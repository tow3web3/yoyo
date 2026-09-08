'use client';

import { Slider, Seg, Toggle, Field, StockPicker, SCHEDULES } from './ui';
import { BASKETS } from '../../lib/stocks';

export function LoyaltyEditor({ value, onChange }) {
  const set = (p) => onChange({ ...value, ...p });
  const minLabel = (h) => (h === 0 ? 'none' : h < 24 ? `${h}h` : `${Math.round(h / 24)}d`);
  return (
    <div className="space-y-3">
      <Toggle checked={value.enabled} onChange={(v) => set({ enabled: v })} label="Weight dividends by holding time" hint="Snipers who buy before the record date earn less than long-term holders" />
      <div className={`space-y-3 rounded-xl border border-line bg-ground p-4 transition ${value.enabled ? '' : 'pointer-events-none opacity-40'}`}>
        <Slider label="Max multiplier" value={value.maxBps / 10000} min={1} max={5} step={0.5} onChange={(v) => set({ maxBps: Math.round(v * 10000) })} format={(v) => `${v.toFixed(1)}x`} />
        <Slider label="Ramp to max" value={value.rampDays} min={1} max={180} step={1} onChange={(v) => set({ rampDays: v })} format={(v) => `${v} days`} />
        <Slider label="Minimum hold to qualify" value={value.minHoldHours} min={0} max={168} step={1} onChange={(v) => set({ minHoldHours: v })} format={minLabel} />
        <Toggle checked={value.sellReset} onChange={(v) => set({ sellReset: v })} label="Selling resets the clock" hint="Any outgoing transfer restarts a wallet's holding time" />
        <p className="text-[11px] text-mut">A wallet's weight = balance x multiplier. The multiplier ramps from 1x to {(value.maxBps / 10000).toFixed(1)}x over {value.rampDays} days{value.minHoldHours ? `; wallets held under ${minLabel(value.minHoldHours)} get nothing that cycle` : ''}. Voting weight follows the same rule.</p>
      </div>
    </div>
  );
}

const MODES = [
  { value: 'fixed', label: '🎯 Fixed' }, { value: 'roulette', label: '🎰 Roulette' }, { value: 'gainer', label: '🚀 Top Gainer' }, { value: 'portfolio', label: '📊 Portfolio' }, { value: 'vote', label: '🗳️ Vote' },
];

export function RewardEditor({ value, onChange }) {
  const set = (p) => onChange({ ...value, ...p });
  return (
    <div className="space-y-3">
      <p className="text-xs text-mut">Applies to <span className="font-semibold text-ink">ETH fees</span> (and to stock fees in convert mode). In-kind stock fees are paid as they are.</p>
      <Seg value={value.rewardMode} onChange={(v) => set({ rewardMode: v })} options={MODES} size="sm" />
      {value.rewardMode === 'fixed' && (
        <Field label="Reward" hint="One of the 195 Robinhood Stock Tokens, ETH, or any token address">
          <StockPicker value={value.reward} onChange={(v) => set({ reward: v })} />
        </Field>
      )}
      {value.rewardMode === 'portfolio' && (
        <Field label="Basket" hint="One stock per cycle, in order, then repeat">
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(BASKETS).map(([k, b]) => (
              <button key={k} type="button" onClick={() => set({ basket: k })} className={`rounded-xl border px-3 py-2 text-left transition ${value.basket === k ? 'border-hood-500 bg-hood-50' : 'border-line bg-paper hover:border-hood-300'}`}>
                <div className="text-sm font-semibold text-ink">{b.emoji} {b.label}</div>
                <div className="font-mono text-[11px] text-mut">{b.tickers.join(' › ')}</div>
              </button>
            ))}
          </div>
        </Field>
      )}
      {value.rewardMode === 'roulette' && <p className="text-xs text-mut">A random stock from the liquid pool every cycle. Holders never know what is coming.</p>}
      {value.rewardMode === 'gainer' && <p className="text-xs text-mut">The best-performing stock of the day among the liquid pool, from Yahoo Finance.</p>}
      {value.rewardMode === 'vote' && <p className="text-xs text-mut">Holders vote on the next reward on the /vote page, weighted by balance and loyalty. The fixed reward is used until the first vote resolves.</p>}
    </div>
  );
}

export function ScheduleEditor({ value, onChange }) {
  const set = (p) => onChange({ ...value, ...p });
  return (
    <div className="space-y-3">
      <Seg value={value.schedule} onChange={(v) => set({ schedule: v })} options={SCHEDULES} size="sm" />
      <Toggle checked={value.marketHoursOnly} onChange={(v) => set({ marketHoursOnly: v })} label="Market hours only" hint="Skip cycles outside 9:30 to 16:00 New York time, weekdays" />
      <Seg value={value.feeSource} onChange={(v) => set({ feeSource: v })} options={[{ value: 'wallet', label: '💼 Fees land in the wallet' }, { value: 'univ3', label: '🦄 Uniswap V3 LP fees' }]} size="sm" />
    </div>
  );
}
