import { getCycleByToken, getSnapshotWeight, getOption, castVote } from '../../../../lib/voteQueries';
import { voteMessage, verifyVoteSignature } from '../../../../lib/verifyVote';
import { EVM_ADDR } from '../../../../lib/stocks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { token, optionId, wallet, signature } = await request.json();
    if (!token || !optionId || !wallet || !signature) return Response.json({ error: 'Missing fields' }, { status: 400 });
    if (!EVM_ADDR.test(wallet)) return Response.json({ error: 'Invalid wallet' }, { status: 400 });

    const data = await getCycleByToken(token);
    if (!data) return Response.json({ error: 'No open vote cycle' }, { status: 404 });
    const { cycle } = data;
    if (new Date(cycle.ends_at).getTime() <= Date.now()) return Response.json({ error: 'Voting has ended for this cycle' }, { status: 409 });

    const message = voteMessage({ cycleId: cycle.id, optionId, wallet });
    if (!(await verifyVoteSignature({ message, signature, wallet }))) return Response.json({ error: 'Invalid signature' }, { status: 401 });

    const option = await getOption(cycle.id, optionId);
    if (!option) return Response.json({ error: 'Invalid option' }, { status: 400 });

    const weight = await getSnapshotWeight(cycle.id, wallet);
    if (!weight || Number(weight) <= 0) return Response.json({ error: 'Not eligible: you held none of this token at snapshot' }, { status: 403 });

    await castVote(cycle.id, wallet, optionId, weight);
    return Response.json({ ok: true, cycleId: cycle.id, optionId, weight });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
