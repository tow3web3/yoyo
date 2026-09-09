'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PerformanceChart from '../../components/PerformanceChart';
import Navigation from '../../components/Navigation';
import TickerTape from '../../components/TickerTape';
import Footer from '../../components/Footer';
import StockLogo from '../../components/StockLogo';
import Countdown from '../../components/Countdown';
import { Coins, Bolt, Swap, Gift, Arrow, Users, Copy, Check } from '../../components/Icons';
import { describeAddress, explorerTx, explorerToken, explorerAddress } from '../../lib/stocks';

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
const fmt = (n) => new Intl.NumberFormat('en-US').format(n || 0);
const compact = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n || 0);
const eth = (wei, d = 4) => (Number(wei || 0) / 1e18).toFixed(d);
const units = (raw, decimals) => Number(raw || 0) / 10 ** Number(decimals ?? 18);

const MODE = {
  fixed: null,
  roulette: { label: 'Stock Roulette', emoji: '🎰', hint: 'a random liquid stock each cycle' },
  gainer: { label: 'Top Gainer', emoji: '🚀', hint: "the day's best stock" },
  portfolio: { label: 'Portfolio', emoji: '📊', hint: 'rotating through a basket' },
  vote: { label: 'Community Vote', emoji: '🗳️', hint: 'holders pick the reward' },
};

export default function TokenDashboard() {
  const params = useParams();
  const tokenAddress = params.tokenAddress;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const copyCA = async () => {
    try { await navigator.clipboard.writeText(tokenAddress); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/dashboard/${tokenAddress}`);
        if (!response.ok) throw new Error('Token not found or not active');
        setData(await response.json());
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [tokenAddress]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="panel px-10 py-12 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-hood-500" />
          <p className="text-sm font-medium text-ink">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="panel max-w-md px-8 py-10 text-center">
          <h1 className="font-display text-xl font-bold text-ink">Token not found</h1>
          <p className="mt-2 text-sm text-mut">This token doesn't have an active yo-yo configuration yet.</p>
          <Link href="/" className="btn-primary mt-6">Go home <Arrow className="h-4 w-4" /></Link>
        </div>
      </div>
    );
  }

  const src = data.sourceToken;
  const tgt = data.targetToken;
  const reward = describeAddress(tgt.address, tgt);
  const mode = MODE[data.config.rewardMode];
  const rewardDecimals = Number(tgt.decimals ?? 18);
  const ethClaimed = eth(data.stats.totalEthClaimed);
  const quote = tgt.quote;

  const STATS = [
    { Icon: Coins, label: 'Fees turned into dividends', value: `${ethClaimed} ETH`, accent: true },
    { Icon: Bolt, label: 'Dividend cycles', value: fmt(data.stats.totalExecutions) },
    { Icon: Users, label: 'Holders indexed', value: fmt(data.stats.holderCount) },
    { Icon: Gift, label: mode ? 'Paid out (all rewards)' : `Paid out in ${reward.symbol}`, value: mode ? fmt(data.stats.totalExecutions) + ' drops' : compact(units(data.stats.totalAirdropped, rewardDecimals)) },
  ];

  return (
    <>
      <TickerTape />
      <Navigation />
      <main className="mx-auto max-w-6xl px-5 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <StockLogo address={src.address} meta={src} size="h-12 w-12" text="text-xs" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h1 className="font-display text-xl font-extrabold tracking-tight text-ink">{src.name || `$${src.symbol || short(src.address)}`}</h1>
                {src.symbol && <span className="font-mono text-sm font-medium text-mut">${src.symbol}</span>}
                {src.marketCap ? <span className="rounded-full bg-hood-100 px-2 py-0.5 text-[11px] font-semibold text-hood-700">MC ${compact(src.marketCap)}</span> : null}
              </div>
              <button onClick={copyCA} title="Copy contract address" className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs text-mut transition hover:text-ink">
                {short(src.address)}
                {copied ? <Check className="h-3.5 w-3.5 text-hood-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`chip ${data.config.isActive ? 'text-hood-700' : 'text-mut'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${data.config.isActive ? 'bg-hood-500' : 'bg-mut'}`} />
              {data.config.isActive ? 'Active' : 'Paused'} · {data.config.scheduleLabel}
            </span>
            {data.yield?.apy ? (
              <span className="chip-gold" title={`${data.yield.eth30d.toFixed(4)} ETH returned over the last ${data.yield.windowDays} days, annualized against market cap`}>
                📈 {data.yield.apy >= 100 ? Math.round(data.yield.apy) : data.yield.apy >= 10 ? data.yield.apy.toFixed(1) : data.yield.apy.toFixed(2)}% dividend yield
              </span>
            ) : data.yield?.cycles30d ? <span className="chip">{data.yield.eth30d.toFixed(4)} ETH returned / 30d</span> : null}
            {data.config.marketHoursOnly && <span className="chip">🕰️ Market hours only</span>}
            {data.config.destination === 'burn' && <span className="chip border-orange-200 bg-orange-50 text-orange-700">🔥 Buyback and burn</span>}
            {data.config.rewardMode === 'vote' && (
              <Link href="/vote" className="btn-primary px-3 py-1.5 text-xs">Vote now <Arrow className="h-3.5 w-3.5" /></Link>
            )}
            <a href={explorerToken(src.address)} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3 py-1.5 text-xs">Blockscout <Arrow className="h-3.5 w-3.5" /></a>
          </div>
        </div>

        {/* Reward card */}
        <div className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_2fr]">
          <div className={`${reward.isStock ? 'panel-gold' : 'panel-glow'} flex items-center gap-4 p-5`}>
            <StockLogo address={tgt.address} meta={tgt} size="h-14 w-14" text="text-sm" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-mut">{mode ? `${mode.emoji} ${mode.label}` : 'Dividends paid in'}</div>
              {mode ? (
                <>
                  <div className="font-display text-xl font-extrabold text-ink">{mode.hint}</div>
                  {data.config.basket && <div className="mt-0.5 font-mono text-xs text-mut">{data.config.basket.label}: {data.config.basket.tickers?.join(' > ')}</div>}
                  <div className="mt-0.5 text-xs text-mut">Fallback reward: <span className="font-mono font-semibold text-ink">{reward.symbol}</span></div>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-2xl font-extrabold text-ink">{reward.symbol}</span>
                    <span className="truncate text-sm text-mut">{reward.name}</span>
                  </div>
                  {quote ? (
                    <div className="mt-0.5 flex items-center gap-2 font-mono text-sm">
                      <span className="text-ink">${quote.price.toFixed(2)}</span>
                      {typeof quote.changePct === 'number' && (
                        <span className={quote.changePct >= 0 ? 'up' : 'dn'}>{quote.changePct >= 0 ? '▲' : '▼'} {Math.abs(quote.changePct).toFixed(2)}%</span>
                      )}
                      <span className="text-xs text-mut">Yahoo Finance</span>
                    </div>
                  ) : reward.isStock ? null : (
                    <div className="mt-0.5 font-mono text-xs text-mut">{short(tgt.address)}</div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {STATS.map(({ Icon, label, value, accent }) => (
              <div key={label} className="panel p-4">
                <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-tile text-hood-700"><Icon className="h-4 w-4" /></span>
                <p className={`figure font-display text-xl font-extrabold tracking-tight ${accent ? 'text-hood-700' : 'text-ink'}`}>{value}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-mut">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Fee split + balance sheet */}
        {data.config.split && (
          <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <div className="panel p-5">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-mut">Dividend policy</h3>
              <p className="mb-3 text-[11px] text-mut">{data.config.payoutMode === 'convert' ? 'Stock fees converted to the reward before payout.' : 'Stock fees paid in kind: what the launchpad pays, holders receive.'}</p>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-tile">
                <div className="bg-hood-500" style={{ width: `${data.config.split.holders / 100}%` }} title="holders" />
                <div className="bg-ink" style={{ width: `${(data.config.split.creator || 0) / 100}%` }} title="creator" />
                <div className="bg-orange-500" style={{ width: `${data.config.split.burn / 100}%` }} title="burn" />
                <div className="bg-gold-400" style={{ width: `${data.config.split.treasury / 100}%` }} title="treasury" />
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                {[['Payout ratio', data.config.split.holders, 'bg-hood-500'], ['Creator', data.config.split.creator || 0, 'bg-ink'], ['Buyback', data.config.split.burn, 'bg-orange-500'], ['Retained', data.config.split.treasury, 'bg-gold-400']].map(([l, v, c]) => (
                  <div key={l}>
                    <div className="mx-auto mb-1 h-1.5 w-6 rounded-full" style={{}}><span className={`block h-full w-full rounded-full ${c}`} /></div>
                    <div className="figure font-display text-xl font-extrabold text-ink">{v / 100}%</div>
                    <div className="text-[10px] uppercase tracking-wider text-mut">{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {data.treasury ? (
              <div className="panel-gold p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gold-700">🏦 Balance sheet</h3>
                    <div className="figure font-display text-3xl font-extrabold text-ink">${data.treasury.totalUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                    <a href={explorerAddress(data.treasury.treasuryAddress)} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-mut hover:text-ink">{short(data.treasury.treasuryAddress)} ↗</a>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-right">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-mut">Book value / token</div>
                      <div className="figure text-sm font-bold text-ink">{data.treasury.bookValuePerToken != null ? `$${data.treasury.bookValuePerToken < 0.01 ? data.treasury.bookValuePerToken.toExponential(2) : data.treasury.bookValuePerToken.toFixed(4)}` : '-'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-mut">Backed</div>
                      <div className={`figure text-sm font-bold ${data.treasury.backedPct != null && data.treasury.backedPct >= 100 ? 'text-hood-700' : 'text-ink'}`}>{data.treasury.backedPct != null ? `${data.treasury.backedPct.toFixed(1)}% of mcap` : '-'}</div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {data.treasury.holdings.length === 0 && <div className="text-sm text-mut">Treasury is empty so far. The next cycle starts filling it.</div>}
                  {data.treasury.holdings.map((h) => (
                    <div key={h.address} className="flex items-center justify-between rounded-lg border border-line/70 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <StockLogo address={h.address} meta={{ symbol: h.symbol }} size="h-7 w-7" text="text-[8px]" />
                        <div>
                          <div className="font-mono text-sm font-semibold text-ink">{h.symbol}</div>
                          <div className="text-[11px] text-mut">{h.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="figure text-sm font-semibold text-ink">{h.amount < 1 ? h.amount.toFixed(4) : h.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                        <div className="figure text-[11px] text-mut">${h.usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}{typeof h.changePct === 'number' ? <span className={h.changePct >= 0 ? ' up' : ' dn'}> {h.changePct >= 0 ? '▲' : '▼'}{Math.abs(h.changePct).toFixed(1)}%</span> : null}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="panel flex items-center p-5 text-sm text-mut">No treasury address set. The creator can route a share of fees into a stock treasury from Telegram (Settings, Fee split).</div>
            )}
          </div>
        )}

        {/* Chart + side */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="panel p-6 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Fees paid out per cycle</h2>
              <span className="text-xs text-mut">in ETH, last {data.recentExecutions.length} cycles</span>
            </div>
            {data.recentExecutions.length > 0 ? (
              <PerformanceChart data={data.recentExecutions} />
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-mut">No dividend yet. The first cycle is coming.</div>
            )}
          </div>

          <div className="panel p-6">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-mut">Next dividend</h3>
            <div className="space-y-4">
              {data.config.isActive && (
                <div>
                  <p className="text-xs text-mut">Countdown</p>
                  <p className="figure font-display text-3xl font-extrabold text-hood-700"><Countdown intervalMinutes={data.config.intervalMinutes} scheduleKind={data.config.scheduleKind} /></p>
                </div>
              )}
              <div><p className="text-xs text-mut">Schedule</p><p className="text-sm font-medium text-ink">{data.config.scheduleLabel}{data.config.marketHoursOnly ? ', market hours only' : ''}</p></div>
              <div><p className="text-xs text-mut">Fee source</p><p className="text-sm font-medium text-ink">{data.config.feeSource === 'univ3' ? 'Uniswap V3 LP fees' : 'Dev wallet balance (ETH)'}</p></div>
              <div>
                <p className="text-xs text-mut">🏅 Loyalty weighting</p>
                {data.config.loyalty?.enabled ? (
                  <p className="text-sm font-medium text-ink">
                    1x to {data.config.loyalty.maxMultiplier.toFixed(1)}x over {data.config.loyalty.rampDays} days
                    {data.config.loyalty.minHoldHours > 0 ? `, min hold ${data.config.loyalty.minHoldHours}h` : ''}
                    {data.config.loyalty.sellReset ? ', selling resets the clock' : ''}
                  </p>
                ) : (
                  <p className="text-sm font-medium text-mut">off, weight = balance</p>
                )}
              </div>
              <div className="border-t border-line pt-4"><p className="text-xs text-mut">Last dividend</p><p className="text-sm font-medium text-ink">{data.stats.lastExecution ? new Date(data.stats.lastExecution).toLocaleString() : 'Never'}</p></div>
              <div><p className="text-xs text-mut">Bought back</p><p className="figure text-sm font-medium text-ink">{mode ? '(varies per cycle)' : `${compact(units(data.stats.totalBoughtBack, rewardDecimals))} ${reward.symbol}`}</p></div>
            </div>
          </div>
        </div>

        {/* Recipients + activity */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="panel p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Top recipients</h2>
              <span className="text-xs text-mut">by dividends received</span>
            </div>
            <div className="space-y-1.5">
              {data.topRecipients.map((r, i) => (
                <a key={r.address} href={explorerAddress(r.address)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-lg border border-line/70 px-3 py-2.5 transition hover:border-hood-300">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-tile text-xs font-semibold text-hood-700">{i + 1}</span>
                    <span className="font-mono text-sm text-ink">{short(r.address)}</span>
                  </div>
                  <div className="text-right">
                    <p className="figure text-sm font-semibold text-ink">{compact(units(r.totalReceived, r.rewardDecimals ?? rewardDecimals))} {r.rewardSymbol || reward.symbol}</p>
                    <p className="text-xs text-mut">
                      {r.airdropCount} dividends
                      {r.heldDays != null ? ` · holding ${r.heldDays < 1 ? `${Math.max(1, Math.round(r.heldDays * 24))}h` : `${Math.floor(r.heldDays)}d`}` : ''}
                    </p>
                  </div>
                </a>
              ))}
              {data.topRecipients.length === 0 && <div className="py-12 text-center text-sm text-mut">No dividends yet</div>}
            </div>
          </div>

          <div className="panel p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Dividend history</h2>
              <span className="text-xs text-mut">{data.recentExecutions.length} cycles</span>
            </div>
            <div className="space-y-1.5">
              {data.recentExecutions.slice(0, 12).map((e) => {
                const r = describeAddress(e.rewardToken, { symbol: e.rewardSymbol });
                return (
                  <div key={e.id} className="rounded-lg border border-line/70 px-3 py-2.5">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs text-mut">{new Date(e.executionTime).toLocaleString()}</span>
                      <span className="figure text-xs font-semibold text-hood-700">{eth(e.claimedEth)} ETH</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-mut">
                      <span className="flex items-center gap-1.5">
                        <StockLogo address={e.rewardToken} meta={{ symbol: e.rewardSymbol }} size="h-4 w-4" text="text-[6px]" />
                        <span className="figure">{compact(units(e.totalAirdropped, e.rewardDecimals ?? rewardDecimals))} {r.symbol}</span>
                        {e.destination === 'burn' ? <span>burned</span> : <span>to {e.holderCount} holders</span>}
                        {e.note && <span className="text-gold-700" title={e.note}>· note</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        <Link href={`/receipt/${e.id}`} className="font-medium text-hood-700 hover:underline">receipt</Link>
                        {e.swapTx && <a href={explorerTx(e.swapTx)} target="_blank" rel="noopener noreferrer" className="font-medium text-mut hover:underline">swap ↗</a>}
                        {e.txHash && <a href={explorerTx(e.txHash)} target="_blank" rel="noopener noreferrer" className="font-medium text-hood-700 hover:underline">payout ↗</a>}
                      </span>
                    </div>
                  </div>
                );
              })}
              {data.recentExecutions.length === 0 && <div className="py-12 text-center text-sm text-mut">No cycles yet</div>}
            </div>
          </div>
        </div>

        <div className="panel mt-6 flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold text-ink">Embed the yield badge</div>
            <div className="text-xs text-mut">Live SVG for your README, website or X bio link. Add <span className="font-mono">?style=reward</span> for the reward badge.</div>
          </div>
          <div className="flex items-center gap-3">
            <img src={`/api/badge/${tokenAddress}`} alt="dividend yield badge" className="h-[22px]" />
            <code className="rounded-md bg-tile px-2 py-1 font-mono text-[11px] text-ink">{`${typeof window !== 'undefined' ? window.location.origin : ''}/api/badge/${tokenAddress}`}</code>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-mut">
          <span>Robinhood Chain (4663)</span>
          <span>·</span>
          <span>Updated {new Date(data.timestamp).toLocaleTimeString()}</span>
        </div>
      </main>
      <Footer />
    </>
  );
}
