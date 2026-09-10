// Voice-over generator: one mp3 per line with edge-tts, durations measured with
// ffprobe, timeline written for the composition. Usage:
//   node analysis/vo.mjs <script.json> <voice> <outDir> <timeline.json>
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const [scriptFile, voice, outDir, timelineFile] = process.argv.slice(2);
const lines = JSON.parse(fs.readFileSync(scriptFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
const FPS = 30;
const GAP = 0.55; // seconds of air after each line
let t = 0.6; // lead-in
const timeline = [];
for (let i = 0; i < lines.length; i++) {
  const file = path.join(outDir, `line-${String(i + 1).padStart(2, '0')}.mp3`);
  execFileSync('python', ['-m', 'edge_tts', '--voice', voice, '--rate', '+4%', '--text', lines[i].text, '--write-media', file], { stdio: 'ignore' });
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());
  const start = Math.round(t * FPS);
  const hold = Number(lines[i].hold || 0);
  t += dur + GAP + hold;
  timeline.push({ id: lines[i].id, text: lines[i].text, file: path.basename(file), duration: dur, startFrame: start, endFrame: Math.round(t * FPS) });
  console.log(lines[i].id, dur.toFixed(2) + 's', 'frames', start, '->', Math.round(t * FPS));
}
fs.writeFileSync(timelineFile, JSON.stringify({ fps: FPS, total: Math.round((t + 1.2) * FPS), lines: timeline }, null, 2));
console.log('total frames', Math.round((t + 1.2) * FPS), 'seconds', (t + 1.2).toFixed(1));
