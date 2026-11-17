// Web Worker: loads one prepared border snapshot and builds everything the main thread needs,
// so switching maps never blocks a frame: triangulated fills on the sphere, line segments, pick rings.
import earcut from 'earcut';
import { colorFor, hexToRgb, isColony } from './colors.js';
import { newLineData, addPath, packLineData, MAX_EDGE } from './linegeom.js';

const D2R = Math.PI / 180, Q = 1000;
function decodeRing(d) { const n = d.length, o = new Float32Array(n); let x = 0, y = 0; for (let i = 0; i < n; i += 2) { x = i ? x + d[i] : d[i]; y = i ? y + d[i + 1] : d[i + 1]; o[i] = x / Q; o[i + 1] = y / Q; } return o; }
function xyz(lon, lat, out, o) { const phi = (lon + 180) * D2R, th = (90 - lat) * D2R, s = Math.sin(th); out[o] = -Math.cos(phi) * s; out[o + 1] = Math.cos(th); out[o + 2] = Math.sin(phi) * s; }
// an edge is "long" by a criterion that depends only on its two end points, so neighbours split it identically
function tooLong(ax, ay, bx, by) { const k = Math.sqrt(Math.max(.05, Math.cos((ay + by) * .5 * D2R))); return Math.max(Math.abs(ax - bx) * k, Math.abs(ay - by)) > MAX_EDGE; }

function build(snap) {
  const year = snap.year, feats = snap.f;
  const names = [], nameId = new Map(), groups = [], groupId = new Map();
  const pos = [], col = [], ids = [], idx = []; // fills
  const lines = newLineData();
  const pickRings = [], features = [];
  let vcount = 0;

  for (let fi = 0; fi < feats.length; fi++) {
    const f = feats[fi], group = f.s || f.n;
    let nid = nameId.get(f.n); if (nid === undefined) { nid = names.length; names.push(f.n); nameId.set(f.n, nid); }
    let gid = groupId.get(group);
    if (gid === undefined) { gid = groups.length; groupId.set(group, gid); groups.push({ key: group, area: 0, best: -1, label: null, color: colorFor(group), kind: 2, n: 0 }); }
    const g = groups[gid]; g.area += f.a; g.n++; g.kind = Math.min(g.kind, f.k);
    if (f.a > g.best) { g.best = f.a; g.label = f.l; }
    const rgb = hexToRgb(g.color), people = f.k === 2, colony = isColony(year, f.n, group);
    const alpha = people ? .13 : f.p > 1 ? .5 : .42, flags = (colony ? 1 : 0) + (people ? 2 : 0);
    const style = people ? 2 : f.p > 1 ? 0 : 1;
    const rings = [];
    for (const poly of f.g) {
      const dec = poly.map(decodeRing); rings.push(...dec);
      // triangulate in lon/lat, then split long edges so flat triangles hug the sphere
      const flat = [], holes = []; let off = 0;
      for (let r = 0; r < dec.length; r++) { if (r) holes.push(off / 2); for (let i = 0; i < dec[r].length; i++) flat.push(dec[r][i]); off += dec[r].length; }
      const tri = earcut(flat, holes, 2), base = vcount, mid = new Map();
      const vx = flat; // grows with midpoints
      const emitV = () => { const n = vx.length / 2 - (vcount - base); for (let k = vcount - base; k < vcount - base + n; k++) { const o = pos.length; pos.length += 3; xyz(vx[k * 2], vx[k * 2 + 1], pos, o); col.push(rgb[0], rgb[1], rgb[2], alpha); ids.push(nid, gid, flags); } vcount += n; };
      const midpoint = (a, b) => { const key = a < b ? a * 1e7 + b : b * 1e7 + a; let m = mid.get(key); if (m === undefined) { m = vx.length / 2; vx.push((vx[a * 2] + vx[b * 2]) / 2, (vx[a * 2 + 1] + vx[b * 2 + 1]) / 2); mid.set(key, m); } return m; };
      const stack = []; for (let t = 0; t < tri.length; t += 3) stack.push(tri[t], tri[t + 1], tri[t + 2]);
      let guard = 0;
      while (stack.length && guard++ < 400000) {
        const c = stack.pop(), b = stack.pop(), a = stack.pop();
        const ax = vx[a * 2], ay = vx[a * 2 + 1], bx = vx[b * 2], by = vx[b * 2 + 1], cx = vx[c * 2], cy = vx[c * 2 + 1];
        const lab = tooLong(ax, ay, bx, by), lbc = tooLong(bx, by, cx, cy), lca = tooLong(cx, cy, ax, ay);
        if (!lab && !lbc && !lca) { idx.push(base + a, base + b, base + c); continue; }
        // bisect the longest of the long edges
        const dab = lab ? (ax - bx) ** 2 + (ay - by) ** 2 : -1, dbc = lbc ? (bx - cx) ** 2 + (by - cy) ** 2 : -1, dca = lca ? (cx - ax) ** 2 + (cy - ay) ** 2 : -1;
        if (dab >= dbc && dab >= dca) { const m = midpoint(a, b); stack.push(a, m, c, m, b, c); }
        else if (dbc >= dca) { const m = midpoint(b, c); stack.push(a, b, m, a, m, c); }
        else { const m = midpoint(c, a); stack.push(a, b, m, m, b, c); }
      }
      emitV();
      for (const r of dec) addPath(lines, r, true, style, rgb);
    }
    pickRings.push(rings);
    features.push({ n: f.n, group, nid, gid, k: f.k, p: f.p, a: f.a, l: f.l, bb: f.bb, po: f.po || '', colony });
  }
  const unclaimed = snap.u.map(poly => poly.map(decodeRing));
  const out = {
    year, features, names, groups: groups.map(g => ({ key: g.key, area: g.area, label: g.label, color: g.color, kind: g.kind, n: g.n })),
    fill: { pos: new Float32Array(pos), col: new Float32Array(col), ids: new Float32Array(ids), idx: new Uint32Array(idx) },
    line: packLineData(lines),
    pickRings, unclaimed
  };
  const transfer = [out.fill.pos.buffer, out.fill.col.buffer, out.fill.ids.buffer, out.fill.idx.buffer, out.line.a.buffer, out.line.b.buffer, out.line.style.buffer, out.line.col.buffer, out.line.dist.buffer];
  for (const rs of pickRings) for (const r of rs) transfer.push(r.buffer);
  for (const rs of unclaimed) for (const r of rs) transfer.push(r.buffer);
  return [out, transfer];
}

self.onmessage = async e => {
  const { id, url } = e.data;
  try {
    const res = await fetch(url); if (!res.ok) throw new Error('HTTP ' + res.status);
    const [out, transfer] = build(await res.json());
    self.postMessage({ id, ok: true, data: out }, transfer);
  } catch (err) { self.postMessage({ id, ok: false, error: String(err.message || err) }); }
};
