// What the dev wallet holds that can be paid out this cycle: ETH above the gas
// reserve, and every Robinhood Stock Token the launchpad paid the creator in.
// Stock balances are read in one Multicall3 round trip (195 balanceOf calls);
// each asset carries an ETH-equivalent value from the Yahoo oracle so splits,
// dust thresholds and the yield metric all speak the same unit.
import { parseAbi, parseEther } from 'viem';
import { publicClient, erc20Abi, ZERO, NATIVE_ETH, formatEth, formatUnits } from '../chain/config.js';
import { STOCKS } from '../chain/stocks.js';
import { getQuotes } from './oracle.js';
import { swapTokenForEth } from './swap.js';

export const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
// Below this ETH-equivalent value an asset leg is dust and waits for the next cycle.
export const MIN_ASSET_VALUE_WEI = parseEther(process.env.MIN_ASSET_VALUE_ETH || '0.0003');

const balanceAbi = parseAbi(['function balanceOf(address) view returns (uint256)']);

/** Raw balances of every registry stock held by `owner`, via Multicall3. */
export async function stockBalances(owner) {
  const client = publicClient();
  const out = [];
  for (let i = 0; i < STOCKS.length; i += 100) {
    const slice = STOCKS.slice(i, i + 100);
    const res = await client.multicall({
      contracts: slice.map((s) => ({ address: s.address, abi: balanceAbi, functionName: 'balanceOf', args: [owner] })),
      multicallAddress: MULTICALL3,
      allowFailure: true,
    });
    res.forEach((r, j) => {
      if (r.status === 'success' && r.result > 0n) out.push({ stock: slice[j], amount: r.result });
    });
  }
  return out;
}

/**
 * Everything payable this cycle.
 * @returns {Promise<Array<{address, symbol, name, decimals, ticker, isNative, isStock, amount: bigint, valueWei: bigint, priceUsd}>>}
 */
export async function collectAssets({ owner, gasReserveWei, includeStocks = true }) {
  const client = publicClient();
  const assets = [];
  const balance = await client.getBalance({ address: owner });
  const reserve = BigInt(gasReserveWei || 0);
  const spendable = balance > reserve ? balance - reserve : 0n;
  if (spendable > 0n) assets.push({ address: NATIVE_ETH, symbol: 'ETH', name: 'Ether', decimals: 18, ticker: null, isNative: true, isStock: false, amount: spendable, valueWei: spendable, priceUsd: null });

  if (includeStocks) {
    const held = await stockBalances(owner);
    if (held.length) {
      const quotes = await getQuotes([...held.map((h) => h.stock.ticker), 'ETH-USD']);
      const ethUsd = quotes['ETH-USD']?.price || 0;
      for (const { stock, amount } of held) {
        const usd = quotes[stock.ticker]?.price || 0;
        const units = Number(amount) / 1e18;
        const valueWei = ethUsd > 0 && usd > 0 ? parseEther((units * usd / ethUsd).toFixed(18)) : 0n;
        assets.push({ address: stock.address, symbol: stock.ticker, name: stock.name, decimals: 18, ticker: stock.ticker, isNative: false, isStock: true, amount, valueWei, priceUsd: usd || null });
      }
    }
  }
  return assets;
}

export function describeAssets(assets) {
  return assets.map((a) => `${a.isNative ? formatEth(a.amount, 4) : formatUnits(a.amount, a.decimals, 4)} ${a.symbol}${a.isNative ? '' : ` (~${formatEth(a.valueWei, 4)} ETH)`}`).join(', ');
}

/** Convert mode: sell every stock in the wallet for ETH before the ETH pipeline runs. */
export async function liquidateStocks({ privateKey, owner }) {
  const held = await stockBalances(owner);
  const notes = [];
  for (const { stock, amount } of held) {
    try {
      const sold = await swapTokenForEth({ privateKey, token: stock.address, amountRaw: amount, slippageBps: 300 });
      if (sold) notes.push(`${stock.ticker} sold for ${formatEth(sold.ethOut, 4)} ETH`);
      else notes.push(`${stock.ticker} kept (no route)`);
    } catch (e) {
      notes.push(`${stock.ticker} kept: ${e.shortMessage || e.message}`);
    }
  }
  return notes;
}

export { ZERO };
