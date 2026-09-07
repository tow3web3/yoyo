import * as db from '../db/queries.js';
import * as keyboards from './keyboards.js';
import { encryptPrivateKey, isValidPrivateKey } from '../services/encryption.js';
import {
  accountFromKey, publicClient, readTokenMeta, isAddress, short, formatEth, erc20Abi, NATIVE_ETH, isNative, explorerAddress,
} from '../chain/config.js';
import { getStock, BASKETS, LIQUID_TICKERS, STOCKS } from '../chain/stocks.js';
import { discoverPositions, FEE_SOURCES } from '../services/fees.js';
import { REWARD_MODES } from '../services/rewards.js';
import { scheduleLabel } from '../services/schedule.js';

// Optional holders-only gate: the dev wallet must hold MIN_HOLD_TO_ACTIVATE $BOOMERANG.
const BOOMERANG_TOKEN = isAddress(process.env.BOOMERANG_TOKEN_ADDRESS) ? process.env.BOOMERANG_TOKEN_ADDRESS : null;
const MIN_HOLD_TO_ACTIVATE = Number(process.env.MIN_HOLD_TO_ACTIVATE || 1_000_000);

const sessions = new Map();
const FRONTEND = process.env.FRONTEND_URL || process.env.WEBSITE_URL || 'https://boomerang.fun';

const dashboardLink = (config) => `${FRONTEND}/${config.source_token_address}`;

async function getUserConfig(telegramId) {
  const user = await db.getUserByTelegramId(telegramId);
  if (!user) return { user: null, config: null };
  const config = await db.getBotConfigByUserId(user.id);
  return { user, config };
}

async function reschedule(config) {
  try {
    const { scheduleConfig } = await import('../scheduler/cron.js');
    scheduleConfig(config);
  } catch (e) {
    console.error('reschedule failed:', e.message);
  }
}

/** Human label for a reward address. */
function rewardLabel(address) {
  if (isNative(address)) return 'ETH';
  const s = getStock(address);
  return s ? `${s.ticker} (${s.name})` : short(address);
}

function modeLine(config) {
  const m = REWARD_MODES[config.reward_mode] || REWARD_MODES.fixed;
  if (config.reward_mode === 'portfolio') {
    const b = BASKETS[config.basket] || BASKETS.MAG7;
    return `${m.emoji} ${m.label}: ${b.label} (${b.tickers.join(', ')})`;
  }
  if (config.reward_mode === 'fixed') return `${m.emoji} Reward: *${rewardLabel(config.target_token_address)}*`;
  return `${m.emoji} ${m.label}`;
}

async function edit(ctx, text, kb) {
  try {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...kb });
  } catch {
    await ctx.replyWithMarkdown(text, kb);
  }
  if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
}

// ---------- home ----------

export async function handleStart(ctx) {
  const telegramId = ctx.from.id;
  await db.createOrGetUser(telegramId, ctx.from.username);
  const { config } = await getUserConfig(telegramId);

  if (config) {
    return ctx.replyWithMarkdown(
      `🪃 *Welcome back!*\n\nYour Boomerang is ${config.is_active ? '🟢 *running*' : '⏸️ *paused*'}: ` +
      `paying holders of \`${short(config.source_token_address)}\` ${scheduleLabel(config)}.\n\nWhat would you like to do?`,
      keyboards.dashboardKeyboard(config)
    );
  }

  await ctx.replyWithMarkdown(
    `🪃 *Boomerang on Robinhood Chain*\n\n` +
    `Your fees come back to your holders as *real stocks*.\n\n` +
    `Every cycle, fully automated:\n` +
    `💰 Collect your token's fees (ETH in your wallet, or Uniswap V3 LP fees)\n` +
    `📈 Buy a Robinhood Stock Token: NVDA, TSLA, AAPL, GLD, SPY... 195 to choose from\n` +
    `🎁 Pay it to every holder, pro-rata. A dividend for your memecoin.\n\n` +
    `Ready when you are 👇`,
    keyboards.welcomeKeyboard()
  );
}

export async function handleMenu(ctx) {
  const { config } = await getUserConfig(ctx.from.id);
  const text = config
    ? `🪃 *Main menu*\n\nBoomerang is ${config.is_active ? '🟢 running' : '⏸️ paused'}. Pick an option:`
    : `🪃 *Main menu*\n\nLet's turn your fees into dividends:`;
  await edit(ctx, text, config ? keyboards.dashboardKeyboard(config) : keyboards.welcomeKeyboard());
}

export async function handleHelp(ctx) {
  await edit(ctx,
    `❓ *Boomerang, help*\n\n` +
    `*Commands*\n/start: open the menu\n/setup: configure your bot\n/status: view your bot\n/stocks: the stock universe\n/help: this message\n\n` +
    `*The loop*\nOn schedule, Boomerang takes the ETH fees in your dev wallet (or collects your Uniswap V3 LP fees), buys the reward on Uniswap, ` +
    `and pays it to holders of your token in proportion to what they hold.\n\n` +
    `*Modes*\n🎯 Fixed: one stock (or ETH, or any token)\n🎰 Roulette: a random liquid stock each cycle\n🚀 Top Gainer: the day's best stock\n📊 Portfolio: rotate through a basket\n🗳️ Community Vote: holders choose\n\n` +
    `*Good to know*\n🔐 Your key is AES-256 encrypted, decrypted only at run time\n🛡️ Swaps are guarded against the real market price (Yahoo Finance)\n⏸️ Pause, resume or delete anytime`,
    keyboards.backToMenuKeyboard()
  );
}

export async function handleHowItWorks(ctx) {
  await edit(ctx,
    `📖 *How Boomerang works*\n\n` +
    `1️⃣ *Collect*: your token's fees arrive as ETH in the dev wallet, or sit in your Uniswap V3 position. Boomerang gathers them every cycle.\n\n` +
    `2️⃣ *Buy*: that ETH is swapped into the reward on Uniswap (V4, V3 or V2, best route). For stocks, the swap only executes if the pool delivers at least 90% of the real market price.\n\n` +
    `3️⃣ *Pay*: the tokens are sent to your holders, proportional to their balance. Or burned, if you prefer a buyback and burn.\n\n` +
    `Schedules: every 1 to 60 minutes, or once a day at the closing bell like a real dividend. 🪃`,
    keyboards.welcomeKeyboard()
  );
}

export async function handleFaq(ctx) {
  await edit(ctx,
    `❓ *FAQ*\n\n` +
    `*Are my funds safe?*\nYour key is encrypted (AES-256-GCM) and only decrypted in memory at run time. Use a *dedicated wallet*.\n\n` +
    `*What can the bot do with my wallet?*\nCollect fees, swap on Uniswap, transfer rewards to holders. Nothing else.\n\n` +
    `*Which stocks?*\nAll 195 official Robinhood Stock Tokens. The liquid ones (${LIQUID_TICKERS.join(', ')}) fill at fair value today; others are guarded and fall back to ETH when their pool is too thin.\n\n` +
    `*Who counts as a holder?*\nReal wallets only. Pools, routers, the token contract and any smart contract are excluded.\n\n` +
    `*Can I stop it?*\nYes: pause, resume or delete anytime from the menu.`,
    keyboards.welcomeKeyboard()
  );
}

export async function handleStocks(ctx) {
  const bySector = {};
  for (const s of STOCKS) (bySector[s.sector] ??= []).push(s.ticker);
  const lines = Object.entries(bySector).map(([sector, tickers]) => `*${sector}*: ${tickers.join(' ')}`);
  const text = `📈 *${STOCKS.length} Robinhood Stock Tokens*\n\nLiquid today: ${LIQUID_TICKERS.join(', ')}\n\n${lines.join('\n\n')}`;
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery().catch(() => {});
    return ctx.replyWithMarkdown(text, keyboards.backToMenuKeyboard());
  }
  return ctx.replyWithMarkdown(text, keyboards.backToMenuKeyboard());
}

// ---------- setup flow ----------

export async function handleSetupStart(ctx) {
  const telegramId = ctx.from.id;
  const user = await db.createOrGetUser(telegramId, ctx.from.username);
  const existing = await db.getBotConfigByUserId(user.id);
  if (existing) {
    await ctx.replyWithMarkdown(`⚠️ You already have a configuration.\n\nUse *Settings* to change it, or delete it first.`, keyboards.dashboardKeyboard(existing));
    if (ctx.callbackQuery) await ctx.answerCbQuery();
    return;
  }
  sessions.set(telegramId, { userId: user.id, step: 'warning', data: {} });
  await ctx.replyWithMarkdown(
    `⚠️ *Before we start, read this*\n\n` +
    `To collect fees and pay holders, Boomerang needs your dev wallet's *private key*. So:\n\n` +
    `❌ *Don't* use your main wallet\n✅ *Do* create a fresh, dedicated wallet on Robinhood Chain\n✅ Keep a little ETH in it for gas (0.002 ETH is reserved automatically)\n\n` +
    `🔐 Your key is encrypted immediately (AES-256) and your message is deleted right after.\n🛑 You stay in control: pause, resume or delete anytime.\n\nUnderstood?`,
    keyboards.warningConfirmationKeyboard()
  );
  if (ctx.callbackQuery) await ctx.answerCbQuery();
}

export async function handleWarningAccept(ctx) {
  const session = sessions.get(ctx.from.id);
  if (!session || session.step !== 'warning') return ctx.answerCbQuery('Session expired. Send /setup to start again.');
  session.step = 'private_key';
  await edit(ctx,
    `🔐 *Step 1 of 5: dev wallet key*\n\nSend the *private key* of your dedicated dev wallet (64 hex characters, with or without 0x).\n\n_Your message is deleted the instant it's received._`,
    keyboards.cancelKeyboard()
  );
}

export async function handleWarningCancel(ctx) {
  sessions.delete(ctx.from.id);
  await edit(ctx, '❌ Setup cancelled. Send /setup whenever you are ready.', keyboards.welcomeKeyboard());
}

export async function handleSetupMessage(ctx) {
  const telegramId = ctx.from.id;
  const session = sessions.get(telegramId);
  if (!session) return;
  const text = (ctx.message.text || '').trim();
  if (session.step === 'private_key') {
    try { await ctx.deleteMessage(ctx.message.message_id); } catch { /* ignore */ }
  }
  try {
    switch (session.step) {
      case 'private_key': return await handlePrivateKeyInput(ctx, session, text);
      case 'source_token': return await handleSourceTokenInput(ctx, session, text);
      case 'reward_custom': return await handleRewardCustomInput(ctx, session, text, false);
      case 'edit_target': return await handleRewardCustomInput(ctx, session, text, true);
      default: return;
    }
  } catch (error) {
    await ctx.reply(`❌ ${error.message}`);
  }
}

async function handlePrivateKeyInput(ctx, session, privateKey) {
  if (!isValidPrivateKey(privateKey)) {
    return ctx.replyWithMarkdown(`❌ That doesn't look like a private key. Send 64 hex characters (0x optional).`, keyboards.cancelKeyboard());
  }
  const account = accountFromKey(privateKey);
  const publicKey = account.address;

  let gateLine = '';
  if (BOOMERANG_TOKEN) {
    let held = 0;
    try {
      const raw = await publicClient().readContract({ address: BOOMERANG_TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: [publicKey] });
      held = Number(raw) / 1e18;
    } catch { /* treat as 0 */ }
    if (held < MIN_HOLD_TO_ACTIVATE) {
      return ctx.replyWithMarkdown(
        `🔒 *Holders-only access.*\n\nYour dev wallet must hold at least *${MIN_HOLD_TO_ACTIVATE.toLocaleString()} $BOOMERANG*.\n` +
        `Wallet \`${short(publicKey)}\` holds *${Math.floor(held).toLocaleString()}*.\n\nTop it up and send the key again, or send a different wallet.`,
        keyboards.cancelKeyboard()
      );
    }
    gateLine = `\n💎 Holds ${Math.floor(held).toLocaleString()} $BOOMERANG, access granted.`;
  }

  let balanceLine = '';
  try {
    const bal = await publicClient().getBalance({ address: publicKey });
    balanceLine = `\n⛽ Balance: ${formatEth(bal, 4)} ETH`;
  } catch { /* ignore */ }

  session.data.privateKey = encryptPrivateKey(privateKey);
  session.data.publicKey = publicKey;
  session.step = 'source_token';
  await ctx.replyWithMarkdown(
    `✅ Key received and encrypted.\n📍 Wallet: \`${publicKey}\`${balanceLine}${gateLine}\n\n` +
    `💎 *Step 2 of 5: your token*\n\nSend the *contract address* of your token on Robinhood Chain: its holders will receive the dividends.`,
    keyboards.cancelKeyboard()
  );
}

async function handleSourceTokenInput(ctx, session, address) {
  if (!isAddress(address)) return ctx.replyWithMarkdown(`❌ That's not a valid 0x address. Try again.`, keyboards.cancelKeyboard());
  const meta = await readTokenMeta(address);
  if (!meta) return ctx.replyWithMarkdown(`❌ No ERC-20 found at that address on Robinhood Chain. Try again.`, keyboards.cancelKeyboard());

  session.data.sourceToken = address;
  session.data.sourceMeta = meta;
  session.step = 'fee_source';

  let positionsLine = '';
  try {
    const ids = await discoverPositions(session.data.publicKey, address);
    session.data.positionIds = ids;
    if (ids.length) positionsLine = `\n🦄 Found ${ids.length} Uniswap V3 position(s) for this token in your wallet.`;
  } catch { /* RPC hiccup */ }

  await ctx.replyWithMarkdown(
    `✅ Token: *${meta.name}* ($${meta.symbol})${positionsLine}\n\n` +
    `💰 *Step 3 of 5: where do your fees come from?*\n\n` +
    `💼 *Wallet*: ${FEE_SOURCES.wallet.hint}\n🦄 *Uniswap V3*: ${FEE_SOURCES.univ3.hint}`,
    keyboards.feeSourceKeyboard()
  );
}

export async function handleFeeSourceSelection(ctx, source) {
  const session = sessions.get(ctx.from.id);
  if (!session || session.step !== 'fee_source') return ctx.answerCbQuery('Send /setup to start again.');
  session.data.feeSource = source;
  session.step = 'reward';
  await edit(ctx,
    `✅ Fee source: ${FEE_SOURCES[source].emoji} ${FEE_SOURCES[source].label}\n\n` +
    `📈 *Step 4 of 5: the reward*\n\nWhat should holders receive? Pick a stock, ETH, or type any ticker (195 available) or token address.`,
    keyboards.rewardKeyboard('reward', 'cancel')
  );
}

/** Resolve free text (ticker or address) to a reward address; throws with a friendly message. */
async function resolveRewardInput(text) {
  const t = text.trim();
  if (/^(eth|\$eth)$/i.test(t)) return { address: NATIVE_ETH, label: 'ETH' };
  const stock = getStock(t);
  if (stock) return { address: stock.address, label: `${stock.ticker} (${stock.name})` };
  if (isAddress(t)) {
    const meta = await readTokenMeta(t);
    if (!meta) throw new Error('No ERC-20 found at that address.');
    return { address: t, label: `${meta.symbol} (${meta.name})` };
  }
  throw new Error(`Unknown ticker "${t}". Send one of the 195 Robinhood stock tickers, ETH, or a token address.`);
}

export async function handleRewardSelection(ctx, pick) {
  const session = sessions.get(ctx.from.id);
  if (!session || session.step !== 'reward') return ctx.answerCbQuery('Send /setup to start again.');
  if (pick === 'custom') {
    session.step = 'reward_custom';
    return edit(ctx, `✍️ Send a *ticker* (like NVDA, SPY, GLD), *ETH*, or a *token address*.`, keyboards.cancelKeyboard());
  }
  const r = await resolveRewardInput(pick);
  session.data.targetToken = r.address;
  session.data.targetLabel = r.label;
  session.step = 'interval';
  await edit(ctx, `✅ Reward: *${r.label}*\n\n⏱️ *Step 5 of 5: schedule*\n\nHow often should dividends go out?`, keyboards.intervalKeyboard('interval', 'cancel'));
}

async function handleRewardCustomInput(ctx, session, text, isEdit) {
  const r = await resolveRewardInput(text);
  if (isEdit) {
    const updated = await db.updateBotConfigTargetToken(session.data.configId, r.address);
    sessions.delete(ctx.from.id);
    await reschedule(updated);
    return ctx.replyWithMarkdown(`✅ Reward updated to *${r.label}* (fixed mode).`, keyboards.settingsKeyboard(updated));
  }
  session.data.targetToken = r.address;
  session.data.targetLabel = r.label;
  session.step = 'interval';
  await ctx.replyWithMarkdown(`✅ Reward: *${r.label}*\n\n⏱️ *Step 5 of 5: schedule*\n\nHow often should dividends go out?`, keyboards.intervalKeyboard('interval', 'cancel'));
}

function scheduleFromPick(pick) {
  if (pick === 'bell') return { scheduleKind: 'closing_bell', intervalMinutes: 1440 };
  if (pick === 'open') return { scheduleKind: 'opening_bell', intervalMinutes: 1440 };
  return { scheduleKind: 'interval', intervalMinutes: parseInt(pick, 10) };
}

export async function handleIntervalSelection(ctx, pick) {
  const session = sessions.get(ctx.from.id);
  if (!session || session.step !== 'interval') return ctx.answerCbQuery('Send /setup to start again.');
  Object.assign(session.data, scheduleFromPick(pick));
  const label = scheduleLabel({ schedule_kind: session.data.scheduleKind, interval_minutes: session.data.intervalMinutes });
  await edit(ctx,
    `📋 *Review your Boomerang*\n\n` +
    `🔐 Wallet: \`${short(session.data.publicKey)}\`\n` +
    `💎 Your token: $${session.data.sourceMeta.symbol} \`${short(session.data.sourceToken)}\`\n` +
    `💰 Fees: ${FEE_SOURCES[session.data.feeSource].label}\n` +
    `📈 Reward: ${session.data.targetLabel}\n` +
    `⏱️ Schedule: ${label}\n\nActivate now?`,
    keyboards.confirmationKeyboard()
  );
}

export async function handleSetupConfirmation(ctx, confirmed) {
  const telegramId = ctx.from.id;
  const session = sessions.get(telegramId);
  if (!session) return ctx.answerCbQuery('Session expired. Send /setup to start again.');
  if (!confirmed) {
    sessions.delete(telegramId);
    return edit(ctx, '❌ Setup cancelled.', keyboards.welcomeKeyboard());
  }
  try {
    const config = await db.createBotConfig({
      userId: session.userId,
      devWalletEncrypted: session.data.privateKey,
      devWalletPublic: session.data.publicKey,
      sourceTokenAddress: session.data.sourceToken,
      targetTokenAddress: session.data.targetToken,
      feeSource: session.data.feeSource,
      univ3PositionIds: session.data.positionIds || [],
      scheduleKind: session.data.scheduleKind,
      intervalMinutes: session.data.intervalMinutes,
    });
    sessions.delete(telegramId);
    await reschedule(config);
    await edit(ctx,
      `🎉 *Boomerang is live!*\n\nDividends go out ${scheduleLabel(config)}.\n\n📊 Dashboard: ${dashboardLink(config)}\n\n` +
      `Tip: hit *⚡ Run now* to fire the first cycle. The first run also builds the holder ledger from chain logs, which can take a minute.`,
      keyboards.dashboardKeyboard(config)
    );
  } catch (error) {
    console.error('Error saving configuration:', error);
    await ctx.answerCbQuery('❌ Error saving config').catch(() => {});
    await ctx.reply(`❌ ${error.message}`);
  }
}

// ---------- status ----------

export async function handleStatus(ctx) {
  const { user, config } = await getUserConfig(ctx.from.id);
  if (!user) { if (ctx.callbackQuery) await ctx.answerCbQuery(); return ctx.reply('Send /start first.'); }
  if (!config) { if (ctx.callbackQuery) await ctx.answerCbQuery(); return ctx.replyWithMarkdown('You have no bot yet.', keyboards.welcomeKeyboard()); }

  let balanceLine = '';
  try {
    const bal = await publicClient().getBalance({ address: config.dev_wallet_public });
    balanceLine = `\n⛽ Wallet balance: *${formatEth(bal, 4)} ETH*`;
  } catch { /* skip */ }

  const last = await db.getLastExecutionLog(config.id);
  let lastLine = `\n📭 No runs yet. Hit *⚡ Run now*.`;
  if (last) {
    const ok = last.status === 'success';
    lastLine =
      `\n*Last run* ${ok ? '✅' : '❌'} _(${new Date(last.execution_time).toLocaleString()})_\n` +
      `💰 Fees used: ${formatEth(last.claimed_eth_wei || 0, 4)} ETH\n` +
      `📈 Reward: ${last.reward_token_used ? rewardLabel(last.reward_token_used) : '-'}\n` +
      `👥 Holders: ${last.holder_count || 0}` +
      (last.error_message ? `\n⚠️ ${last.error_message}` : '');
  }

  await ctx.replyWithMarkdown(
    `📊 *Your Boomerang*\n\n📍 Status: ${config.is_active ? '🟢 Running' : '⏸️ Paused'}\n⏱️ Schedule: ${scheduleLabel(config)}${config.market_hours_only ? ' (market hours only)' : ''}\n` +
    `🔐 Wallet: \`${config.dev_wallet_public}\`${balanceLine}\n💎 Your token: \`${short(config.source_token_address)}\`\n` +
    `💰 Fees: ${FEE_SOURCES[config.fee_source]?.label || config.fee_source}\n${modeLine(config)}\n` +
    `${config.destination === 'burn' ? '🔥 Destination: buyback and burn' : '🎁 Destination: holders'}${lastLine}\n\n📈 Dashboard: ${dashboardLink(config)}\n🔎 ${explorerAddress(config.dev_wallet_public)}`,
    keyboards.statusKeyboard()
  );
  if (ctx.callbackQuery) await ctx.answerCbQuery();
}

// ---------- settings ----------

export async function handleSettings(ctx) {
  const { config } = await getUserConfig(ctx.from.id);
  if (!config) { if (ctx.callbackQuery) await ctx.answerCbQuery('No config yet.'); return ctx.replyWithMarkdown('You have no bot yet.', keyboards.welcomeKeyboard()); }
  await edit(ctx,
    `⚙️ *Settings*\n\n⏱️ Schedule: ${scheduleLabel(config)}${config.market_hours_only ? ' (market hours only)' : ''}\n${modeLine(config)}\n` +
    `${config.destination === 'burn' ? '🔥 Buyback and burn' : '🎁 Paid to holders'}\n📍 ${config.is_active ? '🟢 Running' : '⏸️ Paused'}`,
    keyboards.settingsKeyboard(config)
  );
}

export async function handleChangeIntervalPrompt(ctx) {
  await edit(ctx, '⏱️ *Pick a new schedule:*', keyboards.intervalKeyboard('editint', 'settings'));
}

export async function handleEditInterval(ctx, pick) {
  const { config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.answerCbQuery('No config found.');
  const s = scheduleFromPick(pick);
  let updated = await db.updateBotConfigInterval(config.id, s.intervalMinutes);
  if (s.scheduleKind !== 'interval') updated = await db.updateBotConfigSchedule(config.id, s.scheduleKind);
  await reschedule(updated);
  await edit(ctx, `✅ Schedule updated: dividends ${scheduleLabel(updated)}.`, keyboards.settingsKeyboard(updated));
}

export async function handleChangeTargetPrompt(ctx) {
  const { user, config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.answerCbQuery('No config found.');
  sessions.set(ctx.from.id, { userId: user.id, step: 'edit_reward', data: { configId: config.id } });
  await edit(ctx, `📈 *Change reward*\n\nPick a stock, ETH, or type a ticker or address. This sets the mode back to Fixed.`, keyboards.rewardKeyboard('editreward', 'settings'));
}

export async function handleEditRewardSelection(ctx, pick) {
  const { config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.answerCbQuery('No config found.');
  const session = sessions.get(ctx.from.id) || { data: { configId: config.id } };
  if (pick === 'custom') {
    sessions.set(ctx.from.id, { ...session, step: 'edit_target', data: { configId: config.id } });
    return edit(ctx, `✍️ Send a *ticker* (like NVDA, SPY, GLD), *ETH*, or a *token address*.`, keyboards.cancelKeyboard());
  }
  const r = await resolveRewardInput(pick);
  const updated = await db.updateBotConfigTargetToken(config.id, r.address);
  sessions.delete(ctx.from.id);
  await reschedule(updated);
  await edit(ctx, `✅ Reward updated to *${r.label}* (fixed mode).`, keyboards.settingsKeyboard(updated));
}

export async function handleRewardModePrompt(ctx) {
  const { config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.answerCbQuery('No config found.');
  await edit(ctx,
    `🎛️ *Reward mode*\n\n🎯 Fixed: always the same reward\n🎰 Roulette: random liquid stock each cycle (${LIQUID_TICKERS.length} tickers)\n🚀 Top Gainer: the best-performing liquid stock of the day\n📊 Portfolio: rotate through a basket, one stock per cycle\n🗳️ Community Vote: holders pick, weighted by balance`,
    keyboards.rewardModeKeyboard(config)
  );
}

export async function handleRewardModeSelection(ctx, mode) {
  const { config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.answerCbQuery('No config found.');
  if (mode === 'portfolio') return edit(ctx, `📊 *Pick a basket*\n\nOne stock per cycle, in order, forever.`, keyboards.basketKeyboard());
  const updated = await db.updateBotConfigRewardMode(config.id, mode);
  await reschedule(updated);
  const m = REWARD_MODES[mode];
  const extra = mode === 'vote' ? `\n\nHolders vote at ${FRONTEND}/vote. A cycle lasts ${updated.vote_cycle_hours || 24}h; the winner is paid until the next one resolves.` : '';
  await edit(ctx, `✅ Mode: ${m.emoji} *${m.label}*${extra}`, keyboards.settingsKeyboard(updated));
}

export async function handleBasketSelection(ctx, key) {
  const { config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.answerCbQuery('No config found.');
  const basket = BASKETS[key];
  if (!basket) return ctx.answerCbQuery('Unknown basket.');
  const updated = await db.updateBotConfigRewardMode(config.id, 'portfolio', key);
  await reschedule(updated);
  await edit(ctx, `✅ Mode: 📊 *Portfolio*, ${basket.emoji} ${basket.label}: ${basket.tickers.join(' > ')} then repeat.`, keyboards.settingsKeyboard(updated));
}

export async function handleToggleMarketHours(ctx) {
  const { config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.answerCbQuery('No config found.');
  const updated = await db.updateBotConfigMarketHours(config.id, !config.market_hours_only);
  await edit(ctx,
    updated.market_hours_only
      ? `🕰️ *Market hours only: ON*\n\nCycles outside 9:30 to 16:00 New York time (weekdays) are skipped. Dividends land while Wall Street is open.`
      : `🕰️ *Market hours only: off*\n\nCycles run 24/7.`,
    keyboards.settingsKeyboard(updated)
  );
}

export async function handleToggleDestination(ctx) {
  const { config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.answerCbQuery('No config found.');
  const next = config.destination === 'burn' ? 'holders' : 'burn';
  const updated = await db.updateBotConfigDestination(config.id, next);
  await edit(ctx,
    next === 'burn'
      ? `🔥 *Buyback and burn*\n\nEach cycle the bought reward is sent to the dead address instead of holders. Makes sense when the reward is your own token.`
      : `🎁 *Paid to holders*\n\nEach cycle the reward is split pro-rata across holders.`,
    keyboards.settingsKeyboard(updated)
  );
}

// ---------- run / pause / resume / delete ----------

export async function handleRunNow(ctx) {
  const { config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.answerCbQuery('No config found.');
  if (!config.is_active) return ctx.answerCbQuery('Bot is paused. Resume it first.', { show_alert: true });
  await ctx.answerCbQuery('⚡ Running now');
  await ctx.replyWithMarkdown('⚡ *Running a cycle now.* I will message you with the result.');
  import('../scheduler/executor.js')
    .then(({ executeBotConfig }) => executeBotConfig(config, { force: true }))
    .catch((e) => { console.error('Run-now failed:', e); ctx.reply(`❌ Run failed: ${e.message}`); });
}

export async function handlePause(ctx) {
  const { config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.answerCbQuery('No config found.');
  if (!config.is_active) return ctx.answerCbQuery('Already paused.');
  const updated = await db.updateBotConfigStatus(config.id, false);
  await reschedule(updated);
  await edit(ctx, '⏸️ *Bot paused.* No cycles until you resume.', keyboards.dashboardKeyboard(updated));
}

export async function handleResume(ctx) {
  const { config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.answerCbQuery('No config found.');
  if (config.is_active) return ctx.answerCbQuery('Already running.');
  const updated = await db.updateBotConfigStatus(config.id, true);
  await reschedule(updated);
  await edit(ctx, '▶️ *Bot resumed.* Back to paying dividends.', keyboards.dashboardKeyboard(updated));
}

export async function handleStop(ctx) {
  const { config } = await getUserConfig(ctx.from.id);
  if (!config) { if (ctx.callbackQuery) await ctx.answerCbQuery('No config found.'); return; }
  await edit(ctx, `🗑️ *Delete configuration?*\n\nThis stops the bot and removes its access to your wallet. This can't be undone.`, keyboards.deleteConfirmKeyboard());
}

export async function handleConfirmDelete(ctx) {
  const { config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.answerCbQuery('Nothing to delete.');
  await db.updateBotConfigStatus(config.id, false);
  await reschedule({ ...config, is_active: false });
  await db.deleteBotConfig(config.id);
  await edit(ctx, '🛑 *Configuration deleted.*\n\nSend /setup to create a new one anytime.', keyboards.welcomeKeyboard());
}

export async function handleCancel(ctx) {
  sessions.delete(ctx.from.id);
  await edit(ctx, '❌ Cancelled.', keyboards.backToMenuKeyboard());
}
