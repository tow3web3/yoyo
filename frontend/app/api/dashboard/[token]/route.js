import { getDashboard, scheduleLabel, getTreasuryLedger } from '../../../../lib/queries';
import { treasurySheet } from '../../../../lib/treasury';
import { tokenYield } from '../../../../lib/yield';
import { fetchTokenMeta } from '../../../../lib/tokenMeta';
import { getQuotes } from '../../../../lib/prices';
import { getStock, EVM_ADDR, BASKETS } from '../../../../lib/stocks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const tokenView = (addr, meta) => ({
  address: addr,
  name: meta[addr]?.name || null,
  symbol: meta[addr]?.symbol || null,
  image: meta[addr]?.image || null,
  marketCap: meta[addr]?.marketCap ?? null,
  decimals: meta[addr]?.decimals ?? (getStock(addr) ? 18 : null),
  isStock: Boolean(getStock(addr)),
  sector: getStock(addr)?.sector || null,
});

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    if (!EVM_ADDR.test(token)) return Response.json({ error: 'Invalid address' }, { status: 400 });
    const data = await getDashboard(token);
    if (!data) return Response.json({ error: 'Token not found', message: 'No active Boomerang configuration for this token' }, { status: 404 });

    const { config, stats, topRecipients, recentExecutions, holderCount } = data;
    const src = config.source_token_address;
    const tgt = config.target_token_address;
    const used = recentExecutions.map((e) => e.reward_token_used).filter(Boolean);
    const meta = await fetchTokenMeta([src, tgt, ...used, ...topRecipients.map((r) => r.reward_token).filter(Boolean)]);

    // Fee split (legacy destination=burn means 100% burn) and the treasury balance sheet.
    let sh = Number(config.split_holders_bps ?? 10000), sb = Number(config.split_burn_bps ?? 0), st = Number(config.split_treasury_bps ?? 0);
    if (config.destination === 'burn' && sh === 10000 && sb === 0 && st === 0) { sh = 0; sb = 10000; }
    if (st > 0 && !config.treasury_address) { sh += st; st = 0; }
    let treasury = null;
    if (config.treasury_address) {
      const ledger = await getTreasuryLedger(config.id);
      const sheet = await treasurySheet({ treasuryAddress: config.treasury_address, tokens: ledger.map((l) => l.token), sourceToken: src, marketCap: meta[src]?.marketCap ?? null }).catch(() => null);
      treasury = sheet ? { ...sheet, ledger: ledger.map((l) => ({ token: l.token, amount: l.amount, ethSpent: l.eth_spent, buys: l.buys, lastAt: l.last_at })), asset: config.treasury_asset || null } : null;
    }

    const yieldStats = await tokenYield(src, meta[src]?.marketCap ?? null).catch(() => null);

    // Live quote for the reward when it is a stock.
    const stock = getStock(tgt);
    let quote = null;
    if (stock) {
      const q = await getQuotes([stock.ticker]);
      quote = q[stock.ticker] || null;
    }

    return Response.json({
      sourceToken: tokenView(src, meta),
      targetToken: { ...tokenView(tgt, meta), quote },
      stats: {
        totalAirdropped: stats.total_airdropped || '0',
        totalBoughtBack: stats.total_bought_back || '0',
        totalEthClaimed: stats.total_eth_claimed || '0',
        totalExecutions: stats.execution_count || 0,
        lastExecution: stats.last_execution,
        holderCount,
      },
      topRecipients: topRecipients.map((r) => ({
        address: r.holder_address,
        totalReceived: r.total_received,
        airdropCount: r.airdrop_count,
        rewardToken: r.reward_token,
        rewardSymbol: r.reward_token ? meta[r.reward_token]?.symbol || null : null,
        rewardDecimals: r.reward_token ? meta[r.reward_token]?.decimals ?? null : null,
        // Robinhood Chain mines ~864k blocks a day; null when the wallet is not in the ledger.
        heldDays: r.since_block == null ? null : Math.max(0, Number(r.held_blocks || 0) / 864000),
      })),
      recentExecutions: recentExecutions.map((e) => ({
        id: e.id,
        claimedEth: e.claimed_eth_wei,
        boughtTokens: e.bought_token_amount,
        totalAirdropped: e.total_airdropped,
        holderCount: e.holder_count,
        executionTime: e.execution_time,
        status: e.status,
        txHash: e.tx_hash || null,
        swapTx: e.swap_tx || null,
        rewardToken: e.reward_token_used || null,
        rewardSymbol: e.reward_token_used ? meta[e.reward_token_used]?.symbol || null : null,
        rewardDecimals: e.reward_token_used ? meta[e.reward_token_used]?.decimals ?? null : null,
        rewardMode: e.reward_mode_used || null,
        destination: e.destination || 'holders',
        note: e.error_message || null,
      })),
      config: {
        intervalMinutes: config.interval_minutes,
        scheduleKind: config.schedule_kind,
        scheduleLabel: scheduleLabel(config),
        marketHoursOnly: Boolean(config.market_hours_only),
        isActive: config.is_active,
        rewardMode: config.reward_mode,
        basket: config.basket ? { key: config.basket, ...(BASKETS[config.basket] || {}) } : null,
        destination: config.destination,
        feeSource: config.fee_source,
        split: { holders: sh, burn: sb, treasury: st },
        treasuryAddress: config.treasury_address || null,
        loyalty: {
          enabled: Boolean(config.loyalty_enabled),
          minHoldHours: Number(config.loyalty_min_hold_hours || 0),
          rampDays: Number(config.loyalty_ramp_days || 30),
          maxMultiplier: Number(config.loyalty_max_bps || 20000) / 10000,
          sellReset: Boolean(config.loyalty_sell_reset),
        },
      },
      treasury,
      yield: yieldStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
