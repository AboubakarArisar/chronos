// Timeline model (year, playback, non-linear scale from the look test) and its bottom-bar UI.
import { fmtYear } from '../globe/geo.js';

export const MIN_YEAR = -3000, MAX_YEAR = new Date().getFullYear();
const SCALE = [[-3000, 0], [-500, 14], [1, 22], [500, 34], [1000, 48], [1200, 58], [1400, 68], [1600, 78], [1800, 88], [MAX_YEAR, 100]];
export function yearPct(y) { if (y <= SCALE[0][0]) return 0; for (let i = 1; i < SCALE.length; i++) { const [a, pa] = SCALE[i - 1], [b, pb] = SCALE[i]; if (y <= b) return pa + (y - a) / (b - a) * (pb - pa); } return 100; }
export function pctYear(p) { if (p <= 0) return MIN_YEAR; for (let i = 1; i < SCALE.length; i++) { const [a, pa] = SCALE[i - 1], [b, pb] = SCALE[i]; if (p <= pb) return a + (p - pa) / (pb - pa) * (b - a); } return MAX_YEAR; }
const ERA_CHIPS = [['Ancient', -2000], ['Classical', -200], ['Medieval', 800], ['Khans', 1279], ['Exploration', 1500], ['Modern', 1900]];
const ERA_NAMES = [[-3000, 'The First Cities'], [-800, 'The Classical World'], [-30, 'The Age of Rome'], [476, 'The Early Middle Ages'], [1000, 'The High Middle Ages'], [1200, 'The Age of the Khans'], [1400, 'The Age of Exploration'], [1750, 'Revolutions and Empires'], [1914, 'The World Wars'], [1946, 'The Modern World']];
export const eraName = y => { let n = ERA_NAMES[0][1]; for (const [from, name] of ERA_NAMES) if (y >= from) n = name; return n; };
export const SPEEDS = [1, 5, 20, 100];
export function parseYear(s) {
  const m = String(s).trim().match(/^(-)?\s*(\d{1,4})\s*(bce?|b\.c\.?|ad|ce|a\.d\.?)?$/i); if (!m) return null;
  let y = +m[2]; if (m[1] || /^b/i.test(m[3] || '')) y = -y; if (y === 0) y = 1;
  return y >= MIN_YEAR && y <= MAX_YEAR ? y : null;
}

export function createTimeline(mapYears) {
  const $ = id => document.getElementById(id);
  const state = { year: 1279, playing: false, speed: 5 };
  const subs = [];
  const emit = why => subs.forEach(f => f(state, why));
  const clamp = y => Math.max(MIN_YEAR, Math.min(MAX_YEAR, y));
  function set(y, why = 'set') { y = clamp(y); if (y === state.year) return; state.year = y; if (y >= MAX_YEAR && state.playing) pause(); emit(why); }
  function play() { if (state.playing) return; if (state.year >= MAX_YEAR - 1) state.year = MIN_YEAR; state.playing = true; emit('play'); }
  function pause() { if (!state.playing) return; state.playing = false; emit('pause'); }
  const toggle = () => state.playing ? pause() : play();
  function setSpeed(s) { state.speed = s; emit('speed'); }
  function stepMap(dir) { const y = Math.round(state.year); const next = dir > 0 ? mapYears.find(m => m > y) : [...mapYears].reverse().find(m => m < y); if (next !== undefined) { pause(); set(next, 'jump'); } }
  function tick(dt) { if (state.playing) set(state.year + state.speed * dt, 'tick'); }

  // ---- UI
  const track = $('track'), knob = $('knob'), fill = $('fill'), ticks = $('ticks'), playBtn = $('play'), speedBtn = $('speed'), yval = $('yval');
  if (track) {
    for (const y of [-3000, -2000, -1000, 1, 1000]) ticks.insertAdjacentHTML('beforeend', `<i class="tk" style="left:${yearPct(y)}%"></i>`);
    for (let y = -2500; y <= 2000; y += 100) if (y % 1000 && y > -1000) ticks.insertAdjacentHTML('beforeend', `<i class="tk c" style="left:${yearPct(y || 1)}%"></i>`);
    for (const y of mapYears) ticks.insertAdjacentHTML('beforeend', `<i class="tk map" style="left:${yearPct(y)}%" title="Map of ${fmtYear(y)}"></i>`);
    for (const [label, y] of [['3000 BC', -3000], ['1000 BC', -1000], ['1 AD', 1], ['1000', 1000], ['1500', 1500], ['Today', MAX_YEAR]]) ticks.insertAdjacentHTML('beforeend', `<span class="tick" style="left:${yearPct(y)}%">${label}</span>`);
    for (const [name, y] of ERA_CHIPS) { const b = document.createElement('button'); b.className = 'era'; b.style.left = yearPct(y) + '%'; b.textContent = name; b.dataset.y = y; b.setAttribute('aria-label', `Jump to the ${name} era, ${fmtYear(y)}`); b.onclick = e => { e.stopPropagation(); pause(); set(y, 'jump'); }; b.onpointerdown = e => e.stopPropagation(); track.appendChild(b); }
    const fromEvent = e => { const r = track.getBoundingClientRect(); return pctYear(Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100))); };
    let dragging = false;
    track.addEventListener('pointerdown', e => { dragging = true; track.setPointerCapture(e.pointerId); pause(); set(Math.round(fromEvent(e)), 'scrub'); });
    track.addEventListener('pointermove', e => { if (dragging) set(Math.round(fromEvent(e)), 'scrub'); });
    const end = () => { if (dragging) { dragging = false; emit('scrubend'); } };
    track.addEventListener('pointerup', end); track.addEventListener('pointercancel', end);
    track.addEventListener('keydown', e => { const k = e.key; if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); pause(); set(Math.round(state.year) + (k === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 100 : 10), 'jump'); } });
    playBtn.onclick = toggle;
    speedBtn.onclick = () => setSpeed(SPEEDS[(SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length]);
    $('prevmap').onclick = () => stepMap(-1); $('nextmap').onclick = () => stepMap(1);
    yval.addEventListener('focus', () => { pause(); yval.select(); });
    yval.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { const y = parseYear(yval.value); if (y !== null) { set(y, 'jump'); yval.blur(); } else { yval.setAttribute('aria-invalid', 'true'); api.onInvalid?.(yval.value); } } else if (e.key === 'Escape') yval.blur(); });
    yval.addEventListener('blur', () => { yval.removeAttribute('aria-invalid'); lastShown = null; render(); });
  }
  let lastShown = null, lastEra = null;
  function render() {
    if (!track) return;
    const pct = yearPct(state.year), y = Math.round(state.year);
    knob.style.transform = `translateX(${track.clientWidth * pct / 100}px)`; fill.style.transform = `scaleX(${pct / 100})`;
    if (y !== lastShown && document.activeElement !== yval) { lastShown = y; yval.value = fmtYear(y, true); track.setAttribute('aria-valuenow', y); track.setAttribute('aria-valuetext', fmtYear(y, true)); }
    const era = eraName(y); if (era !== lastEra) { lastEra = era; $('yera').textContent = era; let on = ERA_CHIPS[0][0]; for (const [n, ey] of ERA_CHIPS) if (y >= ey - 150) on = n; track.querySelectorAll('.era').forEach(b => b.classList.toggle('on', b.textContent === on)); }
    playBtn.classList.toggle('on', state.playing); playBtn.setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
    speedBtn.textContent = state.speed + ' yr/s';
  }
  const api = { state, set, play, pause, toggle, setSpeed, stepMap, tick, render, on: f => subs.push(f), mapYears };
  return api;
}
