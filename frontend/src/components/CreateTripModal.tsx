import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import {
  Loader2,
  MapPin,
  Navigation,
  Search,
  Trash2,
  X,
  Crosshair,
  Clock,
  Route,
} from 'lucide-react';
import { MAPUA_INTRAMUROS_COORDS } from '../types';
import { apiRequest } from '../services/api';
import { fetchRoadRoute, GeoPlace, reverseGeocode, searchPlaces } from '../services/geo';

interface DraftPickup {
  label: string;
  address: string;
  lat: number;
  lng: number;
  estimatedOffsetMinutes: number;
}

interface CreateTripModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const startPinIcon = L.divIcon({
  className: 'cardiride-pin',
  html: `<div style="background:#059669;color:#fff;font-weight:800;font-size:11px;padding:5px 10px;border-radius:999px;border:2px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35);white-space:nowrap;">Start</div>`,
  iconSize: [64, 28],
  iconAnchor: [32, 14],
});

const campusIcon = L.divIcon({
  className: 'cardiride-pin',
  html: `<div style="background:#991B1B;color:#FBBF24;font-weight:800;font-size:11px;padding:5px 10px;border-radius:999px;border:2px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35);white-space:nowrap;">Mapúa Intramuros</div>`,
  iconSize: [128, 28],
  iconAnchor: [64, 14],
});

const stopPinIcon = (num: number) =>
  L.divIcon({
    className: 'cardiride-pin',
    html: `<div style="background:#F59E0B;color:#111827;font-weight:800;font-size:12px;width:28px;height:28px;border-radius:999px;border:2.5px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;">${num}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

function MapClickPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitRouteBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length >= 2) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
    }
  }, [coords, map]);
  return null;
}

export const CreateTripModal: React.FC<CreateTripModalProps> = ({ onClose, onCreated }) => {
  const defaultDeparture = new Date(Date.now() + 30 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  // Starting point state (no raw lat/lng inputs shown to user)
  const [origin, setOrigin] = useState<GeoPlace>({
    name: 'SM City North EDSA',
    address: 'North Ave cor. EDSA, Quezon City',
    lat: 14.6565,
    lng: 121.0305,
  });
  const [originQuery, setOriginQuery] = useState('SM City North EDSA');
  const [originResults, setOriginResults] = useState<GeoPlace[]>([]);
  const [searchingOrigin, setSearchingOrigin] = useState(false);

  // Pick-up point search state
  const [pickupQuery, setPickupQuery] = useState('');
  const [pickupResults, setPickupResults] = useState<GeoPlace[]>([]);
  const [searchingPickup, setSearchingPickup] = useState(false);

  // Map click mode: either setting the Start location or adding a Pick-up stop
  const [mapPinMode, setMapPinMode] = useState<'PICKUP' | 'START'>('PICKUP');
  const [resolvingPin, setResolvingPin] = useState(false);

  const [departureLocal, setDepartureLocal] = useState(defaultDeparture);
  const [totalSeats, setTotalSeats] = useState(3);
  const [tokenCost, setTokenCost] = useState(15);
  const [notes, setNotes] = useState('');
  const [pickups, setPickups] = useState<DraftPickup[]>([
    {
      label: 'Welcome Rotonda',
      address: 'Quezon Ave cor. España Blvd, Manila',
      lat: 14.6182,
      lng: 121.0002,
      estimatedOffsetMinutes: 18,
    },
  ]);

  // Road-following OSRM polyline + summary
  const [roadCoords, setRoadCoords] = useState<[number, number][]>([
    [14.6565, 121.0305],
    [14.6182, 121.0002],
    MAPUA_INTRAMUROS_COORDS,
  ]);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number>(0);
  const [routeDurationMin, setRouteDurationMin] = useState<number>(0);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Debounced Google Maps-style search for Starting Point
  useEffect(() => {
    if (originQuery.trim() === origin.name || originQuery.trim().length < 3) {
      setOriginResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearchingOrigin(true);
      try {
        setOriginResults(await searchPlaces(originQuery));
      } finally {
        setSearchingOrigin(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [originQuery, origin.name]);

  // Debounced Google Maps-style search for Along-the-Way Pick-Up Point
  useEffect(() => {
    if (pickupQuery.trim().length < 3) {
      setPickupResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearchingPickup(true);
      try {
        setPickupResults(await searchPlaces(pickupQuery));
      } finally {
        setSearchingPickup(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [pickupQuery]);

  // Recompute real road-following route whenever origin or pick-up stops change
  useEffect(() => {
    let active = true;
    const waypoints = [
      { lat: origin.lat, lng: origin.lng },
      ...pickups.map((p) => ({ lat: p.lat, lng: p.lng })),
      { lat: MAPUA_INTRAMUROS_COORDS[0], lng: MAPUA_INTRAMUROS_COORDS[1] },
    ];

    setLoadingRoute(true);
    fetchRoadRoute(waypoints)
      .then((res) => {
        if (!active) return;
        setRoadCoords(res.coordinates);
        setRouteDistanceKm(res.distanceKm);
        setRouteDurationMin(res.durationMinutes);
        if (res.legDurationsMinutes.length >= pickups.length && pickups.length > 0) {
          let cumulative = 0;
          setPickups((prev) =>
            prev.map((p, idx) => {
              cumulative += res.legDurationsMinutes[idx] || 10;
              return { ...p, estimatedOffsetMinutes: cumulative };
            })
          );
        }
      })
      .finally(() => {
        if (active) setLoadingRoute(false);
      });

    return () => {
      active = false;
    };
  }, [origin.lat, origin.lng, pickups.length, pickups.map((p) => `${p.lat},${p.lng}`).join('|')]);

  const handleSelectOrigin = (place: GeoPlace) => {
    setOrigin(place);
    setOriginQuery(place.name);
    setOriginResults([]);
  };

  const handleAddPickupFromSearch = (place: GeoPlace) => {
    setPickups((prev) => [
      ...prev,
      {
        label: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        estimatedOffsetMinutes: (prev.length + 1) * 10,
      },
    ]);
    setPickupQuery('');
    setPickupResults([]);
  };

  const handleMapClick = async (lat: number, lng: number) => {
    setResolvingPin(true);
    try {
      const place = await reverseGeocode(lat, lng);
      if (mapPinMode === 'START') {
        setOrigin(place);
        setOriginQuery(place.name);
        setMapPinMode('PICKUP');
      } else {
        setPickups((prev) => [
          ...prev,
          {
            label: place.name,
            address: place.address,
            lat: place.lat,
            lng: place.lng,
            estimatedOffsetMinutes: (prev.length + 1) * 10,
          },
        ]);
      }
    } finally {
      setResolvingPin(false);
    }
  };

  const updatePickup = (index: number, field: keyof DraftPickup, value: string | number) => {
    setPickups((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const removePickup = (index: number) => {
    setPickups((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await apiRequest('/trips', {
        method: 'POST',
        body: JSON.stringify({
          originName: origin.name,
          originLat: origin.lat,
          originLng: origin.lng,
          departureTime: new Date(departureLocal).toISOString(),
          totalSeats: Number(totalSeats),
          tokenCost: Number(tokenCost),
          notes,
          pickupPoints: pickups,
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl overflow-hidden my-6">
        <div className="bg-cardinal-800 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">Post a CardiRide to Mapúa University Intramuros</h2>
            <p className="text-xs text-red-200">
              Search any landmark or tap the map to pin your start and along-the-way pick-up stops.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-cardinal-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel: Grab / inDrive-style Route & Trip Inputs */}
          <div className="lg:col-span-5 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {error}
              </div>
            )}

            {/* Start Point Search (No lat/lng!) */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                  Starting Location
                </label>
                <button
                  type="button"
                  onClick={() => setMapPinMode(mapPinMode === 'START' ? 'PICKUP' : 'START')}
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full transition ${
                    mapPinMode === 'START'
                      ? 'bg-emerald-600 text-white'
                      : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                  }`}
                >
                  <Crosshair className="w-3 h-3" />
                  {mapPinMode === 'START' ? 'Tap Map Now...' : 'Pin on Map'}
                </button>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={originQuery}
                  onChange={(e) => setOriginQuery(e.target.value)}
                  placeholder="Search mall, street, or landmark..."
                  className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-cardinal-600 focus:outline-none"
                />
                {searchingOrigin && (
                  <Loader2 className="w-4 h-4 text-slate-400 animate-spin absolute right-3 top-2.5" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 truncate">{origin.address}</p>

              {originResults.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {originResults.map((place, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectOrigin(place)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 transition"
                    >
                      <div className="text-xs font-semibold text-slate-900">{place.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{place.address}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Add Pick-Up Stop Search */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  Along-the-Way Pick-Up Stops ({pickups.length})
                </label>
                <span className="text-[11px] text-slate-500">Search or tap map</span>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={pickupQuery}
                  onChange={(e) => setPickupQuery(e.target.value)}
                  placeholder="Add stop (e.g. UST España, LRT Vito Cruz)..."
                  className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                {searchingPickup && (
                  <Loader2 className="w-4 h-4 text-slate-400 animate-spin absolute right-3 top-2.5" />
                )}
              </div>

              {pickupResults.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {pickupResults.map((place, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAddPickupFromSearch(place)}
                      className="w-full text-left px-3 py-2 hover:bg-amber-50 transition"
                    >
                      <div className="text-xs font-semibold text-slate-900">{place.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{place.address}</div>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto pr-1">
                {pickups.map((stop, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-900 text-[11px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        required
                        value={stop.label}
                        onChange={(e) => updatePickup(idx, 'label', e.target.value)}
                        className="flex-1 px-2 py-1 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
                      />
                      <span className="text-[11px] text-slate-500 whitespace-nowrap">
                        +{stop.estimatedOffsetMinutes}m
                      </span>
                      <button
                        type="button"
                        onClick={() => removePickup(idx)}
                        disabled={pickups.length <= 1}
                        className="text-slate-400 hover:text-red-600 disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-500 pl-7 truncate">{stop.address}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fixed Destination Display */}
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-cardinal-50 border border-cardinal-100 text-xs">
              <Navigation className="w-4 h-4 text-cardinal-700 shrink-0" />
              <div>
                <div className="font-bold text-cardinal-900">Mapúa University Intramuros</div>
                <div className="text-[11px] text-cardinal-700">658 Muralla St, Intramuros, Manila (Fixed)</div>
              </div>
            </div>

            {/* Schedule, Seats & Tokens */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-3 sm:col-span-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Departure (&gt;24h)
                </label>
                <input
                  type="datetime-local"
                  required
                  value={departureLocal}
                  onChange={(e) => setDepartureLocal(e.target.value)}
                  className="w-full px-2 py-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Seats</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  required
                  value={totalSeats}
                  onChange={(e) => setTotalSeats(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tokens</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  required
                  value={tokenCost}
                  onChange={(e) => setTokenCost(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                />
              </div>
            </div>

            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional driver note (e.g. White SUV, hazard lights on)"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
            />

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-cardinal-700 hover:bg-cardinal-800 text-white text-xs font-semibold disabled:opacity-50"
              >
                {submitting ? 'Publishing...' : 'Publish CardiRide'}
              </button>
            </div>
          </div>

          {/* Right Panel: Grab / inDrive-Style Road-Following Map */}
          <div className="lg:col-span-7 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                <MapPin className="w-4 h-4 text-cardinal-700" />
                {resolvingPin
                  ? 'Finding landmark name & address...'
                  : mapPinMode === 'START'
                    ? 'Tap anywhere on the map to set your Starting Location'
                    : 'Tap anywhere along the road to drop a Pick-Up Stop'}
              </div>
              <div className="flex items-center gap-2">
                {loadingRoute ? (
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Snapping to roads...
                  </span>
                ) : (
                  routeDistanceKm > 0 && (
                    <div className="inline-flex items-center gap-2.5 bg-slate-900 text-white px-3 py-1 rounded-full text-[11px] font-semibold">
                      <span className="inline-flex items-center gap-1">
                        <Route className="w-3.5 h-3.5 text-gold-400" /> {routeDistanceKm} km
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-emerald-400" /> ~{routeDurationMin} min
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="h-[460px] rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
              <MapContainer center={[14.615, 121.0]} zoom={12} scrollWheelZoom>
                {/* Clean Google Maps / Grab-like CartoDB Voyager basemap */}
                <TileLayer
                  attribution="&copy; OpenStreetMap &copy; CARTO"
                  url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickPicker onPick={handleMapClick} />
                <FitRouteBounds coords={roadCoords} />

                {/* Grab/inDrive-style double-layered road polyline */}
                <Polyline
                  positions={roadCoords}
                  pathOptions={{ color: '#450A0A', weight: 8, opacity: 0.35 }}
                />
                <Polyline
                  positions={roadCoords}
                  pathOptions={{ color: '#DC2626', weight: 5, opacity: 0.95 }}
                />

                <Marker position={[origin.lat, origin.lng]} icon={startPinIcon}>
                  <Popup>
                    <strong>Start:</strong> {origin.name}
                    <br />
                    <span className="text-xs text-slate-500">{origin.address}</span>
                  </Popup>
                </Marker>

                {pickups.map((p, idx) => (
                  <Marker key={idx} position={[p.lat, p.lng]} icon={stopPinIcon(idx + 1)}>
                    <Popup>
                      <strong>
                        Stop {idx + 1}: {p.label}
                      </strong>
                      <br />
                      <span className="text-xs text-slate-500">{p.address}</span>
                    </Popup>
                  </Marker>
                ))}

                <Marker position={MAPUA_INTRAMUROS_COORDS} icon={campusIcon}>
                  <Popup>
                    <strong>Mapúa University Intramuros</strong>
                    <br />
                    658 Muralla St, Intramuros, Manila
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
