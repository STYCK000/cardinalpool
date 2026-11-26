import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { query } from '../config/db';
import { calculateDynamicEta } from '../services/etaService';

interface AuthedSocket extends Socket {
  userId?: string;
  userName?: string;
}

interface LocationPayload {
  tripId: string;
  role: 'DRIVER' | 'RIDER';
  lat: number;
  lng: number;
  heading?: number;
  speedKmh?: number;
}

/**
 * Sets up real-time Socket.IO rooms per trip for live driver & rider GPS markers
 * and dynamically recalculated ETAs to each rider's pick-up stop and Mapúa Intramuros.
 */
export function initTrackingSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: env.frontendUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Authenticate every Socket.IO connection with the user's JWT
  io.use(async (socket: AuthedSocket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string) ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('UNAUTHORIZED'));
      }

      const payload = jwt.verify(token, env.jwtSecret) as { sub: string };
      const userRes = await query(
        'SELECT id, full_name, email_verified FROM users WHERE id = $1',
        [payload.sub]
      );
      if (userRes.rowCount === 0 || !userRes.rows[0].email_verified) {
        return next(new Error('UNAUTHORIZED'));
      }

      socket.userId = userRes.rows[0].id;
      socket.userName = userRes.rows[0].full_name;
      next();
    } catch {
      next(new Error('INVALID_TOKEN'));
    }
  });

  io.on('connection', (socket: AuthedSocket) => {
    socket.on('trip:join', async (tripId: string) => {
      if (!tripId) return;
      socket.join(`trip:${tripId}`);

      // Send current persisted live locations immediately upon joining
      const locRes = await query(
        `SELECT l.trip_id, l.user_id, l.role, l.lat, l.lng, l.heading, l.speed_kmh, l.updated_at, u.full_name
         FROM live_locations l
         JOIN users u ON u.id = l.user_id
         WHERE l.trip_id = $1`,
        [tripId]
      );
      socket.emit('trip:locations_snapshot', locRes.rows);
    });

    socket.on('trip:leave', (tripId: string) => {
      if (tripId) socket.leave(`trip:${tripId}`);
    });

    socket.on('location:update', async (payload: LocationPayload) => {
      try {
        if (!socket.userId || !payload?.tripId) return;
        if (typeof payload.lat !== 'number' || typeof payload.lng !== 'number') return;

        // Upsert latest live GPS position in PostgreSQL
        await query(
          `INSERT INTO live_locations (trip_id, user_id, role, lat, lng, heading, speed_kmh, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (trip_id, user_id)
           DO UPDATE SET
             role = EXCLUDED.role,
             lat = EXCLUDED.lat,
             lng = EXCLUDED.lng,
             heading = EXCLUDED.heading,
             speed_kmh = EXCLUDED.speed_kmh,
             updated_at = NOW()`,
          [
            payload.tripId,
            socket.userId,
            payload.role,
            payload.lat,
            payload.lng,
            payload.heading ?? null,
            payload.speedKmh ?? null,
          ]
        );

        // Broadcast updated position to everyone tracking this trip
        io.to(`trip:${payload.tripId}`).emit('location:broadcast', {
          trip_id: payload.tripId,
          user_id: socket.userId,
          full_name: socket.userName,
          role: payload.role,
          lat: payload.lat,
          lng: payload.lng,
          heading: payload.heading ?? null,
          speed_kmh: payload.speedKmh ?? null,
          updated_at: new Date().toISOString(),
        });

        // If the driver moved, dynamically recalculate ETAs for every pick-up point & Mapúa Intramuros
        if (payload.role === 'DRIVER') {
          const pickupsRes = await query(
            'SELECT id, label, lat, lng FROM pickup_points WHERE trip_id = $1 ORDER BY sequence_order ASC',
            [payload.tripId]
          );

          const pickupEtas: Record<string, Awaited<ReturnType<typeof calculateDynamicEta>>> = {};
          for (const stop of pickupsRes.rows) {
            pickupEtas[stop.id] = await calculateDynamicEta({
              driverPos: { lat: payload.lat, lng: payload.lng },
              pickupPos: { lat: stop.lat, lng: stop.lng },
              currentSpeedKmh: payload.speedKmh ?? null,
            });
          }

          const campusEta = await calculateDynamicEta({
            driverPos: { lat: payload.lat, lng: payload.lng },
            currentSpeedKmh: payload.speedKmh ?? null,
          });

          io.to(`trip:${payload.tripId}`).emit('eta:update', {
            tripId: payload.tripId,
            campusEta,
            pickupEtas,
          });
        }
      } catch (err) {
        console.error('[Socket] location:update failed:', err);
      }
    });
  });

  return io;
}
