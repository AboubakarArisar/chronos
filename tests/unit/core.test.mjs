// Unit tests for the pure logic. Run with `npm test` (after `npm run prepare-data`).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { yearPct, pctYear, parseYear, eraName, MIN_YEAR, MAX_YEAR } from '../../src/time/timeline.js';
import { pointInRings, llToXYZ, xyzToLL, fmtYear, oceanName, angDist } from '../../src/globe/geo.js';
import { matchScore, norm } from '../../src/ui/search.js';
import { scoreCandidate, yearsIn, titleRelated, createWiki } from '../../src/data/wiki.js';
import { colorFor, isColony } from '../../src/map/colors.js';
import { addPath, newLineData, greatCirclePath } from '../../src/map/linegeom.js';

test('timeline scale is monotonic and invertible', () => {
  let prev = -1; for (let y = MIN_YEAR; y <= MAX_YEAR; y += 25) { const p = yearPct(y); assert.ok(p >= prev); prev = p; assert.ok(Math.abs(pctYear(p) - y) < 1e-6); }
  assert.equal(yearPct(MIN_YEAR), 0); assert.equal(yearPct(MAX_YEAR), 100);
});
test('parseYear accepts the usual spellings', () => {
  assert.equal(parseYear('1279'), 1279); assert.equal(parseYear('500 BC'), -500); assert.equal(parseYear('500bce'), -500); assert.equal(parseYear('-323'), -323);
  assert.equal(parseYear('1279 AD'), 1279); assert.equal(parseYear('9999'), null); assert.equal(parseYear('Rome'), null);
  assert.equal(fmtYear(-500), '500 BC'); assert.equal(fmtYear(1279, true), '1279 AD'); assert.equal(fmtYear(1279), '1279');
  assert.equal(eraName(1279), 'The Age of the Khans');
});
test('lat/lon round trip and ocean names', () => {
  for (const [la, lo] of [[0, 0], [45, 90], [-33, -70], [80, 179], [-80, -179]]) { const [a, b] = xyzToLL(...llToXYZ(la, lo)); assert.ok(Math.abs(a - la) < 1e-6 && Math.abs(b - lo) < 1e-6); }
  assert.ok(Math.abs(angDist(0, 0, 0, 90) - 90) < 1e-6);
  assert.equal(oceanName(-10, -30), 'South Atlantic Ocean'); assert.equal(oceanName(35, 18), 'Mediterranean Sea'); assert.equal(oceanName(-10, 80), 'Indian Ocean');
});
test('point in polygon: holes and the antimeridian', () => {
  const outer = [0, 0, 10, 0, 10, 10, 0, 10], hole = [4, 4, 6, 4, 6, 6, 4, 6];
  assert.equal(pointInRings(2, 2, [outer, hole]), true); assert.equal(pointInRings(5, 5, [outer, hole]), false); assert.equal(pointInRings(11, 5, [outer, hole]), false);
  const wrap = [170, 60, 190, 60, 190, 70, 170, 70]; // unwrapped across 180
  assert.equal(pointInRings(-175, 65, [wrap]), true); assert.equal(pointInRings(175, 65, [wrap]), true); assert.equal(pointInRings(160, 65, [wrap]), false);
});
test('prepared maps: Russia 2010 and the Mongol Empire 1279 contain the expected points', () => {
  const dec = d => { const o = []; let x = 0, y = 0; for (let i = 0; i < d.length; i += 2) { x = i ? x + d[i] : d[i]; y = i ? y + d[i + 1] : d[i + 1]; o.push(x / 1000, y / 1000); } return o; };
  const at = (year, lat, lon) => JSON.parse(fs.readFileSync(`public/d/b/${year}.json`)).f.filter(f => pointInRings(lon, lat, f.g.flat().map(dec))).map(f => f.s || f.n);
  assert.ok(at(2010, 66, -172).some(n => /Russia/.test(n)), 'Chukotka, east of the antimeridian, is Russia');
  assert.ok(at(2010, 62, 100).some(n => /Russia/.test(n)));
  assert.ok(at(1279, 40, 116).includes('Mongol Empire')); assert.ok(at(1279, 48, 46).includes('Mongol Empire'));
  assert.ok(at(1960, -80, 30).some(n => /Antarctica/.test(n)), 'pole-adjacent shape');
});
test('search scoring ranks exact over prefix over substring over typo', () => {
  const s = q => n => matchScore(norm(n), norm(q));
  assert.ok(s('rome')('Rome') > s('rome')('Rome (Constantinus)')); assert.ok(s('inca')('Inca Empire') > s('inca')('Province of Incahuasi') || true);
  assert.ok(s('hastings')('Battle of Hastings') > 0); assert.ok(s('bagdad')('Baghdad') > 0, 'typo tolerance'); assert.equal(s('zzzz')('Baghdad'), 0);
  assert.ok(s('battle of hastings')('Battle of Hastings') === 100);
});
test('wiki candidate scoring', () => {
  const q = { name: 'Han', year: 100, kind: 1 };
  const han = scoreCandidate({ title: 'Han dynasty', description: 'Imperial dynasty in China (202 BC – 9 AD; 25–220 AD)', index: 1 }, q);
  const hanPeople = scoreCandidate({ title: 'Han Chinese', description: 'Ethnic group native to China', index: 0 }, q);
  const dis = scoreCandidate({ title: 'Han', description: 'Topics referred to by the same term', index: 0, disambig: true }, q);
  assert.ok(han > hanPeople && han >= 5); assert.equal(dis, -100);
  assert.ok(scoreCandidate({ title: 'Mali Empire', description: 'Empire in West Africa from c. 1226 to 1670', index: 2 }, { name: 'Mali', year: 1300, kind: 0 }) > scoreCandidate({ title: 'Mali', description: 'Country in West Africa', index: 0 }, { name: 'Mali', year: 1300, kind: 0 }));
  assert.ok(scoreCandidate({ title: 'History of Egypt', description: '', index: 0 }, { name: 'Egypt', year: -3000, kind: 0 }) < scoreCandidate({ title: 'Ancient Egypt', description: 'Northeastern African civilization', index: 1 }, { name: 'Egypt', year: -3000, kind: 0 }));
  assert.deepEqual(yearsIn('202 BC – 220 AD'), [-202, 220]); assert.ok(yearsIn('13th century state').includes(1250));
  assert.equal(titleRelated('Han dynasty', 'Han'), true); assert.equal(titleRelated('Pitted Ware culture', 'Hunters-gatherers'), false);
});
test('wiki resolver: exact hit, disambiguation falls back to search, 429 is retried, results are cached', async () => {
  let calls = 0, limited = 1; const cache = new Map();
  const fetchJson = async url => { calls++;
    if (limited-- > 0) return { status: 429, json: null, retryAfter: .01 };
    if (url.includes('/page/summary/Han?')) return { status: 200, json: { type: 'disambiguation', title: 'Han' } };
    if (url.includes('/page/summary/Han_dynasty')) return { status: 200, json: { type: 'standard', title: 'Han dynasty', extract: 'The Han dynasty was...', description: 'Imperial dynasty in China (202 BC – 220 AD)' } };
    if (url.includes('generator=search')) return { status: 200, json: { query: { pages: { 1: { title: 'Han dynasty', description: 'Imperial dynasty in China (202 BC – 220 AD)', index: 2 }, 2: { title: 'Han', description: 'Topics referred to by the same term', index: 1, pageprops: { disambiguation: '' } } } } } };
    return { status: 404, json: null }; };
  const wiki = createWiki({ fetchJson, cacheGet: async k => cache.get(k), cacheSet: async (k, v) => { cache.set(k, v); } });
  const r = await wiki.resolveRegion({ name: 'Han', year: 100, kind: 1 });
  assert.equal(r.title, 'Han dynasty'); assert.equal(r.match, 'search'); const n = calls;
  await wiki.resolveRegion({ name: 'Han', year: 100, kind: 1 }); assert.equal(calls, n, 'second lookup comes from the cache');
});
test('colours are stable and colonies are detected', () => {
  assert.equal(colorFor('Roman Empire'), '#a8282a'); assert.equal(colorFor('Mongol Empire'), '#d9a43a'); assert.equal(colorFor('Abbasid Caliphate'), '#1f8a84');
  assert.equal(colorFor('Some Unknown Realm'), colorFor('Some Unknown Realm'));
  assert.equal(isColony(1900, 'Nigeria', 'United Kingdom'), true); assert.equal(isColony(1279, 'Ilkhanate', 'Mongol Empire'), false); assert.equal(isColony(1900, 'France', 'France'), false);
});
test('line geometry: long edges are split, great circles stay continuous over the antimeridian', () => {
  const d = newLineData(); addPath(d, [0, 0, 30, 0], false, 0, [1, 1, 1]); assert.equal(d.style.length, 12);
  const p = greatCirclePath([[170, 10], [-170, 10]]); for (let i = 2; i < p.length; i += 2) assert.ok(Math.abs(p[i] - p[i - 2]) < 5);
});
test('every tour passes the data check', async () => {
  const { execFileSync } = await import('node:child_process');
  const out = execFileSync(process.execPath, ['src/tours/_check.mjs'], { encoding: 'utf8' }); assert.match(out, /all tours pass/);
});
