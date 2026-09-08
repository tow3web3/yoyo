'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import TickerTape from '../../components/TickerTape';
import Footer from '../../components/Footer';
import Login from '../../components/app/Login';
import Wizard from '../../components/app/Wizard';
import Dashboard from '../../components/app/Dashboard';
import { ToastProvider } from '../../components/app/ui';

function AppShell({ children, wallet }) {
  return (
    <>
      <TickerTape />
      <nav className="sticky top-0 z-40 border-b border-line bg-ground/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative h-8 w-8"><Image src="/newlogopng.png" alt="Boomerang" fill className="object-contain" /></div>
            <span className="font-display text-lg font-bold tracking-tight text-ink">Boomerang</span>
            <span className="rounded-full border border-ink bg-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Dashboard</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/stocks" className="hidden text-mut hover:text-ink sm:inline">Stocks</Link>
            <Link href="/#screener" className="hidden text-mut hover:text-ink sm:inline">Screener</Link>
            {wallet && <span className="chip font-mono">{wallet.slice(0, 6)}…{wallet.slice(-4)}</span>}
          </div>
        </div>
      </nav>
      <main className="min-h-[70vh]">{children}</main>
      <Footer />
    </>
  );
}

export default function AppPage() {
  const [state, setState] = useState({ loading: true, data: null });

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
    await fetch('/api/app/auth/logout', { method: 'POST' });
    setState({ loading: false, data: null });
  }

  const wallet = state.data?.user?.wallet;
  return (
    <ToastProvider>
      <AppShell wallet={wallet}>
        {state.loading ? (
          <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-hood-500" /></div>
        ) : !state.data?.user ? (
          <Login onLoggedIn={load} />
        ) : !state.data.config ? (
          <Wizard onCreated={load} />
        ) : (
          <Dashboard data={state.data} refresh={load} onLogout={logout} />
        )}
      </AppShell>
    </ToastProvider>
  );
}
