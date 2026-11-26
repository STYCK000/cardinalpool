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
    Icon: React.ComponentType<{ className?: string }>;
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
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => onSelectTab('browse')}
            className="flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cardinal-600 focus-visible:ring-offset-2"
            aria-label="CardiRide home"
          >
            <img src="/cardiride-icon.png" alt="" className="h-9 w-9 rounded-xl object-contain" />
            <span className="hidden text-left leading-none sm:block">
              <span className="block font-display text-[17px] font-bold tracking-tight text-cardinal-800">
                CardiRide
              </span>
              <span className="mt-1 block text-[11px] text-slate-500">Mapúans Moving Mapúans</span>
            </span>
          </button>

          <nav className="ml-4 hidden h-full items-stretch gap-1 md:flex" aria-label="Primary">
            {navItems.map(({ id, label, Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectTab(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex items-center gap-2 px-3.5 text-sm font-medium transition-colors duration-150 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:rounded-full after:bg-cardinal-700 after:transition-transform after:duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cardinal-600 ${
                    active
                      ? 'text-cardinal-800 after:scale-x-100'
                      : 'text-slate-600 after:scale-x-0 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
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
              className="inline-flex items-center gap-1.5 rounded-full bg-gold-400/15 px-3 py-1.5 text-sm font-semibold tabular-nums text-amber-900 ring-1 ring-gold-500/35 transition hover:bg-gold-400/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-600"
            >
              <Coins className="h-4 w-4 text-gold-600" />
              {user.token_balance}
              <span className="hidden text-xs font-medium text-amber-800/70 sm:inline">tokens</span>
            </button>

            <div
              role="group"
              aria-label="Switch between rider and driver mode"
              className="relative grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-xs font-semibold"
            >
              <span
                aria-hidden
                className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-white shadow-sm ring-1 ring-slate-200 transition-transform duration-300 ease-[cubic-bezier(0.3,0.9,0.3,1)] ${
                  shownMode === 'DRIVER' ? 'translate-x-full' : 'translate-x-0'
                }`}
              />
              {(['RIDER', 'DRIVER'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={shownMode === m}
                  onClick={() => handleSelectMode(m)}
                  className={`relative z-10 rounded-lg px-3 py-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cardinal-600 ${
                    shownMode === m ? 'text-cardinal-800' : 'text-slate-500 hover:text-slate-800'
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
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cardinal-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Phone navigation sits under the thumb */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
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
                className={`relative flex flex-col items-center gap-0.5 pb-2 pt-2.5 text-[11px] font-medium transition-colors duration-150 before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-full before:bg-cardinal-700 before:transition-transform before:duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cardinal-600 ${
                  active ? 'text-cardinal-800 before:scale-x-100' : 'text-slate-500 before:scale-x-0'
                }`}
              >
                <Icon className={`h-5 w-5 transition-transform duration-200 ${active ? 'scale-110' : ''}`} />
                {short}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
