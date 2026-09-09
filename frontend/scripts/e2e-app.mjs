// End-to-end check of the creator dashboard API against a running site:
//   node scripts/e2e-app.mjs https://boomerang.65-20-103-177.sslip.io
// Logs in with a throwaway wallet, creates a yo-yo on a real token with a
// generated dev wallet, edits the policy, runs a cycle, screenshots, deletes.
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const BASE = (process.argv[2] || 'http://localhost:3001').replace(/\/$/, '');
const TOKEN = process.argv[3] || '0x322F0929c4625eD5bAd873c95208D54E1c003b2d'; // TSLA
let cookie = '';
const api = async (path, opts = {}) => {
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', cookie, ...(opts.headers || {}) } });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};
const check = (label, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${extra ? ` ${extra}` : ''}`); if (!ok) process.exitCode = 1; };

const account = privateKeyToAccount(generatePrivateKey());
const { data: n } = await api('/api/app/auth/nonce');
const message = `yo-yo dashboard login\nChain: Robinhood Chain (4663)\nWallet: ${account.address}\nNonce: ${n.nonce}\nIssued: ${n.issuedAt}\n\nThis signature costs no gas and only proves you own this wallet.`;
const signature = await account.signMessage({ message });
let r = await api('/api/app/auth/login', { method: 'POST', body: JSON.stringify({ wallet: account.address, nonce: n.nonce, issuedAt: n.issuedAt, signature }) });
check('login', r.status === 200 && r.data.ok, JSON.stringify(r.data));
r = await api('/api/app/auth/login', { method: 'POST', body: JSON.stringify({ wallet: account.address, nonce: n.nonce, issuedAt: n.issuedAt, signature }) });
check('nonce replay rejected', r.status === 400);

r = await api('/api/app/me');
check('me (no config)', r.status === 200 && r.data.user && r.data.config === null, `wallet ${r.data.user?.wallet}`);

r = await api(`/api/app/token?address=${TOKEN}`);
check('token check', r.status === 200 && r.data.symbol, `${r.data.symbol}`);

r = await api('/api/app/config', { method: 'POST', body: JSON.stringify({
  sourceToken: TOKEN, wallet: { mode: 'generate' }, reward: 'NVDA', rewardMode: 'fixed', scheduleKind: 'closing_bell', feeSource: 'wallet',
  split: { holders: 7000, creator: 2000, burn: 0, treasury: 1000 }, creatorAddress: account.address, treasuryAddress: account.address, payoutMode: 'in_kind',
  loyalty: { enabled: true, minHoldHours: 24, rampDays: 30, maxBps: 20000, sellReset: true },
}) });
check('create config (generated wallet)', r.status === 201 && r.data.generated && /^0x[0-9a-fA-F]{40}$/.test(r.data.devWallet), `dev ${r.data.devWallet} ${r.data.symbol || ''} ${r.data.error || ''}`);

r = await api('/api/app/me');
check('me (config + assets)', r.status === 200 && r.data.config && Array.isArray(r.data.assets?.assets), `split ${r.data.config?.split_holders_bps}/${r.data.config?.split_creator_bps}/${r.data.config?.split_burn_bps}/${r.data.config?.split_treasury_bps} assets ${r.data.assets?.assets?.length}`);

r = await api('/api/app/config', { method: 'PATCH', body: JSON.stringify({ split_holders_bps: 8000, split_creator_bps: 2000, split_burn_bps: 0, split_treasury_bps: 0, loyalty_max_bps: 30000, schedule_kind: 'interval', interval_minutes: 30 }) });
check('patch policy + loyalty + schedule', r.status === 200 && r.data.config?.split_holders_bps === 8000 && r.data.config?.loyalty_max_bps === 30000 && r.data.config?.interval_minutes === 30, r.data.error || '');
r = await api('/api/app/config', { method: 'PATCH', body: JSON.stringify({ split_holders_bps: 9000 }) });
check('bad split rejected', r.status === 400, r.data.error || '');
r = await api('/api/app/config', { method: 'PATCH', body: JSON.stringify({ reward: 'GLD' }) });
check('patch reward by ticker', r.status === 200 && r.data.config?.target_token_address === '0xc9a981fee1f9dec688bb123ccdecc63d0debfc4e');

// Fee routing legs (the canvas)
const legs = [
  { kind: 'holders', shareBps: 6000, label: 'Holders' },
  { kind: 'wallet', shareBps: 2500, label: 'Team', address: account.address, asset: '0xc9a981fee1f9dec688bb123ccdecc63d0debfc4e' },
  { kind: 'burn', shareBps: 500, label: 'Buyback & burn' },
  { kind: 'treasury', shareBps: 1000, label: 'Treasury', address: account.address },
];
r = await api('/api/app/config', { method: 'PATCH', body: JSON.stringify({ legs }) });
check('save routing legs', r.status === 200 && r.data.legs?.length === 4 && r.data.config?.legs_enabled === true && r.data.config?.split_holders_bps === 6000, r.data.error || '');
r = await api('/api/app/config', { method: 'PATCH', body: JSON.stringify({ legs: legs.map((l) => ({ ...l, shareBps: 1000 })) }) });
check('routing not 100% rejected', r.status === 400, r.data.error || '');
r = await api('/api/app/config', { method: 'PATCH', body: JSON.stringify({ legs: [{ kind: 'wallet', shareBps: 10000, label: 'x' }] }) });
check('wallet leg without address rejected', r.status === 400, r.data.error || '');
r = await api('/api/app/me');
check('me returns legs', r.status === 200 && r.data.legs?.length === 4);
r = await api('/api/app/discover?wallet=0xe45eec9834a517dea03d69c9bc7dc93c1a032a34');
check('discover tokens of a creator wallet', r.status === 200 && (r.data.created || []).some((t) => t.symbol === 'Nasduck'), 'created ' + (r.data.created || []).map((t) => t.symbol).join(','));
r = await api('/api/app/token?address=0x39dbed3a2bd333467115de45665cc57f813c4571');
check('token research (PONS)', r.status === 200 && r.data.research?.priceUsd > 0 && r.data.image, 'chart ' + (r.data.research?.chart?.length || 0));

r = await api('/api/app/telegram-link', { method: 'POST' });
check('telegram link code', r.status === 200 && /start=w_/.test(r.data.url), r.data.url);

r = await api('/api/app/config/run', { method: 'POST' });
check('run now accepted by the scheduler', r.status === 200 && r.data.ok, r.data.error || '');

// Screenshot the dashboard with the session cookie
try {
  const { chromium } = await import('playwright');
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const [name, value] = cookie.split('=');
  await ctx.addCookies([{ name, value, url: BASE }]);
  const p = await ctx.newPage();
  await p.goto(`${BASE}/app`, { waitUntil: 'load' });
  await p.waitForTimeout(4000);
  await p.screenshot({ path: process.env.SHOT || 'app-dashboard.png', fullPage: true });
  const p2 = await ctx.newPage();
  await ctx.clearCookies();
  await p2.goto(`${BASE}/app`, { waitUntil: 'load' });
  await p2.waitForTimeout(2500);
  await p2.screenshot({ path: process.env.SHOT_LOGIN || 'app-login.png' });
  await b.close();
  console.log('PASS screenshots');
} catch (e) {
  console.log('SKIP screenshots', e.message);
}

await new Promise((res) => setTimeout(res, 4000));
r = await api('/api/app/config', { method: 'DELETE' });
check('delete config', r.status === 200 && r.data.ok, r.data.error || '');
r = await api('/api/app/me');
check('me after delete', r.status === 200 && r.data.config === null);
r = await api('/api/app/auth/logout', { method: 'POST' });
r = await api('/api/app/me');
check('logged out', r.status === 401);
