// The memecoins of Robinhood Chain, live: the most traded pools on GeckoTerminal,
// one entry per base token, stocks and the chain's plumbing tokens removed,
// enriched with DexScreener images and market caps. Cached five minutes.
import { getStock, isNative } from './stocks';
import { fetchTokenMeta } from './tokenMeta';

const IGNORE = new Set(['0x0bd7d308f8e1639fab988df18a8011f41eacad73', '0x5fc5360d0400a0fd4f2af552add042d716f1d168']); // WETH, USDG
const STABLE = /^(USD[A-Z]{0,3}|DAI|USDT|USDC|USDG)$/i;
const TTL = 5 * 60_000;
let cache = { at: 0, data: null };

async function gt(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`geckoterminal ${res.status}`);
  return res.json();
}

export async function listMemecoins(limit = 12) {
  if (cache.data && Date.now() - cache.at < TTL) return cache.data;
  const seen = new Map();
  for (const page of [1, 2]) {
    let j;
    try { j = await gt(`https://api.geckoterminal.com/api/v2/networks/robinhood/pools?page=${page}&sort=h24_volume_usd_desc&include=base_token`); } catch { break; }
    const tokens = new Map((j.included || []).filter((x) => x.type === 'token').map((x) => [x.id, x.attributes]));
    for (const p of j.data || []) {
      const id = p.relationships?.base_token?.data?.id;
      const t = tokens.get(id);
      const address = (t?.address || id?.split('_')[1] || '').toLowerCase();
      if (!address || IGNORE.has(address) || isNative(address) || getStock(address)) continue;
      const sym = t?.symbol || '';
      if (STABLE.test(sym) || /^(UNI-V2|WETH)$/i.test(sym)) continue;
      const a = p.attributes;
      const prev = seen.get(address);
      const row = {
        address, symbol: sym, name: t?.name || sym, image: t?.image_url && t.image_url !== 'missing.png' ? t.image_url : null,
        priceUsd: Number(a.base_token_price_usd) || null, change24: a.price_change_percentage?.h24 != null ? Number(a.price_change_percentage.h24) : null,
        volume24: (prev?.volume24 || 0) + (Number(a.volume_usd?.h24) || 0), liquidityUsd: (prev?.liquidityUsd || 0) + (Number(a.reserve_in_usd) || 0),
        fdv: Number(a.fdv_usd) || null, marketCap: Number(a.market_cap_usd) || null, pools: (prev?.pools || 0) + 1,
      };
      seen.set(address, prev ? { ...prev, volume24: row.volume24, liquidityUsd: row.liquidityUsd, pools: row.pools } : row);
    }
    if (seen.size >= limit * 2) break;
  }
  let rows = [...seen.values()].sort((a, b) => b.volume24 - a.volume24).slice(0, limit);
  // DexScreener fills images and market caps GeckoTerminal lacks
  try {
    const meta = await fetchTokenMeta(rows.map((r) => r.address));
    rows = rows.map((r) => ({ ...r, image: r.image || meta[r.address]?.image || null, marketCap: r.marketCap ?? meta[r.address]?.marketCap ?? r.fdv ?? null }));
  } catch { /* keep what we have */ }
  cache = { at: Date.now(), data: rows };
  return rows;
}
