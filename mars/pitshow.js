// v7.5.29 The Pit as a show (Collin: "when a fight starts make it more of a show with flashing lights, a crowd comes over and
// the fight lasts longer. When you win/lose make it a big deal and very dramatic, like a star exploding or the character glows
// up" + "best 2 of 3 rounds, each round ends on a knockdown, round banner, reset between rounds, a round tally on the HUD").
// Rides on the v7.5.21 landmark (mars/pitring.js) and Ben's best-of-3 series (activities/pitseries.js + runner.js):
//  - bell: strobing coloured spot beams sweep the mat, the floor pool and lamp heads flash on the beat, the announcer card
//    (LADIES AND LOWLIFES / IN THIS CORNER / ROUND n / FIGHT!), the spectators run up and pack the ropes, late arrivals run in
//    from the street, a crowd roar. Clean punches: sparks + the crowd jumps; you get rocked: a red pulse + a gasp.
//  - round end (knockdown): a smaller flash + spark burst on the downed fighter, KNOCKDOWN!/YOU'RE DOWN! with the ●○ tally,
//    you slump to the mat when you are the one down, then 5 s in the corner (healed for the next round).
//  - match end: slow motion, a star explosion (white flash, shockwave ring + shell, flare, a few hundred sparks), the winner
//    glows up (gold aura, a rising light pillar, your suit lit gold) and cash/confetti rain while the crowd erupts; losing: a
//    red flash, the burst and glow go to your opponent, you slump, the crowd boos. WINNER!/DEFEATED banner with the purse.
// Perf: everything is built once (when the landmark is built), hidden, and shader-warmed (SSX.stormGuard.prewarm, draw:true),
// so nothing compiles mid-fight. 9 draw calls while a show runs, 0 otherwise: one instanced beam mesh, one floor pool, one pooled
// Points (sparks), one instanced confetti mesh, ring, shell, flare, aura, pillar. Phones get smaller pools (pitshowcore BUDGET),
// fewer late arrivals and no beam sweep jitter. No real lights.
// Window API: SSX.pitShow = { state(), finale(pay, opp), debug: { built, uncompiled(), counts(), burst(win), round(o), reset() } }
import * as THREE from 'three';
import * as K from './pitshowcore.js';
import { LAMP_HEADS, RIG, RIG_Y, MAT } from './pitringcore.js';

const app = () => window.__app, surf = () => app()?.surface, world = () => surf()?.world, ring = () => window.SSX?.pitRing;
const isPhone = () => document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
const now = () => performance.now() / 1000;
let FX = null, host = null, B = null, mats = null, beams = null, pool = null, sparks = null, conf = null, shock = null, shell = null, flare = null, aura = null, pillar = null;
let warmed = false, lastTc = null;
const V = new THREE.Vector3(), V2 = new THREE.Vector3(), Q = new THREE.Quaternion(), M4 = new THREE.Matrix4(), DOWN = new THREE.Vector3(0, -1, 0), C = new THREE.Color(), S1 = new THREE.Vector3(), E = new THREE.Euler();

// ---------- textures ----------
function dotTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
function starTex() { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.translate(128, 128);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.12, 'rgba(255,240,200,0.9)'); g.addColorStop(0.4, 'rgba(255,170,60,0.25)'); g.addColorStop(1, 'rgba(255,120,20,0)');
  x.fillStyle = g; x.fillRect(-128, -128, 256, 256);
  x.globalCompositeOperation = 'lighter'; for (let i = 0; i < 8; i++) { x.save(); x.rotate(i * Math.PI / 4); const L = i % 2 ? 80 : 126, w = i % 2 ? 3 : 6; const s = x.createLinearGradient(0, 0, L, 0); s.addColorStop(0, 'rgba(255,255,255,0.95)'); s.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = s; x.beginPath(); x.moveTo(0, -w); x.lineTo(L, 0); x.lineTo(0, w); x.fill(); x.restore(); }
  return new THREE.CanvasTexture(c); }
function poolTex() { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); }
function pillarTex() { const c = document.createElement('canvas'); c.width = 4; c.height = 128; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 128, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 4, 128); return new THREE.CanvasTexture(c); }
const add = (o) => ({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, ...o });

// ---------- build (once, hidden, warmed) ----------
function build(G) {
  const phone = isPhone(); B = K.BUDGET[phone ? 'phone' : 'desktop'];
  FX = new THREE.Group(); FX.name = 'pit-show'; FX.visible = false; host = G;
  const dot = dotTex();
  mats = {
    beam: new THREE.MeshBasicMaterial(add({ color: 0xffffff, opacity: 0.17, side: THREE.DoubleSide })),
    pool: new THREE.MeshBasicMaterial(add({ map: poolTex(), color: 0xff2d55, opacity: 0.9 })),
    spark: new THREE.PointsMaterial(add({ map: dot, size: phone ? 0.17 : 0.14, vertexColors: true, sizeAttenuation: true })),
    conf: new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, fog: false }),
    ring: new THREE.MeshBasicMaterial(add({ color: 0xffe2a8, opacity: 0.9, side: THREE.DoubleSide })),
    shell: new THREE.MeshBasicMaterial(add({ color: 0xffb347, opacity: 0.5, side: THREE.DoubleSide })),
    flare: new THREE.SpriteMaterial(add({ map: starTex(), color: 0xffffff, opacity: 1 })),
    aura: new THREE.SpriteMaterial(add({ map: dot, color: 0xffcc55, opacity: 0.8 })),
    pillar: new THREE.MeshBasicMaterial(add({ map: pillarTex(), color: 0xffd27a, opacity: 0.85, side: THREE.DoubleSide })),
  };
  // 6 strobe spots: the 4 lamps on the hanging rig + the sign and mast floods (one instanced mesh)
  const bg = new THREE.CylinderGeometry(0.1, 1.25, 1, 14, 1, true); bg.translate(0, -0.5, 0);
  const org = [...RIG.map(([x, z]) => [x, RIG_Y - 0.45, z]), [LAMP_HEADS[0][0], LAMP_HEADS[0][2], 0], [LAMP_HEADS[2][0], LAMP_HEADS[2][2], 0]];
  beams = new THREE.InstancedMesh(bg, mats.beam, org.length); beams.userData.org = org; beams.frustumCulled = false; beams.name = 'pit-show-beams';
  for (let i = 0; i < org.length; i++) { beams.setColorAt(i, C.setHex(K.STROBE[i % K.STROBE.length])); M4.identity(); beams.setMatrixAt(i, M4); }
  FX.add(beams);
  { const g = new THREE.PlaneGeometry(MAT * 2.1, MAT * 2.1); g.rotateX(-Math.PI / 2); g.translate(0, 0.09, 0); pool = new THREE.Mesh(g, mats.pool); pool.renderOrder = 3; pool.name = 'pit-show-pool'; FX.add(pool); }
  // pooled sparks
  { const n = B.sparks, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3).fill(-999), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    sparks = new THREE.Points(g, mats.spark); sparks.frustumCulled = false; sparks.name = 'pit-show-sparks'; sparks.userData = { n, vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n), drag: new Float32Array(n), grav: new Float32Array(n), head: 0 }; FX.add(sparks); }
  // pooled confetti / cash
  { const n = B.confetti; conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.08), mats.conf, n); conf.frustumCulled = false; conf.name = 'pit-show-confetti';
    conf.userData = { n, p: new Float32Array(n * 3), v: new Float32Array(n * 3), r: new Float32Array(n * 3), life: new Float32Array(n) };
    const pal = [0x22c55e, 0x16a34a, 0x86efac, 0xfacc15, 0xf97316, 0xffffff, 0x4ade80];
    for (let i = 0; i < n; i++) { conf.setColorAt(i, C.setHex(pal[i % pal.length])); conf.setMatrixAt(i, M4.makeScale(0, 0, 0)); } FX.add(conf); }
  { const g = new THREE.RingGeometry(0.86, 1, 56); g.rotateX(-Math.PI / 2); shock = new THREE.Mesh(g, mats.ring); shock.name = 'pit-show-shock'; shock.visible = false; FX.add(shock); }
  shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1, phone ? 1 : 2), mats.shell); shell.name = 'pit-show-shell'; shell.visible = false; FX.add(shell);
  flare = new THREE.Sprite(mats.flare); flare.name = 'pit-show-flare'; flare.visible = false; FX.add(flare);
  aura = new THREE.Sprite(mats.aura); aura.name = 'pit-show-aura'; aura.visible = false; FX.add(aura);
  { const g = new THREE.CylinderGeometry(0.4, 0.62, 1, 18, 1, true); g.translate(0, 0.5, 0); pillar = new THREE.Mesh(g, mats.pillar); pillar.name = 'pit-show-pillar'; pillar.visible = false; FX.add(pillar); }
  G.add(FX);
  // warm every program with the parts visible (one borrowed draw each), then hide them again
  for (const o of [shock, shell, flare, aura, pillar]) o.visible = true;
  try { warmed = !!window.SSX?.stormGuard?.prewarm?.(FX, { hide: false, draw: true }); } catch (e) { warmed = false; }
  setTimeout(() => { if (!SH.on) for (const o of [shock, shell, flare, aura, pillar]) o.visible = false; }, 50);
  css();
}

// ---------- DOM: banner, screen flash, HUD tally ----------
let bannerEl = null, flashEl = null, tallyEl = null, bannerT = 0;
function css() {
  if (document.getElementById('pitShowCss')) return;
  const st = document.createElement('style'); st.id = 'pitShowCss';
  st.textContent = `#pitShowBanner{position:fixed;left:0;right:0;top:24%;z-index:40;text-align:center;pointer-events:none;display:none}
#pitShowBanner.on{display:block}
#pitShowBanner .big{font:900 clamp(38px,11vw,96px)/1 Impact,"Arial Black",system-ui,sans-serif;letter-spacing:.02em;color:#fff;-webkit-text-stroke:2px #000;text-shadow:0 0 18px var(--glow,#ff5a1f),0 4px 0 #000;animation:pitSlam .42s cubic-bezier(.2,1.6,.4,1) both}
#pitShowBanner .small{display:inline-block;margin-top:10px;padding:6px 14px;border-radius:8px;background:#000;color:#fff;font:800 clamp(14px,4vw,22px)/1.2 system-ui,sans-serif;border:1px solid rgba(255,255,255,.35)}
#pitShowBanner.win{--glow:#ffd24a}#pitShowBanner.lose{--glow:#ff1f3d}#pitShowBanner.round{--glow:#22d3ee}
@keyframes pitSlam{0%{transform:scale(2.6);opacity:0}60%{opacity:1}100%{transform:scale(1);opacity:1}}
#pitFlash{position:fixed;inset:0;z-index:39;pointer-events:none;opacity:0;background:#fff;transition:opacity .45s ease-out}
#pitTally{margin-left:auto;margin-right:8px;font-weight:900;letter-spacing:.06em;color:#fff}`;
  document.head.appendChild(st);
  bannerEl = document.createElement('div'); bannerEl.id = 'pitShowBanner'; bannerEl.setAttribute('aria-live', 'polite'); bannerEl.innerHTML = '<div class="big"></div><div class="small"></div>';
  flashEl = document.createElement('div'); flashEl.id = 'pitFlash'; document.body.append(bannerEl, flashEl);
}
function banner(big, small = '', tone = 'round', secs = 1.6) {
  if (!bannerEl) return; const b = bannerEl.querySelector('.big'), s = bannerEl.querySelector('.small');
  b.textContent = big; s.textContent = small; s.style.display = small ? '' : 'none'; bannerEl.className = 'on ' + tone;
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; bannerT = now() + secs; SH.banner = big;
}
function flash(color = '#fff', peak = 0.8, hold = 0.06) { if (!flashEl) return; flashEl.style.transition = 'none'; flashEl.style.background = color; flashEl.style.opacity = String(peak); void flashEl.offsetWidth;
  setTimeout(() => { flashEl.style.transition = 'opacity .55s ease-out'; flashEl.style.opacity = '0'; }, hold * 1000); }
function tally(S) {
  const dt = document.querySelector('#duelBanner .dt'); if (!dt) return;
  if (!tallyEl || !tallyEl.isConnected) { tallyEl = document.createElement('span'); tallyEl.id = 'pitTally'; dt.insertBefore(tallyEl, document.getElementById('duelCount')); }
  const txt = S ? `${K.pips(S.me)}–${K.pips(S.them)}` : ''; if (tallyEl.textContent !== txt) tallyEl.textContent = txt; tallyEl.style.display = S ? '' : 'none';
  SH.tally = txt;
}

// ---------- audio (optional; WebAudio from index.html) ----------
let noise = null;
function actx() { try { const a = window.__pitAudio?.ctx?.(); return a && a.state === 'running' ? a : null; } catch (e) { return null; } }
function crowd(kind = 'roar', level = 1, dur = 1.6) {
  const a = actx(); if (!a) return;
  try {
    if (!noise) { noise = a.createBuffer(1, a.sampleRate * 2, a.sampleRate); const d = noise.getChannelData(0); let b = 0; for (let i = 0; i < d.length; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 6 + (Math.random() * 2 - 1) * 0.15; } }
    const src = a.createBufferSource(); src.buffer = noise; src.loop = true; const f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime;
    f.type = kind === 'boo' ? 'lowpass' : 'bandpass'; f.frequency.value = kind === 'boo' ? 380 : kind === 'gasp' ? 1100 : 760; f.Q.value = kind === 'boo' ? 0.7 : 0.55;
    if (kind === 'boo') { const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 5; lg.gain.value = 120; lfo.connect(lg).connect(f.frequency); lfo.start(t); lfo.stop(t + dur + 0.3); }
    if (kind === 'gasp') f.frequency.linearRampToValueAtTime(500, t + dur);
    const v = 0.11 * level; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.12); g.gain.setValueAtTime(v, t + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(a.destination); src.start(t); src.stop(t + dur + 0.05);
  } catch (e) { /* audio is optional */ }
}
function bell(n = 3) { const a = actx(); if (!a) return; try { const t = a.currentTime; for (let k = 0; k < n; k++) for (const [fr, v] of [[1180, 0.12], [2950, 0.05]]) { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = fr; const s = t + k * 0.22; g.gain.setValueAtTime(v, s); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.9); o.connect(g).connect(a.destination); o.start(s); o.stop(s + 0.95); } } catch (e) { /* optional */ } }
const fx = k => { try { window.__pitAudio?.fx?.[k]?.(); } catch (e) { /* optional */ } };

// ---------- particles ----------
function emit(x, y, z, n, o = {}) {
  const U = sparks.userData, P = sparks.geometry.attributes.position.array, Cc = sparks.geometry.attributes.color.array, cols = o.colors || [0xffffff, 0xffd27a, 0xff8a3d];
  n = Math.min(n, U.n);
  for (let k = 0; k < n; k++) { const i = U.head; U.head = (U.head + 1) % U.n;
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), sp = (o.speed || 6) * (0.35 + Math.random() * 0.75);
    let vx = r * Math.cos(th), vy = u, vz = r * Math.sin(th); if (o.up) vy = Math.abs(vy) * o.up + 0.2;
    P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z; U.vel[i * 3] = vx * sp; U.vel[i * 3 + 1] = vy * sp; U.vel[i * 3 + 2] = vz * sp;
    U.life[i] = U.max[i] = (o.life || 1.2) * (0.6 + Math.random() * 0.6); U.drag[i] = o.drag ?? 2.2; U.grav[i] = o.grav ?? 3;
    C.setHex(cols[(Math.random() * cols.length) | 0]); Cc[i * 3] = C.r; Cc[i * 3 + 1] = C.g; Cc[i * 3 + 2] = C.b; }
  sparks.geometry.attributes.position.needsUpdate = true; sparks.geometry.attributes.color.needsUpdate = true; SH.emitted += n;
}
function stepSparks(dt) {
  const U = sparks.userData, P = sparks.geometry.attributes.position.array, Cc = sparks.geometry.attributes.color.array; let live = 0;
  for (let i = 0; i < U.n; i++) { if (U.life[i] <= 0) continue; U.life[i] -= dt; live++;
    if (U.life[i] <= 0) { P[i * 3 + 1] = -999; continue; }
    const dr = Math.exp(-U.drag[i] * dt); U.vel[i * 3] *= dr; U.vel[i * 3 + 1] = U.vel[i * 3 + 1] * dr - U.grav[i] * dt; U.vel[i * 3 + 2] *= dr;
    P[i * 3] += U.vel[i * 3] * dt; P[i * 3 + 1] += U.vel[i * 3 + 1] * dt; P[i * 3 + 2] += U.vel[i * 3 + 2] * dt; if (P[i * 3 + 1] < 0.05) { P[i * 3 + 1] = 0.05; U.vel[i * 3 + 1] *= -0.3; }
    const f = U.life[i] / U.max[i]; if (f < 0.3) { const k = 1 - dt * 3; Cc[i * 3] *= k; Cc[i * 3 + 1] *= k; Cc[i * 3 + 2] *= k; } }
  if (live) { sparks.geometry.attributes.position.needsUpdate = true; sparks.geometry.attributes.color.needsUpdate = true; }
  return live;
}
function rain(n) { const U = conf.userData; let k = 0;
  for (let i = 0; i < U.n && k < n; i++) { if (U.life[i] > 0) continue; k++; const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 7;
    U.p[i * 3] = Math.cos(a) * r; U.p[i * 3 + 1] = 7 + Math.random() * 5; U.p[i * 3 + 2] = Math.sin(a) * r; U.v[i * 3] = (Math.random() - 0.5) * 0.8; U.v[i * 3 + 1] = -(1.1 + Math.random() * 0.9); U.v[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
    U.r[i * 3] = Math.random() * 6; U.r[i * 3 + 1] = Math.random() * 6; U.r[i * 3 + 2] = 2 + Math.random() * 5; U.life[i] = 6 + Math.random() * 2; } SH.confetti += k; }
function stepConf(dt, t) { const U = conf.userData; let live = 0;
  for (let i = 0; i < U.n; i++) { if (U.life[i] <= 0) continue; U.life[i] -= dt;
    if (U.life[i] <= 0 || U.p[i * 3 + 1] < 0.06) { U.life[i] = 0; conf.setMatrixAt(i, M4.makeScale(0, 0, 0)); continue; } live++;
    U.p[i * 3] += (U.v[i * 3] + Math.sin(t * 3 + i) * 0.5) * dt; U.p[i * 3 + 1] += U.v[i * 3 + 1] * dt; U.p[i * 3 + 2] += (U.v[i * 3 + 2] + Math.cos(t * 2.6 + i) * 0.5) * dt;
    E.set(U.r[i * 3] + t * U.r[i * 3 + 2], U.r[i * 3 + 1] + t * 2, 0); Q.setFromEuler(E); M4.compose(V.set(U.p[i * 3], U.p[i * 3 + 1], U.p[i * 3 + 2]), Q, S1.set(1.2, 1.2, 1.2)); conf.setMatrixAt(i, M4); }
  conf.instanceMatrix.needsUpdate = true; return live; }

// ---------- show state ----------
const SH = { on: false, phase: 'idle', round: 0, duel: null, me: 100, them: 100, ev: 0, S: null, opp: null, oppPos: null, finale: null, pay: null, endAt: 0, slump: null, hype: 0, moodUntil: 0,
  emitted: 0, confetti: 0, rounds: [], bursts: 0, banner: '', tally: '', glow: null, startedAt: 0, fightAt: 0, roundLens: [] };
const local = (x, z) => ({ x: x - host.position.x, z: z - host.position.z });
function mood(m, secs = 1.2) { SH.mood = m; SH.moodUntil = now() + secs; ring()?.show?.({ mood: m }); }

function startShow(d) {
  SH.on = true; SH.phase = 'count'; SH.round = d.pit.round; SH.duel = d; SH.me = d.me; SH.them = d.them; SH.ev = d.pit.ev; SH.opp = d.name; SH.startedAt = now(); SH.fightAt = 0;
  SH.S = window.__activities?.pit ? { ...window.__activities.pit } : { round: d.pit.round, me: 0, them: 0 };
  FX.visible = true; ring()?.show?.({ pack: true, hype: 0.65, mood: 'cheer' });
  const name = String(d.name || 'the challenger').toUpperCase(), seq = [];
  if (SH.round === 1) seq.push([0, 'LADIES AND LOWLIFES', 'Welcome to THE PIT'], [1.35, 'IN THIS CORNER', `${name} · ${['bone breaker', 'rust-belt bruiser', 'Flats legend', 'dust-lung brawler'][(name.length) % 4]}`], [2.8, K.ANNOUNCER.round(1), 'Best of 3 · first to 2 knockdowns']);
  else seq.push([0, K.ANNOUNCER.round(SH.round), `YOU ${K.pips(SH.S.me)} – ${K.pips(SH.S.them)} ${name}`]);
  SH.seq = seq.map(([at, b, s]) => ({ at: SH.startedAt + at, b, s }));
  crowd('roar', 1.2, 2.4); fx('wanted');
}
function stopShow() {
  SH.on = false; SH.phase = 'idle'; SH.duel = null; SH.finale = null; SH.seq = null; window.__ssxTimeK = 1;
  if (FX) { FX.visible = false; for (const o of [shock, shell, flare, aura, pillar]) o.visible = false; }
  ring()?.show?.({ pack: false, mood: '', hype: 0, strobe: null }); unglow(); if (bannerEl) bannerEl.className = ''; bannerT = 0; SH.banner = ''; if (SH.slump && lastTc?.player) lastTc.player.slump = 0; SH.slump = null; tally(null);
}
function roundEnd(o, d) {
  const S0 = SH.S || { me: 0, them: 0 }, win = o === 'win', after = { me: S0.me + (win ? 1 : 0), them: S0.them + (win ? 0 : 1) };
  const final = after.me >= 2 || after.them >= 2; SH.rounds.push({ round: SH.round, o, t: SH.fightAt ? +(now() - SH.fightAt).toFixed(1) : null, final });
  if (SH.fightAt) SH.roundLens.push(+(now() - SH.fightAt).toFixed(1));
  const at = win ? SH.oppPos : playerPos();
  if (final) return startFinale(win, after);
  SH.phase = 'break'; SH.S = { ...S0, ...after, round: S0.round + 1 };
  // smaller flash + burst on the downed fighter
  flash(win ? '#ffffff' : '#ff1f3d', 0.45); if (at) emit(at.x, 1.2, at.z, Math.round(B.sparks * 0.25), { speed: 6, colors: win ? [0xffffff, 0x67e8f9, 0xffd27a] : [0xff1f3d, 0xff8a3d, 0xffffff], life: 1 });
  shockAt(at, 0.6, win ? 0x9ff4ff : 0xff3b3b); SH.bursts++;
  const rb = K.roundBanner(o, after); banner(rb.big, rb.small, rb.tone, 3); mood(win ? 'erupt' : 'boo', 2.5); crowd(win ? 'roar' : 'boo', 1.1, 2); bell(3);
  if (!win) slump(2.6);
  tally(after);
}
function playerPos() { const p = lastTc?.player; return p && host ? local(p.x, p.z) : null; }
function slump(hold) { const p = lastTc?.player; if (!p) return; SH.slump = { t0: now(), hold }; }
function shockAt(at, k, col) { if (!at) return; shock.visible = true; shock.position.set(at.x, 0.12, at.z); shock.scale.setScalar(0.5); mats.ring.color.setHex(col); mats.ring.opacity = 0.9; SH.shock = { t0: now(), k }; }

let saved = [];
function glowPlayer(on, col = 0xffc23a) {
  const a = lastTc?.astro; if (!a?.group) return;
  if (on) { unglow(); a.group.traverse(o => { for (const m of [].concat(o.material || [])) if (m?.emissive && !saved.some(s => s.m === m)) saved.push({ m, c: m.emissive.getHex(), i: m.emissiveIntensity }); }); SH.glow = col; }
}
function unglow() { for (const s of saved) { try { s.m.emissive.setHex(s.c); s.m.emissiveIntensity = s.i; } catch (e) { /* gone */ } } saved = []; SH.glow = null; }

function startFinale(win, after) {
  const t = now(); SH.phase = 'finale'; SH.S = { ...SH.S, ...after };
  const at = win ? playerPos() : SH.oppPos, loser = win ? SH.oppPos : playerPos();
  SH.finale = { t0: t, win, at, loser, rained: 0, banner: false }; SH.endAt = t + K.FINALE.slowmo + K.FINALE.banner + 1;
  window.__ssxTimeK = K.FINALE.slowK; // slow motion on the knockdown (real time below)
  flash(win ? '#ffffff' : '#ff1f3d', 0.95, 0.12); fx('boom');
  const cols = win ? [0xffffff, 0xfff1b8, 0xffd24a, 0xff9f1c, 0x9ff4ff] : [0xffffff, 0xff1f3d, 0xff6a3d, 0xffb347];
  if (at) { emit(at.x, 1.3, at.z, Math.round(B.sparks * 0.75), { speed: 13, colors: cols, life: 1.8, drag: 1.6, grav: 1.4 }); emit(at.x, 0.4, at.z, Math.round(B.sparks * 0.2), { speed: 7, up: 2.5, colors: cols, life: 2.2, drag: 1.2, grav: 4 });
    shockAt(at, 1, win ? 0xffe2a8 : 0xff5a3d); shell.visible = true; shell.position.set(at.x, 1.2, at.z); shell.scale.setScalar(0.3); mats.shell.color.setHex(win ? 0xffb347 : 0xff2d2d); mats.shell.opacity = 0.55;
    flare.visible = true; flare.position.set(at.x, 1.3, at.z); flare.scale.setScalar(0.5); mats.flare.color.setHex(win ? 0xffffff : 0xffb0a0); mats.flare.opacity = 1;
    pillar.visible = true; pillar.position.set(at.x, 0, at.z); pillar.scale.set(1, 0.01, 1); mats.pillar.color.setHex(win ? 0xffd27a : 0xff4040); mats.pillar.opacity = 0.5;
    aura.visible = true; aura.position.set(at.x, 1.15, at.z); mats.aura.color.setHex(win ? 0xffcc55 : 0xff3030); }
  SH.bursts++;
  if (win) { glowPlayer(true, 0xffc23a); mood('erupt', 6); crowd('roar', 1.8, 3.5); setTimeout(() => crowd('roar', 1.4, 3), 2500); setTimeout(() => fx('cash'), 900); }
  else { slump(4.5); mood('boo', 6); crowd('boo', 1.6, 3.5); }
  bell(5); tally(after);
  if (!SH.pay) SH.pay = null; // runner.finale() fills the purse
}
// runner.js finishSeries() -> SSX.pitShow.finale(pay, opp)
function finale(pay, opp) {
  if (!pay || pay.result === 'forfeit') { if (SH.on) stopShow(); return; }
  SH.pay = pay; if (opp) SH.opp = opp;
  if (SH.phase === 'fight' || SH.phase === 'count') { SH.rounds.push({ round: SH.round, o: pay.result === 'lose' ? 'loss' : 'win', t: SH.fightAt ? +(now() - SH.fightAt).toFixed(1) : null, final: true }); if (SH.fightAt) SH.roundLens.push(+(now() - SH.fightAt).toFixed(1)); }
  if (FX && SH.phase !== 'finale') startFinale(pay.result !== 'lose', { me: pay.me, them: pay.them });
  SH.lastFinale = { ...pay, at: Date.now() };
}

// ---------- per-frame ----------
let lastReal = 0, ringT = 0;
function tick(dt, tc) {
  lastTc = tc; const t = now(), rdt = Math.min(0.1, lastReal ? t - lastReal : 0.016); lastReal = t;
  const R = ring(); const G = R?.group?.();
  if (!G || !R.debug?.built) { if (SH.on) stopShow(); return; }
  if (!FX || FX.parent !== G) { if (FX?.parent) FX.parent.remove(FX); build(G); }
  if (tc.name !== 'Mars') { if (SH.on) stopShow(); return; }
  const W = tc.world || world(), d = W?.duel, pitDuel = d && d.pit ? d : null;
  if (pitDuel && (!SH.on || SH.phase === 'break' || SH.phase === 'idle')) { if (!SH.on) startShow(pitDuel); else { SH.phase = 'count'; SH.duel = pitDuel; SH.round = pitDuel.pit.round; SH.me = pitDuel.me; SH.them = pitDuel.them; SH.ev = pitDuel.pit.ev; SH.startedAt = t; SH.fightAt = 0; SH.seq = [{ at: t, b: K.ANNOUNCER.round(SH.round), s: `YOU ${K.pips(SH.S?.me || 0)} – ${K.pips(SH.S?.them || 0)} ${String(pitDuel.name).toUpperCase()}` }]; crowd('roar', 1, 1.6); } }
  if (!SH.on) return;
  // the duel ran: hits, phases
  if (pitDuel) {
    SH.oppPos = local(pitDuel.x, pitDuel.z); SH.duel = pitDuel;
    if (pitDuel.phase === 'fight' && SH.phase === 'count') { SH.phase = 'fight'; SH.fightAt = t; SH.seq = null; banner(K.ANNOUNCER.fight, '', 'round', 0.9); bell(1); crowd('roar', 1.3, 1.4); }
    if (pitDuel.them < SH.them) { const at = SH.oppPos; emit(at.x, 1.35, at.z, phoneN(14), { speed: 4, colors: [0xffffff, 0xffd27a, 0xff6a3d], life: 0.6 }); mood('erupt', 0.6); SH.hype = Math.min(1, SH.hype + 0.15); }
    else if (pitDuel.pit.ev !== SH.ev && pitDuel.pit.last === 'block') { const at = SH.oppPos; emit(at.x, 1.4, at.z, phoneN(6), { speed: 3, colors: [0xffffff, 0x9ff4ff], life: 0.35 }); }
    else if (pitDuel.pit.ev !== SH.ev && pitDuel.pit.last === 'slip') mood('gasp', 0.5);
    if (pitDuel.me < SH.me) { flash('#ff1f3d', 0.22, 0.03); mood('gasp', 0.5); if (Math.random() < 0.35) crowd('gasp', 0.8, 0.8); }
    SH.me = pitDuel.me; SH.them = pitDuel.them; SH.ev = pitDuel.pit.ev;
  } else if (SH.phase === 'count' || SH.phase === 'fight') {
    const L = W?.lastDuel, o = L && (L.win ? 'win' : /lose/.test(L.why) ? 'loss' : null);
    if (o && window.__activities?.pit) roundEnd(o, L); else stopShow(); // no series any more (dropped / left): just wind down
  }
  if (!SH.on) return;
  // announcer card
  if (SH.seq) { let cur = null; for (const s of SH.seq) if (t >= s.at) cur = s; if (cur && SH.banner !== cur.b) banner(cur.b, cur.s, 'round', 2); }
  if (bannerEl && bannerT && t > bannerT && !(SH.phase === 'finale' && SH.finale?.banner)) { bannerEl.className = ''; bannerT = 0; SH.banner = ''; }
  if (SH.mood && t > SH.moodUntil) { SH.mood = ''; R.show({ mood: SH.phase === 'fight' || SH.phase === 'count' ? 'cheer' : '' }); }
  // hype rises as both fighters wear down
  const tension = SH.duel ? 0.45 + (1 - Math.min(SH.me, SH.them) / 100) * 0.5 : 0.5; SH.hype += (tension - SH.hype) * Math.min(1, rdt * 1.5);
  ringT -= rdt; if (ringT <= 0) { ringT = 0.1; if (pitDuel) tally(SH.S); R.show({ hype: SH.hype, strobe: K.strobeOn(t, 0, 128) ? K.strobeColor(t, 0) : 0x222222 }); }
  stepBeams(t); stepSparks(rdt * (window.__ssxTimeK || 1) ** 0.5); stepConf(rdt, t);
  // slump (knocked down): drop 0.35 s, hold, get up 0.6 s
  if (SH.slump && tc.player) { const e = t - SH.slump.t0, h = SH.slump.hold; tc.player.slump = e < 0.35 ? e / 0.35 : e < 0.35 + h ? 1 : Math.max(0, 1 - (e - 0.35 - h) / 0.6); if (e > h + 1) { tc.player.slump = 0; SH.slump = null; } }
  if (SH.shock) { const e = t - SH.shock.t0, k = SH.shock.k; shock.scale.setScalar(0.5 + e * 22 * k); mats.ring.opacity = Math.max(0, 0.9 - e * 1.1); if (e > 0.9) { shock.visible = false; SH.shock = null; } }
  if (SH.phase === 'finale') stepFinale(t, rdt);
  else if (SH.phase === 'break' && !pitDuel && !window.__activities?.pit) { if (!SH.breakT) SH.breakT = t; if (t - SH.breakT > 3) stopShow(); }
  if (SH.phase !== 'break') SH.breakT = 0;
}
const phoneN = n => (isPhone() ? Math.ceil(n * 0.6) : n);
function stepBeams(t) {
  const org = beams.userData.org, fin = SH.phase === 'finale', ph = isPhone();
  for (let i = 0; i < org.length; i++) { const [ox, oy, oz] = org[i];
    let tx, tz; if (fin && SH.finale?.at) { tx = SH.finale.at.x + Math.sin(t * 2 + i * 1.05) * 1.4; tz = SH.finale.at.z + Math.cos(t * 2 + i * 1.05) * 1.4; }
    else { tx = Math.sin(t * (0.7 + i * 0.13) + i * 1.7) * 4.6; tz = Math.cos(t * (0.9 + i * 0.11) + i * 2.3) * 4.6; if (!ph) { tx += Math.sin(t * 5.1 + i) * 0.3; tz += Math.cos(t * 4.7 + i) * 0.3; } }
    V.set(tx - ox, 0.1 - oy, tz - oz); const L = V.length(); V.normalize(); Q.setFromUnitVectors(DOWN, V);
    const on = fin ? Math.sin(t * 22 + i) > -0.2 : K.strobeOn(t, i); M4.compose(V2.set(ox, oy, oz), Q, S1.set(on ? 1 : 0.0001, L, on ? 1 : 0.0001)); beams.setMatrixAt(i, M4);
    beams.setColorAt(i, C.setHex(fin ? (SH.finale.win ? 0xb87a26 : 0x9a1a1a) : K.strobeColor(t, i))); }
  beams.instanceMatrix.needsUpdate = true; if (beams.instanceColor) beams.instanceColor.needsUpdate = true;
  mats.pool.color.setHex(fin ? (SH.finale.win ? 0xffd27a : 0xff2020) : K.strobeColor(t, 3)); mats.pool.opacity = fin ? 0.4 : K.strobeOn(t, 1) ? 0.5 : 0.18;
}
function stepFinale(t, rdt) {
  const F = SH.finale, e = t - F.t0, T = K.FINALE;
  if (e > T.slowmo) window.__ssxTimeK = Math.min(1, K.FINALE.slowK + (e - T.slowmo) * 1.5); if (e > T.slowmo + 0.6) window.__ssxTimeK = 1;
  if (shell.visible) { shell.scale.setScalar(0.3 + e * 9); mats.shell.opacity = Math.max(0, 0.55 - e * 0.6); if (e > 1) shell.visible = false; }
  if (flare.visible) { const k = e < 0.18 ? e / 0.18 : Math.max(0, 1 - (e - 0.18) / 1.6); flare.scale.setScalar(1 + k * 6); mats.flare.opacity = k; flare.material.rotation = e * 0.6; if (e > 1.9) flare.visible = false; }
  if (pillar.visible) { const up = Math.min(1, Math.max(0, (e - 0.25) / 0.7)); pillar.scale.set(1 + Math.sin(t * 5) * 0.06, 0.01 + up * 26, 1 + Math.sin(t * 5) * 0.06); mats.pillar.opacity = 0.5 * Math.min(1, Math.max(0, (T.pillar + 1 - e) / 1.5)); if (e > T.pillar + 1) pillar.visible = false; }
  if (aura.visible) { const p = 1 + Math.sin(t * 6) * 0.12, k = Math.min(1, e / 0.4) * Math.min(1, Math.max(0, (T.glow + 1 - e) / 1.2)); aura.scale.set(2.2 * p, 3.2 * p, 1); mats.aura.opacity = 0.5 * k; if (F.at && F.win) { const pp = playerPos(); if (pp) aura.position.set(pp.x, 1.15, pp.z); pillar.position.set(pp?.x ?? F.at.x, 0, pp?.z ?? F.at.z); } if (e > T.glow + 1) aura.visible = false; }
  if (SH.glow != null) { const k = Math.min(1, e / 0.5) * Math.min(1, Math.max(0, (T.glow - e) / 1.5)); for (const s of saved) { s.m.emissive.setHex(SH.glow); s.m.emissiveIntensity = (0.6 + Math.sin(t * 7) * 0.25) * k * 1.4; } if (e > T.glow) unglow(); }
  if (F.win && e > 0.6 && e < T.confetti && conf) { const want = Math.floor((e - 0.6) / (T.confetti - 0.6) * B.confetti * 1.6); if (want > F.rained) { rain(want - F.rained); F.rained = want; } }
  if (!F.banner && (SH.pay || e > 1.4)) { F.banner = true; const mb = K.matchBanner(SH.pay || { result: F.win ? 'win' : 'lose', me: SH.S?.me, them: SH.S?.them, credits: '…' }); banner(mb.big, mb.small, mb.tone, T.banner); }
  else if (F.banner && SH.pay && !F.paid) { F.paid = true; const mb = K.matchBanner(SH.pay); banner(mb.big, mb.small, mb.tone, T.banner); }
  if (e > T.slowmo + T.banner + 1) stopShow();
}

function uncompiled() { const Rr = app()?.renderer; if (!Rr || !FX) return -1; let n = 0; FX.traverse(o => { if (!o.material) return; for (const m of [].concat(o.material)) if (!Rr.properties.get(m).currentProgram) n++; }); return n; }
const counts = () => { if (!FX) return null; let meshes = 0; FX.traverse(o => { if (o.isMesh || o.isPoints || o.isSprite) meshes++; }); return { draws: meshes, sparks: B.sparks, confetti: B.confetti, phone: isPhone() }; };
const state = () => ({ on: SH.on, phase: SH.phase, round: SH.round, tally: SH.tally, banner: SH.banner, hype: +SH.hype.toFixed(2), mood: SH.mood, emitted: SH.emitted, confetti: SH.confetti, bursts: SH.bursts, rounds: SH.rounds.slice(), roundLens: SH.roundLens.slice(), glow: SH.glow, timeK: window.__ssxTimeK || 1,
  finale: SH.finale ? { win: SH.finale.win, t: +(now() - SH.finale.t0).toFixed(2) } : null, pay: SH.pay, lastFinale: SH.lastFinale || null, slump: lastTc?.player?.slump || 0, warmed, fxVisible: !!FX?.visible });
const api = { state, finale, debug: { get built() { return !!FX; }, uncompiled, counts, burst: (win = true) => { if (!FX) return false; SH.on = true; FX.visible = true; SH.S = SH.S || { me: 0, them: 0 }; startFinale(win, win ? { me: 2, them: 0 } : { me: 0, them: 2 }); return true; }, round: (o = 'win') => { if (!FX) return false; SH.on = true; FX.visible = true; roundEnd(o); return true; }, reset: stopShow, group: () => FX } };
window.SSX = window.SSX || {}; window.SSX.pitShow = api;
(function wire() { const reg = window.SSX?.registerSurfaceTick; if (typeof reg === 'function') reg(tick); else setTimeout(wire, 300); })();
export default api;
