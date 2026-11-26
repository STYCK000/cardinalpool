import React, { useEffect, useState } from 'react';
import { ShieldCheck, MailCheck, Car, GraduationCap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';

const DEPARTMENTS = [
  'School of Civil, Environmental, and Geological Engineering (SCEGE)',
  'School of Chemical, Biological, and Materials Engineering and Sciences (CBMES)',
  'School of Electrical, Electronics, and Computer Engineering (EECE)',
  'School of Industrial Engineering and Engineering Management (IE-EMG)',
  'School of Mechanical and Manufacturing Engineering (MME)',
  'School of Architecture, Industrial Design, and the Built Environment (ARIDBE)',
  'School of Information Technology (SOIT)',
  'School of Media Studies (SMS)',
  'School of Social Sciences and Education (SSSE)',
  'E.T. Yuchengco School of Business (ETYSB)',
  'Senior High School (SHS)',
];

export const AuthView: React.FC = () => {
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[6]);
  const [universityIdNumber, setUniversityIdNumber] = useState('');
  const [initialMode, setInitialMode] = useState<'RIDER' | 'DRIVER'>('RIDER');

  // Vehicle details (for drivers)
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [seatCapacity, setSeatCapacity] = useState(3);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Automatically process /verify-email?token=... links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get('token');
    if (verifyToken) {
      apiRequest<{ message: string }>(`/auth/verify-email?token=${encodeURIComponent(verifyToken)}`)
        .then((res) => {
          setInfo(res.message);
          window.history.replaceState({}, '', '/');
        })
        .catch((err) => setError((err as Error).message));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setDevVerifyUrl(null);
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        const payload: Record<string, unknown> = {
          email,
          password,
          fullName,
          department,
          universityIdNumber,
          initialMode,
        };
        if (initialMode === 'DRIVER') {
          payload.vehicle = {
            make: vehicleMake,
            model: vehicleModel,
            color: vehicleColor,
            plateNumber: vehiclePlate,
            seatCapacity: Number(seatCapacity),
          };
        }

        const res = await apiRequest<{ message: string; devVerificationUrl?: string }>(
          '/auth/register',
          { method: 'POST', body: JSON.stringify(payload) }
        );
        setInfo(res.message);
        if (res.devVerificationUrl) {
          setDevVerifyUrl(res.devVerificationUrl);
        }
        setMode('login');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cardinal-900 via-cardinal-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-cardinal-800 px-6 py-6 text-white">
          <div className="flex items-center gap-3">
            <img src="/cardiride-icon.png" alt="CardiRide" className="w-12 h-12 rounded-xl bg-white p-1 object-contain shadow" />
            <div>
              <h1 className="text-xl font-bold">CardiRide</h1>
              <p className="text-xs text-red-200">
                Mapúans Moving Mapúans · Mapúa University Intramuros
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs bg-cardinal-900/60 border border-red-400/20 rounded-lg px-3 py-2 text-red-100">
            <ShieldCheck className="w-4 h-4 text-gold-400 shrink-0" />
            <span>
              Verified Mapúa accounts only: <strong>@mymail.mapua.edu.ph</strong> (Students) &{' '}
              <strong>@mapua.edu.ph</strong> (Faculty)
            </span>
          </div>
        </div>

        <div className="p-6">
          <div className="flex rounded-lg bg-slate-100 p-1 mb-5">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${
                mode === 'login' ? 'bg-white text-cardinal-800 shadow-sm' : 'text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${
                mode === 'register' ? 'bg-white text-cardinal-800 shadow-sm' : 'text-slate-600'
              }`}
            >
              Register (100 Free Tokens)
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          {info && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
              <div className="flex items-start gap-2">
                <MailCheck className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p>{info}</p>
                  {devVerifyUrl && (
                    <a
                      href={devVerifyUrl}
                      className="inline-block mt-2 text-xs font-semibold underline text-emerald-900"
                    >
                      [Dev Shortcut] Click here to verify institutional email now
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mapúa Institutional Email
              </label>
              <input
                type="email"
                required
                placeholder="jdelacruz@mymail.mapua.edu.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cardinal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={8}
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cardinal-600 focus:outline-none"
              />
            </div>

            {mode === 'register' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Juan Dela Cruz"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Student / Faculty ID
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="2023104821"
                      value={universityIdNumber}
                      onChange={(e) => setUniversityIdNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    School / Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Register Initially As
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setInitialMode('RIDER')}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium ${
                        initialMode === 'RIDER'
                          ? 'border-cardinal-700 bg-cardinal-50 text-cardinal-800'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <GraduationCap className="w-4 h-4" /> Rider
                    </button>
                    <button
                      type="button"
                      onClick={() => setInitialMode('DRIVER')}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium ${
                        initialMode === 'DRIVER'
                          ? 'border-cardinal-700 bg-cardinal-50 text-cardinal-800'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <Car className="w-4 h-4" /> Driver
                    </button>
                  </div>
                </div>

                {initialMode === 'DRIVER' && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Vehicle Information
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        required
                        placeholder="Make (e.g. Toyota)"
                        value={vehicleMake}
                        onChange={(e) => setVehicleMake(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Model (e.g. Vios)"
                        value={vehicleModel}
                        onChange={(e) => setVehicleModel(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Color (e.g. Silver)"
                        value={vehicleColor}
                        onChange={(e) => setVehicleColor(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Plate (e.g. NGA 4821)"
                        value={vehiclePlate}
                        onChange={(e) => setVehiclePlate(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Available Passenger Seats</label>
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
                )}
              </>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-cardinal-700 hover:bg-cardinal-800 text-white font-semibold text-sm transition disabled:opacity-50"
            >
              {submitting
                ? 'Processing...'
                : mode === 'login'
                  ? 'Sign In to CardiRide'
                  : 'Create Verified Mapúa Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
