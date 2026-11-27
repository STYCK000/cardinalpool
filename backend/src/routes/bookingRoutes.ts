import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/db';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { validateAdvanceBookingWindow } from '../services/bookingRules';
import { applyTokenDelta } from '../services/tokenService';

const router = Router();

const createBookingSchema = z.object({
  tripId: z.string().uuid(),
  pickupPointId: z.string().uuid(),
  seatsBooked: z.number().int().min(1).max(4).default(1),
});

/**
 * POST /api/bookings
 * Books a seat on a scheduled trip to Mapúa University Intramuros.
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = createBookingSchema.parse(req.body);

    const outcome = await withTransaction(async (client) => {
      const tripRes = await client.query(
        `SELECT t.*, u.full_name AS driver_name
         FROM trips t
         JOIN users u ON u.id = t.driver_id
         WHERE t.id = $1
         FOR UPDATE OF t`,
        [body.tripId]
      );

      if (tripRes.rowCount === 0) {
        throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found.');
      }

      const trip = tripRes.rows[0];

      if (trip.driver_id === req.user!.id) {
        throw new AppError(400, 'SELF_BOOKING_NOT_ALLOWED', 'You cannot book a seat on your own trip.');
      }

      if (trip.status !== 'SCHEDULED') {
        throw new AppError(400, 'TRIP_NOT_BOOKABLE', 'This trip is no longer accepting bookings.');
      }

      const windowCheck = validateAdvanceBookingWindow(trip.departure_time);
      if (!windowCheck.allowed) {
        throw new AppError(400, 'BOOKING_WINDOW_CLOSED', windowCheck.reason || 'Must book at least 24 hours ahead.', {
          hoursUntilDeparture: Number(windowCheck.hoursUntilDeparture.toFixed(2)),
          requiredHours: windowCheck.requiredHours,
        });
      }

      if (trip.available_seats < body.seatsBooked) {
        throw new AppError(
          409,
          'INSUFFICIENT_SEATS',
          `Only ${trip.available_seats} seat(s) left on this carpool.`
        );
      }

      const pickupRes = await client.query(
        'SELECT id, label FROM pickup_points WHERE id = $1 AND trip_id = $2',
        [body.pickupPointId, trip.id]
      );

      if (pickupRes.rowCount === 0) {
        throw new AppError(400, 'INVALID_PICKUP_POINT', 'Selected pick-up point does not belong to this trip.');
      }

      const pickupPoint = pickupRes.rows[0];
      const totalTokenCost = trip.token_cost * body.seatsBooked;

      const bookingRes = await client.query(
        `INSERT INTO bookings (
           trip_id, rider_id, pickup_point_id, seats_booked, tokens_escrowed, status, booked_at
         ) VALUES ($1, $2, $3, $4, $5, 'CONFIRMED', NOW())
         RETURNING *`,
        [trip.id, req.user!.id, pickupPoint.id, body.seatsBooked, totalTokenCost]
      );
      const booking = bookingRes.rows[0];

      const walletUpdate = await applyTokenDelta(client, {
        userId: req.user!.id,
        counterpartyId: trip.driver_id,
        tripId: trip.id,
        bookingId: booking.id,
        txType: 'BOOKING_ESCROW',
        delta: -totalTokenCost,
        description: `Escrowed ${totalTokenCost} tokens for ${body.seatsBooked} seat(s) from ${pickupPoint.label} to Mapúa Intramuros (Driver: ${trip.driver_name})`,
      });

      await client.query(
        'UPDATE trips SET available_seats = available_seats - $1 WHERE id = $2',
        [body.seatsBooked, trip.id]
      );

      return {
        booking,
        balanceAfter: walletUpdate.balanceAfter,
        pickupLabel: pickupPoint.label,
      };
    });

    res.status(201).json({
      message: `Seat confirmed at ${outcome.pickupLabel}! ${outcome.booking.tokens_escrowed} tokens placed in escrow.`,
      booking: outcome.booking,
      tokenBalance: outcome.balanceAfter,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/bookings/me
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT b.*,
              t.origin_name, t.destination_name, t.departure_time, t.status AS trip_status,
              t.token_cost,
              u.full_name AS driver_name, u.vehicle_make, u.vehicle_model, u.vehicle_color, u.vehicle_plate_number,
              (SELECT ROUND(AVG(r.stars)::numeric, 1)::float FROM trip_ratings r WHERE r.ratee_id = t.driver_id) AS driver_avg_rating,
              (SELECT COUNT(*)::int FROM trip_ratings r WHERE r.ratee_id = t.driver_id) AS driver_rating_count,
              EXISTS(SELECT 1 FROM trip_ratings r WHERE r.booking_id = b.id AND r.rater_id = b.rider_id) AS rider_has_rated,
              (SELECT r.stars FROM trip_ratings r WHERE r.booking_id = b.id AND r.rater_id = b.rider_id LIMIT 1) AS rider_rating_stars,
              p.label AS pickup_label, p.address AS pickup_address, p.lat AS pickup_lat, p.lng AS pickup_lng
       FROM bookings b
       JOIN trips t ON t.id = b.trip_id
       JOIN users u ON u.id = t.driver_id
       JOIN pickup_points p ON p.id = b.pickup_point_id
       WHERE b.rider_id = $1
       ORDER BY t.departure_time DESC`,
      [req.user!.id]
    );

    res.json({ bookings: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/bookings/:id/board
 * Driver marks a booked rider as picked up / boarded at their stop.
 */
router.post('/:id/board', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE bookings b
       SET status = 'BOARDED'
       FROM trips t
       WHERE b.id = $1
         AND b.trip_id = t.id
         AND t.driver_id = $2
         AND b.status = 'CONFIRMED'
       RETURNING b.*`,
      [req.params.id, req.user!.id]
    );

    if (result.rowCount === 0) {
      throw new AppError(400, 'CANNOT_BOARD', 'Confirmed booking not found or you are not the driver.');
    }

    res.json({ message: 'Passenger marked as picked up!', booking: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/bookings/:id/cancel
 */
router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const outcome = await withTransaction(async (client) => {
      const bookingRes = await client.query(
        `SELECT b.*, t.departure_time, t.driver_id
         FROM bookings b
         JOIN trips t ON t.id = b.trip_id
         WHERE b.id = $1 AND b.rider_id = $2 AND b.status = 'CONFIRMED'
         FOR UPDATE OF b`,
        [req.params.id, req.user!.id]
      );

      if (bookingRes.rowCount === 0) {
        throw new AppError(404, 'BOOKING_NOT_FOUND', 'Confirmed booking not found.');
      }

      const booking = bookingRes.rows[0];
      const windowCheck = validateAdvanceBookingWindow(booking.departure_time);
      if (!windowCheck.allowed) {
        throw new AppError(
          400,
          'CANCELLATION_WINDOW_CLOSED',
          'Bookings cannot be cancelled within 24 hours of scheduled departure.'
        );
      }

      await client.query(`UPDATE bookings SET status = 'REFUNDED' WHERE id = $1`, [booking.id]);
      await client.query(
        'UPDATE trips SET available_seats = available_seats + $1 WHERE id = $2',
        [booking.seats_booked, booking.trip_id]
      );

      const wallet = await applyTokenDelta(client, {
        userId: req.user!.id,
        counterpartyId: booking.driver_id,
        tripId: booking.trip_id,
        bookingId: booking.id,
        txType: 'BOOKING_REFUND',
        delta: booking.tokens_escrowed,
        description: `Refunded ${booking.tokens_escrowed} Cardinal Tokens for cancelled carpool booking`,
      });

      return { refundedTokens: booking.tokens_escrowed, tokenBalance: wallet.balanceAfter };
    });

    res.json({
      message: `Booking cancelled and ${outcome.refundedTokens} Cardinal Tokens refunded to your wallet.`,
      ...outcome,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
