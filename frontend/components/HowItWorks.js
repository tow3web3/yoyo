import { Coins, Scale, Gift } from './Icons';

const STEPS = [
  { n: '01', Icon: Coins, title: 'Link any coin, sweep the fees', body: 'Any ERC-20 on Robinhood Chain plugs in, from any launchpad. Its fees land in a dev wallet as stock tokens or ETH; every cycle yo-yo sweeps everything above a small gas reserve.', tile: 'bg-hood-100 text-hood-700', ring: 'hover:border-hood-300' },
  { n: '02', Icon: Scale, title: 'Apply the policy', body: 'Payout ratio to holders, the share you keep, buyback and burn, retained earnings into a stock treasury. Loyalty sets the record date: who qualifies and with what weight.', tile: 'bg-gold-100 text-gold-700', ring: 'hover:border-gold-300' },
  { n: '03', Icon: Gift, title: 'Pay in stocks or memecoins', body: 'NVDA fees become NVDA dividends, pro-rata, no swap. Or pick any token by contract address, a stock or a memecoin, and holders get paid in that, with a fair-price guard on every swap. Receipts, statements and yield follow automatically.', tile: 'bg-tile text-ink', ring: 'hover:border-ink' },
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
