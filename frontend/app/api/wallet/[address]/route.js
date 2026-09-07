import { getWalletStatement } from '../../../../lib/queries';
import { fetchTokenMeta } from '../../../../lib/tokenMeta';
import { EVM_ADDR } from '../../../../lib/stocks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BLOCKS_PER_DAY = 864000;

export async function GET(request, { params }) {
  try {
    const { address } = await params;
    if (!EVM_ADDR.test(address)) return Response.json({ error: 'Invalid address' }, { status: 400 });
    const { totals, recent, holdings } = await getWalletStatement(address);
    const meta = await fetchTokenMeta([
      ...totals.flatMap((t) => [t.source_token, t.reward_token]),
      ...recent.flatMap((r) => [r.source_token, r.reward_token]),
      ...holdings.map((h) => h.token),
    ]);
    const view = (a) => ({ address: a, symbol: meta[a]?.symbol || null, name: meta[a]?.name || null, image: meta[a]?.image || null, decimals: meta[a]?.decimals ?? 18 });

    return Response.json({
      wallet: address.toLowerCase(),
      totals: totals.map((t) => ({ source: view(t.source_token), reward: view(t.reward_token), total: t.total, count: t.n, lastAt: t.last_at })),
      recent: recent.map((r) => ({ logId: r.log_id, amount: r.amount, txHash: r.tx_hash, time: r.execution_time, reward: view(r.reward_token), source: view(r.source_token) })),
      holdings: holdings.map((h) => {
        const since = h.since_block == null ? null : Math.max(Number(h.since_block), h.loyalty_sell_reset && h.last_out_block != null ? Number(h.last_out_block) : 0);
        const heldDays = since == null ? null : Math.max(0, (Number(h.last_block) - since) / BLOCKS_PER_DAY);
        const ramp = Number(h.loyalty_ramp_days || 30);
        const maxMult = Number(h.loyalty_max_bps || 20000) / 10000;
        const mult = !h.loyalty_enabled ? 1 : heldDays == null ? maxMult : 1 + (maxMult - 1) * Math.min(1, heldDays / ramp);
        return {
          token: view(h.token), balance: h.balance, heldDays,
          loyalty: h.loyalty_enabled ? { multiplier: Math.round(mult * 100) / 100, maxMultiplier: maxMult, rampDays: ramp, minHoldHours: Number(h.loyalty_min_hold_hours || 0), qualifies: heldDays == null || heldDays * 24 >= Number(h.loyalty_min_hold_hours || 0) } : null,
        };
      }),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
