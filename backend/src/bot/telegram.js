import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import * as commands from './commands.js';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || 'missing');

export function initBot() {
  bot.command('start', commands.handleStart);
  bot.command('help', commands.handleHelp);
  bot.command('setup', commands.handleSetupStart);
  bot.command('status', commands.handleStatus);
  bot.command('stocks', commands.handleStocks);
  bot.command('announce', commands.handleAnnounce);

  bot.action('menu', commands.handleMenu);
  bot.action('help', commands.handleHelp);
  bot.action('how', commands.handleHowItWorks);
  bot.action('faq', commands.handleFaq);
  bot.action('stocks', commands.handleStocks);

  // Setup flow
  bot.action('setup', commands.handleSetupStart);
  bot.action('warning_accept', commands.handleWarningAccept);
  bot.action('warning_cancel', commands.handleWarningCancel);
  bot.action(/^source_(wallet|univ3)$/, (ctx) => commands.handleFeeSourceSelection(ctx, ctx.match[1]));
  bot.action(/^reward_(.+)$/, (ctx) => commands.handleRewardSelection(ctx, ctx.match[1]));
  bot.action(/^interval_(\w+)$/, (ctx) => commands.handleIntervalSelection(ctx, ctx.match[1]));
  bot.action('confirm_yes', (ctx) => commands.handleSetupConfirmation(ctx, true));
  bot.action('confirm_no', (ctx) => commands.handleSetupConfirmation(ctx, false));

  // Status and control
  bot.action('status', commands.handleStatus);
  bot.action('runnow', commands.handleRunNow);
  bot.action('pause', commands.handlePause);
  bot.action('resume', commands.handleResume);

  // Settings
  bot.action('settings', commands.handleSettings);
  bot.action('change_interval', commands.handleChangeIntervalPrompt);
  bot.action(/^editint_(\w+)$/, (ctx) => commands.handleEditInterval(ctx, ctx.match[1]));
  bot.action('change_target', commands.handleChangeTargetPrompt);
  bot.action(/^editreward_(.+)$/, (ctx) => commands.handleEditRewardSelection(ctx, ctx.match[1]));
  bot.action('reward_mode', commands.handleRewardModePrompt);
  bot.action(/^mode_(fixed|roulette|gainer|portfolio|vote)$/, (ctx) => commands.handleRewardModeSelection(ctx, ctx.match[1]));
  bot.action(/^basket_(\w+)$/, (ctx) => commands.handleBasketSelection(ctx, ctx.match[1]));
  bot.action('market_hours', commands.handleToggleMarketHours);
  bot.action('loyalty', commands.handleLoyaltyMenu);
  bot.action(/^loy_(toggle|min|ramp|max|reset)$/, (ctx) => commands.handleLoyaltySetting(ctx, ctx.match[1]));
  bot.action('split', commands.handleSplitMenu);
  bot.action(/^split_(\d+-\d+-\d+-\d+)$/, (ctx) => commands.handleSplitPreset(ctx, ctx.match[1]));
  bot.action('creator_address', commands.handleCreatorAddressPrompt);
  bot.action('payout_mode', commands.handleTogglePayoutMode);
  bot.action('treasury_address', commands.handleTreasuryAddressPrompt);
  bot.action('treasury_asset', commands.handleTreasuryAssetPrompt);
  bot.action(/^tasset_(.+)$/, (ctx) => commands.handleTreasuryAssetSelection(ctx, ctx.match[1]));

  // Delete
  bot.action('stop', commands.handleStop);
  bot.action('confirm_delete', commands.handleConfirmDelete);
  bot.action('cancel', commands.handleCancel);

  // Free-text setup input only in private chats; group chatter is ignored.
  bot.on('text', (ctx, next) => (ctx.chat?.type === 'private' ? commands.handleSetupMessage(ctx) : next()));

  bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    try { ctx.reply('Something went wrong. Please try again or send /start.'); } catch { /* ignore */ }
  });

  bot.telegram
    .setMyCommands([
      { command: 'start', description: '🪀 Open the yo-yo menu' },
      { command: 'setup', description: '🚀 Set up your dividends' },
      { command: 'status', description: '📊 View your bot status' },
      { command: 'stocks', description: '📈 The 195 Robinhood Stock Tokens' },
      { command: 'help', description: '❓ How it works and FAQ' },
    ])
    .catch(() => { /* offline or missing token */ });

  console.log('Telegram bot initialized');
  return bot;
}

export async function sendNotification(telegramId, message) {
  try {
    await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'Markdown', disable_web_page_preview: true });
  } catch (error) {
    console.error(`Failed to send notification to ${telegramId}:`, error.message);
  }
}

export default bot;
