// Beat analysis for the promo edit: onset envelope, BPM by autocorrelation, beat
// grid with the best phase, energy per beat (to spot drops), and a per-frame
// onset value at 30 fps for pulse animations. Input: mono f32le at 22050 Hz.
import fs from 'fs';

const SR = 22050;
const buf = fs.readFileSync(new URL('./pulse.f32', import.meta.url));
const pcm = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
const HOP = 220; // ~10 ms
const WIN = 1024;

// Spectral flux via a cheap 3-band energy split (low / mid / high) on Hann windows.
function bandEnergies(start) {
  let lo = 0, mid = 0, hi = 0, prev = 0, prev2 = 0;
  for (let i = 0; i < WIN; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / WIN);
    const x = (pcm[start + i] || 0) * w;
    // crude filters: low = smoothed, high = second difference
    const l = 0.9 * prev + 0.1 * x;
    const h = x - 2 * prev + prev2;
    lo += l * l; hi += h * h; mid += (x - l) * (x - l);
    prev2 = prev; prev = x;
  }
  return [lo, mid, hi];
}
const frames = Math.floor((pcm.length - WIN) / HOP);
const bands = new Array(frames);
for (let f = 0; f < frames; f++) bands[f] = bandEnergies(f * HOP).map((e) => Math.log1p(e * 1e3));
const onset = new Float32Array(frames);
for (let f = 1; f < frames; f++) {
  let s = 0;
  for (let b = 0; b < 3; b++) s += Math.max(0, bands[f][b] - bands[f - 1][b]) * (b === 0 ? 1.6 : 1);
  onset[f] = s;
}
// normalise
const mean = onset.reduce((a, b) => a + b, 0) / frames;
for (let f = 0; f < frames; f++) onset[f] = Math.max(0, onset[f] - mean * 0.6);
const peak = Math.max(...onset);
for (let f = 0; f < frames; f++) onset[f] /= peak;

// BPM by autocorrelation over the first 60 s
const N = Math.min(frames, Math.floor((60 * SR) / HOP));
const fps = SR / HOP;
let best = { bpm: 0, score: -1 };
for (let bpm = 70; bpm <= 180; bpm += 0.5) {
  const lag = Math.round((60 / bpm) * fps);
  let s = 0;
  for (let f = 0; f + lag < N; f++) s += onset[f] * onset[f + lag];
  // also reward 2 and 4 beat periodicity
  const lag2 = lag * 2, lag4 = lag * 4;
  let s2 = 0, s4 = 0;
  for (let f = 0; f + lag4 < N; f++) { s2 += onset[f] * onset[f + lag2]; s4 += onset[f] * onset[f + lag4]; }
  const score = s + 0.5 * s2 + 0.5 * s4;
  if (score > best.score) best = { bpm, score };
}
const bpm = best.bpm;
const period = (60 / bpm) * fps; // in onset frames
// phase: shift maximising onset energy on the grid
let bestPhase = { p: 0, s: -1 };
for (let p = 0; p < period; p += 0.25) {
  let s = 0;
  for (let t = p; t < N; t += period) s += onset[Math.round(t)] || 0;
  if (s > bestPhase.s) bestPhase = { p, s };
}
const beats = [];
for (let t = bestPhase.p; t < frames; t += period) beats.push(t / fps);
// energy per beat window (RMS of pcm) to find the loud sections
const beatEnergy = beats.map((b) => {
  const s0 = Math.floor(b * SR), s1 = Math.min(pcm.length, Math.floor((b + 60 / bpm) * SR));
  let e = 0; for (let i = s0; i < s1; i++) e += pcm[i] * pcm[i];
  return Math.sqrt(e / Math.max(1, s1 - s0));
});
// downbeat: the phase (0..3) with the strongest low-band onsets
let db = { k: 0, s: -1 };
for (let k = 0; k < 4; k++) {
  let s = 0;
  for (let i = k; i < beats.length; i += 4) { const f = Math.round(beats[i] * fps); s += bands[f]?.[0] || 0; }
  if (s > db.s) db = { k, s };
}
// per-frame onset at 30 fps
const VFPS = 30;
const seconds = pcm.length / SR;
const perFrame = [];
for (let v = 0; v < Math.floor(seconds * VFPS); v++) {
  const f0 = Math.floor((v / VFPS) * fps), f1 = Math.floor(((v + 1) / VFPS) * fps);
  let m = 0; for (let f = f0; f <= f1; f++) m = Math.max(m, onset[f] || 0);
  perFrame.push(Number(m.toFixed(3)));
}
// energy curve per second (for choosing the 30 s window)
const perSecond = [];
for (let s = 0; s < Math.floor(seconds); s++) { let e = 0; for (let i = s * SR; i < (s + 1) * SR; i++) e += pcm[i] * pcm[i]; perSecond.push(Number(Math.sqrt(e / SR).toFixed(4))); }

const out = { bpm, beatSeconds: 60 / bpm, downbeatIndex: db.k, beats: beats.map((b) => Number(b.toFixed(4))), beatEnergy: beatEnergy.map((e) => Number(e.toFixed(4))), perFrameOnset: perFrame, perSecondRms: perSecond, duration: seconds };
fs.writeFileSync(new URL('../src/beats.json', import.meta.url), JSON.stringify(out));
console.log('bpm', bpm, 'beat', (60 / bpm).toFixed(4), 's', 'downbeat phase', db.k, 'beats', beats.length, 'first beats', beats.slice(0, 6).map((b) => b.toFixed(2)).join(' '));
console.log('rms per 5s:', Array.from({ length: 24 }, (_, i) => perSecond.slice(i * 5, i * 5 + 5).reduce((a, b) => a + b, 0) / 5).map((x) => x.toFixed(3)).join(' '));
