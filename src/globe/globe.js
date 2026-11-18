// The Earth: renderer, look-test globe shader, clouds, atmosphere, stars, camera with inertia and flights.
// Shared by the app and the landing page hero.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { llToXYZ, xyzToLL, wrapLon, angDist, D2R } from './geo.js';

export const MIN_DIST = 1.066, MAX_DIST = 5.2, FOV = 30;
const QUALITY = {
  low: { pr: 1, seg: [96, 64], bloom: false, aniso: 2, texScale: .5, stars: 2500 },
  medium: { pr: 1.5, seg: [192, 128], bloom: false, aniso: 8, texScale: 1, stars: 6000 },
  high: { pr: 2, seg: [256, 160], bloom: true, aniso: 16, texScale: 1, stars: 9000 }
};
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const EARTH_VS = `varying vec2 vUv;varying vec3 vN;varying vec3 vW;void main(){vUv=uv;vN=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const EARTH_FS = `uniform sampler2D day,night,spec,nrm;uniform vec3 sun;uniform float nightBoost,specK;varying vec2 vUv;varying vec3 vN;varying vec3 vW;
vec3 perturb(vec3 p,vec3 N,vec2 uv,vec3 m){vec3 q0=dFdx(p),q1=dFdy(p);vec2 s0=dFdx(uv),s1=dFdy(uv);
  vec3 q1p=cross(q1,N),q0p=cross(N,q0);vec3 T=q1p*s0.x+q0p*s1.x,B=q1p*s0.y+q0p*s1.y;float d=max(dot(T,T),dot(B,B));float sc=d==0.?0.:inversesqrt(d);
  return normalize(T*(m.x*sc)+B*(m.y*sc)+N*m.z);}
void main(){
  vec3 N0=normalize(vN);vec3 m=texture2D(nrm,vUv).xyz*2.-1.;m.xy*=1.6;vec3 N=perturb(vW,N0,vUv,m);
  float d0=dot(N0,sun);float lit=smoothstep(-.2,.3,d0);float relief=clamp(dot(N,sun)*.8+.35,0.,1.3);
  vec3 dc=texture2D(day,vUv).rgb;float sea=texture2D(spec,vUv).r;
  dc=mix(dc,dc*vec3(.82,.95,1.12),sea*.6);
  vec3 nc=texture2D(night,vUv).rgb*vec3(1.,.8,.5)*1.8*nightBoost;
  vec3 V=normalize(cameraPosition-vW);vec3 Hh=normalize(sun+V);
  float s=(pow(max(dot(N0,Hh),0.),60.)*sea*.9+pow(max(dot(N0,Hh),0.),8.)*sea*.08)*specK;
  vec3 col=dc*(.04+1.1*lit*mix(1.,relief,1.-sea))+nc*(1.-lit)*(1.-sea)+vec3(1.,.92,.78)*s*lit;
  float rim=pow(1.-max(dot(N0,V),0.),2.6);col=mix(col,vec3(.42,.66,1.)*(.25+lit),rim*.55);
  gl_FragColor=vec4(col,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const ATMO_FS = `uniform vec3 sun;varying vec3 vN;varying vec3 vW;void main(){vec3 V=normalize(cameraPosition-vW);float x=clamp(-dot(vN,V)/.42,0.,1.);float i=pow(x,2.4)*.62;float l=smoothstep(-.35,.45,dot(vN,sun));gl_FragColor=vec4(vec3(.3,.56,1.)*i*(.2+l),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createGlobe(canvas, { quality = 'medium', assets = 'assets/earth/', interactive = true, onProgress } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(FOV, 1, .05, 120);
  const sun = new THREE.Vector3(...llToXYZ(22, 10)).normalize();
  const U = { sun: { value: sun } };

  // ---- textures
  const manager = new THREE.LoadingManager();
  let loaded = 0; const total = 5;
  const ready = new Promise(res => { manager.onLoad = res; manager.onError = url => { console.warn('texture failed', url); }; });
  manager.onProgress = () => { loaded++; onProgress?.(Math.min(1, loaded / total)); };
  const loader = new THREE.TextureLoader(manager);
  const texList = [];
  const load = (f, srgb = true) => { const t = loader.load(assets + f); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; texList.push(t); return t; };
  const day = load('earth-blue-marble.jpg'), night = load('earth-night.jpg'), spec = load('earth_specular_2048.jpg', false), nrm = load('earth_normal_2048.jpg', false), cloudsTex = load('earth_clouds_1024.png');

  // ---- earth
  const earthMat = new THREE.ShaderMaterial({ uniforms: { day: { value: day }, night: { value: night }, spec: { value: spec }, nrm: { value: nrm }, sun: U.sun, nightBoost: { value: 1 }, specK: { value: 1 } }, vertexShader: EARTH_VS, fragmentShader: EARTH_FS });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 128), earthMat); scene.add(earth);
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.007, 128, 80), new THREE.MeshLambertMaterial({ map: cloudsTex, transparent: true, opacity: .5, depthWrite: false }));
  clouds.renderOrder = 5; scene.add(clouds);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.1, 96, 64), new THREE.ShaderMaterial({ side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, uniforms: { sun: U.sun },
    vertexShader: `varying vec3 vN;varying vec3 vW;void main(){vN=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`, fragmentShader: ATMO_FS }));
  scene.add(atmo);
  scene.add(new THREE.AmbientLight(0xffffff, .12));
  const dl = new THREE.DirectionalLight(0xfff2dd, 2.4); scene.add(dl);
  let stars = null;
  function makeStars(n) {
    if (stars) { scene.remove(stars); stars.geometry.dispose(); stars.material.dispose(); }
    const sg = new THREE.BufferGeometry(), sp = [], sc = []; let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) { const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u), r = 40 + rnd() * 10; sp.push(Math.cos(a) * s * r, u * r, Math.sin(a) * s * r); const k = .6 + rnd() * .4; sc.push(k, k, k * (.9 + rnd() * .2)); }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
    stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: .07, vertexColors: true, transparent: true, opacity: .85, depthWrite: false })); scene.add(stars);
  }

  // ---- post (bloom on High)
  let composer = null, bloom = null, qName = quality, q = QUALITY[quality];
  let W = 2, H = 2, pixelRatio = 1, fixedSize = null;
  function buildComposer() {
    composer?.dispose(); composer = null;
    if (!q.bloom) return;
    const rt = new THREE.WebGLRenderTarget(W * pixelRatio, H * pixelRatio, { type: THREE.HalfFloatType, stencilBuffer: true, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(W, H), .28, .6, .92); composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
  // Low quality draws the 4K textures at half size
  function applyTexScale(t) {
    const img = t.userData.full || t.image; if (!img || !img.width) return; t.userData.full = img;
    if (q.texScale >= 1 || img.width <= 2048) { t.image = img; return; }
    if (!t.userData.half) { const c = document.createElement('canvas'); c.width = img.width * q.texScale; c.height = img.height * q.texScale; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); t.userData.half = c; }
    t.image = t.userData.half;
  }
  ready.then(() => { if (q.texScale < 1) for (const t of texList) { applyTexScale(t); t.needsUpdate = true; } });
  function setQuality(name) {
    qName = QUALITY[name] ? name : 'medium'; q = QUALITY[qName];
    earth.geometry.dispose(); earth.geometry = new THREE.SphereGeometry(1, q.seg[0], q.seg[1]);
    const an = Math.min(q.aniso, renderer.capabilities.getMaxAnisotropy());
    for (const t of texList) { t.anisotropy = an; applyTexScale(t); t.needsUpdate = !!t.image; }
    makeStars(q.stars); resize(); api.onQuality?.(qName);
  }
  function resize(w, h, pr) {
    if (w && h) fixedSize = { w, h, pr: pr || 1 }; else if (w === null) fixedSize = null;
    if (fixedSize) { W = fixedSize.w; H = fixedSize.h; pixelRatio = fixedSize.pr; }
    else { const r = canvas.parentElement?.getBoundingClientRect() || { width: innerWidth, height: innerHeight }; W = Math.max(2, Math.round(canvas.clientWidth || r.width)); H = Math.max(2, Math.round(canvas.clientHeight || r.height)); pixelRatio = Math.min(devicePixelRatio || 1, q.pr); }
    renderer.setPixelRatio(pixelRatio); renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.fov = camera.aspect >= 1 ? FOV : 2 * Math.atan(Math.tan(FOV * D2R / 2) / camera.aspect) / D2R; camera.updateProjectionMatrix();
    buildComposer(); composer?.setSize(W, H);
    api.onResize?.(W, H, pixelRatio);
  }

  // ---- camera state
  const cam = { lat: 30, lon: 20, dist: 4.2 };
  const vel = { lat: 0, lon: 0 }; let distTarget = cam.dist, flight = null, dragging = false, lastInteract = 0;
  const clampLat = l => Math.max(-85, Math.min(85, l));
  const clampDist = d => Math.max(MIN_DIST, Math.min(MAX_DIST, d));
  function setView(lat, lon, dist) { flight = null; cam.lat = clampLat(lat); cam.lon = wrapLon(lon); if (dist) { cam.dist = clampDist(dist); distTarget = cam.dist; } vel.lat = vel.lon = 0; }
  function flyTo(lat, lon, dist = cam.dist, duration = 1.6) {
    lat = clampLat(lat); dist = clampDist(dist);
    if (api.reducedMotion || duration <= 0) { setView(lat, lon, dist); return Promise.resolve(); }
    const ang = angDist(cam.lat, cam.lon, lat, lon);
    return new Promise(done => {
      flight?.done?.();
      flight = { t: 0, dur: duration, lat0: cam.lat, lon0: cam.lon, d0: cam.dist, lat1: lat, dlon: wrapLon(lon - cam.lon), d1: dist, bump: Math.min(1.1, ang / 90) * Math.max(0, 1 - Math.abs(dist - cam.dist) * .5) * .8, done };
      vel.lat = vel.lon = 0;
    });
  }
  function cancelFlight() { if (flight) { const d = flight.done; flight = null; distTarget = cam.dist; d?.(); } }

  const tmp = new THREE.Vector3(), ray = new THREE.Vector3();
  function placeCamera() {
    const p = llToXYZ(cam.lat, cam.lon, cam.dist);
    camera.position.set(p[0], p[1], p[2]); camera.up.set(0, 1, 0); camera.lookAt(0, 0, 0);
    camera.near = Math.max(.01, (cam.dist - 1) * .3); camera.far = cam.dist + 60; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  // screen -> lat/lon on the unit sphere (null when the ray misses)
  function pick(px, py) {
    tmp.set(px / W * 2 - 1, -(py / H) * 2 + 1, .5).unproject(camera); ray.copy(tmp).sub(camera.position).normalize();
    const o = camera.position, b = o.dot(ray), c = o.dot(o) - 1, disc = b * b - c; if (disc < 0) return null;
    const t = -b - Math.sqrt(disc); if (t < 0) return null;
    const [lat, lon] = xyzToLL(o.x + ray.x * t, o.y + ray.y * t, o.z + ray.z * t); return { lat, lon };
  }
  // lat/lon -> screen px; facing in [-1,1] (>0 is the near side)
  const pv = new THREE.Vector3();
  function project(lat, lon, r = 1.004, out = {}) {
    const p = llToXYZ(lat, lon, r); pv.set(p[0], p[1], p[2]);
    const cx = camera.position.x - p[0], cy = camera.position.y - p[1], cz = camera.position.z - p[2], cl = Math.hypot(cx, cy, cz) || 1;
    out.facing = (p[0] * cx + p[1] * cy + p[2] * cz) / (cl * r);
    pv.project(camera); out.x = (pv.x * .5 + .5) * W; out.y = (-pv.y * .5 + .5) * H; return out;
  }
  // degrees of arc per screen pixel at the centre of view
  const degPerPx = () => 2 * (cam.dist - 1) * Math.tan(camera.fov * D2R / 2) / H / D2R;

  // ---- input
  const pointers = new Map(); let pinch0 = 0, moved = 0;
  if (interactive) {
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); dragging = true; moved = 0; cancelFlight(); vel.lat = vel.lon = 0; if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); } });
    canvas.addEventListener('pointermove', e => {
      const p = pointers.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; lastInteract = performance.now();
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0 > 0 && d > 0) { distTarget = clampDist(1 + (distTarget - 1) * pinch0 / d); pinch0 = d; } moved += 10; return; }
      moved += Math.abs(dx) + Math.abs(dy);
      const k = degPerPx(), cl = Math.max(.25, Math.cos(cam.lat * D2R));
      const dlon = -dx * k / cl, dlat = dy * k;
      cam.lon = wrapLon(cam.lon + dlon); cam.lat = clampLat(cam.lat + dlat);
      vel.lon = dlon * 60; vel.lat = dlat * 60; // deg per second at 60 fps
    });
    const up = e => { pointers.delete(e.pointerId); if (!pointers.size) { dragging = false; if (performance.now() - lastInteract > 80) vel.lat = vel.lon = 0; } pinch0 = 0; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => { e.preventDefault(); cancelFlight(); const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY; distTarget = clampDist(1 + (distTarget - 1) * Math.exp(dy * .0014)); lastInteract = performance.now(); }, { passive: false });
    canvas.addEventListener('dblclick', e => { const r = canvas.getBoundingClientRect(); const hit = pick((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H); if (hit) flyTo(hit.lat, hit.lon, 1 + (cam.dist - 1) * .45, 1); });
  }
  const wasDrag = () => moved > 6;

  // ---- sun: pleasant fixed daylight over the viewed area, or the real subsolar point
  let realSun = false; const sunTarget = new THREE.Vector3();
  function updateSun(dt) {
    if (realSun) {
      const now = new Date(), start = Date.UTC(now.getUTCFullYear(), 0, 0), doy = (now - start) / 864e5;
      const decl = -23.44 * Math.cos(2 * Math.PI / 365 * (doy + 10)), hrs = now.getUTCHours() + now.getUTCMinutes() / 60;
      sunTarget.set(...llToXYZ(decl, wrapLon((12 - hrs) * 15)));
    } else sunTarget.set(...llToXYZ(Math.max(-50, Math.min(50, cam.lat * .6 + 24)), cam.lon - 48));
    sun.lerp(sunTarget, Math.min(1, dt * 2.5)).normalize(); dl.position.copy(sun).multiplyScalar(10);
  }

  // ---- loop
  const before = [], after = []; let running = false, last = 0, time = 0, raf = 0;
  const fps = { avg: 60, min: 60, frames: 0, _acc: 0, _n: 0, _worst: 0 };
  function step(dt) {
    if (flight) {
      flight.t = Math.min(1, flight.t + dt / flight.dur); const k = ease(flight.t);
      cam.lat = flight.lat0 + (flight.lat1 - flight.lat0) * k; cam.lon = wrapLon(flight.lon0 + flight.dlon * k);
      cam.dist = clampDist(flight.d0 + (flight.d1 - flight.d0) * k + Math.sin(Math.PI * k) * flight.bump); distTarget = cam.dist;
      if (flight.t >= 1) { const d = flight.done; flight = null; distTarget = cam.dist; d?.(); }
    } else {
      if (!dragging && (Math.abs(vel.lat) > .001 || Math.abs(vel.lon) > .001)) {
        cam.lat = clampLat(cam.lat + vel.lat * dt); cam.lon = wrapLon(cam.lon + vel.lon * dt);
        const f = Math.exp(-dt * 3.2); vel.lat *= f; vel.lon *= f;
      }
      if (Math.abs(distTarget - cam.dist) > 1e-5) cam.dist += (distTarget - cam.dist) * Math.min(1, dt * 9);
    }
    time += dt; clouds.rotation.y = time * .0108;
    clouds.material.opacity = api.cloudOpacity * Math.min(1, .25 + (cam.dist - 1) * .5);
    earthMat.uniforms.specK.value = Math.max(.08, Math.min(.55, (cam.dist - 1.15) / 3));
    updateSun(dt); placeCamera();
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.1, (now - last) / 1000 || .016); last = now;
    fps._acc += dt; fps._n++; fps._worst = Math.max(fps._worst, dt); fps.frames++;
    if (fps._acc >= .5) { fps.avg = fps._n / fps._acc; fps.min = 1 / fps._worst; fps._acc = fps._n = fps._worst = 0; api.onFps?.(fps); }
    step(dt);
    for (const f of before) f(dt, time);
    render();
    for (const f of after) f(dt, time);
  }
  function render() { if (composer) composer.render(); else renderer.render(scene, camera); }
  function start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  const api = {
    THREE, renderer, scene, camera, earth, clouds, canvas, sun, cam, fps, ready, uniforms: U,
    cloudOpacity: .5, reducedMotion: false,
    get size() { return { w: W, h: H, pr: pixelRatio }; }, get quality() { return qName; }, get flying() { return !!flight; }, get dragging() { return dragging; },
    get lastInteract() { return lastInteract; },
    setView, flyTo, cancelFlight, pick, project, degPerPx, wasDrag, setQuality, resize, render, start, stop, step,
    setRealSun(v) { realSun = !!v; },
    zoomBy(f) { cancelFlight(); distTarget = clampDist(1 + (distTarget - 1) * f); },
    nudge(dlat, dlon) { cancelFlight(); const k = degPerPx() * 90; vel.lat += dlat * k * 4; vel.lon += dlon * k * 4 / Math.max(.25, Math.cos(cam.lat * D2R)); },
    onFrame(f) { before.push(f); }, onAfterRender(f) { after.push(f); },
    dispose() { stop(); composer?.dispose(); renderer.dispose(); }
  };
  makeStars(q.stars); setQuality(quality); placeCamera();
  if (!fixedSize) new ResizeObserver(() => { if (!fixedSize) resize(); }).observe(canvas);
  return api;
}
