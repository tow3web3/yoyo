'use client';

import { useEffect, useRef, useState } from 'react';
import StockLogo from './StockLogo';
import { describeAddress, getStock, LIQUID_TICKERS } from '../lib/stocks';

const MAX_ROWS = 6;

function relTime(iso, now) {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 3) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Demo stream shown until the bot has real events.
const DEMO_SOURCES = ['PEPE', 'WOJAK', 'CHAD', 'HOOD', 'PONS', 'MOON'];
function demoEvent(id) {
  const stock = getStock(LIQUID_TICKERS[Math.floor(Math.random() * LIQUID_TICKERS.length)]);
  const isPaid = Math.random() > 0.3;
  return {
    id, type: isPaid ? 'paid' : 'linked', demo: true,
    sourceSymbol: DEMO_SOURCES[Math.floor(Math.random() * DEMO_SOURCES.length)],
    rewardToken: stock.address,
    holderCount: isPaid ? 8 + Math.floor(Math.random() * 60) : null,
    time: new Date().toISOString(),
  };
}

function Row({ event, now, meta }) {
  const isPaid = event.type === 'paid';
  const reward = describeAddress(event.rewardToken, meta?.[event.rewardToken]);
  const sourceSymbol = event.sourceSymbol || meta?.[event.sourceToken]?.symbol || (event.sourceToken ? event.sourceToken.slice(2, 6).toUpperCase() : '????');
  return (
    <li className="animate-feedin flex items-center gap-3 border-b border-line/70 px-4 py-2.5 last:border-b-0">
      {isPaid ? <StockLogo address={event.rewardToken} meta={meta?.[event.rewardToken]} /> : <StockLogo address={event.sourceToken} meta={meta?.[event.sourceToken]} />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
          {isPaid ? (
            <>
              <span className="font-semibold text-hood-600">Dividend</span>
              <span className="truncate font-mono">{reward.symbol}</span>
              {event.holderCount ? <span className="text-mut">· {event.holderCount} holders</span> : null}
            </>
          ) : (
            <>
              <span className="font-semibold text-gold-600">Linked</span>
              <span className="truncate">${sourceSymbol}</span>
            </>
          )}
        </div>
        <div className="text-xs text-mut">{isPaid ? `to holders of $${sourceSymbol}` : `paying dividends in ${reward.symbol}`}</div>
      </div>
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-mut">{relTime(event.time, now)}</span>
    </li>
  );
}

export default function LiveFeed() {
  const [events, setEvents] = useState([]);
  const [meta, setMeta] = useState({});
  const [now, setNow] = useState(() => Date.now());
  const [demo, setDemo] = useState(false);
  const demoId = useRef(0);
  const demoMode = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/activity?limit=${MAX_ROWS}`, { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.events) && data.events.length > 0) {
          demoMode.current = false;
          setDemo(false);
          if (data.meta) setMeta((prev) => ({ ...prev, ...data.meta }));
          setEvents(data.events.map((e, i) => ({ ...e, id: `r${i}-${e.time}` })));
          return;
        }
      } catch { /* backend offline */ }
      if (!cancelled && !demoMode.current) {
        demoMode.current = true;
        setDemo(true);
        setEvents(Array.from({ length: MAX_ROWS }, () => {
          const ev = demoEvent(demoId.current++);
          ev.time = new Date(Date.now() - Math.random() * 120000).toISOString();
          return ev;
        }));
      }
    }
    load();
    const refresh = setInterval(load, 25000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    let demoTimer;
    const scheduleDemo = () => {
      demoTimer = setTimeout(() => {
        if (demoMode.current) setEvents((prev) => [demoEvent(demoId.current++), ...prev].slice(0, MAX_ROWS));
        scheduleDemo();
      }, 30000 + Math.random() * 30000);
    };
    scheduleDemo();
    return () => { cancelled = true; clearInterval(refresh); clearInterval(clock); clearTimeout(demoTimer); };
  }, []);

  return (
    <div className="panel-glow overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-hood-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-hood-500" />
          </span>
          <span className="text-sm font-semibold text-ink">Live activity</span>
        </div>
        <span className="chip">{demo ? 'Preview' : 'Auto-updating'}</span>
      </div>
      <ul>{events.map((e) => <Row key={e.id} event={e} now={now} meta={meta} />)}</ul>
    </div>
  );
}
