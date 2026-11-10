// One place that defines every known spelling of each room type.
const ALIASES = {
  Standard: ['standard', 'std', 'std room', 'standard room', 'classic', 'classic room'],
  Superior: ['superior', 'sup', 'sup room', 'superior room'],
  Deluxe: ['deluxe', 'dlx', 'dlx room', 'deluxe room', 'deluxe king', 'dlx king'],
  Suite: ['suite', 'executive suite', 'exec suite', 'junior suite', 'jr suite'],
};

const LOOKUP = new Map();
for (const [canonical, names] of Object.entries(ALIASES)) {
  for (const name of names) LOOKUP.set(name, canonical);
}

// Returns the canonical type, or null if we don't recognise the name.
function normalizeRoomType(raw) {
  if (typeof raw !== 'string') return null;
  const key = raw
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ') // "Deluxe-King", "DLX." -> words only
    .replace(/\s+/g, ' ')
    .trim();
  return LOOKUP.get(key) ?? null;
}


export { normalizeRoomType };
