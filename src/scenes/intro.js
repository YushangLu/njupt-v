// 01 SIGNAL — Morse code for "NJUPT" is keyed onto a telegraph line, decoded
// letter by letter, then collapses into a single point of light.
import { el, env, prog, ease, clamp, lerp, hash, scramble, pulse, TAU, splitChars, invlerp } from '../lib/util.js';
import { drawGlow } from '../lib/draw.js';
import { MORSE_INTRO, BEAT, bar, FPS } from '../timeline.js';

const CX = 960;
const CY = 540;
const U = 22; // px per Morse unit
const EMBER = [255, 110, 60];
const HOT = [255, 196, 150];

const M = MORSE_INTRO;
const X0 = CX - (M.units * U) / 2;
const unitDur = BEAT / 8;
const RINGS = [bar(3), bar(3) + BEAT, bar(3) + 2 * BEAT, bar(3) + 3 * BEAT, bar(3) + 3.5 * BEAT];
const COLLAPSE = M.end + 0.4; // ~5.3 s

const scene = {
  range: [0, bar(4) + 0.05],
  init(ctx) {
    const root = (this.root = el('div', 'scene', ctx.dom));

    // Faint grid with a radial fade, pre-rendered once.
    const g = document.createElement('canvas');
    g.width = 1920;
    g.height = 1080;
    const gg = g.getContext('2d');
    gg.strokeStyle = 'rgba(150,180,230,0.10)';
    gg.lineWidth = 1;
    for (let x = CX % 60; x < 1920; x += 60) {
      gg.beginPath();
      gg.moveTo(x + 0.5, 0);
      gg.lineTo(x + 0.5, 1080);
      gg.stroke();
    }
    for (let y = CY % 60; y < 1080; y += 60) {
      gg.beginPath();
      gg.moveTo(0, y + 0.5);
      gg.lineTo(1920, y + 0.5);
      gg.stroke();
    }
    gg.globalCompositeOperation = 'destination-in';
    const rg = gg.createRadialGradient(CX, CY, 0, CX, CY, 900);
    rg.addColorStop(0, 'rgba(0,0,0,1)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    gg.fillStyle = rg;
    gg.fillRect(0, 0, 1920, 1080);
    this.grid = g;

    // Captions (DOM).
    const cap = (this.cap = el('div', 'abs', root));
    cap.style.cssText = 'left:0;right:0;top:720px;text-align:center;';
    this.kicker = el('div', 'kicker', cap);
    this.kicker.style.color = 'rgba(255,190,160,0.85)';
    const line = el('div', '', cap);
    line.style.cssText =
      'margin-top:22px;font-weight:300;font-size:36px;letter-spacing:0.28em;color:#f6e6dc;text-shadow:0 0 24px rgba(255,120,60,0.45)';
    this.capChars = splitChars(line, '始于1942 · 一个跨越八十余载的信号');

    this.tag = el('div', 'kicker abs', root);
    this.tag.style.cssText += `left:${X0}px;top:338px;font-size:15px;color:rgba(255,190,160,0.8)`;
  },

  update(t, ctx) {
    const g = ctx.fx;
    const frame = Math.round(t * FPS);
    const collapse = prog(t, COLLAPSE, COLLAPSE + 1.3, ease.inCubic);

    // Grid.
    const gridA = env(t, 0.2, 1.8, COLLAPSE, COLLAPSE + 1.2) * 0.9;
    if (gridA > 0) {
      const s = 1 + t * 0.012;
      g.save();
      g.globalAlpha = gridA;
      g.translate(CX, CY);
      g.scale(s, s);
      g.drawImage(this.grid, -CX, -CY);
      g.restore();
    }

    // Telegraph line.
    const lineGrow = prog(t, 0.5, 1.7, ease.inOutCubic) * (1 - collapse);
    const half = ((M.units * U) / 2 + 90) * lineGrow;
    if (half > 1) {
      const grd = g.createLinearGradient(CX - half, 0, CX + half, 0);
      grd.addColorStop(0, 'rgba(255,170,120,0)');
      grd.addColorStop(0.5, 'rgba(255,190,150,0.55)');
      grd.addColorStop(1, 'rgba(255,170,120,0)');
      g.fillStyle = grd;
      g.fillRect(CX - half, CY - 0.75, half * 2, 1.5);
    }

    // Morse elements.
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const e of M.elements) {
      if (t < e.t0) continue;
      const on = t < e.t1;
      const grow = e.dash ? clamp((t - e.t0) / (e.t1 - e.t0)) : 1;
      const after = on ? 0 : t - e.t1;
      const bright = on ? 1 : 0.5 + 0.5 * Math.exp(-after * 5);
      let xa = X0 + e.u0 * U + 4;
      let xb = X0 + e.u1 * U - 4;
      if (!e.dash) {
        const c = (xa + xb) / 2;
        xa = c - 7;
        xb = c + 7;
      }
      xb = lerp(xa + 14, xb, grow);
      // Collapse toward the centre, farther elements travel later.
      const mid = (xa + xb) / 2;
      const d = Math.abs(mid - CX) / 600;
      const c = prog(t, COLLAPSE + d * 0.35, COLLAPSE + 0.9 + d * 0.35, ease.inCubic);
      const nx = lerp(mid, CX, c);
      const w = lerp(xb - xa, 14, c);
      const flick = 0.85 + 0.15 * hash(frame + e.u0 * 3);
      drawGlow(g, nx, CY, (on ? 46 : 26) + w * 0.35, EMBER, 0.55 * bright * flick * (1 - c * 0.6));
      g.fillStyle = `rgba(${HOT[0]},${HOT[1]},${HOT[2]},${(0.55 + 0.45 * bright) * (1 - c)})`;
      const h = 14;
      const x = nx - w / 2;
      g.beginPath();
      g.roundRect(x, CY - h / 2, Math.max(w, h), h, h / 2);
      g.fill();
      if (on) {
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.beginPath();
        g.roundRect(x + 3, CY - 3, Math.max(w - 6, 6), 6, 3);
        g.fill();
      }
    }
    g.restore();

    // Playhead.
    if (t > M.elements[0].t0 - 0.4 && t < M.end + 0.3) {
      const u = (t - M.elements[0].t0) / unitDur;
      const px = X0 + clamp(u, 0, M.units) * U;
      const a = env(t, M.elements[0].t0 - 0.4, M.elements[0].t0, M.end, M.end + 0.3);
      g.fillStyle = `rgba(255,220,200,${0.35 * a})`;
      g.fillRect(px - 0.5, CY - 60, 1, 120);
      drawGlow(g, px, CY, 26, [255, 200, 170], 0.8 * a);
    }

    // Decoded letters + notation.
    g.save();
    g.textAlign = 'center';
    for (const [i, L] of M.letters.entries()) {
      if (t < L.t1) continue;
      const cx = X0 + ((L.u0 + L.u1) / 2) * U;
      const k = clamp((t - L.t1) / 0.22);
      const out = prog(t, COLLAPSE - 0.2, COLLAPSE + 0.35, ease.inCubic);
      const a = clamp(k * 3) * (1 - out);
      if (a <= 0) continue;
      const ch = k < 1 ? scramble(L.ch, 0, frame + i * 11) : L.ch;
      g.font = '700 72px Mono';
      g.shadowColor = 'rgba(255,120,60,0.9)';
      g.shadowBlur = 24;
      g.fillStyle = `rgba(255,240,230,${a})`;
      g.fillText(ch, cx, CY - 70 - out * 30 + (1 - ease.outCubic(k)) * 12);
      g.shadowBlur = 0;
      g.font = '400 22px Mono';
      g.fillStyle = `rgba(255,170,130,${0.7 * a})`;
      g.fillText(L.code.replace(/\./g, '·').replace(/-/g, '−'), cx, CY + 62 + out * 20);
    }
    g.restore();

    // Tag above the tape.
    const tagA = env(t, 1.2, 1.5, COLLAPSE - 0.3, COLLAPSE + 0.1);
    this.tag.style.opacity = tagA.toFixed(3);
    const cursor = Math.floor(t * 3) % 2 ? '_' : ' ';
    this.tag.textContent = '▸ ' + scramble('DECODING SIGNAL', prog(t, 1.2, 1.7), frame) + ' ' + cursor;

    // Captions.
    const capOut = prog(t, COLLAPSE - 0.1, COLLAPSE + 0.5, ease.inCubic);
    this.kicker.style.opacity = (env(t, 2.3, 2.6, 99, 100) * (1 - capOut)).toFixed(3);
    this.kicker.textContent = scramble('SIGNAL ORIGIN  ·  1942', prog(t, 2.3, 2.9), frame);
    this.capChars.forEach((c, i) => {
      const p = prog(t, 3.0 + i * 0.045, 3.5 + i * 0.045, ease.outCubic);
      const a = p * (1 - capOut);
      c.style.opacity = a.toFixed(3);
      c.style.filter = `blur(${((1 - p) * 8 + capOut * 6).toFixed(2)}px)`;
      c.style.transform = `translateY(${((1 - p) * 18 - capOut * 10).toFixed(2)}px)`;
    });

    // Collapse: gathering light, beat rings, implosion streaks.
    const coreA = prog(t, COLLAPSE + 0.3, bar(4), ease.inQuad);
    if (coreA > 0) {
      const flick = 0.8 + 0.2 * hash(frame * 1.3);
      const blue = prog(t, bar(4) - 0.6, bar(4), ease.inQuad);
      const col = [lerp(255, 170, blue), lerp(150, 215, blue), lerp(90, 255, blue)];
      drawGlow(g, CX, CY, 30 + 110 * coreA, col, (0.6 + 0.4 * coreA) * flick);
      drawGlow(g, CX, CY, 12 + 20 * coreA, [255, 255, 255], 1);
    }
    g.save();
    g.globalCompositeOperation = 'lighter';
    RINGS.forEach((rt, i) => {
      if (t < rt || t > rt + 1.1) return;
      const p = (t - rt) / 1.1;
      const r = 20 + 560 * ease.outCubic(p) * (0.7 + i * 0.12);
      g.strokeStyle = `rgba(255,${170 + i * 15},${120 + i * 25},${0.55 * (1 - p)})`;
      g.lineWidth = 2.5 * (1 - p) + 0.5;
      g.beginPath();
      g.arc(CX, CY, r, 0, TAU);
      g.stroke();
    });
    const imp = invlerp(bar(3) + 0.4, bar(4), t);
    if (imp > 0 && imp < 1) {
      for (let i = 0; i < 90; i++) {
        const ang = hash(i * 3.3) * TAU;
        const speed = 0.6 + hash(i * 7.1) * 0.8;
        const ph = (imp * speed * 2.2 + hash(i * 1.9)) % 1;
        const r = 1100 * (1 - ease.inQuad(ph));
        const len = 40 + 160 * ph;
        const a = Math.sin(ph * Math.PI) * 0.6 * imp;
        const x1 = CX + Math.cos(ang) * r;
        const y1 = CY + Math.sin(ang) * r;
        const x2 = CX + Math.cos(ang) * Math.max(0, r - len);
        const y2 = CY + Math.sin(ang) * Math.max(0, r - len);
        const grd = g.createLinearGradient(x1, y1, x2, y2);
        grd.addColorStop(0, 'rgba(255,200,160,0)');
        grd.addColorStop(1, `rgba(255,225,200,${a})`);
        g.strokeStyle = grd;
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
      }
    }
    g.restore();

    // Soft pre-flash as the signal peaks.
    ctx.flash += 0.25 * prog(t, bar(4) - 0.25, bar(4), ease.inExpo);
    ctx.flash += 0.12 * pulse(t, RINGS[0], 10);
  },
};

export default scene;
