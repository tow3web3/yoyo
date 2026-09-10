'use client';

// A read-only miniature of a coin's routing canvas: the dev wallet on the left,
// the legs on the right, dashed flows carrying the share. Same look as the
// Studio, no React Flow, for public pages and the homepage.
import { useEffect, useRef, useState } from 'react';
import StockLogo from './StockLogo';

const KIND = {
  holders: { label: 'Holders', emoji: '🎁', color: '#CAF90F', text: 'text-hood-700', chip: 'bg-hood-100 text-hood-800' },
  wallet: { label: 'Wallet', emoji: '👤', color: '#0B0F0C', text: 'text-ink', chip: 'bg-tile text-ink' },
  burn: { label: 'Buyback & burn', emoji: '🔥', color: '#FF7A1A', text: 'text-orange-700', chip: 'bg-orange-100 text-orange-800' },
  treasury: { label: 'Treasury', emoji: '🏦', color: '#F6C343', text: 'text-gold-700', chip: 'bg-gold-100 text-gold-800' },
};
const short = (a) => (a && a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || '');
const pct = (bps) => `${(bps / 100).toFixed(bps % 100 ? 1 : 0)}%`;
const usd = (n) => `$${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 0 : 2 })}`;

/** Legs from the API, or the legacy four-way split when the canvas was never used. */
export function legsFrom({ legs, split }) {
  if (Array.isArray(legs) && legs.length) return legs;
  const out = [];
  const s = split || { holders: 10000 };
  if (s.holders > 0) out.push({ kind: 'holders', shareBps: s.holders, label: 'Holders', assetSymbol: null });
  if (s.creator > 0) out.push({ kind: 'wallet', shareBps: s.creator, label: 'Creator', assetSymbol: null });
  if (s.burn > 0) out.push({ kind: 'burn', shareBps: s.burn, label: 'Buyback & burn', assetSymbol: null });
  if (s.treasury > 0) out.push({ kind: 'treasury', shareBps: s.treasury, label: 'Treasury', assetSymbol: null });
  return out;
}

const LEG_H = 92;
const LEG_GAP = 14;

export default function PolicyMini({ source, devWallet, schedule, legs: rawLegs, split, className = '' }) {
  const legs = legsFrom({ legs: rawLegs, split });
  const wrap = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!wrap.current) return undefined;
    const ro = new ResizeObserver((es) => setW(es[0].contentRect.width));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const n = Math.max(1, legs.length);
  const height = Math.max(190, n * (LEG_H + LEG_GAP) + 12);
  const narrow = w > 0 && w < 560;
  const srcW = narrow ? Math.min(240, w * 0.5) : Math.min(300, w * 0.4);
  const legX = narrow ? srcW + 34 : Math.max(srcW + 56, w * 0.56);
  const legW = Math.max(160, w - legX);
  const midY = height / 2;
  const sym = source?.symbol || 'TOKEN';

  return (
    <div ref={wrap} className={`relative w-full overflow-hidden rounded-3xl border border-line bg-ground ${className}`} style={{ height, backgroundImage: 'radial-gradient(circle, rgba(11,15,12,0.10) 1px, transparent 1px)', backgroundSize: '18px 18px' }}>
      {w > 0 && (
        <svg className="pointer-events-none absolute inset-0" width={w} height={height} aria-hidden>
          {legs.map((l, i) => {
            const k = KIND[l.kind] || KIND.wallet;
            const y2 = 6 + i * (LEG_H + LEG_GAP) + LEG_H / 2;
            const x1 = srcW;
            const x2 = legX;
            const c = (x2 - x1) / 2;
            const d = `M ${x1} ${midY} C ${x1 + c} ${midY}, ${x2 - c} ${y2}, ${x2} ${y2}`;
            const sw = 2 + (l.shareBps / 10000) * 8;
            return (
              <g key={i}>
                <path d={d} fill="none" stroke={k.color} strokeWidth={sw} strokeOpacity="0.28" />
                <path d={d} fill="none" stroke={k.color} strokeWidth={Math.max(1.5, sw / 2)} strokeDasharray="6 10" className="bm-flow" style={{ animationDuration: `${Math.max(0.6, 2.4 - (l.shareBps / 10000) * 1.6)}s` }} />
                <circle cx={x2} cy={y2} r="4" fill={k.color} stroke="#fff" strokeWidth="2" />
              </g>
            );
          })}
          <circle cx={srcW} cy={midY} r="5" fill="#CAF90F" stroke="#0B0F0C" strokeWidth="2" />
        </svg>
      )}

      {/* source */}
      <div className="absolute left-0 rounded-2xl border-2 border-hood-500 bg-ink p-3.5 text-white shadow-lg" style={{ width: srcW, top: midY, transform: 'translateY(-50%)' }}>
        <div className="flex items-center gap-2.5">
          <StockLogo address={source?.address} meta={source} size="h-8 w-8" text="text-[8px]" />
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-extrabold">{source?.name || `$${sym}`}</div>
            {devWallet?.address && <div className="truncate font-mono text-[10px] text-white/60">dev wallet {short(devWallet.address)}</div>}
          </div>
          <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-hood-500" />
        </div>
        <div className="mt-2.5 flex items-end justify-between gap-2">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/50">In the dev wallet</div>
            <div className="figure font-display text-xl font-extrabold text-hood-500">{devWallet && devWallet.totalUsd != null ? usd(devWallet.totalUsd) : '…'}</div>
          </div>
          {schedule && <div className="text-right text-[9px] text-white/50">goes out<br /><span className="font-semibold text-white/80">{schedule.toLowerCase()}</span></div>}
        </div>
      </div>

      {/* legs */}
      {legs.map((l, i) => {
        const k = KIND[l.kind] || KIND.wallet;
        const dest = l.kind === 'holders' ? `every $${sym} holder` : l.kind === 'burn' ? `buys $${sym}, burns it` : l.address ? short(l.address) : 'address not set';
        const chip = l.kind === 'burn' ? 'buyback' : l.assetSymbol ? `in ${l.assetSymbol}` : 'in kind';
        return (
          <div key={i} className="absolute rounded-2xl border-2 border-line bg-paper p-3 shadow-soft" style={{ left: legX, top: 6 + i * (LEG_H + LEG_GAP), width: legW, height: LEG_H, borderLeftColor: k.color, borderLeftWidth: 5 }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className={`text-[9px] font-bold uppercase tracking-[0.16em] ${k.text}`}>{k.emoji} {k.label}</div>
                <div className="truncate font-display text-sm font-extrabold text-ink">{l.label || k.label}</div>
                <div className="truncate font-mono text-[10px] text-mut">{dest}</div>
              </div>
              <div className="figure font-display text-xl font-extrabold text-ink">{pct(l.shareBps)}</div>
            </div>
            <span className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold ${k.chip}`}>{chip}</span>
          </div>
        );
      })}
    </div>
  );
}
