// Checks req.body against a zod schema//  Unknown fields are dropped, which is
// what stops someone sending { "role": "admin" } at the sign-up endpoint
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) return next(result.error);
  req.body = result.data;
  next();
};