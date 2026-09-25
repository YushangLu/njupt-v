// 02 IDENTITY — the signal detonates; particles assemble the university name
// above a dotted planet whose arcs carry signals from the pole to the world.
import { el, env, prog, ease, clamp, lerp, hash, pulse, TAU, splitChars, mulberry32, scramble } from '../lib/util.js';
import { textSprite, samplePoints, drawGlow, drawGlitched } from '../lib/draw.js';
import { createPlanet } from '../lib/planet.js';
import { S, bar, BEAT, FPS } from '../timeline.js';

const T0 = S.title[0]; // 7.5
const CX = 960;
const TY = 400; // title centre line
const CONVERGE = T0 + 0.28;
const GLITCH = bar(7) + 1.5 * BEAT; // 13.83
const EXIT = bar(7) + 2 * BEAT; // 14.06

const scene = {
  range: [T0, S.title[1] + 0.35],
  init(ctx) {
    const root = (this.root = el('div', 'scene', ctx.dom));

    // Title sprites (plain for particles/masks, glowing for display).
    const font = '900 156px Sans';
    this.plain = textSprite({ text: '南京邮电大学', font, letterSpacing: 22, pad: 60 });
    this.glow = textSprite({
      text: '南京邮电大学',
      font,
      letterSpacing: 22,
      pad: 60,
      gradient: [
        [0, '#ffffff'],
        [0.5, '#e6f2ff'],
        [1, '#bfe0ff'],
      ],
      shadow: { color: 'rgba(60,150,255,0.85)', blur: 38 },
    });
    this.sx = CX - this.plain.w / 2;
    this.sy = TY - this.plain.pad - this.plain.asc / 2 - 10;

    const rnd = mulberry32(42);
    const pts = samplePoints(this.plain.canvas, 3, 140, rnd);
    this.parts = pts.map(([x, y]) => {
      const tx = this.sx + x;
      const ty = this.sy + y;
      const ang = Math.atan2(ty - 540, tx - CX) + (rnd() - 0.5) * 1.6;
      const rad = 120 + Math.pow(rnd(), 0.7) * 820;
      return {
        tx,
        ty,
        bx: CX + Math.cos(ang) * rad,
        by: 540 + Math.sin(ang) * rad * 0.8,
        delay: ((tx - this.sx) / this.plain.w) * 0.32 + rnd() * 0.12,
        swirl: (rnd() - 0.5) * 140,
        size: 1.4 + rnd() * 1.6,
        spark: rnd() < 0.06,
        ph: rnd() * TAU,
      };
    });

    // Light sweep helper canvas.
    this.sweep = document.createElement('canvas');
    this.sweep.width = this.plain.w;
    this.sweep.height = this.plain.h;

    // DOM: English name, meta row, tagline.
    const en = (this.en = el('div', 'abs grot', root));
    en.style.cssText =
      'left:0;right:0;top:520px;text-align:center;font-weight:500;font-size:25px;letter-spacing:0.46em;color:rgba(205,228,255,0.9);white-space:nowrap;padding-left:0.46em';
    en.textContent = 'NANJING UNIVERSITY OF POSTS AND TELECOMMUNICATIONS';

    const meta = (this.meta = el('div', 'abs', root));
    meta.style.cssText = 'left:0;right:0;top:578px;display:flex;justify-content:center;align-items:center;gap:26px';
    this.lineL = el('div', '', meta);
    this.metaText = el('div', 'kicker', meta);
    this.metaText.style.cssText += 'font-size:17px;color:rgba(160,205,255,0.9)';
    this.lineR = el('div', '', meta);
    [this.lineL, this.lineR].forEach((l) => {
      l.style.cssText = 'height:1px;background:linear-gradient(90deg,rgba(120,180,255,0),rgba(150,200,255,0.8));width:0px';
    });
    this.lineR.style.background = 'linear-gradient(90deg,rgba(150,200,255,0.8),rgba(120,180,255,0))';

    const tag = (this.tag = el('div', 'abs', root));
    tag.style.cssText =
      'left:0;right:0;top:648px;text-align:center;font-weight:500;font-size:46px;letter-spacing:0.36em;padding-left:0.36em;color:#dff0ff;white-space:nowrap';
    this.tagChars = splitChars(tag, '「华夏IT英才的摇篮」');
    this.tagChars.forEach((c) => {
      c.style.textShadow = '0 0 22px rgba(70,160,255,0.75)';
    });

    // Planet.
    this.planet = createPlanet({ n: 30000, R: 9, arcs: 40, seed: 11 });
    this.layers = [ctx.gl.addLayer(this.planet.scene, this.planet.camera, 0)];
  },

  update(t, ctx) {
    const g = ctx.fx;
    const top = ctx.top;
    const lt = t - T0;
    const frame = Math.round(t * FPS);
    const exit = prog(t, EXIT, EXIT + 0.45, ease.inQuad);

    // Impact.
    ctx.flash += 0.95 * pulse(t, T0, 6.5);
    ctx.shake += 14 * pulse(t, T0, 5);

    // Planet.
    const rise = prog(t, T0, T0 + 2.4, ease.outCubic);
    const sink = prog(t, EXIT - 0.1, EXIT + 0.8, ease.inCubic);
    this.planet.update({
      t: lt - 0.3,
      opacity: clamp(lt * 1.5) * (1 - sink),
      rot: lt * 0.06,
      center: [0, lerp(-13.6, -11.9, rise) - sink * 3, 0],
      cam: [0, lerp(-0.2, 0.9, rise), lerp(9.5, 11.5, prog(t, T0, S.title[1], ease.inOutQuad))],
      look: [0, -0.7, 0],
      arcAmt: 1,
      spread: 5.5,
      beamAmt: 0,
    });

    // Shockwave rings.
    g.save();
    g.globalCompositeOperation = 'lighter';
    [0, 0.12].forEach((d, i) => {
      const p = prog(t, T0 + d, T0 + d + 1.2, ease.outCubic);
      if (p <= 0 || p >= 1) return;
      g.strokeStyle = `rgba(${i ? 120 : 200},${i ? 200 : 230},255,${0.8 * (1 - p)})`;
      g.lineWidth = 6 * (1 - p) + 0.5;
      g.beginPath();
      g.ellipse(CX, 540, 40 + 1300 * p, (40 + 1300 * p) * 0.72, 0, 0, TAU);
      g.stroke();
    });
    g.restore();

    // Particles -> title.
    const textIn = prog(t, T0 + 0.95, T0 + 1.45, ease.inOutQuad);
    const partA = 1 - prog(t, T0 + 1.2, T0 + 1.9, ease.inQuad);
    if (partA > 0) {
      top.save();
      top.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.parts.length; i++) {
        const p = this.parts[i];
        const burst = ease.outExpo(clamp(lt / 0.45));
        const q = ease.inOutCubic(clamp((t - CONVERGE - p.delay) / 0.62));
        const bx = lerp(CX, p.bx, burst);
        const by = lerp(540, p.by, burst);
        const sw = Math.sin(Math.PI * q) * p.swirl;
        const x = lerp(bx, p.tx, q) + sw * 0.6;
        const y = lerp(by, p.ty, q) - sw * 0.4;
        const tw = 0.6 + 0.4 * Math.sin(lt * 9 + p.ph);
        const a = partA * (q < 1 ? 0.9 : tw);
        top.fillStyle = `rgba(${lerp(140, 225, q) | 0},${lerp(200, 238, q) | 0},255,${a})`;
        const s = p.size * (1 + (1 - q) * 0.6);
        top.fillRect(x - s / 2, y - s / 2, s, s);
        if (p.spark) drawGlow(top, x, y, 10 + 8 * tw, [110, 190, 255], 0.5 * a);
      }
      top.restore();
    }

    // Crisp title with glitch + sweep.
    let titleA = textIn * (1 - exit);
    if (titleA > 0.001) {
      const sc = 1 + exit * 0.35 + (1 - textIn) * 0.04;
      const w = this.glow.w * sc;
      const h = this.glow.h * sc;
      const x = CX - w / 2;
      const y = this.sy + this.glow.h / 2 - h / 2;
      top.save();
      top.globalAlpha = titleA;
      if (exit > 0) top.filter = `blur(${(exit * 14).toFixed(1)}px)`;
      const gl1 = env(t, GLITCH - 0.02, GLITCH + 0.02, GLITCH + 0.16, GLITCH + 0.24);
      const gl0 = env(t, T0 + 1.0, T0 + 1.04, T0 + 1.14, T0 + 1.24) * 0.6;
      drawGlitched(top, this.glow.canvas, x, y, w, h, Math.max(gl0, gl1), frame, hash);
      top.restore();

      // Light sweep across the characters.
      const sp = prog(t, bar(6) - 0.15, bar(6) + 0.9, ease.inOutQuad);
      if (sp > 0 && sp < 1 && exit === 0) {
        const s = this.sweep.getContext('2d');
        s.clearRect(0, 0, this.sweep.width, this.sweep.height);
        s.globalCompositeOperation = 'source-over';
        s.drawImage(this.plain.canvas, 0, 0);
        s.globalCompositeOperation = 'source-in';
        const cx = lerp(-300, this.sweep.width + 300, sp);
        const grd = s.createLinearGradient(cx - 180, 0, cx + 180, this.sweep.height);
        grd.addColorStop(0, 'rgba(120,200,255,0)');
        grd.addColorStop(0.5, 'rgba(255,255,255,0.95)');
        grd.addColorStop(1, 'rgba(120,200,255,0)');
        s.fillStyle = grd;
        s.fillRect(0, 0, this.sweep.width, this.sweep.height);
        top.save();
        top.globalCompositeOperation = 'lighter';
        top.globalAlpha = 0.85 * titleA;
        top.drawImage(this.sweep, x, y, w, h);
        top.restore();
      }
    }

    // English name: reveals from the centre outward.
    const enP = prog(t, T0 + 1.25, T0 + 2.1, ease.outQuart);
    const inset = (1 - enP) * 50;
    this.en.style.clipPath = `inset(0 ${inset}% 0 ${inset}%)`;
    this.en.style.opacity = ((enP > 0 ? 1 : 0) * (1 - exit)).toFixed(3);
    this.en.style.letterSpacing = `${lerp(0.7, 0.46, enP).toFixed(3)}em`;
    this.en.style.filter = exit > 0 ? `blur(${exit * 8}px)` : '';

    // Meta row.
    const mP = prog(t, T0 + 1.9, T0 + 2.6, ease.outCubic);
    this.meta.style.opacity = (clamp(mP * 2) * (1 - exit)).toFixed(3);
    this.lineL.style.width = this.lineR.style.width = `${(mP * 220).toFixed(1)}px`;
    this.metaText.textContent = scramble('EST. 1942  ·  NJUPT  ·  NANJING', prog(t, T0 + 1.9, T0 + 2.5), frame);

    // Tagline on bar 6.
    this.tagChars.forEach((c, i) => {
      const p = prog(t, bar(6) + i * 0.05, bar(6) + 0.55 + i * 0.05, ease.outCubic);
      c.style.opacity = (p * (1 - exit)).toFixed(3);
      c.style.transform = `translateY(${((1 - p) * 26).toFixed(1)}px) scale(${lerp(1.3, 1, p).toFixed(3)})`;
      c.style.filter = `blur(${((1 - p) * 10 + exit * 8).toFixed(1)}px)`;
    });
  },
};

export default scene;
