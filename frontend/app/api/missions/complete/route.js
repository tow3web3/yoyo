import { getMission, hasCompleted, recordCompletion, hasVoted, isCustomer, getVoteCount, hasMode } from '../../../../lib/missionQueries';
import { getTokenUiBalance } from '../../../../lib/evm';
import { MIN_HOLD, BOOMERANG_TOKEN } from '../../../../lib/missionConfig';
import { EVM_ADDR } from '../../../../lib/stocks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { missionId, wallet } = await request.json();
    if (!missionId || !wallet || !EVM_ADDR.test(wallet)) return Response.json({ error: 'Missing fields' }, { status: 400 });
    if (!BOOMERANG_TOKEN) return Response.json({ error: 'Missions open once $0XDIV is live' }, { status: 503 });

    const mission = await getMission(missionId);
    if (!mission) return Response.json({ error: 'Mission not found' }, { status: 404 });
    if (await hasCompleted(missionId, wallet)) return Response.json({ error: 'Already completed' }, { status: 409 });

    const balance = await getTokenUiBalance(wallet, BOOMERANG_TOKEN);
    if (balance < MIN_HOLD) {
      return Response.json({ error: `You need at least ${MIN_HOLD.toLocaleString()} $0XDIV to earn rewards (you hold ${Math.floor(balance).toLocaleString()}).` }, { status: 403 });
    }

    let ok = false;
    let reason = '';
    if (mission.type === 'hold') {
      const min = Number(mission.params?.minAmount || 0);
      ok = balance >= min;
      reason = `Hold ${min.toLocaleString()} $0XDIV (you have ${Math.floor(balance).toLocaleString()}).`;
    } else if (mission.type === 'vote') {
      ok = await hasVoted(wallet); reason = 'Cast a vote in any Community Vote cycle first.';
    } else if (mission.type === 'customer') {
      ok = await isCustomer(wallet); reason = 'Link one of your tokens to the bot from this wallet first.';
    } else if (mission.type === 'vote_count') {
      const need = Number(mission.params?.count || 1);
      ok = (await getVoteCount(wallet)) >= need; reason = `Vote in ${need} different Community Vote cycles.`;
    } else if (mission.type === 'roulette_mode') {
      ok = await hasMode(wallet, 'roulette'); reason = 'Enable Stock Roulette on one of your tokens first.';
    } else if (mission.type === 'vote_mode') {
      ok = await hasMode(wallet, 'vote'); reason = 'Enable Community Vote on one of your tokens first.';
    } else {
      return Response.json({ error: 'Unsupported mission type' }, { status: 400 });
    }
    if (!ok) return Response.json({ error: `Not completed yet. ${reason}` }, { status: 422 });

    await recordCompletion(mission, wallet);
    return Response.json({ ok: true, missionId, rewardAmount: mission.reward_amount, rewardToken: mission.reward_token });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
