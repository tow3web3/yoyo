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
    sets.legs_enabled = false; // a simple split replaces the routing canvas
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
           el.swap_tx, el.burn_tx, el.treasury_tx, el.creator_tx, el.legs,
           (SELECT at.tx_hash FROM airdrop_transactions at WHERE at.execution_log_id = el.id AND at.status = 'success' AND at.tx_hash IS NOT NULL LIMIT 1) AS tx_hash
    FROM execution_logs el WHERE el.config_id = ${configId}
    ORDER BY el.execution_time DESC LIMIT ${limit}
  `;
}

// ---------- fee routing legs (the canvas) ----------
const LEG_KINDS = ['holders', 'wallet', 'burn', 'treasury'];
const ADDR = /^0x[0-9a-fA-F]{40}$/;

export async function getLegs(configId) {
  const sql = getSql();
  return await sql`SELECT id, kind, share_bps, address, asset, label, sort_order, pos_x, pos_y FROM policy_legs WHERE config_id = ${configId} ORDER BY sort_order, id`;
}

/** Validate a routing table: kinds, shares summing to 100%, destinations, assets. Returns clean rows. */
export function validateLegs(input) {
  if (!Array.isArray(input) || input.length === 0) throw new Error('Route the fees somewhere: add at least one destination');
  if (input.length > 12) throw new Error('Twelve destinations at most');
  const clean = input.map((l, i) => {
    const kind = String(l.kind || '');
    if (!LEG_KINDS.includes(kind)) throw new Error(`Unknown destination type "${kind}"`);
    const share = Number(l.shareBps ?? l.share_bps);
    if (!Number.isInteger(share) || share < 0 || share > 10000) throw new Error('Shares must be whole basis points between 0 and 10000');
    const address = l.address ? String(l.address) : null;
    if ((kind === 'wallet' || kind === 'treasury') && !(address && ADDR.test(address))) throw new Error(`${l.label || kind} needs a valid destination address`);
    const asset = l.asset ? String(l.asset) : null;
    if (asset && !ADDR.test(asset)) throw new Error('Payout asset must be a token address (or empty for in kind)');
    if (kind === 'burn' && asset) throw new Error('A buyback leg always buys your own token');
    const label = l.label ? String(l.label).slice(0, 40) : null;
    const px = Number.isFinite(Number(l.posX ?? l.pos_x)) ? Math.round(Number(l.posX ?? l.pos_x)) : null;
    const py = Number.isFinite(Number(l.posY ?? l.pos_y)) ? Math.round(Number(l.posY ?? l.pos_y)) : null;
    return { kind, shareBps: share, address: kind === 'wallet' || kind === 'treasury' ? address.toLowerCase() : null, asset: asset ? asset.toLowerCase() : null, label, sortOrder: i, posX: px, posY: py };
  });
  if (clean.filter((l) => l.kind === 'holders').length > 1) throw new Error('One holders leg at most');
  const total = clean.reduce((s, l) => s + l.shareBps, 0);
  if (total !== 10000) throw new Error(`Shares add up to ${(total / 100).toFixed(0)}%, they must total 100%`);
  return clean;
}

/** Replace the routing table atomically and switch the config to routing mode. */
export async function replaceLegs(configId, input) {
  const legs = validateLegs(input);
  const { getPool } = await import('./dbPool');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM policy_legs WHERE config_id = $1', [configId]);
    for (const l of legs) {
      await client.query(
        'INSERT INTO policy_legs (config_id, kind, share_bps, address, asset, label, sort_order, pos_x, pos_y) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [configId, l.kind, l.shareBps, l.address, l.asset, l.label, l.sortOrder, l.posX, l.posY]
      );
    }
    // Mirror the table into the legacy columns so the bot summary and public pages stay right.
    const sum = (k) => legs.filter((l) => l.kind === k).reduce((s, l) => s + l.shareBps, 0);
    const firstWallet = legs.find((l) => l.kind === 'wallet');
    const firstTreasury = legs.find((l) => l.kind === 'treasury');
    await client.query(
      `UPDATE bot_configs SET legs_enabled = true, split_holders_bps = $2, split_creator_bps = $3, split_burn_bps = $4, split_treasury_bps = $5,
         creator_address = COALESCE($6, creator_address), treasury_address = COALESCE($7, treasury_address), treasury_asset = COALESCE($8, treasury_asset),
         destination = CASE WHEN $4 = 10000 THEN 'burn' ELSE 'holders' END, updated_at = NOW() WHERE id = $1`,
      [configId, sum('holders'), sum('wallet'), sum('burn'), sum('treasury'), firstWallet?.address || null, firstTreasury?.address || null, firstTreasury?.asset || null]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return getLegs(configId);
}

/** An active policy on this coin owned by someone else, if any. */
export async function activeConfigForToken(token, exceptUserId = null) {
  const sql = getSql();
  const [row] = await sql`SELECT id, user_id, dev_wallet_public FROM bot_configs WHERE source_token_address = ${lc(token)} AND is_active = true AND user_id <> ${exceptUserId ?? -1} ORDER BY id LIMIT 1`;
  return row || null;
}
