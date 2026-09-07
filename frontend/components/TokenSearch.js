'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Arrow, Check } from './Icons';
import StockLogo from './StockLogo';
import { describeAddress, EVM_ADDR } from '../lib/stocks';

function short(a) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';
}

function CoinChip({ address, meta }) {
  const d = describeAddress(address, meta);
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-sm font-semibold text-ink shadow-soft">
      <StockLogo address={address} meta={meta} size="h-5 w-5" text="text-[7px]" />
      {d.isStock ? d.symbol : `$${d.symbol}`}
      {!d.isNative && <span className="font-mono text-xs font-normal text-mut">{short(address)}</span>}
    </span>
  );
}

const MODE_LABEL = { fixed: null, roulette: '🎰 Stock Roulette', gainer: '🚀 Top Gainer', portfolio: '📊 Portfolio', vote: '🗳️ Community Vote' };

export default function TokenSearch() {
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState('idle');
  const [result, setResult] = useState(null);
  const [run, setRun] = useState(0);
  const runRef = useRef(0);

  async function onSubmit(e) {
    e.preventDefault();
    const ca = query.trim();
    setRun((r) => r + 1);
    if (!EVM_ADDR.test(ca)) { setResult({ kind: 'invalid' }); setPhase('done'); return; }

    const myRun = ++runRef.current;
    setPhase('searching');
    setResult(null);
    const started = Date.now();
    let res;
    try {
      const r = await fetch(`/api/dashboard/${ca}`, { cache: 'no-store' });
      if (r.ok) res = { kind: 'found', data: await r.json(), ca };
      else if (r.status === 404) res = { kind: 'notfound', ca };
      else res = { kind: 'error' };
    } catch {
      res = { kind: 'error' };
    }
    const wait = Math.max(0, 1000 - (Date.now() - started));
    setTimeout(() => {
      if (runRef.current !== myRun) return;
      setResult(res);
      setPhase('done');
      setRun((r) => r + 1);
    }, wait);
  }

  return (
    <div id="check" className="scroll-mt-20">
      <div className="mb-6 text-center">
        <div className="eyebrow mb-2">Token check</div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Does a token pay dividends?</h2>
        <p className="mt-2 text-sm text-mut">Paste a Robinhood Chain contract address to find out.</p>
      </div>

      <form onSubmit={onSubmit} className="mx-auto flex max-w-2xl flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="0x…  token address on Robinhood Chain"
          spellCheck={false}
          className="flex-1 rounded-full border border-line bg-paper px-5 py-3 font-mono text-sm text-ink shadow-soft outline-none transition focus:border-hood-400 focus:ring-2 focus:ring-hood-200"
        />
        <button type="submit" className="btn-primary justify-center" disabled={phase === 'searching'}>
          {phase === 'searching' ? 'Checking…' : 'Check'}
          <Arrow className="h-4 w-4" />
        </button>
      </form>

      <div className="relative mx-auto mt-5 min-h-[120px] max-w-2xl overflow-hidden">
        {phase === 'searching' && (
          <>
            <div key={run} className="boomerang-sweep pointer-events-none absolute top-1/2 z-10 h-14 w-14">
              <Image src="/newlogopng.png" alt="" fill className="object-contain drop-shadow-md" />
            </div>
            <div className="flex min-h-[120px] items-center justify-center text-sm font-medium text-mut">Throwing the boomerang…</div>
          </>
        )}

        {phase === 'done' && result && (
          <div key={run} className="reveal-pop">
            {result.kind === 'found' && (
              <div className="rounded-2xl border border-hood-300 bg-hood-50 p-5 shadow-soft">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-hood-500 text-ink"><Check className="h-4 w-4" /></span>
                  <span className="font-display text-lg font-bold text-ink">Paying dividends with Boomerang</span>
                  <span className={`ml-auto chip ${result.data.config.isActive ? 'text-hood-700' : 'text-mut'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${result.data.config.isActive ? 'bg-hood-500' : 'bg-mut'}`} />
                    {result.data.config.isActive ? 'Active' : 'Paused'}
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-xs uppercase tracking-wider text-mut">Token</p>
                    <CoinChip address={result.data.sourceToken.address} meta={result.data.sourceToken} />
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs uppercase tracking-wider text-mut">Dividends paid in</p>
                    {MODE_LABEL[result.data.config.rewardMode] ? (
                      <span className="inline-flex items-center rounded-full border border-line bg-paper px-3 py-1.5 text-sm font-semibold text-ink shadow-soft">{MODE_LABEL[result.data.config.rewardMode]}</span>
                    ) : (
                      <CoinChip address={result.data.targetToken.address} meta={result.data.targetToken} />
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hood-200 pt-4">
                  <span className="text-sm text-mut">{result.data.config.scheduleLabel}</span>
                  <Link href={`/${result.ca}`} className="btn-primary !py-2">Open dashboard <Arrow className="h-4 w-4" /></Link>
                </div>
              </div>
            )}
            {result.kind === 'notfound' && (
              <div className="rounded-2xl border border-line bg-paper p-5 text-center shadow-soft">
                <p className="font-display text-lg font-bold text-ink">Not linked yet</p>
                <p className="mt-1 text-sm text-mut">This token isn't running Boomerang. Set it up in the Telegram bot to start paying dividends.</p>
              </div>
            )}
            {result.kind === 'invalid' && (
              <div className="rounded-2xl border border-gold-300 bg-paper p-5 text-center shadow-soft">
                <p className="text-sm font-medium text-ink">That doesn't look like a Robinhood Chain address.</p>
                <p className="mt-1 text-sm text-mut">Paste a 0x address (42 characters).</p>
              </div>
            )}
            {result.kind === 'error' && (
              <div className="rounded-2xl border border-line bg-paper p-5 text-center shadow-soft"><p className="text-sm text-mut">Couldn't check right now. Please try again.</p></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
