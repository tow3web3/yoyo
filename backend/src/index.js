import express from 'express';
import dotenv from 'dotenv';
import { initBot } from './bot/telegram.js';
import { initScheduler } from './scheduler/cron.js';
import routes from './api/routes.js';
import * as middleware from './api/middleware.js';
import pool from './db/connection.js';
import { RPC_URL, publicClient } from './chain/config.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// A stray RPC error must never take the scheduler down; the affected config
// simply retries on its next cycle.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection (process kept alive):', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (process kept alive):', err?.message || err);
});

app.use(express.json());
app.use(middleware.cors);
app.use(middleware.requestLogger);
app.use('/api', routes);
app.use(middleware.notFoundHandler);
app.use(middleware.errorHandler);

async function start() {
  try {
    console.log('Starting yo-yo (Robinhood Chain)');
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   RPC: ${RPC_URL.replace(/\/v2\/.*$/, '/v2/***')}`);

    await pool.query('SELECT NOW()');
    console.log('Database connected');

    try {
      const chainId = await publicClient().getChainId();
      if (chainId !== 4663) console.warn(`Warning: RPC reports chain id ${chainId}, expected 4663`);
      else console.log('Robinhood Chain reachable (4663)');
    } catch (e) {
      console.warn('RPC check failed:', e.message);
    }

    app.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT} (health: /api/health)`);
    });

    const bot = initBot();
    bot.launch()
      .then(() => console.log('Telegram bot started'))
      .catch((error) => {
        console.error('Telegram bot failed to start:', error.message);
        console.log('   The API and scheduler keep running without the bot');
      });

    await initScheduler();
    console.log('Scheduler started. yo-yo is running.');

    process.once('SIGINT', () => gracefulShutdown(bot));
    process.once('SIGTERM', () => gracefulShutdown(bot));
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

async function gracefulShutdown(bot) {
  console.log('\nShutting down');
  try {
    await bot.stop();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

start();
