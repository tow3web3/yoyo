import express from 'express';
import * as db from '../db/queries.js';
import { getSchedulerStatus } from '../scheduler/cron.js';
import { STOCKS, LIQUID_TICKERS, BASKETS } from '../chain/stocks.js';
import { getQuotes } from '../services/oracle.js';
import { isAddress } from '../chain/config.js';

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', chain: 4663, timestamp: new Date().toISOString() });
});

router.get('/status', async (req, res) => {
  try {
    const activeConfigs = await db.getActiveBotConfigs();
    res.json({ scheduler: getSchedulerStatus(), activeConfigs: activeConfigs.length, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** The stock universe, with liquidity flags and baskets. */
router.get('/stocks', (req, res) => {
  res.json({
    count: STOCKS.length,
    liquid: LIQUID_TICKERS,
    baskets: BASKETS,
    stocks: STOCKS.map((s) => ({ ...s, liquid: LIQUID_TICKERS.includes(s.ticker) })),
  });
});

/** Live prices for a few tickers (Yahoo, cached one minute). */
router.get('/stocks/prices', async (req, res) => {
  try {
    const tickers = String(req.query.tickers || LIQUID_TICKERS.join(',')).split(',').map((t) => t.trim().toUpperCase()).filter(Boolean).slice(0, 30);
    const quotes = await getQuotes([...tickers, 'ETH-USD']);
    res.json({ quotes, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const [u, c, e, s] = await Promise.all([
      db.pool.query('SELECT COUNT(*)::int AS n FROM users'),
      db.pool.query('SELECT COUNT(*)::int AS n FROM bot_configs WHERE is_active = true'),
      db.pool.query(`SELECT COUNT(*)::int AS n FROM execution_logs WHERE status = 'success' AND holder_count > 0`),
      db.pool.query(`SELECT COALESCE(SUM(claimed_eth_wei), 0)::text AS sum FROM execution_logs WHERE status = 'success' AND holder_count > 0`),
    ]);
    res.json({
      totalUsers: u.rows[0].n,
      activeConfigs: c.rows[0].n,
      totalExecutions: e.rows[0].n,
      totalEthClaimed: (Number(s.rows[0].sum) / 1e18).toFixed(4),
      stocksAvailable: STOCKS.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dashboard/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    if (!isAddress(tokenAddress)) return res.status(400).json({ error: 'Invalid address' });
    const config = await db.getBotConfigBySourceToken(tokenAddress);
    if (!config) return res.status(404).json({ error: 'Token not found', message: 'No active Boomerang configuration for this token' });
    const stats = await db.getTokenStats(tokenAddress);
    const recentExecutions = await db.getRecentExecutions(tokenAddress, 10);
    res.json({
      sourceToken: { address: config.source_token_address },
      targetToken: { address: config.target_token_address },
      stats: {
        totalAirdropped: stats.total_airdropped || '0',
        totalBoughtBack: stats.total_bought_back || '0',
        totalEthClaimed: stats.total_eth_claimed || '0',
        totalExecutions: stats.execution_count || 0,
        lastExecution: stats.last_execution,
      },
      recentExecutions: recentExecutions.map((e) => ({
        id: e.id, claimedEth: e.claimed_eth_wei, boughtTokens: e.bought_token_amount, totalAirdropped: e.total_airdropped,
        holderCount: e.holder_count, executionTime: e.execution_time, status: e.status, rewardToken: e.reward_token_used, swapTx: e.swap_tx,
      })),
      config: {
        intervalMinutes: config.interval_minutes, scheduleKind: config.schedule_kind, isActive: config.is_active,
        rewardMode: config.reward_mode, basket: config.basket, destination: config.destination, marketHoursOnly: config.market_hours_only,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
