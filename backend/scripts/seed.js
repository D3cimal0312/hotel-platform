import {pool} from '../src/db.js';
import {config} from '../src/config.js';
import { normalizeRoomType, toInr, fixDates } from '../src/cleaning/index.js';
import { generateRaw } from './rawData.js';

// Bbulk insert: table and column names are our own constants, values are always parameters.
async function insertMany(client, table, columns, rows, returning = '') {
  const out = [];
  for (let i = 0; i < rows.length; i += 500) {
    const params = [];
    const tuples = rows.slice(i, i + 500).map(
      (row) => `(${columns.map((c) => { params.push(row[c]); return `$${params.length}`; }).join(',')})`
    );
    const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${tuples.join(',')}${returning ? ` RETURNING ${returning}` : ''}`;
    out.push(...(await client.query(sql, params)).rows);
  }
  return out;
}

function statusFor(checkIn, checkOut, cancelled, today) {
  if (cancelled) return 'cancelled';
  if (checkOut <= today) return 'checked_out';
  if (checkIn <= today) return 'checked_in';
  return 'confirmed';
}

async function main() {
  if (config.env === 'production') throw new Error('Refusing to seed in production');
  const reset = process.argv.includes('--reset');

  const existing = Number((await pool.query('SELECT count(*) FROM properties')).rows[0].count);
  if (existing > 0 && !reset) {
    throw new Error('Database already has data. Run "pnpm seed-reset" to wipe it and reseed (development only).');
  }

  const raw = generateRaw();
  const today = new Date().toISOString().slice(0, 10);
  const log = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    if (reset) {
      await client.query('TRUNCATE import_log, reviews, bookings, rooms, enquiries, refresh_tokens, users, properties RESTART IDENTITY CASCADE');
    }

    // Properties
    const props = await insertMany(client, 'properties', ['name'], raw.properties.map((name) => ({ name })), 'id, name');
    const propertyId = new Map(props.map((p) => [p.name, p.id]));

    // Rooms: normalise the type, convert the rate, quarantine what we cannot read
    const roomRows = [];
    for (const r of raw.rooms) {
      const type = normalizeRoomType(r.type_raw);
      if (!type) { log.push({ entity: 'room', source_property: r.property, issue: 'unknown_room_type', action: 'quarantined', raw: r }); continue; }
      if (r.type_raw !== type) log.push({ entity: 'room', source_property: r.property, issue: 'room_type_renamed', action: 'normalized', raw: r });
      if (r.currency !== 'INR') log.push({ entity: 'room', source_property: r.property, issue: 'rate_in_usd', action: 'converted', raw: r });
      roomRows.push({ property_id: propertyId.get(r.property), room_number: r.room_number, type, rate_inr: toInr(r.rate, r.currency, config.usdInr) });
    }
    const rooms = await insertMany(client, 'rooms', ['property_id', 'room_number', 'type', 'rate_inr'], roomRows, 'id, property_id, room_number');
    const roomId = new Map(rooms.map((r) => [`${r.property_id}:${r.room_number}`, r.id]));

    // Bookings: repair dates, convert amounts, quarantine unreadable rows and double bookings
    const taken = new Map(); // roomId -> accepted [checkIn, checkOut] pairs
    const bookingRows = [];
    for (const b of raw.bookings) {
      const id = roomId.get(`${propertyId.get(b.property)}:${b.room_number}`);
      if (!id) continue;

      const dates = fixDates(b.check_in, b.check_out);
      if (!dates.ok) { log.push({ entity: 'booking', source_property: b.property, issue: dates.reason, action: 'quarantined', raw: b }); continue; }
      if (dates.flag) log.push({ entity: 'booking', source_property: b.property, issue: dates.flag, action: 'repaired', raw: b });
      if (b.currency !== 'INR') log.push({ entity: 'booking', source_property: b.property, issue: 'amount_in_usd', action: 'converted', raw: b });

      if (!b.cancelled) { // cancelled bookings never block dates
        const list = taken.get(id) ?? [];
        if (list.some(([ci, co]) => dates.checkIn < co && dates.checkOut > ci)) {
          log.push({ entity: 'booking', source_property: b.property, issue: 'overlap_conflict', action: 'quarantined', raw: b });
          continue;
        }
        list.push([dates.checkIn, dates.checkOut]);
        taken.set(id, list);
      }

      bookingRows.push({
        room_id: id, guest_name: b.guest_name, check_in: dates.checkIn, check_out: dates.checkOut,
        amount_inr: toInr(b.amount, b.currency, config.usdInr),
        status: statusFor(dates.checkIn, dates.checkOut, b.cancelled, today),
        source_currency: b.currency, data_flag: dates.flag,
      });
    }
    await insertMany(client, 'bookings', ['room_id', 'guest_name', 'check_in', 'check_out', 'amount_inr', 'status', 'source_currency', 'data_flag'], bookingRows);
    await insertMany(client, 'import_log', ['entity', 'source_property', 'issue', 'action', 'raw'], log);
    await client.query('COMMIT');

    console.log(`Loaded ${props.length} properties, ${rooms.length} rooms, ${bookingRows.length} bookings.\n`);
    const summary = await pool.query('SELECT entity, issue, action, count(*)::int AS n FROM import_log GROUP BY 1,2,3 ORDER BY 1,2,3');
    console.table(summary.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => pool.end());