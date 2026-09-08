import { ImageResponse } from 'next/og';
import { CARD, COLORS, loadFonts, siteUrl, Wordmark } from '../lib/og';

export const runtime = 'nodejs';
export const size = { width: CARD.width, height: CARD.height };
export const contentType = 'image/png';

export default async function Image() {
  const site = siteUrl();
  const fonts = await loadFonts();
  const font = fonts.length ? 'Manrope' : undefined;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: COLORS.ink, color: '#fff', fontFamily: font, padding: 64, position: 'relative' }}>
        <div style={{ position: 'absolute', right: -60, top: 40, width: 520, height: 520, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={`${site}/brand/boomerang-256.png`} width={480} height={480} alt="" />
        </div>
        <Wordmark siteUrl={site} size={32} />
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 680 }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 76, fontWeight: 800, lineHeight: 1, letterSpacing: -3 }}><span>Give your memecoin</span><span style={{ color: COLORS.green }}>a dividend policy.</span></div>
          <span style={{ fontSize: 26, color: '#9AA39D', marginTop: 22 }}>Launchpads on Robinhood Chain pay you in real stocks. Payout ratio, buybacks, treasury, record date: NVDA fees become NVDA dividends.</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, color: '#9AA39D' }}>
          <span>195 Robinhood Stock Tokens · Uniswap V4 · Telegram or web dashboard</span>
          <span>{site.replace(/^https?:\/\//, '')}</span>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
