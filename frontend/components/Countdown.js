'use client';

import { useEffect, useState } from 'react';

const NY = 'America/New_York';

// Next New York wall-clock hh:mm on a weekday, as an epoch ms.
function nextBell(hour, minute) {
  const now = new Date();
  for (let d = 0; d < 8; d++) {
    const probe = new Date(now.getTime() + d * 86400000);
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: NY, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(probe);
    const g = (t) => parts.find((p) => p.type === t)?.value;
    if (g('weekday') === 'Sat' || g('weekday') === 'Sun') continue;
    const nowMin = Number(g('hour')) * 60 + Number(g('minute'));
    if (d === 0 && nowMin >= hour * 60 + minute) continue;
    // Build the target instant: NY offset derived from the probe's local rendering.
    const utcGuess = Date.UTC(Number(g('year')), Number(g('month')) - 1, Number(g('day')), hour, minute);
    const nyRendered = new Date(utcGuess).toLocaleString('en-US', { timeZone: NY, hour12: false });
    const [dPart, tPart] = nyRendered.split(', ');
    const [mm, dd, yy] = dPart.split('/').map(Number);
    const [hh, mi] = tPart.split(':').map(Number);
    const renderedUtc = Date.UTC(yy, mm - 1, dd, hh, mi);
    return utcGuess + (utcGuess - renderedUtc);
  }
  return Date.now();
}

// Interval schedules fire on wall-clock boundaries (*/m at :00s).
function nextRunAt(m) {
  const d = new Date();
  d.setSeconds(0, 0);
  for (let i = 0; i < 24 * 60; i++) {
    d.setMinutes(d.getMinutes() + 1);
    if (!m || d.getMinutes() % m === 0) break;
  }
  return d.getTime();
}

export default function Countdown({ intervalMinutes, scheduleKind = 'interval', className = '' }) {
  const [left, setLeft] = useState(null);

  useEffect(() => {
    const target = () => {
      if (scheduleKind === 'closing_bell') return nextBell(16, 0);
      if (scheduleKind === 'opening_bell') return nextBell(9, 30);
      return nextRunAt(intervalMinutes);
    };
    const tick = () => setLeft(Math.max(0, target() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [intervalMinutes, scheduleKind]);

  if (left === null) return <span className={className}>--:--</span>;
  const s = Math.ceil(left / 1000);
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return <span className={className}>{h > 0 ? `${h}:` : ''}{mm}:{ss}</span>;
}
