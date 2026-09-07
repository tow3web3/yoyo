import { getActivity } from '../../../../lib/queries';
import { fetchTokenMeta } from '../../../../lib/tokenMeta';
import { apiJson, apiOptions } from '../../../../lib/apiResponse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return apiOptions();
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit')) || 20, 50);
    const rows = await getActivity(limit);
    const meta = await fetchTokenMeta(rows.flatMap((r) => [r.source_token, r.reward_token]));
    return apiJson({
      events: rows.map((r) => ({
        type: r.type,
        token: r.source_token,
        tokenSymbol: meta[r.source_token]?.symbol || null,
        rewardToken: r.reward_token,
        rewardSymbol: meta[r.reward_token]?.symbol || null,
        holderCount: r.holder_count,
        airdropped: r.total_airdropped,
        claimedEth: r.claimed_eth_wei,
        time: r.ts,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return apiJson({ error: error.message }, 500);
  }
}
