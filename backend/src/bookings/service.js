import { query } from '../db.js';
import { AppError } from '../errors.js';

const BASE = `FROM bookings b
  JOIN rooms r ON r.id = b.room_id
  JOIN properties p ON p.id = r.property_id`;

// to_char keeps dates as plain "YYYY-MM-DD" text, so time zones cannot shift a date by a day.
const COLUMNS = `b.id, b.room_id AS "roomId", r.room_number AS "roomNumber", r.type AS "roomType",
  r.property_id AS "propertyId", p.name AS "propertyName",
  b.user_id AS "userId", b.guest_name AS "guestName",
  to_char(b.check_in, 'YYYY-MM-DD') AS "checkIn", to_char(b.check_out, 'YYYY-MM-DD') AS "checkOut",
  b.amount_inr AS "amountInr", b.status`;

const format = (row) => ({ ...row, amountInr: Number(row.amountInr) });

//  heart of access control for bookings
//  fails closed: any role that is not admin or employee is treated as a guest.
function scopeCondition(user, params) {
  if (user.role === 'admin') return null;
  if (user.role === 'employee') {
    if (!user.propertyId) throw new AppError(403, 'You do not have permission to do this');
    params.push(user.propertyId);
    return `r.property_id = $${params.length}`;
  }
  params.push(user.id);
  return `b.user_id = $${params.length}`;
}

export async function listBookings(user, { status, propertyId, page, pageSize }) {
  const params = [];
  const where = [];

  const scope = scopeCondition(user, params);
  if (scope) where.push(scope);
  if (status) { params.push(status); where.push(`b.status = $${params.length}`); }
  // Only admins may choose a hotel
  if (propertyId && user.role === 'admin') { params.push(propertyId); where.push(`r.property_id = $${params.length}`); }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number((await query(`SELECT count(*) ${BASE} ${clause}`, params)).rows[0].count);
  const { rows } = await query(
    `SELECT ${COLUMNS} ${BASE} ${clause} ORDER BY b.check_in DESC, b.id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  return { data: rows.map(format), page, pageSize, total };
}

export async function getBooking(user, id) {
  const params = [id];
  const where = ['b.id = $1'];
  const scope = scopeCondition(user, params);
  if (scope) where.push(scope);

  const { rows } = await query(`SELECT ${COLUMNS} ${BASE} WHERE ${where.join(' AND ')}`, params);
  if (!rows[0]) throw new AppError(404, 'Booking not found');
  return format(rows[0]);
}