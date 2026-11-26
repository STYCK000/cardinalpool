import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const switchModeSchema = z.object({
  mode: z.enum(['RIDER', 'DRIVER']),
});

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(150).optional(),
  department: z.string().min(2).max(150).optional(),
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

/**
 * PATCH /api/users/mode
 * Allows users to switch between RIDER and DRIVER modes seamlessly.
 */
router.patch('/mode', requireAuth, async (req, res, next) => {
  try {
    const { mode } = switchModeSchema.parse(req.body);

    if (mode === 'DRIVER' && !req.user!.canDrive) {
      throw new AppError(
        400,
        'VEHICLE_INFO_REQUIRED',
        'Add your vehicle details in Profile Settings before switching to Driver mode.'
      );
    }

    const result = await query(
      `UPDATE users SET active_mode = $1 WHERE id = $2
       RETURNING id, email, full_name, university_role, department, university_id_number,
                 active_mode, can_drive, token_balance,
                 vehicle_make, vehicle_model, vehicle_color, vehicle_plate_number, vehicle_seat_capacity`,
      [mode, req.user!.id]
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/users/profile
 * Updates Mapúa profile details and registers/updates driver vehicle information.
 */
router.patch('/profile', requireAuth, async (req, res, next) => {
  try {
    const body = updateProfileSchema.parse(req.body);

    const result = await query(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           department = COALESCE($2, department),
           can_drive = CASE WHEN $3::boolean THEN TRUE ELSE can_drive END,
           vehicle_make = COALESCE($4, vehicle_make),
           vehicle_model = COALESCE($5, vehicle_model),
           vehicle_color = COALESCE($6, vehicle_color),
           vehicle_plate_number = COALESCE($7, vehicle_plate_number),
           vehicle_seat_capacity = COALESCE($8, vehicle_seat_capacity)
       WHERE id = $9
       RETURNING id, email, full_name, university_role, department, university_id_number,
                 active_mode, can_drive, token_balance,
                 vehicle_make, vehicle_model, vehicle_color, vehicle_plate_number, vehicle_seat_capacity`,
      [
        body.fullName?.trim() ?? null,
        body.department?.trim() ?? null,
        Boolean(body.vehicle),
        body.vehicle?.make?.trim() ?? null,
        body.vehicle?.model?.trim() ?? null,
        body.vehicle?.color?.trim() ?? null,
        body.vehicle?.plateNumber?.trim().toUpperCase() ?? null,
        body.vehicle?.seatCapacity ?? null,
        req.user!.id,
      ]
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
