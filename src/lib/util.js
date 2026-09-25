export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invlerp = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (a, b, x) => {
  const t = invlerp(a, b, x);
  return t * t * (3 - 2 * t);
};

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  inQuint: (t) => t * t * t * t * t,
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t) =>
    t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t) =>
    t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
};

// Eased progress of t through [t0, t1].
export const prog = (t, t0, t1, e = ease.linear) => e(invlerp(t0, t1, t));

// Envelope: rises over [a, b], holds, falls over [c, d].
export const env = (t, a, b, c, d, ei = ease.outCubic, eo = ease.inCubic) => {
  if (t <= a || t >= d) return 0;
  if (t < b) return ei(invlerp(a, b, t));
  if (t <= c) return 1;
  return 1 - eo(invlerp(c, d, t));
};

// Exponential decay pulse after t0.
export const pulse = (t, t0, decay = 6) => (t < t0 ? 0 : Math.exp(-(t - t0) * decay));

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stateless hash -> [0, 1).
export function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
export const hash2 = (a, b) => hash(a * 57.31 + b * 113.97);

// Smooth 1D value noise.
export function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u) * 2 - 1;
}

export const TAU = Math.PI * 2;

export function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

// Wraps every character of `text` in a span and returns the spans.
export function splitChars(parent, text, cls = 'ch') {
  return [...text].map((c) => el('span', cls, parent, c === ' ' ? '&nbsp;' : c));
}

export function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export function mixColor(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return A.map((x, i) => Math.round(lerp(x, B[i], t)));
}
export const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// Scrambled text used for "decoding" reveals.
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/';
export function scramble(target, p, seed) {
  if (p >= 1) return target;
  const n = target.length;
  let out = '';
  for (let i = 0; i < n; i++) {
    const reveal = i / n < p;
    if (reveal || target[i] === ' ') out += target[i];
    else out += GLYPHS[Math.floor(hash(seed + i * 7.3) * GLYPHS.length)];
  }
  return out;
}
