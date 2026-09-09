'use client';

import { useState } from 'react';
import { Check, Copy } from './Icons';

// $YOYO on Robinhood Chain. Set NEXT_PUBLIC_BOOMERANG_CA once the token is live.
export const BOOMERANG_CA = process.env.NEXT_PUBLIC_BOOMERANG_CA || '';

const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function CopyCA({ className = '' }) {
  const [copied, setCopied] = useState(false);

  if (!BOOMERANG_CA) {
    return (
      <span className={`chip-gold ${className}`} title="$YOYO contract address">
        CA <span className="font-mono font-medium text-gold-600">soon</span>
      </span>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(BOOMERANG_CA);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <button
      onClick={copy}
      title="Copy $YOYO contract address"
      className={`group inline-flex items-center gap-2 rounded-full border border-line bg-paper px-2.5 py-1.5 text-xs font-medium shadow-soft transition hover:border-hood-400 ${className}`}
    >
      <span className="rounded-full bg-gold-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-700">CA</span>
      <span className="font-mono text-ink">{copied ? 'Copied!' : short(BOOMERANG_CA)}</span>
      {copied ? <Check className="h-3.5 w-3.5 text-hood-600" /> : <Copy className="h-3.5 w-3.5 text-mut transition group-hover:text-hood-600" />}
    </button>
  );
}
