// Quick interactive smoke test: click a region, open search, start a tour, check for console errors.
import { open, sleep } from './lib.mjs';
const { browser, page, errors } = await open('/app.html');
await sleep(2500);
await page.mouse.click(1100, 480); await sleep(2500);
console.log('realm:', await page.evaluate(() => [document.getElementById('bname').textContent, document.getElementById('bstats').textContent, document.getElementById('bwiki').textContent.slice(0, 120), window.chronos.skins.current]));
await page.screenshot({ path: 'tests/screens/smoke-realm.jpg', quality: 80, type: 'jpeg' });
await page.keyboard.press('/'); await page.keyboard.type('Baghdad'); await sleep(600);
console.log('search:', await page.evaluate(() => [...document.querySelectorAll('.res')].slice(0, 5).map(r => r.textContent)));
await page.keyboard.press('Enter'); await sleep(4000);
console.log('event:', await page.evaluate(() => [document.getElementById('etitle').textContent, document.getElementById('ewhen').textContent, document.getElementById('etext').textContent.slice(0, 100)]));
await page.screenshot({ path: 'tests/screens/smoke-event.jpg', quality: 80, type: 'jpeg' });
await page.evaluate(() => window.chronos.tours.start('genghis', 3)); await sleep(6000);
console.log('tour:', await page.evaluate(() => [document.getElementById('ttag').textContent, document.getElementById('ttitle').textContent, window.chronos.skins.current, location.hash]));
await page.screenshot({ path: 'tests/screens/smoke-tour.jpg', quality: 80, type: 'jpeg' });
console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no console errors');
await browser.close();
