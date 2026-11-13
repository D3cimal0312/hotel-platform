// One JSON object per line: easy for hosting dashboards to search.

const silent = Boolean(process.env.NODE_TEST_CONTEXT);

export function log(event, meta = {}) {
  if (silent) return;
  console.log(JSON.stringify({ time: new Date().toISOString(), event, ...meta }));
}