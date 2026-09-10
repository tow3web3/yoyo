'use client';

// The holders lottery: hold 1M+ $YOYO for 2h, enter with your wallet, one draw a day
// for 0.5% of the creator fees. Selling after entering disqualifies.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Navigation from '../../components/Navigation';
import TickerTape from '../../components/TickerTape';
import Footer from '../../components/Footer';
import { ToastProvider, useToast, Button } from '../../components/app/ui';
import { useWallet } from '../../lib/useWallet';
import { signIn } from '../../lib/authClient';
import { explorerAddress, explorerTx } from '../../lib/stocks';
import { Arrow, Check } from '../../components/Icons';

const CA = process.env.NEXT_PUBLIC_BOOMERANG_CA || '';
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
const eth = (wei, d = 4) => (Number(wei || 0) / 1e18).toFixed(d);

function useCountdown(iso) {
  const [left, setLeft] = useState(null);
  useEffect(() => {
    if (!iso) return undefined;
    const t = () => setLeft(Math.max(0, new Date(iso).getTime() - Date.now()));
    t();
    const id = setInterval(t, 1000);
    return () => clearInterval(id);
  }, [iso]);
  if (left == null) return '--:--:--';
  const s = Math.ceil(left / 1000);
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function LotteryPage() {
  return <ToastProvider><Lottery /></ToastProvider>;
}

function Lottery() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const wallet = useWallet();
  const toast = useToast();
  const load = useCallback(async () => {
    try { setData(await fetch('/api/lottery', { cache: 'no-store' }).then((r) => r.json())); } catch { /* keep the last state */ }
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 30_000); return () => clearInterval(id); }, [load]);
  const draw = useCountdown(data?.round?.drawsAt);

  async function connect() {
    setBusy('connect');
    try {
      const addr = wallet.address || (await wallet.connect());
      if (!addr) throw new Error(wallet.error || 'No wallet found. Install MetaMask or Rabby, or open this page in your wallet browser.');
      await signIn(wallet, addr);
      toast(`Signed in as ${short(addr)}`);
      await load();
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(null); }
  }
  async function enter() {
    setBusy('enter');
    try {
      const res = await fetch('/api/lottery/enter', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Could not enter');
      toast(d.already ? 'You are already in this round.' : 'You are in. Keep holding until the draw.');
      await load();
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(null); }
  }

  const round = data?.round;
  const me = data?.me;
  const elig = me?.eligibility;
  const entered = Boolean(me?.entry && !me.entry.disqualified_at);

  return (
    <main className="min-h-screen">
      <TickerTape />
      <Navigation />
      <div className="mx-auto max-w-5xl px-5 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <div className="eyebrow mb-2">🎟️ Holders lottery</div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Win 0.5% of the creator fees of $YOYO</h1>
            <p className="mt-3 text-base text-mut">One draw every 24 hours. One ticket per wallet. The prize is paid in ETH from the dev wallet, straight to the winner.</p>
            <ol className="mt-6 space-y-3">
              {[
                ['Hold at least 1,000,000 $YOYO', 'for more than 2 hours. Sending or selling resets your clock.'],
                ['Connect your wallet and enter', 'we check your balance and your holding time on chain, then you are in for this round.'],
                ['Keep holding until the draw', 'sell or send tokens out and your ticket is void. The winner is announced in the community group and here.'],
              ].map(([t, b], i) => (
                <li key={t} className="flex gap-3 rounded-2xl border border-line bg-paper p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink font-display text-sm font-extrabold text-hood-500">{i + 1}</span>
                  <div><div className="font-semibold text-ink">{t}</div><div className="text-sm text-mut">{b}</div></div>
                </li>
              ))}
            </ol>
            {CA && <p className="mt-4 text-xs text-mut">$YOYO contract: <Link href={`/${CA}`} className="font-mono text-hood-700 hover:underline">{CA}</Link></p>}
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border-2 border-hood-500 bg-ink p-6 text-white shadow-lg">
              {round ? (
                <>
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-white/50"><span>Round #{round.id}</span><span>{round.entries} {round.entries === 1 ? 'ticket' : 'tickets'}</span></div>
                  <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">Prize so far</div>
                  <div className="figure font-display text-4xl font-extrabold text-hood-500">{eth(round.prizeWei)} ETH</div>
                  <div className="text-xs text-white/60">0.5% of {eth(round.feesWei)} ETH of creator fees this round{Number(round.carryWei) > 0 ? `, plus ${eth(round.carryWei)} ETH rolled over` : ''}. Grows until the draw.</div>
                  <div className="mt-4 flex items-end justify-between rounded-2xl border border-hood-500/40 bg-white/5 px-4 py-3">
                    <div><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">Draw in</div><div className="figure font-display text-3xl font-extrabold leading-none text-hood-500">{draw}</div></div>
                    <div className="text-right text-[11px] text-white/50">{new Date(round.drawsAt).toLocaleString()}</div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-white/70">{data ? 'No round is open right now. The next one opens with the next cycle.' : 'Loading the round…'}</div>
              )}
            </div>

            <div className="panel p-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-mut">Your ticket</div>
              {!me ? (
                <>
                  <p className="mt-1 text-sm text-mut">Connect the wallet that holds your $YOYO. A gasless signature proves it is yours.</p>
                  <Button className="mt-3" onClick={connect} busy={busy === 'connect'}>Connect wallet</Button>
                </>
              ) : (
                <>
                  <div className="mt-1 flex items-center justify-between gap-2 text-sm"><span className="font-mono text-ink">{short(me.wallet)}</span><a href={explorerAddress(me.wallet)} target="_blank" rel="noopener noreferrer" className="text-xs text-mut hover:text-ink">Blockscout ↗</a></div>
                  {elig && (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-xl border border-line bg-ground p-3"><div className="text-[10px] uppercase tracking-wider text-mut">Balance</div><div className={`figure font-display text-lg font-extrabold ${elig.balance >= (round?.minHold || 0) ? 'text-hood-700' : 'text-ink'}`}>{Math.floor(elig.balance || 0).toLocaleString()}</div></div>
                      <div className="rounded-xl border border-line bg-ground p-3"><div className="text-[10px] uppercase tracking-wider text-mut">Held for</div><div className={`figure font-display text-lg font-extrabold ${elig.heldHours != null && elig.heldHours >= (round?.minHours || 0) ? 'text-hood-700' : 'text-ink'}`}>{elig.heldHours == null ? 'not indexed' : elig.heldHours < 1 ? `${Math.floor(elig.heldHours * 60)} min` : `${elig.heldHours.toFixed(1)}h`}</div></div>
                    </div>
                  )}
                  {entered ? (
                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-hood-300 bg-hood-50 px-3 py-2 text-sm font-semibold text-hood-800"><Check className="h-4 w-4" /> You are in round #{round?.id}. Keep holding until the draw.</div>
                  ) : me.entry?.disqualified_at ? (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">Your ticket for this round is void: {me.entry.reason || 'tokens left the wallet'}.</div>
                  ) : elig?.ok ? (
                    <Button className="mt-3 w-full" onClick={enter} busy={busy === 'enter'}>Enter this round <Arrow className="h-4 w-4" /></Button>
                  ) : (
                    <div className="mt-3 space-y-1 rounded-xl border border-gold-300 bg-gold-50 px-3 py-2 text-sm text-gold-700">{(elig?.reasons || ['Checking…']).map((r) => <div key={r}>{r}</div>)}</div>
                  )}
                  {!entered && !elig?.ok && <button type="button" onClick={load} className="mt-2 text-xs text-mut hover:text-ink">Re-check</button>}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="font-display text-xl font-bold text-ink">Past draws</h2>
          {data?.past?.length ? (
            <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-paper">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[10px] uppercase tracking-wider text-mut"><th className="px-4 py-2">Round</th><th className="px-4 py-2">Drawn</th><th className="px-4 py-2">Winner</th><th className="px-4 py-2">Prize</th><th className="px-4 py-2">Tickets</th><th className="px-4 py-2">Payout</th></tr></thead>
                <tbody>
                  {data.past.map((r) => (
                    <tr key={r.id} className="border-t border-line">
                      <td className="px-4 py-2 font-mono text-xs">#{r.id}</td>
                      <td className="px-4 py-2 text-xs text-mut">{new Date(r.drawn_at || r.draws_at).toLocaleString()}</td>
                      <td className="px-4 py-2">{r.winner ? <a href={explorerAddress(r.winner)} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-hood-700 hover:underline">{short(r.winner)}</a> : <span className="text-xs text-mut">no eligible entry, rolled over</span>}</td>
                      <td className="figure px-4 py-2 font-semibold">{eth(r.prize_wei)} ETH</td>
                      <td className="px-4 py-2 text-xs text-mut">{r.eligible_count ?? 0} / {r.entries_count ?? 0}</td>
                      <td className="px-4 py-2 text-xs">{r.tx_hash ? <a href={explorerTx(r.tx_hash)} target="_blank" rel="noopener noreferrer" className="text-hood-700 hover:underline">paid ↗</a> : r.status === 'won' ? <span className="text-gold-700">paying at the next cycle</span> : <span className="text-mut">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="mt-2 text-sm text-mut">No draw yet. The first one is coming.</p>}
        </div>
      </div>
      <Footer />
    </main>
  );
}
