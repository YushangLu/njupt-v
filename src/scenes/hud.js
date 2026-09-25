// Persistent broadcast-style HUD: corner brackets, section index, timecode,
// location and a beat-driven level meter.
import { el, env, hash, scramble, invlerp, clamp, pulse } from '../lib/util.js';
import { S, BEAT, FPS, bar } from '../timeline.js';

const SECTIONS = [
  [S.intro[0], '01', 'SIGNAL'],
  [S.title[0], '02', 'IDENTITY'],
  [S.timeline[0], '03', 'HISTORY'],
  [S.strengths[0], '04', 'STRENGTH'],
  [S.motto[0], '05', 'MOTTO'],
  [S.spirit[0], '06', 'SPIRIT'],
  [S.finale[0], '07', 'CONNECT'],
];

// Rough musical energy used to drive the level meter.
function energy(t) {
  if (t < bar(1)) return 0.15;
  if (t < bar(4)) return 0.35;
  if (t < bar(22)) return 1;
  if (t < bar(26)) return 0.45;
  if (t < bar(30)) return 0.8;
  return 1;
}

const scene = {
  range: [0, 61.5],
  init(ctx) {
    const root = (this.root = el('div', 'scene', ctx.hud));
    const inset = 44;
    const corners = [
      { left: inset, top: inset, borderLeftWidth: 2, borderTopWidth: 2 },
      { right: inset, top: inset, borderRightWidth: 2, borderTopWidth: 2 },
      { left: inset, bottom: inset, borderLeftWidth: 2, borderBottomWidth: 2 },
      { right: inset, bottom: inset, borderRightWidth: 2, borderBottomWidth: 2 },
    ];
    this.corners = corners.map((c) => {
      const e = el('div', 'hud-corner', root);
      Object.entries(c).forEach(([k, v]) => (e.style[k] = typeof v === 'number' ? v + 'px' : v));
      return e;
    });
    this.tl = el('div', 'hud-label', root);
    this.tl.style.left = '96px';
    this.tl.style.top = '58px';
    this.tr = el('div', 'hud-label', root);
    this.tr.style.right = '96px';
    this.tr.style.top = '58px';
    this.bl = el('div', 'hud-label', root);
    this.bl.style.left = '96px';
    this.bl.style.bottom = '56px';
    this.bl.textContent = '32°03′N  118°47′E  ·  NANJING';
    const bars = (this.bars = el('div', 'hud-bars', root));
    bars.style.right = '96px';
    bars.style.bottom = '56px';
    this.barEls = Array.from({ length: 16 }, () => el('i', '', bars));
  },
  update(t) {
    const a = env(t, 0.3, 1.4, 59.6, 60.4);
    // Quieter during the motto so the calligraphy can breathe.
    const dim = 1 - 0.55 * env(t, S.motto[0] - 0.2, S.motto[0] + 0.4, S.motto[1] - 0.4, S.motto[1]);
    const finaleDim = 1 - 0.7 * env(t, S.finale[0], S.finale[0] + 0.6, 70, 71);
    this.root.style.opacity = (a * dim * finaleDim).toFixed(3);
    const grow = invlerp(0.3, 1.2, t);
    this.corners.forEach((c) => {
      c.style.width = c.style.height = (34 * grow).toFixed(1) + 'px';
    });

    let idx = 0;
    while (idx < SECTIONS.length - 1 && t >= SECTIONS[idx + 1][0]) idx++;
    const [st, num, name] = SECTIONS[idx];
    const p = clamp((t - st) / 0.35);
    const frame = Math.round(t * FPS);
    this.tl.innerHTML = '<b>NJUPT</b>  //  ' + scramble(`${num}  ${name}`, t < 0.3 ? 0 : p, frame);

    const f = Math.floor(t * FPS) % FPS;
    const s = Math.floor(t) % 60;
    const m = Math.floor(t / 60);
    const pad = (n) => String(n).padStart(2, '0');
    const blink = Math.floor(t * 2) % 2 === 0 ? 1 : 0.25;
    this.tr.innerHTML = `<span class="hud-dot" style="opacity:${blink}"></span>REC  00:${pad(m)}:${pad(s)}:${pad(f)}`;

    const e = energy(t);
    const beatIdx = Math.floor(t / BEAT);
    const kick = pulse(t, beatIdx * BEAT, 7);
    this.barEls.forEach((b, i) => {
      const n = hash(frame * 0.37 + i * 17.3);
      const shape = Math.exp(-Math.pow((i - 3) / 6, 2));
      const h = 3 + 22 * e * clamp(0.25 * n + 0.75 * kick * shape + 0.15 * n * e);
      b.style.height = h.toFixed(1) + 'px';
      b.style.opacity = (0.35 + 0.65 * (h / 26)).toFixed(2);
    });
  },
};

export default scene;
