// Yahoo Finance quotes for the site (server-side, cached one minute).
const HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json',
};
const TTL = 60_000;
const cache = new Map();

async function fetchQuote(symbol) {
  for (const host of HOSTS) {
    try {
      const res = await fetch(`${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m&includePrePost=true`, { headers: HEADERS, cache: 'no-store', signal: AbortSignal.timeout(6000) });
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
      if (typeof price === 'number' && price > 0) return { price, changePct: prev > 0 ? ((price - prev) / prev) * 100 : null };
    } catch { /* next host */ }
  }
  return null;
}

export async function getQuotes(symbols) {
  const out = {};
  await Promise.all(symbols.map(async (s) => {
    const hit = cache.get(s);
    if (hit && Date.now() - hit.ts < TTL) { out[s] = hit.q; return; }
    const q = await fetchQuote(s);
    if (q) cache.set(s, { q, ts: Date.now() });
    out[s] = q ?? hit?.q ?? null;
  }));
  return out;
}
