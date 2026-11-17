import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { pool, query } from '../src/db.js';
import { hashPassword } from '../src/auth/passwords.js';
import { requireRole, scopeToProperty } from '../src/middleware/rbac.js';

const api = request(createApp());
const PASSWORD = 'correct-horse-battery';
const newEmail = () => `rbactest-${Math.random().toString(36).slice(2, 10)}@example.test`;
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

async function makeUser(role, propertyId = null) {
  const email = newEmail();
  const { rows } = await query(
    'INSERT INTO users (email, password_hash, role, property_id) VALUES ($1, $2, $3, $4) RETURNING id',
    [email, await hashPassword(PASSWORD), role, propertyId]
  );
  const res = await api.post('/api/auth/login').send({ email, password: PASSWORD });
  return { id: rows[0].id, email, token: res.body.accessToken, refreshToken: res.body.refreshToken };
}

let propA, propB, bookingA, bookingB, admin, empA, guest, guestBookingId;

before(async () => {
  const props = (await query(
    'SELECT DISTINCT r.property_id AS id FROM bookings b JOIN rooms r ON r.id = b.room_id ORDER BY 1 LIMIT 2'
  )).rows;
  assert.equal(props.length, 2, 'Seed data is missing. Run "pnpm seed" first.');
  [propA, propB] = [props[0].id, props[1].id];

  const firstBookingAt = async (propertyId) => (await query(
    'SELECT b.id FROM bookings b JOIN rooms r ON r.id = b.room_id WHERE r.property_id = $1 ORDER BY b.id LIMIT 1',
    [propertyId]
  )).rows[0].id;
  bookingA = await firstBookingAt(propA);
  bookingB = await firstBookingAt(propB);

  admin = await makeUser('admin');
  empA = await makeUser('employee', propA);
  guest = await makeUser('user');

  // One booking owned by the test guest, in 2031 so it cannot clash with seeded stays.
  const room = (await query('SELECT id FROM rooms WHERE property_id = $1 ORDER BY id LIMIT 1', [propA])).rows[0].id;
  guestBookingId = (await query(
    `INSERT INTO bookings (room_id, user_id, guest_name, check_in, check_out, amount_inr)
     VALUES ($1, $2, 'RBAC Test Guest', '2031-01-01', '2031-01-03', 19000) RETURNING id`,
    [room, guest.id]
  )).rows[0].id;
});

after(async () => {
  await query("DELETE FROM bookings WHERE guest_name = 'RBAC Test Guest'");
  await query("DELETE FROM users WHERE email LIKE 'rbactest-%@example.test'");
  await pool.end();
});

// ---------- middleware units
const run = (middleware, user) => {
  const req = { user };
  let err;
  middleware(req, {}, (e) => { err = e; });
  return { req, err };
};

test('requireRole: allows listed roles, refuses others, needs a user', () => {
  assert.equal(run(requireRole('admin'), { role: 'admin' }).err, undefined);
  assert.equal(run(requireRole('admin'), { role: 'employee' }).err.status, 403);
  assert.equal(run(requireRole('admin'), undefined).err.status, 401);
});

test('scopeToProperty: pins employees, frees admins, refuses everyone else', () => {
  assert.deepEqual(run(scopeToProperty, { role: 'employee', propertyId: 7 }).req.scope, { propertyId: 7 });
  assert.deepEqual(run(scopeToProperty, { role: 'admin' }).req.scope, {});
  assert.equal(run(scopeToProperty, { role: 'user' }).err.status, 403);
  assert.equal(run(scopeToProperty, { role: 'employee', propertyId: null }).err.status, 403);
});

// ---------- admin API access
test('admin API: no token is 401; user and employee are 403', async () => {
  assert.equal((await api.get('/api/admin/users')).status, 401);
  assert.equal((await api.get('/api/admin/users').set(bearer(guest.token))).status, 403);
  assert.equal((await api.get('/api/admin/users').set(bearer(empA.token))).status, 403);
  const create = await api.post('/api/admin/users').set(bearer(empA.token))
    .send({ email: newEmail(), password: PASSWORD, role: 'admin' });
  assert.equal(create.status, 403);
});

// ---------- booking visibility
test('bookings: no token is 401', async () => {
  assert.equal((await api.get('/api/bookings')).status, 401);
  assert.equal((await api.get(`/api/bookings/${bookingA}`)).status, 401);
});

test('bookings: a user sees only their own', async () => {
  const res = await api.get('/api/bookings').set(bearer(guest.token));
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 1);
  assert.equal(res.body.data[0].id, guestBookingId);
  assert.equal(res.body.data[0].userId, guest.id);
});

test('bookings: a user cannot open someone else\'s booking (404)', async () => {
  assert.equal((await api.get(`/api/bookings/${bookingA}`).set(bearer(guest.token))).status, 404);
  assert.equal((await api.get(`/api/bookings/${guestBookingId}`).set(bearer(guest.token))).status, 200);
});

test('bookings: an employee sees only their own hotel', async () => {
  const res = await api.get('/api/bookings?pageSize=100').set(bearer(empA.token));
  assert.equal(res.status, 200);
  assert.ok(res.body.data.length > 0);
  assert.ok(res.body.data.every((b) => b.propertyId === propA));
});

test('bookings: an employee cannot widen the scope with a query parameter', async () => {
  const res = await api.get(`/api/bookings?propertyId=${propB}&pageSize=100`).set(bearer(empA.token));
  assert.equal(res.status, 200);
  assert.ok(res.body.data.length > 0);
  assert.ok(res.body.data.every((b) => b.propertyId === propA));
});

test('bookings: an employee gets 404 for another hotel\'s booking and 200 for their own', async () => {
  assert.equal((await api.get(`/api/bookings/${bookingB}`).set(bearer(empA.token))).status, 404);
  const own = await api.get(`/api/bookings/${bookingA}`).set(bearer(empA.token));
  assert.equal(own.status, 200);
  assert.equal(own.body.propertyId, propA);
});

test('bookings: an admin sees every hotel and can filter by one', async () => {
  assert.equal((await api.get(`/api/bookings/${bookingA}`).set(bearer(admin.token))).status, 200);
  assert.equal((await api.get(`/api/bookings/${bookingB}`).set(bearer(admin.token))).status, 200);
  const all = await api.get('/api/bookings?pageSize=1').set(bearer(admin.token));
  const justB = await api.get(`/api/bookings?propertyId=${propB}&pageSize=100`).set(bearer(admin.token));
  assert.ok(all.body.total > justB.body.total);
  assert.ok(justB.body.data.every((b) => b.propertyId === propB));
});

test('bookings: bad query values and ids are 400', async () => {
  assert.equal((await api.get('/api/bookings?pageSize=1000').set(bearer(admin.token))).status, 400);
  assert.equal((await api.get('/api/bookings?status=bogus').set(bearer(admin.token))).status, 400);
  assert.equal((await api.get('/api/bookings/abc').set(bearer(admin.token))).status, 400);
});

test('bookings: dates are plain YYYY-MM-DD strings and amounts are numbers', async () => {
  const res = await api.get(`/api/bookings/${guestBookingId}`).set(bearer(guest.token));
  assert.equal(res.body.checkIn, '2031-01-01');
  assert.equal(res.body.checkOut, '2031-01-03');
  assert.equal(res.body.amountInr, 19000);
});

// ---------- admin user management
test('admin can create an employee, who then logs in with the hotel in the token', async () => {
  const email = newEmail();
  const res = await api.post('/api/admin/users').set(bearer(admin.token))
    .send({ email, password: PASSWORD, role: 'employee', propertyId: propA });
  assert.equal(res.status, 201);
  assert.equal(res.body.role, 'employee');
  assert.equal(res.body.propertyId, propA);
  assert.equal(res.body.password_hash, undefined);
  const login = await api.post('/api/auth/login').send({ email, password: PASSWORD });
  assert.equal(jwt.decode(login.body.accessToken).propertyId, propA);
});

test('admin create: invalid role/hotel combinations and bad data are rejected', async () => {
  const post = (body) => api.post('/api/admin/users').set(bearer(admin.token)).send({ email: newEmail(), password: PASSWORD, ...body });
  assert.equal((await post({ role: 'employee' })).status, 400);                         // employee without a hotel
  assert.equal((await post({ role: 'admin', propertyId: propA })).status, 400);         // admin with a hotel
  assert.equal((await post({ role: 'employee', propertyId: 999999 })).status, 400);     // hotel does not exist
  assert.equal((await post({ role: 'superuser' })).status, 400);                        // unknown role
  const dup = await api.post('/api/admin/users').set(bearer(admin.token))
    .send({ email: guest.email, password: PASSWORD, role: 'user' });
  assert.equal(dup.status, 409);
});

test('admin can list users, filter by role, and no hashes are returned', async () => {
  const res = await api.get('/api/admin/users?role=employee&pageSize=100').set(bearer(admin.token));
  assert.equal(res.status, 200);
  assert.ok(res.body.data.length > 0);
  assert.ok(res.body.data.every((u) => u.role === 'employee' && u.propertyId !== null));
  assert.ok(res.body.data.every((u) => u.password_hash === undefined && u.passwordHash === undefined));
});

test('changing a role revokes old refresh tokens and applies at the next login', async () => {
  const target = await makeUser('user');
  const res = await api.patch(`/api/admin/users/${target.id}`).set(bearer(admin.token))
    .send({ role: 'employee', propertyId: propB });
  assert.equal(res.status, 200);
  assert.equal(res.body.role, 'employee');
  assert.equal((await api.post('/api/auth/refresh').send({ refreshToken: target.refreshToken })).status, 401);
  const login = await api.post('/api/auth/login').send({ email: target.email, password: PASSWORD });
  const claims = jwt.decode(login.body.accessToken);
  assert.equal(claims.role, 'employee');
  assert.equal(claims.propertyId, propB);
});

test('admin update: own account, unknown user, bad id and invalid combination', async () => {
  const patch = (id, body) => api.patch(`/api/admin/users/${id}`).set(bearer(admin.token)).send(body);
  assert.equal((await patch(admin.id, { role: 'user', propertyId: null })).status, 409);
  assert.equal((await patch(999999999, { role: 'user', propertyId: null })).status, 404);
  assert.equal((await patch('abc', { role: 'user', propertyId: null })).status, 400);
  assert.equal((await patch(guest.id, { role: 'employee', propertyId: null })).status, 400);
});