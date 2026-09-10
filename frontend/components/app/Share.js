'use client';

// The public page of a coin, ready to share: copy the link, post it on X or
// Telegram. Shown right after launch and behind the Share button on the canvas.
import { useEffect, useState } from 'react';
import { Copy, Check } from '../Icons';

const origin = () => (typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || 'https://yo-yo.dev')).replace(/\/$/, '');

export function publicPageUrl(address) {
  return `${origin()}/${address}`;
}

export default function SharePanel({ address, symbol, compact = false }) {
  const [url, setUrl] = useState(`https://yo-yo.dev/${address}`);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setUrl(publicPageUrl(address)); }, [address]);

  const sym = symbol ? `$${symbol}` : 'This coin';
  const text = `${sym} pays real dividends to its holders on Robinhood Chain. Every cycle, every wallet, the yield: all public here 🪀`;
  const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${text}\n${url}`)}`;
  const tg = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ }
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink">{url}</span>
        <button type="button" onClick={copy} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-ground px-2.5 py-1 text-[11px] font-semibold text-ink hover:border-hood-400">
          {copied ? <Check className="h-3.5 w-3.5 text-hood-600" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={x} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink/90">𝕏 Post it</a>
        <a href={tg} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink hover:border-hood-400">✈️ Send on Telegram</a>
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink hover:border-hood-400">Open the page ↗</a>
      </div>
      {!compact && <p className="text-xs text-mut">Holders see every cycle, their own share and the yield there. Pin it in your group, put it in your bio: it is the proof your coin pays.</p>}
    </div>
  );
}
