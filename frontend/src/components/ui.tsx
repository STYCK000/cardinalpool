import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';

/* ---------- Shared class recipes ---------- */

const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100';

const BTN_VARIANTS = {
  primary: `${btnBase} bg-cardinal-700 text-white shadow-sm hover:bg-cardinal-800 focus-visible:ring-cardinal-600`,
  secondary: `${btnBase} border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-slate-400`,
  success: `${btnBase} bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus-visible:ring-emerald-500`,
  danger: `${btnBase} border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 focus-visible:ring-rose-400`,
  gold: `${btnBase} bg-gold-400 text-cardinal-900 shadow-sm hover:bg-gold-500 focus-visible:ring-gold-500`,
  ghost: `${btnBase} text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400`,
} as const;

const BTN_SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
} as const;

export function btn(
  variant: keyof typeof BTN_VARIANTS = 'primary',
  size: keyof typeof BTN_SIZES = 'md'
): string {
  return `${BTN_VARIANTS[variant]} ${BTN_SIZES[size]}`;
}

export const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition duration-150 focus:border-cardinal-600 focus:outline-none focus:ring-4 focus:ring-cardinal-600/10 disabled:bg-slate-50';

export const labelCls = 'mb-1.5 block text-xs font-semibold text-slate-700';

export const cardCls = 'rounded-2xl border border-slate-200/80 bg-white shadow-card';

/* ---------- Small building blocks ---------- */

export const Spinner: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <Loader2 className={`animate-spin ${className}`} aria-hidden />
);

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton rounded-lg ${className}`} aria-hidden />
);

type Tone = 'neutral' | 'cardinal' | 'green' | 'amber' | 'rose' | 'sky';

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  cardinal: 'bg-cardinal-50 text-cardinal-800 ring-cardinal-100',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  sky: 'bg-sky-50 text-sky-800 ring-sky-200',
};

export const Pill: React.FC<{
  tone?: Tone;
  live?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ tone = 'neutral', live = false, className = '', children }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${TONES[tone]} ${className}`}
  >
    {live && <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />}
    {children}
  </span>
);

const STATUS_META: Record<string, { label: string; tone: Tone; live?: boolean }> = {
  SCHEDULED: { label: 'Scheduled', tone: 'neutral' },
  IN_PROGRESS: { label: 'Live now', tone: 'green', live: true },
  COMPLETED: { label: 'Completed', tone: 'neutral' },
  CANCELLED: { label: 'Cancelled', tone: 'rose' },
  CONFIRMED: { label: 'Confirmed', tone: 'cardinal' },
  BOARDED: { label: 'Picked up', tone: 'green' },
};

export const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const meta = STATUS_META[status];
  if (meta) {
    return (
      <Pill tone={meta.tone} live={meta.live}>
        {meta.label}
      </Pill>
    );
  }
  const readable = status.replace(/_/g, ' ').toLowerCase();
  return <Pill>{readable.charAt(0).toUpperCase() + readable.slice(1)}</Pill>;
};

export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ icon, title, children, action }) => (
  <div className={`${cardCls} flex flex-col items-center px-6 py-12 text-center`}>
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cardinal-50 text-cardinal-700">
      {icon}
    </div>
    <h3 className="mt-4 text-base font-bold text-slate-900">{title}</h3>
    {children && <p className="mt-1 max-w-sm text-sm leading-relaxed text-slate-500">{children}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const Toast: React.FC<{
  type: 'success' | 'error';
  text: string;
  onClose: () => void;
}> = ({ type, text, onClose }) => (
  <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 md:bottom-8">
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl px-4 py-3 text-sm text-white shadow-lift animate-toast-in ${
        type === 'success' ? 'bg-slate-900' : 'bg-rose-700'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-200" />
      )}
      <p className="flex-1 leading-snug">{text}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss message"
        className="-mr-1 rounded-md p-0.5 text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  </div>
);
