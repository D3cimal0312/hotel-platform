import { query } from '../db.js';
import { AppError } from '../errors.js';
import { log } from '../logger.js';
import { hashPassword, verifyPassword, DUMMY_HASH } from './passwords.js';
import { signAccessToken, issueRefreshToken, consumeRefreshToken, revokeRefreshToken } from './tokens.js';

const USER_COLUMNS = 'id, email, password_hash, role, property_id';
const publicUser = (u) => ({ id: u.id, email: u.email, role: u.role, propertyId: u.property_id });

async function issueTokens(user) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: await issueRefreshToken(user.id),
    user: publicUser(user),
  };
}

export async function register({ email, password }) {
  const passwordHash = await hashPassword(password);
  try {
    // Role is hard-coded
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'user') RETURNING ${USER_COLUMNS}`,
      [email, passwordHash]
    );
    log('user_registered', { userId: rows[0].id });
    return issueTokens(rows[0]);
  } catch (err) {
    if (err.code === '23505') throw new AppError(409, 'An account with this email already exists');
    throw err;
  }
}

export async function login({ email, password, ip }) {
  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users WHERE email = $1`, [email]);
  const user = rows[0];
  const passwordOk = await verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !passwordOk) {
    log('login_failed', { ip });
    throw new AppError(401, 'Invalid email or password'); 
  }
  log('login_success', { userId: user.id, role: user.role });
  return issueTokens(user);
}

export async function refresh(refreshToken) {
  const userId = await consumeRefreshToken(refreshToken);
  if (!userId) throw new AppError(401, 'Invalid or expired refresh token');

  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [userId]);
  if (!rows[0]) throw new AppError(401, 'Invalid or expired refresh token');
  return issueTokens(rows[0]);
}

export async function logout(refreshToken) {
  await revokeRefreshToken(refreshToken);
}

export async function getUser(id) {
  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  if (!rows[0]) throw new AppError(401, 'Authentication required');
  return publicUser(rows[0]);
}