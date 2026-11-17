"""Build data/regions.json: Wikipedia/Wikidata info for every NAME/SUBJECTO in data/borders.

Run from the project root:  python -I scripts/build_regions.py
HTTP responses are cached in .cache/wiki_cache.json so reruns (matcher tweaks) are cheap.
"""
import collections, datetime, glob, json, os, re, sys, threading, time, unicodedata
import urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_PATH = os.path.join(ROOT, ".cache", "wiki_cache.json")
UA = "chronos-prep/1.0 (open-source education project)"
WP = "https://en.wikipedia.org/w/api.php"
WD = "https://www.wikidata.org/w/api.php"

# ---------------------------------------------------------------- http + cache
os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
cache = json.load(open(CACHE_PATH, encoding="utf-8")) if os.path.exists(CACHE_PATH) else {}
lock, rate_lock = threading.Lock(), threading.Lock()
last = [0.0]
fetched = [0]


def get(url):
    with lock:
        if url in cache:
            return cache[url]
    for attempt in range(6):
        with rate_lock:  # global limiter: <= 5 req/s
            wait = last[0] + 0.2 - time.time()
            if wait > 0:
                time.sleep(wait)
            last[0] = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.loads(r.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as e:
            if e.code == 404:
                data = None
                break
            time.sleep(2 ** attempt)
        except Exception:
            time.sleep(2 ** attempt)
    else:
        print("FAILED", url, file=sys.stderr)
        return None
    with lock:
        cache[url] = data
        fetched[0] += 1
        if fetched[0] % 500 == 0:
            save_cache()
            print(f"  fetched {fetched[0]}", file=sys.stderr, flush=True)
    return data


def save_cache():
    tmp = CACHE_PATH + ".tmp"
    json.dump(cache, open(tmp, "w", encoding="utf-8"), ensure_ascii=False)
    os.replace(tmp, CACHE_PATH)


def api(base, **params):
    params.update(format="json", formatversion="2")
    return get(base + "?" + urllib.parse.urlencode(params))


def pmap(fn, items):
    with ThreadPoolExecutor(4) as ex:
        return list(ex.map(fn, items))


# ---------------------------------------------------------------- collect names
def snap_year(path):
    m = re.match(r"world_(bc)?(\d+)\.geojson", os.path.basename(path))
    return -int(m[2]) if m[1] else int(m[2])


def collect():
    years, subj = collections.defaultdict(set), collections.defaultdict(collections.Counter)
    for f in glob.glob(os.path.join(ROOT, "data", "borders", "world_*.geojson")):
        y = snap_year(f)
        for ft in json.load(open(f, encoding="utf-8"))["features"]:
            p = ft["properties"]
            n, s = p.get("NAME"), p.get("SUBJECTO")
            if n:
                years[n].add(y)
                if s and s != n:
                    subj[n][s] += 1
            if s:
                years[s].add(y)
    return {n: sorted(v) for n, v in years.items()}, subj


# ---------------------------------------------------------------- heuristics
STATE_W = r"empire|kingdom|sultanate|khanate|caliphate|republic|dynasty|principality|duchy|county|emirate|" \
          r"state|states|confederation|confederacy|union|shogunate|tsardom|realm|khaganate|kaganate|" \
          r"league|imamate|protectorate|colony|dominion|federation|territory|mandate|march|margraviate|" \
          r"electorate|bishopric|archbishopric|order|commonwealth|polity|chiefdom|chiefdoms|city-states?|" \
          r"satrapy|province|viceroyalty|regency|despotate|beylik|khedivate|raj|sheikhdom|oblast|ssr"
PEOPLE_W = r"peoples?|tribes?|tribal|hunter|hunters|gatherers?|nomads?|nomadic|pastoralists?|farmers|cultures?|" \
           r"foragers?|fishers|fichers|herders|clans|aborigin\w*|indians|horticulturalists|agriculturalists|" \
           r"settlers|mesolithic|neolithic|bronze age|iron age|paleo-\w+|population|groups?"
ERA_TOKENS = set("empire kingdom dynasty sultanate khanate caliphate ancient medieval republic state principality "
                 "duchy county emirate confederation khaganate people peoples culture civilization tribe tribes "
                 "of the and grand early late old new".split())
MODERN_DESC = re.compile(r"^(sovereign )?(island )?(country|nation|city|town|village|capital|state of|state in|"
                         r"province|region of|county|municipality|commune|district|island in|island of|"
                         r"federal state|constituent country|unincorporated)", re.I)
OLD_DESC = re.compile(r"ancient|medieval|former|historic|dynasty|empire|kingdom|civili[sz]ation|culture|century|"
                      r"millennium|caliphate|sultanate|khanate|polity|bc\b|bce\b", re.I)
PEOPLE_DESC = re.compile(r"ethnic|people|tribe|tribal|indigenous|culture|confederation|population|language "
                         r"family|nomad|hunter|archaeological", re.I)
STATE_DESC = re.compile(r"empire|kingdom|dynasty|state|country|sultanate|caliphate|khanate|republic|"
                        r"principality|duchy|polity|emirate|realm|confederation|colony|protectorate", re.I)
BAD_TITLE = re.compile(r"^(list of|timeline|battle of|siege of|outline of|index of|bibliography|"
                       r"flag of|coat of arms|demographics|economy of|politics of|geography of|culture of|"
                       r"religion in|military of|music of|cuisine of)", re.I)


def norm_tokens(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\(.*?\)", " ", s)
    return [t for t in re.findall(r"[a-z0-9]+", s) if t not in ("of", "the", "and")]


def kind_from_name(name):
    if re.search(rf"\b({PEOPLE_W})\b", name, re.I):
        return "people"
    if re.search(rf"\b({STATE_W})\b", name, re.I):
        return "state"
    return None


def parse_span(text):
    """Return (min_year, max_year) mentioned in a short description, or None. BC is negative."""
    if not text:
        return None
    t = text.replace("–", "-").replace("—", "-").replace("−", "-")
    ys = []
    for m in re.finditer(r"(\d{1,2})(?:st|nd|rd|th)[- ](?:and \d{1,2}(?:st|nd|rd|th) )?centur(?:y|ies)(?:\s*(BC|BCE))?", t, re.I):
        c = int(m[1])
        ys += [-(c * 100), -(c * 100 - 99)] if m[2] else [(c - 1) * 100, c * 100 - 1]
    t = re.sub(r"\d{1,2}(?:st|nd|rd|th)[- ](?:and \d{1,2}(?:st|nd|rd|th) )?centur(?:y|ies)(\s*(BC|BCE))?", " ", t, flags=re.I)
    for m in re.finditer(r"(\d)(?:st|nd|rd|th)[- ]millennium(?:\s*(BC|BCE))?", t, re.I):
        c = int(m[1])
        ys += [-(c * 1000), -(c * 1000 - 999)] if m[2] else [(c - 1) * 1000, c * 1000 - 1]
    t = re.sub(r"\d(?:st|nd|rd|th)[- ]millennium(\s*(BC|BCE))?", " ", t, flags=re.I)
    toks = [(int(m[2]), (m[1] or m[3] or "").upper(), m.start(), m.end())
            for m in re.finditer(r"(AD\s*)?(?<![\d.])(\d{1,4})(?!\d)(?:\s*(BC|BCE|AD|CE)\b)?", t)]
    for i, (n, mark, s, e) in enumerate(toks):
        if not mark and i + 1 < len(toks):  # "1550-1069 BC" -> both BC
            n2, mark2, s2, _ = toks[i + 1]
            if mark2 in ("BC", "BCE") and re.fullmatch(r"\s*-\s*", t[e:s2]) and n >= n2:
                mark = "BC"
        if mark in ("BC", "BCE"):
            ys.append(-n)
        elif mark or n >= 100:
            ys.append(n)
    return (min(ys), max(ys)) if ys else None


def buckets(snaps):
    """Split a name's snapshot years into eras so 'Egypt' 3000 BC and 'Egypt' 2010 match separately."""
    edges = [(-10**6, 499), (500, 1499), (1500, 1799), (1800, 10**6)]
    out = [[y for y in snaps if lo <= y <= hi] for lo, hi in edges]
    return [b for b in out if b]


def hint(kind, lo, hi):
    if kind:  # name already says "Empire" / "peoples"
        return None
    if hi < 500:
        return "ancient"
    if lo < 1800:
        return "kingdom"
    return None


def score(name, kind, lo, hi, cand):
    title, desc = cand["title"], cand.get("description") or ""
    nt, tt = norm_tokens(name), norm_tokens(title)
    if not nt:
        return -99
    sim = sum(1 for t in nt if t in tt) / len(nt)
    extra = [t for t in tt if t not in nt and t not in ERA_TOKENS]
    s = 4 * sim - 0.6 * len(extra)
    if cand.get("exact"):
        s += 2
    s += cand.get("rankbonus", 0)
    span = parse_span(desc)
    if span:
        a, b = span
        if a == b:
            a, b = a - 50, b + 50
        lo2, hi2 = lo - 25, hi + 25
        ov = min(b, hi2) - max(a, lo2)
        if ov >= 0:
            s += 1 + 2.5 * ov / max(hi2 - lo2, 50)
        else:
            gap = max(a - hi2, lo2 - b)
            s -= 2 + (1.5 if gap > 300 else 0)
    elif MODERN_DESC.search(desc) and hi < 1600:
        s -= 3
    if hi < 1500 and OLD_DESC.search(desc):
        s += 0.5
    if lo >= 1800 and span and span[1] < lo - 100:
        s -= 1
    if kind == "people" and PEOPLE_DESC.search(desc):
        s += 1.5
    if kind == "state" and STATE_DESC.search(desc):
        s += 1
    if BAD_TITLE.search(title):
        s -= 3
    if title.lower().startswith("history of"):
        s -= 1.5
    cand["_span"], cand["_sim"] = span, sim
    return s


# ---------------------------------------------------------------- pipeline
def search(q):
    r = api(WP, action="query", list="search", srsearch=q, srlimit=5, srprop="snippet")
    return [h["title"] for h in (r or {}).get("query", {}).get("search", [])]


def page_info(titles):
    """title -> {title(resolved), description, disambig, qid}; batches of 50, follows redirects."""
    out = {}
    titles = sorted(set(titles))
    chunks = [titles[i:i + 50] for i in range(0, len(titles), 50)]

    def one(chunk):
        r = api(WP, action="query", titles="|".join(chunk), redirects=1, prop="description|pageprops",
                ppprop="disambiguation|wikibase_item")
        return chunk, r

    for chunk, r in pmap(one, chunks):
        q = (r or {}).get("query", {})
        mp = {t: t for t in chunk}
        for n in q.get("normalized", []):
            for k, v in mp.items():
                if v == n["from"]:
                    mp[k] = n["to"]
        for rd in q.get("redirects", []):
            for k, v in mp.items():
                if v == rd["from"]:
                    mp[k] = rd["to"]
        pages = {p["title"]: p for p in q.get("pages", []) if not p.get("missing") and not p.get("invalid")}
        for k, v in mp.items():
            p = pages.get(v)
            if p and p.get("ns") == 0:
                pp = p.get("pageprops", {})
                out[k] = {"title": p["title"], "description": p.get("description", ""),
                          "disambig": "disambiguation" in pp, "qid": pp.get("wikibase_item")}
    return out


def fmt_time(claim):
    try:
        t = claim["mainsnak"]["datavalue"]["value"]["time"]
    except (KeyError, TypeError):
        return None
    y = int(re.match(r"([+-]\d+)", t)[1])
    return f"{-y} BC" if y < 0 else str(y)


def best_claim(claims, prop):
    cs = [c for c in claims.get(prop, []) if c.get("rank") != "deprecated"]
    pref = [c for c in cs if c.get("rank") == "preferred"]
    return (pref or cs or [None])[0]


def wd_entities(ids, props):
    ids = sorted(set(i for i in ids if i))
    chunks = [ids[i:i + 50] for i in range(0, len(ids), 50)]
    out = {}
    for r in pmap(lambda c: api(WD, action="wbgetentities", ids="|".join(c), props=props, languages="en"), chunks):
        out.update((r or {}).get("entities", {}))
    return out


def main():
    years, subj = collect()
    names = sorted(years)
    print(f"{len(names)} unique names", file=sys.stderr)

    # 1. queries per (name, era bucket)
    jobs = []  # (name, kind, lo, hi, snaps)
    for n in names:
        k = kind_from_name(n)
        for b in buckets(years[n]):
            jobs.append((n, k, b[0], b[-1], b))
    queries = set()
    for n, k, lo, hi, _ in jobs:
        queries.add(n)
        h = hint(k, lo, hi)
        if h:
            queries.add(f"{n} {h}")
    queries = sorted(queries)
    print(f"{len(jobs)} name-eras, {len(queries)} searches", file=sys.stderr)
    results = dict(zip(queries, pmap(search, queries)))
    save_cache()

    # 2. candidate page info
    alltitles = set(names)
    for v in results.values():
        alltitles.update(v)
    info = page_info(alltitles)
    save_cache()

    # 3. choose
    matches = {}  # (name, lo) -> (cand, score, conf)
    for n, k, lo, hi, snaps in jobs:
        cands = {}
        if n in info and not info[n]["disambig"]:
            c = dict(info[n], exact=True, rankbonus=0.5)
            cands[c["title"]] = c
        qs = [n] + ([f"{n} {hint(k, lo, hi)}"] if hint(k, lo, hi) else [])
        for q in qs:
            for i, t in enumerate(results.get(q, [])):
                p = info.get(t)
                if not p or p["disambig"]:
                    continue
                c = cands.setdefault(p["title"], dict(p))
                c["rankbonus"] = max(c.get("rankbonus", 0), (5 - i) * 0.25)
        scored = sorted(((score(n, k, lo, hi, c), c) for c in cands.values()), key=lambda x: -x[0])
        if not scored or scored[0][0] < 2.5:
            matches[(n, lo)] = (None, scored[0][0] if scored else None, "low", snaps)
            continue
        s, c = scored[0]
        margin = s - scored[1][0] if len(scored) > 1 else 3
        span_ok = c["_span"] is not None and s > 0
        if s >= 6.5 and c["_sim"] == 1 and margin >= 1:
            conf = "high"
        elif s >= 5 and c["_sim"] >= 0.5:
            conf = "medium"
        else:
            conf = "low"
        if conf == "medium" and c.get("exact") and (span_ok or hi >= 1800):
            conf = "high"
        matches[(n, lo)] = (c, s, conf, snaps)

    # 4. summaries for chosen titles
    chosen = sorted({m[0]["title"] for m in matches.values() if m[0]})
    print(f"{len(chosen)} summaries", file=sys.stderr)
    summ = dict(zip(chosen, pmap(lambda t: get("https://en.wikipedia.org/api/rest_v1/page/summary/"
                                                + urllib.parse.quote(t.replace(" ", "_"), safe="")), chosen)))
    save_cache()

    def wiki_obj(c):
        r = summ.get(c["title"]) or {}
        return {"title": r.get("title", c["title"]),
                "url": (r.get("content_urls") or {}).get("desktop", {}).get("page")
                or "https://en.wikipedia.org/wiki/" + urllib.parse.quote(c["title"].replace(" ", "_")),
                "description": r.get("description") or c.get("description") or "",
                "extract": r.get("extract", ""),
                "thumbnail": (r.get("thumbnail") or {}).get("source")}

    # 5. assemble
    regions = {}
    for n in names:
        eras = [(lo, m) for (nn, lo), m in matches.items() if nn == n]
        eras.sort(key=lambda x: x[0])
        # merge consecutive eras with the same article
        merged = []
        for lo, (c, s, conf, snaps) in eras:
            t = c["title"] if c else None
            if merged and merged[-1]["t"] == t:
                merged[-1]["snaps"] += snaps
                merged[-1]["confs"].append(conf)
            else:
                merged.append({"t": t, "c": c, "snaps": list(snaps), "confs": [conf]})
        rank = {"high": 2, "medium": 1, "low": 0}
        for m in merged:
            m["conf"] = min(m["confs"], key=rank.get)
        main_era = max(merged, key=lambda m: (m["t"] is not None, len(m["snaps"])))
        k = kind_from_name(n)
        desc = (main_era["c"] or {}).get("description", "")
        if not k:
            k = "people" if PEOPLE_DESC.search(desc) and not STATE_DESC.search(desc) else \
                "state" if STATE_DESC.search(desc) else "region"
        e = {"kind": k, "years": [years[n][0], years[n][-1]], "snapshots": years[n],
             "subjecto_examples": [s for s, _ in subj[n].most_common(5)],
             "wiki": wiki_obj(main_era["c"]) if main_era["c"] else None,
             "confidence": main_era["conf"],
             "_qid": (main_era["c"] or {}).get("qid")}
        if len(merged) > 1:
            e["eras"] = [{"years": [m["snaps"][0], m["snaps"][-1]],
                          "wiki": wiki_obj(m["c"]) if m["c"] else None, "confidence": m["conf"]}
                         for m in merged]
        regions[n] = e

    # 6. wikidata for state-like polities
    qids = [e["_qid"] for e in regions.values() if e["kind"] == "state" and e["wiki"]]
    ents = wd_entities(qids, "claims")
    caps = {}
    for q in qids:
        c = best_claim(ents.get(q, {}).get("claims", {}), "P36")
        try:
            caps[q] = c["mainsnak"]["datavalue"]["value"]["id"]
        except (KeyError, TypeError):
            pass
    capents = wd_entities(caps.values(), "labels|claims")
    save_cache()
    for e in regions.values():
        q = e.pop("_qid")
        if e["kind"] != "state" or not e["wiki"]:
            continue
        cl = ents.get(q, {}).get("claims", {})
        inc, dis = fmt_time(best_claim(cl, "P571") or {}), fmt_time(best_claim(cl, "P576") or {})
        if q in caps:
            ce = capents.get(caps[q], {})
            lab = ce.get("labels", {}).get("en", {}).get("value")
            if lab:
                e["capital"] = lab
            co = best_claim(ce.get("claims", {}), "P625")
            try:
                v = co["mainsnak"]["datavalue"]["value"]
                e["capital_coords"] = [round(v["latitude"], 4), round(v["longitude"], 4)]
            except (KeyError, TypeError):
                pass
        if inc:
            e["inception"] = inc
        if dis:
            e["dissolved"] = dis

    out = {"source": "English Wikipedia (CC BY-SA 4.0) summaries, Wikidata (CC0)",
           "generated": datetime.date.today().isoformat(),
           "note": "Keys are NAME/SUBJECTO exactly as in data/borders. 'eras' (when present) gives a "
                   "per-period match; prefer the era whose years cover the current year over top-level 'wiki'.",
           "regions": regions}
    path = os.path.join(ROOT, "data", "regions.json")
    json.dump(out, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    save_cache()
    print(f"wrote {path} ({os.path.getsize(path) // 1024} KB)", file=sys.stderr)


if __name__ == "__main__":
    if sys.argv[1:] == ["test"]:
        assert parse_span("Imperial dynasty of China (618–907)") == (618, 907)
        assert parse_span("Chinese dynasty (202 BC – 220 AD)") == (-202, 220)
        assert parse_span("Kingdom (c. 1550–1069 BC)") == (-1550, -1069)
        assert parse_span("13th-century empire") == (1200, 1299)
        assert parse_span("Country in North Africa") is None
        assert buckets([-3000, 100, 1200, 2010]) == [[-3000, 100], [1200], [2010]]
        print("ok")
    else:
        main()
