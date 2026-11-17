// Turns lon/lat paths into short great-circle-hugging segments for the fat line shader.
// Used by the worker (all borders) and the main thread (selection outline, ghosts, tour routes).
const D2R = Math.PI / 180;
export const MAX_EDGE = 2.5; // degrees; same value as the fill subdivision so lines sit on fill edges
function xyz(lon, lat, out, o) { const phi = (lon + 180) * D2R, th = (90 - lat) * D2R, s = Math.sin(th); out[o] = -Math.cos(phi) * s; out[o + 1] = Math.cos(th); out[o + 2] = Math.sin(phi) * s; }
export const newLineData = () => ({ a: [], b: [], style: [], col: [], dist: [] });

// path: flat [lon,lat,...]. closed rings skip the artificial edge that runs along a pole.
export function addPath(out, path, closed, style, rgb, maxEdge = MAX_EDGE) {
  const n = path.length, last = closed ? n : n - 2; let dist = 0;
  for (let i = 0; i < last; i += 2) {
    const j = (i + 2) % n; let ax = path[i], ay = path[i + 1]; const bx = path[j], by = path[j + 1];
    if (Math.abs(ay) > 89.9 && Math.abs(by) > 89.9) continue;
    const k = Math.sqrt(Math.max(.05, Math.cos((ay + by) * .5 * D2R)));
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(ax - bx) * k, Math.abs(ay - by)) / maxEdge));
    for (let s = 1; s <= steps; s++) {
      const cx = path[i] + (bx - path[i]) * s / steps, cy = path[i + 1] + (by - path[i + 1]) * s / steps, o = out.a.length;
      out.a.length += 3; out.b.length += 3; xyz(ax, ay, out.a, o); xyz(cx, cy, out.b, o);
      const d = Math.hypot(out.a[o] - out.b[o], out.a[o + 1] - out.b[o + 1], out.a[o + 2] - out.b[o + 2]);
      out.style.push(style); out.col.push(rgb[0], rgb[1], rgb[2]); out.dist.push(dist, dist + d); dist += d; ax = cx; ay = cy;
    }
  }
  return dist;
}
export const packLineData = d => ({ a: new Float32Array(d.a), b: new Float32Array(d.b), style: new Float32Array(d.style), col: new Float32Array(d.col), dist: new Float32Array(d.dist) });

// Great-circle path between lon/lat points (for tour routes), returned as a flat lon/lat array.
export function greatCirclePath(points, stepDeg = 1.5) {
  const out = []; const v = (lon, lat) => { const p = [0, 0, 0]; xyz(lon, lat, p, 0); return p; };
  for (let i = 0; i < points.length - 1; i++) {
    const a = v(points[i][0], points[i][1]), b = v(points[i + 1][0], points[i + 1][1]);
    const ang = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))), n = Math.max(1, Math.ceil(ang / D2R / stepDeg)), so = Math.sin(ang) || 1;
    for (let s = i ? 1 : 0; s <= n; s++) {
      const t = s / n, ka = Math.sin((1 - t) * ang) / so, kb = Math.sin(t * ang) / so;
      const x = ang < 1e-9 ? a[0] : a[0] * ka + b[0] * kb, y = ang < 1e-9 ? a[1] : a[1] * ka + b[1] * kb, z = ang < 1e-9 ? a[2] : a[2] * ka + b[2] * kb, r = Math.hypot(x, y, z) || 1;
      const lat = 90 - Math.acos(Math.max(-1, Math.min(1, y / r))) / D2R; let lon = Math.atan2(z, -x) / D2R - 180; if (lon < -180) lon += 360;
      // keep longitudes continuous so addPath does not see a 360 degree jump
      if (out.length) { const pl = out[out.length - 2]; while (lon - pl > 180) lon -= 360; while (lon - pl < -180) lon += 360; }
      out.push(lon, lat);
    }
  }
  return out;
}
