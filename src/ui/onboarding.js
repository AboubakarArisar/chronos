// First visit: a short cinematic intro (the globe drifts in while the year counts up), then three coach marks.
import { fmtYear } from '../globe/geo.js';
import { eraName } from '../time/timeline.js';

export default async function onboarding(app) {
  const { $, globe, timeline, prefs } = app;
  function coach() {
    const steps = [['#timeline', 'Travel through time', 'Drag the timeline or press play. Borders change as the years pass.', 'above'], ['#c', 'Click any land', 'Click a region to read who ruled it, or a marker to open an event.', 'center'], ['#tools [data-act=record]', 'Make a clip', 'Record a clean map video in 16:9 or 9:16, with music and no watermark.', 'below']];
    const el = $('coach'); let i = 0; el.hidden = false;
    const done = () => { el.hidden = true; el.innerHTML = ''; app.askSound?.(); };
    const show = () => {
      const [sel, title, text, where] = steps[i], r = where === 'center' ? { left: innerWidth / 2 - 90, top: innerHeight / 2 - 90, width: 180, height: 180, right: innerWidth / 2 + 90, bottom: innerHeight / 2 + 90 } : document.querySelector(sel).getBoundingClientRect();
      el.innerHTML = `<div class="ring" style="left:${r.left - 6}px;top:${r.top - 6}px;width:${r.width + 12}px;height:${r.height + 12}px"></div><div class="tip frame" role="dialog" aria-label="${title}"><div class="strip"></div><h3>${title}</h3><p>${text}</p><div class="btns"><button class="btn ghost" id="cskip">Skip</button><button class="btn" id="cnext">${i === steps.length - 1 ? 'Start exploring' : 'Next'} (${i + 1}/3)</button></div></div>`;
      const tip = el.querySelector('.tip'), tw = 300, th = tip.offsetHeight;
      const x = Math.max(12, Math.min(innerWidth - tw - 12, r.left + r.width / 2 - tw / 2)), y = where === 'above' ? r.top - th - 22 : where === 'below' ? r.bottom + 22 : r.bottom + 18;
      tip.style.left = x + 'px'; tip.style.top = Math.max(12, Math.min(innerHeight - th - 12, y)) + 'px';
      el.querySelector('#cnext').onclick = () => { if (++i >= steps.length) done(); else show(); }; el.querySelector('#cskip').onclick = done; el.querySelector('#cnext').focus();
    };
    el.onkeydown = e => { if (e.key === 'Escape') { e.stopPropagation(); done(); } };
    show();
  }
  function playIntro(force = false) {
    if (!force && prefs.get('seenIntro', false)) return false; prefs.set('seenIntro', true);
    const targetYear = Math.round(timeline.state.year), view = { ...globe.cam };
    if (globe.reducedMotion) { coach(); return true; }
    document.body.classList.add('intro'); timeline.pause();
    const yel = document.createElement('div'); yel.id = 'introyear'; const skip = document.createElement('button'); skip.id = 'introskip'; skip.className = 'btn ghost'; skip.style.flex = 'none'; skip.style.padding = '9px 16px'; skip.textContent = 'Skip intro';
    document.body.append(yel, skip);
    globe.setView(view.lat - 12, view.lon - 70, 5.2); globe.cam.dist = 9; timeline.set(-3000, 'jump');
    globe.flyTo(view.lat, view.lon, view.dist, 6.5);
    let t = 0, ended = false; const dur = 6.2;
    const end = () => { if (ended) return; ended = true; app.frameHooks.splice(app.frameHooks.indexOf(hook), 1); timeline.set(targetYear, 'jump'); yel.remove(); skip.remove(); document.body.classList.remove('intro'); if (t < dur) globe.setView(view.lat, view.lon, view.dist); setTimeout(coach, 700); };
    const hook = dt => { t += dt; const k = Math.min(1, t / dur), e = 1 - Math.pow(1 - k, 2.2), y = Math.round(-3000 + (targetYear + 3000) * e); timeline.set(y, 'intro'); yel.innerHTML = `${fmtYear(y, true)}<small>${eraName(y)}</small>`; if (k >= 1) end(); };
    app.frameHooks.push(hook); skip.onclick = end; skip.focus();
    const key = e => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); removeEventListener('keydown', key, true); end(); } }; addEventListener('keydown', key, true);
    return true;
  }
  app.playIntro = playIntro;
  (app.onReady ??= []).push(() => { const deep = location.hash.length > 1; if (deep || !playIntro()) { if (!deep) app.askSound?.(); else setTimeout(() => app.askSound?.(), 1500); } });
}
