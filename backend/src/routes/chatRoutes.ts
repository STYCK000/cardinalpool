import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { getIo } from '../sockets/trackingSocket';

const router = Router();

const sendMessageSchema = z.object({
  message: z.string().trim().min(1, 'Message cannot be empty.').max(500, 'Message is too long (max 500 chars).'),
});

async function resolveTripParticipantRole(
  tripId: string,
  userId: string
): Promise<'DRIVER' | 'RIDER' | null> {
  const tripRes = await query<{ driver_id: string }>('SELECT driver_id FROM trips WHERE id = $1', [
    tripId,
  ]);
  if (tripRes.rowCount === 0) {
    throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found.');
  }
  if (tripRes.rows[0].driver_id === userId) {
    return 'DRIVER';
  }

  const bookingRes = await query(
    `SELECT id FROM bookings
     WHERE trip_id = $1 AND rider_id = $2 AND status IN ('CONFIRMED', 'BOARDED', 'COMPLETED')
     LIMIT 1`,
    [tripId, userId]
  );
  if ((bookingRes.rowCount ?? 0) > 0) {
    return 'RIDER';
  }

  return null;
}

/**
 * GET /api/chat/:tripId
 * Returns chat history for a trip (accessible only to the trip's driver and booked riders).
 */
router.get('/:tripId', requireAuth, async (req, res, next) => {
  try {
    const tripId = req.params.tripId;
    const role = await resolveTripParticipantRole(tripId, req.user!.id);
    if (!role) {
      throw new AppError(
        403,
        'CHAT_ACCESS_DENIED',
        'Book a seat on this carpool to chat with the driver and fellow riders.'
      );
    }

    const msgRes = await query(
      `SELECT m.id, m.trip_id, m.sender_id, m.sender_role, m.message, m.created_at,
              u.full_name AS sender_name, u.university_role AS sender_university_role
       FROM trip_messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.trip_id = $1
       ORDER BY m.created_at ASC
       LIMIT 200`,
      [tripId]
    );

    res.json({ role, messages: msgRes.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/chat/:tripId
 * Persists a chat message and broadcasts it in real time via Socket.IO to everyone in the trip room.
 */
router.post('/:tripId', requireAuth, async (req, res, next) => {
  try {
    const tripId = req.params.tripId;
    const body = sendMessageSchema.parse(req.body);
    const role = await resolveTripParticipantRole(tripId, req.user!.id);

    if (!role) {
      throw new AppError(
        403,
        'CHAT_ACCESS_DENIED',
        'Only the driver and booked riders on this trip can send messages.'
      );
    }

    const insertRes = await query(
      `INSERT INTO trip_messages (trip_id, sender_id, sender_role, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, trip_id, sender_id, sender_role, message, created_at`,
      [tripId, req.user!.id, role, body.message]
    );

    const saved = {
      ...insertRes.rows[0],
      sender_name: req.user!.fullName,
      sender_university_role: req.user!.universityRole,
    };

    const io = getIo();
    if (io) {
      io.to(`trip:${tripId}`).emit('chat:message', saved);
    }

    res.status(201).json({ message: saved });
  } catch (err) {
    next(err);
  }
});

export default router;
