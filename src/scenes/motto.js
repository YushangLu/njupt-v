// 05 MOTTO — 厚德 弘毅 求是 笃行, brushed in as vertical columns read right to
// left, each with its classical source, sealed with a red chop.
import { el, prog, ease, clamp, lerp, hash, pulse, TAU } from '../lib/util.js';
import { drawGlow } from '../lib/draw.js';
import { THREE, softPointsMaterial, makePoints } from '../lib/gl.js';
import { S, MOTTO, SEAL_T } from '../timeline.js';

const T0 = S.motto[0];
const T1 = S.motto[1];
const COLS = [1390, 1090, 790, 490];

const scene = {
  range: [T0 - 0.1, T1 + 0.1],
  init(ctx) {
    const root = (this.root = el('div', 'scene', ctx.dom));
    const wrap = (this.wrap = el('div', 'abs', root));
    wrap.style.cssText = 'left:0;top:0;width:1920px;height:1080px;transform-origin:960px 540px';

    this.label = el('div', 'kicker abs', wrap);
    this.label.style.cssText += 'left:150px;top:150px;color:rgba(243,205,140,0.9);font-size:17px';
    this.label.textContent = '校训  ·  UNIVERSITY MOTTO';

    this.cols = MOTTO.map((m, i) => {
      const col = el('div', 'abs', wrap);
      col.style.cssText = `left:${COLS[i] - 110}px;top:262px;width:220px;text-align:center;`;
      const chars = [...m.words].map((c) => {
        const d = el('div', '', col, c);
        d.style.cssText =
          "font-family:'Brush';font-size:212px;line-height:236px;padding:30px 60px;margin:-30px -60px;color:#f7eedf;text-shadow:0 0 26px rgba(243,190,110,0.35),0 0 70px rgba(200,140,60,0.25)";
        return d;
      });
      const q = el('div', 'abs', wrap);
      q.style.cssText = `left:${COLS[i] - 172}px;top:292px;writing-mode:vertical-rl;font-family:'Song';font-weight:600;font-size:23px;letter-spacing:0.2em;line-height:1;color:rgba(238,220,190,0.78);white-space:nowrap`;
      q.innerHTML = `${m.quote}<span style="display:inline-block;margin-top:18px;color:rgba(230,120,90,0.95)">${m.src}</span>`;
      return { col, chars, q };
    });

    const seal = (this.seal = el('div', 'abs', wrap));
    seal.style.cssText =
      "left:196px;top:668px;width:84px;height:84px;border-radius:8px;background:#c23a2b;box-shadow:0 0 30px rgba(220,70,40,0.55);display:grid;grid-template-columns:1fr 1fr;align-items:center;justify-items:center;font-family:'Song';font-weight:900;font-size:32px;color:#fbe9dc;padding:6px;box-sizing:border-box;writing-mode:vertical-rl";
    seal.innerHTML = '<span>校</span><span>训</span>';

    // Warm dust.
    const N = 500;
    const mat = (this.mat = softPointsMaterial({ size: 0.05 }));
    const pts = (this.pts = makePoints(N, mat));
    const c = pts.geometry.attributes.aColor.array;
    const s = pts.geometry.attributes.aSize.array;
    this.base = [];
    for (let i = 0; i < N; i++) {
      this.base.push([(hash(i * 1.1) - 0.5) * 22, (hash(i * 2.3) - 0.5) * 13, -1 - hash(i * 3.7) * 9]);
      c.set([1.0, 0.72 + hash(i) * 0.15, 0.4], i * 3);
      s[i] = 0.5 + hash(i * 5.5) * 1.8;
    }
    const scn = new THREE.Scene();
    scn.add(pts);
    this.cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100);
    this.cam.position.set(0, 0, 6);
    this.layers = [ctx.gl.addLayer(scn, this.cam, 5)];
  },

  update(t, ctx) {
    const g = ctx.fx;
    const lt = t - T0;
    const fin = prog(t, T1 - 0.55, T1, ease.inCubic);
    const inA = prog(t, T0 - 0.1, T0 + 0.4);

    this.wrap.style.transform = `scale(${(1 + lt * 0.006 + fin * 0.05).toFixed(4)})`;
    this.wrap.style.opacity = (1 - fin).toFixed(3);
    this.wrap.style.filter = fin > 0 ? `blur(${(fin * 10).toFixed(1)}px)` : '';
    this.label.style.opacity = prog(t, T0 + 0.1, T0 + 0.6).toFixed(3);

    // Disc and hairline ring behind the columns.
    g.save();
    const discA = inA * (1 - fin);
    const rg = g.createRadialGradient(940, 500, 0, 940, 500, 420);
    rg.addColorStop(0, `rgba(243,199,122,${0.09 * discA})`);
    rg.addColorStop(0.7, `rgba(243,199,122,${0.035 * discA})`);
    rg.addColorStop(1, 'rgba(243,199,122,0)');
    g.fillStyle = rg;
    g.fillRect(400, 60, 1100, 900);
    g.strokeStyle = `rgba(243,205,140,${0.22 * discA})`;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(940, 500, 400, -Math.PI / 2, -Math.PI / 2 + TAU * prog(t, T0, T0 + 2.5, ease.inOutCubic));
    g.stroke();
    g.restore();

    this.cols.forEach(({ chars, q }, i) => {
      const m = MOTTO[i];
      chars.forEach((c, j) => {
        const s = m.t + j * 0.16;
        const p = prog(t, s - 0.04, s + 0.55, ease.outCubic);
        const edge = lerp(-20, 120, p);
        const mask = p >= 1 ? 'none' : `linear-gradient(180deg, #000 ${edge - 25}%, transparent ${edge}%)`;
        c.style.webkitMaskImage = mask;
        c.style.maskImage = mask;
        c.style.opacity = clamp(p * 2).toFixed(3);
        c.style.filter = p < 1 ? `blur(${((1 - p) * 6).toFixed(1)}px)` : '';
        c.style.transform = `scale(${lerp(1.12, 1, p).toFixed(3)})`;
      });
      const qp = prog(t, m.t + 0.35, m.t + 1.0, ease.inOutQuad);
      const qe = lerp(-10, 115, qp);
      const qm = qp >= 1 ? 'none' : `linear-gradient(180deg, #000 ${qe - 12}%, transparent ${qe}%)`;
      q.style.webkitMaskImage = qm;
      q.style.maskImage = qm;
      q.style.opacity = (qp > 0 ? 1 : 0).toString();
      // Ink bloom behind the new column.
      const b = pulse(t, m.t, 2.2) * (t >= m.t ? 1 : 0);
      drawGlow(g, COLS[i], 500, 260, [230, 160, 80], 0.35 * b * (1 - fin));
      ctx.flash += 0.05 * pulse(t, m.t, 10);
    });

    // Seal stamp.
    const sp = prog(t, SEAL_T, SEAL_T + 0.16, ease.inQuad);
    this.seal.style.opacity = (t < SEAL_T ? 0 : clamp(sp * 1.5)).toFixed(3);
    this.seal.style.transform = `scale(${lerp(2.2, 1, sp).toFixed(3)}) rotate(${lerp(-14, -4, sp).toFixed(2)}deg)`;
    ctx.shake += 7 * pulse(t, SEAL_T + 0.16, 12) * (t > SEAL_T + 0.16 ? 1 : 0);

    // Dust drifts upward, faster as the section closes.
    const P = this.pts.geometry.attributes.position.array;
    const A = this.pts.geometry.attributes.aAlpha.array;
    this.base.forEach(([x, y, z], i) => {
      const rise = lt * (0.18 + hash(i * 9.1) * 0.25) + fin * 3;
      let yy = y + rise;
      yy = ((((yy + 6.5) % 13) + 13) % 13) - 6.5;
      P[i * 3] = x + Math.sin(lt * 0.5 + i) * 0.2;
      P[i * 3 + 1] = yy;
      P[i * 3 + 2] = z;
      A[i] = (0.3 + 0.7 * hash(i * 4.4)) * (0.6 + 0.4 * Math.sin(lt * 2 + i));
    });
    this.pts.geometry.attributes.position.needsUpdate = true;
    this.pts.geometry.attributes.aAlpha.needsUpdate = true;
    this.mat.uniforms.uOpacity.value = inA * (1 - fin * 0.5);
  },
};

export default scene;
