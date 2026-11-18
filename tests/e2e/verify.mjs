// Section 11 verification. Usage: node tests/e2e/verify.mjs [skins clicks tours record search share scrub soak]
// Needs the dev server (or BASE=http://localhost:4183 for the built dist). Results go to tests/results/verify.json.
import fs from 'node:fs';
import { open, sleep, BASE } from './lib.mjs';

const want = process.argv.slice(2); const all = ['skins', 'clicks', 'search', 'share', 'tours', 'record', 'scrub', 'soak'];
const todo = want.length ? want : all;
const resFile = 'tests/results/verify.json'; const results = fs.existsSync(resFile) ? JSON.parse(fs.readFileSync(resFile)) : {};
const save = () => fs.writeFileSync(resFile, JSON.stringify(results, null, 1));
const index = JSON.parse(fs.readFileSync('public/d/index.json')), skinData = JSON.parse(fs.readFileSync('public/d/skins.json'));
const rules = skinData.eras.skins.map(s => ({ ...s, re: new RegExp(s.match) }));
const matchName = (names, year) => { for (const n of names) { if (!n) continue; let best = null, len = 0; for (const r of rules) { if (year < r.years[0] || year > r.years[1]) continue; const m = r.re.exec(n); if (m && m[0].length > len) { best = r.id; len = m[0].length; } } if (best) return best; } return null; };
const snap = y => JSON.parse(fs.readFileSync(`public/d/b/${y}.json`));
const waitMap = (page, year) => page.waitForFunction(y => window.chronos.borders.primary?.year === window.chronos.borders.snapshotYearFor(y) && window.chronos.borders.primary.data, year, { timeout: 30000 });

// ---- contrast of each skin's text colours on its panel (WCAG)
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };

async function skins() {
  const out = {}; const { browser, page, errors } = await open('/app.html');
  for (const r of rules) {
    // the largest region in any map of this skin's years whose first matching rule is this skin
    let best = null;
    for (const y of index.years) { if (y < r.years[0] || y > r.years[1]) continue; for (const f of snap(y).f) { const g = f.s || f.n; if (f.k === 2 && r.id !== 'prehistory') continue; if (matchName([f.n, g], y) !== r.id) continue; if (!best || f.a > best.a) best = { y, n: f.n, a: f.a, l: f.l }; } }
    const s = skinData.skins[r.id], c = { ink: +contrast(s.ink, s.panel).toFixed(2), ink2: +contrast(s.ink2, s.panel).toFixed(2), hi: +contrast(s.hi, s.panel).toFixed(2) };
    if (!best) { out[r.id] = { error: 'no matching region in the data', contrast: c }; continue; }
    await page.evaluate(b => { const a = window.chronos; a.tours.exit(true); a.select(null); a.timeline.pause(); a.timeline.set(b.y, 'jump'); a.globe.setView(b.l[0], b.l[1], Math.max(1.5, Math.min(3.4, 1.2 + Math.sqrt(b.a / 1e6) * .55))); }, best);
    await waitMap(page, best.y); await page.evaluate(n => window.chronos.select({ name: n }), best.n);
    await sleep(4200);
    const got = await page.evaluate(() => ({ skin: window.chronos.skins.current, name: document.getElementById('bname').textContent, fonts: [...document.fonts].filter(f => f.status === 'loaded').length, motto: document.getElementById('bdeco').textContent.trim().slice(0, 40) }));
    await page.screenshot({ path: `tests/screens/skin-${r.id}.jpg`, type: 'jpeg', quality: 80 });
    out[r.id] = { year: best.y, realm: best.n, ...got, ok: got.skin === r.id, contrast: c, contrastOk: Math.min(c.ink, c.ink2, c.hi) >= 4.5 };
    console.log(r.id, JSON.stringify(out[r.id]));
  }
  await page.evaluate(() => { window.chronos.prefs.set('skins', false); window.chronos.skins.setEnabled(false); window.chronos.select(null); }); await sleep(3000);
  await page.screenshot({ path: 'tests/screens/skin-default.jpg', type: 'jpeg', quality: 80 });
  out.default = { skin: await page.evaluate(() => window.chronos.skins.current) }; await page.evaluate(() => window.chronos.prefs.set('skins', true));
  out.errors = errors; await browser.close(); results.skins = out; save();
}

// ---- 20 random land points in each of 10 map years, real mouse clicks, checked against the raw GeoJSON
function rawPip(lon, lat, geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  for (const poly of polys) for (const off of [0, 360, -360]) {
    let inside = false; const x = lon + off;
    for (const ring of poly) { let prev = null, o = 0; const u = ring.map(([lo, la]) => { if (prev !== null) { const d = lo + o - prev; if (d > 180) o -= 360; else if (d < -180) o += 360; } prev = lo + o; return [prev, la]; });
      for (let i = 0, j = u.length - 1; i < u.length; j = i++) if ((u[i][1] > lat) !== (u[j][1] > lat) && x < (u[j][0] - u[i][0]) * (lat - u[i][1]) / (u[j][1] - u[i][1]) + u[i][0]) inside = !inside; }
    if (inside) return true;
  }
  return false;
}
async function clicks() {
  let seed = 1234; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const years = [-3000, -323, 100, 800, 1279, 1492, 1650, 1815, 1914, 2010], out = { years: {}, total: 0, correct: 0, wrong: [] };
  const { browser, page, errors } = await open('/app.html');
  for (const y of years) {
    const file = `data/borders/world_${y < 0 ? 'bc' + -y : y}.geojson`, gj = JSON.parse(fs.readFileSync(file)), named = gj.features.filter(f => f.geometry && (f.properties.NAME || '').trim());
    await page.evaluate(y => { const a = window.chronos; a.select(null); a.timeline.pause(); a.timeline.set(y, 'jump'); }, y); await waitMap(page, y); await sleep(400);
    let ok = 0, n = 0, guard = 0;
    while (n < 20 && guard++ < 4000) {
      const f = named[Math.floor(rnd() * named.length)]; const flat = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).flat(2);
      const xs = flat.map(p => p[0]), ys = flat.map(p => p[1]), lon = Math.min(...xs) + rnd() * (Math.max(...xs) - Math.min(...xs)), lat = Math.min(...ys) + rnd() * (Math.max(...ys) - Math.min(...ys));
      if (Math.abs(lat) > 80 || Math.max(...xs) - Math.min(...xs) > 300 || !rawPip(lon, lat, f.geometry)) continue;
      const expected = named.filter(g => rawPip(lon, lat, g.geometry)).map(g => g.properties.NAME.trim());
      await page.evaluate(([la, lo]) => window.chronos.globe.setView(la, lo, 1.9), [lat, lon]); await sleep(120);
      await page.mouse.click(960, 540); await sleep(160);
      const got = await page.evaluate(() => document.getElementById('bname').textContent); n++;
      if (expected.includes(got)) ok++; else out.wrong.push({ y, lat: +lat.toFixed(3), lon: +lon.toFixed(3), expected, got });
    }
    out.years[y] = `${ok}/${n}`; out.total += n; out.correct += ok; console.log('clicks', y, ok + '/' + n);
  }
  // the sea and unclaimed land respond too
  await page.evaluate(() => window.chronos.globe.setView(-30, -20, 2.4)); await sleep(300); await page.mouse.click(960, 560); await sleep(300);
  out.ocean = await page.evaluate(() => [document.getElementById('bname').textContent, document.getElementById('bsub').textContent]);
  await page.evaluate(() => { window.chronos.timeline.set(-3000, 'jump'); window.chronos.globe.setView(-78, 30, 2.4); }); await waitMap(page, -3000); await sleep(500); await page.mouse.click(960, 560); await sleep(300);
  out.unclaimed = await page.evaluate(() => [document.getElementById('bname').textContent, document.getElementById('bsub').textContent]);
  out.errors = errors; await browser.close(); results.clicks = out; save(); console.log(JSON.stringify({ total: out.total, correct: out.correct, wrong: out.wrong.slice(0, 5), ocean: out.ocean, unclaimed: out.unclaimed }));
}

async function search() {
  const { browser, page, errors } = await open('/app.html'); const out = {};
  await page.evaluate(() => window.chronos.events.ready); await sleep(1500);
  for (const q of ['1258', 'Baghdad', 'Battle of Hastings', 'Inca', 'Rome']) {
    await page.keyboard.press('/'); await page.keyboard.type(q); await sleep(500);
    const list = await page.evaluate(() => [...document.querySelectorAll('.res[data-i]')].slice(0, 4).map(r => r.textContent.replace(/\s+/g, ' ')));
    await page.keyboard.press('Enter'); await sleep(3500);
    out[q] = { results: list, after: await page.evaluate(() => ({ year: Math.round(window.chronos.timeline.state.year), realm: window.chronos.borders.selection, event: window.chronos.selectedEvent?.name || null, cam: [window.chronos.globe.cam.lat.toFixed(1), window.chronos.globe.cam.lon.toFixed(1)] })) };
    console.log('search', q, JSON.stringify(out[q]));
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  }
  out.errors = errors; await browser.close(); results.search = out; save();
}

async function share() {
  let { browser, page, errors } = await open('/app.html');
  await page.evaluate(() => { const a = window.chronos; a.timeline.set(117, 'jump'); a.globe.setView(41.2, 14.5, 2.35); }); await waitMap(page, 117);
  await page.evaluate(() => window.chronos.select({ group: 'Roman Empire' })); await sleep(1500);
  const url = await page.evaluate(() => window.chronos.share.url()); const before = await page.evaluate(() => ({ y: Math.round(window.chronos.timeline.state.year), c: window.chronos.globe.cam, s: window.chronos.borders.selection, name: document.getElementById('bname').textContent }));
  await browser.close();
  ({ browser, page, errors } = await open(url.replace(/^https?:\/\/[^/]+/, '')));
  await sleep(4000);
  const after = await page.evaluate(() => ({ y: Math.round(window.chronos.timeline.state.year), c: window.chronos.globe.cam, s: window.chronos.borders.selection, name: document.getElementById('bname').textContent, skin: window.chronos.skins.current }));
  const ok = before.y === after.y && Math.abs(before.c.lat - after.c.lat) < .02 && Math.abs(before.c.lon - after.c.lon) < .02 && Math.abs(before.c.dist - after.c.dist) < .01 && before.name === after.name;
  results.share = { url, before, after, ok, errors }; save(); console.log('share', ok, url, after.name, after.skin); await browser.close();
}

async function tours() {
  const { browser, page, errors } = await open('/app.html'); const out = {};
  const list = await page.evaluate(() => window.chronos.tours.list.map(t => ({ id: t.id, n: t.steps.length })));
  for (const t of list) {
    await page.evaluate(id => window.chronos.tours.start(id, 0, { auto: false }), t.id); const steps = []; let bad = 0;
    for (let i = 0; i < t.n; i++) {
      await sleep(3600);
      const s = await page.evaluate(() => { const a = window.chronos, act = a.tours.active, st = act.tour.steps[act.step], sel = a.borders.selection; return { step: act.step, year: Math.round(a.timeline.state.year), want: st.year, realm: st.realm, sel: sel ? sel.group ?? sel.name : null, title: document.getElementById('ttitle').textContent === st.title, skin: a.skins.current, wantSkin: act.tour.skin, map: a.borders.primary?.year, hidden: document.getElementById('tour').hidden }; });
      const ok = s.step === i && s.year === s.want && s.title && !s.hidden && (s.realm ? s.sel === s.realm : true); if (!ok) { bad++; steps.push(s); }
      if (i === t.n - 1) out[t.id + '_skin'] = s.skin + (s.skin === s.wantSkin ? '' : ' (wanted ' + s.wantSkin + ')');
      await page.evaluate(() => window.chronos.tours.next());
    }
    await sleep(500);
    out[t.id] = { steps: t.n, bad, ended: await page.evaluate(() => !window.chronos.tours.active), problems: steps }; console.log('tour', t.id, JSON.stringify(out[t.id]));
  }
  // automatic playback of one tour start to finish, dwell shortened
  await page.evaluate(() => { window.chronos.tours.start('alexander', 0, { auto: true }); });
  const t0 = Date.now(); let fin = false; while (Date.now() - t0 < 520000) { await sleep(2000); if (await page.evaluate(() => !window.chronos.tours.active)) { fin = true; break; } }
  out.autoplay = { tour: 'alexander', finished: fin, seconds: Math.round((Date.now() - t0) / 1000) }; console.log('autoplay', JSON.stringify(out.autoplay));
  out.errors = errors; await browser.close(); results.tours = out; save();
}

async function record() {
  const { browser, page, errors } = await open('/app.html'); const out = {};
  await page.mouse.click(960, 560); await page.evaluate(() => window.chronos.audio.setMuted(false)); await sleep(5000);
  for (const aspect of ['16:9', '9:16']) {
    await page.evaluate(aspect => { const a = window.chronos; a.lastRecording = null; Object.assign(a.recorder.opts, { aspect, length: 10, camera: 'orbit', overlay: 'year', music: true, format: 'webm' }); a.recorder.start(); }, aspect);
    await page.waitForFunction(() => window.chronos.lastRecording, null, { timeout: 60000 });
    const info = await page.evaluate(async () => {
      const r = window.chronos.lastRecording, v = document.createElement('video'); v.src = r.url; v.muted = true;
      await new Promise(res => { v.onloadedmetadata = res; v.onerror = res; }); if (!isFinite(v.duration)) { v.currentTime = 1e6; await new Promise(res => { v.onseeked = res; setTimeout(res, 3000); }); }
      let audio = null; try { const ac = new AudioContext(), buf = await ac.decodeAudioData(await r.blob.arrayBuffer()); const d = buf.getChannelData(0); let s = 0; for (let i = 0; i < d.length; i += 50) s += d[i] * d[i]; audio = { channels: buf.numberOfChannels, seconds: +buf.duration.toFixed(1), rms: +Math.sqrt(s / (d.length / 50)).toFixed(4) }; ac.close(); } catch (e) { audio = { error: String(e) }; }
      const b = new Uint8Array(await r.blob.arrayBuffer()); let bin = ''; for (let i = 0; i < b.length; i += 32768) bin += String.fromCharCode.apply(null, b.subarray(i, i + 32768));
      return { name: r.name, mime: r.mime, bytes: r.blob.size, width: v.videoWidth, height: v.videoHeight, duration: +v.duration.toFixed(1), audio, b64: btoa(bin), uiHidden: !document.body.classList.contains('recording') };
    });
    fs.writeFileSync(`tests/results/clip-${aspect.replace(':', 'x')}.webm`, Buffer.from(info.b64, 'base64')); delete info.b64;
    out[aspect] = info; console.log('record', aspect, JSON.stringify(info)); await page.keyboard.press('Escape'); await sleep(800);
  }
  out.errors = errors; await browser.close(); results.record = out; save();
}

// frame-time probe installed in the page
const PROBE = () => { const a = window.chronos, p = window.__probe = { n: 0, slow: 0, streak: 0, worstStreak: 0, worst: 0, sum: 0, skinChanges: 0, skins: [] }; let last = performance.now();
  a.frameHooks.push(() => { const now = performance.now(), dt = now - last; last = now; if (document.hidden) return; p.n++; p.sum += dt; p.worst = Math.max(p.worst, dt); if (dt > 33.4) { p.slow++; p.streak += dt; p.worstStreak = Math.max(p.worstStreak, p.streak); } else p.streak = 0; });
  a.skins.on(id => { p.skinChanges++; p.skins.push(id); }); };
async function scrub() {
  const out = {};
  for (const speed of [100, 5]) {
    const { browser, page, errors } = await open('/app.html');
    await page.mouse.click(960, 560); await page.evaluate(() => window.chronos.audio.setMuted(false)); await sleep(1500);
    await page.evaluate(PROBE);
    await page.evaluate(s => { const a = window.chronos; a.select(null); a.timeline.set(-3000, 'jump'); a.timeline.setSpeed(s); a.timeline.play(); }, speed);
    const t0 = Date.now(); while (await page.evaluate(() => window.chronos.timeline.state.playing) && Date.now() - t0 < 1200000) await sleep(2000);
    const p = await page.evaluate(() => ({ ...window.__probe, music: window.chronos.audio.changes, year: Math.round(window.chronos.timeline.state.year), heap: performance.memory?.usedJSHeapSize, mem: window.chronos.globe.renderer.info.memory, quality: window.chronos.globe.quality }));
    out[speed] = { seconds: Math.round((Date.now() - t0) / 1000), frames: p.n, avgFps: +(1000 * p.n / p.sum).toFixed(1), worstFrameMs: +p.worst.toFixed(0), slowFrames: p.slow, longestSlowStreakMs: +p.worstStreak.toFixed(0), skinChanges: p.skinChanges, musicChanges: p.music, musicOk: p.music <= p.skinChanges + 1, endYear: p.year, heapMB: p.heap ? +(p.heap / 1e6).toFixed(0) : null, gpu: p.mem, quality: p.quality, errors };
    console.log('scrub', speed, JSON.stringify(out[speed])); await browser.close(); results.scrub = out; save();
  }
}
async function soak() {
  const { browser, page, errors } = await open('/app.html'); const samples = [];
  await page.evaluate(PROBE); await page.evaluate(() => { const a = window.chronos; a.timeline.set(-1000, 'jump'); a.timeline.setSpeed(20); a.timeline.play(); a.timeline.on(s => { if (!s.playing) { a.timeline.set(-1000, 'jump'); a.timeline.play(); } }); });
  for (let i = 0; i < 20; i++) {
    await page.evaluate(i => { const a = window.chronos, spots = [[40, 15, 2.2], [35, 100, 3], [10, 20, 4.2], [-15, -60, 2.6], [50, 10, 1.5], [25, 78, 1.9]]; a.globe.flyTo(...spots[i % spots.length], 3); }, i);
    await sleep(30000);
    samples.push(await page.evaluate(() => ({ fps: +window.chronos.fps.avg.toFixed(1), heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1e6).toFixed(0) : null, geometries: window.chronos.globe.renderer.info.memory.geometries, textures: window.chronos.globe.renderer.info.memory.textures, cached: window.chronos.borders.stats() })));
    console.log('soak', i, JSON.stringify(samples.at(-1)));
  }
  const p = await page.evaluate(() => window.__probe); const third = Math.floor(samples.length / 3), avg = l => l.reduce((s, x) => s + x.heapMB, 0) / l.length;
  results.soak = { minutes: 10, samples, avgFps: +(1000 * p.n / p.sum).toFixed(1), longestSlowStreakMs: +p.worstStreak.toFixed(0), heapFirstThird: +avg(samples.slice(0, third)).toFixed(0), heapLastThird: +avg(samples.slice(-third)).toFixed(0), geometriesMax: Math.max(...samples.map(s => s.geometries)), texturesMax: Math.max(...samples.map(s => s.textures)), errors };
  save(); console.log('soak done', JSON.stringify({ ...results.soak, samples: undefined })); await browser.close();
}
const fns = { skins, clicks, search, share, tours, record, scrub, soak };
results.base = BASE; results.date = new Date().toISOString();
for (const t of todo) { console.log('== ' + t); try { await fns[t](); } catch (e) { console.error(t, 'FAILED', e.message); results[t] = { ...(results[t] || {}), failed: e.message }; save(); } }
