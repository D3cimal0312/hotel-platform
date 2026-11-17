import { Router } from 'express';
import { asyncHandler } from '../asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { validateQuery, validateId } from '../middleware/validate.js';
import { listBookingsQuery } from './schemas.js';
import { listBookings, getBooking } from './service.js';

const router = Router();
router.use(authenticate);

router.get('/', validateQuery(listBookingsQuery),
  asyncHandler(async (req, res) => res.json(await listBookings(req.user, req.validatedQuery))));

router.get('/:id', validateId,
  asyncHandler(async (req, res) => res.json(await getBooking(req.user, req.resourceId))));

export { router as bookingsRouter };