// Research card data for any token on Robinhood Chain: image, price, 24h change,
// liquidity, volume, market cap and a small price series. Sources:
//   DexScreener  best pair by liquidity (image, price, changes, liquidity, volume, fdv)
//   GeckoTerminal hourly candles for the top pool (free tier: 30 req/min, so cached)
//   Yahoo Finance hourly closes for Stock Tokens (the real stock's chart)
// Everything is cached for five minutes per address; failures degrade to nulls.
import { getStock, isNative } from './stocks';

const TTL = 5 * 60_000;
const cache = new Map();
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36', Accept: 'application/json' };
const get = async (url, timeout = 8000) => {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};

async function dexScreener(address) {
  const pairs = await get(`https://api.dexscreener.com/token-pairs/v1/robinhood/${address}`).catch(() => []);
  const mine = (Array.isArray(pairs) ? pairs : []).filter((p) => p?.baseToken?.address?.toLowerCase() === address.toLowerCase());
  const best = mine.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
  if (!best) return null;
  const totalLiq = mine.reduce((s, p) => s + (p.liquidity?.usd || 0), 0);
  const totalVol = mine.reduce((s, p) => s + (p.volume?.h24 || 0), 0);
  return {
    image: best.info?.imageUrl || null,
    priceUsd: Number(best.priceUsd) || null,
    priceNative: Number(best.priceNative) || null,
    change: { m5: best.priceChange?.m5 ?? null, h1: best.priceChange?.h1 ?? null, h6: best.priceChange?.h6 ?? null, h24: best.priceChange?.h24 ?? null },
    liquidityUsd: totalLiq || null,
    volume24: totalVol || null,
    fdv: best.fdv ?? null,
    marketCap: best.marketCap ?? null,
    pairs: mine.length,
    dex: best.dexId || null,
    quote: best.quoteToken?.symbol || null,
    url: best.url || null,
    createdAt: best.pairCreatedAt || null,
  };
}

async function geckoSeries(address) {
  const pools = await get(`https://api.geckoterminal.com/api/v2/networks/robinhood/tokens/${address}/pools?page=1`);
  const pool = pools?.data?.[0]?.attributes?.address;
  if (!pool) return null;
  const c = await get(`https://api.geckoterminal.com/api/v2/networks/robinhood/pools/${pool}/ohlcv/hour?limit=72&currency=usd`);
  const list = c?.data?.attributes?.ohlcv_list || [];
  // [ts, o, h, l, c, v] newest first
  return list.map(([t, , , , close]) => ({ t: t * 1000, p: Number(close) })).filter((x) => x.p > 0).sort((a, b) => a.t - b.t);
}

async function yahooSeries(ticker) {
  for (const host of ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com']) {
    try {
      const j = await get(`${host}/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=60m&includePrePost=false`);
      const r = j?.chart?.result?.[0];
      const ts = r?.timestamp || [];
      const closes = r?.indicators?.quote?.[0]?.close || [];
      const out = ts.map((t, i) => ({ t: t * 1000, p: closes[i] })).filter((x) => typeof x.p === 'number' && x.p > 0);
      if (out.length) return { series: out, price: r.meta?.regularMarketPrice ?? out[out.length - 1].p, prevClose: r.meta?.chartPreviousClose ?? null };
    } catch { /* next host */ }
  }
  return null;
}

/** Full research payload for an address. Never throws. */
export async function researchToken(address) {
  const key = address.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) return hit.data;
  const stock = getStock(address);
  const [dex, series] = await Promise.all([
    isNative(address) ? null : dexScreener(address).catch(() => null),
    stock ? yahooSeries(stock.ticker).catch(() => null) : isNative(address) ? yahooSeries('ETH-USD').catch(() => null) : geckoSeries(address).catch(() => null),
  ]);
  let chart = null;
  let priceUsd = dex?.priceUsd ?? null;
  let change24 = dex?.change?.h24 ?? null;
  if (stock || isNative(address)) {
    if (series?.series) { chart = series.series; priceUsd = series.price ?? priceUsd; if (series.prevClose) change24 = ((series.price - series.prevClose) / series.prevClose) * 100; }
  } else if (Array.isArray(series) && series.length > 2) {
    chart = series;
  }
  const data = {
    kind: stock ? 'stock' : isNative(address) ? 'eth' : 'token',
    image: stock ? stock.logo : isNative(address) ? '/eth.svg' : dex?.image || null,
    priceUsd, change24,
    change: dex?.change || null,
    liquidityUsd: dex?.liquidityUsd ?? null,
    volume24: dex?.volume24 ?? null,
    marketCap: dex?.marketCap ?? dex?.fdv ?? null,
    fdv: dex?.fdv ?? null,
    pairs: dex?.pairs ?? 0,
    dex: dex?.dex ?? null,
    quote: dex?.quote ?? null,
    dexUrl: dex?.url ?? null,
    createdAt: dex?.createdAt ?? null,
    chart,
    chartSource: chart ? (stock || isNative(address) ? 'yahoo' : 'geckoterminal') : null,
  };
  cache.set(key, { data, ts: Date.now() });
  return data;
}
