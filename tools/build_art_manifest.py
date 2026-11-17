"""Write assets/art/manifest.json from the downloader's metadata (raw.json) plus the four hand-picked images.
Usage: python -I tools/build_art_manifest.py <path-to-raw.json>"""
import json, os, struct, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def size(path):
    b = open(path, "rb").read(400000)
    if b[:8] == b"\x89PNG\r\n\x1a\n": return struct.unpack(">II", b[16:24])
    i = 2
    while i < len(b) - 9:
        if b[i] != 0xFF: i += 1; continue
        if b[i + 1] in (0xC0, 0xC1, 0xC2): h, w = struct.unpack(">HH", b[i + 5:i + 9]); return w, h
        i += 2 + struct.unpack(">H", b[i + 2:i + 4])[0]
    return None, None

raw = json.load(open(sys.argv[1], encoding="utf-8"))
skins = [s["id"] for s in json.load(open(os.path.join(ROOT, "data/eras.json"), encoding="utf-8"))["skins"]]
man = {s: [] for s in skins}
for skin, items in raw.items():
    for g in items:
        p = os.path.join(ROOT, g["file"])
        if not os.path.exists(p): continue
        w, h = size(p)
        man.setdefault(skin, []).append({"file": g["file"], "kind": g["kind"], "title": g["title"], "date": g.get("date", ""),
            "description": g.get("desc", ""), "credit": g.get("credit", ""), "license": g["license"], "source_page": g["source_page"],
            "width": w, "height": h, "focus": "50% 40%" if (h or 0) > (w or 1) else "50% 50%"})
extra = [("mongol", "assets/indus.jpg", "Jalal ad-Din crossing the Indus, escaping Genghis Khan", "c. 1596", "Mughal painting", "50% 42%"),
         ("mongol", "assets/kublai.jpg", "Kublai Khan, Yuan imperial portrait album", "13th century", "Yuan court painter", "50% 38%"),
         ("rome", "assets/trajan.jpg", "Bust of Trajan, Glyptothek Munich", "c. 108 AD", "Roman sculptor", "50% 22%"),
         ("islamic", "assets/wisdom.jpg", "Library scene, Maqamat of al-Hariri", "1237", "Yahya al-Wasiti", "50% 62%")]
for skin, f, t, d, c, foc in extra:
    w, h = size(os.path.join(ROOT, f))
    man[skin].insert(0, {"file": f, "kind": "event", "title": t, "date": d, "description": t + ".", "credit": c,
        "license": "Public domain" if skin != "rome" else "Public domain (photo released by the photographer; check Commons page)",
        "source_page": "https://commons.wikimedia.org/", "width": w, "height": h, "focus": foc})
json.dump({"note": "Public domain and CC images per culture skin. 'focus' is a starting CSS background-position for wide crops; adjust after viewing. Credit every image in the app's Credits panel.", "skins": man},
          open(os.path.join(ROOT, "assets/art/manifest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print({k: len(v) for k, v in man.items()})
