import { rateLimit } from 'express-rate-limit';
import { config } from '../config.js';

// Limits login/sign-up/refresh attempts per IP address.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.authRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});