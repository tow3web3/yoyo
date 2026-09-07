import { markClaiming } from '../../../../lib/missionQueries';
import { verifySignature } from '../../../../lib/evm';
import { claimMessage } from '../../../../lib/missionConfig';
import { EVM_ADDR } from '../../../../lib/stocks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { wallet, signature } = await request.json();
    if (!wallet || !signature || !EVM_ADDR.test(wallet)) return Response.json({ error: 'Missing fields' }, { status: 400 });
    if (!(await verifySignature({ message: claimMessage(wallet), signature, wallet }))) return Response.json({ error: 'Invalid signature' }, { status: 401 });
    const n = await markClaiming(wallet);
    if (n === 0) return Response.json({ error: 'Nothing to claim' }, { status: 409 });
    return Response.json({ ok: true, claimed: n });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
