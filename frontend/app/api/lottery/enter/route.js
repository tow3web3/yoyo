import { sessionUser } from '../../../../lib/session';
import { currentRound, eligibility, enter, myEntry } from '../../../../lib/lottery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const user = await sessionUser();
    if (!user?.wallet_address) return Response.json({ error: 'Sign in with your wallet first' }, { status: 401 });
    const round = await currentRound();
    if (!round) return Response.json({ error: 'No round is open right now' }, { status: 409 });
    const existing = await myEntry(round.id, user.wallet_address);
    if (existing) return Response.json({ ok: true, entry: existing, already: true });
    const elig = await eligibility(user.wallet_address, round);
    if (!elig.ok) return Response.json({ error: elig.reasons.join(' '), eligibility: elig }, { status: 403 });
    const entry = await enter(round, elig);
    return Response.json({ ok: true, entry, eligibility: elig });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
