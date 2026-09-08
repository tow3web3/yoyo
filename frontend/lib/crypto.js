// Dev-wallet key handling for the web app. Same AES-256-GCM format the bot
// writes (backend/src/services/encryption.js) so both front-ends share one key.
import crypto from 'crypto';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const ALGORITHM = 'aes-256-gcm';

function masterKey() {
  const k = Buffer.from(process.env.MASTER_ENCRYPTION_KEY || '', 'hex');
  if (k.length !== 32) throw new Error('MASTER_ENCRYPTION_KEY must be 64 hex characters');
  return k;
}

export function encryptPrivateKey(privateKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey(), iv);
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { encrypted, iv: iv.toString('hex'), authTag: cipher.getAuthTag().toString('hex') };
}

export const isValidPrivateKey = (k) => /^(0x)?[0-9a-fA-F]{64}$/.test(String(k || '').trim());
export const normalizeKey = (k) => { const s = String(k).trim(); return (s.startsWith('0x') ? s : `0x${s}`).toLowerCase(); };

export function addressOf(privateKey) {
  return privateKeyToAccount(normalizeKey(privateKey)).address;
}

/** A fresh dedicated dev wallet. The key is returned once, to be encrypted immediately. */
export function generateDevWallet() {
  const privateKey = generatePrivateKey();
  return { privateKey, address: privateKeyToAccount(privateKey).address };
}
