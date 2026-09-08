import { Coins, Scale, Gift } from './Icons';

const STEPS = [
  { n: '01', Icon: Coins, title: 'Sweep the fees', body: 'Your launchpad pays you in stock tokens (or ETH). Every cycle Boomerang sweeps the dev wallet: all 195 Robinhood Stock Tokens and ETH above a small gas reserve.', tile: 'bg-hood-100 text-hood-700', ring: 'hover:border-hood-300' },
  { n: '02', Icon: Scale, title: 'Apply the policy', body: 'Payout ratio to holders, the share you keep, buyback and burn, retained earnings into a stock treasury. Loyalty sets the record date: who qualifies and with what weight.', tile: 'bg-gold-100 text-gold-700', ring: 'hover:border-gold-300' },
  { n: '03', Icon: Gift, title: 'Pay in kind', body: 'NVDA fees become NVDA dividends, pro-rata, no swap. ETH fees are converted to the stock you chose, with a fair-price guard. Receipts, statements and yield follow automatically.', tile: 'bg-tile text-ink', ring: 'hover:border-ink' },
];

export default function HowItWorks() {
  return (
    <div id="how" className="scroll-mt-20">
      <div className="mb-8">
        <div className="eyebrow mb-2">How it works</div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Three steps, every cycle</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {STEPS.map(({ n, Icon, title, body, tile, ring }) => (
          <div key={n} className={`panel card-fun p-6 ${ring}`}>
            <div className="mb-4 flex items-center justify-between">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tile}`}><Icon className="h-5 w-5" /></span>
              <span className="font-display text-2xl font-extrabold text-line">{n}</span>
            </div>
            <h3 className="text-base font-semibold text-ink">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-mut">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
