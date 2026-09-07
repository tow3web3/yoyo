import { getGlobalStats } from '../../../lib/queries';
import { STOCKS } from '../../../lib/stocks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const s = await getGlobalStats();
    return Response.json({
      totalUsers: s.totalUsers,
      activeConfigs: s.activeConfigs,
      totalExecutions: s.totalExecutions,
      totalEthClaimed: (Number(s.totalEthClaimedWei) / 1e18).toFixed(4),
      stocksAvailable: STOCKS.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
