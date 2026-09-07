// Fee split and the stock treasury.
//
// Each cycle's spendable ETH is cut three ways (basis points, sum 10000):
//   holders   -> the dividend pipeline (swap to reward, pay pro-rata)
//   burn      -> buy the project's own token and send it to the dead address
//   treasury  -> buy the treasury asset (a stock, SPY by default) and send it to
//                the creator's treasury address. Over time the token carries a
//                real balance sheet, and the dashboard publishes its book value.
import { erc20Abi, publicClient, walletFor, confirm, explorerTx, isAddress, formatEth, formatUnits, short } from '../chain/config.js';
import { getStock } from '../chain/stocks.js';
import { swapEthForToken } from './swap.js';
import { burnTokens } from './airdrop.js';
import { describeReward } from './rewards.js';
import { stockOracle } from './oracle.js';
import * as db from '../db/queries.js';

export const DEFAULT_TREASURY_ASSET = getStock('SPY').address;

export const SPLIT_PRESETS = [
  { key: '100-0-0', label: '🎁 100% holders', holders: 10000, burn: 0, treasury: 0 },
  { key: '70-0-30', label: '🎁 70% holders · 🏦 30% treasury', holders: 7000, burn: 0, treasury: 3000 },
  { key: '70-30-0', label: '🎁 70% holders · 🔥 30% burn', holders: 7000, burn: 3000, treasury: 0 },
  { key: '50-25-25', label: '🎁 50% · 🔥 25% · 🏦 25%', holders: 5000, burn: 2500, treasury: 2500 },
  { key: '0-100-0', label: '🔥 100% buyback and burn', holders: 0, burn: 10000, treasury: 0 },
  { key: '0-0-100', label: '🏦 100% treasury', holders: 0, burn: 0, treasury: 10000 },
];

/** Effective split of a config (legacy destination=burn means 100% burn). */
export function effectiveSplit(config) {
  let h = Number(config.split_holders_bps ?? 10000);
  let b = Number(config.split_burn_bps ?? 0);
  let t = Number(config.split_treasury_bps ?? 0);
  if (config.destination === 'burn' && h === 10000 && b === 0 && t === 0) { h = 0; b = 10000; }
  // Treasury leg needs a destination address; without one its share goes to holders.
  if (t > 0 && !isAddress(config.treasury_address)) { h += t; t = 0; }
  return { holders: h, burn: b, treasury: t };
}

export function splitLabel(config) {
  const s = effectiveSplit(config);
  const parts = [];
  if (s.holders) parts.push(`${s.holders / 100}% holders`);
  if (s.burn) parts.push(`${s.burn / 100}% burn`);
  if (s.treasury) parts.push(`${s.treasury / 100}% treasury`);
  return parts.join(' · ') || 'nothing';
}

export const legWei = (spendable, bps) => (spendable * BigInt(bps)) / 10000n;

/**
 * Buyback and burn of the project token with `wei` ETH.
 * @returns {{amount: bigint, hash: string} | {failed: string}}
 */
export async function runBurnLeg({ config, privateKey, wei }) {
  if (wei <= 0n) return null;
  try {
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
 * Treasury leg: buy the treasury asset (guarded) and move it to the treasury
 * address. If no fair route exists, the ETH itself goes to the treasury.
 */
export async function runTreasuryLeg({ config, privateKey, wei, fallbackAsset }) {
  if (wei <= 0n || !isAddress(config.treasury_address)) return null;
  const { account, wallet } = walletFor(privateKey);
  const assetAddr = config.treasury_asset || fallbackAsset || DEFAULT_TREASURY_ASSET;
  const asset = await describeReward(assetAddr);
  try {
    if (asset.isNative) throw new Error('treasury asset is ETH');
    const oracle = asset.isStock ? await stockOracle(asset.ticker) : null;
    console.log(`   Treasury leg: buying ${asset.symbol} with ${formatEth(wei, 4)} ETH for ${short(config.treasury_address)}`);
    const swap = await swapEthForToken({ privateKey, token: asset.address, decimals: asset.decimals, amountWei: wei, slippageBps: config.slippage_bps || 150, oracle });
    const hash = await wallet.writeContract({ address: asset.address, abi: erc20Abi, functionName: 'transfer', args: [config.treasury_address, swap.outputAmount] });
    await confirm(hash, 'treasury transfer');
    await db.insertTreasuryLedger({ configId: config.id, token: asset.address, amount: swap.outputAmount, ethSpent: wei, txHash: hash });
    console.log(`   Treasury: +${formatUnits(swap.outputAmount, asset.decimals, 4)} ${asset.symbol} (${explorerTx(hash)})`);
    return { token: asset.address, symbol: asset.symbol, decimals: asset.decimals, amount: swap.outputAmount, hash };
  } catch (e) {
    console.log(`   Treasury asset unavailable (${e.shortMessage || e.message}), sending ETH to the treasury instead`);
    try {
      const hash = await wallet.sendTransaction({ to: config.treasury_address, value: wei });
      await confirm(hash, 'treasury ETH transfer');
      await db.insertTreasuryLedger({ configId: config.id, token: '0x0000000000000000000000000000000000000000', amount: wei, ethSpent: wei, txHash: hash });
      return { token: '0x0000000000000000000000000000000000000000', symbol: 'ETH', decimals: 18, amount: wei, hash, note: 'ETH fallback' };
    } catch (e2) {
      console.log(`   Treasury leg failed: ${e2.shortMessage || e2.message}`);
      return { failed: e2.shortMessage || e2.message };
    }
  }
  // account unused warning guard
  void account;
}
