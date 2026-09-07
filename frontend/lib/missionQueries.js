import { getSql } from './db';

const lc = (w) => String(w || '').toLowerCase();

export async function listMissions() {
  const sql = getSql();
  return await sql`
    SELECT id, slug, title, description, type, params, reward_token, reward_amount::text, total_budget::text, spent::text, per_wallet_limit, COALESCE(xp, 0) AS xp
    FROM missions WHERE active = true ORDER BY id ASC
  `;
}

export async function touchUser(wallet) {
  const sql = getSql();
  const [r] = await sql`
    INSERT INTO mission_users (wallet, first_seen, last_seen) VALUES (${lc(wallet)}, NOW(), NOW())
    ON CONFLICT (wallet) DO UPDATE SET last_seen = NOW() RETURNING first_seen
  `;
  return r?.first_seen || null;
}

export async function getTotalXp(wallet) {
  const sql = getSql();
  const [r] = await sql`
    SELECT COALESCE(SUM(m.xp), 0)::int AS xp, COUNT(*)::int AS done
    FROM mission_completions c JOIN missions m ON m.id = c.mission_id WHERE c.wallet = ${lc(wallet)}
  `;
  return { xp: r?.xp || 0, done: r?.done || 0 };
}

export async function getCompletions(wallet) {
  const sql = getSql();
  return await sql`SELECT mission_id, status, reward_amount::text, payout_tx FROM mission_completions WHERE wallet = ${lc(wallet)}`;
}

export async function getMission(id) {
  const sql = getSql();
  const [m] = await sql`SELECT * FROM missions WHERE id = ${id} AND active = true`;
  return m || null;
}

export async function hasCompleted(missionId, wallet) {
  const sql = getSql();
  const [r] = await sql`SELECT 1 FROM mission_completions WHERE mission_id = ${missionId} AND wallet = ${lc(wallet)}`;
  return Boolean(r);
}

export async function recordCompletion(mission, wallet) {
  const sql = getSql();
  const [m] = await sql`SELECT spent::text, total_budget::text, reward_amount::text FROM missions WHERE id = ${mission.id}`;
  if (BigInt(m.spent) + BigInt(m.reward_amount) > BigInt(m.total_budget)) throw new Error('Mission budget exhausted');
  await sql`
    INSERT INTO mission_completions (mission_id, wallet, status, reward_token, reward_amount)
    VALUES (${mission.id}, ${lc(wallet)}, 'verified', ${mission.reward_token}, ${mission.reward_amount})
    ON CONFLICT (mission_id, wallet) DO NOTHING
  `;
  await sql`UPDATE missions SET spent = spent + ${mission.reward_amount} WHERE id = ${mission.id}`;
}

export async function getClaimable(wallet) {
  const sql = getSql();
  return await sql`
    SELECT reward_token, COALESCE(SUM(reward_amount), 0)::text AS amount, COUNT(*)::int AS n
    FROM mission_completions WHERE wallet = ${lc(wallet)} AND status = 'verified' GROUP BY reward_token
  `;
}

export async function markClaiming(wallet) {
  const sql = getSql();
  const rows = await sql`UPDATE mission_completions SET status = 'claiming' WHERE wallet = ${lc(wallet)} AND status = 'verified' RETURNING id`;
  return rows.length;
}

export async function hasVoted(wallet) {
  const sql = getSql();
  const [r] = await sql`SELECT 1 FROM votes WHERE voter_address = ${lc(wallet)} LIMIT 1`;
  return Boolean(r);
}

export async function isCustomer(wallet) {
  const sql = getSql();
  const [r] = await sql`SELECT 1 FROM bot_configs WHERE dev_wallet_public = ${lc(wallet)} AND is_active = true LIMIT 1`;
  return Boolean(r);
}

export async function getVoteCount(wallet) {
  const sql = getSql();
  const [r] = await sql`SELECT COUNT(DISTINCT cycle_id)::int AS n FROM votes WHERE voter_address = ${lc(wallet)}`;
  return r?.n || 0;
}

export async function hasMode(wallet, mode) {
  const sql = getSql();
  const [r] = await sql`SELECT 1 FROM bot_configs WHERE dev_wallet_public = ${lc(wallet)} AND is_active = true AND reward_mode = ${mode} LIMIT 1`;
  return Boolean(r);
}
