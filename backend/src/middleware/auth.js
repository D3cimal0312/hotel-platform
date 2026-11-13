import { AppError } from '../errors.js';
import { verifyAccessToken } from '../auth/tokens.js';


export function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) return next(new AppError(401, 'Authentication required'));
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: Number(payload.sub), role: payload.role, propertyId: payload.propertyId };
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token'));
  }
}