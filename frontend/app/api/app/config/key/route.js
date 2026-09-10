// Reveal the dev wallet private key to its owner. The session alone is not
// enough: the creator signs a fresh message with the same wallet that logged
// in, so a stolen cookie cannot pull the key.
import { verifySignature } from '../../../../../lib/evm';
import { consumeNonce, getConfigForUser } from '../../../../../lib/appQueries';
import { revealMessage, sessionUser } from '../../../../../lib/session';
import { decryptPrivateKey } from '../../../../../lib/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const user = await sessionUser();
    if (!user) return Response.json({ error: 'Not logged in' }, { status: 401 });
    const config = await getConfigForUser(user.id);
    if (!config) return Response.json({ error: 'No policy yet' }, { status: 404 });
    const { nonce, issuedAt, signature } = await request.json();
    if (!nonce || !issuedAt || !signature) return Response.json({ error: 'Sign the request with your wallet to reveal the key' }, { status: 400 });
    if (Math.abs(Date.now() - new Date(issuedAt).getTime()) > 5 * 60_000) return Response.json({ error: 'Request expired, try again' }, { status: 400 });
    const message = revealMessage({ wallet: String(user.wallet_address).toLowerCase(), devWallet: String(config.dev_wallet_public).toLowerCase(), nonce, issuedAt });
    if (!(await verifySignature({ message, signature, wallet: user.wallet_address }))) return Response.json({ error: 'Signature does not match the wallet you signed in with' }, { status: 401 });
    if (!(await consumeNonce(nonce))) return Response.json({ error: 'Nonce already used, try again' }, { status: 400 });
    const privateKey = decryptPrivateKey(config.dev_wallet_encrypted);
    return Response.json({ ok: true, address: config.dev_wallet_public, privateKey });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
