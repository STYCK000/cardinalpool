import React, { useState } from 'react';
import { Car, CheckCircle2, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';

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

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Mapúa Profile & Vehicle Details</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {user.email} · {user.university_role} · ID: {user.university_id_number}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
          <UserCheck className="w-3.5 h-3.5" /> Verified Mapúan
        </span>
      </div>

      {savedMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {savedMsg}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              School / Department
            </label>
            <input
              type="text"
              required
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Car className="w-4 h-4 text-cardinal-700" />
            Driver Vehicle Information (Required to switch to Driver mode)
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Make (e.g. Toyota)"
              value={vehicleMake}
              onChange={(e) => setVehicleMake(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            />
            <input
              type="text"
              placeholder="Model (e.g. Vios)"
              value={vehicleModel}
              onChange={(e) => setVehicleModel(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            />
            <input
              type="text"
              placeholder="Color (e.g. Silver)"
              value={vehicleColor}
              onChange={(e) => setVehicleColor(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            />
            <input
              type="text"
              placeholder="Plate Number (e.g. NGA 4821)"
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Passenger Seat Capacity</label>
            <input
              type="number"
              min={1}
              max={8}
              value={seatCapacity}
              onChange={(e) => setSeatCapacity(Number(e.target.value))}
              className="w-28 px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-cardinal-700 hover:bg-cardinal-800 text-white text-sm font-semibold transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Profile Changes'}
        </button>
      </form>
    </div>
  );
};
