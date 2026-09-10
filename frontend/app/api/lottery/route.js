import { sessionUser } from '../../../lib/session';
import { currentRound, pastRounds, eligibility, myEntry, LOTTERY_TOKEN } from '../../../lib/lottery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!LOTTERY_TOKEN) return Response.json({ round: null, past: [], me: null, token: null });
    const [round, past, user] = await Promise.all([currentRound(), pastRounds(), sessionUser()]);
    let me = null;
    if (user?.wallet_address) {
      me = { wallet: user.wallet_address, entry: null, eligibility: null };
      if (round) {
        const [entry, elig] = await Promise.all([myEntry(round.id, user.wallet_address), eligibility(user.wallet_address, round).catch((e) => ({ ok: false, reasons: [`Could not read your balance: ${e.message}`] }))]);
        me.entry = entry;
        me.eligibility = elig;
      }
    }
    return Response.json({ token: LOTTERY_TOKEN, round, past, me, timestamp: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
