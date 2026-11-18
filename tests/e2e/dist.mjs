// Checks the built site served by `npm run preview`: pages load, the app works, and it still works offline.
//   BASE=http://localhost:4183 node tests/e2e/dist.mjs
import fs from 'node:fs';
import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'http://localhost:4183', sleep = ms => new Promise(r => setTimeout(r, ms)), out = { base: BASE };
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }); const page = await ctx.newPage(); const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => { try { localStorage.setItem('chronos.seenIntro', 'true'); localStorage.setItem('chronos.soundAsked', 'true'); } catch {} });
for (const p of ['index.html', 'credits.html', 'privacy.html', '404.html']) { const r = await page.goto(`${BASE}/${p}`); await sleep(1500); out[p] = { status: r.status(), title: await page.title(), text: (await page.evaluate(() => document.body.innerText.length)) }; }
out.credits = await page.goto(`${BASE}/credits.html`).then(() => sleep(1500)).then(() => page.evaluate(() => document.querySelectorAll('#credits li').length));
const t0 = Date.now(); await page.goto(`${BASE}/app.html`); await page.waitForFunction(() => window.chronos?.ready, null, { timeout: 60000 }); out.appReadyMs = Date.now() - t0;
await sleep(3000); await page.mouse.click(900, 430); await sleep(3000);
out.app = await page.evaluate(() => ({ realm: document.getElementById('bname').textContent, wiki: document.getElementById('bwiki').textContent.length, fps: +window.chronos.fps.avg.toFixed(1), skin: window.chronos.skins.current }));
// service worker: wait for it, let it fetch the maps, then go offline and reload
out.sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
await page.evaluate(() => navigator.serviceWorker.controller?.postMessage('precache-maps')); await sleep(25000);
out.cached = await page.evaluate(async () => { const keys = await caches.keys(); const c = await caches.open(keys[0]); const all = await c.keys(); return { cache: keys[0], files: all.length, maps: all.filter(r => /\/d\/b\/-?\d+\.json$/.test(r.url)).length }; });
await ctx.setOffline(true); await page.goto(`${BASE}/privacy.html`); await page.goto(`${BASE}/app.html#y=117&c=41,14,2.5`); await page.waitForFunction(() => window.chronos?.ready, null, { timeout: 60000 }); await sleep(3500);
await page.mouse.click(800, 450); await sleep(3000);
out.offline = await page.evaluate(() => ({ year: Math.round(window.chronos.timeline.state.year), map: window.chronos.borders.primary?.year, realm: document.getElementById('bname').textContent, note: document.getElementById('bwiki').textContent.slice(0, 90) }));
await page.evaluate(() => { window.chronos.timeline.set(1650, 'jump'); }); await sleep(3000); out.offline.otherMap = await page.evaluate(() => window.chronos.borders.primary?.year);
await page.screenshot({ path: 'tests/screens/offline.jpg', type: 'jpeg', quality: 80 });
await page.goto(`${BASE}/index.html`); await sleep(2500); out.offline.landing = await page.evaluate(() => document.querySelector('h1')?.textContent.slice(0, 20));
out.errors = errors.filter(e => !/ERR_INTERNET_DISCONNECTED|Failed to fetch|wikipedia/i.test(e));
fs.writeFileSync('tests/results/dist.json', JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1)); await browser.close();
