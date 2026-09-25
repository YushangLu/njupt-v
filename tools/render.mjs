// Renders the animation to MP4.
//   node tools/render.mjs [--fps 60] [--start 0] [--end 61.5] [--workers 4] [--out out/NJUPT.mp4]
// Frames are split into contiguous chunks, one headless Chromium per worker,
// each piping PNG frames into its own ffmpeg. Chunks are then joined and
// muxed with out/soundtrack.wav.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { ROOT, startServer, launch, openPage } from './harness.mjs';
import { DURATION } from '../src/timeline.js';

const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : def;
};
const FPS = Number(arg('fps', 60));
const START = Number(arg('start', 0));
const END = Number(arg('end', DURATION));
const WORKERS = Number(arg('workers', Math.max(1, os.cpus().length)));
const OUT = path.resolve(ROOT, arg('out', 'out/NJUPT.mp4'));
const CRF = arg('crf', '18');
const AUDIO = path.join(ROOT, 'out', 'soundtrack.wav');

const f0 = Math.round(START * FPS);
const f1 = Math.round(END * FPS);
const total = f1 - f0;
const chunkDir = path.join(ROOT, 'out', 'chunks');
fs.rmSync(chunkDir, { recursive: true, force: true });
fs.mkdirSync(chunkDir, { recursive: true });

const srv = await startServer();
const port = srv.address().port;
const per = Math.ceil(total / WORKERS);
let done = 0;
const t0 = Date.now();

async function worker(k) {
  const a = f0 + k * per;
  const b = Math.min(f1, a + per);
  if (a >= b) return null;
  const file = path.join(chunkDir, `chunk_${String(k).padStart(2, '0')}.mp4`);
  const ff = spawn(
    'ffmpeg',
    ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=bicubic+accurate_rnd+full_chroma_int',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '10', '-pix_fmt', 'yuv420p',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', file],
    { stdio: ['pipe', 'inherit', 'inherit'] }
  );
  const closed = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  const browser = await launch();
  const r = await openPage(browser, port);
  for (let f = a; f < b; f++) {
    const buf = await r.frame(f / FPS);
    if (!ff.stdin.write(buf)) await new Promise((res) => ff.stdin.once('drain', res));
    done++;
    if (done % 60 === 0) {
      const el = (Date.now() - t0) / 1000;
      process.stdout.write(`\r${done}/${total} frames  ${(done / el).toFixed(1)} fps  eta ${((total - done) / (done / el)).toFixed(0)}s   `);
    }
  }
  ff.stdin.end();
  await closed;
  await browser.close();
  return file;
}

const files = (await Promise.all(Array.from({ length: WORKERS }, (_, k) => worker(k)))).filter(Boolean);
srv.close();
console.log(`\nrendered ${total} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

const list = path.join(chunkDir, 'list.txt');
fs.writeFileSync(list, files.map((f) => `file '${f}'`).join('\n'));
const hasAudio = fs.existsSync(AUDIO) && START === 0;
const args = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
if (hasAudio) args.push('-i', AUDIO);
args.push(
  '-vf', 'vignette=angle=0.5',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2',
  '-r', String(FPS), '-g', String(FPS * 2), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-movflags', '+faststart', '-metadata', 'title=南京邮电大学 NJUPT'
);
if (hasAudio) args.push('-c:a', 'aac', '-b:a', '256k', '-shortest');
args.push(OUT);
execFileSync('ffmpeg', args, { stdio: 'inherit' });
console.log(OUT, (fs.statSync(OUT).size / 1e6).toFixed(1), 'MB');
