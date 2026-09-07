// One dividend cycle for one config:
//   claim fees -> ETH available -> pick reward -> buy it (fair-price guarded)
//   -> eligible holders -> pro-rata split -> pay (or burn) -> log + notify.
import { parseEther } from 'viem';
import * as db from '../db/queries.js';
import { decryptPrivateKey } from '../services/encryption.js';
import { accountFromKey, explorerTx, formatEth, formatUnits, short, readTokenMeta } from '../chain/config.js';
import { announceDividend } from '../services/announce.js';
import { claimFees, availableEth } from '../services/fees.js';
import { swapEthForToken } from '../services/swap.js';
import { getTokenHolders, applyLoyalty, loyaltyLabel } from '../services/holders.js';
import { distributeTokens, distributeEth, burnTokens, calculateDistributions } from '../services/airdrop.js';
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

    // 3. Reward
    let reward = await resolveReward(config);
    console.log(`3. Reward: ${reward.symbol}${reward.note ? ` (${reward.note})` : ''}`);

    // 4. Buy
    let amountToDistribute = spendable;
    if (!reward.isNative) {
      const oracle = reward.isStock ? await stockOracle(reward.ticker) : null;
      if (reward.isStock && !oracle) console.log('   Oracle unavailable, swap will run unguarded');
      try {
        console.log(`4. Buying ${reward.symbol} with ${formatEth(spendable)} ETH`);
        const swap = await swapEthForToken({
          privateKey, token: reward.address, decimals: reward.decimals, amountWei: spendable,
          slippageBps: config.slippage_bps || 150, oracle,
        });
        log.swapTx = swap.hash;
        log.boughtTokenAmount = swap.outputAmount;
        amountToDistribute = swap.outputAmount;
      } catch (e) {
        // No fair route: holders still get paid, in ETH, and the run says why.
        console.log(`   Swap skipped: ${e.shortMessage || e.message}. Paying ETH instead.`);
        log.errorMessage = `Paid ETH: ${e.shortMessage || e.message}`;
        reward = { ...(await describeReward(null)), mode: reward.mode, note: 'ETH fallback' };
        amountToDistribute = spendable;
      }
    }
    log.rewardTokenUsed = reward.address;

    // 5. Burn destination short-circuits the holder scan.
    if (log.destination === 'burn' && !reward.isNative) {
      console.log('5. Burning the bought tokens');
      const hash = await burnTokens(privateKey, reward.address, amountToDistribute);
      log.totalAirdropped = amountToDistribute;
      log.status = 'success';
      const saved = await db.createExecutionLog(log);
      await db.createAirdropTransactionsBatch([{ executionLogId: saved.id, holderAddress: '0x000000000000000000000000000000000000dEaD', holderBalance: '0', airdropAmount: amountToDistribute.toString(), txHash: hash, status: 'success' }]);
      await db.updateLastExecution(config.id);
      await notifyUser(config.user_id, `🔥 *Buyback and burn done*\n\n💰 Spent: ${formatEth(spendable, 4)} ETH\n🔥 Burned: ${formatUnits(amountToDistribute, reward.decimals, 4)} ${reward.symbol}\n🔗 ${explorerTx(hash)}`);
      return;
    }

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

    // Receipt into the creator's group (bound with /announce), never fatal.
    if (results.successful.length > 0) {
      const sourceMeta = await readTokenMeta(config.source_token_address).catch(() => null);
      await announceDividend({
        config, log: saved, reward, sourceSymbol: sourceMeta?.symbol || short(config.source_token_address),
        results, spendableWei: spendable, holdersTotal: holders.length,
      });
    }

    const modeLine = reward.note ? `\n${reward.mode === 'roulette' ? '🎰' : reward.mode === 'gainer' ? '🚀' : reward.mode === 'portfolio' ? '📊' : reward.mode === 'vote' ? '🗳️' : 'ℹ️'} ${reward.note}` : '';
    await notifyUser(config.user_id,
      `✅ *Dividend paid*${modeLine}\n\n` +
      `💰 Fees used: ${formatEth(spendable, 4)} ETH\n` +
      `📈 Paid out: ${formatUnits(results.totalSent, reward.decimals, 4)} ${reward.symbol}\n` +
      `👥 Recipients: ${results.successful.length}/${holders.length} holders\n` +
      `⏰ Next: ${scheduleLabel(config)}` +
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
