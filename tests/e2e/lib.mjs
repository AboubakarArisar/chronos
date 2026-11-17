// Shared Playwright helpers: drives the system Chrome (headed, real GPU).
import { chromium } from 'playwright-core';
export const BASE = process.env.BASE || 'http://localhost:5183';
export async function open(path = '/app.html', { width = 1920, height = 1080, fresh = false } = {}) {
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--autoplay-policy=no-user-gesture-required', '--window-position=0,0', `--window-size=${width},${height + 90}`, '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  if (!fresh) await page.addInitScript(() => { try { localStorage.setItem('chronos.seenIntro', 'true'); localStorage.setItem('chronos.soundAsked', 'true'); } catch {} });
  await page.goto(BASE + path);
  if (path.startsWith('/app.html')) await page.waitForFunction(() => window.chronos?.ready, null, { timeout: 60000 });
  return { browser, page, errors };
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
