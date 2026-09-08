import { ImageResponse } from 'next/og';
import { getReceipt } from '../../../../../lib/queries';
import { fetchTokenMeta } from '../../../../../lib/tokenMeta';
import { CARD, COLORS, loadFonts, assetLogo, fmtUnits, siteUrl, Monogram, Wordmark } from '../../../../../lib/og';
import { getStock } from '../../../../../lib/stocks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id } = await params;
  const r = await getReceipt(id);
  if (!r) return new Response('Not found', { status: 404 });

  const site = siteUrl();
  const meta = await fetchTokenMeta([r.source_token_address, r.reward_token_used]);
  const src = meta[r.source_token_address] || {};
  const rew = meta[r.reward_token_used] || {};
  const stock = getStock(r.reward_token_used);
  const rewardSymbol = rew.symbol || stock?.ticker || 'ETH';
  const amount = fmtUnits(r.total_airdropped, rew.decimals ?? 18);
  const fonts = await loadFonts();
  const font = fonts.length ? 'Manrope' : undefined;
  const when = new Date(r.execution_time).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
  const rewardLogo = assetLogo(r.reward_token_used, site);
  const sourceLogo = src.image || assetLogo(r.source_token_address, site);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: COLORS.ground, fontFamily: font, color: COLORS.ink, padding: 56, position: 'relative' }}>
        <div style={{ position: 'absolute', top: -160, right: -120, width: 520, height: 520, borderRadius: 520, background: 'rgba(202,249,15,0.3)' }} />
        <div style={{ position: 'absolute', bottom: -200, left: 200, width: 460, height: 460, borderRadius: 460, background: 'rgba(246,195,67,0.18)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Wordmark siteUrl={site} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, color: COLORS.mut }}>
            <div style={{ width: 12, height: 12, borderRadius: 12, background: COLORS.green }} />
            DIVIDEND PAID · {when} ET
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 48, marginTop: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 24, color: COLORS.mut }}>
              {sourceLogo ? <img src={sourceLogo} width={40} height={40} style={{ borderRadius: 40 }} alt="" /> : <Monogram text={src.symbol} size={40} />}
              <span>Holders of <b style={{ color: COLORS.ink }}>${src.symbol || 'TOKEN'}</b> received</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 8 }}>
              <span style={{ fontSize: 112, fontWeight: 800, letterSpacing: -4, color: COLORS.greenDeep, lineHeight: 1 }}>{amount}</span>
              <span style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2 }}>{rewardSymbol}</span>
            </div>
            <div style={{ fontSize: 26, color: COLORS.mut, marginTop: 6 }}>{stock ? `${stock.name} · Robinhood Stock Token` : rew.name || 'on Robinhood Chain'}</div>

            <div style={{ display: 'flex', gap: 14, marginTop: 34 }}>
              {[
                [`${r.paid_count || r.holder_count}`, 'wallets paid'],
                [`${fmtUnits(r.claimed_eth_wei, 18, 4)} ETH`, 'from fees'],
                [r.loyalty_enabled ? 'loyalty' : 'pro-rata', 'weighting'],
              ].map(([v, l]) => (
                <div key={l} style={{ display: 'flex', flexDirection: 'column', background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 18, padding: '14px 22px' }}>
                  <span style={{ fontSize: 30, fontWeight: 800 }}>{v}</span>
                  <span style={{ fontSize: 15, color: COLORS.mut, letterSpacing: 1.5 }}>{l.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 300, height: 300, borderRadius: 300, background: COLORS.paper, border: `10px solid ${COLORS.green}`, boxShadow: '0 30px 80px rgba(202,249,15,0.45)' }}>
            {rewardLogo ? <img src={rewardLogo} width={200} height={200} style={{ borderRadius: 200 }} alt="" /> : <Monogram text={rewardSymbol} size={200} />}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, color: COLORS.mut }}>
          <span>Your fees come back as stocks.</span>
          <span>{site.replace(/^https?:\/\//, '')}/receipt/{r.id}</span>
        </div>
      </div>
    ),
    { ...CARD, fonts, headers: { 'Cache-Control': 'public, max-age=3600' } }
  );
}
