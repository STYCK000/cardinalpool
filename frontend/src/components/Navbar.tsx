import React from 'react';
import { Car, Coins, Compass, LogOut, MapPin, User, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ActiveTab = 'browse' | 'my-trips' | 'map' | 'wallet' | 'profile';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onModeError: (msg: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab, onModeError }) => {
  const { user, logout, switchMode } = useAuth();
  if (!user) return null;

  const handleToggleMode = async () => {
    const nextMode = user.active_mode === 'RIDER' ? 'DRIVER' : 'RIDER';
    try {
      await switchMode(nextMode);
    } catch (err) {
      onModeError((err as Error).message);
      onSelectTab('profile');
    }
  };

  const navItems: Array<{ id: ActiveTab; label: string; icon: React.ReactNode }> = [
    { id: 'browse', label: 'Find Rides', icon: <Compass className="w-4 h-4" /> },
    {
      id: 'my-trips',
      label: user.active_mode === 'DRIVER' ? 'My Posted Trips' : 'My Bookings',
      icon: <Car className="w-4 h-4" />,
    },
    { id: 'map', label: 'Live Map', icon: <MapPin className="w-4 h-4" /> },
    { id: 'wallet', label: 'Token Wallet', icon: <Wallet className="w-4 h-4" /> },
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  ];

  return (
    <header className="bg-cardinal-800 text-white shadow-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-3">
            <img src="/cardiride-icon.png" alt="CardiRide" className="w-10 h-10 rounded-lg bg-white p-0.5 object-contain shadow" />
            <div>
              <div className="font-bold tracking-tight leading-none text-base">CardiRide</div>
              <div className="text-[11px] text-red-200 mt-0.5">
                Mapúans Moving Mapúans
              </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === item.id
                    ? 'bg-cardinal-900 text-gold-400'
                    : 'text-red-100 hover:bg-cardinal-700'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onSelectTab('wallet')}
              className="flex items-center gap-1.5 bg-cardinal-900/80 border border-gold-500/40 px-3 py-1.5 rounded-full text-sm font-semibold text-gold-400 hover:bg-cardinal-900 transition"
              title="Cardinal Token Balance"
            >
              <Coins className="w-4 h-4" />
              <span>{user.token_balance}</span>
              <span className="hidden sm:inline text-xs font-normal text-red-200">tokens</span>
            </button>

            <button
              onClick={handleToggleMode}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/20 transition"
              title="Click to switch between Rider and Driver mode"
            >
              Mode: <span className="text-gold-400">{user.active_mode}</span>
            </button>

            <button
              onClick={logout}
              className="p-2 rounded-lg text-red-200 hover:text-white hover:bg-cardinal-700 transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        <div className="flex md:hidden items-center gap-1 pb-2 overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                activeTab === item.id
                  ? 'bg-cardinal-900 text-gold-400'
                  : 'text-red-100 hover:bg-cardinal-700'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};
