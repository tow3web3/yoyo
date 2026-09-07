import { getSql } from './db';

// Community Vote reads/writes. Addresses are stored lowercase.

export async function getCycleByToken(tokenAddress) {
  const sql = getSql();
  const addr = tokenAddress.toLowerCase();
  const [cycle] = await sql`
    SELECT vc.*, bc.source_token_address, bc.vote_safety_mode
    FROM vote_cycles vc JOIN bot_configs bc ON vc.config_id = bc.id
    WHERE bc.source_token_address = ${addr} AND bc.is_active = true AND bc.reward_mode = 'vote' AND vc.status = 'open'
    ORDER BY vc.id DESC LIMIT 1
  `;
  if (!cycle) return null;
  const options = await sql`
    SELECT o.id, o.token_address, o.proposed_by, COALESCE(SUM(v.weight), 0)::text AS weight, COUNT(v.voter_address)::int AS voters
    FROM vote_options o LEFT JOIN votes v ON v.option_id = o.id
    WHERE o.cycle_id = ${cycle.id}
    GROUP BY o.id ORDER BY weight DESC, o.id ASC
  `;
  return { cycle, options };
}

export async function getSnapshotWeight(cycleId, wallet) {
  const sql = getSql();
  const [row] = await sql`SELECT weight::text FROM vote_snapshots WHERE cycle_id = ${cycleId} AND holder_address = ${wallet.toLowerCase()}`;
  return row ? row.weight : '0';
}

export async function castVote(cycleId, wallet, optionId, weight) {
  const sql = getSql();
  await sql`
    INSERT INTO votes (cycle_id, voter_address, option_id, weight) VALUES (${cycleId}, ${wallet.toLowerCase()}, ${optionId}, ${weight})
    ON CONFLICT (cycle_id, voter_address) DO UPDATE SET option_id = ${optionId}, weight = ${weight}, created_at = NOW()
  `;
}

export async function getOption(cycleId, optionId) {
  const sql = getSql();
  const [row] = await sql`SELECT id, token_address FROM vote_options WHERE id = ${optionId} AND cycle_id = ${cycleId} AND passed_filters = true`;
  return row || null;
}

export async function getActiveCycles() {
  const sql = getSql();
  return await sql`
    SELECT vc.id AS cycle_id, bc.source_token_address AS token, vc.ends_at, o.token_address AS option_token,
           COALESCE(SUM(v.weight), 0)::text AS weight, COUNT(v.voter_address)::int AS voters
    FROM vote_cycles vc
    JOIN bot_configs bc ON bc.id = vc.config_id AND bc.is_active = true AND bc.reward_mode = 'vote'
    LEFT JOIN vote_options o ON o.cycle_id = vc.id
    LEFT JOIN votes v ON v.option_id = o.id
    WHERE vc.status = 'open'
    GROUP BY vc.id, bc.source_token_address, vc.ends_at, o.token_address
    ORDER BY vc.ends_at ASC, weight DESC
  `;
}

export async function getEligibility(wallet) {
  const sql = getSql();
  const w = wallet.toLowerCase();
  return await sql`
    SELECT bc.source_token_address AS token, vc.id AS cycle_id, vc.ends_at, s.weight::text AS weight,
           (SELECT option_id FROM votes v WHERE v.cycle_id = vc.id AND v.voter_address = ${w}) AS voted_option_id
    FROM vote_snapshots s
    JOIN vote_cycles vc ON vc.id = s.cycle_id AND vc.status = 'open'
    JOIN bot_configs bc ON bc.id = vc.config_id AND bc.is_active = true AND bc.reward_mode = 'vote'
    WHERE s.holder_address = ${w} AND s.weight > 0
    ORDER BY vc.ends_at ASC
  `;
}
