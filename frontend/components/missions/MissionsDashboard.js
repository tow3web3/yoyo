'use client';

import { useEffect, useState, useCallback } from 'react';
import { claimMessage, rankForXp } from '../../lib/missionConfig';
import { useWallet, ConnectButton } from '../../lib/useWallet';
import { isNative } from '../../lib/stocks';

function rewardLabel(amount, token) {
  if (isNative(token)) return `${(Number(amount) / 1e18).toFixed(4)} ETH`;
  return `${new Intl.NumberFormat('en-US', { notation: 'compact' }).format(Number(amount) / 1e18)} tokens`;
}

function sinceLabel(iso) {
  if (!iso) return '-';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month' : `${months} months`;
}

const ICONS = { hold: '💎', vote: '🗳️', vote_count: '🔥', customer: '🤝', roulette_mode: '🎰', vote_mode: '🗳️' };

function Stat({ label, value, sub }) {
  return (
    <div className="panel p-4">
      <div className="text-xs text-mut">{label}</div>
      <div className="mt-0.5 font-display text-lg font-bold text-ink">{value}</div>
      {sub && <div className="text-[11px] text-mut">{sub}</div>}
    </div>
  );
}

export default function MissionsDashboard() {
  const wallet = useWallet();
  const addr = wallet.address;
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(addr ? `/api/missions?wallet=${addr}` : '/api/missions', { cache: 'no-store' });
      setData(await res.json());
    } catch {
      setData({ missions: [] });
    }
  }, [addr]);

  useEffect(() => { load(); }, [load]);

  async function complete(missionId) {
    setBusy(missionId);
    setMsg(null);
    try {
      const res = await fetch('/api/missions/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ missionId, wallet: addr }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setMsg({ type: 'ok', text: 'Mission complete: XP and reward credited 🪃' });
      await load();
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(null);
    }
  }

  async function claim() {
    if (!addr) return;
    setBusy('claim');
    setMsg(null);
    try {
      const signature = await wallet.signMessage(claimMessage(addr));
      const res = await fetch('/api/missions/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet: addr, signature }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Claim failed');
      setMsg({ type: 'ok', text: 'Claim submitted: rewards are on their way 🪃' });
      await load();
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(null);
    }
  }

  if (!wallet.connected) {
    return (
      <div className="panel mx-auto max-w-md px-6 py-10 text-center">
        <div className="text-3xl">🪃🎯</div>
        <h2 className="mt-3 font-display text-xl font-bold text-ink">Connect to start missions</h2>
        <p className="mt-2 text-sm text-mut">Hold at least {data?.minHold?.toLocaleString() || '100,000'} $BOOMERANG, complete missions, earn XP, and claim rewards.</p>
        <div className="mt-6 flex justify-center"><ConnectButton wallet={wallet} /></div>
      </div>
    );
  }

  if (!data) return <div className="panel px-6 py-12 text-center text-sm text-mut">Loading your missions…</div>;

  const claimableEth = (data.claimable || []).find((c) => isNative(c.token));
  const rank = rankForXp(data.totalXp || 0);

  return (
    <div className="space-y-5">
      {msg && <div className={`rounded-xl px-4 py-3 text-sm ${msg.type === 'ok' ? 'bg-hood-100 text-hood-700' : 'bg-red-100 text-red-700'}`}>{msg.text}</div>}

      <div className="panel-gold overflow-hidden p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-100 text-3xl">{rank.emoji}</div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-gold-700">Level {rank.level} · {rank.name}</div>
              <div className="font-display text-2xl font-extrabold text-ink">{(data.totalXp || 0).toLocaleString()} XP</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-mut">Missions</div>
            <div className="font-display text-xl font-bold text-ink">{data.missionsDone || 0}/{data.totalMissions || 0}</div>
          </div>
        </div>
        <div className="mt-5">
          <div className="mb-1 flex items-center justify-between text-[11px] text-mut">
            <span>{rank.name}</span>
            <span>{rank.next ? `${rank.toNext} XP to ${rank.next.name} ${rank.next.emoji}` : 'Max rank 👑'}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/5">
            <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-hood-500 transition-[width] duration-700" style={{ width: `${rank.pct}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="$BOOMERANG held" value={data.boomerangBalance === null ? '-' : Math.floor(data.boomerangBalance).toLocaleString()} sub={!data.eligible ? `need ${data.minHold.toLocaleString()}` : 'eligible ✓'} />
        <Stat label="Holding for" value={sinceLabel(data.firstSeen)} sub="as a member" />
        <Stat label="Total XP" value={(data.totalXp || 0).toLocaleString()} sub={`Level ${rank.level}`} />
        <Stat label="Claimable" value={claimableEth ? rewardLabel(claimableEth.amount, claimableEth.token) : '0.0000 ETH'} sub={claimableEth ? `${claimableEth.count} reward(s)` : 'complete missions'} />
      </div>

      {claimableEth && (
        <div className="panel flex items-center justify-between gap-3 border-l-4 border-l-hood-500 p-4">
          <div className="text-sm text-ink">You have <span className="font-semibold text-hood-700">{rewardLabel(claimableEth.amount, claimableEth.token)}</span> ready to claim.</div>
          <button onClick={claim} disabled={busy !== null} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">{busy === 'claim' ? '…' : 'Claim now'}</button>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink">Missions</h2>
        <div className="space-y-2">
          {data.missions.map((m) => {
            const done = m.status === 'paid' || m.status === 'claiming';
            const credited = m.status === 'verified';
            return (
              <div key={m.id} className={`panel card-fun flex items-center gap-3 p-4 ${done ? 'opacity-80' : ''}`}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-hood-100 text-xl">{ICONS[m.type] || '🎯'}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{m.title}</span>
                    <span className="rounded-full bg-gold-100 px-1.5 py-0.5 text-[10px] font-bold text-gold-700">+{m.xp} XP</span>
                  </div>
                  <div className="text-xs text-mut">{m.description}</div>
                  <div className="mt-0.5 text-[11px] font-medium text-hood-700">{rewardLabel(m.rewardAmount, m.rewardToken)}</div>
                </div>
                {done ? (
                  <span className="shrink-0 rounded-full bg-hood-100 px-3 py-1.5 text-xs font-semibold text-hood-700">{m.status === 'paid' ? 'Paid ✓' : 'Claiming…'}</span>
                ) : credited ? (
                  <span className="shrink-0 rounded-full bg-gold-100 px-3 py-1.5 text-xs font-semibold text-gold-700">Earned · claim</span>
                ) : (
                  <button onClick={() => complete(m.id)} disabled={!data.eligible || busy !== null} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-hood-300 disabled:opacity-50">
                    {busy === m.id ? '…' : 'Verify'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-center text-[11px] text-mut">Rewards paid from the Boomerang treasury after you claim · on-chain missions only.</p>
    </div>
  );
}
