// Settings, keyboard shortcuts, the in-app Credits panel, toolbar actions and global keys.
export default async function settings(app) {
  const { $, prefs, globe, labels, skins, borders } = app;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const seg = (name, opts, cur) => `<div class="seg" role="group" data-seg="${name}">${opts.map(([v, l]) => `<button aria-pressed="${v === cur}" data-v="${v}">${l}</button>`).join('')}</div>`;
  // apply stored settings
  globe.setRealSun(prefs.get('realSun', false)); skins.setEnabled(prefs.get('skins', true)); app.events.setEnabled(prefs.get('markers', true));
  const lineW = () => { borders.setLineWidth(globe.quality === 'low' ? .85 : 1); labels.setDensity(globe.quality === 'low' ? 'low' : prefs.get('labels', 'medium')); }; lineW(); globe.onQuality = lineW;

  function openSettings() {
    const body = app.modal.open(`<h2>Settings</h2>
      <div class="set"><span>Quality</span>${seg('quality', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], globe.quality)}</div>
      <div class="set"><span>Labels</span>${seg('labels', [['low', 'Few'], ['medium', 'Normal'], ['high', 'Many']], prefs.get('labels', 'medium'))}</div>
      <label class="set"><span>Music volume</span><input type="range" id="svol" min="0" max="1" step="0.01" value="${app.audio?.volume ?? .6}"></label>
      <label class="set"><span>Music</span><input type="checkbox" id="smusic" ${app.audio && !app.audio.muted ? 'checked' : ''}></label>
      <label class="set"><span>Culture skins</span><input type="checkbox" id="sskins" ${prefs.get('skins', true) ? 'checked' : ''}></label>
      <label class="set"><span>Event markers</span><input type="checkbox" id="smarkers" ${prefs.get('markers', true) ? 'checked' : ''}></label>
      <label class="set"><span>Real day and night (now)</span><input type="checkbox" id="ssun" ${prefs.get('realSun', false) ? 'checked' : ''}></label>
      <label class="set"><span>Reduced motion</span><input type="checkbox" id="sreduced" ${document.body.classList.contains('reduced') ? 'checked' : ''}></label>
      <div class="set"><span>Introduction</span><button class="btn ghost" id="sintro" style="flex:none;padding:7px 12px">Play again</button></div>
      <p class="src" style="margin-top:12px">Chronos is free and open source (GPL-3.0). No account, no tracking. <a href="credits.html" id="scredits">Credits and licenses</a> · <a href="privacy.html">Privacy</a> · <a href="index.html">About</a></p>`, 'Settings');
    body.querySelectorAll('.seg').forEach(g => g.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return; g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      if (g.dataset.seg === 'quality') { prefs.set('quality', b.dataset.v); prefs.set('qualityAuto', false); globe.setQuality(b.dataset.v); } else { prefs.set('labels', b.dataset.v); labels.setDensity(b.dataset.v); }
    }));
    body.querySelector('#svol').oninput = e => app.audio?.setVolume(+e.target.value);
    body.querySelector('#smusic').onchange = e => app.audio?.setMuted(!e.target.checked);
    body.querySelector('#sskins').onchange = e => { prefs.set('skins', e.target.checked); skins.setEnabled(e.target.checked); };
    body.querySelector('#smarkers').onchange = e => { prefs.set('markers', e.target.checked); app.events.setEnabled(e.target.checked); };
    body.querySelector('#ssun').onchange = e => { prefs.set('realSun', e.target.checked); globe.setRealSun(e.target.checked); };
    body.querySelector('#sreduced').onchange = e => { prefs.set('reduced', e.target.checked); document.body.classList.toggle('reduced', e.target.checked); globe.reducedMotion = e.target.checked; };
    body.querySelector('#sintro').onclick = () => { app.modal.close(); app.playIntro?.(true); };
    body.querySelector('#scredits').onclick = e => { e.preventDefault(); openCredits(); };
  }
  const KEYS = [['Space', 'Play or pause time'], ['[ and ]', 'Previous or next map year'], ['1 2 3 4', 'Speed: 1, 5, 20, 100 years per second'], ['Arrow keys', 'Rotate the globe'], ['+ and −', 'Zoom in or out'], ['Double click', 'Zoom to a point'], ['/', 'Search'], ['T', 'Story tours'], ['N and B', 'Next or previous step of a story'], ['R', 'Record a clip'], ['M', 'Music on or off'], ['L', 'Copy a link to this view'], ['Esc', 'Close a panel or clear the selection'], ['?', 'This sheet']];
  function openHelp() {
    app.modal.open(`<h2>Keyboard shortcuts</h2><div class="keys">${KEYS.map(([k, d]) => `<span>${k.split(' ').map(x => /^(and|or)$/.test(x) ? x : `<kbd>${x}</kbd>`).join(' ')}</span><span>${d}</span>`).join('')}</div>
      <h3>How it works</h3><p>Drag the timeline or press play. Click any land to read about it, click a marker for an event, and open Stories for a guided tour. Record makes a clean clip for your videos.</p>`, 'Keyboard shortcuts');
  }
  async function openCredits(section) {
    const body = app.modal.open('<h2>Credits and licenses</h2><span class="sk"></span><span class="sk w70"></span><span class="sk w40"></span>', 'Credits');
    try {
      const c = await fetch('d/credits.json').then(r => r.json()); if (!app.modal.isOpen) return;
      const link = (u, t) => u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>` : esc(t);
      body.innerHTML = `<h2>Credits and licenses</h2><p>Chronos is free and open source under GPL-3.0. Borders are approximate, some are disputed, and the app always shows which map year is on screen.</p>
        <h3>Data and software</h3><ul>${c.datasets.map(d => `<li><b>${esc(d.name)}</b>: ${esc(d.what)}. ${link(d.url, d.by)}. ${esc(d.license)}.</li>`).join('')}</ul>
        <h3 id="cr-music">Music</h3>${Object.entries(c.music).map(([id, l]) => `<p><b>${esc(skins.skins[id]?.name || id)}</b></p><ul>${l.length ? l.map(m => `<li>${link(m.source_page, m.title)}, ${esc(m.performer_or_author)}. ${link(m.license_url, m.license)}.</li>`).join('') : '<li>Generated in your browser in this culture\'s scale. No recording used.</li>'}</ul>`).join('')}
        <h3 id="cr-art">Artwork</h3>${Object.entries(c.art).filter(([, l]) => l.length).map(([id, l]) => `<p><b>${esc(skins.skins[id]?.name || id)}</b></p><ul>${l.map(a => `<li>${link(a.source_page, a.title)}${a.credit ? ', ' + esc(a.credit) : ''}. ${esc(a.license)}.</li>`).join('')}</ul>`).join('')}`;
      if (section) body.querySelector('#cr-' + section)?.scrollIntoView();
    } catch { body.innerHTML = '<h2>Credits and licenses</h2><p>The credits could not be loaded. They are also in CREDITS.md and on the <a href="credits.html">credits page</a>.</p>'; }
  }
  app.openCredits = openCredits; app.openSettings = openSettings; app.openHelp = openHelp;

  // ---- toolbar
  const acts = { search: () => app.search?.isOpen ? app.search.close() : app.search?.open(), tours: () => app.tours?.openList(), record: () => app.recorder?.openPanel(), link: () => app.share?.copy(), sound: () => app.audio?.toggle(), settings: openSettings, help: openHelp };
  $('tools').addEventListener('click', e => { const b = e.target.closest('button[data-act]'); if (b) acts[b.dataset.act]?.(); });

  // ---- keys
  addEventListener('keydown', e => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = document.activeElement?.tagName, typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (e.key === 'Escape') { if (app.recorder?.active) app.recorder.stop(); else if (app.modal.isOpen) app.modal.close(); else if (app.search?.isOpen) app.search.close(); else if (app.selectedEvent) app.selectEvent(null); else if (app.tours?.active) app.tours.exit(); else app.select(null); return; }
    if (typing || app.modal.isOpen || app.recorder?.active || document.body.classList.contains('intro')) return;
    const onButton = tag === 'BUTTON' || tag === 'A';
    const k = e.key, t = app.timeline;
    if (k === ' ' && !onButton) { e.preventDefault(); t.toggle(); }
    else if (k === '[') t.stepMap(-1); else if (k === ']') t.stepMap(1);
    else if ('1234'.includes(k)) t.setSpeed([1, 5, 20, 100][+k - 1]);
    else if (k === 'ArrowLeft') { e.preventDefault(); globe.nudge(0, -1); } else if (k === 'ArrowRight') { e.preventDefault(); globe.nudge(0, 1); }
    else if (k === 'ArrowUp') { e.preventDefault(); globe.nudge(1, 0); } else if (k === 'ArrowDown') { e.preventDefault(); globe.nudge(-1, 0); }
    else if (k === '+' || k === '=') globe.zoomBy(.8); else if (k === '-' || k === '_') globe.zoomBy(1.25);
    else if (k === '/') { e.preventDefault(); app.search?.open(); }
    else if (k === '?') openHelp();
    else if (k === 't' || k === 'T') app.tours?.openList();
    else if (k === 'n' || k === 'N') app.tours?.next(); else if (k === 'b' || k === 'B') app.tours?.back();
    else if (k === 'r' || k === 'R') app.recorder?.openPanel();
    else if (k === 'm' || k === 'M') app.audio?.toggle();
    else if (k === 'l' || k === 'L') app.share?.copy();
  });
}
