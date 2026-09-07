import { listMissions, getCompletions, getClaimable, touchUser, getTotalXp } from '../../../lib/missionQueries';
import { getTokenUiBalance } from '../../../lib/evm';
import { MIN_HOLD, BOOMERANG_TOKEN } from '../../../lib/missionConfig';
import { EVM_ADDR } from '../../../lib/stocks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const wallet = new URL(request.url).searchParams.get('wallet');
    const missions = await listMissions();

    let balance = null;
    let eligible = false;
    let completions = [];
    let claimable = [];
    let totalXp = 0;
    let missionsDone = 0;
    let firstSeen = null;
    if (wallet && EVM_ADDR.test(wallet)) {
      if (BOOMERANG_TOKEN) {
        try { balance = await getTokenUiBalance(wallet, BOOMERANG_TOKEN); } catch { balance = null; }
      }
      eligible = balance !== null && balance >= MIN_HOLD;
      completions = await getCompletions(wallet);
      claimable = await getClaimable(wallet);
      const xp = await getTotalXp(wallet);
      totalXp = xp.xp;
      missionsDone = xp.done;
      firstSeen = await touchUser(wallet);
    }
    const statusByMission = Object.fromEntries(completions.map((c) => [c.mission_id, c.status]));

    return Response.json({
      minHold: MIN_HOLD,
      tokenConfigured: Boolean(BOOMERANG_TOKEN),
      wallet: wallet || null,
      boomerangBalance: balance,
      eligible,
      totalXp,
      missionsDone,
      totalMissions: missions.length,
      firstSeen,
      claimable: claimable.map((c) => ({ token: c.reward_token, amount: c.amount, count: c.n })),
      missions: missions.map((m) => ({
        id: m.id, slug: m.slug, title: m.title, description: m.description, type: m.type, params: m.params, xp: m.xp,
        rewardToken: m.reward_token, rewardAmount: m.reward_amount,
        budgetLeft: (BigInt(m.total_budget) - BigInt(m.spent)).toString(),
        status: statusByMission[m.id] || null,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
