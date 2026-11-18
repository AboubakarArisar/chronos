// Finds what causes slow frames during playback: node tests/e2e/profile.mjs [speed] [skins on|off]
import { open, sleep } from './lib.mjs';
const speed = +(process.argv[2] || 100), skinsOn = process.argv[3] !== 'off';
const { browser, page, errors } = await open('/app.html');
await page.evaluate(([speed, skinsOn]) => {
  const a = window.chronos; a.prefs.set('qualityAuto', false); a.skins.setEnabled(skinsOn);
  const log = window.__slow = []; let last = performance.now(), mark = '';
  a.borders.on('primary', s => { mark = 'primary ' + s.year; }); a.skins.on(id => { mark += ' skin ' + id; });
  a.frameHooks.push(() => { const now = performance.now(), dt = now - last; last = now; if (dt > 50) log.push([Math.round(a.timeline.state.year), Math.round(dt), mark]); mark = ''; });
  new PerformanceObserver(l => { for (const e of l.getEntries()) log.push(['longtask', Math.round(e.duration), Math.round(e.startTime)]); }).observe({ entryTypes: ['longtask'] });
  a.timeline.set(-3000, 'jump'); a.timeline.setSpeed(speed); a.timeline.play();
}, [speed, skinsOn]);
const t0 = Date.now(); while (await page.evaluate(() => window.chronos.timeline.state.playing) && Date.now() - t0 < 120000) await sleep(1000);
const log = await page.evaluate(() => window.__slow);
const frames = log.filter(l => l[0] !== 'longtask');
console.log('slow frames (>50ms):', frames.length, 'worst', Math.max(0, ...frames.map(f => f[1])), 'ms; long tasks:', log.length - frames.length);
console.log(frames.sort((a, b) => b[1] - a[1]).slice(0, 25).map(f => f.join(' | ')).join('\n'));
console.log(errors.length ? 'ERRORS ' + errors.join(' | ') : 'no console errors'); await browser.close();
