// 03 HISTORY — a fibre-optic timeline. The camera tracks along the fibre while
// a giant odometer rolls from year to year; colour drifts from the red of 1942
// to the blue of the information age.
import { el, prog, ease, clamp, lerp, hash, pulse, TAU, splitChars, mixColor, rgba, invlerp } from '../lib/util.js';
import { drawGlow } from '../lib/draw.js';
import { THREE, softPointsMaterial, makePoints } from '../lib/gl.js';
import { S, MILESTONES, FPS } from '../timeline.js';

const T0 = S.timeline[0];
const T1 = S.timeline[1];
const FY = 800; // fibre y
const GAP = 760; // px between milestones on the track
const NODE_X = 470; // screen x of the current node
const ERA = ['#ff5a3c', '#ff8f45', '#f3c77a', '#38e1ff', '#2f7bff', '#8c7bff'];
const LH = 250; // odometer line height

// Continuous milestone index (with eased transitions between nodes).
function trackPos(t) {
  let pos = 0;
  for (let k = 1; k < MILESTONES.length; k++) {
    pos += ease.inOutCubic(invlerp(MILESTONES[k].t - 0.34, MILESTONES[k].t + 0.3, t));
  }
  return pos;
}

function eraColor(pos) {
  const i = clamp(Math.floor(pos), 0, ERA.length - 1);
  const j = Math.min(i + 1, ERA.length - 1);
  return mixColor(ERA[i], ERA[j], pos - i);
}

function currentIndex(t) {
  let k = 0;
  while (k < MILESTONES.length - 1 && t >= MILESTONES[k + 1].t) k++;
  return k;
}

const scene = {
  range: [T0 - 0.6, T1 + 0.35],
  init(ctx) {
    const root = (this.root = el('div', 'scene', ctx.dom));

    // Odometer.
    const odo = (this.odo = el('div', 'abs', root));
    odo.style.cssText = `left:150px;top:300px;height:${LH}px;display:flex;`;
    this.cols = [0, 1, 2, 3].map(() => {
      const col = el('div', '', odo);
      col.style.cssText = `width:150px;height:${LH}px;overflow:hidden;position:relative`;
      const strip = el('div', 'grot', col);
      strip.style.cssText = `position:absolute;left:0;top:0;width:150px;text-align:center;font-weight:700;font-size:238px;line-height:${LH}px;font-variant-numeric:tabular-nums;letter-spacing:-0.02em;color:transparent;-webkit-background-clip:text;background-clip:text;background-size:100% ${LH}px;`;
      strip.innerHTML = Array.from({ length: 30 }, (_, i) => `<div>${i % 10}</div>`).join('');
      return { col, strip };
    });
    this.odoLabel = el('div', 'kicker abs', root);
    this.odoLabel.style.cssText += 'left:160px;top:262px;font-size:16px';

    // Captions, one block per milestone.
    this.caps = MILESTONES.map((m, k) => {
      const box = el('div', 'abs', root);
      box.style.cssText = 'left:1000px;top:318px;width:840px;';
      const bar = el('div', 'abs', box);
      bar.style.cssText = 'left:-34px;top:6px;width:4px;height:0px;border-radius:2px';
      const kick = el('div', 'kicker', box);
      kick.style.cssText += 'font-size:16px;margin-bottom:22px';
      kick.textContent = `${String(k + 1).padStart(2, '0')} / 06  ·  ${m.en}`;
      const title = el('div', '', box);
      title.style.cssText = 'font-weight:900;font-size:60px;line-height:1.2;color:#fff;letter-spacing:0.04em;white-space:nowrap';
      const chars = m.title.split('\n').flatMap((line, li) => {
        if (li) el('br', '', title);
        return splitChars(title, line);
      });
      const sub = el('div', '', box);
      sub.style.cssText = 'margin-top:20px;font-weight:300;font-size:32px;letter-spacing:0.16em;color:rgba(235,240,255,0.78)';
      sub.textContent = m.sub;
      return { box, bar, kick, chars, sub };
    });

    // Dust with parallax.
    const N = 1400;
    const mat = softPointsMaterial({ size: 0.05 });
    const dust = (this.dust = makePoints(N, mat));
    this.dustMat = mat;
    const sz = dust.geometry.attributes.aSize.array;
    const al = dust.geometry.attributes.aAlpha.array;
    this.dustBase = [];
    for (let i = 0; i < N; i++) {
      const z = -2 - hash(i * 3.1) * 16;
      this.dustBase.push([hash(i * 1.7) * 60 - 30, (hash(i * 5.3) - 0.5) * 22, z]);
      sz[i] = 0.6 + hash(i * 9.1) * 1.6;
      al[i] = 0.25 + hash(i * 2.2) * 0.6;
    }
    const scn = new THREE.Scene();
    scn.add(dust);
    this.cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100);
    this.cam.position.set(0, 0, 6);
    this.layers = [ctx.gl.addLayer(scn, this.cam, 1)];
  },

  update(t, ctx) {
    const g = ctx.fx;
    const frame = Math.round(t * FPS);
    const pos = trackPos(t);
    const k = currentIndex(t);
    const col = eraColor(pos);
    const intro = prog(t, T0 - 0.55, T0 + 0.05, ease.inOutCubic);
    const outro = prog(t, T1 - 0.3, T1 + 0.3, ease.inCubic);
    const vis = intro * (1 - outro);

    ctx.flash += 0.16 * pulse(t, T0, 8);

    // Dust drifts opposite to the track.
    const dp = this.dust.geometry.attributes.position.array;
    const dc = this.dust.geometry.attributes.aColor.array;
    const c01 = col.map((v) => v / 255);
    this.dustBase.forEach(([x, y, z], i) => {
      const par = 1.2 / -z;
      let xx = x - pos * 9 * par * 3 - t * 0.15;
      xx = ((((xx + 30) % 60) + 60) % 60) - 30;
      dp[i * 3] = xx;
      dp[i * 3 + 1] = y + Math.sin(t * 0.4 + i) * 0.1;
      dp[i * 3 + 2] = z;
      const w = hash(i * 7.7) > 0.7 ? 1 : 0.6;
      dc[i * 3] = lerp(c01[0], 1, 0.3) * w;
      dc[i * 3 + 1] = lerp(c01[1], 1, 0.3) * w;
      dc[i * 3 + 2] = lerp(c01[2], 1, 0.3) * w;
    });
    this.dust.geometry.attributes.position.needsUpdate = true;
    this.dust.geometry.attributes.aColor.needsUpdate = true;
    this.dustMat.uniforms.uOpacity.value = vis * 0.9;

    // Fibre line (reveals left -> right on entry).
    const reveal = lerp(-50, 1970, intro);
    const off = NODE_X - pos * GAP;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 1 - outro;
    for (let j = -1; j < MILESTONES.length; j++) {
      const xa = Math.max(-20, off + j * GAP);
      const xb = Math.min(reveal, off + (j + 1) * GAP);
      if (xb <= xa) continue;
      const ca = ERA[clamp(j, 0, 5)];
      const cb = ERA[clamp(j + 1, 0, 5)];
      const grd = g.createLinearGradient(off + j * GAP, 0, off + (j + 1) * GAP, 0);
      grd.addColorStop(0, ca);
      grd.addColorStop(1, cb);
      g.fillStyle = grd;
      g.globalAlpha = (1 - outro) * 0.9;
      g.fillRect(xa, FY - 1, xb - xa, 2);
      g.globalAlpha = (1 - outro) * 0.18;
      g.fillRect(xa, FY - 5, xb - xa, 10);
    }
    g.globalAlpha = 1 - outro;
    // Ruler ticks.
    g.fillStyle = 'rgba(200,220,255,0.28)';
    for (let x = ((off % 38) + 38) % 38; x < Math.min(1920, reveal); x += 38) g.fillRect(x, FY + 14, 1, 7);
    // Travelling light pulses.
    for (let i = 0; i < 7; i++) {
      const sp = 380 + hash(i) * 260;
      const x = ((t * sp + hash(i * 3) * 1920) % 2200) - 140;
      if (x > reveal) continue;
      drawGlow(g, x, FY, 16, [255, 255, 255], 0.55 * (1 - outro));
      const tr = g.createLinearGradient(x - 120, 0, x, 0);
      tr.addColorStop(0, 'rgba(255,255,255,0)');
      tr.addColorStop(1, 'rgba(255,255,255,0.6)');
      g.fillStyle = tr;
      g.fillRect(x - 120, FY - 1, 120, 2);
    }
    // Nodes.
    g.textAlign = 'center';
    MILESTONES.forEach((m, j) => {
      const x = off + j * GAP;
      if (x < -60 || x > 1980 || x > reveal) return;
      const c = ERA[j];
      const rgb = mixColor(c, c, 0);
      const lit = t >= m.t;
      const cur = j === k;
      if (lit) {
        drawGlow(g, x, FY, cur ? 70 : 34, rgb, cur ? 0.95 : 0.55);
        g.fillStyle = cur ? '#fff' : c;
        g.beginPath();
        g.arc(x, FY, cur ? 8 : 6, 0, TAU);
        g.fill();
      } else {
        g.strokeStyle = 'rgba(210,225,255,0.5)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(x, FY, 6, 0, TAU);
        g.stroke();
      }
      if (cur) {
        for (let r = 0; r < 2; r++) {
          const ph = ((t - m.t) / 1.1 + r * 0.5) % 1;
          if (t < m.t) continue;
          g.strokeStyle = rgba(rgb, 0.6 * (1 - ph));
          g.lineWidth = 1.5;
          g.beginPath();
          g.arc(x, FY, 10 + ph * 46, 0, TAU);
          g.stroke();
        }
      }
      g.font = `${cur ? 700 : 400} 18px Mono`;
      g.fillStyle = cur ? 'rgba(255,255,255,0.95)' : 'rgba(200,215,240,0.55)';
      g.fillText(String(m.year), x, FY + 52);
    });
    // Beam from the current node up to the year.
    const beamP = prog(t, MILESTONES[k].t, MILESTONES[k].t + 0.45, ease.outCubic) * vis;
    if (beamP > 0) {
      const x = off + k * GAP;
      const y1 = lerp(FY, 575, beamP);
      const bg = g.createLinearGradient(0, FY, 0, 575);
      bg.addColorStop(0, rgba(col, 0.9));
      bg.addColorStop(1, rgba(col, 0));
      g.fillStyle = bg;
      g.fillRect(x - 1, y1, 2, FY - y1);
    }
    g.restore();

    // Odometer.
    const digitsAt = (i) => (i < 0 ? [0, 0, 0, 0] : String(MILESTONES[i].year).split('').map(Number));
    const odoA = prog(t, T0 - 0.3, T0 + 0.2) * (1 - outro);
    this.odo.style.opacity = odoA.toFixed(3);
    this.odo.style.filter = `drop-shadow(0 0 34px ${rgba(col, 0.55)})`;
    this.odo.style.transform = `translateX(${(-outro * 60).toFixed(1)}px)`;
    const grad = `linear-gradient(180deg, #ffffff 18%, ${rgba(col.map((v) => lerp(255, v, 0.85)))} 92%)`;
    this.cols.forEach(({ strip }, d) => {
      let v = 0;
      for (let i = 0; i < MILESTONES.length; i++) {
        const from = digitsAt(i - 1)[d];
        const to = digitsAt(i)[d];
        const start = MILESTONES[i].t - (i === 0 ? 0.55 : 0.34) + d * 0.05;
        const p = ease.inOutCubic(invlerp(start, start + (i === 0 ? 0.8 : 0.55), t));
        if (t >= start) v = from + (((to - from + 10) % 10) + (i === 0 ? 10 : 0)) * p;
      }
      v = ((v % 10) + 10) % 10;
      strip.style.transform = `translateY(${(-(v + 10) * LH).toFixed(1)}px)`;
      strip.style.backgroundImage = grad;
    });
    this.odoLabel.style.opacity = odoA.toFixed(3);
    this.odoLabel.style.color = rgba(col.map((v) => lerp(v, 255, 0.35)), 0.9);
    this.odoLabel.textContent = `MILESTONE  ${String(k + 1).padStart(2, '0')}`;

    // Captions.
    this.caps.forEach((c, j) => {
      const m = MILESTONES[j];
      const next = j < MILESTONES.length - 1 ? MILESTONES[j + 1].t : T1;
      const inA = prog(t, m.t - 0.05, m.t + 0.35, ease.outCubic);
      const out = prog(t, next - 0.3, next - 0.02, ease.inCubic);
      const on = t > m.t - 0.1 && t < next + 0.05;
      c.box.style.display = on ? 'block' : 'none';
      if (!on) return;
      c.box.style.opacity = (1 - out).toFixed(3);
      c.box.style.transform = `translateY(${(-out * 36).toFixed(1)}px)`;
      c.box.style.filter = out > 0 ? `blur(${(out * 8).toFixed(1)}px)` : '';
      const ec = rgba(mixColor(ERA[j], '#ffffff', 0.25), 1);
      c.kick.style.color = ec;
      c.kick.style.opacity = inA.toFixed(3);
      c.bar.style.height = `${(inA * 190).toFixed(1)}px`;
      c.bar.style.background = `linear-gradient(180deg, ${ERA[j]}, rgba(255,255,255,0))`;
      c.bar.style.boxShadow = `0 0 14px ${ERA[j]}`;
      c.chars.forEach((ch, i) => {
        const p = prog(t, m.t + 0.04 + i * 0.028, m.t + 0.42 + i * 0.028, ease.outCubic);
        ch.style.opacity = p.toFixed(3);
        ch.style.transform = `translateY(${((1 - p) * 40).toFixed(1)}px)`;
        ch.style.filter = p < 1 ? `blur(${((1 - p) * 10).toFixed(1)}px)` : '';
      });
      const sp = prog(t, m.t + 0.3, m.t + 0.75, ease.outCubic);
      c.sub.style.opacity = sp.toFixed(3);
      c.sub.style.transform = `translateX(${((1 - sp) * -24).toFixed(1)}px)`;
    });
  },
};

export default scene;
