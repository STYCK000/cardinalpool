export type UniversityRole = 'STUDENT' | 'FACULTY';
export type UserMode = 'RIDER' | 'DRIVER';
export type TripStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  university_role: UniversityRole;
  department: string;
  university_id_number: string;
  active_mode: UserMode;
  can_drive: boolean;
  email_verified: boolean;
  token_balance: number;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_color?: string | null;
  vehicle_plate_number?: string | null;
  vehicle_seat_capacity?: number | null;
}

export interface PickupPoint {
  id: string;
  trip_id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  sequence_order: number;
  estimated_offset_minutes: number;
}

export interface LiveLocation {
  trip_id: string;
  user_id: string;
  full_name: string;
  role: UserMode;
  lat: number;
  lng: number;
  heading?: number | null;
  speed_kmh?: number | null;
  updated_at: string;
}

export interface LiveEtaSummary {
  driverToPickupMinutes: number | null;
  driverToPickupKm: number | null;
  etaToPickupIso: string | null;
  driverToCampusMinutes: number;
  driverToCampusKm: number;
  etaToCampusIso: string;
  calculatedAt: string;
  source: 'OSRM' | 'HAVERSINE_FALLBACK';
}

export interface TripBookingItem {
  id: string;
  trip_id: string;
  rider_id: string;
  rider_name?: string;
  rider_role?: UniversityRole;
  rider_department?: string;
  rider_university_id?: string;
  rider_avg_rating?: number | null;
  rider_rating_count?: number;
  driver_avg_rating?: number | null;
  driver_rating_count?: number;
  rider_has_rated?: boolean;
  rider_rating_stars?: number | null;
  driver_has_rated?: boolean;
  driver_rating_stars?: number | null;
  pickup_point_id: string;
  pickup_label: string;
  pickup_address?: string;
  pickup_sequence?: number;
  pickup_lat: number;
  pickup_lng: number;
  seats_booked: number;
  tokens_escrowed: number;
  status: string;
  booked_at: string;
  origin_name?: string;
  destination_name?: string;
  departure_time?: string;
  trip_status?: TripStatus;
  driver_name?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_plate_number?: string;
}

export interface Trip {
  id: string;
  driver_id: string;
  driver_name: string;
  driver_role: UniversityRole;
  driver_department: string;
  driver_avg_rating?: number | null;
  driver_rating_count?: number;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  vehicle_plate_number?: string;
  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  departure_time: string;
  total_seats: number;
  available_seats: number;
  token_cost: number;
  status: TripStatus;
  notes?: string | null;
  route_geojson?: {
    type: 'LineString';
    coordinates: [number, number][];
  } | null;
  pickup_points: PickupPoint[];
  bookings?: TripBookingItem[];
  live_locations?: LiveLocation[];
  eta?: LiveEtaSummary;
  booking_eligible?: boolean;
  hours_until_departure?: number;
  booking_window_reason?: string | null;
}

export interface TokenTransaction {
  id: string;
  tx_type: 'WELCOME_BONUS' | 'BOOKING_ESCROW' | 'TRIP_PAYOUT' | 'BOOKING_REFUND' | 'ADMIN_ADJUSTMENT';
  amount: number;
  balance_after: number;
  description: string;
  counterparty_name?: string | null;
  trip_id?: string | null;
  booking_id?: string | null;
  created_at: string;
}

export interface WalletData {
  tokenBalance: number;
  escrowedTokens: number;
  totalEarned: number;
  totalSpent: number;
  transactions: TokenTransaction[];
}

export const MAPUA_INTRAMUROS_COORDS: [number, number] = [14.5902, 120.9787];

export interface RatingSummary {
  avg_rating: number | null;
  rating_count: number;
  as_driver_avg: number | null;
  as_driver_count: number;
  as_rider_avg: number | null;
  as_rider_count: number;
}

export interface RatingReview {
  id: string;
  stars: number;
  comment: string | null;
  rater_role: UserMode;
  rater_name: string;
  rater_university_role: UniversityRole;
  origin_name: string;
  created_at: string;
}
