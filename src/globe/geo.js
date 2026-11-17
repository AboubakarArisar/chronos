// Shared lat/lon helpers. Convention from manifest.json (matches THREE.SphereGeometry UVs).
export const D2R = Math.PI / 180;

export function llToXYZ(lat, lon, r = 1, out = [0, 0, 0]) {
  const phi = (lon + 180) * D2R, th = (90 - lat) * D2R, s = Math.sin(th);
  out[0] = -Math.cos(phi) * s * r; out[1] = Math.cos(th) * r; out[2] = Math.sin(phi) * s * r;
  return out;
}
export function xyzToLL(x, y, z) {
  const r = Math.hypot(x, y, z) || 1;
  const lat = 90 - Math.acos(Math.max(-1, Math.min(1, y / r))) / D2R;
  let lon = Math.atan2(z, -x) / D2R - 180;
  if (lon < -180) lon += 360;
  return [lat, lon];
}
export const wrapLon = l => ((l + 180) % 360 + 360) % 360 - 180;
export function angDist(lat1, lon1, lat2, lon2) { // degrees
  const a = llToXYZ(lat1, lon1), b = llToXYZ(lat2, lon2);
  return Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) / D2R;
}
// Even-odd point in polygon over flat [lon,lat,...] rings; rings are unwrapped so test lon and lon +- 360.
export function pointInRings(lon, lat, rings) {
  for (const off of [0, 360, -360]) {
    const x = lon + off; let inside = false;
    for (const r of rings) for (let i = 0, n = r.length, j = n - 2; i < n; j = i, i += 2) {
      const yi = r[i + 1], yj = r[j + 1];
      if ((yi > lat) !== (yj > lat) && x < (r[j] - r[i]) * (lat - yi) / (yj - yi) + r[i]) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}
export function fmtYear(y, big = false) {
  y = Math.round(y);
  if (y < 0) return -y + ' BC';
  if (y === 0) return '1 BC';
  return big ? y + ' AD' : String(y);
}
export function oceanName(lat, lon) {
  if (lat > 66) return 'Arctic Ocean';
  if (lat < -60) return 'Southern Ocean';
  if (lat > 30 && lat < 46 && lon > -6 && lon < 36) return 'Mediterranean Sea';
  if (lat > 40 && lat < 47.5 && lon > 27 && lon < 42) return 'Black Sea';
  if (lat > 36 && lat < 47.5 && lon > 46.5 && lon < 55) return 'Caspian Sea';
  if (lat > 12 && lat < 30 && lon > 32 && lon < 44) return 'Red Sea';
  if (lat > 8 && lat < 31 && lon > -98 && lon < -60) return lon < -80 && lat > 18 ? 'Gulf of Mexico' : 'Caribbean Sea';
  if (lat > 0 && lat < 25 && lon > 105 && lon < 121) return 'South China Sea';
  if (lat > 5 && lat < 25 && lon > 50 && lon < 78) return 'Arabian Sea';
  if (lat > 5 && lat < 23 && lon > 78 && lon < 98) return 'Bay of Bengal';
  if (lon > 20 && lon < 147 && lat < 30) return 'Indian Ocean';
  if (lon >= -70 && lon <= 20) return lat >= 0 ? 'North Atlantic Ocean' : 'South Atlantic Ocean';
  if (lon > -100 && lon < -70 && lat > 8) return 'North Atlantic Ocean';
  return lat >= 0 ? 'North Pacific Ocean' : 'South Pacific Ocean';
}
