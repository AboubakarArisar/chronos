"""Build data/events.json from Wikidata SPARQL + English Wikipedia REST summaries.
Usage: python -I tools/build_events.py [cache_dir]   (cache makes reruns cheap)"""
import json, sys, time, re, os, urllib.request, urllib.parse
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, ".cache")
os.makedirs(CACHE, exist_ok=True)
UA = {"User-Agent": "chronos-prep/1.0 (open-source education project)"}

def get(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=75) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
            if i == tries - 1: raise
            time.sleep(int(e.headers.get("Retry-After") or 0) or (20 * (i + 1) if e.code == 429 else 2))
        except Exception:
            if i == tries - 1: raise
            time.sleep(3)

def sparql(q):
    return get("https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(q), tries=2)["results"]["bindings"]

def cached(name, fn):
    p = os.path.join(CACHE, name + ".json")
    if os.path.exists(p): return json.load(open(p, encoding="utf-8"))
    v = fn(); json.dump(v, open(p, "w", encoding="utf-8")); return v

def subclasses(roots):
    out = set(roots)
    for r in roots:
        out |= {b["c"]["value"].rsplit("/", 1)[1] for b in sparql(f"SELECT ?c WHERE {{ ?c wdt:P279* wd:{r} }}")}
    return sorted(out)

# type -> (class roots expanded via P279*, direct-only classes, min sitelinks)
TYPES = {
    "battle":   (["Q178561", "Q1261499", "Q188055"], [], 0),
    "treaty":   (["Q131569", "Q625298"], [], 0),
    "city":     (["Q515", "Q15661340"], ["Q486972", "Q3957", "Q5119", "Q1549591", "Q1637706", "Q200250"], 25),
    "disaster": (["Q8065", "Q7944", "Q7692360", "Q8068", "Q8070", "Q8092"], [], 0),
    "expedition": (["Q2401485"], [], 0),
    "building": ([], ["Q44539", "Q2977", "Q32815", "Q16560", "Q842402", "Q5393308", "Q12516", "Q23413", "Q16970"], 40),
    "monument": ([], ["Q839954", "Q4989906", "Q12516", "Q44539", "Q2065736", "Q1107656", "Q15661340"], 15),  # BC only, fills sparse ancient eras
}

TIME = "OPTIONAL {{ ?item p:{p}/psv:{p} [wikibase:timeValue ?t{n}; wikibase:timePrecision ?p{n}] }}"
def query_rows(classes, minsl):
    q = f"""SELECT ?item ?label ?sl ?art ?coord ?lc ?t1 ?p1 ?t2 ?p2 ?t3 ?p3 WHERE {{
      VALUES ?cls {{ {' '.join('wd:' + c for c in classes)} }}
      ?item wdt:P31 ?cls; wikibase:sitelinks ?sl. FILTER(?sl >= {minsl})
      ?art schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>.
      OPTIONAL {{ ?item wdt:P625 ?coord }}
      OPTIONAL {{ ?item (wdt:P276|wdt:P1071)/wdt:P625 ?lc }}
      {TIME.format(p='P585', n=1)} {TIME.format(p='P580', n=2)} {TIME.format(p='P571', n=3)}
      OPTIONAL {{ ?item rdfs:label ?label FILTER(lang(?label)="en") }}
    }}"""
    try:
        return [{k: v["value"] for k, v in b.items()} for b in sparql(q)]
    except Exception as e:
        if len(classes) == 1: print("  FAILED", classes, e); return []
        h = len(classes) // 2  # timeout: split the class list
        return query_rows(classes[:h], minsl) + query_rows(classes[h:], minsl)

def year_of(t):  # WDQS uses astronomical years (0 = 1 BC); output historical (-1 = 1 BC)
    m = re.match(r"(-?)(\d+)-", t)
    y = int(m.group(2)) * (-1 if m.group(1) else 1)
    return y - 1 if y <= 0 else y

PT = re.compile(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)")
def build_raw():
    items = {}
    for typ, (roots, direct, minsl) in TYPES.items():
        classes = cached("classes_" + typ, lambda: subclasses(roots)) + direct
        rows = cached("rows_" + typ, lambda: [r for i in range(0, len(classes), 60) for r in query_rows(classes[i:i + 60], minsl)])
        print(typ, len(classes), "classes", len(rows), "rows")
        for r in rows:
            qid = r["item"].rsplit("/", 1)[1]
            if qid in items: continue  # first type wins (battle > treaty > city ...)
            m = PT.match(r.get("coord") or r.get("lc") or "")
            t, p = next(((r["t" + n], r["p" + n]) for n in "123" if r.get("t" + n)), (None, None))
            if not m or not t: continue
            lon, lat = float(m.group(1)), float(m.group(2))
            y = year_of(t)
            if (lat == 0 and lon == 0) or not -90 <= lat <= 90 or not -180 <= lon <= 180: continue
            if not -3000 <= y <= 2025: continue
            if typ == "city" and y >= 1900: continue
            if typ == "disaster" and y >= 2000: continue
            if typ == "monument" and y >= 0: continue
            items[qid] = {"id": qid, "name": r.get("label") or urllib.parse.unquote(r["art"].rsplit("/", 1)[1]).replace("_", " "),
                          "type": typ, "year": y, "precision": int(p), "lat": round(lat, 4), "lon": round(lon, 4),
                          "fame": int(r["sl"]), "wiki": urllib.parse.unquote(r["art"].rsplit("/", 1)[1])}
    return list(items.values())

def participants(battles):
    out = {}
    ids = [e["id"] for e in battles]
    for i in range(0, len(ids), 400):
        q = f"""SELECT ?item ?pl WHERE {{ VALUES ?item {{ {' '.join('wd:' + x for x in ids[i:i + 400])} }}
                ?item wdt:P710 ?p. ?p rdfs:label ?pl FILTER(lang(?pl)="en") }}"""
        for b in sparql(q):
            out.setdefault(b["item"]["value"].rsplit("/", 1)[1], []).append(b["pl"]["value"])
    return out

def pick_for_summary(events, n=3500, per_century=20):
    by_c = {}
    for e in sorted(events, key=lambda e: -e["fame"]):
        by_c.setdefault(e["year"] // 100, []).append(e)
    chosen = {e["id"] for lst in by_c.values() for e in lst[:per_century]}
    for e in sorted(events, key=lambda e: -e["fame"]):
        if len(chosen) >= n: break
        chosen.add(e["id"])
    return chosen

def summary(title):
    time.sleep(0.3)  # sequential + pause: well under 5 req/s (the IP is shared, 429s happened at 4 threads)
    try:
        d = get("https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(title, safe=""), tries=6)
    except Exception as e:
        print("  summary failed", title, e, flush=True); return "fail"
    if not d: return None
    return {"description": d.get("description"), "extract": d.get("extract"),
            "thumbnail": (d.get("thumbnail") or {}).get("source")}

def main():
    events = cached("events_raw", build_raw)
    battles = [e for e in events if e["type"] == "battle"]
    parts = cached("participants", lambda: participants(battles))
    for e in battles:
        if e["id"] in parts: e["participants"] = sorted(set(parts[e["id"]]))
    sums = cached("summaries", lambda: {})
    todo = [e for e in events if e["id"] in pick_for_summary(events) and e["id"] not in sums]
    print("fetching", len(todo), "summaries")
    for i, e in enumerate(todo):
        s = summary(e["wiki"])
        if s != "fail": sums[e["id"]] = s  # failures stay uncached so a rerun retries them
        if i % 100 == 99 or i == len(todo) - 1:
            json.dump(sums, open(os.path.join(CACHE, "summaries.json"), "w", encoding="utf-8"))
            print(" ", i + 1, "/", len(todo), flush=True)
    for e in events:
        if sums.get(e["id"]): e.update({k: v for k, v in sums[e["id"]].items() if v})
    events.sort(key=lambda e: (e["year"], -e["fame"]))
    meta = {"source": "Wikidata (CC0), English Wikipedia summaries (CC BY-SA 4.0)",
            "generated": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    out = os.path.join(ROOT, "data", "events.json")
    json.dump({**meta, "events": events}, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    mb = os.path.getsize(out) / 1e6
    print(len(events), "events,", round(mb, 1), "MB")
    if mb > 15:
        lite = sorted(sorted(events, key=lambda e: -e["fame"])[:5000], key=lambda e: e["year"])
        json.dump({**meta, "events": lite}, open(out.replace("events.json", "events-lite.json"), "w", encoding="utf-8"),
                  ensure_ascii=False, separators=(",", ":"))

if __name__ == "__main__":
    assert year_of("-0489-09-07T00:00:00Z") == -490 and year_of("0079-10-22T00:00:00Z") == 79  # Marathon, Vesuvius
    main()
