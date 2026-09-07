'use client';

import { useEffect, useState, useCallback } from 'react';
import { voteMessage } from '../../lib/voteMessage';
import { useWallet, ConnectButton } from '../../lib/useWallet';
import StockLogo from '../StockLogo';
import { describeAddress } from '../../lib/stocks';

const compact = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);

function timeLeft(endsAt) {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const h = Math.floor(ms / 3.6e6);
  const m = Math.floor((ms % 3.6e6) / 6e4);
  const s = Math.floor((ms % 6e4) / 1000);
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function VoteDashboard() {
  const wallet = useWallet();
  const addr = wallet.address;

  const [eligible, setEligible] = useState(null);
  const [cycles, setCycles] = useState({});
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadEligibility = useCallback(async () => {
    if (!addr) return;
    try {
      const res = await fetch(`/api/vote/eligibility?wallet=${addr}`, { cache: 'no-store' });
      const data = await res.json();
      setEligible(data.eligible || []);
    } catch {
      setEligible([]);
    }
  }, [addr]);

  const loadCycle = useCallback(async (token) => {
    try {
      const res = await fetch(`/api/vote/cycle/${token}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setCycles((prev) => ({ ...prev, [token]: data }));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (wallet.connected && addr) loadEligibility();
    else setEligible(null);
  }, [wallet.connected, addr, loadEligibility]);

  useEffect(() => {
    if (!eligible?.length) return;
    eligible.forEach((e) => loadCycle(e.token));
    const t = setInterval(() => eligible.forEach((e) => loadCycle(e.token)), 10000);
    return () => clearInterval(t);
  }, [eligible, loadCycle]);

  async function vote(token, cycleId, optionId) {
    if (!addr) return;
    setBusy(optionId);
    setMsg(null);
    try {
      const message = voteMessage({ cycleId, optionId, wallet: addr });
      const signature = await wallet.signMessage(message);
      const res = await fetch('/api/vote/cast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, optionId, wallet: addr, signature }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Vote failed');
      setMsg({ type: 'ok', text: 'Vote recorded 🪃' });
      await loadCycle(token);
      await loadEligibility();
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(null);
    }
  }

  if (!wallet.connected) {
    return (
      <div className="panel mx-auto max-w-md px-6 py-10 text-center">
        <div className="text-3xl">🪃🗳️</div>
        <h2 className="mt-3 font-display text-xl font-bold text-ink">Connect to vote</h2>
        <p className="mt-2 text-sm text-mut">Connect your Robinhood Chain wallet to see the Boomerang tokens you hold and vote on their next dividend. Voting is gasless: you only sign a message.</p>
        {wallet.error && <p className="mt-2 text-xs text-down">{wallet.error}</p>}
        <div className="mt-6 flex justify-center"><ConnectButton wallet={wallet} /></div>
      </div>
    );
  }

  if (eligible === null) return <div className="panel px-6 py-12 text-center text-sm text-mut">Checking your holdings…</div>;

  if (eligible.length === 0) {
    return (
      <div className="panel px-6 py-12 text-center">
        <p className="text-sm font-medium text-ink">No open votes for your wallet</p>
        <p className="mt-1 text-xs text-mut">You don't hold any token with an active Community Vote (at the last snapshot). Hold a vote-enabled Boomerang token to take part.</p>
        <div className="mt-5 flex justify-center"><ConnectButton wallet={wallet} /></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end"><ConnectButton wallet={wallet} className="!py-1.5 text-xs" /></div>
      {msg && <div className={`rounded-xl px-4 py-3 text-sm ${msg.type === 'ok' ? 'bg-hood-100 text-hood-700' : 'bg-red-100 text-red-700'}`}>{msg.text}</div>}

      {eligible.map((e) => {
        const data = cycles[e.token];
        const ended = new Date(e.endsAt).getTime() <= now;
        return (
          <div key={e.token} className="panel overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-3">
                <StockLogo address={e.token} meta={{ symbol: e.symbol, image: e.image }} size="h-8 w-8" />
                <div>
                  <div className="text-sm font-semibold text-ink">{e.name || `$${e.symbol || e.token.slice(2, 6)}`}</div>
                  <div className="text-xs text-mut">your weight: {compact(Number(e.weight) / 1e18)}</div>
                </div>
              </div>
              <span className="chip text-hood-700"><span className="h-1.5 w-1.5 rounded-full bg-hood-500" />{ended ? 'resolving…' : `${timeLeft(e.endsAt)} left`}</span>
            </div>

            <div className="space-y-2 p-4">
              {!data ? (
                <div className="py-6 text-center text-xs text-mut">Loading options…</div>
              ) : (
                data.options.map((o) => {
                  const isVoted = e.votedOptionId === o.id;
                  const pct = Math.round((o.share || 0) * 100);
                  const d = describeAddress(o.token, { symbol: o.symbol, name: o.name, image: o.image });
                  return (
                    <div key={o.id} className={`relative overflow-hidden rounded-xl border px-3 py-2.5 ${isVoted ? 'border-hood-400 bg-hood-50' : 'border-line'}`}>
                      <div className="absolute inset-y-0 left-0 bg-hood-100/70" style={{ width: `${pct}%` }} />
                      <div className="relative flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <StockLogo address={o.token} meta={{ symbol: o.symbol, image: o.image }} size="h-7 w-7" text="text-[8px]" />
                          <div>
                            <div className="font-mono text-sm font-semibold text-ink">{d.symbol}</div>
                            <div className="text-[11px] text-mut">{d.name} · {pct}% · {o.voters} voters</div>
                          </div>
                        </div>
                        <button
                          onClick={() => vote(e.token, e.cycleId, o.id)}
                          disabled={ended || busy !== null}
                          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${isVoted ? 'bg-hood-500 text-ink' : 'border border-line text-ink hover:border-hood-300'}`}
                        >
                          {busy === o.id ? '…' : isVoted ? 'Voted ✓' : 'Vote'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
              {data && <p className="pt-1 text-center text-[11px] text-mut">Winner becomes the next dividend for every holder.</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
