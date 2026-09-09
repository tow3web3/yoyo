import Image from 'next/image';
import { X, Github } from './Icons';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-ground px-5 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 md:flex-row">
        <div className="flex items-center gap-2.5">
          <div className="relative h-7 w-7"><Image src="/brand/boom-256.png" alt="0xdiv" fill className="object-contain" /></div>
          <span className="text-sm text-mut">© {year} <span className="font-mono font-bold text-ink">0x</span><span className="font-display font-bold text-ink">div</span> · The dividend policy for memecoins</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-5 text-sm text-mut">
          <a href="https://x.com/Boomerang_tek" target="_blank" rel="noopener noreferrer" aria-label="0xdiv on X" className="flex items-center transition hover:text-ink"><X className="h-4 w-4" /></a>
          <a href="https://github.com/tow3web3/boomerang" target="_blank" rel="noopener noreferrer" aria-label="0xdiv on GitHub" className="flex items-center transition hover:text-ink"><Github className="h-4 w-4" /></a>
          <a href="https://robinhoodchain.blockscout.com" target="_blank" rel="noopener noreferrer" className="transition hover:text-ink">Blockscout</a>
          <a href="https://app.uniswap.org" target="_blank" rel="noopener noreferrer" className="transition hover:text-ink">Uniswap</a>
          <a href="https://dexscreener.com/robinhood" target="_blank" rel="noopener noreferrer" className="transition hover:text-ink">DexScreener</a>
          <span className="text-xs text-mut/70">Not affiliated with Robinhood Markets. Stock Tokens are issued by Robinhood; 0xdiv only routes them.</span>
        </div>
      </div>
    </footer>
  );
}
