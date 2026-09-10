'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import TickerTape from '../../components/TickerTape';
import Footer from '../../components/Footer';
import { DEMO_DATA, blankData } from '../../lib/demoData';
import Studio from '../../components/app/Studio';
import { ToastProvider, useToast } from '../../components/app/ui';
import { useWallet } from '../../lib/useWallet';
import { signIn, signOut, revealDevKey } from '../../lib/authClient';

/** Header chip: the signed-in wallet, with Switch wallet and Disconnect. */
function WalletMenu({ wallet, onSwitch, onLogout }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!wallet) return null;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="chip font-mono hover:border-hood-400" title={wallet}>
        <span className="h-1.5 w-1.5 rounded-full bg-hood-500" />{wallet.slice(0, 6)}…{wallet.slice(-4)} <span className="text-mut">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-2xl border border-line bg-paper shadow-lg">
          <div className="border-b border-line px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-mut">Signed in as</div>
          <div className="break-all px-3 py-2 font-mono text-[11px] text-ink">{wallet}</div>
          <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await onSwitch(); setOpen(false); } finally { setBusy(false); } }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-ink hover:bg-tile disabled:opacity-60">🔁 Switch wallet</button>
          <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await onLogout(); setOpen(false); } finally { setBusy(false); } }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-down hover:bg-tile disabled:opacity-60">⏏ Disconnect</button>
        </div>
      )}
    </div>
  );
}

function AppShell({ children, wallet, studio, onSwitch, onLogout, onConnect, connecting }) {
  return (
    <div className={studio ? 'flex h-screen flex-col overflow-hidden' : ''}>
      {!studio && <TickerTape />}
      <nav className="sticky top-0 z-40 border-b border-line bg-ground/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative h-8 w-8"><Image src="/brand/yoyo-256.png" alt="yo-yo" fill className="object-contain" /></div>
            <span className="whitespace-nowrap font-display text-lg font-bold tracking-tight text-ink">yo-yo<span className="text-hood-700">.dev</span></span>
            <span className="rounded-full border border-ink bg-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Dashboard</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/stocks" className="hidden text-mut hover:text-ink sm:inline">Stocks</Link>
            <Link href="/#check" className="hidden text-mut hover:text-ink sm:inline">Token check</Link>
            {wallet ? <WalletMenu wallet={wallet} onSwitch={onSwitch} onLogout={onLogout} /> : <button type="button" onClick={onConnect} disabled={connecting} className="btn-primary !py-1.5 text-xs">{connecting ? 'Check your wallet…' : 'Connect wallet'}</button>}
          </div>
        </div>
      </nav>
      <main className={studio ? 'min-h-0 flex-1' : 'min-h-[70vh]'}>{children}</main>
      {!studio && <Footer />}
    </div>
  );
}

export default function AppPage() {
  return <ToastProvider><AppInner /></ToastProvider>;
}

function AppInner() {
  const [state, setState] = useState({ loading: true, data: null });
  const injected = useWallet();
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/app/me', { cache: 'no-store' });
      const data = await res.json();
      setState({ loading: false, data: res.ok ? data : null });
    } catch {
      setState({ loading: false, data: null });
    }
  }, []);

  useEffect(() => {
    load();
    const onRefresh = () => load();
    window.addEventListener('bm:refresh', onRefresh);
    const t = setInterval(load, 30000);
    return () => { window.removeEventListener('bm:refresh', onRefresh); clearInterval(t); };
  }, [load]);

  async function logout() {
    await signOut();
    injected.disconnect();
    setState({ loading: false, data: null });
  }

  const [connecting, setConnecting] = useState(false);
  // Connect: pick an account in the extension, sign the login message, load the real dashboard.
  async function connect() {
    setConnecting(true);
    try {
      const addr = injected.address || (await injected.connect());
      if (!addr) throw new Error(injected.error || 'No wallet found. Install MetaMask or Rabby, or open this page in your wallet browser.');
      await signIn(injected, addr);
      toast(`Signed in as ${addr.slice(0, 6)}…${addr.slice(-4)}`);
      await load();
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setConnecting(false);
    }
  }

  // Switch wallet: sign out, let the extension pick another account, sign in with it.
  async function switchWallet() {
    try {
      const addr = await injected.switchAccount();
      if (!addr) throw new Error(injected.error || 'No account selected');
      if (state.data?.user?.wallet && addr.toLowerCase() === state.data.user.wallet.toLowerCase()) { toast('Same wallet selected.'); return; }
      await signOut();
      await signIn(injected, addr);
      toast(`Signed in as ${addr.slice(0, 6)}…${addr.slice(-4)}`);
      await load();
    } catch (e) {
      toast(e.message, 'err');
    }
  }

  const wallet = state.data?.user?.wallet;
  return (
    <>
      <AppShell wallet={wallet} studio={!state.loading} onSwitch={switchWallet} onLogout={logout} onConnect={connect} connecting={connecting}>
        {state.loading ? (
          <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-hood-500" /></div>
        ) : !state.data?.user ? (
          <Studio data={DEMO_DATA} demo onConnect={connect} refresh={() => {}} onLogout={() => {}} />
        ) : !state.data.config ? (
          <Studio data={blankData(state.data.user)} setup onCreated={load} refresh={load} onLogout={logout} onSwitchWallet={switchWallet} />
        ) : (
          <Studio data={state.data} refresh={load} onLogout={logout} onSwitchWallet={switchWallet} onRevealKey={() => revealDevKey(injected, injected.address || wallet, state.data.config.dev_wallet_public)} />
        )}
      </AppShell>
    </>
  );
}
