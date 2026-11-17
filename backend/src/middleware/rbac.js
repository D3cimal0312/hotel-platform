import { AppError } from '../errors.js';

// Allows only the listed roles. Must run after authenticate.
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new AppError(401, 'Authentication required'));
  if (!roles.includes(req.user.role)) return next(new AppError(403, 'You do not have permission to do this'));
  next();
};

// For staff routes. Sets req.scope, which controllers merge over any client-supplied
// filter, so the client can never widen it:
//   admin    -> {}                       (all hotels)
//   employee -> { propertyId: <token> }  (their hotel only)
// Anyone else, or an employee without a hotel, is refused.
export function scopeToProperty(req, res, next) {
  const { role, propertyId } = req.user ?? {};
  if (role === 'admin') { req.scope = {}; return next(); }
  if (role === 'employee' && propertyId) { req.scope = { propertyId }; return next(); }
  next(new AppError(403, 'You do not have permission to do this'));
}