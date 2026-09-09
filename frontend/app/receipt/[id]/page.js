import Link from 'next/link';
import Navigation from '../../../components/Navigation';
import TickerTape from '../../../components/TickerTape';
import Footer from '../../../components/Footer';
import StockLogo from '../../../components/StockLogo';
import { Arrow, X } from '../../../components/Icons';
import { getReceipt } from '../../../lib/queries';
import { fetchTokenMeta } from '../../../lib/tokenMeta';
import { getStock, explorerTx } from '../../../lib/stocks';
import { fmtUnits, siteUrl } from '../../../lib/og';

export const dynamic = 'force-dynamic';

async function load(id) {
  const r = await getReceipt(id);
  if (!r) return null;
  const meta = await fetchTokenMeta([r.source_token_address, r.reward_token_used]);
  const src = meta[r.source_token_address] || {};
  const rew = meta[r.reward_token_used] || {};
  const stock = getStock(r.reward_token_used);
  return { r, src, rew, stock, rewardSymbol: rew.symbol || stock?.ticker || 'ETH', amount: fmtUnits(r.total_airdropped, rew.decimals ?? 18) };
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const d = await load(id);
  if (!d) return { title: 'Receipt not found · 0xdiv' };
  const title = `$${d.src.symbol || 'Token'} paid ${d.amount} ${d.rewardSymbol} to its holders`;
  const description = `${d.r.paid_count || d.r.holder_count} wallets received ${d.rewardSymbol} as a dividend on Robinhood Chain, via 0xdiv.`;
  const image = `${siteUrl()}/api/card/receipt/${d.r.id}`;
  return {
    title: `${title} · 0xdiv`,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }], type: 'article' },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default async function ReceiptPage({ params }) {
  const { id } = await params;
  const d = await load(id);

  if (!d) {
    return (
      <>
        <TickerTape /><Navigation />
        <main className="mx-auto max-w-2xl px-5 py-20 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">Receipt not found</h1>
          <Link href="/" className="btn-primary mt-6">Go home <Arrow className="h-4 w-4" /></Link>
        </main>
        <Footer />
      </>
    );
  }

  const { r, src, rew, stock, rewardSymbol, amount } = d;
  const site = siteUrl();
  const shareText = `$${src.symbol || 'Token'} just paid its holders ${amount} ${rewardSymbol} 📈\n${r.paid_count || r.holder_count} wallets, pro-rata, on Robinhood Chain.\nDividends by @Boomerang_tek`;
  const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(`${site}/receipt/${r.id}`)}`;
  const when = new Date(r.execution_time).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' });

  return (
    <>
      <TickerTape />
      <Navigation />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="eyebrow mb-2">Dividend receipt #{r.id}</div>
        <div className="panel-glow overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
            <div className="flex items-center gap-3">
              <StockLogo address={r.source_token_address} meta={src} size="h-10 w-10" />
              <div>
                <div className="text-sm text-mut">Holders of</div>
                <div className="font-display text-lg font-bold text-ink">{src.name || `$${src.symbol || 'TOKEN'}`} <span className="font-mono text-sm text-mut">${src.symbol}</span></div>
              </div>
            </div>
            <div className="text-right text-xs text-mut">{when} ET</div>
          </div>

          <div className="grid gap-6 px-6 py-8 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <div className="text-sm text-mut">received</div>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="figure font-display text-5xl font-extrabold tracking-tight text-hood-700 sm:text-6xl">{amount}</span>
                <span className="font-display text-3xl font-extrabold text-ink">{rewardSymbol}</span>
              </div>
              <div className="mt-1 text-sm text-mut">{stock ? `${stock.name} · Robinhood Stock Token` : rew.name || 'on Robinhood Chain'}</div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[[`${r.paid_count || r.holder_count}`, 'wallets paid'], [`${fmtUnits(r.claimed_eth_wei, 18, 4)} ETH`, 'from fees'], [r.loyalty_enabled ? 'Loyalty' : 'Pro-rata', 'weighting']].map(([v, l]) => (
                  <div key={l} className="rounded-xl border border-line bg-paper p-3">
                    <div className="figure text-lg font-bold text-ink">{v}</div>
                    <div className="text-[10px] uppercase tracking-wider text-mut">{l}</div>
                  </div>
                ))}
              </div>
            </div>
            <StockLogo address={r.reward_token_used} meta={rew} size="h-32 w-32" text="text-2xl" className="mx-auto border-4 border-hood-500 shadow-glow" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-ground px-6 py-4">
            <div className="flex flex-wrap gap-3 text-xs">
              {r.tx_hash && <a href={explorerTx(r.tx_hash)} target="_blank" rel="noopener noreferrer" className="font-medium text-hood-700 hover:underline">Payout on Blockscout ↗</a>}
              {r.swap_tx && <a href={explorerTx(r.swap_tx)} target="_blank" rel="noopener noreferrer" className="font-medium text-mut hover:underline">Swap ↗</a>}
              {r.error_message && <span className="text-gold-700">{r.error_message}</span>}
            </div>
            <div className="flex gap-2">
              <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="btn-ink !py-2 text-xs"><X className="h-3.5 w-3.5" /> Share</a>
              <Link href={`/${r.source_token_address}`} className="btn-primary !py-2 text-xs">Dashboard <Arrow className="h-3.5 w-3.5" /></Link>
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-mut">Holders: check everything you earned at <Link href="/wallet" className="font-semibold text-hood-700">/wallet</Link>.</p>
      </main>
      <Footer />
    </>
  );
}
