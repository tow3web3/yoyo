// The launch feed: when a creator starts a policy for a coin, post it to the
// community group(s) bound with /feed (or COMMUNITY_CHAT_ID), with the whole
// policy spelled out: routing legs and payout assets, reward mode, record date,
// schedule, fee source, dev wallet, links.
import { Markup } from 'telegraf';
import pool from '../db/connection.js';
import bot from '../bot/telegram.js';
import { isNative, short, readTokenMeta, explorerAddress } from '../chain/config.js';
import { getStock, BASKETS } from '../chain/stocks.js';
import { legsFor } from './legs.js';
import { REWARD_MODES } from './rewards.js';
import { scheduleLabel } from './schedule.js';
import { loyaltyLabel } from './holders.js';
import { FEE_SOURCES } from './fees.js';

const FRONTEND = (process.env.WEBSITE_URL || process.env.FRONTEND_URL || 'https://yo-yo.dev').replace(/\/$/, '');
const KEY = 'feed_chats';

// ---------- where the feed goes ----------

export async function feedChats() {
  const r = await pool.query('SELECT value FROM bot_settings WHERE key = $1', [KEY]).catch(() => ({ rows: [] }));
  const list = Array.isArray(r.rows[0]?.value) ? r.rows[0].value : [];
  const env = process.env.COMMUNITY_CHAT_ID;
  if (env && !list.some((c) => String(c.chatId) === String(env))) list.push({ chatId: env, threadId: process.env.COMMUNITY_THREAD_ID || null });
  return list;
}

export async function setFeedChat({ chatId, threadId = null, on = true, title = null }) {
  const r = await pool.query('SELECT value FROM bot_settings WHERE key = $1', [KEY]);
  const list = (Array.isArray(r.rows[0]?.value) ? r.rows[0].value : []).filter((c) => String(c.chatId) !== String(chatId));
  if (on) list.push({ chatId: String(chatId), threadId: threadId ? Number(threadId) : null, title });
  await pool.query(
    'INSERT INTO bot_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()',
    [KEY, JSON.stringify(list)]
  );
  return list;
}

// ---------- the policy, in words ----------

const KIND = { holders: '🎁 Holders', wallet: '👤 Wallet', burn: '🔥 Buyback & burn', treasury: '🏦 Treasury' };
const pct = (bps) => `${(Number(bps) / 100).toFixed(Number(bps) % 100 ? 1 : 0)}%`;

async function assetName(address) {
  if (isNative(address)) return 'ETH';
  const s = getStock(address);
  if (s) return s.ticker;
  const m = await readTokenMeta(address).catch(() => null);
  return m?.symbol ? `$${m.symbol}` : short(address);
}

async function legLine(leg, sourceSymbol) {
  const name = KIND[leg.kind] || leg.kind;
  let payout = '';
  if (leg.kind === 'burn') payout = `buys $${sourceSymbol} and burns it`;
  else if (leg.asset) payout = `paid in ${await assetName(leg.asset)}`;
  else payout = 'paid in kind (stocks stay stocks)';
  const who = leg.kind === 'wallet' || leg.kind === 'treasury' ? (leg.address ? ` \`${short(leg.address)}\`` : ' (address not set)') : '';
  const label = leg.label && !Object.values(KIND).some((k) => k.endsWith(leg.label)) ? ` _${leg.label}_` : '';
  return `  ${name}${label}${who}: *${pct(leg.shareBps)}*, ${payout}`;
}

async function rewardLine(config) {
  const m = REWARD_MODES[config.reward_mode] || REWARD_MODES.fixed;
  if (config.reward_mode === 'portfolio') {
    const b = BASKETS[config.basket] || BASKETS.MAG7;
    return `${m.emoji} ETH fees rotate through *${b.label}* (${b.tickers.join(', ')})`;
  }
  if (config.reward_mode === 'fixed') return `🎯 ETH fees convert to *${await assetName(config.target_token_address)}*`;
  return `${m.emoji} ETH fees: *${m.label}*`;
}

export async function policySummary(config) {
  const meta = await readTokenMeta(config.source_token_address).catch(() => null);
  const symbol = meta?.symbol || short(config.source_token_address);
  const legs = await legsFor(config);
  const legLines = [];
  for (const l of legs) legLines.push(await legLine(l, symbol));
  const fee = FEE_SOURCES[config.fee_source]?.label || config.fee_source || 'wallet';
  const text =
    `🪀 *New policy on yo-yo*\n\n` +
    `*$${symbol}*${meta?.name && meta.name !== symbol ? ` · ${meta.name}` : ''}\n` +
    `CA \`${config.source_token_address}\`\n\n` +
    `🧭 *Routing, every cycle*\n${legLines.join('\n')}\n\n` +
    `${await rewardLine(config)}\n` +
    `🏅 Record date: ${loyaltyLabel(config)}\n` +
    `⏱️ Schedule: ${scheduleLabel(config)}${config.market_hours_only ? ', market hours only' : ''}\n` +
    `💰 Fees from: ${fee}\n` +
    `🔐 Dev wallet: \`${short(config.dev_wallet_public)}\`\n\n` +
    `Holders of $${symbol}: your dividends start at the next cycle. Statement per wallet on the public page.`;
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.url('📊 Public page', `${FRONTEND}/${config.source_token_address}`), Markup.button.url('🔎 Dev wallet', explorerAddress(config.dev_wallet_public))],
    [Markup.button.url('🧭 Start yours', `${FRONTEND}/app`)],
  ]);
  return { text, keyboard, symbol };
}

/** Post the policy to every feed chat. Never throws: the feed must not break setup. */
export async function announcePolicyCreated(configId) {
  try {
    const { rows } = await pool.query('SELECT * FROM bot_configs WHERE id = $1', [Number(configId)]);
    const config = rows[0];
    if (!config) return { ok: false, error: 'Config not found' };
    const chats = await feedChats();
    if (!chats.length) return { ok: true, posted: 0 };
    const { text, keyboard, symbol } = await policySummary(config);
    let posted = 0;
    for (const c of chats) {
      try {
        await bot.telegram.sendMessage(String(c.chatId), text, { parse_mode: 'Markdown', disable_web_page_preview: true, ...keyboard, ...(c.threadId ? { message_thread_id: Number(c.threadId) } : {}) });
        posted++;
      } catch (e) {
        console.error(`   Launch feed failed for chat ${c.chatId}: ${e.message}`);
        if (/chat not found|bot was kicked|bot is not a member|CHAT_WRITE_FORBIDDEN/i.test(e.message)) await setFeedChat({ chatId: c.chatId, on: false }).catch(() => {});
      }
    }
    console.log(`📣 Launch feed: $${symbol} policy ${config.id} posted to ${posted}/${chats.length} chat(s)`);
    return { ok: true, posted };
  } catch (e) {
    console.error('Launch feed failed:', e.message);
    return { ok: false, error: e.message };
  }
}
