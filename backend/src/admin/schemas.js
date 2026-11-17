import { z } from 'zod';
import { paginationFields } from '../pagination.js';

const email = z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address'));
const role = z.enum(['user', 'employee', 'admin']);
const propertyId = z.number().int().positive().nullable().default(null);

// The same rule the database enforces, checked first so the client gets a clear message.
const staffRule = (v) => (v.role === 'employee') === (v.propertyId !== null);
const staffRuleError = { message: 'An employee needs a hotel; other roles must not have one', path: ['propertyId'] };

export const createUserSchema = z
  .object({ email, password: z.string().min(8).max(72), role, propertyId })
  .refine(staffRule, staffRuleError);

// Role and hotel are always set together, so a half-changed account cannot exist.
export const updateUserSchema = z.object({ role, propertyId }).refine(staffRule, staffRuleError);

export const listUsersQuery = z.object({ role: role.optional(), ...paginationFields });