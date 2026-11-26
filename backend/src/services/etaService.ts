import { env } from '../config/env';
import { MAPUA_INTRAMUROS_DESTINATION } from '../config/constants';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  geojson: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  source: 'OSRM' | 'HAVERSINE_FALLBACK';
}

export interface LiveEtaSummary {
  driverToPickupMinutes: number | null;
  driverToPickupKm: number | null;
  etaToPickupIso: string | null;
  driverToCampusMinutes: number;
  driverToCampusKm: number;
  etaToCampusIso: string;
  calculatedAt: string;
  source: 'OSRM' | 'HAVERSINE_FALLBACK';
}

const EARTH_RADIUS_KM = 6371;
// Typical Metro Manila urban driving speed fallback (km/h) when OSRM is unreachable
const METRO_MANILA_FALLBACK_SPEED_KMH = 22;

export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Fetches a full driving route from origin -> ordered pick-up points -> Mapúa Intramuros via OSRM.
 * Falls back cleanly to a straight-line polyline + Metro Manila urban speed estimate if OSRM is unreachable.
 */
export async function computeDrivingRoute(waypoints: LatLng[]): Promise<RouteResult> {
  if (waypoints.length < 2) {
    throw new Error('At least two waypoints are required to compute a route.');
  }

  const coordString = waypoints.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `${env.osrmBaseUrl}/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (response.ok) {
      const data = (await response.json()) as {
        code: string;
        routes?: Array<{
          distance: number;
          duration: number;
          geometry: { type: 'LineString'; coordinates: [number, number][] };
        }>;
      };

      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const best = data.routes[0];
        return {
          distanceMeters: best.distance,
          durationSeconds: best.duration,
          geojson: best.geometry,
          source: 'OSRM',
        };
      }
    }
  } catch {
    // Fallback below
  }

  // Haversine fallback with 1.28 road-winding factor for Metro Manila streets
  let totalKm = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    totalKm += haversineDistanceKm(waypoints[i], waypoints[i + 1]) * 1.28;
  }

  const durationSeconds = Math.max(60, Math.round((totalKm / METRO_MANILA_FALLBACK_SPEED_KMH) * 3600));
  return {
    distanceMeters: Math.round(totalKm * 1000),
    durationSeconds,
    geojson: {
      type: 'LineString',
      coordinates: waypoints.map((p) => [p.lng, p.lat]),
    },
    source: 'HAVERSINE_FALLBACK',
  };
}

/**
 * Calculates dynamic live ETAs from the driver's current GPS position:
 *   1. ETA to the rider's selected pick-up point (if provided)
 *   2. ETA to Mapúa University Intramuros (via remaining pick-up point if not yet reached)
 */
export async function calculateDynamicEta(params: {
  driverPos: LatLng;
  pickupPos?: LatLng | null;
  currentSpeedKmh?: number | null;
  now?: Date;
}): Promise<LiveEtaSummary> {
  const now = params.now ?? new Date();
  const campusPos: LatLng = {
    lat: MAPUA_INTRAMUROS_DESTINATION.lat,
    lng: MAPUA_INTRAMUROS_DESTINATION.lng,
  };

  let driverToPickupMinutes: number | null = null;
  let driverToPickupKm: number | null = null;
  let etaToPickupIso: string | null = null;
  let source: 'OSRM' | 'HAVERSINE_FALLBACK' = 'HAVERSINE_FALLBACK';

  if (params.pickupPos) {
    const legToPickup = await computeDrivingRoute([params.driverPos, params.pickupPos]);
    source = legToPickup.source;
    driverToPickupKm = Number((legToPickup.distanceMeters / 1000).toFixed(2));
    driverToPickupMinutes = Math.max(1, Math.round(legToPickup.durationSeconds / 60));
    etaToPickupIso = new Date(now.getTime() + driverToPickupMinutes * 60_000).toISOString();

    const legPickupToCampus = await computeDrivingRoute([params.pickupPos, campusPos]);
    const totalKm = Number(((legToPickup.distanceMeters + legPickupToCampus.distanceMeters) / 1000).toFixed(2));
    const totalMinutes = Math.max(
      driverToPickupMinutes + 1,
      Math.round((legToPickup.durationSeconds + legPickupToCampus.durationSeconds) / 60)
    );

    return {
      driverToPickupMinutes,
      driverToPickupKm,
      etaToPickupIso,
      driverToCampusMinutes: totalMinutes,
      driverToCampusKm: totalKm,
      etaToCampusIso: new Date(now.getTime() + totalMinutes * 60_000).toISOString(),
      calculatedAt: now.toISOString(),
      source,
    };
  }

  const directToCampus = await computeDrivingRoute([params.driverPos, campusPos]);
  source = directToCampus.source;
  const campusKm = Number((directToCampus.distanceMeters / 1000).toFixed(2));

  // If live speed is available and we used Haversine fallback, refine ETA using smoothed speed
  let campusMinutes = Math.max(1, Math.round(directToCampus.durationSeconds / 60));
  if (source === 'HAVERSINE_FALLBACK' && params.currentSpeedKmh && params.currentSpeedKmh >= 8) {
    const blendedSpeed = Math.min(60, Math.max(10, params.currentSpeedKmh * 0.6 + METRO_MANILA_FALLBACK_SPEED_KMH * 0.4));
    campusMinutes = Math.max(1, Math.round((campusKm / blendedSpeed) * 60));
  }

  return {
    driverToPickupMinutes: null,
    driverToPickupKm: null,
    etaToPickupIso: null,
    driverToCampusMinutes: campusMinutes,
    driverToCampusKm: campusKm,
    etaToCampusIso: new Date(now.getTime() + campusMinutes * 60_000).toISOString(),
    calculatedAt: now.toISOString(),
    source,
  };
}
