// Receipts: after a dividend, post a card into the creator's Telegram group
// (bound with /announce) with a Share-on-X button. The card image is rendered
// by the site (/api/card/receipt/:id); the X share goes through the receipt
// page, whose OG image is that same card.
import { Markup } from 'telegraf';
import bot from '../bot/telegram.js';
import { formatEth, formatUnits } from '../chain/config.js';
import { scheduleLabel } from './schedule.js';

const FRONTEND = process.env.FRONTEND_URL || process.env.WEBSITE_URL || 'https://yo-yo.dev';
const X_HANDLE = process.env.X_HANDLE || 'Boomerang_tek';

export function receiptUrl(logId) {
  return `${FRONTEND}/receipt/${logId}`;
}

export function shareOnXUrl({ sourceSymbol, amountLabel, rewardSymbol, holders, logId }) {
  const text = `$${sourceSymbol} just paid its holders ${amountLabel} ${rewardSymbol} 📈\n${holders} wallets, pro-rata, on Robinhood Chain.\nDividends by @${X_HANDLE}`;
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(receiptUrl(logId))}`;
}

async function fetchCard(logId) {
  const res = await fetch(`${FRONTEND}/api/card/receipt/${logId}`, { signal: AbortSignal.timeout(20_000) });
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
    await bot.telegram.sendPhoto(config.announce_chat_id, { source: card, filename: `boomerang-dividend-${log.id}.png` }, extra);
  } catch (e) {
    console.log(`   Receipt card unavailable (${e.message}), posting text`);
    try {
      await bot.telegram.sendMessage(config.announce_chat_id, caption, { parse_mode: 'Markdown', ...keyboard, ...(config.announce_thread_id ? { message_thread_id: config.announce_thread_id } : {}) });
    } catch (e2) {
      console.error(`   Announcement failed for chat ${config.announce_chat_id}: ${e2.message}`);
    }
  }
}
