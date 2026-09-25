// 07 CONNECT — final lockup over the planet; the transmission closes with the
// Morse prosign AR ("end of message").
import { el, prog, ease, clamp, lerp, pulse, TAU, splitChars, scramble } from '../lib/util.js';
import { drawGlow } from '../lib/draw.js';
import { createPlanet } from '../lib/planet.js';
import { S, FINALE, MORSE_OUTRO, FPS, DURATION } from '../timeline.js';

const T0 = S.finale[0];
const FADE = FINALE.fade;
const EMB = { x: 960, y: 222 };

const scene = {
  range: [T0 - 0.02, DURATION + 1],
  init(ctx) {
    const root = (this.root = el('div', 'scene', ctx.dom));
    const wrap = (this.wrap = el('div', 'abs', root));
    wrap.style.cssText = 'left:0;top:0;width:1920px;height:1080px';

    const titleCss =
      'left:0;right:0;top:318px;text-align:center;font-weight:900;font-size:128px;line-height:150px;letter-spacing:0.16em;padding-left:0.16em;white-space:nowrap';
    const title = el('div', 'abs', wrap);
    title.style.cssText = titleCss + ';color:#fff';
    this.chars = splitChars(title, '南京邮电大学');
    this.chars.forEach((c) => (c.style.textShadow = '0 0 26px rgba(70,160,255,0.8), 0 0 80px rgba(30,100,255,0.5)'));
    this.sweep = el('div', 'abs', wrap);
    this.sweep.style.cssText =
      titleCss +
      ';color:transparent;-webkit-background-clip:text;background-clip:text;background-image:linear-gradient(100deg,rgba(255,255,255,0) 42%,rgba(255,255,255,0.95) 50%,rgba(255,255,255,0) 58%);background-size:300% 100%;background-repeat:no-repeat';
    this.sweep.textContent = '南京邮电大学';

    this.en = el('div', 'abs grot', wrap);
    this.en.style.cssText =
      'left:0;right:0;top:486px;text-align:center;font-weight:500;font-size:24px;letter-spacing:0.44em;padding-left:0.44em;color:rgba(210,230,255,0.9);white-space:nowrap';
    this.en.textContent = 'NANJING UNIVERSITY OF POSTS AND TELECOMMUNICATIONS';

    const div = (this.div = el('div', 'abs', wrap));
    div.style.cssText = 'left:0;right:0;top:540px;display:flex;justify-content:center;align-items:center;gap:24px';
    this.dl = el('div', '', div);
    this.dt = el('div', 'kicker', div);
    this.dt.style.cssText += 'font-size:17px;color:rgba(170,210,255,0.95)';
    this.dr = el('div', '', div);
    [this.dl, this.dr].forEach((l, i) => {
      l.style.cssText = `height:1px;width:0;background:linear-gradient(90deg,rgba(150,200,255,${i ? 0.8 : 0}),rgba(150,200,255,${i ? 0 : 0.8}))`;
    });

    this.spirit = el('div', 'abs', wrap);
    this.spirit.style.cssText =
      "left:0;right:0;top:592px;text-align:center;font-family:'Song';font-weight:600;font-size:40px;letter-spacing:0.42em;padding-left:0.42em;color:#f4efe6;text-shadow:0 0 20px rgba(120,170,255,0.5)";
    this.spiritChars = splitChars(this.spirit, '信达天下 · 自强不息');

    this.campus = el('div', 'abs', wrap);
    this.campus.style.cssText =
      'left:0;right:0;top:668px;text-align:center;font-weight:300;font-size:24px;letter-spacing:0.3em;padding-left:0.3em;color:rgba(205,222,255,0.78)';
    this.campus.textContent = '仙林校区  ·  三牌楼校区  ·  锁金村校区';

    this.ar = el('div', 'kicker abs', root);
    this.ar.style.cssText += 'left:0;right:0;top:992px;text-align:center;font-size:14px;letter-spacing:0.45em;padding-left:0.45em';

    this.planet = createPlanet({ n: 30000, R: 9, arcs: 56, seed: 23 });
    this.layers = [ctx.gl.addLayer(this.planet.scene, this.planet.camera, 7)];
  },

  update(t, ctx) {
    const g = ctx.fx;
    const lt = t - T0;
    const frame = Math.round(t * FPS);
    const fade = prog(t, FADE, FADE + 1.2, ease.inOutQuad);
    const vis = 1 - fade;

    ctx.flash += 1.0 * pulse(t, T0, 7);
    ctx.shake += 16 * pulse(t, T0, 5);

    // Planet.
    const rise = prog(t, T0, T0 + 1.6, ease.outCubic);
    this.planet.update({
      t: lt - 0.1,
      opacity: clamp(lt * 2) * vis,
      rot: 1.4 + lt * 0.07,
      center: [0, lerp(-14.5, -12.1, rise), 0],
      cam: [0, lerp(0.2, 1.0, rise), lerp(10.5, 12.2, prog(t, T0, FADE + 1, ease.outQuad))],
      look: [0, -0.8, 0],
      arcAmt: 1.2,
      spread: 3.2,
      beamAmt: 0,
    });

    // Emblem: a beacon radiating rings.
    const eIn = prog(t, T0 + 0.05, T0 + 0.6, ease.outBack);
    if (eIn > 0 && vis > 0) {
      g.save();
      g.globalAlpha = vis;
      g.globalCompositeOperation = 'lighter';
      drawGlow(g, EMB.x, EMB.y, 34 * eIn, [140, 210, 255], 1);
      drawGlow(g, EMB.x, EMB.y, 8 * eIn, [255, 255, 255], 1);
      g.strokeStyle = `rgba(170,215,255,${0.8 * clamp(eIn)})`;
      g.lineWidth = 2;
      [26, 44].forEach((r, i) => {
        const span = prog(t, T0 + 0.1 + i * 0.1, T0 + 0.7 + i * 0.1, ease.outCubic);
        const rot = lt * (i ? -0.5 : 0.7);
        for (let k = 0; k < 3; k++) {
          const a0 = rot + (k * TAU) / 3;
          g.beginPath();
          g.arc(EMB.x, EMB.y, r * eIn, a0, a0 + span * (TAU / 3 - 0.45));
          g.stroke();
        }
      });
      for (let k = 0; k < 3; k++) {
        const ph = (lt / 1.4 + k / 3) % 1;
        g.strokeStyle = `rgba(150,205,255,${0.5 * (1 - ph) * clamp(lt * 2)})`;
        g.lineWidth = 1.2;
        g.beginPath();
        g.arc(EMB.x, EMB.y, 50 + ph * 80, 0, TAU);
        g.stroke();
      }
      g.restore();
    }

    // Title.
    this.chars.forEach((c, i) => {
      const p = prog(t, T0 + 0.08 + i * 0.06, T0 + 0.6 + i * 0.06, ease.outCubic);
      c.style.opacity = (p * vis).toFixed(3);
      c.style.filter = p < 1 ? `blur(${((1 - p) * 14).toFixed(1)}px)` : '';
      c.style.transform = `scale(${lerp(1.5, 1, p).toFixed(3)})`;
    });
    const sw = prog(t, T0 + 2.3, T0 + 3.3, ease.inOutQuad);
    this.sweep.style.opacity = sw > 0 && sw < 1 ? vis.toFixed(3) : '0';
    this.sweep.style.backgroundPosition = `${lerp(100, 0, sw).toFixed(2)}% 0`;

    const enP = prog(t, T0 + 0.55, T0 + 1.3, ease.outQuart);
    this.en.style.clipPath = `inset(0 ${((1 - enP) * 50).toFixed(2)}% 0 ${((1 - enP) * 50).toFixed(2)}%)`;
    this.en.style.opacity = (enP > 0 ? vis : 0).toFixed(3);

    const dP = prog(t, T0 + 0.9, T0 + 1.6, ease.outCubic);
    this.dl.style.width = this.dr.style.width = `${(dP * 300).toFixed(1)}px`;
    this.dt.textContent = scramble('SINCE 1942', prog(t, T0 + 0.9, T0 + 1.4), frame);
    this.div.style.opacity = (clamp(dP * 2) * vis).toFixed(3);

    this.spiritChars.forEach((c, i) => {
      const p = prog(t, T0 + 1.2 + i * 0.04, T0 + 1.7 + i * 0.04, ease.outCubic);
      c.style.opacity = (p * vis).toFixed(3);
      c.style.transform = `translateY(${((1 - p) * 16).toFixed(1)}px)`;
    });
    const cP = prog(t, T0 + 1.6, T0 + 2.2, ease.outCubic);
    this.campus.style.opacity = (cP * vis).toFixed(3);
    this.campus.style.letterSpacing = `${lerp(0.6, 0.3, cP).toFixed(3)}em`;

    // Outro Morse: AR.
    const M = MORSE_OUTRO;
    const U = 16;
    const x0 = 960 - (M.units * U) / 2;
    const arFade = 1 - prog(t, M.end + 0.2, DURATION - 0.1, ease.inQuad);
    g.save();
    g.globalCompositeOperation = 'lighter';
    M.elements.forEach((e) => {
      if (t < e.t0) return;
      const on = t < e.t1;
      const grow = e.dash ? clamp((t - e.t0) / (e.t1 - e.t0)) : 1;
      let xa = x0 + e.u0 * U + 3;
      let xb = x0 + e.u1 * U - 3;
      if (!e.dash) {
        const c = (xa + xb) / 2;
        xa = c - 5;
        xb = c + 5;
      }
      xb = lerp(xa + 10, xb, grow);
      const a = (on ? 1 : 0.6) * arFade;
      drawGlow(g, (xa + xb) / 2, 960, on ? 30 : 18, [120, 200, 255], 0.6 * a);
      g.fillStyle = `rgba(210,235,255,${a})`;
      g.beginPath();
      g.roundRect(xa, 955, xb - xa, 10, 5);
      g.fill();
    });
    g.restore();
    this.ar.style.opacity = (prog(t, M.end - 0.1, M.end + 0.3) * arFade).toFixed(3);
    this.ar.textContent = scramble('AR  ·  END OF MESSAGE', prog(t, M.end - 0.1, M.end + 0.4), frame);

    // Global fade to black at the very end.
    this.wrap.style.opacity = vis.toFixed(3);
  },
};

export default scene;
