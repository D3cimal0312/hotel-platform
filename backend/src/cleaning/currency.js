const round2 = (x) => Math.round(x * 100) / 100;

// Converts an amount to INR. Throws on bad input instead of guessing data
function toInr(amount, currency, usdInr) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) throw new RangeError(`Invalid amount: ${amount}`);
  const cur = String(currency).trim().toUpperCase();
  if (cur === 'INR') return round2(n);
  if (cur === 'USD') {
    if (!(usdInr > 0)) throw new RangeError('A positive USD to INR rate is required');
    return round2(n * usdInr);
  }
  throw new RangeError(`Unsupported currency: ${currency}`);
}


export { toInr };
