// Receipts: after a dividend, post a card into the creator's Telegram group
// (bound with /announce) with a Share-on-X button. The card image is rendered
// by the site (/api/card/receipt/:id); the X share goes through the receipt
// page, whose OG image is that same card.
import { Markup } from 'telegraf';
import bot from '../bot/telegram.js';
import { formatEth, formatUnits } from '../chain/config.js';
import { scheduleLabel } from './schedule.js';
import { explorerTx, explorerAddress, short, isNative } from '../chain/config.js';
import { openRoundFor, prizeSoFar } from './lottery.js';

const FRONTEND = process.env.FRONTEND_URL || process.env.WEBSITE_URL || 'https://yo-yo.dev';
// Receipt cards are rendered by the web app; CARD_BASE_URL lets the bot fetch them from the VM host while links point at the public domain.
const CARD_BASE = String(process.env.CARD_BASE_URL || FRONTEND).replace(/[/]+$/, '');
const X_HANDLE = process.env.X_HANDLE || 'yo_yo_tech';

export function receiptUrl(logId) {
  return `${FRONTEND}/receipt/${logId}`;
}

export function shareOnXUrl({ sourceSymbol, amountLabel, rewardSymbol, holders, logId }) {
  const text = `$${sourceSymbol} just paid its holders ${amountLabel} ${rewardSymbol} 📈\n${holders} wallets, pro-rata, on Robinhood Chain.\nDividends by @${X_HANDLE}`;
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(receiptUrl(logId))}`;
}

async function fetchCard(logId) {
  const res = await fetch(`${CARD_BASE}/api/card/receipt/${logId}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`card ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Announce a paid dividend in the creator's group. Never throws: a failed
 * announcement must not mark the cycle as failed.
 */
export async function announceDividend({ config, log, reward, sourceSymbol, results, feesLabel, holdersTotal }) {
  if (!config.announce_chat_id) return;
  const amountLabel = formatUnits(results.totalSent, reward.decimals, 4);
  const caption =
    `🎁 *Dividend paid to $${sourceSymbol} holders*\n\n` +
    `📈 ${amountLabel} ${reward.symbol}${reward.note ? ` (${reward.note})` : ''}\n` +
    `💰 From ${feesLabel}\n` +
    `👥 ${results.successful.length}/${holdersTotal} wallets, pro-rata${config.loyalty_enabled ? ', loyalty-weighted' : ''}\n` +
    `⏰ Next dividend ${scheduleLabel(config)}`;
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.url('𝕏 Share', shareOnXUrl({ sourceSymbol, amountLabel, rewardSymbol: reward.symbol, holders: results.successful.length, logId: log.id }))],
    [Markup.button.url('🧾 Receipt', receiptUrl(log.id)), Markup.button.url('📊 Dashboard', `${FRONTEND}/${config.source_token_address}`)],
  ]);
  const extra = { caption, parse_mode: 'Markdown', ...keyboard };
  if (config.announce_thread_id) extra.message_thread_id = config.announce_thread_id;
  try {
    const card = await fetchCard(log.id);
    await bot.telegram.sendPhoto(config.announce_chat_id, { source: card, filename: `yo-yo-dividend-${log.id}.png` }, extra);
  } catch (e) {
    console.log(`   Receipt card unavailable (${e.message}), posting text`);
    try {
      await bot.telegram.sendMessage(config.announce_chat_id, caption, { parse_mode: 'Markdown', ...keyboard, ...(config.announce_thread_id ? { message_thread_id: config.announce_thread_id } : {}) });
    } catch (e2) {
      console.error(`   Announcement failed for chat ${config.announce_chat_id}: ${e2.message}`);
    }
  }
}

// ---------------------------------------------------------------- cycle report
const KIND_EMOJI = { holders: '🎁', wallet: '👤', burn: '🔥', treasury: '🏦' };
const pctOf = (bps) => `${(Number(bps) / 100).toFixed(Number(bps) % 100 ? 1 : 0)}%`;
const num = (raw, decimals = 18, digits = 4) => {
  const n = Number(raw || 0) / 10 ** Number(decimals ?? 18);
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return n.toFixed(n >= 1 ? 2 : digits);
};
const sym = (s) => (s && s !== 'ETH' && !/^[A-Z]{1,6}$/.test(s) ? `$${s}` : s || '');
const tx = (label, hash) => (hash ? `[${label}](${explorerTx(hash)})` : null);

/**
 * Everything one cycle did, in one Telegram message: fees in, every leg with its
 * amounts and transactions, the holders payout with its receipt, the lottery pool.
 */
export async function cycleReport({ config, log, asset, legs, legResults, holdersAmount, holdersTotal, results, reward, sourceSymbol }) {
  const when = new Date(log.execution_time || Date.now()).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
  const lines = [`🪀 *$${sourceSymbol} cycle report* · ${when} ET`, `💰 In: *${num(asset.amount, asset.decimals)} ${sym(asset.symbol)}* from the dev wallet${asset.isNative ? '' : ` (~${num(asset.valueWei)} ETH)`}`, ''];
  const byId = new Map(legResults.map((r) => [r.legId, r]));
  for (const leg of legs) {
    const share = pctOf(leg.shareBps);
    if (leg.kind === 'holders') {
      const paid = results ? results.successful.length : 0;
      const bought = log.bought_token_amount || log.boughtTokenAmount;
      const parts = [`${num(holdersAmount, asset.decimals)} ${sym(asset.symbol)}`];
      if (bought && bought !== '0' && reward && !reward.isNative) parts.push(`→ ${num(bought, reward.decimals)} ${sym(reward.symbol)}`);
      if (results) parts.push(`to *${paid}/${holdersTotal} wallets*${config.loyalty_enabled ? ', loyalty-weighted' : ''}`);
      else parts.push('carried to the next cycle');
      const links = [tx('buy', log.swap_tx || log.swapTx), log.id ? `[receipt](${receiptUrl(log.id)})` : null].filter(Boolean);
      lines.push(`${KIND_EMOJI.holders} *Holders* ${share}: ${parts.join(' ')}${links.length ? ' · ' + links.join(' · ') : ''}${results?.failed?.length ? ` · ⚠️ ${results.failed.length} transfers failed` : ''}`);
      continue;
    }
    const r = byId.get(leg.id) || legResults.find((x) => x.kind === leg.kind && x.label === leg.label);
    const name = leg.label || leg.kind;
    if (!r) { lines.push(`${KIND_EMOJI[leg.kind] || '•'} *${name}* ${share}: nothing this cycle`); continue; }
    if (r.failed) { lines.push(`${KIND_EMOJI[leg.kind] || '•'} *${name}* ${share}: ⚠️ ${r.failed}, share paid to holders instead`); continue; }
    const inAmt = `${num(r.input?.amount, asset.decimals)} ${sym(r.input?.symbol)}`;
    const out = r.output ? `${num(r.output.amount, r.output.decimals)} ${sym(r.output.symbol)}` : '';
    const dest = leg.kind === 'burn' ? 'burned' : leg.kind === 'treasury' ? `to the treasury [${short(leg.address)}](${explorerAddress(leg.address)})` : `to [${short(leg.address)}](${explorerAddress(leg.address)})`;
    const links = [tx('buy', r.swapTx), tx(leg.kind === 'burn' ? 'burn' : 'tx', r.tx)].filter(Boolean);
    lines.push(`${KIND_EMOJI[leg.kind] || '•'} *${name}* ${share}: ${inAmt}${out && out !== inAmt ? ` → ${out}` : ''} ${dest}${links.length ? ' · ' + links.join(' · ') : ''}${r.note ? ` (${r.note})` : ''}`);
  }
  try {
    const round = await openRoundFor(config.id);
    if (round) {
      const pool = await prizeSoFar(round);
      const add = (BigInt(asset.valueWei || 0) * BigInt(round.prize_bps || 50)) / 10000n;
      const hrs = Math.max(0, (new Date(round.draws_at).getTime() - Date.now()) / 3.6e6);
      lines.push('', `🎟️ Lottery pool: +${formatEth(add, 5)} ETH this cycle, *${formatEth(pool, 5)} ETH* so far, draw in ${hrs >= 1 ? `${Math.round(hrs)}h` : `${Math.round(hrs * 60)} min`}`);
    }
  } catch { /* the report is fine without it */ }
  if (log.error_message || log.errorMessage) lines.push(`ℹ️ ${log.error_message || log.errorMessage}`);
  lines.push(`⏱ Next cycle ${scheduleLabel(config)}`);
  return lines.join('\n');
}

/** Post the cycle report to the creator's group: the receipt card as picture when holders were paid, the report as its caption. */
export async function announceCycle(args) {
  const { config, log, sourceSymbol, results, reward } = args;
  if (!config.announce_chat_id) return;
  let text;
  try { text = await cycleReport(args); } catch (e) { console.error(`   Cycle report failed to render: ${e.message}`); return; }
  const buttons = [];
  if (results?.successful?.length && reward) {
    buttons.push([Markup.button.url('𝕏 Share', shareOnXUrl({ sourceSymbol, amountLabel: formatUnits(results.totalSent, reward.decimals, 4), rewardSymbol: reward.symbol, holders: results.successful.length, logId: log.id }))]);
  }
  buttons.push([Markup.button.url('🧾 Receipt', receiptUrl(log.id)), Markup.button.url('📊 Public page', `${FRONTEND}/${config.source_token_address}`)]);
  const keyboard = Markup.inlineKeyboard(buttons);
  const thread = config.announce_thread_id ? { message_thread_id: config.announce_thread_id } : {};
  const sendText = () => bot.telegram.sendMessage(config.announce_chat_id, text, { parse_mode: 'Markdown', disable_web_page_preview: true, ...keyboard, ...thread });
  try {
    if (results?.successful?.length && text.length <= 1000) {
      const card = await fetchCard(log.id);
      await bot.telegram.sendPhoto(config.announce_chat_id, { source: card, filename: `yo-yo-dividend-${log.id}.png` }, { caption: text, parse_mode: 'Markdown', ...keyboard, ...thread });
    } else if (results?.successful?.length) {
      const card = await fetchCard(log.id).catch(() => null);
      if (card) await bot.telegram.sendPhoto(config.announce_chat_id, { source: card, filename: `yo-yo-dividend-${log.id}.png` }, thread).catch(() => {});
      await sendText();
    } else {
      await sendText();
    }
  } catch (e) {
    console.log(`   Cycle report with card failed (${e.message}), posting text`);
    try { await sendText(); } catch (e2) { console.error(`   Cycle report failed for chat ${config.announce_chat_id}: ${e2.message}`); }
  }
}
