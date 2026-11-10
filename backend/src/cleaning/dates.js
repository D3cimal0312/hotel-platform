// Accepts "2026-09-14" (ISO) or "14/09/2026" / "14-09-2026" (day first   as in India)
// Returns an ISO string, or null if it isn't a real calendar date
function parseDate(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  let y, m, d;
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(s))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Rejects impossible dates such as 31/02/2026, which JS would silently roll over
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

function nightsBetween(checkIn, checkOut) {
  return (Date.parse(checkOut) - Date.parse(checkIn)) / 86400000;
}

// Repairs a stay's dates, or says why it can't.
function fixDates(rawCheckIn, rawCheckOut) {
  const checkIn = parseDate(rawCheckIn);
  const checkOut = parseDate(rawCheckOut);
  if (!checkIn || !checkOut) return { ok: false, reason: 'bad_date' };
  if (checkIn === checkOut) return { ok: false, reason: 'zero_night' };
  if (checkOut < checkIn) return { ok: true, checkIn: checkOut, checkOut: checkIn, flag: 'dates_swapped' };
  return { ok: true, checkIn, checkOut, flag: null };
}


export { parseDate, nightsBetween, fixDates };
