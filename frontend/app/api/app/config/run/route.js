import { sessionUser } from '../../../../../lib/session';
import { getConfigForUser } from '../../../../../lib/appQueries';
import { runNow } from '../../../../../lib/internal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await sessionUser();
  if (!user) return Response.json({ error: 'Not logged in' }, { status: 401 });
  const config = await getConfigForUser(user.id);
  if (!config) return Response.json({ error: 'No Boomerang yet' }, { status: 404 });
  if (!config.is_active) return Response.json({ error: 'Resume the bot first' }, { status: 409 });
  const r = await runNow(config.id);
  if (!r.ok) return Response.json({ error: r.error || 'The scheduler did not answer. It will run on schedule.' }, { status: 502 });
  return Response.json({ ok: true });
}
