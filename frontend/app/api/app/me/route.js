// Everything the dashboard needs in one call: user, config, wallet assets,
// recent cycles, token metadata, yield.
import { sessionUser } from '../../../../lib/session';
import { getConfigForUser, recentLogsForConfig, getLegs } from '../../../../lib/appQueries';
import { walletAssets } from '../../../../lib/walletAssets';
import { fetchTokenMeta } from '../../../../lib/tokenMeta';
import { tokenYield } from '../../../../lib/yield';
import { scheduleLabel } from '../../../../lib/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function publicConfig(c) {
  if (!c) return null;
  const { dev_wallet_encrypted, ...rest } = c;
  void dev_wallet_encrypted;
  return { ...rest, scheduleLabel: scheduleLabel(c) };
}

export async function GET() {
  try {
    const user = await sessionUser();
    if (!user) return Response.json({ user: null }, { status: 401 });
    const config = await getConfigForUser(user.id);
    let assets = null;
    let logs = [];
    let meta = {};
    let yieldStats = null;
    let legs = [];
    if (config) {
      const [a, l, lg] = await Promise.all([
        walletAssets(config.dev_wallet_public, BigInt(config.gas_reserve_wei || 0)).catch((e) => ({ error: e.message, assets: [] })),
        recentLogsForConfig(config.id),
        getLegs(config.id),
      ]);
      assets = a;
      logs = l;
      legs = lg;
      meta = await fetchTokenMeta([config.source_token_address, config.target_token_address, config.treasury_asset, ...legs.map((x) => x.asset), ...logs.flatMap((x) => [x.reward_token_used, x.asset_token, x.treasury_token, ...((x.legs || []).flatMap((y) => [y.output?.token, y.input?.token]))])]);
      yieldStats = await tokenYield(config.source_token_address, meta[config.source_token_address]?.marketCap ?? null).catch(() => null);
    }
    return Response.json({
      user: { id: user.id, wallet: user.wallet_address, telegramLinked: Boolean(user.telegram_id), telegramUsername: user.username || null },
      config: publicConfig(config),
      legs,
      assets,
      logs,
      meta,
      yield: yieldStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
