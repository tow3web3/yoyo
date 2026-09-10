import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { beatFrame, pulse, onsetAt, FPS as BFPS } from './beat';
import { C, FONT, MONO, Word, Grid, Coin, Pill, Flash, pop } from './ui';

export const FPS = BFPS;
export const DURATION = 900; // 30 s

// Scene boundaries on bar starts (downbeat phase is beat 1).
const T = {
  intro: [0, beatFrame(9)],
  headline: [beatFrame(9), beatFrame(13)],
  stocks: [beatFrame(13), beatFrame(21)],
  dashboard: [beatFrame(21), beatFrame(37)],
  blitz: [beatFrame(37), beatFrame(53)],
  anycoin: [beatFrame(53), beatFrame(57)],
  outro: [beatFrame(57), DURATION],
};
const within = (f, [a, b]) => f >= a && f < b;

/* ---------------- shared: the yo-yo on its string ---------------- */
function Yoyo({ x, y, size = 260, angle = 0, stringTop = -40, glow = true }) {
  return (
    <>
      <svg style={{ position: 'absolute', inset: 0 }} width={1920} height={1080}>
        <line x1={x} y1={stringTop} x2={x} y2={y - size * 0.42} stroke={C.ink} strokeWidth={9} strokeLinecap="round" />
        <line x1={x} y1={stringTop} x2={x} y2={y - size * 0.42} stroke="#fff" strokeWidth={4} strokeLinecap="round" />
      </svg>
      {glow && <div style={{ position: 'absolute', left: x - size, top: y - size, width: size * 2, height: size * 2, borderRadius: size * 2, background: 'radial-gradient(circle, rgba(202,249,15,0.35), transparent 60%)' }} />}
      <Img src={staticFile('yoyoface-512.png')} style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, transform: `rotate(${angle}deg)`, filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.5))' }} />
    </>
  );
}

/* ---------------- 1. intro ---------------- */
function Intro({ f }) {
  const { fps } = useVideoConfig();
  const dropAt = beatFrame(1);
  const drop = spring({ frame: f - dropAt, fps, config: { damping: 9, stiffness: 90, mass: 1.1 } });
  const y = interpolate(drop, [0, 1], [-320, 400]);
  const angle = f > dropAt ? (f - dropAt) * 22 : 0;
  const letters = ['y', 'o', '-', 'y', 'o'];
  const wmAt = beatFrame(5);
  return (
    <AbsoluteFill>
      <Yoyo x={960} y={y} angle={angle} />
      <div style={{ position: 'absolute', top: 640, width: '100%', textAlign: 'center' }}>
        {letters.map((l, i) => <Word key={i} at={wmAt + i * 6} size={170} color={C.paper}>{l}</Word>)}
        {f >= beatFrame(7) && <Word at={beatFrame(7)} size={170} color={C.olive}>.dev</Word>}
      </div>
      {f >= beatFrame(8) && (
        <div style={{ position: 'absolute', top: 860, width: '100%', textAlign: 'center' }}>
          <Word at={beatFrame(8)} size={48} weight={700} color={C.mut}>Fees go out, dividends come back.</Word>
        </div>
      )}
    </AbsoluteFill>
  );
}

/* ---------------- 2. headline ---------------- */
function Headline({ f }) {
  const b = (i) => beatFrame(9 + i * 0.5);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 1500, textAlign: 'center', lineHeight: 0.95 }}>
        <div><Word at={b(0)} size={190}>Give</Word> <Word at={b(1)} size={190}>your</Word></div>
        <div><Word at={b(2)} size={190}>memecoin</Word> <Word at={b(3)} size={190}>a</Word></div>
        <div><Word at={b(4)} size={190} color={C.lime}>dividend</Word> <Word at={b(5)} size={190} color={C.lime}>policy.</Word></div>
      </div>
      {f >= b(6.5) && (
        <div style={{ position: 'absolute', bottom: 120, transform: `scale(${pop(f, b(6.5))})` }}>
          <Pill size={40}>Fees in stocks → dividends out, every closing bell</Pill>
        </div>
      )}
    </AbsoluteFill>
  );
}

/* ---------------- 3. stocks ---------------- */
const STOCKS = ['NVDA', 'TSLA', 'AAPL', 'GLD', 'SPY', 'MSFT', 'AMZN', 'META', 'GOOGL', 'COIN', 'QQQ', 'AMD'];
function Stocks({ f }) {
  const start = beatFrame(13);
  const p = pulse(f);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 150, width: '100%', textAlign: 'center' }}>
        <Word at={start} size={64} weight={700} color={C.mut}>Launchpads on Robinhood Chain pay you in</Word>
      </div>
      <div style={{ position: 'absolute', top: 250, width: '100%', textAlign: 'center' }}>
        <Word at={beatFrame(14)} size={230} color={C.lime}>REAL</Word> <Word at={beatFrame(15)} size={230} color={C.lime}>STOCKS</Word>
      </div>
      {STOCKS.map((t, i) => {
        const at = start + i * 7;
        if (f < at) return null;
        const s = pop(f, at);
        const x = 160 + i * 145;
        const bob = Math.sin((f + i * 9) / 6) * 8;
        return (
          <div key={t} style={{ position: 'absolute', left: x, top: 640 + bob + (i % 2 ? 60 : 0), transform: `scale(${(0.5 + 0.5 * s) * (1 + p * 0.08)}) rotate(${(f - at) * 3}deg)` }}>
            <Coin src={`logos/${t}.png`} size={132} />
          </div>
        );
      })}
      {f >= beatFrame(18) && (
        <div style={{ position: 'absolute', bottom: 90, width: '100%', textAlign: 'center', transform: `scale(${pop(f, beatFrame(18))})` }}>
          <Pill size={38} color={C.paper}>195 Robinhood Stock Tokens · NVDA fees become NVDA dividends</Pill>
        </div>
      )}
    </AbsoluteFill>
  );
}

/* ---------------- 4. the nodal dashboard ---------------- */
const LEGS = [
  { label: 'Holders', kind: '🎁', pct: 60, color: C.lime, sub: 'paid in kind · loyalty weighted' },
  { label: 'Team', kind: '👤', pct: 15, color: C.paper, sub: 'in GLD' },
  { label: 'Partner $PONS', kind: '👤', pct: 10, color: C.paper, sub: 'in PONS' },
  { label: 'Buyback & burn', kind: '🔥', pct: 5, color: C.orange, sub: 'buys your token, burns it' },
  { label: 'Treasury', kind: '🏦', pct: 10, color: C.gold, sub: 'stocks in kind · ETH buys SPY' },
];
const SRC = { x: 330, y: 560 };
const LEG_X = 1180;
const legY = (i) => 240 + i * 158;
const bez = (i, t) => {
  const p0 = { x: SRC.x + 210, y: SRC.y }, p3 = { x: LEG_X - 20, y: legY(i) };
  const p1 = { x: p0.x + 260, y: p0.y }, p2 = { x: p3.x - 260, y: p3.y };
  const u = 1 - t;
  return { x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x, y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y };
};
function Dashboard({ f }) {
  const start = beatFrame(21);
  const p = pulse(f);
  const legAt = (i) => beatFrame(23 + i);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 80, top: 70, transform: `scale(${pop(f, start)})`, transformOrigin: 'left' }}>
        <Pill size={34}>🧭 The nodal dashboard</Pill>
      </div>
      <div style={{ position: 'absolute', left: 80, top: 150, fontFamily: FONT, fontWeight: 800, fontSize: 64, color: C.paper, letterSpacing: -2, opacity: interpolate(f, [start, start + 10], [0, 1]) }}>Draw where the fees go.</div>
      {/* edges */}
      <svg style={{ position: 'absolute', inset: 0 }} width={1920} height={1080}>
        {LEGS.map((l, i) => {
          if (f < legAt(i)) return null;
          const prog = interpolate(f, [legAt(i), legAt(i) + 12], [0, 1], { extrapolateRight: 'clamp' });
          const p0 = bez(i, 0), p3 = bez(i, 1);
          const d = `M ${p0.x} ${p0.y} C ${p0.x + 260} ${p0.y}, ${p3.x - 260} ${p3.y}, ${p3.x} ${p3.y}`;
          return (
            <g key={l.label}>
              <path d={d} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={4 + l.pct / 6} strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 - prog * 100} />
              <path d={d} fill="none" stroke={l.color} strokeWidth={3} strokeLinecap="round" strokeDasharray="8 14" strokeDashoffset={-f * 1.6} pathLength={100} opacity={prog} style={{ strokeDasharray: `${prog * 100} ${100}` }} />
            </g>
          );
        })}
      </svg>
      {/* coins along edges */}
      {f >= beatFrame(29) && [0, 1, 2, 3, 4].map((i) => {
        const k = ((f - beatFrame(29)) / 34 + i * 0.37) % 1;
        const pt = bez(i, k);
        const logo = ['NVDA', 'GLD', 'PONS', 'TSLA', 'SPY'][i];
        return <div key={i} style={{ position: 'absolute', left: pt.x - 26, top: pt.y - 26 }}><Coin src={`logos/${logo}.png`} size={52} /></div>;
      })}
      {/* source node */}
      <div style={{ position: 'absolute', left: SRC.x - 210, top: SRC.y - 80, width: 420, transform: `scale(${pop(f, start) * (1 + p * 0.03)})`, background: C.tile, border: `3px solid ${C.lime}`, borderRadius: 28, padding: 26, boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Coin src="logos/PONS.png" size={64} />
          <div><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, color: C.paper }}>Your coin</div><div style={{ fontFamily: MONO, fontSize: 20, color: C.mut }}>dev wallet 0x4c86…f6a9</div></div>
        </div>
        <div style={{ marginTop: 16, fontFamily: FONT, fontWeight: 700, fontSize: 18, color: C.lime, letterSpacing: 2 }}>FEES LAND HERE, GO OUT AT THE CLOSING BELL</div>
      </div>
      {/* leg nodes */}
      {LEGS.map((l, i) => {
        if (f < legAt(i)) return null;
        const s = pop(f, legAt(i));
        const n = Math.round(interpolate(f, [legAt(i), legAt(i) + 14], [0, l.pct], { extrapolateRight: 'clamp' }));
        return (
          <div key={l.label} style={{ position: 'absolute', left: LEG_X, top: legY(i) - 60, width: 560, transform: `scale(${s})`, transformOrigin: 'left center', background: C.paper, borderRadius: 24, padding: '18px 26px', borderLeft: `14px solid ${l.color === C.paper ? C.ink : l.color}`, boxShadow: '0 30px 60px rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 36, color: C.ink }}>{l.kind} {l.label}</div><div style={{ fontFamily: MONO, fontSize: 20, color: '#5C6660' }}>{l.sub}</div></div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 64, color: C.ink, letterSpacing: -2 }}>{n}%</div>
          </div>
        );
      })}
      {f >= beatFrame(33) && (
        <div style={{ position: 'absolute', left: 80, bottom: 90, transform: `scale(${pop(f, beatFrame(33))})`, transformOrigin: 'left' }}>
          <Pill size={40} color={C.paper}>Holders, wallets, buybacks, treasury. Any share. Any payout coin.</Pill>
        </div>
      )}
      {f >= beatFrame(35) && (
        <div style={{ position: 'absolute', right: 80, bottom: 90, transform: `scale(${pop(f, beatFrame(35))})` }}>
          <Pill size={44}>Save routing ✓</Pill>
        </div>
      )}
      <Flash at={beatFrame(35)} max={0.35} />
    </AbsoluteFill>
  );
}

/* ---------------- 5. the drop: feature blitz ---------------- */
const CARDS = [
  ['🎁', 'PAYOUT RATIO', 'holders, you, buyback, treasury'],
  ['🏅', 'RECORD DATE', '1x to 2x over 30 days, snipers earn less'],
  ['🔔', 'CLOSING BELL', '4:00 pm New York, weekdays'],
  ['🔥', 'BUYBACK & BURN', 'supply shrinks every cycle'],
  ['🏦', 'STOCK TREASURY', 'book value published live'],
  ['🪙', 'ANY TOKEN BY CA', 'pay holders in any coin'],
  ['🎰', 'STOCK ROULETTE', 'a random stock each cycle'],
  ['🚀', 'TOP GAINER', 'the best stock of the day'],
  ['🗳️', 'HOLDER VOTE', 'gasless, weighted by loyalty'],
  ['⚖️', 'FAIR-PRICE GUARD', 'no fill below fair value'],
  ['🧾', 'RECEIPTS', 'every dividend posted to Telegram'],
  ['📈', 'YIELD BADGE', 'APY like a real stock'],
  ['📦', 'PAY IN KIND', 'NVDA fees become NVDA dividends'],
  ['🕘', 'MARKET HOURS', 'skip cycles when Wall Street sleeps'],
  ['🔐', 'ENCRYPTED KEYS', 'AES-256, decrypted in memory only'],
];
function Blitz({ f }) {
  const start = beatFrame(37);
  let k = 0;
  for (let i = 0; i < CARDS.length; i++) if (f >= beatFrame(37 + i)) k = i;
  const summary = f >= beatFrame(52);
  const at = summary ? beatFrame(52) : beatFrame(37 + k);
  const [emoji, title, sub] = summary ? ['🧭', '15 OPTIONS. ONE CANVAS.', 'draw it once, it runs every cycle'] : CARDS[k];
  const lime = summary ? true : k % 2 === 0;
  const punch = interpolate(f, [at, at + 6], [1.18, 1], { extrapolateRight: 'clamp' });
  const slide = interpolate(f, [at, at + 6], [k % 2 ? 80 : -80, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: lime ? C.lime : C.ink, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: 70, left: 80, fontFamily: MONO, fontSize: 28, color: lime ? C.ink : C.lime, letterSpacing: 4 }}>{summary ? 'THE POLICY' : `OPTION ${String(k + 1).padStart(2, '0')} / 15`}</div>
      <div style={{ position: 'absolute', top: 70, right: 80, fontFamily: FONT, fontWeight: 800, fontSize: 28, color: lime ? C.ink : C.paper }}>yo-yo.dev</div>
      <div style={{ transform: `scale(${punch}) translateX(${slide}px)`, textAlign: 'center' }}>
        <div style={{ fontSize: 160, lineHeight: 1 }}>{emoji}</div>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: summary ? 120 : 150, letterSpacing: -6, lineHeight: 1, marginTop: 20, color: lime ? C.ink : C.paper }}>{title}</div>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 48, marginTop: 24, color: lime ? '#3A4A06' : C.mut }}>{sub}</div>
      </div>
      <div style={{ position: 'absolute', bottom: 60, left: 80, right: 80, height: 10, background: lime ? 'rgba(11,15,12,0.15)' : 'rgba(255,255,255,0.12)', borderRadius: 5 }}>
        <div style={{ width: `${((f - start) / (beatFrame(53) - start)) * 100}%`, height: '100%', background: lime ? C.ink : C.lime, borderRadius: 5 }} />
      </div>
    </AbsoluteFill>
  );
}

/* ---------------- 6. any coin ---------------- */
function AnyCoin({ f }) {
  const start = beatFrame(53);
  const p = pulse(f);
  const coins = [['logos/PONS.png', 560], ['logos/NASDUCK.png', 830], ['logos/NVDA.png', 1100]];
  return (
    <AbsoluteFill style={{ alignItems: 'center' }}>
      <div style={{ position: 'absolute', top: 140, textAlign: 'center' }}>
        <Word at={start} size={110} color={C.mut} weight={700}>Link</Word> <Word at={start + 4} size={210} color={C.lime}>ANY</Word> <Word at={start + 8} size={210}>coin.</Word>
      </div>
      {coins.map(([src, x], i) => f >= beatFrame(54 + i) && (
        <div key={src} style={{ position: 'absolute', left: x, top: 520, transform: `scale(${pop(f, beatFrame(54 + i)) * (1 + p * 0.1)}) rotate(${(f - beatFrame(54 + i)) * 2}deg)` }}><Coin src={src} size={220} /></div>
      ))}
      {f >= beatFrame(56) && (
        <div style={{ position: 'absolute', bottom: 110, transform: `scale(${pop(f, beatFrame(56))})` }}>
          <Pill size={44}>Pons, ARROW, your own contract. Paid in stocks or memecoins.</Pill>
        </div>
      )}
    </AbsoluteFill>
  );
}

/* ---------------- 7. outro ---------------- */
function Outro({ f }) {
  const { fps } = useVideoConfig();
  const start = beatFrame(57);
  const climb = spring({ frame: f - start, fps, config: { damping: 10, stiffness: 80, mass: 1 } });
  const y = interpolate(climb, [0, 1], [1200, 300]);
  const angle = -(f - start) * 18;
  return (
    <AbsoluteFill>
      <Yoyo x={960} y={y} angle={angle} size={280} />
      <div style={{ position: 'absolute', top: 560, width: '100%', textAlign: 'center' }}>
        <Word at={beatFrame(58)} size={200}>yo-yo</Word><Word at={beatFrame(58) + 6} size={200} color={C.olive}>.dev</Word>
      </div>
      <div style={{ position: 'absolute', top: 800, width: '100%', textAlign: 'center' }}>
        <Word at={beatFrame(60)} size={46} weight={700} color={C.mut}>The dividend policy for memecoins · Robinhood Chain · @yoyotek_bot</Word>
      </div>
      <Flash at={beatFrame(58)} max={0.6} />
    </AbsoluteFill>
  );
}

/* ---------------- root ---------------- */
export const Promo = () => {
  const f = useCurrentFrame();
  const p = pulse(f);
  const on = onsetAt(f);
  const blitz = within(f, T.blitz);
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: 'hidden' }}>
      <Audio src={staticFile('pulse.mp3')} volume={(fr) => (fr > DURATION - 30 ? Math.max(0, (DURATION - fr) / 30) : 1)} />
      {!blitz && (
        <>
          <Grid opacity={0.06 + on * 0.08} />
          <div style={{ position: 'absolute', left: 960 - 700, top: 540 - 700, width: 1400, height: 1400, borderRadius: 1400, background: 'radial-gradient(circle, rgba(202,249,15,0.16), transparent 60%)', transform: `scale(${1 + p * 0.12})` }} />
          <div style={{ position: 'absolute', inset: 0, boxShadow: `inset 0 0 ${200 + p * 200}px rgba(0,0,0,0.7)` }} />
        </>
      )}
      {within(f, T.intro) && <Intro f={f} />}
      {within(f, T.headline) && <Headline f={f} />}
      {within(f, T.stocks) && <Stocks f={f} />}
      {within(f, T.dashboard) && <Dashboard f={f} />}
      {blitz && <Blitz f={f} />}
      {within(f, T.anycoin) && <AnyCoin f={f} />}
      {within(f, T.outro) && <Outro f={f} />}
      {/* beat bar: a lime tick on every beat */}
      {!blitz && <div style={{ position: 'absolute', bottom: 0, left: 0, height: 6, width: `${Math.min(100, (f / DURATION) * 100)}%`, background: C.lime, opacity: 0.5 + p * 0.5 }} />}
      {/* hard cut flashes on bar starts */}
      {[9, 13, 21, 37, 53, 57].map((b) => <Flash key={b} at={beatFrame(b)} max={0.5} frames={6} color={C.paper} />)}
    </AbsoluteFill>
  );
};
