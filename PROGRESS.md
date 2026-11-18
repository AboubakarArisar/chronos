# Chronos: progress log

If you see only "continue": read this file, check `git log --oneline`, and resume at the first unchecked item.
Everything below is checked off; what remains is listed under "Known limits" and "What I would do next".

## Checklist (mirrors section 12 of FINAL_PROMPT.md)

- [x] `npm run build` gives a static `dist/` (index, app, credits, privacy, 404) that works offline after first load
- [x] Globe at least as realistic as `look-test.html`, 55+ fps on Medium at 1080p (60 fps measured)
- [x] All 49 snapshots crisp at every zoom, cross-fade, map year always shown
- [x] Any region in any year clickable with sourced info; sea and unclaimed land respond
- [x] 24 skins plus default, each verified in a screenshot, switching by the rules
- [x] Music per culture with cross-fades and credits; procedural fallback
- [x] Event markers in time, uncluttered, clickable, sourced
- [x] 10 researched story tours play start to finish
- [x] Search, share links, settings, shortcuts, onboarding, credits
- [x] Creator mode records 16:9 and 9:16 with music, no watermark
- [x] Landing page follows the skill and plan, 390px check, real globe hero
- [x] No console errors in normal use; section 11 verification recorded below
- [x] README.md, CREDITS.md, LICENSE, final PROGRESS.md

Milestones M1 to M7 are all done. Commits: `git log --oneline`.

## Decisions

- **Stack**: Vite 8, plain ES modules, three 0.170.0, earcut, `@fontsource/*` (36 families, loaded lazily per
  skin), `@phosphor-icons/core` (landing page icons, required by the design skill), `playwright-core` for tests.
  No d3-geo: picking uses a planar even-odd test on the same unwrapped lon/lat rings that are drawn. It handles
  the antimeridian and holes, and is immune to the GeoJSON winding problems that make `geoContains` return the
  complement of a polygon. The click test compares against an independent test on the raw GeoJSON.
- **Data prep** (`tools/prepare-data.mjs`, runs before dev and build, never touches originals): borders become
  `public/d/b/<year>.json` (0.001 degree grid, delta encoded, 61 MB to 14 MB, label points by pole of
  inaccessibility, areas). Events become compact rows in one 1.5 MB file loaded after first paint (not split per
  century; 19k rows is small in memory). Also a region index, credits, font loaders and `CREDITS.md`.
- **Borders**: fills are earcut triangles in lon/lat, subdivided until every edge is under 2.5 degrees with an
  edge-only criterion (neighbours split identically, so no cracks), then projected to the sphere. Lines use my own
  instanced screen-space shader (capsule distance field: realm-coloured glow, dark edge, pale core; feathered for
  BORDERPRECISION 1; faint for peoples; gold for the selection; animated dash for tour routes). Far-side lines
  are hidden with a horizon test, and line depth is a pure function of distance to the line centre, so joints and
  shared borders never double-blend. Geometry is built in a Web Worker; the newest request wins while scrubbing.
- **Cross-fade**: while playing, the next map fades in over the last part of each interval; paused shows the
  latest map at or before the year. The year frame always says which map is on screen.
- **Labels, city names and event markers** are drawn on a 2D canvas above the WebGL canvas, so creator mode can
  composite both canvases (plus the year or title overlay) into the recording.
- **Selection**: a click selects one region (NAME); the powers list and tours select a power (SUBJECTO group).
- **Skin choice**: selected realm, else largest realm in view, else era fallback, with the 1.2 s stability rule.
  Among the rules whose years cover the current year, the longest regex match wins, so "Kushan Empire" is
  Classical India (Kushan) rather than Ancient Egypt (Kush). Ties go to the earlier rule.
- **Blackletter and display heads** (UnifrakturCook, Metamorphous, Limelight) are kept for titles, but spaced
  capitals (buttons, small headings, map labels) use the skin's deco or body font, because blackletter capitals
  with letter spacing are unreadable.
- **Stud shapes per skin**: round (mongol, china, japan, africa, prehistory, norse), star (islamic, ottoman, persia,
  mughal), square (rome, greece, egypt, mesopotamia, andes, mesoamerica, modern, worldwars, revolution), diamond (rest).
- **Colonies** (hatched): from 1450, ruled by a colonial power whose name differs from the region's.
- **Kinds**: only `people` regions are drawn faint; `state` and `region` are solid (most ancient states are `region`).
- **Sun**: fixed pleasant daylight that follows the view; Settings has "Real day and night (now)".
- **Offline**: a generated service worker precaches the app shell (286 files, 12 MB), then the 49 maps (14 MB) in
  the background; art, music and non-default fonts are cached when first used.
- **The "40 second tour"** link on the landing page opens `app.html#demo`: Rome rises and falls, 300 BC to 500 AD
  at 20 years per second, which is 40 seconds.
- **Terms** live on `privacy.html#terms` (the page list in the brief has no separate terms page).
- **ffprobe is not installed** here, so recordings are verified in the browser (video metadata + decoded audio).

## Missing or odd inputs (handled, nothing blocked)

- No music for egypt, mesopotamia, rome, india_classical, medieval_europe, mongol, africa, mesoamerica, mughal,
  modern: these use the procedural fallback.
- Border features without a NAME (42 to 629 per map) are treated as unclaimed land.
- Two region names in `regions.json` are blank strings and are dropped (2,977 names, not 2,979).
- Some art manifest dates carry Wikidata junk ("date QS:P..."); stripped in prepare-data.
- `eras.json` rules are plain substrings ("Kush" matches Kushan, "Chin" matches Cochinchina). Applied as given,
  with the longest-match rule above.

## Tour sources and notes

All ten tours pass `node src/tours/_check.mjs` (steps, chronology, word counts, realm names exist in the map in
effect, art files exist). Sources are listed in each `src/tours/*.json` under `sources`; all are English Wikipedia
articles read by the research agents, plus one Britannica search summary for the Mansa Musa route.

- **Left out as unverifiable or disputed**: army sizes and death tolls, the "salting of Carthage", Zheng He's ship
  sizes, the "18 tons of gold" and "richest person ever" claims, legends (Ibn al-Haytham's feigned madness, Thaïs
  and the Persepolis fire, the Sagres school), "father of" labels.
- **Hedged as reported**: the Indus leap, "the die is cast" (Suetonius), the Gordian knot, the Tigris ink story,
  Talas and papermaking, Babylon taken "without battle" (the Cylinder's claim).
- **Realm is null** where the map in effect has no fitting name (Rome 753 BC, Macedon 336 BC, Zheng He 1405, where
  China is still "Great Khanate" on the 1400 map). Some highlights follow the map, not the event (27 BC highlights
  "Roman Republic" from the 100 BC map).
- **Approximate route points** (flagged by the agents): Hannibal's pass, the Indus battle site, Marco Polo's and
  Zhang Qian's overland waypoints, the Cairo to Mecca leg. Magellan's Pacific crossing starts at Guam.
- Not independently re-read by me line by line: I relied on the agents' reports and the automated checker.

## Verification results (section 11)

Machine: this Windows 11 laptop, system Chrome driven headed by playwright-core, 1920x1080, dev server unless noted.
Raw results: `tests/results/*.json`, logs `tests/results/verify-run*.log`, screenshots `tests/screens/`.

| Check | Result |
|---|---|
| Unit tests (`npm test`) | 11 of 11 pass |
| Skins | 24 of 24 switch to the right skin for a matching realm, plus default. Screenshots `tests/screens/skin-*.jpg`, all inspected or spot-checked (Rome, Mongol, medieval, Mughal, Japan, modern, world wars viewed in full). Text contrast on panel colour: minimum 5.0:1 (Mughal highlight), all at least 4.5:1 |
| Clicks | 200 of 200 real mouse clicks (20 random land points in each of 3000 BC, 323 BC, 100, 800, 1279, 1492, 1650, 1815, 1914, 2010) show the NAME that the raw GeoJSON gives. Ocean click: "South Atlantic Ocean". Unclaimed land click: "Unclaimed land" |
| Search | "1258" gives the year first, then Siege of Baghdad. "Baghdad" gives the city (founded 762), the Golden Age story, the siege. "Battle of Hastings" flies to 1066. "Inca" selects Inca Empire in 1500. "Rome" gives the city, the realm and the story |
| Share link | `#y=117&c=41.20,14.50,2.350&g=Roman+Empire` reloads to the same year, camera, selection and skin |
| Tours | all 10 tours, every step: right year, title, panel, realm selected when the step names one, tour ends cleanly. One tour (Alexander, 11 steps) played on autoplay to the end in 235 s |
| Recording | 16:9: 1920x1080, 9.9 s, VP9 + Opus, 9.8 MB, audio 2 channels, RMS 0.02. 9:16: 1080x1920, 9.9 s, 11.7 MB, audio present. Interface hidden, no watermark. Files in `tests/results/clip-*.webm` |
| Scrub, 100 years/s | 55.9 fps average on Medium, longest slow run 0.25 s, music changed 4 times for 13 skin changes |
| Scrub, 5 years/s | 59.4 fps average on Medium, longest slow run 0.35 s, 19 music changes for 21 skin changes |
| 10 minute soak (play at 20 years/s, camera flights) | 59.1 fps average, longest run of slow frames 0.5 s, JS heap 67 MB (first third) to 82 MB (last third), GPU geometries at most 14, textures 5: no growth |
| Wikipedia resolver | all 11 required names resolve (Han to Han dynasty, Egypt 3000 BC to Ancient Egypt, Mali 1300 to Mali Empire, Great Khanate to Yuan dynasty, ...). 30 random names in `tests/results/wiki.json`: 10 exact, 4 by search, 8 "Possible match", 4 nothing found, 4 hit Wikipedia's rate limit in the test run |
| Landing page | 60 fps hero. No horizontal overflow at 1440 and 390 px. CTA visible in the first screen on both. Manrope only, every font size on the Tailwind scale, no italics, no weight above 700, no hyphens in copy, all images have alt text, one h1. Tab order: skip link, brand, nav, CTA. Reduced motion: words lit at once, globe does not drift. Mobile menu opens |
| Built `dist/` via `vite preview` | all five pages load, app ready in 1.5 s, 60 fps, service worker active, 49 maps cached, app reloads and switches maps offline, cards say the article needs a connection |
| First visit | intro plays, three coach marks, then the "Sound on" prompt. No audio before the click. Second visit: no intro |
| Quality levels | Low, Medium and High each settle at 60 fps at 1080p. Switching to High stalls for a few seconds once while shaders compile |
| Narrow screen (430 px) | no overflow, panels become a bottom sheet |
| Console errors | none in any run above (offline runs log the expected failed image requests) |

### Playback numbers

Final run, on Medium at 1920x1080, whole timeline from 3000 BC to today, music on (`tests/results/verify-run3.log`):

- **100 years/s** (52 s): 55.9 fps average, worst frame 149 ms, longest run of frames under 30 fps 0.25 s
  (limit 1 s). 13 skin changes, 4 music changes. Quality stayed on Medium. JS heap 134 MB at the end.
- **5 years/s** (1007 s): 59.4 fps average, worst frame 183 ms, longest slow run 0.35 s. 21 skin changes,
  19 music changes (at most one per stable skin, plus track ends). Quality stayed on Medium. JS heap 96 MB.
- No console errors in either run.

History: the first full run averaged 30 fps at 100 years/s with frames up to 1.4 s. Two causes were found and
fixed: skin switches repainted SVG filter textures (now rasterised once, fades kept on the compositor, pick data
packed into single buffers), and a loader deadlock left stale maps on screen and evicted the wanted map as soon
as it arrived (which also stalled three tours). The earlier logs are `verify-run.log` and `verify-run2.log`.

## Known limits

- **Short hitches** (up to about 0.2 s) still happen when the skin changes or a large map arrives during playback.
- **City labels use modern names** (the Wikidata label), so "Istanbul" appears in 500 AD. Some cities carry odd
  founding years from Wikidata.
- **Weak Wikipedia matches** for obscure peoples (roughly a third of random names, mostly from the 1492 map of
  the Americas) are labelled "Possible match" or show map facts only.
- **Region names and odd rulers come from the dataset** as is ("Khoisan" as a top power, spellings like "Zhoa").
- **Offline**: art, music and exotic-script fonts are only available offline if they were used while online.
- **MP4 export** depends on the browser; Chrome offers WebM always and MP4 where supported.
- **Low quality** halves the 4K textures, sphere detail and label count; it does not change the map data.
- **Earth texture is 4K**, so the ground is soft at the closest zoom (about 400 km across); borders stay sharp.
- **Tour facts** were researched by agents from Wikipedia and checked by script for data consistency, not
  re-verified by a second reader.
- `404.html` links to the site root, so it assumes hosting at a domain root.
- Not tested on Firefox, Safari or a real phone; only Chrome on this laptop.

## What I would do next

1. Historical city names per era, and capitals from a curated list.
2. A second reader pass over every tour step, and more tours (Aztecs and Incas, the Ottomans).
3. Prebuild triangulated geometry so map switches cost nothing on the main thread.
4. Real recordings for the ten cultures that fall back to generated music.
5. Firefox and Safari testing, and a touch-first layout for phones.
