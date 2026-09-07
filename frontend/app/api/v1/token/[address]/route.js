import { getDashboard, scheduleLabel } from '../../../../../lib/queries';
import { fetchTokenMeta } from '../../../../../lib/tokenMeta';
import { apiJson, apiOptions } from '../../../../../lib/apiResponse';
import { EVM_ADDR } from '../../../../../lib/stocks';
import { tokenYield } from '../../../../../lib/yield';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || '';

export function OPTIONS() {
  return apiOptions();
}

export async function GET(request, { params }) {
  try {
    const { address } = await params;
    if (!EVM_ADDR.test(address)) return apiJson({ error: 'Invalid address' }, 400);
    const data = await getDashboard(address);
    if (!data) return apiJson({ linked: false, address });

    const { config, stats, topRecipients, recentExecutions, holderCount } = data;
    const meta = await fetchTokenMeta([config.target_token_address, config.source_token_address]);
    const y = await tokenYield(config.source_token_address, meta[config.source_token_address]?.marketCap ?? null).catch(() => null);
    return apiJson({
      linked: true,
      address: config.source_token_address,
      rewardToken: config.target_token_address,
      rewardSymbol: meta[config.target_token_address]?.symbol || null,
      rewardMode: config.reward_mode,
      basket: config.basket,
      destination: config.destination,
      split: { holders: Number(config.split_holders_bps ?? 10000), burn: Number(config.split_burn_bps ?? 0), treasury: Number(config.split_treasury_bps ?? 0) },
      treasuryAddress: config.treasury_address || null,
      schedule: scheduleLabel(config),
      marketHoursOnly: Boolean(config.market_hours_only),
      active: config.is_active,
      yield: y ? { apy: y.apy, eth30d: y.eth30d, usd30d: y.usd30d, cycles30d: y.cycles30d, windowDays: y.windowDays } : null,
      badge: SITE ? `${SITE}/api/badge/${config.source_token_address}` : undefined,
      stats: {
        feesUsedEth: (Number(stats.total_eth_claimed) / 1e18).toFixed(4),
        dividends: stats.execution_count || 0,
        boughtBack: stats.total_bought_back || '0',
        airdropped: stats.total_airdropped || '0',
        holdersPaid: topRecipients.length,
        holdersIndexed: holderCount,
        lastExecution: stats.last_execution,
      },
      recentExecutions: recentExecutions.slice(0, 10).map((e) => ({
        claimedEth: e.claimed_eth_wei, airdropped: e.total_airdropped, holderCount: e.holder_count, rewardToken: e.reward_token_used, time: e.execution_time, status: e.status, tx: e.tx_hash,
      })),
      dashboardUrl: SITE ? `${SITE}/${config.source_token_address}` : undefined,
    });
  } catch (error) {
    return apiJson({ error: error.message }, 500);
  }
}
