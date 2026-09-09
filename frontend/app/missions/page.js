import Navigation from '../../components/Navigation';
import TickerTape from '../../components/TickerTape';
import Footer from '../../components/Footer';

export const metadata = { title: 'Missions, coming soon · Yoyo' };

const PREVIEW = [
  { emoji: '💎', title: 'Diamond hands', body: 'Hold tiers from 100K to 1M $YOYO.' },
  { emoji: '🗳️', title: 'Cast your vote', body: 'Take part in a Community Vote cycle.' },
  { emoji: '🔥', title: 'Active voter', body: 'Vote across multiple cycles.' },
  { emoji: '🤝', title: 'Become a customer', body: 'Link your own token to the bot.' },
  { emoji: '🎰', title: 'Spin the wheel', body: 'Turn on Stock Roulette.' },
  { emoji: '📈', title: 'Dividend collector', body: 'Receive a stock dividend from any Yoyo token. (later)' },
];

const RANKS = ['🥚 Rookie', '🪀 Holder', '💎 Diamond', '🐋 Whale', '👑 Legend'];

export default function MissionsPage() {
  return (
    <>
      <TickerTape />
      <Navigation />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <div className="mb-6">
          <span className="chip-gold mb-3"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-500" />Coming soon</span>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Earn from holding 🪀🎯</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-mut">
            Holding won't be passive anymore. Complete missions, earn <span className="font-semibold text-ink">XP</span>, level up, and claim
            ETH rewards straight to your wallet, gasless. And soon, every project on Yoyo will be able to run missions for
            their own holders.
          </p>
        </div>

        <div className="panel-gold mb-6 p-5">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-gold-700">Climb the ranks</div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {RANKS.map((r, i) => (
              <span key={r} className="flex items-center gap-2">
                <span className="rounded-full border border-line bg-paper px-3 py-1 text-ink shadow-soft">{r}</span>
                {i < RANKS.length - 1 && <span className="text-mut">›</span>}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {PREVIEW.map((m) => (
            <div key={m.title} className="panel relative flex items-center gap-3 p-4 opacity-90">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-hood-100 text-xl">{m.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{m.title}</div>
                <div className="text-xs text-mut">{m.body}</div>
              </div>
              <span className="shrink-0 text-mut" title="Coming soon">🔒</span>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-mut">Missions drop with <span className="font-semibold text-ink">$YOYO</span> on Robinhood Chain. 🪀</p>
      </main>
      <Footer />
    </>
  );
}
