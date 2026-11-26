import nodemailer from 'nodemailer';
import { ALLOWED_EMAIL_DOMAINS } from '../config/constants';
import { env } from '../config/env';

export interface EmailValidationResult {
  valid: boolean;
  inferredRole?: 'STUDENT' | 'FACULTY';
  reason?: string;
}

/**
 * Strictly validates that an email belongs to Mapúa University:
 *   - Students: @mymail.mapua.edu.ph
 *   - Faculty / Employees: @mapua.edu.ph
 */
export function validateMapuaEmail(email: string): EmailValidationResult {
  const normalized = email.trim().toLowerCase();
  const parts = normalized.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { valid: false, reason: 'Invalid email address format.' };
  }

  const domain = parts[1];
  if (domain === ALLOWED_EMAIL_DOMAINS.STUDENT) {
    return { valid: true, inferredRole: 'STUDENT' };
  }
  if (domain === ALLOWED_EMAIL_DOMAINS.FACULTY) {
    return { valid: true, inferredRole: 'FACULTY' };
  }

  return {
    valid: false,
    reason:
      'Access is restricted to Mapúa University students (@mymail.mapua.edu.ph) and faculty (@mapua.edu.ph).',
  };
}

const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: env.smtpSecure,
  ...(env.smtpUser && env.smtpPass
    ? { auth: { user: env.smtpUser, pass: env.smtpPass } }
    : {}),
});

export async function sendVerificationEmail(params: {
  to: string;
  fullName: string;
  token: string;
}): Promise<{ verificationUrl: string; delivered: boolean }> {
  const verificationUrl = `${env.frontendUrl}/verify-email?token=${encodeURIComponent(params.token)}`;

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
      <div style="background: #991B1B; color: #FFFFFF; padding: 20px 24px;">
        <h2 style="margin: 0; font-size: 20px;">CardinalPool — Mapúa University Carpool</h2>
      </div>
      <div style="padding: 24px; color: #1F2937;">
        <p>Hi <strong>${params.fullName}</strong>,</p>
        <p>Welcome to CardinalPool! Verify your Mapúa University institutional email to activate your account and claim your <strong>100 Cardinal Tokens</strong> welcome balance.</p>
        <p style="margin: 24px 0;">
          <a href="${verificationUrl}" style="background: #B91C1C; color: #FFFFFF; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Verify Institutional Email
          </a>
        </p>
        <p style="font-size: 13px; color: #6B7280;">Or copy this link into your browser:<br/>${verificationUrl}</p>
        <p style="font-size: 12px; color: #9CA3AF; margin-top: 24px;">This link expires in 24 hours. All rides terminate at Mapúa University Intramuros (658 Muralla St).</p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: env.emailFrom,
      to: params.to,
      subject: 'Verify your Mapúa University email for CardinalPool',
      html,
    });
    return { verificationUrl, delivered: true };
  } catch (err) {
    // Graceful fallback in local development if SMTP/MailHog isn't running yet
    console.warn('[EmailService] SMTP delivery unavailable; logging verification link for dev:', verificationUrl);
    return { verificationUrl, delivered: false };
  }
}
