// Event markers: which events show for the current year and view, drawn as crisp medallions on the label canvas.
import { llToXYZ } from '../globe/geo.js';

// icon strokes in a 24x24 box
const ICONS = {
  battle: 'M5 4l11 11M19 4L8 15M4.5 14.5l5 5M19.5 14.5l-5 5M6.5 17.5L4 20M17.5 17.5L20 20',
  siege: 'M8 20V9h8v11M6 9V5h3v2h2V5h2v2h2V5h3v4zM11 20v-4h2v4',
  treaty: 'M8 4h11v12M8 4a2 2 0 0 0-2 2v11M19 16v1a3 3 0 0 1-3 3H7a2 2 0 0 1-2-2v-1h10v1a2 2 0 0 0 2 2M9.5 8.5h6M9.5 12h6',
  city: 'M5 20h14M6.5 20V9M12 20V9M17.5 20V9M4.5 9h15L12 4z',
  disaster: 'M12 3c1 4 5.5 5.5 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2 1-3.4 2-4.4.2 2 1 3 2 3.4 0-3.5-.5-5.5 1.5-9.5z',
  expedition: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z',
  voyage: 'M3.5 15.5h17l-2.5 4.5H6zM12 15.5V3.5M12 5l6.5 8H12M12 7.5L6.5 13H12',
  building: 'M4.5 20h15M6 20v-6M18 20v-6M6 14a6 6 0 0 1 12 0M12 8V4.5M9.5 20v-3.5h5V20',
  monument: 'M4.5 20h15M8 20l1.5-13h5L16 20M9.5 7L12 3.5 14.5 7'
};
export const TYPE_LABEL = { battle: 'Battle', siege: 'Siege', treaty: 'Treaty', city: 'Founding', disaster: 'Disaster', expedition: 'Discovery', voyage: 'Voyage', building: 'Building', monument: 'Monument' };
export function iconFor(ev) {
  if (ev.type === 'battle') return /^(siege|fall|sack|capture|blockade) /i.test(ev.name) ? 'siege' : 'battle';
  if (ev.type === 'expedition') return /voyage|circumnavig|fleet|sail|ship|naval|armada|maritime|sea/i.test(ev.name) ? 'voyage' : 'expedition';
  return ev.type;
}
function medallion(icon, size, sel) {
  const c = document.createElement('canvas'), k = 3, s = size * k; c.width = c.height = s; const g = c.getContext('2d');
  g.scale(k, k); const r = size / 2;
  g.beginPath(); g.arc(r, r, r - 1.2, 0, 7); g.fillStyle = sel ? '#3a2606' : 'rgba(20,13,6,.92)'; g.fill();
  const grad = g.createLinearGradient(0, 0, size, size); grad.addColorStop(0, '#6e5018'); grad.addColorStop(.3, '#f6dc94'); grad.addColorStop(.55, '#9c7426'); grad.addColorStop(.8, '#fbe7a8'); grad.addColorStop(1, '#7a5a1c');
  g.lineWidth = sel ? 2.4 : 1.7; g.strokeStyle = grad; g.stroke();
  const sc = (size - 9) / 24; g.translate(4.5, 4.5); g.scale(sc, sc); g.lineWidth = 1.7 / Math.max(.6, sc) * .62; g.lineCap = g.lineJoin = 'round';
  g.strokeStyle = icon === 'disaster' ? '#ffb37a' : icon === 'battle' || icon === 'siege' ? '#ffc9b0' : '#fbe7a8'; g.stroke(new Path2D(ICONS[icon]));
  return c;
}

export function createEvents({ base = 'd/' } = {}) {
  let rows = [], types = [], byId = new Map(), cities = [], loaded = false;
  const ready = fetch(base + 'events.json').then(r => { if (!r.ok) throw new Error('events ' + r.status); return r.json(); }).then(j => {
    types = j.types;
    rows = j.rows.map(r => ({ id: r[0], name: r[1], type: types[r[2]], year: r[3], lat: r[4], lon: r[5], fame: r[6], wiki: r[7] || r[1].replace(/ /g, '_'), participants: r[8] || null, v: llToXYZ(r[4], r[5]) }));
    for (const e of rows) { e.icon = iconFor(e); byId.set(e.id, e); }
    cities = rows.filter(e => e.type === 'city').sort((a, b) => b.fame - a.fame);
    loaded = true; return rows;
  });
  const lowerBound = y => { let lo = 0, hi = rows.length; while (lo < hi) { const m = (lo + hi) >> 1; if (rows[m].year < y) lo = m + 1; else hi = m; } return lo; };
  const icons = {}; const img = (icon, sel) => icons[icon + sel] ??= medallion(icon, sel ? 30 : 24, sel);

  let visible = [], cityList = [], lastKey = '', lastCalc = 0, win = 10, selectedId = null, enabled = true;
  const born = new Map();
  // window of years around "now": wide where history is thin, narrow where it is dense
  function windowFor(year, dist, playing, speed) {
    let w = dist > 3 ? 22 : dist > 1.8 ? 12 : dist > 1.3 ? 7 : 4;
    w *= year < -1000 ? 14 : year < -500 ? 8 : year < 500 ? 3.5 : year < 1500 ? 1.6 : year < 1800 ? .8 : .45;
    if (playing) w = Math.max(w, speed * 1.2);
    return Math.max(1.5, w);
  }
  function recompute(year, cam, viewDeg, playing, speed, now) {
    const key = [Math.round(year), cam.lat.toFixed(1), cam.lon.toFixed(1), cam.dist.toFixed(2), playing].join();
    if (!loaded || (key === lastKey) || now - lastCalc < 120) return; lastKey = key; lastCalc = now;
    const c = llToXYZ(cam.lat, cam.lon), cosV = Math.cos(Math.min(89, viewDeg) * Math.PI / 180);
    const inView = e => e.v[0] * c[0] + e.v[1] * c[1] + e.v[2] * c[2] > cosV;
    win = windowFor(year, cam.dist, playing, speed);
    const limit = cam.dist > 3.2 ? 12 : cam.dist > 2.2 ? 16 : cam.dist > 1.5 ? 24 : 34, cand = [];
    for (let i = lowerBound(year - win), n = rows.length; i < n && rows[i].year <= year + win; i++) { const e = rows[i]; if (!inView(e)) continue; const dy = Math.abs(e.year - year) / win; cand.push({ e, score: e.fame * (1 - dy * .6) * (e.type === 'city' ? .55 : 1) }); }
    cand.sort((a, b) => b.score - a.score);
    visible = cand.slice(0, limit).map(c => c.e);
    if (selectedId && byId.has(selectedId) && !visible.includes(byId.get(selectedId))) visible.push(byId.get(selectedId));
    for (const e of visible) if (!born.has(e.id)) born.set(e.id, now);
    if (born.size > 600) for (const id of born.keys()) if (!visible.some(e => e.id === id)) born.delete(id);
    // well-known cities founded before now, when zoomed in
    cityList = [];
    if (cam.dist < 2.7) { const max = cam.dist < 1.3 ? 16 : cam.dist < 1.8 ? 11 : 6; for (const e of cities) { if (e.year > year || !inView(e)) continue; cityList.push({ name: e.name, lat: e.lat, lon: e.lon, a: Math.min(1, (2.7 - cam.dist) * 3) }); if (cityList.length >= max) break; } }
  }
  let screen = []; const P = {};
  function draw(env, year) {
    screen = []; if (!enabled) return; const { ctx, now } = env;
    const list = [];
    for (const e of visible) {
      env.project(e.lat, e.lon, 1.006, P); if (P.facing < .08 || env.underUI(P.x, P.y)) continue;
      const dy = Math.abs(e.year - year) / win, sel = e.id === selectedId;
      const a = sel ? 1 : Math.max(0, Math.min(1, (1 - dy) * 2.2)) * Math.min(1, (P.facing - .08) * 6); if (a <= .02) continue;
      list.push({ e, x: P.x, y: P.y, a, sel });
    }
    // cluster markers that would overlap
    for (const m of list) { const host = screen.find(s => Math.hypot(s.x - m.x, s.y - m.y) < 24); if (host && !m.sel && !host.sel) { host.more.push(m.e); continue; } screen.push({ ...m, more: [] }); }
    for (const m of screen) {
      const age = (now - (born.get(m.e.id) || 0)) / 1000, pop = age < .45 ? 1 + (1 - age / .45) * .7 : 1, im = img(m.e.icon, m.sel), size = (m.sel ? 30 : 24) * pop;
      ctx.globalAlpha = m.a;
      if (age < .7) { ctx.beginPath(); ctx.arc(m.x, m.y, 12 + age * 30, 0, 7); ctx.strokeStyle = `rgba(246,220,148,${(1 - age / .7) * .8})`; ctx.lineWidth = 1.5; ctx.stroke(); }
      if (m.sel) { ctx.beginPath(); ctx.arc(m.x, m.y, 19 + Math.sin(now / 300) * 1.5, 0, 7); ctx.strokeStyle = 'rgba(255,227,154,.7)'; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.drawImage(im, m.x - size / 2, m.y - size / 2, size, size);
      if (m.more.length) { ctx.beginPath(); ctx.arc(m.x + 10, m.y - 9, 7.5, 0, 7); ctx.fillStyle = '#f6dc94'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#1a1206'; ctx.font = '700 10px system-ui,sans-serif'; ctx.letterSpacing = '0px'; ctx.fillText(String(m.more.length + 1), m.x + 10, m.y - 8.5); }
      env.take([m.x - 13, m.y - 13, m.x + 13, m.y + 13]);
    }
    ctx.globalAlpha = 1;
  }
  function hit(x, y) { let best = null, bd = 16; for (const m of screen) { const d = Math.hypot(m.x - x, m.y - y); if (d < bd) { bd = d; best = m; } } return best ? [best.e, ...best.more] : null; }
  return {
    ready, recompute, draw, hit, byId: id => byId.get(id), get rows() { return rows; }, get loaded() { return loaded; }, get visible() { return visible; }, cities: () => cityList,
    select(id) { selectedId = id; lastKey = ''; }, setEnabled(v) { enabled = v; }, get screen() { return screen; }
  };
}
