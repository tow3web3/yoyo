import { Target, Dice, TrendUp, Layers, Vote, Bell, Clock, Flame, Scale, Chart, Lock } from './Icons';

const MODES = [
  { Icon: Target, title: 'Fixed stock', body: 'Pick one of 195 Robinhood Stock Tokens, ETH, or any token on the chain. Same reward, every cycle.', tile: 'bg-hood-100 text-hood-700', ring: 'hover:border-hood-300' },
  { Icon: Dice, title: 'Stock Roulette', body: 'A random liquid stock every cycle: NVDA today, GME tomorrow. They get paid, they never know in what.', tile: 'bg-gold-100 text-gold-700', ring: 'hover:border-gold-300' },
  { Icon: TrendUp, title: 'Top Gainer', body: "Each cycle pays the day's best-performing stock in the liquid pool. Holders ride the winner.", tile: 'bg-hood-100 text-hood-700', ring: 'hover:border-hood-300' },
  { Icon: Layers, title: 'Portfolio', body: 'Rotate through a basket: Magnificent 7, AI & Semis, Degen Street, Safe Haven. Holders build a portfolio over time.', tile: 'bg-tile text-ink', ring: 'hover:border-ink' },
  { Icon: Vote, title: 'Community Vote', body: 'Holders vote on the next dividend, weighted by their balance. Gasless, just a signature.', tile: 'bg-gold-100 text-gold-700', ring: 'hover:border-gold-300' },
  { Icon: Bell, title: 'Closing bell', body: 'Pay once a day at 4:00 pm New York time, weekdays only. A real dividend calendar.', tile: 'bg-hood-100 text-hood-700', ring: 'hover:border-hood-300' },
  { Icon: Clock, title: 'Market hours only', body: 'Or run every 1 to 60 minutes and skip the cycles when Wall Street is closed.', tile: 'bg-tile text-ink', ring: 'hover:border-ink' },
  { Icon: Scale, title: 'Fair-price guard', body: 'Every stock swap is checked against Yahoo Finance. Thin pool, no fill: holders get ETH that cycle instead of a bad price.', tile: 'bg-gold-100 text-gold-700', ring: 'hover:border-gold-300' },
  { Icon: Flame, title: 'Buy back & burn', body: 'Point the fees at your own token and burn what they buy. Supply shrinks every run.', tile: 'bg-orange-100 text-orange-700', ring: 'hover:border-orange-300' },
  { Icon: Lock, title: 'AES-256 encrypted keys', body: 'Wallet keys are encrypted at rest and decrypted in memory only, at run time.', tile: 'bg-tile text-ink', ring: 'hover:border-ink' },
  { Icon: Chart, title: 'Public dashboard', body: 'Every token gets a live transparency page with Blockscout links to each payout.', tile: 'bg-hood-100 text-hood-700', ring: 'hover:border-hood-300' },
];

export default function Modes() {
  return (
    <div id="modes" className="scroll-mt-20">
      <div className="mb-8">
        <div className="eyebrow mb-2">Modes</div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">More than a buyback bot</h2>
        <p className="mt-2 max-w-xl text-sm text-mut">Built around what stock tokens make possible: baskets, market hours, the closing bell, and a guard against thin pools.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODES.map(({ Icon, title, body, tile, ring }) => (
          <div key={title} className={`panel card-fun p-5 ${ring}`}>
            <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${tile}`}><Icon className="h-5 w-5" /></span>
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-mut">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
