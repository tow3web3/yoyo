// Run one cycle for a config id: node scripts/test-run.mjs <configId>
import dotenv from 'dotenv';
import pool from '../src/db/connection.js';
import * as db from '../src/db/queries.js';
import { executeBotConfig } from '../src/scheduler/executor.js';

dotenv.config();

const configId = Number(process.argv[2]) || 1;

try {
  const result = await pool.query('SELECT * FROM bot_configs WHERE id = $1', [configId]);
  const config = result.rows[0];
  if (!config) {
    console.error(`No config found for id ${configId}`);
    process.exit(1);
  }
  console.log(`Testing config ${config.id}: ${config.source_token_address}`);
  await executeBotConfig(config, { force: true });
  console.log('\nLatest execution log:');
  console.log(JSON.stringify(await db.getLastExecutionLog(config.id), null, 2));
} catch (error) {
  console.error('Test run failed:', error);
  process.exit(1);
} finally {
  await pool.end();
}
