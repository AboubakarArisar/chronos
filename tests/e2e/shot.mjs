// node tests/e2e/shot.mjs <name> [hash] [waitMs] [js]   -> tests/screens/<name>.jpg
import { open, sleep } from './lib.mjs';
const [name = 'shot', hash = '', wait = '3500', js = ''] = process.argv.slice(2);
const { browser, page, errors } = await open('/app.html' + (hash ? '#' + hash : ''));
if (js) await page.evaluate(js);
await sleep(+wait);
const info = await page.evaluate(() => ({ fps: window.chronos.fps, skin: window.chronos.skins.current, q: window.chronos.globe.quality, info: window.chronos.globe.renderer.info.render }));
await page.screenshot({ path: `tests/screens/${name}.jpg`, quality: 82, type: 'jpeg' });
console.log(JSON.stringify(info), errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no console errors');
await browser.close();
