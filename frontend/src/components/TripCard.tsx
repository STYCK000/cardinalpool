import React, { useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Car,
  CheckCircle2,
  Coins,
  MapPin,
  UserCheck,
} from 'lucide-react';
import { Trip } from '../types';
import { Pill, Spinner, StatusPill, btn, cardCls } from './ui';

interface TripCardProps {
  trip: Trip;
  isOwnTrip: boolean;
  onBook: (tripId: string, pickupPointId: string) => Promise<void>;
  onOpenMap: (tripId: string) => void;
  onStartTrip?: (tripId: string) => Promise<void>;
  onCompleteTrip?: (tripId: string) => Promise<void>;
  onMarkBoarded?: (bookingId: string) => Promise<void>;
}

export const TripCard: React.FC<TripCardProps> = ({
  trip,
  isOwnTrip,
  onBook,
  onOpenMap,
  onStartTrip,
  onCompleteTrip,
  onMarkBoarded,
}) => {
  const [selectedPickupId, setSelectedPickupId] = useState<string>(
    trip.pickup_points[0]?.id || ''
  );
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const handleBookClick = async () => {
    if (!selectedPickupId) return;
    setBusy(true);
    try {
      await onBook(trip.id, selectedPickupId);
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (key: string, fn?: () => Promise<void>) => {
    if (!fn) return;
    setActionBusy(key);
    try {
      await fn();
    } finally {
      setActionBusy(null);
    }
  };

  const departure = new Date(trip.departure_time);
  const dayLabel = departure.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeLabel = departure.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  const bookedRiders = trip.bookings || [];
  const totalEscrowedTokens = bookedRiders.reduce((sum, b) => sum + (b.tokens_escrowed || 0), 0);
  const seatsTaken = trip.total_seats - trip.available_seats;

  return (
    <article className={`${cardCls} flex flex-col`}>
      <div className="space-y-5 p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={trip.status} />
              <span className="text-xs text-slate-500">
                {trip.driver_role === 'FACULTY' ? 'Faculty driver' : 'Student driver'}
              </span>
            </div>
            <h3 className="mt-2 text-lg font-bold leading-tight tracking-tight text-slate-900">
              {trip.origin_name}
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">to Mapúa Intramuros</p>
          </div>

          <div className="shrink-0 rounded-xl bg-gold-400/15 px-3 py-2 text-center ring-1 ring-gold-500/30">
            <div className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums text-amber-900">
              <Coins className="h-4 w-4 text-gold-600" />
              {trip.token_cost}
            </div>
            <div className="text-[11px] text-amber-800/70">per seat</div>
          </div>
        </div>

        {/* When, seats, who */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-slate-50 p-3.5 text-sm">
          <div className="flex items-start gap-2.5">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-cardinal-700" />
            <div>
              <div className="font-semibold leading-tight text-slate-900">{dayLabel}</div>
              <div className="text-xs text-slate-500">{timeLabel}</div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1" aria-hidden>
              {Array.from({ length: trip.total_seats }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2.5 w-2.5 rounded-full ${
                    i < seatsTaken ? 'bg-cardinal-700' : 'border-2 border-slate-300 bg-white'
                  }`}
                />
              ))}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              <span className="font-semibold text-slate-900">{trip.available_seats}</span> of{' '}
              {trip.total_seats} seats open
            </div>
          </div>

          <div className="col-span-2 flex items-center gap-2.5 border-t border-slate-200/80 pt-3">
            <Car className="h-4 w-4 shrink-0 text-slate-400" />
            <div className="min-w-0 text-xs text-slate-600">
              <span className="font-semibold text-slate-900">{trip.driver_name}</span>
              <span className="mx-1.5 text-slate-300">|</span>
              {trip.vehicle_color} {trip.vehicle_make} {trip.vehicle_model}
              <span className="ml-1.5 rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-700 ring-1 ring-slate-200">
                {trip.vehicle_plate_number}
              </span>
            </div>
          </div>
        </div>

        {/* Driver view: who is riding */}
        {isOwnTrip && (
          <div className="space-y-3 rounded-xl border border-cardinal-100 bg-cardinal-50/50 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-bold text-cardinal-900">
                <UserCheck className="h-4 w-4 text-cardinal-700" />
                Riders on this trip ({bookedRiders.length})
              </div>
              {totalEscrowedTokens > 0 && (
                <Pill tone="amber">{totalEscrowedTokens} tokens held</Pill>
              )}
            </div>

            {bookedRiders.length === 0 ? (
              <p className="text-xs leading-relaxed text-slate-500">
                Nobody has booked yet. Riders and their pick-up stops will show up here.
              </p>
            ) : (
              <ul className="space-y-2">
                {bookedRiders.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-900">
                        {b.rider_name}
                        <Pill>{b.rider_role === 'FACULTY' ? 'Faculty' : 'Student'}</Pill>
                        <Pill tone={b.status === 'BOARDED' ? 'green' : 'amber'}>
                          {b.status === 'BOARDED' ? 'Picked up' : 'Waiting'}
                        </Pill>
                      </div>
                      {b.rider_department && (
                        <div className="text-xs text-slate-500">
                          {b.rider_department}
                          {b.rider_university_id ? `, ID ${b.rider_university_id}` : ''}
                        </div>
                      )}
                      <div className="flex items-start gap-1.5 pt-0.5 text-xs font-semibold text-cardinal-800">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" />
                        <span>
                          {b.pickup_sequence ? `Stop ${b.pickup_sequence} at ` : ''}
                          {b.pickup_label}
                          {b.pickup_address && (
                            <span className="block font-normal text-slate-500">{b.pickup_address}</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {b.status === 'CONFIRMED' && onMarkBoarded && (
                      <button
                        type="button"
                        disabled={actionBusy === b.id}
                        onClick={() => runAction(b.id, () => onMarkBoarded(b.id))}
                        className={btn('success', 'sm')}
                      >
                        {actionBusy === b.id ? <Spinner className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Mark picked up
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Route and stops */}
        <fieldset className="min-w-0">
          <legend className="mb-2.5 text-xs font-semibold text-slate-700">
            {isOwnTrip ? 'Your route' : 'Choose where you get picked up'}
          </legend>

          <div className="relative">
            {/* rail */}
            <span
              aria-hidden
              className="absolute bottom-4 left-[11px] top-4 w-0.5 rounded-full bg-slate-200"
            />

            <div className="relative flex items-center gap-3 py-1.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                <span className="h-3 w-3 rounded-full border-[3px] border-emerald-600 bg-white" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-800">{trip.origin_name}</div>
                <div className="text-[11px] text-slate-500">Driver starts here</div>
              </div>
            </div>

            {trip.pickup_points.map((stop, idx) => {
              const ridersAtStop = bookedRiders.filter((b) => b.pickup_point_id === stop.id);
              const selected = !isOwnTrip && selectedPickupId === stop.id;
              return (
                <label
                  key={stop.id}
                  className={`relative my-1 flex items-center gap-3 rounded-xl border px-2 py-2 transition-colors duration-150 focus-within:ring-2 focus-within:ring-cardinal-600/40 ${
                    isOwnTrip ? 'cursor-default' : 'cursor-pointer'
                  } ${
                    selected
                      ? 'border-cardinal-600 bg-cardinal-50/70'
                      : isOwnTrip
                        ? 'border-transparent'
                        : 'border-transparent hover:bg-slate-50'
                  }`}
                >
                  {!isOwnTrip && (
                    <input
                      type="radio"
                      name={`pickup-${trip.id}`}
                      value={stop.id}
                      checked={selectedPickupId === stop.id}
                      onChange={() => setSelectedPickupId(stop.id)}
                      className="sr-only"
                    />
                  )}
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors duration-150 ${
                      selected ? 'bg-cardinal-700 text-white' : 'bg-gold-400 text-slate-900'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-900">
                      <span className="truncate">{stop.label}</span>
                      {isOwnTrip && ridersAtStop.length > 0 && (
                        <Pill tone="amber">
                          {ridersAtStop.length} rider{ridersAtStop.length > 1 ? 's' : ''}
                        </Pill>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-slate-500">{stop.address}</div>
                  </div>
                  <span className="shrink-0 text-xs font-medium tabular-nums text-slate-500">
                    +{stop.estimated_offset_minutes} min
                  </span>
                </label>
              );
            })}

            <div className="relative flex items-center gap-3 py-1.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                <span className="h-3 w-3 rounded-full bg-cardinal-700 ring-4 ring-cardinal-100" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800">Mapúa Intramuros</div>
                <div className="text-[11px] text-slate-500">Final stop</div>
              </div>
            </div>
          </div>
        </fieldset>

        {/* 24-hour booking rule */}
        {!isOwnTrip && trip.booking_eligible === false && trip.booking_window_reason && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>{trip.booking_window_reason}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-4">
        <button type="button" onClick={() => onOpenMap(trip.id)} className={btn('secondary', 'sm')}>
          <MapPin className="h-3.5 w-3.5 text-cardinal-700" />
          Live route and ETA
        </button>

        {!isOwnTrip && (
          <button
            type="button"
            onClick={handleBookClick}
            disabled={busy || !trip.booking_eligible || !selectedPickupId}
            className={`ml-auto ${btn('primary')}`}
          >
            {busy && <Spinner />}
            {busy
              ? 'Booking'
              : trip.booking_eligible
                ? `Book seat for ${trip.token_cost} tokens`
                : 'Booking closed'}
          </button>
        )}

        {isOwnTrip && trip.status === 'SCHEDULED' && onStartTrip && (
          <button
            type="button"
            disabled={actionBusy === 'start'}
            onClick={() => runAction('start', () => onStartTrip(trip.id))}
            className={`ml-auto ${btn('success')}`}
          >
            {actionBusy === 'start' && <Spinner />}
            Start live trip
          </button>
        )}

        {isOwnTrip && trip.status === 'IN_PROGRESS' && onCompleteTrip && (
          <button
            type="button"
            disabled={actionBusy === 'complete'}
            onClick={() => runAction('complete', () => onCompleteTrip(trip.id))}
            className={`ml-auto ${btn('primary')}`}
          >
            {actionBusy === 'complete' && <Spinner />}
            Arrived, claim tokens
          </button>
        )}
      </div>
    </article>
  );
};
