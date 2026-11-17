// Validates every src/tours/*.json. Run from the project root: node src/tours/_check.mjs
import fs from 'node:fs';
import path from 'node:path';

const SNAP = [-3000, -2000, -1500, -1000, -700, -500, -400, -323, -300, -200, -100, -1, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1279, 1300, 1400, 1492, 1500, 1530, 1600, 1650, 1700, 1715, 1783, 1800, 1815, 1878, 1880, 1900, 1914, 1920, 1930, 1938, 1945, 1960, 1994, 2000, 2010];
const dir = 'src/tours';
const cache = {};
const num = (v) => typeof v === 'number' && Number.isFinite(v);

function realms(year) {
  const y = SNAP.filter((s) => s <= year).pop();
  if (y === undefined) return null;
  const file = `data/borders/world_${y < 0 ? 'bc' + -y : y}.geojson`;
  if (!cache[file]) {
    const set = new Set();
    for (const f of JSON.parse(fs.readFileSync(file, 'utf8')).features) {
      if (f.properties?.NAME) set.add(f.properties.NAME);
      if (f.properties?.SUBJECTO) set.add(f.properties.SUBJECTO);
    }
    cache[file] = set;
  }
  return { file, set: cache[file] };
}

let failed = 0;
for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const errs = [];
  let t;
  try {
    t = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
  } catch (e) {
    console.log(`FAIL ${name}: ${e.message}`);
    failed++;
    continue;
  }
  if (t.id + '.json' !== name) errs.push(`id "${t.id}" does not match file name`);
  for (const k of ['title', 'subtitle', 'skin']) if (typeof t[k] !== 'string' || !t[k]) errs.push(`missing ${k}`);
  if (!Array.isArray(t.sources) || !t.sources.length) errs.push('missing sources');
  const steps = Array.isArray(t.steps) ? t.steps : [];
  if (steps.length < 8 || steps.length > 12) errs.push(`${steps.length} steps (need 8 to 12)`);
  let prev = -Infinity;
  steps.forEach((s, i) => {
    const at = `step ${i + 1} (${s.year})`;
    if (!Number.isInteger(s.year) || s.year < -3000 || s.year > 2010) errs.push(`${at}: bad year`);
    if (s.year < prev) errs.push(`${at}: not chronological`);
    prev = s.year;
    if (!num(s.lat) || Math.abs(s.lat) > 90) errs.push(`${at}: bad lat`);
    if (!num(s.lon) || Math.abs(s.lon) > 180) errs.push(`${at}: bad lon`);
    if (!num(s.dist) || s.dist < 1.15 || s.dist > 4.2) errs.push(`${at}: bad dist`);
    if (typeof s.title !== 'string' || !s.title) errs.push(`${at}: missing title`);
    const text = typeof s.text === 'string' ? s.text : '';
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words < 25 || words > 90) errs.push(`${at}: text is ${words} words (need 25 to 90)`);
    if (/[—–]| - | -- /.test(text + ' ' + s.title)) errs.push(`${at}: dash used as punctuation`);
    if (s.realm !== null) {
      const r = Number.isInteger(s.year) ? realms(s.year) : null;
      if (typeof s.realm !== 'string' || !r || !r.set.has(s.realm)) errs.push(`${at}: realm "${s.realm}" not in ${r ? r.file : 'any snapshot'}`);
    }
    if (s.art !== null) {
      if (typeof s.art !== 'string' || !fs.existsSync(s.art)) errs.push(`${at}: art file missing: ${s.art}`);
      if (typeof s.artCaption !== 'string' || !s.artCaption) errs.push(`${at}: art without artCaption`);
    }
    if (s.route !== null) {
      if (!Array.isArray(s.route) || s.route.length < 2 || s.route.length > 12) errs.push(`${at}: route needs 2 to 12 points`);
      else s.route.forEach((p, j) => {
        if (!Array.isArray(p) || p.length !== 2 || !num(p[0]) || !num(p[1]) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90) errs.push(`${at}: route point ${j + 1} is not [lon, lat] in range`);
      });
    }
  });
  if (errs.length) {
    failed++;
    console.log(`FAIL ${name}\n  ` + errs.join('\n  '));
  } else {
    const routes = steps.filter((s) => s.route).length;
    console.log(`ok   ${name}: ${steps.length} steps, ${routes} routes, ${steps.filter((s) => s.art).length} art`);
  }
}
console.log(failed ? `${failed} tour file(s) failed` : 'all tours pass');
process.exit(failed ? 1 : 0);
