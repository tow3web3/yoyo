'use client';

import { useState } from 'react';

const ITEMS = [
  { q: 'What is a Robinhood Stock Token?', a: 'A token on Robinhood Chain that tracks a real stock or ETF: NVDA, TSLA, SPY, GLD and 191 more. They are plain ERC-20s, so Boomerang can buy them on Uniswap and send them to your holders like any other token.' },
  { q: 'Where do my fees come from?', a: 'Two sources. Most launchpads on Robinhood Chain pay creator fees in ETH straight to your wallet: Boomerang distributes whatever sits above a small gas reserve. If your token trades on Uniswap V3 with a position you hold, Boomerang collects the LP fees each cycle and converts the token side to ETH.' },
  { q: 'Are my funds safe?', a: 'Your private key is encrypted with AES-256-GCM and only decrypted in memory when a cycle runs. Use a dedicated wallet funded with just what the bot needs, never your main holdings.' },
  { q: 'What if a stock pool is too thin?', a: 'Every stock swap is compared to the Yahoo Finance price. If no route on Uniswap V4, V3 or V2 delivers at least 90% of fair value, the cycle pays ETH instead and says so on the dashboard. Your fees never disappear into price impact.' },
  { q: 'Which stocks are liquid today?', a: 'About 48 of the 195 fill a small order at fair value on Uniswap V4 right now: the Magnificent 7, most big semis, SPY, QQQ, GLD, COIN, GME, PLTR and more (marked Liquid on the Stocks page). Roulette and Top Gainer draw only from this pool. Any of the 195 can be chosen as a fixed reward; the guard handles the rest.' },
  { q: 'What is loyalty weighting?', a: 'An optional rule set per token. Because Boomerang rebuilds every wallet\'s history from Transfer logs, it knows how long each wallet has held and whether it sold. With loyalty on, a wallet\'s dividend weight ramps from 1x to 2x (creator\'s choice up to 5x) over the ramp period, wallets younger than the minimum hold get nothing that cycle, and any sell restarts the clock. Voting weight follows the same rules.' },
  { q: 'Who counts as a holder?', a: 'Real wallets only. Balances are rebuilt from Transfer logs on chain. Liquidity pools, routers, the token contract, the dev wallet and any smart contract are excluded, so dividends go to people.' },
  { q: 'How often does it run?', a: 'Every 1, 2, 5, 10, 30 or 60 minutes, or once a day at the closing bell (4:00 pm New York time, weekdays). You can also restrict any schedule to market hours.' },
  { q: 'Can it burn instead of paying holders?', a: 'Yes. Set the destination to burn and each cycle sends the bought tokens to the dead address. Point the reward at your own token for a classic buyback and burn.' },
  { q: 'Is there an API?', a: 'Yes, a free public read-only API at /api/v1: global stats, linked tokens, recent dividends and the stock registry. See the Developers section.' },
];

export default function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[0.7fr_1.3fr]">
      <div>
        <div className="eyebrow mb-2">FAQ</div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Questions, answered</h2>
      </div>
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper/80">
        {ITEMS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q}>
              <button onClick={() => setOpen(isOpen ? -1 : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left" aria-expanded={isOpen}>
                <span className="text-sm font-semibold text-ink">{item.q}</span>
                <span className={`shrink-0 text-hood-600 transition-transform ${isOpen ? 'rotate-45' : ''}`} aria-hidden>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </span>
              </button>
              <div className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden"><p className="px-5 pb-4 text-sm leading-relaxed text-mut">{item.a}</p></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
