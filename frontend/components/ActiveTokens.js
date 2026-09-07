'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StockLogo from './StockLogo';
import Countdown from './Countdown';
import { describeAddress } from '../lib/stocks';

const compact = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
const MODE_BADGE = { roulette: ['🎰 Roulette', 'bg-gold-100 text-gold-700'], gainer: ['🚀 Top Gainer', 'bg-hood-100 text-hood-700'], portfolio: ['📊 Portfolio', 'bg-tile text-ink'], vote: ['🗳️ Vote', 'bg-hood-100 text-hood-700'] };

export default function ActiveTokens() {
  const [tokens, setTokens] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/v1/tokens', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled && Array.isArray(data.tokens)) setTokens(data.tokens);
      } catch { /* ignore */ }
    }
    load();
    const t = setInterval(load, 20000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  return (
    <div id="bots" className="scroll-mt-20">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="eyebrow mb-1">Live</div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Tokens paying dividends</h2>
        </div>
        <span className="chip shrink-0 text-hood-700">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-hood-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-hood-500" />
          </span>
          {tokens.length} active
        </span>
      </div>

      {tokens.length === 0 ? (
        <div className="panel px-6 py-10 text-center text-sm text-mut">No active bots right now. Yours could be the first.</div>
      ) : (
        <div className="panel divide-y divide-line/70 overflow-hidden">
          {tokens.map((t) => {
            const reward = describeAddress(t.rewardToken, { symbol: t.rewardSymbol });
            const badge = MODE_BADGE[t.rewardMode];
            return (
              <Link key={t.address} href={`/${t.address}`} className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-hood-50">
                <StockLogo address={t.address} meta={{ symbol: t.symbol, image: t.image }} size="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="truncate text-sm font-semibold text-ink">{t.name || `$${t.symbol || t.address.slice(2, 6)}`}</span>
                    <span className="shrink-0 font-mono text-[11px] text-mut">${t.symbol || '?'}</span>
                    {badge && <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${badge[1]}`}>{badge[0]}</span>}
                  </div>
                  <div className="truncate text-xs text-mut">
                    {badge ? badge[0] : <>pays <span className="font-mono font-semibold text-ink">{reward.symbol}</span></>} · {t.scheduleLabel}
                    {t.marketCap ? ` · MC $${compact(t.marketCap)}` : ''}
                    {t.distributions > 0 ? ` · ${t.distributions} dividends` : ''}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="flex items-center justify-end gap-1.5 text-[11px] font-semibold text-hood-700"><span className="h-1.5 w-1.5 rounded-full bg-hood-500" />Active</div>
                  <div className="mt-0.5 font-mono text-[11px] text-mut">next <Countdown intervalMinutes={t.intervalMinutes} scheduleKind={t.scheduleKind} /></div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
