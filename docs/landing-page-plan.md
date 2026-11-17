# Chronos landing page plan

Follows `docs/landing-page-design-skill.md`. The skill's visual rules (one typeface, flat backgrounds, no italics, Tailwind scale, spacing tokens) apply to the **landing page only**. The app itself keeps its ornate culture skins, because that is the product.

## Intake (answered)

| Question | Answer |
|---|---|
| One primary action | Open the globe ("Explore history"). No signup, no payment. |
| Offer | A free, open source 3D history globe: 5,000 years of real borders, 24 culture styles, period music, clickable regions and events, story tours, and video export for creators. |
| Conversion | Click on the primary CTA that opens `app.html`. |
| ICP | 1) History YouTubers and Shorts creators who need animated maps. 2) Teachers and students. 3) Curious people. |
| Problem | Animated history maps take days in After Effects, or cost money. Free history atlases are flat, dated and silent. |
| Objections | "Is it accurate?" "Is it really free?" "Can I use clips in my videos?" "Does it work on my laptop?" |
| Traffic | Slack community, YouTube descriptions, Reddit history and teaching communities, word of mouth. |
| Proof available | Live product (the hero *is* the product), dataset credits, number of maps, events and regions (real counts from `data/`), open source repo. No testimonials yet, so no invented ones. |
| Risk reversal | Free forever, no account, open source (GPL-3.0), works offline after first load. |
| Voice | Confident, plain, a little epic. Never hype words. |
| Direction | Dark, cinematic, minimal editorial around a living globe. Manrope everywhere on this page. |

Layout choice: **A. Classic hero plus sections**, because the product explains itself the moment people see the globe move. One long scroll, no separate pages besides the app, 404 and legal.

## Page outline

1. Floating nav: logo, "How it works", "For creators", "FAQ", primary button "Explore history"
2. Hero: live globe (the real app scene, auto-playing a slow drift through time, UI hidden), headline, subheadline, CTA, proof line
3. Tagline reveal section (skill B11, words light up on scroll)
4. Benefits (4 cards, each with a short looping video or still of the real app)
5. Culture skins strip: 24 skin swatches that switch the hero globe's skin when hovered or clicked
6. How it works (3 steps)
7. For creators: record mode demo, 16:9 and 9:16 examples, "no watermark"
8. Proof: honest numbers from the data plus credits (historical-basemaps, Wikipedia, Wikidata, NASA)
9. FAQ (8 questions)
10. Final CTA, same as the hero
11. Footer: credits, license, privacy, terms, source code link

## Hero copy

- Headline, with a meaningful break: **"Watch 5,000 years of history<br>move across the Earth"**
- Subheadline: "A free 3D globe with real borders from 3000 BC to today. Pause any year, click any land, and hear the music of the age."
- CTA: **"Explore history"**
- Secondary text link (not a button, so there's only one CTA): "Watch the 40 second tour"
- Proof line: "{{maps}} historical maps · {{events}} dated events · {{regions}} places to explore · free and open source". Fill the numbers from the real data files at build time. Never invent them.

## Tagline reveal (B11)

"Every empire you learned about in school.<br>Every border it drew.<br>Every song it sang."

## Benefits

1. **See time move.** Press play and empires grow, split and fall on a real 3D Earth, using 49 dated world maps.
2. **Click anything.** Pause in any year, zoom into any region and read who ruled it, when, and what happened there.
3. **Feel each culture.** The interface turns into Roman marble, Mughal inlay or Mongol felt, and the music changes with it.
4. **Make videos in minutes.** Record a clean cinematic map clip in 16:9 or 9:16 with no watermark.

## How it works

1. **Pick a moment.** Drag the timeline or choose an era, like the Age of the Khans.
2. **Explore the map.** Zoom, click regions and events, or start a guided story.
3. **Share or record.** Copy a link to that exact view, or export a clip for your video.

## FAQ

1. **Is it really free?** Yes. No account, no ads, no paywall. The code is open source under GPL-3.0.
2. **How accurate are the borders?** They come from the open historical-basemaps project. Ancient borders are approximate and the app shows which map year you are looking at. You can report errors.
3. **Where does the information come from?** Region and event details are summaries from Wikipedia and Wikidata, with a link to the full article.
4. **Can I use recordings in my YouTube videos?** Yes. Clips have no watermark. Please credit "Chronos" and the data sources in your description.
5. **Does it work on my laptop?** It runs in Chrome, Edge and Firefox on most laptops from the last five years. A quality setting helps older machines.
6. **Does it work on phones?** You can explore on a phone. Recording and the full interface work best on a laptop.
7. **Where is the music from?** Public domain and Creative Commons recordings of traditional instruments and period pieces, credited in the app. Where none exists, the app generates gentle music in that culture's scale.
8. **Can I help?** Yes. Fix a border, add an event or translate the app on the project's repository.

## SEO and AEO

Index it. It's an evergreen tool page.
- Title: "Chronos: 5,000 years of history on a 3D globe"
- Meta description: "Free interactive 3D globe with real historical borders from 3000 BC to today. Click any region, hear period music, and record map clips for videos."
- FAQ schema from the FAQ section. OG image: a 1200x630 still of the Mongol skin at 1279.

## Design ideas (pick one; the default is idea 1)

1. **Living globe hero (default).** The real globe fills the hero, slowly drifting through time, with the year counting up in large type behind the headline. Scrolling cross-fades the skin: the page border, accent colour and music hint change as you pass each benefit. Flat #000000 background, Manrope, white to grey gradient on the headline only.
2. **Timeline scroll story.** The page *is* a timeline. Scrolling moves the globe from 3000 BC to today, and each section is pinned to an era (Egypt, Rome, Khans, Exploration, Modern) with one benefit per era. Most memorable, but heavier to build.
3. **Split screen atlas.** Left half is a calm text column. Right half is a fixed globe that reacts to the section in view (for example, "click anything" zooms into Baghdad and opens a region card). Clear and practical, good for teachers.
4. **Creator first.** The hero is a 9:16 phone mockup playing an exported Short of the Mongol conquests next to a 16:9 YouTube frame, with the CTA "Make your first map clip". Best if the main audience is YouTubers.
5. **Museum hall.** Each culture skin is a "room" card in a horizontal gallery, with a painting, motto, music preview button and a "Enter this era" link that deep-links into the app. Shows off the 24 skins and the art.

## Must ship (skill B10)

Favicon, title, meta, og:image, skip-to-content link, alt text, a custom 404 in the default gold skin, privacy and terms pages (short, honest: no tracking), credits page listing every dataset, image and music license, `prefers-reduced-motion` support, and a check at 390px with no horizontal scroll.
