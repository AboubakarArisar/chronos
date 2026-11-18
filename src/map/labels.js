// 2D overlay above the globe: realm names, city names and (via registered drawers) event markers.
// A plain canvas, so creator mode can composite it into recordings.
export function createLabels(globe, canvas, { getSnap, getSelection, getFonts, getCities }) {
  const ctx = canvas.getContext('2d');
  const state = new Map(), widths = new Map(), drawers = [];
  let W = 2, H = 2, pr = 1, uiRects = [], lastRects = 0, density = 1, hideUI = false;
  const DENS = { low: .45, medium: 1, high: 1.7 };
  function resize(w, h, p) { W = w; H = h; pr = p; canvas.width = Math.round(w * p); canvas.height = Math.round(h * p); }
  globe.onResize = resize; { const s = globe.size; resize(s.w, s.h, s.pr); }
  function refreshRects(now) {
    if (now - lastRects < 350) return; lastRects = now; uiRects = [];
    if (hideUI || document.body.classList.contains('recording') || document.body.classList.contains('intro')) return;
    const cr = canvas.getBoundingClientRect(), kx = W / (cr.width || W), ky = H / (cr.height || H);
    for (const el of document.querySelectorAll('#ui .frame')) { if (el.hidden) continue; const r = el.getBoundingClientRect(); if (r.width) uiRects.push([(r.left - cr.left) * kx - 8, (r.top - cr.top) * ky - 8, (r.right - cr.left) * kx + 8, (r.bottom - cr.top) * ky + 8]); }
  }
  const underUIRect = r => underUI(r[0], (r[1] + r[3]) / 2) || underUI(r[2], (r[1] + r[3]) / 2) || underUI((r[0] + r[2]) / 2, r[1]) || underUI((r[0] + r[2]) / 2, r[3]);
  const underUI = (x, y) => { for (const r of uiRects) if (x > r[0] && x < r[2] && y > r[1] && y < r[3]) return true; return false; };
  let placed = [];
  const overlaps = (a) => { for (const b of placed) if (a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]) return true; return false; };
  function textW(text, font, ls) { const k = font + '|' + ls + '|' + text; let w = widths.get(k); if (w === undefined) { ctx.font = font; ctx.letterSpacing = ls + 'px'; w = ctx.measureText(text).width; if (widths.size > 4000) widths.clear(); widths.set(k, w); } return w; }
  const P = {};
  function draw(dt, now = performance.now()) {
    refreshRects(now);
    ctx.setTransform(pr, 0, 0, pr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    placed = [];
    const env = { ctx, W, H, pr, project: globe.project, underUI, overlaps, take: r => placed.push(r), dt, now };
    for (const d of drawers) d(env);
    const snap = getSnap(), fonts = getFonts(), sel = getSelection(), dpp = globe.degPerPx(), dist = globe.cam.dist;
    const cands = [];
    if (snap?.data) {
      const max = Math.round((dist > 3 ? 16 : dist > 1.8 ? 24 : 30) * density);
      const selGroup = sel ? (sel.group ?? snap.data.byName.get(sel.name)?.[0]?.group) : null;
      const groups = snap.data.groups; let n = 0;
      const order = snap.data._labelOrder ??= groups.map((g, i) => i).sort((a, b) => groups[b].area - groups[a].area);
      for (const gi of order) {
        const g = groups[gi]; if (!g.label) continue; const isSel = g.key === selGroup;
        if (g.kind === 2 && dist > 2.3 && !isSel) continue;
        const pxR = g.label[2] / dpp; if (pxR < (g.kind === 2 ? 26 : 13) && !isSel) continue;
        if (n >= max && !isSel) continue; n++;
        cands.push({ key: g.key, text: g.key.toUpperCase(), lat: g.label[0], lon: g.label[1], pxR, kind: g.kind, sel: isSel, pri: isSel ? 1e12 : g.area });
      }
      cands.sort((a, b) => b.pri - a.pri);
    }
    const seen = new Set();
    for (const c of cands) {
      let st = state.get(c.key); if (!st) { st = { a: 0, lat: c.lat, lon: c.lon }; state.set(c.key, st); }
      // glide when the label point moves between maps
      let dl = c.lon - st.lon; if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
      const k = Math.min(1, dt * 4); st.lat += (c.lat - st.lat) * k; st.lon += dl * k;
      globe.project(st.lat, st.lon, 1.004, P);
      let ok = P.facing > .24 && P.x > -50 && P.x < W + 50 && P.y > -20 && P.y < H + 20 && !underUI(P.x, P.y);
      let size = Math.max(c.sel ? 13 : 9.5, Math.min(c.sel ? 30 : c.kind === 2 ? 12 : 26, c.pxR * .34)), ls = size * (c.kind === 2 ? .12 : size > 15 ? .3 : .18);
      const font = `700 ${size.toFixed(1)}px "${fonts.cap}",serif`;
      let w = textW(c.text, font, ls); const budget = Math.max(60, c.pxR * 3.2);
      if (w > budget) { const f = Math.max(.6, budget / w); size *= f; ls *= f; w *= f; if (size < 9 && !c.sel) ok = false; }
      const rect = [P.x - w / 2 - 6, P.y - size * .8 - 2, P.x + w / 2 + 6, P.y + size * .8 + 2];
      if (ok && (overlaps(rect) || underUIRect(rect))) ok = false;
      if (ok) placed.push(rect);
      seen.add(c.key); st.t = ok ? 1 : 0; st.size = size; st.ls = ls; st.text = c.text; st.kind = c.kind; st.sel = c.sel; st.fade = Math.max(0, Math.min(1, (P.facing - .22) * 5)); st.x = P.x; st.y = P.y;
    }
    for (const [key, st] of state) {
      if (!seen.has(key)) st.t = 0;
      st.a += (st.t - st.a) * Math.min(1, dt * 7);
      if (st.a < .015) { if (!st.t) state.delete(key); continue; }
      if (st.t === 0 && seen.has(key) === false) { globe.project(st.lat, st.lon, 1.004, P); st.x = P.x; st.y = P.y; }
      const size = st.size || 12;
      ctx.font = `700 ${size.toFixed(1)}px "${fonts.cap}",serif`; ctx.letterSpacing = (st.ls || 0) + 'px';
      ctx.globalAlpha = st.a * (st.fade ?? 1) * (st.kind === 2 ? .72 : 1);
      ctx.lineWidth = Math.max(2.5, size * .22); ctx.strokeStyle = 'rgba(0,0,0,.78)'; ctx.strokeText(st.text, st.x, st.y);
      ctx.fillStyle = st.sel ? '#fff0c8' : '#f3e1b8'; ctx.fillText(st.text, st.x, st.y);
    }
    // cities: diamond + name, when zoomed in
    const cities = getCities?.() || [];
    if (cities.length) {
      ctx.letterSpacing = '0px'; ctx.textAlign = 'left'; const font = `600 14.5px "${fonts.body}",serif`; ctx.font = font;
      for (const c of cities) {
        globe.project(c.lat, c.lon, 1.004, P); if (P.facing < .15 || underUI(P.x, P.y)) continue;
        const w = textW(c.name, font, 0), rect = [P.x - 8, P.y - 9, P.x + 12 + w, P.y + 9]; if (overlaps(rect) || underUIRect(rect)) continue; placed.push(rect);
        ctx.globalAlpha = Math.min(1, (P.facing - .15) * 5) * c.a;
        ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#000'; ctx.fillRect(-4.5, -4.5, 9, 9); ctx.fillStyle = '#f6dc94'; ctx.fillRect(-3.3, -3.3, 6.6, 6.6); ctx.restore();
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(c.name, P.x + 10, P.y + 1); ctx.fillStyle = '#fff4d8'; ctx.fillText(c.name, P.x + 10, P.y + 1);
      }
      ctx.textAlign = 'center';
    }
    ctx.globalAlpha = 1;
  }
  return { draw, canvas, addDrawer: (d, first = true) => first ? drawers.unshift(d) : drawers.push(d), setDensity: d => { density = DENS[d] ?? 1; }, setHideUI: v => { hideUI = v; lastRects = 0; } };
}
