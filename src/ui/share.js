// The URL hash holds year, camera, selection and tour step, so any view can be shared and reloads exactly.
export default async function share(app) {
  const { globe, timeline, borders } = app; let timer = 0, lastCam = '';
  const camStr = () => `${globe.cam.lat.toFixed(2)},${globe.cam.lon.toFixed(2)},${globe.cam.dist.toFixed(3)}`;
  function build() {
    const p = new URLSearchParams(); p.set('y', Math.round(timeline.state.year)); p.set('c', camStr());
    const s = borders.selection; if (s?.name != null) p.set('r', s.name); else if (s?.group != null) p.set('g', s.group);
    if (app.selectedEvent) p.set('e', app.selectedEvent.id);
    if (app.tours?.active) p.set('t', app.tours.active.id + '.' + app.tours.active.step);
    return '#' + p.toString().replace(/%2C/g, ',');
  }
  const url = () => location.origin + location.pathname + build();
  function touch() { if (!app.ready || app.recorder?.active) return; clearTimeout(timer); timer = setTimeout(() => { try { history.replaceState(null, '', build()); } catch { /* file: or sandboxed */ } }, 400); }
  function restore() {
    const h = location.hash.slice(1); if (!h) return null; const p = new URLSearchParams(h);
    const y = parseInt(p.get('y'), 10), c = (p.get('c') || '').split(',').map(Number);
    if (!Number.isFinite(y) && c.length !== 3) return null;
    if (Number.isFinite(y)) timeline.set(y, 'jump');
    if (c.length === 3 && c.every(Number.isFinite)) globe.setView(c[0], c[1], c[2]); else globe.setView(30, 20, 4.2);
    return { after() {
      const t = p.get('t'); if (t && app.tours) { const [id, step] = t.split('.'); app.tours.start(id, +step || 0, { auto: false, keepView: true }); return; }
      const sel = p.has('r') ? { name: p.get('r') } : p.has('g') ? { group: p.get('g') } : null; let tries = 0;
      const go = () => { if (borders.primary?.data) { if (sel && borders.featuresFor(borders.primary.data, sel).length) app.select(sel, { silent: true }); } else if (tries++ < 200) return setTimeout(go, 50); };
      if (sel) go();
      const e = p.get('e'); if (e) app.events.ready.then(() => { if (app.events.byId(e)) app.selectEvent(e); }).catch(() => {});
    } };
  }
  async function copy() {
    const u = url(); try { history.replaceState(null, '', build()); } catch { /* ignore */ }
    try { await navigator.clipboard.writeText(u); app.toast('Link to this view copied.'); }
    catch { const t = document.createElement('textarea'); t.value = u; document.body.appendChild(t); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch { /* ignore */ } t.remove(); app.toast(ok ? 'Link to this view copied.' : 'Copy the address from the address bar to share this view.'); }
  }
  let acc = 0;
  app.frameHooks.push(dt => { if ((acc += dt) < 1) return; acc = 0; const c = camStr(); if (c !== lastCam && !globe.flying && !globe.dragging) { lastCam = c; touch(); } });
  addEventListener('hashchange', () => { if (location.hash && location.hash !== build()) { app.tours?.exit(true); app.select(null, { silent: true }); app.selectEvent(null); restore()?.after(); } });
  app.share = { touch, restore, url, copy, build };
}
