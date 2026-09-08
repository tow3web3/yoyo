// Embeddable badge: <img src="https://.../api/badge/0x..."> shows the token's
// dividend yield the way shields.io shows a build status. SVG, cached 5 minutes.
import { getDashboard } from '../../../../lib/queries';
import { fetchTokenMeta } from '../../../../lib/tokenMeta';
import { tokenYield, fmtApy } from '../../../../lib/yield';
import { EVM_ADDR } from '../../../../lib/stocks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const textWidth = (s) => Math.round([...String(s)].reduce((w, ch) => w + (/[A-Z0-9%$]/.test(ch) ? 7.6 : /[il.,' ]/.test(ch) ? 3.4 : 6.6), 0));

function badge(left, right, color) {
  const lw = textWidth(left) + 20;
  const rw = textWidth(right) + 20;
  const w = lw + rw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="22" role="img" aria-label="${esc(left)}: ${esc(right)}">
<title>${esc(left)}: ${esc(right)}</title>
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${w}" height="22" rx="4" fill="#fff"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="22" fill="#0B0F0C"/><rect x="${lw}" width="${rw}" height="22" fill="${color}"/><rect width="${w}" height="22" fill="url(#s)"/></g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" font-weight="700">
<text x="${lw / 2}" y="15" fill="#fff" fill-opacity=".95">🪃 ${esc(left)}</text>
<text x="${lw + rw / 2}" y="15" fill="${color === '#F6C343' ? '#0B0F0C' : '#0B0F0C'}">${esc(right)}</text>
</g></svg>`;
}

export async function GET(request, { params }) {
  const { address } = await params;
  const headers = { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' };
  if (!EVM_ADDR.test(address)) return new Response(badge('boomerang', 'invalid address', '#FF5000'), { status: 400, headers });
  const style = new URL(request.url).searchParams.get('style') || 'yield';
  try {
    const data = await getDashboard(address);
    if (!data) return new Response(badge('boomerang', 'not linked', '#9AA39D'), { headers });
    const meta = await fetchTokenMeta([address, data.config.target_token_address]);
    const y = await tokenYield(address, meta[address.toLowerCase()]?.marketCap ?? null);
    if (style === 'reward') {
      const sym = meta[data.config.target_token_address]?.symbol || 'stocks';
      return new Response(badge('dividends in', sym, '#CAF90F'), { headers });
    }
    const apy = fmtApy(y.apy);
    if (!apy) return new Response(badge('dividend yield', y.cycles30d > 0 ? `${y.eth30d.toFixed(3)} ETH / 30d` : 'starting', '#F6C343'), { headers });
    return new Response(badge('dividend yield', `${apy} APY`, '#CAF90F'), { headers });
  } catch (e) {
    return new Response(badge('boomerang', 'unavailable', '#9AA39D'), { status: 500, headers });
  }
}
