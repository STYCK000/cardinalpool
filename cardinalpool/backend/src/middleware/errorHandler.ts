import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request payload.',
      details: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // Handle PostgreSQL trigger / constraint errors cleanly
  const pgErr = err as { code?: string; message?: string };
  if (pgErr?.message?.includes('BOOKING_WINDOW_CLOSED')) {
    res.status(400).json({
      error: 'BOOKING_WINDOW_CLOSED',
      message: 'Rides must be booked at least 24 hours before the scheduled departure time.',
    });
    return;
  }

  if (pgErr?.code === '23505') {
    res.status(409).json({
      error: 'CONFLICT',
      message: 'A duplicate record already exists.',
    });
    return;
  }

  console.error('[Unhandled Error]', err);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected server error occurred.',
  });
}
