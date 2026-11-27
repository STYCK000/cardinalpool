import React, { useEffect, useState } from 'react';
import {
  CalendarClock,
  Car,
  ChevronDown,
  Coins,
  Eye,
  EyeOff,
  GraduationCap,
  MailCheck,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { Spinner, btn, inputCls, labelCls } from './ui';

/** Smoothly reveals extra form fields. A disabled fieldset skips validation while hidden. */
const Collapse: React.FC<{ open: boolean; children: React.ReactNode }> = ({ open, children }) => (
  <div
    aria-hidden={!open}
    className={`!mt-0 grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
      open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
    }`}
  >
    <div className="-mx-1 min-h-0 overflow-hidden">
      <fieldset disabled={!open} className="m-0 min-w-0 border-0 p-0">
        <div className="space-y-4 px-1 pb-1 pt-4">{children}</div>
      </fieldset>
    </div>
  </div>
);

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

  const [showPassword, setShowPassword] = useState(false);

  const isRegister = mode === 'register';

  const perks = [
    {
      Icon: ShieldCheck,
      title: 'Verified Mapúans only',
      body: 'Sign up with @mymail.mapua.edu.ph for students or @mapua.edu.ph for faculty.',
    },
    {
      Icon: CalendarClock,
      title: 'Plan ahead',
      body: 'Seats are booked at least 24 hours before departure.',
    },
    {
      Icon: Coins,
      title: 'No cash needed',
      body: 'Pay with Cardinal tokens. Every new account starts with 100.',
    },
  ];

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-cardinal-800 text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <svg
          aria-hidden
          viewBox="0 0 400 600"
          className="pointer-events-none absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMax slice"
          fill="none"
        >
          <path
            d="M-10 560 C 120 540, 90 420, 200 400 S 330 330, 300 230 S 380 120, 420 100"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="2 10"
          />
          <circle cx="200" cy="400" r="6" fill="#FBBF24" />
          <circle cx="300" cy="230" r="6" fill="#FBBF24" />
        </svg>

        <div className="relative flex items-center gap-3">
          <img
            src="/cardiride-icon.png"
            alt=""
            className="h-12 w-12 rounded-2xl bg-white p-1 object-contain shadow-lift"
          />
          <div className="leading-none">
            <div className="font-display text-xl font-semibold tracking-tight">CardiRide</div>
            <div className="mt-1 text-xs text-red-200">Mapúa University Intramuros</div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight xl:text-6xl">
            Mapúans moving Mapúans.
          </h1>
          <ul className="mt-10 space-y-6">
            {perks.map(({ Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon className="h-5 w-5 text-gold-400" />
                </span>
                <div>
                  <div className="font-semibold">{title}</div>
                  <p className="mt-0.5 text-sm leading-relaxed text-red-100/85">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-red-200/70">Carpool to Intramuros with people you can trust.</p>
      </aside>

      {/* Form side */}
      <div className="flex min-h-screen flex-col lg:min-h-0">
        <div className="flex items-center gap-3 bg-cardinal-800 px-5 py-4 text-white lg:hidden">
          <img
            src="/cardiride-icon.png"
            alt=""
            className="h-10 w-10 rounded-xl bg-white p-1 object-contain"
          />
          <div className="leading-none">
            <div className="font-display text-lg font-semibold tracking-tight">CardiRide</div>
            <div className="mt-1 text-[11px] text-red-200">Mapúans Moving Mapúans</div>
          </div>
        </div>

        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-8 sm:py-12">
          <div
            role="tablist"
            aria-label="Sign in or register"
            className="relative mb-7 grid grid-cols-2 rounded-xl bg-slate-200/60 p-1 text-sm font-semibold"
          >
            <span
              aria-hidden
              className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-white shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.3,0.9,0.3,1)] ${
                isRegister ? 'translate-x-full' : 'translate-x-0'
              }`}
            />
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`relative z-10 rounded-lg py-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cardinal-600 ${
                  mode === m ? 'text-cardinal-800' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Register'}
              </button>
            ))}
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              {isRegister ? 'Create your Mapúa account' : 'Welcome back'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {isRegister
                ? 'New accounts start with 100 free tokens.'
                : 'Sign in with your Mapúa email to find or post a ride.'}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 animate-fade-in"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div
              role="status"
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 animate-fade-in"
            >
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <p>{info}</p>
                {devVerifyUrl && (
                  <a
                    href={devVerifyUrl}
                    className="mt-2 inline-block text-xs font-semibold underline underline-offset-2"
                  >
                    Dev shortcut. Verify this email now
                  </a>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="auth-email" className={labelCls}>
                Mapúa email
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                placeholder="jdelacruz@mymail.mapua.edu.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="auth-password" className={labelCls}>
                Password
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputCls} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cardinal-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Collapse open={isRegister}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="auth-name" className={labelCls}>
                    Full name
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Juan Dela Cruz"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="auth-id" className={labelCls}>
                    Student or faculty ID
                  </label>
                  <input
                    id="auth-id"
                    type="text"
                    required
                    placeholder="2023104821"
                    value={universityIdNumber}
                    onChange={(e) => setUniversityIdNumber(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="auth-dept" className={labelCls}>
                  School or department
                </label>
                <div className="relative">
                  <select
                    id="auth-dept"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className={`${inputCls} appearance-none truncate pr-10`}
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-3 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div>
                <span className={labelCls}>I want to start as a</span>
                <div className="grid grid-cols-2 gap-2.5">
                  {(
                    [
                      { value: 'RIDER', label: 'Rider', hint: 'Book seats', Icon: GraduationCap },
                      { value: 'DRIVER', label: 'Driver', hint: 'Post trips', Icon: Car },
                    ] as const
                  ).map(({ value, label, hint, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={initialMode === value}
                      onClick={() => setInitialMode(value)}
                      className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cardinal-600 ${
                        initialMode === value
                          ? 'border-cardinal-600 bg-cardinal-50 ring-1 ring-cardinal-600'
                          : 'border-slate-300 bg-white hover:border-slate-400'
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${initialMode === value ? 'text-cardinal-700' : 'text-slate-400'}`}
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">{label}</span>
                        <span className="block text-xs text-slate-500">{hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <Collapse open={isRegister && initialMode === 'DRIVER'}>
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Car className="h-4 w-4 text-cardinal-700" />
                    Your vehicle
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      aria-label="Vehicle make"
                      placeholder="Make, e.g. Toyota"
                      value={vehicleMake}
                      onChange={(e) => setVehicleMake(e.target.value)}
                      className={inputCls}
                    />
                    <input
                      type="text"
                      required
                      aria-label="Vehicle model"
                      placeholder="Model, e.g. Vios"
                      value={vehicleModel}
                      onChange={(e) => setVehicleModel(e.target.value)}
                      className={inputCls}
                    />
                    <input
                      type="text"
                      required
                      aria-label="Vehicle color"
                      placeholder="Color, e.g. Silver"
                      value={vehicleColor}
                      onChange={(e) => setVehicleColor(e.target.value)}
                      className={inputCls}
                    />
                    <input
                      type="text"
                      required
                      aria-label="Plate number"
                      placeholder="Plate, e.g. NGA 4821"
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="auth-seats" className="mb-1.5 block text-xs text-slate-600">
                      Passenger seats you can offer
                    </label>
                    <input
                      id="auth-seats"
                      type="number"
                      min={1}
                      max={8}
                      value={seatCapacity}
                      onChange={(e) => setSeatCapacity(Number(e.target.value))}
                      className={`${inputCls} w-28`}
                    />
                  </div>
                </div>
              </Collapse>
            </Collapse>

            <button type="submit" disabled={submitting} className={`${btn('primary')} w-full py-3`}>
              {submitting && <Spinner />}
              {submitting
                ? 'One moment'
                : isRegister
                  ? 'Create account'
                  : 'Sign in'}
            </button>

            <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-slate-500 lg:hidden">
              <ShieldCheck className="h-3.5 w-3.5 text-cardinal-700" />
              Only @mymail.mapua.edu.ph and @mapua.edu.ph emails work.
            </p>
          </form>
        </main>
      </div>
    </div>
  );
};
