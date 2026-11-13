import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { pool, query } from '../src/db.js';
import { hashPassword } from '../src/auth/passwords.js';

const api = request(createApp());
const PASSWORD = 'correct-horse-battery';
const newEmail = () => `authtest-${Math.random().toString(36).slice(2, 10)}@example.test`;

const signUp = (email = newEmail()) => api.post('/api/auth/register').send({ email, password: PASSWORD });

after(async () => {
  await query("DELETE FROM users WHERE email LIKE 'authtest-%@example.test'"); // tokens cascade
  await pool.end();
});

test('register creates a plain user and ignores role and hotel in the body', async () => {
  const res = await api.post('/api/auth/register').send({ email: newEmail(), password: PASSWORD, role: 'admin', propertyId: 1 });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.role, 'user');
  assert.equal(res.body.user.propertyId, null);
  assert.ok(res.body.accessToken && res.body.refreshToken);
  assert.equal(res.body.user.password_hash, undefined);
});

test('the password is stored as a bcrypt hash', async () => {
  const email = newEmail();
  await signUp(email);
  const { rows } = await query('SELECT password_hash FROM users WHERE email = $1', [email]);
  assert.ok(rows[0].password_hash.startsWith('$2'));
  assert.notEqual(rows[0].password_hash, PASSWORD);
});

test('duplicate email returns 409', async () => {
  const email = newEmail();
  await signUp(email);
  assert.equal((await signUp(email)).status, 409);
});

test('validation errors return 400 with field details', async () => {
  const res = await api.post('/api/auth/register').send({ email: 'nope', password: '123' });
  assert.equal(res.status, 400);
  const fields = res.body.details.map((d) => d.field);
  assert.ok(fields.includes('email') && fields.includes('password'));
});

test('malformed JSON returns 400', async () => {
  const res = await api.post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Invalid JSON');
});

test('login works, and wrong password / unknown email give the same 401', async () => {
  const email = newEmail();
  await signUp(email);
  assert.equal((await api.post('/api/auth/login').send({ email, password: PASSWORD })).status, 200);
  const wrong = await api.post('/api/auth/login').send({ email, password: 'wrong-password' });
  const unknown = await api.post('/api/auth/login').send({ email: newEmail(), password: PASSWORD });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(wrong.body.error, unknown.body.error);
});

test('access token carries id, role and hotel, and lasts 15 minutes', async () => {
  const res = await signUp();
  const claims = jwt.decode(res.body.accessToken);
  assert.equal(claims.sub, String(res.body.user.id));
  assert.equal(claims.role, 'user');
  assert.equal(claims.propertyId, null);
  assert.equal(claims.exp - claims.iat, 900);
});

test('/me needs a valid token', async () => {
  const res = await signUp();
  const ok = await api.get('/api/auth/me').set('Authorization', `Bearer ${res.body.accessToken}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.email, res.body.user.email);
  assert.equal((await api.get('/api/auth/me')).status, 401);
  assert.equal((await api.get('/api/auth/me').set('Authorization', 'Bearer garbage')).status, 401);
});

test('refresh rotates the token: the old one stops working', async () => {
  const first = (await signUp()).body;
  const second = await api.post('/api/auth/refresh').send({ refreshToken: first.refreshToken });
  assert.equal(second.status, 200);
  assert.notEqual(second.body.refreshToken, first.refreshToken);
  const replay = await api.post('/api/auth/refresh').send({ refreshToken: first.refreshToken });
  assert.equal(replay.status, 401);
});

test('only token hashes are stored, never the token itself', async () => {
  const res = (await signUp()).body;
  const { rows } = await query('SELECT token_hash FROM refresh_tokens WHERE user_id = $1', [res.user.id]);
  assert.ok(rows.length >= 1);
  assert.ok(rows.every((r) => r.token_hash !== res.refreshToken));
});

test('an expired refresh token is rejected', async () => {
  const res = (await signUp()).body;
  await query("UPDATE refresh_tokens SET expires_at = now() - interval '1 day' WHERE user_id = $1", [res.user.id]);
  assert.equal((await api.post('/api/auth/refresh').send({ refreshToken: res.refreshToken })).status, 401);
});

test('logout revokes the refresh token', async () => {
  const res = (await signUp()).body;
  assert.equal((await api.post('/api/auth/logout').send({ refreshToken: res.refreshToken })).status, 204);
  assert.equal((await api.post('/api/auth/refresh').send({ refreshToken: res.refreshToken })).status, 401);
});

test('a role change takes effect at the next refresh', async () => {
  const res = (await signUp()).body;
  await query("UPDATE users SET role = 'admin' WHERE id = $1", [res.user.id]);
  const next = await api.post('/api/auth/refresh').send({ refreshToken: res.refreshToken });
  assert.equal(jwt.decode(next.body.accessToken).role, 'admin');
});

test('an employee token carries the hotel id', async () => {
  const { rows } = await query('SELECT id FROM properties ORDER BY id LIMIT 1');
  assert.ok(rows[0], 'No properties found. Run "pnpm seed" first.');
  const email = newEmail();
  await query(
    "INSERT INTO users (email, password_hash, role, property_id) VALUES ($1, $2, 'employee', $3)",
    [email, await hashPassword(PASSWORD), rows[0].id]
  );
  const res = await api.post('/api/auth/login').send({ email, password: PASSWORD });
  const claims = jwt.decode(res.body.accessToken);
  assert.equal(claims.role, 'employee');
  assert.equal(claims.propertyId, rows[0].id);
});