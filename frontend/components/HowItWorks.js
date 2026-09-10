'use client';

// How it works, drawn as one yo-yo throw: the string dips through three stations
// (sweep, policy, pay) and the disc rides it in a loop. Each station carries a
// live mini scene from the policy grid instead of an icon.
import Image from 'next/image';
import ModeScene from './ModeScenes';

const STEPS = [
  { n: '01', tag: 'fees in', title: 'Link any coin, sweep the fees', body: 'Any ERC-20 on Robinhood Chain plugs in, from any launchpad. Its fees land in a dev wallet as stock tokens or ETH. Every cycle, yo-yo sweeps everything above a small gas reserve.', scene: 'anytoken' },
  { n: '02', tag: 'the policy', title: 'Apply the routing', body: 'Payout ratio to holders, the share you keep, buyback and burn, retained earnings into a stock treasury. The record date decides who qualifies and with what weight.', scene: 'payout' },
  { n: '03', tag: 'dividends out', title: 'Pay in stocks or memecoins', body: 'NVDA fees become NVDA dividends, pro-rata, no swap. Or pick any token by contract address and holders get paid in that, with a fair-price guard. Receipts, statements and yield follow.', scene: 'inkind' },
];

// The string, in a 1200 x 260 box: hand at the top left, three dips, back to the hand.
const PATH = 'M 40 30 C 120 30, 140 200, 230 200 C 320 200, 330 30, 420 30 C 500 30, 520 200, 610 200 C 700 200, 720 30, 800 30 C 880 30, 900 200, 990 200 C 1080 200, 1100 30, 1160 30';

export default function HowItWorks() {
  return (
    <div id="how" className="scroll-mt-20">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">How it works</div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">One throw, three stations, every cycle</h2>
        </div>
        <div className="hidden items-center gap-2 text-xs text-mut lg:flex"><span className="h-2 w-6 rounded-full bg-hood-500" /> the string is the fee flow</div>
      </div>

      {/* the throw: string + riding yo-yo, desktop only */}
      <div className="relative hidden h-[260px] lg:block" aria-hidden>
        <svg viewBox="0 0 1200 260" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          <path d={PATH} fill="none" stroke="#0B0F0C" strokeWidth="5" strokeLinecap="round" opacity="0.9" />
          <path d={PATH} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          <path d={PATH} fill="none" stroke="#CAF90F" strokeWidth="2.5" strokeDasharray="6 12" strokeLinecap="round" className="peek-dash" />
          {[230, 610, 990].map((x, i) => (
            <g key={x}>
              <circle cx={x} cy={200} r={22} fill="#0B0F0C" />
              <text x={x} y={206} textAnchor="middle" fill="#CAF90F" fontSize="16" fontWeight="800" fontFamily="var(--font-jetbrains), monospace">{STEPS[i].n}</text>
              <text x={x} y={244} textAnchor="middle" fill="#6E8C06" fontSize="12" fontWeight="800" fontFamily="var(--font-manrope), sans-serif" letterSpacing="2">{STEPS[i].tag.toUpperCase()}</text>
            </g>
          ))}
          <rect x="22" y="8" width="36" height="30" rx="14" fill="#0B0F0C" />
          <circle cx="40" cy="30" r="6" fill="#CAF90F" />
          <rect x="1142" y="8" width="36" height="30" rx="14" fill="#0B0F0C" />
          <circle cx="1160" cy="30" r="6" fill="#CAF90F" />
        </svg>
        <div className="hw-yoyo absolute left-0 top-0 h-14 w-14" style={{ offsetPath: `path('${PATH}')` }}>
          <Image src="/brand/yoyoface-256.png" alt="" fill className="object-contain drop-shadow-[0_10px_14px_rgba(11,15,12,0.35)]" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        {STEPS.map((s, i) => (
          <div key={s.n} className="group relative">
            <div className="pointer-events-none absolute -top-3 right-2 select-none font-mono text-[96px] font-extrabold leading-none text-ink/[0.04] lg:hidden">{s.n}</div>
            <div className="mb-3 flex items-center gap-2 lg:hidden"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink font-mono text-[11px] font-bold text-hood-500">{s.n}</span><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-hood-700">{s.tag}</span></div>
            <ModeScene kind={s.scene} />
            <h3 className="font-display text-lg font-extrabold tracking-tight text-ink">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-mut">{s.body}</p>
            {i < STEPS.length - 1 && <div className="pointer-events-none absolute -right-5 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-paper text-hood-700 lg:flex">→</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
