'use client';

import { useEffect, useRef, useState } from 'react';
import { Coins, Chart, Bolt, TrendUp } from './Icons';
import { STOCKS } from '../lib/stocks';

function Counter({ value, decimals = 0, prefix = '', start }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) return;
    const target = Number(value) || 0;
    if (target === 0) return setN(0);
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 1200);
      setN(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, value]);
  const formatted = decimals > 0
    ? n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : Math.round(n).toLocaleString('en-US');
  return <span className="figure">{prefix}{formatted}</span>;
}

export default function StatsBar() {
  const ref = useRef(null);
  const [start, setStart] = useState(false);
  const [ethPrice, setEthPrice] = useState(0);
  const [stats, setStats] = useState({ totalEthClaimed: 0, totalExecutions: 0, activeConfigs: 0, totalUsers: 0 });

  useEffect(() => {
    fetch('/api/stats', { cache: 'no-store' }).then((r) => r.json()).then((d) => setStats((s) => ({ ...s, ...d }))).catch(() => {});
    fetch('/api/stocks/prices?tickers=NVDA', { cache: 'no-store' }).then((r) => r.json()).then((d) => {
      const p = Number(d?.quotes?.['ETH-USD']?.price);
      if (p > 0) setEthPrice(p);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStart(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const items = [
    { Icon: Coins, label: 'Paid in dividends', value: (Number(stats.totalEthClaimed) || 0) * ethPrice, prefix: '$', tile: 'bg-hood-100 text-hood-700', ring: 'hover:border-hood-300' },
    { Icon: Bolt, label: 'Dividend cycles', value: stats.totalExecutions || 0, tile: 'bg-gold-100 text-gold-700', ring: 'hover:border-gold-300' },
    { Icon: Chart, label: 'Tokens paying', value: stats.activeConfigs || 0, tile: 'bg-tile text-ink', ring: 'hover:border-ink' },
    { Icon: TrendUp, label: 'Stocks available', value: STOCKS.length, tile: 'bg-hood-100 text-hood-700', ring: 'hover:border-hood-300' },
  ];

  return (
    <div ref={ref} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map(({ Icon, label, value, prefix, tile, ring }) => (
        <div key={label} className={`panel card-fun p-5 ${ring}`}>
          <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${tile}`}><Icon className="h-[18px] w-[18px]" /></span>
          <div className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            <Counter value={value} prefix={prefix} start={start} />
          </div>
          <div className="mt-1 text-xs font-medium uppercase tracking-wider text-mut">{label}</div>
        </div>
      ))}
    </div>
  );
}
