# Chronos: prepared assets

Everything the one-shot build needs, prepared before the prompt so Fable doesn't have to guess. Full details are in `manifest.json`.

| Folder | What | Source and license |
|---|---|---|
| `assets/earth/` | 4K Earth day, night, relief, water, clouds, normal and specular maps | NASA imagery via three.js and three-globe examples (MIT) |
| `data/borders/` | 49 world border maps, 3000 BC to 2010 (61 MB GeoJSON) | historical-basemaps, GPL-3.0 |
| `assets/*.jpg` | Event paintings: Indus 1221, Kublai 1279, Trajan 116, House of Wisdom 830 | Public domain, Wikimedia Commons |
| `data/eras.json`, `data/skins.json`, `assets/skins/` | 24 culture skins: matching rules, palettes, fonts, mottos, SVG pattern, strip and emblem (`tools/build_skins.py`, preview in `skins-gallery.html`) | Ours |
| `data/regions.json` | Index of all 2,979 region names with years, kind and rulers; article text loads live from Wikipedia | Built from the border data |
| `data/events.json`, `events-lite.json` | 19,326 dated, located events from Wikidata (`tools/build_events.py`), text loads live from Wikipedia | Wikidata CC0 |
| `assets/art/` + `manifest.json` | Public domain and CC artworks per culture (`tools/build_art_manifest.py`) | See manifest |
| `assets/music/` + `manifest.json` | Period music per culture | See manifest |
| `docs/` | Landing page plan and the landing page design skill | Ours |
| `FINAL_PROMPT.md` | The one-shot build prompt | Ours |
| `look-test.html` | Approved look: real globe, three culture skins (Mongol, Rome, Abbasid) | Ours |
| `skin-*.jpg` | Screenshots of the approved look | Ours |

## Run the look test

From `D:\yt-again\longvid`, start the `globe` preview server, or:

```bash
python -m http.server 8765 --directory one-shot-challenge/history-globe
```

Then open `http://localhost:8765/look-test.html`. Press 1, 2 or 3 to switch culture. `?skin=rome` opens a skin directly.

## Things to know about the border data

- Map years are irregular, with more of them in recent centuries. The app must say which map year it is showing.
- Group and colour regions by `SUBJECTO`. In 1279, for example, all four Mongol khanates belong to "Mongol Empire".
- Many regions are peoples or cultural areas, not states. Draw them faintly.
- Shipping GPL data means releasing the app as open source under GPL-3.0, with credit to the project. That suits a free community tool.
