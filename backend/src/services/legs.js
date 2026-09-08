// Fee routing legs. A config routes each cycle's fees to N destinations:
//   holders   the dividend, weighted by balance and loyalty
//   wallet    any address (the creator, a partner, a marketing wallet)
//   burn      buy back the project token and burn it
//   treasury  a wallet you control, recorded in the treasury ledger (book value)
// Every leg carries a share (bps, all legs sum to 10000) and an optional asset:
//   asset = null       pay in kind, whatever landed in the dev wallet
//   asset = 0x0…0      convert to ETH first
//   asset = <token>    buy that token first (a stock, or any ERC-20 by address)
// Configs made before routing existed derive their legs from the legacy split
// columns, so the executor only ever deals with legs.
import { isNative, isAddress, short, formatEth, formatUnits, explorerTx, NATIVE_ETH } from '../chain/config.js';
import { swapEthForToken, swapTokenForEth } from './swap.js';
import { burnTokens } from './airdrop.js';
import { describeReward } from './rewards.js';
import { stockOracle, tokenOracle } from './oracle.js';
import { effectiveSplit, sendAsset, DEFAULT_TREASURY_ASSET } from './treasury.js';
import * as db from '../db/queries.js';

export const LEG_KINDS = ['holders', 'wallet', 'burn', 'treasury'];

/** Legs for a config: the routing table when set, else the legacy 4-way split. */
export async function legsFor(config) {
  if (config.legs_enabled) {
    const rows = await db.getPolicyLegs(config.id);
    if (rows.length) return rows.map(normalizeLeg);
  }
  const s = effectiveSplit(config);
  const legs = [];
  if (s.holders > 0) legs.push({ id: 'holders', kind: 'holders', shareBps: s.holders, address: null, asset: null, label: 'Holders' });
  if (s.creator > 0 && isAddress(config.creator_address)) legs.push({ id: 'creator', kind: 'wallet', shareBps: s.creator, address: config.creator_address, asset: null, label: 'You' });
  if (s.burn > 0) legs.push({ id: 'burn', kind: 'burn', shareBps: s.burn, address: null, asset: null, label: 'Buyback & burn' });
  if (s.treasury > 0 && isAddress(config.treasury_address)) legs.push({ id: 'treasury', kind: 'treasury', shareBps: s.treasury, address: config.treasury_address, asset: null, label: 'Treasury', treasuryAsset: config.treasury_asset || DEFAULT_TREASURY_ASSET });
  return legs;
}

function normalizeLeg(r) {
  return { id: r.id, kind: r.kind, shareBps: Number(r.share_bps), address: r.address || null, asset: r.asset || null, label: r.label || defaultLabel(r.kind), treasuryAsset: r.kind === 'treasury' ? (r.asset || DEFAULT_TREASURY_ASSET) : null };
}
const defaultLabel = (kind) => ({ holders: 'Holders', wallet: 'Wallet', burn: 'Buyback & burn', treasury: 'Treasury' }[kind] || kind);

/** Human summary of a routing table: "70% holders · 20% 0x8a2f (GLD) · 10% treasury". */
export async function legsLabel(legs) {
  const parts = [];
  for (const l of legs) {
    let asset = '';
    if (l.asset) { try { asset = ` in ${(await describeReward(l.asset)).symbol}`; } catch { asset = ''; } }
    const who = l.kind === 'wallet' ? (l.label && l.label !== 'Wallet' ? l.label : short(l.address)) : l.label.toLowerCase();
    parts.push(`${l.shareBps / 100}% ${who}${asset}`);
  }
  return parts.join(' · ');
}

/** Amounts per leg for one asset, remainder to the holders leg (else the first leg). */
export function splitAmounts(total, legs) {
  const amounts = legs.map((l) => (total * BigInt(l.shareBps)) / 10000n);
  const used = amounts.reduce((a, b) => a + b, 0n);
  const sink = Math.max(0, legs.findIndex((l) => l.kind === 'holders'));
  if (amounts.length) amounts[sink] += total - used;
  return amounts;
}

/**
 * Convert an amount of one asset into another token via ETH. Returns the new
 * asset description with the amount received. Throws when no fair route exists.
 */
export async function convertAsset({ config, privateKey, asset, amount, toToken }) {
  let wei = amount;
  let sellTx = null;
  if (!asset.isNative) {
    const sold = await swapTokenForEth({ privateKey, token: asset.address, amountRaw: amount, slippageBps: 300 });
    if (!sold) throw new Error(`no ETH route for ${asset.symbol}`);
    wei = sold.ethOut;
    sellTx = sold.hash;
  }
  if (isNative(toToken)) return { address: NATIVE_ETH, symbol: 'ETH', decimals: 18, amount: wei, isNative: true, swapTx: sellTx };
  const target = await describeReward(toToken);
  const oracle = target.isStock ? await stockOracle(target.ticker) : await tokenOracle(target.address);
  console.log(`   Converting ${asset.isNative ? formatEth(wei, 4) + ' ETH' : formatUnits(amount, asset.decimals, 4) + ' ' + asset.symbol} into ${target.symbol}`);
  const swap = await swapEthForToken({ privateKey, token: target.address, decimals: target.decimals, amountWei: wei, slippageBps: config.slippage_bps || 150, oracle });
  return { address: target.address, symbol: target.symbol, decimals: target.decimals, amount: swap.outputAmount, isNative: false, swapTx: swap.hash };
}

/**
 * Run one non-holders leg for one asset. Never throws: returns { failed } so the
 * executor can fold the share back into the dividend.
 */
export async function runLeg({ config, privateKey, asset, amount, leg }) {
  if (amount <= 0n) return null;
  const base = { legId: leg.id, kind: leg.kind, label: leg.label, address: leg.address, input: { token: asset.address, symbol: asset.symbol, amount: amount.toString() } };
  try {
    let out = { address: asset.address, symbol: asset.symbol, decimals: asset.decimals, amount, isNative: asset.isNative, swapTx: null };
    let note = null;
    const target = leg.kind === 'burn' ? config.source_token_address : leg.kind === 'treasury' && asset.isNative ? leg.treasuryAsset : leg.asset;
    if (target && target.toLowerCase() !== asset.address.toLowerCase()) {
      try {
        out = await convertAsset({ config, privateKey, asset, amount, toToken: target });
      } catch (e) {
        if (leg.kind === 'burn') throw e;
        note = `paid in kind, conversion skipped: ${e.shortMessage || e.message}`;
        console.log(`   ${leg.label}: ${note}`);
      }
    }
    let hash;
    if (leg.kind === 'burn') {
      hash = await burnTokens(privateKey, config.source_token_address, out.amount);
      console.log(`   Burn: ${formatUnits(out.amount, 18, 2)} ${short(config.source_token_address)} burned (${explorerTx(hash)})`);
    } else {
      if (!isAddress(leg.address)) throw new Error('no destination address');
      hash = await sendAsset({ privateKey, asset: out, amount: out.amount, to: leg.address, label: `${leg.kind} leg` });
      console.log(`   ${leg.label}: ${formatUnits(out.amount, out.decimals, 4)} ${out.symbol} to ${short(leg.address)} (${explorerTx(hash)})`);
      if (leg.kind === 'treasury') {
        await db.insertTreasuryLedger({ configId: config.id, token: out.address, amount: out.amount, ethSpent: asset.isNative ? amount : (asset.valueWei && asset.amount ? (asset.valueWei * amount) / asset.amount : 0n), txHash: hash });
      }
    }
    return { ...base, output: { token: out.address, symbol: out.symbol, decimals: out.decimals, amount: out.amount.toString() }, tx: hash, swapTx: out.swapTx, note, out };
  } catch (e) {
    const failed = e.shortMessage || e.message;
    console.log(`   ${leg.label} leg failed: ${failed}`);
    return { ...base, failed };
  }
}
