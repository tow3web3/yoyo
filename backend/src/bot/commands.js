import * as db from '../db/queries.js';
import * as keyboards from './keyboards.js';
import { encryptPrivateKey, isValidPrivateKey } from '../services/encryption.js';
import {
  accountFromKey, publicClient, readTokenMeta, isAddress, short, formatEth, erc20Abi, NATIVE_ETH, isNative, explorerAddress,
} from '../chain/config.js';
import { getStock, BASKETS, LIQUID_TICKERS, STOCKS } from '../chain/stocks.js';
import { discoverPositions, FEE_SOURCES } from '../services/fees.js';
import { REWARD_MODES } from '../services/rewards.js';
import { quoteEthForToken } from '../services/swap.js';
import { tokenOracle } from '../services/oracle.js';
import { scheduleLabel } from '../services/schedule.js';
import { loyaltyLabel } from '../services/holders.js';
import { SPLIT_PRESETS, effectiveSplit, splitLabel } from '../services/treasury.js';
import { emitForConfig } from '../services/webhooks.js';

// Optional holders-only gate: the dev wallet must hold MIN_HOLD_TO_ACTIVATE $0XDIV.
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

  // Deep links: t.me/<bot>?start=l_<code> (from a launchpad) or ?start=t_<token address>.
  const payload = String(ctx.startPayload || '').trim();
  if (payload && /^w_[A-Za-z0-9]{6,16}$/.test(payload)) return linkWebAccount(ctx, payload.slice(2));
  if (payload && !config) {
    if (/^l_[A-Za-z0-9]{6,16}$/.test(payload)) return startFromLaunchLink(ctx, payload.slice(2));
    if (/^t_0x[0-9a-fA-F]{40}$/.test(payload)) return startFromToken(ctx, payload.slice(2), null);
  }

  if (config) {
    return ctx.replyWithMarkdown(
      `🪃 *Welcome back!*\n\nYour policy is ${config.is_active ? '🟢 *running*' : '⏸️ *paused*'}: ` +
      `paying holders of \`${short(config.source_token_address)}\` ${scheduleLabel(config)}.\n\nWhat would you like to do?`,
      keyboards.dashboardKeyboard(config)
    );
  }

  await ctx.replyWithMarkdown(
    `🪃 *0xdiv: the dividend policy for your memecoin*\n\n` +
    `Your launchpad pays you in real stocks. 0xdiv decides what happens next, every cycle:\n` +
    `🎁 *Payout ratio*: a share to your holders, paid in kind (NVDA fees become NVDA dividends)\n` +
    `👤 *Your share*: sent to your own payout address\n` +
    `🔥 *Buyback*: buy your token and burn it\n` +
    `🏦 *Retained earnings*: a stock treasury with a published book value\n` +
    `🏅 *Record date*: loyalty weighting, snipers earn less\n\n` +
    `Ready when you are 👇`,
    keyboards.welcomeKeyboard()
  );
}

export async function handleMenu(ctx) {
  const { config } = await getUserConfig(ctx.from.id);
  const text = config
    ? `🪃 *Main menu*\n\n0xdiv is ${config.is_active ? '🟢 running' : '⏸️ paused'}. Pick an option:`
    : `🪃 *Main menu*\n\nLet's turn your fees into dividends:`;
  await edit(ctx, text, config ? keyboards.dashboardKeyboard(config) : keyboards.welcomeKeyboard());
}

export async function handleHelp(ctx) {
  await edit(ctx,
    `❓ *0xdiv, help*\n\n` +
    `*Commands*\n/start: open the menu\n/setup: configure your bot\n/status: view your bot\n/stocks: the stock universe\n/help: this message\n\n` +
    `*The loop*\nOn schedule, 0xdiv sweeps the dev wallet (stock tokens and ETH, plus Uniswap V3 LP fees), applies your dividend policy ` +
    `(payout ratio, your share, buyback, treasury) and pays holders in proportion to what they hold, weighted by loyalty if enabled. Stocks go out in kind; ETH is converted to your reward.\n\n` +
    `*Modes*\n🎯 Fixed: one stock (or ETH, or any token)\n🎰 Roulette: a random liquid stock each cycle\n🚀 Top Gainer: the day's best stock\n📊 Portfolio: rotate through a basket\n🗳️ Community Vote: holders choose\n🏅 Loyalty: weight dividends by holding time, snipers earn less\n\n` +
    `*Good to know*\n🔐 Your key is AES-256 encrypted, decrypted only at run time\n🛡️ Swaps are guarded against the real market price (Yahoo Finance)\n⏸️ Pause, resume or delete anytime`,
    keyboards.backToMenuKeyboard()
  );
}

export async function handleHowItWorks(ctx) {
  const dash = `${(process.env.FRONTEND_URL || process.env.WEBSITE_URL || 'https://boomerang.fun')}/app`;
  await edit(ctx,
    `📖 *How 0xdiv works*\n\n` +
    `Your launchpad on Robinhood Chain pays you in real Stock Tokens (NVDA, SPY, GLD, 195 of them) or ETH. 0xdiv is the dividend policy on top: it decides where every cycle's fees go.\n\n` +
    `🧭 *Routing canvas*: draw it on the dashboard (${dash}). Fees flow from the dev wallet to as many legs as you like, each with its own share:\n` +
    `  🎁 Holders: the dividend, paid *in kind* (NVDA fees become NVDA dividends, no swap)\n` +
    `  👤 Wallets: you, a partner, marketing, a DAO, any address\n` +
    `  🔥 Buyback & burn: buys your own token on Uniswap and burns it\n` +
    `  🏦 Treasury: retained earnings in stocks, book value per token published live\n\n` +
    `🪙 *Any token, by address*: each leg can convert its share into a stock, ETH, or any token on Robinhood Chain by contract address. Pay a partner in their coin, pay holders in yours.\n\n` +
    `🏅 *Record date*: dividends weighted by holding time, 1x to 2x over 30 days, minimum hold, selling resets the clock. Snipers earn less than diamond hands.\n\n` +
    `🎛️ *ETH fees*: fixed reward, 🎰 Stock Roulette, 🚀 Top Gainer of the day, 📊 Portfolio baskets (Magnificent 7, AI & Semis, Degen Street, Safe Haven) or 🗳️ holder vote.\n\n` +
    `🔔 *Calendar*: every 1 to 60 minutes, or once a day at the closing bell (4:00 pm New York), market hours only if you want.\n\n` +
    `⚖️ *Fair-price guard*: every swap is checked against Yahoo Finance (stocks) or DexScreener (tokens). Thin pool, no fill: that leg pays in kind instead of a bad price.\n\n` +
    `🧾 *Receipts & statements*: every dividend posts a card here with Share on X. Holders get a statement page, tokens get a public dashboard, a yield figure and an embeddable badge.\n\n` +
    `🔗 *Launchpads* plug in with one link: a token lands here already configured.\n\n` +
    `🔐 Keys are AES-256 encrypted, decrypted in memory at run time only. Use a dedicated dev wallet. 🪃`,
    keyboards.welcomeKeyboard()
  );
}

export async function handleFaq(ctx) {
  await edit(ctx,
    `❓ *FAQ*\n\n` +
    `*Are my funds safe?*\nYour key is encrypted (AES-256-GCM) and only decrypted in memory at run time. Use a *dedicated wallet*.\n\n` +
    `*What can the bot do with my wallet?*\nCollect fees, swap on Uniswap, send each leg where you routed it: holders, your wallets, the burn address, your treasury. Nothing else.\n\n` +
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

// ---------- deep links ----------

/** The web app issued a link code: attach this Telegram account to that user (receipts, alerts, same config). */
async function linkWebAccount(ctx, code) {
  const telegramId = ctx.from.id;
  const { rows } = await db.pool.query('SELECT * FROM users WHERE link_code = $1', [code]);
  const webUser = rows[0];
  if (!webUser) return ctx.replyWithMarkdown('❌ This link code is unknown or already used. Generate a new one in the web app.', keyboards.welcomeKeyboard());
  const { rows: mine } = await db.pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  const tgUser = mine[0];
  if (tgUser && tgUser.id !== webUser.id) {
    const { rows: cfg } = await db.pool.query('SELECT id FROM bot_configs WHERE user_id = $1', [tgUser.id]);
    if (cfg.length) return ctx.replyWithMarkdown('⚠️ This Telegram account already runs a 0xdiv policy. Delete it first (Settings) before linking a web account.', keyboards.welcomeKeyboard());
    await db.pool.query('DELETE FROM users WHERE id = $1', [tgUser.id]);
  }
  await db.pool.query('UPDATE users SET telegram_id = $1, username = $2, link_code = NULL WHERE id = $3', [telegramId, ctx.from.username || null, webUser.id]);
  const { config } = await getUserConfig(telegramId);
  await ctx.replyWithMarkdown(
    `🔗 *Linked.* This Telegram account now controls the same 0xdiv as your web dashboard${config ? ` (\`${short(config.source_token_address)}\`)` : ''}. Alerts and receipts arrive here.`,
    config ? keyboards.dashboardKeyboard(config) : keyboards.welcomeKeyboard()
  );
}

async function startFromLaunchLink(ctx, code) {
  const link = await db.getLaunchLink(code);
  if (!link) return ctx.replyWithMarkdown('❌ This launch link is unknown or expired. Send /setup to start normally.', keyboards.welcomeKeyboard());
  if (link.status === 'linked') return ctx.replyWithMarkdown('ℹ️ This token is already linked to 0xdiv. Send /status.', keyboards.welcomeKeyboard());
  return startFromToken(ctx, link.token, link);
}

async function startFromToken(ctx, token, link) {
  const meta = await readTokenMeta(token);
  if (!meta) return ctx.replyWithMarkdown('❌ No ERC-20 found at that address on Robinhood Chain.', keyboards.welcomeKeyboard());
  const user = await db.createOrGetUser(ctx.from.id, ctx.from.username);
  sessions.set(ctx.from.id, {
    userId: user.id, step: 'warning',
    data: { prefill: { token, meta, feeSource: link?.fee_source || null, suggestedReward: link?.suggested_reward || null, creatorWallet: link?.creator_wallet || null, launchpadId: link?.launchpad_id || null, launchCode: link?.code || null, launchpadName: link?.launchpad_name || null } },
  });
  const via = link?.launchpad_name ? ' (via ' + link.launchpad_name + ')' : '';
  await ctx.replyWithMarkdown(
    '🪃 *Set up dividends for $' + meta.symbol + '*' + via + '\n\n' +
    'Token: *' + meta.name + '* `' + short(token) + '`\n\n' +
    "0xdiv needs your dev wallet's *private key* to collect fees and pay holders. Use a *dedicated wallet*, never your main one. " +
    'Your key is encrypted immediately (AES-256) and the message is deleted right after.\n\nUnderstood?',
    keyboards.warningConfirmationKeyboard()
  );
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
    `To collect fees and pay holders, 0xdiv needs your dev wallet's *private key*. So:\n\n` +
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
      case 'treasury_address': return await handleTreasuryAddressInput(ctx, session, text);
      case 'creator_address': return await handleCreatorAddressInput(ctx, session, text);
      case 'treasury_asset': return await handleTreasuryAssetInput(ctx, session, text);
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
        `🔒 *Holders-only access.*\n\nYour dev wallet must hold at least *${MIN_HOLD_TO_ACTIVATE.toLocaleString()} $0XDIV*.\n` +
        `Wallet \`${short(publicKey)}\` holds *${Math.floor(held).toLocaleString()}*.\n\nTop it up and send the key again, or send a different wallet.`,
        keyboards.cancelKeyboard()
      );
    }
    gateLine = `\n💎 Holds ${Math.floor(held).toLocaleString()} $0XDIV, access granted.`;
  }

  let balanceLine = '';
  try {
    const bal = await publicClient().getBalance({ address: publicKey });
    balanceLine = `\n⛽ Balance: ${formatEth(bal, 4)} ETH`;
  } catch { /* ignore */ }

  session.data.privateKey = encryptPrivateKey(privateKey);
  session.data.publicKey = publicKey;

  const pre = session.data.prefill;
  if (pre) {
    // Deep-linked setup: the token is known; jump to the fee source, or straight to the reward when the launchpad told us.
    let walletNote = '';
    if (pre.creatorWallet && pre.creatorWallet.toLowerCase() !== publicKey.toLowerCase()) {
      walletNote = '\n\n⚠️ The launchpad expected wallet `' + short(pre.creatorWallet) + '`; you sent `' + short(publicKey) + '`. Fees only get collected if this wallet receives them.';
    }
    session.data.sourceToken = pre.token;
    session.data.sourceMeta = pre.meta;
    try { session.data.positionIds = await discoverPositions(publicKey, pre.token); } catch { session.data.positionIds = []; }
    const head = '✅ Key received and encrypted.\n📍 Wallet: `' + publicKey + '`' + balanceLine + gateLine + walletNote + '\n\n💎 Token: *' + pre.meta.name + '* ($' + pre.meta.symbol + ')';
    if (pre.feeSource === 'wallet' || pre.feeSource === 'univ3') {
      session.data.feeSource = pre.feeSource;
      session.step = 'reward';
      const hint = pre.suggestedReward ? ' The launchpad suggests *' + rewardLabel(pre.suggestedReward) + '*: type it or pick anything.' : '';
      return ctx.replyWithMarkdown(head + ' · 💰 Fees: ' + FEE_SOURCES[pre.feeSource].label + '\n\n📈 *The reward*\n\nWhat should holders receive?' + hint, keyboards.rewardKeyboard('reward', 'cancel'));
    }
    session.step = 'fee_source';
    return ctx.replyWithMarkdown(head + '\n\n💰 *Where do your fees come from?*\n\n💼 *Wallet*: ' + FEE_SOURCES.wallet.hint + '\n🦄 *Uniswap V3*: ' + FEE_SOURCES.univ3.hint, keyboards.feeSourceKeyboard());
  }

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
    `💼 *Wallet*: ${FEE_SOURCES.wallet.hint}\n🦄 *Uniswap V3*: ${FEE_SOURCES.univ3.hint}\n\n_Stock tokens in the wallet are always swept, whichever you pick._`,
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
    `📈 *Step 4 of 5: the reward*\n\nWhat should holders receive? A stock (195 available), ETH, or *any token on Robinhood Chain*: paste its contract address and holders get paid in it, even another memecoin.`,
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
    // Probe a route so the creator knows up front whether this token can actually be bought.
    let liquidity = '';
    try {
      const oracle = await tokenOracle(t);
      const quoted = await quoteEthForToken({ token: t, amountWei: 10n ** 15n, recipient: '0x000000000000000000000000000000000000dEaD', fairOut: null });
      if (!quoted) liquidity = ' ⚠️ no Uniswap route found yet: holders would receive ETH until a pool exists';
      else liquidity = ` · route ${quoted.route.label}${oracle?.liquidityUsd ? `, $${Math.round(oracle.liquidityUsd).toLocaleString('en-US')} liquidity` : ''}`;
    } catch { liquidity = ''; }
    return { address: t, label: `${meta.symbol} (${meta.name})${liquidity}` };
  }
  throw new Error(`Unknown ticker "${t}". Send one of the 195 Robinhood stock tickers, ETH, or a token address.`);
}

export async function handleRewardSelection(ctx, pick) {
  const session = sessions.get(ctx.from.id);
  if (!session || session.step !== 'reward') return ctx.answerCbQuery('Send /setup to start again.');
  if (pick === 'custom') {
    session.step = 'reward_custom';
    return edit(ctx, `✍️ Send a *ticker* (like NVDA, SPY, GLD), *ETH*, or *any token contract address* (0x…). Fees are swapped into it on Uniswap each cycle; another memecoin works.`, keyboards.cancelKeyboard());
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
    `📋 *Review your policy*\n\n` +
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
      launchpadId: session.data.prefill?.launchpadId || null,
      launchCode: session.data.prefill?.launchCode || null,
    });
    sessions.delete(telegramId);
    await reschedule(config);
    if (config.launch_code) {
      await db.markLaunchLinkLinked(config.launch_code, config.id).catch(() => {});
      await emitForConfig(config, 'token.linked', { symbol: session.data.sourceMeta?.symbol || null, rewardToken: config.target_token_address, schedule: scheduleLabel(config) });
    }
    await edit(ctx,
      `🎉 *0xdiv is live!*\n\nDividends go out ${scheduleLabel(config)}.\n\n📊 Dashboard: ${dashboardLink(config)}\n\n` +
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
    `📊 *Your 0xdiv*\n\n📍 Status: ${config.is_active ? '🟢 Running' : '⏸️ Paused'}\n⏱️ Schedule: ${scheduleLabel(config)}${config.market_hours_only ? ' (market hours only)' : ''}\n` +
    `🔐 Wallet: \`${config.dev_wallet_public}\`${balanceLine}\n💎 Your token: \`${short(config.source_token_address)}\`\n` +
    `💰 Fees: ${FEE_SOURCES[config.fee_source]?.label || config.fee_source}\n${modeLine(config)}\n` +
    `💼 Policy: ${splitLabel(config)}${lastLine}\n\n📈 Dashboard: ${dashboardLink(config)}\n🔎 ${explorerAddress(config.dev_wallet_public)}`,
    keyboards.statusKeyboard()
  );
  if (ctx.callbackQuery) await ctx.answerCbQuery();
}

// ---------- settings ----------

export async function handleSettings(ctx) {
  const { config } = await getUserConfig(ctx.from.id);
  if (!config) { if (ctx.callbackQuery) await ctx.answerCbQuery('No config yet.'); return ctx.replyWithMarkdown('You have no bot yet.', keyboards.welcomeKeyboard()); }
  await edit(ctx,
    `⚙️ *Settings*\n\n⏱️ Schedule: ${scheduleLabel(config)}${config.market_hours_only ? ' (market hours only)' : ''}\n${modeLine(config)}\n🏅 Loyalty: ${loyaltyLabel(config)}\n` +
    `💼 Policy: ${splitLabel(config)}\n📍 ${config.is_active ? '🟢 Running' : '⏸️ Paused'}`,
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

// ---------- fee split + treasury ----------

function splitText(config) {
  if (config.legs_enabled) {
    const url = (process.env.FRONTEND_URL || process.env.WEBSITE_URL || 'https://boomerang.fun') + '/app';
    return `🧭 *Fee routing*

This 0xdiv uses the routing canvas: fees flow to several destinations (holders, wallets, buyback, treasury), each with its own share and payout asset.

Edit it on the dashboard: ${url}

Picking a preset below replaces the canvas with a simple split.`;
  }
  const s = effectiveSplit(config);
  const asset = config.treasury_asset ? rewardLabel(config.treasury_asset) : 'SPY (default)';
  const inKind = (config.payout_mode || 'in_kind') !== 'convert';
  return (
    `💼 *Dividend policy*\n\n` +
    `Your launchpad pays you in stocks. Each cycle, everything that landed in the dev wallet is split:\n` +
    `🎁 *Holders*: the payout ratio, the dividend itself\n👤 *You*: what you keep, sent to your payout address\n🔥 *Burn*: buys your own token and burns it\n🏦 *Treasury*: retained earnings, stocks kept in your treasury wallet (book value published on the dashboard)\n\n` +
    `${inKind ? '📦 Stocks are paid *in kind*: NVDA fees become NVDA dividends, no swap.' : '🔁 Stocks are *converted* to your chosen reward before the payout.'} ETH fees are converted to the reward.\n\n` +
    `Current: *${splitLabel(config)}*\n👤 Payout address: ${config.creator_address ? `\`${config.creator_address}\`` : '_not set (your share goes to holders until you set one)_'}\n` +
    `🏦 Treasury: ${config.treasury_address ? `\`${config.treasury_address}\`` : '_not set (treasury share goes to holders until you set one)_'}\n📈 Treasury asset: ${asset}` +
    (s.treasury > 0 && !config.treasury_address ? '\n\n⚠️ Set a treasury address to activate the treasury share.' : '') +
    (Number(config.split_creator_bps) > 0 && !config.creator_address ? '\n\n⚠️ Set your payout address to activate your share.' : '')
  );
}

function currentPresetKey(config) {
  const s = effectiveSplit({ ...config, treasury_address: config.treasury_address || '0x0000000000000000000000000000000000000001', creator_address: config.creator_address || '0x0000000000000000000000000000000000000001' });
  return `${s.holders / 100}-${s.creator / 100}-${s.burn / 100}-${s.treasury / 100}`;
}

export async function handleCreatorAddressPrompt(ctx) {
  const { user, config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.answerCbQuery('No config found.');
  sessions.set(ctx.from.id, { userId: user.id, step: 'creator_address', data: { configId: config.id } });
  await edit(ctx, `👤 *Your payout address*\n\nWhere your share of the fees goes each cycle (a wallet you control, *not* the dev wallet, or it would be paid out again next cycle). Send \`off\` to clear it.`, keyboards.cancelKeyboard());
}

async function handleCreatorAddressInput(ctx, session, text) {
  const t = text.trim();
  let updated;
  if (/^off$/i.test(t)) updated = await db.updateBotConfigCreatorAddress(session.data.configId, null);
  else if (!isAddress(t)) return ctx.replyWithMarkdown('❌ Not a valid 0x address. Try again, or send `off`.', keyboards.cancelKeyboard());
  else updated = await db.updateBotConfigCreatorAddress(session.data.configId, t);
  sessions.delete(ctx.from.id);
  await reschedule(updated);
  await ctx.replyWithMarkdown(splitText(updated), keyboards.splitKeyboard(updated, SPLIT_PRESETS, currentPresetKey(updated)));
}

export async function handleTogglePayoutMode(ctx) {
  const { config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.answerCbQuery('No config found.');
  const updated = await db.updateBotConfigPayoutMode(config.id, (config.payout_mode || 'in_kind') === 'convert' ? 'in_kind' : 'convert');
  await reschedule(updated);
  await edit(ctx, splitText(updated), keyboards.splitKeyboard(updated, SPLIT_PRESETS, currentPresetKey(updated)));
}

export async function handleSplitMenu(ctx) {
  const { config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.answerCbQuery('No config found.');
  await edit(ctx, splitText(config), keyboards.splitKeyboard(config, SPLIT_PRESETS, currentPresetKey(config)));
}

export async function handleSplitPreset(ctx, key) {
  const { config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.answerCbQuery('No config found.');
  const p = SPLIT_PRESETS.find((x) => x.key === key);
  if (!p) return ctx.answerCbQuery('Unknown split.');
  const updated = await db.updateBotConfigSplit(config.id, p.holders, p.creator, p.burn, p.treasury);
  await reschedule(updated);
  await edit(ctx, splitText(updated), keyboards.splitKeyboard(updated, SPLIT_PRESETS, currentPresetKey(updated)));
}

export async function handleTreasuryAddressPrompt(ctx) {
  const { user, config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.answerCbQuery('No config found.');
  sessions.set(ctx.from.id, { userId: user.id, step: 'treasury_address', data: { configId: config.id } });
  await edit(ctx, `🏦 *Treasury address*\n\nSend the wallet that will hold the treasury stocks (a cold wallet or multisig, *not* the dev wallet). Send \`off\` to clear it.`, keyboards.cancelKeyboard());
}

async function handleTreasuryAddressInput(ctx, session, text) {
  const t = text.trim();
  if (/^off$/i.test(t)) {
    const updated = await db.updateBotConfigTreasuryAddress(session.data.configId, null);
    sessions.delete(ctx.from.id);
    return ctx.replyWithMarkdown(splitText(updated), keyboards.splitKeyboard(updated, SPLIT_PRESETS, currentPresetKey(updated)));
  }
  if (!isAddress(t)) return ctx.replyWithMarkdown('❌ Not a valid 0x address. Try again, or send `off`.', keyboards.cancelKeyboard());
  const updated = await db.updateBotConfigTreasuryAddress(session.data.configId, t);
  sessions.delete(ctx.from.id);
  await reschedule(updated);
  await ctx.replyWithMarkdown(`✅ Treasury address set.\n\n${splitText(updated)}`, keyboards.splitKeyboard(updated, SPLIT_PRESETS, currentPresetKey(updated)));
}

export async function handleTreasuryAssetPrompt(ctx) {
  const { config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.answerCbQuery('No config found.');
  await edit(ctx, `📈 *Treasury asset*\n\nWhich stock should the treasury accumulate? Pick one or type a ticker.`, keyboards.rewardKeyboard('tasset', 'split'));
}

export async function handleTreasuryAssetSelection(ctx, pick) {
  const { user, config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.answerCbQuery('No config found.');
  if (pick === 'custom') {
    sessions.set(ctx.from.id, { userId: user.id, step: 'treasury_asset', data: { configId: config.id } });
    return edit(ctx, `✍️ Send a *ticker* (like SPY, GLD, NVDA) or a token address.`, keyboards.cancelKeyboard());
  }
  if (pick === 'ETH') return ctx.answerCbQuery('The treasury accumulates stocks, not ETH. Pick a ticker.', { show_alert: true });
  const r = await resolveRewardInput(pick);
  const updated = await db.updateBotConfigTreasuryAsset(config.id, r.address);
  await edit(ctx, `✅ Treasury asset: *${r.label}*\n\n${splitText(updated)}`, keyboards.splitKeyboard(updated, SPLIT_PRESETS, currentPresetKey(updated)));
}

async function handleTreasuryAssetInput(ctx, session, text) {
  const r = await resolveRewardInput(text);
  if (isNative(r.address)) return ctx.replyWithMarkdown('❌ The treasury accumulates stocks, not ETH. Send a ticker.', keyboards.cancelKeyboard());
  const updated = await db.updateBotConfigTreasuryAsset(session.data.configId, r.address);
  sessions.delete(ctx.from.id);
  await ctx.replyWithMarkdown(`✅ Treasury asset: *${r.label}*\n\n${splitText(updated)}`, keyboards.splitKeyboard(updated, SPLIT_PRESETS, currentPresetKey(updated)));
}

// ---------- receipts: /announce ----------

/**
 * /announce inside a group or channel topic binds it as the place where this
 * creator's dividends get posted (card + Share on X). /announce off in DM unbinds.
 */
export async function handleAnnounce(ctx) {
  const { config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.reply('You have no 0xdiv yet. Set one up in a private chat with me first (/setup).');
  const arg = (ctx.message.text || '').split(/\s+/)[1];
  const chat = ctx.chat;

  if (chat.type === 'private') {
    if (arg === 'off') {
      await db.setAnnounceChat(config.id, null, null);
      return ctx.replyWithMarkdown('🔕 Dividend receipts are no longer posted anywhere.');
    }
    return ctx.replyWithMarkdown(
      `📣 *Dividend receipts*\n\nAdd me to your project's Telegram group, then send */announce* there (inside the topic you want, if the group uses topics). ` +
      `Every dividend will be posted as a card with a *Share on X* button.\n\n` +
      (config.announce_chat_id ? `Currently posting to chat \`${config.announce_chat_id}\`. Send \`/announce off\` here to stop.` : 'Not bound to any group yet.')
    );
  }
  const threadId = ctx.message.message_thread_id || null;
  await db.setAnnounceChat(config.id, chat.id, threadId);
  await ctx.replyWithMarkdown(`📣 *Bound.* Dividend receipts for \`${short(config.source_token_address)}\` will be posted here${threadId ? ' (this topic)' : ''}.`);
}

// ---------- loyalty ----------

const LOYALTY_TEXT =
  `🏅 *Loyalty rewards*\n\n` +
  `Dividends weighted by *holding time*, not just balance. The multiplier ramps from 1x to the max over the ramp period; ` +
  `wallets younger than the minimum hold get nothing this cycle; with the reset on, any sell restarts a wallet's clock.\n\n` +
  `Snipers who buy right before the record date earn less than the holders who have been there for weeks. Voting weight follows the same rules.`;

export async function handleLoyaltyMenu(ctx) {
  const { config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.answerCbQuery('No config found.');
  await edit(ctx, `${LOYALTY_TEXT}\n\nCurrent: _${loyaltyLabel(config)}_`, keyboards.loyaltyKeyboard(config));
}

const MIN_HOLD_CYCLE = [0, 1, 6, 24, 72, 168];
const RAMP_CYCLE = [7, 14, 30, 60, 90];
const MAX_CYCLE = [15000, 20000, 30000, 50000];
const next = (cycle, current) => cycle[(Math.max(0, cycle.indexOf(Number(current))) + 1) % cycle.length];

export async function handleLoyaltySetting(ctx, key) {
  const { config } = await getUserConfig(ctx.from.id);
  if (!config) return ctx.answerCbQuery('No config found.');
  let updated;
  if (key === 'toggle') updated = await db.updateBotConfigLoyalty(config.id, 'loyalty_enabled', !config.loyalty_enabled);
  else if (key === 'min') updated = await db.updateBotConfigLoyalty(config.id, 'loyalty_min_hold_hours', next(MIN_HOLD_CYCLE, config.loyalty_min_hold_hours));
  else if (key === 'ramp') updated = await db.updateBotConfigLoyalty(config.id, 'loyalty_ramp_days', next(RAMP_CYCLE, config.loyalty_ramp_days));
  else if (key === 'max') updated = await db.updateBotConfigLoyalty(config.id, 'loyalty_max_bps', next(MAX_CYCLE, config.loyalty_max_bps));
  else if (key === 'reset') updated = await db.updateBotConfigLoyalty(config.id, 'loyalty_sell_reset', !config.loyalty_sell_reset);
  else return ctx.answerCbQuery('Unknown setting.');
  await reschedule(updated);
  await edit(ctx, `${LOYALTY_TEXT}\n\nCurrent: _${loyaltyLabel(updated)}_`, keyboards.loyaltyKeyboard(updated));
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
