'use client';

import { useEffect, useState } from 'react';
import { TAPE_TICKERS } from '../lib/stocks';

// Black ticker tape across the top: live prices for the headline stocks, plus
// the latest dividends the bot paid. Prices come from /api/stocks/prices.
const fmt = (n) => (n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : n.toFixed(2));

export default function TickerTape() {
  const [quotes, setQuotes] = useState({});
  const [payouts, setPayouts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/stocks/prices?tickers=${TAPE_TICKERS.join(',')}`, { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled && data.quotes) setQuotes(data.quotes);
      } catch { /* keep last */ }
      try {
        const res = await fetch('/api/activity?limit=12', { cache: 'no-store' });
        const data = await res.json();
        const meta = data.meta || {};
        const items = (data.events || [])
          .filter((e) => e.type === 'paid' && e.holderCount > 0)
          .map((e) => `${meta[e.sourceToken]?.symbol ? `$${meta[e.sourceToken].symbol}` : 'A token'} paid ${e.holderCount} holders in ${meta[e.rewardToken]?.symbol || 'stock'}`);
        if (!cancelled) setPayouts(items);
      } catch { /* ignore */ }
    }
    load();
    const t = setInterval(load, 45000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const cells = TAPE_TICKERS.map((t) => {
    const q = quotes[t];
    return { t, price: q?.price, chg: q?.changePct };
  });
  const loop = [...cells, ...cells];

  return (
    <div className="relative z-50 overflow-hidden border-b border-hood-900 bg-tape">
      <div className="marquee-track py-1.5">
        {loop.map((c, i) => (
          <span key={i} className="mx-4 flex items-center gap-2 whitespace-nowrap font-mono text-[11px] font-semibold tracking-wide">
            <span className="text-white/90">{c.t}</span>
            {c.price ? (
              <>
                <span className="text-white/60">{fmt(c.price)}</span>
                <span className={c.chg >= 0 ? 'text-hood-400' : 'text-down'}>
                  {c.chg >= 0 ? '▲' : '▼'} {Math.abs(c.chg || 0).toFixed(2)}%
                </span>
              </>
            ) : (
              <span className="text-white/30">Robinhood Chain</span>
            )}
            {payouts.length > 0 && i % 4 === 3 ? (
              <span className="ml-3 rounded-full bg-hood-500/15 px-2 py-0.5 text-[10px] text-hood-300">🎁 {payouts[(i >> 2) % payouts.length]}</span>
            ) : null}
            <span className="ml-2 h-1 w-1 rounded-full bg-gold-400" />
          </span>
        ))}
      </div>
    </div>
  );
}
