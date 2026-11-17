// Prepares everything the app loads at runtime into public/ (never modifies the originals).
//  - data/borders/*.geojson  -> public/d/b/<year>.json   (compact, delta-encoded rings, label points, areas)
//  - data/events.json        -> public/d/events.json     (compact rows)
//  - data/regions.json       -> public/d/regions.json    (search + "through time" index)
//  - manifests               -> public/d/credits.json, CREDITS.md
//  - assets/                 -> public/assets/           (only the files the app uses)
//  - src/ui/fonts.gen.js     (lazy @fontsource loaders per font family)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (...a) => path.join(ROOT, ...a);
const readJSON = f => JSON.parse(fs.readFileSync(P(f), 'utf8'));
const log = [];
const warn = m => { log.push(m); console.warn('  ! ' + m); };
const mkdir = d => fs.mkdirSync(d, { recursive: true });
function writeIfChanged(file, content) {
  mkdir(path.dirname(file));
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return;
  fs.writeFileSync(file, content);
}
function copyFile(src, dst) {
  if (!fs.existsSync(src)) { warn('missing asset ' + path.relative(ROOT, src)); return false; }
  const s = fs.statSync(src);
  if (fs.existsSync(dst)) { const d = fs.statSync(dst); if (d.size === s.size && d.mtimeMs >= s.mtimeMs) return true; }
  mkdir(path.dirname(dst)); fs.copyFileSync(src, dst); return true;
}
function copyDir(src, dst, filter = () => true) {
  if (!fs.existsSync(src)) { warn('missing folder ' + path.relative(ROOT, src)); return; }
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d, filter); else if (filter(e.name)) copyFile(s, d);
  }
}

// ---------------------------------------------------------------- borders
const Q = 1000; // 0.001 degree grid (about 110 m)
function unwrap(ring) { // same as the look test: keep rings continuous across the antimeridian
  const out = []; let prev = null, off = 0;
  for (const [lo, la] of ring) {
    if (prev !== null) { const d = lo + off - prev; if (d > 180) off -= 360; else if (d < -180) off += 360; }
    const x = lo + off; out.push([x, la]); prev = x;
  }
  return out;
}
function quantRing(ring) {
  const u = unwrap(ring), pts = [];
  for (const [x, y] of u) {
    const qx = Math.round(x * Q), qy = Math.round(Math.max(-90, Math.min(90, y)) * Q);
    const n = pts.length;
    if (n && pts[n - 2] === qx && pts[n - 1] === qy) continue;
    pts.push(qx, qy);
  }
  if (pts.length >= 4 && pts[0] === pts[pts.length - 2] && pts[1] === pts[pts.length - 1]) pts.length -= 2; // open ring
  return pts.length >= 6 ? pts : null;
}
const D2R = Math.PI / 180;
function ringArea(pts) { // spherical area in steradians (signed), rings given in quantised degrees
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i += 2) {
    const j = (i + 2) % n;
    a += (pts[j] - pts[i]) / Q * D2R * (Math.sin(pts[i + 1] / Q * D2R) + Math.sin(pts[j + 1] / Q * D2R)) / 2;
  }
  return a;
}
function pip(x, y, rings) { // even-odd over all rings (holes included)
  let inside = false;
  for (const r of rings) for (let i = 0, n = r.length, j = n - 2; i < n; j = i, i += 2) {
    const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function edgeDist(x, y, rings, kx) { // min distance to any edge, lon scaled by kx
  let best = Infinity;
  for (const r of rings) for (let i = 0, n = r.length, j = n - 2; i < n; j = i, i += 2) {
    const ax = (r[j] - x) * kx, ay = r[j + 1] - y, bx = (r[i] - x) * kx, by = r[i + 1] - y;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? -(ax * dx + ay * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + t * dx, py = ay + t * dy, d = px * px + py * py;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
function labelPoint(rings) { // pole of inaccessibility by two-pass grid search (good enough for labels)
  const r0 = rings[0]; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < r0.length; i += 2) { x0 = Math.min(x0, r0[i]); x1 = Math.max(x1, r0[i]); y0 = Math.min(y0, r0[i + 1]); y1 = Math.max(y1, r0[i + 1]); }
  const kx = Math.max(0.2, Math.cos((y0 + y1) / 2 / Q * D2R));
  // thin very long rings for the distance test
  const thin = rings.map(r => { if (r.length < 800) return r; const step = Math.ceil(r.length / 800) * 2, o = []; for (let i = 0; i < r.length; i += step) o.push(r[i], r[i + 1]); return o; });
  let best = [(x0 + x1) / 2, (y0 + y1) / 2], bd = -1;
  const search = (ax, ay, bx, by, n) => {
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = ax + (bx - ax) * (i + .5) / n, y = ay + (by - ay) * (j + .5) / n;
      if (!pip(x, y, rings)) continue;
      const d = edgeDist(x, y, thin, kx); if (d > bd) { bd = d; best = [x, y]; }
    }
  };
  search(x0, y0, x1, y1, 18);
  if (bd >= 0) { const sx = (x1 - x0) / 18, sy = (y1 - y0) / 18; search(best[0] - sx, best[1] - sy, best[0] + sx, best[1] + sy, 8); }
  return { lon: best[0] / Q, lat: best[1] / Q, r: Math.max(0, bd) / Q, bbox: [x0 / Q, y0 / Q, x1 / Q, y1 / Q] };
}
const delta = pts => { const o = new Array(pts.length); o[0] = pts[0]; o[1] = pts[1]; for (let i = 2; i < pts.length; i++) o[i] = pts[i] - pts[i - 2]; return o; };

function prepBorders() {
  const regions = readJSON('data/regions.json').regions;
  const files = fs.readdirSync(P('data/borders')).filter(f => /^world_.*\.geojson$/.test(f));
  const snaps = files.map(f => { const m = f.match(/^world_(bc)?(\d+)\.geojson$/); return { f, year: m[1] ? -+m[2] : +m[2] }; })
    .filter(s => s.year >= -3000).sort((a, b) => a.year - b.year);
  const outDir = P('public/d/b'); mkdir(outDir);
  const index = [], areas = {}; // areas[key] = [[year, km2], ...] for every NAME and SUBJECTO group
  const srcM = Math.max(...snaps.map(s => fs.statSync(P('data/borders', s.f)).mtimeMs), fs.statSync(fileURLToPath(import.meta.url)).mtimeMs);
  const idxFile = P('public/d/index.json');
  if (fs.existsSync(idxFile) && fs.statSync(idxFile).mtimeMs > srcM && snaps.every(s => fs.existsSync(path.join(outDir, s.year + '.json')))) {
    console.log('borders: up to date'); return JSON.parse(fs.readFileSync(idxFile, 'utf8'));
  }
  for (const s of snaps) {
    const gj = readJSON('data/borders/' + s.f);
    const feats = [], unclaimed = [], groupArea = {};
    for (const ft of gj.features) {
      if (!ft.geometry) continue;
      const polys = ft.geometry.type === 'Polygon' ? [ft.geometry.coordinates] : ft.geometry.type === 'MultiPolygon' ? ft.geometry.coordinates : [];
      const out = []; let area = 0, big = null, bigA = -1;
      for (const poly of polys) {
        const rings = poly.map(quantRing).filter(Boolean); if (!rings.length || !poly[0] || !quantRing(poly[0])) continue;
        let a = Math.abs(ringArea(rings[0])); for (let i = 1; i < rings.length; i++) a -= Math.abs(ringArea(rings[i]));
        a = Math.max(0, a); area += a; if (a > bigA) { bigA = a; big = rings; }
        out.push(rings);
      }
      if (!out.length) continue;
      const name = (ft.properties.NAME || '').trim();
      if (!name) { for (const rings of out) unclaimed.push(rings.map(delta)); continue; }
      const lp = labelPoint(big);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const rings of out) { const r = rings[0]; for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); y0 = Math.min(y0, r[i + 1]); y1 = Math.max(y1, r[i + 1]); } }
      const subj = (ft.properties.SUBJECTO || '').trim() || name;
      const km2 = Math.round(area * 6371 * 6371);
      const kind = regions[ft.properties.NAME]?.kind || regions[name]?.kind || 'region';
      feats.push({ n: name, s: subj === name ? 0 : subj, po: (ft.properties.PARTOF || '').trim() || 0, p: ft.properties.BORDERPRECISION || 1,
        k: kind === 'people' ? 2 : kind === 'state' ? 0 : 1, a: km2, l: [+lp.lat.toFixed(2), +lp.lon.toFixed(2), +lp.r.toFixed(2)],
        bb: [x0 / Q, y0 / Q, x1 / Q, y1 / Q], g: out.map(rings => rings.map(delta)) });
      groupArea[subj] = (groupArea[subj] || 0) + km2;
      if (subj !== name) groupArea['\u0001' + name] = (groupArea['\u0001' + name] || 0) + km2;
    }
    for (const [k, a] of Object.entries(groupArea)) { const key = k.replace('\u0001', ''); (areas[key] ??= []); const last = areas[key].at(-1); if (last && last[0] === s.year) last[1] = Math.max(last[1], a); else areas[key].push([s.year, a]); }
    fs.writeFileSync(path.join(outDir, s.year + '.json'), JSON.stringify({ year: s.year, f: feats, u: unclaimed }));
    const top = Object.entries(groupArea).filter(([k]) => k[0] !== '\u0001').sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k]) => k);
    index.push({ year: s.year, n: feats.length, top });
    console.log('borders', s.year, feats.length, 'features', unclaimed.length, 'unclaimed');
  }
  const idx = { years: index.map(i => i.year), snapshots: index };
  fs.writeFileSync(P('public/d/areas.json'), JSON.stringify(areas));
  fs.writeFileSync(idxFile, JSON.stringify(idx));
  return idx;
}

// ---------------------------------------------------------------- events
const TYPES = ['battle', 'treaty', 'city', 'disaster', 'expedition', 'building', 'monument'];
function prepEvents() {
  const src = readJSON('data/events.json').events;
  const rows = src.filter(e => Number.isFinite(e.year) && Number.isFinite(e.lat) && Number.isFinite(e.lon) && e.name)
    .sort((a, b) => a.year - b.year || b.fame - a.fame)
    .map(e => { const w = e.wiki === e.name.replace(/ /g, '_') ? 0 : e.wiki; const r = [e.id, e.name, Math.max(0, TYPES.indexOf(e.type)), e.year, +e.lat.toFixed(3), +e.lon.toFixed(3), e.fame || 0, w || 0]; if (e.participants?.length) r.push(e.participants.slice(0, 6)); return r; });
  writeIfChanged(P('public/d/events.json'), JSON.stringify({ types: TYPES, rows }));
  return rows.length;
}
function prepRegions() {
  const src = readJSON('data/regions.json').regions, out = {};
  for (const [n, r] of Object.entries(src)) { const name = n.trim(); if (!name) continue; out[name] = [r.kind === 'people' ? 2 : r.kind === 'state' ? 0 : 1, r.snapshots, r.subjecto || [], r.wiki_search || name]; }
  writeIfChanged(P('public/d/regions.json'), JSON.stringify(out));
  return Object.keys(out).length;
}

// ---------------------------------------------------------------- assets + credits
function prepAssets() {
  const pub = P('public/assets');
  for (const f of ['earth-blue-marble.jpg', 'earth-night.jpg', 'earth_specular_2048.jpg', 'earth_normal_2048.jpg', 'earth_clouds_1024.png', 'earth-water.png'])
    copyFile(P('assets/earth', f), path.join(pub, 'earth', f));
  copyDir(P('assets/skins'), path.join(pub, 'skins'));
  copyDir(P('assets/art'), path.join(pub, 'art'), n => !n.endsWith('.json'));
  copyDir(P('assets/music'), path.join(pub, 'music'), n => !n.endsWith('.json'));
  for (const f of ['indus.jpg', 'kublai.jpg', 'trajan.jpg', 'wisdom.jpg']) copyFile(P('assets', f), path.join(pub, f));
  copyFile(P('data/borders/LICENSE'), P('public/d/b/LICENSE'));

  const skins = readJSON('data/skins.json').skins, eras = readJSON('data/eras.json');
  const art = readJSON('assets/art/manifest.json').skins, music = readJSON('assets/music/manifest.json');
  for (const [id, list] of Object.entries(art)) art[id] = list.filter(a => fs.existsSync(P(a.file)) || (warn('art manifest lists missing file ' + a.file), false));
  for (const [id, list] of Object.entries(music)) music[id] = list.filter(a => fs.existsSync(P(a.file)) || (warn('music manifest lists missing file ' + a.file), false));
  for (const [id, s] of Object.entries(skins)) for (const k of Object.keys(s.assets)) if (!fs.existsSync(P(s.assets[k]))) { warn(`skin ${id} missing ${s.assets[k]}`); s.assets[k] = null; }
  const artLite = {}; for (const [id, list] of Object.entries(art)) artLite[id] = list.map(a => ({ file: a.file, title: a.title, date: (a.date || '').replace(/date QS:.*$/i, '').replace(/\s+/g, ' ').trim(), credit: a.credit, license: a.license, focus: a.focus, kind: a.kind }));
  const musicLite = {}; for (const [id, list] of Object.entries(music)) musicLite[id] = list.map(m => ({ file: m.file, title: m.title, by: m.performer_or_author, license: m.license, dur: m.duration_sec }));
  writeIfChanged(P('public/d/skins.json'), JSON.stringify({ skins, eras: { eraFallback: eras.eraFallback, skins: eras.skins.map(s => ({ id: s.id, name: s.name, years: s.years, match: s.match })) }, art: artLite, music: musicLite }));

  const datasets = [
    { name: 'Historical borders', what: '49 world maps, 3000 BC to 2010', by: 'historical-basemaps, André Ourednik and contributors', license: 'GPL-3.0', url: 'https://github.com/aourednik/historical-basemaps' },
    { name: 'Events', what: 'Dated, located battles, treaties, cities, disasters, expeditions, buildings and monuments', by: 'Wikidata', license: 'CC0', url: 'https://www.wikidata.org/' },
    { name: 'Article summaries and thumbnails', what: 'Loaded live in region and event cards', by: 'English Wikipedia contributors', license: 'CC BY-SA 4.0', url: 'https://en.wikipedia.org/' },
    { name: 'Earth textures', what: 'Blue Marble day, Black Marble night lights, clouds, relief and water masks', by: 'NASA imagery, via the three-globe and three.js example assets', license: 'NASA imagery is public domain; packages MIT', url: 'https://visibleearth.nasa.gov/' },
    { name: 'three.js', what: '3D rendering library', by: 'three.js authors', license: 'MIT', url: 'https://threejs.org/' },
    { name: 'earcut', what: 'Polygon triangulation', by: 'Mapbox', license: 'ISC', url: 'https://github.com/mapbox/earcut' },
    { name: 'Fonts', what: 'Google Fonts families packaged by Fontsource', by: 'Their respective designers', license: 'SIL Open Font License 1.1 (a few Apache 2.0)', url: 'https://fontsource.org/' }
  ];
  const credits = { datasets, art, music };
  writeIfChanged(P('public/d/credits.json'), JSON.stringify(credits));

  let md = '# Credits\n\nChronos is free and open source under GPL-3.0. Borders are approximate and some are disputed; the app always shows which map year is on screen.\n\n## Data and software\n\n';
  for (const d of datasets) md += `- **${d.name}**: ${d.what}. ${d.by}. License: ${d.license}. ${d.url}\n`;
  md += '\n## Artwork\n\n';
  for (const [id, list] of Object.entries(art)) { if (!list.length) continue; md += `### ${skins[id]?.name || id}\n\n`; for (const a of list) md += `- ${a.title}${a.date ? ' (' + a.date + ')' : ''}. ${a.credit || 'Unknown'}. ${a.license}. ${a.source_page || ''}\n`; md += '\n'; }
  md += '## Music\n\n';
  for (const [id, list] of Object.entries(music)) { md += `### ${skins[id]?.name || id}\n\n`; if (!list.length) { md += '- Generated in the browser (procedural music in this culture\'s scale). No recording used.\n\n'; continue; } for (const m of list) md += `- ${m.title}. ${m.performer_or_author}. ${m.license}${m.license_url ? ' (' + m.license_url + ')' : ''}. ${m.source_page}\n`; md += '\n'; }
  writeIfChanged(P('CREDITS.md'), md);
  return { skins, art, music };
}

// ---------------------------------------------------------------- fonts
function prepFonts(skins) {
  const fams = new Set(['Cinzel', 'Alegreya', 'Manrope']);
  for (const s of Object.values(skins)) for (const f of Object.values(s.fonts)) fams.add(f);
  let js = '// Generated by tools/prepare-data.mjs. Lazy loaders for every font family used by a skin.\nexport const FONT_LOADERS = {\n';
  for (const fam of [...fams].sort()) {
    const pkg = fam.toLowerCase().replace(/ /g, '-'), dir = P('node_modules/@fontsource', pkg);
    if (!fs.existsSync(dir)) { warn('font package missing: @fontsource/' + pkg); continue; }
    const have = w => fs.existsSync(path.join(dir, w + '.css'));
    const ws = ['400', '500', '600', '700', '900', '400-italic'].filter(have);
    if (!ws.length) ws.push('index');
    js += `  ${JSON.stringify(fam)}: () => Promise.all([${ws.map(w => `import('@fontsource/${pkg}/${w}.css')`).join(', ')}]),\n`;
  }
  js += '};\n';
  writeIfChanged(P('src/ui/fonts.gen.js'), js);
}

// ---------------------------------------------------------------- run
const t0 = Date.now();
mkdir(P('public/d'));
const idx = prepBorders();
const nEvents = prepEvents(), nRegions = prepRegions();
const { skins } = prepAssets();
writeIfChanged(P('public/favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6e5018"/><stop offset=".35" stop-color="#f6dc94"/><stop offset=".6" stop-color="#9c7426"/><stop offset="1" stop-color="#fbe7a8"/></linearGradient></defs><rect width="64" height="64" rx="12" fill="#0b0805"/><circle cx="32" cy="32" r="20" fill="#12283a" stroke="url(#g)" stroke-width="4"/><path d="M12 32h40M32 12c-9 6-9 34 0 40M32 12c9 6 9 34 0 40" fill="none" stroke="url(#g)" stroke-width="2.5"/></svg>`);
prepFonts(skins);
writeIfChanged(P('public/d/meta.json'), JSON.stringify({ maps: idx.years.length, events: nEvents, regions: nRegions, skins: Object.keys(skins).length, built: new Date().toISOString().slice(0, 10) }));
writeIfChanged(P('public/d/prepare-log.json'), JSON.stringify(log));
console.log(`prepare-data done in ${((Date.now() - t0) / 1000).toFixed(1)}s: ${idx.years.length} maps, ${nEvents} events, ${nRegions} regions, ${log.length} warnings`);
