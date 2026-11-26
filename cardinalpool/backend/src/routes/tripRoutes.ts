import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/db';
import { MAPUA_INTRAMUROS_DESTINATION } from '../config/constants';
import { requireAuth, requireDriverCapability } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { validateAdvanceBookingWindow } from '../services/bookingRules';
import { computeDrivingRoute, calculateDynamicEta } from '../services/etaService';
import { applyTokenDelta } from '../services/tokenService';

const router = Router();

const pickupPointSchema = z.object({
  label: z.string().min(2).max(150),
  address: z.string().min(2).max(255),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  estimatedOffsetMinutes: z.number().int().min(0).max(300).optional(),
});

const createTripSchema = z.object({
  originName: z.string().min(2).max(200),
  originLat: z.number().min(-90).max(90),
  originLng: z.number().min(-180).max(180),
  departureTime: z.string().datetime({ offset: true }),
  totalSeats: z.number().int().min(1).max(8),
  tokenCost: z.number().int().min(1).max(500),
  notes: z.string().max(500).optional(),
  pickupPoints: z
    .array(pickupPointSchema)
    .min(1, 'Please add at least one along-the-way pick-up point.')
    .max(10),
});

/**
 * POST /api/trips
 * Driver creates an upcoming trip terminating at the fixed destination:
 * Mapúa University - Intramuros (658 Muralla St, Intramuros, Manila).
 */
router.post('/', requireAuth, requireDriverCapability, async (req, res, next) => {
  try {
    const body = createTripSchema.parse(req.body);
    const departureDate = new Date(body.departureTime);

    // Ensure drivers schedule trips far enough ahead so riders can satisfy the 24-hour booking rule
    const windowCheck = validateAdvanceBookingWindow(departureDate);
    if (!windowCheck.allowed) {
      throw new AppError(
        400,
        'DEPARTURE_TOO_SOON',
        'Trips must be scheduled at least 24 hours in advance so riders can pre-book.'
      );
    }

    // Compute driving route: origin -> ordered pick-up points -> Mapúa University Intramuros
    const waypoints = [
      { lat: body.originLat, lng: body.originLng },
      ...body.pickupPoints.map((p) => ({ lat: p.lat, lng: p.lng })),
      { lat: MAPUA_INTRAMUROS_DESTINATION.lat, lng: MAPUA_INTRAMUROS_DESTINATION.lng },
    ];
    const route = await computeDrivingRoute(waypoints);

    const created = await withTransaction(async (client) => {
      const tripRes = await client.query(
        `INSERT INTO trips (
           driver_id, origin_name, origin_lat, origin_lng,
           destination_name, destination_lat, destination_lng,
           departure_time, total_seats, available_seats, token_cost,
           status, route_geojson, notes
         ) VALUES (
           $1, $2, $3, $4,
           $5, $6, $7,
           $8, $9, $9, $10,
           'SCHEDULED', $11::jsonb, $12
         )
         RETURNING *`,
        [
          req.user!.id,
          body.originName.trim(),
          body.originLat,
          body.originLng,
          MAPUA_INTRAMUROS_DESTINATION.name,
          MAPUA_INTRAMUROS_DESTINATION.lat,
          MAPUA_INTRAMUROS_DESTINATION.lng,
          departureDate.toISOString(),
          body.totalSeats,
          body.tokenCost,
          JSON.stringify(route.geojson),
          body.notes?.trim() ?? null,
        ]
      );

      const trip = tripRes.rows[0];
      const insertedPickups = [];

      for (let i = 0; i < body.pickupPoints.length; i++) {
        const stop = body.pickupPoints[i];
        const stopRes = await client.query(
          `INSERT INTO pickup_points (
             trip_id, label, address, lat, lng, sequence_order, estimated_offset_minutes
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            trip.id,
            stop.label.trim(),
            stop.address.trim(),
            stop.lat,
            stop.lng,
            i + 1,
            stop.estimatedOffsetMinutes ?? (i + 1) * 10,
          ]
        );
        insertedPickups.push(stopRes.rows[0]);
      }

      return { ...trip, pickup_points: insertedPickups };
    });

    res.status(201).json({ trip: created });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/trips
 * Lists upcoming and active trips to Mapúa University Intramuros with driver info,
 * pick-up points, and 24-hour booking eligibility metadata.
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const statusFilter = req.query.status as string | undefined;
    const mineOnly = req.query.mine === 'true';

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (statusFilter) {
      params.push(statusFilter);
      conditions.push(`t.status = $${params.length}`);
    } else {
      conditions.push(`t.status IN ('SCHEDULED', 'IN_PROGRESS')`);
    }

    if (mineOnly) {
      params.push(req.user!.id);
      conditions.push(`t.driver_id = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const tripsRes = await query(
      `SELECT t.*,
              u.full_name AS driver_name,
              u.university_role AS driver_role,
              u.department AS driver_department,
              u.vehicle_make, u.vehicle_model, u.vehicle_color, u.vehicle_plate_number,
              COALESCE(
                (SELECT json_agg(p ORDER BY p.sequence_order ASC)
                 FROM pickup_points p WHERE p.trip_id = t.id),
                '[]'::json
              ) AS pickup_points
       FROM trips t
       JOIN users u ON u.id = t.driver_id
       ${whereClause}
       ORDER BY t.departure_time ASC`,
      params
    );

    const now = new Date();
    const enriched = tripsRes.rows.map((trip) => {
      const check = validateAdvanceBookingWindow(trip.departure_time, now);
      return {
        ...trip,
        booking_eligible: trip.status === 'SCHEDULED' && trip.available_seats > 0 && check.allowed,
        hours_until_departure: Number(check.hoursUntilDeparture.toFixed(1)),
        booking_window_reason: check.allowed ? null : check.reason,
      };
    });

    res.json({ trips: enriched });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/trips/:id
 * Returns full trip details, pick-up stops, booked riders, latest live GPS positions,
 * and dynamic ETA to the rider's chosen pick-up point and Mapúa Intramuros.
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const tripId = req.params.id;
    const tripRes = await query(
      `SELECT t.*,
              u.full_name AS driver_name,
              u.university_role AS driver_role,
              u.department AS driver_department,
              u.vehicle_make, u.vehicle_model, u.vehicle_color, u.vehicle_plate_number
       FROM trips t
       JOIN users u ON u.id = t.driver_id
       WHERE t.id = $1`,
      [tripId]
    );

    if (tripRes.rowCount === 0) {
      throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found.');
    }

    const trip = tripRes.rows[0];

    const [pickupsRes, bookingsRes, locationsRes] = await Promise.all([
      query('SELECT * FROM pickup_points WHERE trip_id = $1 ORDER BY sequence_order ASC', [tripId]),
      query(
        `SELECT b.*, u.full_name AS rider_name, u.university_role AS rider_role,
                p.label AS pickup_label, p.lat AS pickup_lat, p.lng AS pickup_lng
         FROM bookings b
         JOIN users u ON u.id = b.rider_id
         JOIN pickup_points p ON p.id = b.pickup_point_id
         WHERE b.trip_id = $1 AND b.status IN ('CONFIRMED', 'BOARDED', 'COMPLETED')`,
        [tripId]
      ),
      query(
        `SELECT l.*, u.full_name
         FROM live_locations l
         JOIN users u ON u.id = l.user_id
         WHERE l.trip_id = $1`,
        [tripId]
      ),
    ]);

    // Compute route on-demand if not yet cached
    let routeGeojson = trip.route_geojson;
    if (!routeGeojson) {
      const waypoints = [
        { lat: trip.origin_lat, lng: trip.origin_lng },
        ...pickupsRes.rows.map((p) => ({ lat: p.lat, lng: p.lng })),
        { lat: trip.destination_lat, lng: trip.destination_lng },
      ];
      const computed = await computeDrivingRoute(waypoints);
      routeGeojson = computed.geojson;
    }

    // Calculate dynamic ETA from driver's latest GPS (or origin if trip hasn't started yet)
    const driverLoc = locationsRes.rows.find((l) => l.role === 'DRIVER');
    const driverPos = driverLoc
      ? { lat: driverLoc.lat, lng: driverLoc.lng }
      : { lat: trip.origin_lat, lng: trip.origin_lng };

    const myBooking = bookingsRes.rows.find((b) => b.rider_id === req.user!.id);
    const pickupPos = myBooking
      ? { lat: myBooking.pickup_lat, lng: myBooking.pickup_lng }
      : pickupsRes.rows[0]
        ? { lat: pickupsRes.rows[0].lat, lng: pickupsRes.rows[0].lng }
        : null;

    const eta = await calculateDynamicEta({
      driverPos,
      pickupPos,
      currentSpeedKmh: driverLoc?.speed_kmh ?? null,
    });

    res.json({
      trip: {
        ...trip,
        route_geojson: routeGeojson,
        pickup_points: pickupsRes.rows,
        bookings: bookingsRes.rows,
        live_locations: locationsRes.rows,
        eta,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trips/:id/start
 * Driver marks a scheduled trip as IN_PROGRESS to begin live GPS tracking.
 */
router.post('/:id/start', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE trips
       SET status = 'IN_PROGRESS'
       WHERE id = $1 AND driver_id = $2 AND status = 'SCHEDULED'
       RETURNING *`,
      [req.params.id, req.user!.id]
    );

    if (result.rowCount === 0) {
      throw new AppError(400, 'CANNOT_START_TRIP', 'Trip not found, not owned by you, or already started.');
    }

    res.json({ trip: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trips/:id/complete
 * Driver completes the trip at Mapúa University Intramuros.
 * Atomically releases all escrowed rider tokens to the driver's wallet and logs TRIP_PAYOUT entries.
 */
router.post('/:id/complete', requireAuth, async (req, res, next) => {
  try {
    const summary = await withTransaction(async (client) => {
      const tripRes = await client.query(
        'SELECT * FROM trips WHERE id = $1 AND driver_id = $2 FOR UPDATE',
        [req.params.id, req.user!.id]
      );

      if (tripRes.rowCount === 0) {
        throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found or you are not the assigned driver.');
      }

      const trip = tripRes.rows[0];
      if (trip.status === 'COMPLETED') {
        throw new AppError(409, 'ALREADY_COMPLETED', 'This trip has already been completed and paid out.');
      }
      if (trip.status === 'CANCELLED') {
        throw new AppError(400, 'TRIP_CANCELLED', 'Cannot complete a cancelled trip.');
      }

      // Lock all active bookings for this trip
      const bookingsRes = await client.query(
        `SELECT b.id, b.rider_id, b.tokens_escrowed, u.full_name AS rider_name
         FROM bookings b
         JOIN users u ON u.id = b.rider_id
         WHERE b.trip_id = $1 AND b.status IN ('CONFIRMED', 'BOARDED')
         FOR UPDATE OF b`,
        [trip.id]
      );

      let totalTokensPaid = 0;
      let driverBalanceAfter = 0;

      for (const booking of bookingsRes.rows) {
        await client.query(`UPDATE bookings SET status = 'COMPLETED' WHERE id = $1`, [booking.id]);

        const payout = await applyTokenDelta(client, {
          userId: trip.driver_id,
          counterpartyId: booking.rider_id,
          tripId: trip.id,
          bookingId: booking.id,
          txType: 'TRIP_PAYOUT',
          delta: booking.tokens_escrowed,
          description: `Trip payout from ${booking.rider_name} for carpool to Mapúa Intramuros`,
        });

        totalTokensPaid += booking.tokens_escrowed;
        driverBalanceAfter = payout.balanceAfter;
      }

      const updatedTrip = await client.query(
        `UPDATE trips SET status = 'COMPLETED' WHERE id = $1 RETURNING *`,
        [trip.id]
      );

      return {
        trip: updatedTrip.rows[0],
        completedBookingsCount: bookingsRes.rowCount ?? 0,
        totalTokensPaid,
        driverBalanceAfter,
      };
    });

    res.json({
      message: `Trip completed at Mapúa Intramuros! ${summary.totalTokensPaid} Cardinal Tokens transferred to your wallet.`,
      ...summary,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trips/:id/cancel
 * Driver cancels a scheduled trip and automatically refunds all escrowed rider tokens.
 */
router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const tripRes = await client.query(
        `SELECT * FROM trips WHERE id = $1 AND driver_id = $2 AND status = 'SCHEDULED' FOR UPDATE`,
        [req.params.id, req.user!.id]
      );

      if (tripRes.rowCount === 0) {
        throw new AppError(400, 'CANNOT_CANCEL_TRIP', 'Scheduled trip not found or already in progress.');
      }

      const bookingsRes = await client.query(
        `SELECT id, rider_id, tokens_escrowed
         FROM bookings
         WHERE trip_id = $1 AND status IN ('CONFIRMED', 'BOARDED')
         FOR UPDATE`,
        [req.params.id]
      );

      for (const b of bookingsRes.rows) {
        await client.query(`UPDATE bookings SET status = 'REFUNDED' WHERE id = $1`, [b.id]);
        await applyTokenDelta(client, {
          userId: b.rider_id,
          counterpartyId: req.user!.id,
          tripId: req.params.id,
          bookingId: b.id,
          txType: 'BOOKING_REFUND',
          delta: b.tokens_escrowed,
          description: 'Automatic token refund — driver cancelled scheduled trip to Mapúa Intramuros',
        });
      }

      const cancelled = await client.query(
        `UPDATE trips SET status = 'CANCELLED' WHERE id = $1 RETURNING *`,
        [req.params.id]
      );

      return { trip: cancelled.rows[0], refundedBookings: bookingsRes.rowCount ?? 0 };
    });

    res.json({
      message: `Trip cancelled and ${result.refundedBookings} rider booking(s) automatically refunded.`,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
