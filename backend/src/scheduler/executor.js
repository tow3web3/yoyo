// One dividend cycle for one config:
//   claim fees -> ETH available -> pick reward -> buy it (fair-price guarded)
//   -> eligible holders -> pro-rata split -> pay (or burn) -> log + notify.
import { parseEther } from 'viem';
import * as db from '../db/queries.js';
import { decryptPrivateKey } from '../services/encryption.js';
import { accountFromKey, explorerTx, formatEth, formatUnits, short, readTokenMeta } from '../chain/config.js';
import { announceDividend } from '../services/announce.js';
import { effectiveSplit, splitLabel, legWei, runBurnLeg, runTreasuryLeg } from '../services/treasury.js';
import { emitForConfig } from '../services/webhooks.js';
import { claimFees, availableEth } from '../services/fees.js';
import { swapEthForToken } from '../services/swap.js';
import { getTokenHolders, applyLoyalty, loyaltyLabel } from '../services/holders.js';
import { distributeTokens, distributeEth, calculateDistributions } from '../services/airdrop.js';
import { resolveReward, describeReward } from '../services/rewards.js';
import { stockOracle } from '../services/oracle.js';
import { isMarketOpen, scheduleLabel } from '../services/schedule.js';
import { sendNotification } from '../bot/telegram.js';

const MIN_DISTRIBUTE_WEI = parseEther(process.env.MIN_DISTRIBUTE_ETH || '0.0005');
const runningConfigs = new Set();

export async function executeBotConfig(config, { force = false } = {}) {
  if (runningConfigs.has(config.id)) {
    console.log(`Config ${config.id} is still running from a previous tick, skipping`);
    return;
  }
  runningConfigs.add(config.id);
  console.log(`\nCycle for config ${config.id} (${short(config.source_token_address)}, ${scheduleLabel(config)})`);

  const log = {
    configId: config.id, claimedEthWei: 0n, boughtTokenAmount: 0n, holderCount: 0, totalAirdropped: 0n,
    status: 'failed', errorMessage: null, rewardTokenUsed: null, rewardModeUsed: config.reward_mode || 'fixed',
    swapTx: null, claimTx: null, destination: config.destination || 'holders',
    burnAmount: 0n, burnTx: null, treasuryAmount: 0n, treasuryToken: null, treasuryTx: null,
  };

  try {
    if (config.market_hours_only && !force && !isMarketOpen()) {
      console.log('   Market closed, cycle skipped (market hours only)');
      runningConfigs.delete(config.id);
      return;
    }

    const privateKey = decryptPrivateKey(config.dev_wallet_encrypted);
    const account = accountFromKey(privateKey);

    // 1. Claim
    console.log('1. Claiming fees');
    const claim = await claimFees(config, privateKey);
    log.claimTx = claim.claimTx;
    for (const n of claim.notes) console.log(`   note: ${n}`);

    // 2. Budget
    const { balance, spendable } = await availableEth(account.address, config.gas_reserve_wei);
    console.log(`2. Wallet ${formatEth(balance)} ETH, ${formatEth(spendable)} ETH above the gas reserve`);
    if (spendable < MIN_DISTRIBUTE_WEI) {
      log.status = 'success';
      log.errorMessage = 'Nothing to distribute yet';
      await db.createExecutionLog(log);
      await db.updateLastExecution(config.id);
      return;
    }
    log.claimedEthWei = spendable;

    // 3. Split the ETH: holders / buyback-and-burn / treasury.
    const split = effectiveSplit(config);
    console.log(`3. Split: ${splitLabel(config)}`);
    let holdersWei = legWei(spendable, split.holders);
    const burnWei = legWei(spendable, split.burn);
    const treasuryWei = spendable - holdersWei - burnWei; // remainder absorbs rounding

    const burn = await runBurnLeg({ config, privateKey, wei: burnWei });
    if (burn?.failed) { holdersWei += burnWei; log.errorMessage = `Burn leg paid to holders: ${burn.failed}`; }
    else if (burn) { log.burnAmount = burn.amount; log.burnTx = burn.hash; }

    // 4. Reward for the holders leg
    let reward = await resolveReward(config);
    console.log(`4. Reward: ${reward.symbol}${reward.note ? ` (${reward.note})` : ''}`);

    const treasury = await runTreasuryLeg({ config, privateKey, wei: split.treasury > 0 ? treasuryWei : 0n, fallbackAsset: reward.isStock ? reward.address : null });
    if (treasury?.failed) { holdersWei += treasuryWei; log.errorMessage = [log.errorMessage, `Treasury leg paid to holders: ${treasury.failed}`].filter(Boolean).join('; '); }
    else if (treasury) { log.treasuryAmount = treasury.amount; log.treasuryToken = treasury.token; log.treasuryTx = treasury.hash; }

    if (holdersWei < MIN_DISTRIBUTE_WEI) {
      // Nothing (or dust) left for holders this cycle: burn/treasury did the work.
      log.status = 'success';
      log.holderCount = 0;
      log.rewardTokenUsed = reward.address;
      log.errorMessage = log.errorMessage || (split.holders === 0 ? null : 'Holders leg below the minimum');
      await db.createExecutionLog(log);
      await db.updateLastExecution(config.id);
      const lines = [];
      if (burn && !burn.failed) lines.push(`🔥 Burned ${formatUnits(burn.amount, 18, 2)} of your token (${explorerTx(burn.hash)})`);
      if (treasury && !treasury.failed) lines.push(`🏦 Treasury +${formatUnits(treasury.amount, treasury.decimals, 4)} ${treasury.symbol} (${explorerTx(treasury.hash)})`);
      if (lines.length) await notifyUser(config.user_id, ['✅ *Cycle done*', '', `💰 Fees used: ${formatEth(spendable, 4)} ETH`, ...lines].join('\n'));
      return;
    }

    // 5. Buy the reward for holders
    let amountToDistribute = holdersWei;
    if (!reward.isNative) {
      const oracle = reward.isStock ? await stockOracle(reward.ticker) : null;
      if (reward.isStock && !oracle) console.log('   Oracle unavailable, swap will run unguarded');
      try {
        console.log(`5. Buying ${reward.symbol} with ${formatEth(holdersWei)} ETH`);
        const swap = await swapEthForToken({
          privateKey, token: reward.address, decimals: reward.decimals, amountWei: holdersWei,
          slippageBps: config.slippage_bps || 150, oracle,
        });
        log.swapTx = swap.hash;
        log.boughtTokenAmount = swap.outputAmount;
        amountToDistribute = swap.outputAmount;
      } catch (e) {
        console.log(`   Swap skipped: ${e.shortMessage || e.message}. Paying ETH instead.`);
        log.errorMessage = [log.errorMessage, `Paid ETH: ${e.shortMessage || e.message}`].filter(Boolean).join('; ');
        reward = { ...(await describeReward(null)), mode: reward.mode, note: 'ETH fallback' };
        amountToDistribute = holdersWei;
      }
    }
    log.rewardTokenUsed = reward.address;

    // 6. Holders
    console.log(`5. Fetching holders of ${short(config.source_token_address)}`);
    const { holders: rawHolders, head } = await getTokenHolders(config.source_token_address, {
      minBalance: BigInt(config.min_holder_amount || 0),
      exclude: [account.address],
      startBlock: config.index_start_block || null,
    });
    const holders = applyLoyalty(rawHolders, config, head);
    if (config.loyalty_enabled) console.log(`   Loyalty weighting: ${loyaltyLabel(config)} (${holders.length}/${rawHolders.length} eligible)`);
    log.holderCount = holders.length;
    if (holders.length === 0) {
      log.status = 'success';
      log.errorMessage = 'No eligible holders';
      await db.createExecutionLog(log);
      await db.updateLastExecution(config.id);
      return;
    }

    // 7. Split + pay
    const distributions = calculateDistributions(holders, amountToDistribute, 1n);
    console.log(`6. Paying ${distributions.length} holders in ${reward.symbol}`);
    const results = reward.isNative
      ? await distributeEth(privateKey, distributions)
      : await distributeTokens(privateKey, reward.address, distributions);

    log.totalAirdropped = results.totalSent;
    log.status = 'success';
    const saved = await db.createExecutionLog(log);

    const rows = [];
    for (const tx of results.successful) rows.push({ executionLogId: saved.id, holderAddress: tx.address, holderBalance: tx.holderBalance.toString(), airdropAmount: tx.amount.toString(), txHash: tx.hash, status: 'success' });
    for (const tx of results.failed) rows.push({ executionLogId: saved.id, holderAddress: tx.address, holderBalance: tx.holderBalance?.toString() || '0', airdropAmount: tx.amount?.toString() || '0', txHash: null, status: 'failed' });
    if (rows.length) await db.createAirdropTransactionsBatch(rows);
    await db.updateLastExecution(config.id);

    // Launchpad webhook (only for tokens linked through a launchpad).
    if (results.successful.length > 0) {
      await emitForConfig(config, 'dividend.paid', {
        executionId: saved.id,
        reward: { address: reward.address, symbol: reward.symbol, decimals: reward.decimals, isStock: Boolean(reward.isStock), mode: reward.mode, note: reward.note || null },
        amount: results.totalSent.toString(),
        holdersPaid: results.successful.length,
        holdersEligible: holders.length,
        ethUsedWei: holdersWei.toString(),
        burnAmount: log.burnAmount.toString(),
        treasuryAmount: log.treasuryAmount.toString(),
        txHash: results.txHashes[0] || null,
        receiptUrl: (process.env.FRONTEND_URL || process.env.WEBSITE_URL || 'https://boomerang.fun') + '/receipt/' + saved.id,
      });
    }

    // Receipt into the creator's group (bound with /announce), never fatal.
    if (results.successful.length > 0) {
      const sourceMeta = await readTokenMeta(config.source_token_address).catch(() => null);
      await announceDividend({
        config, log: saved, reward, sourceSymbol: sourceMeta?.symbol || short(config.source_token_address),
        results, spendableWei: holdersWei, holdersTotal: holders.length,
      });
    }

    const modeLine = reward.note ? `\n${reward.mode === 'roulette' ? '🎰' : reward.mode === 'gainer' ? '🚀' : reward.mode === 'portfolio' ? '📊' : reward.mode === 'vote' ? '🗳️' : 'ℹ️'} ${reward.note}` : '';
    await notifyUser(config.user_id,
      `✅ *Dividend paid*${modeLine}\n\n` +
      `💰 Fees used: ${formatEth(spendable, 4)} ETH\n` +
      `📈 Paid out: ${formatUnits(results.totalSent, reward.decimals, 4)} ${reward.symbol}\n` +
      `👥 Recipients: ${results.successful.length}/${holders.length} holders\n` +
      (log.burnAmount > 0n ? `
🔥 Burned: ${formatUnits(log.burnAmount, 18, 2)} of your token` : '') +
      (log.treasuryAmount > 0n ? `
🏦 Treasury: +${formatUnits(log.treasuryAmount, treasury?.decimals ?? 18, 4)} ${treasury?.symbol || ''}` : '') +
      `
⏰ Next: ${scheduleLabel(config)}` +
      (results.failed.length ? `\n⚠️ ${results.failed.length} transfers failed` : '') +
      (log.errorMessage ? `\n⚠️ ${log.errorMessage}` : '')
    );
    console.log(`   Done: ${results.successful.length} paid, ${results.failed.length} failed`);
  } catch (error) {
    console.error('Cycle failed:', error);
    log.status = 'failed';
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
