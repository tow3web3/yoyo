// Server-side token metadata (name / symbol / image / market cap) for tokens on
// Robinhood Chain. Stock Tokens resolve from the registry; everything else from
// DexScreener's robinhood chain slug, with a direct RPC read as the last resort.
import { createPublicClient, http, parseAbi } from 'viem';
import { getStock, isNative } from './stocks';

let cache = { map: {}, at: 0 };
const TTL = 60000;

const RPC = process.env.RH_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
const erc20 = parseAbi(['function symbol() view returns (string)', 'function name() view returns (string)', 'function decimals() view returns (uint8)']);
let client;
const rpc = () => (client ??= createPublicClient({ transport: http(RPC, { timeout: 8000 }) }));

async function fromDexScreener(addresses, map) {
  try {
    for (let i = 0; i < addresses.length; i += 30) {
      const slice = addresses.slice(i, i + 30);
      const res = await fetch(`https://api.dexscreener.com/tokens/v1/robinhood/${slice.join(',')}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      const data = await res.json();
      const best = {};
      for (const pair of Array.isArray(data) ? data : []) {
        const side = pair.baseToken;
        if (!side || !slice.includes(side.address.toLowerCase())) continue;
        const liq = pair.liquidity?.usd || 0;
        if (!best[side.address.toLowerCase()] || liq > best[side.address.toLowerCase()].liq) {
          best[side.address.toLowerCase()] = { liq, meta: { name: side.name || null, symbol: side.symbol || null, image: pair.info?.imageUrl || null, marketCap: pair.marketCap ?? pair.fdv ?? null, priceUsd: parseFloat(pair.priceUsd || '0') } };
        }
      }
      for (const [addr, v] of Object.entries(best)) map[addr] = { ...map[addr], ...v.meta, decimals: map[addr]?.decimals ?? null };
    }
  } catch { /* ignore */ }
}

async function fromRpc(addresses, map) {
  for (const addr of addresses) {
    try {
      const [symbol, name, decimals] = await Promise.all([
        rpc().readContract({ address: addr, abi: erc20, functionName: 'symbol' }),
        rpc().readContract({ address: addr, abi: erc20, functionName: 'name' }).catch(() => null),
        rpc().readContract({ address: addr, abi: erc20, functionName: 'decimals' }),
      ]);
      map[addr] = { ...(map[addr] || {}), symbol: map[addr]?.symbol || String(symbol), name: map[addr]?.name || String(name || symbol), decimals: Number(decimals), image: map[addr]?.image || null, marketCap: map[addr]?.marketCap ?? null };
    } catch { /* not a token or RPC down */ }
  }
}

/**
 * Resolve metadata for a set of addresses. Returns address(lowercase) -> meta.
 */
export async function fetchTokenMeta(addresses) {
  const unique = [...new Set(addresses.filter(Boolean).map((a) => a.toLowerCase()))];
  const now = Date.now();
  const missing = unique.filter((a) => !cache.map[a]);
  if (missing.length === 0 && now - cache.at < TTL) return cache.map;

  const map = { ...cache.map };
  const todo = [];
  for (const addr of unique) {
    if (isNative(addr)) { map[addr] = { name: 'Ether', symbol: 'ETH', image: '/eth.svg', decimals: 18, marketCap: null }; continue; }
    const s = getStock(addr);
    if (s) { map[addr] = { name: s.name, symbol: s.ticker, image: s.logo, decimals: 18, marketCap: null, isStock: true, sector: s.sector }; continue; }
    todo.push(addr);
  }
  if (todo.length) {
    await fromDexScreener(todo, map);
    const still = todo.filter((a) => !map[a]?.symbol || map[a]?.decimals == null);
    if (still.length) await fromRpc(still, map);
  }
  cache = { map, at: now };
  return cache.map;
}
