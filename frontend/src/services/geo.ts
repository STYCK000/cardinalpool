export interface GeoPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface RoadRouteResult {
  coordinates: [number, number][]; // [lat, lng] pairs for Leaflet Polyline
  distanceKm: number;
  durationMinutes: number;
  legDurationsMinutes: number[];
}

// Metro Manila bounding box bias (left, top, right, bottom)
const METRO_MANILA_VIEWBOX = '120.85,14.82,121.22,14.35';

/**
 * Searches real places/landmarks/streets in Metro Manila & the Philippines
 * (Google Maps-style autocomplete using OpenStreetMap Nominatim — no API key needed).
 */
export async function searchPlaces(query: string): Promise<GeoPlace[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const params = new URLSearchParams({
    q: trimmed,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '6',
    countrycodes: 'ph',
    viewbox: METRO_MANILA_VIEWBOX,
    bounded: '0',
  });

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];

  const items = (await res.json()) as Array<{
    name?: string;
    display_name: string;
    lat: string;
    lon: string;
    address?: Record<string, string>;
  }>;

  return items.map((item) => {
    const parts = item.display_name.split(',').map((s) => s.trim());
    const name = item.name?.trim() || parts[0] || 'Selected Location';
    const address = parts.slice(0, 4).join(', ');
    return {
      name,
      address,
      lat: Number(item.lat),
      lng: Number(item.lon),
    };
  });
}

/**
 * Reverse-geocodes a clicked/pinned map point into a human-readable landmark name & street address.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoPlace> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'jsonv2',
      addressdetails: '1',
      zoom: '18',
    });

    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });

    if (res.ok) {
      const data = (await res.json()) as {
        name?: string;
        display_name?: string;
        address?: Record<string, string>;
      };
      const addr = data.address || {};
      const landmark =
        data.name ||
        addr.amenity ||
        addr.building ||
        addr.shop ||
        addr.road ||
        addr.suburb ||
        addr.neighbourhood ||
        'Pinned Stop';
      const streetParts = [addr.road, addr.suburb || addr.neighbourhood, addr.city || addr.town]
        .filter(Boolean)
        .join(', ');

      return {
        name: landmark,
        address: streetParts || data.display_name?.split(',').slice(0, 4).join(', ') || 'Metro Manila',
        lat,
        lng,
      };
    }
  } catch {
    // Graceful fallback below
  }

  return {
    name: 'Pinned Location',
    address: 'Metro Manila',
    lat,
    lng,
  };
}

/**
 * Computes a real road-following driving path (Grab / inDrive style) through all waypoints
 * using OSRM's driving router. Returns [lat, lng] coordinates plus distance & ETA per leg.
 */
export async function fetchRoadRoute(
  waypoints: Array<{ lat: number; lng: number }>
): Promise<RoadRouteResult> {
  if (waypoints.length < 2) {
    return {
      coordinates: waypoints.map((w) => [w.lat, w.lng]),
      distanceKm: 0,
      durationMinutes: 0,
      legDurationsMinutes: [],
    };
  }

  const coordStr = waypoints.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as {
        code: string;
        routes?: Array<{
          distance: number;
          duration: number;
          geometry: { coordinates: [number, number][] };
          legs?: Array<{ duration: number }>;
        }>;
      };

      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const best = data.routes[0];
        return {
          coordinates: best.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
          distanceKm: Number((best.distance / 1000).toFixed(1)),
          durationMinutes: Math.max(1, Math.round(best.duration / 60)),
          legDurationsMinutes: (best.legs || []).map((l) => Math.max(1, Math.round(l.duration / 60))),
        };
      }
    }
  } catch {
    // Fallback below if OSRM is temporarily unreachable
  }

  return {
    coordinates: waypoints.map((w) => [w.lat, w.lng]),
    distanceKm: 0,
    durationMinutes: 0,
    legDurationsMinutes: waypoints.slice(1).map(() => 10),
  };
}
