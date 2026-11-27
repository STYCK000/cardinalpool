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
