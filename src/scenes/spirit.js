// 06 SPIRIT — 信 carries two meanings (诚信 integrity, 信息 information);
// then 信达天下 · 自强不息 lands one character per beat and the light implodes.
import { el, env, prog, ease, clamp, lerp, hash, pulse, TAU, scramble } from '../lib/util.js';
import { drawGlow } from '../lib/draw.js';
import { THREE, softPointsMaterial, makePoints } from '../lib/gl.js';
import { S, SPIRIT, FPS } from '../timeline.js';

const T0 = S.spirit[0];
const T1 = S.spirit[1];
const XIN = { x: 960, y: 500, size: 430 };
const LINE_Y = [420, 630];
const CH = 150;
const STEP = 190;

const scene = {
  range: [T0 - 0.1, T1 + 0.05],
  init(ctx) {
    const root = (this.root = el('div', 'scene', ctx.dom));
    this.kick = el('div', 'kicker abs', root);
    this.kick.style.cssText += 'left:0;right:0;top:170px;text-align:center;font-size:18px;letter-spacing:0.5em;padding-left:0.5em';

    const mk = (c) => {
      const d = el('div', 'abs', root, c);
      d.style.cssText =
        "left:0;top:0;width:500px;height:500px;margin:-250px 0 0 -250px;display:flex;align-items:center;justify-content:center;font-family:'Song';font-weight:900;color:#fff;transform-origin:50% 50%;white-space:nowrap";
      return d;
    };
    this.lines = ['信达天下', '自强不息'].map((s) => [...s].map(mk));

    this.ann = [
      { cn: '诚信', en: 'INTEGRITY', x: 470, side: -1 },
      { cn: '信息', en: 'INFORMATION', x: 1450, side: 1 },
    ].map((a) => {
      const d = el('div', 'abs', root);
      d.style.cssText = `left:${a.x - 150}px;top:452px;width:300px;text-align:center`;
      d.innerHTML = `<div style="font-weight:700;font-size:54px;letter-spacing:0.2em;padding-left:0.2em;color:#fff">${a.cn}</div><div class="mono" style="margin-top:10px;font-size:16px;letter-spacing:0.4em;padding-left:0.4em;color:rgba(160,205,255,0.9)">${a.en}</div>`;
      return { ...a, d };
    });

    // Vortex of particles that implodes into the finale.
    const N = 2200;
    const mat = (this.mat = softPointsMaterial({ size: 0.05 }));
    const pts = (this.pts = makePoints(N, mat));
    this.vx = [];
    const col = pts.geometry.attributes.aColor.array;
    const sz = pts.geometry.attributes.aSize.array;
    for (let i = 0; i < N; i++) {
      this.vx.push({ r: 1.2 + Math.pow(hash(i * 1.3), 0.7) * 9, a: hash(i * 2.9) * TAU, y: (hash(i * 4.1) - 0.5) * 1.4, w: 0.15 + hash(i * 6.1) * 0.35 });
      const warm = hash(i * 8.8) > 0.8;
      col.set(warm ? [1, 0.8, 0.5] : [0.4, 0.75, 1], i * 3);
      sz[i] = 0.5 + hash(i * 3.3) * 1.5;
    }
    const scn = new THREE.Scene();
    scn.add(pts);
    this.cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100);
    this.layers = [ctx.gl.addLayer(scn, this.cam, 6)];
  },

  update(t, ctx) {
    const g = ctx.fx;
    const frame = Math.round(t * FPS);
    const build = prog(t, SPIRIT.build, T1, ease.inQuad);
    const out = prog(t, T1 - 0.5, T1, ease.inCubic);

    this.kick.textContent = scramble('南邮精神  ·  NJUPT SPIRIT', prog(t, T0, T0 + 0.5), frame);
    this.kick.style.opacity = (prog(t, T0, T0 + 0.3) * (1 - out)).toFixed(3);

    // Rays behind 信.
    const rayA = env(t, T0, T0 + 0.6, SPIRIT.line1[0] - 0.2, SPIRIT.line1[0] + 0.3);
    if (rayA > 0) {
      g.save();
      g.translate(XIN.x, XIN.y);
      g.rotate(t * 0.08);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * TAU;
        const len = 380 + hash(i) * 420;
        const grd = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
        grd.addColorStop(0, `rgba(120,190,255,${0.2 * rayA})`);
        grd.addColorStop(1, 'rgba(120,190,255,0)');
        g.strokeStyle = grd;
        g.lineWidth = 1 + hash(i * 3) * 2;
        g.beginPath();
        g.moveTo(Math.cos(a) * 60, Math.sin(a) * 60);
        g.lineTo(Math.cos(a) * len, Math.sin(a) * len);
        g.stroke();
      }
      g.restore();
      drawGlow(g, XIN.x, XIN.y, 420, [60, 130, 255], 0.35 * rayA);
    }

    // Characters.
    const move = prog(t, SPIRIT.line1[0] - 0.05, SPIRIT.line1[0] + 0.4, ease.inOutCubic);
    this.lines.forEach((line, li) => {
      line.forEach((d, i) => {
        const tx = 960 + (i - 1.5) * STEP;
        const ty = LINE_Y[li];
        let x, y, size, a, blur, sc;
        if (li === 0 && i === 0) {
          const p = prog(t, T0, T0 + 0.5, ease.outCubic);
          x = lerp(XIN.x, tx, move);
          y = lerp(XIN.y, ty, move);
          size = lerp(XIN.size, CH, move);
          a = p;
          blur = (1 - p) * 16;
          sc = lerp(1.25, 1, p);
        } else {
          const at = li === 0 ? SPIRIT.line1[i] : SPIRIT.line2[i];
          const p = prog(t, at - 0.02, at + 0.16, ease.outCubic);
          x = tx;
          y = ty;
          size = CH;
          a = t < at - 0.02 ? 0 : clamp(p * 1.6);
          blur = (1 - p) * 14;
          sc = lerp(1.9, 1, p);
          ctx.flash += 0.07 * pulse(t, at, 12);
          ctx.shake += 5 * pulse(t, at, 14) * (t >= at ? 1 : 0);
        }
        // Build: glow swells, then everything rushes toward the camera.
        sc *= 1 + build * 0.06 + out * 0.5;
        a *= 1 - out;
        blur += out * 18;
        d.style.fontSize = size.toFixed(1) + 'px';
        d.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${sc.toFixed(3)})`;
        d.style.opacity = a.toFixed(3);
        d.style.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : '';
        const glow = 0.45 + build * 0.5;
        d.style.textShadow = `0 0 ${(24 + build * 30).toFixed(0)}px rgba(90,170,255,${glow.toFixed(2)}), 0 0 ${(70 + build * 60).toFixed(0)}px rgba(40,110,255,${(glow * 0.7).toFixed(2)})`;
        d.style.color = li === 0 && i === 0 ? '#ffffff' : '#f2f7ff';
      });
    });

    // Annotations: 诚信 / 信息.
    const annIn = prog(t, T0 + 0.4, T0 + 0.9, ease.outCubic);
    const annOut = prog(t, SPIRIT.line1[0] - 0.3, SPIRIT.line1[0], ease.inCubic);
    this.ann.forEach((a, i) => {
      const p = prog(t, T0 + 0.45 + i * 0.12, T0 + 0.95 + i * 0.12, ease.outCubic);
      a.d.style.opacity = (p * (1 - annOut)).toFixed(3);
      a.d.style.transform = `translateX(${((1 - p) * -40 * a.side).toFixed(1)}px)`;
    });
    if (annIn > 0 && annOut < 1) {
      g.save();
      g.globalAlpha = 1 - annOut;
      this.ann.forEach((a) => {
        const x0 = XIN.x + a.side * 250;
        const x1 = lerp(x0, a.x - a.side * 170, annIn);
        g.strokeStyle = 'rgba(150,200,255,0.7)';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(x0, XIN.y);
        g.lineTo(x1, XIN.y);
        g.stroke();
        drawGlow(g, x0, XIN.y, 14, [150, 210, 255], 0.9);
        drawGlow(g, x1, XIN.y, 10, [150, 210, 255], 0.9 * annIn);
      });
      g.restore();
    }

    // Vortex.
    const vIn = prog(t, T0, T0 + 1.2);
    const P = this.pts.geometry.attributes.position.array;
    const A = this.pts.geometry.attributes.aAlpha.array;
    const lt = t - T0;
    const shrink = ease.inQuad(build);
    this.vx.forEach((v, i) => {
      const ang = v.a + lt * v.w * (1 + build * 6) + build * build * 4;
      const r = v.r * (1 - 0.97 * shrink);
      P[i * 3] = Math.cos(ang) * r;
      P[i * 3 + 1] = v.y * (1 - shrink) + Math.sin(ang) * r * 0.18;
      P[i * 3 + 2] = Math.sin(ang) * r;
      A[i] = 0.55 * vIn * (1 - out * 0.7) * (0.5 + 0.5 * hash(i * 7.7));
    });
    this.pts.geometry.attributes.position.needsUpdate = true;
    this.pts.geometry.attributes.aAlpha.needsUpdate = true;
    this.cam.position.set(0, 2.2 + build * 1.5, 9 - build * 3);
    this.cam.lookAt(0, -0.2, 0);

    // Converging streaks + swelling core before the final hit.
    if (build > 0) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 110; i++) {
        const ang = hash(i * 3.3 + 50) * TAU;
        const ph = (build * (1 + hash(i) * 1.5) * 2 + hash(i * 1.9)) % 1;
        const r = 1200 * (1 - ease.inQuad(ph));
        const len = 50 + 200 * ph;
        const a = Math.sin(ph * Math.PI) * 0.55 * build;
        const x1 = 960 + Math.cos(ang) * r;
        const y1 = 540 + Math.sin(ang) * r;
        const x2 = 960 + Math.cos(ang) * Math.max(0, r - len);
        const y2 = 540 + Math.sin(ang) * Math.max(0, r - len);
        const grd = g.createLinearGradient(x1, y1, x2, y2);
        grd.addColorStop(0, 'rgba(120,190,255,0)');
        grd.addColorStop(1, `rgba(210,235,255,${a})`);
        g.strokeStyle = grd;
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
      }
      g.restore();
      drawGlow(g, 960, 540, 60 + 240 * build * build, [140, 200, 255], build);
    }
    ctx.flash += 0.35 * prog(t, T1 - 0.2, T1, ease.inExpo);
  },
};

export default scene;
