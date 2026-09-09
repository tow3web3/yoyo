// Tokens created or held by a wallet, for the setup flow: ?wallet=0x…
import { sessionUser } from '../../../../lib/session';
import { discoverTokens } from '../../../../lib/discover';
import { EVM_ADDR } from '../../../../lib/stocks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const user = await sessionUser();
  if (!user) return Response.json({ error: 'Not logged in' }, { status: 401 });
  const wallet = new URL(request.url).searchParams.get('wallet') || user.wallet_address;
  if (!EVM_ADDR.test(wallet || '')) return Response.json({ error: 'Invalid wallet' }, { status: 400 });
  try {
    return Response.json(await discoverTokens(wallet));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
