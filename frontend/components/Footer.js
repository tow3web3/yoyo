import Image from 'next/image';
import { X, Github } from './Icons';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-ground px-5 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 md:flex-row">
        <div className="flex items-center gap-2.5">
          <div className="relative h-7 w-7"><Image src="/brand/yoyo-256.png" alt="yo-yo" fill className="object-contain" /></div>
          <span className="text-sm text-mut">© {year} <span className="whitespace-nowrap font-display font-bold text-ink">yo-yo<span className="text-hood-700">.dev</span></span> · The dividend policy for memecoins</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-5 text-sm text-mut">
          <a href="https://x.com/yo_yo_tech" target="_blank" rel="noopener noreferrer" aria-label="yo-yo on X" className="flex items-center transition hover:text-ink"><X className="h-4 w-4" /></a>
          <a href="https://t.me/yoyocommu" target="_blank" rel="noopener noreferrer" aria-label="yo-yo community on Telegram" className="flex items-center transition hover:text-ink"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4"><path d="M21.9 4.6 18.6 20c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.2-8.3c.4-.4-.1-.6-.6-.2L6.1 13.7 1.3 12.2c-1-.3-1-1 .2-1.5L20.6 3.1c.9-.3 1.6.2 1.3 1.5z"/></svg></a>
          <a href="https://github.com/tow3web3/yoyo" target="_blank" rel="noopener noreferrer" aria-label="yo-yo on GitHub" className="flex items-center transition hover:text-ink"><Github className="h-4 w-4" /></a>
          <a href="https://robinhoodchain.blockscout.com" target="_blank" rel="noopener noreferrer" className="transition hover:text-ink">Blockscout</a>
          <a href="https://app.uniswap.org" target="_blank" rel="noopener noreferrer" className="transition hover:text-ink">Uniswap</a>
          <a href="https://dexscreener.com/robinhood" target="_blank" rel="noopener noreferrer" className="transition hover:text-ink">DexScreener</a>
          <span className="text-xs text-mut/70">Not affiliated with Robinhood Markets. Stock Tokens are issued by Robinhood; yo-yo only routes them.</span>
        </div>
      </div>
    </footer>
  );
}
