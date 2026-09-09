// Shared bits for the server-rendered cards (receipts, wallet statements, token
// OG images). Rendered with next/og (Satori): flex layouts only, absolute image
// URLs, fonts passed in as buffers.
import fs from 'fs';
import path from 'path';
import { STOCK_BY_ADDRESS, isNative } from './stocks';

export const CARD = { width: 1200, height: 630 };
export const COLORS = { green: '#CAF90F', greenDeep: '#6E8C06', gold: '#F6C343', ink: '#0B0F0C', mut: '#5C6660', line: '#E5EBE6', paper: '#FFFFFF', ground: '#F6F8F6' };

let fontCache = null;
/** Manrope 800 as a TTF buffer (Satori needs TTF/OTF/WOFF, never woff2). Falls back to the default font. */
export async function loadFonts() {
  if (fontCache) return fontCache;
  try {
    const css = await fetch('https://fonts.googleapis.com/css2?family=Manrope:wght@800&display=swap', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0' },
      signal: AbortSignal.timeout(6000),
    }).then((r) => r.text());
    const url = css.match(/src: url\(([^)]+)\) format\('(?:truetype|woff)'\)/)?.[1];
    if (!url) throw new Error('no ttf url');
    const data = await fetch(url, { signal: AbortSignal.timeout(6000) }).then((r) => r.arrayBuffer());
    fontCache = [{ name: 'Manrope', data, weight: 800, style: 'normal' }];
  } catch {
    fontCache = [];
  }
  return fontCache;
}

export function assetLogo(address, siteUrl) {
  if (isNative(address)) return `${siteUrl}/eth.svg`;
  const s = STOCK_BY_ADDRESS[String(address || '').toLowerCase()];
  if (s) return `https://assets.parqet.com/logos/symbol/${s.ticker}?format=png&size=128`;
  return address ? `https://dd.dexscreener.com/ds-data/tokens/robinhood/${address}.png?size=lg` : null;
}

export const fmtUnits = (raw, decimals = 18, digits = 4) => {
  const n = Number(raw || 0) / 10 ** Number(decimals ?? 18);
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return n.toFixed(n >= 1 ? 2 : digits);
};

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://boomerang.fun').replace(/\/$/, '');
}

/** Monogram fallback when a logo cannot be fetched (Satori renders nothing for a broken img). */
export function Monogram({ text, color = COLORS.greenDeep, size = 96 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size, background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.3, fontWeight: 800 }}>
      {String(text || '?').slice(0, 4)}
    </div>
  );
}

/** The yo-yo as a data URL: Satori cannot always fetch the site from inside the server. */
let logoData = null;
export function logoUrl(site) {
  if (logoData) return logoData;
  for (const p of [path.join(process.cwd(), 'public', 'brand', 'boom-256.png'), path.join(process.cwd(), 'frontend', 'public', 'brand', 'boom-256.png')]) {
    try { logoData = 'data:image/png;base64,' + fs.readFileSync(p).toString('base64'); return logoData; } catch { /* next */ }
  }
  return `${site}/brand/yoyo-256.png`;
}

export function Wordmark({ siteUrl: site, size = 28, color = COLORS.ink }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <img src={logoUrl(site)} width={size + 8} height={size + 8} alt="" />
      <span style={{ fontSize: size, fontWeight: 800, letterSpacing: -0.5, color }}>Yoyo</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: COLORS.greenDeep, border: `1px solid ${COLORS.green}55`, background: '#EBFCEB', borderRadius: 999, padding: '3px 10px', letterSpacing: 1.5 }}>ROBINHOOD CHAIN</span>
    </div>
  );
}
