'use client';

import { useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_SITE_URL || '';

const ENDPOINTS = [
  { path: '/api/v1/stats', desc: 'Global stats: ETH paid out, dividend cycles, active tokens.' },
  { path: '/api/v1/tokens', desc: 'Every token paying dividends, with its reward, mode and schedule.' },
  { path: '/api/v1/token/{address}', desc: 'Is a token linked? Its reward, schedule and payout stats.' },
  { path: '/api/v1/stocks', desc: 'The 195 Robinhood Stock Tokens with addresses and liquidity flags.' },
  { path: '/api/v1/activity?limit=20', desc: 'Recent linked tokens and dividends.' },
  { path: '/api/v1/launchpads', desc: 'Integrated launchpads and how many tokens each linked.' },
  { path: '/api/badge/{address}', desc: 'Embeddable SVG badge with the live dividend yield of a token (?style=reward for the reward badge).' },
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
      {/* Launchpad integration */}
      <div id="launchpads" className="panel-gold mt-8 scroll-mt-20 p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-gold-700">For launchpads</div>
            <h3 className="font-display text-xl font-bold tracking-tight text-ink">Ship dividends as a default</h3>
            <p className="mt-1 max-w-xl text-sm text-mut">One call per launch. The creator gets a Telegram link that pre-fills the whole setup; you get a signed webhook for every dividend and a live badge for the token page.</p>
          </div>
          <a href="mailto:hello@boomerang.fun?subject=Launchpad%20integration" className="btn-ink shrink-0 self-start text-xs">Request an API key</a>
        </div>
        <ol className="grid gap-3 text-sm text-mut sm:grid-cols-3">
          <li className="rounded-xl border border-line bg-paper p-4"><span className="font-mono text-xs font-bold text-hood-700">1 · POST /api/v1/hooks/launch</span><br />Send the token address (plus the creator wallet and fee source if you know them). Get back <span className="font-mono">telegramUrl</span>, <span className="font-mono">dashboardUrl</span>, <span className="font-mono">badgeUrl</span>.</li>
          <li className="rounded-xl border border-line bg-paper p-4"><span className="font-mono text-xs font-bold text-hood-700">2 · Show the link</span><br />The creator opens Telegram, sends the dev key, picks a stock and a schedule. Token and fee source are already filled in.</li>
          <li className="rounded-xl border border-line bg-paper p-4"><span className="font-mono text-xs font-bold text-hood-700">3 · Receive webhooks</span><br /><span className="font-mono">token.linked</span> and <span className="font-mono">dividend.paid</span>, HMAC-signed (<span className="font-mono">X-Boomerang-Signature</span>). Poll <span className="font-mono">GET ?code=</span> if you prefer.</li>
        </ol>
        <div className="mt-4 overflow-x-auto rounded-xl border border-ink bg-tape p-4">
          <pre className="font-mono text-xs leading-relaxed text-gold-200">
{`$ curl -X POST ${BASE || ''}/api/v1/hooks/launch \\
    -H "Authorization: Bearer bmr_…" -H "Content-Type: application/json" \\
    -d '{"token":"0x322F…3b2d","creatorWallet":"0xaC97…030b","feeSource":"wallet","reward":"NVDA"}'

{ "code": "K7Q2MX4P", "status": "pending",
  "telegramUrl": "https://t.me/boomerangtekbot?start=l_K7Q2MX4P",
  "dashboardUrl": "${BASE || ''}/0x322f…3b2d", "badgeUrl": "${BASE || ''}/api/badge/0x322f…3b2d" }`}
          </pre>
        </div>
        <p className="mt-3 text-xs text-mut">No API key? Any site can still link <span className="font-mono">https://t.me/boomerangtekbot?start=t_&lt;tokenAddress&gt;</span> to pre-fill the token.</p>
      </div>

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
  "yield": { "apy": 12.4, "eth30d": 1.284, "cycles30d": 31 },
  "stats": { "feesUsedEth": "1.2840", "dividends": 31, "holdersPaid": 412, ... }
}`}
        </pre>
      </div>
    </div>
  );
}
