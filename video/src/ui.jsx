import React from 'react';
import { Img, staticFile, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { loadFont as loadManrope } from '@remotion/google-fonts/Manrope';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';

const manrope = loadManrope('normal', { weights: ['700', '800'], subsets: ['latin'] });
const mono = loadMono('normal', { weights: ['700'], subsets: ['latin'] });
export const FONT = manrope.fontFamily;
export const MONO = mono.fontFamily;

export const C = { lime: '#CAF90F', olive: '#93B80A', deep: '#6E8C06', ink: '#0B0F0C', paper: '#FFFFFF', mut: '#9AA39D', gold: '#F6C343', orange: '#FF7A1A', red: '#FF5000', tile: '#151b17' };

/** Spring-in helper: returns 0..1 with overshoot, starting at `from` frame. */
// Not a hook on purpose: it is called inside conditionals and loops, so it must not touch React state.
export function pop(frame, from, { damping = 12, stiffness = 180, mass = 0.6 } = {}) {
  return spring({ frame: frame - from, fps: 30, config: { damping, stiffness, mass } });
}

/** Word that scales in with a spring at a given frame. */
export function Word({ children, at, style = {}, color = C.paper, size = 120, weight = 800 }) {
  const frame = useCurrentFrame();
  const p = pop(frame, at);
  if (frame < at) return null;
  return (
    <span style={{ display: 'inline-block', fontFamily: FONT, fontWeight: weight, fontSize: size, color, letterSpacing: -3, lineHeight: 1, marginRight: '0.22em', transform: `scale(${0.6 + 0.4 * p}) translateY(${(1 - p) * 30}px)`, opacity: Math.min(1, p * 1.4), ...style }}>{children}</span>
  );
}

export function Grid({ opacity = 0.08 }) {
  return <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(202,249,15,${opacity}) 1px, transparent 1px), linear-gradient(90deg, rgba(202,249,15,${opacity}) 1px, transparent 1px)`, backgroundSize: '64px 64px' }} />;
}

export function Coin({ src, size = 120, style = {} }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size, background: '#fff', border: `${Math.max(3, size * 0.05)}px solid ${C.lime}`, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
      <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
}

export function Pill({ children, color = C.lime, text = C.ink, size = 30, style = {} }) {
  return <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: color, color: text, fontFamily: FONT, fontWeight: 800, fontSize: size, padding: `${size * 0.35}px ${size * 0.9}px`, borderRadius: 999, letterSpacing: -0.5, ...style }}>{children}</div>;
}

/** A flash that fades quickly, for beat hits. */
export function Flash({ at, color = C.lime, max = 0.9, frames = 8 }) {
  const frame = useCurrentFrame();
  if (frame < at || frame > at + frames) return null;
  const o = interpolate(frame, [at, at + frames], [max, 0]);
  return <div style={{ position: 'absolute', inset: 0, background: color, opacity: o }} />;
}
