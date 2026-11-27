-- ============================================================================
-- CardiRide — Mapúa University Intramuros Carpooling Database Schema
-- PostgreSQL 15+
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom ENUM types
DO $$ BEGIN
  CREATE TYPE university_role AS ENUM ('STUDENT', 'FACULTY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_mode AS ENUM ('RIDER', 'DRIVER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trip_status AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('CONFIRMED', 'BOARDED', 'COMPLETED', 'CANCELLED', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE token_tx_type AS ENUM (
    'WELCOME_BONUS',
    'BOOKING_ESCROW',
    'TRIP_PAYOUT',
    'BOOKING_REFUND',
    'ADMIN_ADJUSTMENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 1. USERS TABLE
-- Strictly enforces Mapúa University institutional email domains:
--   - Students: @mymail.mapua.edu.ph
--   - Faculty / Employees: @mapua.edu.ph
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                         VARCHAR(255) NOT NULL UNIQUE,
  password_hash                 TEXT NOT NULL,
  full_name                     VARCHAR(150) NOT NULL,
  university_role               university_role NOT NULL,
  department                    VARCHAR(150) NOT NULL,
  university_id_number          VARCHAR(40) NOT NULL UNIQUE,
  active_mode                   user_mode NOT NULL DEFAULT 'RIDER',
  can_drive                     BOOLEAN NOT NULL DEFAULT FALSE,

  -- Institutional email verification
  email_verified                BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token            VARCHAR(128),
  verification_token_expires_at TIMESTAMPTZ,

  -- Token-based economy (non-negative balance enforced at DB level)
  token_balance                 INTEGER NOT NULL DEFAULT 100 CHECK (token_balance >= 0),

  -- Driver vehicle details (required when can_drive = TRUE)
  vehicle_make                  VARCHAR(80),
  vehicle_model                 VARCHAR(80),
  vehicle_color                 VARCHAR(40),
  vehicle_plate_number          VARCHAR(20),
  vehicle_seat_capacity         INTEGER CHECK (vehicle_seat_capacity IS NULL OR (vehicle_seat_capacity BETWEEN 1 AND 8)),

  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_mapua_institutional_email CHECK (
    LOWER(email) ~ '^[a-z0-9._%+-]+@(mymail\.)?mapua\.edu\.ph$'
  ),
  CONSTRAINT chk_driver_vehicle_complete CHECK (
    can_drive = FALSE OR (
      vehicle_make IS NOT NULL AND
      vehicle_model IS NOT NULL AND
      vehicle_color IS NOT NULL AND
      vehicle_plate_number IS NOT NULL AND
      vehicle_seat_capacity IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users (verification_token) WHERE verification_token IS NOT NULL;

-- ============================================================================
-- 2. TRIPS TABLE
-- All trips terminate at the single fixed destination:
--   Mapúa University - Intramuros (658 Muralla St, Intramuros, Manila)
--   Coordinates: 14.5902, 120.9787
-- ============================================================================
CREATE TABLE IF NOT EXISTS trips (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  origin_name         VARCHAR(200) NOT NULL,
  origin_lat          DOUBLE PRECISION NOT NULL CHECK (origin_lat BETWEEN -90 AND 90),
  origin_lng          DOUBLE PRECISION NOT NULL CHECK (origin_lng BETWEEN -180 AND 180),

  -- Single fixed destination: Mapúa University Intramuros
  destination_name    VARCHAR(200) NOT NULL DEFAULT 'Mapúa University - Intramuros (658 Muralla St, Intramuros, Manila)'
                      CHECK (destination_name = 'Mapúa University - Intramuros (658 Muralla St, Intramuros, Manila)'),
  destination_lat     DOUBLE PRECISION NOT NULL DEFAULT 14.5902
                      CHECK (destination_lat = 14.5902),
  destination_lng     DOUBLE PRECISION NOT NULL DEFAULT 120.9787
                      CHECK (destination_lng = 120.9787),

  departure_time      TIMESTAMPTZ NOT NULL,
  total_seats         INTEGER NOT NULL CHECK (total_seats BETWEEN 1 AND 8),
  available_seats     INTEGER NOT NULL CHECK (available_seats >= 0 AND available_seats <= total_seats),
  token_cost          INTEGER NOT NULL CHECK (token_cost > 0),
  status              trip_status NOT NULL DEFAULT 'SCHEDULED',
  route_geojson       JSONB,
  notes               TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trips_status_departure ON trips (status, departure_time);
CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips (driver_id);

-- ============================================================================
-- 3. PICKUP POINTS TABLE
-- Custom along-the-way pick-up stops defined by the driver for each trip
-- ============================================================================
CREATE TABLE IF NOT EXISTS pickup_points (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id                   UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  label                     VARCHAR(150) NOT NULL,
  address                   VARCHAR(255) NOT NULL,
  lat                       DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng                       DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  sequence_order            INTEGER NOT NULL CHECK (sequence_order >= 1),
  estimated_offset_minutes  INTEGER NOT NULL DEFAULT 0 CHECK (estimated_offset_minutes >= 0),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (trip_id, sequence_order)
);

CREATE INDEX IF NOT EXISTS idx_pickup_points_trip_id ON pickup_points (trip_id, sequence_order);

-- ============================================================================
-- 4. BOOKINGS TABLE
-- Links a verified Mapúa rider to a trip and their chosen pick-up point.
-- Tokens are held in escrow upon booking and released to the driver on completion.
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id           UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  rider_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pickup_point_id   UUID NOT NULL REFERENCES pickup_points(id) ON DELETE RESTRICT,
  seats_booked      INTEGER NOT NULL DEFAULT 1 CHECK (seats_booked >= 1),
  tokens_escrowed   INTEGER NOT NULL CHECK (tokens_escrowed > 0),
  status            booking_status NOT NULL DEFAULT 'CONFIRMED',
  booked_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate active bookings by the same rider on the same trip
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_rider_booking
  ON bookings (trip_id, rider_id)
  WHERE status IN ('CONFIRMED', 'BOARDED');

CREATE INDEX IF NOT EXISTS idx_bookings_rider_id ON bookings (rider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_trip_id ON bookings (trip_id);

-- ============================================================================
-- 5. TOKEN TRANSACTIONS TABLE (Immutable Ledger)
-- Records every token movement: welcome bonus, booking escrow, driver payout, refunds
-- ============================================================================
CREATE TABLE IF NOT EXISTS token_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  counterparty_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  trip_id           UUID REFERENCES trips(id) ON DELETE SET NULL,
  booking_id        UUID REFERENCES bookings(id) ON DELETE SET NULL,
  tx_type           token_tx_type NOT NULL,
  amount            INTEGER NOT NULL CHECK (amount <> 0),
  balance_after     INTEGER NOT NULL CHECK (balance_after >= 0),
  description       TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_tx_user_created ON token_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_tx_trip_id ON token_transactions (trip_id);

-- ============================================================================
-- 6. LIVE LOCATIONS TABLE
-- Stores latest real-time GPS coordinates for drivers and booked riders
-- ============================================================================
CREATE TABLE IF NOT EXISTS live_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        user_mode NOT NULL,
  lat         DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng         DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  heading     DOUBLE PRECISION,
  speed_kmh   DOUBLE PRECISION CHECK (speed_kmh IS NULL OR speed_kmh >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (trip_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_locations_trip_id ON live_locations (trip_id);

-- ============================================================================
-- 7. DB-LEVEL GUARDRAIL TRIGGER FOR 24-HOUR ADVANCE BOOKING RULE
-- Provides defense-in-depth alongside backend API validation
-- ============================================================================
CREATE OR REPLACE FUNCTION enforce_24h_advance_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_departure_time TIMESTAMPTZ;
BEGIN
  SELECT departure_time INTO v_departure_time
  FROM trips
  WHERE id = NEW.trip_id;

  IF v_departure_time IS NULL THEN
    RAISE EXCEPTION 'Trip not found for booking';
  END IF;

  IF v_departure_time - NEW.booked_at < INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'BOOKING_WINDOW_CLOSED: Rides must be booked at least 24 hours before scheduled departure.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_24h_advance_booking ON bookings;
CREATE TRIGGER trg_enforce_24h_advance_booking
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_24h_advance_booking();

-- Updated-at auto-maintenance trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_trips_updated_at ON trips;
CREATE TRIGGER trg_trips_updated_at BEFORE UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON bookings;
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- CardiRide Migration: Two-Way Rider & Driver Rating System
-- Safe to run on an existing RDS PostgreSQL database without wiping data.
-- ============================================================================

CREATE TABLE IF NOT EXISTS trip_ratings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  rater_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ratee_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rater_role  user_mode NOT NULL,
  stars       INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (booking_id, rater_id),
  CONSTRAINT chk_no_self_rating CHECK (rater_id <> ratee_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_ratings_ratee ON trip_ratings (ratee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_ratings_trip ON trip_ratings (trip_id);
