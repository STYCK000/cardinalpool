import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Play,
  Radio,
  Square,
  UserCheck,
  Users,
} from 'lucide-react';
import { LiveEtaSummary, LiveLocation, MAPUA_INTRAMUROS_COORDS, Trip } from '../types';
import { apiRequest } from '../services/api';
import { getTrackingSocket } from '../services/socket';
import { fetchRoadRoute } from '../services/geo';
import { useAuth } from '../context/AuthContext';
import { BaseTiles, SmoothCarMarker, campusIcon, riderIcon, routeStyles, startIcon, stopIcon } from './MapKit';
import { TripChatPanel } from './TripChatPanel';
import { Pill, Skeleton, Spinner, StatusPill, btn, cardCls } from './ui';

interface LiveTripMapProps {
  tripId: string;
}

function FitBoundsOnRoute({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length >= 2) {
      map.fitBounds(L.latLngBounds(coords), { padding: [50, 50], maxZoom: 15 });
    }
  }, [coords, map]);
  return null;
}

export const LiveTripMap: React.FC<LiveTripMapProps> = ({ tripId }) => {
  const { user } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [routeLatLngs, setRouteLatLngs] = useState<[number, number][]>([MAPUA_INTRAMUROS_COORDS]);
  const [liveLocations, setLiveLocations] = useState<Record<string, LiveLocation>>({});
  const [campusEta, setCampusEta] = useState<LiveEtaSummary | null>(null);
  const [pickupEtas, setPickupEtas] = useState<Record<string, LiveEtaSummary>>({});
  const [sharingGps, setSharingGps] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const simTimerRef = useRef<number | null>(null);

  const loadTripDetails = async (activeCheck?: () => boolean) => {
    const res = await apiRequest<{ trip: Trip }>(`/trips/${tripId}`);
    if (activeCheck && !activeCheck()) return;
    const loadedTrip = res.trip;
    setTrip(loadedTrip);
    if (loadedTrip.eta) setCampusEta(loadedTrip.eta);

    const map: Record<string, LiveLocation> = {};
    (loadedTrip.live_locations || []).forEach((loc) => {
      map[loc.user_id] = loc;
    });
    setLiveLocations(map);

    const savedCoords = loadedTrip.route_geojson?.coordinates || [];
    if (savedCoords.length > loadedTrip.pickup_points.length + 4) {
      setRouteLatLngs(savedCoords.map(([lng, lat]) => [lat, lng]));
    } else {
      const waypoints = [
        { lat: loadedTrip.origin_lat, lng: loadedTrip.origin_lng },
        ...loadedTrip.pickup_points.map((p) => ({ lat: p.lat, lng: p.lng })),
        { lat: MAPUA_INTRAMUROS_COORDS[0], lng: MAPUA_INTRAMUROS_COORDS[1] },
      ];
      const road = await fetchRoadRoute(waypoints);
      if (!activeCheck || activeCheck()) setRouteLatLngs(road.coordinates);
    }
  };

  useEffect(() => {
    let active = true;
    loadTripDetails(() => active);

    const socket = getTrackingSocket();
    socket.emit('trip:join', tripId);

    const handleSnapshot = (locs: LiveLocation[]) => {
      const map: Record<string, LiveLocation> = {};
      locs.forEach((l) => {
        map[l.user_id] = l;
      });
      setLiveLocations(map);
    };

    const handleBroadcast = (loc: LiveLocation) => {
      if (loc.trip_id !== tripId) return;
      setLiveLocations((prev) => ({ ...prev, [loc.user_id]: loc }));
    };

    const handleEtaUpdate = (payload: {
      tripId: string;
      campusEta: LiveEtaSummary;
      pickupEtas: Record<string, LiveEtaSummary>;
    }) => {
      if (payload.tripId !== tripId) return;
      setCampusEta(payload.campusEta);
      setPickupEtas(payload.pickupEtas);
    };

    socket.on('trip:locations_snapshot', handleSnapshot);
    socket.on('location:broadcast', handleBroadcast);
    socket.on('eta:update', handleEtaUpdate);

    return () => {
      active = false;
      socket.emit('trip:leave', tripId);
      socket.off('trip:locations_snapshot', handleSnapshot);
      socket.off('location:broadcast', handleBroadcast);
      socket.off('eta:update', handleEtaUpdate);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (simTimerRef.current !== null) window.clearInterval(simTimerRef.current);
    };
  }, [tripId]);

  const isDriver = user?.id === trip?.driver_id;
  const myBooking = trip?.bookings?.find((b) => b.rider_id === user?.id);
  const myPickupEta = myBooking ? pickupEtas[myBooking.pickup_point_id] : null;
  const passengers = trip?.bookings || [];

  const handleMarkPickedUp = async (bookingId: string) => {
    await apiRequest(`/bookings/${bookingId}/board`, { method: 'POST' });
    await loadTripDetails();
  };

  const toggleRealGps = () => {
    if (sharingGps) {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setSharingGps(false);
      return;
    }

    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser. Use Simulate Route below for testing.');
      return;
    }

    const socket = getTrackingSocket();
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        socket.emit('location:update', {
          tripId,
          role: isDriver ? 'DRIVER' : 'RIDER',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading ?? undefined,
          speedKmh: pos.coords.speed ? pos.coords.speed * 3.6 : 24,
        });
      },
      () => setSharingGps(false),
      { enableHighAccuracy: true, maximumAge: 3000 }
    );
    setSharingGps(true);
  };

  const toggleSimulateDrive = () => {
    if (simulating) {
      if (simTimerRef.current !== null) window.clearInterval(simTimerRef.current);
      simTimerRef.current = null;
      setSimulating(false);
      return;
    }

    const socket = getTrackingSocket();
    let idx = 0;
    const step = Math.max(1, Math.floor(routeLatLngs.length / 45));
    setSimulating(true);
    simTimerRef.current = window.setInterval(() => {
      if (idx >= routeLatLngs.length) {
        if (simTimerRef.current !== null) window.clearInterval(simTimerRef.current);
        setSimulating(false);
        return;
      }
      const [lat, lng] = routeLatLngs[idx];
      socket.emit('location:update', {
        tripId,
        role: isDriver ? 'DRIVER' : 'RIDER',
        lat,
        lng,
        speedKmh: 28,
      });
      if (idx === routeLatLngs.length - 1) {
        idx = routeLatLngs.length;
      } else {
        idx = Math.min(routeLatLngs.length - 1, idx + step);
      }
    }, 1000);
  };

  const [markingId, setMarkingId] = useState<string | null>(null);
  const driverIsLive = Object.values(liveLocations).some((l) => l.role === 'DRIVER');

  const markPickedUp = async (bookingId: string) => {
    setMarkingId(bookingId);
    try {
      await handleMarkPickedUp(bookingId);
    } finally {
      setMarkingId(null);
    }
  };

  if (!trip) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-[420px] rounded-2xl sm:h-[520px]" />
      </div>
    );
  }

  const stopEtaMinutes = myPickupEta?.driverToPickupMinutes ?? campusEta?.driverToPickupMinutes;
  const stopEtaKm = myPickupEta?.driverToPickupKm ?? campusEta?.driverToPickupKm;

  return (
    <div className="space-y-4">
      {/* ETA and controls */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={`${cardCls} p-5`}>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Clock className="h-4 w-4 text-cardinal-700" />
            {myBooking ? `ETA to your stop, ${myBooking.pickup_label}` : 'ETA to next pick-up stop'}
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="font-display text-4xl font-semibold tabular-nums text-slate-900">
              {stopEtaMinutes ?? '--'}
            </span>
            <span className="text-sm font-medium text-slate-500">min</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {stopEtaKm != null ? `${stopEtaKm} km away` : 'Waiting for the driver to share a live position'}
          </div>
        </div>

        <div className="rounded-2xl bg-cardinal-800 p-5 text-white shadow-card">
          <div className="flex items-center gap-2 text-xs font-semibold text-red-200">
            <Navigation className="h-4 w-4 text-gold-400" />
            ETA to Mapúa Intramuros
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="font-display text-4xl font-semibold tabular-nums text-gold-400">
              {campusEta?.driverToCampusMinutes ?? '--'}
            </span>
            <span className="text-sm text-red-200">min</span>
          </div>
          <div className="mt-1 text-xs text-red-200">
            {campusEta
              ? `${campusEta.driverToCampusKm} km to go, arriving about ${new Date(
                  campusEta.etaToCampusIso
                ).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
              : 'Calculating route'}
          </div>
        </div>

        <div className={`${cardCls} flex flex-col justify-between gap-3 p-5`}>
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-600" />
              Live tracking
            </span>
            {driverIsLive ? (
              <Pill tone="green" live>
                Driver is live
              </Pill>
            ) : (
              <Pill>Driver offline</Pill>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleRealGps}
              aria-pressed={sharingGps}
              className={sharingGps ? btn('success', 'sm') : btn('secondary', 'sm')}
            >
              <Radio className="h-3.5 w-3.5" />
              {sharingGps ? 'Stop sharing GPS' : 'Share my GPS'}
            </button>
            <button
              type="button"
              onClick={toggleSimulateDrive}
              title="Simulates driving along the route so you can test live ETA updates"
              className={btn('ghost', 'sm')}
            >
              {simulating ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {simulating ? 'Stop demo drive' : 'Simulate route'}
            </button>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="h-[420px] overflow-hidden rounded-2xl border border-slate-200/80 shadow-card sm:h-[540px]">
        <MapContainer center={MAPUA_INTRAMUROS_COORDS} zoom={13} scrollWheelZoom>
          <BaseTiles />
          <FitBoundsOnRoute coords={routeLatLngs} />

          <Polyline positions={routeLatLngs} pathOptions={routeStyles.casing} />
          <Polyline positions={routeLatLngs} pathOptions={routeStyles.line} />

          <Marker position={[trip.origin_lat, trip.origin_lng]} icon={startIcon}>
            <Popup>
              <strong>Start</strong>
              <br />
              {trip.origin_name}
            </Popup>
          </Marker>

          {trip.pickup_points.map((stop, idx) => {
            const stopRiders = passengers.filter((b) => b.pickup_point_id === stop.id);
            return (
              <Marker key={stop.id} position={[stop.lat, stop.lng]} icon={stopIcon(idx + 1)}>
                <Popup>
                  <div className="space-y-1 text-xs">
                    <strong>
                      Stop {idx + 1}, {stop.label}
                    </strong>
                    <p className="text-slate-600">{stop.address}</p>
                    {stopRiders.length > 0 && (
                      <div className="border-t border-slate-200 pt-1">
                        <div className="font-semibold text-slate-800">Riders here</div>
                        {stopRiders.map((r) => (
                          <div key={r.id} className="text-cardinal-700">
                            {r.rider_name} ({r.status === 'BOARDED' ? 'picked up' : 'waiting'})
                          </div>
                        ))}
                      </div>
                    )}
                    {pickupEtas[stop.id]?.driverToPickupMinutes != null && (
                      <p className="font-semibold text-cardinal-700">
                        Driver ETA {pickupEtas[stop.id].driverToPickupMinutes} min
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          <Marker position={MAPUA_INTRAMUROS_COORDS} icon={campusIcon}>
            <Popup>
              <strong>Mapúa University Intramuros</strong>
              <br />
              658 Muralla St, Intramuros, Manila
            </Popup>
          </Marker>

          {Object.values(liveLocations).map((loc) =>
            loc.role === 'DRIVER' ? (
              <SmoothCarMarker
                key={loc.user_id}
                position={[loc.lat, loc.lng]}
                heading={loc.heading}
                driverName={loc.full_name}
                updatedAt={loc.updated_at}
                durationMs={950}
              />
            ) : (
              <Marker key={loc.user_id} position={[loc.lat, loc.lng]} icon={riderIcon}>
                <Popup>
                  <div className="text-xs">
                    <strong>{loc.full_name}</strong> (Rider)
                    <br />
                    Updated {new Date(loc.updated_at).toLocaleTimeString()}
                  </div>
                </Popup>
              </Marker>
            )
          )}
        </MapContainer>
      </div>

      {/* Passenger manifest */}
      {/* Real-Time Driver <-> Rider Chat */}
      <TripChatPanel tripId={tripId} isDriver={isDriver} />

      <section className={`${cardCls} space-y-4 p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <UserCheck className="h-5 w-5 text-cardinal-700" />
              {isDriver ? 'Your pick-up list' : 'Passengers and stops'} ({passengers.length})
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">Ordered by pick-up stop along the route to Intramuros.</p>
          </div>
          <div className="text-xs font-semibold text-slate-600">
            {trip.total_seats - trip.available_seats} of {trip.total_seats} seats filled
          </div>
        </div>

        {passengers.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
            Nobody has booked this trip yet. Riders and their pick-up stops will appear here.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {passengers.map((b) => {
              const stopEta = pickupEtas[b.pickup_point_id];
              return (
                <div
                  key={b.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-900">
                        {b.rider_name}
                        <Pill>{b.rider_role === 'FACULTY' ? 'Faculty' : 'Student'}</Pill>
                      </div>
                      <StatusPill status={b.status} />
                    </div>

                    {b.rider_department && (
                      <div className="text-xs text-slate-500">
                        {b.rider_department}
                        {b.rider_university_id ? `, ID ${b.rider_university_id}` : ''}
                      </div>
                    )}

                    <div className="flex items-start gap-1.5 pt-1 text-xs">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
                      <div>
                        <div className="font-semibold text-cardinal-900">
                          {b.pickup_sequence ? `Stop ${b.pickup_sequence} at ` : ''}
                          {b.pickup_label}
                        </div>
                        {b.pickup_address && <div className="text-[11px] text-slate-500">{b.pickup_address}</div>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-slate-200/80 pt-3 text-xs">
                    <span className="tabular-nums text-slate-600">
                      {stopEta?.driverToPickupMinutes != null
                        ? `Driver ETA ${stopEta.driverToPickupMinutes} min (${stopEta.driverToPickupKm} km)`
                        : `${b.seats_booked} seat, ${b.tokens_escrowed} tokens`}
                    </span>

                    {isDriver && b.status === 'CONFIRMED' && (
                      <button
                        type="button"
                        disabled={markingId === b.id}
                        onClick={() => markPickedUp(b.id)}
                        className={btn('success', 'sm')}
                      >
                        {markingId === b.id ? (
                          <Spinner className="h-3.5 w-3.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Mark picked up
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
