// Live list of Robinhood Chain memecoins (most traded), for the home page.
import { listMemecoins } from '../../../lib/memecoins';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const coins = await listMemecoins(12);
    return Response.json({ coins, updatedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'public, max-age=120' } });
  } catch (e) {
    return Response.json({ coins: [], error: e.message }, { status: 200 });
  }
}
