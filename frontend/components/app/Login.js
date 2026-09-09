'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useWallet } from '../../lib/useWallet';
import { signIn } from '../../lib/authClient';
import { Button } from './ui';

export default function Login({ onLoggedIn }) {
  const wallet = useWallet();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function login() {
    setErr(null);
    setBusy(true);
    try {
      const addr = wallet.address || (await wallet.connect());
      if (!addr) throw new Error(wallet.error || 'Connect a wallet first');
      await signIn(wallet, addr);
      onLoggedIn();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-16 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <div className="chip mb-5"><span className="h-1.5 w-1.5 rounded-full bg-hood-500" />Creator dashboard</div>
        <h1 className="font-display text-4xl font-extrabold leading-[1.02] tracking-tight text-ink sm:text-5xl">Your dividend policy,<br />on one screen.</h1>
        <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-mut">
          Everything the Telegram bot does, with sliders. Set the payout ratio, the record date, the treasury, the schedule. Watch what the next cycle pays. Run it now. Same engine, same account.
        </p>
        <ul className="mt-6 space-y-2 text-sm text-mut">
          {['Sign in with any wallet, no gas, no email', '0xdiv creates a dedicated dev wallet for you, or import yours', 'Link Telegram later for receipts and alerts'].map((t) => (
            <li key={t} className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-hood-100 text-[10px] font-bold text-hood-700">✓</span>{t}</li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button onClick={login} busy={busy} className="text-base">{wallet.available ? (wallet.connected ? 'Sign in' : 'Connect wallet and sign in') : 'Install a wallet'}</Button>
          {wallet.connected && (
            <span className="flex items-center gap-2 text-xs text-mut">
              <span className="font-mono">{wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}</span>
              <button type="button" onClick={async () => { setErr(null); const a = await wallet.switchAccount(); if (!a) setErr(wallet.error || 'No account selected'); }} className="font-semibold text-hood-700 hover:underline">Not you? Switch wallet</button>
              <button type="button" onClick={wallet.disconnect} className="hover:text-ink">Disconnect</button>
            </span>
          )}
        </div>
        {err && <p className="mt-3 text-sm text-down">{err}</p>}
      </div>
      <div className="relative mx-auto w-full max-w-sm">
        <div className="absolute inset-8 rounded-full bg-hood-300/30 blur-3xl" />
        <div className="panel-glow relative overflow-hidden p-5">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-mut"><Image src="/brand/boom-256.png" alt="" width={18} height={18} /> Preview</div>
          <div className="mb-3 flex h-3 w-full overflow-hidden rounded-full bg-tile"><div className="w-[70%] bg-hood-500" /><div className="w-[20%] bg-ink" /><div className="w-[10%] bg-gold-400" /></div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['70%', 'holders'], ['20%', 'you'], ['10%', 'treasury']].map(([v, l]) => <div key={l}><div className="figure font-display text-lg font-extrabold text-ink">{v}</div><div className="text-[10px] uppercase tracking-wider text-mut">{l}</div></div>)}
          </div>
          <div className="mt-4 rounded-xl border border-line bg-ground p-3 text-xs text-mut">
            Next cycle pays <span className="font-mono font-bold text-ink">0.0421 NVDA</span> and <span className="font-mono font-bold text-ink">0.0106 GLD</span> to <span className="font-bold text-ink">412 holders</span>, at the closing bell.
          </div>
        </div>
      </div>
    </div>
  );
}
