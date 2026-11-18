// Landing page checks: screenshots at desktop and 390px, no horizontal overflow, CTA visible in the first screen,
// keyboard reachability, reduced motion, hero fps, design-skill lint (fonts, sizes, italics, hyphens in copy).
import fs from 'node:fs';
import { open, sleep } from './lib.mjs';
const out = {}; const TW = [12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72, 96, 128];
async function run(width, height, tag) {
  const { browser, page, errors } = await open('/index.html', { width, height });
  await sleep(5000);
  const r = await page.evaluate(TW => {
    const de = document.documentElement, cta = document.querySelector('.hero .btn').getBoundingClientRect();
    const bad = { fonts: new Set(), sizes: new Set(), italic: 0, heavy: 0, hyphen: [] };
    for (const el of document.querySelectorAll('body *')) {
      if (!el.childNodes.length || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el); if (cs.display === 'none') continue;
      if (!/Manrope/.test(cs.fontFamily)) bad.fonts.add(cs.fontFamily.slice(0, 30));
      const fs = parseFloat(cs.fontSize); if (!TW.includes(fs)) bad.sizes.add(fs + ':' + el.className);
      if (cs.fontStyle === 'italic') bad.italic++; if (+cs.fontWeight > 700) bad.heavy++;
      for (const n of el.childNodes) if (n.nodeType === 3 && /[A-Za-z]-[A-Za-z]|\s-\s|—|–/.test(n.textContent) && !el.closest('#heroYear,#heroMap,#skinNote')) bad.hyphen.push(n.textContent.trim().slice(0, 50));
    }
    return { overflowX: de.scrollWidth - de.clientWidth, ctaVisible: cta.top >= 0 && cta.bottom <= innerHeight && cta.width > 0, ctaText: document.querySelector('.hero .btn').textContent.trim(),
      proof: document.querySelector('.proof').textContent, fps: window.chronosHero?.globe.fps.avg, map: document.getElementById('heroMap').textContent,
      fonts: [...bad.fonts], sizes: [...bad.sizes], italic: bad.italic, heavy: bad.heavy, hyphen: bad.hyphen, h1: document.querySelectorAll('h1').length, imgsNoAlt: [...document.images].filter(i => !i.hasAttribute('alt')).length };
  }, TW);
  await page.screenshot({ path: `tests/screens/landing-${tag}-hero.jpg`, type: 'jpeg', quality: 78 });
  // scroll through so reveals fire, then a full page shot
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += Math.round(height * .6)) { await page.evaluate(y => scrollTo(0, y), y); await sleep(350); }
  r.revealed = await page.evaluate(() => [document.querySelectorAll('.rise.in').length, document.querySelectorAll('.rise').length, document.querySelectorAll('.w.on').length, document.querySelectorAll('.w').length]);
  await page.screenshot({ path: `tests/screens/landing-${tag}-full.jpg`, type: 'jpeg', quality: 70, fullPage: true });
  if (tag === 'desktop') { // keyboard: tab order reaches skip link, nav, CTA
    await page.evaluate(() => scrollTo(0, 0)); const seq = [];
    for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); seq.push(await page.evaluate(() => (document.activeElement.textContent || document.activeElement.getAttribute('aria-label') || '').trim().slice(0, 24))); }
    r.tabOrder = seq;
  } else { await page.evaluate(() => scrollTo(0, 0)); await page.click('#menuToggle'); await sleep(700); r.menuOpen = await page.evaluate(() => !document.getElementById('menu').hidden && document.getElementById('menuToggle').getAttribute('aria-expanded')); await page.screenshot({ path: `tests/screens/landing-${tag}-menu.jpg`, type: 'jpeg', quality: 78 }); }
  r.errors = errors; out[tag] = r; await browser.close();
}
await run(1440, 900, 'desktop'); await run(390, 844, 'mobile');
// reduced motion: words are lit at once, nothing drifts
{ const { chromium } = await import('playwright-core'); const b = await chromium.launch({ channel: 'chrome', headless: false }); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }); const p = await ctx.newPage(); await p.goto((process.env.BASE || 'http://localhost:5183') + '/index.html'); await sleep(3000);
  out.reduced = await p.evaluate(() => ({ wordsOn: document.querySelectorAll('.w.on').length, words: document.querySelectorAll('.w').length, year: document.getElementById('heroYear').textContent })); await sleep(1500); out.reduced.yearLater = await p.evaluate(() => document.getElementById('heroYear').textContent); await b.close(); }
fs.writeFileSync('tests/results/landing.json', JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
