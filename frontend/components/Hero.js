'use client';

import Link from 'next/link';
import { Arrow } from './Icons';
import CopyCA from './CopyCA';
import StockLogo from './StockLogo';
import YoyoSim from './YoyoSim';
import { getStock } from '../lib/stocks';


// The dividend statement the hero "prints": what a holder's inbox looks like.
const STATEMENT = [
  { t: 'NVDA', amt: '0.0421', from: '$PEPE fees' },
  { t: 'TSLA', amt: '0.0187', from: '$WOJAK fees' },
  { t: 'GLD', amt: '0.0106', from: '$CHAD fees' },
  { t: 'AAPL', amt: '0.0293', from: '$PEPE fees' },
];

export default function Hero() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'boomerangtekbot';
  const telegramUrl = `https://t.me/${botUsername}`;

  return (
    <section className="relative px-5 pt-10 sm:pt-14">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="animate-blob absolute left-[8%] top-24 h-64 w-64 rounded-full bg-hood-300/30 blur-3xl" />
        <div className="animate-blob absolute right-[6%] top-40 h-72 w-72 rounded-full bg-gold-200/40 blur-3xl [animation-delay:-4s]" />
        <div className="animate-blob absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-hood-200/30 blur-3xl [animation-delay:-8s]" />
      </div>

      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="chip mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-hood-500" />
              The dividend policy for Robinhood Chain
            </div>

            <h1 className="font-display text-5xl font-extrabold leading-[0.98] tracking-tight text-ink sm:text-6xl lg:text-7xl">
              Give your memecoin<br className="hidden sm:block" /> a{' '}
              <span className="text-gradient">dividend</span> <span className="whitespace-nowrap"><span className="text-gradient">policy</span>.</span>
            </h1>

            <div className="mt-6 max-w-xl rounded-xl border border-line border-l-4 border-l-hood-500 bg-paper p-4 shadow-soft">
              <p className="text-[15px] leading-relaxed text-mut">
                Your launchpad pays you in real stocks.{' '}
                <span className="font-semibold text-ink">yo-yo decides what happens next: a payout ratio to holders, paid in kind, a share you keep, buybacks, a stock treasury.</span>{' '}
                NVDA fees become NVDA dividends. Drawn on one screen, run on schedule.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2 text-sm font-medium">
              <span className="rounded-full border border-line bg-paper px-3 py-1 text-ink shadow-soft">Fees in stocks</span>
              <Arrow className="h-4 w-4 text-hood-500" />
              <span className="rounded-full border border-line bg-paper px-3 py-1 text-ink shadow-soft">Policy applied</span>
              <Arrow className="h-4 w-4 text-hood-500" />
              <span className="rounded-full border border-hood-200 bg-hood-50 px-3 py-1 font-semibold text-hood-700 shadow-soft">Holders paid</span>
              <span className="rounded-full border border-line bg-paper px-3 py-1 text-ink shadow-soft">👤 You paid</span>
              <span className="rounded-full border border-gold-200 bg-gold-50 px-3 py-1 text-gold-700 shadow-soft">🏦 Treasury</span>
              <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-orange-700 shadow-soft">🔥 Burn</span>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/app" className="btn-primary text-base">Open the dashboard <Arrow className="h-4 w-4" /></Link>
              <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className="btn-ink text-base">Telegram remote</a>
              <a href="#how" className="btn-ghost text-base">How it works</a>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <CopyCA />
              <p className="text-sm text-mut">Fees go out, dividends come back. Like a listed company, for a memecoin.</p>
            </div>
          </div>

          {/* A playable yo-yo + a dividend statement */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="relative aspect-square w-full">
              <div className="absolute inset-10 rounded-full bg-hood-300/30 blur-3xl" />
              {/* The finger sits up in the header: the sim box starts above the hero, over the nav, and only the disc itself takes clicks. */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 top-0 z-50 lg:-top-[12rem]">
                <YoyoSim />
              </div>
            </div>

            {/* Dividend statement */}
            <div className="panel-glow absolute -bottom-6 -left-4 w-[240px] overflow-hidden sm:-left-10">
              <div className="flex items-center justify-between border-b border-line px-3 py-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-hood-700">Dividends received</span>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-hood-500" />
              </div>
              <ul className="divide-y divide-line/70">
                {STATEMENT.map((row, i) => (
                  <li key={row.t} className="line-in flex items-center gap-2 px-3 py-1.5" style={{ animationDelay: `${600 + i * 220}ms` }}>
                    <StockLogo address={getStock(row.t).address} size="h-6 w-6" text="text-[8px]" />
                    <div className="min-w-0 flex-1">
                      <div className="figure text-xs font-semibold text-ink">+{row.amt} {row.t}</div>
                      <div className="truncate text-[10px] text-mut">{row.from}</div>
                    </div>
                    <span className="text-[10px] font-bold text-hood-600">paid</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
