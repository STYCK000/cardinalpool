import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const createRatingSchema = z.object({
  bookingId: z.string().uuid(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(400).optional(),
});

/**
 * POST /api/ratings
 * Two-way rating endpoint:
 *  - Rider rates the Driver after a COMPLETED booking
 *  - Driver rates a booked Rider after a COMPLETED booking
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = createRatingSchema.parse(req.body);
    const raterId = req.user!.id;

    const bookingRes = await query(
      `SELECT b.id, b.trip_id, b.rider_id, b.status AS booking_status,
              t.driver_id, t.status AS trip_status
       FROM bookings b
       JOIN trips t ON t.id = b.trip_id
       WHERE b.id = $1`,
      [body.bookingId]
    );

    if (bookingRes.rowCount === 0) {
      throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
    }

    const row = bookingRes.rows[0];
    if (row.booking_status !== 'COMPLETED' && row.trip_status !== 'COMPLETED') {
      throw new AppError(
        400,
        'TRIP_NOT_COMPLETED',
        'Ratings can only be submitted after the trip has been completed.'
      );
    }

    let rateeId: string;
    let raterRole: 'RIDER' | 'DRIVER';

    if (raterId === row.rider_id) {
      rateeId = row.driver_id;
      raterRole = 'RIDER';
    } else if (raterId === row.driver_id) {
      rateeId = row.rider_id;
      raterRole = 'DRIVER';
    } else {
      throw new AppError(403, 'NOT_PARTICIPANT', 'Only participants of this ride can submit a rating.');
    }

    const existing = await query(
      'SELECT id FROM trip_ratings WHERE booking_id = $1 AND rater_id = $2',
      [body.bookingId, raterId]
    );
    if ((existing.rowCount ?? 0) > 0) {
      throw new AppError(409, 'ALREADY_RATED', 'You have already rated this ride.');
    }

    const insertRes = await query(
      `INSERT INTO trip_ratings (trip_id, booking_id, rater_id, ratee_id, rater_role, stars, comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        row.trip_id,
        row.id,
        raterId,
        rateeId,
        raterRole,
        body.stars,
        body.comment?.trim() || null,
      ]
    );

    const statsRes = await query(
      `SELECT ROUND(AVG(stars)::numeric, 1)::float AS avg_rating,
              COUNT(*)::int AS rating_count
       FROM trip_ratings
       WHERE ratee_id = $1`,
      [rateeId]
    );

    res.status(201).json({
      message: 'Thanks for rating your fellow Mapúan!',
      rating: insertRes.rows[0],
      rateeStats: statsRes.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/ratings/me
 * Returns the authenticated user's overall rating summary, driver/rider breakdown,
 * and recent reviews received.
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;

    const [summaryRes, reviewsRes] = await Promise.all([
      query(
        `SELECT
           ROUND(AVG(stars)::numeric, 1)::float AS avg_rating,
           COUNT(*)::int AS rating_count,
           ROUND(AVG(stars) FILTER (WHERE rater_role = 'RIDER')::numeric, 1)::float AS as_driver_avg,
           COUNT(*) FILTER (WHERE rater_role = 'RIDER')::int AS as_driver_count,
           ROUND(AVG(stars) FILTER (WHERE rater_role = 'DRIVER')::numeric, 1)::float AS as_rider_avg,
           COUNT(*) FILTER (WHERE rater_role = 'DRIVER')::int AS as_rider_count
         FROM trip_ratings
         WHERE ratee_id = $1`,
        [userId]
      ),
      query(
        `SELECT r.id, r.stars, r.comment, r.rater_role, r.created_at,
                u.full_name AS rater_name, u.university_role AS rater_university_role,
                t.origin_name
         FROM trip_ratings r
         JOIN users u ON u.id = r.rater_id
         JOIN trips t ON t.id = r.trip_id
         WHERE r.ratee_id = $1
         ORDER BY r.created_at DESC
         LIMIT 25`,
        [userId]
      ),
    ]);

    res.json({
      summary: summaryRes.rows[0],
      reviews: reviewsRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
