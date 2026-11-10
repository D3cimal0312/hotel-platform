import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoomType, toInr, parseDate, fixDates, nightsBetween } from '../src/cleaning/index.js';

test('room types: aliases from different hotels map to one name', () => {
  assert.equal(normalizeRoomType('DLX'), 'Deluxe');
  assert.equal(normalizeRoomType('Deluxe King'), 'Deluxe');
  assert.equal(normalizeRoomType('Deluxe-King'), 'Deluxe');
  assert.equal(normalizeRoomType('  exec   SUITE '), 'Suite');
  assert.equal(normalizeRoomType('Classic'), 'Standard');
  assert.equal(normalizeRoomType('Sup Room'), 'Superior');
});

test('room types: unknown or non-string values return null', () => {
  assert.equal(normalizeRoomType('Penthouse'), null);
  assert.equal(normalizeRoomType(''), null);
  assert.equal(normalizeRoomType(null), null);
});

test('currency: INR passes through, USD is converted', () => {
  assert.equal(toInr(9500, 'INR', 83), 9500);
  assert.equal(toInr(100, 'USD', 83), 8300);
  assert.equal(toInr(12.5, 'usd', 83), 1037.5);
});

test('currency: bad input throws instead of guessing', () => {
  assert.throws(() => toInr(-1, 'INR', 83), RangeError);
  assert.throws(() => toInr('abc', 'INR', 83), RangeError);
  assert.throws(() => toInr(100, 'EUR', 83), RangeError);
  assert.throws(() => toInr(100, 'USD', 0), RangeError);
});

test('dates: ISO and day-first formats parse', () => {
  assert.equal(parseDate('2026-09-14'), '2026-09-14');
  assert.equal(parseDate('14/09/2026'), '2026-09-14');
  assert.equal(parseDate('14-09-2026'), '2026-09-14');
});

test('dates: impossible dates are rejected', () => {
  assert.equal(parseDate('31/02/2026'), null);
  assert.equal(parseDate('2026-13-01'), null);
  assert.equal(parseDate('tomorrow'), null);
});

test('fixDates: normal stay is unchanged', () => {
  assert.deepEqual(fixDates('2026-09-01', '2026-09-04'), { ok: true, checkIn: '2026-09-01', checkOut: '2026-09-04', flag: null });
});

test('fixDates: reversed dates are swapped and flagged', () => {
  assert.deepEqual(fixDates('2026-09-04', '2026-09-01'), { ok: true, checkIn: '2026-09-01', checkOut: '2026-09-04', flag: 'dates_swapped' });
});

test('fixDates: zero-night and unparsable stays are rejected', () => {
  assert.deepEqual(fixDates('2026-09-01', '2026-09-01'), { ok: false, reason: 'zero_night' });
  assert.deepEqual(fixDates('x', '2026-09-01'), { ok: false, reason: 'bad_date' });
});

test('nightsBetween counts nights', () => {
  assert.equal(nightsBetween('2026-09-01', '2026-09-04'), 3);
});