'use client';

// The Studio: one screen where the creator draws their fee routing.
// Left node = the dev wallet (what lands there each cycle). Right nodes = legs:
// holders, wallets, buyback, treasury. Edges carry the share. The inspector on
// the right edits whatever is selected. Save writes the routing table; the
// scheduler applies it on the next cycle.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ReactFlow, Background, Controls, Handle, Position, BaseEdge, EdgeLabelRenderer, getBezierPath, ReactFlowProvider, useNodesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import StockLogo from '../StockLogo';
import Countdown from '../Countdown';
import { Bolt, Pause, Arrow, Copy, Check } from '../Icons';
import { LoyaltyEditor, RewardEditor, ScheduleEditor } from './Editors';
import { Button, Seg, Slider, StockPicker, inputCls, useToast, useCustomToken, useTokenResearch, shortAddr, fmtUsd, fmtNum, units, scheduleValue, parseSchedule } from './ui';
import TokenCard from './TokenCard';
import Wizard from './Wizard';
import SharePanel from './Share';
import { describeAddress, explorerAddress, explorerTx, getStock, ZERO } from '../../lib/stocks';

const KIND = {
  holders: { label: 'Holders', emoji: '🎁', color: '#CAF90F', text: 'text-hood-700', bg: 'bg-hood-100', hint: 'The dividend. Weighted by balance and loyalty.' },
  wallet: { label: 'Wallet', emoji: '👤', color: '#0B0F0C', text: 'text-ink', bg: 'bg-tile', hint: 'Any address: you, a partner, marketing, a DAO.' },
  burn: { label: 'Buyback & burn', emoji: '🔥', color: '#FF7A1A', text: 'text-orange-700', bg: 'bg-orange-100', hint: 'Buys your own token on Uniswap and burns it.' },
  treasury: { label: 'Treasury', emoji: '🏦', color: '#F6C343', text: 'text-gold-700', bg: 'bg-gold-100', hint: 'Retained earnings. Book value published on the dashboard.' },
};
const ADDR = /^0x[0-9a-fA-F]{40}$/;
const SOURCE_ID = 'source';
const LEG_X = 480;
const LEG_GAP = 168;

/* ---------------- draft model ---------------- */
function legsFromData(data) {
  const { config, legs } = data;
  if (legs?.length) {
    return legs.map((l, i) => ({ key: `l${l.id}`, kind: l.kind, shareBps: Number(l.share_bps), address: l.address || '', asset: l.asset || '', label: l.label || KIND[l.kind].label, posX: l.pos_x ?? LEG_X, posY: l.pos_y ?? 30 + i * LEG_GAP }));
  }
  // Legacy split → legs
  const out = [];
  const push = (kind, bps, extra = {}) => bps > 0 && out.push({ key: `legacy-${kind}`, kind, shareBps: bps, address: '', asset: '', label: kind === 'wallet' ? 'You' : KIND[kind].label, posX: LEG_X, posY: 30 + out.length * LEG_GAP, ...extra });
  push('holders', Number(config.split_holders_bps));
  push('wallet', Number(config.split_creator_bps), { address: config.creator_address || '' });
  push('burn', Number(config.split_burn_bps));
  push('treasury', Number(config.split_treasury_bps), { address: config.treasury_address || '', asset: config.treasury_asset || '' });
  if (!out.length) push('holders', 10000);
  return out;
}
function draftFromData(data) {
  const c = data.config;
  return {
    legs: legsFromData(data),
    reward: { rewardMode: c.reward_mode || 'fixed', reward: c.target_token_address === ZERO ? 'ETH' : c.target_token_address, basket: c.basket || 'MAG7' },
    schedule: { schedule: scheduleValue(c), marketHoursOnly: Boolean(c.market_hours_only), feeSource: c.fee_source || 'wallet' },
    loyalty: { enabled: Boolean(c.loyalty_enabled), maxBps: Number(c.loyalty_max_bps || 20000), rampDays: Number(c.loyalty_ramp_days || 30), minHoldHours: Number(c.loyalty_min_hold_hours || 0), sellReset: Boolean(c.loyalty_sell_reset) },
    sourcePos: { x: 40, y: 60 },
  };
}
const stripPos = (d) => ({ ...d, legs: d.legs.map(({ posX, posY, ...l }) => l), sourcePos: undefined });
const totalBps = (legs) => legs.reduce((s, l) => s + l.shareBps, 0);
const legProblem = (l) => ((l.kind === 'wallet' || l.kind === 'treasury') && !ADDR.test(l.address) ? 'needs an address' : null);

/* ---------------- nodes ---------------- */
function AssetChip({ asset, meta, kind, fallback }) {
  const custom = useCustomToken(asset && !getStock(asset) && asset !== ZERO ? asset : null);
  if (!asset) return <span className="rounded-full bg-tile px-2 py-0.5 text-[10px] font-semibold text-mut">{fallback}</span>;
  const d = describeAddress(asset, meta?.[asset] || (custom?.symbol ? { symbol: custom.symbol, image: custom.image } : null));
  return <span className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-1.5 py-0.5 text-[10px] font-bold text-ink"><StockLogo address={asset} meta={{ symbol: d.symbol, image: custom?.image }} size="h-3.5 w-3.5" text="text-[5px]" />{kind === 'holders' ? 'paid in' : kind === 'treasury' ? 'holds' : 'in'} {d.symbol}</span>;
}

function SourceNode({ data }) {
  const { src, config, assets, selected } = data;
  const payable = (assets?.assets || []).filter((a) => (a.isNative ? a.spendable > 0.0005 : a.usd >= 1)).slice(0, 4);
  return (
    <div className={`w-[280px] rounded-2xl border-2 bg-ink p-4 text-white shadow-lg transition ${selected ? 'border-hood-500' : 'border-ink'}`}>
      <div className="flex items-center gap-3">
        <StockLogo address={config.source_token_address} meta={src} size="h-10 w-10" text="text-[10px]" />
        <div className="min-w-0"><div className="truncate font-display text-base font-extrabold">{src.name || `$${src.symbol || 'TOKEN'}`}</div><div className="font-mono text-[11px] text-white/60">dev wallet {shortAddr(config.dev_wallet_public)}</div></div>
        <span className={`ml-auto h-2.5 w-2.5 rounded-full ${config.is_active ? 'bg-hood-500' : 'bg-white/30'}`} title={config.is_active ? 'Running' : 'Paused'} />
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">In the dev wallet</div>
          <div className="figure font-display text-2xl font-extrabold text-hood-500">{assets ? fmtUsd(assets.totalUsd || 0) : '…'}</div>
        </div>
        <div className="text-right text-[10px] text-white/50">goes out<br /><span className="font-semibold text-white/80">{config.scheduleLabel?.toLowerCase()}</span></div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {payable.length ? payable.map((a) => <span key={a.address} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold"><StockLogo address={a.address} meta={{ symbol: a.symbol }} size="h-3.5 w-3.5" text="text-[5px]" />{fmtNum(a.isNative ? a.spendable : a.amount)} {a.symbol}</span>) : <span className="text-xs text-white/50">Nothing payable yet. Fees land here first.</span>}
      </div>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-ink !bg-hood-500" />
    </div>
  );
}

function LegNode({ data }) {
  const { leg, selected, meta, sourceSymbol } = data;
  const k = KIND[leg.kind];
  const problem = legProblem(leg);
  const dest = leg.kind === 'holders' ? `every ${sourceSymbol ? `$${sourceSymbol}` : ''} holder` : leg.kind === 'burn' ? `buys $${sourceSymbol || 'TOKEN'}, burns it` : ADDR.test(leg.address) ? shortAddr(leg.address) : 'no address yet';
  return (
    <div className={`w-[250px] rounded-2xl border-2 bg-paper p-3.5 shadow-soft transition ${selected ? 'border-ink' : problem ? 'border-red-300' : 'border-line'}`} style={{ borderLeftColor: k.color, borderLeftWidth: 6 }}>
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-paper" style={{ background: k.color }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-[10px] font-bold uppercase tracking-[0.16em] ${k.text}`}>{k.emoji} {k.label}</div>
          <div className="truncate text-sm font-bold text-ink">{leg.label}</div>
        </div>
        <div className="figure font-display text-2xl font-extrabold text-ink">{(leg.shareBps / 100).toFixed(leg.shareBps % 100 ? 1 : 0)}%</div>
      </div>
      <div className={`mt-1.5 font-mono text-[11px] ${problem ? 'text-red-600' : 'text-mut'}`}>{problem ? '⚠ ' + problem : dest}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {leg.kind === 'burn' ? <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">buyback</span> : <AssetChip asset={leg.asset} meta={meta} kind={leg.kind} fallback={leg.kind === 'treasury' ? 'stocks in kind · ETH buys SPY' : 'in kind'} />}
      </div>
    </div>
  );
}

function ShareEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }) {
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const w = 2 + (data.shareBps / 10000) * 10;
  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: data.color, strokeWidth: w, opacity: 0.35 }} />
      <path d={path} fill="none" stroke={data.color} strokeWidth={Math.max(1.5, w / 2)} strokeDasharray="6 10" className={data.active === false ? '' : 'bm-flow'} style={{ animationDuration: `${Math.max(0.6, 2.4 - (data.shareBps / 10000) * 1.6)}s`, opacity: data.active === false ? 0.45 : 1 }} />
      <EdgeLabelRenderer>
        <div className="pointer-events-none absolute rounded-full border border-line bg-paper px-2 py-0.5 font-mono text-[11px] font-bold text-ink shadow-soft" style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}>{(data.shareBps / 100).toFixed(data.shareBps % 100 ? 1 : 0)}%</div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { source: SourceNode, leg: LegNode };
const edgeTypes = { share: ShareEdge };

/* ---------------- inspector panels ---------------- */
/** Loud state: a play sign with moving bars while the policy runs, a pause sign when it does not. */
function RunBadge({ active }) {
  if (!active) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-300 bg-gold-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-700" title="Nothing goes out until you resume">
        <span className="flex h-3 w-3 items-center justify-center"><span className="mr-[2px] h-2.5 w-[3px] rounded-sm bg-gold-600" /><span className="h-2.5 w-[3px] rounded-sm bg-gold-600" /></span>Paused
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-hood-500" title="Cycles fire on schedule">
      <span className="relative flex h-3 w-3 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-hood-500 opacity-40" />
        <svg viewBox="0 0 10 10" className="relative h-2.5 w-2.5" aria-hidden><path d="M2 1.5v7l6-3.5z" fill="currentColor" /></svg>
      </span>
      Running
      <span className="run-bars ml-0.5 flex items-end gap-[2px]" aria-hidden><i /><i /><i /></span>
    </span>
  );
}

function CopyBtn({ text, label = 'Copy' }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); } catch { /* ignore */ } }} className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-semibold text-mut transition hover:border-hood-400 hover:text-hood-700">
      {ok ? <Check className="h-3 w-3 text-hood-600" /> : <Copy className="h-3 w-3" />}{ok ? 'Copied' : label}
    </button>
  );
}

function Section({ title, children, aside }) {
  return (
    <section className="border-b border-line px-4 py-4 last:border-b-0">
      <div className="mb-2.5 flex items-center justify-between"><h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-mut">{title}</h3>{aside}</div>
      {children}
    </section>
  );
}

function LegInspector({ leg, draft, setDraft, meta, sourceSymbol, onRemove }) {
  const k = KIND[leg.kind];
  const patch = (p) => setDraft((d) => ({ ...d, legs: d.legs.map((l) => (l.key === leg.key ? { ...l, ...p } : l)) }));
  const total = totalBps(draft.legs);
  const balanceOthers = () => setDraft((d) => {
    const others = d.legs.filter((l) => l.key !== leg.key);
    const room = 10000 - leg.shareBps;
    const otherTotal = totalBps(others);
    let acc = 0;
    const scaled = others.map((l, i) => {
      const v = i === others.length - 1 ? room - acc : otherTotal ? Math.round((l.shareBps / otherTotal) * room) : Math.round(room / others.length);
      acc += v;
      return { ...l, shareBps: Math.max(0, v) };
    });
    return { ...d, legs: d.legs.map((l) => (l.key === leg.key ? l : scaled.find((s) => s.key === l.key))) };
  });
  const convertMode = leg.asset ? 'convert' : 'kind';
  return (
    <>
      <div className="flex items-center gap-3 border-b border-line px-4 py-4">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${k.bg}`}>{k.emoji}</span>
        <div className="min-w-0 flex-1">
          <input value={leg.label} onChange={(e) => patch({ label: e.target.value.slice(0, 40) })} className="w-full bg-transparent font-display text-base font-extrabold text-ink outline-none" />
          <div className="text-xs text-mut">{k.hint}</div>
        </div>
      </div>
      <Section title="Share of every cycle" aside={total !== 10000 && <button type="button" onClick={balanceOthers} className="text-[11px] font-semibold text-hood-700 hover:underline">Balance the others to 100%</button>}>
        <Slider label={k.label} value={leg.shareBps / 100} step={0.5} onChange={(v) => patch({ shareBps: Math.round(v * 100) })} format={(v) => `${v}%`} />
        <div className={`mt-2 text-xs ${total === 10000 ? 'text-mut' : 'text-red-600'}`}>All legs: <span className="figure font-bold">{(total / 100).toFixed(1)}%</span>{total !== 10000 ? ' (must be 100%)' : ''}</div>
      </Section>
      {(leg.kind === 'wallet' || leg.kind === 'treasury') && (
        <Section title={leg.kind === 'wallet' ? 'Destination address' : 'Treasury wallet'}>
          <input value={leg.address} onChange={(e) => patch({ address: e.target.value.trim() })} placeholder="0x…" className={inputCls} />
          {leg.address && !ADDR.test(leg.address) && <p className="mt-1 text-xs text-red-600">Not a valid address.</p>}
          {leg.kind === 'treasury' && <p className="mt-1.5 text-xs text-mut">A wallet you control. yo-yo only sends to it. Its holdings become the book value on the public dashboard.</p>}
        </Section>
      )}
      {leg.kind === 'burn' && (
        <Section title="What burns">
          <p className="text-xs text-mut">This share is swapped into <span className="font-mono font-bold text-ink">${sourceSymbol || 'your token'}</span> on Uniswap and sent to the burn address. Stocks in this share are sold for ETH first. Supply shrinks every cycle.</p>
        </Section>
      )}
      {leg.kind === 'holders' && (
        <Section title="ETH fees convert to">
          <RewardEditor value={draft.reward} onChange={(v) => setDraft((d) => ({ ...d, reward: v }))} />
          <p className="mt-2 rounded-xl border border-gold-200 bg-gold-50 px-3 py-2 text-xs text-gold-700">Not a stock? Open the picker and use the <span className="font-bold">Any token</span> tab: paste any contract address on Robinhood Chain and holders get paid in it.</p>
        </Section>
      )}
      {leg.kind !== 'burn' && (
        <Section title={leg.kind === 'holders' ? 'Stock fees' : 'Payout asset'}>
          <Seg size="sm" value={convertMode} onChange={(v) => patch({ asset: v === 'kind' ? '' : leg.kind === 'treasury' ? getStock('SPY').address : leg.kind === 'holders' && draft.reward.rewardMode === 'fixed' && draft.reward.reward !== 'ETH' ? draft.reward.reward : getStock('SPY').address })}
            options={[{ value: 'kind', label: leg.kind === 'holders' ? '📦 Paid in kind' : leg.kind === 'treasury' ? '📦 Stocks in kind, ETH buys SPY' : '📦 As it arrives' }, { value: 'convert', label: '🔁 Convert everything to' }]} />
          {convertMode === 'convert' && (
            <div className="mt-2 space-y-2">
              <StockPicker value={leg.asset === ZERO ? 'ETH' : leg.asset} onChange={(v) => patch({ asset: v === 'ETH' ? ZERO : v })} allowEth={leg.kind !== 'treasury'} />
              <AssetResearch address={leg.asset} />
              <p className="text-xs text-mut">A stock, ETH, or any token by contract address. Swapped on Uniswap with the fair-price guard; if no route fills, this leg pays in kind that cycle.</p>
            </div>
          )}
        </Section>
      )}
      {leg.kind === 'holders' && (
        <Section title="Record date and loyalty">
          <LoyaltyEditor value={draft.loyalty} onChange={(v) => setDraft((d) => ({ ...d, loyalty: v }))} />
        </Section>
      )}
      <Section title="Remove">
        <Button variant="danger" className="!py-1.5 text-xs" onClick={onRemove} disabled={draft.legs.length <= 1}>Remove this leg</Button>
        {draft.legs.length <= 1 && <p className="mt-1 text-xs text-mut">Keep at least one destination.</p>}
      </Section>
    </>
  );
}

function AssetResearch({ address }) {
  const info = useTokenResearch(address || null);
  if (!address) return null;
  if (!info || info.loading) return <div className="flex items-center gap-2 rounded-2xl border border-line bg-paper px-3 py-3 text-xs text-mut"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-hood-500" /> Researching…</div>;
  if (info.error) return <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{info.error}</div>;
  return <TokenCard token={info} compact />;
}

function DevKeyReveal({ onRevealKey, address }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(null);
  const reveal = async () => {
    setBusy(true);
    try {
      const r = await onRevealKey();
      if (r?.address && address && r.address.toLowerCase() !== address.toLowerCase()) throw new Error('Key does not match this dev wallet');
      setKey(r.privateKey);
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  if (!onRevealKey) return null;
  return (
    <div className="mt-3 rounded-xl border border-line bg-ground p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs"><span className="font-semibold text-ink">Your wallet, your key.</span> <span className="text-mut">Export it anytime to import the dev wallet elsewhere.</span></div>
        {!key && <Button variant="ghost" className="!py-1 text-[11px]" onClick={reveal} busy={busy}>Reveal private key</Button>}
      </div>
      {key && (
        <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-2.5">
          <div className="break-all font-mono text-[11px] text-ink">{key}</div>
          <div className="mt-2 flex items-center gap-2"><CopyBtn text={key} label="Copy key" /><button type="button" onClick={() => setKey(null)} className="rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-semibold text-mut hover:text-ink">Hide</button></div>
          <p className="mt-2 text-[11px] text-red-700">Anyone holding this key controls the fees. Store it offline, never paste it in a chat.</p>
        </div>
      )}
    </div>
  );
}

function SourceInspector({ data, draft, setDraft, act, busy, tg, onRevealKey }) {
  const { config, assets, user } = data;
  const eth = assets?.assets?.find((a) => a.isNative);
  const lowGas = eth && eth.amount < (assets.gasReserveEth || 0.002);
  return (
    <>
      <div className="border-b border-line px-4 py-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-mut">Dev wallet</div>
        <div className="mt-1 break-all font-mono text-xs text-ink">{config.dev_wallet_public}</div>
        <div className="mt-2 flex gap-2"><CopyBtn text={config.dev_wallet_public} label="Copy address" /><a href={explorerAddress(config.dev_wallet_public)} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-mut hover:border-hood-400 hover:text-hood-700">Blockscout ↗</a></div>
        <p className="mt-2 text-xs text-mut">Set this address as the fee recipient on your launchpad. Whatever lands here is what the next cycle routes.</p>
        {lowGas && <div className="mt-2 rounded-xl border border-gold-300 bg-gold-50 p-2.5 text-xs text-gold-700">⛽ Low gas: {fmtNum(eth.amount)} ETH. Send ~0.005 ETH so cycles can pay transfers.</div>}
        <DevKeyReveal onRevealKey={onRevealKey} address={config.dev_wallet_public} />
      </div>
      <Section title="Holdings" aside={assets && <span className="figure text-xs font-bold text-ink">{fmtUsd(assets.totalUsd)}</span>}>
        {assets?.error && <p className="text-xs text-down">{assets.error}</p>}
        <div className="divide-y divide-line/70">
          {(assets?.assets || []).map((a) => (
            <div key={a.address} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2"><StockLogo address={a.address} meta={{ symbol: a.symbol }} size="h-6 w-6" text="text-[7px]" /><span className="font-mono text-xs font-semibold text-ink">{a.symbol}</span></div>
              <div className="text-right"><div className="figure text-xs font-semibold text-ink">{fmtNum(a.amount)}</div><div className="figure text-[10px] text-mut">{fmtUsd(a.usd)}</div></div>
            </div>
          ))}
          {assets && !(assets.assets || []).some((a) => a.usd >= 0.01 || a.amount > 0) && <div className="py-2 text-xs text-mut">Empty so far.</div>}
        </div>
      </Section>
      <Section title="Schedule and fee source">
        <ScheduleEditor value={draft.schedule} onChange={(v) => setDraft((d) => ({ ...d, schedule: v }))} />
      </Section>
      <Section title="Telegram remote">
        {user.telegramLinked ? (
          <p className="text-xs text-mut">Linked{user.telegramUsername ? ` to @${user.telegramUsername}` : ''}. Send <span className="font-mono text-ink">/announce</span> in your group so each dividend posts a receipt card there.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-mut">Cycle results, receipt cards in your group, and the same routing controllable from the bot.</p>
            {tg ? <a href={tg} target="_blank" rel="noopener noreferrer" className="btn-primary !py-1.5 text-xs">Open Telegram to link <Arrow className="h-3.5 w-3.5" /></a> : <Button variant="ghost" className="!py-1.5 text-xs" onClick={() => act('tg')} busy={busy === 'tg'}>Link Telegram</Button>}
          </div>
        )}
      </Section>
      <Section title="Danger zone">
        <p className="mb-2 text-xs text-mut">Deleting removes the bot's access to the dev wallet. Move its funds out first.</p>
        <Button variant="danger" className="!py-1.5 text-xs" onClick={() => act('delete')} busy={busy === 'delete'}>Delete this policy</Button>
      </Section>
    </>
  );
}

function RoutingSummary({ draft, meta, select }) {
  const total = totalBps(draft.legs);
  return (
    <>
      <div className="border-b border-line px-4 py-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-mut">Routing</div>
        <div className="mt-1 font-display text-base font-extrabold text-ink">Where every cycle goes</div>
        <p className="mt-1 text-xs text-mut">Click a node to edit it. Drag to arrange. Shares must total 100%.</p>
      </div>
      <div className="px-4 py-3">
        <div className="mb-3 flex h-2.5 w-full overflow-hidden rounded-full bg-tile">{draft.legs.map((l) => <div key={l.key} style={{ width: `${l.shareBps / 100}%`, background: KIND[l.kind].color }} className="transition-all" />)}</div>
        <div className="space-y-1">
          {draft.legs.map((l) => (
            <button key={l.key} type="button" onClick={() => select(l.key)} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-tile">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: KIND[l.kind].color }} />
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{l.label}{l.kind === 'wallet' && ADDR.test(l.address) ? <span className="ml-1 font-mono text-[10px] text-mut">{shortAddr(l.address)}</span> : null}</span>
              <span className="figure text-sm font-bold text-ink">{(l.shareBps / 100).toFixed(l.shareBps % 100 ? 1 : 0)}%</span>
            </button>
          ))}
        </div>
        <div className={`mt-3 flex justify-between border-t border-line pt-2 text-xs ${total === 10000 ? 'text-mut' : 'text-red-600'}`}><span>Total</span><span className="figure font-bold">{(total / 100).toFixed(1)}%</span></div>
      </div>
    </>
  );
}

function Cycles({ logs, meta, onClose }) {
  return (
    <div className="absolute bottom-4 left-4 z-20 max-h-[60%] w-[420px] max-w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-line bg-paper shadow-lg">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5"><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-mut">Recent cycles</span><button type="button" onClick={onClose} className="text-xs text-mut hover:text-ink">Close</button></div>
      <div className="max-h-[calc(60vh-3rem)] space-y-1.5 overflow-y-auto p-3">
        {logs.length === 0 && <p className="text-xs text-mut">No cycle yet.</p>}
        {logs.map((l) => {
          const r = describeAddress(l.reward_token_used, meta[l.reward_token_used]);
          const paid = Number(l.total_airdropped || 0) > 0;
          return (
            <div key={l.id} className="rounded-lg border border-line/70 px-3 py-2 text-xs">
              <div className="flex items-center justify-between"><span className="text-mut">{new Date(l.execution_time).toLocaleString()}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${l.status === 'success' ? (paid ? 'bg-hood-100 text-hood-700' : 'bg-tile text-mut') : 'bg-red-100 text-red-700'}`}>{l.status === 'success' ? (paid ? 'paid' : 'idle') : 'failed'}</span></div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-mut">
                {paid && <span className="flex items-center gap-1"><StockLogo address={l.reward_token_used} meta={{ symbol: r.symbol }} size="h-4 w-4" text="text-[6px]" /><span className="figure font-semibold text-ink">{fmtNum(units(l.total_airdropped, meta[l.reward_token_used]?.decimals ?? 18))} {r.symbol}</span> to {l.holder_count} holders</span>}
                {(l.legs || []).map((x, i) => <span key={i} className={x.failed ? 'text-red-600' : ''}>{KIND[x.kind]?.emoji} {x.failed ? `${x.label}: ${x.failed}` : `${fmtNum(units(x.output?.amount, x.output?.decimals ?? 18))} ${x.output?.symbol || ''}`}</span>)}
                {l.error_message && <span className="text-gold-700">{l.error_message}</span>}
                {paid && <Link href={`/receipt/${l.id}`} className="font-semibold text-hood-700 hover:underline">receipt</Link>}
                {l.tx_hash && <a href={explorerTx(l.tx_hash)} target="_blank" rel="noopener noreferrer" className="hover:underline">tx ↗</a>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- the studio ---------------- */
/** Step-by-step overlay shown once after the first policy is created. */
const TOUR = [
  { title: 'This is your coin', body: 'Fees from your launchpad land in this dev wallet. Everything that lands here gets routed at the closing bell. Click the node to see holdings, schedule and the Telegram link.', pos: 'left-[24%] top-[40%]' },
  { title: 'These are the legs', body: 'Each card is a destination with a share of every cycle. Holders is the dividend. Click a leg to change its share, its address and the asset it is paid in: a stock, ETH, or any token by contract address.', pos: 'right-[26%] top-[30%]' },
  { title: 'Add destinations', body: 'A partner wallet, a buyback and burn, a stock treasury. Add as many as you like; shares must add up to 100%.', pos: 'right-[26%] top-[6%]' },
  { title: 'Save, then let it run', body: 'Save routing writes the policy. Run now fires a cycle immediately. Cycles shows every payout with its receipt. You can change anything, any time.', pos: 'right-[6%] top-[12%]' },
];
function Tour({ onDone }) {
  const [i, setI] = useState(0);
  const step = TOUR[i];
  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      <div className="pointer-events-auto absolute inset-0 bg-ink/30" onClick={onDone} />
      <div className={`pointer-events-auto absolute w-[360px] rounded-2xl border border-hood-300 bg-paper p-4 shadow-lg reveal-pop ${step.pos}`}>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-hood-700">Quick tour · {i + 1} / {TOUR.length}</div>
        <div className="font-display text-base font-extrabold text-ink">{step.title}</div>
        <p className="mt-1 text-sm text-mut">{step.body}</p>
        <div className="mt-3 flex items-center justify-between">
          <button type="button" onClick={onDone} className="text-xs text-mut hover:text-ink">Skip</button>
          <Button className="!py-1.5 text-xs" onClick={() => (i + 1 < TOUR.length ? setI(i + 1) : onDone())}>{i + 1 < TOUR.length ? 'Next' : 'Got it'}</Button>
        </div>
      </div>
    </div>
  );
}

function StudioInner({ data, refresh, onLogout, onSwitchWallet, demo = false, onConnect, setup = false, onCreated, onRevealKey }) {
  const [guide, setGuide] = useState(true);
  const [tour, setTour] = useState(false);
  useEffect(() => {
    if (demo || setup) return;
    try { if (!localStorage.getItem('yoyo:tour-done')) setTour(true); } catch { /* ignore */ }
  }, [demo, setup]);
  const endTour = () => { setTour(false); try { localStorage.setItem('yoyo:tour-done', '1'); } catch { /* ignore */ } };
  const { config, assets, logs, meta, user } = data;
  const toast = useToast();
  const src = meta[config.source_token_address] || {};
  const initial = useMemo(() => draftFromData(data), [data]);
  const [draft, setDraft] = useState(initial);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(null);
  const [tg, setTg] = useState(null);
  const [showCycles, setShowCycles] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [launched, setLaunched] = useState(null);
  const dirty = JSON.stringify(stripPos(draft)) !== JSON.stringify(stripPos(initial));
  const initialKey = JSON.stringify(stripPos(initial));
  useEffect(() => { setDraft((d) => (JSON.stringify(stripPos(d)) === initialKey ? initial : d)); }, [initialKey, initial]); // refreshes keep the draft when dirty

  const total = totalBps(draft.legs);
  const problems = draft.legs.map(legProblem).filter(Boolean);
  const canSave = dirty && total === 10000 && problems.length === 0 && draft.legs.length > 0;

  // React Flow owns node positions while dragging (no re-render of node contents per frame,
  // which is what made the logos blink). Positions are copied into the draft on drag stop;
  // node contents are rebuilt only when something other than a position changes.
  const [nodes, setNodes, onNodesChangeRF] = useNodesState([]);
  const contentSig = JSON.stringify([draft.legs.map(({ posX, posY, ...l }) => l), selected, src.symbol, config.is_active, config.scheduleLabel, config.dev_wallet_public, (assets?.assets || []).map((a) => [a.address, a.amount]), Object.keys(meta || {})]);
  useEffect(() => {
    setNodes((prev) => {
      const pos = new Map(prev.map((n) => [n.id, n.position]));
      return [
        { id: SOURCE_ID, type: 'source', position: pos.get(SOURCE_ID) || draft.sourcePos, data: { src, config, assets, selected: selected === SOURCE_ID }, draggable: true },
        ...draft.legs.map((leg) => ({ id: leg.key, type: 'leg', position: pos.get(leg.key) || { x: leg.posX, y: leg.posY }, data: { leg, meta, sourceSymbol: src.symbol, selected: selected === leg.key } })),
      ];
    });
  }, [contentSig]); // eslint-disable-line react-hooks/exhaustive-deps
  // Discard (draft reset) must also snap nodes back to the saved positions.
  const posSig = JSON.stringify([draft.sourcePos, draft.legs.map((l) => [l.key, l.posX, l.posY])]);
  useEffect(() => {
    setNodes((prev) => prev.map((n) => {
      const leg = draft.legs.find((l) => l.key === n.id);
      const target = n.id === SOURCE_ID ? draft.sourcePos : leg ? { x: leg.posX, y: leg.posY } : null;
      return target && (target.x !== n.position.x || target.y !== n.position.y) ? { ...n, position: target } : n;
    }));
  }, [posSig]); // eslint-disable-line react-hooks/exhaustive-deps
  const edges = useMemo(() => draft.legs.map((leg) => ({ id: `e-${leg.key}`, source: SOURCE_ID, target: leg.key, type: 'share', data: { shareBps: leg.shareBps, color: KIND[leg.kind].color, active: demo || setup ? true : Boolean(config.is_active) } })), [draft.legs, config.is_active, demo, setup]);

  const onNodesChange = useCallback((changes) => onNodesChangeRF(changes.filter((c) => c.type !== 'remove')), [onNodesChangeRF]);
  const onNodeDragStop = useCallback((_, node) => {
    const p = { x: Math.round(node.position.x), y: Math.round(node.position.y) };
    setDraft((d) => (node.id === SOURCE_ID ? { ...d, sourcePos: p } : { ...d, legs: d.legs.map((l) => (l.key === node.id ? { ...l, posX: p.x, posY: p.y } : l)) }));
  }, []);

  function addLeg(kind) {
    setAddOpen(false);
    if (kind === 'holders' && draft.legs.some((l) => l.kind === 'holders')) return toast('There is already a holders leg.', 'err');
    const key = `new-${Date.now().toString(36)}`;
    const share = 1000;
    setDraft((d) => {
      // take the new share from the biggest leg so the total stays at 100%
      const biggest = [...d.legs].sort((a, b) => b.shareBps - a.shareBps)[0];
      const legs = d.legs.map((l) => (biggest && l.key === biggest.key && l.shareBps >= share ? { ...l, shareBps: l.shareBps - share } : l));
      const taken = biggest && biggest.shareBps >= share;
      const ys = legs.map((l) => l.posY);
      return { ...d, legs: [...legs, { key, kind, shareBps: taken ? share : 0, address: '', asset: '', label: kind === 'wallet' ? 'Partner wallet' : KIND[kind].label, posX: LEG_X, posY: (ys.length ? Math.max(...ys) : -LEG_GAP + 30) + LEG_GAP }] };
    });
    setSelected(key);
  }
  function removeLeg(key) {
    setDraft((d) => {
      const gone = d.legs.find((l) => l.key === key);
      const rest = d.legs.filter((l) => l.key !== key);
      const sink = rest.find((l) => l.kind === 'holders') || rest[0];
      return { ...d, legs: rest.map((l) => (sink && l.key === sink.key ? { ...l, shareBps: l.shareBps + (gone?.shareBps || 0) } : l)) };
    });
    setSelected(null);
  }

  async function save() {
    if (demo) { toast('This is the sample policy. Connect a wallet to route your own coin.'); onConnect?.(); return; }
    if (setup) { setGuide(true); return; }
    setBusy('save');
    try {
      const s = parseSchedule(draft.schedule.schedule);
      const body = {
        legs: draft.legs.map((l, i) => ({ kind: l.kind, shareBps: l.shareBps, address: l.address || null, asset: l.asset || null, label: l.label, posX: l.posX, posY: l.posY, sortOrder: i })),
        reward_mode: draft.reward.rewardMode, basket: draft.reward.rewardMode === 'portfolio' ? draft.reward.basket : null,
        ...(draft.reward.rewardMode === 'fixed' ? { reward: draft.reward.reward } : {}),
        ...s, market_hours_only: draft.schedule.marketHoursOnly, fee_source: draft.schedule.feeSource,
        loyalty_enabled: draft.loyalty.enabled, loyalty_max_bps: draft.loyalty.maxBps, loyalty_ramp_days: draft.loyalty.rampDays, loyalty_min_hold_hours: draft.loyalty.minHoldHours, loyalty_sell_reset: draft.loyalty.sellReset,
      };
      const res = await fetch('/api/app/config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Save failed');
      toast('Routing saved. The next cycle follows it.');
      refresh();
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setBusy(null);
    }
  }

  async function act(kind) {
    setAddOpen(false);
    if (demo) { toast(kind === 'tg' ? 'Connect a wallet first, then link Telegram.' : 'Connect a wallet to run this on your own coin.'); onConnect?.(); return; }
    if (setup) { setGuide(true); return; }
    setBusy(kind);
    try {
      if (kind === 'run') {
        const res = await fetch('/api/app/config/run', { method: 'POST' });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        toast('Cycle started. Results land in Cycles and on Telegram in a minute or two.');
      } else if (kind === 'pause' || kind === 'resume') {
        const res = await fetch('/api/app/config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: kind === 'resume' }) });
        if (!res.ok) throw new Error((await res.json()).error);
        toast(kind === 'resume' ? 'Resumed.' : 'Paused. No cycles until you resume.');
        refresh();
      } else if (kind === 'delete') {
        if (!window.confirm('Delete this policy? The bot loses access to the dev wallet. Withdraw its funds first.')) return;
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

  useEffect(() => {
    const onKey = (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && selected && selected !== SOURCE_ID && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) removeLeg(selected); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedLeg = draft.legs.find((l) => l.key === selected);

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-ground">
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-paper px-4">
        <StockLogo address={config.source_token_address} meta={src} size="h-8 w-8" text="text-[9px]" />
        <div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate font-display text-sm font-extrabold text-ink">{src.name || `$${src.symbol}`} <span className="font-mono text-xs font-semibold text-mut">${src.symbol}</span></span><CopyBtn text={config.source_token_address} label={`CA ${shortAddr(config.source_token_address)}`} /><Link href={`/${config.source_token_address}`} target="_blank" className="inline-flex items-center gap-1 rounded-full border border-hood-300 bg-hood-50 px-2.5 py-1 text-[11px] font-semibold text-hood-800 transition hover:border-hood-500" title="The public page of your coin: share it with your community">Community page ↗</Link></div><div className="flex items-center gap-1.5 text-[11px] text-mut"><RunBadge active={config.is_active} /><span>{config.scheduleLabel}{assets ? ` · ${fmtUsd(assets.totalUsd || 0)} in dev wallet` : ''}{data.yield?.apy ? ` · ${data.yield.apy.toFixed(1)}% yield` : ''}</span></div></div>
        {config.is_active && <div className="ml-2 hidden items-center gap-2 rounded-full bg-ink px-3 py-1 text-xs text-white/70 md:flex">next cycle <span className="figure font-mono text-sm font-bold text-hood-500"><Countdown intervalMinutes={config.interval_minutes} scheduleKind={config.schedule_kind} /></span></div>}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Button variant="ghost" className="!py-1.5 text-xs" onClick={() => setAddOpen((o) => !o)}>+ Add destination</Button>
            {addOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-2xl border border-line bg-paper shadow-lg">
                {Object.entries(KIND).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => addLeg(k)} className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-tile">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${v.bg}`}>{v.emoji}</span>
                    <span><span className="block text-sm font-semibold text-ink">{v.label}</span><span className="block text-[11px] text-mut">{v.hint}</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button variant="ghost" className="!py-1.5 text-xs" onClick={() => { setAddOpen(false); setShowCycles((s) => !s); }}>Cycles</Button>
          <Button variant="ghost" className="!py-1.5 text-xs" onClick={() => act('run')} busy={busy === 'run'} disabled={!config.is_active}><Bolt className="h-3.5 w-3.5" /> Run now</Button>
          {config.is_active ? <Button variant="ghost" className="!py-1.5 text-xs" onClick={() => act('pause')} busy={busy === 'pause'}><Pause className="h-3.5 w-3.5" /></Button> : <Button variant="ink" className="!py-1.5 text-xs" onClick={() => act('resume')} busy={busy === 'resume'}>▶ Resume</Button>}
          {dirty && <Button variant="ghost" className="!py-1.5 text-xs" onClick={() => setDraft(initial)} disabled={busy === 'save'}>Discard</Button>}
          <Button className="!py-1.5 text-xs" onClick={save} busy={busy === 'save'} disabled={demo ? false : !canSave}>{demo ? 'Connect to save' : setup ? 'Pick your coin first' : dirty ? 'Save routing' : 'Saved'}</Button>
          <div className="relative">
            <Button variant="ghost" className="!py-1.5 text-xs" onClick={() => { setAddOpen(false); setShareOpen((o) => !o); }}>Share</Button>
            {shareOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-[22rem] max-w-[90vw] rounded-2xl border border-line bg-paper p-3 shadow-lg">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-mut">Your coin's public page</div>
                <SharePanel address={config.source_token_address} symbol={src.symbol} compact />
              </div>
            )}
          </div>
          {!demo && onSwitchWallet && <button type="button" onClick={onSwitchWallet} className="text-xs text-mut hover:text-ink" title={`Signed in as ${data.user.wallet}`}>Switch wallet</button>}
          {!demo && <button type="button" onClick={onLogout} className="text-xs text-mut hover:text-ink">Sign out</button>}
        </div>
      </div>

      {setup && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gold-300 bg-gold-50 px-4 py-2 text-sm text-gold-700">
          <span><span className="font-bold">Blank canvas.</span> Pick the wallet and the coin in the guide, launch, then draw the routing here.</span>
          <Button className="!py-1.5 text-xs" onClick={() => setGuide(true)}>Open the guide</Button>
        </div>
      )}
      {setup && guide && (
        <div className="absolute inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-8 backdrop-blur-sm sm:pt-12">
          <div className="relative w-full max-w-2xl rounded-3xl border border-line bg-ground p-5 shadow-lg reveal-pop">
            <button type="button" onClick={() => (launched ? onCreated(launched) : setGuide(false))} className="absolute right-4 top-4 rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-semibold text-mut hover:text-ink">{launched ? 'Close' : 'Look around first'}</button>
            <Wizard embedded user={data.user} onCreated={onCreated} onLaunched={setLaunched} onSwitchWallet={onSwitchWallet} onLogout={onLogout} />
          </div>
        </div>
      )}
      {tour && <Tour onDone={endTour} />}
      {demo && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-hood-300 bg-hood-100 px-4 py-2 text-sm text-hood-800">
          <span><span className="font-bold">Sample policy.</span> This is what a creator's canvas looks like: drag the nodes, open them, change shares and payout assets. Nothing is saved until you connect a wallet and pick your coin.</span>
          <Button className="!py-1.5 text-xs" onClick={onConnect}>Connect wallet and start</Button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        {/* Canvas */}
        <div className="relative min-w-0 flex-1">
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange} onNodeDragStop={onNodeDragStop}
            onNodeClick={(_, n) => setSelected(n.id)} onPaneClick={() => { setSelected(null); setAddOpen(false); }}
            fitView fitViewOptions={{ padding: 0.25, maxZoom: 1 }} minZoom={0.4} maxZoom={1.4} proOptions={{ hideAttribution: true }} nodesConnectable={false} elementsSelectable deleteKeyCode={null} panOnScroll>
            <Background gap={24} size={1.2} color="#D9DFDA" />
            <Controls showInteractive={false} position="bottom-right" />
          </ReactFlow>
          {total !== 10000 && <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">Shares total {(total / 100).toFixed(1)}%. Adjust a leg or use Balance.</div>}
          {problems.length > 0 && total === 10000 && <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">A wallet or treasury leg needs an address.</div>}
          {showCycles && <Cycles logs={logs} meta={meta} onClose={() => setShowCycles(false)} />}
          <div className="pointer-events-none absolute bottom-4 right-16 z-10 hidden items-center gap-3 text-[11px] text-mut lg:flex">
            {Object.entries(KIND).map(([k, v]) => <span key={k} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: v.color }} />{v.label}</span>)}
          </div>
        </div>

        {/* Inspector */}
        <aside className="w-[360px] shrink-0 overflow-y-auto border-l border-line bg-paper">
          {selected === SOURCE_ID ? <SourceInspector data={data} draft={draft} setDraft={setDraft} act={act} busy={busy} tg={tg} onRevealKey={onRevealKey} />
            : selectedLeg ? <LegInspector key={selectedLeg.key} leg={selectedLeg} draft={draft} setDraft={setDraft} meta={meta} sourceSymbol={src.symbol} onRemove={() => removeLeg(selectedLeg.key)} />
            : <RoutingSummary draft={draft} meta={meta} select={setSelected} />}
        </aside>
      </div>
    </div>
  );
}

export default function Studio(props) {
  return <ReactFlowProvider><StudioInner {...props} /></ReactFlowProvider>;
}
