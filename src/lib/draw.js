// Canvas 2D helpers: cached glow sprites, text sprites and point sampling.

const spriteCache = new Map();

// Soft radial glow sprite (white core -> color -> transparent).
export function glowSprite(color = [120, 200, 255], size = 64, core = 0.18) {
  const key = color.join(',') + '|' + size + '|' + core;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size / 2;
  const grd = g.createRadialGradient(r, r, 0, r, r, r);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(core, `rgba(${color[0]},${color[1]},${color[2]},0.9)`);
  grd.addColorStop(0.45, `rgba(${color[0]},${color[1]},${color[2]},0.25)`);
  grd.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  spriteCache.set(key, c);
  return c;
}

export function drawGlow(ctx, x, y, radius, color, alpha = 1, core) {
  if (alpha <= 0.002 || radius <= 0.1) return;
  const s = glowSprite(color, 128, core);
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(s, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

// Renders text into an offscreen canvas. Returns {canvas, w, h, ox, oy}
// where (ox, oy) is the offset of the text anchor inside the canvas.
export function textSprite({
  text,
  font,
  color = '#fff',
  letterSpacing = 0,
  pad = 40,
  shadow = null, // {color, blur}
  gradient = null, // [[stop, color], ...] horizontal
  stroke = null, // {color, width}
}) {
  const m = document.createElement('canvas').getContext('2d');
  m.font = font;
  m.letterSpacing = letterSpacing + 'px';
  const met = m.measureText(text);
  const asc = met.actualBoundingBoxAscent;
  const desc = met.actualBoundingBoxDescent;
  // letterSpacing adds trailing space after the last glyph; remove it.
  const w = Math.ceil(met.width - letterSpacing) + pad * 2;
  const h = Math.ceil(asc + desc) + pad * 2;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.font = font;
  g.letterSpacing = letterSpacing + 'px';
  g.textBaseline = 'alphabetic';
  const x = pad;
  const y = pad + asc;
  if (gradient) {
    const grd = g.createLinearGradient(pad, 0, w - pad, 0);
    gradient.forEach(([s, col]) => grd.addColorStop(s, col));
    g.fillStyle = grd;
  } else g.fillStyle = color;
  if (shadow) {
    g.shadowColor = shadow.color;
    g.shadowBlur = shadow.blur;
  }
  if (stroke) {
    g.strokeStyle = stroke.color;
    g.lineWidth = stroke.width;
    g.strokeText(text, x, y);
  } else g.fillText(text, x, y);
  return { canvas: c, w, h, textW: w - pad * 2, textH: asc + desc, pad, asc };
}

// Returns target points (in sprite-local pixels) where the sprite is opaque.
export function samplePoints(canvas, step = 4, threshold = 128, rand = Math.random) {
  const g = canvas.getContext('2d');
  const { width, height } = canvas;
  const data = g.getImageData(0, 0, width, height).data;
  const pts = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const jx = x + Math.floor(rand() * step);
      const jy = y + Math.floor(rand() * step);
      if (jx >= width || jy >= height) continue;
      const a = data[(jy * width + jx) * 4 + 3];
      if (a > threshold) pts.push([jx, jy]);
    }
  }
  return pts;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Draws an image sliced into horizontal bands with random offsets and an
// RGB split: the look of a corrupted signal.
export function drawGlitched(ctx, img, x, y, w, h, amount, seed, hashFn) {
  if (amount <= 0.001) {
    ctx.drawImage(img, x, y, w, h);
    return;
  }
  const bands = 14;
  const iw = img.width;
  const ih = img.height;
  for (let i = 0; i < bands; i++) {
    const r = hashFn(seed * 13.1 + i * 3.7);
    const sy = (i / bands) * ih;
    const sh = ih / bands + 1;
    const dy = y + (i / bands) * h;
    const dh = h / bands + 1;
    const off = r > 0.55 ? (hashFn(seed + i) - 0.5) * 160 * amount : 0;
    ctx.drawImage(img, 0, sy, iw, sh, x + off, dy, w, dh);
  }
  // Chromatic fringes.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.55 * Math.min(1, amount * 1.5);
  ctx.filter = 'sepia(1) saturate(8) hue-rotate(-50deg)';
  ctx.drawImage(img, x - 14 * amount, y, w, h);
  ctx.filter = 'sepia(1) saturate(8) hue-rotate(160deg)';
  ctx.drawImage(img, x + 14 * amount, y, w, h);
  ctx.restore();
}
