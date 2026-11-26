import React, { useState } from 'react';
import { AlertTriangle, Car, CheckCircle2, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { Spinner, btn, cardCls, inputCls, labelCls } from './ui';

export const ProfileSettings: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [vehicleMake, setVehicleMake] = useState(user?.vehicle_make || '');
  const [vehicleModel, setVehicleModel] = useState(user?.vehicle_model || '');
  const [vehicleColor, setVehicleColor] = useState(user?.vehicle_color || '');
  const [vehiclePlate, setVehiclePlate] = useState(user?.vehicle_plate_number || '');
  const [seatCapacity, setSeatCapacity] = useState(user?.vehicle_seat_capacity || 3);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    setError(null);

    try {
      const payload: Record<string, unknown> = { fullName, department };
      if (vehicleMake && vehicleModel && vehicleColor && vehiclePlate) {
        payload.vehicle = {
          make: vehicleMake,
          model: vehicleModel,
          color: vehicleColor,
          plateNumber: vehiclePlate,
          seatCapacity: Number(seatCapacity),
        };
      }

      await apiRequest('/users/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await refreshUser();
      setSavedMsg('Profile and vehicle details updated! You can now switch between Rider and Driver modes.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const initials = user.full_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className={`${cardCls} flex flex-wrap items-center gap-4 p-5`}>
        <div
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cardinal-800 font-display text-xl font-bold text-gold-400"
        >
          {initials || 'M'}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-bold tracking-tight text-slate-900">{user.full_name}</h2>
          <p className="truncate text-sm text-slate-500">{user.email}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {user.university_role === 'FACULTY' ? 'Faculty' : 'Student'}, ID {user.university_id_number}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <UserCheck className="h-3.5 w-3.5" />
          Verified Mapúan
        </span>
      </div>

      <form onSubmit={handleSave} className={`${cardCls} space-y-6 p-5 sm:p-6`}>
        {savedMsg && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 animate-fade-in"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            {savedMsg}
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 animate-fade-in"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            {error}
          </div>
        )}

        <section className="space-y-4">
          <h3 className="text-base font-bold text-slate-900">Your details</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="profile-name" className={labelCls}>
                Full name
              </label>
              <input
                id="profile-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="profile-dept" className={labelCls}>
                School or department
              </label>
              <input
                id="profile-dept"
                type="text"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Car className="h-4 w-4 text-cardinal-700" />
              Vehicle
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Fill in all four fields to unlock Driver mode. Riders see this when they book with you.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              aria-label="Vehicle make"
              placeholder="Make, e.g. Toyota"
              value={vehicleMake}
              onChange={(e) => setVehicleMake(e.target.value)}
              className={inputCls}
            />
            <input
              type="text"
              aria-label="Vehicle model"
              placeholder="Model, e.g. Vios"
              value={vehicleModel}
              onChange={(e) => setVehicleModel(e.target.value)}
              className={inputCls}
            />
            <input
              type="text"
              aria-label="Vehicle color"
              placeholder="Color, e.g. Silver"
              value={vehicleColor}
              onChange={(e) => setVehicleColor(e.target.value)}
              className={inputCls}
            />
            <input
              type="text"
              aria-label="Plate number"
              placeholder="Plate number, e.g. NGA 4821"
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="profile-seats" className="mb-1.5 block text-xs text-slate-600">
              Passenger seats you can offer
            </label>
            <input
              id="profile-seats"
              type="number"
              min={1}
              max={8}
              value={seatCapacity}
              onChange={(e) => setSeatCapacity(Number(e.target.value))}
              className={`${inputCls} w-28`}
            />
          </div>
        </section>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className={`${btn('primary')} w-full sm:w-auto sm:px-6`}>
            {saving && <Spinner />}
            {saving ? 'Saving' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
