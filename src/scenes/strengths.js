// 04 STRENGTH — warp jump, a 3D network of disciplines, four headline numbers
// and the flexible-electronics lab over a bending circuit mesh.
import { el, prog, ease, clamp, lerp, hash, pulse, TAU, splitChars, mulberry32, scramble } from '../lib/util.js';
import { drawGlow } from '../lib/draw.js';
import { THREE, softPointsMaterial, makePoints, makeLines, fibSphere } from '../lib/gl.js';
import { S, STRENGTH, FPS } from '../timeline.js';

const T0 = S.strengths[0];
const T1 = S.strengths[1];
const WARP_END = STRENGTH.headline;

const FIELDS = [
  ['通信工程', 'COMMUNICATIONS'],
  ['电子信息', 'ELECTRONICS'],
  ['集成电路', 'INTEGRATED CIRCUITS'],
  ['人工智能', 'AI'],
  ['计算机', 'COMPUTING'],
  ['网络空间安全', 'CYBERSECURITY'],
  ['物联网', 'IOT'],
  ['柔性电子', 'FLEXIBLE ELECTRONICS'],
  ['光电信息', 'OPTOELECTRONICS'],
  ['大数据', 'BIG DATA'],
  ['自动化', 'AUTOMATION'],
  ['软件工程', 'SOFTWARE'],
];

const STATS = [
  { kick: 'DOUBLE FIRST-CLASS', big: '双一流', cn: true, desc: '国家“双一流”建设高校', sub: '建设学科 · 电子科学与技术' },
  { kick: 'ESI GLOBAL RANKING', big: 'TOP 1‰', desc: '计算机科学 · 工程学', sub: '跻身 ESI 全球排名前 1‰' },
  { kick: 'ESI TOP 1%', big: '6', count: 6, desc: '个学科进入 ESI 全球排名前 1%', sub: '计算机科学 · 工程学 · 材料科学 · 化学 · 物理学 · 社会科学总论' },
  { kick: 'NATIONAL FIRST-CLASS MAJORS', big: '27', count: 27, desc: '个国家级一流本科专业建设点', sub: '以工学为主体 · 以电子信息为特色' },
];

const scene = {
  range: [T0 - 0.05, T1 + 0.05],
  init(ctx) {
    const root = (this.root = el('div', 'scene', ctx.dom));
    const rnd = mulberry32(99);

    // ---------------------------------------------------------- warp ---
    const NW = 700;
    this.warpLines = makeLines(NW);
    this.warp = [];
    for (let i = 0; i < NW; i++) {
      const a = rnd() * TAU;
      const r = 0.6 + Math.pow(rnd(), 0.6) * 9;
      this.warp.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, z: -rnd() * 90, s: 0.6 + rnd() * 0.8, c: rnd() });
    }
    const warpScene = new THREE.Scene();
    warpScene.add(this.warpLines);
    this.warpCam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 200);

    // ------------------------------------------------------- network ---
    const net = (this.net = new THREE.Group());
    const nodes = [];
    fibSphere(FIELDS.length, 3.1).forEach((p) => nodes.push({ p: new THREE.Vector3(...p), label: true }));
    for (let i = 0; i < 90; i++) {
      const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(2.2 + rnd() * 1.4);
      nodes.push({ p: v, label: false });
    }
    this.nodes = nodes;
    const nodeMat = softPointsMaterial({ size: 0.32 });
    this.nodeMat = nodeMat;
    const np = makePoints(nodes.length, nodeMat);
    nodes.forEach((n, i) => {
      np.geometry.attributes.position.array.set([n.p.x, n.p.y, n.p.z], i * 3);
      np.geometry.attributes.aSize.array[i] = n.label ? 1.5 : 0.35 + rnd() * 0.4;
      np.geometry.attributes.aColor.array.set(n.label ? [0.7, 0.9, 1] : [0.3, 0.6, 1], i * 3);
    });
    net.add(np);
    // Edges: each node to its 3 nearest neighbours.
    const edges = [];
    nodes.forEach((n, i) => {
      const d = nodes.map((m, j) => [j, n.p.distanceTo(m.p)]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]);
      d.slice(0, 3).forEach(([j]) => {
        if (!edges.some(([a, b]) => (a === j && b === i) || (a === i && b === j))) edges.push([i, j]);
      });
    });
    this.edges = edges;
    const lines = (this.netLines = makeLines(edges.length));
    edges.forEach(([a, b], k) => {
      const A = nodes[a].p;
      const B = nodes[b].p;
      lines.geometry.attributes.position.array.set([A.x, A.y, A.z, B.x, B.y, B.z], k * 6);
    });
    net.add(lines);
    // Packets travelling along edges.
    const packMat = softPointsMaterial({ size: 0.22 });
    this.packMat = packMat;
    this.packets = makePoints(60, packMat);
    this.packInfo = Array.from({ length: 60 }, (_, i) => ({ e: Math.floor(rnd() * edges.length), off: rnd(), sp: 0.5 + rnd() }));
    net.add(this.packets);
    const netScene = new THREE.Scene();
    netScene.add(net);
    this.netCam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);

    // Labels.
    this.labels = FIELDS.map(([cn, en]) => {
      const d = el('div', 'abs', root);
      d.style.cssText =
        'left:0;top:0;padding:8px 16px 9px;border:1px solid rgba(120,190,255,0.45);border-radius:22px;background:rgba(8,20,48,0.55);white-space:nowrap;transform-origin:0 50%';
      d.innerHTML = `<span style="font-weight:700;font-size:24px;color:#fff;letter-spacing:0.08em">${cn}</span><span class="mono" style="font-size:12px;letter-spacing:0.2em;color:rgba(150,205,255,0.85);margin-left:12px">${en}</span>`;
      return d;
    });

    // ------------------------------------------------------ headline ---
    const hl = (this.headline = el('div', 'abs', root));
    hl.style.cssText = 'left:150px;top:360px;';
    this.hlKick = el('div', 'kicker', hl);
    this.hlKick.style.marginBottom = '28px';
    const l1 = el('div', '', hl);
    l1.style.cssText = 'font-weight:900;font-size:78px;letter-spacing:0.06em;line-height:1.25;color:#fff';
    this.hl1 = splitChars(l1, '以工学为主体');
    const l2 = el('div', '', hl);
    l2.style.cssText = 'font-weight:900;font-size:78px;letter-spacing:0.06em;line-height:1.25;color:#fff';
    this.hl2 = [...'以电子信息为特色'].map((c, i) => {
      const s = el('span', 'ch', l2, c);
      if (i >= 1 && i <= 4) {
        s.style.background = 'linear-gradient(180deg,#9ff0ff,#2f8bff)';
        s.style.webkitBackgroundClip = 'text';
        s.style.backgroundClip = 'text';
        s.style.color = 'transparent';
      }
      return s;
    });

    // --------------------------------------------------------- stats ---
    this.stats = STATS.map((st) => {
      const box = el('div', 'abs', root);
      box.style.cssText = 'left:0;right:0;top:250px;text-align:center;';
      const kick = el('div', 'kicker', box);
      kick.style.cssText += 'font-size:20px;letter-spacing:0.5em;padding-left:0.5em';
      const big = el('div', st.cn ? '' : 'grot', box);
      big.style.cssText = st.cn
        ? 'margin-top:6px;font-weight:900;font-size:210px;line-height:300px;letter-spacing:0.08em;padding-left:0.08em'
        : 'margin-top:6px;font-weight:700;font-size:260px;line-height:300px;letter-spacing:-0.02em';
      big.style.background = 'linear-gradient(180deg,#ffffff 25%,#7cc4ff 75%,#2f6bff 100%)';
      big.style.webkitBackgroundClip = 'text';
      big.style.backgroundClip = 'text';
      big.style.color = 'transparent';
      big.textContent = st.big;
      const bigWrap = el('div', '', box);
      bigWrap.appendChild(big);
      bigWrap.style.filter = 'drop-shadow(0 0 30px rgba(60,150,255,0.55))';
      const desc = el('div', '', box);
      desc.style.cssText = 'margin-top:10px;font-weight:700;font-size:46px;letter-spacing:0.14em;padding-left:0.14em;color:#fff';
      desc.textContent = st.desc;
      const sub = el('div', '', box);
      sub.style.cssText = 'margin-top:22px;font-weight:300;font-size:28px;letter-spacing:0.2em;padding-left:0.2em;color:rgba(210,230,255,0.8)';
      sub.textContent = st.sub;
      return { st, box, kick, big, bigWrap, desc, sub };
    });

    // ----------------------------------------------------------- lab ---
    const GX = 56;
    const GZ = 30;
    this.GX = GX;
    this.GZ = GZ;
    this.mesh = makeLines(GX * (GZ + 1) + GZ * (GX + 1));
    const meshScene = new THREE.Scene();
    meshScene.add(this.mesh);
    this.meshCam = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
    const lab = (this.lab = el('div', 'abs', root));
    lab.style.cssText = 'left:0;right:0;top:250px;text-align:center';
    this.labKick = el('div', 'kicker', lab);
    this.labKick.style.cssText += 'font-size:20px;letter-spacing:0.5em;padding-left:0.5em;color:rgba(190,170,255,0.95)';
    const lt = el('div', '', lab);
    lt.style.cssText =
      'margin-top:26px;font-weight:900;font-size:92px;letter-spacing:0.08em;padding-left:0.08em;color:#fff;text-shadow:0 0 30px rgba(140,110,255,0.6),0 0 80px rgba(60,120,255,0.4)';
    this.labChars = splitChars(lt, '柔性电子全国重点实验室');
    this.labSub = el('div', '', lab);
    this.labSub.style.cssText = 'margin-top:26px;font-weight:500;font-size:36px;letter-spacing:0.3em;padding-left:0.3em;color:rgba(225,220,255,0.9)';
    this.labSub.textContent = '南京邮电大学 牵头组建';

    this.layers = [
      ctx.gl.addLayer(netScene, this.netCam, 2),
      ctx.gl.addLayer(meshScene, this.meshCam, 3),
      ctx.gl.addLayer(warpScene, this.warpCam, 4),
    ];
  },

  update(t, ctx) {
    const g = ctx.fx;
    const frame = Math.round(t * FPS);

    // ---------------------------------------------------------- warp ---
    const wIn = prog(t, T0 - 0.05, T0 + 0.25, ease.outQuad);
    const wOut = prog(t, WARP_END - 0.2, WARP_END + 0.25, ease.inQuad);
    const wAmt = wIn * (1 - wOut);
    ctx.flash += 0.6 * pulse(t, WARP_END, 7) + 0.2 * pulse(t, T0, 8);
    ctx.shake += 6 * wAmt;
    this.layers[2].visible = wAmt > 0.001;
    if (wAmt > 0.001) {
      // Distance travelled: accelerate then brake.
      const lt = t - T0;
      const dist = 140 * Math.pow(clamp(lt / 0.95), 1.6) + 20 * lt;
      const speed = 180 * clamp(lt / 0.95) + 20;
      const P = this.warpLines.geometry.attributes.position.array;
      const C = this.warpLines.geometry.attributes.color.array;
      this.warp.forEach((w, i) => {
        let z = ((w.z + dist * w.s) % 90) - 90 + 4;
        if (z > 3) z -= 90;
        const len = Math.min(26, 0.4 + speed * 0.06 * w.s);
        P.set([w.x, w.y, z, w.x, w.y, z - len], i * 6);
        const near = clamp((z + 90) / 90);
        const I = wAmt * near * near;
        const c = w.c > 0.8 ? [1, 1, 1] : w.c > 0.4 ? [0.3, 0.8, 1] : [0.25, 0.45, 1];
        C.set([c[0] * I, c[1] * I, c[2] * I, 0, 0, 0], i * 6);
      });
      this.warpLines.geometry.attributes.position.needsUpdate = true;
      this.warpLines.geometry.attributes.color.needsUpdate = true;
      this.warpCam.position.set(0, 0, 4);
      this.warpCam.lookAt(0, 0, -10);
      this.warpCam.rotation.z = (t - T0) * 0.4;
      drawGlow(g, 960, 540, 260 * wAmt, [120, 190, 255], 0.5 * wAmt);
    }

    // ------------------------------------------------------- network ---
    const nIn = prog(t, WARP_END - 0.1, WARP_END + 0.9, ease.outCubic);
    const toStats = prog(t, STRENGTH.stats[0] - 0.35, STRENGTH.stats[0] + 0.35, ease.inOutCubic);
    const nOut = prog(t, STRENGTH.lab - 0.3, STRENGTH.lab + 0.3, ease.inCubic);
    const netA = nIn * (1 - nOut) * lerp(1, 0.32, toStats);
    this.layers[0].visible = netA > 0.001;
    const rotY = (t - WARP_END) * 0.32 + 0.8;
    this.net.rotation.set(0.25 + Math.sin(t * 0.3) * 0.08, rotY, 0);
    this.net.position.set(lerp(2.35, 0, toStats), lerp(0.1, 0, toStats), lerp(0, -2.5, toStats));
    this.net.scale.setScalar(lerp(0.6, 1, nIn) * lerp(1, 1.35, toStats));
    this.netCam.position.set(0, 0, 11);
    this.netCam.lookAt(0, 0, 0);
    this.nodeMat.uniforms.uOpacity.value = netA;
    const EC = this.netLines.geometry.attributes.color.array;
    const reveal = prog(t, WARP_END, WARP_END + 1.2);
    this.edges.forEach((e, k) => {
      const I = netA * 0.35 * clamp(reveal * 1.4 - hash(k) * 0.4);
      EC.set([0.3 * I, 0.65 * I, I, 0.3 * I, 0.65 * I, I], k * 6);
    });
    this.netLines.geometry.attributes.color.needsUpdate = true;
    const PP = this.packets.geometry.attributes.position.array;
    this.packInfo.forEach((p, i) => {
      const [a, b] = this.edges[p.e];
      const s = (t * p.sp + p.off) % 1;
      const A = this.nodes[a].p;
      const B = this.nodes[b].p;
      PP.set([lerp(A.x, B.x, s), lerp(A.y, B.y, s), lerp(A.z, B.z, s)], i * 3);
    });
    this.packets.geometry.attributes.position.needsUpdate = true;
    this.packMat.uniforms.uOpacity.value = netA;
    this.net.updateMatrixWorld(true);

    // Labels follow their projected nodes.
    const labelA = nIn * (1 - toStats);
    const v = new THREE.Vector3();
    this.labels.forEach((lab, i) => {
      if (labelA <= 0.001) {
        lab.style.display = 'none';
        return;
      }
      lab.style.display = 'block';
      v.copy(this.nodes[i].p).applyMatrix4(this.net.matrixWorld);
      const depth = clamp((v.z + 3.5) / 7 + 0.05);
      v.project(this.netCam);
      const x = (v.x * 0.5 + 0.5) * 1920 + 18;
      const y = (-v.y * 0.5 + 0.5) * 1080;
      const pop = prog(t, WARP_END + 0.25 + i * 0.07, WARP_END + 0.6 + i * 0.07, ease.outBack);
      lab.style.transform = `translate(${x.toFixed(1)}px, ${(y - 22).toFixed(1)}px) scale(${(lerp(0.62, 1, depth) * pop).toFixed(3)})`;
      lab.style.opacity = (labelA * lerp(0.25, 1, depth) * clamp(pop)).toFixed(3);
      lab.style.zIndex = String(Math.round(depth * 100));
    });

    // ------------------------------------------------------ headline ---
    const hOut = prog(t, STRENGTH.stats[0] - 0.4, STRENGTH.stats[0] - 0.05, ease.inCubic);
    this.headline.style.display = t < STRENGTH.stats[0] ? 'block' : 'none';
    this.hlKick.textContent = scramble('DISCIPLINES  ·  学科特色', prog(t, WARP_END, WARP_END + 0.5), frame);
    this.hlKick.style.opacity = (prog(t, WARP_END, WARP_END + 0.2) * (1 - hOut)).toFixed(3);
    [...this.hl1, ...this.hl2].forEach((c, i) => {
      const s = WARP_END + 0.12 + i * 0.045 + (i >= 6 ? 0.18 : 0);
      const p = prog(t, s, s + 0.45, ease.outCubic);
      c.style.opacity = (p * (1 - hOut)).toFixed(3);
      c.style.transform = `translateY(${((1 - p) * 50 - hOut * 30).toFixed(1)}px) rotateX(${((1 - p) * 70).toFixed(1)}deg)`;
      c.style.filter = `blur(${((1 - p) * 8 + hOut * 10).toFixed(1)}px)`;
    });

    // --------------------------------------------------------- stats ---
    this.stats.forEach((s, i) => {
      const t0 = STRENGTH.stats[i];
      const t1 = i < 3 ? STRENGTH.stats[i + 1] : STRENGTH.lab;
      const on = t > t0 - 0.1 && t < t1 + 0.05;
      s.box.style.display = on ? 'block' : 'none';
      if (!on) return;
      const pin = prog(t, t0 - 0.06, t0 + 0.32, ease.outCubic);
      const pout = prog(t, t1 - 0.22, t1 + 0.02, ease.inCubic);
      s.box.style.opacity = (clamp(pin * 1.4) * (1 - pout)).toFixed(3);
      s.box.style.transform = `scale(${(lerp(1.12, 1, pin) * lerp(1, 0.94, pout)).toFixed(4)})`;
      s.box.style.filter = pin < 1 || pout > 0 ? `blur(${((1 - pin) * 12 + pout * 12).toFixed(1)}px)` : '';
      s.kick.textContent = scramble(s.st.kick, prog(t, t0, t0 + 0.4), frame + i);
      if (s.st.count) {
        const c = Math.round(s.st.count * prog(t, t0 + 0.02, t0 + 0.75, ease.outCubic));
        s.big.textContent = String(c);
      }
      const dp = prog(t, t0 + 0.18, t0 + 0.55, ease.outCubic);
      s.desc.style.opacity = dp.toFixed(3);
      s.desc.style.transform = `translateY(${((1 - dp) * 24).toFixed(1)}px)`;
      const sp = prog(t, t0 + 0.35, t0 + 0.75, ease.outCubic);
      s.sub.style.opacity = sp.toFixed(3);
      s.sub.style.letterSpacing = `${lerp(0.5, 0.2, sp).toFixed(3)}em`;
      // Light streak across the frame on each downbeat.
      const st = prog(t, t0 - 0.05, t0 + 0.3, ease.outQuad);
      if (st > 0 && st < 1) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        const x = lerp(-400, 2300, st);
        const grd = g.createLinearGradient(x - 500, 0, x, 0);
        grd.addColorStop(0, 'rgba(80,160,255,0)');
        grd.addColorStop(1, `rgba(200,235,255,${0.8 * (1 - st)})`);
        g.fillStyle = grd;
        g.fillRect(x - 500, 538, 500, 3);
        g.restore();
      }
      ctx.flash += 0.12 * pulse(t, t0, 9);
    });

    // ----------------------------------------------------------- lab ---
    const L0 = STRENGTH.lab;
    const lIn = prog(t, L0 - 0.15, L0 + 0.5, ease.outCubic);
    const lOut = prog(t, T1 - 0.4, T1, ease.inCubic);
    const labA = lIn * (1 - lOut);
    this.layers[1].visible = labA > 0.001;
    this.lab.style.display = t > L0 - 0.2 ? 'block' : 'none';
    if (labA > 0.001) {
      const { GX, GZ } = this;
      const P = this.mesh.geometry.attributes.position.array;
      const C = this.mesh.geometry.attributes.color.array;
      const lt = t - L0;
      const fold = Math.sin(lt * 1.6) * 0.9;
      const Y = (x, z) =>
        0.45 * Math.sin(x * 0.55 + lt * 2.2) * Math.cos(z * 0.45 - lt * 1.4) + fold * Math.pow(x / 9, 2) * 3 - 0.8 * Math.pow(z / 12, 2);
      const X = (i) => -10 + (20 * i) / GX;
      const Z = (j) => -14 + (16 * j) / GZ;
      let k = 0;
      const put = (x0, z0, x1, z1) => {
        const y0 = Y(x0, z0);
        const y1 = Y(x1, z1);
        P.set([x0, y0, z0, x1, y1, z1], k * 6);
        const f0 = clamp((z0 + 16) / 16);
        const f1 = clamp((z1 + 16) / 16);
        const hue = (x0 + 10) / 20;
        const cr = lerp(0.35, 0.65, hue);
        const cg = lerp(0.75, 0.45, hue);
        const I0 = labA * f0 * f0 * (0.55 + 0.45 * Math.max(0, y0));
        const I1 = labA * f1 * f1 * (0.55 + 0.45 * Math.max(0, y1));
        C.set([cr * I0, cg * I0, I0, cr * I1, cg * I1, I1], k * 6);
        k++;
      };
      for (let j = 0; j <= GZ; j++) for (let i = 0; i < GX; i++) put(X(i), Z(j), X(i + 1), Z(j));
      for (let i = 0; i <= GX; i++) for (let j = 0; j < GZ; j++) put(X(i), Z(j), X(i), Z(j + 1));
      this.mesh.geometry.attributes.position.needsUpdate = true;
      this.mesh.geometry.attributes.color.needsUpdate = true;
      this.meshCam.position.set(0, 4.2 - lIn * 0.6, 6.5);
      this.meshCam.lookAt(0, -1.2, -5);
    }
    this.labKick.textContent = scramble('FLEXIBLE ELECTRONICS  ·  NATIONAL KEY LABORATORY', prog(t, L0, L0 + 0.5), frame);
    this.labKick.style.opacity = (prog(t, L0, L0 + 0.2) * (1 - lOut)).toFixed(3);
    this.labChars.forEach((c, i) => {
      const p = prog(t, L0 + 0.05 + i * 0.035, L0 + 0.45 + i * 0.035, ease.outCubic);
      c.style.opacity = (p * (1 - lOut)).toFixed(3);
      c.style.transform = `translateY(${((1 - p) * 40).toFixed(1)}px) scale(${lerp(1.25, 1, p).toFixed(3)})`;
      c.style.filter = `blur(${((1 - p) * 10 + lOut * 8).toFixed(1)}px)`;
    });
    const sp = prog(t, L0 + 0.45, L0 + 0.85, ease.outCubic);
    this.labSub.style.opacity = (sp * (1 - lOut)).toFixed(3);
    ctx.flash += 0.15 * pulse(t, L0, 8);
  },
};

export default scene;
