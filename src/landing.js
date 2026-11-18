// Landing page behaviour: icons, nav menu, scroll reveals, tagline word reveal, and the hero,
// which runs the real globe (same modules as the app) drifting slowly through time.
import { createGlobe } from './globe/globe.js';
import { createBorders } from './map/borders.js';
import { createLabels } from './map/labels.js';
import { pctYear, yearPct } from './time/timeline.js';
import { fmtYear, wrapLon } from './globe/geo.js';
import arrowRight from '@phosphor-icons/core/assets/regular/arrow-right.svg?raw';
import clock from '@phosphor-icons/core/assets/regular/clock-counter-clockwise.svg?raw';
import cursor from '@phosphor-icons/core/assets/regular/cursor-click.svg?raw';
import palette from '@phosphor-icons/core/assets/regular/palette.svg?raw';
import video from '@phosphor-icons/core/assets/regular/video-camera.svg?raw';
import check from '@phosphor-icons/core/assets/regular/check.svg?raw';
import caret from '@phosphor-icons/core/assets/regular/caret-down.svg?raw';

const ICONS = { 'arrow-right': arrowRight, 'clock-counter-clockwise': clock, 'cursor-click': cursor, palette, 'video-camera': video, check, 'caret-down': caret };
for (const el of document.querySelectorAll('.ic[data-ic]')) { el.innerHTML = ICONS[el.dataset.ic] || ''; el.setAttribute('aria-hidden', 'true'); }
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- nav menu
const toggle = document.getElementById('menuToggle'), menu = document.getElementById('menu');
function setMenu(open) {
  toggle.setAttribute('aria-expanded', String(open)); toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  if (open) { menu.hidden = false; requestAnimationFrame(() => menu.classList.add('open')); document.body.style.overflow = 'hidden'; }
  else { menu.classList.remove('open'); document.body.style.overflow = ''; setTimeout(() => { if (!menu.classList.contains('open')) menu.hidden = true; }, 320); }
}
toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

// ---- scroll reveals, once each
const io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }, { rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('.rise').forEach((el, i) => { el.style.transitionDelay = (i % 4) * 60 + 'ms'; io.observe(el); });

// ---- tagline: each word lights up as it crosses a trigger line (B11)
{
  const p = document.getElementById('tagline'), words = [];
  const wrap = node => { for (const n of [...node.childNodes]) { if (n.nodeType === 3) { const frag = document.createDocumentFragment(); n.textContent.split(/(\s+)/).forEach(t => { if (!t) return; if (/^\s+$/.test(t)) frag.append(t); else { const s = document.createElement('span'); s.className = 'w'; s.textContent = t; words.push(s); frag.append(s); } }); n.replaceWith(frag); } } };
  wrap(p);
  if (reduced) words.forEach(w => w.classList.add('on'));
  else {
    let batch = 0, last = 0;
    const wio = new IntersectionObserver(es => { const now = performance.now(); if (now - last > 400) batch = 0; last = now; for (const e of es.filter(e => e.isIntersecting).sort((a, b) => words.indexOf(a.target) - words.indexOf(b.target))) { e.target.style.transitionDelay = batch++ * 70 + 'ms'; e.target.classList.add('on'); wio.unobserve(e.target); } }, { rootMargin: '0px 0px -32% 0px' });
    words.forEach(w => wio.observe(w));
  }
}

// ---- hero globe
const KEYS = [[-3000, 28, 42], [-600, 36, 30], [100, 40, 16], [800, 32, 44], [1279, 40, 84], [1500, 22, -30], [1800, 38, -40], [2010, 28, 14]];
const SKIN_VIEW = { egypt: [26, 31, -1300], mesopotamia: [33, 44, -1800], indus: [27, 72, -500], china: [34, 108, 100], persia: [32, 53, -480], greece: [38, 24, -400], rome: [41, 14, 100], india_classical: [22, 79, 300], byzantine: [40, 29, 600], islamic: [33, 44, 800], norse: [60, 10, 900], medieval_europe: [48, 8, 1200], mongol: [46, 100, 1279], africa: [14, -2, 1300], mesoamerica: [19, -98, 1492], andes: [-13, -72, 1500], japan: [36, 138, 1650], ottoman: [39, 33, 1600], mughal: [27, 78, 1650], exploration: [38, -9, 1530], revolution: [48, 2, 1815], worldwars: [50, 12, 1938], modern: [30, 10, 2010], prehistory: [10, 20, -3000] };
async function hero() {
  const canvas = document.getElementById('globe'); let globe;
  try { globe = createGlobe(canvas, { quality: 'medium', interactive: false }); } catch { document.querySelector('.hero-globe').style.display = 'none'; return; }
  const borders = createBorders(globe, { maxMeshes: 4, maxData: 6 });
  const fonts = { head: 'Manrope', body: 'Manrope', cap: 'Manrope' };
  const labels = createLabels(globe, document.getElementById('glabels'), { getSnap: () => borders.primary, getSelection: () => null, getFonts: () => fonts, getCities: () => [] });
  labels.setDensity('low');
  const yearEl = document.getElementById('heroYear'), mapEl = document.getElementById('heroMap');
  let index; try { index = await borders.ready; } catch { return; }
  let pct = yearPct(1279), year = 1279, hold = 0, target = null, shownYear = null, shownMap = null;
  const camAt = y => { let a = KEYS[0], b = KEYS.at(-1); for (let i = 1; i < KEYS.length; i++) if (y <= KEYS[i][0]) { a = KEYS[i - 1]; b = KEYS[i]; break; } const t = Math.max(0, Math.min(1, (y - a[0]) / ((b[0] - a[0]) || 1))), e = t * t * (3 - 2 * t); return [a[1] + (b[1] - a[1]) * e, a[2] + wrapLon(b[2] - a[2]) * e]; };
  const dist = () => innerWidth < 760 ? 4.5 : 4.3;
  { const [la, lo] = camAt(year); globe.setView(la, lo, dist()); }
  globe.onFrame(dt => {
    let speed = 0;
    if (target) { hold -= dt; if (hold <= 0) target = null; }
    else if (!reduced) { const prev = year; pct += dt * 100 / 110; if (pct >= 100) pct = 0; year = pctYear(pct); speed = Math.abs(year - prev) / Math.max(dt, .001); const [la, lo] = camAt(year), c = globe.cam, k = Math.min(1, dt * .8); c.lat += (la - c.lat) * k; c.lon = wrapLon(c.lon + wrapLon(lo - c.lon) * k); c.dist += (dist() - c.dist) * k; }
    borders.setTime(year, !target && !reduced, speed); borders.update(dt);
    const y = Math.round(year); if (y !== shownYear) { shownYear = y; yearEl.textContent = fmtYear(y); }
    const m = borders.primary?.year; if (m !== undefined && m !== shownMap) { shownMap = m; mapEl.textContent = `Live globe. Borders: map of ${fmtYear(m, true)}`; }
  });
  globe.onAfterRender(dt => labels.draw(dt));
  await Promise.all([globe.ready, borders.load(borders.snapshotYearFor(year), true).catch(() => {})]);
  globe.start();
  new IntersectionObserver(es => { for (const e of es) e.isIntersecting ? globe.start() : globe.stop(); }).observe(document.querySelector('.hero'));
  document.addEventListener('visibilitychange', () => document.hidden ? globe.stop() : globe.start());
  window.chronosHero = { globe, borders };

  // ---- culture swatches send the globe to that culture's age
  try {
    const data = await fetch('d/skins.json').then(r => r.json()), box = document.getElementById('swatches'), note = document.getElementById('skinNote');
    for (const [id, s] of Object.entries(data.skins)) {
      const b = document.createElement('button'); b.className = 'swatch'; b.setAttribute('role', 'listitem'); b.setAttribute('aria-pressed', 'false');
      b.innerHTML = `<span class="chip" style="background:${s.accent}">${s.assets.emblem ? `<img src="${s.assets.emblem}" alt="">` : ''}</span><span class="title-4">${s.name}</span>`;
      const go = () => {
        const v = SKIN_VIEW[id]; if (!v) return; box.querySelectorAll('.swatch').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        year = v[2]; pct = yearPct(year); target = id; hold = 9; globe.flyTo(v[0], v[1], 3.4, reduced ? 0 : 1.8);
        document.documentElement.style.setProperty('--accent', s.panel_is_light ? s.metal[1] : s.hi);
        note.textContent = `${s.name}, around ${fmtYear(year)}. In the app: ${s.materials}.`;
      };
      b.addEventListener('click', () => { go(); if (innerWidth < 760) document.querySelector('.hero-globe').scrollIntoView({ block: 'center' }); });
      b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') go(); });
      box.appendChild(b);
    }
  } catch { /* the strip is an extra; the page works without it */ }
}
hero();
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
