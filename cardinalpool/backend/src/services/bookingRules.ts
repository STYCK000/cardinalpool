import { MIN_ADVANCE_BOOKING_HOURS, MIN_ADVANCE_BOOKING_MS } from '../config/constants';

export interface AdvanceBookingCheck {
  allowed: boolean;
  msUntilDeparture: number;
  hoursUntilDeparture: number;
  requiredHours: number;
  reason?: string;
}

/**
 * Enforces the mandatory 24-hour advance booking rule.
 * Any booking attempt strictly less than 24 hours before scheduled departure is rejected.
 */
export function validateAdvanceBookingWindow(
  departureTime: Date | string,
  now: Date = new Date()
): AdvanceBookingCheck {
  const dep = departureTime instanceof Date ? departureTime : new Date(departureTime);
  if (Number.isNaN(dep.getTime())) {
    return {
      allowed: false,
      msUntilDeparture: 0,
      hoursUntilDeparture: 0,
      requiredHours: MIN_ADVANCE_BOOKING_HOURS,
      reason: 'Invalid scheduled departure time.',
    };
  }

  const msUntilDeparture = dep.getTime() - now.getTime();
  const hoursUntilDeparture = msUntilDeparture / (1000 * 60 * 60);

  if (msUntilDeparture < MIN_ADVANCE_BOOKING_MS) {
    const remainingText =
      msUntilDeparture <= 0
        ? 'This trip has already departed.'
        : `Only ${hoursUntilDeparture.toFixed(1)} hours remain before departure; bookings must be made at least ${MIN_ADVANCE_BOOKING_HOURS} hours in advance.`;

    return {
      allowed: false,
      msUntilDeparture,
      hoursUntilDeparture,
      requiredHours: MIN_ADVANCE_BOOKING_HOURS,
      reason: remainingText,
    };
  }

  return {
    allowed: true,
    msUntilDeparture,
    hoursUntilDeparture,
    requiredHours: MIN_ADVANCE_BOOKING_HOURS,
  };
}
