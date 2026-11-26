import React, { useState } from 'react';
import { CalendarClock, Car, Coins, MapPin, Navigation, Users, AlertTriangle } from 'lucide-react';
import { Trip } from '../types';

interface TripCardProps {
  trip: Trip;
  isOwnTrip: boolean;
  onBook: (tripId: string, pickupPointId: string) => Promise<void>;
  onOpenMap: (tripId: string) => void;
  onStartTrip?: (tripId: string) => Promise<void>;
  onCompleteTrip?: (tripId: string) => Promise<void>;
}

export const TripCard: React.FC<TripCardProps> = ({
  trip,
  isOwnTrip,
  onBook,
  onOpenMap,
  onStartTrip,
  onCompleteTrip,
}) => {
  const [selectedPickupId, setSelectedPickupId] = useState<string>(
    trip.pickup_points[0]?.id || ''
  );
  const [busy, setBusy] = useState(false);

  const handleBookClick = async () => {
    if (!selectedPickupId) return;
    setBusy(true);
    try {
      await onBook(trip.id, selectedPickupId);
    } finally {
      setBusy(false);
    }
  };

  const departureFormatted = new Date(trip.departure_time).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition p-5 flex flex-col justify-between gap-4">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  trip.status === 'IN_PROGRESS'
                    ? 'bg-emerald-100 text-emerald-800'
                    : trip.status === 'COMPLETED'
                      ? 'bg-slate-200 text-slate-700'
                      : 'bg-cardinal-50 text-cardinal-800'
                }`}
              >
                {trip.status.replace('_', ' ')}
              </span>
              <span className="text-xs text-slate-500">
                {trip.driver_role === 'FACULTY' ? 'Faculty Driver' : 'Student Driver'}
              </span>
            </div>
            <h3 className="font-bold text-slate-900 mt-1 text-base">{trip.origin_name}</h3>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <Navigation className="w-3.5 h-3.5 text-cardinal-700" />
              To: <strong className="text-slate-700">Mapúa University Intramuros</strong>
            </p>
          </div>

          <div className="text-right shrink-0">
            <div className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1 rounded-lg font-bold text-sm">
              <Coins className="w-4 h-4 text-amber-600" />
              {trip.token_cost}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">tokens / seat</div>
          </div>
        </div>

        {/* Schedule & Vehicle Info */}
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 rounded-xl p-3">
          <div className="flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4 text-cardinal-700 shrink-0" />
            <span>{departureFormatted}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-cardinal-700 shrink-0" />
            <span>
              <strong>{trip.available_seats}</strong> / {trip.total_seats} seats open
            </span>
          </div>
          <div className="col-span-2 flex items-center gap-1.5 pt-1 border-t border-slate-200/70">
            <Car className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              <strong>{trip.driver_name}</strong> · {trip.vehicle_color} {trip.vehicle_make}{' '}
              {trip.vehicle_model} ({trip.vehicle_plate_number})
            </span>
          </div>
        </div>

        {/* Along-the-way pick-up point selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Along-the-Way Pick-Up Points ({trip.pickup_points.length})
          </label>
          <div className="space-y-1.5">
            {trip.pickup_points.map((stop, idx) => (
              <label
                key={stop.id}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition ${
                  selectedPickupId === stop.id
                    ? 'border-cardinal-600 bg-cardinal-50/60 text-cardinal-900'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`pickup-${trip.id}`}
                    value={stop.id}
                    checked={selectedPickupId === stop.id}
                    onChange={() => setSelectedPickupId(stop.id)}
                    className="accent-cardinal-700"
                  />
                  <div>
                    <div className="font-semibold">
                      Stop {idx + 1}: {stop.label}
                    </div>
                    <div className="text-[11px] text-slate-500">{stop.address}</div>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
                  +{stop.estimated_offset_minutes} min
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* 24-hour advance booking rule indicator */}
        {!isOwnTrip && trip.booking_eligible === false && trip.booking_window_reason && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{trip.booking_window_reason}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
        <button
          onClick={() => onOpenMap(trip.id)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
        >
          <MapPin className="w-3.5 h-3.5 text-cardinal-700" /> View Live Route & ETA
        </button>

        {!isOwnTrip && (
          <button
            onClick={handleBookClick}
            disabled={busy || !trip.booking_eligible || !selectedPickupId}
            className="ml-auto px-4 py-2 rounded-lg bg-cardinal-700 hover:bg-cardinal-800 text-white text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy
              ? 'Booking...'
              : trip.booking_eligible
                ? `Pre-Book (${trip.token_cost} Tokens)`
                : '24h Window Closed'}
          </button>
        )}

        {isOwnTrip && trip.status === 'SCHEDULED' && onStartTrip && (
          <button
            onClick={() => onStartTrip(trip.id)}
            className="ml-auto px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
          >
            Start Live Trip
          </button>
        )}

        {isOwnTrip && trip.status === 'IN_PROGRESS' && onCompleteTrip && (
          <button
            onClick={() => onCompleteTrip(trip.id)}
            className="ml-auto px-4 py-2 rounded-lg bg-cardinal-700 hover:bg-cardinal-800 text-white text-xs font-semibold transition"
          >
            Arrived at Mapúa — Complete & Claim Tokens
          </button>
        )}
      </div>
    </div>
  );
};
