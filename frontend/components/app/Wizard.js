'use client';

// Three steps to a running Boomerang: the token, the dev wallet, go. Everything
// else (routing, record date, schedule) is drawn on the canvas afterwards.
import { useState } from 'react';
import TokenCard from './TokenCard';
import { Button, Field, inputCls, useToast, shortAddr } from './ui';

const STEPS = ['Token', 'Dev wallet', 'Launch'];

export default function Wizard({ onCreated }) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState({ address: '', meta: null, checking: false, error: null });
  const [wallet, setWallet] = useState({ mode: 'generate', privateKey: '' });

  async function checkToken(address) {
    setToken({ address, meta: null, checking: true, error: null });
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return setToken((t) => ({ ...t, checking: false }));
    try {
      const res = await fetch(`/api/app/token?address=${address}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToken({ address, meta: data, checking: false, error: null });
    } catch (e) {
      setToken({ address, meta: null, checking: false, error: e.message });
    }
  }

  const canNext = [Boolean(token.meta), wallet.mode === 'generate' || /^(0x)?[0-9a-fA-F]{64}$/.test(wallet.privateKey.trim()), true][step];

  async function create() {
    setBusy(true);
    try {
      const res = await fetch('/api/app/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceToken: token.address, wallet, reward: 'ETH', rewardMode: 'fixed',
          scheduleKind: 'closing_bell', intervalMinutes: 1440, marketHoursOnly: false, feeSource: 'wallet',
          split: { holders: 10000, creator: 0, burn: 0, treasury: 0 }, payoutMode: 'in_kind',
          loyalty: { enabled: true, minHoldHours: 24, rampDays: 30, maxBps: 20000, sellReset: true },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create');
      toast(data.generated ? `Boomerang is live. Dev wallet ${shortAddr(data.devWallet)} created for you. Now draw the routing.` : 'Boomerang is live. Now draw the routing.');
      onCreated(data);
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="mb-6">
        <div className="eyebrow mb-2">Set up your Boomerang</div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">Two answers, then draw the routing.</h1>
      </div>

      <ol className="mb-6 grid grid-cols-3 gap-1">
        {STEPS.map((s, i) => (
          <li key={s} className="text-center">
            <div className={`mx-auto mb-1 h-1.5 rounded-full ${i <= step ? 'bg-hood-500' : 'bg-line'}`} />
            <span className={`text-[10px] font-semibold ${i === step ? 'text-ink' : 'text-mut'}`}>{s}</span>
          </li>
        ))}
      </ol>

      <div className="panel p-6">
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-ink">Which token pays dividends?</h2>
            <Field label="Token contract address on Robinhood Chain" hint="Its holders receive the dividends.">
              <input value={token.address} onChange={(e) => checkToken(e.target.value.trim())} placeholder="0x…" className={inputCls} autoFocus />
            </Field>
            {token.checking && <p className="text-xs text-mut">Checking on chain…</p>}
            {token.error && <p className="text-xs text-down">{token.error}</p>}
            {token.meta && <TokenCard token={token.meta} />}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-ink">The dev wallet</h2>
            <p className="text-sm text-mut">Boomerang needs a wallet it can spend from: it receives your fees and routes them. Never your main wallet.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setWallet({ ...wallet, mode: 'generate' })} className={`rounded-xl border p-4 text-left transition ${wallet.mode === 'generate' ? 'border-hood-500 bg-hood-50' : 'border-line hover:border-hood-300'}`}>
                <div className="text-sm font-bold text-ink">✨ Create one for me <span className="ml-1 rounded-full bg-hood-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-ink">Recommended</span></div>
                <div className="mt-1 text-xs text-mut">A fresh wallet, encrypted at rest. You set it as your fee recipient on the launchpad and top it up with a little ETH for gas.</div>
              </button>
              <button type="button" onClick={() => setWallet({ ...wallet, mode: 'import' })} className={`rounded-xl border p-4 text-left transition ${wallet.mode === 'import' ? 'border-hood-500 bg-hood-50' : 'border-line hover:border-hood-300'}`}>
                <div className="text-sm font-bold text-ink">🔑 Import a key</div>
                <div className="mt-1 text-xs text-mut">The wallet that already receives your fees. AES-256 encrypted the moment it arrives.</div>
              </button>
            </div>
            {wallet.mode === 'import' && (
              <Field label="Private key" hint="64 hex characters, with or without 0x. Sent once over HTTPS, stored encrypted.">
                <input type="password" value={wallet.privateKey} onChange={(e) => setWallet({ ...wallet, privateKey: e.target.value })} placeholder="0x…" className={inputCls} autoComplete="off" />
              </Field>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-ink">Launch with a sane default, then draw</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {[
                ['Token', token.meta ? `${token.meta.name} ($${token.meta.symbol})` : token.address],
                ['Dev wallet', wallet.mode === 'generate' ? 'Created for you' : 'Imported'],
                ['Routing', '100% to holders, paid in kind'],
                ['Record date', 'Loyalty 1x to 2x over 30 days, 24h minimum hold'],
                ['Schedule', 'Closing bell, 4:00 pm New York, weekdays'],
                ['Then', 'Add wallets, buybacks, a treasury, pick payout assets: all on the canvas'],
              ].map(([k, v]) => <div key={k} className="rounded-xl border border-line bg-ground p-3"><dt className="text-[10px] uppercase tracking-wider text-mut">{k}</dt><dd className="mt-0.5 font-semibold text-ink">{v}</dd></div>)}
            </dl>
            <p className="text-xs text-mut">Cycles that find nothing to route simply wait for the next one. Nothing moves until fees land in the dev wallet.</p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>Back</Button>
          {step < STEPS.length - 1
            ? <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>Continue</Button>
            : <Button onClick={create} busy={busy}>Launch and open the canvas</Button>}
        </div>
      </div>
    </div>
  );
}
