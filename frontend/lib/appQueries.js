// Read/write queries for the web dashboard. Writes go to the same tables the
// bot uses; the backend scheduler is told to reschedule through lib/internal.js.
import crypto from 'crypto';
import { getSql } from './db';

const lc = (a) => (a ? String(a).toLowerCase() : null);

export async function issueNonce() {
  const sql = getSql();
  const nonce = crypto.randomBytes(16).toString('hex');
  await sql`INSERT INTO login_nonces (nonce) VALUES (${nonce})`;
  await sql`DELETE FROM login_nonces WHERE created_at < NOW() - INTERVAL '15 minutes'`;
  return nonce;
}

/** Consume a nonce; returns false if unknown or already used. */
export async function consumeNonce(nonce) {
  const sql = getSql();
  const rows = await sql`DELETE FROM login_nonces WHERE nonce = ${nonce} AND created_at > NOW() - INTERVAL '15 minutes' RETURNING nonce`;
  return rows.length === 1;
}

export async function getOrCreateUserByWallet(wallet) {
  const sql = getSql();
  const w = lc(wallet);
  const [existing] = await sql`SELECT * FROM users WHERE wallet_address = ${w}`;
  if (existing) {
    await sql`UPDATE users SET last_seen = NOW() WHERE id = ${existing.id}`;
    return existing;
  }
  const [created] = await sql`INSERT INTO users (wallet_address, last_seen) VALUES (${w}, NOW()) RETURNING *`;
  return created;
}

export async function setLinkCode(userId) {
  const sql = getSql();
  const code = crypto.randomBytes(6).toString('base64url').replace(/[-_]/g, 'x').slice(0, 10);
  await sql`UPDATE users SET link_code = ${code} WHERE id = ${userId}`;
  return code;
}

export async function getConfigForUser(userId) {
  const sql = getSql();
  const [config] = await sql`SELECT * FROM bot_configs WHERE user_id = ${userId} ORDER BY id DESC LIMIT 1`;
  return config || null;
}

export async function createConfig(userId, c) {
  const sql = getSql();
  const [row] = await sql`
    INSERT INTO bot_configs (
      user_id, dev_wallet_encrypted, dev_wallet_public, source_token_address, target_token_address,
      fee_source, univ3_position_ids, reward_mode, basket, schedule_kind, interval_minutes, market_hours_only,
      split_holders_bps, split_creator_bps, split_burn_bps, split_treasury_bps, creator_address, treasury_address, payout_mode,
      loyalty_enabled, loyalty_min_hold_hours, loyalty_ramp_days, loyalty_max_bps, loyalty_sell_reset
    ) VALUES (
      ${userId}, ${JSON.stringify(c.devWalletEncrypted)}, ${lc(c.devWalletPublic)}, ${lc(c.sourceToken)}, ${lc(c.targetToken)},
      ${c.feeSource || 'wallet'}, ${'[]'}, ${c.rewardMode || 'fixed'}, ${c.basket || null}, ${c.scheduleKind || 'interval'}, ${c.intervalMinutes || 5}, ${Boolean(c.marketHoursOnly)},
      ${c.split.holders}, ${c.split.creator}, ${c.split.burn}, ${c.split.treasury}, ${lc(c.creatorAddress)}, ${lc(c.treasuryAddress)}, ${c.payoutMode || 'in_kind'},
      ${Boolean(c.loyalty?.enabled)}, ${c.loyalty?.minHoldHours ?? 0}, ${c.loyalty?.rampDays ?? 30}, ${c.loyalty?.maxBps ?? 20000}, ${c.loyalty?.sellReset ?? true}
    ) RETURNING *
  `;
  return row;
}

// Columns the dashboard may change, with validators.
const EDITABLE = {
  target_token_address: (v) => (/^0x[0-9a-fA-F]{40}$/.test(v) ? v.toLowerCase() : undefined),
  reward_mode: (v) => (['fixed', 'roulette', 'gainer', 'portfolio', 'vote'].includes(v) ? v : undefined),
  basket: (v) => (v == null ? null : ['MAG7', 'AI', 'DEGEN', 'HAVEN'].includes(v) ? v : undefined),
  schedule_kind: (v) => (['interval', 'closing_bell', 'opening_bell'].includes(v) ? v : undefined),
  interval_minutes: (v) => ([1, 2, 5, 10, 30, 60, 1440].includes(Number(v)) ? Number(v) : undefined),
  market_hours_only: (v) => Boolean(v),
  is_active: (v) => Boolean(v),
  split_holders_bps: (v) => bps(v),
  split_creator_bps: (v) => bps(v),
  split_burn_bps: (v) => bps(v),
  split_treasury_bps: (v) => bps(v),
  creator_address: (v) => addrOrNull(v),
  treasury_address: (v) => addrOrNull(v),
  treasury_asset: (v) => addrOrNull(v),
  payout_mode: (v) => (['in_kind', 'convert'].includes(v) ? v : undefined),
  loyalty_enabled: (v) => Boolean(v),
  loyalty_min_hold_hours: (v) => (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 720 ? Number(v) : undefined),
  loyalty_ramp_days: (v) => (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 365 ? Number(v) : undefined),
  loyalty_max_bps: (v) => (Number.isInteger(Number(v)) && Number(v) >= 10000 && Number(v) <= 50000 ? Number(v) : undefined),
  loyalty_sell_reset: (v) => Boolean(v),
  fee_source: (v) => (['wallet', 'univ3'].includes(v) ? v : undefined),
  announce_chat_id: (v) => (v == null ? null : undefined),
};
const bps = (v) => (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 10000 ? Number(v) : undefined);
const addrOrNull = (v) => (v == null || v === '' ? null : /^0x[0-9a-fA-F]{40}$/.test(v) ? v.toLowerCase() : undefined);

/** Apply a validated partial update. Splits must sum to 10000 when any split field is present. */
export async function updateConfig(configId, patch) {
  const sql = getSql();
  const sets = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (!(k in EDITABLE)) continue;
    const clean = EDITABLE[k](v);
    if (clean === undefined) throw new Error(`Invalid value for ${k}`);
    sets[k] = clean;
  }
  const splitKeys = ['split_holders_bps', 'split_creator_bps', 'split_burn_bps', 'split_treasury_bps'];
  if (splitKeys.some((k) => k in sets)) {
    const [cur] = await sql`SELECT split_holders_bps, split_creator_bps, split_burn_bps, split_treasury_bps FROM bot_configs WHERE id = ${configId}`;
    const total = splitKeys.reduce((s, k) => s + Number(k in sets ? sets[k] : cur[k]), 0);
    if (total !== 10000) throw new Error('The policy must add up to 100%');
    sets.destination = sets.split_burn_bps === 10000 ? 'burn' : 'holders';
  }
  if (!Object.keys(sets).length) throw new Error('Nothing to update');
  const cols = Object.keys(sets);
  // Build a parameterised UPDATE by hand (column names are from the whitelist above).
  const text = `UPDATE bot_configs SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_at = NOW() WHERE id = $${cols.length + 1} RETURNING *`;
  const rows = await rawQuery(text, [...cols.map((c) => sets[c]), configId]);
  return rows[0];
}

// The tagged-template helper cannot take dynamic column lists; use the pool directly.
async function rawQuery(text, values) {
  const { getPool } = await import('./dbPool');
  const { rows } = await getPool().query(text, values);
  return rows;
}

export async function deleteConfig(configId) {
  const sql = getSql();
  await sql`DELETE FROM bot_configs WHERE id = ${configId}`;
}

export async function recentLogsForConfig(configId, limit = 12) {
  const sql = getSql();
  return await sql`
    SELECT el.id, el.cycle_key, el.status, el.error_message, el.execution_time, el.holder_count,
           el.claimed_eth_wei::text AS claimed_eth_wei, el.total_airdropped::text AS total_airdropped,
           el.reward_token_used, el.asset_token, el.asset_amount::text AS asset_amount,
           el.creator_amount::text AS creator_amount, el.burn_amount::text AS burn_amount, el.treasury_amount::text AS treasury_amount, el.treasury_token,
           el.swap_tx, el.burn_tx, el.treasury_tx, el.creator_tx,
           (SELECT at.tx_hash FROM airdrop_transactions at WHERE at.execution_log_id = el.id AND at.status = 'success' AND at.tx_hash IS NOT NULL LIMIT 1) AS tx_hash
    FROM execution_logs el WHERE el.config_id = ${configId}
    ORDER BY el.execution_time DESC LIMIT ${limit}
  `;
}
