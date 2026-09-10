'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import StockLogo from './StockLogo';
import Countdown from './Countdown';
import { Arrow } from './Icons';
import { describeAddress } from '../lib/stocks';

// The dividend screener: every token running a policy, comparable like stocks.
const compact = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
const pct = (n, d = 1) => (n == null ? null : n >= 100 ? `${Math.round(n)}%` : `${n.toFixed(d)}%`);
const MODE = { roulette: '🎰 Roulette', gainer: '🚀 Top Gainer', portfolio: '📊 Portfolio', vote: '🗳️ Vote' };

const COLUMNS = [
  { key: 'yieldApy', label: 'Yield', title: 'Fees returned over 30 days, annualized, over market cap' },
  { key: 'payoutRatio', label: 'Payout', title: 'Share of each cycle that goes to holders' },
  { key: 'backed', label: 'Backed', title: 'Treasury value as a share of market cap' },
  { key: 'marketCap', label: 'Mcap' },
  { key: 'distributions', label: 'Paid' },
];

export default function Screener() {
  const [tokens, setTokens] = useState(null);
  const [sort, setSort] = useState({ key: 'yieldApy', dir: -1 });
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'yoyotek_bot';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/v1/tokens', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled && Array.isArray(data.tokens)) setTokens(data.tokens);
      } catch { if (!cancelled) setTokens([]); }
    }
    load();
    const t = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const rows = useMemo(() => {
    if (!tokens) return [];
    const val = (t) => (sort.key === 'backed' ? t.treasury?.backedPct ?? null : t[sort.key] ?? null);
    return [...tokens].sort((a, b) => {
      const av = val(a), bv = val(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (bv - av) * sort.dir;
    });
  }, [tokens, sort]);

  const toggle = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }));

  return (
    <div id="screener" className="scroll-mt-20">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow mb-1">The screener</div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Memecoins, compared like stocks</h2>
          <p className="mt-2 max-w-xl text-sm text-mut">Every token with a dividend policy, ranked by yield, payout ratio and treasury backing. Live from chain, updated every cycle.</p>
        </div>
        <span className="chip shrink-0 self-start text-hood-700 sm:self-auto">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-hood-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-hood-500" />
          </span>
          {tokens ? `${tokens.length} listed` : 'loading'}
        </span>
      </div>

      <div className="panel overflow-hidden">
        {/* Header (desktop) */}
        <div className="hidden grid-cols-[2fr_1.2fr_repeat(5,0.8fr)_1fr] items-center gap-3 border-b border-line bg-tile/60 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-mut lg:grid">
          <span>Token</span>
          <span>Pays in</span>
          {COLUMNS.map((c) => (
            <button key={c.key} onClick={() => toggle(c.key)} title={c.title} className={`text-left transition hover:text-ink ${sort.key === c.key ? 'text-hood-700' : ''}`}>
              {c.label}{sort.key === c.key ? (sort.dir < 0 ? ' ↓' : ' ↑') : ''}
            </button>
          ))}
          <span className="text-right">Next</span>
        </div>

        {tokens === null && <div className="px-6 py-10 text-center text-sm text-mut">Loading the screener…</div>}
        {tokens && tokens.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <p className="text-sm font-medium text-ink">No token has a dividend policy yet.</p>
            <p className="max-w-md text-xs text-mut">The first one listed here gets every holder on Robinhood Chain looking at its yield. Two minutes on Telegram.</p>
            <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener noreferrer" className="btn-primary !py-2 text-xs">Be the first <Arrow className="h-3.5 w-3.5" /></a>
          </div>
        )}

        <div className="divide-y divide-line/70">
          {rows.map((t, i) => {
            const reward = describeAddress(t.rewardToken, { symbol: t.rewardSymbol });
            const paysIn = t.payoutMode === 'in_kind' ? 'In kind' : MODE[t.rewardMode] || reward.symbol;
            const backedPct = t.treasury?.backedPct ?? null;
            return (
              <Link key={t.address} href={`/${t.address}`} className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 px-4 py-3 transition hover:bg-hood-50 lg:grid-cols-[2fr_1.2fr_repeat(5,0.8fr)_1fr] lg:gap-3">
                <div className="flex items-center gap-3 lg:col-span-1">
                  <span className="hidden w-5 text-right font-mono text-[11px] text-mut lg:inline">{i + 1}</span>
                  <StockLogo address={t.address} meta={{ symbol: t.symbol, image: t.image }} size="h-9 w-9" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{t.name || `$${t.symbol || t.address.slice(2, 6)}`}</div>
                    <div className="truncate font-mono text-[11px] text-mut">${t.symbol || '?'} · {t.scheduleLabel}{t.loyalty ? ` · 🏅 ${t.loyalty.maxMultiplier.toFixed(1)}x loyalty` : ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {t.payoutMode === 'in_kind' ? <span className="rounded-full bg-hood-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-hood-700">In kind</span> : <><StockLogo address={t.rewardToken} meta={{ symbol: t.rewardSymbol }} size="h-5 w-5" text="text-[7px]" /><span className="font-mono font-semibold text-ink">{paysIn}</span></>}
                </div>
                <div className="figure text-sm font-bold text-hood-700">{pct(t.yieldApy) ? `${pct(t.yieldApy)} APY` : <span className="font-normal text-mut">{t.eth30d > 0 ? `${t.eth30d.toFixed(3)} ETH/30d` : '-'}</span>}</div>
                <div className="figure text-sm text-ink">{t.payoutRatio}%<span className="text-[10px] text-mut"> to holders</span></div>
                <div className="figure text-sm text-ink">{backedPct != null ? <span className={backedPct >= 100 ? 'text-hood-700 font-bold' : ''}>{pct(backedPct)}</span> : <span className="text-mut">-</span>}</div>
                <div className="figure text-sm text-ink">{t.marketCap ? `$${compact(t.marketCap)}` : <span className="text-mut">-</span>}</div>
                <div className="figure text-sm text-ink">{t.distributions}</div>
                <div className="text-right font-mono text-[11px] text-mut">next <Countdown intervalMinutes={t.intervalMinutes} scheduleKind={t.scheduleKind} /></div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
