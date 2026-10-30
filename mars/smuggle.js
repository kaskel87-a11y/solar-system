// Ship smuggling runs (Pumpkin). Pick up a sealed crate from Gutter Pell at the Ares Junction pad, fly it to the Phobos
// drop, get home to Mars, take cash or a favor. Customs beacons sweep scan cones across the lane; get flagged and patrol
// interceptors come for you. Roll (SSX.airRoll when it is there, the ship's own barrel roll otherwise) to shake a scan or
// a lock, bribe the officer (SSX.bribes.price when it is there), or dump the crate (run over, no heat).
// Pure logic lives in ./smugglecore.js. Hooks: one <script> line in index.html, the import map, one sw.js precache line.
// Everything optional is feature-detected: SSX.pursuit (#42), SSX.bribes (#23), SSX.airRoll (#41), SSX.contraband.
// Fiction only, M-rated (contraband, crooked customs, swearing).
import * as THREE from 'three';
import * as C from './smugglecore.js';
import { jobPay } from '../economy.js'; // money boost: SSX.economy.payoutMult

const app = () => window.__app;
const SSX = () => window.SSX || {};
const toast = (m, ms = 3000) => { try { app()?.toast?.(m, ms); } catch (e) { /* */ } log.push(m); if (log.length > 40) log.shift(); };
const log = [];
const mobile = () => !!(document.body?.classList.contains('touch') || matchMedia?.('(pointer: coarse)').matches);
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const v3 = v => [v.x, v.y, v.z];

let S = C.loadState(null);
try { S = C.loadState(localStorage.getItem(C.SAVE_KEY)); } catch (e) { /* private mode */ }
const save = () => { try { localStorage.setItem(C.SAVE_KEY, JSON.stringify(S)); } catch (e) { /* */ } };

// R = live (unsaved) state
const R = { run: null, t: 0, cd: -1e9, mars: null, mp: null, a0: 0, sc: {}, cleared: new Set(), icp: [], lost: 0, wasRolling: false,
  freeze: null, forceRefuse: null, pendingWanted: 0, payT: 0, ui: '', grp: null, payoutShown: false, scanning: null, locked: false, holdT: 0 };

// ---------- heat: SSX.pursuit when present (#42 reads world.wanted), else a local 0-5 value that cools ----------
function heat() {
  const p = SSX().pursuit;
  if (p) { const h = Number.isFinite(+p.heat) ? +p.heat : (app()?.surface?.world?.wanted ?? 0); return C.clamp(Math.max(h, R.pendingWanted), 0, 5); }
  return C.coolHeat(S.heat, (Date.now() - S.heatT) / 1000);
}
function raiseHeat(n, why) {
  const p = SSX().pursuit;
  if (p) {
    const r = C.routeHeat(p, n, why); R.heatFn = r.fn || null;
    if (r.via === 'pending') R.pendingWanted = C.queueWanted(R.pendingWanted, heat(), n); // applied to world.wanted on the next Mars landing
    return r.via;
  }
  S.heat = C.clamp(heat() + n, 0, 5); S.heatT = Date.now(); save(); return 'local';
}
function applyPending() {
  if (!R.pendingWanted) return false;
  const w = app()?.surface?.world; if (!w?.setWanted) return false;
  const to = C.landWanted(R.pendingWanted, w.wanted);
  try { if (to > (w.wanted || 0)) w.setWanted(to, 'smuggling: customs flagged your ship'); } catch (e) { return false; }
  R.pendingWanted = 0; return true;
}

// ---------- rolls: SSX.airRoll (#41, the ship counts) when it can, else the ship's own barrel roll ----------
function roll(dir = 1) {
  const ar = SSX().airRoll;
  if (ar?.canRoll?.()) { try { return ar.roll(dir < 0 ? 'left' : 'right') !== false; } catch (e) { /* */ } }
  app()?.requestRoll?.(dir < 0 ? -1 : 1); return !!app()?.shipRoll;
}
const rolling = () => { const ar = SSX().airRoll; let r = false; try { r = !!ar?.isRolling?.(); } catch (e) { /* */ } return r || !!app()?.shipRoll; };

// ---------- Mars frame: Phobos, the customs beacons + scan cones, the interceptors ----------
const W = new THREE.Color(0xffffff);
function marsMesh() { return R.mars || (R.mars = app()?.bodies?.find(b => b.name === 'Mars' || b.mesh?.userData?.name === 'Mars')?.mesh || null); }
function build() {
  const scene = app()?.rocket?.parent; if (!scene || R.grp) return;
  const g = new THREE.Group(); g.name = 'smuggleFrame'; g.visible = false;
  const ph = new THREE.Mesh(new THREE.IcosahedronGeometry(C.PHOBOS.r, 1), new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: 1, flatShading: true }));
  ph.scale.set(1.25, 0.9, 1); ph.name = 'smgPhobos'; g.add(ph);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(C.PHOBOS.drop, 0.12, 6, 48), new THREE.MeshBasicMaterial({ color: W, transparent: true, opacity: 0.55 }));
  ring.name = 'smgDrop'; ring.rotation.x = Math.PI / 2; g.add(ring);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 40, 6), new THREE.MeshBasicMaterial({ color: W, transparent: true, opacity: 0.35 }));
  mast.name = 'smgMast'; g.add(mast);
  R.beacons = C.BEACONS.map((b, i) => {
    const bg = new THREE.Group(); bg.name = 'smgBeacon:' + b.id;
    bg.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.9), new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0x222222, flatShading: true })));
    const h = C.SCAN.range, geo = new THREE.ConeGeometry(Math.tan(C.SCAN.half) * h, h, 28, 1, true); geo.translate(0, -h / 2, 0);
    const cone = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: W, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }));
    cone.name = 'smgCone'; bg.add(cone); g.add(bg); return { id: b.id, g: bg, cone, phase: i * 1.7 };
  });
  scene.add(g); R.grp = g; R.ph = ph; R.ring = ring; R.mast = mast;
}
function icpMesh() {
  const m = new THREE.Group(); m.name = 'smgInterceptor';
  const hull = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.2, 4), new THREE.MeshStandardMaterial({ color: 0x8c8c8c, roughness: 0.45, metalness: 0.3, flatShading: true }));
  hull.rotation.x = -Math.PI / 2; m.add(hull);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.7), new THREE.MeshStandardMaterial({ color: 0xeeeeee })); wing.position.z = 0.5; m.add(wing);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 })); lamp.name = 'lamp'; lamp.position.set(0, 0.35, 0.2); m.add(lamp);
  m.scale.setScalar(1.5); return m;
}

// geometry of the moment (Mars frame)
function geo() {
  const ph = C.phobosAt(R.a0, R.freeze?.t ?? R.t), bs = C.beaconsFor(ph);
  return { ph, bs: bs.map((b, i) => ({ ...b, dir: C.beamDir(b.rest, R.freeze?.t ?? R.t, R.beacons?.[i]?.phase || i * 1.7) })) };
}
const blockers = ph => [{ c: [0, 0, 0], r: 3.3 }, { c: ph, r: C.PHOBOS.r + 0.4 }];
function shipM() { const a = app(); return a?.rocket && R.mp ? sub3(v3(a.rocket.position), R.mp) : null; }

// ---------- run flow ----------
function here() { const i = app()?.surface?.info; if (!i || i.name !== 'Mars' || !i.colony) return null; return { x: i.x - i.colony.x, z: i.z - i.colony.z, info: i }; }
function atPad() { const h = here(); return !!h && Math.hypot(h.x - C.PAD_AJ[0], h.z - C.PAD_AJ[1]) <= C.PAD_R; }
const inSpace = () => { const s = app()?.state; return !!s && s.flying && !s.onSurface && !s.transitioning; };
const onMars = () => { const s = app()?.state; return !!s?.onSurface && s.info?.name === 'Mars'; };
function why() {
  if (R.run) return 'run';
  if (!onMars()) return 'notMars';
  if (!atPad()) return 'notPad';
  if (R.t - R.cd < C.COOLDOWN) return 'cooldown';
  return null;
}
function start() {
  const w = why(); if (w) { if (w === 'cooldown') toast(`📦 ${C.FIXER}: Cool off. Come back in ${Math.ceil(C.COOLDOWN - (R.t - R.cd))} s.`, 2200); return { ok: false, why: w }; }
  R.run = C.newRun(R.t); R.a0 = Math.random() * Math.PI * 2; R.sc = {}; R.cleared = new Set(); R.payoutShown = false; R.holdT = 0; clearIcp();
  S.runs++; save(); emit('start');
  toast(`📦 ${C.line('pickup', S.runs)} Take off (T), fly to the ring at Phobos.`, 4200);
  return { ok: true };
}
function fail(kind) {
  const r = R.run; if (!r) return;
  r.phase = 'failed'; r.why = kind; S.failed++; save();
  if (kind === 'seized') raiseHeat(1, 'smuggling: cargo seized');
  toast(C.line(kind === 'dumped' ? 'dump' : 'seized', S.failed), 3200);
  clearIcp(); R.run = null; R.cd = R.t; R.scanning = null; R.locked = false; emit(kind);
}
function dump() { if (!R.run || R.run.phase === 'payout') return { ok: false }; fail('dumped'); return { ok: true }; }
function bribe() {
  const r = R.run, s = R.scanning; if (!r || !s) return { ok: false, why: 'noScan' };
  const h = heat(); let price = null;
  try { const p = SSX().bribes?.price?.({ kind: 'spot', stars: Math.round(h) + 1, where: 'orbit', who: 'customs' }); if (Number.isFinite(+p) && +p > 0) price = Math.round(+p); else if (Number.isFinite(+p?.price)) price = Math.round(+p.price); } catch (e) { /* */ }
  if (price == null) price = C.bribePrice(h);
  const g = app()?.game; if (!g?.spend?.(price)) { toast(`💸 You can't cover ${price} cr. Roll or run.`, 2200); return { ok: false, why: 'broke', price }; }
  const refused = R.forceRefuse ?? (Math.random() < C.refuseChance(h));
  r.bribes++;
  if (refused) { toast(C.line('bribeNo', r.bribes), 2600); flag(s); return { ok: true, refused: true, price }; }
  R.cleared.add(s); R.sc[s] = { v: 0, ghost: 0 }; R.scanning = null; toast(`${C.line('bribeOk', r.bribes)} (−${price} cr)`, 2400); emit('bribe');
  return { ok: true, refused: false, price };
}
function flag(id) {
  const r = R.run; if (!r) return;
  r.flags++; R.cleared.add(id); R.sc[id] = { v: 0, ghost: 0 }; R.scanning = null;
  r.heatVia = raiseHeat(1, 'smuggling: flagged by orbital customs');
  toast(C.line('flagged', r.flags), 2600);
  spawnIcp(id); emit('flagged');
}
function spawnIcp(fromId) {
  build(); const { bs } = geo(), b = bs.find(x => x.id === fromId) || bs[0];
  const n = Math.max(0, C.interceptorCount(heat(), mobile()) - R.icp.length);
  for (let i = 0; i < n; i++) { const m = icpMesh(); R.grp.add(m); const off = [(i - 0.5) * 3, 1.5 * i, 0]; R.icp.push({ p: add3(b.pos, off), lock: { v: 0, ghost: 0 }, m }); }
  R.lost = 0;
}
function clearIcp() { for (const i of R.icp) i.m.parent?.remove(i.m); R.icp = []; R.lost = 0; R.locked = false; }
function payout(kind = 'cash') {
  const r = R.run; if (!r || r.phase !== 'payout') return { ok: false };
  const p = C.payout(r), g = app()?.game, cb = SSX().contraband;
  let got = null;
  if (kind === 'favor' && cb?.items && cb?.add) {
    try {
      const st = cb.stash?.() || { items: {} }, cap = cb.capacity?.() || { used: 0, max: 20 };
      let left = Math.max(0, cap.max - cap.used);
      const items = cb.items().map(I => ({ id: I.id, base: I.base, room: Math.max(0, (I.max ?? 99) - (st.items?.[I.id]?.qty || 0)) }));
      const bundle = []; for (const x of C.favorBundle(p.favorValue, items)) { const q = Math.min(x.qty, left); if (q > 0) { bundle.push({ id: x.id, qty: q }); left -= q; } }
      if (bundle.length) {
        for (const x of bundle) cb.add(x.id, x.qty, 1);
        const w = app()?.surface?.world; if (w?.setWanted && (w.wanted || 0) > 0) w.setWanted(w.wanted - 1, 'smuggling favor: Pell made a call');
        got = { kind: 'favor', bundle, value: C.bundleValue(bundle, items) }; S.favors++;
        toast(`🤝 ${C.FIXER}: ${bundle.map(x => x.qty + '× ' + (cb.items().find(i => i.id === x.id)?.name || x.id)).join(', ')}. And I made a call about your face.`, 3600);
      }
    } catch (e) { console.warn('smuggle favor', e); }
  }
  if (!got) { p.cash = jobPay(p.cash, 'smuggle'); try { g?.reward?.(0, p.cash); } catch (e) { /* */ } got = { kind: 'cash', cash: p.cash }; S.earned += p.cash; toast(`💰 ${C.FIXER} pays ${p.cash} cr${r.flags ? ' (hot cargo bonus)' : r.hp < 100 ? ' (damaged crate)' : ' (clean run)'}.`, 3000); }
  r.phase = 'done'; S.delivered++; save(); R.last = { ...r, got }; R.run = null; R.cd = R.t; emit('paid');
  return { ok: true, ...got };
}

// ---------- per-frame tick (own rAF; space logic + Mars ride-along + payout timeout) ----------
let lastT = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; R.t += dt;
  const a = app(); if (!a) return;
  if (R.pendingWanted && onMars() && !a.state?.transitioning) applyPending(); // any Mars landing, run or not
  const mm = marsMesh(); if (!mm) return;
  const mp = v3(mm.getWorldPosition(new THREE.Vector3())), prev = R.mp; R.mp = mp;
  const r = R.run;
  if (r && R.grp) R.grp.position.set(mp[0], mp[1], mp[2]);
  if (!r) { if (R.grp) R.grp.visible = false; ui(); return; }
  build();
  const space = inSpace();
  R.grp.visible = space || !!a.state?.flying;
  // ride-along: the route lives in the Mars frame. Inside the lane and not already riding a body (the engine rides Mars
  // itself within 12 of the surface) the ship gets Mars' orbital motion too.
  const sm = shipM();
  if (space && prev && sm && !a.state.near && C.len(sm) < C.PHOBOS.R + 45) {
    const d = sub3(mp, prev); a.rocket.position.x += d[0]; a.rocket.position.y += d[1]; a.rocket.position.z += d[2];
    a.camera?.position && (a.camera.position.x += d[0], a.camera.position.y += d[1], a.camera.position.z += d[2]);
  }
  const { ph, bs } = geo();
  // near Phobos the ship rides along with it too (it moves ~3 u/s round Mars), so holding in the drop ring is about flying, not chasing
  if (space && sm && R.prevPh && C.dist(sm, ph) < C.PHOBOS.drop * 2) { const d = sub3(ph, R.prevPh); a.rocket.position.x += d[0]; a.rocket.position.y += d[1]; a.rocket.position.z += d[2]; a.camera?.position && (a.camera.position.x += d[0], a.camera.position.y += d[1], a.camera.position.z += d[2]); }
  R.prevPh = ph;
  R.ph.position.set(...ph); R.ph.rotation.y += dt * 0.2; R.ring.position.set(...ph); R.mast.position.set(ph[0], ph[1] + 20, ph[2]);
  R.ring.visible = r.phase === 'outbound'; R.mast.visible = r.phase === 'outbound';
  bs.forEach((b, i) => { const B = R.beacons[i]; B.g.position.set(...b.pos); B.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(...b.dir)); B.cone.visible = !R.cleared.has(b.id); });
  if (r.phase === 'payout') { R.payT += dt; if (R.payT > 30) payout('cash'); ui(); return; }
  if (!space) {
    if (onMars() && r.phase === 'return') { r.phase = 'payout'; R.payT = 0; clearIcp(); applyPending(); toast(`${C.line('home')} ${mobile() ? 'Tap 💰 CASH or 🤝 FAVOR' : '8 = cash, 9 = favor'}.`, 4000); emit('home'); }
    ui(); return;
  }
  if (R.paused) { ui(); return; } // debug: hold the logic still (slow test browsers screenshotting)
  const p = sm, boost = !!(a.keys?.Space || a.keys?.ShiftLeft || a.touchBtns?.boost), rl = rolling(), sr = a.shipRolls || 0, rolled = (rl && !R.wasRolling) || (!R.wasRolling && sr > (R.lastSR ?? sr)); R.wasRolling = rl; R.lastSR = sr; // a whole roll between two of our ticks still counts
  if (rolled) r.rolls++;
  const H = heat(), blk = blockers(ph);
  // customs scans
  let top = null, topV = 0;
  for (const b of bs) {
    if (R.cleared.has(b.id)) continue;
    const s0 = R.sc[b.id] || { v: 0, ghost: 0 }, seen = C.inCone(b.pos, b.dir, p) && !C.blocked(b.pos, p, blk);
    const s1 = C.scanStep(s0, dt, { seen, boost, heat: H, rolled: rolled && s0.v > 0 });
    let rd = s0.rd && s1.v > 0;
    if (s1.dodged) { r.dodges++; rd = true; toast(C.line('dodge', r.dodges), 1600); emit('dodge'); }
    else if (s0.v > 0.25 && s1.v === 0 && !s0.rd) { r.dodges++; toast(C.line('dodge', r.dodges + 1), 1600); emit('dodge'); }
    if (s0.v === 0 && s1.v > 0) toast(`${C.line('scan', r.flags)} (${b.name})`, 2200);
    R.sc[b.id] = { v: s1.v, ghost: s1.ghost, seen, rd };
    if (s1.flagged) { flag(b.id); continue; }
    if (s1.v > topV) { topV = s1.v; top = b.id; }
  }
  R.scanning = top;
  // interceptors
  R.locked = false;
  if (R.icp.length) {
    let far = true, anySee = false;
    for (const ic of R.icp) {
      const to = sub3(p, ic.p), d = C.len(to), sp = Math.min(d, C.LOCK.speed * dt), n = C.norm(to);
      ic.p = add3(ic.p, [n[0] * sp, n[1] * sp, n[2] * sp]);
      ic.m.position.set(...ic.p); ic.m.lookAt(ic.m.position.clone().add(new THREE.Vector3(...n)));
      const lamp = ic.m.getObjectByName('lamp'); if (lamp) lamp.visible = Math.floor(R.t * 6) % 2 === 0;
      const sees = !C.blocked(ic.p, p, blk); if (sees) anySee = true;
      if (d < C.LOCK.lose) far = false;
      const ls = C.lockStep(ic.lock, dt, { d: sees ? d : 1e9, rolled: rolled && ic.lock.v > 0 });
      if (ls.broke) { toast(C.line('lockBroke', r.rolls), 1400); r.dodges++; emit('lockBroke'); }
      ic.lock = { v: ls.v, ghost: ls.ghost };
      if (ls.v > 0.15) R.locked = true;
      if (ls.hit) { r.hp = Math.max(0, r.hp - C.LOCK.hit); toast(`${C.line('hit', r.hp)} (${r.hp}%)`, 1600); emit('hit'); if (r.hp <= 0) { fail('seized'); ui(); return; } }
    }
    R.lost = (far || !anySee) ? R.lost + dt : 0;
    if (R.lost > C.LOCK.loseT) { clearIcp(); toast(C.line('lost'), 2200); emit('lost'); }
  }
  // the drop
  if (r.phase === 'outbound') {
    const dp = C.dist(p, ph);
    R.holdT = dp <= C.PHOBOS.drop ? R.holdT + dt : 0;
    if (R.holdT >= C.PHOBOS.hold && !R.pauseDrop) { r.phase = 'return'; r.dropped = true; R.holdT = 0; toast(C.line('drop', S.runs), 3200); emit('drop'); }
  }
  ui();
}

// ---------- UI: a dock button on the Mars surface (📦 RUN / 💰 CASH + 🤝 FAVOR), one tiny black/white strip in space ----------
const CSS = `#dockSmg,#dockSmgF{order:7}
#smgHud{position:fixed;z-index:13;left:50%;top:calc(228px + env(safe-area-inset-top));transform:translateX(-50%);display:none;align-items:center;gap:6px;padding:4px 6px;border-radius:10px;background:#000;color:#fff;border:1.5px solid #fff;font:700 11px/1.1 system-ui,sans-serif;white-space:nowrap;pointer-events:none}
#smgHud.on{display:flex} #smgHud .m{width:46px;height:6px;border:1px solid #fff;border-radius:3px;overflow:hidden} #smgHud .m i{display:block;height:100%;background:#fff;width:0}
#smgHud button{pointer-events:auto;min-height:30px;min-width:40px;padding:2px 7px;border-radius:8px;background:#000;color:#fff;border:1.5px solid #fff;font:800 11px/1 system-ui,sans-serif;touch-action:manipulation}
#smgHud button[hidden]{display:none}
@media (max-height:440px){#smgHud{top:calc(160px + env(safe-area-inset-top))}}`;
let dockBtn = null, dockFav = null, hud = null;
// bind with index.html's __onTap (pointer pattern, works with a 2nd finger on the stick); it may not exist yet when this
// module runs, so wait for it (click as a last resort)
function tap(el, fn, n = 0) { if (window.__onTap) return window.__onTap(el, fn); if (n < 300) return setTimeout(() => tap(el, fn, n + 1), 100); el.addEventListener('click', fn); }
function dockAct() { if (R.run?.phase === 'payout') return payout('cash'); return start(); }
function dockButtons() {
  const attach = () => {
    const d = document.getElementById('ssxDock'); if (!d) return false;
    const mk = (id, fn) => { let b = document.getElementById(id); if (!b) { b = document.createElement('button'); b.id = id; b.type = 'button'; b.style.order = '7'; b.style.display = 'none'; d.appendChild(b); tap(b, fn); } return b; };
    dockBtn = mk('dockSmg', dockAct); dockFav = mk('dockSmgF', () => payout('favor')); R.ui = ''; return true;
  };
  if (attach()) return;
  try { const mo = new MutationObserver(() => { if (attach()) mo.disconnect(); }); mo.observe(document.body, { childList: true }); } catch (e) { /* no dock: keys 8 / 9 only */ }
}
function buildHud() {
  hud = document.createElement('div'); hud.id = 'smgHud'; hud.setAttribute('role', 'status');
  hud.innerHTML = '<span class="t">📦</span><span class="m"><i></i></span><button type="button" id="smgRoll" aria-label="Evasive roll">🌀</button><button type="button" id="smgBribe" aria-label="Bribe customs (B)">💸</button><button type="button" id="smgDump" aria-label="Dump the cargo (X)">DUMP</button>';
  document.body.appendChild(hud);
  tap(hud.querySelector('#smgRoll'), () => { R.rollDir = -(R.rollDir || 1); roll(R.rollDir); });
  tap(hud.querySelector('#smgBribe'), () => bribe());
  tap(hud.querySelector('#smgDump'), () => dump());
}
function ui() {
  const r = R.run, mars = onMars();
  if (dockBtn) {
    const mode = !mars ? '' : r?.phase === 'payout' ? 'pay' : (!r && atPad()) ? 'run' : '';
    const k = mode + (mode === 'run' && R.t - R.cd < C.COOLDOWN ? 'c' : '');
    if (k !== R.ui) {
      R.ui = k; dockBtn.style.display = mode ? '' : 'none'; dockFav.style.display = mode === 'pay' ? '' : 'none';
      dockBtn.textContent = mode === 'pay' ? '💰\nCASH' : '📦\nRUN'; dockFav.textContent = '🤝\nFAVOR';
      dockBtn.setAttribute('aria-label', mode === 'pay' ? 'Take the cash payout (8)' : 'Pick up a smuggling run (8)'); dockFav.setAttribute('aria-label', 'Take a favor from Gutter Pell instead (9)');
    }
  }
  if (!hud) return;
  const pre = !!r && r.phase === 'outbound' && mars; // picked up, still on the ground: one line, no buttons (toasts can hide under the radio pill)
  const show = !!r && (inSpace() || pre) && r.phase !== 'payout'; hud.classList.toggle('on', show); if (!show) return;
  if (pre) { const t = hud.querySelector('.t'), x = `📦 ${mobile() ? 'Take off' : 'T: take off'} → Phobos`; if (t.textContent !== x) t.textContent = x; hud.querySelector('.m').style.display = 'none'; for (const b of hud.querySelectorAll('button')) b.hidden = true; return; }
  hud.querySelector('#smgDump').hidden = false;
  const p = shipM(), { ph } = geo(), sv = R.scanning ? R.sc[R.scanning]?.v || 0 : 0;
  const lock = R.icp.reduce((m, i) => Math.max(m, i.lock.v / C.LOCK.fill), 0);
  const tgt = r.phase === 'outbound' ? `Phobos ${Math.round(C.dist(p, ph))}` : `Mars ${Math.round(Math.max(0, C.len(p) - 3))}`;
  const txt = R.scanning ? `📡 SCAN` : R.icp.length ? `🚨 ${R.icp.length} · ${r.hp}%` : `📦 ${tgt}`;
  const t = hud.querySelector('.t'); if (t.textContent !== txt) t.textContent = txt;
  hud.querySelector('.m').style.display = (R.scanning || R.icp.length) ? '' : 'none';
  hud.querySelector('.m i').style.width = Math.round(100 * (R.scanning ? sv : lock)) + '%';
  hud.querySelector('#smgRoll').hidden = !(R.scanning || R.icp.length);
  const b = hud.querySelector('#smgBribe'); b.hidden = !R.scanning; if (R.scanning) { const pr = bribeQuote(); b.textContent = `💸${pr}`; }
}
function bribeQuote() { let p = null; try { const x = SSX().bribes?.price?.({ kind: 'spot', stars: Math.round(heat()) + 1 }); p = Number.isFinite(+x) ? Math.round(+x) : Number.isFinite(+x?.price) ? Math.round(+x.price) : null; } catch (e) { /* */ } return p ?? C.bribePrice(heat()); }

const subs = new Set();
function emit(ev) { for (const f of subs) { try { f(ev, api.state); } catch (e) { /* */ } } try { dispatchEvent(new CustomEvent('ssx:smuggle', { detail: { ev } })); } catch (e) { /* */ } }

function setup() {
  if (!document.body) return addEventListener('DOMContentLoaded', setup, { once: true });
  const st = document.createElement('style'); st.id = 'smgCss'; st.textContent = CSS; document.head.appendChild(st);
  dockButtons(); buildHud();
  addEventListener('keydown', e => {
    if (e.repeat || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    const r = R.run;
    if (e.code === C.RUN_KEY || e.code === C.FAVOR_KEY) {
      if (r?.phase === 'payout' && onMars()) { e.preventDefault(); payout(e.code === C.FAVOR_KEY ? 'favor' : 'cash'); return; }
      if (e.code === C.RUN_KEY && !r && onMars() && atPad()) { e.preventDefault(); start(); }
      return;
    }
    if (!r || !inSpace()) return; // B / X stay the stash / medkit on the surface
    if (e.code === C.BRIBE_KEY && R.scanning) { e.preventDefault(); bribe(); }
    else if (e.code === C.DUMP_KEY) { e.preventDefault(); dump(); }
  });
}
setup();

const api = {
  get state() { const r = R.run; return { run: r ? { ...r, cleared: [...R.cleared] } : null, saved: { ...S }, heat: heat(), heatVia: SSX().pursuit ? (C.HEAT_FNS.some(k => typeof SSX().pursuit[k] === 'function') ? 'pursuit' : 'pending') : 'local', heatFn: R.heatFn || null, pendingWanted: R.pendingWanted,
    scanning: R.scanning, scan: Object.fromEntries(Object.entries(R.sc).map(([k, v]) => [k, Math.round(v.v * 100) / 100])), interceptors: R.icp.length, locked: R.locked, why: why(), last: R.last || null, t: R.t }; },
  start, bribe, dump, payout, roll,
  on(fn) { if (typeof fn !== 'function') return () => {}; subs.add(fn); return () => subs.delete(fn); },
  // test/debug surface (Mars frame -> world placement)
  debug: {
    log: () => log.slice(), geo: () => { const g = geo(); return { ph: g.ph, bs: g.bs.map(b => ({ id: b.id, pos: b.pos, dir: b.dir })), mars: R.mp }; },
    freezeBeam(on = true) { R.freeze = on ? { t: R.t } : null; },
    forceRefuse(v = null) { R.forceRefuse = v; },
    place(pm, look) { const a = app(); if (!a?.rocket || !R.mp) return false; const w = add3(R.mp, pm); a.rocket.position.set(...w); if (look) { a.rocket.lookAt(new THREE.Vector3(...add3(R.mp, look))); a.rocket.rotateY(Math.PI); } a.camera?.position.copy(a.rocket.position).add(new THREE.Vector3(0, 3.5, 11).applyQuaternion(a.rocket.quaternion)); return true; },
    placeInBeam(id = 'kestrel', k = 12) { const g = geo(), b = g.bs.find(x => x.id === id) || g.bs[0]; return api.debug.place(add3(b.pos, b.dir.map(v => v * k)), b.pos); },
    placeAtPhobos(off = 4) { const g = geo(); return api.debug.place(add3(g.ph, [0, off, 0]), [0, 0, 0]); },
    placeNearMars(k = 30) { const g = geo(), n = C.norm(g.ph); return api.debug.place([n[0] * k, 2, n[2] * k], [0, 0, 0]); },
    applyPending: () => applyPending(), pending: () => R.pendingWanted,
    pause(v = true) { R.paused = !!v; }, flag: (id = 'kestrel') => flag(id), pauseDrop(v = true) { R.pauseDrop = !!v; }, hold: () => R.holdT,
    forceStart() { R.run = C.newRun(R.t); R.a0 = Math.random() * Math.PI * 2; R.sc = {}; R.cleared = new Set(); R.holdT = 0; clearIcp(); emit('start'); return true; },
    skipTo(ph) { if (R.run) { R.run.phase = ph; R.payT = 0; } }, cool() { R.cd = -1e9; }, setHp(v) { if (R.run) R.run.hp = v; },
    icp: () => R.icp.map(i => ({ p: i.p, lock: Math.round(i.lock.v * 100) / 100 })),
    pullIcp(k = 10) { const p = shipM(); if (!p) return; R.icp.forEach((i, n) => { i.p = add3(p, [k, 1 + n, 0]); }); },
    pullIcpBehind(k = 80) { const p = shipM(), a = app(); if (!p || !a?.rocket) return; const f = new THREE.Vector3(0, 0, -1).applyQuaternion(a.rocket.quaternion); R.icp.forEach((i, n) => { i.p = [p[0] - f.x * (k + 4 * n), p[1] - f.y * (k + 4 * n), p[2] - f.z * (k + 4 * n)]; }); },
    reset() { S = C.loadState(null); save(); clearIcp(); R.run = null; R.cd = -1e9; R.pendingWanted = 0; R.last = null; }
  }
};
window.__smuggle = api;
(function boot(n = 0) {
  if (!window.SSX || !window.__app) { if (n < 300) setTimeout(() => boot(n + 1), 200); return; }
  window.SSX.smuggle = api; requestAnimationFrame(t => { lastT = t; tick(t); });
})();
