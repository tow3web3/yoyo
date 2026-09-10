import Link from 'next/link';
import Navigation from '../../../components/Navigation';
import TickerTape from '../../../components/TickerTape';
import Footer from '../../../components/Footer';
import StockLogo from '../../../components/StockLogo';
import { Arrow, X } from '../../../components/Icons';
import { getWalletStatement } from '../../../lib/queries';
import { fetchTokenMeta } from '../../../lib/tokenMeta';
import { EVM_ADDR, explorerTx, explorerAddress } from '../../../lib/stocks';
import { fmtUnits, siteUrl } from '../../../lib/og';

export const dynamic = 'force-dynamic';
const BLOCKS_PER_DAY = 864000;
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export async function generateMetadata({ params }) {
  const { address } = await params;
  if (!EVM_ADDR.test(address)) return { title: 'Wallet · yo-yo' };
  const image = `${siteUrl()}/api/card/wallet/${address}`;
  const title = `Dividend statement for ${short(address)}`;
  return {
    title: `${title} · yo-yo`,
    description: 'Stock dividends earned by holding tokens on Robinhood Chain, via yo-yo.',
    openGraph: { title, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, images: [image] },
  };
}

export default async function WalletPage({ params }) {
  const { address } = await params;
  if (!EVM_ADDR.test(address)) {
    return (<><TickerTape /><Navigation /><main className="mx-auto max-w-2xl px-5 py-20 text-center"><h1 className="font-display text-2xl font-bold text-ink">Not a wallet address</h1><Link href="/wallet" className="btn-primary mt-6">Try again</Link></main><Footer /></>);
  }
  const { totals, recent, holdings } = await getWalletStatement(address);
  const meta = await fetchTokenMeta([...totals.flatMap((t) => [t.source_token, t.reward_token]), ...recent.flatMap((r) => [r.source_token, r.reward_token]), ...holdings.map((h) => h.token)]);
  const sym = (a) => meta[a]?.symbol || (a ? a.slice(2, 6).toUpperCase() : '?');
  const dec = (a) => meta[a]?.decimals ?? 18;

  const byReward = new Map();
  for (const t of totals) {
    const cur = byReward.get(t.reward_token) || { total: 0n, n: 0 };
    cur.total += BigInt(t.total);
    cur.n += t.n;
    byReward.set(t.reward_token, cur);
  }
  const dividends = totals.reduce((s, t) => s + t.n, 0);
  const site = siteUrl();
  const headline = [...byReward.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 3).map(([k, v]) => `${fmtUnits(v.total, dec(k))} ${sym(k)}`).join(', ');
  const shareText = dividends > 0
    ? `I earned ${headline} just by holding on Robinhood Chain 📈 Stock dividends by @yo_yo_tech`
    : 'Memecoins that pay real stock dividends on Robinhood Chain 📈 @yo_yo_tech';
  const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(`${site}/wallet/${address}`)}`;

  return (
    <>
      <TickerTape />
      <Navigation />
      <main className="mx-auto max-w-4xl px-5 py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow mb-2">Dividend statement</div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl"><span className="font-mono">{short(address)}</span></h1>
            <a href={explorerAddress(address)} target="_blank" rel="noopener noreferrer" className="text-xs text-mut hover:text-ink">Blockscout ↗</a>
          </div>
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="btn-ink"><X className="h-4 w-4" /> Share my statement</a>
        </div>

        {/* Headline totals */}
        <div className="panel-ink relative mb-6 overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-hood-500/20 blur-3xl" />
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-hood-400">{dividends} dividends received</div>
          {dividends === 0 ? (
            <p className="mt-2 text-white/80">No dividend yet for this wallet. Hold a token that runs yo-yo and the statement fills itself.</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...byReward.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, v]) => (
                <div key={k} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                  <StockLogo address={k} meta={meta[k]} size="h-10 w-10" />
                  <div>
                    <div className="figure text-xl font-extrabold text-hood-400">+{fmtUnits(v.total, dec(k))} <span className="text-white">{sym(k)}</span></div>
                    <div className="text-xs text-white/60">{v.n} payouts</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Holdings + loyalty */}
          <div className="panel p-6">
            <h2 className="mb-3 text-sm font-semibold text-ink">yo-yo tokens held</h2>
            {holdings.length === 0 ? <p className="text-sm text-mut">This wallet holds no token that runs yo-yo right now.</p> : (
              <div className="space-y-2">
                {holdings.map((h) => {
                  const since = h.since_block == null ? null : Math.max(Number(h.since_block), h.loyalty_sell_reset && h.last_out_block != null ? Number(h.last_out_block) : 0);
                  const heldDays = since == null ? null : Math.max(0, (Number(h.last_block) - since) / BLOCKS_PER_DAY);
                  const ramp = Number(h.loyalty_ramp_days || 30);
                  const maxMult = Number(h.loyalty_max_bps || 20000) / 10000;
                  const mult = !h.loyalty_enabled ? null : heldDays == null ? maxMult : 1 + (maxMult - 1) * Math.min(1, heldDays / ramp);
                  const pct = heldDays == null ? 100 : Math.min(100, Math.round((heldDays / ramp) * 100));
                  return (
                    <Link key={h.token} href={`/${h.token}`} className="block rounded-xl border border-line p-3 transition hover:border-hood-300">
                      <div className="flex items-center gap-3">
                        <StockLogo address={h.token} meta={meta[h.token]} size="h-9 w-9" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-semibold text-ink">${sym(h.token)}</span>
                            <span className="figure text-xs text-mut">{fmtUnits(h.balance, dec(h.token))}</span>
                          </div>
                          <div className="text-xs text-mut">{heldDays == null ? 'holding since before the ledger' : `holding for ${heldDays < 1 ? `${Math.max(1, Math.round(heldDays * 24))}h` : `${Math.floor(heldDays)} days`}`}</div>
                        </div>
                        {mult != null && <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs font-bold text-gold-700">🏅 {mult.toFixed(2)}x</span>}
                      </div>
                      {mult != null && (
                        <div className="mt-2">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-tile"><div className="h-full rounded-full bg-gradient-to-r from-hood-400 to-gold-400" style={{ width: `${pct}%` }} /></div>
                          <div className="mt-1 text-[10px] text-mut">Loyalty ramps to {maxMult.toFixed(1)}x at {ramp} days{h.loyalty_sell_reset ? ', selling resets' : ''}</div>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent dividends */}
          <div className="panel p-6">
            <h2 className="mb-3 text-sm font-semibold text-ink">Recent dividends</h2>
            {recent.length === 0 ? <p className="text-sm text-mut">Nothing yet.</p> : (
              <div className="space-y-1.5">
                {recent.map((r, i) => (
                  <div key={`${r.log_id}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-line/70 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <StockLogo address={r.reward_token} meta={meta[r.reward_token]} size="h-7 w-7" text="text-[8px]" />
                      <div>
                        <div className="figure text-sm font-semibold text-ink">+{fmtUnits(r.amount, dec(r.reward_token))} {sym(r.reward_token)}</div>
                        <div className="text-[11px] text-mut">from ${sym(r.source_token)} · {new Date(r.execution_time).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 text-[11px]">
                      <Link href={`/receipt/${r.log_id}`} className="font-medium text-hood-700 hover:underline">receipt</Link>
                      {r.tx_hash && <a href={explorerTx(r.tx_hash)} target="_blank" rel="noopener noreferrer" className="font-medium text-mut hover:underline">tx ↗</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
