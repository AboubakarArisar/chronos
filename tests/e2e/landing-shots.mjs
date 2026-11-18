// Captures the real-app stills used on the landing page into static/landing/ (copied to public/ by prepare-data).
//   node tests/e2e/landing-shots.mjs
import fs from 'node:fs';
import { open, sleep } from './lib.mjs';
fs.mkdirSync('static/landing', { recursive: true });
const shot = async (page, name, w = 1920, h = 1080) => { await page.screenshot({ path: `static/landing/${name}.jpg`, type: 'jpeg', quality: 72, clip: { x: 0, y: 0, width: w, height: h } }); console.log('saved', name); };
const exported = async (page, name, aspect) => {
  const b64 = await page.evaluate(async aspect => {
    const a = window.chronos; a.recorder.opts.aspect = aspect; a.recorder.opts.overlay = 'year'; a.lastScreenshot = null;
    const orig = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (!this.download) orig.call(this); }; // no download dialog
    await a.recorder.screenshot(); for (let i = 0; i < 100 && !a.lastScreenshot; i++) await new Promise(r => setTimeout(r, 100));
    HTMLAnchorElement.prototype.click = orig;
    const bmp = await createImageBitmap(a.lastScreenshot.blob), c = document.createElement('canvas'); c.width = bmp.width / 2; c.height = bmp.height / 2; c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', .8).split(',')[1];
  }, aspect);
  fs.writeFileSync(`static/landing/${name}.jpg`, Buffer.from(b64, 'base64')); console.log('saved', name);
};
let { browser, page } = await open('/app.html');
await sleep(4500); await shot(page, 'see-time');
await page.mouse.click(1100, 480); await sleep(4000); await shot(page, 'click');
await exported(page, 'clip-wide', '16:9'); fs.copyFileSync('static/landing/clip-wide.jpg', 'static/landing/record.jpg');
await page.evaluate(() => window.chronos.globe.setView(34, 100, 3.3)); await sleep(1200);
await exported(page, 'clip-tall', '9:16');
await browser.close();
({ browser, page } = await open('/app.html#y=117&c=40,16,2.7&g=Roman+Empire'));
await sleep(6000); await shot(page, 'culture'); await browser.close();
({ browser, page } = await open('/app.html#y=1279&c=40,84,3.6&g=Mongol+Empire', { width: 1200, height: 630 }));
await sleep(6000); await shot(page, 'og', 1200, 630); await browser.close();
