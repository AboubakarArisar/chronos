import { open, sleep } from './lib.mjs';
const { browser, page } = await open('/app.html#y=1938&c=30,60,3.2');
await page.evaluate(() => window.chronos.prefs.set('qualityAuto', false));
for (const q of ['high', 'low', 'medium', 'high']) { await page.evaluate(q => window.chronos.globe.setQuality(q), q); await sleep(7000); console.log(q, await page.evaluate(() => [window.chronos.fps.avg.toFixed(1), window.chronos.fps.min.toFixed(1), JSON.stringify(window.chronos.globe.size)])); }
await browser.close();
