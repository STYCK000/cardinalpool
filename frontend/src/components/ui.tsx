import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';

/* ---------- Shared class recipes ---------- */

const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-[-0.01em] transition duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100';

const BTN_VARIANTS = {
  primary: `${btnBase} bg-cardinal-700 text-white hover:bg-cardinal-800 active:bg-cardinal-900 focus-visible:ring-cardinal-600`,
  secondary: `${btnBase} bg-slate-900/[0.06] text-slate-900 hover:bg-slate-900/[0.10] active:bg-slate-900/[0.14] focus-visible:ring-slate-400`,
  success: `${btnBase} bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:ring-emerald-500`,
  danger: `${btnBase} bg-rose-600/[0.08] text-rose-700 hover:bg-rose-600/[0.14] focus-visible:ring-rose-400`,
  gold: `${btnBase} bg-gold-400 text-cardinal-900 hover:bg-gold-500 focus-visible:ring-gold-500`,
  light: `${btnBase} bg-white text-cardinal-800 hover:bg-white/90 focus-visible:ring-white focus-visible:ring-offset-cardinal-800`,
  ghost: `${btnBase} text-slate-600 hover:bg-slate-900/[0.05] hover:text-slate-900 focus-visible:ring-slate-400`,
} as const;

const BTN_SIZES = {
  sm: 'px-3.5 py-1.5 text-[13px]',
  md: 'px-5 py-2.5 text-[15px]',
} as const;

export function btn(
  variant: keyof typeof BTN_VARIANTS = 'primary',
  size: keyof typeof BTN_SIZES = 'md'
): string {
  return `${BTN_VARIANTS[variant]} ${BTN_SIZES[size]}`;
}

export const inputCls =
  'w-full rounded-xl border border-slate-300 bg-surface dark:bg-slate-100 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 transition duration-200 hover:border-slate-400 focus:border-cardinal-600 focus:outline-none focus:ring-4 focus:ring-cardinal-600/15 disabled:bg-slate-50 sm:py-2.5 sm:text-[15px]';

export const labelCls = 'mb-1.5 block text-xs font-medium text-slate-600';

export const cardCls = 'rounded-[22px] bg-surface shadow-card';

/* ---------- Small building blocks ---------- */

export const Spinner: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <Loader2 className={`animate-spin ${className}`} aria-hidden />
);

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton rounded-xl ${className}`} aria-hidden />
);

type Tone = 'neutral' | 'cardinal' | 'green' | 'amber' | 'rose' | 'sky';

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-900/[0.06] text-slate-600',
  cardinal: 'bg-cardinal-700/[0.09] text-accent',
  green: 'bg-emerald-600/[0.10] text-emerald-800',
  amber: 'bg-amber-500/[0.14] text-amber-900',
  rose: 'bg-rose-600/[0.10] text-rose-700',
  sky: 'bg-sky-600/[0.10] text-sky-800 dark:text-sky-300',
};

export const Pill: React.FC<{
  tone?: Tone;
  live?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ tone = 'neutral', live = false, className = '', children }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONES[tone]} ${className}`}
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
  <div className={`${cardCls} flex flex-col items-center px-6 py-14 text-center`}>
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
      {icon}
    </div>
    <h3 className="mt-4 text-[17px] font-semibold tracking-tight text-slate-900">{title}</h3>
    {children && <p className="mt-1.5 max-w-sm text-[15px] leading-relaxed text-slate-500">{children}</p>}
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
      className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-[20px] px-4 py-3 text-sm text-white shadow-lift backdrop-blur-xl animate-toast-in ${
        type === 'success' ? 'bg-[#1d1d1f]/90 dark:bg-slate-200/95' : 'bg-rose-600/95'
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
