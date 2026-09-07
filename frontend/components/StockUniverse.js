'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Arrow } from './Icons';
import StockLogo from './StockLogo';
import { STOCKS, SECTORS, LIQUID_TICKERS, explorerToken } from '../lib/stocks';

const FEATURED = ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'SPY', 'GLD', 'COIN', 'PLTR', 'GME', 'AMD', 'QQQ', 'SPCX', 'ASML'];

/**
 * The stock universe. `compact` shows the featured 16 with a link to /stocks;
 * the full page shows all 195 with search and sector filter.
 */
export default function StockUniverse({ compact = false }) {
  const [q, setQ] = useState('');
  const [sector, setSector] = useState('All');
  const [copied, setCopied] = useState(null);

  const list = useMemo(() => {
    if (compact) return FEATURED.map((t) => STOCKS.find((s) => s.ticker === t)).filter(Boolean);
    const needle = q.trim().toLowerCase();
    return STOCKS.filter((s) => (sector === 'All' || s.sector === sector) && (!needle || s.ticker.toLowerCase().includes(needle) || s.name.toLowerCase().includes(needle)));
  }, [compact, q, sector]);

  const copy = async (s) => {
    try { await navigator.clipboard.writeText(s.address); setCopied(s.ticker); setTimeout(() => setCopied(null), 1200); } catch { /* ignore */ }
  };

  return (
    <div id="stocks" className="scroll-mt-20">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow mb-2">The universe</div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">{STOCKS.length} stocks and ETFs, all payable</h2>
          <p className="mt-2 max-w-xl text-sm text-mut">
            Every official Robinhood Stock Token on Robinhood Chain. <span className="font-semibold text-ink">Liquid</span> tickers fill at fair value today; the rest are guarded and pay ETH until their pools deepen.
          </p>
        </div>
        {compact ? (
          <Link href="/stocks" className="btn-ghost shrink-0 self-start">See all {STOCKS.length} <Arrow className="h-4 w-4" /></Link>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search NVDA, gold, semis…" className="rounded-full border border-line bg-paper px-4 py-2 text-sm outline-none focus:border-hood-400 focus:ring-2 focus:ring-hood-200" />
            <select value={sector} onChange={(e) => setSector(e.target.value)} className="rounded-full border border-line bg-paper px-4 py-2 text-sm outline-none focus:border-hood-400">
              <option>All</option>
              {SECTORS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((s) => {
          const liquid = LIQUID_TICKERS.includes(s.ticker);
          return (
            <div key={s.ticker} className={`panel card-fun group relative p-3 ${liquid ? 'hover:border-hood-300' : 'hover:border-line'}`}>
              <div className="flex items-center gap-3">
                <StockLogo address={s.address} size="h-10 w-10" text="text-[9px]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-bold text-ink">{s.ticker}</span>
                    {liquid && <span className="rounded-full bg-hood-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-hood-700">Liquid</span>}
                  </div>
                  <div className="truncate text-xs text-mut">{s.name}</div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-mut">
                <span className="truncate">{s.sector}</span>
                <span className="flex items-center gap-2">
                  <button onClick={() => copy(s)} className="font-mono transition hover:text-hood-700">{copied === s.ticker ? 'copied' : `${s.address.slice(0, 6)}…`}</button>
                  <a href={explorerToken(s.address)} target="_blank" rel="noopener noreferrer" className="transition hover:text-hood-700">↗</a>
                </span>
              </div>
            </div>
          );
        })}
        {list.length === 0 && <div className="col-span-full panel px-6 py-10 text-center text-sm text-mut">No ticker matches.</div>}
      </div>
    </div>
  );
}
