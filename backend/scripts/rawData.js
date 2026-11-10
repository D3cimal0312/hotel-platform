function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PROPERTIES = [
  'Marine Drive Haven', 'Bandra Bay Retreat', 'Colaba Courtyard', 'Juhu Shoreline',
  'Powai Lakeside', 'Worli Skyline Suites', 'Fort Heritage House', 'Andheri Garden Inn',
  'Malabar Hill Residency', 'Versova Sands', 'Lower Parel Lofts', 'Chembur Palm Court',
  'Dadar Central Stay', 'Kala Ghoda Boutique',
];

// Each hotel names its room types differently.
const STYLES = [
  { Standard: 'Standard', Superior: 'Superior', Deluxe: 'Deluxe Room', Suite: 'Executive Suite' },
  { Standard: 'STD', Superior: 'SUP', Deluxe: 'DLX', Suite: 'Exec Suite' },
  { Standard: 'Classic', Superior: 'Superior Room', Deluxe: 'Deluxe King', Suite: 'Junior Suite' },
  { Standard: 'Standard Room', Superior: 'Sup Room', Deluxe: 'DLX King', Suite: 'Suite' },
];

const BASE_RATE_INR = { Standard: 5000, Superior: 7000, Deluxe: 9500, Suite: 16000 };
const LAYOUT = [['101', 'Standard'], ['102', 'Standard'], ['103', 'Standard'], ['201', 'Superior'],
                ['202', 'Superior'], ['301', 'Deluxe'], ['302', 'Deluxe'], ['401', 'Suite']];

const USD_PROPERTIES = new Set([3, 8, 12]); // these hotels quote in US dollars
const DMY_PROPERTIES = new Set([6, 7, 8]);  // these export dates as DD/MM/YYYY

const FIRST = ['Aarav', 'Diya', 'Rohan', 'Meera', 'Kabir', 'Ananya', 'Vikram', 'Isha', 'Arjun', 'Nisha', 'Sam', 'Priya'];
const LAST = ['Mehta', 'Iyer', 'Shah', 'Khan', 'Patil', 'Nair', 'Gupta', 'D\'Souza', 'Rao', 'Joshi', 'Smith', 'Brown'];

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const toDmy = (iso) => iso.split('-').reverse().join('/');

function generateRaw({ seed = 42, from = '2026-09-01', to = '2027-01-15' } = {}) {
  const rand = mulberry32(seed);
  const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const rooms = [];
  const bookings = [];
  const duplicates = [];

  PROPERTIES.forEach((property, i) => {
    const style = STYLES[i % STYLES.length];
    const usd = USD_PROPERTIES.has(i);
    const currency = usd ? 'USD' : 'INR';
    const factor = 0.9 + (i % 5) * 0.1;
    const fmt = DMY_PROPERTIES.has(i) ? toDmy : (d) => d;
    const layout = [...LAYOUT];
    if (i === 4) layout.push(['501', 'Penthouse']); // a type we do not recognise

    for (const [roomNumber, type] of layout) {
      const rateInr = Math.round(((BASE_RATE_INR[type] ?? 30000) * factor) / 100) * 100;
      const rate = usd ? Math.round(rateInr / 83) : rateInr;
      rooms.push({ property, room_number: roomNumber, type_raw: style[type] ?? type, rate, currency });
      if (!BASE_RATE_INR[type]) continue; // no bookings for the unknown type

      let cursor = addDays(from, int(0, 10));
      while (cursor < to) {
        const nights = int(1, 5);
        const checkIn = cursor;
        const checkOut = addDays(cursor, nights);
        const cancelled = rand() < 0.05;
        const base = { property, room_number: roomNumber, guest_name: `${pick(FIRST)} ${pick(LAST)}`, amount: rate * nights, currency, cancelled };

        const roll = rand();
        let outIn = checkIn;
        let outOut = checkOut;
        if (roll < 0.08) [outIn, outOut] = [checkOut, checkIn]; // 8%: reversed dates
        else if (roll < 0.10) outOut = checkIn;                 // 2%: zero-night stay
        bookings.push({ ...base, check_in: fmt(outIn), check_out: fmt(outOut) });

        // ~1.5%: the same room entered twice for the same dates by a different guest
        if (roll >= 0.10 && !cancelled && rand() < 0.015) {
          duplicates.push({ ...base, guest_name: `${pick(FIRST)} ${pick(LAST)}`, check_in: fmt(checkIn), check_out: fmt(checkOut) });
        }
        cursor = addDays(checkOut, int(0, 7));
      }
    }
  });

  return { properties: PROPERTIES, rooms, bookings: [...bookings, ...duplicates] };
}


export { generateRaw };
