// GET: public list of integrated launchpads. POST (admin): register one and
// return its API key and webhook secret exactly once.
import { getSql } from '../../../../lib/db';
import { apiJson, apiOptions } from '../../../../lib/apiResponse';
import { adminOk, sha256, randomKey } from '../../../../lib/hooks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return apiOptions();
}

export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT lp.slug, lp.name, lp.website, lp.created_at,
             (SELECT COUNT(*)::int FROM launch_links ll WHERE ll.launchpad_id = lp.id) AS launches,
             (SELECT COUNT(*)::int FROM bot_configs bc WHERE bc.launchpad_id = lp.id AND bc.is_active = true) AS linked_tokens
      FROM launchpads lp ORDER BY linked_tokens DESC, lp.created_at ASC
    `;
    return apiJson({ count: rows.length, launchpads: rows.map((r) => ({ slug: r.slug, name: r.name, website: r.website, launches: r.launches, linkedTokens: r.linked_tokens, since: r.created_at })) });
  } catch (error) {
    return apiJson({ error: error.message }, 500);
  }
}

export async function POST(request) {
  if (!adminOk(request)) return apiJson({ error: 'Unauthorized' }, 401);
  try {
    const body = await request.json();
    const slug = String(body.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32);
    const name = String(body.name || '').trim().slice(0, 80);
    if (!slug || !name) return apiJson({ error: 'slug and name required' }, 400);
    const webhookUrl = body.webhookUrl && /^https:\/\//.test(body.webhookUrl) ? String(body.webhookUrl).slice(0, 500) : null;
    const website = body.website ? String(body.website).slice(0, 200) : null;
    const apiKey = randomKey('bmr');
    const webhookSecret = randomKey('whsec');
    const sql = getSql();
    const [row] = await sql`
      INSERT INTO launchpads (slug, name, website, api_key_hash, webhook_url, webhook_secret)
      VALUES (${slug}, ${name}, ${website}, ${sha256(apiKey)}, ${webhookUrl}, ${webhookSecret})
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, website = EXCLUDED.website, api_key_hash = EXCLUDED.api_key_hash, webhook_url = EXCLUDED.webhook_url, webhook_secret = EXCLUDED.webhook_secret
      RETURNING id, slug, name
    `;
    return apiJson({ launchpad: row, apiKey, webhookSecret, note: 'Store both now: they are not shown again. Rotating = POST again with the same slug.' }, 201);
  } catch (error) {
    return apiJson({ error: error.message }, 500);
  }
}
