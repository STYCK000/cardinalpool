import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { query } from '../config/db';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  universityRole: 'STUDENT' | 'FACULTY';
  activeMode: 'RIDER' | 'DRIVER';
  canDrive: boolean;
  emailVerified: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header.' });
      return;
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string };

    const result = await query(
      `SELECT id, email, full_name, university_role, active_mode, can_drive, email_verified
       FROM users WHERE id = $1`,
      [payload.sub]
    );

    if (result.rowCount === 0) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'User account not found.' });
      return;
    }

    const row = result.rows[0];
    if (!row.email_verified) {
      res.status(403).json({
        error: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your Mapúa University institutional email before accessing CardiRide.',
      });
      return;
    }

    req.user = {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      universityRole: row.university_role,
      activeMode: row.active_mode,
      canDrive: row.can_drive,
      emailVerified: row.email_verified,
    };

    next();
  } catch (err) {
    res.status(401).json({ error: 'INVALID_TOKEN', message: 'Session expired or invalid token.' });
  }
}

export function requireDriverCapability(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.canDrive) {
    res.status(403).json({
      error: 'DRIVER_PROFILE_REQUIRED',
      message: 'Please add your vehicle information in Profile Settings before posting trips as a driver.',
    });
    return;
  }
  next();
}
