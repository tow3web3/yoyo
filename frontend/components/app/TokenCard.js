'use client';

// The research card for a token: image, price, 24h change, sparkline, and the
// pool stats that matter before routing fees into it.
import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import StockLogo from '../StockLogo';
import { explorerAddress } from '../../lib/stocks';

const fmtPrice = (p) => (p == null ? '—' : p >= 1000 ? `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : p >= 1 ? `$${p.toFixed(2)}` : p >= 0.01 ? `$${p.toFixed(4)}` : `$${p.toPrecision(3)}`);
const fmtBig = (n) => (n == null ? '—' : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}k` : `$${Number(n).toFixed(0)}`);
const pct = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));

function Change({ v, className = '' }) {
  const n = pct(v);
  if (n == null) return <span className={`text-mut ${className}`}>—</span>;
  const up = n >= 0;
  return <span className={`figure font-bold ${up ? 'text-hood-700' : 'text-down'} ${className}`}>{up ? '▲' : '▼'} {Math.abs(n).toFixed(2)}%</span>;
}

function Spark({ data, up, height = 96, id }) {
  const color = up ? '#93B80A' : '#FF5000';
  const fill = up ? '#CAF90F' : '#FF5000';
  const [min, max] = useMemo(() => { const ps = data.map((d) => d.p); return [Math.min(...ps), Math.max(...ps)]; }, [data]);
  const pad = (max - min) * 0.15 || max * 0.02 || 1;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={fill} stopOpacity={0.55} /><stop offset="100%" stopColor={fill} stopOpacity={0.02} /></linearGradient>
          </defs>
          <YAxis hide domain={[min - pad, max + pad]} />
          <Tooltip cursor={{ stroke: color, strokeOpacity: 0.4 }} content={({ active, payload }) => (active && payload?.length ? <div className="rounded-lg border border-line bg-paper px-2 py-1 text-[11px] shadow-soft"><div className="figure font-bold text-ink">{fmtPrice(payload[0].payload.p)}</div><div className="text-mut">{new Date(payload[0].payload.t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div></div> : null)} />
          <Area type="monotone" dataKey="p" stroke={color} strokeWidth={2} fill={`url(#spark-${id})`} isAnimationActive animationDuration={700} dot={false} activeDot={{ r: 3, fill: color, stroke: '#fff', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Four-bar fallback when no candle history exists yet: 5m, 1h, 6h, 24h moves. */
function ChangeBars({ change }) {
  const rows = [['5m', change?.m5], ['1h', change?.h1], ['6h', change?.h6], ['24h', change?.h24]];
  return (
    <div className="grid grid-cols-4 gap-2">
      {rows.map(([k, v]) => <div key={k} className="rounded-xl border border-line bg-ground px-2 py-1.5 text-center"><div className="text-[10px] uppercase tracking-wider text-mut">{k}</div><Change v={v} className="text-xs" /></div>)}
    </div>
  );
}

/**
 * props: token = the /api/app/token payload; compact = tighter layout for inspectors;
 * action = optional { label, onClick } button.
 */
export default function TokenCard({ token, compact = false, action = null }) {
  const r = token.research || {};
  const chart = Array.isArray(r.chart) && r.chart.length > 2 ? r.chart : null;
  const trendUp = chart ? chart[chart.length - 1].p >= chart[0].p : (pct(r.change24) ?? 0) >= 0;
  const kindLabel = token.isNative ? 'Native gas token' : token.isStock ? 'Robinhood Stock Token' : 'Token on Robinhood Chain';
  const id = token.address.slice(2, 10);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-soft">
      <div className={`flex items-center gap-3 ${compact ? 'p-3' : 'p-4'}`}>
        <StockLogo address={token.address} meta={{ symbol: token.symbol, image: token.image }} size={compact ? 'h-10 w-10' : 'h-12 w-12'} text="text-[10px]" className="border-2 border-hood-500" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><span className="truncate font-display text-base font-extrabold text-ink">{token.name}</span><span className="font-mono text-xs font-bold text-mut">${token.symbol}</span></div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-mut">
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${token.isStock ? 'bg-hood-100 text-hood-700' : token.isNative ? 'bg-tile text-ink' : 'bg-gold-100 text-gold-700'}`}>{kindLabel}</span>
            <a href={explorerAddress(token.address)} target="_blank" rel="noopener noreferrer" className="font-mono hover:text-ink">{token.address.slice(0, 6)}…{token.address.slice(-4)} ↗</a>
          </div>
        </div>
        <div className="text-right">
          <div className={`figure font-display font-extrabold text-ink ${compact ? 'text-lg' : 'text-2xl'}`}>{fmtPrice(r.priceUsd)}</div>
          <Change v={r.change24} className="text-xs" />
        </div>
      </div>
      <div className={compact ? 'px-3' : 'px-4'}>
        {chart ? <Spark data={chart} up={trendUp} height={compact ? 72 : 110} id={id} /> : <div className="pb-1"><ChangeBars change={r.change} /></div>}
      </div>
      <div className={`grid grid-cols-3 gap-px border-t border-line bg-line ${compact ? 'text-[11px]' : 'text-xs'}`}>
        {[['Liquidity', fmtBig(r.liquidityUsd)], ['24h volume', fmtBig(r.volume24)], [token.isStock ? 'On-chain mcap' : 'Market cap', fmtBig(r.marketCap)]].map(([k, v]) => (
          <div key={k} className="bg-paper px-3 py-2"><div className="text-[10px] uppercase tracking-wider text-mut">{k}</div><div className="figure font-bold text-ink">{v}</div></div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-[11px] text-mut">
        <span>{r.pairs ? `${r.pairs} pool${r.pairs > 1 ? 's' : ''}${r.dex ? ` · ${r.dex}` : ''}${r.quote ? ` · vs ${r.quote}` : ''}` : token.isStock ? 'Priced from Yahoo Finance' : 'No pool found yet: fees routed here would pay in kind'}{chart ? ` · ${r.chartSource === 'yahoo' ? '5 days, hourly' : '72 hours, hourly'}` : ''}</span>
        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          {r.dexUrl && <a href={r.dexUrl} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-ink">DexScreener ↗</a>}
          {action && <button type="button" onClick={action.onClick} className="whitespace-nowrap rounded-full bg-hood-500 px-3 py-1 text-[11px] font-bold text-ink hover:bg-hood-400">{action.label}</button>}
        </span>
      </div>
    </div>
  );
}
