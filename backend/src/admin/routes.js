import { Router } from 'express';
import { asyncHandler } from '../asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate, validateQuery, validateId } from '../middleware/validate.js';
import { createUserSchema, updateUserSchema, listUsersQuery } from './schemas.js';
import { listUsers, createUser, updateUser } from './service.js';

const router = Router();

// Everything under /api/admin is admin-only. The role check runs before validation,
// so a non-admin always gets 403 and never learns anything about the request format.
router.use(authenticate, requireRole('admin'));

router.get('/users', validateQuery(listUsersQuery),
  asyncHandler(async (req, res) => res.json(await listUsers(req.validatedQuery))));

router.post('/users', validate(createUserSchema),
  asyncHandler(async (req, res) => res.status(201).json(await createUser(req.body, req.user.id))));

router.patch('/users/:id', validateId, validate(updateUserSchema),
  asyncHandler(async (req, res) => res.json(await updateUser(req.resourceId, req.body, req.user.id))));

export { router as adminRouter };