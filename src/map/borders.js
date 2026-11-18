// Vector borders on the sphere: sharp triangulated fills + screen-space fat lines, cross-fading between
// map snapshots. Also owns picking (planar even-odd on unwrapped rings, the same geometry that is drawn).
import * as THREE from 'three';
import { pointInRings, D2R } from '../globe/geo.js';
import { newLineData, addPath, packLineData, greatCirclePath } from './linegeom.js';
import { hexToRgb } from './colors.js';

const R_FILL = 1.0012, R_LINE = 1.002;
const COMMON = `vec3 toLin(vec3 c){return pow(c,vec3(2.2));}`;
const FILL_VS = `attribute vec4 aCol;attribute vec3 aIds;uniform float uR;varying vec4 vCol;varying vec3 vIds;varying vec3 vP;
void main(){vCol=aCol;vIds=aIds;vP=position;gl_Position=projectionMatrix*viewMatrix*vec4(position*uR,1.);}`;
const FILL_FS = `uniform vec3 sun;uniform float uOpacity,uSelN,uSelG,uHovN,uHovG,uHatch;varying vec4 vCol;varying vec3 vIds;varying vec3 vP;
${COMMON}
void main(){
  vec3 N=normalize(vP);float lit=smoothstep(-.2,.3,dot(N,sun));
  float a=vCol.a;vec3 c=vCol.rgb;
  bool anySel=uSelN>=0.||uSelG>=0.;
  bool selN=abs(vIds.x-uSelN)<.5,selG=abs(vIds.y-uSelG)<.5;
  if(selN){a=max(a,.64);c=mix(c,vec3(1.,.9,.62),.14);}
  else if(selG){a=max(a,.56);c=mix(c,vec3(1.,.9,.62),.06);}
  else if(anySel)a*=.8;
  if(abs(vIds.x-uHovN)<.5||abs(vIds.y-uHovG)<.5){a=min(.8,a+.13);c=min(vec3(1.),c*1.16);}
  if(mod(vIds.z,2.)>.5){float s=sin((vP.x+vP.y*1.3+vP.z*.7)*uHatch);float w=fwidth(s)+1e-4;a*=mix(.42,1.,smoothstep(-w,w,s));}
  gl_FragColor=vec4(min(vec3(1.),toLin(c)*(.32+.9*lit)),a*uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
// one instanced quad per segment, expanded in screen space; the fragment shader draws a capsule
const LINE_VS = `attribute vec3 iA;attribute vec3 iB;attribute float iStyle;attribute vec3 iCol;attribute vec2 iDist;
uniform vec2 uRes;uniform float uR,uPr,uWidth;uniform vec3 sun,uCamDir;
varying float vAlong,vAcross,vHalf,vW,vStyle,vLit,vDist,vFace;varying vec3 vCol;
float halfW(float s){return s<.5?6.5:s<1.5?6.5:s<2.5?1.8:s<3.5?10.:s<4.5?2.2:7.5;}
void main(){
  vec4 ca=projectionMatrix*viewMatrix*vec4(iA*uR,1.),cb=projectionMatrix*viewMatrix*vec4(iB*uR,1.);
  vec2 sa=ca.xy/ca.w*uRes*.5,sb=cb.xy/cb.w*uRes*.5;vec2 d=sb-sa;float len=length(d);d=len>1e-4?d/len:vec2(1.,0.);vec2 n=vec2(-d.y,d.x);
  float w=halfW(iStyle)*uPr*uWidth;
  vec4 c=mix(ca,cb,position.x);float e=position.x*2.-1.;
  c.xy+=(n*position.y*w+d*e*w)/(uRes*.5)*c.w;
  vAlong=e*(len*.5+w);vAcross=position.y;vHalf=len*.5;vW=w;vStyle=iStyle;vCol=iCol;
  vDist=mix(iDist.x,iDist.y,position.x);vFace=dot(normalize(mix(iA,iB,position.x)),uCamDir);
  vLit=smoothstep(-.2,.3,dot(normalize(mix(iA,iB,.5)),sun));
  gl_Position=c;
}`;
const LINE_FS = `uniform float uOpacity,uPr,uWidth,uTime,uReveal,uLimit,uLayer,uDash;varying float vAlong,vAcross,vHalf,vW,vStyle,vLit,vDist,vFace;varying vec3 vCol;
${COMMON}
void over(inout vec4 acc,vec3 c,float a){acc.rgb=acc.rgb*(1.-a)+c*a;acc.a=acc.a*(1.-a)+a;}
void main(){
  if(vFace<uLimit)discard; // behind the limb
  float dx=max(abs(vAlong)-vHalf,0.);float d=length(vec2(dx,vAcross*vW))/(uPr*uWidth);
  vec4 acc=vec4(0.);float light=.5+.7*vLit;
  if(vStyle<.5){ // precise border: realm-coloured glow, dark edge, pale core
    over(acc,min(vec3(1.),vCol*1.7),(1.-smoothstep(2.4,6.5,d))*.26);
    over(acc,vec3(0.),(1.-smoothstep(1.7,2.8,d))*.6);
    over(acc,vec3(.914,.863,.753),(1.-smoothstep(.55,1.25,d))*.95);
  }else if(vStyle<1.5){ // approximate border: feathered
    over(acc,min(vec3(1.),vCol*1.7),(1.-smoothstep(1.,6.5,d))*.24);
    over(acc,vec3(0.),(1.-smoothstep(1.,3.8,d))*.42);
    over(acc,vec3(.914,.863,.753),(1.-smoothstep(.35,1.9,d))*.86);
  }else if(vStyle<2.5){ // peoples and cultural regions: faint
    over(acc,vec3(.9,.86,.76),(1.-smoothstep(.3,1.5,d))*.24);
  }else if(vStyle<3.5){ // selected realm: gold edge
    over(acc,vec3(1.,.82,.4),(1.-smoothstep(2.,10.,d))*.42);
    over(acc,vec3(0.),(1.-smoothstep(2.6,3.8,d))*.8);
    over(acc,vec3(1.,.89,.6),(1.-smoothstep(1.3,2.1,d)));light=.75+.5*vLit;
  }else if(vStyle<4.5){ // ghost outline (through time)
    over(acc,vCol,(1.-smoothstep(.5,1.9,d))*.75);light=1.;
  }else{ // tour route: animated dash, revealed along its length
    if(vDist>uReveal)discard;
    float dash=fract(vDist*uDash-uTime*.7);float on=smoothstep(.0,.07,dash)*(1.-smoothstep(.6,.67,dash));
    over(acc,vec3(0.),(1.-smoothstep(4.4,6.6,d))*.6*on);
    over(acc,vec3(1.,.953,.8),(1.-smoothstep(2.9,3.9,d))*on);light=1.;
  }
  if(acc.a<.012)discard;
  // depth is a pure function of the distance to the line's centre: the nearest fragment wins the pixel,
  // so joints and shared borders do not double-blend (the limb is handled by the horizon test above)
  gl_FragDepth=uLayer+.01*clamp(d*uPr*uWidth/vW,0.,1.);
  acc.a*=smoothstep(uLimit,uLimit+.03,vFace);
  gl_FragColor=vec4(min(vec3(1.),toLin(acc.rgb/acc.a)*light*1.25),acc.a*uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createBorders(globe, { base = 'd/', maxMeshes = 5, maxData = 9 } = {}) {
  const { scene } = globe;
  const shared = { sun: globe.uniforms.sun, uRes: { value: new THREE.Vector2(2, 2) }, uPr: { value: 1 }, uWidth: { value: 1 }, uTime: { value: 0 }, uHatch: { value: 500 }, uCamDir: { value: new THREE.Vector3(0, 0, 1) }, uLimit: { value: 0 }, uDash: { value: 38 } };
  const quad = { pos: new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), idx: [0, 1, 2, 0, 2, 3] };
  let index = null; const listeners = { primary: [], loading: [] };
  const emit = (n, ...a) => listeners[n].forEach(f => f(...a));

  // ---- worker with a one-slot queue (newest request wins while scrubbing)
  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  const snaps = new Map(), pending = new Map(); let busy = null, queued = [];
  worker.onmessage = e => { const { id, ok, data, error } = e.data, p = pending.get(id); pending.delete(id); busy = null; if (p) ok ? p.res(data) : p.rej(new Error(error)); pump(); };
  function pump() { if (busy !== null || !queued.length) return; const y = queued.shift(); busy = y; worker.postMessage({ id: y, url: new URL(base + 'b/' + y + '.json', location.href).href }); }
  function load(year, urgent = false) {
    let s = snaps.get(year); if (s) { s.used = performance.now(); return s.promise; }
    s = { year, data: null, fill: null, line: null, opacity: 0, used: performance.now(), inScene: false };
    s.promise = new Promise((res, rej) => pending.set(year, { res, rej })).then(d => { s.data = d; indexSnap(s); evict(); return s; }, err => { if (snaps.get(year) === s) snaps.delete(year); if (err.message !== 'superseded') emit('loading', year, err); throw err; });
    s.promise.catch(() => {});
    snaps.set(year, s);
    if (urgent) { // newest request wins: drop waiting ones completely so they can be asked for again later
      for (const y of queued) if (y !== year) { snaps.delete(y); const p = pending.get(y); pending.delete(y); p?.rej(new Error('superseded')); }
      queued = [year];
    } else queued.push(year);
    pump(); return s.promise;
  }
  function indexSnap(s) {
    const d = s.data;
    const unpack = p => { const out = new Array(p.groupOff.length - 1); for (let g = 0; g < out.length; g++) { const rs = []; for (let r = p.groupOff[g]; r < p.groupOff[g + 1]; r++) rs.push(p.buf.subarray(p.ringOff[r], p.ringOff[r + 1])); out[g] = rs; } return out; };
    d.pickRings = unpack(d.pick); d.unclaimed = unpack(d.unclaimedPack);
    d.nameIds = new Map(d.names.map((n, i) => [n, i])); d.groupIds = new Map(d.groups.map((g, i) => [g.key, i]));
    d.byName = new Map(); for (let i = 0; i < d.features.length; i++) { const f = d.features[i]; f.i = i; (d.byName.get(f.n) || d.byName.set(f.n, []).get(f.n)).push(f); }
    d.powers = d.groups.map((g, i) => ({ ...g, gid: i })).filter(g => g.kind < 2).sort((a, b) => b.area - a.area);
  }
  function buildMeshes(s) {
    if (s.fill) return; const d = s.data, bit = (index.years.indexOf(s.year) % 2) ? 2 : 1;
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(d.fill.pos, 3)); fg.setAttribute('aCol', new THREE.BufferAttribute(d.fill.col, 4)); fg.setAttribute('aIds', new THREE.BufferAttribute(d.fill.ids, 3));
    fg.setIndex(new THREE.BufferAttribute(d.fill.idx, 1));
    s.fillU = { sun: shared.sun, uR: { value: R_FILL }, uOpacity: { value: 0 }, uSelN: { value: -1 }, uSelG: { value: -1 }, uHovN: { value: -1 }, uHovG: { value: -1 }, uHatch: shared.uHatch };
    s.fill = new THREE.Mesh(fg, new THREE.ShaderMaterial({ uniforms: s.fillU, vertexShader: FILL_VS, fragmentShader: FILL_FS, transparent: true, depthWrite: false }));
    s.fill.frustumCulled = false; s.fill.renderOrder = 2;
    s.line = makeLineMesh(d.line, bit, 3); s.lineU = s.line.material.uniforms;
    applySelection(s);
  }
  function makeLineMesh(ld, stencilBit = 0, order = 3) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(quad.pos, 3)); g.setIndex(quad.idx);
    g.setAttribute('iA', new THREE.InstancedBufferAttribute(ld.a, 3)); g.setAttribute('iB', new THREE.InstancedBufferAttribute(ld.b, 3));
    g.setAttribute('iStyle', new THREE.InstancedBufferAttribute(ld.style, 1)); g.setAttribute('iCol', new THREE.InstancedBufferAttribute(ld.col, 3));
    g.setAttribute('iDist', new THREE.InstancedBufferAttribute(ld.dist, 2)); g.instanceCount = ld.style.length;
    const u = { sun: shared.sun, uRes: shared.uRes, uPr: shared.uPr, uWidth: shared.uWidth, uTime: shared.uTime, uCamDir: shared.uCamDir, uLimit: shared.uLimit, uDash: shared.uDash, uLayer: { value: order >= 6 ? .002 : order >= 4 ? .0005 : .02 }, uR: { value: R_LINE }, uOpacity: { value: 1 }, uReveal: { value: 1e9 } };
    const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: LINE_VS, fragmentShader: LINE_FS, transparent: true, depthWrite: true });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = order; return mesh;
  }
  const disposeMesh = m => { if (!m) return; scene.remove(m); m.geometry.dispose(); m.material.dispose(); };
  // keep GPU meshes for a few maps and parsed data for a few more; everything else is freed
  function evict() {
    const idle = [...snaps.values()].filter(s => s.data && !s.inScene).sort((a, b) => a.used - b.used);
    let built = [...snaps.values()].filter(s => s.fill).length, total = snaps.size;
    for (const s of idle) {
      if (s.fill && built > maxMeshes) { disposeMesh(s.fill); disposeMesh(s.line); s.fill = s.line = null; built--; }
      if (total > maxData) { if (s.fill) { disposeMesh(s.fill); disposeMesh(s.line); s.fill = s.line = null; built--; } snaps.delete(s.year); total--; }
    }
  }

  // ---- time -> which maps are on screen
  let primary = null, want = { a: null, b: null, blend: 0 }, selection = null, hover = null;
  const yearIndex = y => { const ys = index.years; let i = 0; for (let k = 0; k < ys.length; k++) if (ys[k] <= y) i = k; return i; };
  function setTime(year, playing, speed = 1) {
    if (!index) return;
    const ys = index.years, i = yearIndex(year), a = ys[i], b = ys[i + 1];
    let blend = 0;
    if (playing && b !== undefined) { const t = (year - a) / (b - a), from = Math.max(.5, 1 - Math.max(.28, 1.2 * speed / (b - a))); blend = Math.min(1, Math.max(0, (t - from) / (1 - from))); blend = blend * blend * (3 - 2 * blend); }
    want = { a, b: blend > 0 ? b : null, blend, playing };
    load(a, true); if (playing && b !== undefined) { load(b); if (ys[i + 2] !== undefined && speed >= 20) load(ys[i + 2]); }
  }
  function update(dt) {
    if (!index) return;
    const A = snaps.get(want.a), B = want.b !== null ? snaps.get(want.b) : null;
    const aReady = A?.data, bReady = B?.data;
    const rate = Math.min(1, dt * (want.playing ? 14 : 7));
    for (const s of snaps.values()) {
      if (!s.data) continue;
      let target = s.opacity;
      if (aReady) target = s === A ? (bReady ? 1 - want.blend * .999 : 1) : s === B && bReady ? want.blend : 0;
      if (target > 0 || s.opacity > 0) {
        s.opacity += (target - s.opacity) * rate; if (Math.abs(target - s.opacity) < .004) s.opacity = target;
        if (s.opacity > 0 && !s.inScene) { buildMeshes(s); scene.add(s.fill, s.line); s.inScene = true; }
        if (s.opacity <= 0 && s.inScene) { scene.remove(s.fill, s.line); s.inScene = false; }
        if (s.inScene) { s.fillU.uOpacity.value = s.opacity; s.lineU.uOpacity.value = s.opacity; s.used = performance.now(); }
      }
    }
    // the primary map is the most visible one
    let best = null; for (const s of snaps.values()) if (s.inScene && (!best || s.opacity > best.opacity)) best = s;
    if (best && best !== primary && (best.opacity >= .5 || !primary?.inScene)) { primary = best; for (const s of snaps.values()) if (s.fill) applySelection(s); rebuildSelectionLine(); emit('primary', primary); evict(); }
    const sz = globe.size; shared.uRes.value.set(sz.w * sz.pr, sz.h * sz.pr); shared.uPr.value = sz.pr; shared.uTime.value += dt; shared.uCamDir.value.copy(globe.camera.position).normalize(); shared.uDash.value = 1 / Math.pow(2, Math.round(Math.log2(30 * globe.degPerPx() * D2R))); shared.uLimit.value = Math.cos(Math.acos(1 / globe.cam.dist) + Math.acos(1 / 1.003));
    // hatch period of about 9 px, snapped to octaves so the stripes do not swim while zooming
    const period = 9 * globe.degPerPx() * D2R; shared.uHatch.value = 2 * Math.PI / Math.pow(2, Math.round(Math.log2(period)));
    if (selLine) selLine.material.uniforms.uOpacity.value += ((primary ? 1 : 0) - selLine.material.uniforms.uOpacity.value) * Math.min(1, dt * 8);
  }

  // ---- selection + hover
  // selection: { name } for one region or { group } for everything a power rules
  function applySelection(s) {
    if (!s.fillU) return; const d = s.data;
    s.fillU.uSelN.value = selection?.name != null ? d.nameIds.get(selection.name) ?? -1 : -1;
    s.fillU.uSelG.value = selection?.group != null && selection?.name == null ? d.groupIds.get(selection.group) ?? -1 : -1;
    s.fillU.uHovN.value = hover?.name != null ? d.nameIds.get(hover.name) ?? -1 : -1;
    s.fillU.uHovG.value = hover?.group != null && hover?.name == null ? d.groupIds.get(hover.group) ?? -1 : -1;
  }
  let selLine = null;
  function featuresFor(d, sel) { return !sel ? [] : sel.name != null ? d.byName.get(sel.name) || [] : d.features.filter(f => f.group === sel.group); }
  function rebuildSelectionLine() {
    disposeMesh(selLine); selLine = null;
    if (!primary || !selection) return;
    const fs = featuresFor(primary.data, selection); if (!fs.length) return;
    const ld = newLineData(); for (const f of fs) for (const r of primary.data.pickRings[f.i]) addPath(ld, r, true, 3, [1, .85, .5]);
    selLine = makeLineMesh(packLineData(ld), 4, 4); selLine.material.uniforms.uR.value = R_LINE + .0014; scene.add(selLine);
  }
  function select(sel) { selection = sel; for (const s of snaps.values()) if (s.fill) applySelection(s); rebuildSelectionLine(); }
  function setHover(h) { if (hover?.name === h?.name && hover?.group === h?.group) return; hover = h; for (const s of snaps.values()) if (s.fill) applySelection(s); }

  // ---- picking against the primary map
  function pick(lat, lon, snap = primary) {
    if (!snap?.data) return null; const d = snap.data; let best = null;
    for (let i = 0; i < d.features.length; i++) {
      const f = d.features[i], bb = f.bb; if (lat < bb[1] || lat > bb[3]) continue;
      if (!((lon >= bb[0] && lon <= bb[2]) || (lon + 360 >= bb[0] && lon + 360 <= bb[2]) || (lon - 360 >= bb[0] && lon - 360 <= bb[2]))) continue;
      if (!pointInRings(lon, lat, d.pickRings[i])) continue;
      // states win over peoples; otherwise the smallest region wins
      if (!best || (f.k < 2) > (best.k < 2) || ((f.k < 2) === (best.k < 2) && f.a < best.a)) best = f;
    }
    if (best) return { feature: best };
    for (const rings of d.unclaimed) if (pointInRings(lon, lat, rings)) return { unclaimed: true };
    return null;
  }

  // ---- extra lines: ghosts ("through time") and tour routes
  const extras = new Set();
  function addLines(paths, { style = 4, color = '#ffffff', closed = true, radius = R_LINE + .0009, order = 6 } = {}) {
    const ld = newLineData(), rgb = hexToRgb(color); let total = 0;
    for (const p of paths) total = Math.max(total, addPath(ld, p, closed, style, rgb, style === 5 ? 1.2 : undefined));
    const m = makeLineMesh(packLineData(ld), 0, order); m.material.uniforms.uR.value = radius; m.userData.length = total; scene.add(m); extras.add(m); return m;
  }
  function removeLines(m) { if (!m) return; extras.delete(m); disposeMesh(m); }
  const routePath = pts => greatCirclePath(pts);

  const ready = fetch(base + 'index.json').then(r => { if (!r.ok) throw new Error('Could not load the map index'); return r.json(); }).then(j => { index = j; return j; });
  return {
    ready, load, setTime, update, pick, select, setHover, addLines, removeLines, routePath, featuresFor,
    get index() { return index; }, get primary() { return primary; }, get selection() { return selection; }, get shared() { return shared; },
    snapshotYearFor: y => index.years[yearIndex(y)], yearIndex,
    get: y => snaps.get(y),
    on(n, f) { listeners[n].push(f); },
    stats: () => ({ cached: snaps.size, built: [...snaps.values()].filter(s => s.fill).length }),
    setLineWidth(w) { shared.uWidth.value = w; }
  };
}
