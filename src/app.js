// Chronos app entry: wires the globe, borders, timeline, skins, labels, events and panels together.
import '@fontsource/cinzel/400.css'; import '@fontsource/cinzel/700.css'; import '@fontsource/cinzel/900.css';
import '@fontsource/alegreya/400.css'; import '@fontsource/alegreya/600.css'; import '@fontsource/alegreya/400-italic.css';
import { createGlobe, FOV } from './globe/globe.js';
import { fmtYear, oceanName, D2R } from './globe/geo.js';
import { createBorders } from './map/borders.js';
import { createLabels } from './map/labels.js';
import { createEvents, TYPE_LABEL } from './map/events.js';
import { createTimeline } from './time/timeline.js';
import { createSkins, capFont } from './ui/skins.js';
import { createPanels } from './ui/panels.js';
import { createWiki, browserFetchJson } from './data/wiki.js';
import { cacheGet, cacheSet, prefs } from './data/store.js';
import { features } from './features.js';

const $ = id => document.getElementById(id);
const app = { prefs, $ };
window.chronos = app; // handy for tests and the console

function toast(msg, ms = 2600) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), ms); }
app.toast = toast;
const loadMsg = (m, err) => { $('lmsg').textContent = m; $('lmsg').classList.toggle('err', !!err); };

// ---- modal
let modalReturn = null;
app.modal = {
  open(html, label) { modalReturn = document.activeElement; $('mbody').innerHTML = html; $('modalbox').setAttribute('aria-label', label || 'Dialog'); $('modal').hidden = false; ($('mbody').querySelector('button,input,select,a') || $('mclose')).focus(); return $('mbody'); },
  close() { if ($('modal').hidden) return; $('modal').hidden = true; $('mbody').innerHTML = ''; app.modal.onClose?.(); app.modal.onClose = null; modalReturn?.focus?.(); },
  get isOpen() { return !$('modal').hidden; }
};
$('mclose').onclick = app.modal.close; $('modal').addEventListener('pointerdown', e => { if (e.target === $('modal')) app.modal.close(); });
$('modal').addEventListener('keydown', e => { if (e.key !== 'Tab') return; const f = [...$('modalbox').querySelectorAll('button,input,select,a[href],[tabindex="0"]')].filter(x => !x.hidden && !x.disabled); if (!f.length) return; const first = f[0], last = f.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } });

async function boot() {
  const reduced = prefs.get('reduced', matchMedia('(prefers-reduced-motion: reduce)').matches);
  document.body.classList.toggle('reduced', reduced);
  let globe;
  try { globe = createGlobe($('c'), { quality: prefs.get('quality', 'medium'), onProgress: p => { $('lfill').style.width = Math.round(p * 70) + '%'; } }); }
  catch (e) { loadMsg('Your browser could not start WebGL. Try a recent Chrome, Edge or Firefox with hardware acceleration on.', true); throw e; }
  globe.reducedMotion = reduced; app.globe = globe;
  const borders = createBorders(globe); app.borders = borders;
  const wiki = createWiki({ fetchJson: browserFetchJson, cacheGet, cacheSet }); app.wiki = wiki;
  let skins, index;
  try { [skins, index] = await Promise.all([createSkins(), borders.ready]); }
  catch (e) { loadMsg('The map data did not load. Check your connection and reload the page.', true); throw e; }
  app.skins = skins;
  const timeline = createTimeline(index.years); app.timeline = timeline;
  const events = createEvents(); app.events = events; events.ready.catch(() => toast('Events could not be loaded. The map still works.'));
  const labels = createLabels(globe, $('overlay'), { getSnap: () => borders.primary, getSelection: () => borders.selection, getFonts: () => ({ ...skins.spec.fonts, cap: capFont(skins.spec) }), getCities: () => events.cities() });
  app.labels = labels; labels.setDensity(prefs.get('labels', 'medium'));
  labels.addDrawer(env => events.draw(env, timeline.state.year));
  const panels = createPanels(app); app.panels = panels;

  // ---- selection
  let selectedEvent = null;
  app.select = (sel, { fly = false, silent = false } = {}) => {
    borders.select(sel);
    if (!sel) panels.showNone(); else panels.showRealm(sel);
    panels.renderPowers();
    if (sel && fly && borders.primary?.data) {
      const fs = borders.featuresFor(borders.primary.data, sel); if (fs.length) {
        const big = fs.reduce((a, b) => b.a > a.a ? b : a), total = fs.reduce((s, f) => s + f.a, 0);
        globe.flyTo(big.l[0], big.l[1], Math.max(1.25, Math.min(3.6, 1.15 + Math.sqrt(total / 1e6) * .55)), 1.6);
      }
    }
    if (!silent) app.share?.touch();
  };
  app.selectEvent = (id, { fly = false } = {}) => {
    const e = id ? events.byId(id) : null; selectedEvent = e; events.select(e?.id || null);
    if (!e) panels.hideEvent(); else { panels.showEvent(e); if (fly) { timeline.pause(); timeline.set(e.year, 'jump'); globe.flyTo(e.lat, e.lon, Math.min(globe.cam.dist, 1.6), 1.6); } }
    app.share?.touch();
  };
  Object.defineProperty(app, 'selectedEvent', { get: () => selectedEvent });

  // ---- land or sea, for clicks outside every region
  let water = null;
  const waterImg = new Image(); waterImg.onload = () => { const c = document.createElement('canvas'); c.width = 720; c.height = 360; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(waterImg, 0, 0, 720, 360); water = g.getImageData(0, 0, 720, 360).data; }; waterImg.src = 'assets/earth/earth-water.png';
  const isWater = (lat, lon) => { if (!water) return true; const x = Math.min(719, Math.max(0, Math.floor((lon + 180) / 360 * 720))), y = Math.min(359, Math.max(0, Math.floor((90 - lat) / 180 * 360))); return water[(y * 720 + x) * 4] > 128; };
  app.describePoint = (lat, lon) => { const r = borders.pick(lat, lon); if (r?.feature) return { feature: r.feature }; if (r?.unclaimed || !isWater(lat, lon)) return { unclaimed: true }; return { ocean: oceanName(lat, lon) }; };

  // ---- pointer: hover tooltip, click to select
  const canvas = $('c'), tip = $('tooltip'); let hoverAt = 0, downAt = null;
  const local = e => { const r = canvas.getBoundingClientRect(), s = globe.size; return [(e.clientX - r.left) / r.width * s.w, (e.clientY - r.top) / r.height * s.h]; };
  canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; canvas.classList.add('drag'); tip.classList.remove('on'); });
  canvas.addEventListener('pointerup', () => canvas.classList.remove('drag'));
  canvas.addEventListener('pointerleave', () => { tip.classList.remove('on'); borders.setHover(null); });
  canvas.addEventListener('pointermove', e => {
    if (globe.dragging || e.pointerType === 'touch') return; const now = performance.now(); if (now - hoverAt < 40) return; hoverAt = now;
    const [x, y] = local(e), ev = events.hit(x, y); let html = '';
    if (ev) { html = ev.length > 1 ? `${ev.length} events<small>click to choose</small>` : `${ev[0].name}<small>${TYPE_LABEL[ev[0].icon]}, ${fmtYear(ev[0].year)}</small>`; borders.setHover(null); }
    else { const p = globe.pick(x, y), f = p && borders.pick(p.lat, p.lon)?.feature; if (f) { html = `${f.n}${f.group !== f.n ? `<small>ruled by ${f.group}</small>` : f.k === 2 ? '<small>people</small>' : ''}`; borders.setHover({ name: f.n }); } else borders.setHover(null); }
    canvas.classList.toggle('point', !!html);
    if (html) { tip.innerHTML = html.replace(/<(?!\/?small>)/g, '&lt;'); tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px'; tip.classList.add('on'); } else tip.classList.remove('on');
  });
  canvas.addEventListener('click', e => {
    if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    const [x, y] = local(e), ev = events.hit(x, y);
    if (ev) { if (ev.length > 1) { events.select(null); panels.showEventList(ev); } else app.selectEvent(ev[0].id); return; }
    const p = globe.pick(x, y); if (!p) { app.select(null); return; }
    const d = app.describePoint(p.lat, p.lon);
    if (d.feature) app.select({ name: d.feature.n });
    else { borders.select(null); panels.renderPowers(); if (d.ocean) panels.showPlace(d.ocean, 'Open water. No realm claims it on this map.'); else panels.showPlace('Unclaimed land', `No state or people is recorded here on the map of ${fmtYear(borders.primary?.year ?? timeline.state.year)}.`); app.share?.touch(); }
  });

  // ---- maps on screen
  let mapText = '';
  borders.on('primary', snap => {
    const sel = borders.selection;
    if (sel && !borders.featuresFor(snap.data, sel).length) { if (sel.name != null && snap.data.groupIds.has(sel.name)) app.select({ group: sel.name }, { silent: true }); else if (!app.tours?.active) app.select(null, { silent: true }); else { borders.select(null); panels.showNone(); } }
    else if (sel && panels.shown?.type === 'realm' && !timeline.state.playing) panels.showRealm(sel);
    panels.renderPowers(); if (!sel && panels.shown?.type === 'none') panels.showNone();
  });
  borders.on('loading', () => toast('A map did not load. Check your connection.'));
  timeline.on((s, why) => { if (why === 'pause' && borders.selection && panels.shown?.type === 'realm') panels.showRealm(borders.selection); if (why !== 'tick') app.share?.touch(); });
  timeline.onInvalid = () => toast('Type a year between 3000 BC and today, such as 1279 or 500 BC.');

  // ---- frame loop
  let skinTick = 0;
  globe.onFrame((dt, t) => {
    timeline.tick(dt);
    const s = timeline.state; borders.setTime(s.year, s.playing, s.speed); borders.update(dt);
    const viewDeg = Math.min(80, Math.max(8, Math.atan((globe.cam.dist - 1) * Math.tan(FOV * D2R / 2) * 1.9) / D2R * 3 + (globe.cam.dist > 2.2 ? 40 : 6)));
    events.recompute(s.year, globe.cam, viewDeg + 25, s.playing, s.speed, performance.now());
    timeline.render();
    const p = borders.primary, txt = p ? `Borders: map of ${fmtYear(p.year, true)}` : 'Loading the map';
    if (txt !== mapText) { mapText = txt; $('ymap').textContent = txt; }
    if ((skinTick += dt) > .2) { skinTick = 0; skins.consider({ year: s.year, selection: borders.selection, snap: p, cam: globe.cam, viewDeg: Math.min(60, viewDeg) }); }
    for (const f of app.frameHooks) f(dt, t);
  });
  app.frameHooks = []; app.afterLabels = [];
  globe.onAfterRender(dt => { labels.draw(dt); for (const f of app.afterLabels) f(); });

  // ---- features (search, tours, music, record, settings, share, onboarding)
  for (const f of features) { try { await f(app); } catch (e) { console.error('feature failed to start', e); } }

  // ---- first view
  const restored = app.share?.restore();
  if (!restored) { timeline.set(1279, 'jump'); globe.setView(38, 80, 4.2); }
  skins.apply(skins.decide({ year: timeline.state.year, selection: null, snap: null, cam: globe.cam, viewDeg: 50 }), true);
  borders.setTime(timeline.state.year, false);
  loadMsg('Loading the map of ' + fmtYear(borders.snapshotYearFor(timeline.state.year), true));
  await Promise.all([globe.ready, borders.load(borders.snapshotYearFor(timeline.state.year), true).catch(e => { loadMsg('The first map did not load. Check your connection and reload the page.', true); throw e; }), skins.loadFonts(skins.spec), panels.index]);
  $('lfill').style.width = '100%';
  globe.start(); panels.showNone();
  // quality: default by measured performance, and drop to Low if fps stays under 40
  let lowSince = 0, measured = prefs.get('qualityAuto', true);
  globe.onFps = f => {
    app.fps = f; if (!measured || document.hidden || app.recorder?.active) return;
    if (f.frames < 90) return;
    if (f.avg < 40 && globe.quality !== 'low') { lowSince += .5; if (lowSince >= 4) { lowSince = 0; globe.setQuality(globe.quality === 'high' ? 'medium' : 'low'); toast('Quality lowered to keep the globe smooth. You can change it in Settings.'); } } else lowSince = 0;
  };
  await new Promise(r => setTimeout(r, 250));
  document.body.classList.remove('booting'); $('loading').classList.add('out'); setTimeout(() => $('loading').remove(), 800);
  app.ready = true; app.onReady?.forEach(f => f());
  restored?.after?.();
}
boot().catch(e => { console.error(e); if (!$('lmsg').classList.contains('err')) loadMsg('Something went wrong while starting. Reload the page to try again.', true); });
