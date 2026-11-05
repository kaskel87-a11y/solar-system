// The sandworm (window.SSX.sandworm). Rules + numbers: mars/sandwormcore.js. The fight follows the mission script in
// /workspace/story/worm-mission.md: Tully radios in, phase 1 dust plumes (shoot or tap the plume head: 3 surfacings), phase 2 the
// 40 m worm with a ringed, toothy maw (pop 4 glowing gill sacs, dodge lunges + acid spit, it eats a plot every 20 s), phase 3 it
// dives and charges the silo (ram it with a rover or the harvester, or torch it with the flamethrower, to stun it, then shoot
// the open maw). Win: 1,500 cr + 150 ⭐ + a Worm Tooth (Sister Nettle buys it in the Hydro Den for 800 cr); eaten plots regrow
// the next game day. Lose: it eats half the farm (never more) and goes back under.
// Trigger: at most once per 3 in-game days at the farm (random), the story start after your 2nd harvest, or SSX.sandworm.spawn().
// Never in the Rust Pit, in custody/jail, during fast travel or off Mars. Farms: SSX.farm (racks; ripe ones are cut via
// farm.cut, growing ones chewed through a guarded SSX.harvest.cropLeft wrap) and SSX.farm2 if present (damage/restore).
// Low poly: ~30 meshes + one pooled InstancedMesh for dust/goo/acid. Save: ssx.sandworm.v1. Fiction only.
import * as THREE from 'three';
import * as K from './sandwormcore.js';
import { getAudioCtx, realDest } from '../audioctx.js';

const app = () => window.__app, surf = () => app()?.surface, game = () => app()?.game || surf()?.game, world = () => surf()?.world;
const FARM = () => window.SSX?.farm, FARM2 = () => window.SSX?.farm2;
const fin = Number.isFinite, TAU = Math.PI * 2;
let S = K.fresh();
try { S = K.migrate(localStorage.getItem(K.SAVE_KEY)); } catch (e) { /* private mode */ }
let saveErr = null;
function save() { try { localStorage.setItem(K.SAVE_KEY, JSON.stringify(S)); saveErr = null; } catch (e) { saveErr = String(e?.name || e); } }
const subs = new Set();
function emit(type, ev = {}) { const e = { type, ...ev }; for (const f of subs) { try { f(e); } catch (x) { console.warn('sandworm on', x); } } try { window.dispatchEvent(new CustomEvent('ssx:sandworm', { detail: e })); } catch (x) { /* */ } return e; }
function toast(m, ms = 3200) { try { app()?.toast?.(m, ms); } catch (e) { /* */ } }
const AG = K.makeActGuard(() => performance.now());
let rng = Math.random, noRandom = false;

// ---------- where things are ----------
function colony() { const c = surf()?.info?.colony || world()?.colony; return c && fin(c.x) && fin(c.z) ? c : null; }
const onMars = () => surf()?.info?.name === 'Mars' && !!colony() && !!app()?.state?.onSurface;
const me = () => { const i = surf()?.info; return i && fin(i.x) && fin(i.z) ? i : null; };
const d2 = (a, b) => (a && b ? Math.hypot(a.x - b.x, a.z - b.z) : Infinity);
function inPit() { try { return !!FARM()?.debug?.inPit?.(); } catch (e) { return false; } }
let lastTc = null;
function ground(x, z) { try { const h = lastTc?.height?.(x, z); if (fin(h)) return h; } catch (e) { /* */ } try { const h = FARM()?.debug?.ground?.(x, z); if (fin(h)) return h; } catch (e) { /* */ } return 0; }
function custody() { try { const c = window.SSX?.consequences?.status?.(); return !!(c && (c.custody || c.jail)); } catch (e) { return false; } }
function blocked() {
  if (!onMars()) return 'off';
  if (inPit()) return 'pit';
  if (custody()) return 'jail';
  if (window.SSX?.fastTravel?.busy) return 'travel';
  if (app()?.state?.flying && !app()?.state?.onSurface) return 'flying';
  return null;
}
function day() { try { const c = FARM()?.clock?.(); if (fin(c?.day)) return c.day; if (fin(c?.hours)) return Math.floor(c.hours / 24); } catch (e) { /* */ } return Math.floor(performance.now() / 1440000); }

// ---------- farms (both guarded) ----------
function farm1() {
  const F = FARM(); if (!F?.status || !F.places) return null;
  let st = null; try { st = F.status(); } catch (e) { return null; } if (!st?.owned) return null;
  const pl = F.places().find(p => p.id === 'farm'); if (!pl || !fin(pl.x)) return null;
  const canChew = typeof window.SSX?.harvest?.cropLeft === 'function';
  let racks = []; try { racks = F.rackSpots() || []; } catch (e) { racks = []; }
  const plots = racks.filter(r => r.crop && (r.ripe || canChew)).filter(r => !chewed.has(r.i + ':' + r.planted))
    .map(r => ({ key: 'farm:' + r.i, farm: 'farm', i: r.i, x: r.x, z: r.z, crop: r.crop, ripe: r.ripe ? 1 : 0, planted: r.planted }));
  return { id: 'farm', name: pl.name || 'the homestead', c: { x: pl.x, z: pl.z }, silo: { x: pl.x + 8.4, z: pl.z - 5.2 }, plots, total: racks.filter(r => r.crop).length };
}
function farm2() {
  const F = FARM2(); if (!F?.status || !F.plots) return null;
  let st = null; try { st = F.status(); } catch (e) { return null; } if (!st?.owned || !st.site) return null;
  let rows = []; try { rows = F.plots() || []; } catch (e) { rows = []; }
  const plots = rows.filter(r => r.crop).map(r => ({ key: 'farm2:' + r.id, farm: 'farm2', id: r.id, x: r.x, z: r.z, crop: r.crop, ripe: r.ripe ? 1 : 0 }));
  return { id: 'farm2', name: F.SITE?.name || 'the grow op', c: { x: st.site.x, z: st.site.z }, silo: { x: st.site.x - 7, z: st.site.z - 9 }, plots, total: plots.length };
}
function farms() { return [farm1(), farm2()].filter(Boolean); }
function farmById(id) { return id === 'farm2' ? farm2() : farm1(); }
function nearestFarm(p, r = K.TUNE.atFarmR) { let best = null, bd = r; for (const f of farms()) { const d = d2(p, f.c); if (d < bd) { bd = d; best = f; } } return best; }

// growing farm racks: chewed down to stubble (a guarded wrap of SSX.harvest.cropLeft; the farm's own save is untouched)
const chewed = new Set();
let wrapped = null;
function wrapCropLeft() {
  const H = window.SSX?.harvest; if (!H || typeof H.cropLeft !== 'function' || H.cropLeft === wrapped) return !!H && H.cropLeft === wrapped;
  const orig = H.cropLeft; wrapped = (k, r) => (r && chewed.has(k + ':' + r.planted) ? 0 : orig(k, r)); H.cropLeft = wrapped; return true;
}
function redrawFarm() { try { FARM()?.redraw?.(); } catch (e) { /* */ } }
function eatPlot(p) {
  const rec = { farm: p.farm, key: p.key, crop: p.crop, day: day(), fight: S.stats.spawns };
  if (p.farm === 'farm2') { let r = null; try { r = FARM2()?.damage?.(p.id); } catch (e) { r = null; } if (!r?.ok) return null; Object.assign(rec, { kind: 'f2', id: p.id, snap: r.snap }); }
  else if (p.ripe) { let r = null; try { r = FARM()?.cut?.(p.i, { hand: true, via: 'worm', planted: p.planted }); } catch (e) { r = null; } if (!r?.ok) return null; Object.assign(rec, { kind: 'cut', i: p.i }); }
  else { if (!wrapCropLeft()) return null; chewed.add(p.i + ':' + p.planted); Object.assign(rec, { kind: 'chew', i: p.i, planted: p.planted }); redrawFarm(); }
  S.eaten.push(rec); S.stats.eaten++; save(); emit('eat', { farm: p.farm, key: p.key, crop: p.crop, kind: rec.kind });
  return rec;
}
// next game day: eaten plots regrow (after a win; chewed growing racks always grow back)
let regrowT = 0;
function regrow(force) {
  const dd = day(); let n = 0;
  for (const e of K.due(S, force ? Infinity : dd).slice()) {
    let done = false;
    if (e.kind === 'chew') { chewed.delete(e.i + ':' + e.planted); redrawFarm(); done = true; }
    else if (e.kind === 'f2') { try { done = !!FARM2()?.restore?.(e.id, e.snap)?.ok; } catch (x) { done = false; } if (!done) done = !FARM2(); }
    else if (e.kind === 'cut') {
      const F = FARM(); if (!F) { done = true; } else {
        const r = (F.debug?.state?.().racks || [])[e.i]; if (r && r.crop) done = true; // the rack's been replanted already
        else { const c0 = game()?.progress?.credits | 0; let res = null; try { res = F.plant(e.i, e.crop); } catch (x) { res = null; }
          if (res?.ok) { const cost = res.cost | 0; if (cost > 0 && game()?.progress) { game().progress.credits += cost; try { game().save(); } catch (x) { /* */ } } done = true; }
          else if ((game()?.progress?.credits | 0) !== c0) done = true; }
      }
    }
    if (done) { S.eaten.splice(S.eaten.indexOf(e), 1); n++; }
  }
  if (n) { save(); emit('regrow', { n }); }
  return n;
}

// ---------- audio: a low rumble (shared AudioContext, guarded) ----------
function rumble(sec = 1.2, vol = 0.5) {
  try {
    const a = getAudioCtx(); if (!a || a.state !== 'running') return; const t = a.currentTime;
    const o = a.createOscillator(), o2 = a.createOscillator(), g = a.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(38, t); o.frequency.linearRampToValueAtTime(26, t + sec);
    o2.type = 'square'; o2.frequency.setValueAtTime(53, t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18 * vol, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + sec);
    o.connect(g); o2.connect(g); g.connect(realDest(a)); o.start(t); o2.start(t); o.stop(t + sec + 0.05); o2.stop(t + sec + 0.05);
  } catch (e) { /* no audio */ }
}

// ---------- visuals ----------
const SEG = 14;
let root = null, segs = [], head = null, maw = null, sacMesh = [], plume = null, ring = null, globs = [], parts = null, inScene = null;
const PN = 200, pp = []; let pHead = 0;
const M = {};
function build() {
  if (root) return root;
  root = new THREE.Group(); root.name = 'sandworm'; root.visible = false;
  M.skin = new THREE.MeshStandardMaterial({ color: 0x9a6f52, roughness: 0.9, flatShading: true });
  M.band = new THREE.MeshStandardMaterial({ color: 0x5e3a2a, roughness: 0.95, flatShading: true });
  M.tooth = new THREE.MeshStandardMaterial({ color: 0xece2c2, roughness: 0.5, flatShading: true });
  M.gum = new THREE.MeshStandardMaterial({ color: 0x8a1a1a, emissive: 0x4a0606, roughness: 0.6, side: THREE.DoubleSide });
  M.sac = new THREE.MeshStandardMaterial({ color: 0xffc23a, emissive: 0xffa21a, emissiveIntensity: 0.9, roughness: 0.4 });
  M.dust = new THREE.MeshStandardMaterial({ color: 0xb07850, roughness: 1, flatShading: true });
  M.acid = new THREE.MeshBasicMaterial({ color: 0x9cff3a });
  const segG = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < SEG; i++) { const m = new THREE.Mesh(segG, i % 2 ? M.band : M.skin); m.name = 'worm-seg'; root.add(m); segs.push(m); }
  head = new THREE.Group(); head.name = 'worm-head';
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.5, 2.4, 10, 1, true), M.skin); lip.rotation.x = Math.PI / 2; head.add(lip);
  maw = new THREE.Mesh(new THREE.CircleGeometry(1.9, 10), M.gum); maw.position.z = 0.2; head.add(maw);
  const toothG = new THREE.ConeGeometry(0.24, 1.0, 4);
  for (const [n, r, z, len] of [[14, 1.95, 1.05, 1], [9, 1.25, 0.6, 0.8]]) for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU, t = new THREE.Mesh(toothG, M.tooth); t.scale.setScalar(len);
    t.position.set(Math.cos(a) * r, Math.sin(a) * r, z); t.lookAt(0, 0, z + 0.35); t.rotateX(Math.PI / 2); head.add(t);
  }
  root.add(head);
  const sacG = new THREE.SphereGeometry(0.8, 8, 6);
  for (let i = 0; i < K.TUNE.sacs; i++) { const m = new THREE.Mesh(sacG, M.sac); m.name = 'worm-sac'; root.add(m); sacMesh.push(m); }
  plume = new THREE.Group(); plume.name = 'worm-plume';
  const mound = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.5, 7), M.dust); mound.position.y = 0.4; plume.add(mound);
  const cloud = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0), new THREE.MeshStandardMaterial({ color: 0xc89064, transparent: true, opacity: 0.55, flatShading: true })); cloud.position.y = 1.9; cloud.name = 'plume-cloud'; plume.add(cloud);
  root.add(plume);
  ring = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.7, 5, 10), M.dust); ring.rotation.x = Math.PI / 2; root.add(ring);
  const gG = new THREE.SphereGeometry(0.45, 6, 4);
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(gG, M.acid); m.visible = false; root.add(m); globs.push({ m, on: false }); }
  parts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff }), PN); parts.name = 'worm-parts';
  parts.instanceMatrix.setUsage(THREE.DynamicDrawUsage); parts.frustumCulled = false;
  const col = new THREE.Color(); for (let i = 0; i < PN; i++) { pp.push({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, s: 1 }); parts.setColorAt(i, col.set(0xb07850)); }
  root.add(parts);
  return root;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
function burst(x, y, z, n, color, speed = 5, up = 4, size = 1) {
  if (!parts) return;
  for (let k = 0; k < n; k++) {
    const i = pHead; pHead = (pHead + 1) % PN; const p = pp[i], a = rng() * TAU, v = speed * (0.4 + rng() * 0.6);
    p.x = x; p.y = y; p.z = z; p.vx = Math.cos(a) * v; p.vz = Math.sin(a) * v; p.vy = up * (0.5 + rng()); p.life = 0.8 + rng() * 0.8; p.s = size * (0.6 + rng() * 0.8);
    parts.setColorAt(i, _c.set(color));
  }
  if (parts.instanceColor) parts.instanceColor.needsUpdate = true;
}
function partsTick(dt) {
  if (!parts) return; let any = false;
  for (let i = 0; i < PN; i++) {
    const p = pp[i];
    if (p.life > 0) { p.life -= dt; p.vy -= 12 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const g = ground(p.x, p.z); if (p.y < g) { p.y = g; p.vy *= -0.2; p.vx *= 0.6; p.vz *= 0.6; } any = true; }
    const s = p.life > 0 ? p.s * Math.min(1, p.life * 2) : 0; _s.set(s, s, s); _p.set(p.x, p.y, p.z); _m.compose(_p, _q, _s); parts.setMatrixAt(i, _m);
  }
  parts.instanceMatrix.needsUpdate = true; parts.visible = any || !!fight;
}

// ---------- the fight ----------
let fight = null; // { f (core), farm, eatenKeys, plume {x,z,a,R}, base, headAt, pose, lunge, glob, dive, t, ... }
let shake = 0, lineT = 0, line = '';
function say(txt, sec = 5) { line = txt; lineT = sec; }
function spawn(o = {}) {
  return AG.run('spawn', () => {
    if (fight?.done) { fight = null; if (root) root.visible = false; }
    if (fight) return { ok: false, why: 'busy', msg: 'The worm is already here.' };
    const b = blocked(); if (b) return { ok: false, why: b, msg: b === 'pit' ? 'Not in the Rust Pit.' : 'Not now.' };
    const p = me(); const fm = o.farm ? farmById(o.farm) : nearestFarm(p, o.anywhere ? Infinity : K.TUNE.atFarmR);
    if (!fm) return { ok: false, why: 'farm', msg: 'Go to your farm first.' };
    if (!o.anywhere && d2(p, fm.c) > K.TUNE.atFarmR) return { ok: false, why: 'far', msg: 'Go to your farm first.' };
    if (!fm.plots.length) return { ok: false, why: 'empty', msg: 'Nothing planted for it to eat.' };
    build(); S.stats.spawns++; S.lastDay = day(); save();
    const f = K.newFight(Math.max(fm.total, fm.plots.length));
    fight = { f, farm: fm.id, c: fm.c, silo: fm.silo, eatenKeys: new Set(), t: 0, plume: { a: rng() * TAU, x: fm.c.x, z: fm.c.z }, base: null, pose: 'under', poseT: 0,
      lunge: null, dive: 0, breach: 0, charge: null, deathT: 0, why: o.why || 'spawn', hitT: 0 };
    say(`📻 ${K.WHO}: \u201c${K.LINES.intro}\u201d`, 6); shake = 0.6; rumble(2, 0.8);
    emit('spawn', { farm: fm.id, why: fight.why }); refreshUi(true);
    return { ok: true, farm: fm.id, cap: f.cap };
  });
}
function edible() { const fm = farmById(fight.farm); return fm ? fm.plots.filter(p => !fight.eatenKeys.has(p.key)) : []; }
function eatNext(from) {
  if (!fight || fight.done || fight.f.over) return null;
  const p = K.pickPlot(edible(), fight.eatenKeys, from); if (!p) return null;
  const rec = eatPlot(p); fight.eatenKeys.add(p.key);
  if (rec) { burst(p.x, ground(p.x, p.z) + 1, p.z, 22, 0x6e8a2a, 5, 6); burst(p.x, ground(p.x, p.z) + 0.5, p.z, 14, 0xb07850, 6, 4); shake = Math.max(shake, 0.5); rumble(1, 0.7);
    say('It ate a rack!', 2.5); if (K.ate(fight.f) === 'lose') end('lose'); }
  return p;
}
function end(how) {
  if (!fight) return;
  const f = fight.f; if (!f.over) f.over = how === 'win' ? 'win' : 'lose';
  if (how === 'win') {
    const pay = K.payout(S); const g = game();
    if (g?.progress) { g.progress.credits += pay.cr; g.progress.xp = (+g.progress.xp || 0) + pay.stars * K.STAR_RATE; try { g.save(); } catch (e) { /* */ } }
    say(`📻 ${K.WHO}: \u201c${K.LINES.win}\u201d <small>+${pay.cr.toLocaleString()} cr · +${pay.stars} ⭐ · 🦷 Worm Tooth</small>`, 7);
  } else if (how === 'lose') say(`📻 ${K.WHO}: \u201c${K.LINES.lose}\u201d`, 7);
  else say('The worm went back under.', 4);
  K.finish(S, f, day()); save();
  emit('end', { how, eaten: f.eaten, teeth: S.teeth });
  fight.done = how; fight.doneT = how === 'win' ? 2.8 : 1.4; // death / dive animation, then gone
}

// world positions for weak points (filled by pose())
const wp = { plume: null, sacs: [], maw: null, segs: [] };
function plumeHead() { return fight && fight.f.phase === K.P.PLUMES && fight.pose === 'under' ? wp.plume : null; }

function tickFight(dt, tc) {
  const F = fight, f = F.f; F.t += dt;
  const p = me(); const pg = p ? { x: p.x, y: ground(p.x, p.z), z: p.z } : null;
  if (F.done) { F.doneT -= dt; deathTick(dt); if (F.doneT <= 0) { fight = null; root.visible = false; try { window.SSX?.minimap?.addMarks?.('sandworm', []); } catch (e) { /* */ } refreshUi(true); } return; }
  const b = blocked(); if (b || (p && d2(p, F.c) > K.TUNE.leaveR)) { end('away'); return; }
  // --- phase 1: dust plumes ---
  if (f.phase === K.P.PLUMES) {
    if (F.pose === 'breach') { F.poseT -= dt; poseWorm(F.base, 7 + 3 * Math.sin(Math.min(1, (1.6 - F.poseT) / 0.4) * Math.PI / 2), pg, 0); if (F.poseT <= 0) { F.pose = 'under'; if (f.phase !== K.P.PLUMES) startSacs(); } return; }
    const R = 9 + 5 * Math.sin(F.t * 0.7); F.plume.a += (4.2 / R) * dt; F.plume.x = F.c.x + Math.cos(F.plume.a) * R; F.plume.z = F.c.z + Math.sin(F.plume.a) * R;
    showPlume(F.plume.x, F.plume.z, dt);
    f.autoT -= dt;
    if (f.autoT <= 0) { // it surfaces on its own and eats a plot
      const q = eatNext(F.plume); breachAt(q || F.plume); K.surface(f); if (f.over) return;
    }
    shake = Math.max(shake, Math.max(0, 0.35 - d2(p, F.plume) / 60));
    return;
  }
  // --- phase 2: the worm stands; pop the sacs ---
  if (f.phase === K.P.SACS) {
    if (F.dive > 0) { F.dive -= dt; const k = Math.max(0, F.dive / 0.8); poseWorm(F.base, 8 * k, pg, 0); if (F.dive <= 0) { const q = eatNext(F.base); if (f.over) return; F.base = spotNear(q || F.base); F.breach = 0.8; burst(F.base.x, ground(F.base.x, F.base.z), F.base.z, 24, 0xb07850, 7, 6); shake = 0.7; } return; }
    if (F.breach > 0) { F.breach -= dt; poseWorm(F.base, 8 * (1 - F.breach / 0.8), pg, 0); return; }
    f.eatT -= dt; if (f.eatT <= 0) { f.eatT = K.TUNE.eatEveryS; F.dive = 0.8; F.lunge = null; rumble(1.2, 0.7); return; }
    // lunge: rear back (wind-up), strike where you stood
    let reach = 0;
    if (!F.lunge) { f.lungeT -= dt; if (f.lungeT <= 0 && pg && d2(pg, F.base) < 22) { F.lunge = { t: 0, at: { x: pg.x, z: pg.z } }; say('It\u2019s rearing up: move!', 1.2); } }
    if (F.lunge) {
      const L = F.lunge; L.t += dt; const W = K.TUNE.lungeWindS;
      if (L.t < W) reach = -0.25 * (L.t / W); else if (L.t < W + 0.35) reach = (L.t - W) / 0.35; else if (L.t < W + 1.0) reach = 1 - (L.t - W - 0.35) / 0.65; else { F.lunge = null; f.lungeT = K.TUNE.lungeEveryS; }
      if (!L.hit && L.t >= W + 0.33) { L.hit = true; const gy = ground(L.at.x, L.at.z); burst(L.at.x, gy, L.at.z, 18, 0xb07850, 7, 5); shake = 0.8; if (pg && d2(pg, L.at) < K.TUNE.lungeR) hurt(K.TUNE.lungeDmg); }
    }
    poseWorm(F.base, 8, pg, reach, F.lunge?.at);
    // acid spit
    f.spitT -= dt; if (f.spitT <= 0 && pg && !F.lunge) { f.spitT = K.TUNE.spitEveryS; spit(pg); }
    globTick(dt, pg);
    return;
  }
  // --- phase 3: dive and charge the silo; stun it, shoot the maw ---
  if (f.stun > 0) {
    f.stun -= dt; poseWorm(F.base, 5, pg, 0, null, true); globTick(dt, pg);
    if (f.stun <= 0) { F.charge = null; say('It shook it off!', 2); }
    return;
  }
  if (!F.charge) newCharge();
  const C = F.charge; const dx = F.silo.x - C.x, dz = F.silo.z - C.z, dd = Math.hypot(dx, dz);
  if (dd < 2.5) { // it hit the silo: eats a plot, comes round again
    burst(F.silo.x, ground(F.silo.x, F.silo.z) + 1, F.silo.z, 30, 0xb07850, 9, 7); shake = 1; rumble(1.5, 1); say('It slammed the silo!', 2.5);
    eatNext(F.silo); F.charge = null; return;
  }
  const v = K.TUNE.chargeSpeed * dt; C.x += dx / dd * v; C.z += dz / dd * v;
  F.base = { x: C.x, z: C.z }; showPlume(C.x, C.z, dt, 1.5); poseWorm(null);
  shake = Math.max(shake, Math.max(0.1, 0.6 - d2(p, C) / 50));
  // ram: rover / harvester / any car
  const car = tc.car; if (car && fin(car.x) && d2(car, C) < K.TUNE.ramR && K.ram(f, car.speed || 0)) { car.speed = -(car.speed || 0) * 0.3; onStun('ram'); return; }
  // flamethrower cone on the plume head
  if (flameAt(C, tc)) { if (K.flameOn(f, dt)) onStun('flame'); else if (rng() < 0.3) burst(C.x, ground(C.x, C.z) + 1, C.z, 1, 0xff7a1a, 2, 3); }
}
function startSacs() { const F = fight; const q = K.pickPlot(edible(), F.eatenKeys, me()); F.base = spotNear(q || F.plume); F.breach = 0.8; rumble(2, 1); shake = 0.9; say('There it is! Shoot the glowing gill sacs!', 4); burst(F.base.x, ground(F.base.x, F.base.z), F.base.z, 30, 0xb07850, 8, 7); }
function breachAt(at) { const F = fight; F.base = { x: at.x, z: at.z }; F.pose = 'breach'; F.poseT = 1.6; burst(at.x, ground(at.x, at.z), at.z, 26, 0xb07850, 7, 7); shake = 0.7; rumble(1.2, 0.8); }
function spotNear(q) { const F = fight; const a = Math.atan2(q.z - F.c.z, q.x - F.c.x); return { x: q.x + Math.cos(a) * 2, z: q.z + Math.sin(a) * 2 }; }
function newCharge() { const F = fight; const a = rng() * TAU; F.charge = { x: F.silo.x + Math.cos(a) * K.TUNE.chargeFrom, z: F.silo.z + Math.sin(a) * K.TUNE.chargeFrom }; F.base = { x: F.charge.x, z: F.charge.z }; rumble(2.5, 1); say('It dove! It\u2019s charging the silo!', 3); }
function onStun(how) { const F = fight; F.base = { x: F.charge.x, z: F.charge.z }; burst(F.base.x, ground(F.base.x, F.base.z) + 1, F.base.z, 30, how === 'flame' ? 0xff7a1a : 0xb07850, 8, 7); shake = 1; rumble(1.4, 1); say(how === 'ram' ? 'Rammed! Shoot the open mouth!' : 'Torched! Shoot the open mouth!', 3); emit('stun', { how }); }
function flameAt(C, tc) {
  let st = null; try { st = window.SSX?.flame?.state?.(); } catch (e) { st = null; } if (!st?.firing) return false;
  const p = me(); if (!p || d2(p, C) > K.TUNE.flameR) return false;
  const v = new THREE.Vector3(); try { tc.camera.getWorldDirection(v); } catch (e) { return false; }
  const dx = C.x - p.x, dz = C.z - p.z, L = Math.hypot(dx, dz) || 1, h = Math.hypot(v.x, v.z) || 1; return (dx * v.x + dz * v.z) / (L * h) > K.TUNE.flameCos;
}
function hurt(n) { const p = me(); try { game()?.hurtPlayer?.(n, p ? { x: p.x, z: p.z } : null); } catch (e) { /* */ } emit('hurt', { n }); }
function spit(pg) {
  const g = globs.find(x => !x.on); if (!g || !wp.maw) return;
  g.on = true; g.t = 0; g.from = { ...wp.maw }; g.to = { x: pg.x + (rng() - 0.5) * 1.5, y: pg.y, z: pg.z + (rng() - 0.5) * 1.5 }; g.m.visible = true;
}
function globTick(dt, pg) {
  for (const g of globs) { if (!g.on) continue; g.t += dt; const k = Math.min(1, g.t / K.TUNE.spitFlightS);
    g.m.position.set(g.from.x + (g.to.x - g.from.x) * k, g.from.y + (g.to.y - g.from.y) * k + Math.sin(k * Math.PI) * 5, g.from.z + (g.to.z - g.from.z) * k);
    if (k >= 1) { g.on = false; g.m.visible = false; burst(g.to.x, g.to.y + 0.2, g.to.z, 14, 0x9cff3a, 4, 3, 0.8); if (pg && d2(pg, g.to) < K.TUNE.spitR) hurt(K.TUNE.spitDmg); } }
}
// the body: a bezier from underground up to the head; reach>0 pushes the head out toward `at` (lunge), <0 pulls back
const _v = new THREE.Vector3();
function poseWorm(base, height, pg, reach = 0, at = null, stunned = false) {
  if (!base) { segs.forEach(s => (s.visible = false)); head.visible = false; sacMesh.forEach(s => (s.visible = false)); ring.visible = false; wp.maw = null; wp.sacs = []; wp.segs = []; return; }
  plume.visible = false; ring.visible = true;
  const gy = ground(base.x, base.z); ring.position.set(base.x, gy + 0.2, base.z);
  const tx = pg ? pg.x : fight.c.x, tz = pg ? pg.z : fight.c.z; let fx = tx - base.x, fz = tz - base.z; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
  const U = { x: base.x - fx * 6, y: gy - 7, z: base.z - fz * 6 };
  let H = { x: base.x + fx * 4, y: gy + Math.max(-3, height), z: base.z + fz * 4 };
  if (stunned) H = { x: base.x + fx * 4.5, y: gy + 4.2, z: base.z + fz * 4.5 };
  if (reach > 0 && at) { const ay = ground(at.x, at.z) + 1.5; H = { x: H.x + (at.x - H.x) * reach, y: H.y + (ay - H.y) * reach, z: H.z + (at.z - H.z) * reach }; }
  else if (reach < 0) H = { x: H.x - fx * 3 * -reach * 4, y: H.y + 2 * -reach * 4, z: H.z - fz * 3 * -reach * 4 };
  const Cc = { x: base.x, y: gy + Math.max(0, height) * 1.25 + 2, z: base.z };
  wp.segs = [];
  for (let i = 0; i < SEG; i++) {
    const t = i / (SEG - 1) * 0.94, q = K.bez(U, Cc, H, t), r = 1.25 + 0.85 * t + 0.25 * Math.sin(F_T() * 4 + i);
    const s = segs[i]; s.visible = q.y + r > ground(q.x, q.z) - 0.5; s.position.set(q.x, q.y, q.z); s.scale.set(r, r * 0.85, r); s.rotation.set(0, i * 0.7, 0);
    wp.segs.push({ x: q.x, y: q.y, z: q.z, r });
  }
  head.visible = true; head.position.set(H.x, H.y, H.z);
  const q2 = K.bez(U, Cc, H, 0.9); _v.set(H.x * 2 - q2.x, H.y * 2 - q2.y, H.z * 2 - q2.z); head.lookAt(_v);
  const open = stunned ? 1.25 + 0.1 * Math.sin(F_T() * 10) : 1 + 0.08 * Math.sin(F_T() * 6); head.scale.set(open, open, 1);
  _v.set(0, 0, 0.4).applyQuaternion(head.quaternion); wp.maw = { x: H.x + _v.x, y: H.y + _v.y, z: H.z + _v.z };
  // gill sacs on segments 8..11, alternating sides
  wp.sacs = [];
  const f = fight.f;
  for (let i = 0; i < sacMesh.length; i++) {
    const s = segs[7 + i] || segs[SEG - 1], side = i % 2 ? 1 : -1, r = s.scale.x;
    const x = s.position.x + -fz * side * (r + 0.4), z = s.position.z + fx * side * (r + 0.4), y = s.position.y + 0.3;
    const on = f.phase === K.P.SACS && f.sacs[i] > 0; sacMesh[i].visible = on; sacMesh[i].position.set(x, y, z);
    const pulse = 1 + 0.15 * Math.sin(F_T() * 5 + i); sacMesh[i].scale.setScalar(pulse * (0.6 + 0.4 * f.sacs[i] / K.TUNE.sacHits));
    wp.sacs.push(on ? { x, y, z, r: 1.1, i } : null);
  }
}
const F_T = () => fight?.t || 0;
function showPlume(x, z, dt, big = 1) {
  segs.forEach(s => (s.visible = false)); head.visible = false; sacMesh.forEach(s => (s.visible = false)); ring.visible = false; wp.maw = null; wp.sacs = [];
  const y = ground(x, z); plume.visible = true; plume.position.set(x, y, z); plume.scale.setScalar(big); plume.rotation.y += dt * 3;
  const cl = plume.getObjectByName('plume-cloud'); if (cl) { const k = 1 + 0.2 * Math.sin(F_T() * 7); cl.scale.set(k, k * 1.2, k); }
  wp.plume = { x, y: y + 1.2 * big, z, r: 1.9 * big };
  if (rng() < dt * 30) burst(x + (rng() - 0.5) * 2, y + 0.3, z + (rng() - 0.5) * 2, 1, rng() < 0.5 ? 0xb07850 : 0xd8a070, 2.5, 5, 1.3 * big);
}
// gory but cartoony: segments pop from the head down in goo bursts, teeth fly
function deathTick(dt) {
  const F = fight; if (F.done !== 'win') { // dive away
    const k = Math.max(0, F.doneT / 1.4); if (F.base && segs[0]) { for (const s of segs) s.position.y -= dt * 9; head.position.y -= dt * 9; } sacMesh.forEach(s => (s.visible = false)); plume.visible = false; if (k <= 0) root.visible = false; return;
  }
  F.deathT += dt; const n = Math.floor(F.deathT / 0.17);
  if (head.visible && F.deathT > 0.05) { head.visible = false; const h = head.position; burst(h.x, h.y, h.z, 40, 0x9cff3a, 9, 8, 1.3); burst(h.x, h.y, h.z, 14, 0xece2c2, 10, 9, 0.7); burst(h.x, h.y, h.z, 18, 0xc0302a, 7, 6, 1.1); shake = 1.2; rumble(1.8, 1); }
  for (let i = SEG - 1; i >= Math.max(0, SEG - 1 - n); i--) { const s = segs[i]; if (s.visible) { s.visible = false; burst(s.position.x, s.position.y, s.position.z, 10, i % 2 ? 0x9cff3a : 0xc0302a, 6, 6, s.scale.x * 0.6); } }
  sacMesh.forEach(s => (s.visible = false));
}

// ---------- bullets + auto-aim: chain world.hitWorld / world.targets (once per world) ----------
const patched = new WeakSet();
function patchWorld(w) {
  if (!w || patched.has(w)) return; patched.add(w);
  const oHit = w.hitWorld?.bind(w), oT = w.targets?.bind(w);
  w.hitWorld = (p0, p1, b) => { try { if (fight && !fight.done && p0 && p1 && onBullet(p0, p1, b)) return true; } catch (e) { console.warn('sandworm hit', e); } return oHit ? oHit(p0, p1, b) : false; };
  w.targets = () => { const out = oT ? oT() : []; try { if (fight && !fight.done) for (const t of aimPoints()) out.push(t); } catch (e) { /* */ } return out; };
}
function aimPoints() {
  const f = fight.f, o = [];
  if (f.phase === K.P.PLUMES && wp.plume && fight.pose === 'under') o.push({ x: wp.plume.x, y: wp.plume.y, z: wp.plume.z, kind: 'sandworm' });
  if (f.phase === K.P.SACS) for (const s of wp.sacs) if (s) o.push({ x: s.x, y: s.y, z: s.z, kind: 'sandworm' });
  if (f.phase === K.P.CHARGE && f.stun > 0 && wp.maw) o.push({ x: wp.maw.x, y: wp.maw.y, z: wp.maw.z, kind: 'sandworm' });
  return o;
}
// one bullet segment: true when the worm soaked it
function onBullet(p0, p1, b) {
  const f = fight.f, n = K.hitsOf(b);
  if (f.phase === K.P.PLUMES) { const P = plumeHead(); if (P && K.segHit(p0, p1, P, P.r) >= 0) { hitPlumeNow(n); return true; } }
  if (f.phase === K.P.SACS) for (const s of wp.sacs) if (s && K.segHit(p0, p1, s, s.r) >= 0) { hitSacNow(s.i, n, s); return true; }
  if (f.phase === K.P.CHARGE) {
    if (f.stun > 0 && wp.maw && K.segHit(p0, p1, wp.maw, 2.1) >= 0) { hitMawNow(n); return true; }
    if (!(f.stun > 0) && b?.flame && fight.charge) { const C = { x: fight.charge.x, y: ground(fight.charge.x, fight.charge.z) + 1.5, z: fight.charge.z }; if (K.segHit(p0, p1, C, 2.5) >= 0) { if (K.flameOn(f, 0.25)) onStun('flame'); return true; } }
  }
  // the armoured body soaks shots (sparks, no damage)
  if (head?.visible && wp.segs.length) for (const s of wp.segs) if (K.segHit(p0, p1, s, s.r) >= 0) { burst(s.x, s.y + s.r * 0.5, s.z, 2, 0xffe08a, 3, 2, 0.5); return true; }
  return false;
}
function hitPlumeNow(n = 1) {
  const F = fight, P = wp.plume; if (!P) return false; burst(P.x, P.y, P.z, 8, 0xd8a070, 5, 4);
  if (K.hitPlume(F.f, n)) { breachAt(F.plume); say(F.f.phase === K.P.SACS ? 'It\u2019s coming up for real!' : `It surfaced! (${F.f.surf}/${K.TUNE.surfacings})`, 2.5); emit('surface', { n: F.f.surf }); }
  refreshUi(); return true;
}
function hitSacNow(i, n = 1, s) {
  const r = K.hitSac(fight.f, i, n); if (!r) return false; const at = s || wp.sacs[i];
  if (at) burst(at.x, at.y, at.z, r === 'hit' ? 6 : 26, r === 'hit' ? 0xffc23a : 0x9cff3a, r === 'hit' ? 3 : 7, 4, r === 'hit' ? 0.6 : 1.1);
  if (r !== 'hit') { shake = 0.6; say(r === 'phase' ? 'All sacs popped! It\u2019s diving!' : `Sac popped! ${K.sacsLeft(fight.f)} left.`, 2.5); emit('sac', { i, left: K.sacsLeft(fight.f) }); }
  if (r === 'phase') { fight.charge = null; fight.dive = 0; fight.lunge = null; globs.forEach(g => { g.on = false; g.m.visible = false; }); }
  refreshUi(); return true;
}
function hitMawNow(n = 1) {
  const r = K.hitMaw(fight.f, n); if (!r) return false; const m = wp.maw; if (m) burst(m.x, m.y, m.z, 8, 0xc0302a, 5, 4, 0.8);
  if (r === 'win') end('win'); refreshUi(); return true;
}

// tap the plume on screen (phones): a quick projection of the plume head
function onTapScreen(ev) {
  try {
    if (!fight || fight.done || !lastTc?.camera || ev.target?.closest?.('button, .sheet, #wormCap, [role=dialog]')) return;
    const P = plumeHead(); if (!P || d2(me(), P) > 35) return;
    const v = new THREE.Vector3(P.x, P.y, P.z).project(lastTc.camera); if (v.z > 1) return;
    const sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight, pt = ev.touches?.[0] || ev;
    if (Math.hypot(pt.clientX - sx, pt.clientY - sy) < 70) AG.run('tap', () => hitPlumeNow(1));
  } catch (e) { /* */ }
}

// ---------- UI: one caption with a health bar; a 🦷 button in the Hydro Den ----------
let capEl = null, actBtn = null, capKey = '';
function css() {
  if (document.getElementById('wormCss')) return;
  const st = document.createElement('style'); st.id = 'wormCss';
  st.textContent = `#wormCap{position:fixed;z-index:16;top:calc(122px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);display:none;width:min(360px,calc(100vw - 24px));padding:8px 14px 9px;border-radius:14px;border:3px solid #ff3b30;background:#000;color:#fff;font:800 16px/1.25 system-ui,sans-serif;pointer-events:none;box-sizing:border-box}
#wormCap.on{display:block}#wormCap b{font-weight:900}#wormCap small{display:block;font-weight:700;font-size:13px;margin-top:4px}
#wormCap .bar{height:10px;border:2px solid #fff;border-radius:6px;margin-top:6px;overflow:hidden;background:#222}#wormCap .bar i{display:block;height:100%;background:#ff3b30}
@media (max-width:440px) and (orientation:portrait){#wormCap{left:auto;right:calc(8px + env(safe-area-inset-right));transform:none;width:calc(100vw - 132px - env(safe-area-inset-left) - env(safe-area-inset-right));padding:5px 9px 6px;font-size:13px}#wormCap small{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}} /* v7.5.56 (p1): clear of ▤ More on narrow phones */
body.wormOn #hvCap,body.wormOn #stillCap,body.wormOn #f2Cap,body.wormOn #farmGuide{display:none!important}
#wormAct{position:fixed;z-index:15;left:calc(14px + env(safe-area-inset-left));bottom:calc(250px + env(safe-area-inset-bottom));display:none;min-height:52px;min-width:120px;padding:6px 16px;border-radius:14px;border:3px solid #fff;background:#000;color:#fff;font:900 17px/1.1 system-ui,sans-serif;touch-action:manipulation;box-shadow:0 2px 10px #000}
#wormAct.on{display:block}`;
  document.head.appendChild(st);
}
function ui() {
  css(); if (capEl) return;
  capEl = document.createElement('div'); capEl.id = 'wormCap'; capEl.setAttribute('role', 'status'); document.body.appendChild(capEl);
  actBtn = document.createElement('button'); actBtn.id = 'wormAct'; actBtn.type = 'button'; actBtn.textContent = `🦷 Sell Worm Tooth · ${K.PAY.tooth} cr`; document.body.appendChild(actBtn);
  const go = e => { e?.preventDefault?.(); sellTooth(); };
  actBtn.addEventListener('click', go); window.__onTap ? window.__onTap(actBtn, go) : actBtn.addEventListener('touchend', go);
  addEventListener('pointerdown', onTapScreen, { passive: true });
}
function refreshUi(force) {
  if (!capEl) return;
  let html = '';
  if (fight) {
    const f = fight.f, hp = Math.round(K.health(f) * 100);
    const title = fight.done ? (fight.done === 'win' ? '🪱 Sandworm · dead' : '🪱 Sandworm · gone') : `🪱 Sandworm · phase ${f.phase} of 3`;
    html = `<b>${title}</b><div class="bar"><i style="width:${fight.done === 'win' ? 0 : hp}%"></i></div><small>${lineT > 0 ? line : K.hint(f)}</small>`;
  } else if (lineT > 0) html = `<b>🪱 Sandworm</b><small>${line}</small>`;
  if (force || html !== capKey) { capKey = html; capEl.innerHTML = html; capEl.classList.toggle('on', !!html); document.body.classList.toggle('wormOn', !!html); }
  const den = !!window.SSX?.hydroden?.inside, showAct = den && S.teeth > 0 && !document.querySelector('.sheet.show, #hdPanel, #cqScreen.on');
  actBtn.classList.toggle('on', showAct); if (showAct) actBtn.textContent = `🦷 Sell Worm Tooth · ${K.PAY.tooth} cr${S.teeth > 1 ? ` (${S.teeth})` : ''}`;
}
function sellTooth(o = {}) {
  return AG.run('tooth', () => {
    if (!o.anywhere && !window.SSX?.hydroden?.inside) return { ok: false, msg: 'Sell it to Sister Nettle in the Hydro Den.' };
    const r = K.sellTooth(S); if (!r.ok) return { ok: false, msg: r.why };
    const g = game(); if (g?.progress) { g.progress.credits += r.cr; try { g.save(); } catch (e) { /* */ } }
    save(); toast(`🦷 Sister Nettle takes the Worm Tooth: +${r.cr} cr. \u201cThat\u2019s a big one.\u201d`); emit('sell', { cr: r.cr }); refreshUi(true);
    return { ok: true, cr: r.cr, teeth: S.teeth };
  });
}

// ---------- triggers + tick ----------
let trigT = 2, storyT = 0;
function hookEvents() {
  try { FARM()?.on?.(e => { if (!e) return; if (e.type === 'harvest' || (e.type === 'cut' && e.via !== 'worm')) { S.harvests++; save(); } }); } catch (e) { /* */ }
  let f2Hooked = false; const h2 = () => { if (f2Hooked) return; const F = FARM2(); if (!F?.on) return; f2Hooked = true; try { F.on(e => { if (e?.type === 'harvest') { S.harvests++; save(); } }); } catch (x) { /* */ } };
  h2(); hookEvents.h2 = h2;
}
function tick(dt, tc) {
  lastTc = tc; if (!(dt > 0)) return; dt = Math.min(dt, 0.1);
  if (tc.world) patchWorld(tc.world);
  if (root && inScene !== tc.scene) { tc.scene.add(root); inScene = tc.scene; }
  if (lineT > 0) lineT -= dt;
  hookEvents.h2?.();
  if (fight) {
    root.visible = true; tickFight(dt, tc); partsTick(dt);
    if (fight && wp.plume) { try { window.SSX?.minimap?.addMarks?.('sandworm', [{ x: (fight.base || fight.plume).x, z: (fight.base || fight.plume).z, color: '#ff3b30', r: 3, ring: true }]); } catch (e) { /* */ } }
  } else if (parts && root?.visible) partsTick(dt);
  // camera shake (extraTicks run after updateCamera, so a zero-mean jitter never drifts)
  if (shake > 0.01 && tc.camera && !blocked()) { const a = Math.min(1.2, shake) * 0.35; tc.camera.position.x += (rng() - 0.5) * a; tc.camera.position.y += (rng() - 0.5) * a; tc.camera.position.z += (rng() - 0.5) * a; shake = Math.max(0, shake - dt * 1.4); }
  // triggers: the story start after your 2nd harvest, else once per 3 game days at a farm
  if (!fight && !blocked()) {
    if ((regrowT -= dt) <= 0) { regrowT = 2; if (S.eaten.length) regrow(); }
    if ((trigT -= dt) <= 0) {
      trigT = 5;
      const fm = nearestFarm(me());
      if (fm && fm.plots.length) {
        if (K.storyDue(S)) { storyT += 5; if (storyT >= 5) { S.story = true; save(); spawn({ why: 'story' }); } }
        else if (!noRandom && K.canTrigger(S, day(), rng())) spawn({ why: 'random' });
      }
    }
  }
  refreshUi();
}

// ---------- public API ----------
function status() {
  const f = fight?.f;
  return { active: !!fight && !fight.done, farm: fight?.farm || null, phase: f?.phase || 0, health: f ? Math.round(K.health(f) * 100) / 100 : null, surf: f?.surf ?? null, sacs: f ? f.sacs.slice() : null,
    stun: f ? Math.round(f.stun * 10) / 10 : 0, maw: f?.maw ?? null, eaten: f?.eaten ?? 0, cap: f?.cap ?? null, over: f?.over || null, done: fight?.done || null,
    teeth: S.teeth, lastDay: S.lastDay, harvests: S.harvests, story: S.story, pending: S.eaten.map(e => ({ farm: e.farm, kind: e.kind, day: e.day })), stats: { ...S.stats },
    blocked: blocked(), saveErr, aim: fight && !fight.done ? aimPoints() : [], caption: capEl?.classList.contains('on') ? capEl.textContent : '', act: actBtn?.classList.contains('on') ? actBtn.textContent : '' };
}
const api = {
  version: 1, spawn, status, sellTooth, on: f => { if (typeof f !== 'function') return () => {}; subs.add(f); return () => subs.delete(f); },
  LINES: K.LINES, PAY: K.PAY, TUNE: K.TUNE,
  get state() { return JSON.parse(JSON.stringify(S)); },
  debug: {
    reset() { AG.reset(); if (fight) { fight = null; if (root) root.visible = false; } chewed.clear(); S = K.fresh(); save(); lineT = 0; refreshUi(true); return status(); },
    state: () => JSON.parse(JSON.stringify(S)), ag: () => AG.reset(), rng(v) { rng = typeof v === 'function' ? v : (v == null ? Math.random : () => +v); return true; },
    noRandom(v = true) { noRandom = v !== false; return noRandom; }, weak: () => JSON.parse(JSON.stringify(wp)),
    hitPlume: (n = 1) => !!fight && hitPlumeNow(n), hitSac: (i, n = 1) => !!fight && hitSacNow(i, n), hitMaw: (n = 1) => !!fight && hitMawNow(n),
    stun: (how = 'ram') => { if (!fight || fight.f.phase !== K.P.CHARGE) return false; if (!fight.charge) newCharge(); K.stun(fight.f); onStun(how); return true; },
    phase(n) { if (!fight) return false; const f = fight.f; if (n >= 2 && f.phase === 1) { f.surf = K.TUNE.surfacings; f.phase = 2; fight.pose = 'under'; startSacs(); } if (n >= 3 && f.phase === 2) { f.sacs = f.sacs.map(() => 0); f.phase = 3; fight.charge = null; } return status(); },
    eat: () => (fight ? !!eatNext(fight.base || fight.plume) : false), lunge() { if (fight?.f.phase === 2) fight.f.lungeT = 0; return !!fight; }, spit() { if (fight?.f.phase === 2) fight.f.spitT = 0; return !!fight; },
    hold(sec = 999) { if (!fight) return false; const f = fight.f; f.autoT = f.eatT = f.lungeT = f.spitT = sec; return true; },
    charge: () => (fight?.charge ? { ...fight.charge } : null), setCharge(x, z) { if (fight?.charge) { fight.charge.x = x; fight.charge.z = z; } return !!fight?.charge; },
    regrow: (force = true) => regrow(force), end: how => { if (fight) end(how || 'away'); return status(); }, farms: () => farms().map(f => ({ id: f.id, c: f.c, silo: f.silo, plots: f.plots.length })),
    chewed: () => [...chewed], base: () => (fight?.base ? { ...fight.base } : null), give(n = 1) { S.teeth = Math.min(99, S.teeth + n); save(); return S.teeth; }, harvests(n) { S.harvests = n | 0; save(); return S.harvests; }
  }
};
const attach = () => { if (!window.SSX) window.SSX = {}; if (window.SSX.sandworm !== api) window.SSX.sandworm = api; };
attach();
(function boot() {
  if (!window.SSX?.registerSurfaceTick || !window.__app) { attach(); setTimeout(boot, 200); return; }
  attach(); ui(); hookEvents();
  try { window.SSX.registerSurfaceTick(tick); } catch (e) { console.warn('sandworm tick', e); }
  setInterval(attach, 2000);
})();
