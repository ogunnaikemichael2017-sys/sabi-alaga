// Tracks how many changes are waiting to go live with the next publish.
// Interface state only: it lives in the browser, and Publish clears it.
const KEY = "sa_pend";
export function loadPending() {
  try {
    const n = parseInt(localStorage.getItem(KEY) || "0", 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (e) { return 0; }
}
export function addPending(n) {
  const next = loadPending() + (n || 1);
  try { localStorage.setItem(KEY, String(next)); } catch (e) {}
  return next;
}
export function clearPending() {
  try { localStorage.removeItem(KEY); } catch (e) {}
  return 0;
}
