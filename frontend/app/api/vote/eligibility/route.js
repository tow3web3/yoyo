import { getEligibility } from '../../../../lib/voteQueries';
import { fetchTokenMeta } from '../../../../lib/tokenMeta';
import { EVM_ADDR } from '../../../../lib/stocks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const wallet = new URL(request.url).searchParams.get('wallet');
    if (!wallet || !EVM_ADDR.test(wallet)) return Response.json({ error: 'wallet required' }, { status: 400 });
    const rows = await getEligibility(wallet);
    const meta = await fetchTokenMeta(rows.map((r) => r.token));
    return Response.json({
      wallet,
      eligible: rows.map((r) => ({
        token: r.token,
        name: meta[r.token]?.name || null,
        symbol: meta[r.token]?.symbol || null,
        image: meta[r.token]?.image || null,
        cycleId: r.cycle_id,
        endsAt: r.ends_at,
        weight: r.weight,
        votedOptionId: r.voted_option_id,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
