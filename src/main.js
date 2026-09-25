import { createGL } from './lib/gl.js';
import { DURATION, FPS, W, H } from './timeline.js';
import { hash, lerp, invlerp, hexToRgb } from './lib/util.js';

import hud from './scenes/hud.js';
import intro from './scenes/intro.js';
import title from './scenes/title.js';
import history from './scenes/history.js';
import strengths from './scenes/strengths.js';
import motto from './scenes/motto.js';
import spirit from './scenes/spirit.js';
import finale from './scenes/finale.js';

const scenes = [intro, title, history, strengths, motto, spirit, finale, hud];

const $ = (id) => document.getElementById(id);

// Background palette keyframes: [time, inner color, outer color].
const BG = [
  [0, '#05070c', '#000000'],
  [4.8, '#0b0908', '#000000'],
  [7.4, '#1a0d08', '#020101'],
  [7.55, '#0d2150', '#01030b'],
  [14.6, '#0a1a40', '#01030a'],
  [15.0, '#1b0c09', '#030102'],
  [17.8, '#1b1009', '#030202'],
  [19.7, '#1a1508', '#030302'],
  [22.5, '#081a2c', '#010308'],
  [24.4, '#0a1a3c', '#01030a'],
  [26.3, '#0f1440', '#02020b'],
  [28.1, '#0a1a44', '#01030b'],
  [39.4, '#0a1d3a', '#01030a'],
  [41.2, '#0c0f1c', '#010103'],
  [48.6, '#0e0f1a', '#010103'],
  [48.8, '#0f1433', '#010207'],
  [56.2, '#0f2350', '#01030b'],
  [60.0, '#0c1c40', '#01030a'],
  [61.2, '#000000', '#000000'],
];

function bgAt(t) {
  let i = 0;
  while (i < BG.length - 2 && t > BG[i + 1][0]) i++;
  const [t0, a0, b0] = BG[i];
  const [t1, a1, b1] = BG[i + 1];
  const p = invlerp(t0, t1, t);
  const A0 = hexToRgb(a0), A1 = hexToRgb(a1), B0 = hexToRgb(b0), B1 = hexToRgb(b1);
  return [A0.map((v, k) => lerp(v, A1[k], p) / 255), B0.map((v, k) => lerp(v, B1[k], p) / 255)];
}

async function loadFonts() {
  const faces = [
    '300 20px Sans', '500 20px Sans', '700 20px Sans', '900 20px Sans',
    '600 20px Song', '900 20px Song', '400 20px Brush',
    '300 20px Grotesk', '400 20px Grotesk', '500 20px Grotesk', '700 20px Grotesk',
    '400 20px Mono', '700 20px Mono',
  ];
  await Promise.all(faces.map((f) => document.fonts.load(f, '南京邮电大学ABC123')));
  await document.fonts.ready;
}

async function boot() {
  await loadFonts();
  const gl = createGL($('gl'));
  const ctx = {
    W,
    H,
    gl,
    fx: $('fx').getContext('2d'),
    top: $('top').getContext('2d'),
    dom: $('dom'),
    hud: $('hud'),
    flash: 0,
    shake: 0,
  };
  for (const s of scenes) await s.init(ctx);
  const shakeTargets = [$('gl'), $('fx'), $('dom'), $('top')];

  window.renderAt = (t) => {
    ctx.fx.clearRect(0, 0, W, H);
    ctx.top.clearRect(0, 0, W, H);
    ctx.flash = 0;
    ctx.shake = 0;
    const [inner, outer] = bgAt(t);
    gl.bg.uInner.value.setRGB(...inner);
    gl.bg.uOuter.value.setRGB(...outer);
    for (const s of scenes) {
      const on = t >= s.range[0] && t < s.range[1];
      if (s.root) s.root.style.display = on ? 'block' : 'none';
      if (s.layers) s.layers.forEach((l) => (l.visible = on));
      if (on) s.update(t, ctx);
    }
    gl.render(t);
    const frame = Math.round(t * FPS);
    $('flash').style.opacity = Math.min(1, ctx.flash).toFixed(3);
    const sx = ctx.shake ? (hash(frame * 1.7) - 0.5) * 2 * ctx.shake : 0;
    const sy = ctx.shake ? (hash(frame * 2.9) - 0.5) * 2 * ctx.shake : 0;
    const tr = ctx.shake ? `translate(${sx.toFixed(2)}px, ${sy.toFixed(2)}px)` : '';
    shakeTargets.forEach((e) => (e.style.transform = tr));
    return true;
  };

  window.__duration = DURATION;
  window.__ready = true;

  const params = new URLSearchParams(location.search);
  if (!params.has('render')) startPreview(params);
}

// Interactive preview: plays in real time (with the soundtrack if present).
function startPreview(params) {
  const stage = $('stage');
  const fit = () => {
    const s = Math.min(innerWidth / W, innerHeight / H);
    stage.style.transform = `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - H * s) / 2}px) scale(${s})`;
  };
  fit();
  addEventListener('resize', fit);
  // Click to start the soundtrack in sync (browsers block autoplay with sound).
  const audio = new Audio('../out/soundtrack.wav');
  const t0 = performance.now() - (parseFloat(params.get('t')) || 0) * 1000;
  const tick = () => {
    const t = (performance.now() - t0) / 1000;
    window.renderAt(Math.min(t, DURATION - 0.001));
    if (t < DURATION) requestAnimationFrame(tick);
  };
  addEventListener('click', () => {
    audio.currentTime = (performance.now() - t0) / 1000;
    audio.play().catch(() => {});
  });
  requestAnimationFrame(tick);
}

boot();
