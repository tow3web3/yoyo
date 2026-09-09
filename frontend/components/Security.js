import { Lock, Shield, Pause, Scale } from './Icons';

const POINTS = [
  { Icon: Lock, title: 'AES-256-GCM encryption', body: 'Your wallet key is encrypted the moment you send it and stored encrypted at rest. It is only ever decrypted in memory, at execution time.', tile: 'bg-hood-100 text-hood-700', ring: 'hover:border-hood-300' },
  { Icon: Shield, title: 'Scoped to a few actions', body: 'The bot collects fees, swaps on Uniswap, and transfers rewards to holders or the burn address. Nothing else runs against your wallet.', tile: 'bg-gold-100 text-gold-700', ring: 'hover:border-gold-300' },
  { Icon: Scale, title: 'Fair-price oracle guard', body: 'A stock swap only executes when the pool delivers at least 90% of the Yahoo Finance price. Thin pools never eat your fees.', tile: 'bg-tile text-ink', ring: 'hover:border-ink' },
  { Icon: Pause, title: 'Pause or stop anytime', body: 'Pause, resume, or delete your configuration from Telegram instantly. Deleting removes the bot access for good.', tile: 'bg-hood-100 text-hood-700', ring: 'hover:border-hood-300' },
];

export default function Security() {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <div className="eyebrow mb-2">Security</div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Built so your keys stay yours</h2>
        <p className="mt-3 text-sm leading-relaxed text-mut">0xdiv handles a wallet key to automate on-chain actions, so it is designed around least privilege, encryption, a price guard, and full owner control.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {POINTS.map(({ Icon, title, body, tile, ring }) => (
          <div key={title} className={`panel card-fun p-5 ${ring}`}>
            <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${tile}`}><Icon className="h-[18px] w-[18px]" /></span>
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-mut">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
