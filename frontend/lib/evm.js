// Server-side chain reads for the site (balances, signature checks).
import { createPublicClient, http, parseAbi, verifyMessage } from 'viem';

const RPC = process.env.RH_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
const erc20 = parseAbi(['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)']);

let client;
export const rpc = () => (client ??= createPublicClient({ transport: http(RPC, { timeout: 10_000, retryCount: 2 }) }));

/** UI-amount balance of an ERC-20 for a wallet; retried once on transient errors. */
export async function getTokenUiBalance(wallet, token) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [raw, decimals] = await Promise.all([
        rpc().readContract({ address: token, abi: erc20, functionName: 'balanceOf', args: [wallet] }),
        rpc().readContract({ address: token, abi: erc20, functionName: 'decimals' }),
      ]);
      return Number(raw) / 10 ** Number(decimals);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw lastErr;
}

/** EIP-191 personal_sign verification. */
export async function verifySignature({ message, signature, wallet }) {
  try {
    return await verifyMessage({ address: wallet, message, signature });
  } catch {
    return false;
  }
}
