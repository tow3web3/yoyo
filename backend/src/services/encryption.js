import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = Buffer.from(process.env.MASTER_ENCRYPTION_KEY || '', 'hex');

if (ENCRYPTION_KEY.length !== 32) {
  throw new Error('MASTER_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)');
}

/** AES-256-GCM encrypt a private key. */
export function encryptPrivateKey(privateKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { encrypted, iv: iv.toString('hex'), authTag: cipher.getAuthTag().toString('hex') };
}

export function decryptPrivateKey(encryptedData) {
  const data = typeof encryptedData === 'string' ? JSON.parse(encryptedData) : encryptedData;
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, Buffer.from(data.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
  let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

/** An EVM private key: 32 bytes of hex, with or without the 0x prefix. */
export function isValidPrivateKey(privateKey) {
  const k = String(privateKey || '').trim();
  return /^(0x)?[0-9a-fA-F]{64}$/.test(k);
}
