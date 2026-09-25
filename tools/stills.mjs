// Renders individual frames for review.
//   node tools/stills.mjs 1.2 3.5 7.6        -> out/stills/t001.20.png ...
//   node tools/stills.mjs --sheet 0 8 0.5    -> contact sheet of t = 0..8 step 0.5
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, startServer, launch, openPage } from './harness.mjs';

const args = process.argv.slice(2);
let times = [];
let sheet = null;
if (args[0] === '--sheet') {
  const [a, b, step] = args.slice(1).map(Number);
  for (let t = a; t <= b + 1e-9; t += step) times.push(+t.toFixed(4));
  sheet = args[4] || `sheet_${a}_${b}`;
} else times = args.map(Number);

const dir = path.join(ROOT, 'out', 'stills');
fs.mkdirSync(dir, { recursive: true });
const srv = await startServer();
const browser = await launch();
const r = await openPage(browser, srv.address().port);
const files = [];
for (const t of times) {
  const buf = await r.frame(t);
  const f = path.join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`);
  fs.writeFileSync(f, buf);
  files.push(f);
}
await browser.close();
srv.close();

if (sheet) {
  const outFile = path.join(ROOT, 'out', `${sheet}.png`);
  execFileSync('python3', [path.join(ROOT, 'tools', 'sheet.py'), outFile, '4', ...files], { cwd: ROOT, stdio: 'inherit' });
} else files.forEach((f) => console.log(f));
