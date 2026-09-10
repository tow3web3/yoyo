// The holders lottery, read side and entry. The draw and the payout live in the
// backend (services/lottery.js); this is what the page and its API need.
import { getSql } from './db';
import { rpc } from './evm';

export const LOTTERY_TOKEN = (process.env.NEXT_PUBLIC_BOOMERANG_CA || process.env.BOOMERANG_TOKEN_ADDRESS || '').toLowerCase() || null;
const BLOCKS_PER_HOUR = 36_000; // Robinhood Chain, ~10 blocks a second
const erc20 = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
];

export async function currentRound(token = LOTTERY_TOKEN) {
  if (!token) return null;
  const sql = getSql();
  const [round] = await sql`SELECT * FROM lottery_rounds WHERE token = ${token} AND status = 'open' ORDER BY id DESC LIMIT 1`;
  if (!round) return null;
  const [fees] = await sql`SELECT COALESCE(SUM(claimed_eth_wei), 0)::text AS f FROM execution_logs WHERE config_id = ${round.config_id} AND status = 'success' AND execution_time >= ${round.opens_at}`;
  const [n] = await sql`SELECT COUNT(*)::int AS n FROM lottery_entries WHERE round_id = ${round.id} AND disqualified_at IS NULL`;
  const prizeWei = (BigInt(fees.f) * BigInt(round.prize_bps)) / 10000n + BigInt(round.carry_wei || 0);
  return {
    id: round.id, opensAt: round.opens_at, drawsAt: round.draws_at, minHold: Number(round.min_hold), minHours: Number(round.min_hours), prizeBps: Number(round.prize_bps),
    feesWei: fees.f, prizeWei: prizeWei.toString(), carryWei: String(round.carry_wei || 0), entries: n.n,
  };
}

export async function pastRounds(token = LOTTERY_TOKEN, limit = 10) {
  if (!token) return [];
  const sql = getSql();
  return sql`SELECT id, status, winner, prize_wei::text AS prize_wei, tx_hash, entries_count, eligible_count, drawn_at, draws_at FROM lottery_rounds WHERE token = ${token} AND status <> 'open' ORDER BY id DESC LIMIT ${limit}`;
}

/** Can this wallet enter now? Balance from chain, holding time from the holder ledger. */
export async function eligibility(wallet, round) {
  const w = wallet.toLowerCase();
  const client = rpc();
  const [raw, decimals, head] = await Promise.all([
    client.readContract({ address: round.token || LOTTERY_TOKEN, abi: erc20, functionName: 'balanceOf', args: [w] }),
    client.readContract({ address: round.token || LOTTERY_TOKEN, abi: erc20, functionName: 'decimals' }),
    client.getBlockNumber(),
  ]);
  const balance = Number(raw) / 10 ** Number(decimals);
  const sql = getSql();
  const [ledger] = await sql`SELECT since_block, last_out_block, balance::text AS bal FROM holder_balances WHERE token = ${round.token || LOTTERY_TOKEN} AND address = ${w}`;
  let since = ledger?.since_block != null ? BigInt(ledger.since_block) : null;
  if (ledger?.last_out_block != null && (since == null || BigInt(ledger.last_out_block) > since)) since = BigInt(ledger.last_out_block);
  const heldHours = since == null ? null : Number(head - since) / BLOCKS_PER_HOUR;
  const reasons = [];
  if (balance < round.minHold) reasons.push(`You hold ${Math.floor(balance).toLocaleString()}, the minimum is ${round.minHold.toLocaleString()}.`);
  if (heldHours == null) reasons.push(balance >= round.minHold ? 'Your wallet is not in the holder ledger yet. It is refreshed every cycle, every 30 minutes: come back after the next one.' : '');
  else if (heldHours < round.minHours) reasons.push(`Held for ${heldHours < 1 ? `${Math.floor(heldHours * 60)} min` : `${heldHours.toFixed(1)}h`}, the minimum is ${round.minHours}h. Selling or sending resets the clock.`);
  return { wallet: w, balance, balanceRaw: raw.toString(), heldHours, headBlock: head.toString(), ok: reasons.filter(Boolean).length === 0, reasons: reasons.filter(Boolean) };
}

export async function myEntry(roundId, wallet) {
  const sql = getSql();
  const [e] = await sql`SELECT wallet, entered_at, balance_at_entry::text AS balance_at_entry, disqualified_at, reason FROM lottery_entries WHERE round_id = ${roundId} AND wallet = ${wallet.toLowerCase()}`;
  return e || null;
}

export async function enter(round, elig) {
  const sql = getSql();
  const [row] = await sql`
    INSERT INTO lottery_entries (round_id, wallet, balance_at_entry, entered_block, entered_at)
    VALUES (${round.id}, ${elig.wallet}, ${elig.balanceRaw}, ${elig.headBlock}, NOW())
    ON CONFLICT (round_id, wallet) DO UPDATE SET wallet = EXCLUDED.wallet
    RETURNING wallet, entered_at`;
  return row;
}
