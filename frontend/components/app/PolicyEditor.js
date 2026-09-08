'use client';

import { useMemo } from 'react';
import { Slider, Seg, Field, inputCls, PRESETS, StockPicker } from './ui';

/**
 * The dividend policy as four sliders that always sum to 100. Moving one
 * slider takes from (or gives to) the holders share, which is the natural
 * balancing item of a payout ratio.
 */
export default function PolicyEditor({ value, onChange, showAddresses = true }) {
  const { holders, creator, burn, treasury, creatorAddress, treasuryAddress, treasuryAsset, payoutMode } = value;
  const set = (patch) => onChange({ ...value, ...patch });

  const setLeg = (key, v) => {
    const others = { creator, burn, treasury, [key]: v };
    const sum = others.creator + others.burn + others.treasury;
    if (sum > 100) return; // holders cannot go negative
    set({ [key]: v, holders: 100 - sum });
  };
  const presetKey = `${holders}-${creator}-${burn}-${treasury}`;

  const bar = useMemo(() => [
    ['holders', holders, 'bg-hood-500'], ['you', creator, 'bg-ink'], ['burn', burn, 'bg-orange-500'], ['treasury', treasury, 'bg-gold-400'],
  ], [holders, creator, burn, treasury]);

  return (
    <div className="space-y-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-tile">
        {bar.map(([k, v, c]) => <div key={k} className={`${c} transition-all`} style={{ width: `${v}%` }} title={`${k} ${v}%`} />)}
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {bar.map(([k, v, c]) => (
          <div key={k}>
            <div className={`mx-auto mb-1 h-1 w-6 rounded-full ${c}`} />
            <div className="figure font-display text-lg font-extrabold text-ink">{v}%</div>
            <div className="text-[10px] uppercase tracking-wider text-mut">{k}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button key={p.key} type="button" onClick={() => set({ holders: p.holders, creator: p.creator, burn: p.burn, treasury: p.treasury })}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${presetKey === p.key ? 'border-hood-500 bg-hood-50 text-hood-700' : 'border-line bg-paper text-mut hover:text-ink'}`}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 rounded-xl border border-line bg-ground p-4">
        <Slider label="👤 Your share" value={creator} onChange={(v) => setLeg('creator', v)} color="accent-ink" />
        <Slider label="🔥 Buyback and burn" value={burn} onChange={(v) => setLeg('burn', v)} color="accent-orange-500" />
        <Slider label="🏦 Retained in treasury" value={treasury} onChange={(v) => setLeg('treasury', v)} color="accent-gold-400" />
        <p className="text-[11px] text-mut">Holders receive the rest: <span className="font-bold text-hood-700">{holders}%</span>. A share without a destination address is paid to holders.</p>
      </div>

      {showAddresses && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Your payout address" hint={creator > 0 && !creatorAddress ? 'Required to activate your share' : 'Where your share goes, never the dev wallet'}>
            <input value={creatorAddress || ''} onChange={(e) => set({ creatorAddress: e.target.value.trim() })} placeholder="0x…" className={inputCls} />
          </Field>
          <Field label="Treasury address" hint={treasury > 0 && !treasuryAddress ? 'Required to activate the treasury share' : 'A cold wallet or multisig you control'}>
            <input value={treasuryAddress || ''} onChange={(e) => set({ treasuryAddress: e.target.value.trim() })} placeholder="0x…" className={inputCls} />
          </Field>
          <Field label="Treasury asset" hint="What ETH fees buy for the treasury. Stock fees move in kind.">
            <StockPicker value={treasuryAsset || ''} onChange={(v) => set({ treasuryAsset: v })} allowEth={false} allowAddress={false} compact />
          </Field>
          <Field label="Stock fees" hint={payoutMode === 'convert' ? 'Sold and converted to your reward before payout' : 'Paid to holders as they are: NVDA in, NVDA out'}>
            <Seg value={payoutMode || 'in_kind'} onChange={(v) => set({ payoutMode: v })} options={[{ value: 'in_kind', label: '📦 In kind' }, { value: 'convert', label: '🔁 Convert' }]} />
          </Field>
        </div>
      )}
    </div>
  );
}
