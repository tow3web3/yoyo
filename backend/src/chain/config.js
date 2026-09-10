// Robinhood Chain (id 4663), an Arbitrum-based L2 where gas is ETH and the
// official Robinhood Stock Tokens live as plain ERC-20s. Every address below was
// verified on mainnet in earlier deployments (RobinPad, Stock16, ripple).
import { defineChain, createPublicClient, createWalletClient, http, fallback, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config();

export const RPC_URL = process.env.RH_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
// A second endpoint takes over when the first one errors or rate-limits (the public
// RPC answers with Cloudflare challenges under load).
export const RPC_FALLBACK_URL = process.env.RH_RPC_FALLBACK_URL || '';
export function rpcTransport(opts = {}) {
  const primary = http(RPC_URL, { retryCount: 2, retryDelay: 500, timeout: 30_000, ...opts });
  if (!RPC_FALLBACK_URL || RPC_FALLBACK_URL === RPC_URL) return primary;
  return fallback([primary, http(RPC_FALLBACK_URL, { retryCount: 2, retryDelay: 500, timeout: 30_000, ...opts })], { rank: false, retryCount: 0 });
}

export const robinhoodChain = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' } },
});

export const EXPLORER_URL = 'https://robinhoodchain.blockscout.com';
export const explorerTx = (hash) => `${EXPLORER_URL}/tx/${hash}`;
export const explorerAddress = (addr) => `${EXPLORER_URL}/address/${addr}`;
export const explorerToken = (addr) => `${EXPLORER_URL}/token/${addr}`;

export const ZERO = '0x0000000000000000000000000000000000000000';
export const DEAD = '0x000000000000000000000000000000000000dEaD';
// Native ETH is stored as the zero address wherever a reward token is expected.
export const NATIVE_ETH = ZERO;
export const isNative = (addr) => !addr || addr.toLowerCase() === ZERO;

export const WETH = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73';
export const USDG = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168'; // 6 decimals

export const UNIV2_ROUTER = '0x89e5DB8B5aA49aA85AC63f691524311AEB649eba';
export const UNIV3_SWAP_ROUTER02 = '0xcaf681a66d020601342297493863e78c959e5cb2';
export const UNIV3_NPM = '0x73991a25c818bf1f1128deaab1492d45638de0d3';
export const UNIV3_FACTORY = '0x1f7d7550b1b028f7571e69a784071f0205fd2efa';
export const UNIV4_POOL_MANAGER = '0x8366a39CC670B4001A1121B8F6A443A643e40951';
export const UNIV4_QUOTER = '0x5c3db48cFd8352D845fac70009d714F0Ce1d7914';
export const UNIV4_ROUTER = '0x9115a9208e9c09056bB3617136CB4eFf1bb408A0'; // MotionSwapRouter, exactInputSingle
export const UNIVERSAL_ROUTER = '0x8876789976decbfcbbbe364623c63652db8c0904';

// Protocol contracts that can hold tokens but must never receive a dividend.
export const PROTOCOL_ADDRESSES = [
  ZERO, DEAD, WETH, USDG,
  UNIV2_ROUTER, UNIV3_SWAP_ROUTER02, UNIV3_NPM, UNIV3_FACTORY,
  UNIV4_POOL_MANAGER, UNIV4_QUOTER, UNIV4_ROUTER, UNIVERSAL_ROUTER,
].map((a) => a.toLowerCase());

export const erc20Abi = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
]);

export const wethAbi = parseAbi([
  'function deposit() payable',
  'function withdraw(uint256 wad)',
  'function balanceOf(address) view returns (uint256)',
]);

let _public;
export function publicClient() {
  if (!_public) {
    _public = createPublicClient({
      chain: robinhoodChain,
      transport: rpcTransport(),
    });
  }
  return _public;
}

/** Normalise a private key string to 0x-prefixed lowercase hex. */
export function normalizeKey(key) {
  const k = String(key || '').trim();
  return (k.startsWith('0x') ? k : `0x${k}`).toLowerCase();
}

export function accountFromKey(privateKey) {
  return privateKeyToAccount(normalizeKey(privateKey));
}

/** Wallet client bound to a config's dev wallet key (never cached: keys differ per config). */
export function walletFor(privateKey) {
  const account = accountFromKey(privateKey);
  const wallet = createWalletClient({ account, chain: robinhoodChain, transport: rpcTransport() });
  return { account, wallet };
}

export const isAddress = (s) => /^0x[0-9a-fA-F]{40}$/.test(String(s || '').trim());
export const short = (a) => (a && a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || '');
export const lower = (a) => String(a || '').toLowerCase();

/** Wait for a receipt and throw a readable error when the tx reverted. */
export async function confirm(hash, label = 'transaction') {
  const receipt = await publicClient().waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (receipt.status !== 'success') throw new Error(`${label} reverted: ${explorerTx(hash)}`);
  return receipt;
}

/** name / symbol / decimals of any ERC-20, or null when the address is not a token. */
export async function readTokenMeta(address) {
  const client = publicClient();
  try {
    const [symbol, decimals, name] = await Promise.all([
      client.readContract({ address, abi: erc20Abi, functionName: 'symbol' }),
      client.readContract({ address, abi: erc20Abi, functionName: 'decimals' }),
      client.readContract({ address, abi: erc20Abi, functionName: 'name' }).catch(() => ''),
    ]);
    return { address, symbol: String(symbol), decimals: Number(decimals), name: String(name || symbol) };
  } catch {
    return null;
  }
}

export const formatEth = (wei, digits = 5) => (Number(wei) / 1e18).toFixed(digits);
export const formatUnits = (raw, decimals, digits = 6) => (Number(raw) / 10 ** Number(decimals)).toFixed(digits);
