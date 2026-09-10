import { sessionUser } from '../../../../lib/session';
import { setLinkCode } from '../../../../lib/appQueries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const BOT = process.env.NEXT_PUBLIC_BOT_USERNAME || 'yoyotek_bot';

export async function POST() {
  const user = await sessionUser();
  if (!user) return Response.json({ error: 'Not logged in' }, { status: 401 });
  const code = await setLinkCode(user.id);
  return Response.json({ code, url: `https://t.me/${BOT}?start=w_${code}` });
}
