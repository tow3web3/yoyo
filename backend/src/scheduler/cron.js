import cron from 'node-cron';
import * as db from '../db/queries.js';
import { executeBotConfig } from './executor.js';
import { tickVoteCycles } from '../services/voteService.js';
import { tickMissionClaims } from '../services/missionPayout.js';
import { tickLottery } from '../services/lottery.js';
import { cronFor } from '../services/schedule.js';

const activeCronJobs = new Map();

export async function initScheduler() {
  const activeConfigs = await db.getActiveBotConfigs();
  console.log(`   Found ${activeConfigs.length} active configurations`);
  for (const config of activeConfigs) scheduleConfig(config);

  cron.schedule('*/5 * * * *', async () => {
    await refreshScheduler();
  });

  cron.schedule('*/5 * * * *', async () => {
    try { await tickVoteCycles(); } catch (e) { console.error('Vote cycle tick failed:', e.message); }
  });
  tickVoteCycles().catch((e) => console.error('Initial vote tick failed:', e.message));

  cron.schedule('*/2 * * * *', async () => {
    try { await tickMissionClaims(); } catch (e) { console.error('Mission payout tick failed:', e.message); }
  });

  cron.schedule('* * * * *', async () => {
    try { await tickLottery(); } catch (e) { console.error('Lottery tick failed:', e.message); }
  });
  tickLottery().catch((e) => console.error('Initial lottery tick failed:', e.message));
}

export function scheduleConfig(config) {
  const configId = config.id;
  if (activeCronJobs.has(configId)) {
    activeCronJobs.get(configId).stop();
    activeCronJobs.delete(configId);
  }
  if (!config.is_active) {
    console.log(`   Config ${configId} is paused`);
    return;
  }
  const { expression, timezone } = cronFor(config);
  console.log(`   Scheduling config ${configId}: ${expression}${timezone ? ` (${timezone})` : ''}`);
  const job = cron.schedule(expression, async () => {
    try {
      await executeBotConfig(config);
    } catch (error) {
      console.error(`Error executing config ${configId}:`, error);
    }
  }, timezone ? { timezone } : undefined);
  activeCronJobs.set(configId, job);
}

export async function refreshScheduler() {
  try {
    const activeConfigs = await db.getActiveBotConfigs();
    const ids = new Set(activeConfigs.map((c) => c.id));
    for (const [configId, job] of activeCronJobs.entries()) {
      if (!ids.has(configId)) { job.stop(); activeCronJobs.delete(configId); }
    }
    for (const config of activeConfigs) scheduleConfig(config);
  } catch (error) {
    console.error('Error refreshing scheduler:', error);
  }
}

export function getSchedulerStatus() {
  return { activeJobs: activeCronJobs.size, configIds: Array.from(activeCronJobs.keys()) };
}

export function stopScheduler() {
  for (const job of activeCronJobs.values()) job.stop();
  activeCronJobs.clear();
}
