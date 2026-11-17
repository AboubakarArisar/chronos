// Music of the age: a playlist per culture skin with 3 s cross-fades, and a gentle generative
// fallback (WebAudio) in the skin's scale and timbre for skins that have no recordings.
const PLUCKS = ['harp', 'lyre', 'pluck', 'oud', 'kora', 'koto', 'sitar', 'lute', 'piano'];
const FADE = 3, STABLE_MS = 4000;

function makeReverb(ctx) { // long, soft generated impulse
  const len = Math.floor(ctx.sampleRate * 3.6), buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { const t = i / len; lp += ((Math.random() * 2 - 1) - lp) * (.5 - t * .4); d[i] = lp * Math.pow(1 - t, 2.6); } }
  const c = ctx.createConvolver(); c.buffer = buf; return c;
}

// A calm generative piece: a quiet drone plus a sparse voice wandering the scale.
function createProcedural(ctx, out) {
  const bus = ctx.createGain(); bus.gain.value = 0; bus.connect(out);
  const dry = ctx.createGain(), wet = ctx.createGain(), rev = makeReverb(ctx); dry.gain.value = .6; wet.gain.value = .55;
  dry.connect(bus); wet.connect(rev); rev.connect(bus);
  let timer = 0, live = [], spec = null, degree = 0, playing = false, droneNodes = [];
  const freq = (root, semis) => root * Math.pow(2, semis / 12);
  function drone(root, timbre) {
    const g = ctx.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(timbre === 'drone' || timbre === 'pad' || timbre === 'choir' ? .11 : .06, ctx.currentTime + 4);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.connect(g); g.connect(dry); g.connect(wet);
    const nodes = [g, lp];
    for (const [mul, det, type, vol] of [[.5, -4, 'sine', 1], [.5, 5, 'triangle', .5], [.75, 0, 'sine', .45], [1, 3, 'sine', .25]]) {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = root * mul; o.detune.value = det; og.gain.value = vol; o.connect(og); og.connect(lp); o.start(); nodes.push(o, og);
    }
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .07; lg.gain.value = 120; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(); nodes.push(lfo, lg);
    return nodes;
  }
  function note(f, timbre, vel = 1) {
    const t = ctx.currentTime + .03, g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; g.connect(dry); g.connect(wet); lp.connect(g);
    const oscs = []; const osc = (type, mul, det, vol) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f * mul; o.detune.value = det; og.gain.value = vol; o.connect(og); og.connect(lp); o.start(t); oscs.push(o); return o; };
    let dur;
    if (PLUCKS.includes(timbre)) { // plucked: fast attack, long exponential decay, closing filter
      const decay = { harp: 3.2, lyre: 2.6, pluck: 2.4, oud: 1.9, kora: 2.2, koto: 2.8, sitar: 3.4, lute: 2.3, piano: 3.6 }[timbre]; dur = decay + .2;
      osc('triangle', 1, 0, .8); osc('sine', 2, 3, timbre === 'koto' || timbre === 'kora' ? .3 : .16);
      if (timbre === 'sitar') { osc('sawtooth', 1, 6, .1); osc('sine', 3, 0, .1); } if (timbre === 'oud' || timbre === 'lute') osc('sawtooth', 1, -3, .06); if (timbre === 'piano') osc('sine', 1, -5, .5);
      lp.frequency.setValueAtTime(timbre === 'piano' ? 2200 : 3400, t); lp.frequency.exponentialRampToValueAtTime(480, t + decay * .7);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.2 * vel, t + .008); g.gain.exponentialRampToValueAtTime(.0008, t + decay);
    } else { // breathy or bowed: slow swell, vibrato, slow release
      const hold = 2.2 + Math.random() * 1.6, att = timbre === 'brass' ? .5 : .8, rel = 1.8; dur = att + hold + rel;
      if (timbre === 'flute') { osc('sine', 1, 0, .9); osc('triangle', 2, 0, .08); }
      else if (timbre === 'choir') { osc('sawtooth', 1, -7, .3); osc('sawtooth', 1, 7, .3); osc('sine', 1, 0, .5); }
      else if (timbre === 'bowed') { osc('sawtooth', 1, 0, .4); osc('triangle', 1, 5, .4); }
      else if (timbre === 'brass') { osc('sawtooth', 1, 0, .35); osc('sine', 1, 0, .5); }
      else { osc('triangle', 1, -5, .5); osc('triangle', 1, 5, .5); osc('sine', .5, 0, .3); }
      lp.frequency.value = timbre === 'choir' ? 900 : timbre === 'brass' ? 760 : timbre === 'bowed' ? 1300 : 1800;
      const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 4.6; vg.gain.value = timbre === 'flute' || timbre === 'bowed' ? 7 : 3; vib.connect(vg); for (const o of oscs) vg.connect(o.detune); vib.start(t + att); oscs.push(vib);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.085 * vel, t + att); g.gain.setValueAtTime(.085 * vel, t + att + hold); g.gain.linearRampToValueAtTime(0, t + dur);
    }
    for (const o of oscs) o.stop(t + dur + .1);
    const entry = { g, lp, end: t + dur + .3 }; live.push(entry);
    oscs[0].onended = () => { g.disconnect(); lp.disconnect(); live = live.filter(e => e !== entry); };
  }
  function step() {
    if (!playing || !spec) return;
    const sc = spec.scale, n = sc.length, pl = PLUCKS.includes(spec.timbre);
    if (Math.random() > .22) {
      degree = Math.max(-2, Math.min(n + 3, degree + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
      const oct = Math.floor(degree / n), semis = sc[((degree % n) + n) % n] + 12 * oct;
      note(freq(spec.root, semis), spec.timbre, .8 + Math.random() * .3);
      if (pl && Math.random() < .28) setTimeout(() => playing && note(freq(spec.root, semis + (sc.includes(7) ? 7 : 12)), spec.timbre, .5), 180 + Math.random() * 240);
    }
    timer = setTimeout(step, (pl ? 1500 : 3400) + Math.random() * (pl ? 2400 : 3000));
  }
  return {
    bus,
    start(scale, timbre) {
      this.stop(true); playing = true;
      const root = { harp: 196, lyre: 220, pluck: 220, oud: 147, kora: 220, koto: 196, sitar: 147, drone: 147, bowed: 147, flute: 294, choir: 196, brass: 131, piano: 196, lute: 196, pad: 174 }[timbre] || 196;
      spec = { scale: scale?.length ? scale : [0, 2, 4, 7, 9], timbre, root }; degree = Math.floor(spec.scale.length / 2);
      droneNodes = drone(root, timbre); timer = setTimeout(step, 900);
    },
    stop(now = false) {
      playing = false; clearTimeout(timer); const nodes = droneNodes; droneNodes = [];
      if (nodes.length) { const g = nodes[0]; g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setTargetAtTime(0, ctx.currentTime, now ? .05 : 1); setTimeout(() => { for (const n of nodes) { try { n.stop?.(); } catch { /* not an oscillator */ } n.disconnect(); } }, now ? 300 : 4500); }
    }
  };
}

export default async function music(app) {
  const { skins, prefs, $ } = app;
  let ctx = null, master = null, proc = null, recDest = null;
  let volume = prefs.get('volume', .6), muted = prefs.get('muted', true), wantSkin = null, playingSkin = null, stableTimer = 0, changes = 0;
  const decks = []; let active = -1; const order = {};
  const nowEl = $('nowplaying'), btn = $('soundbtn');
  function ensure() {
    if (ctx) return true;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return false; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : volume; master.connect(ctx.destination);
    proc = createProcedural(ctx, master);
    for (let i = 0; i < 2; i++) { const el = new Audio(); el.preload = 'auto'; el.crossOrigin = 'anonymous'; const src = ctx.createMediaElementSource(el), g = ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(master); decks.push({ el, g, skin: null }); el.addEventListener('ended', () => { if (decks[active]?.el === el && playingSkin) playTrack(playingSkin, true); }); el.addEventListener('error', () => { if (decks[active]?.el === el && el.src) { console.warn('music track failed', el.src); startProc(playingSkin); } }); }
    return true;
  }
  const ramp = (param, v, secs = FADE) => { const t = ctx.currentTime; param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.linearRampToValueAtTime(v, t + secs); };
  function label(html) { nowEl.innerHTML = html; }
  function startProc(skinId) {
    const s = skins.skins[skinId] || skins.spec; proc.start(s.scale, s.timbre); ramp(proc.bus.gain, .9);
    for (const d of decks) { ramp(d.g.gain, 0); setTimeout(() => { if (d.g.gain.value < .01) d.el.pause(); }, FADE * 1000 + 200); }
    active = -1; label(`<span aria-hidden="true">♪</span> Generated music in the scale of ${s.name}`);
  }
  function playTrack(skinId, next = false) {
    const list = skins.music(skinId); if (!list.length) { startProc(skinId); return; }
    const o = order[skinId] ??= { i: Math.floor(Math.random() * list.length) }; if (next) o.i = (o.i + 1) % list.length;
    const tr = list[o.i], ni = active === 0 ? 1 : 0, deck = decks[ni], old = decks[active];
    deck.el.src = tr.file; deck.el.loop = false; deck.el.currentTime = 0;
    deck.el.play().then(() => {
      ramp(deck.g.gain, .85, next ? 1.5 : FADE); if (old && old !== deck) { ramp(old.g.gain, 0, FADE); setTimeout(() => { if (decks[active] !== old) old.el.pause(); }, FADE * 1000 + 200); }
      ramp(proc.bus.gain, 0); setTimeout(() => { if (active !== -1) proc.stop(); }, FADE * 1000);
      active = ni; const by = tr.by ? ', ' + tr.by.replace(/\s*;\s*/g, ', ') : '';
      label(`<span aria-hidden="true">♪</span> ${esc(tr.title)}${esc(by.length > 60 ? by.slice(0, 58) + '…' : by)} · ${esc(tr.license.replace(/\s*\(.*\)/, ''))} · <a href="credits.html#music" data-credits>credits</a>`);
    }).catch(() => startProc(skinId));
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function switchTo(skinId) { if (!ctx || muted || skinId === playingSkin) return; playingSkin = skinId; changes++; playTrack(skinId); }
  // follow the skin, but only after it has been stable for 4 s (no thrash while scrubbing)
  skins.on(id => { wantSkin = id; clearTimeout(stableTimer); if (!ctx || muted) return; stableTimer = setTimeout(() => switchTo(wantSkin), playingSkin ? STABLE_MS : 300); });
  function setMuted(m, save = true) {
    muted = m; if (save) prefs.set('muted', m); btn.setAttribute('aria-pressed', String(!m)); btn.title = m ? 'Turn the music on (M)' : 'Turn the music off (M)';
    if (m) { if (ctx) { ramp(master.gain, 0, .5); setTimeout(() => { if (muted) { for (const d of decks) d.el.pause(); proc.stop(); playingSkin = null; ctx.suspend?.(); } }, 700); } label(''); return; }
    if (!ensure()) { app.toast('This browser cannot play audio here.'); return; }
    ctx.resume?.(); ramp(master.gain, volume, .6); wantSkin = skins.current; switchTo(wantSkin);
  }
  function setVolume(v) { volume = Math.max(0, Math.min(1, v)); prefs.set('volume', volume); if (ctx && !muted) ramp(master.gain, volume, .1); }
  nowEl.addEventListener('click', e => { if (e.target.closest('[data-credits]') && app.openCredits) { e.preventDefault(); app.openCredits('music'); } });
  btn.setAttribute('aria-pressed', 'false');
  // sound never starts before a gesture; if it was on last time, the first click or key resumes it
  if (!muted) { const first = () => { removeEventListener('pointerdown', first, true); removeEventListener('keydown', first, true); if (!muted && !ctx) setMuted(false, false); }; addEventListener('pointerdown', first, true); addEventListener('keydown', first, true); }
  app.audio = {
    toggle: () => setMuted(!muted), setMuted, setVolume, get muted() { return muted; }, get volume() { return volume; }, get changes() { return changes; }, get playingSkin() { return playingSkin; },
    // audio for recordings: the same mix that goes to the speakers
    recordStream() { if (!ensure()) return null; if (!recDest) { recDest = ctx.createMediaStreamDestination(); master.connect(recDest); } return recDest.stream; },
    ensureOn() { if (muted) setMuted(false, false); else ctx?.resume?.(); }
  };
  // first visit: an unobtrusive "Sound on" prompt (after the intro)
  app.askSound = () => {
    if (prefs.get('soundAsked', false) || !muted) return; prefs.set('soundAsked', true);
    const el = document.createElement('div'); el.id = 'soundask'; el.className = 'frame'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Music');
    el.innerHTML = '<div class="strip"></div><span>Hear the music of each age?</span><button class="btn" id="sndyes">Sound on</button><button class="btn ghost" id="sndno">Not now</button>';
    document.body.appendChild(el); const done = () => el.remove();
    el.querySelector('#sndyes').onclick = () => { setMuted(false); done(); }; el.querySelector('#sndno').onclick = done; setTimeout(done, 20000);
  };
}
