import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Clock, Crosshair, Loader2, MapPin, Navigation, Route, Search, Trash2, X } from 'lucide-react';
import { MAPUA_INTRAMUROS_COORDS } from '../types';
import { apiRequest } from '../services/api';
import { fetchRoadRoute, GeoPlace, reverseGeocode, searchPlaces } from '../services/geo';
import { BaseTiles, campusIcon, routeStyles, startIcon, stopIcon } from './MapKit';
import { Spinner, btn, inputCls, labelCls } from './ui';

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

  // Close with Escape and keep the page behind from scrolling
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const dropdownCls =
    'absolute z-20 left-0 right-0 mt-1.5 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-surface shadow-lift animate-fade-in divide-y divide-slate-100';

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/30 dark:bg-black/60 backdrop-blur-md animate-overlay-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-trip-title"
    >
      <div
        className="flex min-h-full items-end justify-center sm:items-center sm:p-6"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="w-full max-w-6xl overflow-hidden rounded-t-[28px] bg-surface shadow-lift animate-sheet-in sm:rounded-[28px]">
          <div className="flex items-start justify-between gap-4 bg-cardinal-800 px-5 py-4 text-white sm:px-6">
            <div>
              <h2 id="create-trip-title" className="text-lg font-semibold tracking-tight">
                Post a ride to Mapúa Intramuros
              </h2>
              <p className="mt-0.5 text-xs text-red-200">
                Search for a landmark or tap the map to set your start and pick-up stops.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-xl p-1.5 text-red-100 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-12">
            {/* Left panel: route and trip details */}
            <div className="space-y-5 lg:col-span-5">
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 animate-fade-in"
                >
                  {error}
                </div>
              )}

              {/* Starting location */}
              <div className="relative">
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="trip-origin" className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" />
                    Starting point
                  </label>
                  <button
                    type="button"
                    onClick={() => setMapPinMode(mapPinMode === 'START' ? 'PICKUP' : 'START')}
                    aria-pressed={mapPinMode === 'START'}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition duration-150 active:scale-95 ${
                      mapPinMode === 'START'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    <Crosshair className="h-3 w-3" />
                    {mapPinMode === 'START' ? 'Tap the map' : 'Pin on map'}
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    id="trip-origin"
                    type="text"
                    required
                    autoComplete="off"
                    value={originQuery}
                    onChange={(e) => setOriginQuery(e.target.value)}
                    placeholder="Search a mall, street or landmark"
                    className={`${inputCls} pl-10 pr-10`}
                  />
                  {searchingOrigin && <Spinner className="absolute right-3.5 top-3 h-4 w-4 text-slate-400" />}
                </div>
                <p className="mt-1.5 truncate text-[11px] text-slate-500">{origin.address}</p>

                {originResults.length > 0 && (
                  <div className={dropdownCls}>
                    {originResults.map((place, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectOrigin(place)}
                        className="w-full px-3.5 py-2.5 text-left transition-colors hover:bg-slate-50"
                      >
                        <div className="text-sm font-semibold text-slate-900">{place.name}</div>
                        <div className="truncate text-xs text-slate-500">{place.address}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Pick-up stops */}
              <div className="relative">
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="trip-stop" className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold-500" />
                    Pick-up stops ({pickups.length})
                  </label>
                  <span className="text-[11px] text-slate-500">Search or tap the map</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    id="trip-stop"
                    type="text"
                    autoComplete="off"
                    value={pickupQuery}
                    onChange={(e) => setPickupQuery(e.target.value)}
                    placeholder="Add a stop, e.g. UST España or LRT Vito Cruz"
                    className={`${inputCls} pl-10 pr-10`}
                  />
                  {searchingPickup && <Spinner className="absolute right-3.5 top-3 h-4 w-4 text-slate-400" />}
                </div>

                {pickupResults.length > 0 && (
                  <div className={dropdownCls}>
                    {pickupResults.map((place, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAddPickupFromSearch(place)}
                        className="w-full px-3.5 py-2.5 text-left transition-colors hover:bg-amber-50"
                      >
                        <div className="text-sm font-semibold text-slate-900">{place.name}</div>
                        <div className="truncate text-xs text-slate-500">{place.address}</div>
                      </button>
                    ))}
                  </div>
                )}

                <ul className="mt-2.5 max-h-60 space-y-2 overflow-y-auto pr-0.5">
                  {pickups.map((stop, idx) => (
                    <li
                      key={idx}
                      className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-2.5 animate-fade-in"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-400 text-[11px] font-semibold text-[#1d1d1f]">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          required
                          aria-label={`Name of stop ${idx + 1}`}
                          value={stop.label}
                          onChange={(e) => updatePickup(idx, 'label', e.target.value)}
                          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-surface px-2.5 py-1.5 text-sm font-semibold focus:border-cardinal-600 focus:outline-none focus:ring-4 focus:ring-cardinal-600/10"
                        />
                        <span className="whitespace-nowrap text-xs font-medium tabular-nums text-slate-500">
                          +{stop.estimatedOffsetMinutes} min
                        </span>
                        <button
                          type="button"
                          onClick={() => removePickup(idx)}
                          disabled={pickups.length <= 1}
                          aria-label={`Remove stop ${idx + 1}`}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="truncate pl-8 text-[11px] text-slate-500">{stop.address}</div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Fixed destination */}
              <div className="flex items-center gap-3 rounded-xl border border-cardinal-100 bg-cardinal-50 px-3.5 py-3">
                <Navigation className="h-4 w-4 shrink-0 text-accent" />
                <div>
                  <div className="text-sm font-semibold text-accent">Mapúa University Intramuros</div>
                  <div className="text-xs text-accent">658 Muralla St, Intramuros, Manila. Fixed destination.</div>
                </div>
              </div>

              {/* Schedule, seats and tokens */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label htmlFor="trip-departure" className={labelCls}>
                    Departure
                  </label>
                  <input
                    id="trip-departure"
                    type="datetime-local"
                    required
                    value={departureLocal}
                    onChange={(e) => setDepartureLocal(e.target.value)}
                    className={inputCls}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Must be more than 24 hours from now.</p>
                </div>
                <div>
                  <label htmlFor="trip-seats" className={labelCls}>
                    Seats
                  </label>
                  <input
                    id="trip-seats"
                    type="number"
                    min={1}
                    max={8}
                    required
                    value={totalSeats}
                    onChange={(e) => setTotalSeats(Number(e.target.value))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="trip-tokens" className={labelCls}>
                    Tokens per seat
                  </label>
                  <input
                    id="trip-tokens"
                    type="number"
                    min={1}
                    max={500}
                    required
                    value={tokenCost}
                    onChange={(e) => setTokenCost(Number(e.target.value))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="trip-notes" className={labelCls}>
                  Note for riders (optional)
                </label>
                <input
                  id="trip-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="White SUV, hazard lights on"
                  className={inputCls}
                />
              </div>

              <div className="sticky bottom-0 -mx-1 flex justify-end gap-2 border-t border-slate-100 bg-surface/95 px-1 pb-1 pt-4 backdrop-blur">
                <button type="button" onClick={onClose} className={btn('secondary')}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className={btn('primary')}>
                  {submitting && <Spinner />}
                  {submitting ? 'Publishing' : 'Publish ride'}
                </button>
              </div>
            </div>

            {/* Right panel: road-following map */}
            <div className="flex flex-col gap-3 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-slate-700">
                  <MapPin className="h-4 w-4 text-accent" />
                  {mapPinMode === 'START'
                    ? 'Tap the map to set your starting point'
                    : 'Tap the map to add a pick-up stop'}
                </div>
                {loadingRoute ? (
                  <span className="inline-flex items-center gap-1.5 text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Snapping route to roads
                  </span>
                ) : (
                  routeDistanceKm > 0 && (
                    <div className="inline-flex items-center gap-3 rounded-full bg-[#1d1d1f] dark:bg-slate-200 px-3 py-1 text-[11px] font-semibold text-white">
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Route className="h-3.5 w-3.5 text-gold-400" />
                        {routeDistanceKm} km
                      </span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="h-3.5 w-3.5 text-emerald-400" />
                        about {routeDurationMin} min
                      </span>
                    </div>
                  )
                )}
              </div>

              <div className="relative h-[360px] overflow-hidden rounded-2xl border border-slate-200 sm:h-[460px] lg:h-[600px] [&_.leaflet-container]:cursor-crosshair">
                {resolvingPin && (
                  <div className="pointer-events-none absolute left-1/2 top-3 z-[500] -translate-x-1/2 animate-fade-in">
                    <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-lift">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                      Finding that address
                    </span>
                  </div>
                )}
                <MapContainer center={[14.615, 121.0]} zoom={12} scrollWheelZoom>
                  <BaseTiles />
                  <MapClickPicker onPick={handleMapClick} />
                  <FitRouteBounds coords={roadCoords} />

                  <Polyline positions={roadCoords} pathOptions={routeStyles.casing} />
                  <Polyline positions={roadCoords} pathOptions={routeStyles.line} />

                  <Marker position={[origin.lat, origin.lng]} icon={startIcon}>
                    <Popup>
                      <strong>Start</strong>
                      <br />
                      {origin.name}
                      <br />
                      <span className="text-slate-500">{origin.address}</span>
                    </Popup>
                  </Marker>

                  {pickups.map((p, idx) => (
                    <Marker key={idx} position={[p.lat, p.lng]} icon={stopIcon(idx + 1)}>
                      <Popup>
                        <strong>
                          Stop {idx + 1}, {p.label}
                        </strong>
                        <br />
                        <span className="text-slate-500">{p.address}</span>
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
    </div>
  );
};
