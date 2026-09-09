// Webhooks to launchpads. Every event is a JSON POST signed with HMAC-SHA256
// over the raw body using the launchpad's webhook secret (header
// X-Yoyo-Signature: sha256=<hex>), plus X-Yoyo-Event and a timestamp.
// Delivery is best effort with one retry; failures never affect the cycle.
import crypto from 'crypto';
import * as db from '../db/queries.js';

const FRONTEND = process.env.FRONTEND_URL || process.env.WEBSITE_URL || 'https://boomerang.fun';

export function sign(secret, body) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function post(launchpad, event, payload) {
  const body = JSON.stringify({ event, sentAt: new Date().toISOString(), ...payload });
  const headers = { 'Content-Type': 'application/json', 'X-Yoyo-Event': event, 'User-Agent': 'Yoyo-Webhooks/1.0' };
  if (launchpad.webhook_secret) headers['X-Yoyo-Signature'] = sign(launchpad.webhook_secret, body);
  let status = 0;
  let ok = false;
  for (let attempt = 0; attempt < 2 && !ok; attempt++) {
    try {
      const res = await fetch(launchpad.webhook_url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10_000) });
      status = res.status;
      ok = res.ok;
    } catch {
      status = 0;
    }
    if (!ok) await new Promise((r) => setTimeout(r, 2000));
  }
  await db.recordWebhookDelivery(launchpad.id, event, status, ok).catch(() => {});
  console.log(`   Webhook ${event} to ${launchpad.slug}: ${ok ? 'delivered' : `failed (${status})`}`);
  return ok;
}

/** Fire an event for a config linked through a launchpad; no-op otherwise. */
export async function emitForConfig(config, event, payload) {
  if (!config.launchpad_id) return;
  try {
    const lp = await db.getLaunchpad(config.launchpad_id);
    if (!lp?.webhook_url) return;
    await post(lp, event, {
      token: config.source_token_address,
      launchCode: config.launch_code || null,
      dashboardUrl: `${FRONTEND}/${config.source_token_address}`,
      badgeUrl: `${FRONTEND}/api/badge/${config.source_token_address}`,
      ...payload,
    });
  } catch (e) {
    console.error('   Webhook error:', e.message);
  }
}
