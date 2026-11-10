import { pool } from '../src/db.js';


// Runs fn inside a transaction that is always rolled back, so nothing is saved.
async function attempt(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await fn(client);
    return { ok: true };
  } catch (err) {
    return { ok: false, code: err.code };
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

async function seed(c) {
  const p = await c.query("INSERT INTO properties(name) VALUES ('Test Hotel') RETURNING id");
  const r = await c.query(
    "INSERT INTO rooms(property_id, room_number, type, rate_inr) VALUES ($1,'101','Deluxe',9500) RETURNING id",
    [p.rows[0].id]
  );
  return { propertyId: p.rows[0].id, roomId: r.rows[0].id };
}

const addUser = (c, email, role, propertyId) =>
  c.query('INSERT INTO users(email, password_hash, role, property_id) VALUES ($1,$2,$3,$4)', [email, 'x', role, propertyId]);

const addBooking = (c, roomId, ci, co, status = 'confirmed') =>
  c.query(
    "INSERT INTO bookings(room_id, guest_name, check_in, check_out, amount_inr, status) VALUES ($1,'Guest',$2,$3,1000,$4)",
    [roomId, ci, co, status]
  );

const cases = [
  ['employee without a hotel is rejected', '23514', async (c) => addUser(c, 'e@x.com', 'employee', null)],
  ['user with a hotel is rejected', '23514', async (c) => { const s = await seed(c); await addUser(c, 'u@x.com', 'user', s.propertyId); }],
  ['employee with a hotel is accepted', 'ok', async (c) => { const s = await seed(c); await addUser(c, 'e@x.com', 'employee', s.propertyId); }],
  ['duplicate email is rejected', '23505', async (c) => { await addUser(c, 'a@x.com', 'user', null); await addUser(c, 'a@x.com', 'user', null); }],
  ['check-out before check-in is rejected', '23514', async (c) => { const s = await seed(c); await addBooking(c, s.roomId, '2026-05-05', '2026-05-01'); }],
  ['overlapping bookings are rejected', '23P01', async (c) => { const s = await seed(c); await addBooking(c, s.roomId, '2026-05-01', '2026-05-05'); await addBooking(c, s.roomId, '2026-05-03', '2026-05-07'); }],
  ['back-to-back bookings are accepted', 'ok', async (c) => { const s = await seed(c); await addBooking(c, s.roomId, '2026-05-01', '2026-05-05'); await addBooking(c, s.roomId, '2026-05-05', '2026-05-07'); }],
  ['a cancelled booking frees the dates', 'ok', async (c) => { const s = await seed(c); await addBooking(c, s.roomId, '2026-05-01', '2026-05-05', 'cancelled'); await addBooking(c, s.roomId, '2026-05-02', '2026-05-04'); }],
  ['a room type outside the list is rejected', '23514', async (c) => { const s = await seed(c); await c.query("INSERT INTO rooms(property_id, room_number, type, rate_inr) VALUES ($1,'102','DLX',100)", [s.propertyId]); }],
];

(async () => {
  let failed = 0;
  for (const [name, expected, fn] of cases) {
    const result = await attempt(fn);
    const actual = result.ok ? 'ok' : result.code;
    const pass = actual === expected;
    if (!pass) failed++;
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  (expected ${expected}, got ${actual})`);
  }
  await pool.end();
  process.exit(failed ? 1 : 0);
})();