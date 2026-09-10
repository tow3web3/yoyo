'use client';

// $YOYO runs on its own product. This is its live routing and numbers, on the
// homepage, straight from the public dashboard API.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PolicyMini from './PolicyMini';
import { Arrow } from './Icons';

const CA = process.env.NEXT_PUBLIC_BOOMERANG_CA || '';
const fmt = (raw, decimals = 18) => {
  const n = Number(raw || 0) / 10 ** decimals;
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : n.toFixed(2);
};

export default function YoyoLive() {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!CA) return undefined;
    let alive = true;
    const load = () => fetch(`/api/dashboard/${CA}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => alive && d && setData(d)).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  if (!CA || !data) return null;

  const sym = data.sourceToken?.symbol || 'YOYO';
  const stats = [
    ['Paid to holders', `${fmt(data.stats.totalAirdropped)} $${sym}`],
    ['Bought back', `${fmt(data.stats.totalBoughtBack)} $${sym}`],
    ['Cycles', String(data.stats.totalExecutions || 0)],
    ['Holders', String(data.stats.holderCount || 0)],
  ];

  return (
    <div id="yoyo" className="scroll-mt-20">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow mb-1">We eat our own dividends</div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">${sym} runs on yo-yo, live</h2>
          <p className="mt-2 max-w-xl text-sm text-mut">The coin behind the product uses the product: {data.config.scheduleLabel?.toLowerCase()}, creator fees are routed as drawn below. Every cycle is public.</p>
        </div>
        <Link href={`/${CA}`} className="btn-primary whitespace-nowrap">Open the ${sym} dashboard <Arrow className="h-4 w-4" /></Link>
      </div>
      <PolicyMini source={data.sourceToken} devWallet={data.devWallet} schedule={data.config.scheduleLabel} legs={data.legs} split={data.config.split} />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([l, v]) => (
          <div key={l} className="panel p-4">
            <div className="figure font-display text-xl font-extrabold text-ink">{v}</div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-mut">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
