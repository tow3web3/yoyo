// Holder ledger per token, rebuilt from ERC-20 Transfer logs and kept in
// Postgres. Robinhood Chain has no "list every holder" RPC call, and Blockscout's
// API sits behind a Cloudflare challenge, so the bot owns the data: every sync
// walks from the last indexed block to the head in chunks and applies the logs
// in order. Besides the balance, each row remembers when the wallet started
// holding (since_block) and when it last sent tokens out (last_out_block), which
// is what loyalty-weighted dividends are built on.
import pool from '../db/connection.js';
import { publicClient, erc20Abi, PROTOCOL_ADDRESSES, lower, ZERO } from '../chain/config.js';

const TRANSFER_EVENT = erc20Abi.find((x) => x.type === 'event' && x.name === 'Transfer');
const INDEX_CHUNK = BigInt(process.env.INDEX_CHUNK_BLOCKS || '50000');
const MAX_BLOCKS_PER_SYNC = BigInt(process.env.INDEX_MAX_BLOCKS || '4000000');
// Robinhood Chain mines a block roughly every 0.1 s.
export const BLOCKS_PER_HOUR = 36_000;
export const BLOCKS_PER_DAY = 864_000;

const extraExcluded = (process.env.EXCLUDED_ADDRESSES || '')
  .split(',').map((s) => s.trim().toLowerCase()).filter((s) => /^0x[0-9a-f]{40}$/.test(s));

const pairCache = new Map();

/** DexScreener pairs for a token on Robinhood Chain (pool addresses + creation time). */
export async function tokenPairs(token) {
  const key = lower(token);
  const hit = pairCache.get(key);
  if (hit && Date.now() - hit.ts < 5 * 60_000) return hit.pairs;
  try {
    const res = await fetch(`https://api.dexscreener.com/token-pairs/v1/robinhood/${token}`, {
      headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000),
    });
    const pairs = res.ok ? await res.json() : [];
    const list = Array.isArray(pairs) ? pairs : [];
    pairCache.set(key, { pairs: list, ts: Date.now() });
    return list;
  } catch {
    return hit?.pairs || [];
  }
}

async function blockAtTimestamp(client, ts) {
  let lo = 0n;
  let hi = await client.getBlockNumber();
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    const b = await client.getBlock({ blockNumber: mid });
    if (Number(b.timestamp) < ts) lo = mid + 1n;
    else hi = mid;
  }
  return lo;
}

/** First block worth scanning: a day before the first pool, else seven days back. */
async function detectStartBlock(client, token) {
  const pairs = await tokenPairs(token);
  const created = pairs.map((p) => p.pairCreatedAt).filter((t) => t > 0);
  if (created.length) return blockAtTimestamp(client, Math.floor(Math.min(...created) / 1000 - 86_400));
  const head = await client.getBlockNumber();
  const back = BigInt(BLOCKS_PER_DAY * 7);
  return head > back ? head - back : 0n;
}

async function fetchLogs(client, token, from, to) {
  try {
    return await client.getLogs({ address: token, event: TRANSFER_EVENT, fromBlock: from, toBlock: to });
  } catch (e) {
    if (to - from < 50n) throw e;
    const mid = from + (to - from) / 2n;
    const a = await fetchLogs(client, token, from, mid);
    const b = await fetchLogs(client, token, mid + 1n, to);
    return a.concat(b);
  }
}

/** Apply one chunk of logs, in order, on top of the stored state of the touched wallets. */
async function applyLogs(key, logs, to) {
  const touched = new Set();
  for (const l of logs) {
    if (lower(l.args.from) !== ZERO) touched.add(lower(l.args.from));
    if (lower(l.args.to) !== ZERO) touched.add(lower(l.args.to));
  }
  const addrs = [...touched];
  const state = new Map();
  if (addrs.length) {
    const { rows } = await pool.query(
      'SELECT address, balance::text AS bal, since_block, last_out_block FROM holder_balances WHERE token = $1 AND address = ANY($2)',
      [key, addrs]
    );
    for (const r of rows) {
      state.set(r.address, { balance: BigInt(r.bal), since: r.since_block != null ? BigInt(r.since_block) : null, lastOut: r.last_out_block != null ? BigInt(r.last_out_block) : null });
    }
  }
  const get = (a) => {
    if (!state.has(a)) state.set(a, { balance: 0n, since: null, lastOut: null });
    return state.get(a);
  };
  for (const l of logs) {
    const from = lower(l.args.from);
    const dest = lower(l.args.to);
    const v = l.args.value;
    const bn = l.blockNumber;
    if (from !== ZERO) {
      const s = get(from);
      s.balance -= v;
      s.lastOut = bn;
      if (s.balance <= 0n) s.since = null;
    }
    if (dest !== ZERO) {
      const s = get(dest);
      if (s.balance <= 0n) s.since = bn;
      s.balance += v;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [addr, s] of state) {
      await client.query(
        `INSERT INTO holder_balances (token, address, balance, since_block, last_out_block) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (token, address) DO UPDATE SET balance = EXCLUDED.balance, since_block = EXCLUDED.since_block, last_out_block = EXCLUDED.last_out_block`,
        [key, addr, s.balance.toString(), s.since?.toString() ?? null, s.lastOut?.toString() ?? null]
      );
    }
    await client.query('UPDATE holder_index_state SET last_block = $2, updated_at = NOW() WHERE token = $1', [key, to.toString()]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Bring a token's ledger up to the chain head. Bounded per call so one cycle
 * never runs away on a fresh token; the next cycle continues.
 */
export async function syncHolders(token, startBlock = null) {
  const client = publicClient();
  const key = lower(token);
  const { rows } = await pool.query('SELECT start_block, last_block FROM holder_index_state WHERE token = $1', [key]);
  let last = rows[0] ? BigInt(rows[0].last_block) : null;

  if (last === null) {
    const start = startBlock ? BigInt(startBlock) : await detectStartBlock(client, token);
    last = start - 1n;
    await pool.query(
      `INSERT INTO holder_index_state (token, start_block, last_block) VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET start_block = EXCLUDED.start_block, last_block = EXCLUDED.last_block`,
      [key, start.toString(), last.toString()]
    );
    console.log(`   Holder index for ${token} starts at block ${start}`);
  }

  const head = await client.getBlockNumber();
  const target = head - last > MAX_BLOCKS_PER_SYNC ? last + MAX_BLOCKS_PER_SYNC : head;
  let from = last + 1n;
  let events = 0;
  while (from <= target) {
    const to = from + INDEX_CHUNK - 1n > target ? target : from + INDEX_CHUNK - 1n;
    const logs = await fetchLogs(client, token, from, to);
    if (logs.length) {
      await applyLogs(key, logs, to);
      events += logs.length;
    } else {
      await pool.query('UPDATE holder_index_state SET last_block = $2, updated_at = NOW() WHERE token = $1', [key, to.toString()]);
    }
    from = to + 1n;
  }
  await pool.query('DELETE FROM holder_balances WHERE token = $1 AND balance <= 0', [key]);
  return { head, indexedTo: target, events, complete: target === head };
}

/** Contract-or-EOA check, cached forever per address (code never disappears). */
async function contractFlags(addresses) {
  const out = new Map();
  if (!addresses.length) return out;
  const { rows } = await pool.query('SELECT address, is_contract FROM address_kinds WHERE address = ANY($1)', [addresses]);
  for (const r of rows) out.set(r.address, r.is_contract);
  const unknown = addresses.filter((a) => !out.has(a));
  const client = publicClient();
  const BATCH = 25;
  for (let i = 0; i < unknown.length; i += BATCH) {
    const slice = unknown.slice(i, i + BATCH);
    const codes = await Promise.all(slice.map((a) => client.getCode({ address: a }).catch(() => undefined)));
    for (let j = 0; j < slice.length; j++) {
      const code = codes[j];
      if (code === undefined) continue;
      const isContract = Boolean(code && code !== '0x');
      out.set(slice[j], isContract);
      await pool.query('INSERT INTO address_kinds (address, is_contract) VALUES ($1, $2) ON CONFLICT (address) DO NOTHING', [slice[j], isContract]);
    }
  }
  return out;
}

/**
 * Eligible holders of a token: real wallets only. Pools, routers, the token
 * itself, the dev wallet, burn addresses and any contract are excluded.
 * @returns {Promise<{holders: Array<{address, balance, sinceBlock, lastOutBlock}>, head: bigint}>}
 */
export async function getTokenHolders(token, { minBalance = 0n, exclude = [], startBlock = null } = {}) {
  const sync = await syncHolders(token, startBlock);
  if (!sync.complete) console.log(`   Holder index still catching up (${sync.indexedTo}/${sync.head}); distributing on the indexed snapshot`);

  const excluded = new Set([...PROTOCOL_ADDRESSES, lower(token), ...extraExcluded, ...exclude.map(lower)]);
  for (const p of await tokenPairs(token)) {
    if (p.pairAddress && /^0x[0-9a-fA-F]{40}$/.test(p.pairAddress)) excluded.add(lower(p.pairAddress));
  }

  const min = BigInt(minBalance || 0);
  const { rows } = await pool.query(
    'SELECT address, balance::text AS bal, since_block, last_out_block FROM holder_balances WHERE token = $1 AND balance > 0 ORDER BY balance DESC',
    [lower(token)]
  );
  const candidates = rows.filter((r) => !excluded.has(r.address) && BigInt(r.bal) >= min);
  const flags = await contractFlags(candidates.map((r) => r.address));
  const holders = candidates
    .filter((r) => flags.get(r.address) !== true)
    .map((r) => ({
      address: r.address,
      balance: BigInt(r.bal),
      sinceBlock: r.since_block != null ? BigInt(r.since_block) : null,
      lastOutBlock: r.last_out_block != null ? BigInt(r.last_out_block) : null,
    }));
  console.log(`   ${holders.length} eligible holders (${rows.length} balances indexed, ${rows.length - holders.length} excluded)`);
  return { holders, head: sync.indexedTo };
}

/** Loyalty rules of a config in one readable line (Telegram + logs). */
export function loyaltyLabel(config) {
  if (!config.loyalty_enabled) return 'off (weight = balance)';
  const parts = [`1x to ${(Number(config.loyalty_max_bps || 20000) / 10000).toFixed(1)}x over ${config.loyalty_ramp_days || 30} days`];
  if (Number(config.loyalty_min_hold_hours) > 0) parts.push(`min hold ${config.loyalty_min_hold_hours}h`);
  if (config.loyalty_sell_reset) parts.push('selling resets');
  return parts.join(', ');
}

/**
 * Loyalty weighting: weight = balance x multiplier(holding time). The multiplier
 * ramps linearly from 1x to loyalty_max_bps over loyalty_ramp_days; wallets held
 * for less than loyalty_min_hold_hours are skipped; with loyalty_sell_reset any
 * outgoing transfer restarts the clock. A wallet with no recorded start (indexed
 * from before the ledger began) is treated as fully ramped.
 */
export function applyLoyalty(holders, config, headBlock) {
  if (!config.loyalty_enabled) return holders.map((h) => ({ ...h, weight: h.balance, multiplierBps: 10000, heldBlocks: null }));
  const minHold = BigInt(Math.round(Number(config.loyalty_min_hold_hours || 0) * BLOCKS_PER_HOUR));
  const ramp = BigInt(Math.max(1, Math.round(Number(config.loyalty_ramp_days || 30) * BLOCKS_PER_DAY)));
  const maxBps = Math.max(10000, Number(config.loyalty_max_bps || 20000));
  const head = BigInt(headBlock);
  const out = [];
  let skipped = 0;
  for (const h of holders) {
    let since = h.sinceBlock;
    if (config.loyalty_sell_reset && h.lastOutBlock != null && (since == null || h.lastOutBlock > since)) since = h.lastOutBlock;
    const held = since == null ? ramp : head > since ? head - since : 0n;
    if (held < minHold) { skipped++; continue; }
    const frac = held >= ramp ? 1 : Number(held) / Number(ramp);
    const bps = Math.round(10000 + (maxBps - 10000) * frac);
    out.push({ ...h, weight: (h.balance * BigInt(bps)) / 10000n, multiplierBps: bps, heldBlocks: held });
  }
  if (skipped) console.log(`   Loyalty: ${skipped} wallets below the minimum holding time skipped`);
  return out;
}

export async function holderCount(token) {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM holder_balances WHERE token = $1 AND balance > 0', [lower(token)]);
  return rows[0]?.n || 0;
}
