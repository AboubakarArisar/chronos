// Guided story tours: each step sets the year, flies the camera, selects a realm, draws a route and narrates.
import { fmtYear } from '../globe/geo.js';
const files = import.meta.glob('../tours/*.json', { eager: true });
const ORDER = ['genghis', 'rome', 'alexander', 'golden-age', 'silk-road', 'first-states', 'exploration', 'end-of-empires', 'mughals', 'mansa-musa'];

export default async function tours(app) {
  const { $, globe, timeline, borders, skins } = app;
  const list = Object.values(files).map(m => m.default || m).sort((a, b) => (ORDER.indexOf(a.id) + 99) % 99 - (ORDER.indexOf(b.id) + 99) % 99);
  let active = null, route = null, routeT = 0, timer = 0, auto = true, yearTween = null, token = 0, dwell = 0, elapsed = 0;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clearRoute = () => { if (route) { borders.removeLines(route); route = null; } };

  function show(i, { keepView = false } = {}) {
    const t = active.tour, s = t.steps[i], my = ++token; active.step = i; elapsed = 0;
    $('tour').hidden = false; app.selectEvent(null);
    $('ttag').textContent = `${t.title} · ${i + 1} of ${t.steps.length}`; $('ttitle').textContent = s.title; $('twhen').textContent = fmtYear(s.year);
    $('ttext').textContent = s.text; $('tart').hidden = !s.art;
    if (s.art) { $('tart').style.setProperty('--art', `url("${s.art}")`); const meta = Object.values(skins.data.art).flat().find(a => a.file === s.art); $('tart').style.backgroundPosition = (meta?.focus || '50% 35%') + ',0 0'; $('tcap').textContent = (s.artCaption || meta?.title || '') + (meta?.credit ? ', ' + meta.credit : ''); } else $('tcap').textContent = '';
    $('tbar').style.width = (i + 1) / t.steps.length * 100 + '%';
    $('tback').disabled = i === 0; $('tnext').textContent = i === t.steps.length - 1 ? 'Finish' : 'Next';
    dwell = Math.max(10, s.text.split(/\s+/).length * .42 + 4);
    // year: glide there so the borders change on the way
    timeline.pause(); const from = timeline.state.year; yearTween = Math.abs(from - s.year) < 1 || globe.reducedMotion ? null : { from, to: s.year, t: 0, dur: Math.min(2.4, .8 + Math.abs(from - s.year) / 400) };
    if (!yearTween) timeline.set(s.year, 'tour');
    if (!keepView) globe.flyTo(s.lat, s.lon, s.dist, 2.4);
    clearRoute(); borders.select(null);
    const want = borders.snapshotYearFor(s.year); let tries = 0;
    const whenMap = () => {
      if (my !== token) return;
      if (borders.primary?.year !== want || !borders.primary.data || yearTween) { if (tries++ < 200) setTimeout(whenMap, 50); return; }
      const d = borders.primary.data;
      if (s.realm) { const sel = d.groupIds.has(s.realm) ? { group: s.realm } : d.byName.has(s.realm) ? { name: s.realm } : null; app.select(sel, { silent: true }); } else app.select(null, { silent: true });
      if (s.route?.length > 1) { route = borders.addLines([borders.routePath(s.route)], { style: 5, closed: false }); routeT = 0; route.material.uniforms.uReveal.value = 0; }
    };
    whenMap(); app.share?.touch(); updatePause();
  }
  function updatePause() { $('tpause').textContent = auto ? 'Pause' : 'Resume'; $('tpause').setAttribute('aria-pressed', String(!auto)); }
  function start(id, step = 0, opts = {}) {
    const tour = list.find(t => t.id === id); if (!tour) return false;
    if (active) exit(true); app.modal.close(); app.search?.close();
    active = { id, tour, step: 0 }; auto = opts.auto !== false; skins.force(tour.skin);
    document.body.classList.add('touring'); show(Math.max(0, Math.min(tour.steps.length - 1, step)), opts); return true;
  }
  function exit(silent = false) {
    if (!active) return; active = null; token++; clearRoute(); yearTween = null; skins.force(null); $('tour').hidden = true; document.body.classList.remove('touring');
    if (!silent) { app.select(null, { silent: true }); app.share?.touch(); }
    app.tours.onEnd?.();
  }
  const next = () => { if (!active) return; if (active.step >= active.tour.steps.length - 1) { const t = active.tour.title; exit(); app.toast(`End of "${t}". Keep exploring, or pick another story.`); } else show(active.step + 1); };
  const back = () => { if (active && active.step > 0) show(active.step - 1); };
  $('tnext').onclick = next; $('tback').onclick = back; $('texit').onclick = () => exit();
  $('tpause').onclick = () => { auto = !auto; if (auto && active) { const s = active.tour.steps[active.step]; globe.flyTo(s.lat, s.lon, s.dist, 1.6); elapsed = Math.min(elapsed, dwell - 4); } updatePause(); };
  // exploring mid-tour pauses the story; Resume flies back
  $('c').addEventListener('pointerdown', () => { if (active && auto && !app.recorder?.active) { auto = false; updatePause(); } });
  $('c').addEventListener('wheel', () => { if (active && auto && !app.recorder?.active) { auto = false; updatePause(); } }, { passive: true });

  app.frameHooks.push(dt => {
    if (!active) return;
    if (yearTween) { yearTween.t = Math.min(1, yearTween.t + dt / yearTween.dur); const k = yearTween.t, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; timeline.set(Math.round(yearTween.from + (yearTween.to - yearTween.from) * e), 'tour'); if (k >= 1) yearTween = null; }
    if (route) { routeT += dt; route.material.uniforms.uReveal.value = route.userData.length * Math.min(1, Math.max(0, (routeT - 1.2) / 3)); }
    if (auto) { elapsed += dt; if (elapsed >= dwell) next(); }
  });

  function openList() {
    const body = app.modal.open(`<h2>Story tours</h2><p>Guided stories told step by step on the globe. You can explore at any moment and then resume.</p><div class="tourlist">${list.map(t => { const art = t.steps.find(s => s.art)?.art; return `<button data-id="${t.id}"><span class="th" style="${art ? `background-image:url('${art}')` : ''}"></span><span><b>${esc(t.title)}</b><span>${esc(t.subtitle)} · ${t.steps.length} steps</span></span></button>`; }).join('')}</div>`, 'Story tours');
    body.querySelectorAll('button[data-id]').forEach(b => b.onclick = () => start(b.dataset.id));
  }
  app.tours = { list, start, exit, next, back, openList, get active() { return active; }, get auto() { return auto; }, setAuto(v) { auto = v; updatePause(); }, set dwellScale(v) { dwell *= v; } };
}
