import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query, withTransaction } from '../config/db';
import { env } from '../config/env';
import { STARTING_TOKEN_BALANCE } from '../config/constants';
import { AppError } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';
import { sendVerificationEmail, validateMapuaEmail } from '../services/emailService';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  fullName: z.string().min(2).max(150),
  department: z.string().min(2).max(150),
  universityIdNumber: z.string().min(4).max(40),
  initialMode: z.enum(['RIDER', 'DRIVER']).default('RIDER'),
  vehicle: z
    .object({
      make: z.string().min(2).max(80),
      model: z.string().min(1).max(80),
      color: z.string().min(2).max(40),
      plateNumber: z.string().min(4).max(20),
      seatCapacity: z.number().int().min(1).max(8),
    })
    .optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /api/auth/register
 * Registers a Mapúa University student (@mymail.mapua.edu.ph) or faculty (@mapua.edu.ph),
 * grants starting Cardinal Tokens, and sends an institutional email verification link.
 */
router.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const emailCheck = validateMapuaEmail(body.email);

    if (!emailCheck.valid || !emailCheck.inferredRole) {
      throw new AppError(403, 'INVALID_INSTITUTIONAL_EMAIL', emailCheck.reason || 'Mapúa email required.');
    }

    const canDrive = body.initialMode === 'DRIVER' || Boolean(body.vehicle);
    if (canDrive && !body.vehicle) {
      throw new AppError(
        400,
        'VEHICLE_INFO_REQUIRED',
        'Drivers must provide vehicle make, model, color, plate number, and seat capacity.'
      );
    }

    const normalizedEmail = body.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(body.password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const createdUser = await withTransaction(async (client) => {
      const existing = await client.query(
        'SELECT id FROM users WHERE LOWER(email) = $1 OR university_id_number = $2',
        [normalizedEmail, body.universityIdNumber.trim()]
      );
      if ((existing.rowCount ?? 0) > 0) {
        throw new AppError(
          409,
          'ACCOUNT_EXISTS',
          'An account with this Mapúa email or University ID number already exists.'
        );
      }

      const insertUser = await client.query(
        `INSERT INTO users (
           email, password_hash, full_name, university_role, department,
           university_id_number, active_mode, can_drive, email_verified,
           verification_token, verification_token_expires_at, token_balance,
           vehicle_make, vehicle_model, vehicle_color, vehicle_plate_number, vehicle_seat_capacity
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, FALSE,
           $9, $10, $11,
           $12, $13, $14, $15, $16
         )
         RETURNING id, email, full_name, university_role, department, university_id_number,
                   active_mode, can_drive, email_verified, token_balance`,
        [
          normalizedEmail,
          passwordHash,
          body.fullName.trim(),
          emailCheck.inferredRole,
          body.department.trim(),
          body.universityIdNumber.trim(),
          body.initialMode,
          canDrive,
          verificationToken,
          expiresAt,
          STARTING_TOKEN_BALANCE,
          body.vehicle?.make ?? null,
          body.vehicle?.model ?? null,
          body.vehicle?.color ?? null,
          body.vehicle?.plateNumber?.toUpperCase() ?? null,
          body.vehicle?.seatCapacity ?? null,
        ]
      );

      const user = insertUser.rows[0];

      await client.query(
        `INSERT INTO token_transactions (user_id, tx_type, amount, balance_after, description)
         VALUES ($1, 'WELCOME_BONUS', $2, $2, $3)`,
        [
          user.id,
          STARTING_TOKEN_BALANCE,
          `Welcome to CardinalPool — ${STARTING_TOKEN_BALANCE} starter Cardinal Tokens`,
        ]
      );

      return user;
    });

    const mailResult = await sendVerificationEmail({
      to: createdUser.email,
      fullName: createdUser.full_name,
      token: verificationToken,
    });

    res.status(201).json({
      message:
        'Registration successful! Please verify your Mapúa University email before signing in.',
      user: createdUser,
      // Exposed only in development so local testers can verify without external SMTP
      ...(env.nodeEnv !== 'production' ? { devVerificationUrl: mailResult.verificationUrl } : {}),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/verify-email?token=...
 * Confirms ownership of the Mapúa institutional email address.
 */
router.get('/verify-email', async (req, res, next) => {
  try {
    const token = String(req.query.token || '').trim();
    if (!token) {
      throw new AppError(400, 'MISSING_TOKEN', 'Verification token is required.');
    }

    const result = await query(
      `UPDATE users
       SET email_verified = TRUE,
           verification_token = NULL,
           verification_token_expires_at = NULL
       WHERE verification_token = $1
         AND verification_token_expires_at > NOW()
       RETURNING id, email, full_name, university_role`,
      [token]
    );

    if (result.rowCount === 0) {
      throw new AppError(400, 'INVALID_OR_EXPIRED_TOKEN', 'Verification link is invalid or has expired.');
    }

    res.json({
      message: 'Mapúa institutional email verified! You can now sign in to CardinalPool.',
      user: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Authenticates verified Mapúa University users and returns a signed JWT.
 */
router.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const normalizedEmail = body.email.trim().toLowerCase();

    const result = await query(
      `SELECT id, email, password_hash, full_name, university_role, department,
              university_id_number, active_mode, can_drive, email_verified, token_balance,
              vehicle_make, vehicle_model, vehicle_color, vehicle_plate_number, vehicle_seat_capacity
       FROM users
       WHERE LOWER(email) = $1`,
      [normalizedEmail]
    );

    if (result.rowCount === 0) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(body.password, user.password_hash);
    if (!passwordMatch) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    if (!user.email_verified) {
      throw new AppError(
        403,
        'EMAIL_NOT_VERIFIED',
        'Please verify your Mapúa University email link before signing in.'
      );
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.university_role },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
    );

    const { password_hash: _omit, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Returns the authenticated user's full profile and live token balance.
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, email, full_name, university_role, department, university_id_number,
              active_mode, can_drive, email_verified, token_balance,
              vehicle_make, vehicle_model, vehicle_color, vehicle_plate_number, vehicle_seat_capacity,
              created_at
       FROM users WHERE id = $1`,
      [req.user!.id]
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
