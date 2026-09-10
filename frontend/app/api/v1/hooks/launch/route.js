// Launchpad hook. POST (Bearer <apiKey>) with a token address: returns a
// Telegram deep link that prefills the creator's yo-yo setup, plus the
// dashboard and badge URLs the launchpad can show immediately.
import { parseAbi } from 'viem';
import { getSql } from '../../../../../lib/db';
import { apiJson, apiOptions } from '../../../../../lib/apiResponse';
import { bearer, launchpadByKey, launchCode } from '../../../../../lib/hooks';
import { rpc } from '../../../../../lib/evm';
import { EVM_ADDR, getStock } from '../../../../../lib/stocks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const erc20 = parseAbi(['function symbol() view returns (string)', 'function name() view returns (string)']);
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
const BOT = process.env.NEXT_PUBLIC_BOT_USERNAME || 'yoyotek_bot';

export function OPTIONS() {
  return apiOptions();
}

export async function POST(request) {
  try {
    const lp = await launchpadByKey(bearer(request));
    if (!lp) return apiJson({ error: 'Unauthorized: send Authorization: Bearer <apiKey>' }, 401);
    const body = await request.json();
    const token = String(body.token || '').trim();
    if (!EVM_ADDR.test(token)) return apiJson({ error: 'token must be a 0x address on Robinhood Chain' }, 400);
    const creatorWallet = body.creatorWallet && EVM_ADDR.test(body.creatorWallet) ? body.creatorWallet.toLowerCase() : null;
    const feeSource = ['wallet', 'univ3'].includes(body.feeSource) ? body.feeSource : null;
    let suggestedReward = null;
    if (body.reward) {
      const s = getStock(body.reward);
      if (s) suggestedReward = s.address.toLowerCase();
      else if (EVM_ADDR.test(body.reward)) suggestedReward = String(body.reward).toLowerCase();
    }

    let symbol = null;
    let name = null;
    try {
      [symbol, name] = await Promise.all([
        rpc().readContract({ address: token, abi: erc20, functionName: 'symbol' }),
        rpc().readContract({ address: token, abi: erc20, functionName: 'name' }).catch(() => null),
      ]);
    } catch {
      return apiJson({ error: 'No ERC-20 found at that address on Robinhood Chain' }, 422);
    }

    const sql = getSql();
    // One pending link per launchpad + token; re-posting returns the existing one.
    const [existing] = await sql`SELECT code, status FROM launch_links WHERE launchpad_id = ${lp.id} AND token = ${token.toLowerCase()} ORDER BY created_at DESC LIMIT 1`;
    let code = existing?.status === 'pending' ? existing.code : null;
    if (!code) {
      code = launchCode();
      await sql`INSERT INTO launch_links (code, launchpad_id, token, creator_wallet, fee_source, suggested_reward) VALUES (${code}, ${lp.id}, ${token.toLowerCase()}, ${creatorWallet}, ${feeSource}, ${suggestedReward})`;
    }
    return apiJson({
      code,
      status: existing?.status === 'linked' ? 'linked' : 'pending',
      token: { address: token.toLowerCase(), symbol: String(symbol), name: name ? String(name) : null },
      telegramUrl: `https://t.me/${BOT}?start=l_${code}`,
      dashboardUrl: `${SITE}/${token.toLowerCase()}`,
      badgeUrl: `${SITE}/api/badge/${token.toLowerCase()}`,
      statusUrl: `${SITE}/api/v1/hooks/launch?code=${code}`,
    }, 201);
  } catch (error) {
    return apiJson({ error: error.message }, 500);
  }
}

/** GET ?code=XXXX: status of a launch link (pending | linked) and, once linked, the config summary. */
export async function GET(request) {
  try {
    const code = new URL(request.url).searchParams.get('code') || '';
    if (!/^[A-Z2-9]{6,16}$/.test(code)) return apiJson({ error: 'code required' }, 400);
    const sql = getSql();
    const [row] = await sql`
      SELECT ll.code, ll.status, ll.token, ll.created_at, ll.linked_at, lp.slug AS launchpad,
             bc.is_active, bc.reward_mode, bc.target_token_address, bc.schedule_kind, bc.interval_minutes
      FROM launch_links ll LEFT JOIN launchpads lp ON lp.id = ll.launchpad_id LEFT JOIN bot_configs bc ON bc.id = ll.config_id
      WHERE ll.code = ${code}
    `;
    if (!row) return apiJson({ error: 'Unknown code' }, 404);
    return apiJson({
      code: row.code, status: row.status, token: row.token, launchpad: row.launchpad, createdAt: row.created_at, linkedAt: row.linked_at,
      config: row.status === 'linked' ? { active: row.is_active, rewardMode: row.reward_mode, rewardToken: row.target_token_address, scheduleKind: row.schedule_kind, intervalMinutes: row.interval_minutes } : null,
      dashboardUrl: `${SITE}/${row.token}`,
      badgeUrl: `${SITE}/api/badge/${row.token}`,
    });
  } catch (error) {
    return apiJson({ error: error.message }, 500);
  }
}
