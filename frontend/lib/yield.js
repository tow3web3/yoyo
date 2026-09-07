// Dividend yield: ETH returned to a token's holders (dividends, buybacks and
// treasury together) over the trailing 30 days, in USD, annualized, divided by
// market cap. Young tokens are annualized over their real age (at least one
// day) so a week-old token is not understated.
import { getYieldInputs } from './queries';
import { getQuotes } from './prices';

const DAY = 86_400_000;

export function computeYield({ eth30d, eth7d, cycles30d, firstAt, ethUsd, marketCap }) {
  const eth30 = Number(eth30d || 0) / 1e18;
  const eth7 = Number(eth7d || 0) / 1e18;
  const usd30d = eth30 * (ethUsd || 0);
  const ageDays = firstAt ? Math.max(1, (Date.now() - new Date(firstAt).getTime()) / DAY) : 30;
  const window = Math.min(30, ageDays);
  const annualizedUsd = window > 0 ? usd30d * (365 / window) : 0;
  const apy = marketCap > 0 && annualizedUsd > 0 ? (annualizedUsd / marketCap) * 100 : null;
  return { eth30d: eth30, eth7d: eth7, usd30d, annualizedUsd, apy, cycles30d: Number(cycles30d || 0), windowDays: Math.round(window * 10) / 10 };
}

/** Yield for one token (needs its market cap from token metadata). */
export async function tokenYield(address, marketCap) {
  const [row] = await getYieldInputs(address);
  const q = await getQuotes(['ETH-USD']);
  const ethUsd = q['ETH-USD']?.price || 0;
  if (!row) return computeYield({ eth30d: 0, eth7d: 0, cycles30d: 0, firstAt: null, ethUsd, marketCap });
  return computeYield({ eth30d: row.eth_30d, eth7d: row.eth_7d, cycles30d: row.cycles_30d, firstAt: row.first_at, ethUsd, marketCap });
}

/** Yield for every active token: address(lowercase) -> yield, given a marketCap lookup. */
export async function allYields(marketCapOf) {
  const rows = await getYieldInputs();
  const q = await getQuotes(['ETH-USD']);
  const ethUsd = q['ETH-USD']?.price || 0;
  const out = {};
  for (const r of rows) out[r.address] = computeYield({ eth30d: r.eth_30d, eth7d: r.eth_7d, cycles30d: r.cycles_30d, firstAt: r.first_at, ethUsd, marketCap: marketCapOf(r.address) });
  return out;
}

export const fmtApy = (apy) => (apy == null ? null : apy >= 100 ? `${Math.round(apy)}%` : apy >= 10 ? `${apy.toFixed(1)}%` : `${apy.toFixed(2)}%`);
