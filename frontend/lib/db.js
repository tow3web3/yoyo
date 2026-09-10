// Read-only Postgres access for the site's API routes (the same database the
// bot writes to). Exposes a tagged template, `sql\`... ${value} ...\``, that
// returns the rows array, so queries read like plain SQL.
import { Pool } from 'pg';

let pool;

function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    // Self-signed server certificate on the VM: verify nothing, but do encrypt. sslmode=no-verify in the URL is handled by pg itself.
    const ssl = url.includes('sslmode=no-verify') ? undefined : url.includes('sslmode=require') || url.includes('neon.tech') ? { rejectUnauthorized: false } : false;
    pool = new Pool({ connectionString: url, ssl, max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
    pool.on('error', (e) => console.error('pg pool error:', e.message));
  }
  return pool;
}

async function sql(strings, ...values) {
  let text = '';
  strings.forEach((s, i) => { text += s; if (i < values.length) text += `$${i + 1}`; });
  const { rows } = await getPool().query(text, values);
  return rows;
}

export function getSql() {
  return sql;
}
