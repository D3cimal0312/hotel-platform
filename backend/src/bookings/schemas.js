import { z } from 'zod';
import { paginationFields } from '../pagination.js';

export const listBookingsQuery = z.object({
  status: z.enum(['confirmed', 'checked_in', 'checked_out', 'cancelled']).optional(),
  propertyId: z.coerce.number().int().positive().optional(), //  for admins only
  ...paginationFields,
});