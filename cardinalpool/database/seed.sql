-- ============================================================================
-- CardinalPool — Seed Data for Local Development
-- Demo password for all seeded accounts: Cardinal2026!
-- (bcrypt hash of "Cardinal2026!" with 10 rounds)
-- ============================================================================

INSERT INTO users (
  id, email, password_hash, full_name, university_role, department,
  university_id_number, active_mode, can_drive, email_verified,
  token_balance, vehicle_make, vehicle_model, vehicle_color,
  vehicle_plate_number, vehicle_seat_capacity
) VALUES
(
  '11111111-1111-1111-1111-111111111111',
  'engr.santos@mapua.edu.ph',
  '$2a$10$8K1p/a0dL1LXMIgoEDFrwOfMQ0G6F7gY8c6qS3gN2oT8n0p3Z5w2W',
  'Engr. Marco Santos',
  'FACULTY',
  'School of Civil, Environmental, and Geological Engineering (SCEGE)',
  'FAC-2019-0412',
  'DRIVER',
  TRUE,
  TRUE,
  145,
  'Toyota',
  'Vios 1.3 XLE',
  'Silver Metallic',
  'NGA 4821',
  4
),
(
  '22222222-2222-2222-2222-222222222222',
  'jdelacruz@mymail.mapua.edu.ph',
  '$2a$10$8K1p/a0dL1LXMIgoEDFrwOfMQ0G6F7gY8c6qS3gN2oT8n0p3Z5w2W',
  'Juan Dela Cruz',
  'STUDENT',
  'School of Information Technology (SOIT)',
  '2023104821',
  'RIDER',
  FALSE,
  TRUE,
  85,
  NULL, NULL, NULL, NULL, NULL
),
(
  '33333333-3333-3333-3333-333333333333',
  'mreyes@mymail.mapua.edu.ph',
  '$2a$10$8K1p/a0dL1LXMIgoEDFrwOfMQ0G6F7gY8c6qS3gN2oT8n0p3Z5w2W',
  'Mikaela Reyes',
  'STUDENT',
  'School of Electrical, Electronics, and Computer Engineering (EECE)',
  '2022108934',
  'DRIVER',
  TRUE,
  TRUE,
  120,
  'Honda',
  'City RS',
  'Ignite Red',
  'NBC 7734',
  3
)
ON CONFLICT (email) DO NOTHING;

-- Welcome bonus transactions
INSERT INTO token_transactions (user_id, tx_type, amount, balance_after, description)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'WELCOME_BONUS', 100, 100, 'Welcome to CardinalPool — Mapúa University starter token grant'),
  ('22222222-2222-2222-2222-222222222222', 'WELCOME_BONUS', 100, 100, 'Welcome to CardinalPool — Mapúa University starter token grant'),
  ('33333333-3333-3333-3333-333333333333', 'WELCOME_BONUS', 100, 100, 'Welcome to CardinalPool — Mapúa University starter token grant')
ON CONFLICT DO NOTHING;

-- Sample Trip 1: Departing 36 hours from now (eligible for booking under 24-hour rule)
INSERT INTO trips (
  id, driver_id, origin_name, origin_lat, origin_lng,
  departure_time, total_seats, available_seats, token_cost, status, notes
) VALUES
(
  'aaaa1111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'SM North EDSA Sky Dome, Quezon City',
  14.6565,
  121.0305,
  NOW() + INTERVAL '36 hours',
  4,
  3,
  15,
  'SCHEDULED',
  'Taking Quezon Ave -> España Blvd -> Lerma -> Quezon Bridge -> Mapúa Intramuros. Please be at your stop 5 mins early.'
),
-- Sample Trip 2: Departing 12 hours from now (demonstrates 24-hour rule rejection on booking)
(
  'bbbb2222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  'Ayala Triangle Gardens, Makati',
  14.5570,
  121.0232,
  NOW() + INTERVAL '12 hours',
  3,
  3,
  20,
  'SCHEDULED',
  'Taking Gil Puyat -> Taft Ave -> Padre Burgos -> Intramuros. Booking window closed (<24h).'
)
ON CONFLICT (id) DO NOTHING;

-- Along-the-way pick-up points for Trip 1 (SM North -> Mapúa Intramuros)
INSERT INTO pickup_points (id, trip_id, label, address, lat, lng, sequence_order, estimated_offset_minutes)
VALUES
  ('c1111111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 'MRT Quezon Ave Station', 'EDSA cor. Quezon Ave, Quezon City', 14.6426, 121.0386, 1, 10),
  ('c2222222-2222-2222-2222-222222222222', 'aaaa1111-1111-1111-1111-111111111111', 'Welcome Rotonda', 'Quezon Ave cor. España Blvd, Manila', 14.6182, 121.0002, 2, 24),
  ('c3333333-3333-3333-3333-333333333333', 'aaaa1111-1111-1111-1111-111111111111', 'UST España Gate 2', 'España Blvd, Sampaloc, Manila', 14.6095, 120.9896, 3, 32)
ON CONFLICT DO NOTHING;

-- Along-the-way pick-up points for Trip 2 (Makati -> Mapúa Intramuros)
INSERT INTO pickup_points (id, trip_id, label, address, lat, lng, sequence_order, estimated_offset_minutes)
VALUES
  ('d1111111-1111-1111-1111-111111111111', 'bbbb2222-2222-2222-2222-222222222222', 'LRT Gil Puyat Station', 'Taft Ave cor. Sen. Gil Puyat Ave, Pasay', 14.5542, 120.9972, 1, 12),
  ('d2222222-2222-2222-2222-222222222222', 'bbbb2222-2222-2222-2222-222222222222', 'DLSU / Vito Cruz', 'Taft Ave, Malate, Manila', 14.5648, 120.9932, 2, 18),
  ('d3333333-3333-3333-3333-333333333333', 'bbbb2222-2222-2222-2222-222222222222', 'UN Avenue LRT Station', 'Taft Ave cor. United Nations Ave, Ermita', 14.5825, 120.9846, 3, 27)
ON CONFLICT DO NOTHING;

-- Seeded Booking for Juan on Trip 1 (booked >24h ahead)
INSERT INTO bookings (
  id, trip_id, rider_id, pickup_point_id, seats_booked, tokens_escrowed, status, booked_at
) VALUES (
  'e1111111-1111-1111-1111-111111111111',
  'aaaa1111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'c2222222-2222-2222-2222-222222222222',
  1,
  15,
  'CONFIRMED',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO token_transactions (user_id, counterparty_id, trip_id, booking_id, tx_type, amount, balance_after, description)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'aaaa1111-1111-1111-1111-111111111111',
  'e1111111-1111-1111-1111-111111111111',
  'BOOKING_ESCROW',
  -15,
  85,
  'Escrowed 15 Cardinal Tokens for ride from Welcome Rotonda to Mapúa Intramuros'
)
ON CONFLICT DO NOTHING;
