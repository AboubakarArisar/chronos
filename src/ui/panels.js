// Left realm panel, powers list and the right-hand event card.
import { fmtYear } from '../globe/geo.js';
import { TYPE_LABEL } from '../map/events.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KIND = ['State', 'Region', 'People'];
export const fmtArea = km2 => km2 >= 1e6 ? (km2 / 1e6).toFixed(km2 >= 1e7 ? 0 : 1) + ' million km²' : km2 >= 1000 ? Math.round(km2 / 1000) + ',000 km²' : Math.round(km2) + ' km²';
function shorten(text, max = 430) { if (!text || text.length <= max) return text || ''; const cut = text.slice(0, max), i = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.) ')); return i > 160 ? cut.slice(0, i + 1) : cut.replace(/\s+\S*$/, '') + '…'; }
const SKEL = '<span class="sk"></span><span class="sk"></span><span class="sk w70"></span><span class="sk w40"></span>';
const srcLine = url => `<div class="src">Text from <a href="${esc(url)}" target="_blank" rel="noopener">Wikipedia</a>, CC BY-SA 4.0</div>`;

export function createPanels(app) {
  const { borders, skins, timeline, wiki } = app;
  let regions = null, areas = null, token = 0, shown = null, ghosts = [], through = false;
  const index = Promise.all([fetch('d/regions.json').then(r => r.json()), fetch('d/areas.json').then(r => r.json())]).then(([r, a]) => { regions = r; areas = a; app.regions = r; app.areas = a; }).catch(() => {});
  const artFor = (skinId, n = 0) => { const list = skins.art(skinId); return list.length ? list[Math.abs(n) % list.length] : null; };
  const artHTML = a => a ? `<img class="wthumb" src="${esc(a.file)}" alt="${esc(a.title)}" title="${esc(a.title + (a.credit ? ', ' + a.credit : ''))}" style="object-position:${esc(a.focus || '50% 50%')}">` : '';
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };

  function setEmblem(skinId) { const src = skins.emblem(skinId) || skins.emblem(skins.current); $('emblem').innerHTML = src ? `<img src="${src}" alt="">` : ''; }
  function refreshDeco() { const html = skins.mottoHTML(skins.current); $('bdeco').innerHTML = html; $('bdeco').hidden = !html; if (!shown || shown.type === 'none') showNone(); else setEmblem(skins.current); }
  skins.on(refreshDeco);

  function clearGhosts() { for (const g of ghosts) borders.removeLines(g); ghosts = []; through = false; $('spark').hidden = true; $('bthrough').setAttribute('aria-pressed', 'false'); $('bthrough').textContent = 'Through time'; }
  function head(name, sub, stats) {
    $('bname').textContent = name; $('bsub').textContent = sub || ''; $('bsub').hidden = !sub;
    $('bstats').innerHTML = stats.map(([a, b]) => `<span>${esc(a)}</span><b>${esc(b)}</b>`).join('');
  }
  // nothing selected: the culture of the age, with a piece of its art
  function showNone() {
    shown = { type: 'none' }; token++; clearGhosts();
    const s = skins.spec, a = artFor(skins.current, Math.floor(timeline.state.year / 100));
    head(s.name === 'Chronos' ? 'The world' : s.name, 'Click any land to read about it', []);
    setEmblem(skins.current);
    $('bwiki').innerHTML = a ? `${artHTML(a)}<p class="weak">${esc(a.title)}${a.date ? ', ' + esc(a.date) : ''}</p>` : '';
    $('bbtns').hidden = true; $('bclose').hidden = true;
  }
  function showPlace(title, sub) { shown = { type: 'place' }; token++; clearGhosts(); head(title, sub, []); $('bwiki').innerHTML = ''; $('bbtns').hidden = true; $('bclose').hidden = false; setEmblem(skins.current); }

  async function showRealm(sel) {
    const snap = borders.primary; if (!snap?.data) return; await index;
    const d = snap.data, fs = borders.featuresFor(d, sel); if (!fs.length) { showNone(); return; }
    const my = ++token; clearGhosts();
    const isGroup = sel.name == null, name = isGroup ? sel.group : sel.name, f = fs[0], group = f.group, year = timeline.state.year;
    const area = fs.reduce((s, x) => s + x.a, 0), stats = [];
    if (!isGroup && group !== name) stats.push(['Ruled by', group]);
    if (isGroup && fs.length > 1) stats.push(['Lands', fs.length + ' regions']);
    stats.push(['Kind', isGroup ? 'Power' : f.colony ? 'Colony' : KIND[f.k]]);
    const yrs = isGroup ? (areas?.[group] || []).map(a => a[0]) : regions?.[name]?.[1] || [];
    if (yrs.length) stats.push(['On maps', yrs.length > 1 ? `${fmtYear(yrs[0])} to ${fmtYear(yrs.at(-1))}` : fmtYear(yrs[0])]);
    if (area) stats.push(['Area', 'about ' + fmtArea(area)]);
    if (!isGroup && f.po && f.po !== name) stats.push(['Part of', f.po]);
    head(name, f.p === 1 ? 'approximate borders' : '', stats);
    shown = { type: 'realm', sel, name, group };
    const skinId = skins.matchName([name, group], year) || skins.current; setEmblem(skinId);
    $('bbtns').hidden = false; $('bclose').hidden = false; $('bread').hidden = true; $('bwiki').innerHTML = SKEL;
    $('bthrough').hidden = yrs.length < 2;
    try {
      const r = await wiki.resolveRegion({ name, year, kind: isGroup ? 0 : f.k, wikiSearch: regions?.[name]?.[3] });
      if (my !== token) return;
      if (!r) { $('bwiki').innerHTML = `${artHTML(artFor(skinId, hash(name)))}<p class="weak">No Wikipedia article was found for this name. The dataset uses its own names for some regions.</p>`; return; }
      $('bwiki').innerHTML = `${r.thumb ? `<img class="wthumb" src="${esc(r.thumb)}" alt="">` : ''}${r.match === 'weak' ? `<p class="weak">Possible match: ${esc(r.title)}</p>` : r.title !== name ? `<p class="weak">${esc(r.title)}</p>` : ''}<p>${esc(shorten(r.extract))}</p>${srcLine(r.url)}`;
      $('bread').href = r.url; $('bread').hidden = false;
    } catch {
      if (my !== token) return;
      $('bwiki').innerHTML = `${artHTML(artFor(skinId, hash(name)))}<p class="weak">${navigator.onLine === false ? 'You are offline. ' : ''}The full article needs a connection to Wikipedia. The facts above come from the map data.</p>`;
    }
  }
  // "Through time": ghost outlines of the realm in every map where it exists + area sparkline
  async function toggleThrough() {
    if (through) { clearGhosts(); return; }
    if (shown?.type !== 'realm') return; const { sel, name, group } = shown, my = token, key = sel.name == null ? group : name;
    const series = areas?.[key] || []; if (!series.length) return;
    through = true; $('bthrough').setAttribute('aria-pressed', 'true'); $('bthrough').textContent = 'Hide outlines';
    const max = Math.max(...series.map(s => s[1])) || 1, w = 270, h = 46, x = i => series.length > 1 ? 4 + i / (series.length - 1) * (w - 8) : w / 2, y = v => h - 4 - v / max * (h - 10);
    $('spark').hidden = false;
    $('spark').innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Area of ${esc(key)} over time"><polyline fill="none" stroke="var(--hi)" stroke-width="1.6" points="${series.map((s, i) => x(i) + ',' + y(s[1])).join(' ')}"/>${series.map((s, i) => `<circle tabindex="0" role="button" aria-label="Jump to ${fmtYear(s[0])}" data-y="${s[0]}" cx="${x(i)}" cy="${y(s[1])}" r="4.5" fill="var(--panel)" stroke="var(--hi)" stroke-width="1.6" style="cursor:pointer"><title>${fmtYear(s[0])}: ${fmtArea(s[1])}</title></circle>`).join('')}</svg><div class="lab"><span>${fmtYear(series[0][0])}</span><span>area over time</span><span>${fmtYear(series.at(-1)[0])}</span></div>`;
    $('spark').querySelectorAll('circle').forEach(c => { const go = () => { timeline.pause(); timeline.set(+c.dataset.y, 'jump'); }; c.onclick = go; c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; });
    for (let i = 0; i < series.length; i++) {
      const yr = series[i][0]; let s; try { s = await borders.load(yr); } catch { continue; }
      if (my !== token || !through) return;
      const fs = borders.featuresFor(s.data, sel.name == null ? { group } : { name }); if (!fs.length) continue;
      const t = series.length > 1 ? i / (series.length - 1) : 1, paths = []; for (const f of fs) for (const r of s.data.pickRings[f.i]) paths.push(r);
      const col = `#${[255, Math.round(150 + 90 * t), Math.round(90 + 110 * t)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
      ghosts.push(borders.addLines(paths, { style: 4, color: col }));
    }
  }
  $('bthrough').onclick = toggleThrough; $('bclose').onclick = () => app.select(null);

  // ---- powers of the age
  function renderPowers() {
    const snap = borders.primary; if (!snap?.data) return; const sel = borders.selection, list = snap.data.powers.slice(0, 8);
    const selGroup = sel ? (sel.group ?? snap.data.byName.get(sel.name)?.[0]?.group) : null;
    $('rlist').innerHTML = list.map(g => `<button class="realm${g.key === selGroup ? ' on' : ''}" role="listitem" data-g="${esc(g.key)}"><span class="sw" style="background:${g.color}"></span><span class="n">${esc(g.key)}</span><span class="s">${g.area >= 1e5 ? (g.area / 1e6).toFixed(1) + 'M km²' : ''}</span></button>`).join('');
    $('rlist').querySelectorAll('button').forEach(b => { b.onclick = () => app.select({ group: b.dataset.g }, { fly: true }); b.onmouseenter = () => borders.setHover({ group: b.dataset.g }); b.onmouseleave = () => borders.setHover(null); });
  }

  // ---- event card
  let evToken = 0;
  function hideEvent() { $('event').hidden = true; evToken++; }
  function showEventList(list) {
    evToken++; $('event').hidden = false; $('etag').textContent = list.length + ' events here'; $('etitle').textContent = 'Choose an event'; $('ewhen').textContent = ''; $('eart').hidden = true; $('ecap').textContent = '';
    $('etext').innerHTML = `<div class="evlist">${list.slice(0, 12).map(e => `<button data-id="${e.id}">${esc(e.name)} <small>${TYPE_LABEL[e.icon]}, ${fmtYear(e.year)}</small></button>`).join('')}</div>`;
    $('etext').querySelectorAll('button').forEach(b => b.onclick = () => app.selectEvent(b.dataset.id));
    $('efly').hidden = true; $('eread').hidden = true;
  }
  async function showEvent(e) {
    const my = ++evToken; $('event').hidden = false;
    $('etag').textContent = TYPE_LABEL[e.icon] || 'Event'; $('etitle').textContent = e.name;
    const snap = borders.get(borders.snapshotYearFor(e.year)) || borders.primary, at = snap?.data && snap.year === borders.snapshotYearFor(e.year) ? borders.pick(e.lat, e.lon, snap)?.feature : null;
    $('ewhen').textContent = fmtYear(e.year) + (at ? ' · ' + (at.group !== at.n ? `${at.n}, ${at.group}` : at.n) : '');
    $('eart').hidden = true; $('ecap').textContent = '';
    const parts = e.participants?.length ? `<p class="parts">Between ${esc(e.participants.join(', '))}</p>` : '';
    $('etext').innerHTML = parts + SKEL; $('efly').hidden = false; $('eread').hidden = false; $('eread').href = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(e.wiki);
    $('efly').onclick = () => { timeline.pause(); timeline.set(e.year, 'jump'); app.globe.flyTo(e.lat, e.lon, Math.min(app.globe.cam.dist, 1.5), 1.6); };
    const localArt = () => { const a = artFor(skins.current, hash(e.name)); if (a) { $('eart').hidden = false; $('eart').style.setProperty('--art', `url("${a.file}")`); $('eart').style.backgroundPosition = (a.focus || '50% 50%') + ',0 0'; $('ecap').textContent = a.title + (a.credit ? ', ' + a.credit : ''); } };
    try {
      const r = await wiki.eventSummary(e.wiki); if (my !== evToken) return;
      if (!r) { localArt(); $('etext').innerHTML = parts + '<p class="weak">No summary is available for this event.</p>'; return; }
      if (r.thumb) { $('eart').hidden = false; $('eart').style.setProperty('--art', `url("${r.thumb}")`); $('eart').style.backgroundPosition = '50% 30%,0 0'; $('ecap').textContent = 'Image from Wikipedia'; } else localArt();
      $('etext').innerHTML = `${parts}<p>${esc(shorten(r.extract, 380))}</p>${srcLine(r.url)}`; $('eread').href = r.url;
    } catch { if (my !== evToken) return; localArt(); $('etext').innerHTML = parts + `<p class="weak">${navigator.onLine === false ? 'You are offline. ' : ''}The full article needs a connection to Wikipedia.</p>`; }
  }
  $('eclose').onclick = () => app.selectEvent(null);
  return { showRealm, showNone, showPlace, renderPowers, showEvent, showEventList, hideEvent, refreshDeco, index, get shown() { return shown; }, get through() { return through; } };
}
