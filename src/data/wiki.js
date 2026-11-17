// Resolves a region name or an event to an English Wikipedia summary, live from the browser.
// Pure logic with injectable fetch + cache so it can be tested in Node (tests/unit/wiki.test.mjs).
const REST = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const API = 'https://en.wikipedia.org/w/api.php';
const MODERN = /\b(country|sovereign state|city|town|village|capital of|province|state of|region of|municipality|county|federal subject|commune|island|republic in|department|district|prefecture|u\.s\. state|territory of|autonomous)\b/i;
const HIST = /\b(empire|kingdom|dynasty|caliphate|sultanate|khanate|confederation|polity|civili[sz]ation|people|peoples|ethnic|tribe|tribes|historical|ancient|medieval|former|chiefdom|principality|duchy|realm|horde|culture|\d{3,4} ?(bc|bce|ad|ce)|bc|bce|century)\b/i;
const HIST_TITLE = /\b(empire|kingdom|dynasty|caliphate|sultanate|khanate|ancient|confederation|civili[sz]ation|duchy|principality|horde|people|peoples|culture|tribe)\b/i;
const BAD_TITLE = /^(history of|list of|timeline of|outline of|index of|geography of|economy of|demographics of)\b/i;
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// years mentioned in a description, as signed numbers ("202 BC – 220 AD", "1206–1368", "13th century")
export function yearsIn(text) {
  const out = []; if (!text) return out;
  const re = /(\d{1,4})\s*(BCE|BC|AD|CE)?/g; let m; const t = text.replace(/(\d+)(st|nd|rd|th)[ -]century( BCE?| BC)?/gi, (_, c, __, bc) => { const y = (c - 1) * 100 + 50; out.push(bc ? -y : y); return ' '; });
  const nums = []; while ((m = re.exec(t))) nums.push({ v: +m[1], era: (m[2] || '').toUpperCase() });
  for (let i = 0; i < nums.length; i++) { let era = nums[i].era; if (!era && nums[i + 1] && /^BC/.test(nums[i + 1].era) && nums[i].v >= nums[i + 1].v) era = 'BC'; if (!era && nums[i].v < 100) continue; out.push(/^BC/.test(era) ? -nums[i].v : nums[i].v); }
  return out;
}
export const titleRelated = (title, name) => { const t = norm(title.replace(/\(.*?\)/g, '')), n = norm(name); return t === n || t.includes(n) || (t.length > 3 && n.includes(t)); };
export function scoreCandidate(c, q) {
  // c: { title, description, index, disambig }   q: { name, year, kind }
  if (c.disambig || /disambiguation/i.test(c.description || '') || /\(disambiguation\)/i.test(c.title)) return -100;
  const t = norm(c.title.replace(/\(.*?\)/g, '')), n = norm(q.name), d = c.description || '', old = q.year < 1800;
  let s = -0.3 * (c.index || 0);
  if (t === n) s += 5; else if (t.startsWith(n + ' ') || t.endsWith(' ' + n) || t.includes(' ' + n + ' ')) s += 3; else if (n.includes(t) && t.length > 3) s += 1.5; else s -= 2;
  if (BAD_TITLE.test(c.title)) s -= 6;
  if (/\bborn \d|footballer|politician|actor|actress|singer|player|athlete|hurdler|film|album|song|novel|video game|company|band\b/i.test(d)) s -= 8;
  if (old || q.kind === 2) { if (HIST_TITLE.test(c.title)) s += 3; if (HIST.test(d)) s += 3; if (MODERN.test(d) && !HIST.test(d)) s -= 5; }
  if (q.kind === 2 && /people|ethnic|tribe|culture|language|hunter|indigenous/i.test(d + ' ' + c.title)) s += 3;
  const ys = yearsIn(d);
  if (ys.length) { const lo = Math.min(...ys), hi = Math.max(...ys); if (hi >= q.year - 200 && lo <= q.year + 200) s += 4; else if (ys.length >= 2 || /century/i.test(d)) s -= 3; }
  return s;
}

export function createWiki({ fetchJson, cacheGet = async () => undefined, cacheSet = async () => {} }) {
  let chain = Promise.resolve(), blockedUntil = 0;
  const sleep = ms => new Promise(res => setTimeout(res, ms));
  // one request at a time, spaced out; 429 waits for Retry-After and tries again
  function get(url) {
    const run = async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        const wait = blockedUntil - Date.now(); if (wait > 0) await sleep(wait);
        const r = await fetchJson(url); // { status, json, retryAfter }
        if (r.status === 429 || r.status === 503) { blockedUntil = Date.now() + Math.min(8000, (r.retryAfter || 2 * (attempt + 1)) * 1000 + 300); continue; }
        blockedUntil = Math.max(blockedUntil, Date.now() + 120);
        return r;
      }
      throw new Error('rate limited');
    };
    const p = chain.then(run, run); chain = p.catch(() => {}); return p;
  }
  const pack = (j, extra = {}) => ({ title: j.title, extract: j.extract || '', description: j.description || '', thumb: j.thumbnail?.source || null, url: j.content_urls?.desktop?.page || 'https://en.wikipedia.org/wiki/' + encodeURIComponent(j.title.replace(/ /g, '_')), ...extra });
  async function summary(title) {
    const r = await get(REST + encodeURIComponent(title.replace(/ /g, '_')) + '?redirect=true');
    return r.status === 200 && r.json?.title ? r.json : null;
  }
  async function search(text) {
    const u = `${API}?action=query&generator=search&gsrsearch=${encodeURIComponent(text)}&gsrlimit=8&prop=description%7Cpageprops&ppprop=disambiguation&format=json&origin=*`;
    const r = await get(u); const pages = r.json?.query?.pages; if (!pages) return [];
    return Object.values(pages).map(p => ({ title: p.title, description: p.description || '', index: (p.index || 1) - 1, disambig: p.pageprops && 'disambiguation' in p.pageprops }));
  }
  // q: { name, year (the year being viewed), kind (0 state, 1 region, 2 people), wikiSearch }
  async function resolveRegion(q) {
    const old = q.year < 1800, key = `r3:${q.name}:${old ? Math.floor(q.year / 500) : 'new'}`;
    const hit = await cacheGet(key); if (hit !== undefined) return hit;
    let result = null;
    // 1) the exact title, unless it is a disambiguation page or a modern place for an old region
    const exact = await summary(q.name).catch(e => { if (/rate/.test(e.message)) throw e; return null; });
    const exactOk = exact && exact.type === 'standard' && !(old && MODERN.test(exact.description || '') && !HIST.test(exact.description || ''));
    if (exactOk && (!old || scoreCandidate({ title: exact.title, description: exact.description, index: 0 }, q) >= 4)) result = pack(exact, { match: 'exact' });
    else {
      // 2) search and score
      const plain = (q.wikiSearch || q.name).replace(/\(.*?\)/g, '').trim() || q.name;
      const hint = q.kind === 2 ? 'people OR culture' : old ? 'empire OR kingdom OR dynasty OR ancient OR historical' : '';
      const lists = await Promise.all([search(plain), hint ? search(`${plain} ${hint}`) : []]);
      const seen = new Map(); for (const list of lists) for (const c of list) if (!seen.has(c.title) || seen.get(c.title).index > c.index) seen.set(c.title, c);
      if (exact && exact.type === 'standard' && !seen.has(exact.title)) seen.set(exact.title, { title: exact.title, description: exact.description || '', index: 0 });
      const ranked = [...seen.values()].map(c => ({ c, s: scoreCandidate(c, q) })).sort((a, b) => b.s - a.s);
      const best = ranked[0];
      if (best && best.s >= 1.5) { const j = best.c.title === exact?.title ? exact : await summary(best.c.title); if (j && j.type !== 'disambiguation') result = pack(j, { match: best.s >= 5 && titleRelated(best.c.title, q.name) ? 'search' : 'weak', score: +best.s.toFixed(1) }); }
      if (!result && exact && exact.type === 'standard') result = pack(exact, { match: 'weak' });
    }
    await cacheSet(key, result); return result;
  }
  async function eventSummary(title) {
    const key = 'e:' + title; const hit = await cacheGet(key); if (hit !== undefined) return hit;
    const j = await summary(title); const out = j ? pack(j, { match: 'exact' }) : null;
    await cacheSet(key, out); return out;
  }
  return { resolveRegion, eventSummary, search, summary };
}
export const browserFetchJson = async url => { const r = await fetch(url, { headers: { Accept: 'application/json' } }); let json = null; try { json = await r.json(); } catch { /* not json */ } return { status: r.status, json, retryAfter: +r.headers.get('retry-after') || 0 }; };
