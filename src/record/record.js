// Creator mode: records the globe (WebGL canvas + label canvas + optional overlay) with the music mix
// into a clean clip with no watermark, and takes PNG screenshots at the same sizes.
import { fmtYear, wrapLon } from '../globe/geo.js';
import { eraName } from '../time/timeline.js';
import { capFont } from '../ui/skins.js';

const SIZES = { '16:9': [1920, 1080], '9:16': [1080, 1920] };
const MIMES = [['webm', 'video/webm;codecs=vp9,opus'], ['webm', 'video/webm;codecs=vp8,opus'], ['mp4', 'video/mp4;codecs=avc1.640028,mp4a.40.2'], ['mp4', 'video/mp4'], ['webm', 'video/webm']];
export const supportedFormats = () => typeof MediaRecorder === 'undefined' ? [] : MIMES.filter(([, m]) => MediaRecorder.isTypeSupported(m)).filter(([ext], i, a) => a.findIndex(x => x[0] === ext) === i);

export default async function record(app) {
  const { $, globe, timeline, skins, labels, prefs } = app;
  const opts = { aspect: '16:9', length: 20, camera: 'current', overlay: 'year', title: '', music: true, format: 'webm', tour: 'genghis', ...prefs.get('record', {}) };
  let active = null;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const glCanvas = $('c'), lblCanvas = $('overlay');

  function fit(w, h) { // show the fixed-size render letterboxed in the window
    for (const c of [glCanvas, lblCanvas]) { if (!w) { c.style.cssText = ''; continue; } const k = Math.min(innerWidth / w, innerHeight / h); c.style.width = w * k + 'px'; c.style.height = h * k + 'px'; c.style.left = (innerWidth - w * k) / 2 + 'px'; c.style.top = (innerHeight - h * k) / 2 + 'px'; c.style.inset = 'auto'; c.style.left = (innerWidth - w * k) / 2 + 'px'; c.style.top = (innerHeight - h * k) / 2 + 'px'; }
  }
  function enterStage(w, h) { document.body.classList.add('recording'); labels.setHideUI(true); fit(w, h); globe.resize(w, h, 1); }
  function leaveStage() { document.body.classList.remove('recording'); labels.setHideUI(false); fit(0); globe.resize(null); }
  function drawOverlay(g, w, h) {
    if (opts.overlay === 'none') return; const s = skins.spec, head = s.fonts.head, cap = capFont(s), body = s.fonts.body, u = Math.min(w, h) / 1080;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    const text = (str, x, y, font, fill, lw = 8) => { g.font = font; g.lineWidth = lw * u; g.strokeStyle = 'rgba(0,0,0,.72)'; g.strokeText(str, x, y); g.fillStyle = fill; g.fillText(str, x, y); };
    if (opts.overlay === 'year' || opts.overlay === 'title') {
      const y = h - 96 * u; g.letterSpacing = '0px';
      text(fmtYear(timeline.state.year, true), w / 2, y, `900 ${Math.round(92 * u)}px "${head}",serif`, '#f6dc94', 10);
      text(eraName(timeline.state.year), w / 2, y + 44 * u, `italic 400 ${Math.round(30 * u)}px "${body}",serif`, '#efe2bf', 6);
    }
    if (opts.overlay === 'title' && opts.title.trim()) {
      const lines = opts.title.trim().split(/\n/).slice(0, 2), size = Math.round(64 * u * (lines[0].length > 28 ? 28 / lines[0].length : 1));
      g.letterSpacing = Math.round(size * .08) + 'px';
      lines.forEach((ln, i) => text(ln.toUpperCase(), w / 2, 120 * u + i * size * 1.15, `700 ${size}px "${cap}",serif`, '#fff0c8', 10)); g.letterSpacing = '0px';
    }
  }
  function composite(g, w, h) { g.drawImage(glCanvas, 0, 0, w, h); g.drawImage(lblCanvas, 0, 0, w, h); drawOverlay(g, w, h); }

  async function countdown() { const el = document.createElement('div'); el.id = 'count'; document.body.appendChild(el); for (const n of [3, 2, 1]) { el.textContent = n; await new Promise(r => setTimeout(r, 650)); } el.remove(); }
  async function start() {
    if (active) return; const formats = supportedFormats();
    if (!formats.length || !HTMLCanvasElement.prototype.captureStream) { app.toast('This browser cannot record video. Try Chrome or Edge, or use Screenshot.'); return; }
    const [ext, mime] = formats.find(f => f[0] === opts.format) || formats[0], [w, h] = SIZES[opts.aspect];
    app.modal.close(); prefs.set('record', opts);
    const comp = document.createElement('canvas'); comp.width = w; comp.height = h; const g = comp.getContext('2d', { alpha: false });
    enterStage(w, h);
    await document.fonts.ready; await countdown();
    const stream = comp.captureStream(30);
    if (opts.music && app.audio) { app.audio.ensureOn(); const a = app.audio.recordStream(); a?.getAudioTracks().forEach(t => stream.addTrack(t)); }
    let rec; try { rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12e6, audioBitsPerSecond: 160e3 }); }
    catch { leaveStage(); app.toast('Recording could not start in this browser.'); return; }
    const chunks = []; rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const t0 = performance.now(); let hook;
    const state = { year0: Math.round(timeline.state.year), skin: skins.current };
    active = { rec, stop: () => { if (rec.state !== 'inactive') rec.stop(); } };
    $('recbar').hidden = false; $('recstop').focus();
    hook = dt => {
      if (opts.camera === 'orbit') globe.cam.lon = wrapLon(globe.cam.lon + 5 * dt);
      const secs = (performance.now() - t0) / 1000; $('rectime').textContent = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
      if (opts.length && secs >= opts.length) active?.stop();
    };
    app.frameHooks.push(hook);
    const afterIdx = app.afterLabels.push(() => composite(g, w, h)) - 1;
    if (opts.camera === 'timeline') timeline.play();
    if (opts.camera === 'tour') { app.tours?.start(opts.tour, 0, { auto: true }); if (app.tours) app.tours.onEnd = () => setTimeout(() => active?.stop(), 1500); }
    rec.onstop = () => {
      app.frameHooks.splice(app.frameHooks.indexOf(hook), 1); app.afterLabels[afterIdx] = () => {}; $('recbar').hidden = true; active = null;
      if (opts.camera === 'timeline') timeline.pause(); if (app.tours) app.tours.onEnd = null;
      stream.getTracks().forEach(t => { if (t.kind === 'video') t.stop(); }); leaveStage();
      const blob = new Blob(chunks, { type: mime.split(';')[0] }), url = URL.createObjectURL(blob), name = `chronos-${state.skin}-${fmtYear(state.year0).replace(/\s+/g, '').toLowerCase()}.${ext}`;
      app.lastRecording = { blob, url, name, mime, w, h };
      const body = app.modal.open(`<h2>Your clip is ready</h2><video class="recprev" src="${url}" controls playsinline></video><p>${w} × ${h}, ${(blob.size / 1e6).toFixed(1)} MB, ${ext.toUpperCase()}. No watermark. If you publish it, please credit Chronos and the data sources (see Credits).</p><div class="btns"><a class="btn" id="recdl" href="${url}" download="${esc(name)}">Download ${esc(name)}</a><button class="btn ghost" id="recagain">Record again</button></div>`, 'Recording finished');
      body.querySelector('#recagain').onclick = () => openPanel(); app.modal.onClose = () => setTimeout(() => URL.revokeObjectURL(url), 60000);
    };
    rec.start(500);
  }
  $('recstop').onclick = () => active?.stop();

  async function screenshot() {
    const [w, h] = SIZES[opts.aspect]; app.modal.close(); prefs.set('record', opts);
    enterStage(w, h); await document.fonts.ready; await new Promise(r => setTimeout(r, 350)); // let labels settle at the new size
    const comp = document.createElement('canvas'); comp.width = w; comp.height = h; const g = comp.getContext('2d', { alpha: false });
    await new Promise(res => { const i = app.afterLabels.push(() => { composite(g, w, h); app.afterLabels[i] = () => {}; res(); }) - 1; });
    leaveStage();
    comp.toBlob(blob => { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `chronos-${skins.current}-${fmtYear(timeline.state.year).replace(/\s+/g, '').toLowerCase()}.png`; document.body.appendChild(a); a.click(); a.remove(); app.lastScreenshot = { blob, w, h }; setTimeout(() => URL.revokeObjectURL(url), 30000); app.toast(`Screenshot saved, ${w} × ${h}.`); }, 'image/png');
  }

  function openPanel() {
    if (active) return; const formats = supportedFormats(), seg = (name, list) => `<div class="seg" data-o="${name}">${list.map(([v, l]) => `<button aria-pressed="${String(opts[name]) === String(v)}" data-v="${v}">${l}</button>`).join('')}</div>`;
    const body = app.modal.open(`<h2>Record a clip</h2><p>The interface is hidden while recording. The clip has no watermark.</p>
      <div class="set"><span>Shape</span>${seg('aspect', [['16:9', '16:9 · 1920×1080'], ['9:16', '9:16 · 1080×1920']])}</div>
      <div class="set"><span>Length</span>${seg('length', [[10, '10 s'], [20, '20 s'], [30, '30 s'], [60, '60 s'], [0, 'Until I stop']])}</div>
      <div class="set"><span>Camera</span>${seg('camera', [['current', 'This view'], ['orbit', 'Slow orbit'], ['timeline', 'Play time'], ['tour', 'A story']])}</div>
      <div class="set" id="rtourrow"><span>Story</span><select id="rtour" class="field">${(app.tours?.list || []).map(t => `<option value="${t.id}" ${t.id === opts.tour ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select></div>
      <div class="set"><span>Overlay</span>${seg('overlay', [['none', 'None'], ['year', 'Year'], ['title', 'Title + year']])}</div>
      <div class="set" id="rtitlerow"><label for="rtitle">Title text</label><input id="rtitle" class="field" type="text" maxlength="60" value="${esc(opts.title)}" placeholder="The Mongol conquests"></div>
      <label class="set"><span>Music in the clip</span><input type="checkbox" id="rmusic" ${opts.music ? 'checked' : ''}></label>
      ${formats.length > 1 ? `<div class="set"><span>Format</span>${seg('format', formats.map(([e]) => [e, e.toUpperCase()]))}</div>` : ''}
      ${formats.length ? '' : '<p class="weak">This browser cannot record video. Screenshots still work.</p>'}
      <div class="btns" style="margin-top:14px"><button class="btn" id="rgo" ${formats.length ? '' : 'disabled'}>Start recording</button><button class="btn ghost" id="rshot">Screenshot (PNG)</button></div>`, 'Record a clip');
    const sync = () => { body.querySelector('#rtitlerow').hidden = opts.overlay !== 'title'; body.querySelector('#rtourrow').hidden = opts.camera !== 'tour'; };
    body.querySelectorAll('.seg').forEach(sg => sg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const k = sg.dataset.o; opts[k] = k === 'length' ? +b.dataset.v : b.dataset.v; sg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); sync(); }));
    body.querySelector('#rtitle').oninput = e => { opts.title = e.target.value; }; body.querySelector('#rmusic').onchange = e => { opts.music = e.target.checked; };
    body.querySelector('#rtour').onchange = e => { opts.tour = e.target.value; };
    body.querySelector('#rgo').onclick = start; body.querySelector('#rshot').onclick = screenshot; sync();
  }
  addEventListener('resize', () => { if (active) { const [w, h] = SIZES[opts.aspect]; fit(w, h); } });
  app.recorder = { openPanel, start, stop: () => active?.stop(), screenshot, opts, get active() { return !!active; } };
}
