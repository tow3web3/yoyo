// Resolve a token address for the wizard: symbol, name, whether it is a stock,
// and DexScreener metadata when available.
import { parseAbi } from 'viem';
import { rpc } from '../../../../lib/evm';
import { fetchTokenMeta } from '../../../../lib/tokenMeta';
import { EVM_ADDR, getStock } from '../../../../lib/stocks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const erc20 = parseAbi(['function symbol() view returns (string)', 'function name() view returns (string)', 'function decimals() view returns (uint8)']);

export async function GET(request) {
  const address = new URL(request.url).searchParams.get('address') || '';
  if (!EVM_ADDR.test(address)) return Response.json({ error: 'Invalid address' }, { status: 400 });
  try {
    const [symbol, name, decimals] = await Promise.all([
      rpc().readContract({ address, abi: erc20, functionName: 'symbol' }),
      rpc().readContract({ address, abi: erc20, functionName: 'name' }).catch(() => null),
      rpc().readContract({ address, abi: erc20, functionName: 'decimals' }).catch(() => 18),
    ]);
    const meta = await fetchTokenMeta([address]).catch(() => ({}));
    const m = meta[address.toLowerCase()] || {};
    return Response.json({ address: address.toLowerCase(), symbol: String(symbol), name: name ? String(name) : String(symbol), decimals: Number(decimals), image: m.image || null, marketCap: m.marketCap ?? null, isStock: Boolean(getStock(address)) });
  } catch {
    return Response.json({ error: 'No ERC-20 found at that address on Robinhood Chain' }, { status: 404 });
  }
}
