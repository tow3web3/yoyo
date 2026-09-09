'use client';

// Setup: pick the wallet first (the connected one, or a key you import), Yoyo
// scans the chain for the tokens that wallet created or holds, you pick one, go.
// Everything else (routing, record date, schedule) is drawn on the canvas afterwards.
import { useEffect, useRef, useState } from 'react';
import { privateKeyToAccount } from 'viem/accounts';
import StockLogo from '../StockLogo';
import TokenCard from './TokenCard';
import { Button, Field, inputCls, useToast, shortAddr, fmtNum, fmtUsd } from './ui';

const STEPS = ['Wallet', 'Token', 'Launch'];
const KEY_RE = /^(0x)?[0-9a-fA-F]{64}$/;

function addressOfKey(pk) {
  try { return privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`).address; } catch { return null; }
}

export default function Wizard({ onCreated, user, onSwitchWallet, onLogout }) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [wallet, setWallet] = useState({ mode: 'mine', privateKey: '' });
  const [scan, setScan] = useState({ wallet: null, loading: false, data: null, error: null });
  const [token, setToken] = useState({ address: '', meta: null, checking: false, error: null });
  const [manual, setManual] = useState('');

  const keyAddress = wallet.mode === 'import' && KEY_RE.test(wallet.privateKey.trim()) ? addressOfKey(wallet.privateKey.trim()) : null;
  const scanWallet = wallet.mode === 'mine' ? user?.wallet : keyAddress;
  const scanned = useRef(null);

  // Scan the chosen wallet when entering the token step.
  useEffect(() => {
    if (step !== 1 || !scanWallet || scanned.current === scanWallet) return;
    scanned.current = scanWallet;
    let alive = true;
    setScan({ wallet: scanWallet, loading: true, data: null, error: null });
    fetch(`/api/app/discover?wallet=${scanWallet}`).then((r) => r.json()).then((d) => { if (!alive) return; if (d.error) setScan({ wallet: scanWallet, loading: false, data: null, error: d.error }); else setScan({ wallet: scanWallet, loading: false, data: d, error: null }); }).catch((e) => alive && setScan({ wallet: scanWallet, loading: false, data: null, error: e.message }));
    return () => { alive = false; scanned.current = null; };
  }, [step, scanWallet]);

  async function checkToken(address) {
    setToken({ address, meta: null, checking: true, error: null });
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return setToken((t) => ({ ...t, checking: false }));
    try {
      const res = await fetch(`/api/app/token?address=${address}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToken({ address, meta: data, checking: false, error: null });
    } catch (e) {
      setToken({ address, meta: null, checking: false, error: e.message });
    }
  }

  const canNext = [wallet.mode === 'mine' ? Boolean(user?.wallet) : Boolean(keyAddress), Boolean(token.meta), true][step];
  const created = scan.data?.created || [];

  async function create() {
    setBusy(true);
    try {
      const res = await fetch('/api/app/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceToken: token.address, wallet: wallet.mode === 'import' ? { mode: 'import', privateKey: wallet.privateKey.trim() } : { mode: 'generate' },
          reward: 'ETH', rewardMode: 'fixed', scheduleKind: 'closing_bell', intervalMinutes: 1440, marketHoursOnly: false, feeSource: 'wallet',
          split: { holders: 10000, creator: 0, burn: 0, treasury: 0 }, payoutMode: 'in_kind',
          loyalty: { enabled: true, minHoldHours: 24, rampDays: 30, maxBps: 20000, sellReset: true },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create');
      toast(data.generated ? `Yoyo is live for your token. Dev wallet ${shortAddr(data.devWallet)} created for you. Now draw the routing.` : 'Yoyo is live for your token. Now draw the routing.');
      onCreated(data);
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  const TokenRow = ({ t, tag }) => (
    <button type="button" onClick={() => { setManual(''); checkToken(t.address); }} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${token.address === t.address ? 'border-hood-500 bg-hood-50' : 'border-line bg-paper hover:border-hood-300'}`}>
      <StockLogo address={t.address} meta={{ symbol: t.symbol, image: t.image }} size="h-9 w-9" text="text-[9px]" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2"><span className="truncate text-sm font-bold text-ink">{t.name}</span><span className="font-mono text-xs text-mut">${t.symbol}</span>{tag && <span className="rounded-full bg-hood-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink">{tag}</span>}</span>
        <span className="block font-mono text-[11px] text-mut">{shortAddr(t.address)}{t.marketCap ? ` · MC ${fmtUsd(t.marketCap)}` : ''}{t.balanceUi > 0 ? ` · you hold ${fmtNum(t.balanceUi, 2)}` : ''}</span>
      </span>
      <span className="text-mut">›</span>
    </button>
  );

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="mb-6">
        <div className="eyebrow mb-2">Set up Yoyo</div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">Your wallet, your token, then draw the routing.</h1>
      </div>

      <ol className="mb-6 grid grid-cols-3 gap-1">
        {STEPS.map((s, i) => (
          <li key={s} className="text-center">
            <div className={`mx-auto mb-1 h-1.5 rounded-full ${i <= step ? 'bg-hood-500' : 'bg-line'}`} />
            <span className={`text-[10px] font-semibold ${i === step ? 'text-ink' : 'text-mut'}`}>{s}</span>
          </li>
        ))}
      </ol>

      <div className="panel p-6">
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-ink">Which wallet created your token?</h2>
            <p className="text-sm text-mut">Yoyo scans Robinhood Chain for the tokens this wallet created, so you can pick yours in one tap.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setWallet({ ...wallet, mode: 'mine' })} className={`rounded-xl border p-4 text-left transition ${wallet.mode === 'mine' ? 'border-hood-500 bg-hood-50' : 'border-line hover:border-hood-300'}`}>
                <div className="text-sm font-bold text-ink">🪪 My connected wallet</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-ink">{user?.wallet ? shortAddr(user.wallet) : 'not connected'}</span>
                  {onSwitchWallet && <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onSwitchWallet(); }} onKeyDown={(e) => e.key === 'Enter' && onSwitchWallet()} className="rounded-full border border-line bg-paper px-2 py-0.5 text-[10px] font-bold text-ink hover:border-hood-400">🔁 Switch wallet</span>}
                  {onLogout && <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onLogout(); }} onKeyDown={(e) => e.key === 'Enter' && onLogout()} className="rounded-full border border-line bg-paper px-2 py-0.5 text-[10px] font-bold text-down hover:border-red-300">⏏ Disconnect</span>}
                </div>
                <div className="mt-1 text-xs text-mut">We list the tokens it created. Yoyo then creates a dedicated dev wallet for the fees (a bot cannot sign with your browser wallet); you set it as fee recipient on your launchpad.</div>
              </button>
              <button type="button" onClick={() => setWallet({ ...wallet, mode: 'import' })} className={`rounded-xl border p-4 text-left transition ${wallet.mode === 'import' ? 'border-hood-500 bg-hood-50' : 'border-line hover:border-hood-300'}`}>
                <div className="text-sm font-bold text-ink">🔑 Import a key</div>
                <div className="mt-1 text-xs text-mut">The wallet that created your token and receives its fees. We list its tokens and use it as the dev wallet. AES-256 encrypted the moment it arrives.</div>
              </button>
            </div>
            {wallet.mode === 'import' && (
              <Field label="Private key" hint="64 hex characters, with or without 0x. Sent once over HTTPS, stored encrypted. Never your main wallet.">
                <input type="password" value={wallet.privateKey} onChange={(e) => setWallet({ ...wallet, privateKey: e.target.value })} placeholder="0x…" className={inputCls} autoComplete="off" autoFocus />
                {wallet.privateKey && !KEY_RE.test(wallet.privateKey.trim()) && <p className="mt-1 text-xs text-down">Not a valid private key yet.</p>}
                {keyAddress && <p className="mt-1.5 text-xs text-mut">Wallet <span className="font-mono text-ink">{keyAddress}</span></p>}
              </Field>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-ink">Which token pays dividends?</h2>
            <p className="text-sm text-mut">Scanning <span className="font-mono text-ink">{shortAddr(scanWallet)}</span> on Robinhood Chain. Its holders will receive the dividends.</p>
            {scan.loading && <div className="flex items-center gap-2 rounded-xl border border-line bg-ground px-3 py-3 text-xs text-mut"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-hood-500" /> Reading every transaction this wallet ever sent, finding the tokens it created…</div>}
            {scan.error && <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"><span>The chain scan did not complete{/rate limit/i.test(scan.error) ? ' (the public RPC is busy)' : ''}. Paste the address below, or retry.</span><button type="button" onClick={() => { scanned.current = null; setScan({ wallet: null, loading: false, data: null, error: null }); }} className="ml-3 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white">Retry</button></div>}
            {scan.data && (
              <div className="space-y-3">
                {created.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-hood-700">Created by this wallet</div>
                    <div className="space-y-1.5">{created.map((t) => <TokenRow key={t.address} t={t} tag="Created" />)}</div>
                  </div>
                )}
                {created.length === 0 && <p className="text-xs text-mut">No token created by this wallet found on chain. If your launchpad deployed it from another wallet, paste the contract address below.</p>}
              </div>
            )}
            <Field label={created.length ? 'Or paste a contract address' : 'Token contract address'} hint="Any ERC-20 on Robinhood Chain.">
              <input value={manual} onChange={(e) => { setManual(e.target.value.trim()); checkToken(e.target.value.trim()); }} placeholder="0x…" className={inputCls} />
            </Field>
            {token.checking && <p className="text-xs text-mut">Checking on chain, DexScreener and GeckoTerminal…</p>}
            {token.error && <p className="text-xs text-down">{token.error}</p>}
            {token.meta && <TokenCard token={token.meta} />}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-ink">Launch with a sane default, then draw</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {[
                ['Token', token.meta ? `${token.meta.name} ($${token.meta.symbol})` : token.address],
                ['Dev wallet', wallet.mode === 'import' ? `Imported: ${shortAddr(keyAddress)}` : 'Created for you, encrypted at rest'],
                ['Routing', '100% to holders, paid in kind'],
                ['Record date', 'Loyalty 1x to 2x over 30 days, 24h minimum hold'],
                ['Schedule', 'Closing bell, 4:00 pm New York, weekdays'],
                ['Then', 'Add wallets, buybacks, a treasury, pick payout assets: all on the canvas'],
              ].map(([k, v]) => <div key={k} className="rounded-xl border border-line bg-ground p-3"><dt className="text-[10px] uppercase tracking-wider text-mut">{k}</dt><dd className="mt-0.5 font-semibold text-ink">{v}</dd></div>)}
            </dl>
            <p className="text-xs text-mut">{wallet.mode === 'import' ? 'Fees already landing in this wallet are routed from the first cycle.' : 'Point your launchpad fee recipient at the new dev wallet once it appears on the canvas. Nothing moves until fees land there.'}</p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>Back</Button>
          {step < STEPS.length - 1
            ? <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>Continue</Button>
            : <Button onClick={create} busy={busy}>Launch and open the canvas</Button>}
        </div>
      </div>
    </div>
  );
}
