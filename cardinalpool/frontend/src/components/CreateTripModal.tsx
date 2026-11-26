import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Plus, Trash2, X, MapPin } from 'lucide-react';
import { MAPUA_INTRAMUROS_COORDS } from '../types';
import { apiRequest } from '../services/api';

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

const campusIcon = L.divIcon({
  className: 'custom-campus-pin',
  html: `<div style="background:#991B1B;color:#FBBF24;font-weight:800;font-size:11px;padding:4px 8px;border-radius:999px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);white-space:nowrap;">Mapúa Intramuros</div>`,
  iconSize: [120, 26],
  iconAnchor: [60, 13],
});

function MapClickPicker({ onAddPoint }: { onAddPoint: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onAddPoint(Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5)));
    },
  });
  return null;
}

export const CreateTripModal: React.FC<CreateTripModalProps> = ({ onClose, onCreated }) => {
  // Default departure: 30 hours from now (safely past the 24-hour advance booking requirement)
  const defaultDeparture = new Date(Date.now() + 30 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  const [originName, setOriginName] = useState('SM North EDSA, Quezon City');
  const [originLat, setOriginLat] = useState(14.6565);
  const [originLng, setOriginLng] = useState(121.0305);
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
      estimatedOffsetMinutes: 20,
    },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleMapClick = (lat: number, lng: number) => {
    setPickups((prev) => [
      ...prev,
      {
        label: `Custom Stop ${prev.length + 1}`,
        address: `Pinned at ${lat}, ${lng}`,
        lat,
        lng,
        estimatedOffsetMinutes: (prev.length + 1) * 10,
      },
    ]);
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
          originName,
          originLat: Number(originLat),
          originLng: Number(originLng),
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

  const previewLine: [number, number][] = [
    [originLat, originLng],
    ...pickups.map((p): [number, number] => [p.lat, p.lng]),
    MAPUA_INTRAMUROS_COORDS,
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden my-8">
        <div className="bg-cardinal-800 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">Post a Carpool to Mapúa University Intramuros</h2>
            <p className="text-xs text-red-200">
              Destination is fixed to 658 Muralla St, Intramuros, Manila. Schedule at least 24 hours ahead.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-cardinal-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Starting Origin Name
              </label>
              <input
                type="text"
                required
                value={originName}
                onChange={(e) => setOriginName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Origin Lat</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={originLat}
                  onChange={(e) => setOriginLat(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Origin Lng</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={originLng}
                  onChange={(e) => setOriginLng(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3 sm:col-span-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Departure (&gt;24h)
                </label>
                <input
                  type="datetime-local"
                  required
                  value={departureLocal}
                  onChange={(e) => setDepartureLocal(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Token Cost</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  required
                  value={tokenCost}
                  onChange={(e) => setTokenCost(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Along-the-Way Pick-Up Points (Click map to add)
                </label>
                <button
                  type="button"
                  onClick={() => handleMapClick(14.6095, 120.9896)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-cardinal-700 hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Stop
                </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {pickups.map((stop, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-cardinal-700 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        required
                        value={stop.label}
                        onChange={(e) => updatePickup(idx, 'label', e.target.value)}
                        placeholder="Stop name (e.g. UST España Gate 2)"
                        className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => removePickup(idx)}
                        disabled={pickups.length <= 1}
                        className="text-slate-400 hover:text-red-600 disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={stop.address}
                      onChange={(e) => updatePickup(idx, 'address', e.target.value)}
                      placeholder="Landmark / street address"
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Trip Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Passing Quezon Ave -> España Blvd"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-lg bg-cardinal-700 hover:bg-cardinal-800 text-white text-xs font-semibold disabled:opacity-50"
              >
                {submitting ? 'Publishing...' : 'Publish Trip to Intramuros'}
              </button>
            </div>
          </div>

          {/* Interactive Map Picker */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <MapPin className="w-4 h-4 text-cardinal-700" />
              Click anywhere along your route to drop a custom pick-up point.
            </div>
            <div className="h-[380px] rounded-xl overflow-hidden border border-slate-200">
              <MapContainer center={[14.615, 121.0]} zoom={12} scrollWheelZoom>
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickPicker onAddPoint={handleMapClick} />
                <Polyline positions={previewLine} pathOptions={{ color: '#991B1B', weight: 4 }} />
                <Marker position={[originLat, originLng]}>
                  <Popup>Start: {originName}</Popup>
                </Marker>
                {pickups.map((p, idx) => (
                  <Marker key={idx} position={[p.lat, p.lng]}>
                    <Popup>
                      Stop {idx + 1}: {p.label}
                    </Popup>
                  </Marker>
                ))}
                <Marker position={MAPUA_INTRAMUROS_COORDS} icon={campusIcon}>
                  <Popup>Fixed Destination: Mapúa University Intramuros</Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
