// Burn alerts: watch a token for transfers to the burn addresses (0x0 and
// 0xdead) and post a card in every Telegram group that asked for it with
// /burns. Any burn counts, not only the ones yo-yo executes: a manual burn by
// the creator, a launchpad burn, a buyback bot. Total burned = tokens parked at
// the burn addresses plus whatever left the supply since the group was bound.
import { parseAbiItem } from 'viem';
import pool from '../db/connection.js';
import bot from '../bot/telegram.js';
import { publicClient, erc20Abi, ZERO, DEAD, explorerTx, short } from '../chain/config.js';

const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
const POLL_MS = Number(process.env.BURN_WATCH_POLL_MS || 30_000);
const MAX_SPAN = 20_000n; // blocks per getLogs call: the public RPC serves this comfortably
const BURN_ADDRESSES = [ZERO, DEAD];
const lc = (a) => String(a).toLowerCase();

let timer = null;
let running = false;

// ---------- chain reads ----------

async function tokenFacts(token) {
  const client = publicClient();
  const [decimals, symbol, totalSupply, atDead, atZero] = await Promise.all([
    client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }).catch(() => 18),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'symbol' }).catch(() => 'TOKEN'),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'totalSupply' }),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [DEAD] }).catch(() => 0n),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [ZERO] }).catch(() => 0n),
  ]);
  return { decimals: Number(decimals), symbol: String(symbol), totalSupply: BigInt(totalSupply), parked: BigInt(atDead) + BigInt(atZero) };
}

/** Share of the initial supply that is gone: parked at a burn address, or removed from the supply. */
export function burnedShare({ initialSupply, totalSupply, parked }) {
  const initial = BigInt(initialSupply);
  if (initial <= 0n) return 0;
  const gone = parked + (initial > totalSupply ? initial - totalSupply : 0n);
  return Number((gone * 1_000_000n) / initial) / 10_000; // percent with 4 decimals
}

// ---------- bindings ----------

/** Bind a group (and optional topic) to burn alerts for a token. Idempotent. */
export async function enableBurnAlerts({ chatId, threadId, token, enabledBy, chatTitle }) {
  const t = lc(token);
  const facts = await tokenFacts(t);
  const initialSupply = process.env[`BURN_INITIAL_SUPPLY_${t}`] || (facts.totalSupply + facts.parked).toString();
  await pool.query(
    `INSERT INTO burn_alert_chats (chat_id, token, thread_id, initial_supply, decimals, symbol, enabled_by, chat_title)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (chat_id, token) DO UPDATE SET thread_id = EXCLUDED.thread_id, enabled_by = EXCLUDED.enabled_by, chat_title = EXCLUDED.chat_title`,
    [chatId, t, threadId, initialSupply, facts.decimals, facts.symbol, enabledBy, chatTitle || null]
  );
  // Start from the current block: past burns are counted in the total, not re-posted.
  const latest = await publicClient().getBlockNumber();
  await pool.query(`INSERT INTO burn_watch_state (token, last_block) VALUES ($1, $2) ON CONFLICT (token) DO NOTHING`, [t, latest.toString()]);
  return { ...facts, initialSupply: BigInt(initialSupply), burnedPct: burnedShare({ initialSupply, totalSupply: facts.totalSupply, parked: facts.parked }) };
}

export async function disableBurnAlerts({ chatId, token }) {
  const r = token
    ? await pool.query(`DELETE FROM burn_alert_chats WHERE chat_id = $1 AND token = $2`, [chatId, lc(token)])
    : await pool.query(`DELETE FROM burn_alert_chats WHERE chat_id = $1`, [chatId]);
  return r.rowCount;
}

export async function burnAlertsFor(chatId) {
  const r = await pool.query(`SELECT * FROM burn_alert_chats WHERE chat_id = $1 ORDER BY created_at`, [chatId]);
  return r.rows;
}

// ---------- the message ----------

const pct = (n) => `${n.toFixed(2)}%`;
const amount = (raw, decimals) => {
  const n = Number(raw) / 10 ** decimals;
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : n.toFixed(2);
};

export function burnMessage({ burnedPct, txHash, amount, symbol, burnedNowPct }) {
  const nowLine = amount ? `\n\n🪙 Just burned: *${amount} $${symbol || 'TOKEN'}*${burnedNowPct != null ? ` (${pct(burnedNowPct)} of supply)` : ''}` : '';
  return `🔥 *BUY BACK & BURN*${nowLine}\n\n🔥 Total Supply Burned: *${pct(burnedPct)}*\n\n🔗 Transaction: [TX LINK](${explorerTx(txHash)})`;
}

async function postBurn(binding, ev) {
  const extra = { parse_mode: 'Markdown', disable_web_page_preview: true, ...(binding.thread_id ? { message_thread_id: Number(binding.thread_id) } : {}) };
  try {
    await bot.telegram.sendMessage(String(binding.chat_id), burnMessage(ev), extra);
  } catch (e) {
    console.error(`   Burn alert failed for chat ${binding.chat_id}: ${e.message}`);
    // The bot was removed, or the group is gone: stop trying.
    if (/chat not found|bot was kicked|bot is not a member|CHAT_WRITE_FORBIDDEN|group chat was upgraded/i.test(e.message)) {
      await pool.query(`DELETE FROM burn_alert_chats WHERE chat_id = $1`, [binding.chat_id]).catch(() => {});
    }
  }
}

// ---------- the watcher ----------

async function scanToken(token, bindings) {
  const client = publicClient();
  const state = await pool.query(`SELECT last_block FROM burn_watch_state WHERE token = $1`, [token]);
  const latest = await client.getBlockNumber();
  let from = state.rows[0] ? BigInt(state.rows[0].last_block) + 1n : latest;
  if (from > latest) return;
  const to = from + MAX_SPAN - 1n < latest ? from + MAX_SPAN - 1n : latest;

  const logs = await client.getLogs({ address: token, event: TRANSFER, args: { to: BURN_ADDRESSES }, fromBlock: from, toBlock: to });
  for (const log of logs) {
    const value = BigInt(log.args.value || 0n);
    if (value === 0n) continue;
    const key = [log.transactionHash, Number(log.logIndex)];
    const seen = await pool.query(`SELECT 1 FROM burn_events WHERE tx_hash = $1 AND log_index = $2`, key);
    if (seen.rowCount) continue;

    const facts = await tokenFacts(token);
    const initialSupply = bindings[0].initial_supply;
    const burnedPct = burnedShare({ initialSupply, totalSupply: facts.totalSupply, parked: facts.parked });
    await pool.query(
      `INSERT INTO burn_events (tx_hash, log_index, token, block_number, from_addr, amount, burned_pct) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
      [log.transactionHash, Number(log.logIndex), token, log.blockNumber.toString(), lc(log.args.from), value.toString(), burnedPct]
    );
    console.log(`🔥 Burn on ${facts.symbol}: ${amount(value, facts.decimals)} from ${short(log.args.from)} in ${log.transactionHash} (${pct(burnedPct)} of supply gone)`);
    const initial = BigInt(initialSupply);
    const burnedNowPct = initial > 0n ? Number((value * 1_000_000n) / initial) / 10_000 : null;
    for (const b of bindings) await postBurn(b, { burnedPct, txHash: log.transactionHash, amount: amount(value, facts.decimals), symbol: facts.symbol, burnedNowPct, from: log.args.from });
  }
  await pool.query(`INSERT INTO burn_watch_state (token, last_block) VALUES ($1, $2) ON CONFLICT (token) DO UPDATE SET last_block = EXCLUDED.last_block`, [token, to.toString()]);
}

export async function scanOnce() {
  if (running) return;
  running = true;
  try {
    const r = await pool.query(`SELECT * FROM burn_alert_chats ORDER BY token, created_at`);
    const byToken = new Map();
    for (const row of r.rows) (byToken.get(row.token) || byToken.set(row.token, []).get(row.token)).push(row);
    for (const [token, bindings] of byToken) {
      try { await scanToken(token, bindings); } catch (e) { console.error(`   Burn watch ${short(token)}: ${e.message}`); }
    }
  } finally {
    running = false;
  }
}

export function startBurnWatch() {
  if (timer) return;
  timer = setInterval(() => scanOnce().catch((e) => console.error('Burn watch tick failed:', e.message)), POLL_MS);
  scanOnce().catch((e) => console.error('Burn watch first scan failed:', e.message));
  console.log(`Burn watch started (every ${POLL_MS / 1000}s)`);
}
