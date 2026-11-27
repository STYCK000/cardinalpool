import React, { useState } from 'react';
import { Car, Coins, Compass, LogOut, MapPin, User, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ActiveTab = 'browse' | 'my-trips' | 'map' | 'wallet' | 'profile';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onModeError: (msg: string) => void;
}

type UserMode = 'RIDER' | 'DRIVER';

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab, onModeError }) => {
  const { user, logout, switchMode } = useAuth();
  // Move the switch right away and roll back if the server says no
  const [pendingMode, setPendingMode] = useState<UserMode | null>(null);
  if (!user) return null;

  const shownMode: UserMode = pendingMode ?? user.active_mode;

  const handleSelectMode = async (next: UserMode) => {
    if (next === shownMode || pendingMode) return;
    setPendingMode(next);
    try {
      await switchMode(next);
    } catch (err) {
      onModeError((err as Error).message);
      onSelectTab('profile');
    } finally {
      setPendingMode(null);
    }
  };

  const isDriver = user.active_mode === 'DRIVER';

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    short: string;
    Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  }> = [
    { id: 'browse', label: 'Find rides', short: 'Rides', Icon: Compass },
    {
      id: 'my-trips',
      label: isDriver ? 'My trips' : 'My bookings',
      short: isDriver ? 'Trips' : 'Bookings',
      Icon: Car,
    },
    { id: 'map', label: 'Live map', short: 'Map', Icon: MapPin },
    { id: 'wallet', label: 'Wallet', short: 'Wallet', Icon: Wallet },
    { id: 'profile', label: 'Profile', short: 'Profile', Icon: User },
  ];

  return (
    <>
      <header className="glass sticky top-0 z-40 border-b border-black/[0.06]">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => onSelectTab('browse')}
            className="flex items-center gap-2.5 rounded-xl transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cardinal-600 focus-visible:ring-offset-2"
            aria-label="CardiRide home"
          >
            <img src="/cardiride-icon.png" alt="" className="h-8 w-8 rounded-[10px] object-contain" />
            <span className="hidden font-display text-[17px] font-semibold tracking-tight text-slate-900 sm:block">
              CardiRide
            </span>
          </button>

          <nav className="ml-3 hidden items-center gap-0.5 md:flex" aria-label="Primary">
            {navItems.map(({ id, label, Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectTab(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[14px] font-medium tracking-[-0.01em] transition duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cardinal-600 ${
                    active
                      ? 'bg-slate-900/[0.07] text-slate-900'
                      : 'text-slate-500 hover:bg-slate-900/[0.04] hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-[17px] w-[17px]" strokeWidth={active ? 2.1 : 1.8} />
                  {label}
                </button>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectTab('wallet')}
              title="Cardinal token balance"
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/[0.05] px-3 py-1.5 text-[13px] font-semibold tabular-nums text-slate-900 transition duration-200 hover:bg-slate-900/[0.09] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cardinal-600"
            >
              <Coins className="h-4 w-4 text-gold-600" strokeWidth={2} />
              {user.token_balance}
              <span className="hidden text-xs font-medium text-slate-500 sm:inline">tokens</span>
            </button>

            <div
              role="group"
              aria-label="Switch between rider and driver mode"
              className="relative grid grid-cols-2 rounded-full bg-slate-900/[0.06] p-0.5 text-[13px] font-medium"
            >
              <span
                aria-hidden
                className={`absolute inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-full bg-white shadow-thumb transition-transform duration-[450ms] ease-apple ${
                  shownMode === 'DRIVER' ? 'translate-x-full' : 'translate-x-0'
                }`}
              />
              {(['RIDER', 'DRIVER'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={shownMode === m}
                  onClick={() => handleSelectMode(m)}
                  className={`relative z-10 rounded-full px-3.5 py-1 transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cardinal-600 ${
                    shownMode === m ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {m === 'RIDER' ? 'Rider' : 'Driver'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={logout}
              title="Sign out"
              aria-label="Sign out"
              className="rounded-full p-2 text-slate-500 transition duration-200 hover:bg-slate-900/[0.05] hover:text-slate-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cardinal-600"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </header>

      {/* Phone navigation sits under the thumb, like a tab bar */}
      <nav
        aria-label="Primary"
        className="glass fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.06] pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {navItems.map(({ id, short, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10px] font-medium transition-colors duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cardinal-600 ${
                  active ? 'text-cardinal-700' : 'text-slate-400'
                }`}
              >
                <Icon
                  className={`h-[22px] w-[22px] transition-transform duration-300 ${active ? 'scale-105' : ''}`}
                  strokeWidth={active ? 2.1 : 1.7}
                />
                {short}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
