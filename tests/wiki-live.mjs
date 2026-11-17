// Live check of the Wikipedia resolver: node tests/wiki-live.mjs  (needs a connection)
import fs from 'node:fs';
import { createWiki } from '../src/data/wiki.js';
const regions = JSON.parse(fs.readFileSync(new URL('../public/d/regions.json', import.meta.url)));
const fetchJson = async url => { const r = await fetch(url, { headers: { 'User-Agent': 'ChronosHistoryGlobe/1.0 (open source test script)', Accept: 'application/json' } }); let json = null; try { json = await r.json(); } catch {} return { status: r.status, json, retryAfter: +r.headers.get('retry-after') || 0 }; };
const wiki = createWiki({ fetchJson });
const q = (name, year) => { const r = regions[name]; if (!r) return { name, year, kind: 0 }; return { name, year: year ?? r[1][0], kind: r[0], wikiSearch: r[3] }; };
const must = [['Han', 100, /Han dynasty/], ['Roman Empire', 100, /Roman Empire/], ['Great Khanate', 1279, /Yuan|Mongol|Khan/], ['Khanate of the Golden Horde', 1279, /Golden Horde/], ['Egypt', -3000, /Ancient Egypt|Dynastic/], ['Mali', 1300, /Mali Empire/], ['Tang Empire', 800, /Tang/], ['Sultanate of Delhi', 1279, /Delhi Sultanate/], ['Inca Empire', 1500, /Inca/], ["Kievan Rus'", 1000, /Kievan Rus/], ['Bantu peoples', 800, /Bantu/]];
let seed = 42; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const names = Object.keys(regions); const random = []; while (random.length < 30) { const n = names[Math.floor(rnd() * names.length)]; if (!random.includes(n)) random.push(n); }
const out = { date: new Date().toISOString().slice(0, 10), must: [], random: [] }; let fail = 0;
for (const [name, year, re] of must) {
  const r = await wiki.resolveRegion(q(name, year)).catch(e => ({ error: e.message }));
  const ok = !!r && !r.error && re.test(r.title); if (!ok) fail++;
  out.must.push({ name, year, title: r?.title || null, match: r?.match || r?.error || 'none', ok }); console.log(ok ? 'ok  ' : 'FAIL', name, year, '->', r?.title, r?.match, r?.score ?? '');
  await new Promise(r => setTimeout(r, 900));
}
for (const name of random) {
  const r = await wiki.resolveRegion(q(name)).catch(e => ({ error: e.message }));
  out.random.push({ name, years: regions[name][1][0] + '..' + regions[name][1].at(-1), title: r?.title || null, match: r?.match || r?.error || 'none', desc: r?.description || '' });
  console.log('    ', name, '->', r?.title, '|', r?.match, '|', (r?.description || '').slice(0, 60));
  await new Promise(r => setTimeout(r, 900));
}
fs.writeFileSync(new URL('./results/wiki.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(fail ? fail + ' required lookups failed' : 'all required lookups passed'); process.exit(fail ? 1 : 0);
