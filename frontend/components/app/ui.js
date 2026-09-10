'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import StockLogo from '../StockLogo';
import TokenCard from './TokenCard';
import { STOCKS, LIQUID_TICKERS, getStock } from '../../lib/stocks';

// ---------- toasts ----------
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, kind = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setItems((s) => [...s, { id, text, kind }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[70] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className={`animate-feedin rounded-xl border px-4 py-3 text-sm shadow-soft ${t.kind === 'ok' ? 'border-hood-200 bg-hood-50 text-hood-800' : t.kind === 'warn' ? 'border-gold-300 bg-gold-50 text-gold-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------- primitives ----------
export function Card({ title, eyebrow, aside, children, className = '', tone = 'paper' }) {
  const base = tone === 'gold' ? 'panel-gold' : tone === 'glow' ? 'panel-glow' : tone === 'ink' ? 'panel-ink' : 'panel';
  return (
    <section className={`${base} p-5 ${className}`}>
      {(title || aside) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {eyebrow && <div className={`text-[10px] font-bold uppercase tracking-[0.18em] ${tone === 'ink' ? 'text-hood-400' : 'text-mut'}`}>{eyebrow}</div>}
            {title && <h3 className={`font-display text-base font-bold ${tone === 'ink' ? 'text-white' : 'text-ink'}`}>{title}</h3>}
          </div>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Seg({ options, value, onChange, size = 'md' }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-full border border-line bg-tile p-1">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} title={o.title}
          className={`rounded-full px-3 ${size === 'sm' ? 'py-1 text-xs' : 'py-1.5 text-sm'} font-semibold transition ${value === o.value ? 'bg-ink text-white shadow-sm' : 'text-mut hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 rounded-xl border border-line bg-paper px-4 py-3 text-left transition hover:border-hood-300">
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {hint && <span className="block text-xs text-mut">{hint}</span>}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-hood-500' : 'bg-line'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-mut">{hint}</span>}
    </label>
  );
}

export const inputCls = 'w-full rounded-xl border border-line bg-paper px-4 py-2.5 font-mono text-sm text-ink outline-none transition focus:border-hood-400 focus:ring-2 focus:ring-hood-200';

export function Button({ children, variant = 'primary', busy, className = '', ...rest }) {
  const cls = variant === 'primary' ? 'btn-primary' : variant === 'ink' ? 'btn-ink' : variant === 'danger' ? 'inline-flex items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100' : 'btn-ghost';
  return (
    <button type="button" disabled={busy || rest.disabled} className={`${cls} ${busy ? 'opacity-60' : ''} ${className}`} {...rest}>
      {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
}

/** Slider with a live figure. */
export function Slider({ label, value, min = 0, max = 100, step = 1, onChange, format = (v) => `${v}%`, color = 'accent-hood-500' }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-ink">{label}</span>
        <span className="figure font-bold text-ink">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className={`w-full ${color}`} />
    </div>
  );
}

/** Stock picker: search over the 195 tickers, plus ETH and a raw address. */
const customCache = new Map();
export function useCustomToken(address) {
  const key = address && /^0x[0-9a-fA-F]{40}$/.test(address) && !getStock(address) && !/^0x0{40}$/i.test(address) ? address.toLowerCase() : null;
  const [info, setInfo] = useState(key ? customCache.get(key) || null : null);
  useEffect(() => {
    if (!key) { setInfo(null); return; }
    if (customCache.has(key)) { setInfo(customCache.get(key)); return; }
    let alive = true;
    setInfo({ loading: true });
    fetch(`/api/app/token?address=${key}`).then((r) => r.json()).then((d) => { const v = d.error ? { error: d.error } : d; customCache.set(key, v); if (alive) setInfo(v); }).catch(() => { if (alive) setInfo({ error: 'Lookup failed' }); });
    return () => { alive = false; };
  }, [key]);
  return info;
}

/** Research payload (/api/app/token) for any address, stocks and ETH included. Cached per address. */
const researchCache = new Map();
export function useTokenResearch(address) {
  const key = address && /^0x[0-9a-fA-F]{40}$/.test(address) ? address.toLowerCase() : address === 'ETH' ? '0x0000000000000000000000000000000000000000' : null;
  const [info, setInfo] = useState(key ? researchCache.get(key) || null : null);
  useEffect(() => {
    if (!key) { setInfo(null); return; }
    if (researchCache.has(key)) { setInfo(researchCache.get(key)); return; }
    let alive = true;
    setInfo({ loading: true });
    fetch(`/api/app/token?address=${key}`).then((r) => r.json()).then((d) => { const v = d.error ? { error: d.error } : d; researchCache.set(key, v); if (alive) setInfo(v); }).catch(() => { if (alive) setInfo({ error: 'Lookup failed' }); });
    return () => { alive = false; };
  }, [key]);
  return info;
}

export function StockPicker({ value, onChange, allowEth = true, allowAddress = true, compact = false }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('stocks'); // stocks | custom
  const custom = useCustomToken(value);
  const selected = value ? (value === 'ETH' || /^0x0{40}$/i.test(value) ? { symbol: 'ETH', name: 'Ether', address: '0x0000000000000000000000000000000000000000' } : getStock(value) ? { symbol: getStock(value).ticker, name: getStock(value).name, address: getStock(value).address } : { symbol: custom?.symbol || `${value.slice(0, 6)}…`, name: custom?.name ? `${custom.name} · custom token` : 'Custom token', address: value, image: custom?.image || null }) : null;
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = STOCKS.filter((s) => !needle || s.ticker.toLowerCase().includes(needle) || s.name.toLowerCase().includes(needle));
    return base.sort((a, b) => Number(LIQUID_TICKERS.includes(b.ticker)) - Number(LIQUID_TICKERS.includes(a.ticker))).slice(0, compact ? 8 : 14);
  }, [q, compact]);
  useEffect(() => { if (!open) { setQ(''); setTab('stocks'); } }, [open]);
  const isAddr = /^0x[0-9a-fA-F]{40}$/.test(q.trim());
  useEffect(() => { if (isAddr) setTab('custom'); }, [isAddr]);
  const probe = useTokenResearch(isAddr ? q.trim() : null);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 rounded-xl border border-line bg-paper px-3 py-2.5 text-left transition hover:border-hood-300">
        {selected ? <StockLogo address={selected.address} meta={{ symbol: selected.symbol, image: selected.image }} size="h-8 w-8" text="text-[9px]" /> : <span className="stock-logo h-8 w-8 bg-tile" />}
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-sm font-bold text-ink">{selected ? selected.symbol : 'Pick a token'}</span>
          <span className="block truncate text-xs text-mut">{selected ? selected.name : 'A stock, ETH, or any token by contract address'}</span>
        </span>
        <span className="text-mut">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 min-w-[320px] overflow-hidden rounded-2xl border border-line bg-paper shadow-lg">
          {allowAddress && (
            <div className="flex gap-1 border-b border-line bg-ground p-1.5">
              <button type="button" onClick={() => setTab('stocks')} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition ${tab === 'stocks' ? 'bg-ink text-white' : 'text-mut hover:text-ink'}`}>📈 Stocks{allowEth ? ' & ETH' : ''}</button>
              <button type="button" onClick={() => setTab('custom')} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition ${tab === 'custom' ? 'bg-ink text-white' : 'text-mut hover:text-ink'}`}>🪙 Any token (paste a CA)</button>
            </div>
          )}
          {tab === 'custom' ? (
            <div className="p-3">
              <p className="mb-2 text-xs text-mut">Any ERC-20 on Robinhood Chain: a memecoin, a partner token, your own coin. Paste its contract address.</p>
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value.trim())} placeholder="0x… contract address" className={inputCls} />
              {isAddr ? (
                <div className="mt-2">
                  {probe?.loading || !probe ? <div className="flex items-center gap-2 px-2 py-3 text-xs text-mut"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-hood-500" /> Looking up {q.trim().slice(0, 10)}… on chain, DexScreener and GeckoTerminal</div>
                    : probe.error ? <div className="px-2 py-3 text-xs text-down">{probe.error}</div>
                    : <TokenCard token={probe} compact action={{ label: 'Use this token', onClick: () => { onChange(q.trim()); setOpen(false); } }} />}
                </div>
              ) : q ? <p className="mt-2 text-xs text-mut">Keep typing: 42 characters starting with 0x.</p> : null}
            </div>
          ) : (
          <>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={allowAddress ? 'Search ticker or company (or paste a CA)' : 'Search ticker or company'} className="w-full border-b border-line px-4 py-2.5 text-sm outline-none" />
          <div className="max-h-[420px] overflow-y-auto">
            {allowEth && !q && (
              <button type="button" onClick={() => { onChange('ETH'); setOpen(false); }} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-hood-50">
                <StockLogo address="0x0000000000000000000000000000000000000000" size="h-7 w-7" text="text-[8px]" /><span className="font-mono text-sm font-bold">ETH</span><span className="text-xs text-mut">no conversion</span>
              </button>
            )}
            {list.map((s) => (
              <button key={s.ticker} type="button" onClick={() => { onChange(s.address); setOpen(false); }} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-hood-50">
                <StockLogo address={s.address} size="h-7 w-7" text="text-[8px]" />
                <span className="font-mono text-sm font-bold text-ink">{s.ticker}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-mut">{s.name}</span>
                {LIQUID_TICKERS.includes(s.ticker) && <span className="rounded-full bg-hood-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-hood-700">Liquid</span>}
              </button>
            ))}
            {list.length === 0 && !isAddr && <div className="px-4 py-4 text-center text-xs text-mut">No ticker matches. Looking for another token? Use the "Any token" tab.</div>}
          </div>
          </>
          )}
        </div>
      )}
    </div>
  );
}

export const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
export const fmtUsd = (n) => `$${(n || 0).toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 0 : 2 })}`;
export const fmtNum = (n, d = 4) => (n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : Number(n || 0).toFixed(n >= 1 ? 2 : d));
export const units = (raw, dec = 18) => Number(raw || 0) / 10 ** dec;

export const SCHEDULES = [
  { value: 'interval:5', label: 'Every 5 min' }, { value: 'interval:30', label: 'Every 30 min' }, { value: 'interval:60', label: 'Hourly' },
  { value: 'closing_bell', label: '🔔 Closing bell' }, { value: 'opening_bell', label: '🛎️ Opening bell' },
];
export const scheduleValue = (c) => (c.schedule_kind === 'interval' ? `interval:${[5, 30, 60].includes(Number(c.interval_minutes)) ? c.interval_minutes : 5}` : c.schedule_kind);
export const parseSchedule = (v) => (v.startsWith('interval:') ? { schedule_kind: 'interval', interval_minutes: Number(v.split(':')[1]) } : { schedule_kind: v, interval_minutes: 1440 });

export const PRESETS = [
  { key: '100-0-0-0', label: '100% holders', holders: 100, creator: 0, burn: 0, treasury: 0 },
  { key: '80-20-0-0', label: '80 / 20 you', holders: 80, creator: 20, burn: 0, treasury: 0 },
  { key: '70-30-0-0', label: '70 / 30 you', holders: 70, creator: 30, burn: 0, treasury: 0 },
  { key: '70-0-0-30', label: '70 + 30 treasury', holders: 70, creator: 0, burn: 0, treasury: 30 },
  { key: '60-20-0-20', label: '60 / 20 / 20', holders: 60, creator: 20, burn: 0, treasury: 20 },
  { key: '50-20-15-15', label: '50 / 20 / 15 / 15', holders: 50, creator: 20, burn: 15, treasury: 15 },
];
