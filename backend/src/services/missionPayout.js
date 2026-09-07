import pool from '../db/connection.js';
import { distributeEth, distributeTokens } from './airdrop.js';
import { isNative } from '../chain/config.js';

/**
 * Pay claimed mission rewards from the treasury wallet: rows marked 'claiming'
 * are grouped per token, one transfer per wallet, then marked paid.
 */
export async function tickMissionClaims() {
  const treasuryKey = process.env.TREASURY_PRIVATE_KEY;
  if (!treasuryKey) return;

  const { rows } = await pool.query(`SELECT id, wallet, reward_token, reward_amount::text FROM mission_completions WHERE status = 'claiming'`);
  if (!rows.length) return;

  const byToken = {};
  for (const r of rows) (byToken[r.reward_token] ??= []).push(r);

  for (const [token, comps] of Object.entries(byToken)) {
    const byWallet = {};
    for (const c of comps) {
      byWallet[c.wallet] ??= { amount: 0n, ids: [] };
      byWallet[c.wallet].amount += BigInt(c.reward_amount);
      byWallet[c.wallet].ids.push(c.id);
    }
    const distributions = Object.entries(byWallet).map(([address, v]) => ({ address, amount: v.amount, holderBalance: 0n }));
    let results;
    try {
      console.log(`Paying ${distributions.length} mission claim(s) in ${isNative(token) ? 'ETH' : token}`);
      results = isNative(token) ? await distributeEth(treasuryKey, distributions) : await distributeTokens(treasuryKey, token, distributions);
    } catch (e) {
      console.error('Mission payout batch failed (will retry):', e.message);
      continue;
    }
    for (const s of results.successful) {
      const ids = byWallet[s.address]?.ids || [];
      if (ids.length) {
        await pool.query(`UPDATE mission_completions SET status = 'paid', payout_tx = $1, paid_at = NOW() WHERE id = ANY($2)`, [s.hash, ids]);
      }
    }
  }
}
