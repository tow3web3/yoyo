import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { C, FONT, MONO, Word, Grid, Coin, Pill, Flash, pop } from './ui';
import vo from './vo-holders.json';

// Scenario 1: "Pay your holders after the pump". Scenes follow the voice-over
// timeline (src/vo-holders.json), one scene per line, so the picture always
// lands with the words.
export const FPS = 30;
export const DURATION = vo.total;
const L = Object.fromEntries(vo.lines.map((l) => [l.id, l]));
const at = (id) => L[id].startFrame;
const end = (id) => L[id].endFrame;
const within = (f, id) => f >= at(id) && f < end(id);

/* ---------- caption strip: the spoken line, word by word ---------- */
function Caption({ f }) {
  const line = vo.lines.find((l) => f >= l.startFrame && f < l.endFrame);
  if (!line) return null;
  const words = line.text.replace('yo dash yo dot dev', 'yo-yo.dev').split(' ');
  const perWord = (line.duration * FPS) / words.length;
  const shown = Math.min(words.length, Math.floor((f - line.startFrame) / perWord) + 1);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 34, display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 1500, background: 'rgba(11,15,12,0.85)', color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 34, padding: '16px 28px', borderRadius: 20, lineHeight: 1.3, textAlign: 'center' }}>
        {words.slice(0, shown).join(' ')}<span style={{ color: C.lime }}>{shown < words.length ? ' ▍' : ''}</span>
      </div>
    </div>
  );
}

/* ---------- 1. the pump ---------- */
function Pump({ f }) {
  const s = at('pump');
  const t = interpolate(f, [s, s + 70], [0, 1], { extrapolateRight: 'clamp' });
  const pts = Array.from({ length: 40 }, (_, i) => { const x = i / 39; const y = 0.15 + 0.1 * Math.sin(i * 1.3) + (x > 0.55 ? Math.pow((x - 0.55) / 0.45, 1.6) * 0.75 : 0); return [120 + x * 1000, 760 - y * 620]; });
  const n = Math.max(2, Math.floor(pts.length * t));
  const d = pts.slice(0, n).map((p, i) => `${i ? 'L' : 'M'} ${p[0]} ${p[1]}`).join(' ');
  const last = pts[n - 1];
  const feesAt = s + 75;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 120, top: 90, fontFamily: MONO, fontSize: 26, color: C.mut, letterSpacing: 3 }}>$YOURCOIN / USD · 1H</div>
      <svg style={{ position: 'absolute', inset: 0 }} width={1920} height={1080}>
        <path d={`${d} L ${last[0]} 760 L 120 760 Z`} fill="rgba(202,249,15,0.12)" />
        <path d={d} fill="none" stroke={C.lime} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last[0]} cy={last[1]} r={12} fill={C.lime} />
      </svg>
      {t > 0.95 && <div style={{ position: 'absolute', left: last[0] - 160, top: last[1] - 90, fontFamily: FONT, fontWeight: 800, fontSize: 56, color: C.lime, transform: `scale(${pop(f, s + 70)})` }}>+412% 🚀</div>}
      {/* fees landing on the right */}
      <div style={{ position: 'absolute', right: 140, top: 240, width: 420, borderRadius: 28, background: C.tile, border: `3px solid ${C.lime}`, padding: 26, opacity: interpolate(f, [feesAt, feesAt + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: C.lime, letterSpacing: 2 }}>CREATOR FEES · DEV WALLET</div>
        {[['NVDA', '0.0421'], ['GLD', '0.0106'], ['SPY', '0.058']].map(([t2, amt], i) => (
          f >= feesAt + 12 + i * 9 && (
            <div key={t2} style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, transform: `translateY(${(1 - pop(f, feesAt + 12 + i * 9)) * -40}px)` }}>
              <Coin src={`logos/${t2}.png`} size={56} />
              <div style={{ fontFamily: MONO, fontSize: 30, color: '#fff' }}>+{amt} <span style={{ color: C.mut }}>{t2}</span></div>
            </div>
          )
        ))}
      </div>
    </AbsoluteFill>
  );
}

/* ---------- 2. the holders who stayed ---------- */
const HOLDERS = [['0x8a2f…41c9', 'holding 61 days', 2.0], ['0x3d17…b0e2', 'holding 15 days', 1.5], ['0xc4a9…77de', 'sold 2 days ago', 0], ['0xf01e…9a33', 'bought 4 min ago', 0], ['0x55b1…0c4e', 'holding 33 days', 1.9]];
function Holders({ f }) {
  const s = at('question');
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: 110, textAlign: 'center' }}><Word at={s} size={84}>Who gets paid?</Word></div>
      <div style={{ width: 1100, marginTop: 60 }}>
        {HOLDERS.map(([addr, note, mult], i) => f >= s + 20 + i * 9 && (
          <div key={addr} style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '16px 26px', marginBottom: 12, borderRadius: 20, background: C.tile, border: `2px solid ${mult ? 'rgba(202,249,15,0.4)' : 'rgba(255,80,0,0.4)'}`, transform: `translateX(${(1 - pop(f, s + 20 + i * 9)) * 80}px)` }}>
            <div style={{ fontFamily: MONO, fontSize: 30, color: '#fff', width: 300 }}>{addr}</div>
            <div style={{ flex: 1, height: 12, background: 'rgba(255,255,255,0.1)', borderRadius: 6 }}><div style={{ width: `${Math.min(100, (mult / 2) * 100)}%`, height: '100%', borderRadius: 6, background: mult ? `linear-gradient(90deg, ${C.lime}, ${C.gold})` : C.red }} /></div>
            <div style={{ fontFamily: FONT, fontSize: 24, color: C.mut, width: 260 }}>{note}</div>
            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 30, color: mult ? C.lime : C.red, width: 120, textAlign: 'right' }}>{mult ? `${mult.toFixed(1)}x` : '✕'}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

/* ---------- 3. answer: the yo-yo ---------- */
function Answer({ f }) {
  const { fps } = useVideoConfig();
  const s = at('answer');
  const drop = spring({ frame: f - s, fps, config: { damping: 9, stiffness: 90, mass: 1.1 } });
  const y = interpolate(drop, [0, 1], [-300, 380]);
  return (
    <AbsoluteFill>
      <svg style={{ position: 'absolute', inset: 0 }} width={1920} height={1080}><line x1={960} y1={-40} x2={960} y2={y - 110} stroke="#fff" strokeWidth={4} /></svg>
      <Img src={staticFile('yoyoface-512.png')} style={{ position: 'absolute', left: 960 - 130, top: y - 130, width: 260, height: 260, transform: `rotate(${(f - s) * 20}deg)`, filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.5))' }} />
      <div style={{ position: 'absolute', top: 640, width: '100%', textAlign: 'center' }}>
        <Word at={s + 12} size={150}>yo-yo</Word><Word at={s + 18} size={150} color={C.olive}>.dev</Word>
      </div>
      <div style={{ position: 'absolute', top: 820, width: '100%', textAlign: 'center' }}><Word at={s + 40} size={44} weight={700} color={C.mut}>Pays your holders. Automatically.</Word></div>
      <Flash at={s + 12} max={0.5} />
    </AbsoluteFill>
  );
}

/* ---------- 4. connect + pick your coin ---------- */
function Connect({ f }) {
  const s = at('connect');
  const steps = [['🪪', 'Connect wallet', 'no gas, no email'], ['🔎', 'Scan your wallet', 'the coins you created appear'], ['🪙', 'Pick your coin', 'or paste a contract address']];
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: 110, textAlign: 'center' }}><Word at={s} size={84}>Three taps to start</Word></div>
      <div style={{ display: 'flex', gap: 32, marginTop: -40 }}>
        {steps.map(([e, t, sub], i) => f >= s + 25 + i * 22 && (
          <div key={t} style={{ width: 440, borderRadius: 28, background: C.paper, padding: 30, transform: `scale(${pop(f, s + 25 + i * 22)})`, boxShadow: '0 30px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: 72 }}>{e}</div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, color: C.ink, marginTop: 10 }}>{i + 1}. {t}</div>
            <div style={{ fontFamily: FONT, fontSize: 26, color: '#5C6660', marginTop: 6 }}>{sub}</div>
          </div>
        ))}
      </div>
      {f >= s + 100 && (
        <div style={{ position: 'absolute', bottom: 250, display: 'flex', gap: 16, transform: `scale(${pop(f, s + 100)})` }}>
          {[['PONS.png', 'Pons', 'created'], ['NASDUCK.png', 'Nasduck', 'created']].map(([img, name, tag]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 14, background: C.paper, borderRadius: 999, padding: '10px 22px 10px 10px' }}>
              <Coin src={`logos/${img}`} size={52} /><span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: C.ink }}>{name}</span><span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, background: C.lime, borderRadius: 999, padding: '4px 10px', color: C.ink }}>{tag.toUpperCase()}</span>
            </div>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
}

/* ---------- 5. route on the canvas ---------- */
const LEGS = [['🎁 Holders', 70, C.lime], ['👤 You', 15, C.paper], ['🔥 Buyback & burn', 5, C.orange], ['🏦 Treasury', 10, C.gold]];
function Route({ f }) {
  const s = at('route');
  const src = { x: 330, y: 540 };
  const legY = (i) => 220 + i * 170;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 80, top: 80 }}><Pill size={32}>🧭 The canvas</Pill></div>
      <svg style={{ position: 'absolute', inset: 0 }} width={1920} height={1080}>
        {LEGS.map(([l, pct, color], i) => {
          const a = s + 30 + i * 16; if (f < a) return null;
          const prog = interpolate(f, [a, a + 12], [0, 1], { extrapolateRight: 'clamp' });
          const d = `M ${src.x + 210} ${src.y} C ${src.x + 480} ${src.y}, ${1160 - 300} ${legY(i)}, 1160 ${legY(i)}`;
          return <path key={l} d={d} fill="none" stroke={color} strokeWidth={4 + pct / 5} strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 - prog * 100} opacity={0.9} />;
        })}
      </svg>
      <div style={{ position: 'absolute', left: src.x - 210, top: src.y - 80, width: 420, background: C.tile, border: `3px solid ${C.lime}`, borderRadius: 28, padding: 26, transform: `scale(${pop(f, s + 6)})` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}><Coin src="logos/PONS.png" size={64} /><div><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, color: '#fff' }}>Your coin</div><div style={{ fontFamily: MONO, fontSize: 20, color: C.mut }}>fees: NVDA · GLD · SPY</div></div></div>
      </div>
      {LEGS.map(([l, pct, color], i) => {
        const a = s + 30 + i * 16; if (f < a) return null;
        const n = Math.round(interpolate(f, [a, a + 16], [0, pct], { extrapolateRight: 'clamp' }));
        return (
          <div key={l} style={{ position: 'absolute', left: 1160, top: legY(i) - 60, width: 560, background: C.paper, borderRadius: 24, padding: '20px 26px', borderLeft: `14px solid ${color === C.paper ? C.ink : color}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', transform: `scale(${pop(f, a)})`, transformOrigin: 'left center', boxShadow: '0 30px 60px rgba(0,0,0,0.45)' }}>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 36, color: C.ink }}>{l}</div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 64, color: C.ink, letterSpacing: -2 }}>{n}%</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

/* ---------- 6. the record date ---------- */
function Loyalty({ f }) {
  const s = at('loyalty');
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: 100, textAlign: 'center' }}><Word at={s} size={84}>🏅 Record date</Word></div>
      <div style={{ width: 1200, marginTop: -60 }}>
        {[['0x8a2f…41c9', 61, '2.0x', C.lime], ['0x3d17…b0e2', 15, '1.5x', C.olive], ['0xf01e…9a33', 0, 'nothing', C.red]].map(([addr, days, mult, color], i) => {
          const a = s + 20 + i * 30; if (f < a) return null;
          const w = interpolate(f, [a, a + 30], [0, Math.min(100, (days / 30) * 100)], { extrapolateRight: 'clamp' });
          return (
            <div key={addr} style={{ display: 'flex', alignItems: 'center', gap: 26, marginBottom: 26 }}>
              <div style={{ fontFamily: MONO, fontSize: 32, color: '#fff', width: 320 }}>{addr}</div>
              <div style={{ flex: 1, height: 22, borderRadius: 11, background: 'rgba(255,255,255,0.1)' }}><div style={{ width: `${w}%`, height: '100%', borderRadius: 11, background: `linear-gradient(90deg, ${C.lime}, ${C.gold})` }} /></div>
              <div style={{ fontFamily: FONT, fontSize: 26, color: C.mut, width: 200 }}>{days ? `${days} days` : '4 minutes'}</div>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, color, width: 200, textAlign: 'right' }}>{mult}</div>
            </div>
          );
        })}
      </div>
      {f >= s + 110 && <div style={{ position: 'absolute', bottom: 250, transform: `scale(${pop(f, s + 110)})` }}><Pill size={36}>1x → 2x over 30 days · selling resets the clock</Pill></div>}
    </AbsoluteFill>
  );
}

/* ---------- 7. the payout asset ---------- */
function Asset({ f }) {
  const s = at('asset');
  const opts = [['logos/NVDA.png', 'NVDA', 'in kind, no swap'], ['logos/GLD.png', 'GLD', 'gold'], ['logos/PONS.png', 'PONS', 'any coin by CA'], ['logos/NASDUCK.png', 'NASDUCK', 'any coin by CA']];
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: 110, textAlign: 'center' }}><Word at={s} size={84}>Paid in what you choose</Word></div>
      <div style={{ display: 'flex', gap: 28, marginTop: -60 }}>
        {opts.map(([img, sym, sub], i) => f >= s + 25 + i * 14 && (
          <div key={sym} style={{ width: 340, borderRadius: 28, background: i === 0 ? C.lime : C.paper, padding: 26, textAlign: 'center', transform: `scale(${pop(f, s + 25 + i * 14)})`, boxShadow: '0 30px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><Coin src={img} size={120} /></div>
            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 40, color: C.ink, marginTop: 14 }}>{sym}</div>
            <div style={{ fontFamily: FONT, fontSize: 24, color: i === 0 ? '#3A4A06' : '#5C6660' }}>{sub}</div>
          </div>
        ))}
      </div>
      {f >= s + 95 && <div style={{ position: 'absolute', bottom: 250, transform: `scale(${pop(f, s + 95)})` }}><Pill size={36} color={C.paper}>Paste a contract address: fair-price guard on every swap</Pill></div>}
    </AbsoluteFill>
  );
}

/* ---------- 8. save, closing bell, receipt ---------- */
function Save({ f }) {
  const s = at('save');
  const bellAt = s + 40, cardAt = s + 70;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      {f < bellAt + 20 && <div style={{ transform: `scale(${pop(f, s)})` }}><Pill size={64}>Save routing ✓</Pill></div>}
      <Flash at={s} max={0.4} />
      {f >= bellAt && (
        <div style={{ position: 'absolute', left: 160, top: 300, textAlign: 'center' }}>
          <div style={{ fontSize: 200, transform: `rotate(${Math.sin((f - bellAt) / 2) * 14}deg)`, transformOrigin: 'top' }}>🔔</div>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 44, color: '#fff' }}>4:00 pm New York</div>
        </div>
      )}
      {f >= cardAt && (
        <div style={{ position: 'absolute', right: 180, top: 220, width: 720, borderRadius: 28, background: '#0f1512', border: '2px solid rgba(255,255,255,0.12)', padding: 20, transform: `translateY(${(1 - pop(f, cardAt)) * 80}px)` }}>
          <div style={{ fontFamily: FONT, fontSize: 22, color: C.mut, marginBottom: 12 }}>💬 $YOURCOIN holders · 1,204 members</div>
          <div style={{ borderRadius: 20, background: C.paper, overflow: 'hidden' }}>
            <div style={{ background: C.lime, padding: '10px 18px', fontFamily: FONT, fontWeight: 800, fontSize: 20, color: C.ink, letterSpacing: 2 }}>🪀 DIVIDEND PAID · 4:00 PM ET</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: 22 }}>
              <Coin src="logos/NVDA.png" size={96} />
              <div><div style={{ fontFamily: FONT, fontSize: 22, color: '#5C6660' }}>Holders received</div><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 52, color: C.deep }}>0.0421 <span style={{ color: C.ink }}>NVDA</span></div><div style={{ fontFamily: FONT, fontSize: 22, color: '#5C6660' }}>412 wallets · loyalty-weighted</div></div>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '0 22px 18px' }}>{['𝕏 Share', '🧾 Receipt', '📊 Dashboard'].map((b, i) => <span key={b} style={{ fontFamily: FONT, fontWeight: 700, fontSize: 20, padding: '8px 16px', borderRadius: 999, background: i === 0 ? C.ink : '#F0F3EE', color: i === 0 ? '#fff' : '#5C6660' }}>{b}</span>)}</div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
}

/* ---------- 9. outro ---------- */
function Outro({ f }) {
  const s = at('outro');
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Img src={staticFile('yoyo-256.png')} style={{ position: 'absolute', top: 160, width: 260, height: 260, transform: `scale(${pop(f, s)}) rotate(${(f - s) * 3}deg)` }} />
      <div style={{ position: 'absolute', top: 470, textAlign: 'center', width: '100%' }}><Word at={s + 6} size={124}>Real holders.</Word> <Word at={s + 26} size={124} color={C.lime}>Really paid.</Word></div>
      <div style={{ position: 'absolute', top: 700, width: '100%', textAlign: 'center' }}><Word at={s + 50} size={90} color={C.paper}>yo-yo</Word><Word at={s + 56} size={90} color={C.olive}>.dev</Word></div>
      <div style={{ position: 'absolute', top: 830, width: '100%', textAlign: 'center' }}><Word at={s + 70} size={34} weight={700} color={C.mut}>Robinhood Chain · @yoyotek_bot · t.me/yoyocommu</Word></div>
    </AbsoluteFill>
  );
}

export const Scenario1 = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: 'hidden' }}>
      <Audio src={staticFile('pulse.mp3')} volume={(fr) => (fr > DURATION - 40 ? Math.max(0, ((DURATION - fr) / 40) * 0.12) : 0.12)} />
      {vo.lines.map((l) => (
        <Sequence key={l.id} from={l.startFrame} durationInFrames={Math.ceil(l.duration * FPS) + 4}><Audio src={staticFile(`vo/holders/${l.file}`)} /></Sequence>
      ))}
      <Grid opacity={0.07} />
      <div style={{ position: 'absolute', left: 260, top: -160, width: 1400, height: 1400, borderRadius: 1400, background: 'radial-gradient(circle, rgba(202,249,15,0.14), transparent 60%)' }} />
      {within(f, 'pump') && <Pump f={f} />}
      {within(f, 'question') && <Holders f={f} />}
      {within(f, 'answer') && <Answer f={f} />}
      {within(f, 'connect') && <Connect f={f} />}
      {within(f, 'route') && <Route f={f} />}
      {within(f, 'loyalty') && <Loyalty f={f} />}
      {within(f, 'asset') && <Asset f={f} />}
      {within(f, 'save') && <Save f={f} />}
      {f >= at('outro') && <Outro f={f} />}
      <Caption f={f} />
      <div style={{ position: 'absolute', top: 40, right: 60, fontFamily: FONT, fontWeight: 800, fontSize: 26, color: 'rgba(255,255,255,0.55)' }}>yo-yo.dev</div>
      {vo.lines.map((l) => <Flash key={l.id} at={l.startFrame} max={0.25} frames={5} color={C.paper} />)}
    </AbsoluteFill>
  );
};
