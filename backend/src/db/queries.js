import pool from './connection.js';

export { pool };

// ========== USERS ==========

export async function createOrGetUser(telegramId, username) {
  const result = await pool.query(
    `INSERT INTO users (telegram_id, username) VALUES ($1, $2)
     ON CONFLICT (telegram_id) DO UPDATE SET username = $2 RETURNING *`,
    [telegramId, username]
  );
  return result.rows[0];
}

export async function getUserByTelegramId(telegramId) {
  const result = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  return result.rows[0];
}

// ========== BOT CONFIGS ==========

export async function createBotConfig(c) {
  const result = await pool.query(
    `INSERT INTO bot_configs (
       user_id, dev_wallet_encrypted, dev_wallet_public, source_token_address, target_token_address,
       fee_source, univ3_position_ids, reward_mode, basket, destination, schedule_kind, interval_minutes,
       market_hours_only, slippage_bps, min_holder_amount, index_start_block, launchpad_id, launch_code
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
    [
      c.userId, JSON.stringify(c.devWalletEncrypted), c.devWalletPublic.toLowerCase(),
      c.sourceTokenAddress.toLowerCase(), c.targetTokenAddress.toLowerCase(),
      c.feeSource || 'wallet', JSON.stringify(c.univ3PositionIds || []), c.rewardMode || 'fixed', c.basket || null,
      c.destination || 'holders', c.scheduleKind || 'interval', c.intervalMinutes || 5,
      Boolean(c.marketHoursOnly), c.slippageBps || 150, c.minHolderAmount || 0, c.indexStartBlock || null,
      c.launchpadId || null, c.launchCode || null,
    ]
  );
  return result.rows[0];
}

export async function getBotConfigByUserId(userId) {
  const result = await pool.query('SELECT * FROM bot_configs WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [userId]);
  return result.rows[0];
}

export async function getActiveBotConfigs() {
  const result = await pool.query('SELECT * FROM bot_configs WHERE is_active = true');
  return result.rows;
}

async function updateConfig(configId, column, value) {
  const result = await pool.query(`UPDATE bot_configs SET ${column} = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [value, configId]);
  return result.rows[0];
}

export const updateBotConfigStatus = (id, isActive) => updateConfig(id, 'is_active', isActive);
export const updateBotConfigInterval = (id, minutes) => pool
  .query(`UPDATE bot_configs SET interval_minutes = $1, schedule_kind = 'interval', updated_at = NOW() WHERE id = $2 RETURNING *`, [minutes, id])
  .then((r) => r.rows[0]);
export const updateBotConfigSchedule = (id, kind) => updateConfig(id, 'schedule_kind', kind);
export const updateBotConfigTargetToken = (id, address) => pool
  .query(`UPDATE bot_configs SET target_token_address = $1, reward_mode = 'fixed', updated_at = NOW() WHERE id = $2 RETURNING *`, [address.toLowerCase(), id])
  .then((r) => r.rows[0]);
export const updateBotConfigRewardMode = (id, mode, basket = null) => pool
  .query(`UPDATE bot_configs SET reward_mode = $1, basket = COALESCE($2, basket), portfolio_cursor = 0, updated_at = NOW() WHERE id = $3 RETURNING *`, [mode, basket, id])
  .then((r) => r.rows[0]);
export const updateBotConfigDestination = (id, destination) => updateConfig(id, 'destination', destination);
export const updateBotConfigMarketHours = (id, flag) => updateConfig(id, 'market_hours_only', flag);
export const advancePortfolioCursor = (id, cursor) => updateConfig(id, 'portfolio_cursor', cursor);

export const updateBotConfigSplit = (id, holders, burn, treasury) => pool
  .query(`UPDATE bot_configs SET split_holders_bps = $1, split_burn_bps = $2, split_treasury_bps = $3,
          destination = CASE WHEN $2 = 10000 THEN 'burn' ELSE 'holders' END, updated_at = NOW() WHERE id = $4 RETURNING *`, [holders, burn, treasury, id])
  .then((r) => r.rows[0]);
export const updateBotConfigTreasuryAddress = (id, address) => updateConfig(id, 'treasury_address', address ? address.toLowerCase() : null);
export const updateBotConfigTreasuryAsset = (id, address) => updateConfig(id, 'treasury_asset', address ? address.toLowerCase() : null);
export async function insertTreasuryLedger({ configId, token, amount, ethSpent, txHash }) {
  await pool.query('INSERT INTO treasury_ledger (config_id, token, amount, eth_spent, tx_hash) VALUES ($1, $2, $3, $4, $5)',
    [configId, token.toLowerCase(), amount.toString(), (ethSpent ?? 0n).toString(), txHash || null]);
}

// ========== LAUNCHPAD HOOK ==========

export async function getLaunchLink(code) {
  const { rows } = await pool.query(
    `SELECT ll.*, lp.name AS launchpad_name, lp.slug AS launchpad_slug FROM launch_links ll LEFT JOIN launchpads lp ON lp.id = ll.launchpad_id WHERE ll.code = $1`,
    [code]
  );
  return rows[0] || null;
}
export async function markLaunchLinkLinked(code, configId) {
  await pool.query(`UPDATE launch_links SET status = 'linked', config_id = $2, linked_at = NOW() WHERE code = $1`, [code, configId]);
}
export async function getLaunchpad(id) {
  const { rows } = await pool.query('SELECT * FROM launchpads WHERE id = $1', [id]);
  return rows[0] || null;
}
export async function recordWebhookDelivery(launchpadId, event, statusCode, ok) {
  await pool.query('INSERT INTO webhook_deliveries (launchpad_id, event, status_code, ok) VALUES ($1, $2, $3, $4)', [launchpadId, event, statusCode, ok]);
}

export const setAnnounceChat = (id, chatId, threadId) => pool
  .query(`UPDATE bot_configs SET announce_chat_id = $1, announce_thread_id = $2, updated_at = NOW() WHERE id = $3 RETURNING *`, [chatId, threadId, id])
  .then((r) => r.rows[0]);

const LOYALTY_COLUMNS = new Set(['loyalty_enabled', 'loyalty_min_hold_hours', 'loyalty_ramp_days', 'loyalty_max_bps', 'loyalty_sell_reset']);
export function updateBotConfigLoyalty(id, column, value) {
  if (!LOYALTY_COLUMNS.has(column)) throw new Error(`Not a loyalty setting: ${column}`);
  return updateConfig(id, column, value);
}

export async function updateLastExecution(configId) {
  await pool.query('UPDATE bot_configs SET last_execution = NOW(), updated_at = NOW() WHERE id = $1', [configId]);
}

export async function deleteBotConfig(configId) {
  await pool.query('DELETE FROM bot_configs WHERE id = $1', [configId]);
}

// ========== EXECUTION LOGS ==========

export async function createExecutionLog(log) {
  const result = await pool.query(
    `INSERT INTO execution_logs (
       config_id, claimed_eth_wei, bought_token_amount, holder_count, total_airdropped, status, error_message,
       reward_token_used, reward_mode_used, destination, swap_tx, claim_tx,
       burn_amount, burn_tx, treasury_amount, treasury_token, treasury_tx
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
    [
      log.configId, (log.claimedEthWei ?? 0n).toString(), (log.boughtTokenAmount ?? 0n).toString(), log.holderCount || 0,
      (log.totalAirdropped ?? 0n).toString(), log.status, log.errorMessage || null,
      log.rewardTokenUsed ? log.rewardTokenUsed.toLowerCase() : null, log.rewardModeUsed || null, log.destination || null,
      log.swapTx || null, log.claimTx || null,
      (log.burnAmount ?? 0n).toString(), log.burnTx || null, (log.treasuryAmount ?? 0n).toString(),
      log.treasuryToken ? log.treasuryToken.toLowerCase() : null, log.treasuryTx || null,
    ]
  );
  return result.rows[0];
}

export async function getLastExecutionLog(configId) {
  const result = await pool.query('SELECT * FROM execution_logs WHERE config_id = $1 ORDER BY execution_time DESC LIMIT 1', [configId]);
  return result.rows[0];
}

// ========== AIRDROP TRANSACTIONS ==========

export async function createAirdropTransactionsBatch(transactions) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const tx of transactions) {
      await client.query(
        `INSERT INTO airdrop_transactions (execution_log_id, holder_address, holder_balance, airdrop_amount, tx_hash, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tx.executionLogId, tx.holderAddress.toLowerCase(), tx.holderBalance, tx.airdropAmount, tx.txHash, tx.status]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ========== DASHBOARD ==========

export async function getBotConfigBySourceToken(tokenAddress) {
  const result = await pool.query('SELECT * FROM bot_configs WHERE source_token_address = $1 AND is_active = true LIMIT 1', [tokenAddress.toLowerCase()]);
  return result.rows[0];
}

export async function getTokenStats(tokenAddress) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(total_airdropped), 0)::text AS total_airdropped,
            COALESCE(SUM(bought_token_amount), 0)::text AS total_bought_back,
            COALESCE(SUM(claimed_eth_wei), 0)::text AS total_eth_claimed,
            COUNT(*)::int AS execution_count,
            MAX(execution_time) AS last_execution
     FROM execution_logs el JOIN bot_configs bc ON el.config_id = bc.id
     WHERE bc.source_token_address = $1 AND el.status = 'success' AND el.holder_count > 0`,
    [tokenAddress.toLowerCase()]
  );
  return result.rows[0];
}

export async function getRecentExecutions(tokenAddress, limit = 10) {
  const result = await pool.query(
    `SELECT el.* FROM execution_logs el JOIN bot_configs bc ON el.config_id = bc.id
     WHERE bc.source_token_address = $1 ORDER BY el.execution_time DESC LIMIT $2`,
    [tokenAddress.toLowerCase(), limit]
  );
  return result.rows;
}
