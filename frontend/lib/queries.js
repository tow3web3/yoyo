import { getSql } from './db';

// Shared read-only queries used by the site routes and the public /api/v1.

export function scheduleLabel(row) {
  if (row.schedule_kind === 'closing_bell') return 'at the closing bell';
  if (row.schedule_kind === 'opening_bell') return 'at the opening bell';
  return `every ${row.interval_minutes} min`;
}

export async function getGlobalStats() {
  const sql = getSql();
  const [[u], [c], [e], [s]] = await Promise.all([
    sql`SELECT COUNT(*)::int AS count FROM users`,
    sql`SELECT COUNT(*)::int AS count FROM bot_configs WHERE is_active = true`,
    sql`SELECT COUNT(*)::int AS count FROM execution_logs WHERE status = 'success' AND holder_count > 0`,
    sql`SELECT COALESCE(SUM(claimed_eth_wei), 0)::text AS sum FROM execution_logs WHERE status = 'success' AND holder_count > 0`,
  ]);
  return { totalUsers: u.count, activeConfigs: c.count, totalExecutions: e.count, totalEthClaimedWei: s.sum };
}

export async function getActivity(limit = 20) {
  const sql = getSql();
  return await sql`
    (
      SELECT 'paid' AS type,
             bc.source_token_address AS source_token,
             COALESCE(el.reward_token_used, bc.target_token_address) AS reward_token,
             el.holder_count, el.total_airdropped::text AS total_airdropped, el.claimed_eth_wei::text AS claimed_eth_wei,
             el.execution_time AS ts
      FROM execution_logs el JOIN bot_configs bc ON el.config_id = bc.id
      WHERE el.status = 'success' AND el.holder_count > 0
    )
    UNION ALL
    (
      SELECT 'linked' AS type, bc.source_token_address, bc.target_token_address,
             NULL::int, NULL::text, NULL::text, bc.created_at
      FROM bot_configs bc
    )
    ORDER BY ts DESC
    LIMIT ${limit}
  `;
}

export async function getActiveTokens() {
  const sql = getSql();
  return await sql`
    SELECT bc.source_token_address AS address,
           bc.target_token_address AS reward_token,
           bc.reward_mode, bc.basket, bc.destination, bc.schedule_kind, bc.interval_minutes, bc.market_hours_only, bc.last_execution,
           COALESCE((SELECT COUNT(*) FROM execution_logs el WHERE el.config_id = bc.id AND el.status = 'success' AND el.holder_count > 0), 0)::int AS distributions
    FROM bot_configs bc
    WHERE bc.is_active = true
    ORDER BY bc.created_at DESC
    LIMIT 50
  `;
}

/** What Boomerang has bought for a config's treasury, grouped by asset. */
export async function getTreasuryLedger(configId) {
  const sql = getSql();
  return await sql`
    SELECT token, SUM(amount)::text AS amount, SUM(eth_spent)::text AS eth_spent, COUNT(*)::int AS buys, MAX(created_at) AS last_at
    FROM treasury_ledger WHERE config_id = ${configId}
    GROUP BY token ORDER BY buys DESC
  `;
}

/** One paid dividend (for the receipt page and card), or null. */
export async function getReceipt(id) {
  const sql = getSql();
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return null;
  const [row] = await sql`
    SELECT el.id, el.claimed_eth_wei::text AS claimed_eth_wei, el.total_airdropped::text AS total_airdropped, el.holder_count,
           el.execution_time, el.reward_token_used, el.reward_mode_used, el.destination, el.swap_tx, el.error_message,
           bc.source_token_address, bc.schedule_kind, bc.interval_minutes, bc.loyalty_enabled,
           (SELECT COUNT(*)::int FROM airdrop_transactions at WHERE at.execution_log_id = el.id AND at.status = 'success') AS paid_count,
           (SELECT at.tx_hash FROM airdrop_transactions at WHERE at.execution_log_id = el.id AND at.status = 'success' AND at.tx_hash IS NOT NULL LIMIT 1) AS tx_hash
    FROM execution_logs el JOIN bot_configs bc ON el.config_id = bc.id
    WHERE el.id = ${n} AND el.status = 'success' AND el.holder_count > 0
  `;
  return row || null;
}

/** Everything a wallet has received across every Boomerang token, plus its current holdings. */
export async function getWalletStatement(address) {
  const sql = getSql();
  const w = address.toLowerCase();
  const [totals, recent, holdings] = await Promise.all([
    sql`
      SELECT bc.source_token_address AS source_token, el.reward_token_used AS reward_token,
             SUM(at.airdrop_amount)::text AS total, COUNT(*)::int AS n, MAX(el.execution_time) AS last_at
      FROM airdrop_transactions at
      JOIN execution_logs el ON el.id = at.execution_log_id
      JOIN bot_configs bc ON bc.id = el.config_id
      WHERE at.holder_address = ${w} AND at.status = 'success'
      GROUP BY bc.source_token_address, el.reward_token_used
      ORDER BY n DESC
    `,
    sql`
      SELECT at.airdrop_amount::text AS amount, at.tx_hash, el.id AS log_id, el.execution_time, el.reward_token_used AS reward_token,
             bc.source_token_address AS source_token
      FROM airdrop_transactions at
      JOIN execution_logs el ON el.id = at.execution_log_id
      JOIN bot_configs bc ON bc.id = el.config_id
      WHERE at.holder_address = ${w} AND at.status = 'success'
      ORDER BY el.execution_time DESC
      LIMIT 25
    `,
    sql`
      SELECT hb.token, hb.balance::text AS balance, hb.since_block, hb.last_out_block, s.last_block,
             bc.loyalty_enabled, bc.loyalty_ramp_days, bc.loyalty_max_bps, bc.loyalty_min_hold_hours, bc.loyalty_sell_reset
      FROM holder_balances hb
      JOIN holder_index_state s ON s.token = hb.token
      JOIN bot_configs bc ON bc.source_token_address = hb.token AND bc.is_active = true
      WHERE hb.address = ${w} AND hb.balance > 0
    `,
  ]);
  return { totals, recent, holdings };
}

/** Full dashboard data, or null when the token has no active config. */
export async function getDashboard(address) {
  const sql = getSql();
  const addr = address.toLowerCase();
  const [config] = await sql`SELECT * FROM bot_configs WHERE source_token_address = ${addr} AND is_active = true LIMIT 1`;
  if (!config) return null;

  const [[stats], topRecipients, recentExecutions, [holders]] = await Promise.all([
    sql`
      SELECT COALESCE(SUM(total_airdropped), 0)::text AS total_airdropped,
             COALESCE(SUM(bought_token_amount), 0)::text AS total_bought_back,
             COALESCE(SUM(claimed_eth_wei), 0)::text AS total_eth_claimed,
             COUNT(*)::int AS execution_count,
             MAX(execution_time) AS last_execution
      FROM execution_logs el JOIN bot_configs bc ON el.config_id = bc.id
      WHERE bc.source_token_address = ${addr} AND el.status = 'success' AND el.holder_count > 0
    `,
    sql`
      SELECT at.holder_address, COUNT(*)::int AS airdrop_count,
             SUM(at.airdrop_amount)::text AS total_received,
             MAX(el.reward_token_used) AS reward_token,
             hb.balance::text AS balance,
             GREATEST(0, (SELECT last_block FROM holder_index_state WHERE token = ${addr}) - GREATEST(hb.since_block, COALESCE(hb.last_out_block, 0)))::bigint AS held_blocks,
             hb.since_block
      FROM airdrop_transactions at
      JOIN execution_logs el ON at.execution_log_id = el.id
      JOIN bot_configs bc ON el.config_id = bc.id
      LEFT JOIN holder_balances hb ON hb.token = bc.source_token_address AND hb.address = at.holder_address
      WHERE bc.source_token_address = ${addr} AND at.status = 'success'
      GROUP BY at.holder_address, hb.balance, hb.since_block, hb.last_out_block
      ORDER BY airdrop_count DESC, total_received DESC
      LIMIT 10
    `,
    sql`
      SELECT el.id, el.claimed_eth_wei::text AS claimed_eth_wei, el.bought_token_amount::text AS bought_token_amount,
             el.total_airdropped::text AS total_airdropped, el.holder_count, el.execution_time, el.status,
             el.reward_token_used, el.reward_mode_used, el.destination, el.swap_tx, el.error_message,
             (SELECT at.tx_hash FROM airdrop_transactions at WHERE at.execution_log_id = el.id AND at.status = 'success' AND at.tx_hash IS NOT NULL LIMIT 1) AS tx_hash
      FROM execution_logs el JOIN bot_configs bc ON el.config_id = bc.id
      WHERE bc.source_token_address = ${addr} AND el.status = 'success' AND el.holder_count > 0
      ORDER BY el.execution_time DESC
      LIMIT 30
    `,
    sql`SELECT COUNT(*)::int AS n FROM holder_balances WHERE token = ${addr} AND balance > 0`,
  ]);

  return { config, stats, topRecipients, recentExecutions, holderCount: holders?.n || 0 };
}
