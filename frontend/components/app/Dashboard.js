'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import StockLogo from '../StockLogo';
import Countdown from '../Countdown';
import { Copy, Check, Bolt, Pause, Arrow } from '../Icons';
import PolicyEditor from './PolicyEditor';
import { LoyaltyEditor, RewardEditor, ScheduleEditor } from './Editors';
import { Card, Button, useToast, shortAddr, fmtUsd, fmtNum, units, scheduleValue, parseSchedule } from './ui';
import { describeAddress, explorerAddress, explorerTx, ZERO } from '../../lib/stocks';

function CopyBtn({ text, label = 'Copy' }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); } catch { /* ignore */ } }} className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-semibold text-mut transition hover:border-hood-400 hover:text-hood-700">
      {ok ? <Check className="h-3 w-3 text-hood-600" /> : <Copy className="h-3 w-3" />}{ok ? 'Copied' : label}
    </button>
  );
}

/** A card that tracks a draft, shows Save when dirty, and PATCHes on save. */
function Editable({ title, eyebrow, initial, toPatch, children, tone }) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => setDraft(initial), [JSON.stringify(initial)]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  async function save() {
    setBusy(true);
    try {
      const res = await fetch('/api/app/config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toPatch(draft)) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast('Saved. The scheduler picked it up.');
      window.dispatchEvent(new Event('bm:refresh'));
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title={title} eyebrow={eyebrow} tone={tone} aside={dirty ? <div className="flex gap-2"><Button variant="ghost" className="!py-1.5 text-xs" onClick={() => setDraft(initial)} disabled={busy}>Discard</Button><Button className="!py-1.5 text-xs" onClick={save} busy={busy}>Save</Button></div> : null}>
      {children(draft, setDraft)}
    </Card>
  );
}

export default function Dashboard({ data, refresh, onLogout }) {
  const { config, assets, logs, meta, user } = data;
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const [tg, setTg] = useState(null);
  const src = meta[config.source_token_address] || {};
  const symbol = src.symbol || config.source_token_address.slice(2, 6).toUpperCase();

  const policyInitial = useMemo(() => ({
    holders: Number(config.split_holders_bps) / 100, creator: Number(config.split_creator_bps) / 100, burn: Number(config.split_burn_bps) / 100, treasury: Number(config.split_treasury_bps) / 100,
    creatorAddress: config.creator_address || '', treasuryAddress: config.treasury_address || '', treasuryAsset: config.treasury_asset || '', payoutMode: config.payout_mode || 'in_kind',
  }), [config]);
  const loyaltyInitial = useMemo(() => ({ enabled: Boolean(config.loyalty_enabled), maxBps: Number(config.loyalty_max_bps || 20000), rampDays: Number(config.loyalty_ramp_days || 30), minHoldHours: Number(config.loyalty_min_hold_hours || 0), sellReset: Boolean(config.loyalty_sell_reset) }), [config]);
  const rewardInitial = useMemo(() => ({ rewardMode: config.reward_mode || 'fixed', reward: config.target_token_address === ZERO ? 'ETH' : config.target_token_address, basket: config.basket || 'MAG7' }), [config]);
  const scheduleInitial = useMemo(() => ({ schedule: scheduleValue(config), marketHoursOnly: Boolean(config.market_hours_only), feeSource: config.fee_source || 'wallet' }), [config]);

  async function act(kind) {
    setBusy(kind);
    try {
      if (kind === 'run') {
        const res = await fetch('/api/app/config/run', { method: 'POST' });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        toast('Cycle started. Results land here and on Telegram in a minute or two.');
      } else if (kind === 'pause' || kind === 'resume') {
        const res = await fetch('/api/app/config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: kind === 'resume' }) });
        if (!res.ok) throw new Error((await res.json()).error);
        toast(kind === 'resume' ? 'Resumed.' : 'Paused. No cycles until you resume.');
        refresh();
      } else if (kind === 'delete') {
        if (!window.confirm('Delete this Boomerang? The bot loses access to the dev wallet. Withdraw its funds first.')) return;
        const res = await fetch('/api/app/config', { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error);
        toast('Deleted.');
        refresh();
      } else if (kind === 'tg') {
        const res = await fetch('/api/app/telegram-link', { method: 'POST' });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        setTg(d.url);
      }
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setBusy(null);
    }
  }

  const eth = assets?.assets?.find((a) => a.isNative);
  const lowGas = eth && eth.amount < (assets.gasReserveEth || 0.002);
  const payable = (assets?.assets || []).filter((a) => (a.isNative ? a.spendable > 0.0005 : a.usd >= 1));

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      {/* Top strip */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <StockLogo address={config.source_token_address} meta={src} size="h-12 w-12" text="text-xs" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-extrabold tracking-tight text-ink">{src.name || `$${symbol}`}</h1>
              <span className={`chip ${config.is_active ? 'text-hood-700' : 'text-mut'}`}><span className={`h-1.5 w-1.5 rounded-full ${config.is_active ? 'bg-hood-500' : 'bg-mut'}`} />{config.is_active ? 'Running' : 'Paused'} · {config.scheduleLabel}</span>
              {data.yield?.apy ? <span className="chip-gold">📈 {data.yield.apy.toFixed(data.yield.apy >= 10 ? 1 : 2)}% yield</span> : null}
            </div>
            <div className="mt-1 flex items-center gap-2 font-mono text-xs text-mut">${symbol} · <Link href={`/${config.source_token_address}`} className="text-hood-700 hover:underline">public dashboard ↗</Link></div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => act('run')} busy={busy === 'run'} disabled={!config.is_active}><Bolt className="h-4 w-4" /> Run a cycle now</Button>
          {config.is_active ? <Button variant="ghost" onClick={() => act('pause')} busy={busy === 'pause'}><Pause className="h-4 w-4" /> Pause</Button> : <Button variant="ink" onClick={() => act('resume')} busy={busy === 'resume'}>▶ Resume</Button>}
          <button type="button" onClick={onLogout} className="text-xs text-mut hover:text-ink">Sign out</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        {/* Left: live state */}
        <div className="space-y-4">
          <Card eyebrow="Next cycle" title={config.is_active ? 'Countdown' : 'Paused'} tone="ink" aside={config.is_active ? <span className="figure font-display text-3xl font-extrabold text-hood-400"><Countdown intervalMinutes={config.interval_minutes} scheduleKind={config.schedule_kind} /></span> : null}>
            <div className="text-sm text-white/70">
              {payable.length ? <>Will pay <span className="font-mono font-bold text-white">{payable.map((a) => `${fmtNum(a.isNative ? a.spendable : a.amount)} ${a.symbol}`).join(' + ')}</span> under the policy below{config.loyalty_enabled ? ', loyalty-weighted' : ''}.</> : <>Nothing to distribute yet. Fees land in the dev wallet, then the next cycle pays them out.</>}
            </div>
          </Card>

          <Card eyebrow="Dev wallet" title={shortAddr(config.dev_wallet_public)} aside={<div className="flex gap-2"><CopyBtn text={config.dev_wallet_public} label="Copy address" /><a href={explorerAddress(config.dev_wallet_public)} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-mut hover:border-hood-400 hover:text-hood-700">Blockscout ↗</a></div>}>
            {lowGas && <div className="mb-3 rounded-xl border border-gold-300 bg-gold-50 p-3 text-xs text-gold-700">⛽ Low gas: the wallet holds {fmtNum(eth.amount)} ETH. Send ~0.005 ETH so cycles can pay transfers.</div>}
            <div className="mb-3 rounded-xl border border-line bg-ground p-3 text-xs text-mut">
              Set <span className="font-mono text-ink">{config.dev_wallet_public}</span> as the fee recipient on your launchpad. Whatever lands here (stocks or ETH) is what the next cycle distributes.
            </div>
            {assets?.error && <p className="text-xs text-down">{assets.error}</p>}
            <div className="divide-y divide-line/70">
              {(assets?.assets || []).map((a) => (
                <div key={a.address} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2"><StockLogo address={a.address} meta={{ symbol: a.symbol }} size="h-7 w-7" text="text-[8px]" /><div><div className="font-mono text-sm font-semibold text-ink">{a.symbol}</div><div className="text-[11px] text-mut">{a.name}</div></div></div>
                  <div className="text-right"><div className="figure text-sm font-semibold text-ink">{fmtNum(a.amount)}</div><div className="figure text-[11px] text-mut">{fmtUsd(a.usd)}{a.isNative ? ` · ${fmtNum(a.spendable)} spendable` : ''}</div></div>
                </div>
              ))}
              {assets && assets.assets.length <= 1 && !(eth?.amount > 0) && <div className="py-3 text-xs text-mut">Empty so far.</div>}
            </div>
            {assets && <div className="mt-2 flex justify-between text-xs text-mut"><span>Total</span><span className="figure font-bold text-ink">{fmtUsd(assets.totalUsd)}</span></div>}
          </Card>

          <Card eyebrow="History" title="Recent cycles" aside={<Link href={`/${config.source_token_address}`} className="text-xs font-semibold text-hood-700 hover:underline">Public dashboard ↗</Link>}>
            {logs.length === 0 && <p className="text-xs text-mut">No cycle yet.</p>}
            <div className="space-y-1.5">
              {logs.map((l) => {
                const r = describeAddress(l.reward_token_used, meta[l.reward_token_used]);
                const paid = Number(l.total_airdropped || 0) > 0;
                return (
                  <div key={l.id} className="rounded-lg border border-line/70 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-mut">{new Date(l.execution_time).toLocaleString()}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${l.status === 'success' ? (paid ? 'bg-hood-100 text-hood-700' : 'bg-tile text-mut') : 'bg-red-100 text-red-700'}`}>{l.status === 'success' ? (paid ? 'paid' : 'idle') : 'failed'}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-mut">
                      {paid && <span className="flex items-center gap-1"><StockLogo address={l.reward_token_used} meta={{ symbol: r.symbol }} size="h-4 w-4" text="text-[6px]" /><span className="figure font-semibold text-ink">{fmtNum(units(l.total_airdropped, meta[l.reward_token_used]?.decimals ?? 18))} {r.symbol}</span> to {l.holder_count} holders</span>}
                      {Number(l.creator_amount) > 0 && <span>👤 {fmtNum(units(l.creator_amount))}</span>}
                      {Number(l.burn_amount) > 0 && <span>🔥 {fmtNum(units(l.burn_amount), 2)}</span>}
                      {Number(l.treasury_amount) > 0 && <span>🏦 +{fmtNum(units(l.treasury_amount))} {meta[l.treasury_token]?.symbol || ''}</span>}
                      {l.error_message && <span className="text-gold-700">{l.error_message}</span>}
                      {paid && <Link href={`/receipt/${l.id}`} className="font-semibold text-hood-700 hover:underline">receipt</Link>}
                      {l.tx_hash && <a href={explorerTx(l.tx_hash)} target="_blank" rel="noopener noreferrer" className="hover:underline">tx ↗</a>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right: the policy */}
        <div className="space-y-4">
          <Editable title="Dividend policy" eyebrow="Payout ratio · you · buyback · treasury" tone="gold" initial={policyInitial}
            toPatch={(d) => ({ split_holders_bps: d.holders * 100, split_creator_bps: d.creator * 100, split_burn_bps: d.burn * 100, split_treasury_bps: d.treasury * 100, creator_address: d.creatorAddress || null, treasury_address: d.treasuryAddress || null, treasury_asset: d.treasuryAsset || null, payout_mode: d.payoutMode })}>
            {(d, set) => <PolicyEditor value={d} onChange={set} />}
          </Editable>

          <Editable title="Record date" eyebrow="Loyalty weighting" initial={loyaltyInitial}
            toPatch={(d) => ({ loyalty_enabled: d.enabled, loyalty_max_bps: d.maxBps, loyalty_ramp_days: d.rampDays, loyalty_min_hold_hours: d.minHoldHours, loyalty_sell_reset: d.sellReset })}>
            {(d, set) => <LoyaltyEditor value={d} onChange={set} />}
          </Editable>

          <Editable title="Reward for ETH fees" eyebrow="Conversion" initial={rewardInitial}
            toPatch={(d) => ({ reward_mode: d.rewardMode, reward: d.rewardMode === 'fixed' ? d.reward : undefined, basket: d.rewardMode === 'portfolio' ? d.basket : undefined })}>
            {(d, set) => <RewardEditor value={d} onChange={set} />}
          </Editable>

          <Editable title="Schedule and fee source" eyebrow="Calendar" initial={scheduleInitial}
            toPatch={(d) => ({ ...parseSchedule(d.schedule), market_hours_only: d.marketHoursOnly, fee_source: d.feeSource })}>
            {(d, set) => <ScheduleEditor value={d} onChange={set} />}
          </Editable>

          <Card title="Telegram" eyebrow="Receipts and alerts">
            {user.telegramLinked ? (
              <p className="text-sm text-mut">Linked{user.telegramUsername ? ` to @${user.telegramUsername}` : ''}. Send <span className="font-mono text-ink">/announce</span> in your project group so every dividend posts a receipt card there.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-mut">Get every cycle's result on Telegram, post receipt cards in your group, and control the same Boomerang from the bot.</p>
                {tg ? <a href={tg} target="_blank" rel="noopener noreferrer" className="btn-primary !py-2 text-xs">Open Telegram to link <Arrow className="h-3.5 w-3.5" /></a> : <Button variant="ghost" className="!py-2 text-xs" onClick={() => act('tg')} busy={busy === 'tg'}>Link Telegram</Button>}
              </div>
            )}
          </Card>

          <Card title="Danger zone" eyebrow="Irreversible">
            <p className="mb-3 text-xs text-mut">Deleting removes the bot's access to the dev wallet. Move its funds out first.</p>
            <Button variant="danger" className="!py-2 text-xs" onClick={() => act('delete')} busy={busy === 'delete'}>Delete this Boomerang</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
