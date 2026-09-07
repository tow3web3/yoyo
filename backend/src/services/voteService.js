import pool from '../db/connection.js';
import { getTokenHolders } from './holders.js';
import { LIQUID_STOCKS } from '../chain/stocks.js';
import { NATIVE_ETH } from '../chain/config.js';

// Holders pick the next dividend from the liquid stock pool plus ETH.
export const DEFAULT_OPTION_POOL = [NATIVE_ETH, ...LIQUID_STOCKS.map((s) => s.address.toLowerCase())];

export async function getOpenCycle(configId) {
  const { rows } = await pool.query(
    `SELECT * FROM vote_cycles WHERE config_id = $1 AND status = 'open' ORDER BY id DESC LIMIT 1`,
    [configId]
  );
  return rows[0] || null;
}

/** Open a cycle: snapshot holders (balance = voting weight) and seed the options. */
export async function openCycle(config) {
  const hours = config.vote_cycle_hours || 24;
  const { rows } = await pool.query(
    `INSERT INTO vote_cycles (config_id, status, ends_at) VALUES ($1, 'open', NOW() + ($2 || ' hours')::interval) RETURNING *`,
    [config.id, String(hours)]
  );
  const cycle = rows[0];

  let holders = [];
  try {
    holders = await getTokenHolders(config.source_token_address, {
      minBalance: BigInt(config.min_holder_amount || 0), exclude: [config.dev_wallet_public], startBlock: config.index_start_block || null,
    });
  } catch (e) {
    console.error(`Vote snapshot failed for config ${config.id}:`, e.message);
  }
  const CHUNK = 500;
  for (let i = 0; i < holders.length; i += CHUNK) {
    const slice = holders.slice(i, i + CHUNK);
    const ph = slice.map((_, j) => `($1, $${j * 2 + 2}, $${j * 2 + 3})`).join(',');
    const vals = slice.flatMap((h) => [h.address, h.balance.toString()]);
    await pool.query(`INSERT INTO vote_snapshots (cycle_id, holder_address, weight) VALUES ${ph} ON CONFLICT DO NOTHING`, [cycle.id, ...vals]);
  }

  const opts = [...new Set([...DEFAULT_OPTION_POOL, config.target_token_address.toLowerCase()])];
  for (const addr of opts) {
    await pool.query(
      `INSERT INTO vote_options (cycle_id, token_address, proposed_by, passed_filters) VALUES ($1, $2, NULL, true) ON CONFLICT DO NOTHING`,
      [cycle.id, addr]
    );
  }
  console.log(`Opened vote cycle ${cycle.id} for config ${config.id} (${holders.length} holders, ${opts.length} options)`);
  return cycle;
}

export async function resolveCycle(cycleId, fallbackToken) {
  const { rows } = await pool.query(
    `SELECT o.token_address, COALESCE(SUM(v.weight), 0) AS w, o.id
     FROM vote_options o LEFT JOIN votes v ON v.option_id = o.id
     WHERE o.cycle_id = $1 GROUP BY o.id, o.token_address ORDER BY w DESC, o.id ASC`,
    [cycleId]
  );
  const top = rows[0];
  const winner = top && Number(top.w) > 0 ? top.token_address : fallbackToken;
  const totalWeight = rows.reduce((s, r) => s + Number(r.w), 0);
  await pool.query(`UPDATE vote_cycles SET status = 'resolved', winning_token = $1, total_weight = $2 WHERE id = $3`, [winner, totalWeight, cycleId]);
  console.log(`Resolved vote cycle ${cycleId}: winner ${winner}`);
  return winner;
}

export async function getCurrentRewardToken(configId) {
  const { rows } = await pool.query(
    `SELECT winning_token FROM vote_cycles WHERE config_id = $1 AND status = 'resolved' AND winning_token IS NOT NULL ORDER BY id DESC LIMIT 1`,
    [configId]
  );
  return rows[0]?.winning_token || null;
}

export async function tickVoteCycles() {
  const { rows: configs } = await pool.query(`SELECT * FROM bot_configs WHERE is_active = true AND reward_mode = 'vote'`);
  for (const config of configs) {
    const open = await getOpenCycle(config.id);
    if (open) {
      if (new Date(open.ends_at).getTime() <= Date.now()) {
        await resolveCycle(open.id, config.target_token_address);
        await openCycle(config);
      }
    } else {
      await openCycle(config);
    }
  }
}
