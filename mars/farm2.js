// Red Static Gulch: a hidden outlaw grow op out in the south-east dunes (window.SSX.farm2). Rules + numbers: mars/farm2core.js.
// Fiction only: made-up crops (Red Static moss, Void Honey poppies, Glow-dust cactus, Ghost spore), no real drugs, no how-to.
// - Buy it once (2,500 cr or 2,500 ⭐ via SSX.stars, 1:1 like the farm). Up to 6 grow racks under camo netting (400 cr or ⭐).
// - Grow on the farm's game clock (SSX.farm.clock), harvest into your stash (cap 40), sell to Skiv the fence at the gulch
//   (cash, can draw heat) or to the Xen-7 aliens at the trading post (1.2x, a row in their 👽 Trade sheet via SSX.farmRows).
// - Heat: planting, harvesting and selling to Skiv can get you noticed: +1 wanted through SSX.pursuit.addHeat (guarded, never
//   past 3 stars from here, never in the Rust Pit). Heat can bring a ColSec drone sweep: kill the grow lights in time and the
//   drones fly past (Skiv tips you); ignore it and they grab a quarter of your stash (racks and crops in the ground are safe).
//   BUSTED by ColSec anywhere: they take the same quarter of the stash you carry. No extra fine.
// - SSX.farm2: status() plots() damage(plotId) restore(plotId, snap) buy rack plant harvest sell killLights open close on debug.
//   damage(plotId) is the sandworm's hook: it wipes one rack's crop and hands back a snapshot that restore() regrows.
// - UI: one 🏴 Gulch context button at the op, one caption (raid only), one ☰ menu row, a minimap mark. Save: ssx.farm2.v1 +
//   ssx.farm2.v1.bak (#83 pattern: an owned op is never lost to one bad read).
import * as THREE from 'three';
import * as K from './farm2core.js';

const app = () => window.__app, surf = () => app()?.surface, game = () => app()?.game || surf()?.game, world = () => surf()?.world;
const FARM = () => window.SSX?.farm, STARS = () => window.SSX?.stars;
const fin = Number.isFinite;
const NEAR_R = 14, POST_R = 12;
let S = K.fresh(), restoredFrom = null, saveErr = null;
function load() { try { const r = K.recover(localStorage.getItem(K.SAVE_KEY), localStorage.getItem(K.BAK_KEY)); S = r.s; restoredFrom = r.restored ? r.from : null; } catch (e) { S = K.fresh(); } }
function save() {
  try { const raw = localStorage.getItem(K.SAVE_KEY); if (!K.mayOverwrite(S, raw)) return; const j = JSON.stringify(S); localStorage.setItem(K.SAVE_KEY, j); if (S.owned) localStorage.setItem(K.BAK_KEY, j); saveErr = null; }
  catch (e) { saveErr = String(e?.name || e); }
}
load(); if (restoredFrom) save();
const subs = new Set();
function emit(type, ev = {}) { const e = { type, ...ev }; for (const f of subs) { try { f(e); } catch (x) { console.warn('farm2 on', x); } } try { window.dispatchEvent(new CustomEvent('ssx:farm2', { detail: e })); } catch (x) { /* */ } return e; }
function toast(m, ms = 2800) { if (!m) return; if (panel?.classList.contains('show')) { pMsg.textContent = m; return; } try { app()?.toast?.(m, ms); } catch (e) { /* */ } }
const credits = () => game()?.progress?.credits | 0;
function payCr(n) { const g = game(); if (!g?.progress || credits() < n) return false; g.progress.credits -= n; try { g.save(); } catch (e) { /* */ } return true; }
function earnCr(n) { const g = game(); if (!g?.progress || !(n > 0)) return; g.progress.credits += Math.round(n); try { g.save(); } catch (e) { /* */ } }
const starBal = () => { try { const b = STARS()?.balance?.(); return fin(b) ? b : 0; } catch (e) { return 0; } };
function pay(c, n) {
  if (c === 'stars') { if (typeof STARS()?.spend !== 'function') return { ok: false, msg: '⭐ aren\u2019t available here. Pay in cr.' }; try { return STARS().spend(n, 'farm2') || { ok: false }; } catch (e) { return { ok: false, msg: '⭐ payment failed.' }; } }
  return payCr(n) ? { ok: true } : { ok: false, msg: 'Not enough cr.' };
}
const AG = K.makeActGuard(() => performance.now());
const res = (ok, msg, x = {}) => ({ ok, msg, ...x });
let rng = Math.random;

// ---------- where things are ----------
function colony() { const c = surf()?.info?.colony || world()?.colony; return c && fin(c.x) && fin(c.z) ? c : null; }
const onMars = () => surf()?.info?.name === 'Mars' && !!colony() && !!app()?.state?.onSurface;
const W = at => { const c = colony(); return c ? { x: c.x + at[0], z: c.z + at[1] } : null; };
const siteW = () => W(K.SITE.at);
const me = () => { const i = surf()?.info; return i && fin(i.x) && fin(i.z) ? i : null; };
const dist = (a, b) => (a && b ? Math.hypot(a.x - b.x, a.z - b.z) : Infinity);
function inPit() { try { return !!FARM()?.debug?.inPit?.(); } catch (e) { return false; } }
function postW() { try { const p = FARM()?.places?.().find(q => q.id === 'post'); return p && fin(p.x) ? p : null; } catch (e) { return null; } }
const atGulch = () => onMars() && dist(me(), siteW()) < NEAR_R;
const atPost = () => onMars() && dist(me(), postW()) < POST_R;
function ground(x, z) { try { const h = lastTc?.height?.(x, z); if (fin(h)) return h; } catch (e) { /* */ } try { const h = FARM()?.debug?.ground?.(x, z); if (fin(h)) return h; } catch (e) { /* */ } return 0; }
function blocked() { if (inPit()) return 'No grow-op business in the Rust Pit.'; if (!onMars()) return `${K.SITE.name} is out in the Mars dunes.`; return null; }
// the farm's game clock (monotonic game hours) when it's there; else our own: one game hour a real minute
let ownH = 0;
function clockH() { try { const h = FARM()?.clock?.().hours; if (fin(h)) return h; } catch (e) { /* */ } return ownH; }

// ---------- heat (guarded SSX.pursuit; never in the Pit, never past 3 stars from here) ----------
function wanted() { try { const w = world()?.wanted; return fin(w) ? w : (fin(+w?.()) ? +w() : 0); } catch (e) { return 0; } }
function addHeat(why) {
  if (inPit() || !onMars() || wanted() >= K.HEAT.maxStars) return false;
  const p = window.SSX?.pursuit;
  try { if (typeof p?.addHeat === 'function') { const r = p.addHeat(1, why); if (r && r.ok === false) return false; S.stats.heat++; return true; } } catch (e) { /* */ }
  try { const w = world(); if (typeof w?.setWanted === 'function') { w.setWanted(Math.min(5, wanted() + 1), why); S.stats.heat++; return true; } } catch (e) { /* */ }
  return false;
}
// a heat roll: maybe +1 wanted, and maybe a ColSec drone sweep after it
function heatRoll(chance, why) {
  if (!K.heatRoll(chance, rng())) return null;
  const hot = addHeat(why); let raidOn = false;
  if (!raid && K.raidDue(S, rng())) { startRaid(); raidOn = true; }
  return { hot, raid: raidOn };
}

// ---------- the ColSec drone sweep: fun, not punishing ----------
let raid = null, lastRaid = '';
function startRaid() { raid = { t: K.RAID.len, lights: true }; S.lastRaidH = S.hours; S.stats.raids++; save(); emit('raid', { t: raid.t }); lastRaid = 'start'; }
function killLights() {
  return AG.run('lights', () => {
    if (!raid) return res(false, 'No drones overhead. Keep the lights on.');
    if (!atGulch()) return res(false, 'Get back to the gulch to kill the lights.');
    const tip = K.RAID.tip; raid = null; lightsOffT = 20; S.stats.raidsDodged++; earnCr(tip); save(); emit('raid:dodged', { tip }); lastRaid = 'dodged';
    const r = res(true, `💡 Lights out. The drones sweep a dark, dead gulch and fly on. Skiv slips you ${tip} cr for keeping your head.`, { tip }); toast(r.msg, 4200); return r;
  });
}
function endRaid() {
  raid = null; const r = K.seize(S); save(); lastRaid = 'seized'; emit('raid:seized', { n: r.n, took: r.took });
  toast(r.n ? `🚁 ColSec drones tagged the gulch and grabbed ${r.n} unit${r.n === 1 ? '' : 's'} from your stash. The racks are fine.` : '🚁 ColSec drones swept the gulch and found nothing worth taking.', 4200);
  if (panel?.classList.contains('show')) render(); return r;
}

// ---------- actions (idempotent: one guard key each, all-or-nothing charges) ----------
function buy(cur = 'cr') {
  return AG.run('buy', () => {
    const b = blocked(); if (b) return res(false, b);
    if (!atGulch() && !S.owned) return res(false, `Go to ${K.SITE.name} to buy it.`);
    const r = K.buyOp(S, cur, { cr: credits(), stars: starBal() }, pay);
    if (r.ok) { S.clockAt = clockH(); save(); emit('buy', { cur: r.cur, cost: r.cost }); redraw(); hookBase(true); }
    toast(r.msg, 3200); return r;
  });
}
function rack(cur = 'cr') {
  return AG.run('rack', () => {
    const b = blocked(); if (b) return res(false, b); if (!atGulch()) return res(false, `Go to ${K.SITE.name} to put in a rack.`);
    const r = K.addRack(S, cur, { cr: credits(), stars: starBal() }, pay);
    if (r.ok) { save(); emit('rack', { n: S.racks.length, cur: r.cur }); redraw(); } toast(r.msg); return r;
  });
}
function plant(i, crop) {
  return AG.run('plant:' + i, () => {
    const b = blocked(); if (b) return res(false, b); if (!atGulch()) return res(false, `Go to ${K.SITE.name} to plant.`);
    const c = K.canPlant(S, i, crop, credits()); if (!c.ok) return res(false, c.why);
    if (!payCr(c.cost)) return res(false, 'Not enough cr.');
    K.plant(S, i, crop); const h = heatRoll(K.HEAT.plant, 'grow op'); save(); emit('plant', { i, crop, id: S.racks[i].id }); redraw();
    const r = res(true, `${K.CROPS[crop].icon} ${K.CROPS[crop].name} in rack ${i + 1}. Ripe in ${K.CROPS[crop].hours} h.${heatLine(h)}`, { heat: h }); toast(r.msg, 3200); return r;
  });
}
function harvest(i) {
  return AG.run('harvest:' + i, () => {
    const b = blocked(); if (b) return res(false, b); if (!atGulch()) return res(false, `Go to ${K.SITE.name} to harvest.`);
    const crop = S.racks[i]?.crop; const r0 = K.harvest(S, i); if (!r0.ok) return res(false, r0.why);
    const h = heatRoll(K.CROPS[crop].heat, 'grow op'); save(); emit('harvest', { i, crop, n: r0.n }); redraw();
    const r = res(true, `${K.CROPS[crop].icon} Cut ${r0.n} ${K.CROPS[crop].name}${r0.lost ? ` (${r0.lost} left to rot: your stash is full)` : ''}.${heatLine(h)}`, { n: r0.n, crop, heat: h }); toast(r.msg, 3200); return r;
  });
}
function sell(buyer, crop, qty) {
  return AG.run('sell:' + buyer + ':' + crop, () => {
    const b = blocked(); if (b) return res(false, b);
    if (buyer === 'skiv' && !atGulch()) return res(false, `Skiv only deals at ${K.SITE.name}.`);
    if (buyer === 'xen7' && !atPost()) return res(false, 'The Xen-7 aliens buy at their trading post.');
    const q = K.quoteSale(S, buyer, crop, qty ?? (S.stash[crop] | 0)); if (!q.ok) return res(false, q.why);
    K.applySale(S, q); earnCr(q.cash); const h = K.BUYERS[buyer].heat ? heatRoll(K.BUYERS[buyer].heat, 'dealing') : null; save(); emit('sell', { ...q }); redraw();
    const who = buyer === 'skiv' ? 'Skiv counts it twice and pays' : 'The Xen-7 aliens hum and pay';
    const r = res(true, `💰 ${q.qty} ${K.CROPS[crop].name}: ${who} ${q.cash.toLocaleString('en-US')} cr.${heatLine(h)}`, { ...q, heat: h }); toast(r.msg, 3200); return r;
  });
}
const heatLine = h => (!h ? '' : h.raid ? ' 🚨 Someone talked. ColSec drones are inbound!' : h.hot ? ' 🚨 Someone saw that. Heat +1.' : '');
// BUSTED: ColSec takes a quarter of the stash you carry. The consequences module owns any fine; we add none.
let lastBusted = null, lastSeize = '';
function onBust() {
  const P = game()?.progress?.stats; if (P && fin(P.busted)) lastBusted = P.busted;
  const r = K.seize(S); if (!r.n) return null; save(); lastSeize = `ColSec bagged ${r.n} unit${r.n === 1 ? '' : 's'} of your gulch stash.`;
  emit('seized', { n: r.n, took: r.took }); setTimeout(() => toast(lastSeize, 4200), 2600); return r;
}

// ---------- the sandworm hook (and anything else that eats crops) ----------
function plots() {
  const c = siteW(); if (!c || !S.owned) return [];
  return S.racks.map((r, i) => ({ id: r.id, i, x: c.x + K.RACK_SPOTS[i][0], z: c.z + K.RACK_SPOTS[i][1], crop: r.crop, growth: r.growth, ripe: !!r.crop && r.growth >= 1 }));
}
function damage(plotId) { if (inPit()) return { ok: false, why: 'pit' }; const r = K.damage(S, +plotId); if (r.ok) { save(); emit('damage', { id: r.id, i: r.i, crop: r.snap.crop }); redraw(); } return r; }
function restore(plotId, snap) { const r = K.restore(S, +plotId, snap); if (r.ok) { save(); emit('restore', { id: +plotId, i: r.i }); redraw(); } return r; }

// ---------- SSX.base (guarded): a build:false lot the op owns ----------
let baseHook = null;
function plotDef() { return { id: K.PLOT_ID, name: K.SITE.name, district: 'Mars badlands', at: K.SITE.at, price: K.PRICES.op, owned: () => !!S.owned, build: false, pieces: [], blurb: 'No address, no questions. Camo netting and stolen grid power.' }; }
function hookBase(refresh) {
  const b = window.SSX?.base;
  if (baseHook === 'api') { if (refresh) { try { b?.refresh?.(); } catch (e) { /* */ } } return; }
  if (b?.registerPlot) { baseHook = 'api'; try { b.registerPlot(plotDef()); } catch (e) { console.warn('farm2 base', e); } return; }
  if (b || baseHook === 'queued') return;
  const q = (window.SSX_pending = window.SSX_pending || {}); (q.plots = q.plots || []).push(plotDef()); baseHook = 'queued';
}

// ---------- the op: plinth, camo net, rust container, Skiv, grow racks, lamps ----------
let scene = null, G = null, rackG = null, lamps = [], drones = null, lightsOffT = 0, rackKey = '', lastTc = null;
function mat(c, o = {}) { return new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.85, metalness: o.m ?? 0.1, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 0, transparent: !!o.t, opacity: o.t ?? 1, side: o.ds ? THREE.DoubleSide : THREE.FrontSide, depthWrite: o.t ? false : true }); }
function box(w, h, d, m, x, y, z, g) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y + h / 2, z); g.add(b); return b; }
function sign(text, fg, bg, w) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 96); x.fillStyle = fg; x.font = '900 52px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 52);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, w * 96 / 512), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide }));
}
function teardown() { if (G) { G.parent?.remove(G); G.traverse(o => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); }); } G = null; rackG = null; lamps = []; drones = null; rackKey = ''; try { window.SSX?.minimap?.clear?.('farm2'); } catch (e) { /* */ } }
function build(sc) {
  teardown(); const p = siteW(); if (!p) return; G = new THREE.Group(); G.name = 'farm2';
  G.position.set(p.x, ground(p.x, p.z) - 0.15, p.z); sc.add(G);
  box(24, 2.4, 24, mat(0x6a3a26), 0, -2.2, 0, G); // a rusty plinth: no floating lip where the dunes dip
  for (const [x, z, w, d] of [[-11.5, 0, 0.3, 23], [11.5, 0, 0.3, 23], [0, -11.5, 23, 0.3], [4, 11.5, 15, 0.3]]) box(w, 1.3, d, mat(0x5b4636, { m: 0.4 }), x, 0.2, z, G); // scrap fence, a gap at the south-west
  const ctr = box(6, 2.6, 2.4, mat(0x7a3b22, { m: 0.5, r: 0.7 }), -6, 0.2, -9, G); ctr.name = 'farm2-container';
  const tag = sign('KEEP OUT', '#ff2a2a', '#1a1a1a', 4); tag.position.set(-6, 1.7, -7.78); G.add(tag);
  box(1.4, 1, 1, mat(0x2b2b2b, { m: 0.6 }), 8.5, 0.2, -9, G); // the stolen-power generator
  const sk = new THREE.Group(); sk.name = 'farm2-skiv';
  const bd = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 1.1, 3, 8), mat(0x3d3d2e)); bd.position.y = 1.05; sk.add(bd);
  const hd = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), mat(0x6e5a48)); hd.position.y = 2.0; sk.add(hd);
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.6, 8), mat(0x22221a)); hood.position.y = 2.25; sk.add(hood);
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.05), mat(0xff3b30, { e: 0xff2a00, ei: 1.5 })); eye.position.set(0, 2.03, 0.27); sk.add(eye);
  sk.position.set(K.SKIV_AT[0], 0.2, K.SKIV_AT[1]); sk.rotation.y = 0.5; G.add(sk);
  for (const [x, z] of [[-8.5, -4], [8.5, -4], [-8.5, 7.5], [8.5, 7.5]]) box(0.2, 4.4, 0.2, mat(0x4d4d40), x, 0.2, z, G);
  const net = box(17.6, 0.05, 12, mat(0x6b7a42, { t: 0.5, ds: true }), 0, 4.6, 1.75, G); net.name = 'farm2-net';
  for (let k = 0; k < 7; k++) { const rag = box(1.6 + (k % 3) * 0.5, 0.06, 1.2, mat(k % 2 ? 0x6b5a3a : 0x3b4a2a, { ds: true }), -7 + k * 2.3, 4.62, -3 + ((k * 37) % 11), G); rag.rotation.y = k * 0.7; }
  rackG = new THREE.Group(); G.add(rackG);
  drones = new THREE.Group(); drones.visible = false; G.add(drones);
  for (let k = 0; k < 2; k++) { const d = new THREE.Group(); box(1.2, 0.3, 1.2, mat(0x222831, { m: 0.7 }), 0, 0, 0, d); const l = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mat(k ? 0x3b82f6 : 0xff3b30, { e: k ? 0x3b82f6 : 0xff3b30, ei: 2 })); l.position.y = -0.1; d.add(l); drones.add(d); }
  rebuild(true);
  try { window.SSX?.minimap?.addMarks?.('farm2', [{ x: p.x, z: p.z, color: '#ff3b30', r: 3, ring: true }]); } catch (e) { /* */ }
}
const leafMat = {};
function rebuild(force) {
  if (!rackG) return; const key = JSON.stringify([S.owned, S.racks.map(r => [r.crop, Math.round(r.growth * 10)]), lightsOffT > 0]);
  if (!force && key === rackKey) return; rackKey = key;
  for (const c of [...rackG.children]) { rackG.remove(c); c.traverse(o => { o.geometry?.dispose?.(); }); }
  lamps = [];
  const s = sign(S.owned ? 'RED STATIC GULCH' : 'NO TRESPASS · ASK SKIV', '#ffffff', S.owned ? '#3a0d0d' : '#111111', 5); s.position.set(-4, 1.4, 11.7); rackG.add(s);
  S.racks.forEach((r, i) => {
    const [x, z] = K.RACK_SPOTS[i], g = new THREE.Group(); g.position.set(x, 0, z); g.name = 'farm2-rack-' + i; rackG.add(g);
    box(1.4, 0.8, 3, mat(0x6d4c3a, { m: 0.5 }), 0, 0.2, 0, g);
    const lamp = box(1.5, 0.08, 3.1, mat(0xb44bff, { e: 0xa020f0, ei: lightsOffT > 0 ? 0 : 0.9 }), 0, 3.2, 0, g); lamps.push(lamp);
    for (const zz of [-1.4, 1.4]) box(0.08, 3, 0.08, mat(0x555555), 0, 0.2, zz, g);
    const c = K.CROPS[r.crop]; if (!c) return; const gr = Math.max(0.12, r.growth);
    const m = leafMat[r.crop] ||= mat(c.color, { e: c.color, ei: r.crop === 'glowcactus' || r.crop === 'ghostspore' ? 0.5 : 0.15 });
    for (let k = 0; k < 4; k++) { const cm = box(0.32, 0.9 * gr, 0.32, m, (k % 2 ? 0.3 : -0.3), 1.0, -1.05 + k * 0.7, g); cm.name = 'farm2-crop'; if (r.crop === 'voidpoppy' && r.growth >= 1) { const bud = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 4), m); bud.position.set(cm.position.x, 1.0 + 0.9 * gr + 0.1, cm.position.z); g.add(bud); } }
  });
}
function redraw() { rebuild(true); if (panel?.classList.contains('show')) render(); }

// ---------- UI: one context button, one caption (raid), a small sheet ----------
const css = `
#f2Act{position:fixed;z-index:15;left:calc(14px + env(safe-area-inset-left));bottom:calc(250px + env(safe-area-inset-bottom));display:none;min-height:52px;min-width:120px;padding:6px 16px;border-radius:14px;border:3px solid #fff;background:#000;color:#fff;font:900 17px/1.1 system-ui,sans-serif;touch-action:manipulation;box-shadow:0 2px 10px #000}
#f2Act.on{display:block}
#f2Cap{position:fixed;z-index:14;top:calc(122px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);display:none;width:max-content;max-width:min(460px,calc(100vw - 24px));padding:7px 14px;border-radius:14px;border:3px solid #ff3b30;background:#000;color:#fff;font:800 16px/1.25 system-ui,sans-serif;pointer-events:none}
#f2Cap.on{display:block}#f2Cap small{display:block;font-weight:700;font-size:13px}
#f2Panel{position:fixed;inset:0;z-index:58;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55)}
#f2Panel.show{display:flex}#f2Panel .wrap{width:min(480px,calc(100vw - 20px));max-height:calc(100vh - 40px);overflow:auto;background:#000;color:#fff;border:3px solid #fff;border-radius:16px;padding:14px 14px 10px;font:600 15px/1.35 system-ui,sans-serif}
#f2Panel h2{margin:0 0 4px;font:900 21px/1.2 system-ui,sans-serif}#f2Panel p{margin:6px 0}#f2Panel .sub{color:#ddd;font-size:13px}
#f2Panel button{display:block;width:100%;min-height:48px;margin:8px 0 0;padding:8px 12px;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:800 15px/1.2 system-ui,sans-serif;text-align:left;touch-action:manipulation}
#f2Panel button.pri{border-width:3px}#f2Panel button:disabled{opacity:1;color:#c8c8c8;border-style:dashed;border-color:#8a8a8a}#f2Panel button small{display:block;font-weight:600;font-size:12px;opacity:.85}
#f2Panel .msg{min-height:18px;margin-top:8px;color:#ffd400;font-weight:800}
body.f2CapOn #farmGuide{display:none!important}
`;
let actBtn = null, capEl = null, panel = null, pBody = null, pMsg = null, pMode = 'op', capKey = '', plantFor = null;
function tap(el, fn) { let last = 0; const g = e => { const n = performance.now(); if (e?.type === 'click' && n - last < 700) return; if (e?.type === 'pointerup') last = n; fn(e); }; (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, g); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function ui() {
  if (actBtn) return; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  actBtn = document.createElement('button'); actBtn.id = 'f2Act'; actBtn.type = 'button'; actBtn.textContent = '🏴 Gulch'; actBtn.setAttribute('aria-label', 'Open the grow op'); document.body.appendChild(actBtn);
  tap(actBtn, () => open(raid ? 'op' : 'op'));
  capEl = document.createElement('div'); capEl.id = 'f2Cap'; capEl.setAttribute('role', 'status'); document.body.appendChild(capEl);
  panel = document.createElement('div'); panel.id = 'f2Panel'; panel.innerHTML = '<div class="wrap" role="dialog" aria-label="Grow op"><div id="f2Body"></div><div class="msg" id="f2Msg" aria-live="polite"></div></div>'; document.body.appendChild(panel);
  pBody = panel.querySelector('#f2Body'); pMsg = panel.querySelector('#f2Msg');
  panel.addEventListener('pointerup', e => { if (e.target === panel) close(); });
  try { window.SSX.registerMenuItem({ id: 'rmFarm2', label: '🏴 Grow op', onTap: () => open(atPost() ? 'post' : 'op') }); } catch (e) { console.warn('farm2 menu', e); }
  // one row in the Xen-7 trading post's 👽 Trade sheet (post mode) while you hold stash
  (window.SSX.farmRows ||= []).push({ id: 'farm2', row: farmRow, tap: () => open('post') });
}
function farmRow(ctx) {
  if (ctx.mode !== 'post') return null; const n = K.stashCount(S); if (!n) return null;
  return { label: `🏴 Sell gulch stash · ${n} unit${n === 1 ? '' : 's'}`, sub: 'The aliens pay 1.2x what Skiv does. No questions.', pri: true };
}
function btn(a, label, sub, o = {}) { return `<button type="button" data-a="${a}"${o.i != null ? ` data-i="${o.i}"` : ''}${o.c ? ` data-c="${o.c}"` : ''}${o.b ? ` data-b="${o.b}"` : ''} class="${o.pri ? 'pri' : ''}" ${o.dis ? 'disabled' : ''}>${label}${sub ? `<small>${sub}</small>` : ''}</button>`; }
const stashWords = () => K.CROP_IDS.filter(k => S.stash[k] > 0).map(k => `${K.CROPS[k].icon} ${S.stash[k]} ${K.CROPS[k].name}`).join(', ');
let pGen = 0;
function render() {
  if (!pBody) return; const b = blocked(), cr = credits(), stars = starBal(), here = atGulch(), d = K.day(S);
  let x = '';
  if (pMode === 'post') {
    x += `<h2>👽 Sell gulch stash</h2><p class="sub">💰 ${cr.toLocaleString('en-US')} cr · the Xen-7 aliens pay 1.2x, no questions</p>`;
    const pt = atPost(); let any = false;
    for (const k of K.CROP_IDS) { const n = S.stash[k] | 0; if (!n) continue; any = true; const u = K.unitPrice(d, k, 'xen7'); x += btn('sell', `${K.CROPS[k].icon} Sell ${n} ${esc(K.CROPS[k].name)} · ${u} cr each`, `${(u * n).toLocaleString('en-US')} cr in all`, { b: 'xen7', c: k, pri: true, dis: !!b || !pt }); }
    if (!any) x += '<p>Your stash is empty. Grow something at the gulch.</p>';
    if (!pt) x += '<p class="sub">Drive to the Xen-7 Trading Post to sell.</p>';
  } else {
    x += `<h2>🏴 ${K.SITE.name}</h2><p class="sub">💰 ${cr.toLocaleString('en-US')} cr · ⭐ ${stars}${b ? ' · ' + esc(b) : ''}</p>`;
    if (raid) x += btn('lights', `💡 Kill the grow lights · drones in ${Math.ceil(raid.t)} s`, 'Go dark and ColSec flies past. Ignore it and they grab a quarter of your stash.', { pri: true, dis: !here });
    if (!here) { const m = me(), s = siteW(); x += `<p>${esc(m && s ? K.directions(m, s) : `${K.SITE.name} is out in the Mars dunes.`)}</p>`; }
    if (!S.owned) {
      x += '<p>A dead-end gulch under camo netting. Stolen grid power, no paperwork. Skiv sells it as is.</p>';
      const where = here ? '' : 'Go to the gulch to buy it.';
      x += btn('buy', `🏴 Buy the gulch · ${K.PRICES.op.toLocaleString('en-US')} cr`, where || 'Charged once.', { c: 'cr', pri: true, dis: !!b || !!where || cr < K.PRICES.op });
      x += btn('buy', `⭐ Buy the gulch · ${K.starPrice(K.PRICES.op).toLocaleString('en-US')} ⭐`, where || (stars < K.starPrice(K.PRICES.op) ? `You have ${stars} ⭐.` : 'Charged once.'), { c: 'stars', dis: !!b || !!where || stars < K.starPrice(K.PRICES.op) || !STARS()?.spend });
    } else if (plantFor != null && S.racks[plantFor]) {
      x += `<p>🪴 Plant rack ${plantFor + 1} with:</p>`;
      for (const k of K.CROP_IDS) { const c = K.CROPS[k]; x += btn('plant', `${c.icon} ${esc(c.name)} · ${c.seed} cr`, `${c.hours} h · ${c.yield} a rack · Skiv pays ~${K.unitPrice(d, k)} cr each`, { i: plantFor, c: k, dis: !!b || !here || cr < c.seed }); }
      x += btn('back', '← Back', '');
    } else {
      x += `<p>📦 Stash: ${K.stashCount(S) ? esc(stashWords()) : 'empty'} (${K.stashCount(S)}/${K.LIMITS.stash}).</p>`;
      S.racks.forEach((r, i) => {
        const c = K.CROPS[r.crop];
        if (!c) x += btn('pick', `🪴 Rack ${i + 1}: empty · Plant`, 'Pick a crop.', { i, dis: !!b || !here });
        else if (r.growth >= 1) x += btn('harvest', `${c.icon} Rack ${i + 1}: ${esc(c.name)} is ripe · Harvest`, `${K.yieldOf(r)} units. Cutting it can draw heat.`, { i, pri: true, dis: !!b || !here });
        else x += btn('noop', `${c.icon} Rack ${i + 1}: ${esc(c.name)} · ${Math.floor(r.growth * 100)}%`, `Ripe in ${Math.ceil((1 - r.growth) * c.hours)} h.`, { i, dis: true });
      });
      if (S.racks.length < K.LIMITS.racks) {
        x += btn('rack', `🪴 Add a grow rack · ${K.PRICES.rack} cr`, `${S.racks.length}/${K.LIMITS.racks} under the net.`, { c: 'cr', dis: !!b || !here || cr < K.PRICES.rack });
        if (STARS()?.spend) x += btn('rack', `⭐ Add a grow rack · ${K.starPrice(K.PRICES.rack)} ⭐`, '', { c: 'stars', dis: !!b || !here || stars < K.starPrice(K.PRICES.rack) });
      }
      for (const k of K.CROP_IDS) { const n = S.stash[k] | 0; if (!n) continue; const u = K.unitPrice(d, k, 'skiv'); x += btn('sell', `💰 Sell ${n} ${esc(K.CROPS[k].name)} to Skiv · ${u} cr each`, `${(u * n).toLocaleString('en-US')} cr. Skiv talks when he drinks.`, { b: 'skiv', c: k, dis: !!b || !here }); }
      if (K.stashCount(S)) x += '<p class="sub">The Xen-7 aliens at the trading post pay 1.2x.</p>';
    }
  }
  x += btn('close', 'Close', '');
  const gen = ++pGen; pBody.innerHTML = x;
  pBody.querySelectorAll('button[data-a]').forEach(el => tap(el, () => { if (el.disabled || gen !== pGen || !el.isConnected || performance.now() - openedAt < OPEN_GUARD_MS) return; act(el.dataset); }));
}
function act(d) {
  const a = d.a, i = d.i != null ? +d.i : null; if (a === 'close') return close(); let r = null;
  if (a === 'buy') r = buy(d.c); else if (a === 'rack') r = rack(d.c); else if (a === 'pick') { plantFor = i; r = { ok: true, msg: '' }; } else if (a === 'back') { plantFor = null; r = { ok: true, msg: '' }; }
  else if (a === 'plant') { r = plant(i, d.c); if (r.ok) plantFor = null; } else if (a === 'harvest') r = harvest(i); else if (a === 'sell') r = sell(d.b, d.c); else if (a === 'lights') r = killLights();
  if (panel.classList.contains('show')) { const m = pMsg.textContent; if (!r?.dup) openedAt = performance.now(); render(); pMsg.textContent = r?.dup ? m : (r?.msg || ''); }
}
const OPEN_GUARD_MS = 400; let openedAt = -1e9;
function open(mode = 'op') { if (!panel) return; openedAt = performance.now(); pMode = mode === 'post' ? 'post' : 'op'; plantFor = null; pMsg.textContent = ''; render(); panel.classList.add('show'); try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ } emit('open', { mode: pMode }); }
function close() { panel?.classList.remove('show'); }
function otherUp() { return !!document.querySelector('#farmPanel.show, #hvPanel.show, #stillPanel.show, #hvCap.on, #stillCap.on, #dlrSheet, #cqScreen.on, #wormCap.on'); }
function refreshUi(force) {
  if (!actBtn) return; const pit = inPit(), here = atGulch() && !pit;
  const showAct = here && !otherUp() && !panel.classList.contains('show');
  if (force || actBtn.classList.contains('on') !== showAct) actBtn.classList.toggle('on', showAct);
  let cap = '';
  if (raid && onMars() && !pit) cap = `🚁 ColSec drones sweeping ${K.SITE.name}: ${Math.ceil(raid.t)} s<small>${here ? 'Open 🏴 Gulch and kill the grow lights.' : 'Get back and kill the grow lights.'}</small>`;
  if (otherUp() || panel.classList.contains('show')) cap = '';
  if (force || cap !== capKey) { capKey = cap; capEl.innerHTML = cap; capEl.classList.toggle('on', !!cap); document.body.classList.toggle('f2CapOn', !!cap); }
}

// ---------- per frame ----------
let uiT = 0, wasMars = false;
function tick(dt, tc) {
  lastTc = tc; if (!fin(dt)) return; ownH += dt / 60;
  const m = onMars();
  if (!m) { if (G) G.visible = false; if (wasMars) { wasMars = false; refreshUi(); } if ((uiT -= dt) <= 0) { uiT = 0.25; refreshUi(); } return; }
  wasMars = true;
  if (!G || scene !== tc.scene) { scene = tc.scene; if (scene) build(scene); hookBase(); }
  if (G) G.visible = true;
  if (raid) { raid.t -= dt; if (drones) { drones.visible = true; const t = performance.now() / 1000; drones.children.forEach((d, k) => d.position.set(Math.cos(t * 0.8 + k * Math.PI) * 9, 9 + Math.sin(t * 2 + k) * 0.6, Math.sin(t * 0.8 + k * Math.PI) * 9)); } if (raid.t <= 0) endRaid(); }
  else if (drones?.visible) drones.visible = false;
  if (lightsOffT > 0) { lightsOffT -= dt; if (lightsOffT <= 0) rebuild(true); }
  if ((uiT -= dt) <= 0) {
    uiT = 0.25; const h = clockH();
    if (S.clockAt == null || h < S.clockAt) S.clockAt = h;
    const dh = h - S.clockAt; if (dh > 0.05) { S.clockAt = h; const r = K.advance(S, dh); if (S.owned) { save(); rebuild(); if (r.ripe.length) { emit('ripe', { racks: r.ripe }); if (atGulch()) toast(`🌱 Rack ${r.ripe.map(i => i + 1).join(', ')} ripe at the gulch.`); } } }
    const P = game()?.progress?.stats; if (P && fin(P.busted)) { if (lastBusted !== null && P.busted > lastBusted) onBust(); lastBusted = P.busted; }
    refreshUi(); if (panel?.classList.contains('show') && raid) { const lb = pBody.querySelector('button[data-a="lights"]'); if (lb?.firstChild) lb.firstChild.textContent = `💡 Kill the grow lights · drones in ${Math.ceil(raid.t)} s`; }
  }
}

// ---------- API ----------
function status() {
  return { owned: S.owned, paidWith: S.paidWith, racks: S.racks.map(r => ({ ...r })), stash: { ...S.stash }, stashCount: K.stashCount(S), hours: S.hours, day: K.day(S), stats: { ...S.stats },
    raid: raid ? { t: raid.t } : null, lastRaid, at: { gulch: atGulch(), post: atPost() }, pit: inPit(), site: siteW(), restored: restoredFrom, saveErr, lastSeize,
    ui: { act: actBtn?.classList.contains('on') ? actBtn.textContent : '', caption: capEl?.classList.contains('on') ? capEl.textContent : '', panel: !!panel?.classList.contains('show') } };
}
const api = {
  status, plots, damage, restore, buy, rack, plant, harvest, sell, killLights, open, close,
  on: f => { if (typeof f !== 'function') return () => {}; subs.add(f); return () => subs.delete(f); },
  PRICES: { ...K.PRICES, starRate: K.STAR_RATE }, CROPS: K.CROPS, SITE: K.SITE,
  get state() { return JSON.parse(JSON.stringify(S)); }, get rows() { return plots(); },
  debug: {
    reset() { AG.reset(); S = K.fresh(); raid = null; lastRaid = ''; lastSeize = ''; lightsOffT = 0; rng = Math.random; try { localStorage.removeItem(K.SAVE_KEY); localStorage.removeItem(K.BAK_KEY); } catch (e) { /* */ } restoredFrom = null; rebuild(true); return status(); },
    reload() { load(); rebuild(true); return status(); }, state: () => JSON.parse(JSON.stringify(S)), ag: () => AG.reset(),
    skip(h) { const r = K.advance(S, +h || 0); save(); rebuild(true); if (panel?.classList.contains('show')) render(); return r; },
    rng(v) { rng = typeof v === 'function' ? v : (v == null ? Math.random : () => +v); return true; },
    raid() { if (!raid) startRaid(); return status().raid; }, endRaid: () => endRaid(), bust: () => onBust(), setRaidT(t) { if (raid) raid.t = +t; return status().raid; },
    give(crop, n) { if (!K.CROPS[crop]) return false; S.stash[crop] = Math.min(K.LIMITS.stash, (S.stash[crop] | 0) + (n | 0)); save(); return true; },
    goto(o = {}) { const s = surf(), p = o.post ? postW() : siteW(); if (!s || !p) return false; s.debugMove(p.x + (o.dx ?? 0), p.z + (o.dz ?? 9), o.yaw ?? 0); return p; }
  }
};
(function boot() {
  if (!window.SSX?.registerSurfaceTick || !window.__app || !window.SSX.registerMenuItem) { setTimeout(boot, 200); return; }
  if (window.SSX.farm2) return; window.SSX.farm2 = api; ui();
  try { window.SSX.on?.('game:down', d => { if (/bust/i.test(d?.why || '')) { try { onBust(); } catch (e) { console.warn('farm2 bust', e); } } }); } catch (e) { /* the tick's busted counter covers it */ }
  try { window.SSX.registerSurfaceTick(tick); } catch (e) { console.warn('farm2 tick', e); }
})();
