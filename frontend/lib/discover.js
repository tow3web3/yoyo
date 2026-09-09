// Discover the tokens behind a wallet, straight from the chain (no explorer API):
//   created  tokens this wallet brought into existence: a direct deployment, or a
//            launchpad `create` call (the factory deploys, the wallet's tx mints)
//   held     ERC-20s the wallet has ever received, with current balances
// Sources: the public RPC answers topic-filtered eth_getLogs over the whole chain
// in under a second (held). Outgoing transactions come from Alchemy's
// alchemy_getAssetTransfers on ARCHIVE_RPC_URL; their receipts reveal every mint
// and deployment (created). Without Alchemy, the receipt of the wallet's earliest
// transfer of each held token is checked for a mint instead.
import { createPublicClient, http, parseAbiItem, parseAbi } from 'viem';
import { rpc } from './evm';
import { getStock, isNative } from './stocks';
import { fetchTokenMeta } from './tokenMeta';

const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ZERO_TOPIC = `0x${'0'.repeat(64)}`;
const ERC20 = parseAbi(['function symbol() view returns (string)', 'function name() view returns (string)', 'function decimals() view returns (uint8)', 'function balanceOf(address) view returns (uint256)']);
const IGNORE = new Set(['0x0bd7d308f8e1639fab988df18a8011f41eacad73', '0x5fc5360d0400a0fd4f2af552add042d716f1d168']); // WETH, USDG
const MAX_HELD = 40;
const MAX_RECEIPTS = 160;
const PER_TARGET = 6; // receipts to inspect per distinct contract the wallet called
const TTL = 2 * 60_000;
const walletCache = new Map();
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';

// Reads go through the archive provider when configured (higher rate limits), else the public RPC.
let archiveClient = null;
function reader() {
  const url = process.env.ARCHIVE_RPC_URL;
  if (!url) return rpc();
  return (archiveClient ??= createPublicClient({ transport: http(url, { timeout: 12_000, retryCount: 2, batch: true }) }));
}

const isLpToken = (symbol, name) => /^(UNI-V2|UNI-V3-POS|SLP|CAKE-LP)$/i.test(symbol || '') || /uniswap|liquidity|\bLP\b|position/i.test(name || '');

async function alchemy(method, params) {
  const url = process.env.ARCHIVE_RPC_URL;
  if (!url) return null;
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(15_000) });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || 'alchemy error');
  return j.result;
}

/** Outgoing transactions of a wallet (hash, to), newest first. Empty without Alchemy. */
async function outgoingTxs(wallet) {
  const out = [];
  let pageKey;
  for (let page = 0; page < 3; page++) {
    const r = await alchemy('alchemy_getAssetTransfers', [{ fromBlock: '0x0', toBlock: 'latest', fromAddress: wallet, category: ['external'], maxCount: '0x3e8', excludeZeroValue: false, order: 'desc', ...(pageKey ? { pageKey } : {}) }]).catch(() => null);
    if (!r) break;
    for (const t of r.transfers || []) out.push({ hash: t.hash, to: (t.to || '').toLowerCase(), block: parseInt(t.blockNum, 16) });
    pageKey = r.pageKey;
    if (!pageKey) break;
  }
  return out;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k).catch(() => null); }
  }));
  return out;
}

/** Tokens minted or deployed inside the wallet's own transactions. Map token -> { txHash, block }. */
async function createdTokens(client, wallet) {
  const txs = await outgoingTxs(wallet);
  const perTarget = new Map();
  const picked = [];
  for (const t of txs) {
    if (IGNORE.has(t.to)) continue;
    const n = perTarget.get(t.to) || 0;
    if (t.to && n >= PER_TARGET) continue; // repeated calls to the same contract (a game, a router) rarely create tokens
    perTarget.set(t.to, n + 1);
    picked.push(t);
    if (picked.length >= MAX_RECEIPTS) break;
  }
  const found = new Map();
  await mapLimit(picked, 10, async (t) => {
    const r = await client.getTransactionReceipt({ hash: t.hash });
    if (!r || r.status !== 'success') return;
    if (r.contractAddress) found.set(r.contractAddress.toLowerCase(), { txHash: t.hash, block: t.block, how: 'deployed' });
    for (const l of r.logs) {
      if (l.topics[0] === TRANSFER_TOPIC && l.topics[1] === ZERO_TOPIC && l.topics.length === 3) {
        const a = l.address.toLowerCase();
        if (!IGNORE.has(a) && !getStock(a) && !found.has(a)) found.set(a, { txHash: t.hash, block: t.block, how: 'minted' });
      }
    }
  });
  return found;
}

/** Fallback without Alchemy: did the wallet's earliest transaction touching this token mint it? */
async function mintedInWalletTx(client, token, wallet, earliestLog) {
  if (!earliestLog) return false;
  const receipt = await client.getTransactionReceipt({ hash: earliestLog.transactionHash }).catch(() => null);
  if (!receipt || receipt.from.toLowerCase() !== wallet) return false;
  return receipt.logs.some((l) => l.address.toLowerCase() === token && l.topics[0] === TRANSFER_TOPIC && l.topics[1] === ZERO_TOPIC);
}

export async function discoverTokens(wallet) {
  const w = wallet.toLowerCase();
  const hit = walletCache.get(w);
  if (hit && Date.now() - hit.ts < TTL) return hit.data;
  const client = reader();
  const pub = rpc();
  const head = await client.getBlockNumber();
  const logsFor = (args) => pub.getLogs({ event: TRANSFER, args, fromBlock: 0n, toBlock: head }).catch(() => client.getLogs({ event: TRANSFER, args, fromBlock: 0n, toBlock: head }));
  const [inLogs, outLogs, created] = await Promise.all([
    logsFor({ to: wallet }),
    logsFor({ from: wallet }),
    createdTokens(client, w).catch(() => new Map()),
  ]);
  const last = new Map();
  const earliest = new Map();
  for (const l of [...inLogs, ...outLogs]) {
    const a = l.address.toLowerCase();
    if (IGNORE.has(a) || getStock(a) || isNative(a)) continue;
    if (!last.has(a) || last.get(a) < l.blockNumber) last.set(a, l.blockNumber);
    if (!earliest.has(a) || earliest.get(a).blockNumber > l.blockNumber) earliest.set(a, l);
  }
  const heldTokens = [...last.entries()].sort((a, b) => Number(b[1] - a[1])).slice(0, MAX_HELD).map(([a]) => a);
  const tokens = [...new Set([...created.keys(), ...heldTokens])];

  const calls = tokens.flatMap((t) => [
    { address: t, abi: ERC20, functionName: 'symbol' }, { address: t, abi: ERC20, functionName: 'name' },
    { address: t, abi: ERC20, functionName: 'decimals' }, { address: t, abi: ERC20, functionName: 'balanceOf', args: [wallet] },
  ]);
  const mc = tokens.length ? await client.multicall({ contracts: calls, multicallAddress: MULTICALL3, allowFailure: true }).catch(() => null) : [];
  const field = (i, k, fallback) => { const r = mc?.[i * 4 + k]; return r && r.status === 'success' ? r.result : fallback; };
  const [rows, meta] = await Promise.all([
    mapLimit(tokens, 8, async (t, i) => {
      const symbol = field(i, 0, null), name = field(i, 1, null), decimals = field(i, 2, 18), balance = field(i, 3, 0n);
      if (!symbol || isLpToken(String(symbol), name ? String(name) : '')) return null;
      const c = created.get(t);
      const isCreated = Boolean(c) || (await mintedInWalletTx(client, t, w, earliest.get(t)));
      return {
        address: t, symbol: String(symbol), name: name ? String(name) : String(symbol), decimals: Number(decimals),
        balance: balance.toString(), balanceUi: Number(balance) / 10 ** Number(decimals),
        created: isCreated, createdHow: c?.how || (isCreated ? 'minted' : null), creationTx: c?.txHash || null, creationBlock: c?.block ?? null,
        lastActivityBlock: Number(last.get(t) ?? c?.block ?? 0),
      };
    }),
    fetchTokenMeta(tokens).catch(() => ({})),
  ]);
  const clean = rows.filter(Boolean).map((r) => ({ ...r, image: meta[r.address]?.image || null, marketCap: meta[r.address]?.marketCap ?? null }));
  const data = {
    wallet: w,
    created: clean.filter((r) => r.created).sort((a, b) => (b.creationBlock || 0) - (a.creationBlock || 0)),
    held: clean.filter((r) => !r.created && r.balanceUi > 0).sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0)),
    scanned: tokens.length,
    archive: Boolean(process.env.ARCHIVE_RPC_URL),
  };
  walletCache.set(w, { data, ts: Date.now() });
  return data;
}
