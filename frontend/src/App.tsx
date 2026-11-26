import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Compass, MapPin, Plus, Ticket } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { Navbar, ActiveTab } from './components/Navbar';
import { AuthView } from './components/AuthView';
import { TripCard } from './components/TripCard';
import { BookingCard } from './components/BookingCard';
import { CreateTripModal } from './components/CreateTripModal';
import { LiveTripMap } from './components/LiveTripMap';
import { WalletDashboard } from './components/WalletDashboard';
import { ProfileSettings } from './components/ProfileSettings';
import { EmptyState, Skeleton, Toast, btn, cardCls } from './components/ui';
import { Trip, TripBookingItem } from './types';
import { apiRequest } from './services/api';

type Banner = { type: 'success' | 'error'; text: string } | null;

const TripCardSkeleton: React.FC = () => (
  <div className={`${cardCls} space-y-5 p-5`} aria-hidden>
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 space-y-2.5">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <Skeleton className="h-14 w-16" />
    </div>
    <Skeleton className="h-24 w-full rounded-xl" />
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
    <Skeleton className="h-10 w-full rounded-xl" />
  </div>
);

const PageHeading: React.FC<{
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, children, action }) => (
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
      {children && <p className="mt-1 text-sm leading-relaxed text-slate-500">{children}</p>}
    </div>
    {action}
  </div>
);

export default function App() {
  const { user, loading, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('browse');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [myBookings, setMyBookings] = useState<TripBookingItem[]>([]);
  const [selectedMapTripId, setSelectedMapTripId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  const loadTripsAndBookings = useCallback(async () => {
    if (!user) return;
    try {
      const [tripsRes, bookingsRes] = await Promise.all([
        apiRequest<{ trips: Trip[] }>('/trips'),
        apiRequest<{ bookings: TripBookingItem[] }>('/bookings/me'),
      ]);
      setTrips(tripsRes.trips);
      setMyBookings(bookingsRes.bookings);
      // Pick a default map trip once, without re-fetching every time the selection changes
      setSelectedMapTripId((current) => current ?? tripsRes.trips[0]?.id ?? null);
    } catch (err) {
      setBanner({ type: 'error', text: (err as Error).message });
    } finally {
      setTripsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadTripsAndBookings();
  }, [loadTripsAndBookings]);

  // Messages clear themselves so they never pile up over the page
  useEffect(() => {
    if (!banner) return;
    const timer = window.setTimeout(() => setBanner(null), banner.type === 'error' ? 8000 : 5000);
    return () => window.clearTimeout(timer);
  }, [banner]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper">
        <img src="/cardiride-icon.png" alt="" className="h-14 w-14 animate-pulse object-contain" />
        <p className="text-sm text-slate-500">Loading CardiRide</p>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  const handleBookSeat = async (tripId: string, pickupPointId: string) => {
    setBanner(null);
    try {
      const res = await apiRequest<{ message: string }>('/bookings', {
        method: 'POST',
        body: JSON.stringify({ tripId, pickupPointId, seatsBooked: 1 }),
      });
      setBanner({ type: 'success', text: res.message });
      await Promise.all([loadTripsAndBookings(), refreshUser()]);
    } catch (err) {
      setBanner({ type: 'error', text: (err as Error).message });
    }
  };

  const handleStartTrip = async (tripId: string) => {
    setBanner(null);
    try {
      await apiRequest(`/trips/${tripId}/start`, { method: 'POST' });
      setBanner({ type: 'success', text: 'Trip started. Open the live map to share your GPS.' });
      setSelectedMapTripId(tripId);
      setActiveTab('map');
      await loadTripsAndBookings();
    } catch (err) {
      setBanner({ type: 'error', text: (err as Error).message });
    }
  };

  const handleCompleteTrip = async (tripId: string) => {
    setBanner(null);
    try {
      const res = await apiRequest<{ message: string }>(`/trips/${tripId}/complete`, {
        method: 'POST',
      });
      setBanner({ type: 'success', text: res.message });
      await Promise.all([loadTripsAndBookings(), refreshUser()]);
    } catch (err) {
      setBanner({ type: 'error', text: (err as Error).message });
    }
  };

  const handleMarkBoarded = async (bookingId: string) => {
    setBanner(null);
    try {
      const res = await apiRequest<{ message: string }>(`/bookings/${bookingId}/board`, {
        method: 'POST',
      });
      setBanner({ type: 'success', text: res.message });
      await loadTripsAndBookings();
    } catch (err) {
      setBanner({ type: 'error', text: (err as Error).message });
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    setBanner(null);
    try {
      const res = await apiRequest<{ message: string }>(`/bookings/${bookingId}/cancel`, {
        method: 'POST',
      });
      setBanner({ type: 'success', text: res.message });
      await Promise.all([loadTripsAndBookings(), refreshUser()]);
    } catch (err) {
      setBanner({ type: 'error', text: (err as Error).message });
    }
  };

  const openMapFor = (id: string) => {
    setSelectedMapTripId(id);
    setActiveTab('map');
  };

  const myDrivenTrips = trips.filter((t) => t.driver_id === user.id);
  const isDriverMode = user.active_mode === 'DRIVER';
  const seatsOpen = trips.reduce((sum, t) => sum + t.available_seats, 0);

  const postTripButton = (
    <button type="button" onClick={() => setShowCreateModal(true)} className={btn('primary')}>
      <Plus className="h-4 w-4" />
      Post a trip
    </button>
  );

  const tripGrid = (list: Trip[], own: boolean) => (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {list.map((trip) => (
        <TripCard
          key={trip.id}
          trip={trip}
          isOwnTrip={own || trip.driver_id === user.id}
          onBook={handleBookSeat}
          onOpenMap={openMapFor}
          onStartTrip={handleStartTrip}
          onCompleteTrip={handleCompleteTrip}
          onMarkBoarded={handleMarkBoarded}
        />
      ))}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onModeError={(msg) => setBanner({ type: 'error', text: msg })}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-12 lg:px-8">
        <div key={activeTab} className="animate-fade-in space-y-6">
          {/* FIND RIDES */}
          {activeTab === 'browse' && (
            <>
              <section className="relative overflow-hidden rounded-3xl bg-cardinal-800 text-white">
                <svg
                  aria-hidden
                  viewBox="0 0 420 220"
                  className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[52%] md:block"
                  preserveAspectRatio="xMaxYMid slice"
                  fill="none"
                >
                  <path
                    d="M10 190 C 90 190, 90 110, 170 118 S 290 170, 335 80 S 390 40, 410 36"
                    stroke="rgba(255,255,255,0.28)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="2 9"
                  />
                  <circle cx="10" cy="190" r="6" fill="#7F1D1D" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" />
                  <circle cx="170" cy="118" r="6" fill="#FBBF24" />
                  <circle cx="335" cy="80" r="6" fill="#FBBF24" />
                  <circle cx="410" cy="36" r="11" fill="#FBBF24" />
                  <circle cx="410" cy="36" r="4" fill="#7F1D1D" />
                </svg>

                <div className="relative flex flex-col gap-6 p-6 sm:p-8 md:max-w-[62%]">
                  <div>
                    <h1 className="text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl">
                      Rides to Mapúa Intramuros
                    </h1>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-red-100/90 sm:text-base">
                      Pick a stop along the driver&apos;s route and reserve a seat. Bookings close 24
                      hours before departure.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                    {!tripsLoading && trips.length > 0 && (
                      <dl className="flex gap-8">
                        <div>
                          <dd className="font-display text-3xl font-bold tabular-nums text-gold-400">
                            {trips.length}
                          </dd>
                          <dt className="text-xs text-red-100/80">upcoming rides</dt>
                        </div>
                        <div>
                          <dd className="font-display text-3xl font-bold tabular-nums text-gold-400">
                            {seatsOpen}
                          </dd>
                          <dt className="text-xs text-red-100/80">open seats</dt>
                        </div>
                      </dl>
                    )}
                    {isDriverMode && (
                      <button
                        type="button"
                        onClick={() => setShowCreateModal(true)}
                        className={btn('gold')}
                      >
                        <Plus className="h-4 w-4" />
                        Post a trip
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {tripsLoading ? (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <TripCardSkeleton />
                  <TripCardSkeleton />
                </div>
              ) : trips.length === 0 ? (
                <EmptyState
                  icon={<Compass className="h-6 w-6" />}
                  title="No rides scheduled yet"
                  action={isDriverMode ? postTripButton : undefined}
                >
                  {isDriverMode
                    ? 'Be the first to post a ride to Intramuros.'
                    : 'Switch to Driver mode to post the first ride to Intramuros.'}
                </EmptyState>
              ) : (
                tripGrid(trips, false)
              )}
            </>
          )}

          {/* MY TRIPS OR MY BOOKINGS */}
          {activeTab === 'my-trips' && (
            <>
              {isDriverMode ? (
                <>
                  <PageHeading
                    title="My trips"
                    action={postTripButton}
                  >
                    See who is riding with you, where they get picked up, and mark them as picked up.
                  </PageHeading>
                  {tripsLoading ? (
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                      <TripCardSkeleton />
                    </div>
                  ) : myDrivenTrips.length === 0 ? (
                    <EmptyState
                      icon={<Compass className="h-6 w-6" />}
                      title="You have not posted any trips"
                      action={postTripButton}
                    >
                      Schedule a carpool to Mapúa Intramuros and riders can start booking seats.
                    </EmptyState>
                  ) : (
                    tripGrid(myDrivenTrips, true)
                  )}
                </>
              ) : (
                <>
                  <PageHeading title="My bookings">
                    Seats you have reserved. Cancel before the trip starts to get your tokens back.
                  </PageHeading>
                  {tripsLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-28 w-full rounded-2xl" />
                      <Skeleton className="h-28 w-full rounded-2xl" />
                    </div>
                  ) : myBookings.length === 0 ? (
                    <EmptyState
                      icon={<Ticket className="h-6 w-6" />}
                      title="No bookings yet"
                      action={
                        <button type="button" onClick={() => setActiveTab('browse')} className={btn('primary')}>
                          Find a ride
                        </button>
                      }
                    >
                      Browse upcoming rides and reserve a seat at least 24 hours ahead.
                    </EmptyState>
                  ) : (
                    <div className="space-y-3">
                      {myBookings.map((b) => (
                        <BookingCard
                          key={b.id}
                          booking={b}
                          onTrack={openMapFor}
                          onCancel={handleCancelBooking}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* LIVE MAP */}
          {activeTab === 'map' && (
            <>
              <PageHeading
                title="Live map"
                action={
                  trips.length > 0 ? (
                    <div className="relative">
                      <label htmlFor="map-trip" className="sr-only">
                        Choose a trip to follow
                      </label>
                      <select
                        id="map-trip"
                        value={selectedMapTripId || ''}
                        onChange={(e) => setSelectedMapTripId(e.target.value)}
                        className="max-w-[18rem] appearance-none truncate rounded-xl border border-slate-300 bg-white py-2.5 pl-3.5 pr-9 text-sm font-medium text-slate-800 transition focus:border-cardinal-600 focus:outline-none focus:ring-4 focus:ring-cardinal-600/10"
                      >
                        {trips.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.origin_name} with {t.driver_name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
                    </div>
                  ) : undefined
                }
              >
                Follow the driver in real time, see each pick-up stop, and watch the ETA to Mapúa Intramuros update.
              </PageHeading>

              {selectedMapTripId ? (
                <LiveTripMap key={selectedMapTripId} tripId={selectedMapTripId} />
              ) : (
                <EmptyState icon={<MapPin className="h-6 w-6" />} title="No trip selected">
                  Book a ride or post a trip to open the live map.
                </EmptyState>
              )}
            </>
          )}

          {activeTab === 'wallet' && <WalletDashboard />}
          {activeTab === 'profile' && <ProfileSettings />}
        </div>
      </main>

      {showCreateModal && (
        <CreateTripModal
          onClose={() => setShowCreateModal(false)}
          onCreated={loadTripsAndBookings}
        />
      )}

      {banner && (
        <Toast
          key={banner.text}
          type={banner.type}
          text={banner.text}
          onClose={() => setBanner(null)}
        />
      )}
    </div>
  );
}
