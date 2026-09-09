'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Arrow, X, Github } from './Icons';
import CopyCA from './CopyCA';

export default function Navigation() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'boomerangtekbot';

  return (
    <nav className="sticky top-0 z-40 border-b border-line bg-ground/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex h-14 items-center justify-between gap-4">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="relative h-8 w-8 group-hover:animate-wiggle">
              <Image src="/brand/yoyo-256.png" alt="Yoyo" fill className="object-contain" priority />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-ink">Yoyo</span>
            <span className="hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-hood-300 bg-hood-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-hood-700 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-hood-500" />
              Robinhood Chain
            </span>
          </Link>

          <div className="hidden items-center gap-0.5 lg:flex">
            <a href="/#how" className="whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium text-mut transition hover:text-ink">How it works</a>
            <Link href="/stocks" className="whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium text-mut transition hover:text-ink">Stocks</Link>
            <a href="/#modes" className="whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium text-mut transition hover:text-ink">Modes</a>
            <a href="/#screener" className="whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium text-mut transition hover:text-ink">Screener</a>
            <Link href="/wallet" className="whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium text-mut transition hover:text-ink">My dividends</Link>
            <Link href="/vote" className="whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium text-hood-700 transition hover:text-hood-600">Vote</Link>
            <Link href="/missions" className="whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium text-gold-700 transition hover:text-gold-600">Missions</Link>
            <a href="/#developers" className="whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium text-mut transition hover:text-ink">API</a>
          </div>

          <div className="flex items-center gap-2">
            <CopyCA className="hidden xl:inline-flex" />
            <a href="https://x.com/Boomerang_tek" target="_blank" rel="noopener noreferrer" aria-label="Yoyo on X" className="flex h-8 w-8 items-center justify-center rounded-md text-mut transition hover:text-ink">
              <X className="h-[18px] w-[18px]" />
            </a>
            <a href="https://github.com/tow3web3/boomerang" target="_blank" rel="noopener noreferrer" aria-label="Yoyo on GitHub" className="flex h-8 w-8 items-center justify-center rounded-md text-mut transition hover:text-ink">
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
