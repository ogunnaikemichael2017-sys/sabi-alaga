// Instant-open cache for the admin: each panel paints from here first, then
// quietly refreshes from the backend, so switching sections never shows a
// loading gap.
const mem = {};
export function cacheGet(k) { return mem[k]; }
export function cacheSet(k, v) { if (v !== undefined && v !== null) mem[k] = v; }
