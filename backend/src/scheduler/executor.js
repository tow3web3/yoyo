// One dividend cycle for one config.
//
//   1. claim      unwrap WETH, collect Uniswap V3 LP fees (and, in convert mode,
//                 sell the stocks the launchpad paid into ETH)
//   2. collect    every payable asset in the dev wallet: ETH above the gas
//                 reserve plus each Robinhood Stock Token balance
//   3. per asset  apply the dividend policy: holders / creator / burn / treasury
//                 stocks are paid in kind; ETH is converted to the reward first
//   4. record     one execution log per asset leg, receipts, webhooks, Telegram
import { parseEther } from 'viem';
import * as db from '../db/queries.js';
import { decryptPrivateKey } from '../services/encryption.js';
import { accountFromKey, explorerTx, formatEth, formatUnits, short, readTokenMeta } from '../chain/config.js';
import { announceDividend } from '../services/announce.js';
import { effectiveSplit } from '../services/treasury.js';
import { legsFor, legsLabel, splitAmounts, runLeg, convertAsset } from '../services/legs.js';
import { emitForConfig } from '../services/webhooks.js';
import { claimFees } from '../services/fees.js';
import { collectAssets, liquidateStocks, describeAssets, MIN_ASSET_VALUE_WEI } from '../services/assets.js';
import { swapEthForToken } from '../services/swap.js';
import { getTokenHolders, applyLoyalty, loyaltyLabel } from '../services/holders.js';
import { distributeTokens, distributeEth, calculateDistributions } from '../services/airdrop.js';
import { resolveReward, describeReward } from '../services/rewards.js';
import { stockOracle, tokenOracle } from '../services/oracle.js';
import { isMarketOpen, scheduleLabel } from '../services/schedule.js';
import { sendNotification } from '../bot/telegram.js';

const MIN_DISTRIBUTE_WEI = parseEther(process.env.MIN_DISTRIBUTE_ETH || '0.0005');
const runningConfigs = new Set();

function newLog(config, cycleKey) {
  return {
    configId: config.id, cycleKey, claimedEthWei: 0n, boughtTokenAmount: 0n, holderCount: 0, totalAirdropped: 0n,
    status: 'failed', errorMessage: null, rewardTokenUsed: null, rewardModeUsed: config.reward_mode || 'fixed',
    swapTx: null, claimTx: null, destination: 'holders',
    burnAmount: 0n, burnTx: null, treasuryAmount: 0n, treasuryToken: null, treasuryTx: null,
    creatorAmount: 0n, creatorTx: null, assetToken: null, assetAmount: 0n,
  };
}

const note = (log, msg) => { log.errorMessage = [log.errorMessage, msg].filter(Boolean).join('; '); };

export async function executeBotConfig(config, { force = false } = {}) {
  if (runningConfigs.has(config.id)) {
    console.log(`Config ${config.id} is still running from a previous tick, skipping`);
    return;
  }
  runningConfigs.add(config.id);
  const cycleKey = `${config.id}-${Date.now().toString(36)}`;
  console.log(`\nCycle ${cycleKey} for ${short(config.source_token_address)} (${scheduleLabel(config)})`);

  try {
    if (config.market_hours_only && !force && !isMarketOpen()) {
      console.log('   Market closed, cycle skipped (market hours only)');
      return;
    }
    const privateKey = decryptPrivateKey(config.dev_wallet_encrypted);
    const account = accountFromKey(privateKey);
    const inKind = (config.payout_mode || 'in_kind') !== 'convert';

    // 1. Claim
    console.log('1. Claiming fees');
    const claim = await claimFees(config, privateKey);
    for (const n of claim.notes) console.log(`   note: ${n}`);
    if (!inKind) for (const n of await liquidateStocks({ privateKey, owner: account.address })) console.log(`   convert: ${n}`);

    // 2. Collect
    const assets = (await collectAssets({ owner: account.address, gasReserveWei: config.gas_reserve_wei, includeStocks: inKind }))
      .filter((a) => (a.isNative ? a.amount >= MIN_DISTRIBUTE_WEI : a.valueWei >= MIN_ASSET_VALUE_WEI || a.valueWei === 0n));
    console.log(`2. Payable: ${assets.length ? describeAssets(assets) : 'nothing above the minimums'}`);
    if (!assets.length) {
      const log = newLog(config, cycleKey);
      log.status = 'success';
      log.errorMessage = 'Nothing to distribute yet';
      log.claimTx = claim.claimTx;
      await db.createExecutionLog(log);
      await db.updateLastExecution(config.id);
      return;
    }

    const split = effectiveSplit(config);
    const legs = await legsFor(config);
    const holdersLeg = legs.find((l) => l.kind === 'holders') || null;
    const routingLabel = await legsLabel(legs);
    console.log(`3. Routing: ${routingLabel}${config.loyalty_enabled ? `, loyalty ${loyaltyLabel(config)}` : ''}`);
    const sourceMeta = await readTokenMeta(config.source_token_address).catch(() => null);
    const sourceSymbol = sourceMeta?.symbol || short(config.source_token_address);

    // Holders are fetched once per cycle, only if a holders leg exists.
    let holdersCache = null;
    const getHolders = async () => {
      if (holdersCache) return holdersCache;
      const { holders: raw, head } = await getTokenHolders(config.source_token_address, {
        minBalance: BigInt(config.min_holder_amount || 0), exclude: [account.address], startBlock: config.index_start_block || null,
      });
      holdersCache = applyLoyalty(raw, config, head);
      if (config.loyalty_enabled) console.log(`   Loyalty: ${holdersCache.length}/${raw.length} wallets eligible`);
      return holdersCache;
    };

    const summary = [];
    let firstClaimTx = claim.claimTx;

    for (const asset of assets) {
      const log = newLog(config, cycleKey);
      log.claimTx = firstClaimTx; firstClaimTx = null;
      log.assetToken = asset.address;
      log.assetAmount = asset.amount;
      log.claimedEthWei = asset.valueWei;
      console.log(`4. ${asset.symbol}: ${formatUnits(asset.amount, asset.decimals, 4)} (~${formatEth(asset.valueWei, 4)} ETH)`);

      const amounts = splitAmounts(asset.amount, legs);
      let holdersAmount = holdersLeg ? amounts[legs.indexOf(holdersLeg)] : 0n;
      const legResults = [];
      let creator = null, burn = null, treasury = null;
      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        if (leg.kind === 'holders') continue;
        const r = await runLeg({ config, privateKey, asset, amount: amounts[i], leg });
        if (!r) continue;
        legResults.push({ ...r, out: undefined });
        if (r.failed) {
          if (holdersLeg) { holdersAmount += amounts[i]; note(log, `${leg.label} share paid to holders: ${r.failed}`); }
          else note(log, `${leg.label} share carried: ${r.failed}`);
          continue;
        }
        if (r.note) note(log, `${leg.label}: ${r.note}`);
        if (leg.kind === 'wallet') { log.creatorAmount += amounts[i]; if (!log.creatorTx) log.creatorTx = r.tx; creator = { amount: log.creatorAmount }; }
        if (leg.kind === 'burn') { log.burnAmount += r.out.amount; log.burnTx = r.tx; burn = { amount: log.burnAmount }; }
        if (leg.kind === 'treasury') { log.treasuryAmount += r.out.amount; log.treasuryToken = r.out.address; log.treasuryTx = r.tx; treasury = { amount: log.treasuryAmount, symbol: r.out.symbol, decimals: r.out.decimals }; }
      }

      // The dividend leg: ETH converts to the reward (mode or the leg's asset), a stock goes out
      // as is unless the holders leg asks for a specific asset.
      let reward = asset.isNative
        ? (holdersLeg?.asset ? { ...(await describeReward(holdersLeg.asset)), mode: 'fixed', note: 'routing' } : await resolveReward(config))
        : { ...(await describeReward(asset.address)), mode: 'in_kind', note: null };
      let holdersPreconverted = null;
      if (holdersLeg && !asset.isNative && holdersLeg.asset && holdersLeg.asset.toLowerCase() !== asset.address.toLowerCase() && holdersAmount > 0n) {
        try {
          holdersPreconverted = await convertAsset({ config, privateKey, asset, amount: holdersAmount, toToken: holdersLeg.asset });
          reward = { ...(await describeReward(holdersPreconverted.address)), mode: 'convert', note: `converted from ${asset.symbol}` };
        } catch (e) {
          note(log, `Holders paid in kind, conversion skipped: ${e.shortMessage || e.message}`);
        }
      }
      log.legs = legResults;

      const holdersValueWei = asset.amount > 0n ? (asset.valueWei * holdersAmount) / asset.amount : 0n;
      if (holdersAmount <= 0n || holdersValueWei < MIN_DISTRIBUTE_WEI / 2n) {
        log.status = 'success';
        log.rewardTokenUsed = reward.address;
        if (holdersLeg && holdersAmount > 0n) note(log, 'Holders share below the minimum, carried to the next cycle');
        const savedIdle = await db.createExecutionLog(log);
        if (legResults.length) await db.setExecutionLegs(savedIdle.id, legResults).catch(() => {});
        summary.push(`${asset.symbol}: ${creator && !creator.failed ? `👤 ${formatUnits(creator.amount, asset.decimals, 4)} to you` : ''}${burn && !burn.failed ? ` 🔥 burned ${formatUnits(burn.amount, 18, 2)}` : ''}${treasury && !treasury.failed ? ` 🏦 +${formatUnits(treasury.amount, treasury.decimals, 4)} ${treasury.symbol}` : ''}`.trim());
        continue;
      }

      // Holders leg. ETH converts to the reward (guarded); a stock goes out as is.
      let amountToDistribute = holdersPreconverted ? holdersPreconverted.amount : holdersAmount;
      if (holdersPreconverted) { log.swapTx = holdersPreconverted.swapTx; log.boughtTokenAmount = holdersPreconverted.amount; }
      if (!holdersPreconverted && asset.isNative && !reward.isNative) {
        const oracle = reward.isStock ? await stockOracle(reward.ticker) : await tokenOracle(reward.address);
        try {
          console.log(`   Buying ${reward.symbol} with ${formatEth(holdersAmount, 4)} ETH`);
          const swap = await swapEthForToken({ privateKey, token: reward.address, decimals: reward.decimals, amountWei: holdersAmount, slippageBps: config.slippage_bps || 150, oracle });
          log.swapTx = swap.hash;
          log.boughtTokenAmount = swap.outputAmount;
          amountToDistribute = swap.outputAmount;
        } catch (e) {
          console.log(`   Swap skipped: ${e.shortMessage || e.message}. Paying ETH instead.`);
          note(log, `Paid ETH: ${e.shortMessage || e.message}`);
          reward = { ...(await describeReward(null)), mode: reward.mode, note: 'ETH fallback' };
        }
      }
      log.rewardTokenUsed = reward.address;

      const holders = await getHolders();
      log.holderCount = holders.length;
      if (!holders.length) {
        log.status = 'success';
        note(log, 'No eligible holders');
        if (legResults.length) { const savedNoH = await db.createExecutionLog(log); await db.setExecutionLegs(savedNoH.id, legResults).catch(() => {}); continue; }
        await db.createExecutionLog(log);
        continue;
      }
      const distributions = calculateDistributions(holders, amountToDistribute, 1n);
      console.log(`   Paying ${distributions.length} holders in ${reward.symbol}`);
      const results = reward.isNative
        ? await distributeEth(privateKey, distributions)
        : await distributeTokens(privateKey, reward.address, distributions);
      log.totalAirdropped = results.totalSent;
      log.status = 'success';
      const saved = await db.createExecutionLog(log);
      if (legResults.length) await db.setExecutionLegs(saved.id, legResults).catch(() => {});

      const rows = [];
      for (const tx of results.successful) rows.push({ executionLogId: saved.id, holderAddress: tx.address, holderBalance: tx.holderBalance.toString(), airdropAmount: tx.amount.toString(), txHash: tx.hash, status: 'success' });
      for (const tx of results.failed) rows.push({ executionLogId: saved.id, holderAddress: tx.address, holderBalance: tx.holderBalance?.toString() || '0', airdropAmount: tx.amount?.toString() || '0', txHash: null, status: 'failed' });
      if (rows.length) await db.createAirdropTransactionsBatch(rows);

      if (results.successful.length) {
        await emitForConfig(config, 'dividend.paid', {
          executionId: saved.id, cycleKey,
          asset: { address: asset.address, symbol: asset.symbol, amount: asset.amount.toString(), valueWei: asset.valueWei.toString() },
          reward: { address: reward.address, symbol: reward.symbol, decimals: reward.decimals, isStock: Boolean(reward.isStock), mode: reward.mode, note: reward.note || null },
          amount: results.totalSent.toString(), holdersPaid: results.successful.length, holdersEligible: holders.length,
          split, routing: routingLabel, legs: legResults, creatorAmount: log.creatorAmount.toString(), burnAmount: log.burnAmount.toString(), treasuryAmount: log.treasuryAmount.toString(),
          txHash: results.txHashes[0] || null,
          receiptUrl: `${process.env.FRONTEND_URL || process.env.WEBSITE_URL || 'https://yo-yo.dev'}/receipt/${saved.id}`,
        });
        await announceDividend({ config, log: saved, reward, sourceSymbol, results, feesLabel: `${formatUnits(holdersAmount, asset.decimals, 4)} ${asset.symbol} of fees`, holdersTotal: holders.length });
      }
      summary.push(
        `${asset.symbol}: 📈 ${formatUnits(results.totalSent, reward.decimals, 4)} ${reward.symbol} to ${results.successful.length}/${holders.length} holders` +
        (creator && !creator.failed ? ` · 👤 ${formatUnits(creator.amount, asset.decimals, 4)} to you` : '') +
        (burn && !burn.failed ? ` · 🔥 burned ${formatUnits(burn.amount, 18, 2)}` : '') +
        (treasury && !treasury.failed ? ` · 🏦 +${formatUnits(treasury.amount, treasury.decimals, 4)} ${treasury.symbol}` : '') +
        (results.failed.length ? ` · ⚠️ ${results.failed.length} failed` : '') +
        (log.errorMessage ? ` · ⚠️ ${log.errorMessage}` : '')
      );
    }

    await db.updateLastExecution(config.id);
    await notifyUser(config.user_id, `✅ *Dividend cycle done*\n\n${summary.join('\n')}\n\n💼 Routing: ${routingLabel}\n⏰ Next: ${scheduleLabel(config)}`);
    console.log(`   Cycle ${cycleKey} done`);
  } catch (error) {
    console.error('Cycle failed:', error);
    const log = newLog(config, cycleKey);
    log.errorMessage = error.shortMessage || error.message;
    await db.createExecutionLog(log).catch(() => {});
    await notifyUser(config.user_id, `❌ *Cycle failed*\n\n${log.errorMessage}\n\nCheck the dev wallet has ETH for gas, or contact support.`);
  } finally {
    runningConfigs.delete(config.id);
  }
}

async function notifyUser(userId, message) {
  try {
    const result = await db.pool.query('SELECT telegram_id FROM users WHERE id = $1', [userId]);
    if (result.rows.length) await sendNotification(result.rows[0].telegram_id, message);
  } catch (error) {
    console.error('Error notifying user:', error);
  }
}

export { explorerTx };
