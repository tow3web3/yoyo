// One small looping animation per policy option. Pure SVG + SMIL, no JavaScript
// timers, so 15 of them on one page cost nothing. ViewBox is 300 x 84.
import { getStock } from '../lib/stocks';

const F = 'var(--font-manrope), Manrope, sans-serif';
const M = 'var(--font-jetbrains), "JetBrains Mono", monospace';
const LIME = '#CAF90F', OLIVE = '#6E8C06', INK = '#0B0F0C', MUT = '#9AA39D', LINE = '#DDE3DE', GOLD = '#F6C343', ORANGE = '#FF7A1A', RED = '#FF5000', PAPER = '#FFFFFF';

const logoOf = (t) => (t === 'ETH' ? '/eth.svg' : getStock(t)?.logo);

/** A stock disc: white ring, logo inside. Children = SMIL animations applied to the group. */
function Coin({ x = 0, y = 0, r = 10, t = 'NVDA', ring = LIME, children, opacity }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      <circle r={r} fill={PAPER} stroke={ring} strokeWidth="1.5" />
      <image href={logoOf(t)} x={-r + 2} y={-r + 2} width={2 * r - 4} height={2 * r - 4} clipPath={`circle(${r - 2}px at ${r - 2}px ${r - 2}px)`} />
      {children}
    </g>
  );
}
const Label = ({ x, y, children, anchor = 'start', fill = MUT, size = 10, weight = 700, mono = false }) => (
  <text x={x} y={y} textAnchor={anchor} fill={fill} fontSize={size} fontWeight={weight} fontFamily={mono ? M : F}>{children}</text>
);
/** Fade a node in and out on a shared cycle: visible from `from` to `to` (fractions of dur). */
const blink = (from, to, dur = '6s') => (
  <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes={`0;${from};${Math.min(from + 0.03, to)};${to};${Math.min(to + 0.03, 1)};1`} dur={dur} repeatCount="indefinite" />
);

/* 1. Pay-through in kind: the same coin travels from the launchpad to three holders. */
function InKind() {
  return (
    <svg viewBox="0 0 300 84" className="h-full w-full">
      <rect x="14" y="30" width="62" height="24" rx="12" fill={INK} />
      <Label x="45" y="46" anchor="middle" fill="#fff" size="10">Launchpad</Label>
      <line x1="76" y1="42" x2="204" y2="42" stroke={LINE} strokeWidth="6" strokeLinecap="round" />
      <line x1="76" y1="42" x2="204" y2="42" stroke={LIME} strokeWidth="2" strokeDasharray="4 8"><animate attributeName="stroke-dashoffset" from="0" to="-48" dur="1.5s" repeatCount="indefinite" /></line>
      {[0, 1, 2].map((k) => (
        <g key={k}>
          <rect x="212" y={10 + k * 24} width="76" height="18" rx="9" fill={PAPER} stroke={LINE} />
          <Label x="228" y={23 + k * 24} size="8" mono fill={INK}>{['0x8a2f', '0x3d17', '0xc4a9'][k]}</Label>
          <g opacity="0">
            <Coin x={276} y={19 + k * 24} r={7} t="NVDA" />
            <animate attributeName="opacity" values="0;0;1;1;0" keyTimes={`0;${0.62 + k * 0.06};${0.66 + k * 0.06};0.95;1`} dur="4s" repeatCount="indefinite" />
          </g>
        </g>
      ))}
      <Coin r={11} t="NVDA">
        <animateMotion dur="4s" repeatCount="indefinite" path="M 76 42 L 200 42" keyPoints="0;0;1;1" keyTimes="0;0.1;0.6;1" calcMode="linear" />
        <animate attributeName="opacity" values="0;1;1;1;0;0" keyTimes="0;0.1;0.55;0.62;0.66;1" dur="4s" repeatCount="indefinite" />
      </Coin>
      <Label x="140" y="70" anchor="middle" size="9">NVDA in, NVDA out. No swap.</Label>
    </svg>
  );
}

/* 2. Payout ratio: the split bar breathes between 100/0, 80/20 and 70/30. */
function Payout() {
  const W = 272;
  return (
    <svg viewBox="0 0 300 84" className="h-full w-full">
      <rect x="14" y="30" width={W} height="20" rx="10" fill={INK} />
      <rect x="14" y="30" height="20" rx="10" fill={LIME}>
        <animate attributeName="width" values={`${W};${W};${W * 0.8};${W * 0.8};${W * 0.7};${W * 0.7};${W}`} keyTimes="0;0.25;0.35;0.55;0.65;0.9;1" dur="8s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1" />
      </rect>
      <Label x="14" y="20" size="9" fill={OLIVE}>HOLDERS</Label>
      <Label x="286" y="20" anchor="end" size="9" fill={INK}>YOU</Label>
      {[['100%', '0%', 0, 0.3], ['80%', '20%', 0.33, 0.6], ['70%', '30%', 0.63, 0.92]].map(([h, y, a, b]) => (
        <g key={h} opacity="0">
          <Label x="14" y="70" size="12" mono fill={INK}>{h}</Label>
          <Label x="286" y="70" anchor="end" size="12" mono fill={INK}>{y}</Label>
          {blink(a, b, '8s')}
        </g>
      ))}
      <Label x="150" y="70" anchor="middle" size="9">paid to your address each cycle</Label>
    </svg>
  );
}

/* 3. Record date and loyalty: hold time fills, multiplier climbs, a seller resets. */
function Loyalty() {
  const rows = [['0x8a2f', 0], ['0x3d17', 1], ['0xc4a9', 2]];
  return (
    <svg viewBox="0 0 300 84" className="h-full w-full">
      {rows.map(([name, k]) => {
        const y = 14 + k * 24;
        const sells = k === 2;
        return (
          <g key={name}>
            <Label x="14" y={y + 10} size="8" mono fill={INK}>{name}</Label>
            <rect x="56" y={y + 2} width="180" height="10" rx="5" fill={LINE} />
            <rect x="56" y={y + 2} height="10" rx="5" fill={sells ? RED : LIME}>
              {sells
                ? <animate attributeName="width" values="0;70;70;0;0;40" keyTimes="0;0.4;0.5;0.52;0.6;1" dur="6s" repeatCount="indefinite" />
                : <animate attributeName="width" values="0;180;180" keyTimes={`0;${0.7 + k * 0.1};1`} dur="6s" repeatCount="indefinite" />}
            </rect>
            {sells ? (
              <g>
                <Label x="252" y={y + 11} size="9" mono fill={RED} weight={800}>reset</Label>
                <Label x="250" y={y + 11} size="9" fill={MUT} weight={600} anchor="end">sold</Label>
              </g>
            ) : (
              <g>
                <g opacity="0"><Label x="246" y={y + 11} size="9" mono fill={MUT}>1.0x</Label>{blink(0, 0.35)}</g>
                <g opacity="0"><Label x="246" y={y + 11} size="9" mono fill={OLIVE}>1.5x</Label>{blink(0.38, 0.68)}</g>
                <g opacity="0"><Label x="246" y={y + 11} size="9" mono fill={OLIVE} weight={800}>2.0x 🏅</Label>{blink(0.71, 1)}</g>
              </g>
            )}
          </g>
        );
      })}
      <Label x="56" y="82" size="8">day 0</Label><Label x="236" y="82" size="8" anchor="end">day 30</Label>
    </svg>
  );
}

/* 4. Retained earnings: the vault stacks up, book value per token climbs. */
function Treasury() {
  const bars = [0, 1, 2, 3, 4, 5];
  return (
    <svg viewBox="0 0 300 84" className="h-full w-full">
      <rect x="176" y="8" width="110" height="68" rx="12" fill={INK} />
      <Label x="231" y="22" anchor="middle" fill="#fff" size="8">STOCK TREASURY</Label>
      {bars.map((k) => (
        <rect key={k} x={188 + (k % 3) * 30} y={k < 3 ? 52 : 34} width="26" height="14" rx="4" fill={k % 2 ? GOLD : LIME} opacity="0">
          <animate attributeName="opacity" values="0;0;1;1;0" keyTimes={`0;${0.1 + k * 0.12};${0.14 + k * 0.12};0.95;1`} dur="7s" repeatCount="indefinite" />
        </rect>
      ))}
      <Label x="14" y="24" size="9">BOOK VALUE / TOKEN</Label>
      {[['$0.0000', 0, 0.2], ['$0.0012', 0.22, 0.46], ['$0.0027', 0.48, 0.7], ['$0.0041', 0.72, 0.95]].map(([v, a, b]) => (
        <g key={v} opacity="0"><Label x="14" y="52" size="22" mono fill={INK} weight={800}>{v}</Label>{blink(a, b, '7s')}</g>
      ))}
      <Label x="14" y="72" size="9" fill={OLIVE}>held by a wallet you control</Label>
    </svg>
  );
}

/* 5. Buyback and burn: tokens vanish one by one, supply shrinks. */
function Burn() {
  const n = 9;
  return (
    <svg viewBox="0 0 300 84" className="h-full w-full">
      {Array.from({ length: n }, (_, k) => (
        <g key={k}>
          <circle cx={26 + k * 31} cy="34" r="10" fill={LIME} stroke={INK} strokeWidth="1.5">
            {k >= 5 && <animate attributeName="r" values={`10;10;0;0;10`} keyTimes={`0;${0.15 + (k - 5) * 0.18};${0.22 + (k - 5) * 0.18};0.95;1`} dur="7s" repeatCount="indefinite" />}
          </circle>
          {k >= 5 && (
            <text x={26 + k * 31} y="22" textAnchor="middle" fontSize="14" opacity="0">🔥
              <animate attributeName="opacity" values="0;0;1;0;0" keyTimes={`0;${0.12 + (k - 5) * 0.18};${0.18 + (k - 5) * 0.18};${0.26 + (k - 5) * 0.18};1`} dur="7s" repeatCount="indefinite" />
              <animate attributeName="y" values="26;26;14;14" keyTimes={`0;${0.12 + (k - 5) * 0.18};${0.26 + (k - 5) * 0.18};1`} dur="7s" repeatCount="indefinite" />
            </text>
          )}
        </g>
      ))}
      <Label x="14" y="64" size="9">SUPPLY</Label>
      <rect x="60" y="57" width="226" height="8" rx="4" fill={LINE} />
      <rect x="60" y="57" height="8" rx="4" fill={INK}>
        <animate attributeName="width" values="226;226;125;125;226" keyTimes="0;0.15;0.87;0.95;1" dur="7s" repeatCount="indefinite" />
      </rect>
      <Label x="286" y="80" size="8" anchor="end" fill={ORANGE}>bought back and burned every cycle</Label>
    </svg>
  );
}

/* 6. Dividend yield: the 30 day line draws itself, the APY badge lands. */
function Yield() {
  const d = 'M 14 64 L 40 60 L 66 61 L 92 52 L 118 55 L 144 44 L 170 46 L 196 36 L 222 30 L 248 24 L 274 18';
  return (
    <svg viewBox="0 0 300 84" className="h-full w-full">
      {[24, 44, 64].map((y) => <line key={y} x1="14" x2="286" y1={y} y2={y} stroke={LINE} strokeDasharray="2 4" />)}
      <path d={`${d} L 274 70 L 14 70 Z`} fill={LIME} fillOpacity="0.25">
        <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.55;0.65;0.95;1" dur="6s" repeatCount="indefinite" />
      </path>
      <path d={d} fill="none" stroke={OLIVE} strokeWidth="2.5" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset="100">
        <animate attributeName="stroke-dashoffset" values="100;0;0;100" keyTimes="0;0.55;0.95;1" dur="6s" repeatCount="indefinite" />
      </path>
      <g opacity="0">
        <rect x="192" y="6" width="94" height="22" rx="11" fill={INK} />
        <Label x="239" y="21" anchor="middle" fill={LIME} size="11" mono weight={800}>12.4% APY</Label>
        {blink(0.6, 0.95)}
      </g>
      <Label x="14" y="80" size="8">fees returned, 30 days, annualized vs market cap</Label>
    </svg>
  );
}

/* 7. Closing bell: the hands reach 4:00, the bell rings, a dividend drops. */
function Bell() {
  return (
    <svg viewBox="0 0 300 84" className="h-full w-full">
      <circle cx="46" cy="42" r="28" fill={PAPER} stroke={INK} strokeWidth="2" />
      {[0, 90, 180, 270].map((a) => <line key={a} x1="46" y1="17" x2="46" y2="21" stroke={INK} strokeWidth="2" transform={`rotate(${a} 46 42)`} />)}
      <line x1="46" y1="42" x2="46" y2="24" stroke={INK} strokeWidth="2.5" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" values="0 46 42;360 46 42;360 46 42" keyTimes="0;0.6;1" dur="5s" repeatCount="indefinite" />
      </line>
      <line x1="46" y1="42" x2="46" y2="30" stroke={OLIVE} strokeWidth="3" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" values="90 46 42;120 46 42;120 46 42" keyTimes="0;0.6;1" dur="5s" repeatCount="indefinite" />
      </line>
      <text x="120" y="40" fontSize="30" textAnchor="middle">🔔
        <animateTransform attributeName="transform" type="rotate" values="0 120 30;0 120 30;-14 120 30;14 120 30;-10 120 30;10 120 30;0 120 30;0 120 30" keyTimes="0;0.6;0.64;0.68;0.72;0.76;0.8;1" dur="5s" repeatCount="indefinite" />
      </text>
      <Label x="120" y="72" anchor="middle" size="10" fill={INK} weight={800}>4:00 pm ET</Label>
      <rect x="180" y="52" width="106" height="24" rx="12" fill={INK} />
      <Label x="233" y="68" anchor="middle" fill="#fff" size="9">holders, weekdays</Label>
      <Coin x={233} y={20} r={10} t="SPY">
        <animateTransform attributeName="transform" type="translate" values="233 -20;233 -20;233 40;233 40" keyTimes="0;0.66;0.8;1" dur="5s" repeatCount="indefinite" calcMode="spline" keySplines="0 0 1 1;0.3 0 0.6 1;0 0 1 1" />
        <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.66;0.7;0.95;1" dur="5s" repeatCount="indefinite" />
      </Coin>
    </svg>
  );
}

/* 8. Market hours only: the cursor sweeps the day, coins only fall while Wall Street is open. */
function Hours() {
  return (
    <svg viewBox="0 0 300 84" className="h-full w-full">
      <rect x="14" y="40" width="272" height="10" rx="5" fill={LINE} />
      <rect x="92" y="40" width="118" height="10" rx="5" fill={LIME} />
      <Label x="92" y="66" size="9" fill={INK} anchor="middle" mono>9:30</Label>
      <Label x="210" y="66" size="9" fill={INK} anchor="middle" mono>16:00</Label>
      <Label x="53" y="30" size="8" anchor="middle">closed</Label>
      <Label x="151" y="30" size="8" anchor="middle" fill={OLIVE}>market open</Label>
      <Label x="248" y="30" size="8" anchor="middle">closed</Label>
      <line x1="0" y1="34" x2="0" y2="56" stroke={INK} strokeWidth="2">
        <animateTransform attributeName="transform" type="translate" from="14 0" to="286 0" dur="7s" repeatCount="indefinite" />
      </line>
      {[110, 140, 170, 200].map((x, k) => {
        const t = (x - 14) / 272;
        return (
          <circle key={x} cx={x} cy="18" r="5" fill={LIME} stroke={INK} strokeWidth="1.2" opacity="0">
            <animate attributeName="opacity" values="0;0;1;1;0" keyTimes={`0;${t};${t + 0.03};0.97;1`} dur="7s" repeatCount="indefinite" />
            <animate attributeName="cy" values="8;8;18;18" keyTimes={`0;${t};${t + 0.05};1`} dur="7s" repeatCount="indefinite" />
          </circle>
        );
      })}
      <Label x="150" y="82" anchor="middle" size="8">cycles outside these hours are skipped</Label>
    </svg>
  );
}

/* 9. Any token by address: an address is typed, the token resolves with its route. */
function AnyToken() {
  const addr = '0x8a2f9c41…e7b0';
  return (
    <svg viewBox="0 0 300 84" className="h-full w-full">
      <rect x="14" y="10" width="272" height="28" rx="8" fill={PAPER} stroke={INK} strokeWidth="1.5" />
      <Label x="26" y="29" size="12" mono fill={INK}>{addr}</Label>
      <rect x="26" y="12" height="24" fill="#F4F6F4">
        <animate attributeName="x" values="26;26;150;150;26" keyTimes="0;0.05;0.4;0.98;1" dur="6s" repeatCount="indefinite" />
        <animate attributeName="width" values="150;150;0;0;150" keyTimes="0;0.05;0.4;0.98;1" dur="6s" repeatCount="indefinite" />
      </rect>
      <rect x="0" y="14" width="2" height="20" fill={INK}>
        <animate attributeName="x" values="27;27;150;150" keyTimes="0;0.05;0.4;1" dur="6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0;1;0" dur="0.8s" repeatCount="indefinite" />
      </rect>
      <g opacity="0">
        <rect x="14" y="48" width="272" height="26" rx="13" fill={LIME} />
        <circle cx="30" cy="61" r="8" fill={INK} /><Label x="30" y="64" anchor="middle" fill={LIME} size="7" weight={800}>PP</Label>
        <Label x="44" y="65" size="11" fill={INK} weight={800}>$PEPE</Label>
        <Label x="92" y="65" size="9" fill={INK} weight={600}>route V3 0.3% · $212k liquidity ✓</Label>
        {blink(0.48, 0.96)}
      </g>
    </svg>
  );
}

/* 10. Convert mode: a mixed bag of fees becomes one stock. */
function Convert() {
  const inputs = [['NVDA', 16], ['GLD', 42], ['ETH', 68]];
  return (
    <svg viewBox="0 0 300 84" className="h-full w-full">
      {inputs.map(([t, y]) => (
        <path key={t} d={`M 40 ${y} C 90 ${y} 100 42 140 42`} fill="none" stroke={LINE} strokeWidth="4" strokeLinecap="round" />
      ))}
      <path d="M 160 42 L 240 42" fill="none" stroke={LIME} strokeWidth="4" strokeLinecap="round" />
      {inputs.map(([t, y], k) => (
        <Coin key={t} r={10} t={t}>
          <animateMotion dur="5s" repeatCount="indefinite" path={`M 40 ${y} C 90 ${y} 100 42 140 42`} keyPoints="0;0;1;1" keyTimes={`0;${0.05 + k * 0.08};${0.5 + k * 0.05};1`} calcMode="linear" />
          <animate attributeName="opacity" values="1;1;1;0;0;1" keyTimes={`0;0.1;${0.5 + k * 0.05};${0.54 + k * 0.05};0.98;1`} dur="5s" repeatCount="indefinite" />
        </Coin>
      ))}
      <circle cx="150" cy="42" r="14" fill={INK} />
      <text x="150" y="47" textAnchor="middle" fontSize="13" fill={LIME}>⇄</text>
      <Coin x={250} y={42} r={16} t="SPY">
        <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.6;0.7;0.96;1" dur="5s" repeatCount="indefinite" />
      </Coin>
      <Label x="250" y="76" anchor="middle" size="9" fill={INK} weight={800}>one stock out</Label>
      <Label x="20" y="80" size="9">whatever comes in</Label>
    </svg>
  );
}

/* 11. Roulette, Top Gainer, Portfolio: the reel spins and lands on a stock. */
function Reel() {
  const list = ['AAPL', 'COIN', 'GLD', 'TSLA', 'SPY', 'NVDA', 'AMD', 'META', 'GME', 'AAPL', 'COIN', 'GLD', 'TSLA', 'SPY', 'NVDA'];
  return (
    <svg viewBox="0 0 300 84" className="h-full w-full">
      <text x="34" y="52" fontSize="30" textAnchor="middle">🎰</text>
      <defs><clipPath id="reel-clip"><rect x="80" y="8" width="140" height="68" rx="10" /></clipPath></defs>
      <rect x="80" y="8" width="140" height="68" rx="10" fill={INK} />
      <rect x="86" y="32" width="128" height="20" rx="6" fill={LIME} opacity="0.9" />
      <g clipPath="url(#reel-clip)">
        <g>
          {list.map((t, k) => (
            <text key={k} x="150" y={47 + k * 22} textAnchor="middle" fontSize="13" fontWeight="800" fontFamily={M} fill={k === 5 ? INK : '#9AA39D'}>{t}</text>
          ))}
          <animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -110;0 -110" keyTimes="0;0.1;0.7;1" dur="5s" repeatCount="indefinite" calcMode="spline" keySplines="0 0 1 1;0.15 0.85 0.25 1;0 0 1 1" />
        </g>
      </g>
      <Label x="232" y="30" size="9" fill={MUT}>this cycle</Label>
      <g opacity="0">
        <Label x="232" y="50" size="14" fill={INK} weight={800} mono>NVDA</Label>
        <Label x="232" y="66" size="9" fill={OLIVE} weight={700}>+3.4% today 🚀</Label>
        {blink(0.7, 0.98, '5s')}
      </g>
    </svg>
  );
}

/* 12. Community vote: bars fill, the winner turns lime. */
function VoteScene() {
  const rows = [['NVDA', 190, true], ['GLD', 120, false], ['SPY', 84, false]];
  return (
    <svg viewBox="0 0 300 84" className="h-full w-full">
      {rows.map(([t, w, win], k) => {
        const y = 10 + k * 22;
        return (
          <g key={t}>
            <Label x="14" y={y + 12} size="10" mono fill={INK} weight={800}>{t}</Label>
            <rect x="56" y={y + 3} width="200" height="12" rx="6" fill={LINE} />
            <rect x="56" y={y + 3} height="12" rx="6" fill={win ? LIME : '#C9D1CB'}>
              <animate attributeName="width" values={`0;${w * 0.4};${w};${w};0`} keyTimes="0;0.3;0.7;0.95;1" dur="6s" repeatCount="indefinite" calcMode="spline" keySplines="0.2 0 0.4 1;0.2 0 0.4 1;0 0 1 1;0 0 1 1" />
            </rect>
            {win && <g opacity="0"><Label x="270" y={y + 13} size="12" fill={OLIVE} weight={800}>✓</Label>{blink(0.72, 0.95)}</g>}
          </g>
        );
      })}
      <Label x="14" y="80" size="8">weighted by balance and loyalty, gasless signature</Label>
    </svg>
  );
}

/* 13. Fair-price guard: the gauge checks the fill against Yahoo; a bad quote pays ETH instead. */
function Guard() {
  return (
    <svg viewBox="0 0 300 84" className="h-full w-full">
      <path d="M 16 62 A 40 40 0 0 1 96 62" fill="none" stroke={LINE} strokeWidth="10" strokeLinecap="round" />
      <path d="M 78 33 A 40 40 0 0 1 96 62" fill="none" stroke={LIME} strokeWidth="10" strokeLinecap="round" />
      <line x1="56" y1="62" x2="56" y2="30" stroke={INK} strokeWidth="3" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" values="-80 56 62;62 56 62;62 56 62;-30 56 62;-30 56 62;-80 56 62" keyTimes="0;0.25;0.48;0.62;0.9;1" dur="8s" repeatCount="indefinite" calcMode="spline" keySplines="0.3 0 0.2 1;0 0 1 1;0.3 0 0.2 1;0 0 1 1;0.3 0 0.2 1" />
      </line>
      <circle cx="56" cy="62" r="4" fill={INK} />
      <Label x="56" y="78" anchor="middle" size="8">fill vs fair price</Label>
      <g opacity="0">
        <Label x="118" y="34" size="20" mono fill={OLIVE} weight={800}>98.6%</Label>
        <Label x="118" y="52" size="10" fill={INK} weight={700}>of Yahoo fair value ✓ swap executed</Label>
        {blink(0.22, 0.48, '8s')}
      </g>
      <g opacity="0">
        <Label x="118" y="34" size="20" mono fill={RED} weight={800}>71.2%</Label>
        <Label x="118" y="52" size="10" fill={INK} weight={700}>thin pool, no fill: holders get ETH</Label>
        <Coin x={128} y={68} r={7} t="ETH" ring={INK} /><Label x="140" y="71" size="8" fill={MUT}>ETH fallback this cycle</Label>
        {blink(0.6, 0.9, '8s')}
      </g>
    </svg>
  );
}

/* 14. Encrypted keys: the key goes in, the secret becomes ciphertext. */
function Keys() {
  return (
    <svg viewBox="0 0 300 84" className="h-full w-full">
      <text x="40" y="54" fontSize="30" textAnchor="middle">🔑
        <animateTransform attributeName="transform" type="translate" values="0 0;0 0;44 0;44 0;0 0" keyTimes="0;0.2;0.45;0.9;1" dur="6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;1;1;0;0;1" keyTimes="0;0.2;0.42;0.46;0.95;1" dur="6s" repeatCount="indefinite" />
      </text>
      <g opacity="1"><text x="96" y="54" fontSize="30" textAnchor="middle">🔓</text><animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;0.44;0.46;0.95;1" dur="6s" repeatCount="indefinite" /></g>
      <g opacity="0"><text x="96" y="54" fontSize="30" textAnchor="middle">🔒</text><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.44;0.46;0.95;1" dur="6s" repeatCount="indefinite" /></g>
      <rect x="128" y="26" width="158" height="30" rx="8" fill={INK} />
      <g opacity="1"><Label x="207" y="46" anchor="middle" fill={LIME} size="11" mono>0xa8f3…c91e private key</Label><animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;0.46;0.5;0.95;1" dur="6s" repeatCount="indefinite" /></g>
      <g opacity="0"><Label x="207" y="46" anchor="middle" fill="#fff" size="11" mono>AES-256-GCM ••••••••••••</Label><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.46;0.5;0.95;1" dur="6s" repeatCount="indefinite" /></g>
      <Label x="207" y="72" anchor="middle" size="8">decrypted in memory, at run time only</Label>
    </svg>
  );
}

/* 15. Receipts and statements: the card lands in the group, Share lights up. */
function Receipts() {
  return (
    <svg viewBox="0 0 300 84" className="h-full w-full">
      <defs><clipPath id="chat-clip"><rect x="14" y="4" width="272" height="76" rx="10" /></clipPath></defs>
      <rect x="14" y="4" width="272" height="76" rx="10" fill="#0f1512" />
      <circle cx="30" cy="16" r="6" fill={LIME} /><Label x="42" y="19" fill="#fff" size="8">$PEPE holders · 1,204</Label>
      <g clipPath="url(#chat-clip)">
        <g>
          <rect x="24" y="28" width="196" height="46" rx="8" fill={PAPER} />
          <rect x="24" y="28" width="196" height="12" rx="6" fill={LIME} />
          <Label x="32" y="37" size="7" fill={INK} weight={800}>🪀 DIVIDEND PAID · 4:00 PM ET</Label>
          <Coin x={42} y={57} r={10} t="NVDA" />
          <Label x="58" y="54" size="8" fill={MUT}>Holders received</Label>
          <Label x="58" y="68" size="12" fill={OLIVE} weight={800} mono>0.0421 NVDA</Label>
          <animateTransform attributeName="transform" type="translate" values="0 60;0 60;0 0;0 0;0 60" keyTimes="0;0.1;0.3;0.95;1" dur="6s" repeatCount="indefinite" calcMode="spline" keySplines="0 0 1 1;0.2 0.8 0.2 1;0 0 1 1;0 0 1 1" />
        </g>
      </g>
      <g opacity="0">
        <rect x="228" y="40" width="50" height="18" rx="9" fill={INK} stroke={LIME} />
        <Label x="253" y="53" anchor="middle" fill="#fff" size="9" weight={800}>𝕏 Share</Label>
        {blink(0.4, 0.95)}
      </g>
      <g opacity="0">
        <rect x="228" y="62" width="50" height="14" rx="7" fill={LIME} />
        <Label x="253" y="72" anchor="middle" fill={INK} size="7" weight={800}>statement ↗</Label>
        {blink(0.55, 0.95)}
      </g>
    </svg>
  );
}

const SCENES = { inkind: InKind, payout: Payout, loyalty: Loyalty, treasury: Treasury, burn: Burn, yield: Yield, bell: Bell, hours: Hours, anytoken: AnyToken, convert: Convert, reel: Reel, vote: VoteScene, guard: Guard, keys: Keys, receipts: Receipts };

export default function ModeScene({ kind }) {
  const S = SCENES[kind];
  if (!S) return null;
  return (
    <div className="mode-stage mb-4 aspect-[300/84] w-full overflow-hidden rounded-xl border border-line bg-[#F6F8F3]">
      <S />
    </div>
  );
}
