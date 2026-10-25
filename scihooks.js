// Junkyard-lab pack shim: THE ONE PLACE this pack talks to core (like planets/hooks.js and racehooks.js).
// Importing it registers the Raccoon Mobile, the lab, the duo, 5 portal dimensions and the sci-01..05 mission chain.
// surface.js calls sciTick(dt, ctx) once per frame, next to raceTick. Everything else is new files:
//   raccoon.js · scientists.js · portals.js · dimensions/*.js · scicore.js (pure, unit-tested)
import * as THREE from 'three';
import { COLONIES, registerVehicle, buildVehicle } from './world.js?v=7.5';
import { registerMission, SHOP } from './game.js?v=7.5';
import { registerInterior, textTex } from './interiors.js?v=7.5';
import { STORY } from './missions-data.js?v=7.5';
import { LAB_BLOCK, PORTAL_AT, JUNK_AT, RACCOON_PARK, portalTrigger, hazardPos, makeRun, stepRun, stepLabel } from './scicore.js?v=7.5';
import { RACCOON_ID, RACCOON_SPEC, RACCOON_SHOP, raccoonBuilder } from './raccoon.js?v=7.5';
import { SILAS, TAM, BARKS, sciMissions, LAB_INTERIOR, buildLab } from './scientists.js?v=7.5';
import { DIMENSIONS } from './dimensions/index.js?v=7.5';
import { roomKit, buildPortal, homeRing, geos } from './portals.js?v=7.5';

const LIVE = {}; // dimension id -> { picks, hazards, tick } from the last build of that room

// ---------- registration (runs once, at import) ----------
registerVehicle(RACCOON_ID, RACCOON_SPEC, raccoonBuilder(THREE));
if (!SHOP.some(s => s.id === RACCOON_ID)) SHOP.push({ ...RACCOON_SHOP });
registerInterior('scilab', { ...LAB_INTERIOR, build(api) { buildLab(api, roomKit(THREE, api)); } });
for (const [id, dim] of Object.entries(DIMENSIONS)) {
  registerInterior('sci-' + id, {
    name: dim.name, w: dim.w, d: dim.d, h: dim.h, wall: dim.wall, floor: dim.floor, ceil: dim.ceil, trim: dim.trim, light: dim.light,
    build(api) { const live = dim.build(api, roomKit(THREE, api)); homeRing(THREE, api); LIVE[id] = live; }
  });
}
{ const k = Object.keys(STORY.barks).find(x => x.startsWith('Contacts')); if (k) Object.assign(STORY.barks[k], BARKS); }
for (const m of sciMissions()) registerMission(m);
export function ensureMars() {
  const C = COLONIES.Mars; if (!C) return false;
  C.blocks = C.blocks || []; C.inside = C.inside || {}; C.vehicles = C.vehicles || [];
  if (!C.blocks.some(b => b[7] === 'scilab')) C.blocks.push([...LAB_BLOCK]);
  if (!C.inside.scilab) C.inside.scilab = { talk: 'Silas' };
  if (!C.vehicles.some(v => v[0] === RACCOON_ID)) C.vehicles.push([RACCOON_ID, ...RACCOON_PARK]);
  return true;
}
ensureMars();

// Pumpkin's dealership (pumpkin/dealership-garage) isn't on main yet: feature-detect its hook and list the car there too.
const S = { t: 0, root: null, portal: null, sale: null, trig: { armed: true }, run: null, px: 0, pz: 0, warnT: -9, key: '', prevCar: null, prevWanted: 0, dealer: null, err: null };
function dealerHook() {
  if (S.dealer !== null) return;
  const X = window.SSX; if (!X) return;
  const fn = X.dealership?.addStock || X.dealership?.register || X.registerDealerStock || X.addDealerStock || null;
  S.dealer = false;
  if (typeof fn !== 'function') return;
  try { fn.call(X.dealership || X, RACCOON_ID, { kind: RACCOON_ID, ...RACCOON_SPEC, price: RACCOON_SPEC.price }); S.dealer = true; } catch (e) { console.warn('sci: dealership addStock failed', e); }
}

// ---------- per-frame ----------
export function sciTick(dt, ctx) {
  try { tick(dt, ctx); } catch (e) { if (!S.err) { S.err = e; console.warn('sci pack:', e); } }
}
const app = () => window.__app;
const toast = (m, ms = 4200) => app()?.toast?.(m, ms);
// Duo barks: Pumpkin's PR #5 (not merged) adds SSX.bark(npc, category) for captioned NPC barks. Feature-detect it
// at call time (it may arrive after us); if absent or it throws/returns false, fall back to our own caption toast.
export function bark(who, category, line) {
  const B = window.SSX?.bark;
  if (typeof B === 'function') { try { if (B(who, category, line) !== false) return 'ssx'; } catch (e) { console.warn('[sci] SSX.bark', e); } }
  if (line) toast(`💬 ${who}: "${line}"`, 3600);
  return 'caption';
}
const pick = a => a[(Math.random() * a.length) | 0];

function dropRoot() { if (S.root) { S.root.parent?.remove(S.root); S.root = null; S.portal = null; S.sale = null; } }
function buildRoot(ctx) {
  dropRoot();
  const { world, scene, height } = ctx, G = geos(THREE), root = new THREE.Group(); root.name = 'sci-pack';
  const W = p => world.colonyAt(p);
  // junkyard: a rolled-over stock buggy and two scrap heaps (one instanced draw)
  const wreck = buildVehicle('buggy').group, wp = W(JUNK_AT[1]); wreck.position.set(wp.x, height(wp.x, wp.z) + 0.6, wp.z); wreck.rotation.set(0, 0.8, 2.5); root.add(wreck);
  const heap = new THREE.InstancedMesh(G.dodeca, new THREE.MeshStandardMaterial({ color: 0x6a5e52, roughness: 0.8, metalness: 0.5, flatShading: true }), 12), o = new THREE.Object3D();
  for (let i = 0; i < 12; i++) { const c = W(JUNK_AT[i < 7 ? 0 : 2]), a = i * 2.4, r = (i % 4) * 0.7; o.position.set(c.x + Math.cos(a) * r, height(c.x, c.z) + 0.3 + (i % 3) * 0.35, c.z + Math.sin(a) * r); o.scale.setScalar(0.6 + (i % 3) * 0.3); o.rotation.set(a, a * 0.7, 0); o.updateMatrix(); heap.setMatrixAt(i, o.matrix); }
  root.add(heap);
  // the portal (only shown while a scientist job wants you through it)
  const pp = W(PORTAL_AT), door = W([LAB_BLOCK[0], LAB_BLOCK[1] + LAB_BLOCK[3] / 2 + 0.9]);
  S.px = pp.x; S.pz = pp.z; S.portal = buildPortal(THREE); S.portal.position.set(pp.x, height(pp.x, pp.z), pp.z); S.portal.rotation.y = Math.atan2(door.x - pp.x, door.z - pp.z); S.portal.visible = false; root.add(S.portal);
  // FOR SALE tag over the Raccoon Mobile's spot at the Depot
  const sp = W(RACCOON_PARK); S.saleTex = { own: null, sale: textTex(`🦝 FOR SALE · ${RACCOON_SPEC.price} cr · DEPOT`, 0xffd040) };
  S.sale = new THREE.Sprite(new THREE.SpriteMaterial({ map: S.saleTex.sale, transparent: true, depthWrite: false })); S.sale.scale.set(4.2, 1.05, 1); S.sale.position.set(sp.x, height(sp.x, sp.z) + 4.2, sp.z); root.add(S.sale);
  scene.add(root); S.root = root; S.trig.armed = true;
}

function tick(dt, ctx) {
  S.t += dt; dealerHook();
  const { world, game, player } = ctx;
  if (ctx.name !== 'Mars' || !world?.colony || !game?.debug) { if (S.root) dropRoot(); ensureMars(); return; }
  if (!S.root || S.root.parent !== ctx.scene) buildRoot(ctx);
  const q = game.debug.quest(), s = q ? game.debug.step() : null, key = q ? q.id + ':' + q.step : '';
  if (key !== S.key) {
    S.key = key;
    if (s?.type === 'portal') { s.base = s.base || s.text; s.text = s.base; }
    if (s?.getaway) window.dispatchEvent(new CustomEvent('ssx:getaway', { detail: { source: q.id, stars: s.wanted || 1 } }));
  }
  const ins = world.inside;
  const inLab = ins?.kind === 'scilab';
  if (inLab && !S.inLab) { const who = Math.random() < 0.65 ? SILAS : TAM; bark(who, 'idle', pick(BARKS[who])); }
  S.inLab = inLab;
  if (!ins) {
    S.run = null;
    const dim = s?.type === 'portal' ? DIMENSIONS[s.dim] : null;
    S.portal.visible = !!dim;
    if (dim) {
      S.portal.userData.spin(S.t);
      const d = Math.hypot(player.x - S.px, player.z - S.pz);
      if (ctx.car) { if (d < 4 && S.t - S.warnT > 5) { S.warnT = S.t; bark(TAM, 'warn', "It doesn't take cars! Get out and walk in. Please. Sorry."); } }
      else if (portalTrigger(S.trig, d)) enterDim(s.dim);
    }
    raccoonTick(ctx);
  } else if (ins.kind.startsWith('sci-')) dimTick(dt, ctx, ins, s);
}

export function enterDim(id) {
  const dim = DIMENSIONS[id], a = app(); if (!dim || !a?.surface) return null;
  const r = a.surface.enterBuilding({ i: 'sci-dim:' + id, kind: 'sci-' + id, name: dim.name, title: dim.name, color: 0xff2fa8, x: S.px, z: S.pz + 3.0 });
  if (r?.ok) { S.run = null; toast(dim.intro, 6000); }
  return r;
}

function dimTick(dt, ctx, ins, s) {
  const id = ins.kind.slice(4), dim = DIMENSIONS[id], live = LIVE[id]; if (!dim || !live) return;
  if (!S.run || S.run.id !== id) {
    S.run = makeRun(dim, !(s?.type === 'portal' && s.dim === id));
    live.picks.forEach(o => { o.visible = !S.run.inert; });
  }
  const run = S.run, p = ctx.player, lx = p.x - ins.ax, lz = p.z - ins.az;
  const ev = stepRun(run, dim, lx, lz, dt);
  live.tick?.(run.t);
  dim.hazards.forEach((h, i) => {
    const o = live.hazards[i]; if (!o) return; const hp = hazardPos(h, run.t);
    if (h.kind === 'geyser') return dim.place(o, hp, dim.h);
    const px = o.position.x, pz = o.position.z; o.position.x = hp.x; o.position.z = hp.z;
    if (live.roll) { o.rotation.z -= (hp.x - px) / 1.3; o.rotation.x += (hp.z - pz) / 1.3; } else if (hp.x !== px || hp.z !== pz) o.rotation.y = Math.atan2(hp.x - px, hp.z - pz) + Math.PI;
  });
  for (const e of ev) {
    if (e.type === 'pick') { if (live.picks[e.i]) live.picks[e.i].visible = false; if (s) s.text = stepLabel(s.base || s.text, run); if (e.got < e.need) toast(`✨ ${e.got}/${e.need}`, 1500); }
    else if (e.type === 'wrong') toast(`🎫 Wrong ticket. You need number ${e.want + 1} first.`, 2200);
    else if (e.type === 'hurt') { ctx.game.hurtPlayer(e.dmg, null); p.x += e.push[0]; p.z += e.push[1]; if (e.line) toast('💥 ' + e.line, 1800); }
    else if (e.type === 'done') { if (s) s.text = s.base || s.text; ctx.game.debug.advance(); toast(dim.done, 5000); }
  }
}

function raccoonTick(ctx) {
  const { world, game } = ctx, owned = (game.progress?.upgrades || []).includes(RACCOON_ID);
  if (S.sale) { S.sale.visible = !owned; }
  const car = ctx.car && ctx.car.kind === RACCOON_ID ? ctx.car : null;
  if (car && car !== S.prevCar && owned) {
    // your own car: undo the car-theft heat and the stolen-car tally the core just added
    if ((world.wanted || 0) > S.prevWanted) world.setWanted(S.prevWanted, 'owner');
    if (!car.sciOwned) { car.sciOwned = true; const st = game.progress.stats; if (st.stolen > 0) st.stolen--; }
    toast('🦝 Your Raccoon Mobile. Keys were in the ignition. No heat.', 3000);
  }
  if (!ctx.car) S.prevWanted = world.wanted || 0;
  S.prevCar = ctx.car || null;
}

// test/debug surface (read-mostly)
window.__sci = { S, LIVE, DIMENSIONS, enterDim, ensureMars, bark, ids: () => sciMissions().map(m => m.id), dealer: () => S.dealer };
