import React, { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Coins, Lock, RefreshCw } from 'lucide-react';
import { WalletData } from '../types';
import { apiRequest } from '../services/api';

export const WalletDashboard: React.FC = () => {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'CREDITS' | 'DEBITS'>('ALL');

  const loadWallet = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<WalletData>('/wallet');
      setWallet(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
  }, []);

  if (loading || !wallet) {
    return <div className="p-8 text-center text-slate-500">Loading Cardinal Token wallet...</div>;
  }

  const filteredTx = wallet.transactions.filter((tx) => {
    if (filter === 'CREDITS') return tx.amount > 0;
    if (filter === 'DEBITS') return tx.amount < 0;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Cardinal Token Wallet</h2>
          <p className="text-sm text-slate-500">
            Cashless campus carpool economy — rider tokens are held in escrow and automatically transferred to drivers on trip completion.
          </p>
        </div>
        <button
          onClick={loadWallet}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Ledger
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-cardinal-700 to-cardinal-900 text-white rounded-2xl p-5 shadow-md">
          <div className="flex items-center justify-between text-red-200 text-xs font-medium">
            <span>Available Balance</span>
            <Coins className="w-4 h-4 text-gold-400" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-gold-400">{wallet.tokenBalance}</div>
          <div className="text-xs text-red-200 mt-1">Cardinal Tokens</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>In Escrow (Upcoming)</span>
            <Lock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{wallet.escrowedTokens}</div>
          <div className="text-xs text-slate-500 mt-1">Released to driver upon arrival</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Credited</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">+{wallet.totalEarned}</div>
          <div className="text-xs text-slate-500 mt-1">Welcome bonus, payouts & refunds</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Spent</span>
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-700">-{wallet.totalSpent}</div>
          <div className="text-xs text-slate-500 mt-1">Seat bookings to Intramuros</div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-900">Complete Transaction History</h3>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
            {(['ALL', 'CREDITS', 'DEBITS'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-md transition ${
                  filter === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {filteredTx.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No token transactions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3">Date & Time</th>
                  <th className="text-left px-5 py-3">Type</th>
                  <th className="text-left px-5 py-3">Description</th>
                  <th className="text-right px-5 py-3">Tokens</th>
                  <th className="text-right px-5 py-3">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTx.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          tx.tx_type === 'TRIP_PAYOUT' || tx.tx_type === 'WELCOME_BONUS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : tx.tx_type === 'BOOKING_REFUND'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {tx.tx_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{tx.description}</td>
                    <td
                      className={`px-5 py-3 text-right font-bold whitespace-nowrap ${
                        tx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-slate-700 whitespace-nowrap">
                      {tx.balance_after}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
