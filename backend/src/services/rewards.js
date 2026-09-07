// Reward modes: what holders get paid in on a given cycle.
//   fixed      one token, chosen by the creator (a stock, ETH, or any ERC-20)
//   roulette   a random liquid Stock Token every cycle
//   portfolio  rotates through a basket, one stock per cycle
//   gainer     the day's best-performing stock in the liquid pool
//   vote       whatever holders voted for (see voteService)
import { NATIVE_ETH, isNative, readTokenMeta } from '../chain/config.js';
import { getStock, BASKETS, LIQUID_STOCKS, pickRandomLiquid } from '../chain/stocks.js';
import { getQuotes } from './oracle.js';
import { getCurrentRewardToken } from './voteService.js';
import * as db from '../db/queries.js';

export const REWARD_MODES = {
  fixed: { label: 'Fixed reward', emoji: '🎯' },
  roulette: { label: 'Stock Roulette', emoji: '🎰' },
  portfolio: { label: 'Portfolio', emoji: '📊' },
  gainer: { label: 'Top Gainer', emoji: '🚀' },
  vote: { label: 'Community Vote', emoji: '🗳️' },
};

/** Describe any reward address: stock registry first, then on-chain metadata. */
export async function describeReward(address) {
  if (isNative(address)) return { address: NATIVE_ETH, symbol: 'ETH', name: 'Ether', decimals: 18, ticker: null, isNative: true, isStock: false };
  const stock = getStock(address);
  if (stock) return { address: stock.address, symbol: stock.ticker, name: stock.name, decimals: 18, ticker: stock.ticker, isNative: false, isStock: true, logo: stock.logo };
  const meta = await readTokenMeta(address);
  if (!meta) throw new Error(`Reward token ${address} is not an ERC-20`);
  return { ...meta, ticker: null, isNative: false, isStock: false };
}

/** Pick this cycle's reward for a config. Returns the described reward plus a note. */
export async function resolveReward(config) {
  const mode = config.reward_mode || 'fixed';

  if (mode === 'roulette') {
    const s = pickRandomLiquid();
    return { ...(await describeReward(s.address)), mode, note: `Roulette landed on ${s.ticker}` };
  }

  if (mode === 'portfolio') {
    const basket = BASKETS[config.basket] || BASKETS.MAG7;
    const idx = Number(config.portfolio_cursor || 0) % basket.tickers.length;
    const s = getStock(basket.tickers[idx]);
    await db.advancePortfolioCursor(config.id, (idx + 1) % basket.tickers.length);
    return { ...(await describeReward(s.address)), mode, note: `${basket.label} ${idx + 1}/${basket.tickers.length}: ${s.ticker}` };
  }

  if (mode === 'gainer') {
    const quotes = await getQuotes(LIQUID_STOCKS.map((s) => s.ticker));
    let best = null;
    for (const s of LIQUID_STOCKS) {
      const q = quotes[s.ticker];
      if (q && typeof q.changePct === 'number' && (!best || q.changePct > best.changePct)) best = { stock: s, changePct: q.changePct };
    }
    if (!best) {
      const s = pickRandomLiquid();
      return { ...(await describeReward(s.address)), mode, note: `No market data, roulette fallback: ${s.ticker}` };
    }
    const sign = best.changePct >= 0 ? '+' : '';
    return { ...(await describeReward(best.stock.address)), mode, note: `Top gainer today: ${best.stock.ticker} (${sign}${best.changePct.toFixed(2)}%)` };
  }

  if (mode === 'vote') {
    const voted = await getCurrentRewardToken(config.id);
    if (voted) return { ...(await describeReward(voted)), mode, note: 'Community vote winner' };
    return { ...(await describeReward(config.target_token_address)), mode, note: 'No resolved vote yet, fixed reward used' };
  }

  return { ...(await describeReward(config.target_token_address)), mode: 'fixed', note: null };
}
