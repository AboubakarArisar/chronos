"""Build data/regions.json for every region NAME in data/borders, using Wikidata only.

Wikipedia's API rate-limits bulk use, so this stores the matched English Wikipedia title plus
Wikidata facts (description, capital, inception, dissolved, image). The app fetches the full
Wikipedia summary live on click (CORS-enabled REST API) and caches it.
Steps: exact enwiki-title match in batches of 50, then Wikidata search for the rest, then
one batched SPARQL pass for facts. Resumable via cache.  Usage: python -I tools/build_regions.py [cache_dir]
"""
import hashlib, json, os, re, sys, time, urllib.parse, urllib.request
from collections import defaultdict
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, ".cache")
os.makedirs(CACHE, exist_ok=True)
UA = {"User-Agent": "chronos-prep/1.0 (open-source education project)"}
WD = "https://www.wikidata.org/w/api.php?"
PEOPLE = re.compile(r"peoples?$|tribes?$|hunter|gatherer|farmers|herders|nomads|culture$|foragers|pastoralists|settlers|horticulturalists", re.I)
MODERN = re.compile(r"\b(country|sovereign state|city in|capital of|province of|state of|region of|municipality|county|federal subject)\b", re.I)
HIST = re.compile(r"\b(empire|kingdom|dynasty|caliphate|sultanate|khanate|confederation|polity|civili[sz]ation|people|ethnic|tribe|historical|ancient|medieval|former|chiefdom|principality|duchy|realm|state from|\d{3,4} ?(bc|bce|ad|ce)|(bc|bce)|century)\b", re.I)
BAD = re.compile(r"disambiguation|wikimedia list|family name|given name|surname|wikimedia category|scientific article|album|song|film|band", re.I)

def get(url, tries=6):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
            if e.code in (429, 503): time.sleep(min(int(e.headers.get("Retry-After") or 0) or 10 * (i + 1), 90)); continue
            if i == tries - 1: raise
            time.sleep(3)
        except Exception:
            if i == tries - 1: raise
            time.sleep(3)

def commons_thumb(fname, w=400):
    """Upload URL of a Commons file thumbnail, computed locally (md5 path), no API call."""
    f = fname.replace(" ", "_"); h = hashlib.md5(f.encode("utf-8")).hexdigest(); q = urllib.parse.quote(f)
    return f"https://upload.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{q}/{w}px-{q}" + (".png" if f.lower().endswith((".svg", ".tif", ".tiff")) else "")

def collect():
    yrs, subj, prec = defaultdict(set), defaultdict(set), defaultdict(list)
    for e in json.load(open(os.path.join(ROOT, "data/borders/index.json"), encoding="utf-8"))["years"]:
        p = os.path.join(ROOT, "data/borders", e["filename"])
        if not os.path.exists(p): continue
        for f in json.load(open(p, encoding="utf-8"))["features"]:
            pr = f["properties"]; n = pr.get("NAME")
            if not n: continue
            yrs[n].add(e["year"]); subj[n].add(pr.get("SUBJECTO") or n); prec[n].append(pr.get("BORDERPRECISION") or 1)
    return yrs, subj, prec

def norm(s): return re.sub(r"[^a-z0-9]", "", s.lower())

def fits(desc, years):
    if BAD.search(desc or ""): return False
    return not (max(years) < 1800 and MODERN.search(desc or "") and not HIST.search(desc or ""))

def entity_summary(e):
    return {"qid": e["id"], "title": e.get("sitelinks", {}).get("enwiki", {}).get("title"),
            "description": e.get("descriptions", {}).get("en", {}).get("value", ""),
            "label": e.get("labels", {}).get("en", {}).get("value", "")}

def exact(names):
    out = {}
    for i in range(0, len(names), 50):
        batch = names[i:i + 50]
        d = get(WD + urllib.parse.urlencode(dict(action="wbgetentities", sites="enwiki", titles="|".join(batch), normalize=0,
                props="descriptions|sitelinks|labels", languages="en", sitefilter="enwiki", format="json")))
        for e in (d or {}).get("entities", {}).values():
            if "missing" in e: continue
            s = entity_summary(e)
            if s["title"]: out[s["title"]] = s
        time.sleep(0.5)
    return out

def search(name, years):
    old = max(years) < 1800
    for q in [name] + ([re.sub(r"\b(Empire|Kingdom|Sultanate|Caliphate|Khanate|Dynasty)\b", "", name).strip()] if old else []):
        d = get(WD + urllib.parse.urlencode(dict(action="wbsearchentities", search=q, language="en", limit=10, format="json")))
        time.sleep(0.4)
        cands = [c for c in (d or {}).get("search", []) if fits(c.get("description", ""), years)]
        if not cands: continue
        ids = [c["id"] for c in cands]
        d2 = get(WD + urllib.parse.urlencode(dict(action="wbgetentities", ids="|".join(ids), props="descriptions|sitelinks|labels",
                 languages="en", sitefilter="enwiki", format="json")))
        time.sleep(0.4)
        ents = [entity_summary(d2["entities"][i]) for i in ids if i in (d2 or {}).get("entities", {})]
        ents = [e for e in ents if e["title"]]
        def sc(e):
            s = 5 if norm(e["label"]) == norm(name) or norm(e["title"]) == norm(name) else (2 if norm(name) in norm(e["title"]) or norm(e["title"]) in norm(name) else 0)
            if old and HIST.search(e["description"] + " " + e["title"]): s += 3
            if PEOPLE.search(name) and re.search(r"people|ethnic|tribe|culture|language", e["description"], re.I): s += 2
            return s - ids.index(e["qid"]) * 0.3
        if ents:
            best = max(ents, key=sc); s = sc(best)
            if s >= 2: return {**best, "confidence": "high" if s >= 7 else "medium" if s >= 4 else "low"}
    return None

def facts(qids):
    out = {}
    for i in range(0, len(qids), 150):
        vals = " ".join("wd:" + q for q in qids[i:i + 150])
        q = f"""SELECT ?item ?capL ?ccoord ?inc ?dis ?img WHERE {{ VALUES ?item {{ {vals} }}
          OPTIONAL {{ ?item wdt:P36 ?cap. ?cap rdfs:label ?capL FILTER(lang(?capL)="en") OPTIONAL {{ ?cap wdt:P625 ?ccoord }} }}
          OPTIONAL {{ ?item wdt:P571 ?inc }} OPTIONAL {{ ?item wdt:P576 ?dis }} OPTIONAL {{ ?item wdt:P18 ?img }} }}"""
        d = get("https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(q))
        for b in (d or {}).get("results", {}).get("bindings", []):
            k = b["item"]["value"].rsplit("/", 1)[1]; o = out.setdefault(k, {})
            if "capL" in b and "capital" not in o:
                o["capital"] = b["capL"]["value"]
                m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", b.get("ccoord", {}).get("value", ""))
                if m: o["capital_lonlat"] = [round(float(m.group(1)), 4), round(float(m.group(2)), 4)]
            for key, f in (("inc", "inception"), ("dis", "dissolved")):
                if key in b and f not in o:
                    m = re.match(r"(-?)(\d+)-", b[key]["value"])
                    if m: y = int(m.group(2)) * (-1 if m.group(1) else 1); o[f] = y - 1 if y <= 0 else y
            if "img" in b and "image" not in o:
                o["image"] = commons_thumb(urllib.parse.unquote(b["img"]["value"].rsplit("/", 1)[1]))
        time.sleep(1)
    return out

def cache(name, fn):
    p = os.path.join(CACHE, name)
    if os.path.exists(p): return json.load(open(p, encoding="utf-8"))
    v = fn(); json.dump(v, open(p, "w", encoding="utf-8"), ensure_ascii=False); return v

def main():
    yrs, subj, prec = collect()
    names = sorted(yrs)
    ex = cache("rg_exact.json", lambda: exact(names))
    match = {}
    for n in names:
        e = ex.get(n)
        if e and fits(e["description"], yrs[n]): match[n] = {**e, "confidence": "high"}
    sp = os.path.join(CACHE, "rg_search.json")
    found = json.load(open(sp, encoding="utf-8")) if os.path.exists(sp) else {}
    todo = [n for n in names if n not in match and n not in found]
    print(len(names), "names;", len(match), "exact;", len(todo), "to search", flush=True)
    for i, n in enumerate(todo):
        try: found[n] = search(n, yrs[n])
        except Exception as e: print("  fail", n, e, flush=True); continue
        if i % 50 == 49 or i == len(todo) - 1:
            json.dump(found, open(sp, "w", encoding="utf-8"), ensure_ascii=False); print(" ", i + 1, "/", len(todo), flush=True)
    for n, v in found.items():
        if v and n not in match: match[n] = v
    qids = sorted({m["qid"] for m in match.values()})
    fx = cache("rg_facts.json", lambda: facts(qids))
    regions = {}
    for n in names:
        m = match.get(n); ys = sorted(yrs[n])
        desc = (m or {}).get("description", "")
        kind = "people" if PEOPLE.search(n) else ("state" if max(prec[n]) > 1 or HIST.search(desc + " " + n) else "region")
        r = {"kind": kind, "years": [ys[0], ys[-1]], "snapshots": ys, "subjecto": sorted(subj[n] - {n})[:6], "confidence": (m or {}).get("confidence")}
        if m:
            t = m["title"]
            r["wiki"] = {"title": t, "url": "https://en.wikipedia.org/wiki/" + urllib.parse.quote(t.replace(" ", "_")),
                         "summary_api": "https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(t.replace(" ", "_"), safe=""),
                         "description": desc, "wikidata": m["qid"]}
            r.update(fx.get(m["qid"], {}))
        regions[n] = r
    out = os.path.join(ROOT, "data", "regions.json")
    json.dump({"source": "Wikidata (CC0); article text loads live from English Wikipedia (CC BY-SA 4.0) via summary_api",
               "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"), "regions": regions},
              open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    conf = defaultdict(int)
    for r in regions.values(): conf[r["confidence"]] += 1
    print(len(regions), "regions", dict(conf), round(os.path.getsize(out) / 1e6, 2), "MB")

if __name__ == "__main__":
    main()
