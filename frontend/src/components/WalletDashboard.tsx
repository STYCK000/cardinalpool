import React, { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Coins, Lock, Receipt, RefreshCw } from 'lucide-react';
import { WalletData } from '../types';
import { apiRequest } from '../services/api';
import { Pill, Skeleton, btn, cardCls } from './ui';

const FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'CREDITS', label: 'Credits' },
  { id: 'DEBITS', label: 'Debits' },
] as const;

const TX_LABELS: Record<string, string> = {
  WELCOME_BONUS: 'Welcome bonus',
  BOOKING_ESCROW: 'Seat booked',
  TRIP_PAYOUT: 'Trip payout',
  BOOKING_REFUND: 'Refund',
  ADMIN_ADJUSTMENT: 'Adjustment',
};

export const WalletDashboard: React.FC = () => {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'CREDITS' | 'DEBITS'>('ALL');

  const loadWallet = async () => {
    // First load shows placeholders, later loads keep the page steady
    if (wallet) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await apiRequest<WalletData>('/wallet');
      setWallet(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !wallet) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  const filteredTx = wallet.transactions.filter((tx) => {
    if (filter === 'CREDITS') return tx.amount > 0;
    if (filter === 'DEBITS') return tx.amount < 0;
    return true;
  });
  const filterIndex = FILTERS.findIndex((f) => f.id === filter);

  const stats = [
    {
      label: 'Held for rides',
      value: wallet.escrowedTokens,
      note: 'Released to the driver on arrival',
      Icon: Lock,
      iconCls: 'text-gold-600',
      valueCls: 'text-slate-900',
    },
    {
      label: 'Total credited',
      value: `+${wallet.totalEarned}`,
      note: 'Bonuses, payouts and refunds',
      Icon: ArrowDownLeft,
      iconCls: 'text-emerald-600',
      valueCls: 'text-emerald-700',
    },
    {
      label: 'Total spent',
      value: `-${wallet.totalSpent}`,
      note: 'Seat bookings to Intramuros',
      Icon: ArrowUpRight,
      iconCls: 'text-rose-600',
      valueCls: 'text-rose-700',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Token wallet</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            Riders pay in Cardinal tokens. Tokens stay on hold until the trip ends, then go to the driver.
          </p>
        </div>
        <button type="button" onClick={loadWallet} disabled={refreshing} className={btn('secondary', 'sm')}>
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col justify-between rounded-3xl bg-cardinal-800 p-6 text-white shadow-card">
          <div className="flex items-center justify-between text-sm font-medium text-red-100">
            Available balance
            <Coins className="h-5 w-5 text-gold-400" />
          </div>
          <div className="mt-6">
            <div className="font-display text-5xl font-semibold tabular-nums tracking-tight text-gold-400">
              {wallet.tokenBalance}
            </div>
            <div className="mt-1 text-sm text-red-200">Cardinal tokens</div>
          </div>
        </div>

        <dl className={`${cardCls} grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0`}>
          {stats.map(({ label, value, note, Icon, iconCls, valueCls }) => (
            <div key={label} className="flex flex-col justify-between gap-4 p-5">
              <dt className="flex items-center justify-between text-xs font-medium text-slate-500">
                {label}
                <Icon className={`h-4 w-4 ${iconCls}`} />
              </dt>
              <div>
                <dd className={`font-display text-3xl font-semibold tabular-nums ${valueCls}`}>{value}</dd>
                <p className="mt-1 text-xs leading-snug text-slate-500">{note}</p>
              </div>
            </div>
          ))}
        </dl>
      </div>

      <section className={`${cardCls} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">Transaction history</h3>
          <div
            role="group"
            aria-label="Filter transactions"
            className="relative grid grid-cols-3 rounded-xl bg-slate-100 p-1 text-xs font-semibold"
          >
            <span
              aria-hidden
              className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg bg-thumb shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.3,0.9,0.3,1)]"
              style={{ transform: `translateX(${filterIndex * 100}%)` }}
            />
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`relative z-10 rounded-lg px-4 py-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cardinal-600 ${
                  filter === f.id ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredTx.length === 0 ? (
          <EmptyStateInline />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredTx.map((tx) => {
              const credit = tx.amount > 0;
              return (
                <li key={tx.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50/70">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      credit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {credit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">{tx.description}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <Pill tone={credit ? 'green' : tx.tx_type === 'BOOKING_ESCROW' ? 'amber' : 'neutral'}>
                        {TX_LABELS[tx.tx_type] ?? tx.tx_type.replace(/_/g, ' ').toLowerCase()}
                      </Pill>
                      <span>
                        {new Date(tx.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`text-sm font-semibold tabular-nums ${credit ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {credit ? `+${tx.amount}` : tx.amount}
                    </div>
                    <div className="mt-0.5 text-xs tabular-nums text-slate-500">Balance {tx.balance_after}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

const EmptyStateInline: React.FC = () => (
  <div className="flex flex-col items-center px-6 py-12 text-center">
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
      <Receipt className="h-5 w-5" />
    </div>
    <p className="mt-3 text-sm font-semibold text-slate-800">No transactions here</p>
    <p className="mt-1 text-sm text-slate-500">Token activity will appear as you book and drive.</p>
  </div>
);
