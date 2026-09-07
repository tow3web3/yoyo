import { getActiveTokens, scheduleLabel } from '../../../../lib/queries';
import { fetchTokenMeta } from '../../../../lib/tokenMeta';
import { apiJson, apiOptions } from '../../../../lib/apiResponse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || '';

export function OPTIONS() {
  return apiOptions();
}

export async function GET() {
  try {
    const rows = await getActiveTokens();
    const meta = await fetchTokenMeta(rows.flatMap((r) => [r.address, r.reward_token]));
    const tokens = rows
      .map((r) => ({
        address: r.address,
        name: meta[r.address]?.name || null,
        symbol: meta[r.address]?.symbol || null,
        image: meta[r.address]?.image || null,
        marketCap: meta[r.address]?.marketCap ?? null,
        rewardToken: r.reward_token,
        rewardSymbol: meta[r.reward_token]?.symbol || null,
        rewardMode: r.reward_mode,
        basket: r.basket,
        destination: r.destination,
        scheduleKind: r.schedule_kind,
        intervalMinutes: r.interval_minutes,
        scheduleLabel: scheduleLabel(r),
        marketHoursOnly: Boolean(r.market_hours_only),
        distributions: r.distributions,
        lastExecution: r.last_execution,
        dashboardUrl: SITE ? `${SITE}/${r.address}` : `/${r.address}`,
      }))
      .sort((a, b) => (b.marketCap ?? -1) - (a.marketCap ?? -1));
    return apiJson({ count: tokens.length, tokens, timestamp: new Date().toISOString() });
  } catch (error) {
    return apiJson({ error: error.message }, 500);
  }
}
