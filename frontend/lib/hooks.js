// Launchpad hook helpers: API keys are stored hashed, launch codes are short
// and unambiguous, webhook secrets are returned once at registration.
import crypto from 'crypto';
import { getSql } from './db';

export const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
export const randomKey = (prefix) => `${prefix}_${crypto.randomBytes(24).toString('base64url')}`;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function launchCode(len = 8) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function bearer(request) {
  const h = request.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

/** Launchpad row for a raw API key, or null. */
export async function launchpadByKey(apiKey) {
  if (!apiKey) return null;
  const sql = getSql();
  const [row] = await sql`SELECT id, slug, name, website, webhook_url FROM launchpads WHERE api_key_hash = ${sha256(apiKey)}`;
  return row || null;
}

export function adminOk(request) {
  const key = process.env.HOOKS_ADMIN_KEY;
  return Boolean(key) && request.headers.get('x-admin-key') === key;
}
