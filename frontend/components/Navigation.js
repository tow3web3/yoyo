'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Arrow, X, Github } from './Icons';
import CopyCA from './CopyCA';

export default function Navigation() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'yoyotek_bot';

  return (
    <nav className="sticky top-0 z-40 border-b border-line bg-ground/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex h-14 items-center justify-between gap-4">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="relative h-8 w-8 group-hover:animate-wiggle">
              <Image src="/brand/yoyo-256.png" alt="yo-yo" fill className="object-contain" priority />
            </div>
            <span className="whitespace-nowrap font-display text-lg font-bold tracking-tight text-ink">yo-yo<span className="text-hood-700">.dev</span></span>
            <span className="hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-hood-300 bg-hood-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-hood-700 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-hood-500" />
              Robinhood Chain
            </span>
          </Link>

          <div className="hidden items-center gap-0.5 lg:flex">
            <a href="/#how" className="whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium text-mut transition hover:text-ink">How it works</a>
            <a href="/#modes" className="whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium text-mut transition hover:text-ink">Modes</a>
            <a href="/#check" className="whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium text-mut transition hover:text-ink">Token check</a>
            {process.env.NEXT_PUBLIC_BOOMERANG_CA && <Link href={`/${process.env.NEXT_PUBLIC_BOOMERANG_CA}`} className="whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-semibold text-hood-700 transition hover:text-hood-600">$YOYO live</Link>}
            <Link href="/wallet" className="whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium text-mut transition hover:text-ink">My dividends</Link>
            <Link href="/vote" className="whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium text-hood-700 transition hover:text-hood-600">Vote</Link>
            <Link href="/missions" className="whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium text-gold-700 transition hover:text-gold-600">Missions</Link>
            {process.env.NEXT_PUBLIC_BOOMERANG_CA && <Link href="/lottery" className="whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium text-gold-700 transition hover:text-gold-600">🎟️ Lottery</Link>}
            <a href="/#developers" className="whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium text-mut transition hover:text-ink">API</a>
          </div>

          <div className="flex items-center gap-2">
            <CopyCA className="hidden xl:inline-flex" />
            <a href="https://x.com/yo_yo_tech" target="_blank" rel="noopener noreferrer" aria-label="yo-yo on X" className="flex h-8 w-8 items-center justify-center rounded-md text-mut transition hover:text-ink">
              <X className="h-[18px] w-[18px]" />
            </a>
            <a href="https://t.me/yoyocommu" target="_blank" rel="noopener noreferrer" aria-label="yo-yo community on Telegram" className="flex h-8 w-8 items-center justify-center rounded-md text-mut transition hover:text-ink"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4"><path d="M21.9 4.6 18.6 20c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.2-8.3c.4-.4-.1-.6-.6-.2L6.1 13.7 1.3 12.2c-1-.3-1-1 .2-1.5L20.6 3.1c.9-.3 1.6.2 1.3 1.5z"/></svg></a>
            <a href="https://github.com/tow3web3/yoyo" target="_blank" rel="noopener noreferrer" aria-label="yo-yo on GitHub" className="flex h-8 w-8 items-center justify-center rounded-md text-mut transition hover:text-ink">
              <Github className="h-[18px] w-[18px]" />
            </a>
            <Link href="/app" className="btn-primary whitespace-nowrap">
              Dashboard
              <Arrow className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
