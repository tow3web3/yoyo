import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame, interpolate } from 'remotion';
import { C, FONT, MONO, Word, Grid, Coin, Pill, Flash, pop } from './ui';
import vo from './vo-vote.json';

// Scenario 2: "Let them vote". Holders pick the next dividend asset.
export const FPS = 30;
export const DURATION = vo.total;
const L = Object.fromEntries(vo.lines.map((l) => [l.id, l]));
const at = (id) => L[id].startFrame;
const end = (id) => L[id].endFrame;
const within = (f, id) => f >= at(id) && f < end(id);

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

/* 1. the community argues */
const CHAT = [['0x8a2f…41c9', 'NVDA or nothing 🚀', 'NVDA', 'left'], ['0x3d17…b0e2', 'gold. we are in a debasement trade', 'GLD', 'right'], ['0x55b1…0c4e', 'TSLA. obviously.', 'TSLA', 'left'], ['0xc4a9…77de', 'dev just pick one??', null, 'right'], ['0xf01e…9a33', 'let us VOTE', null, 'left']];
function Opinions({ f }) {
  const s = at('opinions');
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 1000, borderRadius: 32, background: '#0f1512', border: '2px solid rgba(255,255,255,0.1)', padding: 28 }}>
        <div style={{ fontFamily: FONT, fontSize: 24, color: C.mut, marginBottom: 14 }}>💬 $YOURCOIN holders · 1,204 members</div>
        {CHAT.map(([who, msg, t, side], i) => f >= s + 10 + i * 22 && (
          <div key={who} style={{ display: 'flex', justifyContent: side === 'left' ? 'flex-start' : 'flex-end', marginBottom: 14, transform: `scale(${pop(f, s + 10 + i * 22)})`, transformOrigin: side === 'left' ? 'left' : 'right' }}>
            <div style={{ maxWidth: 640, background: side === 'left' ? 'rgba(255,255,255,0.08)' : C.lime, color: side === 'left' ? '#fff' : C.ink, borderRadius: 22, padding: '14px 20px' }}>
              <div style={{ fontFamily: MONO, fontSize: 18, opacity: 0.6 }}>{who}</div>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 32, display: 'flex', alignItems: 'center', gap: 12 }}>{t && <Coin src={`logos/${t}.png`} size={40} />}{msg}</div>
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

/* 2. switch the reward mode */
const MODES = ['🎯 Fixed', '🎰 Roulette', '🚀 Top Gainer', '📊 Portfolio', '🗳️ Vote'];
function Mode({ f }) {
  const s = at('mode');
  const clickAt = s + 95;
  const on = f >= clickAt;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', left: 120, top: 330, width: 520, background: C.paper, borderRadius: 26, padding: '22px 28px', borderLeft: `14px solid ${C.lime}`, boxShadow: '0 30px 60px rgba(0,0,0,0.45)', transform: `scale(${pop(f, s)})`, transformOrigin: 'left center' }}>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: C.deep, letterSpacing: 2 }}>🎁 HOLDERS</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, color: C.ink }}>Holders</div><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 56, color: C.ink }}>70%</div></div>
        <div style={{ fontFamily: MONO, fontSize: 20, color: '#5C6660' }}>every $YOURCOIN holder</div>
      </div>
      {f >= s + 30 && (
        <div style={{ position: 'absolute', right: 140, top: 200, width: 760, background: C.paper, borderRadius: 30, padding: 30, boxShadow: '0 30px 60px rgba(0,0,0,0.45)', transform: `scale(${pop(f, s + 30)})`, transformOrigin: 'right center' }}>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, color: '#5C6660', letterSpacing: 2 }}>ETH FEES CONVERT TO</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16, background: '#F0F3EE', borderRadius: 18, padding: 8 }}>
            {MODES.map((m, i) => { const active = on ? i === 4 : i === 0; return <div key={m} style={{ fontFamily: FONT, fontWeight: 700, fontSize: 26, padding: '12px 20px', borderRadius: 14, background: active ? C.ink : 'transparent', color: active ? '#fff' : '#5C6660', transform: on && i === 4 ? `scale(${1 + (1 - pop(f, clickAt)) * 0.3})` : 'none' }}>{m}</div>; })}
          </div>
          <div style={{ marginTop: 18, fontFamily: FONT, fontSize: 24, color: '#5C6660' }}>{on ? 'Holders vote on the next reward, weighted by balance and loyalty. Gasless, just a signature.' : 'Always the same reward: NVDA.'}</div>
          {f >= clickAt - 24 && f < clickAt + 12 && <div style={{ position: 'absolute', right: 120, top: 70, fontSize: 56, transform: `translate(${interpolate(f, [clickAt - 24, clickAt], [80, 0], { extrapolateRight: 'clamp' })}px, ${interpolate(f, [clickAt - 24, clickAt], [60, 0], { extrapolateRight: 'clamp' })}px)` }}>👆</div>}
        </div>
      )}
      {on && <Flash at={clickAt} max={0.35} />}
      {f >= clickAt + 30 && <div style={{ position: 'absolute', bottom: 250, transform: `scale(${pop(f, clickAt + 30)})` }}><Pill size={40}>Save routing ✓</Pill></div>}
    </AbsoluteFill>
  );
}

/* 3. the vote page */
const OPTIONS = [['NVDA', 41, C.lime], ['GLD', 33, C.gold], ['TSLA', 26, '#FF7A1A']];
function Vote({ f }) {
  const s = at('vote');
  const sigs = ['0x8a2f', '0x3d17', '0x55b1', '0x9c0d', '0x21ee', '0x77ab', '0xd4f1', '0x0b39'];
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: 90, textAlign: 'center' }}><Word at={s} size={72}>🗳️ Next dividend: you decide</Word></div>
      <div style={{ width: 1200, marginTop: 40 }}>
        {OPTIONS.map(([t, pct, color], i) => {
          const a = s + 30 + i * 8;
          const w = interpolate(f, [a, a + 60], [0, pct], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
          return (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 22 }}>
              <Coin src={`logos/${t}.png`} size={72} />
              <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 36, color: '#fff', width: 130 }}>{t}</div>
              <div style={{ flex: 1, height: 44, borderRadius: 22, background: 'rgba(255,255,255,0.08)' }}><div style={{ width: `${(w / 45) * 100}%`, height: '100%', borderRadius: 22, background: color }} /></div>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 44, color: '#fff', width: 130, textAlign: 'right' }}>{Math.round(w)}%</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', bottom: 250, display: 'flex', gap: 10 }}>
        {sigs.map((w, i) => f >= s + 50 + i * 14 && <div key={w} style={{ fontFamily: MONO, fontSize: 20, color: C.ink, background: C.lime, borderRadius: 999, padding: '8px 14px', transform: `scale(${pop(f, s + 50 + i * 14)})` }}>✍️ {w} signed</div>)}
      </div>
    </AbsoluteFill>
  );
}

/* 4. no buying a vote */
function Sniper({ f }) {
  const s = at('sniper');
  const rows = [['0x8a2f…41c9', 'held 34 days', '1.2M', '2.0x', '2.4M', C.lime], ['0xf01e…9a33', 'bought yesterday', '1.2M', '1.0x', '1.2M', C.orange]];
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: 100, textAlign: 'center' }}><Word at={s} size={80}>Weight = balance × loyalty</Word></div>
      <div style={{ width: 1300, marginTop: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '340px 260px 200px 140px 200px', gap: 20, fontFamily: FONT, fontWeight: 800, fontSize: 18, color: C.mut, letterSpacing: 2, padding: '0 26px 12px' }}><div>WALLET</div><div>HISTORY</div><div>BALANCE</div><div>LOYALTY</div><div style={{ textAlign: 'right' }}>VOTE WEIGHT</div></div>
        {rows.map(([addr, hist, bal, mult, w, color], i) => f >= s + 20 + i * 30 && (
          <div key={addr} style={{ display: 'grid', gridTemplateColumns: '340px 260px 200px 140px 200px', gap: 20, alignItems: 'center', padding: '22px 26px', marginBottom: 16, borderRadius: 22, background: C.tile, border: `2px solid ${color}55`, transform: `translateX(${(1 - pop(f, s + 20 + i * 30)) * 80}px)` }}>
            <div style={{ fontFamily: MONO, fontSize: 30, color: '#fff' }}>{addr}</div>
            <div style={{ fontFamily: FONT, fontSize: 26, color: C.mut }}>{hist}</div>
            <div style={{ fontFamily: MONO, fontSize: 30, color: '#fff' }}>{bal}</div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color }}>{mult}</div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, color, textAlign: 'right' }}>{w}</div>
          </div>
        ))}
      </div>
      {f >= s + 100 && <div style={{ position: 'absolute', bottom: 250, transform: `scale(${pop(f, s + 100)})` }}><Pill size={36}>Same bag, half the say. Time in the coin is what counts.</Pill></div>}
    </AbsoluteFill>
  );
}

/* 5. the winner pays */
function Winner({ f }) {
  const s = at('winner');
  const cardAt = s + 90;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      {f < cardAt + 10 && (
        <div style={{ textAlign: 'center', transform: `scale(${pop(f, s)})` }}>
          <div style={{ fontSize: 120 }}>🔔</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 22, background: C.lime, borderRadius: 999, padding: '18px 40px', marginTop: 10 }}><Coin src="logos/NVDA.png" size={80} /><span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 64, color: C.ink }}>NVDA wins · 41%</span></div>
          {f >= s + 40 && <div style={{ marginTop: 26, transform: `scale(${pop(f, s + 40)})` }}><Pill size={32} color={C.paper}>⚖️ fair-price guard: fill at 98.6% of Yahoo fair value ✓</Pill></div>}
        </div>
      )}
      {f >= cardAt && (
        <div style={{ width: 760, borderRadius: 28, background: '#0f1512', border: '2px solid rgba(255,255,255,0.12)', padding: 20, transform: `translateY(${(1 - pop(f, cardAt)) * 80}px)` }}>
          <div style={{ fontFamily: FONT, fontSize: 22, color: C.mut, marginBottom: 12 }}>💬 $YOURCOIN holders · 1,204 members</div>
          <div style={{ borderRadius: 20, background: C.paper, overflow: 'hidden' }}>
            <div style={{ background: C.lime, padding: '10px 18px', fontFamily: FONT, fontWeight: 800, fontSize: 20, color: C.ink, letterSpacing: 2 }}>🪀 DIVIDEND PAID · COMMUNITY VOTE</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: 22 }}>
              <Coin src="logos/NVDA.png" size={96} />
              <div><div style={{ fontFamily: FONT, fontSize: 22, color: '#5C6660' }}>Holders received, as voted</div><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 52, color: C.deep }}>0.0388 <span style={{ color: C.ink }}>NVDA</span></div><div style={{ fontFamily: FONT, fontSize: 22, color: '#5C6660' }}>412 wallets · loyalty-weighted</div></div>
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
}

/* 6. the loop */
function Loop({ f }) {
  const s = at('loop');
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: 110, textAlign: 'center' }}><Word at={s} size={80}>Every closing bell, a new vote</Word></div>
      <div style={{ display: 'flex', gap: 22, marginTop: 40 }}>
        {days.map((d, i) => f >= s + 20 + i * 12 && (
          <div key={d} style={{ width: 300, borderRadius: 26, background: C.paper, padding: 22, textAlign: 'center', transform: `scale(${pop(f, s + 20 + i * 12)})` }}>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: '#5C6660', letterSpacing: 2 }}>{d} · 4:00 PM</div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}><Coin src={`logos/${['NVDA', 'GLD', 'TSLA', 'NVDA', 'PONS'][i]}.png`} size={84} /></div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: C.ink, marginTop: 10 }}>{['NVDA', 'GLD', 'TSLA', 'NVDA', 'PONS'][i]}</div>
            <div style={{ fontFamily: FONT, fontSize: 20, color: '#5C6660' }}>{['41%', '38%', '35%', '52%', '44%'][i]} of the vote</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

function Outro({ f }) {
  const s = at('outro');
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Img src={staticFile('yoyo-256.png')} style={{ position: 'absolute', top: 160, width: 260, height: 260, transform: `scale(${pop(f, s)}) rotate(${(f - s) * 3}deg)` }} />
      <div style={{ position: 'absolute', top: 470, textAlign: 'center', width: '100%' }}><Word at={s + 6} size={140}>Let them</Word> <Word at={s + 20} size={140} color={C.lime}>vote.</Word></div>
      <div style={{ position: 'absolute', top: 700, width: '100%', textAlign: 'center' }}><Word at={s + 40} size={90} color={C.paper}>yo-yo</Word><Word at={s + 46} size={90} color={C.olive}>.dev</Word></div>
      <div style={{ position: 'absolute', top: 830, width: '100%', textAlign: 'center' }}><Word at={s + 60} size={34} weight={700} color={C.mut}>Robinhood Chain · @yoyotek_bot · t.me/yoyocommu</Word></div>
    </AbsoluteFill>
  );
}

export const Scenario2 = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: 'hidden' }}>
      <Audio src={staticFile('pulse.mp3')} volume={(fr) => (fr > DURATION - 40 ? Math.max(0, ((DURATION - fr) / 40) * 0.12) : 0.12)} />
      {vo.lines.map((l) => <Sequence key={l.id} from={l.startFrame} durationInFrames={Math.ceil(l.duration * FPS) + 4}><Audio src={staticFile(`vo/vote/${l.file}`)} /></Sequence>)}
      <Grid opacity={0.07} />
      <div style={{ position: 'absolute', left: 260, top: -160, width: 1400, height: 1400, borderRadius: 1400, background: 'radial-gradient(circle, rgba(202,249,15,0.14), transparent 60%)' }} />
      {within(f, 'opinions') && <Opinions f={f} />}
      {within(f, 'mode') && <Mode f={f} />}
      {within(f, 'vote') && <Vote f={f} />}
      {within(f, 'sniper') && <Sniper f={f} />}
      {within(f, 'winner') && <Winner f={f} />}
      {within(f, 'loop') && <Loop f={f} />}
      {f >= at('outro') && <Outro f={f} />}
      <Caption f={f} />
      <div style={{ position: 'absolute', top: 40, right: 60, fontFamily: FONT, fontWeight: 800, fontSize: 26, color: 'rgba(255,255,255,0.55)' }}>yo-yo.dev</div>
      {vo.lines.map((l) => <Flash key={l.id} at={l.startFrame} max={0.25} frames={5} color={C.paper} />)}
    </AbsoluteFill>
  );
};
