// Direct pool access for the few queries that need dynamic column lists.
import { Pool } from 'pg';

let pool;
export function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    const ssl = url.includes('sslmode=require') || url.includes('neon.tech') ? { rejectUnauthorized: false } : false;
    pool = new Pool({ connectionString: url, ssl, max: 3, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  }
  return pool;
}
