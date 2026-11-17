# Final execution prompt: Chronos

Paste everything below the line into a **fresh Claude Code session opened in** `D:\yt-again\longvid\one-shot-challenge\history-globe`, running Fable 5.2. Do not send anything after it.

---

Build **Chronos**, a complete, polished, free and open source 3D history globe for the desktop browser, plus its landing page, working autonomously from start to finish.

This is a one-prompt challenge entry. The rules forbid me from sending you anything after this message, so nobody will answer questions, approve plans or correct course. Never stop to ask: decide, write the decision in `PROGRESS.md`, and continue. Keep working until every item under "Done means" (section 12) is true and verified. If the session is interrupted and you see only the word "continue", read `PROGRESS.md` and resume.

The goal is not "it works". The goal is that people who open it say "wow", play with it for twenty minutes, and send the link to a friend. Treat look, feel, smoothness and correctness as equally important as features.

# 1. The product

**Chronos: watch 5,000 years of history move across the Earth.**

A photoreal 3D Earth with a timeline from 3000 BC to today. Real historical borders appear on the globe and change as time moves. Press play and empires grow, split and fall. Pause on any year, zoom into any area, click any region or event and read about it. The whole interface changes its look to match the culture you're exploring (Roman marble, Mongol felt, Islamic tilework, Mughal inlay and 20 more), and the music changes with it. Guided story tours tell famous stories step by step. A creator mode records clean cinematic map clips for YouTube and Shorts with no watermark.

Who it's for, in order: history content creators (they need animated maps and today pay animators or spend days in After Effects), teachers and students, curious people.

What makes it different from existing history map sites: they are flat, dated, silent database viewers. Chronos is cinematic, culture-aware, musical, clickable everywhere, and made for creators. Every decision should push in that direction.

# 2. Read these first, in this order

Everything visual, every dataset and every license is already prepared in this folder. Before writing any code, read these files in full and look at every screenshot:

1. `README.md` and `manifest.json`: every asset, its source, license and quirks, the lat/lon to sphere convention, and the border data's quirks.
2. `look-test.html` (open it in a browser too: `python -m http.server 8765` then `http://localhost:8765/look-test.html`, press 1, 2, 3) and `skin-mongol.jpg`, `skin-rome.jpg`, `skin-abbasid.jpg`. **This is the approved look.** Reuse its globe shader (day/night blend, normal-map relief, ocean shine, rim glow, tone mapping), atmosphere shell, star field, metal-framed panels, studs, border strips, engraved titles, vignette and grain, camera flights and label projection. Improve it, never downgrade it.
3. `data/skins.json`, `skins-gallery.html`, `skins-gallery-1.jpg`, `skins-gallery-2.jpg`, and the files in `assets/skins/<id>/`: the 24 culture skins (palette, metal, fonts, native-script motto, pattern, border strip, emblem, materials, music scale and timbre).
4. `data/eras.json`: how a skin is chosen (regex on the selected polity's NAME/SUBJECTO, else the era fallback for the current year).
5. `data/borders/` (49 GeoJSON snapshots, 3000 BC to 2010) and `data/borders/index.json`.
6. `data/regions.json`: an index of all 2,979 region names in the borders (kind: state, region or people; map years it appears in; ruling powers; a `wiki_search` string). Article text is **not** stored: the app resolves it live (section 5.5).
7. `data/events.json` (19,326 events: battles, treaties, city foundings, disasters, expeditions, buildings, ancient monuments, each with Wikidata id, year, coordinates, `fame` = number of Wikipedia language editions, English Wikipedia title and a `summary_api` URL) and `data/events-lite.json` (top 6,000 by fame). Coverage is dense after 1500 and thin before 500 BC; Wikidata has occasional wrong dates or places, so any event you feature in a tour or on the landing page must be checked against its Wikipedia article.
8. `assets/art/manifest.json` and `assets/art/<skin>/`: public-domain and CC artworks per culture, with credits and a suggested crop focus. Also `assets/indus.jpg`, `kublai.jpg`, `trajan.jpg`, `wisdom.jpg`.
9. `assets/music/manifest.json` and `assets/music/<skin>/`: period music per culture, with licenses. Skins with no tracks need the procedural fallback (section 5.4).
10. `assets/earth/`: 4K day, night, topology, water, normal, specular and cloud textures.
11. `docs/landing-page-plan.md` and `docs/landing-page-design-skill.md`: the landing page plan and the design system it must follow.

If a file listed here is missing or a manifest lists a file that doesn't exist, handle it gracefully (skip or fall back), log it in `PROGRESS.md`, and continue.

# 3. Hard rules

- **Never invent borders, facts, dates, statistics, quotes or credits.** Borders come only from `data/borders/`. Region and event text comes from `data/regions.json` and `data/events.json` (Wikipedia/Wikidata). Text you write yourself (story tours, era intros, UI copy) must be checked against Wikipedia before you commit it; when unsure, leave the claim out.
- **Never a cartoon globe.** No flat-shaded sphere, no untextured or flat-coloured box, sphere or plane standing in for something. If an asset is missing, use another prepared asset or leave the element out. Debug shapes only behind a debug flag that is off by default.
- **Everything local, except article text.** The app loads its own textures, data, fonts, art and music from this folder (install fonts with `@fontsource/*` packages or download the Google Fonts files into the build). It must work offline after the first load. The one runtime network use: when online, region and event cards load the English Wikipedia summary and thumbnail live from the browser (REST summary API and search API with `origin=*`, both CORS-enabled), cache them in IndexedDB, and credit Wikipedia. Offline, cards show the local data (name, dates, ruling power, type, participants) plus skin art, and say the full article needs a connection.
- **Licenses.** Credit every dataset, image and track in an in-app Credits panel and in `CREDITS.md` exactly as the manifests state. The border data is GPL-3.0, so the project is GPL-3.0: add `LICENSE`.
- **No backend, no accounts, no tracking, no ads.**
- **Respect the user.** Music never autoplays before the first click. Remember mute and volume. Support `prefers-reduced-motion`.
- **Culture skins are respectful and authentic:** use the real motifs, scripts and colours provided; no caricatures, no fake "ethnic" fonts.

# 4. Technology

- Vite (latest stable) with plain JavaScript ES modules, no UI framework. `three@0.170.0` (same as the look test). Allowed extra packages, if useful: `d3-geo` (point-in-polygon on the sphere, projections), `earcut` (triangulation), `three/examples/jsm` add-ons (Line2/LineMaterial for crisp borders, EffectComposer for bloom/FXAA), `@fontsource/*`, `playwright-core` for testing. Add anything else only if it clearly saves a lot of work, and note why in `PROGRESS.md`.
- Pages: `index.html` (landing page), `app.html` (the globe), `credits.html`, `404.html`, `privacy.html`. `npm run dev`, `npm run build` (static `dist/` that works from any static host and from `vite preview`), `npm test`.
- Copy the prepared data and assets into `public/` at build time with a small script (do not modify the originals). Precompute anything heavy in a build step (`tools/` scripts run by `npm run prepare-data`): for example simplify/convert GeoJSON per snapshot to a compact binary or TopoJSON, build a spatial index for picking, merge region info, split events per century. Keep the first load fast: load the snapshot for the current year first, the rest lazily.

# 5. Features

## 5.1 Globe and camera

- Start from the look test's globe and keep its realism: 4K day texture, night lights on the dark side, relief from the normal/topology maps, ocean shine from the water mask, drifting clouds, atmosphere halo, stars, ACES tone mapping. Add subtle bloom on night lights and the sun glint if it stays tasteful. Sun position: fixed pleasant daylight over the area being viewed (the globe is about history, not real-time astronomy), with a setting to show real day/night.
- Camera: orbit with inertia, scroll and pinch zoom from full-Earth view down to roughly regional level (about 400 km across the screen), double-click to zoom to a point, keyboard (arrows to rotate, +/− to zoom). Smooth eased flights (`flyTo(lat, lon, distance, duration)`) used by search, events, stories and region focus. Never let the camera go inside the globe or flip over the poles.
- **Borders stay crisp at every zoom level.** The look test paints borders into a canvas texture; that blurs when zoomed in. Use vector borders on the sphere (fat lines via Line2/LineMaterial or an equivalent shader, slightly above the surface, depth-tested so far-side lines hide) plus fills that stay sharp (triangulated polygons on the sphere with enough subdivision, or a high-resolution fill texture regenerated for the visible area). Keep the look test's style: soft inner glow along each realm's border, the selected realm brighter and gold-edged, approximate borders (BORDERPRECISION 1) drawn softer/feathered, cultural regions and peoples drawn faint.
- Colours: one colour per ruling power (SUBJECTO), stable across all years (hash the name into a curated palette of deep, map-like colours; fixed colours for major empires so Rome is always imperial red, the Mongols gold, the Abbasids teal and so on). Colonies take their colonial power's colour with a hatched pattern.
- Labels: realm names placed inside the realm's largest polygon (pole of inaccessibility or area-weighted centroid), sized by area and zoom, faded near the limb, never overlapping each other (simple collision pass), never drawn over the UI panels. Peoples/cultural regions only labelled when zoomed in. City labels when zoomed in: well-known cities from the `city` events (founded before the current year, ranked by fame).
- Quality setting (Low/Medium/High) that changes texture size, sphere segments, line widths, bloom and label density. Default by detected GPU performance (measure the first 60 frames).

## 5.2 Timeline

- Range 3000 BC to today. Use the look test's non-linear scale (more room for recent centuries) and its era labels. Ticks for millennia and centuries; the year shown large in the top frame ("1279 AD", "500 BC"), with the era name below and "Borders: map of 1279" under it.
- Controls: play/pause (space), speed (1, 5, 20, 100 years per second), step to the previous/next map year (`[` and `]`), drag the knob to scrub, click a tick or era chip to jump, type a year in the year frame.
- Snapshots are irregular. While time moves between two snapshots, **cross-fade** the borders (the next map fades in during the last part of the interval) rather than snapping, and keep labels stable for realms present in both. Always show which map year is on screen.
- Event markers fade in and out around their year as time passes (section 5.6).
- Pausing is just stopping time: the user can then explore freely; nothing else changes.

## 5.3 Culture skins

- 24 skins from `data/skins.json` plus a default (the gold strategy style of the look test). Implement them as CSS custom properties on `<body data-skin="...">` exactly like the look test, driven by the JSON (panel colour, ink, ink2, highlight, accent, metal gradient from the 4 stops, fonts, pattern, strip and emblem assets). Light-panel skins (`panel_is_light`: Rome, Mughal, Exploration) need dark text and the light-variant shadows, as in the look test's Rome skin.
- Which skin: the selected realm's skin (regex match from `eras.json`), else the skin of the largest realm in view if it matches, else the era fallback for the current year. Switching skins cross-fades the panels (out 0.35 s, swap, in 0.35 s) and never flickers while scrubbing: only switch after the decision has been stable for 1.2 s.
- Each skin also sets: the native-script motto line in the realm banner (deco font), the emblem in the banner, panel texture/pattern, border strip, stud shape (diamond, round, star, square: pick per skin and note it), button style, and the art used in empty states.
- Make the skins look rich: subtle material texture (noise, marble veins, felt, paper, lacquer) layered with the pattern, bevelled metal frames, engraved headings. Check every skin in screenshots (section 11) and fix any that looks cheap, unreadable or low contrast (text contrast at least 4.5:1).

## 5.4 Music of the age

- Each skin has a playlist from `assets/music/manifest.json`. When the active skin changes, cross-fade to that skin's music over 3 s. While scrubbing fast or playing at high speed, don't thrash: change music only after the skin has been stable for 4 s.
- Music starts only after the user's first interaction (an elegant "Sound on" prompt on first visit). Volume slider and mute in the HUD, remembered in localStorage. A small "Now playing" line with title, performer and license, linking to Credits.
- **Procedural fallback** for skins with no tracks: a gentle generative piece with WebAudio using the skin's `scale` (semitones) and `timbre` (harp, lyre, pluck, oud, kora, koto, sitar, drone, bowed, flute, choir, brass, piano, lute, pad): a soft drone or pad plus a sparse melodic voice that wanders the scale with plucked or breathy envelopes and a long reverb (convolver with a generated impulse). It must sound calm and pleasant, never like a ringtone. Same cross-fade rules.
- During record mode the music goes into the recording (section 5.9).

## 5.5 Click any region

- Hover: the realm under the cursor gets a soft highlight and a small tooltip (name, ruled by).
- Click: select it. The realm glows gold-edged, the skin follows it, and the realm panel (top left, the look test's banner) shows: emblem and motto of its skin, name, "ruled by" (SUBJECTO) if different, kind (state, people, region), first and last map years it appears in, and the Wikipedia summary with thumbnail and a "Read on Wikipedia" link, loaded live (show a skeleton while loading).
- Resolving the article (write this as a small, well-tested module): 1) request the REST summary for the exact NAME; accept it unless it is a disambiguation page or (when the region only exists before 1800) a modern country, city or province; 2) otherwise call the search API (`action=query&list=search&srsearch=<wiki_search>&origin=*`) and score the top results: exact or near title match, descriptions with empire/kingdom/dynasty/people/century words for old regions, penalise "History of", "List of", disambiguation; 3) cache the decision and summary in IndexedDB; 4) label weak matches "Possible match: <article>". Test it in Node or the browser on at least: Han (100 AD → Han dynasty), Roman Empire, Great Khanate, Khanate of the Golden Horde, Egypt (3000 BC → Ancient Egypt), Mali (1300 → Mali Empire), Tang Empire, Sultanate of Delhi, Inca Empire, Kievan Rus', Bantu peoples, and 30 random names; record the results.
- "Through time" button: ghost outlines of the same realm in every snapshot where it exists, plus a small sparkline of its area over time; clicking a point jumps the timeline there.
- Picking must be correct everywhere: raycast to the sphere, convert to lat/lon, test against the current snapshot's polygons with a spatial index (bounding boxes per feature on a grid) and a spherical point-in-polygon (`d3-geo` `geoContains`) that handles the antimeridian and holes. Clicking the sea or an unclaimed area shows a short "Unclaimed land" or ocean name panel instead of nothing.
- The "Powers of the age" list (left) shows the largest realms in the current map year, by area, with their colours; clicking one selects it and flies the camera to it.

## 5.6 Events

- Markers from `data/events.json`: icon per type (battle crossed swords, siege tower, treaty scroll, founding pillar, disaster flame, discovery compass, voyage ship, building dome), drawn as crisp sprites on the globe that hide behind the limb.
- Which ones show: events within a window around the current year (wider when zoomed out or playing fast, narrower when paused and zoomed in), ranked by fame, limited by zoom so the globe never looks cluttered (about 12 on the full globe, more when zoomed in). Cluster nearby markers. New markers pop in with a short pulse.
- Click: the event card (right panel, as in the look test) shows type tag, name, date, place, participants for battles, then the Wikipedia summary and picture loaded live from `summary_api` (cached; offline: a matching art piece from the skin), "Read on Wikipedia", and "Fly here".
- Density: there are 13,500 events after 1500 and only a few hundred before 500 BC. Rank by `fame`, scale the visible count with zoom, and never let the modern era look cluttered or the ancient era look empty (lower the fame threshold for older periods). If several events overlap, show a small list first.
- The look test's hand-written route lines (campaigns, trade routes) belong to story tours (5.7), not to general events.

## 5.7 Story tours

Write at least **8 tours**, each 8 to 12 steps. Each step: year, camera target and distance, optional realm to select, optional route line to draw (animated dash, as in the look test), title, 2 to 4 sentences of narration, art (from `assets/art`), and the skin/music follow automatically. Next/back/pause controls, a progress bar, and the user may explore mid-tour and then resume.

Tours: (1) Genghis Khan: from outcast to world conqueror (1162 to 1227) and the Mongol world under Kublai (to 1279); (2) The rise and fall of Rome; (3) Alexander's march east; (4) The Islamic Golden Age and the House of Wisdom; (5) The Silk Road; (6) Ancient Egypt and Mesopotamia, the first states; (7) The Age of Exploration (Zheng He, Columbus, da Gama, Magellan); (8) The end of empires in the 20th century. Add more if time allows (for example the Mughals, Mali under Mansa Musa, the Aztecs and Incas).

Research every tour on the web (Wikipedia first) before writing it, and keep the writing spare, vivid and accurate. Record your sources per tour in `PROGRESS.md`. Never put words in historical figures' mouths unless the quote is well attested, and then mark it as reported.

## 5.8 Search

One search box (`/` to focus) that finds years ("1258", "500 BC"), realms (any NAME in any snapshot, jumping to a year where it exists), events, cities/capitals and tours, with fuzzy matching and keyboard navigation. Picking a result flies there and selects it.

## 5.9 Creator mode (record)

- A "Record" button opens a small panel: aspect 16:9 (1920x1080) or 9:16 (1080x1920), length or "until I stop", camera (current view, slow orbit, follow timeline playback, or a story tour), overlays (none, year counter, title card with custom text in the current skin's fonts), music on/off.
- Recording hides all UI, renders at the chosen size (offscreen canvas or resized renderer with correct aspect), and records the canvas plus the WebAudio output with `MediaRecorder` (WebM VP9/Opus, MP4 if the browser supports it). Show a countdown and a discreet stop control that is not captured. Then offer the file for download, named like `chronos-mongol-1279.webm`. No watermark.
- Also a "Screenshot" action for a clean PNG at the chosen size.

## 5.10 Sharing and state

The URL hash holds year, camera (lat, lon, distance), selected realm or event, and open tour step, so any view can be shared and reloads exactly. A "Copy link" button.

## 5.11 Polish and the rest

- First visit: a short cinematic intro (the globe drifts in from space while the year counts up to a default year and era), then three coach marks: timeline, click a region, record. Skippable, never shown again.
- Keyboard shortcut sheet (`?`). Settings panel: quality, labels density, real day/night, music volume, reduced motion.
- Loading: a skinned loading screen with progress while textures and the first snapshot load (skeletons, not spinners). Errors in plain words with what to do.
- Responsive: designed for laptop and desktop (1280x720 and up). On narrow or touch screens, panels collapse into a bottom sheet; exploring still works.
- Accessibility: every control reachable by keyboard with visible focus, labelled buttons, sufficient contrast, panels announced politely to screen readers.
- Performance targets on a typical laptop with integrated graphics at 1920x1080 on Medium: 55 to 60 fps while orbiting and while playing time at 20 years/second; snapshot switch without a visible hitch (prepare geometry off the main thread with a Web Worker if needed); first meaningful paint under 3 s on a local server; no memory growth over a 10-minute play session (dispose old geometries and textures).

## 5.12 Landing page

Build `index.html` from `docs/landing-page-plan.md`, following `docs/landing-page-design-skill.md` strictly for the landing page (Manrope only, flat backgrounds, Tailwind type scale and spacing tokens, named text styles, B7 motion, B11 tagline reveal, B10 ship list, 390px check). Use design idea 1 (living globe hero) unless it can't reach 60 fps on the hero, then idea 3. The hero runs the real globe (shared module, UI hidden, slow drift through time). Fill the proof numbers from the real data counts at build time. The in-app skins are exempt from the landing page skill; it applies to the landing page only.

# 6. When you get stuck: use the internet

You have web search and web fetch. Use them whenever you are unsure or blocked, instead of guessing:
- API or library questions (three.js, WebAudio, MediaRecorder, d3-geo, Vite): read the current official docs and examples.
- Rendering or math bugs (antimeridian, polygon winding, depth fighting, line widths): search for known solutions.
- Historical facts for tours and era text: check Wikipedia and one more reliable source; never rely on memory alone.
- Library errors: search the exact error message.
Only install packages from npm. Never run scripts downloaded from random sites. Note what you looked up and what you decided in `PROGRESS.md`.

# 7. Content rules

- Names and dates exactly as the data has them in data views; in your own text, use common English names.
- Dates: "500 BC", "AD" not needed after 1 AD except in the big year frame ("1279 AD").
- Tone: spare, vivid, factual, no hype. No jokes about atrocities. Neutral on modern disputed borders: show them as the data does, label the map year, and add a short note in Credits that borders are approximate and some are disputed.
- Every piece of text from Wikipedia keeps a "Wikipedia" source link; license CC BY-SA noted in Credits.

# 8. Architecture (suggested)

`src/globe/` (renderer, earth material, atmosphere, stars, camera controls, quality), `src/map/` (snapshot loading, border geometry, fills, labels, picking, colours, cross-fade), `src/time/` (timeline model, scale, playback), `src/ui/` (panels, skins, search, tours, settings, credits, coach marks), `src/audio/` (playlist player, procedural music, mixer for recording), `src/record/`, `src/data/` (loaders, workers), `tools/` (data preparation), `tests/`. Keep modules small and named for what they do.

# 9. Working method

1. Read everything in section 2. Write `PROGRESS.md` with a plan, decisions and a checklist mirroring section 12.
2. Build in milestones and commit after each one (`git init` first; commit messages without AI attribution). After each milestone, run the app in a real browser, screenshot it, compare with the look test screenshots, and fix what looks worse.
   - M1: globe from the look test, camera, timeline, crisp borders for all 49 snapshots with cross-fade, labels, region picking and the realm panel.
   - M2: all 24 skins plus default, skin selection rules, music player with cross-fades and the procedural fallback.
   - M3: events, search, powers list, share links.
   - M4: story tours.
   - M5: creator mode and screenshots.
   - M6: landing page, credits, 404, privacy.
   - M7: performance, accessibility, onboarding, polish, final verification.
3. If time runs short, finish and polish the earlier milestones rather than leaving later ones half done. A beautiful M1 to M4 beats a broken M1 to M7.

# 10. Things that will go wrong (handle them)

- Polygons crossing the antimeridian or containing a pole: split or unwrap correctly; test Russia, Mongol Empire 1279, Antarctica-adjacent shapes.
- Holes and multipolygons: picking and fills must respect holes.
- Huge snapshots: simplify geometry for low zoom and keep full detail for close zoom.
- Fonts with exotic scripts (Mongolian vertical script, cuneiform, hieroglyphs, Nastaliq): load lazily only when that skin is first used; vertical Mongolian uses `writing-mode: vertical-lr`.
- Autoplay restrictions: audio context resumes on first gesture.
- MediaRecorder support differs: detect supported mime types and fall back gracefully.
- Wikipedia unreachable, slow or rate-limited (HTTP 429): back off, show local data and skin art, never block the UI.
- Low-end GPUs: drop to Low quality automatically if fps stays under 40.

# 11. Verification you must do yourself

Use `playwright-core` driving the system Chrome (headed, real GPU) against `npm run dev` and again against the built `dist/` via `vite preview`:
- Screenshot every skin (select a matching realm in a fitting year) at 1920x1080 and inspect each one; fix any that is unreadable, cheap-looking or broken. Save them in `tests/screens/`.
- Click 20 random land points in each of 10 different map years and assert the realm panel shows the correct NAME (compare with a point-in-polygon check in Node on the raw GeoJSON).
- Scrub the whole timeline at 100 years/second and at 5 years/second: no console errors, no frame below 30 fps for more than 1 s on Medium, music changes no more than once per stable skin.
- Play every story tour start to finish automatically.
- Record a 10-second 16:9 and 9:16 clip with music; check the files have video and audio and the right dimensions (ffprobe if available, else inspect metadata in the browser).
- Search for "1258", "Baghdad", "Battle of Hastings", "Inca", "Rome" and check results.
- Reload a shared URL and check the view matches.
- Landing page: Lighthouse-style checks you can run, keyboard navigation, the 390px check, reduced motion.
- A 10-minute soak test: fps, JS heap and GPU memory stable.
Record every result with numbers in `PROGRESS.md`.

# 12. Done means

- [ ] `npm run build` produces a static `dist/` that runs offline after first load, with `index.html` (landing), `app.html`, `credits.html`, `privacy.html`, `404.html`.
- [ ] The globe is at least as realistic as `look-test.html`, at 55+ fps on Medium at 1080p on this laptop.
- [ ] All 49 border snapshots render crisply at every zoom, cross-fade over time, and always show their map year.
- [ ] Any region in any year can be clicked and shows correct, sourced information; the sea and unclaimed land respond too.
- [ ] 24 culture skins plus default, each verified in a screenshot, switching smoothly by the rules.
- [ ] Music plays per culture with smooth cross-fades and credits; skins without tracks use pleasant procedural music.
- [ ] Event markers appear in time, uncluttered, clickable, with sourced details.
- [ ] At least 8 researched story tours play start to finish.
- [ ] Search, share links, settings, shortcuts, onboarding and credits work.
- [ ] Creator mode records 16:9 and 9:16 clips with music and no watermark.
- [ ] The landing page follows the landing page skill and plan, passes the 390px check, and its hero runs the real globe.
- [ ] No console errors in normal use. All verification in section 11 passed and recorded.
- [ ] `README.md` (what it is, how to run, build and deploy, features, shortcuts, data sources), `CREDITS.md`, `LICENSE` (GPL-3.0), and a final `PROGRESS.md` with what works, measured numbers, known limits and what you would do next.

When everything is done, finish with a short summary: what was built, the measured numbers, how to run it, and any known limits.
