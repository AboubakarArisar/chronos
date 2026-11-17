// One search box for years, realms, events, cities and stories. Fuzzy, keyboard driven.
import { fmtYear } from '../globe/geo.js';
import { parseYear } from '../time/timeline.js';
import { TYPE_LABEL } from '../map/events.js';

export const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
function lev(a, b, max) { // edit distance with early exit
  if (Math.abs(a.length - b.length) > max) return max + 1; let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { const cur = [i]; let best = i; for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); best = Math.min(best, cur[j]); } if (best > max) return max + 1; prev = cur; }
  return prev[b.length];
}
// score a normalised name against a normalised query: exact > prefix > word prefix > substring > typo
export function matchScore(n, q) {
  if (n === q) return 100; if (n.startsWith(q)) return 80 - Math.min(15, (n.length - q.length) * .4);
  const i = n.indexOf(' ' + q); if (i >= 0) return 62 - Math.min(10, i * .2);
  if (q.length >= 3 && n.includes(q)) return 42;
  if (q.length >= 4) { const max = q.length >= 7 ? 2 : 1; for (const w of n.split(' ')) { if (Math.abs(w.length - q.length) <= max && lev(w, q, max) <= max) return 30; if (w.length > q.length && lev(w.slice(0, q.length), q, max) <= max) return 24; } if (!q.includes(' ')) return 0; if (lev(n.slice(0, q.length), q, max) <= max) return 26; }
  return 0;
}

export default async function search(app) {
  const $ = app.$, box = $('searchbox'), input = $('q'), out = $('results');
  let index = null, results = [], cur = 0;
  function build() {
    if (index) return index; index = [];
    const regions = app.regions || {}, areas = app.areas || {};
    for (const [name, r] of Object.entries(regions)) index.push({ k: 'Realm', n: norm(name), name, sub: r[1].length > 1 ? `${fmtYear(r[1][0])} to ${fmtYear(r[1].at(-1))}` : fmtYear(r[1][0]), w: Math.min(14, r[1].length) + (r[0] === 0 ? 4 : 0), years: r[1], sel: { name } });
    for (const [key, series] of Object.entries(areas)) if (!regions[key]) index.push({ k: 'Realm', n: norm(key), name: key, sub: `${fmtYear(series[0][0])} to ${fmtYear(series.at(-1)[0])}`, w: Math.min(14, series.length) + 6, years: series.map(s => s[0]), sel: { group: key } });
    for (const e of app.events.rows) index.push({ k: e.type === 'city' ? 'City' : 'Event', n: norm(e.name), name: e.name, sub: e.type === 'city' ? 'founded ' + fmtYear(e.year) : `${TYPE_LABEL[e.icon]}, ${fmtYear(e.year)}`, w: Math.min(16, e.fame / 8), ev: e });
    for (const t of app.tours?.list || []) index.push({ k: 'Story', n: norm(t.title + ' ' + t.subtitle), name: t.title, sub: t.subtitle, w: 20, tour: t.id });
    return index;
  }
  function query(text) {
    const res = [], q = norm(text); if (!q) return res;
    const y = parseYear(text);
    if (y !== null) { res.push({ k: 'Year', name: fmtYear(y, true), sub: 'Jump to this year', s: 1000, year: y }); if (app.events.loaded) for (const e of app.events.rows.filter(e => e.year === y).sort((a, b) => b.fame - a.fame).slice(0, 4)) res.push({ k: 'Event', name: e.name, sub: `${TYPE_LABEL[e.icon]}, ${fmtYear(e.year)}`, s: 500 + e.fame / 100, ev: e }); }
    for (const it of build()) { const s = matchScore(it.n, q); if (s > 0) res.push({ ...it, s: s + it.w }); }
    return res.sort((a, b) => b.s - a.s).slice(0, 12);
  }
  function render() {
    out.innerHTML = results.length ? results.map((r, i) => `<div class="res" role="option" id="res${i}" aria-selected="${i === cur}" data-i="${i}"><span class="k">${r.k}</span><span>${r.name.replace(/[<&]/g, c => c === '<' ? '&lt;' : '&amp;')}</span><small>${r.sub}</small></div>`).join('') : input.value.trim() ? '<div class="res none">Nothing found. Try a year like 1258, a realm, an event or a city.</div>' : '<div class="res none">Try: 1258, Baghdad, Battle of Hastings, Inca, Rome</div>';
    input.setAttribute('aria-activedescendant', results.length ? 'res' + cur : '');
    out.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' });
  }
  async function pick(r) {
    close(); const { timeline, globe, borders } = app;
    if (r.year !== undefined) { timeline.pause(); timeline.set(r.year, 'jump'); return; }
    if (r.tour) { app.tours.start(r.tour); return; }
    if (r.ev) { const e = r.ev; timeline.pause(); if (e.type === 'city') { if (timeline.state.year < e.year) timeline.set(e.year, 'jump'); app.selectEvent(e.id); globe.flyTo(e.lat, e.lon, Math.min(globe.cam.dist, 1.5), 1.8); } else app.selectEvent(e.id, { fly: true }); return; }
    if (r.sel) { // jump to the map nearest to now where the realm exists, then select it
      const now = timeline.state.year, snapNow = borders.snapshotYearFor(now);
      const target = r.years.includes(snapNow) ? null : r.years.reduce((a, b) => Math.abs(b - now) < Math.abs(a - now) ? b : a);
      timeline.pause(); if (target !== null) timeline.set(target, 'jump');
      const want = borders.snapshotYearFor(timeline.state.year); let tries = 0;
      const go = () => { if (borders.primary?.year === want && borders.primary.data) app.select(r.sel, { fly: true }); else if (tries++ < 160) setTimeout(go, 50); };
      go();
    }
  }
  function open() { if (!box.hidden) { input.focus(); return; } box.hidden = false; input.value = ''; results = []; cur = 0; render(); input.focus(); }
  function close() { if (box.hidden) return; box.hidden = true; input.blur(); }
  input.addEventListener('input', () => { results = query(input.value); cur = 0; render(); });
  input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'ArrowDown') { e.preventDefault(); cur = Math.min(results.length - 1, cur + 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cur = Math.max(0, cur - 1); render(); }
    else if (e.key === 'Enter') { if (results[cur]) pick(results[cur]); }
    else if (e.key === 'Escape') close();
  });
  out.addEventListener('pointerdown', e => { const el = e.target.closest('.res[data-i]'); if (el) { e.preventDefault(); pick(results[+el.dataset.i]); } });
  document.addEventListener('pointerdown', e => { if (!box.hidden && !box.contains(e.target) && !e.target.closest('[data-act=search]')) close(); });
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-controls', 'results'); input.setAttribute('aria-expanded', 'true');
  app.search = { open, close, query, pick, get isOpen() { return !box.hidden; } };
}
