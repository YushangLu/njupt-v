// Shared helpers: a tiny static file server plus a headless Chromium page that
// exposes window.renderAt(t). Frames are pure functions of t, so any worker
// can render any frame range independently.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.json': 'application/json',
  '.wav': 'audio/wav',
};

export function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(p, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

export async function launch() {
  return chromium.launch({
    headless: true,
    args: [
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader',
      '--ignore-gpu-blocklist',
      '--font-render-hinting=none',
      '--force-color-profile=srgb',
      '--hide-scrollbars',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
    ],
  });
}

export async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text());
  });
  await page.goto(`http://127.0.0.1:${port}/src/index.html?render=1`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  const cdp = await page.context().newCDPSession(page);
  return {
    page,
    async frame(t, format = 'png') {
      await page.evaluate((tt) => window.renderAt(tt), t);
      const r = await cdp.send('Page.captureScreenshot', {
        format,
        quality: format === 'jpeg' ? 95 : undefined,
        optimizeForSpeed: true,
      });
      return Buffer.from(r.data, 'base64');
    },
  };
}
