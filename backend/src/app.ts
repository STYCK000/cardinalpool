import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { MAPUA_INTRAMUROS_DESTINATION, MAPUA_DEPARTMENTS } from './config/constants';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import tripRoutes from './routes/tripRoutes';
import bookingRoutes from './routes/bookingRoutes';
import walletRoutes from './routes/walletRoutes';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.frontendUrl,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'CardiRide API',
      destination: MAPUA_INTRAMUROS_DESTINATION,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/meta', (_req, res) => {
    res.json({
      destination: MAPUA_INTRAMUROS_DESTINATION,
      departments: MAPUA_DEPARTMENTS,
      allowedDomains: ['mymail.mapua.edu.ph', 'mapua.edu.ph'],
      minAdvanceBookingHours: 24,
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/trips', tripRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/wallet', walletRoutes);

  app.use(errorHandler);
  return app;
}
