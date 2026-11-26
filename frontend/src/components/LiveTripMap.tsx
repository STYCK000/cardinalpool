import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
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

interface LiveTripMapProps {
  tripId: string;
}

const makeBadgeIcon = (bg: string, text: string, label: string, width = 120) =>
  L.divIcon({
    className: 'cardiride-map-badge',
    html: `<div style="background:${bg};color:${text};font-weight:700;font-size:11px;padding:5px 10px;border-radius:999px;border:2px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35);white-space:nowrap;text-align:center;">${label}</div>`,
    iconSize: [width, 28],
    iconAnchor: [Math.round(width / 2), 14],
  });

const stopCircleIcon = (num: number) =>
  L.divIcon({
    className: 'cardiride-stop-circle',
    html: `<div style="background:#F59E0B;color:#111827;font-weight:800;font-size:12px;width:28px;height:28px;border-radius:999px;border:2.5px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;">${num}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

const startIcon = makeBadgeIcon('#059669', '#FFFFFF', 'Start', 64);
const campusIcon = makeBadgeIcon('#991B1B', '#FBBF24', 'Mapúa Intramuros', 132);
const driverIcon = makeBadgeIcon('#0F172A', '#38BDF8', 'Driver Live', 92);
const riderIcon = makeBadgeIcon('#047857', '#FFFFFF', 'Rider Live', 86);

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
    const step = Math.max(1, Math.floor(routeLatLngs.length / 25));
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
    }, 1500);
  };

  if (!trip) {
    return <div className="p-8 text-center text-slate-500">Loading live road map...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Live Dynamic ETA Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-cardinal-700" />
            {myBooking ? `ETA to Your Stop (${myBooking.pickup_label})` : 'Next Pick-Up Stop ETA'}
          </div>
          <div className="mt-1.5 text-2xl font-extrabold text-slate-900">
            {myPickupEta?.driverToPickupMinutes ?? campusEta?.driverToPickupMinutes ?? '—'}{' '}
            <span className="text-sm font-medium text-slate-500">min</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {(myPickupEta?.driverToPickupKm ?? campusEta?.driverToPickupKm) != null
              ? `${myPickupEta?.driverToPickupKm ?? campusEta?.driverToPickupKm} km away`
              : 'Waiting for live driver position'}
          </div>
        </div>

        <div className="bg-cardinal-800 text-white rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-red-200 flex items-center gap-1.5">
            <Navigation className="w-4 h-4 text-gold-400" />
            ETA to Mapúa University Intramuros
          </div>
          <div className="mt-1.5 text-2xl font-extrabold text-gold-400">
            {campusEta?.driverToCampusMinutes ?? '—'}{' '}
            <span className="text-sm font-normal text-red-200">min</span>
          </div>
          <div className="text-xs text-red-200 mt-0.5">
            {campusEta
              ? `${campusEta.driverToCampusKm} km remaining · Est. arrival ${new Date(
                  campusEta.etaToCampusIso
                ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Calculating route...'}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between gap-2">
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-emerald-600" />
            Live Tracking Controls ({Object.keys(liveLocations).length} active pins)
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={toggleRealGps}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                sharingGps
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              {sharingGps ? 'Stop GPS Share' : 'Share My Live GPS'}
            </button>

            <button
              onClick={toggleSimulateDrive}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-slate-100"
              title="Simulates driving along the road route to test live ETA updates"
            >
              {simulating ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {simulating ? 'Stop Demo Drive' : 'Simulate Route'}
            </button>
          </div>
        </div>
      </div>

      {/* Grab / inDrive-Style Road-Following Live Map */}
      <div className="h-[500px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
        <MapContainer center={MAPUA_INTRAMUROS_COORDS} zoom={13} scrollWheelZoom>
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBoundsOnRoute coords={routeLatLngs} />

          {/* Double-stroke road polyline */}
          <Polyline
            positions={routeLatLngs}
            pathOptions={{ color: '#450A0A', weight: 9, opacity: 0.3 }}
          />
          <Polyline
            positions={routeLatLngs}
            pathOptions={{ color: '#DC2626', weight: 5, opacity: 0.95 }}
          />

          <Marker position={[trip.origin_lat, trip.origin_lng]} icon={startIcon}>
            <Popup>
              <strong>Start:</strong> {trip.origin_name}
            </Popup>
          </Marker>

          {trip.pickup_points.map((stop, idx) => {
            const stopRiders = passengers.filter((b) => b.pickup_point_id === stop.id);
            return (
              <Marker key={stop.id} position={[stop.lat, stop.lng]} icon={stopCircleIcon(idx + 1)}>
                <Popup>
                  <div className="text-xs space-y-1">
                    <strong>
                      Stop {idx + 1}: {stop.label}
                    </strong>
                    <p className="text-slate-600">{stop.address}</p>
                    {stopRiders.length > 0 && (
                      <div className="pt-1 border-t border-slate-200">
                        <div className="font-semibold text-slate-800">Riders here:</div>
                        {stopRiders.map((r) => (
                          <div key={r.id} className="text-cardinal-700">
                            • {r.rider_name} ({r.status === 'BOARDED' ? 'Picked Up' : 'Waiting'})
                          </div>
                        ))}
                      </div>
                    )}
                    {pickupEtas[stop.id]?.driverToPickupMinutes != null && (
                      <p className="font-semibold text-cardinal-700">
                        Live Driver ETA: {pickupEtas[stop.id].driverToPickupMinutes} min
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          <Marker position={MAPUA_INTRAMUROS_COORDS} icon={campusIcon}>
            <Popup>
              <strong>Mapúa University — Intramuros</strong>
              <br />
              658 Muralla St, Intramuros, Manila
            </Popup>
          </Marker>

          {Object.values(liveLocations).map((loc) => (
            <Marker
              key={loc.user_id}
              position={[loc.lat, loc.lng]}
              icon={loc.role === 'DRIVER' ? driverIcon : riderIcon}
            >
              <Popup>
                <div className="text-xs">
                  <strong>{loc.full_name}</strong> ({loc.role})
                  <br />
                  Updated: {new Date(loc.updated_at).toLocaleTimeString()}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Passenger Pick-Up Manifest Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
              <UserCheck className="w-5 h-5 text-cardinal-700" />
              {isDriver ? 'Your Passenger Pick-Up Manifest' : 'Carpool Passengers & Stops'} (
              {passengers.length})
            </h3>
            <p className="text-xs text-slate-500">
              Ordered by pick-up stop along your route to Mapúa University Intramuros.
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-600">
            {trip.total_seats - trip.available_seats} / {trip.total_seats} seats filled
          </div>
        </div>

        {passengers.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
            No riders have booked this trip yet. Once Mapúa students or faculty reserve a seat, their name and pick-up stop will show up here.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {passengers.map((b) => {
              const stopEta = pickupEtas[b.pickup_point_id];
              return (
                <div
                  key={b.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-2.5"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <span>{b.rider_name}</span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-semibold">
                          {b.rider_role}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          b.status === 'BOARDED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'COMPLETED'
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {b.status === 'BOARDED' ? 'Picked Up' : b.status}
                      </span>
                    </div>

                    {b.rider_department && (
                      <div className="text-xs text-slate-500">
                        {b.rider_department}
                        {b.rider_university_id ? ` · ID: ${b.rider_university_id}` : ''}
                      </div>
                    )}

                    <div className="pt-1 flex items-start gap-1.5 text-xs">
                      <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-cardinal-900">
                          {b.pickup_sequence ? `Stop ${b.pickup_sequence}: ` : ''}
                          {b.pickup_label}
                        </div>
                        {b.pickup_address && (
                          <div className="text-[11px] text-slate-500">{b.pickup_address}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-xs">
                    <span className="text-slate-600">
                      {stopEta?.driverToPickupMinutes != null
                        ? `Live ETA: ${stopEta.driverToPickupMinutes} min (${stopEta.driverToPickupKm} km)`
                        : `${b.seats_booked} seat · ${b.tokens_escrowed} tokens`}
                    </span>

                    {isDriver && b.status === 'CONFIRMED' && (
                      <button
                        type="button"
                        onClick={() => handleMarkPickedUp(b.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Picked Up
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
