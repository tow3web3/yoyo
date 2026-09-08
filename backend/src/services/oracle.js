// Fair-price oracle: Yahoo Finance for the stock and for ETH-USD, so a swap is
// only executed when the on-chain pool delivers close to the real market price.
// Stock Token pools can be paper thin; without this guard a cycle could vanish
// into price impact.
const YAHOO_HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json',
};

const TTL = 60_000;
const cache = new Map(); // symbol -> { quote, ts }

async function fetchQuote(symbol) {
  for (const host of YAHOO_HOSTS) {
    try {
      const url = `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m&includePrePost=true`;
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result) continue;
      const closes = result.indicators?.quote?.[0]?.close ?? [];
      let last = null;
      for (let i = closes.length - 1; i >= 0; i--) {
        const c = closes[i];
        if (typeof c === 'number' && Number.isFinite(c) && c > 0) { last = c; break; }
      }
      const price = last ?? result.meta?.regularMarketPrice ?? null;
      const prev = result.meta?.chartPreviousClose ?? result.meta?.previousClose ?? null;
      if (typeof price === 'number' && price > 0) {
        const changePct = prev > 0 ? ((price - prev) / prev) * 100 : null;
        return { symbol, price, prevClose: prev, changePct, at: Date.now() };
      }
    } catch {
      // try the next host
    }
  }
  return null;
}

/** Latest price (+ % change vs previous close) for one Yahoo symbol, cached. */
export async function getQuote(symbol) {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.ts < TTL) return hit.quote;
  const quote = await fetchQuote(symbol);
  if (quote) cache.set(symbol, { quote, ts: Date.now() });
  return quote ?? hit?.quote ?? null;
}

export async function getQuotes(symbols) {
  const entries = await Promise.all(symbols.map(async (s) => [s, await getQuote(s)]));
  return Object.fromEntries(entries);
}

export const ethUsd = async () => (await getQuote('ETH-USD'))?.price ?? null;

/**
 * Fair-value oracle for a stock ticker: { stockUsd, ethUsd } or null when either
 * leg is unavailable (the caller then swaps unguarded or falls back to ETH).
 */
export async function stockOracle(ticker) {
  const [stock, eth] = await Promise.all([getQuote(ticker), getQuote('ETH-USD')]);
  if (!stock?.price || !eth?.price) return null;
  return { stockUsd: stock.price, ethUsd: eth.price, changePct: stock.changePct };
}

/**
 * Fair-value oracle for any other ERC-20 (a memecoin, a partner token) from its
 * DexScreener price on Robinhood Chain. Same shape as stockOracle so the swap
 * guard treats both alike. Null when DexScreener has no pair yet.
 */
export async function tokenOracle(address) {
  if (!address) return null;
  const key = `dex:${address.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) return hit.quote;
  try {
    const [res, eth] = await Promise.all([
      fetch(`https://api.dexscreener.com/tokens/v1/robinhood/${address}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }),
      getQuote('ETH-USD'),
    ]);
    if (!res.ok || !eth?.price) return null;
    const pairs = (await res.json()) || [];
    const best = pairs.filter((p) => p?.baseToken?.address?.toLowerCase() === address.toLowerCase() && Number(p.priceUsd) > 0)
      .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    if (!best) return null;
    const quote = { stockUsd: Number(best.priceUsd), ethUsd: eth.price, changePct: best.priceChange?.h24 ?? null, liquidityUsd: best.liquidity?.usd || 0, dex: best.dexId || null };
    cache.set(key, { quote, ts: Date.now() });
    return quote;
  } catch {
    return null;
  }
}
