# Chronos: progress log

If you see only "continue": read this file, check `git log --oneline`, and resume at the first unchecked item.

## Checklist (mirrors section 12 of FINAL_PROMPT.md)

- [ ] `npm run build` gives a static `dist/` (index, app, credits, privacy, 404) that works offline after first load
- [ ] Globe at least as realistic as `look-test.html`, 55+ fps on Medium at 1080p
- [ ] All 49 snapshots crisp at every zoom, cross-fade, map year always shown
- [ ] Any region in any year clickable with sourced info; sea and unclaimed land respond
- [ ] 24 skins plus default, each verified in a screenshot, switching by the rules
- [ ] Music per culture with cross-fades and credits; procedural fallback
- [ ] Event markers in time, uncluttered, clickable, sourced
- [ ] 8+ researched story tours play start to finish
- [ ] Search, share links, settings, shortcuts, onboarding, credits
- [ ] Creator mode records 16:9 and 9:16 with music, no watermark
- [ ] Landing page follows the skill and plan, 390px check, real globe hero
- [ ] No console errors; section 11 verification recorded here
- [ ] README.md, CREDITS.md, LICENSE, final PROGRESS.md

## Milestones

- [ ] M1 globe, camera, timeline, crisp borders, cross-fade, labels, picking, realm panel
- [ ] M2 skins, skin rules, music + procedural fallback
- [ ] M3 events, search, powers list, share links
- [ ] M4 story tours (data written by research agents in `src/tours/*.json`, checked by `src/tours/_check.mjs`)
- [ ] M5 creator mode, screenshots
- [ ] M6 landing page, credits, 404, privacy
- [ ] M7 performance, accessibility, onboarding, polish, verification

## Decisions

- **Stack**: Vite 8, plain ES modules, three 0.170.0, earcut. No d3-geo: picking uses a planar even-odd test on the
  same unwrapped lon/lat rings that are drawn (handles antimeridian and holes, immune to GeoJSON winding problems
  that make `geoContains` return the complement). Independent check in tests uses the raw GeoJSON.
- **Data prep** (`tools/prepare-data.mjs`, runs before dev and build, never touches originals): borders become
  `public/d/b/<year>.json` (0.001 degree grid, delta encoded, 61 MB to 12 MB, label points by pole of
  inaccessibility, areas), events become compact rows, regions a search index, plus credits and font loaders.
  Events are one 1.5 MB file loaded after first paint rather than split per century (19k rows is small in memory).
- **Borders**: fills are earcut triangles in lon/lat, subdivided until every edge is under 2.5 degrees (edge-only
  criterion so neighbours split identically, no cracks), projected to the sphere. Lines are my own instanced
  screen-space fat line shader (capsule SDF: realm-coloured glow, dark edge, pale core; feathered for
  BORDERPRECISION 1; faint for peoples; gold for the selection; animated dash for tour routes). A stencil bit makes
  each pixel take one line fragment, so shared borders and joints do not double-blend. Geometry is built in a Web
  Worker; the newest request wins while scrubbing.
- **Cross-fade**: while playing, the next map fades in over the last part of each interval; paused shows the
  latest map at or before the year. The year frame always says which map is on screen.
- **Labels, city names and event markers** are drawn on a 2D canvas above the WebGL canvas, so creator mode can
  composite both canvases into the recording.
- **Selection**: a click selects one region (NAME); the powers list and tours select a power (SUBJECTO group).
- **Colonies** (hatched): from 1450, ruled by a colonial power whose name differs from the region's.
- **Kinds**: only `people` regions are drawn faint; `state` and `region` are solid (most ancient states are `region`).
- **Stud shapes per skin**: round (mongol, china, japan, africa, prehistory, norse), star (islamic, ottoman, persia,
  mughal), square (rome, greece, egypt, mesopotamia, andes, mesoamerica, modern, worldwars, revolution), diamond (rest).
- **ffprobe is not installed** on this machine: recordings are verified in the browser (video element metadata + audio tracks).

## Missing or odd inputs

- Music: no tracks for egypt, mesopotamia, rome, india_classical, medieval_europe, mongol, africa, mesoamerica,
  mughal, modern. These use the procedural fallback.
- `data/borders` features without a NAME (42 to 629 per map) are treated as unclaimed land.

## Tour sources

See `sources` in each `src/tours/*.json`. Notes from the research agents are appended below as they finish.

### genghis, rome, alexander, golden-age, mughals (agent 1, done, all pass `_check.mjs`)

All from English Wikipedia articles listed in each file. Deliberately left out as unverifiable or disputed: army
sizes and death tolls, the "salting of Carthage", legends (Ibn al-Haytham's feigned madness, Thaïs and the fire),
"father of" labels. Hedged as reported: the Indus leap, the die-is-cast line, the Gordian knot, the Tigris ink story.
Realm is null where the map in effect has no fitting name (e.g. Rome 753 BC, Macedon 336 BC). Some realm names
follow the map in effect, not the event (27 BC highlights "Roman Republic" from the 100 BC map).

## Verification results

(filled in during M7)
