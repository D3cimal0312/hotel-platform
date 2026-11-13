import { Router } from 'express';
import { asyncHandler } from '../asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, refreshSchema } from './schemas.js';
import { register, login, refresh, logout, getUser } from './service.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema),
  asyncHandler(async (req, res) => res.status(201).json(await register(req.body))));

router.post('/login', authLimiter, validate(loginSchema),
  asyncHandler(async (req, res) => res.json(await login({ ...req.body, ip: req.ip }))));

router.post('/refresh', authLimiter, validate(refreshSchema),
  asyncHandler(async (req, res) => res.json(await refresh(req.body.refreshToken))));

router.post('/logout', validate(refreshSchema),
  asyncHandler(async (req, res) => { await logout(req.body.refreshToken); res.status(204).end(); }));

router.get('/me', authenticate,
  asyncHandler(async (req, res) => res.json({ user: await getUser(req.user.id) })));

export { router as authRouter };