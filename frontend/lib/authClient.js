// Browser-side sign in: nonce, wallet signature, session cookie. Shared by the
// login screen and the wallet menu (switch account).
export const LOGIN_TEXT = (addr, nonce, issuedAt) => `yo-yo dashboard login\nChain: Robinhood Chain (4663)\nWallet: ${addr}\nNonce: ${nonce}\nIssued: ${issuedAt}\n\nThis signature costs no gas and only proves you own this wallet.`;

export async function signIn(wallet, addr) {
  const n = await fetch('/api/app/auth/nonce', { cache: 'no-store' }).then((r) => r.json());
  if (!n?.nonce || !n?.issuedAt) throw new Error(n?.error || 'Could not get a login nonce. Reload and try again.');
  const signature = await wallet.signMessage(LOGIN_TEXT(addr, n.nonce, n.issuedAt), addr);
  const res = await fetch('/api/app/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet: addr, nonce: n.nonce, issuedAt: n.issuedAt, signature }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function signOut() {
  await fetch('/api/app/auth/logout', { method: 'POST' });
}

export const REVEAL_TEXT = (addr, devWallet, nonce, issuedAt) => `yo-yo: reveal my dev wallet private key\nDev wallet: ${devWallet}\nSigned in as: ${addr}\nNonce: ${nonce}\nIssued: ${issuedAt}\n\nOnly sign this on yo-yo.dev. Anyone holding the key controls the fees.`;

/** Ask the wallet for a fresh signature, then fetch the decrypted dev key. Returned once, never stored in the page. */
export async function revealDevKey(wallet, addr, devWallet) {
  const n = await fetch('/api/app/auth/nonce', { cache: 'no-store' }).then((r) => r.json());
  if (!n?.nonce || !n?.issuedAt) throw new Error(n?.error || 'Could not get a nonce. Reload and try again.');
  const signature = await wallet.signMessage(REVEAL_TEXT(String(addr).toLowerCase(), String(devWallet).toLowerCase(), n.nonce, n.issuedAt), addr);
  const res = await fetch('/api/app/config/key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nonce: n.nonce, issuedAt: n.issuedAt, signature }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not reveal the key');
  return data;
}
