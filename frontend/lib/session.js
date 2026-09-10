// Wallet-login sessions for the web app: an HMAC-signed cookie carrying the
// user id and wallet, verified on every request. No third party, no gas.
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getSql } from './db';

const COOKIE = 'bm_session';
const MAX_AGE = 30 * 24 * 3600;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set');
  return s;
}

const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (payload) => crypto.createHmac('sha256', secret()).update(payload).digest('base64url');

export function makeToken(user) {
  const payload = b64(JSON.stringify({ uid: user.id, wallet: user.wallet_address, exp: Date.now() + MAX_AGE * 1000 }));
  return `${payload}.${sign(payload)}`;
}

export function readToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export async function setSessionCookie(user) {
  const jar = await cookies();
  jar.set(COOKIE, makeToken(user), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: MAX_AGE });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
}

/** The logged-in user row, or null. */
export async function sessionUser() {
  const jar = await cookies();
  const data = readToken(jar.get(COOKIE)?.value);
  if (!data) return null;
  const sql = getSql();
  const [user] = await sql`SELECT * FROM users WHERE id = ${data.uid}`;
  if (!user || (user.wallet_address && user.wallet_address !== data.wallet)) return null;
  return user;
}

export const loginMessage = ({ wallet, nonce, issuedAt }) =>
  `yo-yo dashboard login\nChain: Robinhood Chain (4663)\nWallet: ${wallet}\nNonce: ${nonce}\nIssued: ${issuedAt}\n\nThis signature costs no gas and only proves you own this wallet.`;

export const revealMessage = ({ wallet, devWallet, nonce, issuedAt }) =>
  `yo-yo: reveal my dev wallet private key\nDev wallet: ${devWallet}\nSigned in as: ${wallet}\nNonce: ${nonce}\nIssued: ${issuedAt}\n\nOnly sign this on yo-yo.dev. Anyone holding the key controls the fees.`;
