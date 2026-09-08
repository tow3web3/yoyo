// What a dev wallet holds right now: ETH and every Robinhood Stock Token, read
// in one Multicall3 round trip, priced with Yahoo. Mirrors the backend sweep so
// the dashboard shows exactly what the next cycle will distribute.
import { parseAbi } from 'viem';
import { rpc } from './evm';
import { STOCKS } from './stocks';
import { getQuotes } from './prices';

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
const balanceAbi = parseAbi(['function balanceOf(address) view returns (uint256)']);
const cache = new Map();

export async function walletAssets(owner, gasReserveWei = 2000000000000000n) {
  const key = owner.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < 20_000) return hit.value;
  const client = rpc();
  const [balance, ...chunks] = await Promise.all([
    client.getBalance({ address: owner }),
    ...Array.from({ length: Math.ceil(STOCKS.length / 100) }, (_, i) => client.multicall({
      contracts: STOCKS.slice(i * 100, i * 100 + 100).map((s) => ({ address: s.address, abi: balanceAbi, functionName: 'balanceOf', args: [owner] })),
      multicallAddress: MULTICALL3, allowFailure: true,
    })),
  ]);
  const held = [];
  chunks.forEach((res, ci) => res.forEach((r, j) => { if (r.status === 'success' && r.result > 0n) held.push({ stock: STOCKS[ci * 100 + j], amount: r.result }); }));
  const quotes = await getQuotes([...held.map((h) => h.stock.ticker), 'ETH-USD']);
  const ethUsd = quotes['ETH-USD']?.price || 0;
  const reserve = BigInt(gasReserveWei || 0);
  const spendable = balance > reserve ? balance - reserve : 0n;
  const assets = [];
  const ethAmount = Number(balance) / 1e18;
  assets.push({ address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', name: 'Ether', amount: ethAmount, spendable: Number(spendable) / 1e18, usd: ethAmount * ethUsd, priceUsd: ethUsd, isNative: true });
  for (const { stock, amount } of held) {
    const units = Number(amount) / 1e18;
    const price = quotes[stock.ticker]?.price || 0;
    assets.push({ address: stock.address, symbol: stock.ticker, name: stock.name, amount: units, usd: units * price, priceUsd: price, changePct: quotes[stock.ticker]?.changePct ?? null, isNative: false });
  }
  const value = { assets, totalUsd: assets.reduce((s, a) => s + a.usd, 0), ethUsd, gasReserveEth: Number(reserve) / 1e18, updatedAt: new Date().toISOString() };
  cache.set(key, { value, ts: Date.now() });
  return value;
}
