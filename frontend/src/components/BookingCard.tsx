import React, { useState } from 'react';
import { ArrowRight, Coins, MapPin } from 'lucide-react';
import { TripBookingItem } from '../types';
import { Spinner, StatusPill, btn, cardCls } from './ui';

interface BookingCardProps {
  booking: TripBookingItem;
  onTrack: (tripId: string) => void;
  onCancel: (bookingId: string) => Promise<void>;
}

export const BookingCard: React.FC<BookingCardProps> = ({ booking: b, onTrack, onCancel }) => {
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await onCancel(b.id);
    } finally {
      setCancelling(false);
    }
  };

  const departure = b.departure_time ? new Date(b.departure_time) : null;

  return (
    <div className={`${cardCls} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between`}>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={b.status} />
          {departure && (
            <span className="text-xs text-slate-500">
              {departure.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              {', '}
              {departure.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-bold tracking-tight text-slate-900">
          <span>{b.pickup_label}</span>
          <ArrowRight className="h-4 w-4 text-slate-400" aria-label="to" />
          <span>Mapúa Intramuros</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>
            Driver <span className="font-semibold text-slate-700">{b.driver_name}</span>
          </span>
          <span>
            {b.vehicle_make} {b.vehicle_model}
            <span className="ml-1.5 rounded bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 ring-1 ring-slate-200">
              {b.vehicle_plate_number}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-amber-900">
            <Coins className="h-3.5 w-3.5 text-gold-600" />
            {b.tokens_escrowed} tokens held
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={() => onTrack(b.trip_id)} className={btn('secondary', 'sm')}>
          <MapPin className="h-3.5 w-3.5 text-cardinal-700" />
          Track live
        </button>
        {b.status === 'CONFIRMED' && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            className={btn('danger', 'sm')}
          >
            {cancelling && <Spinner className="h-3.5 w-3.5" />}
            Cancel and refund
          </button>
        )}
      </div>
    </div>
  );
};
