// Calls into the backend's internal API (same box): run a cycle now, reschedule
// after an edit. Best effort: a failed call never breaks the dashboard, the
// scheduler refreshes configs on its own every five minutes anyway.
// INTERNAL_API_URL is either the backend origin (http://127.0.0.1:5400) or, from
// another host, the nginx alias that already maps to /api/internal (https://host/internal).
const RAW = (process.env.INTERNAL_API_URL || 'http://127.0.0.1:5400').replace(/\/$/, '');
const BASE = RAW.endsWith('/internal') ? RAW : `${RAW}/api/internal`;

export async function internal(path, body = {}) {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) return { ok: false, error: 'INTERNAL_API_KEY not set' };
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-internal-key': key }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export const reschedule = (configId) => internal(`/reschedule/${configId}`);
export const runNow = (configId) => internal(`/run/${configId}`);
export const policyCreated = (configId) => internal(`/created/${configId}`);
