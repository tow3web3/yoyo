'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Arrow } from './Icons';
import StockLogo from './StockLogo';
import MemecoinList from './MemecoinList';
import { STOCKS, SECTORS, LIQUID_TICKERS, explorerToken } from '../lib/stocks';

const FEATURED = ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'SPY', 'GLD', 'COIN', 'PLTR', 'GME', 'AMD', 'QQQ', 'SPCX', 'ASML', 'NFLX', 'MU', 'INTC', 'RDDT', 'HOOD', 'MSTR', 'AVGO', 'ORCL'];

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
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">{compact ? 'Stocks to pay with, memecoins to plug in' : `${STOCKS.length} stocks and ETFs, all payable`}</h2>
          <p className="mt-2 max-w-xl text-sm text-mut">
            {compact ? <>Dividends can be paid in any of the {STOCKS.length} official Robinhood Stock Tokens, or in any memecoin on the chain. Any coin on the right can link a policy today.</> : <>Every official Robinhood Stock Token on Robinhood Chain. <span className="font-semibold text-ink">Liquid</span> tickers fill at fair value today; the rest are guarded and pay ETH until their pools deepen.</>}
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

      {compact ? (
        <div className="grid items-start gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="flex flex-wrap gap-2">
              {list.map((s, i) => {
                const liquid = LIQUID_TICKERS.includes(s.ticker);
                return (
                  <Link key={s.ticker} href={`/stocks#${s.ticker}`} title={`${s.name} · ${s.sector}`} className={`bubble group inline-flex items-center gap-2 rounded-full border bg-paper py-1.5 pl-1.5 pr-3 shadow-soft transition hover:-translate-y-0.5 ${liquid ? 'border-hood-300 hover:border-hood-500' : 'border-line hover:border-ink'}`} style={{ animationDelay: `${(i % 8) * 0.35}s` }}>
                    <StockLogo address={s.address} size="h-8 w-8" text="text-[8px]" />
                    <span className="font-mono text-sm font-bold text-ink">{s.ticker}</span>
                    {liquid && <span className="h-1.5 w-1.5 rounded-full bg-hood-500" title="Liquid today" />}
                  </Link>
                );
              })}
              <Link href="/stocks" className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-3 py-1.5 text-sm font-semibold text-mut hover:border-ink hover:text-ink">+{STOCKS.length - list.length} more <Arrow className="h-3.5 w-3.5" /></Link>
            </div>
            <p className="mt-3 text-xs text-mut"><span className="inline-block h-1.5 w-1.5 rounded-full bg-hood-500 align-middle" /> liquid today: fills at fair value on Uniswap. The rest are guarded and pay ETH until their pools deepen.</p>
          </div>
          <MemecoinList />
        </div>
      ) : (
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
      )}
    </div>
  );
}
