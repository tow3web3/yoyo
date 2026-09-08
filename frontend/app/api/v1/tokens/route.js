import { getActiveTokens, scheduleLabel, getTreasuryLedger } from '../../../../lib/queries';
import { fetchTokenMeta } from '../../../../lib/tokenMeta';
import { apiJson, apiOptions } from '../../../../lib/apiResponse';
import { allYields } from '../../../../lib/yield';
import { treasurySheet } from '../../../../lib/treasury';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || '';

export function OPTIONS() {
  return apiOptions();
}

function policyOf(r) {
  let h = Number(r.split_holders_bps ?? 10000), c = Number(r.split_creator_bps ?? 0), b = Number(r.split_burn_bps ?? 0), t = Number(r.split_treasury_bps ?? 0);
  if (r.destination === 'burn' && h === 10000 && c === 0 && b === 0 && t === 0) { h = 0; b = 10000; }
  if (t > 0 && !r.treasury_address) { h += t; t = 0; }
  if (c > 0 && !r.creator_address) { h += c; c = 0; }
  return { holders: h, creator: c, burn: b, treasury: t };
}

export async function GET() {
  try {
    const rows = await getActiveTokens();
    const meta = await fetchTokenMeta(rows.flatMap((r) => [r.address, r.reward_token]));
    const yields = await allYields((a) => meta[a]?.marketCap ?? null).catch(() => ({}));

    // Treasury backing for tokens that have a treasury (cached per token inside treasurySheet).
    const backed = {};
    await Promise.all(rows.filter((r) => r.treasury_address).map(async (r) => {
      try {
        const ledger = await getTreasuryLedger(r.id);
        const sheet = await treasurySheet({ treasuryAddress: r.treasury_address, tokens: ledger.map((l) => l.token), sourceToken: r.address, marketCap: meta[r.address]?.marketCap ?? null });
        if (sheet) backed[r.address] = { totalUsd: sheet.totalUsd, backedPct: sheet.backedPct, bookValuePerToken: sheet.bookValuePerToken };
      } catch { /* skip */ }
    }));

    const tokens = rows
      .map((r) => {
        const policy = policyOf(r);
        return {
          address: r.address,
          name: meta[r.address]?.name || null,
          symbol: meta[r.address]?.symbol || null,
          image: meta[r.address]?.image || null,
          marketCap: meta[r.address]?.marketCap ?? null,
          rewardToken: r.reward_token,
          rewardSymbol: meta[r.reward_token]?.symbol || null,
          rewardMode: r.reward_mode,
          payoutMode: r.payout_mode || 'in_kind',
          basket: r.basket,
          destination: r.destination,
          policy,
          payoutRatio: policy.holders / 100,
          loyalty: r.loyalty_enabled ? { maxMultiplier: Number(r.loyalty_max_bps || 20000) / 10000, rampDays: Number(r.loyalty_ramp_days || 30) } : null,
          treasury: backed[r.address] || null,
          scheduleKind: r.schedule_kind,
          intervalMinutes: r.interval_minutes,
          scheduleLabel: scheduleLabel(r),
          marketHoursOnly: Boolean(r.market_hours_only),
          distributions: r.distributions,
          yieldApy: yields[r.address]?.apy ?? null,
          eth30d: yields[r.address]?.eth30d ?? 0,
          lastExecution: r.last_execution,
          dashboardUrl: SITE ? `${SITE}/${r.address}` : `/${r.address}`,
          badgeUrl: SITE ? `${SITE}/api/badge/${r.address}` : `/api/badge/${r.address}`,
        };
      })
      .sort((a, b) => (b.yieldApy ?? -1) - (a.yieldApy ?? -1) || (b.marketCap ?? -1) - (a.marketCap ?? -1));
    return apiJson({ count: tokens.length, tokens, timestamp: new Date().toISOString() });
  } catch (error) {
    return apiJson({ error: error.message }, 500);
  }
}
