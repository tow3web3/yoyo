import { Markup } from 'telegraf';
import { FEATURED_TICKERS, BASKETS, BASKET_KEYS } from '../chain/stocks.js';
import { INTERVAL_OPTIONS } from '../services/schedule.js';

const WEBSITE = process.env.WEBSITE_URL || process.env.FRONTEND_URL || 'https://yo-yo.dev';

export function welcomeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🚀 Set up yo-yo', 'setup')],
    [Markup.button.callback('📖 How it works', 'how'), Markup.button.callback('📈 Stocks', 'stocks')],
    [Markup.button.callback('❓ FAQ', 'faq'), Markup.button.url('🌐 Website', WEBSITE)],
  ]);
}

export function dashboardKeyboard(config) {
  const toggle = config.is_active ? Markup.button.callback('⏸️ Pause', 'pause') : Markup.button.callback('▶️ Resume', 'resume');
  return Markup.inlineKeyboard([
    [Markup.button.callback('📊 Status', 'status'), Markup.button.callback('⚡ Run now', 'runnow')],
    [Markup.button.callback('⚙️ Settings', 'settings'), toggle],
    [Markup.button.callback('❓ Help', 'help')],
  ]);
}

export function settingsKeyboard(config) {
  const toggle = config.is_active ? Markup.button.callback('⏸️ Pause bot', 'pause') : Markup.button.callback('▶️ Resume bot', 'resume');
  const hours = config.market_hours_only
    ? Markup.button.callback('🕰️ Market hours only: ON', 'market_hours')
    : Markup.button.callback('🕰️ Market hours only: off', 'market_hours');
  return Markup.inlineKeyboard([
    [Markup.button.callback('📈 Change reward', 'change_target')],
    [Markup.button.callback('🎛️ Reward mode', 'reward_mode')],
    [Markup.button.callback(config.loyalty_enabled ? '🏅 Loyalty rewards: ON' : '🏅 Loyalty rewards', 'loyalty')],
    [Markup.button.callback('💼 Dividend policy', 'split')],
    [Markup.button.callback('⏱️ Schedule', 'change_interval')],
    [hours],
    [toggle],
    [Markup.button.callback('🗑️ Delete configuration', 'stop')],
    [Markup.button.callback('⬅️ Back', 'menu')],
  ]);
}

/** Dividend policy submenu: payout presets, payout address, treasury, in-kind vs convert. */
export function splitKeyboard(config, presets, currentKey) {
  const rows = presets.map((p) => [Markup.button.callback(`${p.key === currentKey ? '✅ ' : ''}${p.label}`, `split_${p.key}`)]);
  const shortAddr = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  rows.push([Markup.button.callback(config.creator_address ? `👤 Your payout address: ${shortAddr(config.creator_address)}` : '👤 Set your payout address', 'creator_address')]);
  rows.push([Markup.button.callback(config.treasury_address ? `🏦 Treasury address: ${shortAddr(config.treasury_address)}` : '🏦 Set treasury address', 'treasury_address')]);
  rows.push([Markup.button.callback('📈 Treasury asset (default SPY)', 'treasury_asset')]);
  rows.push([Markup.button.callback((config.payout_mode || 'in_kind') === 'convert' ? '🔁 Stocks: convert to the reward (switch to in kind)' : '📦 Stocks: paid in kind (switch to convert)', 'payout_mode')]);
  rows.push([Markup.button.callback('⬅️ Back', 'settings')]);
  return Markup.inlineKeyboard(rows);
}

/** Loyalty submenu: each button cycles its value. */
export function loyaltyKeyboard(config) {
  const on = Boolean(config.loyalty_enabled);
  const hours = Number(config.loyalty_min_hold_hours || 0);
  const minLabel = hours === 0 ? 'none' : hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
  return Markup.inlineKeyboard([
    [Markup.button.callback(on ? '🏅 Loyalty weighting: ON (turn off)' : '🏅 Loyalty weighting: off (turn on)', 'loy_toggle')],
    [Markup.button.callback(`⏳ Min hold to qualify: ${minLabel}`, 'loy_min')],
    [Markup.button.callback(`📈 Ramp: ${config.loyalty_ramp_days || 30} days`, 'loy_ramp')],
    [Markup.button.callback(`✖️ Max multiplier: ${(Number(config.loyalty_max_bps || 20000) / 10000).toFixed(1)}x`, 'loy_max')],
    [Markup.button.callback(config.loyalty_sell_reset ? '🔁 Selling resets the clock: ON' : '🔁 Selling resets the clock: off', 'loy_reset')],
    [Markup.button.callback('⬅️ Back', 'settings')],
  ]);
}

/** Reward picker: featured stocks, ETH, and a free-text option. */
export function rewardKeyboard(prefix = 'reward', backAction = 'cancel') {
  const rows = [];
  for (let i = 0; i < FEATURED_TICKERS.length; i += 3) {
    rows.push(FEATURED_TICKERS.slice(i, i + 3).map((t) => Markup.button.callback(`📈 ${t}`, `${prefix}_${t}`)));
  }
  rows.push([Markup.button.callback('⟠ ETH', `${prefix}_ETH`), Markup.button.callback('✍️ Any ticker or token CA', `${prefix}_custom`)]);
  rows.push([Markup.button.callback(backAction === 'cancel' ? '❌ Cancel' : '⬅️ Back', backAction)]);
  return Markup.inlineKeyboard(rows);
}

export function rewardModeKeyboard(config) {
  const mark = (m) => (config.reward_mode === m ? '✅ ' : '');
  return Markup.inlineKeyboard([
    [Markup.button.callback(`${mark('fixed')}🎯 Fixed reward`, 'mode_fixed')],
    [Markup.button.callback(`${mark('roulette')}🎰 Stock Roulette (random each cycle)`, 'mode_roulette')],
    [Markup.button.callback(`${mark('gainer')}🚀 Top Gainer (best stock of the day)`, 'mode_gainer')],
    [Markup.button.callback(`${mark('portfolio')}📊 Portfolio (rotate a basket)`, 'mode_portfolio')],
    [Markup.button.callback(`${mark('vote')}🗳️ Community Vote`, 'mode_vote')],
    [Markup.button.callback('⬅️ Back', 'settings')],
  ]);
}

export function basketKeyboard() {
  return Markup.inlineKeyboard([
    ...BASKET_KEYS.map((k) => [Markup.button.callback(`${BASKETS[k].emoji} ${BASKETS[k].label}: ${BASKETS[k].tickers.join(' ')}`, `basket_${k}`)]),
    [Markup.button.callback('⬅️ Back', 'reward_mode')],
  ]);
}

export function feeSourceKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('💼 Fees land in my wallet (stocks or ETH)', 'source_wallet')],
    [Markup.button.callback('🦄 Uniswap V3 LP fees', 'source_univ3')],
    [Markup.button.callback('❌ Cancel', 'cancel')],
  ]);
}

export function intervalKeyboard(prefix = 'interval', backAction = 'cancel') {
  const rows = [];
  for (let i = 0; i < INTERVAL_OPTIONS.length; i += 3) {
    rows.push(INTERVAL_OPTIONS.slice(i, i + 3).map((m) => Markup.button.callback(`${m} min`, `${prefix}_${m}`)));
  }
  rows.push([Markup.button.callback('🔔 Closing bell (4 pm ET)', `${prefix}_bell`), Markup.button.callback('🛎️ Opening bell', `${prefix}_open`)]);
  rows.push([Markup.button.callback(backAction === 'cancel' ? '❌ Cancel' : '⬅️ Back', backAction)]);
  return Markup.inlineKeyboard(rows);
}

export function confirmationKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Activate', 'confirm_yes')],
    [Markup.button.callback('❌ Cancel', 'confirm_no')],
  ]);
}

export function statusKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Refresh', 'status'), Markup.button.callback('⚡ Run now', 'runnow')],
    [Markup.button.callback('⚙️ Settings', 'settings'), Markup.button.callback('⬅️ Menu', 'menu')],
  ]);
}

export function cancelKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'cancel')]]);
}

export function backToMenuKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back to menu', 'menu')]]);
}

export function warningConfirmationKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ I understand, continue', 'warning_accept')],
    [Markup.button.callback('❌ Cancel', 'warning_cancel')],
  ]);
}

export function deleteConfirmKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🗑️ Yes, delete it', 'confirm_delete')],
    [Markup.button.callback('⬅️ Keep it', 'menu')],
  ]);
}
