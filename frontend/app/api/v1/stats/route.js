import { getGlobalStats } from '../../../../lib/queries';
import { apiJson, apiOptions } from '../../../../lib/apiResponse';
import { STOCKS } from '../../../../lib/stocks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return apiOptions();
}

export async function GET() {
  try {
    const s = await getGlobalStats();
    return apiJson({
      ethPaidOut: (Number(s.totalEthClaimedWei) / 1e18).toFixed(4),
      dividends: s.totalExecutions,
      activeBots: s.activeConfigs,
      creators: s.totalUsers,
      stocksAvailable: STOCKS.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return apiJson({ error: error.message }, 500);
  }
}
