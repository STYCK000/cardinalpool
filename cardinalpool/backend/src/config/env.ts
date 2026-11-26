import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://cardinalpool:cardinalpool_dev_password@localhost:5432/cardinalpool',
  jwtSecret: process.env.JWT_SECRET || 'dev-cardinalpool-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  smtpHost: process.env.SMTP_HOST || 'localhost',
  smtpPort: Number(process.env.SMTP_PORT || 1025),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  emailFrom: process.env.EMAIL_FROM || 'CardinalPool Mapúa <no-reply@cardinalpool.mapua.edu.ph>',
  osrmBaseUrl: process.env.OSRM_BASE_URL || 'https://router.project-osrm.org',
};
