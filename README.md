# Chronos

**Watch 5,000 years of history move across the Earth.**

Chronos is a free, open source 3D history globe for the desktop browser. A photoreal Earth carries real historical
borders from 3000 BC to today. Press play and empires grow, split and fall. Pause on any year, zoom in, click any
region or event and read about it. The interface takes on the look of the culture you are exploring (Roman marble,
Mongol felt, Islamic tilework, Mughal inlay and 20 more), and the music changes with it. Guided story tours tell
famous stories step by step, and a creator mode records clean map clips for YouTube and Shorts with no watermark.

No backend, no accounts, no tracking, no ads. GPL-3.0.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open `http://localhost:5183/` (landing page) or `http://localhost:5183/app.html` (the globe).
Node 20 or newer. `npm run dev` first runs `npm run prepare-data`, which builds `public/` from `data/` and `assets/`
(a few seconds; the originals are never modified).

## Build and deploy

```bash
npm run build
```

```bash
npm run preview
```

`dist/` is a plain static site (`index.html`, `app.html`, `credits.html`, `privacy.html`, `404.html`, `sw.js`).
Upload it to any static host; all paths are relative, so a sub-folder works too (only `404.html` links to the site
root). A service worker caches the app shell on the first visit and the 49 maps shortly after, so the globe works
offline afterwards. Art, music and extra fonts are cached as they are used. The whole `dist/` is about 250 MB,
almost all of it music and artwork.

## Test

```bash
npm test
```

Unit tests (timeline scale, picking, search scoring, Wikipedia resolver, tour data).
Browser checks drive the system Chrome through `playwright-core` (start the dev server first):

```bash
node tests/e2e/verify.mjs
```

```bash
node tests/e2e/landing.mjs
```

```bash
node tests/wiki-live.mjs
```

Results are written to `tests/results/`, screenshots to `tests/screens/`. Set `BASE=http://localhost:4183` to run
against `npm run preview`.

## Features

- **Globe**: 4K day texture, night lights, relief, ocean shine, drifting clouds, atmosphere, stars, ACES tone
  mapping, bloom on High. Orbit with inertia, scroll or pinch to zoom from the whole Earth to about 400 km across,
  double click to zoom to a point, smooth flights.
- **Borders**: 49 dated world maps drawn as vector fills and lines that stay sharp at every zoom, cross-fading as
  time passes. One colour per ruling power, colonies hatched, approximate borders feathered, peoples faint.
  The year frame always says which map is on screen.
- **Timeline**: 3000 BC to today on a scale with more room for recent centuries. Play at 1, 5, 20 or 100 years per
  second, scrub, jump to an era, step between map years, or type a year.
- **Click anything**: every region opens a panel with its ruler, kind, years on the maps, area and a live Wikipedia
  summary. "Through time" draws its outline in every map where it exists, with an area sparkline. The sea and
  unclaimed land answer too.
- **Events**: 19,326 battles, treaties, foundings, disasters, expeditions and buildings from Wikidata appear around
  their year, ranked by fame and thinned by zoom, with live Wikipedia summaries.
- **24 culture skins** plus a default, chosen from the selected realm, else the largest realm in view, else the era.
- **Music of the age**: period recordings per culture with 3 second cross-fades, and gentle generated music in the
  culture's scale where no recording exists. Never plays before your first click.
- **Story tours**: ten researched tours (Genghis Khan, Rome, Alexander, the Islamic Golden Age, the Silk Road,
  the first states, the Age of Exploration, the end of empires, the Mughals, Mansa Musa).
- **Search**: years, realms, events, cities and stories in one box, with typo tolerance.
- **Creator mode**: record 1920×1080 or 1080×1920 clips (WebM, or MP4 where the browser supports it) with music,
  an optional year counter or title card, and four camera modes. PNG screenshots at the same sizes. No watermark.
- **Share links**: the address holds the year, camera, selection and tour step.
- Settings (quality, labels, music, real day and night, reduced motion), a first-visit introduction, a skinned
  loading screen, keyboard access throughout, and a bottom-sheet layout on narrow screens.

## Keyboard shortcuts

| Key | Action |
|---|---|
| Space | Play or pause time |
| `[` `]` | Previous or next map year |
| `1` `2` `3` `4` | Speed: 1, 5, 20, 100 years per second |
| Arrow keys | Rotate the globe |
| `+` `-` | Zoom |
| `/` | Search |
| `T` | Story tours (`N` next step, `B` back) |
| `R` | Record |
| `M` | Music on or off |
| `L` | Copy a link to this view |
| `Esc` | Close a panel or clear the selection |
| `?` | Shortcut sheet |

## Data sources

| What | Source | License |
|---|---|---|
| Borders (`data/borders/`) | [historical-basemaps](https://github.com/aourednik/historical-basemaps) | GPL-3.0 |
| Events (`data/events.json`) | Wikidata | CC0 |
| Region and event text | English Wikipedia, loaded live | CC BY-SA 4.0 |
| Earth textures (`assets/earth/`) | NASA imagery via three-globe and three.js examples | public domain / MIT |
| Artwork (`assets/art/`) | Wikimedia Commons, see `CREDITS.md` | public domain and CC |
| Music (`assets/music/`) | Wikimedia Commons and Library of Congress National Jukebox, see `CREDITS.md` | public domain and CC |
| Skins (`data/skins.json`, `data/eras.json`, `assets/skins/`) | this project | GPL-3.0 |

Every item is credited in the in-app Credits panel, on `credits.html` and in `CREDITS.md` (generated from the
manifests). Borders are approximate and some are disputed; the app shows them as the dataset does.

## Project layout

```
index.html, app.html, credits.html, privacy.html, 404.html   pages
src/globe/      renderer, Earth shader, camera, quality
src/map/        border worker, fills and lines, labels, events, colours
src/time/       timeline model and scale
src/ui/         skins, panels, search, tours, settings, share, onboarding
src/audio/      playlist player and procedural music
src/record/     creator mode
src/data/       Wikipedia resolver, IndexedDB cache
src/tours/      story tours (JSON) and their checker
tools/          prepare-data (data and assets into public/), postbuild (service worker)
tests/          unit tests, browser verification, results and screenshots
data/, assets/  the prepared originals (see manifest.json)
docs/           landing page plan and design skill
look-test.html  the approved look this app was built from
```

`PROGRESS.md` records decisions, measured numbers and known limits.
