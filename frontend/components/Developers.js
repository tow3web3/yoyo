'use client';

import { useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_SITE_URL || '';

const ENDPOINTS = [
  { path: '/api/v1/stats', desc: 'Global stats: ETH paid out, dividend cycles, active tokens.' },
  { path: '/api/v1/tokens', desc: 'Every token paying dividends, with its reward, mode and schedule.' },
  { path: '/api/v1/token/{address}', desc: 'Is a token linked? Its reward, schedule and payout stats.' },
  { path: '/api/v1/stocks', desc: 'The 195 Robinhood Stock Tokens with addresses and liquidity flags.' },
  { path: '/api/v1/activity?limit=20', desc: 'Recent linked tokens and dividends.' },
];

function Endpoint({ path, desc }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${BASE}${path}`); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  return (
    <div className="panel flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="rounded bg-hood-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-hood-700">GET</span>
          <code className="truncate font-mono text-sm text-ink">{path}</code>
        </div>
        <p className="mt-1 text-xs text-mut">{desc}</p>
      </div>
      <button onClick={copy} className="shrink-0 self-start rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-mut transition hover:border-hood-400 hover:text-hood-700 sm:self-center">
        {copied ? 'Copied!' : 'Copy URL'}
      </button>
    </div>
  );
}

export default function Developers() {
  return (
    <div id="developers" className="scroll-mt-20">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow mb-2">Developers</div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Build on Boomerang</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-mut">A free, public, read-only API. No key required. Query token links, dividends, live stats and the stock registry.</p>
        </div>
        <a href="/api/v1" target="_blank" rel="noopener noreferrer" className="btn-ghost shrink-0 self-start">View API root</a>
      </div>
      <div className="grid gap-3">{ENDPOINTS.map((e) => <Endpoint key={e.path} {...e} />)}</div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-ink bg-tape p-4">
        <pre className="font-mono text-xs leading-relaxed text-hood-300">
{`$ curl ${BASE || ''}/api/v1/token/0x322F…3b2d

{
  "linked": true,
  "rewardToken": "0xd0601CE1…9EEC",
  "rewardSymbol": "NVDA",
  "rewardMode": "fixed",
  "schedule": "at the closing bell",
  "active": true,
  "stats": { "feesUsedEth": "1.2840", "dividends": 31, "holdersPaid": 412, ... }
}`}
        </pre>
      </div>
    </div>
  );
}
