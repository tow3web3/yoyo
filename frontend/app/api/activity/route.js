import { getActivity } from '../../../lib/queries';
import { fetchTokenMeta } from '../../../lib/tokenMeta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit')) || 20, 50);
    const rows = await getActivity(limit);
    const meta = await fetchTokenMeta(rows.flatMap((r) => [r.source_token, r.reward_token]));
    return Response.json({
      events: rows.map((r) => ({
        type: r.type,
        sourceToken: r.source_token,
        rewardToken: r.reward_token,
        holderCount: r.holder_count,
        airdropped: r.total_airdropped,
        claimedEth: r.claimed_eth_wei,
        time: r.ts,
      })),
      meta,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
