// Probe the swap route for a stock without sending anything:
//   node scripts/probe-stock.mjs NVDA 0.01
// Prints the best route across Uniswap V4 / V3 / V2 and its ratio to the Yahoo fair price.
import { parseEther } from 'viem';
import { getStock, STOCKS, LIQUID_TICKERS } from '../src/chain/stocks.js';
import { quoteEthForToken, MIN_FAIR_RATIO } from '../src/services/swap.js';
import { stockOracle } from '../src/services/oracle.js';
import { ZERO } from '../src/chain/config.js';

const arg = process.argv[2] || 'NVDA';
const eth = process.argv[3] || '0.01';
const amountWei = parseEther(eth);
const targets = arg === 'ALL' ? STOCKS : arg === 'LIQUID' ? LIQUID_TICKERS.map(getStock) : [getStock(arg)].filter(Boolean);
if (!targets.length) { console.error(`Unknown ticker ${arg}`); process.exit(1); }

for (const s of targets) {
  const oracle = await stockOracle(s.ticker);
  let fairOut = null;
  if (oracle) fairOut = BigInt(Math.floor((Number(amountWei) / 1e18) * (oracle.ethUsd / oracle.stockUsd) * 1e18));
  const q = await quoteEthForToken({ token: s.address, amountWei, recipient: ZERO, fairOut });
  const price = oracle ? `$${oracle.stockUsd.toFixed(2)}` : 'no oracle';
  if (!q) console.log(`${s.ticker.padEnd(6)} ${price.padEnd(10)} no route above ${(MIN_FAIR_RATIO * 100).toFixed(0)}% of fair for ${eth} ETH`);
  else console.log(`${s.ticker.padEnd(6)} ${price.padEnd(10)} ${q.route.label} -> ${(Number(q.route.out) / 1e18).toFixed(6)} ${s.ticker}${q.ratio !== null ? ` (${(q.ratio * 100).toFixed(1)}% of fair)` : ''}`);
}
