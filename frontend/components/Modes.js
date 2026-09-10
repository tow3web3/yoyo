import ModeScene from './ModeScenes';
import { Target, Dice, TrendUp, Layers, Vote, Bell, Clock, Flame, Scale, Chart, Lock, Medal, Bank, Gift, Wallet } from './Icons';

const MODES = [
  { Icon: Gift, title: 'Pay-through in kind', scene: 'inkind', body: 'What the launchpad pays, holders receive: NVDA fees become NVDA dividends. No swap, no slippage. ETH fees convert to the stock you pick.', tile: 'bg-hood-100 text-hood-700', ring: 'hover:border-hood-300', badge: 'Core' },
  { Icon: Wallet, title: 'Payout ratio', scene: 'payout', body: 'Decide the share that goes to holders and the share you keep, sent to your own payout address each cycle. 100/0, 80/20, 70/30: your call.', tile: 'bg-tile text-ink', ring: 'hover:border-ink', badge: 'Core' },
  { Icon: Medal, title: 'Record date & loyalty', scene: 'loyalty', body: 'Dividends weighted by holding time: 1x to 2x over 30 days, a minimum hold to qualify, and selling resets the clock. Snipers earn less than diamond hands.', tile: 'bg-gold-100 text-gold-700', ring: 'hover:border-gold-300' },
  { Icon: Bank, title: 'Retained earnings', scene: 'treasury', body: 'Route a share into a stock treasury held by a wallet you control. The dashboard publishes the balance sheet, book value per token and how much of the market cap is backed.', tile: 'bg-gold-100 text-gold-700', ring: 'hover:border-gold-300' },
  { Icon: Flame, title: 'Buyback & burn', scene: 'burn', body: 'A share buys your own token and burns it. Supply shrinks every cycle, alongside the dividend.', tile: 'bg-orange-100 text-orange-700', ring: 'hover:border-orange-300' },
  { Icon: TrendUp, title: 'Dividend yield', scene: 'yield', body: 'Fees returned over 30 days, annualized against market cap, like a real stock. On the dashboard, in the API, and as a badge you can embed.', tile: 'bg-hood-100 text-hood-700', ring: 'hover:border-hood-300' },
  { Icon: Bell, title: 'Closing bell', scene: 'bell', body: 'Pay once a day at 4:00 pm New York time, weekdays only. A real dividend calendar.', tile: 'bg-hood-100 text-hood-700', ring: 'hover:border-hood-300' },
  { Icon: Clock, title: 'Market hours only', scene: 'hours', body: 'Or run every 1 to 60 minutes and skip the cycles when Wall Street is closed.', tile: 'bg-tile text-ink', ring: 'hover:border-ink' },
  { Icon: Layers, title: 'Any token, by address', scene: 'anytoken', body: 'Dividends do not have to be a stock. Paste any contract address on Robinhood Chain and holders of your coin get paid in it: a partner memecoin, your ecosystem token, a cross-promo. Fees are swapped into it on Uniswap every cycle.', tile: 'bg-gold-100 text-gold-700', ring: 'hover:border-gold-300', badge: 'New' },
  { Icon: Target, title: 'Convert mode', scene: 'convert', body: 'Rather pay one stock than a mix? Everything is converted to the reward you chose before payout: any of the 195, or ETH.', tile: 'bg-tile text-ink', ring: 'hover:border-ink' },
  { Icon: Dice, title: 'Roulette, Top Gainer, Portfolio', scene: 'reel', body: 'For ETH fees: a random liquid stock each cycle, the best stock of the day, or a rotating basket (Magnificent 7, AI & Semis, Degen Street, Safe Haven).', tile: 'bg-gold-100 text-gold-700', ring: 'hover:border-gold-300' },
  { Icon: Vote, title: 'Community Vote', scene: 'vote', body: 'Holders vote on the next dividend, weighted by their balance and loyalty. Gasless, just a signature.', tile: 'bg-gold-100 text-gold-700', ring: 'hover:border-gold-300' },
  { Icon: Scale, title: 'Fair-price guard', scene: 'guard', body: 'Every conversion is checked against Yahoo Finance. Thin pool, no fill: holders get ETH that cycle instead of a bad price.', tile: 'bg-tile text-ink', ring: 'hover:border-ink' },
  { Icon: Lock, title: 'AES-256 encrypted keys', scene: 'keys', body: 'Wallet keys are encrypted at rest and decrypted in memory only, at run time.', tile: 'bg-tile text-ink', ring: 'hover:border-ink' },
  { Icon: Chart, title: 'Receipts & statements', scene: 'receipts', body: 'Every dividend posts a card to your Telegram group with a Share on X button. Every holder gets a statement page. Every token gets a live dashboard.', tile: 'bg-hood-100 text-hood-700', ring: 'hover:border-hood-300' },
];

export default function Modes() {
  return (
    <div id="modes" className="scroll-mt-20">
      <div className="mb-8">
        <div className="eyebrow mb-2">The policy</div>
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl lg:text-5xl">Every decision a listed company makes about its cash</h2>
        <p className="mt-2 max-w-xl text-sm text-mut">Payout ratio, record date, retained earnings, buybacks, calendar, yield. For a memecoin, from Telegram. Each card shows the option in action.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODES.map(({ Icon, title, body, tile, ring, badge, scene }) => (
          <div key={title} className={`panel card-fun relative p-5 ${ring}`}>
            {badge && <span className="absolute right-5 top-1 z-10 rounded-full bg-ink px-2 py-[1px] text-[9px] font-bold uppercase tracking-wider text-hood-500">{badge}</span>}
            <ModeScene kind={scene} />
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><span className={`flex h-6 w-6 items-center justify-center rounded-lg ${tile}`}><Icon className="h-3.5 w-3.5" /></span>{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-mut">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
