'use client';

// A playable yo-yo. Hangs from the finger at the top of the hero. Click to throw:
// the string unwinds and the disc spins up as it drops (a yo-yo falls slower than
// a stone because the axle has to spin the whole disc). At the bottom it sleeps,
// spinning on the string and losing a little spin to friction. Click again to tug:
// spin turns back into climb and the string winds up. Enough spin, it comes home
// and pops into the hand. Too little, it stalls and drops back to sleep.
import { useEffect, useRef, useState } from 'react';

const FACE = '/brand/yoyoface-512.png';
const G = 2400; // px/s², gravity in canvas units
const INERTIA = 3.2; // 1 + I/(m r²): how much the axle slows the fall
const AXLE = 13; // px, the coupling radius between string speed and spin
const FRICTION_TAU = 2.6; // s, spin half-life-ish while sleeping
const MIN_RETURN_SPIN = 28; // rad/s needed for a tug to bring it home

export default function YoyoSim({ className = '' }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const state = useRef(null);
  const [returns, setReturns] = useState(0);
  const [hint, setHint] = useState('Click the yo-yo');

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = FACE;
    let ready = false;
    img.onload = () => { ready = true; };

    const s = {
      mode: 'hand', // hand | down | sleep | up
      y: 0, v: 0, omega: 0, angle: 0,
      theta: 0, thetaV: 0, // sway pendulum
      squash: 0, catchPulse: 0, sleepT: 0, idle: 0,
      W: 0, H: 0, L: 0, R: 0, x0: 0, y0: 0,
      last: performance.now(), returns: 0,
    };
    state.current = s;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      s.W = rect.width; s.H = rect.height;
      canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.R = Math.max(44, Math.min(78, rect.width * 0.17));
      // hangs right of centre and sleeps above the dividend card that overlaps the bottom-left
      s.x0 = rect.width * 0.6; s.y0 = 34;
      s.L = Math.max(120, Math.min(rect.height - s.y0 - 2 * s.R - 26, rect.height * 0.6 - s.y0 - 2 * s.R));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const step = (dt) => {
      const aDown = G / INERTIA;
      s.idle += dt;
      if (s.mode === 'down') {
        s.v += aDown * dt;
        s.y += s.v * dt;
        s.omega = s.v / AXLE;
        if (s.y >= s.L) { s.y = s.L; s.mode = 'sleep'; s.v = 0; s.squash = 1; s.sleepT = 0; s.thetaV += 0.6 * (Math.random() - 0.5); }
      } else if (s.mode === 'sleep') {
        s.omega *= Math.exp(-dt / FRICTION_TAU);
        s.sleepT += dt;
        if (s.omega < 0.6) s.omega = 0;
      } else if (s.mode === 'up') {
        s.v += aDown * dt; // gravity fights the climb
        s.y += s.v * dt;
        s.omega = Math.max(0, -s.v / AXLE); // winding eats spin
        if (s.v >= 0) { s.mode = 'down'; s.omega = 0.2; } // stalled: falls back, rewinds spin on the way down
        if (s.y <= 0) { s.y = 0; s.v = 0; s.mode = 'hand'; s.omega = 0; s.catchPulse = 1; s.returns += 1; setReturns(s.returns); s.thetaV *= 0.3; }
      } else {
        s.omega *= Math.exp(-dt / 0.4);
      }
      s.angle += s.omega * dt;
      // sway: pendulum on the unwound length
      const len = Math.max(60, s.y + s.R);
      s.thetaV += (-(G / len) * Math.sin(s.theta) - 1.6 * s.thetaV) * dt;
      s.theta += s.thetaV * dt;
      s.squash = Math.max(0, s.squash - dt * 3);
      s.catchPulse = Math.max(0, s.catchPulse - dt * 2.5);
    };

    const draw = () => {
      const { W, H, R, x0, y0 } = s;
      ctx.clearRect(0, 0, W, H);
      const len = s.y + R * 0.15;
      const cx = x0 + Math.sin(s.theta) * (s.y + R);
      const cy = y0 + Math.cos(s.theta) * (s.y + R);
      // finger loop at the top
      ctx.save();
      ctx.translate(x0, y0);
      ctx.fillStyle = '#0B0F0C';
      ctx.beginPath(); ctx.roundRect(-16, -22, 32, 26, 12); ctx.fill();
      ctx.fillStyle = '#CAF90F';
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // string: a rope with a little bow when climbing or sleeping
      const bow = s.mode === 'up' ? -Math.min(24, Math.abs(s.v) * 0.02) : s.mode === 'sleep' ? Math.sin(s.sleepT * 9) * 3 : 0;
      const mx = (x0 + cx) / 2 + bow + Math.sin(s.theta) * 4;
      const my = (y0 + cy) / 2;
      const top = { x: cx - Math.sin(s.theta) * R * 0.15, y: cy - Math.cos(s.theta) * R * 0.15 };
      if (s.mode !== 'hand' || s.catchPulse > 0) {
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0B0F0C'; ctx.lineWidth = 4.5;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, top.x, top.y); ctx.stroke();
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, top.x, top.y); ctx.stroke();
        void len;
      }
      // shadow on the "floor"
      const floorY = y0 + s.L + R + 14;
      const near = Math.min(1, Math.max(0, (cy + R) / floorY));
      ctx.fillStyle = `rgba(11,15,12,${0.06 + near * 0.12})`;
      ctx.beginPath(); ctx.ellipse(cx, floorY, R * (0.55 + near * 0.45), 7 + near * 5, 0, 0, Math.PI * 2); ctx.fill();
      // the disc
      ctx.save();
      ctx.translate(cx, cy);
      const pulse = 1 + s.catchPulse * 0.12;
      const sq = 1 + s.squash * 0.10;
      ctx.scale(pulse * (2 - sq), pulse * sq);
      ctx.rotate(s.angle);
      ctx.shadowColor = 'rgba(11,15,12,0.25)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 12;
      if (ready) ctx.drawImage(img, -R, -R, R * 2, R * 2);
      else { ctx.fillStyle = '#CAF90F'; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      // motion blur streaks when spinning fast
      if (s.omega > 20) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(s.angle * 0.35);
        ctx.strokeStyle = `rgba(202,249,15,${Math.min(0.5, (s.omega - 20) / 120)})`; ctx.lineWidth = 3;
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(0, 0, R + 6 + k * 5, k * 2.1, k * 2.1 + 1.2); ctx.stroke(); }
        ctx.restore();
      }
    };

    let raf;
    const loop = (t) => {
      const dt = Math.min(0.033, (t - s.last) / 1000);
      s.last = t;
      // substeps keep the string taut at high speed
      for (let i = 0; i < 3; i++) step(dt / 3);
      draw();
      if (s.mode === 'hand' && s.idle > 4 && s.returns === 0) setHint('Click the yo-yo to throw it');
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  const act = () => {
    const s = state.current;
    if (!s) return;
    s.idle = 0;
    if (s.mode === 'hand') {
      s.mode = 'down'; s.v = 520; s.omega = s.v / AXLE; s.thetaV += 1.2 * (Math.random() - 0.5);
      setHint('Wait for it to sleep, then tug');
    } else if (s.mode === 'sleep') {
      if (s.omega >= MIN_RETURN_SPIN) {
        s.mode = 'up'; s.v = -Math.max(700, s.omega * AXLE * 0.95); setHint('Coming home');
      } else {
        // not enough spin: a weak hop, it drops back
        s.mode = 'up'; s.v = -Math.max(220, s.omega * AXLE * 0.8); s.omega = Math.max(s.omega, 6); setHint('Too slow, it stalls. Throw again');
      }
      s.thetaV += 0.8 * (Math.random() - 0.5);
    } else if (s.mode === 'down') {
      // tug mid-drop: an upward impulse, the spin is still there
      s.v -= 760; if (s.v < 0) { s.mode = 'up'; }
      setHint('Tugged mid-air');
    } else if (s.mode === 'up') {
      s.v -= 380; // extra pull while climbing
    }
  };

  return (
    <div ref={wrapRef} className={`relative h-full w-full select-none ${className}`}>
      <canvas ref={canvasRef} onPointerDown={(e) => { e.preventDefault(); act(); }} className="block h-full w-full cursor-pointer touch-none" aria-label="Playable yo-yo: click to throw, click again to bring it back" role="img" />
      <div className="pointer-events-none absolute right-3 top-3 whitespace-nowrap rounded-full border border-line bg-paper/90 px-2.5 py-1 text-[11px] font-semibold text-mut shadow-soft">{hint}{returns > 0 ? ` · ${returns} return${returns > 1 ? 's' : ''}` : ''}</div>
    </div>
  );
}
