import { ImageResponse } from 'next/og';
import { getDashboard, scheduleLabel } from '../../lib/queries';
import { fetchTokenMeta } from '../../lib/tokenMeta';
import { tokenYield, fmtApy } from '../../lib/yield';
import { CARD, COLORS, loadFonts, assetLogo, siteUrl, Monogram, Wordmark } from '../../lib/og';
import { getStock, EVM_ADDR } from '../../lib/stocks';

export const runtime = 'nodejs';
export const size = { width: CARD.width, height: CARD.height };
export const contentType = 'image/png';

const MODE = { roulette: 'Stock Roulette', gainer: 'Top Gainer', portfolio: 'Portfolio', vote: 'Community Vote' };

export default async function Image({ params }) {
  const { tokenAddress } = await params;
  const site = siteUrl();
  const fonts = await loadFonts();
  const font = fonts.length ? 'Manrope' : undefined;
  const data = EVM_ADDR.test(tokenAddress) ? await getDashboard(tokenAddress).catch(() => null) : null;

  if (!data) {
    return new ImageResponse(
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: COLORS.ground, fontFamily: font, color: COLORS.ink }}>
        <Wordmark siteUrl={site} size={40} />
        <div style={{ fontSize: 40, marginTop: 30, color: COLORS.mut }}>Your fees come back as stocks.</div>
      </div>, { ...size, fonts });
  }

  const { config, stats } = data;
  const src = config.source_token_address;
  const tgt = config.target_token_address;
  const meta = await fetchTokenMeta([src, tgt]);
  const y = await tokenYield(src, meta[src]?.marketCap ?? null);
  const stock = getStock(tgt);
  const rewardSymbol = meta[tgt]?.symbol || stock?.ticker || 'ETH';
  const apy = fmtApy(y.apy);
  const srcLogo = meta[src]?.image || assetLogo(src, site);
  const rewLogo = assetLogo(tgt, site);
  const modeLabel = MODE[config.reward_mode];

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: COLORS.ground, fontFamily: font, color: COLORS.ink, padding: 56, position: 'relative' }}>
        <div style={{ position: 'absolute', top: -180, right: -140, width: 560, height: 560, borderRadius: 560, background: 'rgba(202,249,15,0.3)' }} />
        <div style={{ position: 'absolute', bottom: -220, left: 240, width: 460, height: 460, borderRadius: 460, background: 'rgba(246,195,67,0.18)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Wordmark siteUrl={site} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, color: COLORS.mut }}>
            <div style={{ width: 12, height: 12, borderRadius: 12, background: config.is_active ? COLORS.green : '#9AA39D' }} />
            {config.is_active ? 'PAYING DIVIDENDS' : 'PAUSED'} · {scheduleLabel(config).toUpperCase()}
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 40, marginTop: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {srcLogo ? <img src={srcLogo} width={72} height={72} style={{ borderRadius: 72, border: `2px solid ${COLORS.line}` }} alt="" /> : <Monogram text={meta[src]?.symbol} size={72} />}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>{meta[src]?.name || `$${meta[src]?.symbol || 'TOKEN'}`}</span>
                <span style={{ fontSize: 22, color: COLORS.mut }}>${meta[src]?.symbol || '?'} · Robinhood Chain</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 28 }}>
              <span style={{ fontSize: 30, color: COLORS.mut }}>pays dividends in</span>
              <span style={{ fontSize: 56, fontWeight: 800, letterSpacing: -2, color: COLORS.greenDeep }}>{modeLabel || rewardSymbol}</span>
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 26 }}>
              {[
                [apy ? `${apy} APY` : (y.cycles30d ? `${y.eth30d.toFixed(3)} ETH` : 'starting'), apy ? 'dividend yield' : 'last 30 days'],
                [`${stats.execution_count || 0}`, 'dividends paid'],
                [`${(Number(stats.total_eth_claimed || 0) / 1e18).toFixed(3)} ETH`, 'fees returned'],
              ].map(([v, l]) => (
                <div key={l} style={{ display: 'flex', flexDirection: 'column', background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 18, padding: '14px 22px' }}>
                  <span style={{ fontSize: 32, fontWeight: 800 }}>{v}</span>
                  <span style={{ fontSize: 15, color: COLORS.mut, letterSpacing: 1.5 }}>{l.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 280, height: 280, borderRadius: 280, background: COLORS.paper, border: `10px solid ${COLORS.green}`, boxShadow: '0 30px 80px rgba(202,249,15,0.45)' }}>
            {rewLogo && !modeLabel ? <img src={rewLogo} width={190} height={190} style={{ borderRadius: 190 }} alt="" /> : <span style={{ fontSize: 110 }}>{config.reward_mode === 'roulette' ? '🎰' : config.reward_mode === 'gainer' ? '🚀' : config.reward_mode === 'portfolio' ? '📊' : config.reward_mode === 'vote' ? '🗳️' : '📈'}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, color: COLORS.mut }}>
          <span>Your fees come back as stocks.</span>
          <span>{site.replace(/^https?:\/\//, '')}/{src.slice(0, 10)}…</span>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
