import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

//  access token
export function signAccessToken(user) {
  return jwt.sign(
    { role: user.role, propertyId: user.property_id ?? null },
    config.jwtSecret,
    { subject: String(user.id), expiresIn: config.accessTtl, algorithm: 'HS256' }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
}

//  refresh token 
export async function issueRefreshToken(userId) {
  await query('DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at < now()', [userId]); // housekeeping
  const token = crypto.randomBytes(48).toString('base64url');
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3))`,
    [userId, sha256(token), config.refreshTtlDays]
  );
  return token;
}

// Deletes the token and returns its owner in ONE statement. Two requests presenting
// the same token at the same moment cannot both succeed: that is one-time use.
export async function consumeRefreshToken(token) {
  const { rows } = await query(
    'DELETE FROM refresh_tokens WHERE token_hash = $1 AND expires_at > now() RETURNING user_id',
    [sha256(token)]
  );
  return rows[0]?.user_id ?? null;
}

export const revokeRefreshToken = (token) =>
  query('DELETE FROM refresh_tokens WHERE token_hash = $1', [sha256(token)]);

// Used when an admin changes someone s role or hotel 
export const revokeAllRefreshTokens = (userId) =>
  query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);