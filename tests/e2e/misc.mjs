// Extra checks: High quality (bloom), first-visit intro + coach marks + sound prompt, narrow layout, keyboard reachability.
import fs from 'node:fs';
import { open, sleep } from './lib.mjs';
const out = {};
{ // High quality
  const { browser, page, errors } = await open('/app.html#y=1938&c=30,60,3.2');
  await page.evaluate(() => { window.chronos.prefs.set('qualityAuto', false); window.chronos.globe.setQuality('high'); }); await sleep(4000);
  out.high = await page.evaluate(() => ({ fps: +window.chronos.fps.avg.toFixed(1), q: window.chronos.globe.quality })); out.high.errors = errors;
  await page.screenshot({ path: 'tests/screens/quality-high.jpg', type: 'jpeg', quality: 82 });
  await page.evaluate(() => window.chronos.globe.setQuality('low')); await sleep(2500);
  out.low = await page.evaluate(() => ({ fps: +window.chronos.fps.avg.toFixed(1), q: window.chronos.globe.quality }));
  await page.screenshot({ path: 'tests/screens/quality-low.jpg', type: 'jpeg', quality: 82 });
  // keyboard: tab through the app and list what gets focus
  await page.evaluate(() => window.chronos.globe.setQuality('medium')); const seq = [];
  for (let i = 0; i < 26; i++) { await page.keyboard.press('Tab'); seq.push(await page.evaluate(() => { const e = document.activeElement; const cs = getComputedStyle(e); return (e.getAttribute('aria-label') || e.title || e.textContent || e.id).trim().slice(0, 22) + (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? '' : ' [no focus ring]'); })); }
  out.tabOrder = seq;
  await page.keyboard.press('Escape'); await page.keyboard.press('?'); await sleep(400); out.helpOpen = await page.evaluate(() => !document.getElementById('modal').hidden && document.getElementById('mbody').textContent.slice(0, 18)); await page.keyboard.press('Escape');
  await page.keyboard.press('Space'); await sleep(1200); out.spacePlays = await page.evaluate(() => window.chronos.timeline.state.playing); await page.keyboard.press('Space');
  await browser.close();
}
{ // first visit
  const { browser, page, errors } = await open('/app.html', { fresh: true });
  await sleep(1500); out.intro = { cls: await page.evaluate(() => document.body.className), year: await page.evaluate(() => document.getElementById('introyear')?.textContent) };
  await page.screenshot({ path: 'tests/screens/intro.jpg', type: 'jpeg', quality: 80 });
  await sleep(7500); out.intro.coach = await page.evaluate(() => !document.getElementById('coach').hidden && document.querySelector('#coach h3')?.textContent);
  await page.screenshot({ path: 'tests/screens/coach.jpg', type: 'jpeg', quality: 80 });
  for (let i = 0; i < 3; i++) { await page.click('#cnext'); await sleep(400); }
  await sleep(600); out.intro.soundPrompt = await page.evaluate(() => !!document.getElementById('soundask')); out.intro.audioBeforeClick = await page.evaluate(() => window.chronos.audio.playingSkin);
  await page.click('#sndyes'); await sleep(5000); out.intro.afterSoundOn = await page.evaluate(() => ({ playing: window.chronos.audio.playingSkin, now: document.getElementById('nowplaying').textContent }));
  await page.screenshot({ path: 'tests/screens/sound-on.jpg', type: 'jpeg', quality: 80 });
  await page.reload(); await page.waitForFunction(() => window.chronos?.ready); await sleep(1500); out.intro.secondVisitIntro = await page.evaluate(() => document.body.classList.contains('intro') || !document.getElementById('coach').hidden);
  out.intro.errors = errors; await browser.close();
}
{ // narrow touch-sized screen
  const { browser, page, errors } = await open('/app.html', { width: 430, height: 860 });
  await sleep(3000); await page.mouse.click(215, 430); await sleep(2500);
  out.narrow = await page.evaluate(() => ({ overflowX: document.documentElement.scrollWidth - innerWidth, banner: document.getElementById('bname').textContent, bannerRect: (r => [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)])(document.getElementById('banner').getBoundingClientRect()) })); out.narrow.errors = errors;
  await page.screenshot({ path: 'tests/screens/narrow.jpg', type: 'jpeg', quality: 80 }); await browser.close();
}
fs.writeFileSync('tests/results/misc.json', JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
