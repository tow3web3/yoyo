// Beat helpers derived from analysis/beats.mjs output. The track is 124 BPM,
// downbeat on beat index 1, so bars start at beats 1, 5, 9, ...
import beats from './beats.json';

export const FPS = 30;
export const BPM = beats.bpm;
export const BEAT = beats.beatSeconds; // seconds
export const beatTime = (i) => beats.beats[i] ?? beats.beats[0] + i * BEAT;
export const beatFrame = (i) => Math.round((Number.isInteger(i) ? beatTime(i) : beats.beats[0] + i * BEAT) * FPS);
export const onsetAt = (frame) => beats.perFrameOnset[Math.max(0, Math.min(beats.perFrameOnset.length - 1, frame))] || 0;

/** 0..1 pulse that spikes on every beat and decays over ~a third of a beat. */
export function pulse(frame, decayBeats = 0.35) {
  const t = frame / FPS;
  const first = beats.beats[0];
  const k = Math.floor((t - first) / BEAT);
  const since = t - (first + k * BEAT);
  if (k < 0) return 0;
  return Math.max(0, 1 - since / (BEAT * decayBeats));
}
/** Which beat index we are on at this frame (fractional). */
export const beatPos = (frame) => (frame / FPS - beats.beats[0]) / BEAT;
