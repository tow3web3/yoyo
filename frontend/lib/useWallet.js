'use client';

import { useCallback, useEffect, useState } from 'react';
import { createWalletClient, custom } from 'viem';

// Minimal injected-wallet hook (MetaMask, Rabby, Coinbase Wallet, ...). Only
// message signing is needed on the site, so no chain switch is required.
export const ROBINHOOD_CHAIN = {
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' } },
};

export function useWallet() {
  const [address, setAddress] = useState(null);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const eth = typeof window !== 'undefined' ? window.ethereum : null;
    setAvailable(Boolean(eth));
    if (!eth) return;
    eth.request({ method: 'eth_accounts' }).then((accs) => { if (accs?.[0]) setAddress(accs[0]); }).catch(() => {});
    const onAccounts = (accs) => setAddress(accs?.[0] || null);
    eth.on?.('accountsChanged', onAccounts);
    return () => eth.removeListener?.('accountsChanged', onAccounts);
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    const eth = window.ethereum;
    if (!eth) { setError('No wallet found. Install MetaMask or Rabby.'); return null; }
    try {
      const accs = await eth.request({ method: 'eth_requestAccounts' });
      setAddress(accs?.[0] || null);
      return accs?.[0] || null;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, []);

  const disconnect = useCallback(() => setAddress(null), []);

  // Signs with the given address (or the connected one). Falls back to a raw personal_sign
  // for providers that return nothing through viem, and always yields a 0x hex string.
  const signMessage = useCallback(async (message, account = address) => {
    if (!account) throw new Error('Connect a wallet first');
    const eth = window.ethereum;
    let sig = null;
    try {
      const client = createWalletClient({ chain: ROBINHOOD_CHAIN, transport: custom(eth) });
      sig = await client.signMessage({ account, message });
    } catch (e) {
      if (/reject|denied|cancel/i.test(e.message || '')) throw new Error('Signature rejected in the wallet');
    }
    if (typeof sig !== 'string' || !/^0x[0-9a-fA-F]+$/.test(sig)) {
      const hex = '0x' + Array.from(new TextEncoder().encode(message)).map((b) => b.toString(16).padStart(2, '0')).join('');
      sig = await eth.request({ method: 'personal_sign', params: [hex, account] });
    }
    if (typeof sig !== 'string' || !/^0x[0-9a-fA-F]+$/.test(sig)) throw new Error('The wallet did not return a signature. Try another wallet or reload the page.');
    return sig;
  }, [address]);

  return { address, connected: Boolean(address), available, error, connect, disconnect, signMessage };
}

export function ConnectButton({ wallet, className = '' }) {
  const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  if (wallet.connected) {
    return (
      <button onClick={wallet.disconnect} className={`btn-ghost ${className}`} title="Disconnect">
        <span className="h-2 w-2 rounded-full bg-hood-500" />
        <span className="font-mono">{short(wallet.address)}</span>
      </button>
    );
  }
  return (
    <button onClick={wallet.connect} className={`btn-primary ${className}`}>
      {wallet.available ? 'Connect wallet' : 'Install a wallet'}
    </button>
  );
}
