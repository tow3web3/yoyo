import { getActiveCycles } from '../../../../lib/voteQueries';
import { fetchTokenMeta } from '../../../../lib/tokenMeta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await getActiveCycles();
    const byCycle = new Map();
    for (const r of rows) {
      if (!byCycle.has(r.cycle_id)) byCycle.set(r.cycle_id, { cycleId: r.cycle_id, token: r.token, endsAt: r.ends_at, totalWeight: 0, voters: 0, options: [] });
      const c = byCycle.get(r.cycle_id);
      if (r.option_token) {
        c.options.push({ token: r.option_token, weight: Number(r.weight) });
        c.totalWeight += Number(r.weight);
        c.voters += r.voters;
      }
    }
    const cycles = [...byCycle.values()];
    const meta = await fetchTokenMeta(cycles.flatMap((c) => [c.token, ...c.options.map((o) => o.token)]));
    const sym = (m) => meta[m]?.symbol || null;
    return Response.json({
      count: cycles.length,
      votes: cycles.map((c) => {
        const leader = c.options.slice().sort((a, b) => b.weight - a.weight)[0];
        return {
          cycleId: c.cycleId, token: c.token, symbol: sym(c.token), image: meta[c.token]?.image || null,
          endsAt: c.endsAt, voters: c.voters, totalWeight: String(c.totalWeight),
          leader: leader && leader.weight > 0 ? { symbol: sym(leader.token), image: meta[leader.token]?.image || null, share: c.totalWeight > 0 ? leader.weight / c.totalWeight : 0 } : null,
          optionCount: c.options.length,
        };
      }),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
