import React, { useCallback, useEffect, useState } from 'react';
import { PlusCircle, MapPin, ShieldAlert } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { Navbar, ActiveTab } from './components/Navbar';
import { AuthView } from './components/AuthView';
import { TripCard } from './components/TripCard';
import { CreateTripModal } from './components/CreateTripModal';
import { LiveTripMap } from './components/LiveTripMap';
import { WalletDashboard } from './components/WalletDashboard';
import { ProfileSettings } from './components/ProfileSettings';
import { Trip, TripBookingItem } from './types';
import { apiRequest } from './services/api';

export default function App() {
  const { user, loading, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('browse');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [myBookings, setMyBookings] = useState<TripBookingItem[]>([]);
  const [selectedMapTripId, setSelectedMapTripId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadTripsAndBookings = useCallback(async () => {
    if (!user) return;
    const [tripsRes, bookingsRes] = await Promise.all([
      apiRequest<{ trips: Trip[] }>('/trips'),
      apiRequest<{ bookings: TripBookingItem[] }>('/bookings/me'),
    ]);
    setTrips(tripsRes.trips);
    setMyBookings(bookingsRes.bookings);
    if (!selectedMapTripId && tripsRes.trips.length > 0) {
      setSelectedMapTripId(tripsRes.trips[0].id);
    }
  }, [user, selectedMapTripId]);

  useEffect(() => {
    loadTripsAndBookings();
  }, [loadTripsAndBookings]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        Loading CardinalPool...
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
      setBanner({ type: 'success', text: 'Trip started! Open the Live Map to broadcast your GPS.' });
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

  const myDrivenTrips = trips.filter((t) => t.driver_id === user.id);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onModeError={(msg) => setBanner({ type: 'error', text: msg })}
      />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-6">
        {banner && (
          <div
            className={`p-3.5 rounded-xl border text-sm flex items-center justify-between ${
              banner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <span>{banner.text}</span>
            <button
              onClick={() => setBanner(null)}
              className="text-xs font-semibold underline ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* BROWSE TRIPS */}
        {activeTab === 'browse' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Upcoming Rides to Mapúa University Intramuros
                </h1>
                <p className="text-sm text-slate-500">
                  All bookings require at least 24 hours advance notice. Select an along-the-way pick-up point to reserve your seat.
                </p>
              </div>
              {user.active_mode === 'DRIVER' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cardinal-700 hover:bg-cardinal-800 text-white text-sm font-semibold shadow-sm transition"
                >
                  <PlusCircle className="w-4 h-4" /> Post New Trip
                </button>
              )}
            </div>

            {trips.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
                No upcoming carpools scheduled yet. Switch to Driver mode to post the first ride to Intramuros!
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {trips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    isOwnTrip={trip.driver_id === user.id}
                    onBook={handleBookSeat}
                    onOpenMap={(id) => {
                      setSelectedMapTripId(id);
                      setActiveTab('map');
                    }}
                    onStartTrip={handleStartTrip}
                    onCompleteTrip={handleCompleteTrip}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* MY TRIPS / BOOKINGS */}
        {activeTab === 'my-trips' && (
          <div className="space-y-5">
            {user.active_mode === 'DRIVER' ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">My Posted Driver Trips</h2>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cardinal-700 text-white text-xs font-semibold"
                  >
                    <PlusCircle className="w-4 h-4" /> Post New Trip
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {myDrivenTrips.map((trip) => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      isOwnTrip
                      onBook={handleBookSeat}
                      onOpenMap={(id) => {
                        setSelectedMapTripId(id);
                        setActiveTab('map');
                      }}
                      onStartTrip={handleStartTrip}
                      onCompleteTrip={handleCompleteTrip}
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-slate-900">My Reserved Carpool Seats</h2>
                {myBookings.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                    You have not booked any rides yet. Browse upcoming trips to reserve a seat at least 24 hours ahead.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myBookings.map((b) => (
                      <div
                        key={b.id}
                        className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-cardinal-50 text-cardinal-800">
                              {b.status}
                            </span>
                            <span className="text-xs text-slate-500">
                              {b.departure_time ? new Date(b.departure_time).toLocaleString() : ''}
                            </span>
                          </div>
                          <div className="font-bold text-slate-900 mt-1">
                            Pick-up: {b.pickup_label} → Mapúa Intramuros
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Driver: {b.driver_name} ({b.vehicle_make} {b.vehicle_model} · {b.vehicle_plate_number}) ·{' '}
                            <strong>{b.tokens_escrowed} tokens</strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedMapTripId(b.trip_id);
                              setActiveTab('map');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                          >
                            <MapPin className="w-3.5 h-3.5 text-cardinal-700" /> Track Live
                          </button>
                          {b.status === 'CONFIRMED' && (
                            <button
                              onClick={() => handleCancelBooking(b.id)}
                              className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100"
                            >
                              Cancel & Refund
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* LIVE MAP */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Real-Time Trip Map & Dynamic ETA</h2>
                <p className="text-xs text-slate-500">
                  Live driver & rider markers, driver-defined pick-up stops, and dynamic ETAs to Mapúa Intramuros.
                </p>
              </div>
              {trips.length > 0 && (
                <select
                  value={selectedMapTripId || ''}
                  onChange={(e) => setSelectedMapTripId(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium bg-white"
                >
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.origin_name} ({t.status}) — {t.driver_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedMapTripId ? (
              <LiveTripMap tripId={selectedMapTripId} />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
                <ShieldAlert className="w-4 h-4" /> Select or create a trip to open the live map.
              </div>
            )}
          </div>
        )}

        {activeTab === 'wallet' && <WalletDashboard />}
        {activeTab === 'profile' && <ProfileSettings />}
      </main>

      {showCreateModal && (
        <CreateTripModal
          onClose={() => setShowCreateModal(false)}
          onCreated={loadTripsAndBookings}
        />
      )}
    </div>
  );
}
