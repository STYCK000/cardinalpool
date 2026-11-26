import test from 'node:test';
import assert from 'node:assert/strict';

// Pure business-rule mirrors for zero-dependency verification under Node 18+
const MIN_ADVANCE_BOOKING_MS = 24 * 60 * 60 * 1000;
const MAPUA_INTRAMUROS = { lat: 14.5902, lng: 120.9787 };

function validateMapuaEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const parts = normalized.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { valid: false };
  if (parts[1] === 'mymail.mapua.edu.ph') return { valid: true, inferredRole: 'STUDENT' };
  if (parts[1] === 'mapua.edu.ph') return { valid: true, inferredRole: 'FACULTY' };
  return { valid: false };
}

function validateAdvanceBookingWindow(departureTime, now = new Date()) {
  const dep = new Date(departureTime);
  const msUntilDeparture = dep.getTime() - now.getTime();
  return {
    allowed: msUntilDeparture >= MIN_ADVANCE_BOOKING_MS,
    hoursUntilDeparture: msUntilDeparture / (1000 * 60 * 60),
  };
}

function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

test('Institutional Email Validation: allows Mapúa student & faculty domains only', () => {
  assert.deepEqual(validateMapuaEmail('jdelacruz@mymail.mapua.edu.ph'), {
    valid: true,
    inferredRole: 'STUDENT',
  });
  assert.deepEqual(validateMapuaEmail('engr.santos@mapua.edu.ph'), {
    valid: true,
    inferredRole: 'FACULTY',
  });
  assert.equal(validateMapuaEmail('student@gmail.com').valid, false);
  assert.equal(validateMapuaEmail('fake@mymail.mapua.edu.ph.evil.com').valid, false);
});

test('24-Hour Advance Booking Rule: rejects < 24h and accepts >= 24h', () => {
  const now = new Date('2026-11-26T08:00:00Z');
  const twentyThreeHoursLater = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const thirtySixHoursLater = new Date(now.getTime() + 36 * 60 * 60 * 1000);

  assert.equal(validateAdvanceBookingWindow(twentyThreeHoursLater, now).allowed, false);
  assert.equal(validateAdvanceBookingWindow(twentyFourHoursLater, now).allowed, true);
  assert.equal(validateAdvanceBookingWindow(thirtySixHoursLater, now).allowed, true);
});

test('Distance & ETA Geometry: Welcome Rotonda to Mapúa Intramuros is ~3.9 km', () => {
  const welcomeRotonda = { lat: 14.6182, lng: 121.0002 };
  const km = haversineKm(welcomeRotonda, MAPUA_INTRAMUROS);
  assert.ok(km > 3.0 && km < 5.0, `Expected ~3.9km, got ${km.toFixed(2)}km`);
});
