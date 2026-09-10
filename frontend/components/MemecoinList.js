'use client';

// The right column of the universe: the memecoins of Robinhood Chain, live from
// the most traded pools, each one a coin that can plug into yo-yo today.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import StockLogo from './StockLogo';
import { Arrow } from './Icons';

const fmtBig = (n) => (n == null ? '—' : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}k` : `$${Number(n).toFixed(0)}`);

export default function MemecoinList() {
  const [state, setState] = useState({ coins: null, error: null });
  useEffect(() => {
    let alive = true;
    fetch('/api/memecoins').then((r) => r.json()).then((d) => alive && setState({ coins: d.coins || [], error: d.error || null })).catch((e) => alive && setState({ coins: [], error: e.message }));
    return () => { alive = false; };
  }, []);
  const coins = state.coins;
  return (
    <div className="panel-ink relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-hood-500/20 blur-3xl" />
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-hood-500">Memecoins on Robinhood Chain</div>
          <div className="font-display text-lg font-extrabold text-white">Any of these can plug in today</div>
        </div>
        <span className="hidden h-2 w-2 animate-pulse rounded-full bg-hood-500 sm:block" title="live" />
      </div>
      <div className="space-y-1">
        {coins === null && [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-11 animate-pulse rounded-xl bg-white/5" />)}
        {coins?.map((c) => {
          const up = (c.change24 ?? 0) >= 0;
          return (
            <Link key={c.address} href={`/${c.address}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white/5">
              <StockLogo address={c.address} meta={{ symbol: c.symbol, image: c.image }} size="h-8 w-8" text="text-[8px]" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2"><span className="truncate text-sm font-bold text-white">{c.name}</span><span className="font-mono text-[11px] text-white/50">${c.symbol}</span></span>
                <span className="block text-[11px] text-white/45">MC {fmtBig(c.marketCap)} · 24h vol {fmtBig(c.volume24)}</span>
              </span>
              <span className={`figure text-xs font-bold ${up ? 'text-hood-500' : 'text-orange-400'}`}>{c.change24 == null ? '' : `${up ? '▲' : '▼'} ${Math.abs(c.change24).toFixed(1)}%`}</span>
            </Link>
          );
        })}
        {coins && coins.length === 0 && <div className="py-4 text-xs text-white/50">The chain list is busy right now. Try again in a minute.</div>}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs text-white/60">
        <span>Yours is not here yet? Any ERC-20 on Robinhood Chain works.</span>
        <Link href="/app" className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-hood-500 px-3 py-1 font-bold text-ink hover:bg-hood-400">Link my coin <Arrow className="h-3 w-3" /></Link>
      </div>
    </div>
  );
}
