import { query } from '../db.js';
import { AppError } from '../errors.js';
import { log } from '../logger.js';
import { hashPassword } from '../auth/passwords.js';
import { revokeAllRefreshTokens } from '../auth/tokens.js';

const COLUMNS = 'id, email, role, property_id AS "propertyId", created_at AS "createdAt"';

// changes PostgreSQL constraint errors into clear API errors.
function mapDbError(err) {
  if (err.code === '23505') return new AppError(409, 'An account with this email already exists');
  if (err.code === '23503') return new AppError(400, 'That hotel does not exist');
  if (err.code === '23514') return new AppError(400, 'An employee needs a hotel; other roles must not have one');
  return err;
}

export async function listUsers({ role, page, pageSize }) {
  const where = role ? 'WHERE role = $1' : '';
  const params = role ? [role] : [];
  const total = Number((await query(`SELECT count(*) FROM users ${where}`, params)).rows[0].count);
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM users ${where} ORDER BY id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  return { data: rows, page, pageSize, total };
}

export async function createUser({ email, password, role, propertyId }, actorId) {
  try {
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, role, property_id) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
      [email, await hashPassword(password), role, propertyId]
    );
    log('user_created_by_admin', { actorId, userId: rows[0].id, role, propertyId });
    return rows[0];
  } catch (err) {
    throw mapDbError(err);
  }
}

export async function updateUser(id, { role, propertyId }, actorId) {
  // stopping an admin demoting themselves and leaving nobody able to manage accounts.
  if (id === actorId) throw new AppError(409, 'You cannot change your own role or hotel');

  const before = (await query('SELECT role, property_id FROM users WHERE id = $1', [id])).rows[0];
  if (!before) throw new AppError(404, 'User not found');

  let updated;
  try {
    updated = (await query(
      `UPDATE users SET role = $1, property_id = $2 WHERE id = $3 RETURNING ${COLUMNS}`,
      [role, propertyId, id]
    )).rows[0];
  } catch (err) {
    throw mapDbError(err);
  }

  //  old refresh tokens would keep issuing tokens with the old rights this  end those sessions.
  await revokeAllRefreshTokens(id);
  log('user_role_changed', { actorId, userId: id, from: before.role, to: role, propertyId });
  return updated;
}