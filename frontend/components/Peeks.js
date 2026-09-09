'use client';

import { useEffect, useState } from 'react';
import StockLogo from './StockLogo';
import { getStock } from '../lib/stocks';

// "See it work": four small animated scenes, all CSS and SVG, auto-rotating.
const NVDA = getStock('NVDA').address;
const GLD = getStock('GLD').address;
const SPY = getStock('SPY').address;

const SCENES = [
  { key: 'loop', label: 'The loop', title: 'Fees in, dividends out', body: 'Your launchpad pays the dev wallet in stocks. Every cycle 0xdiv applies the policy: holders, you, buyback, treasury.' },
  { key: 'policy', label: 'The policy', title: 'Four sliders, one balance sheet', body: 'Move a share, the payout ratio adjusts. Presets for the common splits. Change it any time from the dashboard or Telegram.' },
  { key: 'record', label: 'Record date', title: 'Diamond hands earn more', body: 'Weight ramps from 1x to 2x over 30 days. A wallet that sells resets to zero. A sniper who buys right before the cycle gets nothing.' },
  { key: 'receipt', label: 'The receipt', title: 'Every dividend, posted', body: 'A card lands in your Telegram group with a Share on X button. Holders check their own statement at /wallet.' },
];

export default function Peeks() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((x) => (x + 1) % SCENES.length), 7000);
    return () => clearInterval(t);
  }, [paused]);
  const scene = SCENES[i];

  return (
    <div id="peeks" className="scroll-mt-20">
      <div className="mb-6">
        <div className="eyebrow mb-2">Sneak peek</div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">See it work</h2>
      </div>
      <div className="panel-ink relative overflow-hidden" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-hood-500/20 blur-3xl" />
        <div className="grid lg:grid-cols-[0.9fr_1.4fr]">
          {/* Left: scene list */}
          <div className="flex flex-col justify-between border-b border-white/10 p-6 lg:border-b-0 lg:border-r">
            <div className="space-y-1">
              {SCENES.map((s, k) => (
                <button key={s.key} type="button" onClick={() => setI(k)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${k === i ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                  <span className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold ${k === i ? 'bg-hood-500 text-ink' : 'bg-white/10 text-white/60'}`}>
                    {k + 1}
                    {k === i && !paused && <span className="absolute inset-0 animate-ping rounded-full bg-hood-500/60" style={{ animationDuration: '2.5s' }} />}
                  </span>
                  <span className={`text-sm font-semibold ${k === i ? 'text-white' : 'text-white/60'}`}>{s.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-6">
              <h3 className="font-display text-xl font-extrabold text-white">{scene.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{scene.body}</p>
            </div>
          </div>
          {/* Right: stage */}
          <div className="relative min-h-[300px] p-5 sm:p-6 lg:min-h-[400px]">
            <div key={scene.key} className="reveal-pop h-full">
              {scene.key === 'loop' && <LoopScene />}
              {scene.key === 'policy' && <PolicyScene />}
              {scene.key === 'record' && <RecordScene />}
              {scene.key === 'receipt' && <ReceiptScene />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Scene 1: the loop (SVG with travelling coins) ---------------- */
const FONT_D = 'var(--font-manrope), sans-serif';
const FONT_M = 'var(--font-jetbrains), monospace';
function LoopScene() {
  const nodes = [
    { x: 90, y: 180, label: 'Launchpad', sub: 'pays fees in stocks' },
    { x: 300, y: 180, label: 'Dev wallet', sub: 'swept each cycle' },
    { x: 510, y: 180, label: 'Policy', sub: 'split every cycle', hot: true },
  ];
  const outs = [
    { y: 60, label: 'Holders', pct: '70%', tone: '#CAF90F' },
    { y: 140, label: 'You', pct: '20%', tone: '#FFFFFF' },
    { y: 220, label: 'Treasury', pct: '10%', tone: '#F6C343' },
    { y: 300, label: 'Burn', pct: '0%', tone: '#FF7A1A' },
  ];
  const branch = (y) => `M 585 180 C 630 180 625 ${y} 648 ${y}`;
  const coins = [
    { t: 'NVDA', path: 'M 165 180 L 435 180', begin: '0s', dur: '2.4s' },
    { t: 'GLD', path: 'M 165 180 L 435 180', begin: '1.2s', dur: '2.4s' },
    { t: 'NVDA', path: branch(60), begin: '2.4s', dur: '1.8s' },
    { t: 'GLD', path: branch(220), begin: '3s', dur: '1.8s' },
    { t: 'SPY', path: branch(140), begin: '3.6s', dur: '1.8s' },
  ];
  return (
    <div className="relative flex h-full w-full items-center">
      <svg viewBox="0 0 780 360" className="w-full">
        <path d="M 165 180 L 435 180" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="16" strokeLinecap="round" />
        <path d="M 165 180 L 435 180" fill="none" stroke="#CAF90F" strokeWidth="2" strokeDasharray="6 10" className="peek-dash" />
        {outs.map((o, k) => (
          <g key={o.label}>
            <path d={branch(o.y)} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" strokeLinecap="round" />
            <path d={branch(o.y)} fill="none" stroke={o.tone} strokeOpacity="0.75" strokeWidth="2" strokeDasharray="6 10" className="peek-dash" style={{ animationDelay: `${k * 0.3}s` }} />
          </g>
        ))}
        {nodes.map((n) => (
          <g key={n.label}>
            <rect x={n.x - 75} y={n.y - 40} width="150" height="80" rx="18" fill="#131916" stroke={n.hot ? '#CAF90F' : 'rgba(255,255,255,0.18)'} strokeWidth={n.hot ? 2.5 : 1} />
            <text x={n.x} y={n.y - 4} textAnchor="middle" fill="#fff" fontSize="18" fontWeight="800" fontFamily={FONT_D}>{n.label}</text>
            <text x={n.x} y={n.y + 18} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="12" fontFamily={FONT_D}>{n.sub}</text>
          </g>
        ))}
        {outs.map((o) => (
          <g key={o.label}>
            <rect x="652" y={o.y - 26} width="126" height="52" rx="14" fill="#131916" stroke={o.tone} strokeOpacity="0.7" />
            <text x="664" y={o.y + 6} fill="#fff" fontSize="15" fontWeight="800" fontFamily={FONT_D}>{o.label}</text>
            <text x="768" y={o.y + 6} textAnchor="end" fill={o.tone} fontSize="15" fontWeight="700" fontFamily={FONT_M}>{o.pct}</text>
          </g>
        ))}
        {[0, 1, 2, 3, 4].map((k) => <rect key={k} x={662 + k * 24} y={18} width="18" height="9" rx="3" fill="#CAF90F" className="peek-fill" style={{ animationDelay: `${1.6 + k * 0.25}s` }} />)}
        {coins.map((c, k) => (
          <g key={k} opacity="0">
            <animate attributeName="opacity" values="0;1" dur="0.05s" begin={c.begin} fill="freeze" />
            <circle r="19" fill="#fff" stroke="#CAF90F" strokeWidth="2.5" />
            <image href={getStock(c.t).logo} x="-16" y="-16" width="32" height="32" clipPath="circle(16px at 16px 16px)" />
            <animateMotion dur={c.dur} begin={c.begin} repeatCount="indefinite" path={c.path} calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines="0.4 0 0.2 1" />
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ---------------- Scene 2: policy sliders animating between presets ---------------- */
const PRESET_LOOP = [
  { h: 100, c: 0, b: 0, t: 0 }, { h: 80, c: 20, b: 0, t: 0 }, { h: 70, c: 20, b: 0, t: 10 }, { h: 50, c: 20, b: 15, t: 15 },
];
function PolicyScene() {
  const [k, setK] = useState(0);
  useEffect(() => { const t = setInterval(() => setK((x) => (x + 1) % PRESET_LOOP.length), 1800); return () => clearInterval(t); }, []);
  const p = PRESET_LOOP[k];
  const rows = [['Holders', p.h, '#CAF90F'], ['You', p.c, '#FFFFFF'], ['Buyback and burn', p.b, '#FF7A1A'], ['Treasury', p.t, '#F6C343']];
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#131916] p-5">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">Dividend policy</div>
      <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full bg-white/10">
        {rows.map(([l, v, c]) => <div key={l} className="transition-all duration-700 ease-out" style={{ width: `${v}%`, background: c }} />)}
      </div>
      <div className="space-y-3">
        {rows.map(([l, v, c]) => (
          <div key={l}>
            <div className="mb-1 flex justify-between text-xs"><span className="text-white/80">{l}</span><span className="figure font-bold text-white">{v}%</span></div>
            <div className="relative h-1.5 rounded-full bg-white/10">
              <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out" style={{ width: `${v}%`, background: c }} />
              <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#131916] shadow transition-all duration-700 ease-out" style={{ left: `${v}%`, background: c }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-[11px] text-white/50">
        <span>Next cycle: <span className="font-mono text-white">0.0421 NVDA</span> in the wallet</span>
        <span className="rounded-full bg-hood-500 px-2 py-0.5 font-bold text-ink">Save</span>
      </div>
    </div>
  );
}

/* ---------------- Scene 3: record date and loyalty ---------------- */
const WALLETS = [
  { name: '0x8a2f…41c9', days: 61, mult: 2.0, note: 'holding 61 days' },
  { name: '0x3d17…b0e2', days: 15, mult: 1.5, note: 'holding 15 days' },
  { name: '0xc4a9…77de', days: 2, mult: 1.07, note: 'sold 2 days ago, clock reset' },
  { name: '0xf01e…9a33', days: 0, mult: 0, note: 'bought 4 minutes ago, below min hold' },
];
function RecordScene() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 900); return () => clearInterval(t); }, []);
  const revealed = Math.min(WALLETS.length, Math.floor(tick / 1.2) + 1);
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#131916] p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">Record date · 4:00 pm ET</div>
        <span className="rounded-full bg-gold-400/20 px-2 py-0.5 text-[10px] font-bold text-gold-300">🏅 1x → 2x over 30d</span>
      </div>
      <div className="space-y-2">
        {WALLETS.map((w, k) => (
          <div key={w.name} className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-all duration-500 ${k < revealed ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-3'} ${w.mult === 0 ? 'border-red-500/30 bg-red-500/5' : 'border-white/10'}`}>
            <span className="font-mono text-xs text-white/80">{w.name}</span>
            <div className="min-w-0 flex-1">
              <div className="h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-hood-500 to-gold-400 transition-all duration-1000" style={{ width: k < revealed ? `${Math.min(100, (w.days / 30) * 100)}%` : 0 }} /></div>
              <div className="mt-0.5 text-[10px] text-white/50">{w.note}</div>
            </div>
            <span className={`figure rounded-full px-2 py-0.5 text-xs font-bold ${w.mult === 0 ? 'bg-red-500/20 text-red-300' : 'bg-hood-500/20 text-hood-300'}`}>{w.mult === 0 ? 'skipped' : `${w.mult.toFixed(2)}x`}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-white/50">Weight = balance x multiplier. Voting weight follows the same rule.</p>
    </div>
  );
}

/* ---------------- Scene 4: the Telegram receipt ---------------- */
function ReceiptScene() {
  const [step, setStep] = useState(0);
  useEffect(() => { const t = setInterval(() => setStep((s) => (s + 1) % 4), 1700); return () => clearInterval(t); }, []);
  return (
    <div className="mx-auto max-w-sm">
      <div className="rounded-2xl border border-white/10 bg-[#0f1512] p-3">
        <div className="mb-2 flex items-center gap-2 border-b border-white/10 pb-2 text-xs text-white/60"><span className="h-6 w-6 rounded-full bg-hood-500" /> <span className="font-semibold text-white">$PEPE holders</span> · 1,204 members</div>
        <div className={`transition-all duration-500 ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
          <div className="overflow-hidden rounded-xl border border-white/10 bg-paper text-ink">
            <div className="flex items-center justify-between bg-hood-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink"><span>🪃 Dividend paid</span><span>4:00 pm ET</span></div>
            <div className="flex items-center gap-3 p-3">
              <StockLogo address={NVDA} size="h-12 w-12" text="text-xs" className="border-2 border-hood-500" />
              <div><div className="text-[11px] text-mut">Holders of $PEPE received</div><div className="figure font-display text-2xl font-extrabold text-hood-700">0.0421 <span className="text-ink">NVDA</span></div><div className="text-[11px] text-mut">412 wallets · loyalty-weighted</div></div>
            </div>
            <div className="flex gap-2 border-t border-line px-3 py-2">
              <span className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${step >= 2 ? 'bg-ink text-white' : 'bg-tile text-mut'}`}>𝕏 Share</span>
              <span className="rounded-full bg-tile px-3 py-1 text-[11px] font-semibold text-mut">🧾 Receipt</span>
              <span className="rounded-full bg-tile px-3 py-1 text-[11px] font-semibold text-mut">📊 Dashboard</span>
            </div>
          </div>
        </div>
        <div className={`mt-2 flex justify-end transition-all duration-500 ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
          <div className="rounded-2xl rounded-br-sm bg-hood-500 px-3 py-1.5 text-xs font-semibold text-ink">holding since day one 🫡</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-white/50"><StockLogo address={GLD} size="h-4 w-4" text="text-[6px]" /><StockLogo address={SPY} size="h-4 w-4" text="text-[6px]" /> Every cycle, every stock, one card.</div>
    </div>
  );
}
