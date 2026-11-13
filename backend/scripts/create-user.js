import { pool } from '../src/db.js';
import { hashPassword } from '../src/auth/passwords.js';

const [role, rawEmail, propertyId] = process.argv.slice(2);
const password = process.env.NEW_PASSWORD;
const email = rawEmail?.trim().toLowerCase();

function fail(message) {
  console.error(message);
  console.error('Usage: NEW_PASSWORD=... pnpm create-user <admin|employee|user> <email> [propertyId]');
  process.exit(1);
}

if (!['admin', 'employee', 'user'].includes(role)) fail('Role must be admin, employee or user.');
if (!email || !email.includes('@')) fail('A valid email is required.');
if (!password || password.length < 8) fail('Set NEW_PASSWORD (at least 8 characters).');
if (role === 'employee' && !propertyId) fail('An employee needs a propertyId.');
if (role !== 'employee' && propertyId) fail('Only employees take a propertyId.');

try {
  const { rows } = await pool.query(
    'INSERT INTO users (email, password_hash, role, property_id) VALUES ($1,$2,$3,$4) RETURNING id, email, role, property_id',
    [email, await hashPassword(password), role, propertyId ? Number(propertyId) : null]
  );
  console.table(rows);
} catch (err) {
  console.error(err.code === '23505' ? 'That email already exists.' : err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}