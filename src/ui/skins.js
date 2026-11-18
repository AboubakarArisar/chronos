// Culture skins: CSS custom properties on <body data-skin>, driven by data/skins.json and data/eras.json.
import { FONT_LOADERS } from './fonts.gen.js';
import { angDist } from '../globe/geo.js';

const STUD = { round: ['mongol', 'china', 'japan', 'africa', 'prehistory', 'norse'], star: ['islamic', 'ottoman', 'persia', 'mughal'], square: ['rome', 'greece', 'egypt', 'mesopotamia', 'andes', 'mesoamerica', 'modern', 'worldwars', 'revolution'] };
const ARCH = ['islamic', 'ottoman', 'mughal', 'persia'], RTL = ['islamic', 'ottoman', 'mughal'];
const svg = s => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
// subtle material layers under the pattern: fibre noise for dark panels, marble veins for light ones
const MAT_DARK = svg(`<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 .9 0 0 0 0 .75 0 0 0 .09 0'/></filter><rect width='300' height='300' filter='url(#n)'/></svg>`);
const MAT_LIGHT = svg(`<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'><filter id='m'><feTurbulence type='fractalNoise' baseFrequency='.004 .018' numOctaves='5' seed='7'/><feColorMatrix type='luminanceToAlpha'/><feComponentTransfer><feFuncA type='table' tableValues='0 0 .05 .5 0 0 .35 0 0 .15'/></feComponentTransfer><feColorMatrix values='0 0 0 0 .42 0 0 0 0 .38 0 0 0 0 .34 0 0 0 .55 0'/></filter><rect width='600' height='400' filter='url(#m)'/></svg>`);
export const capFont = s => /Unifraktur|Metamorphous|Limelight/.test(s.fonts.head) && s.fonts.deco && !/Noto|Metamorphous/.test(s.fonts.deco) ? s.fonts.deco : /Unifraktur/.test(s.fonts.head) ? s.fonts.body : s.fonts.head;
const DEFAULT = { name: 'Chronos', panel: '#140e09', panel_is_light: false, ink: '#efe2bf', ink2: '#cbb88a', hi: '#f6dc94', accent: '#c9a24a', metal: ['#6e5018', '#f6dc94', '#9c7426', '#fbe7a8'], fonts: { head: 'Cinzel', body: 'Alegreya', deco: 'Cinzel' }, motto: '', motto_en: '', assets: {}, scale: [0, 2, 4, 7, 9], timbre: 'pad' };

export async function createSkins({ base = 'd/', assetBase = '' } = {}) {
  const data = await fetch(base + 'skins.json').then(r => r.json());
  const skins = { default: DEFAULT, ...data.skins }, rules = data.eras.skins.map(s => ({ ...s, re: new RegExp(s.match) }));
  const loadedFonts = new Set(), subs = [], raster = new Map();
  // SVG textures with turbulence filters are expensive to repaint; draw each once into a PNG tile
  function rasterise(key, src, w, h) {
    if (raster.has(key)) return raster.get(key);
    const p = new Promise(res => { const img = new Image(); img.onload = () => { try { const c = document.createElement('canvas'); c.width = w || img.naturalWidth || 300; c.height = h || img.naturalHeight || 300; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(`url("${c.toDataURL('image/png')}")`); } catch { res(null); } }; img.onerror = () => res(null); img.src = src; });
    raster.set(key, p); return p;
  }
  const unUrl = v => v.slice(5, -2);
  const matDark = rasterise('matDark', unUrl(MAT_DARK), 300, 300), matLight = rasterise('matLight', unUrl(MAT_LIGHT), 600, 400);
  async function bitmapTextures(id) { // swap the SVG layers for bitmaps once they are ready
    const s = skins[id] || DEFAULT, out = {}; const mat = await (s.panel_is_light ? matLight : matDark); if (mat) out['--mat'] = mat;
    if (s.assets.pattern) { const t = await rasterise('pat:' + id, assetBase + s.assets.pattern); if (t) out['--tex'] = t; }
    return out;
  }
  const ready = new Map();
  let current = null, enabled = true, candidate = null, candidateSince = 0, forced = null;

  function loadFonts(s) { const ps = []; for (const f of new Set(Object.values(s.fonts))) { if (loadedFonts.has(f)) continue; loadedFonts.add(f); const l = FONT_LOADERS[f]; if (l) ps.push(l().catch(() => {})); } return Promise.all(ps); }
  function vars(id) {
    const s = skins[id] || DEFAULT, m = s.metal, light = s.panel_is_light;
    return {
      '--panel': s.panel, '--ink': s.ink, '--ink2': s.ink2, '--hi': s.hi, '--accent': s.accent, '--danger': light ? s.accent : s.hi,
      '--gold': `linear-gradient(135deg,${m[0]} 0%,${m[1]} 22%,${m[2]} 45%,${m[3]} 62%,${m[0]} 80%,${m[1]} 100%)`,
      '--btn': light ? `linear-gradient(180deg,color-mix(in srgb,${s.accent} 85%,#fff),${s.accent})` : `linear-gradient(180deg,${m[3]},${m[1]} 45%,${m[2]})`,
      '--btn-ink': light ? '#fbf3e0' : '#1a1206',
      '--head': `'${s.fonts.head}',serif`, '--cap': `'${capFont(s)}',serif`, '--body': `'${s.fonts.body}',serif`, '--deco': `'${s.fonts.deco}','${s.fonts.body}',serif`,
      '--tex': s.assets.pattern ? `url("${assetBase}${s.assets.pattern}")` : 'none', '--strip': s.assets.strip ? `url("${assetBase}${s.assets.strip}")` : 'var(--gold)',
      '--mat': light ? MAT_LIGHT : MAT_DARK, '--sh-in': light ? '#fff8' : '#00000080', '--sh-glow': light ? '#6b5a4433' : '#00000066', '--line': light ? '#0000001f' : '#0000002e'
    };
  }
  function applyNow(id) {
    const s = skins[id] || DEFAULT, b = document.body; current = id;
    for (const [k, v] of Object.entries({ ...vars(id), ...(ready.get(id) || {}) })) b.style.setProperty(k, v);
    if (!ready.has(id)) bitmapTextures(id).then(v => { ready.set(id, v); if (current === id) for (const [k, val] of Object.entries(v)) b.style.setProperty(k, val); });
    b.dataset.skin = id; b.classList.toggle('light', !!s.panel_is_light);
    b.dataset.stud = Object.entries(STUD).find(([, ids]) => ids.includes(id))?.[0] || 'diamond';
    b.dataset.arch = ARCH.includes(id) ? 'on' : 'off';
    loadFonts(s);
    subs.forEach(f => f(id, s));
  }
  let fadeTimer = 0, pendingId = null;
  function apply(id, instant = false) {
    if (!skins[id]) id = 'default'; if (id === pendingId) return; if (id === current && !pendingId) return;
    clearTimeout(fadeTimer); pendingId = null;
    if (id === current) { document.body.classList.remove('fading'); return; }
    if (instant || !current || document.body.classList.contains('reduced')) { document.body.classList.remove('fading'); applyNow(id); return; }
    pendingId = id; document.body.classList.add('fading'); // out .35 s, swap, in .35 s
    const fonts = Promise.all([loadFonts(skins[id]), ready.has(id) ? null : bitmapTextures(id).then(v => ready.set(id, v))]);
    fadeTimer = setTimeout(async () => { await Promise.race([fonts, new Promise(r => setTimeout(r, 400))]); if (pendingId !== id) return; pendingId = null; applyNow(id); document.body.classList.remove('fading'); }, 360);
  }
  // regex match on NAME / SUBJECTO, only for skins whose years cover the current year
  function matchName(names, year) {
    for (const n of names) { if (!n) continue; let best = null, len = 0; for (const r of rules) { if (year < r.years[0] || year > r.years[1]) continue; const m = r.re.exec(n); if (m && m[0].length > len) { best = r.id; len = m[0].length; } } if (best) return best; }
    return null;
  }
  const eraSkin = year => (data.eras.eraFallback.find(e => year >= e.from && year < e.to) || data.eras.eraFallback.at(-1)).skin;
  // selected realm -> largest realm in view -> era fallback
  function decide({ year, selection, snap, cam, viewDeg }) {
    if (!enabled) return 'default'; if (forced) return forced;
    if (selection) { const id = matchName([selection.name, selection.group], year); if (id) return id; }
    if (snap?.data) {
      let best = null;
      for (const g of snap.data.powers) { if (!g.label) continue; if (angDist(cam.lat, cam.lon, g.label[0], g.label[1]) > viewDeg) continue; if (!best || g.area > best.area) best = g; }
      if (best) { const id = matchName([best.key], year); if (id) return id; }
    }
    return eraSkin(year);
  }
  // call often; switches only after the decision has been stable for 1.2 s
  function consider(ctx, now = performance.now()) {
    const id = decide(ctx);
    if (id !== candidate) { candidate = id; candidateSince = now; }
    if (candidate !== current && (now - candidateSince >= 1200 || !current)) apply(candidate);
  }
  function mottoHTML(id) {
    const s = skins[id]; if (!s || !s.motto) return '';
    const m = id === 'mongol' ? `<span class="vert">${s.motto}</span>` : RTL.includes(id) ? `<span dir="rtl" lang="${id === 'mughal' ? 'ur' : id === 'ottoman' ? 'ota' : 'ar'}">${s.motto}</span>` : `<span>${s.motto}</span>`;
    return m + (s.motto_en ? `<span class="en">${s.motto_en}</span>` : '');
  }
  return {
    skins, data, apply, consider, decide, matchName, eraSkin, mottoHTML, vars, loadFonts,
    get current() { return current; }, get spec() { return skins[current] || DEFAULT; },
    emblem: id => skins[id]?.assets?.emblem ? assetBase + skins[id].assets.emblem : null,
    art: id => data.art[id] || [], music: id => data.music[id] || [],
    setEnabled(v) { enabled = v; candidate = null; }, force(id) { forced = id; },
    on: f => subs.push(f)
  };
}
