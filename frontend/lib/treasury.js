// Balance sheet of a token's treasury: what the treasury wallet holds (from the
// ledger of what 0xdiv bought for it, plus ETH), priced with Yahoo (stocks)
// and ETH-USD, against the token's circulating supply and market cap.
import { parseAbi } from 'viem';
import { rpc } from './evm';
import { getQuotes } from './prices';
import { getStock, isNative, ZERO } from './stocks';

const erc20 = parseAbi(['function balanceOf(address) view returns (uint256)', 'function totalSupply() view returns (uint256)', 'function decimals() view returns (uint8)']);
const DEAD = '0x000000000000000000000000000000000000dEaD';
const cache = new Map();
const TTL = 60_000;

/**
 * @param {object} p
 * @param {string} p.treasuryAddress
 * @param {string[]} p.tokens distinct asset addresses ever bought for the treasury (zero address = ETH)
 * @param {string} p.sourceToken the project token (for supply)
 * @param {number|null} p.marketCap USD market cap from DexScreener, if known
 */
export async function treasurySheet({ treasuryAddress, tokens, sourceToken, marketCap }) {
  if (!treasuryAddress) return null;
  const key = `${treasuryAddress}:${tokens.join(',')}:${sourceToken}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) return { ...hit.sheet, marketCap, backedPct: marketCap ? (hit.sheet.totalUsd / marketCap) * 100 : null };

  const client = rpc();
  const assets = [...new Set([ZERO, ...tokens.map((t) => t.toLowerCase())])];
  const stocks = assets.map((a) => getStock(a)).filter(Boolean);
  const quotes = await getQuotes([...stocks.map((s) => s.ticker), 'ETH-USD']);
  const ethUsd = quotes['ETH-USD']?.price || 0;

  const holdings = [];
  for (const a of assets) {
    try {
      if (isNative(a)) {
        const wei = await client.getBalance({ address: treasuryAddress });
        const amount = Number(wei) / 1e18;
        if (amount > 0) holdings.push({ address: ZERO, symbol: 'ETH', name: 'Ether', amount, priceUsd: ethUsd, usd: amount * ethUsd });
        continue;
      }
      const [raw, decimals] = await Promise.all([
        client.readContract({ address: a, abi: erc20, functionName: 'balanceOf', args: [treasuryAddress] }),
        client.readContract({ address: a, abi: erc20, functionName: 'decimals' }),
      ]);
      const amount = Number(raw) / 10 ** Number(decimals);
      if (amount <= 0) continue;
      const s = getStock(a);
      const price = s ? quotes[s.ticker]?.price || 0 : 0;
      holdings.push({ address: a, symbol: s?.ticker || a.slice(2, 6).toUpperCase(), name: s?.name || 'Token', amount, priceUsd: price, usd: amount * price, changePct: s ? quotes[s.ticker]?.changePct ?? null : null });
    } catch { /* skip asset */ }
  }
  holdings.sort((x, y) => y.usd - x.usd);
  const totalUsd = holdings.reduce((s, h) => s + h.usd, 0);

  // Circulating supply = total supply minus what sits in the burn addresses.
  let circulating = null;
  let bookValuePerToken = null;
  try {
    const [supply, dec, dead, zero] = await Promise.all([
      client.readContract({ address: sourceToken, abi: erc20, functionName: 'totalSupply' }),
      client.readContract({ address: sourceToken, abi: erc20, functionName: 'decimals' }),
      client.readContract({ address: sourceToken, abi: erc20, functionName: 'balanceOf', args: [DEAD] }).catch(() => 0n),
      client.readContract({ address: sourceToken, abi: erc20, functionName: 'balanceOf', args: [ZERO] }).catch(() => 0n),
    ]);
    circulating = Number(supply - dead - zero) / 10 ** Number(dec);
    if (circulating > 0) bookValuePerToken = totalUsd / circulating;
  } catch { /* supply unknown */ }

  const sheet = { treasuryAddress, holdings, totalUsd, ethUsd, circulating, bookValuePerToken, updatedAt: new Date().toISOString() };
  cache.set(key, { sheet, ts: Date.now() });
  return { ...sheet, marketCap, backedPct: marketCap ? (totalUsd / marketCap) * 100 : null };
}
