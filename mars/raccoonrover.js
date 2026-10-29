// v7.5.3 Raccoon Rover (Pumpkin): a scrappy trash-panda junker parked in the Red Tape Flats junkyard, with a raccoon
// co-pilot (Rocket) who snarks, robs parked cars and dumpsters you crawl past, and pickpockets NPCs on command.
// Self-contained add-on: one <script type="module"> in index.html. Talks to the game only through window.__app,
// window.SSX (registerSurfaceTick, on, bark/registerBarks, garage, city, gravity?, airRoll?, jobs?) and world.js
// registerVehicle/districtsOf. Pure logic + numbers live in mars/raccooncore.js (unit-tested).
//
// window.SSX.raccoon (also window.__raccoon for tests)
//   state            -> { owned, how, garage, loot, picks, busts, cr, driving, near, pick, blocked }
//   buy()            -> { ok, msg }  1200 cr at the junkyard (on foot, next to it)
//   pickpocket()     -> { ok, msg }  send Rocket at the nearest NPC (key 5 or the 🦝 dock button)
//   on(fn)           -> unsubscribe; fn({ type: 'buy'|'steal'|'loot'|'pick'|'bark', ... })
// Buy or steal: getting in without paying is grand theft (heat via world.setWanted). Either way the ride is granted
// to the garage with SSX.garage.grantVehicle (feature-detected; stolen = noPlates). Loot and pickpocket pause while
// SSX.gravity.floating is true, indoors, during races and during jobs. SSX.gravity / SSX.airRoll are optional.
import * as THREE from 'three';
import { registerVehicle, districtsOf, VEHICLES } from '../world.js';
import * as RC from './raccooncore.js';

const app = () => window.__app;
const SSX = () => window.SSX || {};
const toast = (t, ms = 2400) => { try { app()?.toast?.(t, ms); } catch (e) { /* no toast */ } };
const builds = new Set(); // every built Raccoon Rover group (junkyard car, garage copies)
const subs = new Set(), barkLog = [];
const emit = ev => { for (const f of subs) { try { f(ev); } catch (e) { console.warn('raccoon on', e); } } };
let S = RC.loadState(null);
try { S = RC.loadState(localStorage.getItem(RC.SAVE_KEY)); } catch (e) { /* private mode */ }
const save = () => { try { localStorage.setItem(RC.SAVE_KEY, JSON.stringify(S)); } catch (e) { /* */ } };
const R = { t: 0, prevWanted: 0, prevCar: null, lastLoot: -1e9, seen: new Map(), barker: RC.createBarker(), stillT: 0, run: null, pickCd: -1e9,
  tc: null, dump: [], dumpScene: null, runner: null, hooked: { gravity: false, airRoll: false, bus: false }, near: null, ui: '' };

// ---------- the vehicle: a dented junk buggy from primitives ----------
let K = null;
function kit() {
  if (K) return K;
  const std = (c, o = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o }); m.userData.shared = true; return m; };
  const tail = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 64; const x = c.getContext('2d');
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#a7a9ae' : '#141416'; x.fillRect(0, i * 8, 4, 8); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const sale = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 256, 64); x.strokeStyle = '#fff'; x.lineWidth = 4; x.strokeRect(2, 2, 252, 60);
    x.fillStyle = '#fff'; x.font = '800 30px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(`🦝 ${RC.PRICE} CR`, 128, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  K = { rust: std(0x8a4a2a, { metalness: 0.4 }), olive: std(0x5d6b3a, { metalness: 0.3 }), grey: std(0x8c9096, { metalness: 0.6, roughness: 0.45 }),
    lid: std(0x6f7479, { metalness: 0.85, roughness: 0.4 }), mask: std(0x111114, { roughness: 0.4 }), fur: std(0x6e7078, { roughness: 0.95 }),
    belly: std(0xc9c6bd, { roughness: 1 }), tail: std(0xffffff, { map: tail, roughness: 0.9 }), eye: new THREE.MeshBasicMaterial({ color: 0xfff0b8 }),
    ring: new THREE.TorusGeometry(1, 0.12, 6, 14), cone: new THREE.ConeGeometry(1, 1, 8),
    sale: new THREE.SpriteMaterial({ map: sale, transparent: true, depthWrite: false }) };
  K.eye.userData.shared = true; K.ring.userData.shared = true; K.cone.userData.shared = true;
  return K;
}
// a little raccoon (co-pilot / runner): ~0.9 m tall when sitting
function raccoonFigure(mesh, Rg, k, s = 1) {
  const g = new THREE.Group(), m = (geo, mat, ...a) => { const o = mesh(geo, mat, ...a); g.add(o); return o; };
  m(Rg.sph, k.fur, 0, 0.32, 0, 0.3, 0.34, 0.26); m(Rg.sph, k.belly, 0, 0.3, -0.18, 0.18, 0.22, 0.1);
  m(Rg.sph, k.fur, 0, 0.78, -0.02, 0.22, 0.2, 0.2); m(Rg.sph, k.mask, 0, 0.8, -0.16, 0.2, 0.07, 0.1);
  m(Rg.sph, k.belly, 0, 0.72, -0.22, 0.08, 0.06, 0.08); m(Rg.sph, k.mask, 0, 0.73, -0.3, 0.035, 0.035, 0.035);
  for (const x of [-1, 1]) { const e = m(k.cone, k.fur, x * 0.13, 0.98, 0, 0.07, 0.14, 0.05); e.rotation.z = -x * 0.3; m(Rg.sph, k.eye, x * 0.08, 0.82, -0.2, 0.03, 0.03, 0.02); }
  const t = m(Rg.cyl, k.tail, 0, 0.3, 0.32, 0.09, 0.62, 0.09); t.rotation.x = 1.1;
  g.scale.setScalar(s); return g;
}
function builder({ R: Rg, mesh, build, sec }) {
  const v = build('buggy', sec), k = kit(), b = v.body, PI = Math.PI;
  const add = (g, m, ...a) => { const o = mesh(g, m, ...a); b.add(o); return o; };
  // mismatched panels: repaint the buggy tub panel by panel (rust nose, olive tail, grey door)
  let n = 0; if (!sec) b.traverse(o => { if (o.isMesh && o.material === Rg.paints.buggy) { o.material = [k.rust, k.olive, k.grey][n++ % 3]; } });
  const dent = add(Rg.box, k.olive, -0.86, 1.0, -0.5, 0.06, 0.36, 1.1); dent.rotation.y = 0.08; dent.rotation.z = 0.12; // bent side panel
  const patch = add(Rg.box, k.grey, 0.86, 0.95, 0.7, 0.06, 0.3, 0.8); patch.rotation.z = -0.15;
  for (const s of [-1, 1]) { const l = add(Rg.cyl, k.lid, s * 0.95, 1.05, 0.05, 0.5, 0.05, 0.5); l.rotation.z = PI / 2; l.rotation.x = s * 0.2; // bin-lid doors
    add(Rg.box, k.lid, s * 1.0, 1.05, 0.05, 0.05, 0.08, 0.3); }
  const roof = add(Rg.cyl, k.lid, 0.1, 2.38, 0.25, 0.75, 0.05, 0.75); roof.rotation.x = 0.06; roof.rotation.z = -0.05; // bin lid on the roll cage
  add(Rg.box, k.mask, 0, 1.15, -1.47, 1.3, 0.24, 0.08); // bandit-mask band across the nose
  for (const s of [-1, 1]) { add(Rg.sph, k.eye, s * 0.42, 1.15, -1.52, 0.16, 0.12, 0.06); add(k.ring, k.mask, s * 0.42, 1.15, -1.5, 0.19, 0.16, 0.19); }
  const ant = add(Rg.cyl, k.tail, -0.6, 2.4, 1.35, 0.07, 1.9, 0.07); ant.rotation.x = 0.28; ant.rotation.z = 0.1; // striped tail antenna
  add(Rg.sph, k.mask, -0.69, 3.3, 1.62, 0.13, 0.17, 0.13);
  const bump = add(Rg.cyl, k.grey, 0, 0.62, -1.75, 0.3, 1.6, 0.3); bump.rotation.z = PI / 2; bump.rotation.y = 0.07; // dented can bumper
  // the co-pilot rides shotgun (left seat; the driver seat is +x)
  const pilot = raccoonFigure(mesh, Rg, k, 1.05); pilot.name = 'rcnPilot'; pilot.position.set(-0.45, 1.05, 0.35); b.add(pilot);
  const sale = new THREE.Sprite(k.sale); sale.name = 'rcnSale'; sale.position.set(0, 3.9, 0); sale.scale.set(3.0, 0.75, 1); sale.visible = !S.owned; v.group.add(sale);
  v.group.userData.rcn = true; builds.add(v.group);
  return v;
}

// ---------- registration (runs at import) ----------
registerVehicle(RC.KIND, { ...RC.SPEC }, builder);
function ensureJunkyard() {
  try {
    const D = (districtsOf('Mars') || []).find(d => d.id === RC.DISTRICT); if (!D) return false;
    D.vehicles = D.vehicles || [];
    if (!D.vehicles.some(v => v[0] === RC.KIND)) D.vehicles.push([RC.KIND, RC.JUNKYARD[0], RC.JUNKYARD[1], RC.JUNK_YAW]);
    return true;
  } catch (e) { return false; }
}
if (!ensureJunkyard()) { let n = 0; const iv = setInterval(() => { if (ensureJunkyard() || ++n > 60) clearInterval(iv); }, 250); }
function registerLines() {
  const reg = SSX().registerBarks; if (typeof reg !== 'function' || R.linesIn) return !!R.linesIn;
  try { for (const [c, l] of Object.entries(RC.LINES)) reg(c, l); R.linesIn = true; } catch (e) { /* */ }
  return !!R.linesIn;
}

// ---------- co-pilot barks (SSX.bark, rate-limited; toast fallback) ----------
function bark(cat, force = false) {
  const now = R.t; if (!force && !R.barker.can(now, cat)) return null;
  const pool = RC.LINES[cat]; if (!pool) return null;
  R.barker.mark(now, cat);
  registerLines();
  const car = R.tc?.car, at = car ? { x: car.x, z: car.z } : R.tc?.player ? { x: R.tc.player.x, z: R.tc.player.z } : { x: 0, z: 0 };
  let line = null;
  try { line = SSX().bark?.({ x: at.x, z: at.z, kind: 'raccoon', name: RC.COPILOT }, cat, { force: true }) || null; } catch (e) { line = null; }
  if (line) { // pin Rocket's caption above the car (the bark layer would anchor it to a fixed ground point we drive away from)
    const els = [...document.querySelectorAll('.ssxBark')].filter(e => e.textContent === line); const el = els[els.length - 1];
    if (el) { document.querySelectorAll('.ssxBark.rcnBark').forEach(o => o.remove()); el.classList.add('rcnBark'); } // one Rocket caption at a time
  } else { line = pool[Math.floor(Math.random() * pool.length)]; toast(line, 2600); }
  barkLog.push({ t: now, cat, line, via: SSX().bark ? 'bark' : 'toast' }); if (barkLog.length > 60) barkLog.shift();
  emit({ type: 'bark', cat, line }); return line;
}
const aboard = () => R.tc?.car?.kind === RC.KIND;

// ---------- guards ----------
function raceOn(tc) {
  try { if (window.__race?.state) return true; if (window.SSX?.drag?.active?.() || window.__drag?.state || window.SSX?.race?.active?.()) return true; if (tc?.game?.mapGate?.()) return true; } catch (e) { /* */ }
  return false;
}
function jobOn() { try { const a = window.SSX?.jobs?.active?.(); return !!a; } catch (e) { return false; } }
function why(tc = R.tc) {
  return RC.blocked({ onMars: !!tc && tc.name === 'Mars' && !!app()?.state?.onSurface, inside: !!tc?.world?.inside, race: raceOn(tc), job: jobOn(), floating: !!window.SSX?.gravity?.floating });
}
const wanted = () => R.tc?.world?.wanted | 0;
function setWanted(n, reason) { try { const w = R.tc?.world; if (w?.setWanted) { w.setWanted(n, reason); return true; } SSX().city?.setWanted?.(n, reason); return true; } catch (e) { return false; } }

// ---------- garage ----------
function toGarage(stolen) {
  if (S.garage) return true;
  const G = SSX().garage;
  try {
    if (typeof G?.grantVehicle === 'function') { const r = G.grantVehicle(RC.KIND, { active: false, noPlates: !!stolen }); if (r?.ok) { S.garage = true; save(); return true; } if (r?.full) toast('🦝 Garage is full. Rocket will sleep in the car.', 2600); return false; }
    if (typeof SSX().registerDealerVehicle === 'function') { SSX().registerDealerVehicle(RC.KIND, { price: RC.PRICE, tier: 1, name: RC.SPEC.name, icon: '🦝', blurb: RC.SPEC.blurb }); }
  } catch (e) { console.warn('raccoon garage', e); }
  return false;
}
function own(how) {
  S.owned = true; S.how = how; save();
  for (const g of builds) { const s = g.getObjectByName('rcnSale'); if (s) s.visible = false; }
  toGarage(how === 'stole');
}

// ---------- buy / steal ----------
function nearJunker(tc = R.tc, r = 7.5) { // 7.5 m: a touch more than interact's 7 m reach
  if (!tc) return null; let best = null, bd = r;
  for (const g of builds) { if (!g.parent || g === tc.car?.group) continue; const d = Math.hypot(g.position.x - tc.player.x, g.position.z - tc.player.z); if (d < bd) { bd = d; best = g; } }
  return best;
}
function buy() {
  const tc = R.tc; if (S.owned) return { ok: false, msg: '🦝 Already yours. Rocket says no refunds.' };
  if (!tc || tc.car || !nearJunker(tc)) return { ok: false, msg: `🦝 Walk up to the junker in Red Tape Flats to buy it (${RC.PRICE} cr).` };
  const g = tc.game; if (!g?.spend?.(RC.PRICE)) return { ok: false, msg: `🦝 ${RC.PRICE} cr. You're short. Or just... take it.` };
  own('bought'); emit({ type: 'buy' }); bark('raccoon_buy', true);
  return { ok: true, msg: `🦝 Raccoon Rover bought for ${RC.PRICE} cr. It's in your garage. Rocket came with it.` };
}
function onEnter(car, tc) { // called once when you get into a Raccoon Rover
  const cur = tc.world?.wanted | 0, owned = S.owned || car === tc.rover;
  const target = RC.wantedOnEnter(owned, R.prevWanted, cur);
  if (target !== cur) setWanted(target, owned ? 'owner' : 'stole the Raccoon Rover');
  if (owned) { if (!car.rcnOwned && car !== tc.rover) { car.rcnOwned = true; const st = tc.game?.progress?.stats; if (st?.stolen > 0) st.stolen--; } toast('🦝 Your Raccoon Rover. Rocket is riding shotgun. Hold still for loot, 5 or 🦝 to pickpocket.', 3600); }
  else { own('stole'); emit({ type: 'steal', wanted: target }); toast(`🦝 Stole the Raccoon Rover. Heat ${target}★. It's in your garage now (no plates).`, 3600); bark('raccoon_steal', true); }
}

// ---------- loot: Rocket robs what you crawl past ----------
function lootTargets(tc) {
  const out = [];
  try { (tc.world?.debug?.vehicles?.() || []).forEach((v, i) => { if (v.parked && v.kind !== RC.KIND) out.push({ id: `car:${v.kind}:${Math.round(v.x)}:${Math.round(v.z)}`, x: v.x, z: v.z, kind: 'car', r: 1.2 }); }); } catch (e) { /* */ }
  for (const d of R.dump) out.push({ id: d.id, x: d.x, z: d.z, kind: 'dumpster', r: 0.8 });
  return out;
}
function lootTick(tc) {
  if (!aboard() || R.run || why(tc)) return;
  const t = RC.lootPick({ x: tc.car.x, z: tc.car.z, speed: tc.car.speed }, lootTargets(tc), R.seen, R.t, R.lastLoot); if (!t) return;
  doLoot(t, tc);
}
function doLoot(t, tc = R.tc) {
  R.seen.set(t.id, R.t); R.lastLoot = R.t;
  const L = RC.rollLoot(t.kind); S.loot++;
  if (L.credits) { tc.game?.reward?.(0, L.credits); S.cr += L.credits; }
  if (L.item) { const P = tc.game?.progress; if (P) { (P.raccoonStash ||= []).push(L.item); if (P.raccoonStash.length > 40) P.raccoonStash.shift(); tc.game?.reward?.(0, 0); } }
  save();
  const src = t.kind === 'car' ? 'a parked car' : 'a dumpster';
  let msg = `🦝 Rocket robbed ${src}: ${L.credits ? `+${L.credits} cr` : L.item}`;
  if (L.witness) { setWanted(RC.bump(wanted()), 'raccoon theft'); msg += '. Somebody saw. Heat!'; }
  toast(msg, 2600); bark('raccoon_loot', true);
  if (t.kind === 'dumpster') { const d = R.dump.find(x => x.id === t.id); if (d?.lid) { d.lid.rotation.x = -0.9; d.open = 3; } }
  emit({ type: 'loot', src: t.kind, id: t.id, credits: L.credits, item: L.item, witness: L.witness });
  return L;
}

// ---------- pickpocket ----------
function pilotGroup() { const g = R.tc?.car?.kind === RC.KIND ? R.tc.car.group : nearJunker(R.tc, RC.PICK.onFootR); return g || null; }
function pickpocket() {
  const tc = R.tc; if (!tc) return { ok: false, msg: '🦝 Land on Mars first.' };
  if (!S.owned) { if (!tc.car && nearJunker(tc)) return buy(); return { ok: false, msg: '🦝 You need the Raccoon Rover (Red Tape Flats junkyard).' }; }
  const w = why(tc); if (w) return { ok: false, msg: `🦝 Rocket stays put: ${w}.` };
  if (R.run) return { ok: false, msg: '🦝 Rocket is already out working.' };
  if (R.t - R.pickCd < RC.PICK.cd) return { ok: false, msg: `🦝 Rocket needs ${Math.ceil(RC.PICK.cd - (R.t - R.pickCd))} s to calm his tiny heart.` };
  const g = pilotGroup(); if (!g) return { ok: false, msg: '🦝 Get in (or stand next to) your Raccoon Rover.' };
  if (tc.car?.kind === RC.KIND && Math.abs(tc.car.speed || 0) > RC.PICK.maxSpeed) return { ok: false, msg: '🦝 Slow down. He jumps, he does not fly.' };
  let ps = []; try { ps = tc.world?.debug?.people?.() || []; } catch (e) { ps = []; }
  const tgt = RC.pickTarget(g.position.x, g.position.z, ps); if (!tgt) return { ok: false, msg: `🦝 Nobody worth robbing within ${RC.PICK.range} m.` };
  R.pickCd = R.t;
  R.run = { phase: 'out', i: tgt.i, kind: tgt.p.kind, name: tgt.p.name || tgt.p.kind, x: g.position.x, z: g.position.z, sx: g.position.x, sz: g.position.z, tx: tgt.p.x, tz: tgt.p.z, home: g, t: 0, res: null };
  runnerShow(true); pilotShow(false); bark('raccoon_pick_go', true);
  emit({ type: 'pick', phase: 'out', target: R.run.name, kind: R.run.kind });
  return { ok: true, msg: `🦝 Rocket is going for ${R.run.name}.` };
}
function pickTick(dt, tc) {
  const r = R.run; if (!r) return;
  r.t += dt;
  if (r.phase === 'out') { let ps = []; try { ps = tc.world?.debug?.people?.() || []; } catch (e) { ps = []; } const p = ps[r.i]; if (p && p.on !== false) { r.tx = p.x; r.tz = p.z; } }
  const home = r.home.parent ? r.home.position : { x: tc.player.x, z: tc.player.z };
  const [gx, gz] = r.phase === 'out' ? [r.tx, r.tz] : [home.x, home.z];
  const s = RC.stepToward(r.x, r.z, gx, gz, RC.PICK.runSpeed * (r.phase === 'back' && r.res && !r.res.ok ? 1.4 : 1), dt, r.phase === 'out' ? RC.PICK.grab : 1.2);
  r.x = s.x; r.z = s.z;
  if (r.t > 25 || Math.hypot(home.x - r.x, home.z - r.z) > 60) s.arrived = r.phase === 'back' ? true : s.arrived; // catches up if you drive off
  if (r.phase === 'out' && (s.arrived || r.t > 12)) {
    r.res = RC.rollPick(r.kind); r.phase = 'back'; S.picks++;
    if (r.res.ok) { tc.game?.reward?.(0, r.res.credits); S.cr += r.res.credits; toast(`🦝 Rocket lifted ${r.res.credits} cr off ${r.name}.`, 2600); bark('raccoon_pick_ok', true); }
    else { S.busts++; setWanted(RC.bump(wanted()), 'raccoon pickpocket'); toast(`🦝 ${r.name} caught Rocket! Heat +1. He's running back.`, 2800); bark('raccoon_pick_fail', true);
      try { SSX().bark?.(r.i, 'warn', { force: true }); } catch (e) { /* */ } }
    save(); emit({ type: 'pick', phase: 'result', ok: r.res.ok, credits: r.res.credits, target: r.name, kind: r.kind });
  } else if (r.phase === 'back' && (s.arrived || r.t > 30)) { R.run = null; runnerShow(false); pilotShow(true); emit({ type: 'pick', phase: 'home' }); return; }
  const m = R.runner; if (m) { const y = tc.height?.(r.x, r.z) ?? 0; m.position.set(r.x, y, r.z); m.rotation.y = Math.atan2(gx - r.x, gz - r.z) + Math.PI; m.children[0] && (m.position.y += Math.abs(Math.sin(r.t * 14)) * 0.12); }
}
function pilotShow(on) { for (const g of builds) { const p = g.getObjectByName('rcnPilot'); if (p) p.visible = on; } }
function runnerShow(on) {
  const tc = R.tc; if (!tc?.scene) return;
  if (!R.runner) { const k = kit(), mesh = (geo, mat, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy ?? sx, sz ?? sx); return o; };
    const Rg = { sph: new THREE.SphereGeometry(1, 10, 8), cyl: new THREE.CylinderGeometry(1, 1, 1, 8) };
    R.runner = raccoonFigure(mesh, Rg, k, 1.4); R.runner.name = 'rcnRunner'; }
  if (R.runner.parent !== tc.scene) tc.scene.add(R.runner);
  R.runner.visible = on;
}

// ---------- dumpsters (8 primitive bins; shared geometry) ----------
function buildDumpsters(tc) {
  const col = SSX().city?.colony?.(); if (!col || !tc.scene) return;
  if (R.dumpScene === tc.scene && R.dump.length) return;
  for (const d of R.dump) d.g.parent?.remove(d.g);
  R.dump = []; R.dumpScene = tc.scene;
  const k = kit(), box = new THREE.BoxGeometry(1, 1, 1), green = new THREE.MeshStandardMaterial({ color: 0x2f4a33, roughness: 0.8, metalness: 0.3 });
  for (const d of RC.DUMPSTERS) {
    let [x, z] = RC.aj2world(d.x, d.z, col); try { const q = tc.world?.freeSpot?.(x, z, 1.4); if (q) { x = q.x; z = q.z; } } catch (e) { /* */ }
    const g = new THREE.Group(), y = tc.height?.(x, z) ?? 0; g.position.set(x, y, z); g.rotation.y = (d.x * 7 + d.z) % 3;
    const body = new THREE.Mesh(box, green); body.scale.set(2.2, 1.3, 1.3); body.position.y = 0.65; g.add(body);
    const lid = new THREE.Mesh(box, k.lid); lid.scale.set(2.25, 0.08, 1.35); lid.position.set(0, 1.32, 0.65); const hinge = new THREE.Group(); hinge.position.set(0, 0, -0.65); hinge.add(lid); g.add(hinge);
    g.userData.v8 = { part: 'dumpster' }; tc.scene.add(g);
    R.dump.push({ id: 'dump:' + d.id, x, z, g, lid: hinge, open: 0 });
  }
}

// ---------- event hooks (all optional) ----------
function hookEvents() {
  const X = SSX();
  if (!R.hooked.bus && typeof X.on === 'function') {
    R.hooked.bus = true;
    X.on('game:crash', () => { if (aboard()) bark('raccoon_crash'); });
    X.on('game:stunt', ev => { if (!aboard()) return; if (ev?.bad) bark('raccoon_rollcrash'); else if (ev?.rolls) bark('raccoon_roll'); });
    X.on('game:down', ev => { if (/bust/i.test(ev?.why || '') && (aboard() || R.prevCar?.kind === RC.KIND)) bark('raccoon_caught', true); });
    X.on('game:wanted', ev => { if (aboard() && (ev?.stars | 0) > 0) bark('raccoon_heat'); });
  }
  if (!R.hooked.gravity && typeof X.gravity?.on === 'function') { R.hooked.gravity = true; try { X.gravity.on(e => { if (aboard()) bark(RC.gravityCat(e?.mode || X.gravity.mode)); }); } catch (e) { /* */ } }
  if (!R.hooked.airRoll && typeof X.airRoll?.on === 'function') { R.hooked.airRoll = true;
    try { X.airRoll.on('land', () => { if (aboard()) bark('raccoon_roll'); }); X.airRoll.on('crash', () => { if (aboard()) bark('raccoon_rollcrash'); }); } catch (e) { /* */ } }
}

// ---------- per-frame ----------
function tick(dt, tc) {
  R.tc = tc; R.t += dt; hookEvents();
  if (tc.name !== 'Mars') { R.near = null; ui(); return; }
  buildDumpsters(tc);
  const car = tc.car && tc.car.kind === RC.KIND ? tc.car : null;
  if (car && car !== R.prevCar) onEnter(car, tc);
  if (!tc.car) R.prevWanted = tc.world?.wanted | 0;
  R.prevCar = tc.car || null;
  for (const d of R.dump) if (d.open > 0) { d.open -= dt; if (d.open <= 0) d.lid.rotation.x = 0; }
  if (car) { // idle snark
    if (Math.abs(car.speed || 0) < 0.4) { R.stillT += dt; if (R.stillT > RC.BARK.idleAfter) { R.stillT = 0; bark('raccoon_idle'); } } else R.stillT = 0;
  } else R.stillT = 0;
  lootTick(tc); pickTick(dt, tc);
  R.near = !tc.car && !tc.world?.inside ? nearJunker(tc, S.owned ? RC.PICK.onFootR : 7.5) : null;
  if (R.near && !S.owned && !R.hinted) { R.hinted = true; toast(`🦝 Raccoon Rover: ${RC.PRICE} cr. Tap 🦝 BUY (or press 5). Or just steal it.`, 4200); }
  ui();
}

// ---------- UI: one dock button (🦝 BUY / PICK), key 5. Black and white, only shown when it does something ----------
const CSS = `#dockRcn{order:6}
.ssxBark.rcnBark{left:50%!important;top:calc(26% + env(safe-area-inset-top))!important;transform:translate(-50%,0)!important;opacity:1!important;background:#000!important;color:#fff!important;border:2px solid #fff!important}`;
let dockBtn = null;
function tap(el, fn) { (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, fn); }
function act() { const r = pickpocket(); if (r?.msg) toast(r.msg, r.ok ? 2000 : 2600); return r; }
function dockButton() {
  const attach = () => {
    const d = document.getElementById('ssxDock'); if (!d) return false;
    let b = document.getElementById('dockRcn'); if (b) { dockBtn = b; return true; }
    b = document.createElement('button'); b.id = 'dockRcn'; b.type = 'button'; b.style.order = '6'; b.style.display = 'none'; d.appendChild(b); tap(b, act); dockBtn = b; R.ui = ''; return true;
  };
  if (attach()) return;
  try { const mo = new MutationObserver(() => { if (attach()) mo.disconnect(); }); mo.observe(document.body, { childList: true }); } catch (e) { /* no dock: key 5 only */ }
}
function ui() {
  if (!dockBtn) return;
  const tc = R.tc, mars = tc?.name === 'Mars' && app()?.state?.onSurface;
  const mode = !mars ? '' : (!S.owned && R.near) ? 'buy' : (S.owned && (aboard() || R.near)) ? 'pick' : '';
  const k = mode + (R.run ? 'r' : '');
  if (k === R.ui) return; R.ui = k;
  dockBtn.style.display = mode ? '' : 'none';
  dockBtn.textContent = mode === 'buy' ? `🦝\nBUY ${RC.PRICE}` : R.run ? '🦝\nOUT' : '🦝\nPICK';
  dockBtn.setAttribute('aria-label', mode === 'buy' ? `Buy the Raccoon Rover for ${RC.PRICE} credits (5)` : 'Send Rocket to pickpocket the nearest person (5)');
}
function setup() {
  if (!document.body) return addEventListener('DOMContentLoaded', setup, { once: true });
  const st = document.createElement('style'); st.id = 'rcnCss'; st.textContent = CSS; document.head.appendChild(st);
  dockButton();
  addEventListener('keydown', e => {
    if (e.code !== RC.PICK_KEY || e.repeat || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    if (!app()?.state?.onSurface || window.__race?.builder?.open || document.body.classList.contains('danger-standoff')) return;
    if (!S.owned && !R.near) return; // nothing to do: leave the key alone
    e.preventDefault(); act();
  });
}
setup();

const api = {
  get state() { return { ...S, driving: aboard(), near: !!R.near, pick: R.run ? { phase: R.run.phase, target: R.run.name, x: R.run.x, z: R.run.z, out: Math.hypot(R.run.x - R.run.sx, R.run.z - R.run.sz) } : null, blocked: why(), t: R.t }; },
  buy, pickpocket,
  on(fn) { if (typeof fn !== 'function') return () => {}; subs.add(fn); return () => subs.delete(fn); },
  kind: RC.KIND, price: RC.PRICE,
  // test/debug surface
  debug: { barks: () => barkLog.slice(), dumpsters: () => R.dump.map(d => ({ id: d.id, x: d.x, z: d.z })), junkers: () => [...builds].filter(g => g.parent).map(g => ({ x: g.position.x, z: g.position.z, sale: !!g.getObjectByName('rcnSale')?.visible })),
    junkAJ: RC.junkAJ, pilots: () => [...builds].filter(g => g.parent).map(g => !!g.getObjectByName('rcnPilot')?.visible), bark: (cat) => bark(cat, true), loot: (kind = 'dumpster') => doLoot({ id: 'debug:' + R.t, kind }), reset() { S = RC.loadState(null); save(); R.seen.clear(); R.lastLoot = -1e9; R.pickCd = -1e9; R.barker.reset(); for (const g of builds) { const s = g.getObjectByName('rcnSale'); if (s) s.visible = true; } },
    cool() { R.pickCd = -1e9; R.lastLoot = -1e9; R.barker.reset(); }, why: () => why(), vehicleSpec: () => VEHICLES[RC.KIND] }
};
window.__raccoon = api;
(function boot(n = 0) { // like jobs.js: index.html builds window.SSX + window.__app in its main module, then we attach
  if (!window.SSX?.registerSurfaceTick || !window.__app) { if (n < 300) setTimeout(() => boot(n + 1), 200); return; }
  window.SSX.raccoon = api; window.SSX.registerSurfaceTick(tick); registerLines();
})();
