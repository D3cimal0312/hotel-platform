import { AppError } from '../errors.js';
import { log } from '../logger.js';

// Every error in the API leaves through here, in one consistent shape:
// { "error": "message" } plus "details" for validation problems.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });

  log('server_error', { method: req.method, path: req.path, message: err.message });
  res.status(500).json({ error: 'Internal server error' }); // never leak internals
}
