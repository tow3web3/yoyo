// The dividend policy of a token, in basis points that sum to 10000:
//   holders   payout ratio: the dividend itself
//   creator   what the creator keeps, sent to their payout address
//   burn      buyback and burn of the project token
//   treasury  retained earnings: stocks accumulated in a treasury wallet
// A share whose destination address is missing goes to holders.
import { erc20Abi, publicClient, walletFor, confirm, explorerTx, isAddress, formatEth, formatUnits, short, isNative } from '../chain/config.js';
import { getStock } from '../chain/stocks.js';
import { swapEthForToken, swapTokenForEth } from './swap.js';
import { burnTokens } from './airdrop.js';
import { describeReward } from './rewards.js';
import { stockOracle } from './oracle.js';
import * as db from '../db/queries.js';

export const DEFAULT_TREASURY_ASSET = getStock('SPY').address;

export const SPLIT_PRESETS = [
  { key: '100-0-0-0', label: '🎁 100% to holders', holders: 10000, creator: 0, burn: 0, treasury: 0 },
  { key: '80-20-0-0', label: '🎁 80% holders · 👤 20% you', holders: 8000, creator: 2000, burn: 0, treasury: 0 },
  { key: '70-30-0-0', label: '🎁 70% holders · 👤 30% you', holders: 7000, creator: 3000, burn: 0, treasury: 0 },
  { key: '70-0-0-30', label: '🎁 70% holders · 🏦 30% treasury', holders: 7000, creator: 0, burn: 0, treasury: 3000 },
  { key: '60-20-0-20', label: '🎁 60% · 👤 20% · 🏦 20%', holders: 6000, creator: 2000, burn: 0, treasury: 2000 },
  { key: '50-20-15-15', label: '🎁 50% · 👤 20% · 🔥 15% · 🏦 15%', holders: 5000, creator: 2000, burn: 1500, treasury: 1500 },
  { key: '0-0-100-0', label: '🔥 100% buyback and burn', holders: 0, creator: 0, burn: 10000, treasury: 0 },
  { key: '0-0-0-100', label: '🏦 100% treasury', holders: 0, creator: 0, burn: 0, treasury: 10000 },
];

/** Effective split (legacy destination=burn means 100% burn; missing addresses fold into holders). */
export function effectiveSplit(config) {
  let h = Number(config.split_holders_bps ?? 10000);
  let c = Number(config.split_creator_bps ?? 0);
  let b = Number(config.split_burn_bps ?? 0);
  let t = Number(config.split_treasury_bps ?? 0);
  if (config.destination === 'burn' && h === 10000 && c === 0 && b === 0 && t === 0) { h = 0; b = 10000; }
  if (t > 0 && !isAddress(config.treasury_address)) { h += t; t = 0; }
  if (c > 0 && !isAddress(config.creator_address)) { h += c; c = 0; }
  return { holders: h, creator: c, burn: b, treasury: t };
}

export function splitLabel(config) {
  const s = effectiveSplit(config);
  const parts = [];
  if (s.holders) parts.push(`${s.holders / 100}% holders`);
  if (s.creator) parts.push(`${s.creator / 100}% you`);
  if (s.burn) parts.push(`${s.burn / 100}% burn`);
  if (s.treasury) parts.push(`${s.treasury / 100}% treasury`);
  return parts.join(' · ') || 'nothing';
}

export const legAmount = (total, bps) => (total * BigInt(bps)) / 10000n;

/** Send a share of an asset (ETH or ERC-20) to an address. */
export async function sendAsset({ privateKey, asset, amount, to, label }) {
  if (amount <= 0n) return null;
  const { wallet } = walletFor(privateKey);
  const hash = asset.isNative
    ? await wallet.sendTransaction({ to, value: amount })
    : await wallet.writeContract({ address: asset.address, abi: erc20Abi, functionName: 'transfer', args: [to, amount] });
  await confirm(hash, label);
  return hash;
}

/** Creator share: straight to the creator's payout address. */
export async function runCreatorLeg({ config, privateKey, asset, amount }) {
  if (amount <= 0n || !isAddress(config.creator_address)) return null;
  try {
    const hash = await sendAsset({ privateKey, asset, amount, to: config.creator_address, label: 'creator payout' });
    console.log(`   Creator share: ${formatUnits(amount, asset.decimals, 4)} ${asset.symbol} to ${short(config.creator_address)} (${explorerTx(hash)})`);
    return { amount, hash };
  } catch (e) {
    console.log(`   Creator leg failed: ${e.shortMessage || e.message}`);
    return { failed: e.shortMessage || e.message };
  }
}

/**
 * Burn leg: buy the project token with ETH and burn it. A stock share is sold
 * for ETH first.
 */
export async function runBurnLeg({ config, privateKey, asset, amount }) {
  if (amount <= 0n) return null;
  try {
    let wei = amount;
    if (!asset.isNative) {
      const sold = await swapTokenForEth({ privateKey, token: asset.address, amountRaw: amount, slippageBps: 300 });
      if (!sold) throw new Error(`no ETH route for ${asset.symbol}`);
      wei = sold.ethOut;
    }
    console.log(`   Burn leg: buying ${short(config.source_token_address)} with ${formatEth(wei, 4)} ETH`);
    const swap = await swapEthForToken({ privateKey, token: config.source_token_address, decimals: 18, amountWei: wei, slippageBps: Math.max(300, config.slippage_bps || 150) });
    const hash = await burnTokens(privateKey, config.source_token_address, swap.outputAmount);
    return { amount: swap.outputAmount, hash, swapTx: swap.hash };
  } catch (e) {
    console.log(`   Burn leg skipped: ${e.shortMessage || e.message}`);
    return { failed: e.shortMessage || e.message };
  }
}

/**
 * Treasury leg. A stock share moves to the treasury as is (retained earnings in
 * kind). An ETH share buys the treasury asset (guarded), falling back to ETH.
 */
export async function runTreasuryLeg({ config, privateKey, asset, amount, fallbackAsset }) {
  if (amount <= 0n || !isAddress(config.treasury_address)) return null;
  if (!asset.isNative) {
    try {
      const hash = await sendAsset({ privateKey, asset, amount, to: config.treasury_address, label: 'treasury transfer' });
      await db.insertTreasuryLedger({ configId: config.id, token: asset.address, amount, ethSpent: asset.valueWei ?? 0n, txHash: hash });
      console.log(`   Treasury: +${formatUnits(amount, asset.decimals, 4)} ${asset.symbol} in kind (${explorerTx(hash)})`);
      return { token: asset.address, symbol: asset.symbol, decimals: asset.decimals, amount, hash };
    } catch (e) {
      return { failed: e.shortMessage || e.message };
    }
  }
  const assetAddr = config.treasury_asset || fallbackAsset || DEFAULT_TREASURY_ASSET;
  const target = await describeReward(assetAddr);
  const { wallet } = walletFor(privateKey);
  try {
    if (target.isNative) throw new Error('treasury asset is ETH');
    const oracle = target.isStock ? await stockOracle(target.ticker) : null;
    console.log(`   Treasury leg: buying ${target.symbol} with ${formatEth(amount, 4)} ETH for ${short(config.treasury_address)}`);
    const swap = await swapEthForToken({ privateKey, token: target.address, decimals: target.decimals, amountWei: amount, slippageBps: config.slippage_bps || 150, oracle });
    const hash = await wallet.writeContract({ address: target.address, abi: erc20Abi, functionName: 'transfer', args: [config.treasury_address, swap.outputAmount] });
    await confirm(hash, 'treasury transfer');
    await db.insertTreasuryLedger({ configId: config.id, token: target.address, amount: swap.outputAmount, ethSpent: amount, txHash: hash });
    return { token: target.address, symbol: target.symbol, decimals: target.decimals, amount: swap.outputAmount, hash };
  } catch (e) {
    console.log(`   Treasury asset unavailable (${e.shortMessage || e.message}), sending ETH to the treasury instead`);
    try {
      const hash = await wallet.sendTransaction({ to: config.treasury_address, value: amount });
      await confirm(hash, 'treasury ETH transfer');
      await db.insertTreasuryLedger({ configId: config.id, token: '0x0000000000000000000000000000000000000000', amount, ethSpent: amount, txHash: hash });
      return { token: '0x0000000000000000000000000000000000000000', symbol: 'ETH', decimals: 18, amount, hash, note: 'ETH fallback' };
    } catch (e2) {
      return { failed: e2.shortMessage || e2.message };
    }
  }
}

export { isNative, publicClient };
