import { AppError } from '../errors.js';

// Body: unknown fields are dropped, which is what stops { "role": "admin" } sneaking in.
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) return next(result.error);
  req.body = result.data;
  next();
};

// Query string. The parsed copy goes in req.validatedQuery (Express 5 makes req.query read-only).
export const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) return next(result.error);
  req.validatedQuery = result.data;
  next();
};

// Route parameter :id must be a positive integer that fits the database column.
export function validateId(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) return next(new AppError(400, 'Invalid id'));
  req.resourceId = id;
  next();
}