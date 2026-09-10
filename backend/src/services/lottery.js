// The holders lottery: every 24 hours one wallet that held at least
// LOTTERY_MIN_HOLD of the project token for LOTTERY_MIN_HOURS wins
// LOTTERY_PRIZE_BPS of the creator fees routed during the round. Entering is
// done on the site (signed in with the wallet); the draw runs here. Selling
// after entering disqualifies: the holder ledger's last outgoing transfer is
// checked at draw time, and so is the live balance.
import crypto from 'crypto';
import pool from '../db/connection.js';
import bot from '../bot/telegram.js';
import * as db from '../db/queries.js';
import { publicClient, erc20Abi, isAddress, short, formatEth, explorerTx, explorerAddress } from '../chain/config.js';
import { decryptPrivateKey } from './encryption.js';
import { sendAsset } from './treasury.js';

export const LOTTERY_TOKEN = isAddress(process.env.LOTTERY_TOKEN_ADDRESS || process.env.BOOMERANG_TOKEN_ADDRESS || '') ? (process.env.LOTTERY_TOKEN_ADDRESS || process.env.BOOMERANG_TOKEN_ADDRESS).toLowerCase() : null;
export const MIN_HOLD = Number(process.env.LOTTERY_MIN_HOLD || 1_000_000);
export const MIN_HOURS = Number(process.env.LOTTERY_MIN_HOURS || 2);
export const PRIZE_BPS = Number(process.env.LOTTERY_PRIZE_BPS || 50); // 0.5% of the round's creator fees
export const ROUND_HOURS = Number(process.env.LOTTERY_ROUND_HOURS || 24);
const FRONTEND = (process.env.WEBSITE_URL || process.env.FRONTEND_URL || 'https://yo-yo.dev').replace(/\/$/, '');

let ticking = false;

async function configForToken(token) {
  return db.getBotConfigBySourceToken(token);
}

/** One open round at a time per token. */
export async function ensureOpenRound(token = LOTTERY_TOKEN) {
  if (!token) return null;
  const { rows } = await pool.query(`SELECT * FROM lottery_rounds WHERE token = $1 AND status = 'open' ORDER BY id DESC LIMIT 1`, [token]);
  if (rows[0]) return rows[0];
  const config = await configForToken(token);
  if (!config) return null;
  // Whatever an empty or void round left behind rolls into this one.
  const carry = await pool.query(`SELECT COALESCE(SUM(prize_wei), 0)::text AS c FROM lottery_rounds WHERE token = $1 AND status = 'void' AND rolled = false`, [token]);
  const created = await pool.query(
    `INSERT INTO lottery_rounds (token, config_id, opens_at, draws_at, status, carry_wei, min_hold, min_hours, prize_bps)
     VALUES ($1, $2, NOW(), NOW() + ($3 || ' hours')::interval, 'open', $4, $5, $6, $7) RETURNING *`,
    [token, config.id, String(ROUND_HOURS), carry.rows[0].c, MIN_HOLD, MIN_HOURS, PRIZE_BPS]
  );
  await pool.query(`UPDATE lottery_rounds SET rolled = true WHERE token = $1 AND status = 'void' AND rolled = false`, [token]);
  console.log(`🎟️ Lottery round ${created.rows[0].id} open for ${short(token)}, draws at ${new Date(created.rows[0].draws_at).toISOString()}`);
  return created.rows[0];
}

/** Fees claimed by the policy during the round, in wei. */
async function roundFeesWei(round) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(claimed_eth_wei), 0)::text AS f FROM execution_logs WHERE config_id = $1 AND status = 'success' AND execution_time >= $2 AND execution_time < $3`,
    [round.config_id, round.opens_at, round.draws_at]
  );
  return BigInt(rows[0].f);
}

export async function prizeSoFar(round) {
  const fees = await roundFeesWei({ ...round, draws_at: new Date() });
  return (fees * BigInt(round.prize_bps || PRIZE_BPS)) / 10000n + BigInt(round.carry_wei || 0);
}

async function stillEligible(round, entry, decimals) {
  const client = publicClient();
  const raw = await client.readContract({ address: round.token, abi: erc20Abi, functionName: 'balanceOf', args: [entry.wallet] }).catch(() => null);
  if (raw == null) return { ok: false, reason: 'balance unreadable' };
  const balance = Number(raw) / 10 ** decimals;
  if (balance < Number(round.min_hold)) return { ok: false, reason: `holds ${Math.floor(balance).toLocaleString()} now, below ${Number(round.min_hold).toLocaleString()}` };
  if (BigInt(raw) < BigInt(entry.balance_at_entry)) return { ok: false, reason: 'sold since entering' };
  const { rows } = await pool.query(`SELECT last_out_block FROM holder_balances WHERE token = $1 AND address = $2`, [round.token, entry.wallet]);
  const lastOut = rows[0]?.last_out_block != null ? BigInt(rows[0].last_out_block) : null;
  if (lastOut != null && lastOut > BigInt(entry.entered_block || 0)) return { ok: false, reason: 'sent tokens out since entering' };
  return { ok: true };
}

async function announce(config, text, extra = {}) {
  if (!config?.announce_chat_id) return;
  try {
    await bot.telegram.sendMessage(String(config.announce_chat_id), text, { parse_mode: 'Markdown', disable_web_page_preview: true, ...(config.announce_thread_id ? { message_thread_id: Number(config.announce_thread_id) } : {}), ...extra });
  } catch (e) {
    console.error(`   Lottery announcement failed: ${e.message}`);
  }
}

/** Try to pay a won round from the dev wallet now. Returns the tx hash or null (paid later, at the next cycle). */
export async function payRound(round, config, { privateKey = null, gasReserveWei = null } = {}) {
  const prize = BigInt(round.prize_wei || 0);
  if (prize <= 0n || !round.winner) return null;
  const key = privateKey || decryptPrivateKey(config.dev_wallet_encrypted);
  const client = publicClient();
  const { address } = (await import('../chain/config.js')).accountFromKey(key);
  const balance = await client.getBalance({ address });
  const reserve = BigInt(gasReserveWei ?? config.gas_reserve_wei ?? 2_000_000_000_000_000n);
  if (balance - reserve < prize) return null;
  const hash = await sendAsset({ privateKey: key, asset: { isNative: true }, amount: prize, to: round.winner, label: `lottery prize round ${round.id}` });
  await pool.query(`UPDATE lottery_rounds SET status = 'paid', tx_hash = $2, paid_at = NOW() WHERE id = $1`, [round.id, hash]);
  console.log(`🎟️ Lottery round ${round.id} paid: ${formatEth(prize, 5)} ETH to ${short(round.winner)} (${hash})`);
  await announce(config, `💸 *Lottery prize paid*\n\n\`${round.winner}\` received *${formatEth(prize, 5)} ETH*.\n🔗 [Transaction](${explorerTx(hash)})`);
  return hash;
}

/** Called by the executor before routing: pays any pending prize for this policy out of the fees just collected. */
export async function settleLotteryPayouts({ config, privateKey, assets }) {
  const { rows } = await pool.query(`SELECT * FROM lottery_rounds WHERE config_id = $1 AND status = 'won' ORDER BY id`, [config.id]);
  for (const round of rows) {
    const native = assets.find((a) => a.isNative);
    const prize = BigInt(round.prize_wei || 0);
    if (!native || native.amount < prize) { console.log(`   Lottery round ${round.id}: prize ${formatEth(prize, 5)} ETH still pending, not enough ETH this cycle`); continue; }
    const hash = await payRound(round, config, { privateKey, gasReserveWei: 0n });
    if (hash) native.amount -= prize;
  }
}

export async function drawRound(round) {
  const config = await pool.query('SELECT * FROM bot_configs WHERE id = $1', [round.config_id]).then((r) => r.rows[0]);
  if (!config) { await pool.query(`UPDATE lottery_rounds SET status = 'void', drawn_at = NOW() WHERE id = $1`, [round.id]); return; }
  const decimals = Number(await publicClient().readContract({ address: round.token, abi: erc20Abi, functionName: 'decimals' }).catch(() => 18));
  const symbol = String(await publicClient().readContract({ address: round.token, abi: erc20Abi, functionName: 'symbol' }).catch(() => 'TOKEN'));
  const fees = await roundFeesWei(round);
  const prize = (fees * BigInt(round.prize_bps || PRIZE_BPS)) / 10000n + BigInt(round.carry_wei || 0);
  const { rows: entries } = await pool.query(`SELECT * FROM lottery_entries WHERE round_id = $1 AND disqualified_at IS NULL ORDER BY entered_at`, [round.id]);

  const eligible = [];
  for (const e of entries) {
    const r = await stillEligible(round, e, decimals);
    if (r.ok) eligible.push(e);
    else await pool.query(`UPDATE lottery_entries SET disqualified_at = NOW(), reason = $3 WHERE round_id = $1 AND wallet = $2`, [round.id, e.wallet, r.reason]);
  }
  console.log(`🎟️ Lottery round ${round.id}: ${entries.length} entries, ${eligible.length} eligible, prize ${formatEth(prize, 5)} ETH`);

  if (!eligible.length || prize <= 0n) {
    await pool.query(`UPDATE lottery_rounds SET status = 'void', prize_wei = $2, entries_count = $3, eligible_count = $4, drawn_at = NOW() WHERE id = $1`, [round.id, prize.toString(), entries.length, eligible.length]);
    await announce(config, `🎟️ *$${symbol} holders lottery*\n\n${!eligible.length ? 'No eligible entry this round.' : 'No creator fees this round.'} The prize of *${formatEth(prize, 5)} ETH* rolls into the next draw.\n\nHold ${Number(round.min_hold).toLocaleString()}+ $${symbol} for ${round.min_hours}h and enter at ${FRONTEND}/lottery`);
    return;
  }

  const winner = eligible[crypto.randomInt(eligible.length)].wallet;
  await pool.query(`UPDATE lottery_rounds SET status = 'won', winner = $2, prize_wei = $3, entries_count = $4, eligible_count = $5, drawn_at = NOW() WHERE id = $1`, [round.id, winner, prize.toString(), entries.length, eligible.length]);
  const won = { ...round, winner, prize_wei: prize.toString() };
  await announce(config,
    `🎟️ *$${symbol} holders lottery: we have a winner*\n\n` +
    `🏆 [${short(winner)}](${explorerAddress(winner)})\n` +
    `💰 *${formatEth(prize, 5)} ETH*, ${(Number(round.prize_bps || PRIZE_BPS) / 100).toFixed(1)}% of the creator fees of the last ${round.round_hours || ROUND_HOURS}h\n` +
    `🎫 ${eligible.length} eligible ${eligible.length === 1 ? 'wallet' : 'wallets'}, one ticket each\n\n` +
    `Next draw in ${ROUND_HOURS}h. Hold ${Number(round.min_hold).toLocaleString()}+ $${symbol} for ${round.min_hours}h and enter at ${FRONTEND}/lottery. Selling after entering disqualifies.`
  );
  const hash = await payRound(won, config).catch((e) => { console.error(`   Lottery payout failed: ${e.message}`); return null; });
  if (!hash) console.log(`   Lottery round ${round.id}: prize paid at the next cycle`);
}

/** Cron tick: open a round if none, draw the ones that are due, retry pending payouts. */
export async function tickLottery() {
  if (!LOTTERY_TOKEN || ticking) return;
  ticking = true;
  try {
    const { rows: due } = await pool.query(`SELECT * FROM lottery_rounds WHERE status = 'open' AND draws_at <= NOW()`);
    for (const r of due) {
      try { await drawRound(r); } catch (e) { console.error(`Lottery draw ${r.id} failed:`, e.message); }
    }
    await ensureOpenRound();
  } finally {
    ticking = false;
  }
}
