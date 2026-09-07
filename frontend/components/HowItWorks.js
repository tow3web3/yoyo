import { Coins, Swap, Gift } from './Icons';

const STEPS = [
  { n: '01', Icon: Coins, title: 'Collect the fees', body: 'Your fees arrive as ETH in the dev wallet, or sit inside your Uniswap V3 position. Boomerang gathers them every cycle.', tile: 'bg-hood-100 text-hood-700', ring: 'hover:border-hood-300' },
  { n: '02', Icon: Swap, title: 'Buy the stock', body: 'That ETH is swapped into the reward on Uniswap V4, V3 or V2, best route wins. Stock swaps only execute above 90% of the real market price.', tile: 'bg-gold-100 text-gold-700', ring: 'hover:border-gold-300' },
  { n: '03', Icon: Gift, title: 'Pay the dividend', body: 'The stock is sent to every holder, proportional to their balance. Or burned, if you run a buyback and burn instead.', tile: 'bg-tile text-ink', ring: 'hover:border-ink' },
];

export default function HowItWorks() {
  return (
    <div id="how" className="scroll-mt-20">
      <div className="mb-8">
        <div className="eyebrow mb-2">How it works</div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Three steps, fully automated</h2>
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
