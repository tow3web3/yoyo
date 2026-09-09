'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';
import TickerTape from '../../components/TickerTape';
import Footer from '../../components/Footer';
import { Arrow } from '../../components/Icons';
import { useWallet } from '../../lib/useWallet';
import { EVM_ADDR } from '../../lib/stocks';

export default function WalletLookup() {
  const router = useRouter();
  const wallet = useWallet();
  const [q, setQ] = useState('');
  const [err, setErr] = useState(null);

  const go = (a) => {
    if (!EVM_ADDR.test(a)) return setErr('Paste a 0x wallet address (42 characters).');
    router.push(`/wallet/${a}`);
  };

  return (
    <>
      <TickerTape />
      <Navigation />
      <main className="mx-auto max-w-2xl px-5 py-16 text-center">
        <div className="eyebrow mb-2">Dividend statement</div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">What did holding earn you?</h1>
        <p className="mt-3 text-sm text-mut">Every stock dividend a wallet received from any yo-yo token, plus its loyalty standing. Shareable.</p>
        <form onSubmit={(e) => { e.preventDefault(); go(q.trim()); }} className="mx-auto mt-8 flex max-w-xl flex-col gap-2 sm:flex-row">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="0x… wallet address" spellCheck={false} className="flex-1 rounded-full border border-line bg-paper px-5 py-3 font-mono text-sm outline-none focus:border-hood-400 focus:ring-2 focus:ring-hood-200" />
          <button type="submit" className="btn-primary justify-center">Show <Arrow className="h-4 w-4" /></button>
        </form>
        {err && <p className="mt-2 text-xs text-down">{err}</p>}
        <div className="mt-6 text-sm text-mut">
          or{' '}
          <button onClick={async () => { const a = wallet.address || (await wallet.connect()); if (a) go(a); }} className="font-semibold text-hood-700 hover:underline">
            connect your wallet
          </button>
        </div>
      </main>
      <Footer />
    </>
  );
}
