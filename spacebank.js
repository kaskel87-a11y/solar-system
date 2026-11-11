// Cinder Vault orbital bank job (v7.5.82). Scout the buoys, hire a crew, dock, drill under pressure,
// crack the dial with SSX.heist.safeCrack, then burn back to the ship while cutters chase you.
// Find it: ☰ → 🏦 Space bank, or walk up to Nix Calder at the Ares spaceport (waypoint from that panel, 🏦 JOB on the spot).
// Reuses SSX.heist.safeCrack + tipSafeOpts, SSX.heist.alarm on landing, pursuit heat (queued in orbit, same as smuggling),
// SSX.crew (a hired hand covers their role for free), SSX.crimebreak.payBonus, SSX.airRoll, SSX.hudx.setWaypoint, SSX.on.
// Surface mission steps are ground metres, so this job runs its own stage machine and emits spacebank:* instead of registerMission.
// The Mars First Junction Trust job is a different heist. Fiction only. No real brands.
import * as THREE from 'three';
import * as C from './spacebankcore.js';
import { tipSafeOpts } from './heistcore.js';
import { cancelSafe } from './safecrack.js';
import { jobPay } from './economy.js';
import { routeHeat, queueWanted, landWanted, PHOBOS } from './mars/smugglecore.js';
import { addMenuItem, tap, panelTap } from './racehooks.js';

const app = () => window.__app;
const SSX = () => window.SSX || {};
const log = [];
const toast = (m, ms = 3200) => { try { app()?.toast?.(m, ms); } catch (e) { /* */ } log.push(m); if (log.length > 40) log.shift(); };
const mobile = () => !!(document.body?.classList.contains('touch') || matchMedia?.('(pointer: coarse)').matches);
const v3 = v => [v.x, v.y, v.z];
const add3 = C.add, sub3 = C.sub;

let S = C.loadState(null);
try { S = C.loadState(localStorage.getItem(C.SAVE_KEY)); } catch (e) { /* private mode */ }
const save = () => { try { localStorage.setItem(C.SAVE_KEY, JSON.stringify(S)); } catch (e) { /* */ } };

const R = {
  run: null, t: 0, mp: null, grp: null, drill: null, holdT: 0, holdBtn: false, holdPid: null,
  sc: {}, scanning: null, cut: [], lost: 0, locked: false, pending: 0, pin: null, look: null,
  wasRolling: false, lastSR: 0, ui: '', last: null, nix: null, marked: false, cracking: false
};

const subs = new Set();
function emit(ev, extra) {
  const detail = { ev, phase: R.run?.phase || null, id: 'cinder-vault', ...(extra || {}) };
  for (const f of subs) { try { f(detail); } catch (e) { /* */ } }
  try { SSX().emit?.('spacebank:' + ev, detail); } catch (e) { /* */ }
  try { dispatchEvent(new CustomEvent('spacebank:' + ev, { detail })); } catch (e) { /* */ }
}

const inSpace = () => { const s = app()?.state; return !!s && s.flying && !s.onSurface && !s.transitioning; };
const onMars = () => { const s = app()?.state; return !!s?.onSurface && s.info?.name === 'Mars' && !s.transitioning; };
function here() { const i = app()?.surface?.info; if (!i || i.name !== 'Mars' || !i.colony) return null; return { x: i.x - i.colony.x, z: i.z - i.colony.z, info: i }; }
function atNix() { const h = here(); return !!h && Math.hypot(h.x - C.NIX[0], h.z - C.NIX[1]) <= C.NIX_R; }
function nixWorld() { const i = app()?.surface?.info; if (!i?.colony) return null; return { x: i.colony.x + C.NIX[0], z: i.colony.z + C.NIX[1] }; }
function hiredCrew() { try { return (SSX().crew?.state?.()?.crew || []).map(m => m.id); } catch (e) { return []; } }
function shipM() { const a = app(); return a?.rocket && R.mp ? sub3(v3(a.rocket.position), R.mp) : null; }
function marsMesh() { return app()?.bodies?.find(b => b.name === 'Mars')?.mesh || null; }
const rolling = () => { let r = false; try { r = !!SSX().airRoll?.isRolling?.(); } catch (e) { /* */ } return r || !!app()?.shipRoll; };
function doRoll(dir = 1) {
  const ar = SSX().airRoll;
  if (ar?.canRoll?.()) { try { return ar.roll(dir < 0 ? 'left' : 'right') !== false; } catch (e) { /* */ } }
  app()?.requestRoll?.(dir < 0 ? -1 : 1); return !!app()?.shipRoll;
}

function raiseHeat(n, why) {
  // An orbital alarm waits for the next Mars landing. Pursuit's onMars flag only
  // updates while the surface tick runs, so after a landing it stays true in
  // space and spike() would accept the heat and skip this queue (Firefox did).
  if (!onMars()) {
    R.pending = queueWanted(R.pending, 0, n);
    return 'pending';
  }
  const p = SSX().pursuit;
  if (p) {
    const r = routeHeat(p, n, why);
    if (r.via === 'pursuit' || r.via === 'pit') return r.via;
  }
  R.pending = queueWanted(R.pending, 0, n);
  return 'pending';
}
function trip(why) {
  const r = R.run; if (!r) return;
  r.alarm = true;
  if (r.heatSent) return;
  r.heatSent = true; r.camHit = true;
  raiseHeat(2, why);
  toast(C.line('alarm', S.runs), 2800);
  emit('alarm', { why });
}
function applyPending() {
  if (!(R.pending > 0)) return false;
  const w = app()?.surface?.world; if (!w?.setWanted) return false;
  const to = landWanted(R.pending, w.wanted), why = 'Cinder Vault: orbital alarm caught up';
  const H = SSX().heist;
  if (to > (w.wanted || 0)) {
    if (H?.alarm && !H.active) { try { H.alarm(to, why); } catch (e) { w.setWanted(to, why); } }
    else w.setWanted(to, why);
  }
  R.pending = 0; return true;
}

function spend(n) {
  if (!(n > 0)) return true;
  const g = app()?.game || app()?.surface?.game;
  return !!g?.spend?.(n);
}
function waypoint(on) {
  try {
    const h = SSX().hudx;
    if (!on) { h?.setWaypoint?.(null, true); return; }
    const p = nixWorld(); if (p && h?.setWaypoint) h.setWaypoint({ x: p.x, z: p.z, label: 'Nix Calder' }, true);
  } catch (e) { /* no hud yet */ }
}

function start() {
  if (R.run) return { ok: false, why: 'run' };
  try { if (SSX().smuggle?.state?.run) return { ok: false, why: 'smuggle' }; } catch (e) { /* */ }
  R.run = C.newRun(); R.drill = C.freshDrill(); R.holdT = 0; R.holdBtn = false; R.sc = {}; R.scanning = null; R.lost = 0; R.locked = false;
  clearCut(); S.runs++; save(); emit('start');
  toast(C.guide(R.run, shipM(), !inSpace()).text, 5200);
  if (onMars() && !atNix()) waypoint(true);
  return { ok: true };
}
function abort(why = 'bailed') {
  const r = R.run; if (!r) return { ok: false };
  if (r.phase === 'crack') { try { cancelSafe(); } catch (e) { /* */ } }
  r.phase = 'failed'; S.failed++; save();
  clearCut(); R.run = null; R.pin = null; R.holdBtn = false; R.cracking = false;
  toast(`${C.FIXER}: Job's dead (${why}).`, 2400); emit('abort', { why }); closePanel();
  return { ok: true };
}
function hire(id) {
  const r = R.run; if (!r || r.phase !== 'crew') return { ok: false, why: 'phase' };
  if (r.crew.includes(id)) return { ok: false, why: 'have' };
  const p = C.priceOf(id, hiredCrew()); if (!p) return { ok: false, why: 'role' };
  if (!spend(p.cost)) return { ok: false, why: 'broke', cost: p.cost };
  r.crew.push(id);
  toast(p.free ? `${p.name} already works for you. No charge.` : `Hired ${p.name}. −${p.cost} cr.`, 2400);
  if (panelOn()) renderPanel();
  emit('hire', { id, cost: p.cost, free: p.free });
  return { ok: true, id, cost: p.cost, free: p.free };
}
function lockCrew() {
  const r = R.run; if (!r || r.phase !== 'crew') return { ok: false, why: 'phase' };
  r.phase = 'vault'; closePanel();
  toast(C.line('crew'), 3200); emit('crew', { crew: r.crew.slice() });
  return { ok: true, crew: r.crew.slice() };
}
function pay(how) {
  const r = R.run; if (!r || r.phase === 'done' || r.phase === 'failed') return { ok: false };
  let bonus = 0; try { bonus = SSX().crimebreak?.payBonus?.() || 0; } catch (e) { /* */ }
  const sc = C.score(r, bonus);
  const g = app()?.game || app()?.surface?.game;
  let cash = sc.cash;
  if (cash > 0) { try { cash = jobPay(cash, 'spacebank'); } catch (e) { /* */ } }
  try { if (cash > 0 || sc.stars > 0) g?.reward?.(sc.stars, cash); } catch (e) { /* */ }
  S.earned += cash; S.done++; save();
  R.last = { phase: r.phase, crew: r.crew.slice(), alarm: r.alarm, loot: r.loot, hp: r.hp, got: { cash, stars: sc.stars, how, bonus } };
  clearCut(); R.run = null; R.pin = null; R.holdBtn = false;
  toast(cash ? `${C.line('paid', S.done)} +${cash} cr${r.alarm ? ' (hot)' : ''}.` : C.line('blown'), 3600);
  emit('paid', R.last.got); return { ok: true, ...R.last.got };
}
function seize() {
  const r = R.run; if (!r) return;
  r.loot = false; r.phase = 'failed'; S.failed++; save();
  raiseHeat(1, 'Cinder Vault: boarded');
  clearCut(); R.run = null; R.pin = null;
  toast(C.line('seized'), 3600); emit('seized');
}

function crackOpts(run) {
  const plan = C.vaultPlan(run);
  const tip = plan.ease ? tipSafeOpts(plan.tier, plan.time, { safeEase: plan.ease }) : { time: plan.time };
  return { tier: plan.tier, time: tip.time || plan.time, title: C.BANK_NAME, seed: run.seed, overrides: tip.overrides };
}
async function beginCrack() {
  const r = R.run; if (!r || r.phase === 'crack' || R.cracking) return;
  r.phase = 'crack'; R.cracking = true; R.holdBtn = false;
  toast(C.line('dial'), 2600); emit('dial');
  const opts = crackOpts(r);
  let res = { success: false, reason: 'missing' };
  try {
    const H = SSX().heist;
    res = H?.safeCrack ? await H.safeCrack(opts) : { success: true, ok: true, reason: 'cracked' };
  } catch (e) { res = { success: false, reason: 'error' }; }
  R.cracking = false;
  if (!R.run || R.run !== r) return;
  r.lastCrack = { tier: opts.tier, time: opts.time, reason: res.reason || (res.success ? 'cracked' : 'fail'), overrides: !!opts.overrides };
  if (res.success || res.ok) {
    r.loot = true; r.phase = 'getaway'; spawnCut(); toast(C.line('escape'), 3200); emit('vault', r.lastCrack); return;
  }
  if (res.reason === 'abort' || res.reason === 'busy') {
    r.phase = 'drill'; R.drill = C.freshDrill(); toast('Dial closed. Drill it again.', 2400); return;
  }
  trip('Cinder Vault: the dial tripped the grid');
  if (!r.retried) { r.retried = true; r.phase = 'drill'; R.drill = C.freshDrill(); toast(C.line('retry'), 2800); emit('retry'); return; }
  r.loot = false; r.phase = 'getaway'; spawnCut(); toast(C.line('blown'), 3200); emit('blown');
}

// ---------- meshes (one group in the Mars frame, hidden until a job is live) ----------
function glowMat(color, emissive) {
  const m = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 1.8, roughness: 0.4, metalness: 0.05, flatShading: true });
  m.toneMapped = false; return m;
}
function beamMat(color) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  m.toneMapped = false; return m;
}
const _w = new THREE.Vector3(), _to = new THREE.Vector3(), _fwd = new THREE.Vector3();
function build() {
  const scene = app()?.rocket?.parent; if (!scene || R.grp) return;
  const g = new THREE.Group(); g.name = 'cinderVault'; g.visible = false;
  const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2, 4.2), new THREE.MeshStandardMaterial({ color: 0x8a939c, metalness: 0.45, roughness: 0.4 }));
  hull.position.set(...C.BANK.pos); hull.name = 'sbHull'; g.add(hull);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 1.2), new THREE.MeshStandardMaterial({ color: 0xc4552a, roughness: 0.6 }));
  fin.position.set(C.BANK.pos[0], C.BANK.pos[1] + 2.2, C.BANK.pos[2]); g.add(fin);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(C.BANK.dockR * 0.55, 0.18, 8, 48), new THREE.MeshBasicMaterial({ color: 0xffd040 }));
  ring.position.set(...C.BANK.dock); ring.rotation.x = Math.PI / 2; ring.name = 'sbDock'; ring.material.toneMapped = false; g.add(ring); R.dock = ring;
  const dockGeo = new THREE.CylinderGeometry(0.7, 1.25, 80, 10, 1, true); dockGeo.translate(0, 40, 0);
  const dockBeam = new THREE.Mesh(dockGeo, beamMat(0xffd040));
  dockBeam.position.set(...C.BANK.dock); dockBeam.name = 'sbDockBeam'; dockBeam.frustumCulled = false; dockBeam.visible = false; g.add(dockBeam); R.dockBeam = dockBeam;
  R.buoys = C.BUOYS.map(b => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(1.15), glowMat(0xfff1c2, 0xff8a00));
    m.position.set(...b.pos); m.name = 'sbBuoy:' + b.id;
    const beamGeo = new THREE.CylinderGeometry(0.55, 0.95, 72, 8, 1, true); beamGeo.translate(0, 36, 0);
    const beam = new THREE.Mesh(beamGeo, beamMat(0xffb020)); beam.name = 'sbBeam'; beam.frustumCulled = false;
    const halo = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 8), beamMat(0xffd060)); halo.name = 'sbHalo';
    m.add(beam, halo); g.add(m); return m;
  });
  R.cones = C.CAMS.map((c, i) => {
    const h = C.SCAN.range, geo = new THREE.ConeGeometry(Math.tan(C.SCAN.half) * h, h, 20, 1, true); geo.translate(0, -h / 2, 0);
    const cone = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
    cone.name = 'sbCone:' + c.id; cone.position.set(...c.at); g.add(cone); cone.userData.phase = i * 1.7; return cone;
  });
  scene.add(g); R.grp = g;
}
function cutterMesh() {
  const m = new THREE.Group(); m.name = 'sbCutter';
  const hull = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2, 4), new THREE.MeshStandardMaterial({ color: 0x9a3a2a, roughness: 0.45, metalness: 0.25, flatShading: true }));
  hull.rotation.x = -Math.PI / 2; m.add(hull);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  lamp.name = 'lamp'; lamp.position.set(0, 0.3, 0.3); m.add(lamp); m.scale.setScalar(1.4); return m;
}
function clearCut() { for (const c of R.cut) c.m.parent?.remove(c.m); R.cut = []; R.locked = false; R.lost = 0; }
function spawnCut() {
  build(); if (!R.grp) return;
  const n = Math.max(0, C.cutterCount(mobile()) - R.cut.length);
  for (let i = 0; i < n; i++) {
    const m = cutterMesh(); R.grp.add(m);
    const p = [C.BANK.pos[0] + (i - 0.5) * 4, C.BANK.pos[1] + 2, C.BANK.pos[2] + 6];
    m.position.set(...p); R.cut.push({ p, lock: { v: 0, ghost: 0 }, m });
  }
  R.lost = 0;
}

function nixMesh() {
  const s = app()?.surface; if (!s?.scene || !onMars()) return;
  if (R.nix?.parent) return;
  const g = new THREE.Group(); g.name = 'nixCalder';
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.05, 0.3), new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.8 }));
  body.position.y = 0.85;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshStandardMaterial({ color: 0xc4a07a, roughness: 0.7 }));
  head.position.y = 1.55; g.add(body, head);
  const p = nixWorld(); if (!p) return;
  const y = SSX().height?.(p.x, p.z);
  if (!Number.isFinite(y)) return;
  g.position.set(p.x, y, p.z); s.scene.add(g); R.nix = g;
  if (!R.marked) { try { SSX().minimap?.addMarks?.('spacebank', [{ x: p.x, z: p.z, color: '#ffd040', r: 3 }]); R.marked = true; } catch (e) { /* */ } }
}
function nixPlant() {
  nixMesh();
  if (!R.nix?.parent || !onMars()) return;
  const p = nixWorld(); if (!p) return;
  const y = SSX().height?.(p.x, p.z);
  if (Number.isFinite(y) && Math.abs(R.nix.position.y - y) > 0.2) R.nix.position.set(p.x, y, p.z);
}
function applyPin() {
  const a = app(); if (!R.pin || !R.mp || !a?.rocket) return false;
  const w = add3(R.mp, R.pin); a.rocket.position.set(...w);
  if (R.look) {
    a.rocket.lookAt(new THREE.Vector3(...add3(R.mp, R.look))); a.rocket.rotateY(Math.PI);
    a.camera?.position.copy(a.rocket.position).add(new THREE.Vector3(0, 2.2, 8).applyQuaternion(a.rocket.quaternion));
  }
  return true;
}

// ---------- per-frame ----------
let lastT = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; R.t += dt;
  const a = app(); if (!a) return;
  if (R.pending && onMars()) applyPending();
  nixPlant();
  const mm = marsMesh(); if (!mm) { ui(); return; }
  const mp = v3(mm.getWorldPosition(new THREE.Vector3())), prev = R.mp; R.mp = mp;
  const r = R.run;
  if (r && R.grp) R.grp.position.set(mp[0], mp[1], mp[2]);
  const space = inSpace(), sm = shipM();
  if (space && prev && sm && r && !R.pin) {
    const dMars = C.len(sm);
    const engineRides = dMars < 16;
    let smuggleRides = false;
    try { smuggleRides = !!SSX().smuggle?.state?.run && dMars < PHOBOS.R + 45; } catch (e) { /* */ }
    if (!engineRides && !smuggleRides && dMars < 170) {
      const d = sub3(mp, prev);
      a.rocket.position.x += d[0]; a.rocket.position.y += d[1]; a.rocket.position.z += d[2];
      if (a.camera?.position) { a.camera.position.x += d[0]; a.camera.position.y += d[1]; a.camera.position.z += d[2]; }
    }
  }
  if (R.pin) applyPin();
  if (!r) { if (R.grp) R.grp.visible = false; ui(); return; }
  build();
  if (R.grp) R.grp.visible = space || !!a.state?.flying;
  if (!space) {
    if (onMars() && r.phase === 'getaway') pay('land');
    ui(); return;
  }
  if (R.paused) { ui(); return; }
  const p = shipM(); if (!p) { ui(); return; }
  const rl = rolling(), sr = a.shipRolls || 0;
  const rolled = (rl && !R.wasRolling) || (sr > (R.lastSR ?? sr));
  R.wasRolling = rl; R.lastSR = sr;
  if (rolled && r) r.dodges++;
  const tune = C.chaseTune(r.crew.includes('wheel'));
  // cameras on the way in
  if (!r.camHit && (r.phase === 'scout' || r.phase === 'crew' || r.phase === 'vault')) {
    let top = null, topV = 0;
    C.CAMS.forEach((c, i) => {
      const dir = C.beamDir(c.rest, R.t, R.cones?.[i]?.userData?.phase || i);
      if (R.cones?.[i]) R.cones[i].quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(...dir));
      const seen = C.inCone(c.at, dir, p) && !C.blocked(c.at, p, [{ c: [0, 0, 0], r: 3.4 }, { c: C.BANK.pos, r: C.BANK.r }]);
      const s0 = R.sc[c.id] || { v: 0, ghost: 0 };
      const s1 = C.scanStep(s0, dt, { seen, rolled: rolled && s0.v > 0 });
      if (s1.dodged) toast('📡 Lost the cone.', 1400);
      R.sc[c.id] = { v: s1.v, ghost: s1.ghost, seen };
      if (s1.flagged) { trip('Cinder Vault: a camera painted the hull'); return; }
      if (s1.v > topV) { topV = s1.v; top = c.id; }
    });
    R.scanning = top;
  } else R.scanning = null;
  if (r.phase === 'scout') {
    const have = C.gather(r.intel, p);
    if (have.length > r.intel.length) { r.intel = have; toast(`${C.line('intel')} ${have.length}/3`, 1800); emit('intel', { n: have.length }); }
    if (r.intel.length >= 3) { r.phase = 'crew'; toast(C.line('intelDone'), 3600); emit('scout'); }
  } else if (r.phase === 'vault') {
    const d = C.dist(p, C.BANK.dock);
    R.holdT = d <= C.BANK.dockR ? R.holdT + dt : 0;
    if (R.holdT >= C.BANK.hold) { r.phase = 'drill'; R.drill = C.freshDrill(); toast(C.line('dock'), 3200); emit('dock'); }
  } else if (r.phase === 'drill') {
    const next = C.drillStep(R.drill || C.freshDrill(), dt, !!R.holdBtn);
    R.drill = next;
    if (next.alarm) trip('Cinder Vault: the drill ran hot');
    if (next.done) beginCrack();
    else if (next.failed) {
      trip('Cinder Vault: the drill timed out');
      if (!r.retried) { r.retried = true; R.drill = C.freshDrill(); toast(C.line('retry'), 2600); }
      else { r.loot = false; r.phase = 'getaway'; spawnCut(); toast(C.line('blown'), 2800); }
    }
  } else if (r.phase === 'getaway') {
    R.locked = false;
    if (R.cut.length) {
      let far = true, any = false;
      for (const ic of R.cut) {
        const to = sub3(p, ic.p), d = C.len(to), sp = Math.min(d, tune.speed * dt), nrm = C.norm(to);
        ic.p = add3(ic.p, [nrm[0] * sp, nrm[1] * sp, nrm[2] * sp]);
        ic.m.position.set(...ic.p); ic.m.lookAt(ic.m.position.clone().add(new THREE.Vector3(...nrm)));
        const lamp = ic.m.getObjectByName('lamp'); if (lamp) lamp.visible = Math.floor(R.t * 6) % 2 === 0;
        const sees = !C.blocked(ic.p, p, [{ c: [0, 0, 0], r: 3.4 }, { c: C.BANK.pos, r: C.BANK.r }]);
        if (sees) any = true;
        if (d < tune.lose) far = false;
        const ls = C.lockStep(ic.lock, dt, { d: sees ? d : 1e9, rolled: rolled && ic.lock.v > 0 });
        if (ls.broke) toast('🌀 Broke the lock.', 1400);
        ic.lock = { v: ls.v, ghost: ls.ghost };
        if (ls.v > 0.15) R.locked = true;
        if (ls.hit) {
          r.hp = Math.max(0, r.hp - tune.hit); toast(`${C.line('hit')} ${r.hp}%`, 1400); emit('hit');
          if (r.hp <= 0) { seize(); ui(); return; }
        }
      }
      R.lost = (far || !any) ? R.lost + dt : 0;
      if (R.lost > tune.loseT) { clearCut(); toast(C.line('lost'), 2200); emit('lost'); }
    }
    if (C.len(p) <= C.HOME || (R.cut.length === 0 && C.len(p) < C.BANK.pos[2] * 0.45)) pay(R.cut.length ? 'well' : 'lost');
  }
  ui();
}

function paintMarkers() {
  if (!R.buoys) return;
  const r = R.run, scout = r?.phase === 'scout', have = r?.intel || [];
  const pulse = 0.5 + 0.5 * Math.sin(R.t * 3.4);
  const cam = app()?.camera;
  const widen = m => {
    if (!cam) return 1;
    m.getWorldPosition(_w);
    return Math.max(1, Math.min(14, cam.position.distanceTo(_w) / 28));
  };
  R.buoys.forEach((m, i) => {
    const logged = !scout || have.includes(C.BUOYS[i].id);
    const beam = m.getObjectByName('sbBeam'), halo = m.getObjectByName('sbHalo');
    if (logged) {
      m.material.color.setHex(0x8ee0a8); m.material.emissive.setHex(0x146b38); m.material.emissiveIntensity = 0.4;
      m.scale.setScalar(1);
      if (beam) beam.visible = false;
      if (halo) halo.visible = false;
    } else {
      m.material.color.setHex(0xfff3c4); m.material.emissive.setHex(0xff8a00); m.material.emissiveIntensity = 1.15 + pulse * 1.35;
      m.scale.setScalar(1.2 + pulse * 0.35);
      const s = widen(m);
      if (beam) { beam.visible = true; beam.material.opacity = 0.28 + 0.32 * pulse; beam.scale.set(s, 1, s); }
      if (halo) { halo.visible = true; halo.material.opacity = 0.16 + 0.22 * pulse; halo.scale.setScalar(s * (0.8 + 0.25 * pulse)); }
    }
  });
  const dockOn = !!r && (r.phase === 'crew' || r.phase === 'vault');
  if (R.dockBeam) {
    R.dockBeam.visible = dockOn;
    if (dockOn) { const s = widen(R.dockBeam); R.dockBeam.scale.set(s, 1, s); R.dockBeam.material.opacity = 0.42 + 0.48 * pulse; }
  }
  if (R.dock?.material) R.dock.material.color.setHex(dockOn ? (pulse > 0.5 ? 0xfff2a8 : 0xffc020) : 0xffd040);
}
function projectGuide(pos) {
  const cam = app()?.camera; if (!cam || !R.mp) return null;
  _w.set(R.mp[0] + pos[0], R.mp[1] + pos[1], R.mp[2] + pos[2]);
  _fwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
  _to.copy(_w).sub(cam.position);
  const behind = _to.dot(_fwd) <= 0;
  _w.project(cam);
  let x = _w.x, y = _w.y;
  if (behind) { x = -x; y = -y; }
  return { x, y, behind };
}
function shovePtr(el) {
  const margin = 8, W = innerWidth, H = innerHeight;
  const L = W * 0.25, Rg = W * 0.75, T = H * 0.25, B = H * 0.75, floor = H - 128;
  const place = (x, y) => { el.style.left = x + 'px'; el.style.top = y + 'px'; };
  let x = parseFloat(el.style.left), y = parseFloat(el.style.top);
  let r = el.getBoundingClientRect();
  if (r.left < margin) x += margin - r.left;
  if (r.right > W - margin) x -= r.right - (W - margin);
  if (r.top < 58) y += 58 - r.top;
  if (r.bottom > floor) y -= r.bottom - floor;
  place(x, y); r = el.getBoundingClientRect();
  if (!(r.right > L && r.left < Rg && r.bottom > T && r.top < B)) return;
  // Wider than the side gutter: sit in the top band so the whole pill stays on screen and out of the middle.
  // Left side of the top band: the right side is the menu and Stop flying.
  const ny = Math.max(58 + r.height / 2, T - 8 - r.height / 2);
  const nx = margin + r.width / 2;
  place(nx, ny);
}
function paintGuide() {
  if (!ptr) return;
  const r = R.run;
  const g = r && r.phase !== 'done' && r.phase !== 'failed' ? C.guide(r, shipM(), !inSpace()) : null;
  if (!g?.kind) { ptr.classList.remove('on'); R.guide = null; return; }
  let nx = 0, ny = 0.94, dist = null;
  if (g.pos && inSpace()) {
    const pr = projectGuide(g.pos);
    if (pr) { nx = pr.x; ny = pr.y; }
    const p = shipM(); if (p) dist = C.dist(p, g.pos);
  }
  const spot = C.edgePointer(nx, ny, innerWidth, innerHeight);
  const range = dist == null ? '' : C.fmtRange(dist);
  const label = g.kind === 'takeoff' ? 'Take off' : (range || g.hint);
  ptr.classList.add('on');
  const sp = ptr.querySelector('span'); if (sp.textContent !== label) sp.textContent = label;
  ptr.querySelector('i').style.transform = `rotate(${spot.ang}rad)`;
  ptr.style.left = spot.x + 'px'; ptr.style.top = spot.y + 'px';
  shovePtr(ptr);
  const box = ptr.getBoundingClientRect();
  R.guide = { kind: g.kind, id: g.id, label, dist: dist == null ? null : Math.round(dist), x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) };
}

// ---------- UI: one narrow left chip in space (outside the middle 50%), a bottom sheet, one dock button on Nix ----------
// v7.5.84: an edge pointer (#sbPtr) aims at the next buoy, the gold ring, or Mars. It stays out of the middle.
const CSS = `#sbPtr{position:fixed;z-index:20;display:none;align-items:center;gap:4px;min-height:44px;max-width:46vw;box-sizing:border-box;padding:4px 10px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:800 13px/1.15 system-ui,sans-serif;pointer-events:none;transform:translate(-50%,-50%);white-space:nowrap}
#sbPtr.on{display:flex}#sbPtr i{display:block;width:22px;font-style:normal;font-size:18px;line-height:22px;text-align:center}
#sbChip{position:fixed;z-index:14;left:calc(8px + env(safe-area-inset-left));top:calc(168px + env(safe-area-inset-top));display:none;flex-direction:column;gap:4px;width:min(22vw,168px);box-sizing:border-box;padding:4px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:700 11px/1.15 system-ui,sans-serif;pointer-events:auto}
#sbChip.on{display:flex}#sbChip .m{display:none;height:6px;border:1px solid #fff;border-radius:3px;overflow:hidden}#sbChip .m.on{display:block}#sbChip .m b{display:block;height:100%;width:0;background:#fff}
#sbChip button{display:none;min-height:44px;min-width:44px;width:100%;padding:4px;border-radius:8px;background:#000;color:#fff;border:2px solid #fff;font:800 12px/1.1 system-ui,sans-serif;touch-action:none}
#sbChip button.on{display:block}
#sbPanel{position:fixed;inset:0;z-index:56;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.45)}
#sbPanel.on{display:flex}#sbPanel .wrap{width:min(96vw,440px);max-height:min(70vh,560px);overflow:auto;-webkit-overflow-scrolling:touch;margin:0 8px calc(12px + env(safe-area-inset-bottom));background:#000;color:#fff;border:2px solid #fff;border-radius:16px;padding:12px;box-sizing:border-box;font:14px/1.35 system-ui,sans-serif}
#sbPanel h2{margin:0 0 6px;font-size:17px}#sbPanel p{margin:6px 0}#sbPanel button{min-height:44px;min-width:44px;margin:4px 4px 0 0;padding:8px 10px;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:800 14px/1.15 system-ui,sans-serif;touch-action:manipulation}
#sbPanel button:disabled{opacity:.45}#dockSb{order:8}`;
let dockBtn = null, chip = null, panel = null, ptr = null;
function panelOn() { return !!panel?.classList.contains('on'); }
function ensureDom() {
  if (chip || typeof document === 'undefined') return;
  const st = document.createElement('style'); st.id = 'sbCss'; st.textContent = CSS; document.head.appendChild(st);
  ptr = document.createElement('div'); ptr.id = 'sbPtr'; ptr.setAttribute('aria-hidden', 'true'); ptr.innerHTML = '<i>▲</i><span></span>'; document.body.appendChild(ptr);
  chip = document.createElement('div'); chip.id = 'sbChip'; chip.setAttribute('role', 'status');
  chip.innerHTML = '<span class="t"></span><span class="m"><b></b></span><button type="button" id="sbAct"></button>';
  document.body.appendChild(chip);
  const btn = chip.querySelector('#sbAct');
  btn.addEventListener('pointerdown', e => {
    if (R.run?.phase !== 'drill') return;
    R.holdBtn = true; R.holdPid = e.pointerId;
  });
  const release = e => { if (R.holdPid == null || e.pointerId === R.holdPid) { R.holdBtn = false; R.holdPid = null; } };
  btn.addEventListener('pointerup', release); btn.addEventListener('pointercancel', release);
  window.addEventListener('pointerup', release);
  tap(btn, () => {
    const p = R.run?.phase;
    if (p === 'crew') openPanel();
    else if (p === 'getaway' || p === 'scout' || p === 'vault') { R.rollDir = -(R.rollDir || 1); doRoll(R.rollDir); }
  });
  panel = document.createElement('div'); panel.id = 'sbPanel'; panel.innerHTML = '<div class="wrap"></div>';
  document.body.appendChild(panel);
  panelTap(panel, e => { const b = e.target?.closest?.('button'); if (b && !b.disabled) onPanel(b.dataset); });
  panel.addEventListener('pointerdown', e => { if (e.target === panel) closePanel(); });
  const attach = () => {
    const d = document.getElementById('ssxDock'); if (!d) return false;
    let b = document.getElementById('dockSb');
    if (!b) { b = document.createElement('button'); b.id = 'dockSb'; b.type = 'button'; b.style.display = 'none'; d.appendChild(b); tap(b, () => { if (!R.run) start(); }); }
    dockBtn = b; return true;
  };
  if (!attach()) { try { const mo = new MutationObserver(() => { if (attach()) mo.disconnect(); }); mo.observe(document.body, { childList: true, subtree: true }); } catch (e) { /* */ } }
  addEventListener('keydown', e => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Escape' && panelOn()) { closePanel(); return; }
    if (e.code === 'KeyG' && R.run?.phase === 'drill') { R.holdBtn = e.type === 'keydown'; e.preventDefault(); }
  });
  addEventListener('keyup', e => { if (e.code === 'KeyG' && R.run?.phase === 'drill') R.holdBtn = false; });
}
function closePanel() { panel?.classList.remove('on'); return true; }
function renderPanel() {
  if (!panel) return;
  const w = panel.firstChild, r = R.run, esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  if (!r) {
    w.innerHTML = `<h2>🏦 ${C.BANK_NAME}</h2><p>${esc(C.FIXER)} has an orbital bank job. Not the Junction Trust. Scout three buoys, hire a drill, a hacker and a wheel, dock, crack the dial, burn home.</p><p>Nix waits at the Ares spaceport. Set a waypoint, or take the job from here and fly.</p><button type="button" data-a="wp">📍 Waypoint</button><button type="button" data-a="go">Take the job</button><button type="button" data-a="close">Close</button>`;
    return;
  }
  if (r.phase === 'crew') {
    const ids = hiredCrew();
    const rows = C.ROLES.map(role => {
      const p = C.priceOf(role.id, ids), on = r.crew.includes(role.id);
      const tag = on ? 'Hired' : p.free ? 'Your crew · free' : `${p.cost} cr`;
      return `<p><b>${esc(role.title)}</b> · ${esc(role.name)}<br><small>${esc(role.blurb)}</small></p><button type="button" data-a="hire" data-id="${role.id}" ${on ? 'disabled' : ''}>${on ? '✓ ' : ''}${esc(role.title)} · ${tag}</button>`;
    }).join('');
    w.innerHTML = `<h2>👥 Crew</h2><p>Buy who you need, or skip them. A hand you already hired at ☰ Crew covers their role free. Then fly into the gold ring at Cinder Vault. The arrow points at it.</p>${rows}<button type="button" data-a="lock">Lock the crew</button><button type="button" data-a="abort">Abort</button><button type="button" data-a="close">Close</button>`;
    return;
  }
  const phase = C.guide(r, shipM(), !inSpace())?.text || r.phase;
  w.innerHTML = `<h2>🏦 ${esc(C.BANK_NAME)}</h2><p>${esc(phase)}</p><button type="button" data-a="abort">Abort</button><button type="button" data-a="close">Close</button>`;
}
function openPanel() {
  ensureDom(); if (!panel) return false;
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ }
  renderPanel(); panel.classList.add('on'); return true;
}
function onPanel(ds) {
  const a = ds?.a;
  if (a === 'close') return closePanel();
  if (a === 'wp') { waypoint(true); toast(nixWorld() ? '📍 Waypoint: Nix Calder, Ares spaceport.' : '📍 Land on Mars first.', 2400); closePanel(); return; }
  if (a === 'go') { const r = start(); if (!r.ok && r.why === 'smuggle') toast('Finish the smuggle run first.', 2200); closePanel(); return; }
  if (a === 'hire') { const r = hire(ds.id); if (!r.ok && r.why === 'broke') toast(`Need ${r.cost} cr.`, 2200); return; }
  if (a === 'lock') return lockCrew();
  if (a === 'abort') return abort('bailed');
}
function ui() {
  paintMarkers();
  paintGuide();
  if (dockBtn) {
    const show = onMars() && !R.run && atNix();
    const k = show ? '1' : '0';
    if (k !== R.dockK) { R.dockK = k; dockBtn.style.display = show ? '' : 'none'; dockBtn.textContent = '🏦\nJOB'; dockBtn.setAttribute('aria-label', 'Take the Cinder Vault job'); }
  }
  if (!chip) return;
  const r = R.run, space = inSpace();
  const show = !!r && space && r.phase !== 'done' && r.phase !== 'failed';
  chip.classList.toggle('on', show); if (!show) return;
  const p = shipM();
  let text = '🏦', act = '', meter = 0, meterOn = false;
  if (r.phase === 'scout') { text = `🏦 ${r.intel.length}/3`; if (R.scanning) { act = 'ROLL'; meter = R.sc[R.scanning]?.v || 0; meterOn = true; } }
  else if (r.phase === 'crew') { text = '🏦 Crew'; act = 'CREW'; }
  else if (r.phase === 'vault') { text = `🏦 ${p ? Math.round(C.dist(p, C.BANK.dock)) : '—'}m`; if (R.scanning) { act = 'ROLL'; meter = R.sc[R.scanning]?.v || 0; meterOn = true; } }
  else if (r.phase === 'drill') { text = '🏦 Drill'; act = 'DRILL'; meter = R.drill?.fill || 0; meterOn = true; }
  else if (r.phase === 'crack') text = '🏦 Dial';
  else if (r.phase === 'getaway') {
    text = R.cut.length ? `🚨 ${R.cut.length} · ${r.hp}%` : `🏦 ${p ? Math.round(C.len(p)) : ''}`;
    act = 'ROLL';
    meter = R.cut.reduce((m, c) => Math.max(m, (c.lock.v || 0) / C.LOCK.fill), 0); meterOn = !!R.cut.length;
  }
  const t = chip.querySelector('.t'); if (t.textContent !== text) t.textContent = text;
  const bar = chip.querySelector('.m'); bar.classList.toggle('on', meterOn); bar.firstChild.style.width = Math.round(meter * 100) + '%';
  const b = chip.querySelector('#sbAct');
  b.classList.toggle('on', !!act); if (act && b.textContent !== act) b.textContent = act;
  b.setAttribute('aria-label', act === 'DRILL' ? 'Hold to drill the vault' : act === 'CREW' ? 'Open the crew sheet' : 'Evasive roll');
}

function setup() {
  if (!document.body) { addEventListener('DOMContentLoaded', setup, { once: true }); return; }
  ensureDom();
}
setup();

const api = {
  version: 'v7.5.84',
  get state() {
    const r = R.run;
    return {
      run: r ? { phase: r.phase, intel: r.intel.slice(), crew: r.crew.slice(), alarm: !!r.alarm, loot: !!r.loot, hp: r.hp, retried: !!r.retried, dodges: r.dodges, heatSent: !!r.heatSent, lastCrack: r.lastCrack || null } : null,
      drill: R.drill ? { fill: +(+R.drill.fill).toFixed(3), heat: +(+R.drill.heat).toFixed(3), done: !!R.drill.done, hot: !!R.drill.hot } : null,
      scanning: R.scanning, scan: Object.fromEntries(Object.entries(R.sc).map(([k, v]) => [k, Math.round((v.v || 0) * 100) / 100])),
      cutters: R.cut.length, locked: R.locked, pending: R.pending, atNix: atNix(), nix: nixWorld(), guide: R.guide || null, why: R.run ? 'run' : null, last: R.last, saved: { ...S }, t: R.t
    };
  },
  start, abort, hire, lockCrew, pay, roll: doRoll, open: openPanel, close: closePanel,
  price: id => C.priceOf(id, hiredCrew()),
  plan: () => (R.run ? crackOpts(R.run) : null),
  on(fn) { if (typeof fn !== 'function') return () => {}; subs.add(fn); return () => subs.delete(fn); },
  debug: {
    log: () => log.slice(),
    nix: () => nixWorld(),
    place(pm, look) { R.pin = pm; R.look = look || null; return applyPin(); },
    unpin() { R.pin = null; R.look = null; },
    placeAtBuoy(id = 'cams') { const b = C.BUOYS.find(x => x.id === id) || C.BUOYS[0]; return api.debug.place(b.pos, C.BANK.pos); },
    placeAtDock() { return api.debug.place(C.BANK.dock, C.BANK.pos); },
    placeNearMars(k = 8) { return api.debug.place([0, 2, k], [0, 0, 120]); },
    placeInCone(id = 'lane', k = 12) { const c = C.CAMS.find(x => x.id === id) || C.CAMS[0]; const dir = C.norm(c.rest); return api.debug.place(add3(c.at, [dir[0] * k, dir[1] * k, dir[2] * k]), c.at); },
    pause(v = true) { R.paused = !!v; },
    scoutAll() { if (R.run) { R.run.intel = C.BUOYS.map(b => b.id); if (R.run.phase === 'scout') R.run.phase = 'crew'; } return R.run?.intel || []; },
    pulse() { if (!R.run || R.run.phase !== 'drill') return null; R.drill = C.pulseDrill(R.drill || C.freshDrill()); return { ...R.drill }; },
    trip(why = 'Cinder Vault: test alarm') { trip(why); return R.pending; },
    skip(phase) { if (R.run && C.PHASES.includes(phase)) { R.run.phase = phase; if (phase === 'getaway' && !R.cut.length) spawnCut(); if (phase === 'drill') R.drill = C.freshDrill(); } return R.run?.phase || null; },
    hold: () => R.holdT,
    pullCut(k = 8) { const p = shipM(); if (!p) return; R.cut.forEach((c, n) => { c.p = add3(p, [k, 1 + n, 0]); }); },
    pullCutBehind(k = 80) { const p = shipM(), a = app(); if (!p || !a?.rocket) return; const f = new THREE.Vector3(0, 0, -1).applyQuaternion(a.rocket.quaternion); R.cut.forEach((c, n) => { c.p = [p[0] - f.x * (k + n * 4), p[1] - f.y * (k + n * 4), p[2] - f.z * (k + n * 4)]; }); },
    reset() { if (R.run?.phase === 'crack') { try { cancelSafe(); } catch (e) { /* */ } } clearCut(); R.run = null; R.pin = null; R.pending = 0; R.last = null; R.cracking = false; S = C.loadState(null); save(); }
  }
};
window.__spacebank = api;
(function boot(n = 0) {
  if (!window.SSX || !window.__app?.registerMenuItem) { if (n < 400) setTimeout(() => boot(n + 1), 200); return; }
  if (window.SSX.spacebank) return;
  window.SSX.spacebank = api;
  try { addMenuItem(window.__app, { id: 'sbMenu', label: '🏦 Space bank', onTap: () => openPanel() }); } catch (e) { console.warn('spacebank menu', e); }
  requestAnimationFrame(t => { lastT = t; tick(t); });
})();
