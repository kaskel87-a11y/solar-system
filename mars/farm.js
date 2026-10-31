/*
 * mars/farm.js: Mars farming (Marsmania). Buy the Dustbowl Homestead out past the last district, put up a greenhouse
 * dome, add hydroponic racks and grow potatoes, algae mats, glow-berries and ghost lichen (the fictional contraband crop,
 * it dries into Glow-dust for SSX.contraband's stash). Crops grow on the Mars clock, need water and power, take storm
 * damage, ripen and go to the silo. Sell at the Xen-7 Trading Post, where three alien buyers pay cash, rare items or
 * favors at prices that shift every game day. Raiders come for a full silo. Fiction only.
 *
 * Reuses (all guarded; each one falls back if it isn't loaded):
 *   SSX.time (#30)    hour() deltas drive growth; skip() moves it with set(). Else SSX.empire.clock().hour (#52), else
 *                     our own clock (2 real minutes per game hour, like the street clock).
 *   SSX.storm (#50)   active() / intensity() damage crops each game hour; on('start'|'peak'|'end') captions.
 *                     Else only farm.debug.storm() (tests).
 *   SSX.raids (main)  start({ id, pos, radius, attackers, waves, onWin, onLose, label }). Win = bounty, lose = raiders
 *                     take 60% of the silo. Else a small timer raid (be at the farm when it ends).
 *   SSX.contraband    add('glowdust', n) for ripe lichen, add('voidhoney') for an Oru trade. Else it stays in the silo.
 *   SSX.base (#24)    registerPlot (build:false) + registerPiece (dome, racks); refresh()/syncOwners() after Buy. Guarded.
 *   SSX.empire (#52)  on('hour') drives the clock; yieldRaid('farm') / 'raid:request' + raidSlot() before a raid. Guarded.
 * UI (team HUD rules): ☰ → 🌱 Farm, plus ONE context button (#farmAct) only while you stand at the homestead or the
 *   trading post. No permanent chips. Plain-word directions. One message at a time (in the open sheet, else one toast).
 *   Black/white, 48px buttons, __onTap. Safe in the Rust Pit (nothing shows or starts there) and in floating cars
 *   (land first; growth keeps going).
 * window.SSX.farm: status() buy() buildDome() addRack() plant(i, crop) harvest(i|'all') refill('water'|'power') patch()
 *   buyers() sell(buyer, crop, qty) useFavor(id) raid(opts) skip(hours) clock() places() open(mode) close() on(type?, fn)
 *   CROPS, debug.*  Events (on(), window 'ssx:farm', SSX.emit('farm:<type>')): buy, dome, rack, plant, ripe, harvest,
 *   refill, patch, wilt, storm, sale, favor, raid, raid:end, stash, day, load, expand, expand:fail.
 * Expansions: expand(id, 'cr'|'stars') for dome2 / dome3 / water / power / silo, expansions(), caps(). ONE 🧱 Expand row
 *   in the farm sheet opens the sub-list ('… cr' and '… ⭐' buttons). Extra domes go on their own 20 x 20 m base lots
 *   (farm-annex-1 north, farm-annex-2 north-east, registered with SSX.base only once bought), 6 racks each. Stars go through
 *   SSX.stars canSpend/spend/refund only (rank never drops). Bought = saved: a failed save puts it back and refunds.
 * Save: localStorage 'ssx.farm.v1' (expansions live inside it as exp: { domes, water, power, silo }; no new key).
 */
import * as THREE from 'three';
import * as F from './farmcore.js';

const app = () => window.__app, surf = () => app()?.surface, game = () => app()?.game || surf()?.game, world = () => surf()?.world;
const T = () => window.SSX?.time, EMP = () => window.SSX?.empire, STORM = () => window.SSX?.storm, RAIDS = () => window.SSX?.raids, CB = () => window.SSX?.contraband;
const fin = v => Number.isFinite(v);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PIT_AJ = [-292, -68], PIT_R = 12;

// ---------- state ----------
// v7.5.7 hotfix: load takes the first owned state from the save, its mirror, or SSX.base's homestead record (F.recover),
// so a bought farm never comes back as for sale. save() never lets an unowned state replace an owned one (only debug.reset),
// mirrors owned states to F.BAK_KEY, and reports a full storage once instead of failing silently.
const LS = (() => { try { return window.localStorage; } catch (e) { return null; } })();
const lsGet = k => { try { return LS?.getItem(k) ?? null; } catch (e) { return null; } };
function loadState() { const r = F.recover(lsGet(F.SAVE_KEY), lsGet(F.BAK_KEY), lsGet(F.BASE_SAVE_KEY)); restoredFrom = r.restored ? r.from : null; return r.s; }
let restoredFrom = null, restoreSaid = false, saveErr = null, saveWarned = false;
let S = loadState();
function save(force) {
  if (!LS) return false; const j = JSON.stringify(S);
  if (!force && !F.mayOverwrite(S, lsGet(F.SAVE_KEY))) return false; // never downgrade a stored farm
  const put = () => { LS.setItem(F.SAVE_KEY, j); if (S.owned) LS.setItem(F.BAK_KEY, j); else if (force) LS.removeItem(F.BAK_KEY); };
  try { put(); saveErr = null; return true; } catch (e) {
    try { LS.removeItem(F.BAK_KEY); LS.setItem(F.SAVE_KEY, j); saveErr = 'nobak'; return true; } catch (e2) { saveErr = String(e2?.name || e2); }
    if (!saveWarned) { saveWarned = true; try { app()?.toast?.('⚠️ This browser\u2019s storage for the game is full, so farm progress can\u2019t be saved.', 4200); } catch (e3) { /* */ } }
    return false;
  }
}
if (restoredFrom) save();
const subs = new Set();
function emit(type, d = {}) {
  const ev = { type, ...d, t: Date.now() };
  for (const s of [...subs]) { try { if (!s.type || s.type === type) s.fn(ev); } catch (e) { console.warn('farm listener', e); } }
  try { window.dispatchEvent(new CustomEvent('ssx:farm', { detail: ev })); } catch (e) { /* */ }
  try { window.SSX?.emit?.('farm:' + type, ev); } catch (e) { /* */ }
  return ev;
}
const on = (a, b) => { const s = typeof a === 'function' ? { fn: a } : { type: a, fn: b }; if (typeof s.fn !== 'function') return () => {}; subs.add(s); return () => subs.delete(s); };

// ---------- guarded game access ----------
function colony() { const c = surf()?.info?.colony || world()?.colony; return c && fin(c.x) && fin(c.z) ? c : null; }
const onMars = () => surf()?.info?.name === 'Mars' && !!colony() && !!app()?.state?.onSurface;
const W = at => { const c = colony(); return c ? { x: c.x + at[0], z: c.z + at[1] } : null; };
const me = () => { const i = surf()?.info; return i && fin(i.x) && fin(i.z) ? i : null; };
const credits = () => game()?.progress?.credits | 0;
function spend(n) { const g = game(); if (!g || n <= 0) return n <= 0; if (credits() < n) return false; if (g.spend) return !!g.spend(n); g.progress.credits -= n; try { g.save(); } catch (e) { /* */ } return true; }
function give(n) { const g = game(); if (!g?.progress || !(n > 0)) return; g.progress.credits += Math.round(n); try { g.save(); } catch (e) { /* */ } }
function ground(x, z) { try { const h = lastTc?.height?.(x, z); if (fin(h)) return h; } catch (e) { /* */ } try { const h = world()?.groundAt?.(x, z); if (fin(h)) return h; } catch (e) { /* */ } return 0; }
function inPit() {
  try { if (world()?.inDuel) return true; } catch (e) { /* */ }
  try { if (window.SSX?.fight?.debug?.inCage) return true; } catch (e) { /* */ }
  const i = me(), p = W(PIT_AJ); let at = p; try { const s = window.SSX?.fight?.status?.()?.at; if (Array.isArray(s)) at = W(s); } catch (e) { /* */ }
  return !!(i && at && Math.hypot(i.x - at.x, i.z - at.z) < PIT_R);
}
function floating() {
  const c = lastTc?.car; try { const G = window.SSX?.gravity; if (c && (G?.floating?.() || G?.isFloating?.())) return true; } catch (e) { /* */ }
  return !!(c && fin(c.y) && c.y - ground(c.x, c.z) > 4);
}
const distTo = id => { const i = me(), p = W(F.SITES[id].at); return i && p ? Math.hypot(i.x - p.x, i.z - p.z) : 1e9; };
// at the homestead: near its centre, or (expansions) on one of your extra lots north / north-east of it (lotOff / lotsInUse below)
const onAnnex = () => { const i = me(), p = W(F.SITES.farm.at); if (!i || !p) return false; for (let n = 1; n < lotsInUse(); n++) { const o = lotOff(n); if (Math.max(Math.abs(i.x - p.x - o[0]), Math.abs(i.z - p.z - o[1])) < 13) return true; } return false; };
const at = id => onMars() && (distTo(id) < F.SITES[id].r + 6 || (id === 'farm' && onAnnex()));
function blocked() { if (!onMars()) return 'Farming is on Mars.'; if (inPit()) return 'Not in the Rust Pit.'; if (floating()) return 'Land first.'; return null; }
function need(id) { const b = blocked(); if (b) return b; if (!at(id)) return directions(id); return null; }
function directions(id) { const i = me(), p = W(F.SITES[id].at); if (!i || !p) return `Go to ${F.SITES[id].name} on Mars.`; return F.directions(i, p, F.SITES[id].name, id === 'post' ? 'tap Trade' : 'tap Farm'); }

// ---------- clock: game hours from SSX.time, else SSX.empire, else our own ----------
let lastH = null, src = 'own', ownAcc = 0;
function srcHour() {
  try { const t = T(); const h = t?.hour?.() ?? t?.now?.(); if (fin(h)) return { h, src: 'SSX.time' }; } catch (e) { /* */ }
  try { const h = EMP()?.clock?.()?.hour; if (fin(h)) return { h, src: 'SSX.empire' }; } catch (e) { /* */ }
  return null;
}
function clockTick(dt) {
  const s = srcHour(); let dh = 0;
  if (s) { if (lastH == null || src !== s.src) { lastH = s.h; src = s.src; return 0; } dh = ((s.h - lastH) % 24 + 24) % 24; if (dh > 23.5) dh = 0; lastH = s.h; }
  else { src = 'own'; lastH = null; ownAcc += Math.min(dt, 0.5) / 120; if (ownAcc >= 0.05) { dh = ownAcc; ownAcc = 0; } }
  return dh;
}
const hourNow = () => { const s = srcHour(); return s ? s.h : (S.hours + 8) % 24; };

// ---------- SSX.base (Ben, #24): the homestead is a registered 20 x 20 lot; the dome and racks are base pieces ----------
// Guarded: no SSX.base yet -> queue on window.SSX_pending.{plots,pieces} (drained by base at init / every frame; same id replaces).
// No SSX.base at all -> we draw and charge everything ourselves, same layout.
const B = () => window.SSX?.base, PLOT = F.LOT.id;
// expansions: each extra dome has its own add-on lot (F.ANNEXES, registered only once it's bought, so no FOR SALE
// marker stands there before). Lot 0 = the homestead, lot n = F.ANNEXES[n - 1]. Racks run lot by lot: 0-5, 6-11, 12-17.
const LOT_IDS = [PLOT, ...F.ANNEXES.map(a => a.id)], lotIdx = id => LOT_IDS.indexOf(id), ourLot = id => lotIdx(id) >= 0;
const lotOff = n => n > 0 ? F.ANNEXES[n - 1].off : [0, 0];
const lotsInUse = () => S.owned ? 1 + Math.min(F.ANNEXES.length, S.exp?.domes | 0) : 1;
let baseHook = null, baseSub = null, adopting = false, synced = false, rackIds = [], annexReg = 0;
const SITE_LOCAL = () => F.SITES.farm.at;
function baseLot(id = PLOT) { try { return B()?.plots?.().find(p => p.id === id) || null; } catch (e) { return null; } }
function basePieces(id = PLOT) { if (!baseLot(id)) return []; try { const p = B().state(id)?.pieces; return Array.isArray(p) ? p.filter(x => x.type === F.LOT.dome.type || x.type === 'farm-rack').map(x => ({ ...x, plot: id, lot: lotIdx(id) })) : []; } catch (e) { return []; } }
function allPieces() { const out = []; for (const id of LOT_IDS) out.push(...basePieces(id)); return out; }
const pieceKey = p => p.plot + ':' + p.id;
function sortedRacks() { return allPieces().filter(p => p.type === 'farm-rack').sort((a, b) => (a.lot - b.lot) || String(a.id).localeCompare(String(b.id), undefined, { numeric: true })); }
// lot-local (homestead frame) centre of rack k: base pieces in lot order, else the layout slots of lot floor(k / 6)
function rackSpot(k, bRacks) {
  if (k < bRacks.length) { const p = bRacks[k], o = lotOff(p.lot), c = F.lotCentre(p.i, p.j, F.LOT.rackFp, p.r | 0); return { ...c, x: c.x + o[0], z: c.z + o[1], lot: p.lot, base: true }; }
  const lot = Math.min(F.ANNEXES.length, F.rackLot(k)), o = lotOff(lot), slot = F.LOT.rackSlots[Math.min(k - lot * F.LIMITS.racks, F.LOT.rackSlots.length - 1)], c = F.lotCentre(slot[0], slot[1], F.LOT.rackFp);
  return { ...c, x: c.x + o[0], z: c.z + o[1], lot, base: false };
}
function sortedRackIds() { return sortedRacks().map(pieceKey); }
const domeParts = (THREE, kit) => { const R = F.LOT.dome.r, glass = kit.std(0xcfefff, { transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.TorusGeometry(R, 0.12, 6, 40); ring.rotateX(Math.PI / 2); ring.translate(0, 0.3, 0);
  return [[new THREE.SphereGeometry(R, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), glass], [ring, kit.std(0xdddddd)], [kit.box(R * 2 - 0.4, 1.7, 0.3, 0, -0.55, R - 0.2), kit.std(0x777777)]]; };
const rackParts = (THREE, kit) => [[kit.box(1.6, 2.3, 3.4, 0, -0.45, 0), kit.std(0x9aa3ad, { metalness: 0.5 })], [kit.box(1.7, 0.06, 3.5, 0, 2.3, 0), kit.std(0x3b82f6, { emissive: 0x1d4ed8, emissiveIntensity: 0.4 })],
  [kit.box(0.1, 3.5, 0.1, 0, -0.3, -1.6), kit.std(0x777777)], [kit.box(0.1, 3.5, 0.1, 0, -0.3, 1.6), kit.std(0x777777)]];
function pieceDefs() {
  return [ // max is per lot (#24): one dome and six racks on each of the homestead's lots
    { id: F.LOT.dome.type, name: 'Greenhouse dome', icon: '🫧', cost: F.PRICES.dome, fp: F.LOT.dome.fp, max: 1, hp: 200, h: 6, solid: false, plots: [...LOT_IDS], parts: domeParts, onPlace: e => onBasePlace(e) },
    { id: 'farm-rack', name: 'Hydro rack', icon: '🪴', cost: F.PRICES.rack, fp: F.LOT.rackFp, max: F.LIMITS.racks, hp: 100, h: 2.4, plots: [...LOT_IDS], parts: rackParts, colliders: [[0, 0, 0.8, 1.7]], onPlace: e => onBasePlace(e) }
  ];
}
function plotDef() { return { id: PLOT, name: F.SITES.farm.name, district: 'Mars outskirts', at: SITE_LOCAL(), price: F.PRICES.plot, owned: () => !!S.owned, build: false, // build:false (#24): no base 🏗️ Build button here, the farm's one button drives place()
  blurb: 'Flat, cheap, and far from the patrols. Grow potatoes, sell to the aliens.' }; }
function annexPlotDef(n) { const a = F.ANNEXES[n - 1], c = SITE_LOCAL(); return { id: a.id, name: a.name, district: 'Mars outskirts', at: [c[0] + a.off[0], c[1] + a.off[1]], price: F.EXPANSIONS[n === 1 ? 'dome2' : 'dome3'].cr,
  owned: () => !!S.owned && (S.exp?.domes | 0) >= n, build: false, pieces: [F.LOT.dome.type, 'farm-rack'], blurb: 'More greenhouse room for the Dustbowl Homestead.' }; }
// annex lots join the base once bought (and on load for a save that has them)
function registerAnnexes() {
  const want = S.owned ? Math.min(F.ANNEXES.length, S.exp?.domes | 0) : 0; if (annexReg >= want) return;
  if (baseHook === 'api') { const b = B(); while (annexReg < want) { annexReg++; try { b.registerPlot(annexPlotDef(annexReg)); } catch (e) { console.warn('farm annex', e); } } return; }
  if (baseHook === 'queued') { const q = (window.SSX_pending = window.SSX_pending || {}); q.plots = q.plots || []; while (annexReg < want) q.plots.push(annexPlotDef(++annexReg)); }
}
function hookBase() {
  if (baseHook === 'api' || baseHook === 'old') { if (baseHook === 'api') registerAnnexes(); if (!baseSub && baseLot()) subBase(); return; }
  const b = B();
  if (b?.registerPlot && b?.registerPiece) {
    const was = baseHook; baseHook = 'api';
    if (was !== 'queued') { try { for (const d of pieceDefs()) b.registerPiece(d); b.registerPlot(plotDef()); } catch (e) { console.warn('farm base', e); } }
    registerAnnexes(); if (baseLot()) subBase(); return;
  }
  if (b) { baseHook = 'old'; return; } // a base without the add-on API: we keep drawing and charging ourselves
  if (baseHook === 'queued') { registerAnnexes(); return; }
  const q = (window.SSX_pending = window.SSX_pending || {}); (q.pieces = q.pieces || []).push(...pieceDefs()); (q.plots = q.plots || []).push(plotDef()); baseHook = 'queued'; registerAnnexes();
}
function subBase() {
  const b = B(); if (!b?.on || baseSub === b) return; baseSub = b; rackIds = sortedRackIds();
  try { b.on('remove', e => onBaseRemove(e)); } catch (e) { /* */ }
  try { b.on('lost', e => { if (e?.plotId !== PLOT) return; if (S.owned) syncLot(); refresh(true); }); } catch (e) { /* */ } // never downgraded: a refresh that saw us unowned is put back
  syncBase(); emit('base', { plot: PLOT, registered: true });
}
// keep S and the base's pieces in step: pieces placed in base's own Build flow join the farm; old saves get their pieces placed (we pay)
function syncBase() {
  if (synced || !baseLot() || !S.owned) return;
  for (let n = 1; n < lotsInUse(); n++) if (!baseLot(LOT_IDS[n])) return; // an annex lot still queued: try again next frame
  synced = true;
  const bp = basePieces(), hasDome = bp.some(p => p.type === F.LOT.dome.type), nR = sortedRacks().length;
  if (hasDome && !S.dome) { S.dome = true; S.domeHp = 100; }
  while (S.racks.length < Math.min(nR, F.caps(S).racks)) S.racks.push(F.freshRack());
  adopting = true;
  try {
    if (S.dome && !hasDome) { give(F.PRICES.dome); if (!basePlace(F.LOT.dome.type).ok) spend(F.PRICES.dome); }
    for (let n = 1; n < lotsInUse(); n++) placeAnnexDome(n);
    for (let k = nR; k < S.racks.length; k++) { give(F.PRICES.rack); if (!placeRack().ok) { spend(F.PRICES.rack); break; } }
  } finally { adopting = false; }
  rackIds = sortedRackIds(); save(); rebuildFarm(true);
}
// an extra dome is paid for by the expansion: its base piece goes up free (we hand base the piece cost, it takes it back)
function placeAnnexDome(n) {
  const id = LOT_IDS[n]; if (!id || !baseLot(id) || basePieces(id).some(p => p.type === F.LOT.dome.type)) return false;
  const was = adopting; adopting = true; let ok = false;
  try { give(F.PRICES.dome); ok = basePlace(F.LOT.dome.type, id).ok; if (!ok) spend(F.PRICES.dome); } finally { adopting = was; }
  return ok;
}
// next rack goes on the first lot in use with room (homestead, then north, then north-east)
function placeRack() {
  let why = 'No room left on the lot.';
  for (let n = 0; n < lotsInUse(); n++) { const id = LOT_IDS[n]; if (!baseLot(id)) continue; if (basePieces(id).filter(p => p.type === 'farm-rack').length >= F.LIMITS.racks) continue;
    const p = basePlace('farm-rack', id); if (p.ok) return { ...p, key: id + ':' + p.piece?.id }; why = p.why; }
  return { ok: false, why };
}
// base syncs owned() every frame; make it now: SSX.base.refresh() / syncOwners() when present, else re-register the plot (old base)
function reRegister(b, id = PLOT) { try { b.registerPlot(id === PLOT ? plotDef() : annexPlotDef(lotIdx(id))); } catch (e) { /* */ } }
function syncLot(b = B()) {
  if (!b || !S.owned || !baseLot()) return;
  const f = typeof b.refresh === 'function' ? 'refresh' : typeof b.syncOwners === 'function' ? 'syncOwners' : null;
  if (f) { try { b[f](); lotSync = f; return; } catch (e) { /* fall through */ } }
  let st; try { st = b.state?.(PLOT); } catch (e) { /* */ } if (st && st.owned !== false) return;
  lotSync = 'reregister'; reRegister(b);
}
let lotSync = null;
// place at the layout spot first, then anywhere free on the lot
function basePlace(type, plotId = PLOT) {
  const b = B(); if (!b?.place) return { ok: false, why: 'The base builder is not ready.' };
  const fp = type === F.LOT.dome.type ? F.LOT.dome.fp : F.LOT.rackFp, tries = [];
  if (type === F.LOT.dome.type) tries.push([F.LOT.dome.i, F.LOT.dome.j, 0]); else tries.push(...F.LOT.rackSlots.map(([i, j]) => [i, j, 0]));
  for (let j = 0; j <= F.LOT.size - fp[1]; j++) for (let i = 0; i <= F.LOT.size - fp[0]; i++) tries.push([i, j, 0]);
  syncLot(b); const c0 = credits(), cost = (type === F.LOT.dome.type ? F.PRICES.dome : F.PRICES.rack);
  let why = 'No room left on the lot.', retried = false;
  for (const [i, j, r] of tries) { let o; const put = () => { try { return b.place(plotId, type, i, j, r); } catch (e) { return { ok: false, why: String(e?.message || e) }; } };
    o = put(); if (!o?.ok && !retried && S.owned && /buy the lot/i.test(o?.why || '')) { retried = true; reRegister(b, plotId); o = put(); } // fallback: old base without refresh()
    if (o?.ok) { rackIds = sortedRackIds(); const over = (c0 - credits()) - cost; if (over > 0 && !adopting) give(over); return { ok: true, piece: o.piece, charged: c0 - credits() }; } if (o?.why && !/already there|off your lot|overlap|occupied/i.test(o.why)) { why = o.why; break; } }
  return { ok: false, why };
}
function onBasePlace(e) {
  if (adopting || !ourLot(e?.plotId)) return; const t = e?.piece?.type;
  if (t === F.LOT.dome.type && e.plotId === PLOT && !S.dome) { S.dome = true; S.domeHp = 100; }
  else if (t === 'farm-rack' && S.racks.length < F.caps(S).racks && S.racks.length < sortedRackIds().length) { const k = sortedRackIds().indexOf(e.plotId + ':' + e.piece.id); S.racks.splice(k >= 0 ? Math.min(k, S.racks.length) : S.racks.length, 0, F.freshRack()); }
  rackIds = sortedRackIds(); save(); dirty = true; refresh(true); guideTick();
}
function onBaseRemove(e) {
  if (!ourLot(e?.plotId)) return; const t = e?.type ?? e?.piece?.type, id = e?.pieceId ?? e?.piece?.id;
  if (t === F.LOT.dome.type || (!t && !basePieces().some(p => p.type === F.LOT.dome.type) && S.dome)) { if (e.plotId === PLOT) S.dome = false; } // an extra dome scrapped in base: we draw it ourselves
  else { const k = rackIds.indexOf(e.plotId + ':' + id); if (k >= 0 && k < S.racks.length) S.racks.splice(k, 1); else if (S.racks.length > sortedRackIds().length) S.racks.pop(); }
  rackIds = sortedRackIds(); save(); dirty = true; refresh(true); guideTick();
}

// ---------- SSX.empire 'hour' (Ben, #52): one event per game hour drives growth, upkeep and raid rolls ----------
// Guarded: no SSX.empire yet -> queue on window.SSX_pending.empire. The first event is a baseline; from then on our own clock stops
// advancing the farm (no double ticks). skip() that moves SSX.time swallows the hour events it causes (skipDebt).
let empOff = null, empHook = null, empOn = false, skipDebt = 0, skipDebtT = 0, empHours = 0;
function onHour(e) {
  if (!empOn) { if (e?.catchUp) return; empOn = true; emit('clock', { source: 'SSX.empire.hour', hour: e?.hour }); return; } // the first event (or burst) is a baseline: our clock already covered it
  if (skipDebt > 0 && performance.now() < skipDebtT) { skipDebt--; return; } skipDebt = 0;
  empHours++; advance(1, e?.catchUp ? 'catchup' : 'tick'); raidTick(0, 1); guideTick();
}
function hookEmpire() {
  if (empHook) return; const E = EMP();
  if (E?.on) { try { const off = E.on('hour', onHour); empOff = typeof off === 'function' ? off : null; } catch (e) { /* */ } empHook = 'api'; return; }
  if (E) { empHook = 'old'; return; }
  const q = (window.SSX_pending = window.SSX_pending || {}); (q.empire = q.empire || []).push(['hour', onHour]); empHook = 'queued';
}

// ---------- storms ----------
let dbgStorm = 0, stormSub = null;
function stormI() { try { const s = STORM(); if (s?.active?.()) { const i = +s.intensity?.(); return fin(i) ? F.clamp(i, 0, 1) : 0.5; } } catch (e) { /* */ } return dbgStorm; }
function hookStorm() {
  const s = STORM(); if (!s?.on || stormSub === s) return; stormSub = s;
  try { s.on('start', () => { if (S.owned && S.racks.some(r => r.crop)) say('🌪️ Dust storm coming. Your crops will take a beating.'); emit('storm', { phase: 'start' }); }); } catch (e) { /* */ }
  try { s.on('peak', () => emit('storm', { phase: 'peak', intensity: stormI() })); } catch (e) { /* */ }
  try { s.on('end', () => { if (S.owned && S.dome && S.domeHp < 60) say('🌤️ Storm over. The dome needs patching. ☰ → 🌱 Farm.'); emit('storm', { phase: 'end', domeHp: Math.round(S.domeHp) }); }); } catch (e) { /* */ }
}

// ---------- growth ----------
let lastDay = null;
function advance(dh, why = 'tick') {
  if (!(dh > 0)) return null;
  const ripe0 = S.racks.map(r => r.growth >= 1), d0 = F.day(S);
  const o = F.advance(S, dh, () => stormI());
  if (o.ripe.length) { emit('ripe', { racks: o.ripe, crops: o.ripe.map(i => S.racks[i].crop) }); if (!ripe0.every(Boolean)) say(`🌱 ${o.ripe.length === 1 ? F.CROPS[S.racks[o.ripe[0]].crop].name + ' are' : o.ripe.length + ' racks are'} ripe. Go to the homestead and harvest.`); }
  if (o.wilted && (o.dry || o.dark)) { emit('wilt', { dry: o.dry, dark: o.dark }); if (why !== 'tick' || Math.random() < 0.02) say(o.dry ? '💧 The farm tanks are dry. Crops are wilting.' : '🔌 The farm is out of power. Crops are wilting.'); }
  if (o.stormLoss > 0) emit('storm', { phase: 'damage', loss: Math.round(o.stormLoss * 10) / 10, domeHp: Math.round(S.domeHp) });
  const d1 = F.day(S); if (d1 !== d0) emit('day', { day: d1 });
  save(); dirty = true; return o;
}
function skip(hours) {
  hours = Math.max(0, +hours || 0); const t = T(); let via = 'own';
  try { if (t?.set && (t.hour || t.now)) { const h = (t.hour?.() ?? t.now()); if (empOn) { skipDebt += Math.floor(h + (hours % 24)) - Math.floor(h); skipDebtT = performance.now() + 3000; } t.set(((h + hours) % 24 + 24) % 24); via = 'SSX.time'; const s = srcHour(); if (s) { lastH = s.h; src = s.src; } } } catch (e) { via = 'own'; }
  const o = advance(hours, 'skip'); guideTick(); return { ok: true, hours, via, out: o, status: status() };
}

// ---------- actions ----------
function res(ok, msg, extra = {}) { if (msg) say(msg); refresh(true); guideTick(); return { ok, msg, ...extra }; }
function buy_() { const n = need('farm'); if (n) return res(false, n); const v = F.canBuy(S, credits()); if (!v.ok) return res(false, v.why); if (!spend(v.cost)) return res(false, 'Short on credits.');
  S.owned = true; S.water = 40; S.power = 40; save(); syncLot(); rebuildFarm(); emit('buy', { price: v.cost }); return res(true, `🏡 ${F.SITES.farm.name} is yours. Build the greenhouse dome next.`, { cost: v.cost }); }
function buildDome_() { const n = need('farm'); if (n) return res(false, n); const v = F.canDome(S, credits()); if (!v.ok) return res(false, v.why);
  if (baseLot() && basePieces().some(q => q.type === F.LOT.dome.type)) { S.dome = true; S.domeHp = 100; save(); rebuildFarm(true); return res(true, '🫧 Greenhouse dome is up. Add a hydroponic rack.', { cost: 0, via: 'base' }); } // already placed: adopt, no second charge
  if (baseLot()) { const p = basePlace(F.LOT.dome.type); if (!p.ok) return res(false, p.why); if (!S.dome) { S.dome = true; S.domeHp = 100; } save(); rebuildFarm(true); emit('dome', { price: v.cost, via: 'base' }); return res(true, '🫧 Greenhouse dome is up. Add a hydroponic rack.', { cost: v.cost, via: 'base' }); }
  if (!spend(v.cost)) return res(false, 'Short on credits.');
  S.dome = true; S.domeHp = 100; save(); rebuildFarm(); emit('dome', { price: v.cost }); return res(true, '🫧 Greenhouse dome is up. Add a hydroponic rack.', { cost: v.cost }); }
function addRack_(o = {}) { const n = need('farm'); if (n) return res(false, n); const v = F.canRack(S, credits()); if (!v.ok) return res(false, v.why);
  const st = F.actStale(S, 'rack', o.expect); if (st) return res(false, st);
  if (baseLot()) { const n0 = S.racks.length, p = placeRack(); if (!p.ok) return res(false, p.why); if (S.racks.length === n0) { const k = sortedRackIds().indexOf(p.key); S.racks.splice(k >= 0 ? Math.min(k, n0) : n0, 0, F.freshRack()); } if (S.racks.length > n0 + 1) S.racks.length = n0 + 1; save(); rebuildFarm(true); emit('rack', { n: S.racks.length, price: v.cost, via: 'base' }); return res(true, `🪴 Rack ${S.racks.length} installed. Plant something.`, { cost: v.cost, rack: S.racks.length - 1, via: 'base' }); }
  if (!spend(v.cost)) return res(false, 'Short on credits.');
  S.racks.push(F.freshRack()); save(); rebuildFarm(); emit('rack', { n: S.racks.length, price: v.cost }); return res(true, `🪴 Rack ${S.racks.length} installed. Plant something.`, { cost: v.cost, rack: S.racks.length - 1 }); }
function plant_(i, crop) { const n = need('farm'); if (n) return res(false, n); i = i == null ? S.racks.findIndex(r => !r.crop) : i | 0; const v = F.canPlant(S, i, crop, credits()); if (!v.ok) return res(false, v.why); if (!spend(v.cost)) return res(false, 'Short on credits.');
  F.plant(S, i, crop); save(); rebuildFarm(); emit('plant', { rack: i, crop, price: v.cost }); const c = F.CROPS[crop]; return res(true, `${c.icon} ${c.name} planted. Ripe in about ${c.hours} game hours if the water and power hold.`, { rack: i, cost: v.cost }); }
function harvest_(i = 'all') {
  const n = need('farm'); if (n) return res(false, n);
  const idx = i === 'all' ? S.racks.map((r, k) => (r.crop && r.growth >= 1 ? k : -1)).filter(k => k >= 0) : [i | 0];
  if (!idx.length) return res(false, 'Nothing is ripe yet.');
  const got = {}; let lost = 0, stash = 0;
  for (const k of idx) { const h = F.harvest(S, k); if (!h.ok) { if (i !== 'all') return res(false, h.why); continue; } got[h.crop] = (got[h.crop] || 0) + h.n; lost += h.lost; }
  if (got.lichen) stash = toStash();
  save(); rebuildFarm(); emit('harvest', { got, lost, stash });
  const words = Object.entries(got).map(([k, v]) => `${v} ${F.CROPS[k].name}`).join(', ') || 'nothing';
  return res(true, `🧺 Harvested ${words}.${stash ? ` ${stash} ghost lichen dried into Glow-dust for your stash.` : ''}${lost ? ` The silo is full: ${lost} rotted.` : ''}`, { got, lost, stash });
}
// hands-on harvest (mars/harvest.js, SSX.harvest): cut takes a ripe rack's crop off without banking it; bank puts crops in
// the silo (capped; lichen still dries into Glow-dust). o.hand: a hired hand works while you're away (owned farm is enough).
function cut_(i, o = {}) {
  const n = o.hand ? (S.owned ? null : 'Buy the homestead first.') : need('farm'); if (n) return res(false, n); i = i | 0; const r = S.racks[i];
  if (!r?.crop) return res(false, 'Nothing planted there.'); if (r.health <= 0) return res(false, 'That crop died.'); if (r.growth < 1) return res(false, `Not ripe yet (${Math.floor(r.growth * 100)}%).`);
  if (o.planted != null && r.planted !== o.planted) return res(false, 'That rack changed.');
  const crop = r.crop, k = F.yieldOf(r); S.racks[i] = F.freshRack(); save(); rebuildFarm(true); emit('cut', { rack: i, crop, n: k, via: o.via || 'hand' }); return res(true, '', { crop, n: k });
}
function bank_(items, o = {}) {
  const n = o.hand ? (S.owned ? null : 'Buy the homestead first.') : need('farm'); if (n) return res(false, n);
  const got = {}, left = {}; let room = Math.max(0, F.caps(S).silo - F.siloCount(S)), stash = 0, total = 0;
  for (const [c, q0] of Object.entries(items || {})) { const q = Math.max(0, q0 | 0); if (!F.CROPS[c] || !q) continue; const g = Math.min(q, room); room -= g; if (g) { S.silo[c] = (S.silo[c] || 0) + g; got[c] = g; total += g; } if (q - g) left[c] = q - g; }
  if (!total) return res(false, 'The silo is full. Sell some crops first.', { got, left, full: true });
  S.stats.harvested += total; if (got.lichen) stash = toStash();
  save(); emit('harvest', { got, lost: 0, stash, via: o.via || 'silo' }); return res(true, '', { got, left, stash, n: total });
}
function toStash() {
  const C = CB(), have = S.silo.lichen | 0; if (!C?.add || !have) return 0;
  let room = have; try { const c = C.capacity?.(); if (c && fin(c.max) && fin(c.used)) room = Math.max(0, Math.min(have, c.max - c.used)); } catch (e) { /* */ }
  if (!room) return 0; let r = null; try { r = C.add(F.CROPS.lichen.contraband, room, 1); } catch (e) { return 0; }
  const n = r?.ok === false ? 0 : (fin(r?.qty) ? r.qty : room); if (n > 0) { S.silo.lichen -= n; if (S.silo.lichen <= 0) delete S.silo.lichen; emit('stash', { item: 'glowdust', n }); }
  return n;
}
function refill_(what) { const n = need('farm'); if (n) return res(false, n); if (!S.owned) return res(false, 'Buy the homestead first.'); if (what !== 'water' && what !== 'power') return res(false, 'Water or power?');
  const q = F.refillCost(S, what); if (!q.units) return res(false, what === 'water' ? 'The tanks are full.' : 'The cells are full.'); if (!spend(q.cost)) return res(false, `That top-up is ${q.cost} cr.`);
  S[what] = F.caps(S)[what]; save(); emit('refill', { what, units: q.units, cost: q.cost }); return res(true, what === 'water' ? `💧 Tanks filled. ${q.cost} cr.` : `🔋 Power cells charged. ${q.cost} cr.`, q); }
function patch_() { const n = need('farm'); if (n) return res(false, n); if (!S.dome) return res(false, 'No dome to patch.'); if (S.domeHp >= 100) return res(false, 'The dome is sound.'); if (!spend(F.PRICES.patch)) return res(false, `A patch kit is ${F.PRICES.patch} cr.`);
  S.domeHp = 100; save(); emit('patch', { cost: F.PRICES.patch }); return res(true, `🩹 Dome patched. ${F.PRICES.patch} cr.`); }
function sell_(buyer, crop, qty = 1, o = {}) {
  const n = need('post'); if (n) return res(false, n); const st = F.staleSale(S, crop, o.expect); if (st) return res(false, st);
  const q = F.quoteSale(S, buyer, crop, qty); if (!q.ok) return res(false, q.why);
  F.applySale(S, q); let paid = '';
  if (q.cash) { give(q.cash); paid = `+${q.cash} cr`; }
  else if (q.item) paid = giveItem(q.item);
  else if (q.favor) paid = F.FAVORS[q.favor].name;
  save(); emit('sale', { ...q, paid }); if (q.favor) emit('favor', { id: q.favor, got: true });
  const b = F.BUYERS.find(x => x.id === buyer); return res(true, `${b.icon} ${b.name} took ${q.qty} ${F.CROPS[crop].name}. ${paid}.`, { ...q, paid });
}
// ---------- expansions: extra domes and bigger tanks, paid in credits OR ⭐ stars (SSX.stars, rank never drops) ----------
// One currency per purchase, charged once (the AG guard + the owned check), refused short / in the Rust Pit / away from the farm.
// The sale only counts once it is saved: a failed save (or anything throwing) puts the state back and refunds what was taken.
const STARS = () => window.SSX?.stars;
const fmtN = n => Math.round(n).toLocaleString('en-US');
function starBal() { try { const b = STARS()?.balance?.(); return fin(b) ? b : null; } catch (e) { return null; } }
function expand_(id, cur = 'cr') {
  const n = need('farm'); if (n) return res(false, n);
  cur = cur === 'stars' || cur === '⭐' || cur === 'star' ? 'stars' : 'cr';
  const v = F.canExpand(S, id); if (!v.ok) return res(false, v.why, { owned: !!v.owned, locked: !!v.locked });
  const x = F.EXPANSIONS[id], ST = STARS();
  if (cur === 'stars' && (typeof ST?.spend !== 'function' || typeof ST?.balance !== 'function')) return res(false, 'Stars aren\u2019t ready right now. Pay in credits.');
  const wallet = cur === 'stars'
    ? { have: () => ST.balance(), take: k => { const c = ST.canSpend?.(k); if (c && !c.ok) return c; return ST.spend(k, 'farm:' + id); }, give: k => ST.refund(k) }
    : { have: () => credits(), take: k => spend(k) ? { ok: true, n: k } : { ok: false, msg: 'Short on credits.' }, give: k => give(k) };
  const r = F.buyExpansion(S, id, cur, wallet, () => { if (failNext) { failNext = false; throw new Error('test: forced failure'); } return save(); });
  S = r.s;
  if (!r.ok) { if (r.refunded) { save(); emit('expand:fail', { id, cur, refunded: r.refunded, why: r.why }); } return res(false, r.why, { dup: !!r.dup, short: r.short | 0, refunded: r.refunded | 0 }); }
  // paid and saved: put the new dome on its lot (base piece, free) or draw it ourselves
  if (x.kind === 'dome') { try { registerAnnexes(); syncLot(); placeAnnexDome(x.n); rackIds = sortedRackIds(); } catch (e) { console.warn('farm annex dome', e); } }
  rebuildFarm(true); const cp = F.caps(S), unit = cur === 'stars' ? '⭐' : 'cr';
  emit('expand', { id, cur, price: r.price, caps: cp });
  const msg = x.kind === 'dome' ? `🫧 ${x.name} is up on the ${x.n === 1 ? 'north' : 'north-east'} lot. Room for ${cp.racks} racks now. ${fmtN(r.price)} ${unit}.`
    : `${x.icon} ${x.name} in: holds ${cp[x.key]} now. ${fmtN(r.price)} ${unit}.`;
  return res(true, msg, { id, cur, price: r.price, caps: cp });
}
let failNext = false;
// guarded entry points (API and sheet): one effect and one charge per action, see farmcore makeActGuard
const AG = F.makeActGuard(() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
const buy = () => AG.run('buy', () => buy_());
const buildDome = () => AG.run('dome', () => buildDome_());
const addRack = (o = {}) => AG.run('rack', () => addRack_(o || {}));
const rackTag = i => (i == null || i === 'all') ? i : `${i}${rackIds[i | 0] ? '#' + rackIds[i | 0] : ''}`; // a rack replaced in base's flow is a new target
const plant = (i, crop) => AG.run(F.actKey('plant', { i: rackTag(i) }), () => plant_(i, crop));
const harvest = (i = 'all') => AG.run(F.actKey('harvest', { i: rackTag(i) }), () => harvest_(i));
const refill = what => AG.run(F.actKey(what), () => refill_(what));
const patch = () => AG.run('patch', () => patch_());
const cut = (i, o = {}) => AG.run('cut:' + rackTag(i | 0), () => cut_(i, o || {}));
const expand = (id, cur = 'cr') => AG.run('expand:' + id, () => expand_(id, cur));
const sell = (buyer, crop, qty = 1, o = {}) => AG.run(F.actKey('sell', { b: buyer, c: crop }), () => sell_(buyer, crop, qty, o || {}));
function giveItem(id) {
  const it = F.ITEMS.find(x => x.id === id), P = game()?.progress;
  if (id === 'medkit' && P?.inv && P.inv.medkits < 3) { P.inv.medkits++; try { game().save(); } catch (e) { /* */ } return `✚ Medkit (${P.inv.medkits}/3)`; }
  if (id === 'slugs' && P?.inv) { P.inv.slugs = (P.inv.slugs | 0) + 4; try { game().save(); } catch (e) { /* */ } return '🔋 4 coil slugs'; }
  if (id === 'voidhoney') { try { const r = CB()?.add?.('voidhoney', 1, 1); if (r && r.ok !== false && (r.qty ?? 1) > 0) return '🍯 a Void Honey vial (in your stash)'; } catch (e) { /* */ } }
  give(it.worth); return `${it.icon} ${it.name} (pawned on the spot: +${it.worth} cr)`;
}
function useFavor(id) {
  const k = S.favors.indexOf(id); if (k < 0) return res(false, 'You have no favor like that.');
  if (id === 'cool') { const w = world(); if (!w || !(w.wanted > 0)) return res(false, 'Nobody is looking for you right now.'); S.favors.splice(k, 1); try { w.setWanted(Math.max(0, (w.wanted | 0) - 2), 'Hush favor'); } catch (e) { /* */ } save(); emit('favor', { id, used: true }); return res(true, '🌫️ The Hush made a call. ColSec lost your file.'); }
  return res(false, 'That favor works on its own: the next raid comes lighter.');
}

// ---------- raids ----------
let raid = null;
function raid_(opts = {}) {
  if (!S.owned) return { ok: false, why: 'No farm to raid.' }; if (raid) return { ok: false, why: 'A raid is already on.' };
  if (!onMars() || inPit()) return { ok: false, why: 'Not now.' };
  let waves = opts.waves ?? 2; const wk = S.favors.indexOf('watch'); let watched = false; if (wk >= 0 && waves > 1) { S.favors.splice(wk, 1); waves--; watched = true; }
  const p = W(F.SITES.farm.at), id = 'farm-raid-' + Date.now().toString(36); S.lastRaidH = S.hours; S.stats.raids++; save();
  raid = { id, via: 'own', t: 0, len: opts.len ?? 60, why: opts.why || 'raiders' };
  const R = RAIDS(); let slot = 'free';
  if (R?.start && p) { // one SSX.raids slot: ask the empire (#52) to hand over its rival-crew raid first
    const E = EMP();
    try { if (typeof E?.yieldRaid === 'function') { E.yieldRaid('farm'); raid.asked = 'yieldRaid'; } else { dispatchEvent(new CustomEvent('raid:request', { detail: { id } })); raid.asked = 'raid:request'; } } catch (e) { /* */ }
    try { if (typeof E?.raidSlot === 'function') slot = E.raidSlot() || 'free'; } catch (e) { /* */ }
    raid.slot = slot; if (slot === 'other') raid.engineWhy = 'raid slot held by another add-on';
  }
  if (R?.start && p && slot !== 'other') { try { const r = R.start({ id, pos: { x: p.x, z: p.z }, radius: 24, attackers: 'gang', waves, label: 'Dust raiders', onWin: info => endRaid('win', info), onLose: info => endRaid('lose', info) }); if (r && r.ok !== false) raid.via = 'SSX.raids'; else raid.engineWhy = r?.why || 'refused'; } catch (e) { console.warn('farm raid engine', e); } }
  emit('raid', { id, via: raid.via, waves, watched, silo: F.siloCount(S) });
  say(`🚨 Dust raiders are hitting ${F.SITES.farm.name}. ${at('farm') ? 'Fight them off!' : directions('farm').replace('tap Farm', 'fight them off')}`);
  refresh(true); return { ok: true, id, via: raid.via, waves, watched, engineWhy: raid.engineWhy || null, slot: raid.slot || null, asked: raid.asked || null };
}
function endRaid(result, info = {}) {
  if (!raid) return false; const r = raid; raid = null; let st = { took: {}, n: 0 };
  if (result === 'win') { give(F.RAID.bounty); S.stats.raidsWon++; say(`🛡️ Raiders beaten off. The silo is safe. +${F.RAID.bounty} cr`); }
  else { st = F.steal(S); say(st.n ? `🚚 Raiders hauled off ${st.n} crates from your silo.` : '🚚 Raiders found an empty silo and left.'); }
  save(); rebuildFarm(); emit('raid:end', { id: r.id, result, via: r.via, stolen: st.n, took: st.took, kills: info?.kills | 0 }); refresh(true); return true;
}
function raidTick(dt, dh) {
  if (raid && raid.via === 'own') { raid.t += dt; if (raid.t >= raid.len) endRaid(at('farm') ? 'win' : 'lose', {}); return; }
  if (raid || !(dh > 0) || !onMars() || inPit() || noRaids) return;
  if (F.raidDue(S, 0) && Math.random() < 1 - Math.pow(1 - F.RAID.chancePerH, dh)) raid_({ why: 'roll' });
}
let noRaids = /[?&]farmraids=0/.test(location.search);

// ---------- messages: one at a time ----------
function say(m) { if (!m) return; if (panel?.classList.contains('show')) { pMsg.textContent = m; return; } try { app()?.toast?.(m, 3400); } catch (e) { /* */ } }

// ---------- 3D ----------
let G = null, rackG = null, lastTc = null, dirty = true, rackKey = '';
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
function box(w, h, d, m, x, y, z, g) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y + h / 2, z); g.add(b); return b; }
function sign(text, fg, bg, w) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 96); x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(3, 3, 506, 90);
  x.fillStyle = fg; x.font = '800 50px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 50);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, w * 96 / 512), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide }));
}
function build(scene) {
  teardown(); const c = colony(); if (!c) return; G = new THREE.Group(); G.name = 'farm';
  const fp = W(F.SITES.farm.at), pp = W(F.SITES.post.at);
  const fg = new THREE.Group(); fg.name = 'farm-homestead'; fg.position.set(fp.x, ground(fp.x, fp.z) - 0.15, fp.z); G.add(fg);
  const pg = new THREE.Group(); pg.name = 'farm-post'; pg.position.set(pp.x, ground(pp.x, pp.z) - 0.15, pp.z); G.add(pg);
  G.userData = { fg, pg };
  // trading post: pad, a humming obelisk, a canopy and three tall buyers
  box(14, 2.3, 12, mat(0x3a3340), 0, -2, 0, pg); // a plinth: no floating lip where the ground dips box(1.2, 6, 1.2, mat(0x221a33, { emissive: 0x7a3cff, emissiveIntensity: 0.6 }), -4.5, 0.3, -3.5, pg);
  box(9, 0.25, 5, mat(0x5b4f73), 1.5, 3.4, -3.5, pg); for (const [x, z] of [[-2.8, -1.2], [5.8, -1.2], [-2.8, -5.8], [5.8, -5.8]]) box(0.25, 3.4, 0.25, mat(0x8d82a8), x, 0.3, z, pg);
  const skin = [0x5fd38a, 0xd07af0, 0x9fb3c8];
  F.BUYERS.forEach((b, k) => { const n = new THREE.Group(); const bd = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 1.7, 3, 8), mat(skin[k])); bd.position.y = 1.35; n.add(bd); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), mat(skin[k], { emissive: skin[k], emissiveIntensity: 0.25 })); hd.scale.set(1, 1.35, 1); hd.position.y = 2.75; n.add(hd); n.position.set(-1 + k * 2.6, 0.3, -2.4); pg.add(n); });
  const ps = sign('XEN-7 TRADING POST', '#ffffff', '#3b1d6e', 8); ps.position.set(1.5, 4.6, -1); pg.add(ps);
  scene.add(G); rebuildFarm(true);
  try { window.SSX?.minimap?.addMarks?.('farm', [{ ...fp, color: '#4ade80', r: 3, ring: true }, { ...pp, color: '#b388ff', r: 2.6, ring: true }]); } catch (e) { /* */ }
}
function rebuildFarm(force) {
  if (!G) return; const fg = G.userData.fg; const HL = (k, r) => { try { const f = window.SSX?.harvest?.cropLeft?.(k, r); return fin(f) ? F.clamp(f, 0, 1) : 1; } catch (e) { return 1; } };
  const nL = lotsInUse(), ex = S.exp || F.freshExp();
  const key = JSON.stringify([S.owned, S.dome, nL, ex, S.racks.map((r, k) => [r.crop, Math.round(r.growth * 10), r.health > 0, HL(k, r)]), allPieces().map(p => [p.plot, p.id, p.i, p.j, p.r])]);
  if (!force && key === rackKey) return; rackKey = key;
  if (rackG) { fg.remove(rackG); rackG.traverse(o => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); }); }
  rackG = new THREE.Group(); fg.add(rackG);
  // the lot is one 20 x 20 m base lot (F.LOT): dome on the north 6 x 6 cells, racks along the south row, a path up the middle.
  // With SSX.base (#24) the dome and racks are base pieces it draws; we draw only what it doesn't have, plus the crops.
  // Extra domes (expansions) each get a lot of the same layout north / north-east of it; one fence runs round all of them.
  const c0 = W(F.SITES.farm.at), fgY = fg.position.y, lotY = n => { if (!n || !c0) return 0; const o = lotOff(n); return ground(c0.x + o[0], c0.z + o[1]) - 0.15 - fgY; };
  const offs = []; for (let n = 0; n < nL; n++) offs.push(lotOff(n)); const has = (x, z) => offs.some(o => o[0] === x && o[1] === z);
  const lots = offs.map((o, n) => { if (!n) return rackG; const g = new THREE.Group(); g.name = 'farm-annex-' + n; g.position.set(o[0], lotY(n), o[1]); rackG.add(g); return g; });
  const post = mat(0xc9b38a);
  offs.forEach((o, n) => { const g = lots[n];
    box(19.6, 2.2, 19.6, mat(S.owned ? 0x6b4a32 : 0x7d5a40), 0, -2, 0, g);
    for (let k = -5; k <= 5; k++) for (const [x, z, dx, dz] of [[k * 1.96, -9.8, 0, -20], [k * 1.96, 9.8, 0, 20], [-9.8, k * 1.96, -20, 0], [9.8, k * 1.96, 20, 0]]) {
      if (has(o[0] + dx, o[1] + dz)) continue; // shared edge between two of your lots: open
      if (!n && z === 9.8 && Math.abs(x) < 2.5) continue; box(0.15, 1.1, 0.15, post, x, 0.2, z, g); }
  });
  box(3.6, 0.22, 7, mat(0x8f6f52), 0, 0.02, 5.5, rackG);
  const s = sign(S.owned ? 'DUSTBOWL HOMESTEAD' : 'FOR SALE · HOMESTEAD', S.owned ? '#000000' : '#ffffff', S.owned ? '#ffd84d' : '#b31b1b', 5); s.position.set(0, 2.6, 10.3); rackG.add(s);
  box(0.2, 2.4, 0.2, mat(0x555555), -2.5, 0.2, 10.2, rackG); box(0.2, 2.4, 0.2, mat(0x555555), 2.5, 0.2, 10.2, rackG);
  if (S.owned) { const tank = (z, name) => { const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.2, 14), mat(0x8ab4d8, { metalness: 0.4 })); tk.position.set(name ? 8.6 : 8.2, 1.3, z); tk.name = name || 'farm-tank'; rackG.add(tk); };
    const solar = (z, name) => { box(0.2, 3, 0.2, mat(0x777777), -8.2, 0.2, z, rackG); const pnl = box(2, 0.08, 1.3, mat(0x1a2a6c, { metalness: 0.6, roughness: 0.3 }), -8.2, 3.2, z, rackG); pnl.rotation.x = -0.5; if (name) pnl.name = name; };
    tank(1.6); solar(1.6);
    // tank upgrades: a second water tank and solar rack beside the first (clear of the silo at 8.4, -5.2 and the dome), a second silo bin north of the silo
    if (ex.water) tank(-0.9, 'farm-tank2'); if (ex.power) solar(-1.2, 'farm-solar2');
    if (ex.silo) { const b = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 3.6, 16), mat(0xb8b0a0, { metalness: 0.3 })); b.position.set(8.4, 2.0, -8.6); b.name = 'farm-silo2'; rackG.add(b);
      const rf = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.9, 16), mat(0x8a4b2a)); rf.position.set(8.4, 4.25, -8.6); rackG.add(rf); } }
  const bp = allPieces(), bRacks = sortedRacks();
  const D = F.LOT.dome, dc = F.lotCentre(D.i, D.j, D.fp);
  const ownDome = (g, name) => {
    const d = new THREE.Mesh(new THREE.SphereGeometry(D.r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xcfefff, transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }));
    d.position.set(dc.x, 0.2, dc.z); d.name = name; g.add(d);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(D.r, 0.12, 6, 40), mat(0xdddddd)); ring.rotation.x = Math.PI / 2; ring.position.set(dc.x, 0.3, dc.z); g.add(ring);
  };
  if (S.dome && !bp.some(p => p.lot === 0 && p.type === D.type)) ownDome(rackG, 'farm-dome');
  for (let n = 1; n < nL; n++) if (!bp.some(p => p.lot === n && p.type === D.type)) ownDome(lots[n], 'farm-dome-' + (n + 1));
  const leaf = { potato: 0x6aa84f, algae: 0x2fbf71, glowberry: 0x6e5bff, lichen: 0xd9e6f2 };
  S.racks.forEach((r, k) => {
    const c = rackSpot(k, bRacks), g0 = new THREE.Group(); g0.position.set(c.x, c.lot ? rackY(c, fgY) : 0, c.z); g0.rotation.y = c.rot; rackG.add(g0);
    if (!c.base) { box(1.6, 0.9, 3.4, mat(0x9aa3ad, { metalness: 0.5 }), 0, 0.2, 0, g0); box(1.7, 0.06, 3.5, mat(0x3b82f6, { emissive: 0x1d4ed8, emissiveIntensity: 0.4 }), 0, 2.3, 0, g0);
      for (const z of [-1.6, 1.6]) box(0.1, 2.1, 0.1, mat(0x777777), 0, 0.2, z, g0); }
    const left = r.crop ? HL(k, r) : 0; // hands-on harvest: cut patches come off the rack from the north end
    if (r.crop && left > 0) { const g = Math.max(0.1, r.growth), dead = r.health <= 0; const cm = box(1.4, 0.9 * g, 3.1 * left, mat(dead ? 0x5a4632 : leaf[r.crop], r.crop === 'glowberry' || r.crop === 'lichen' ? { emissive: leaf[r.crop], emissiveIntensity: r.growth >= 1 ? 0.6 : 0.2 } : {}), 0, 1.1, 1.55 * (1 - left), g0); cm.name = 'farm-crop'; }
  });
}
// a rack on an extra lot stands on the lowest ground under it (as SSX.base draws its pieces), in the homestead group's frame
function rackY(c, fgY) {
  const p = W(F.SITES.farm.at); if (!p) return 0; const [w, d] = c.rot ? [F.LOT.rackFp[1], F.LOT.rackFp[0]] : F.LOT.rackFp, hw = w * F.LOT.cell / 2, hd = d * F.LOT.cell / 2; let y = Infinity;
  for (const [dx, dz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd], [0, 0]]) y = Math.min(y, ground(p.x + c.x + dx, p.z + c.z + dz));
  return fin(y) ? y - 0.15 - fgY : 0;
}
function teardown() { if (G) { G.parent?.remove(G); G.traverse(o => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); }); } G = null; rackG = null; rackKey = ''; try { window.SSX?.minimap?.clear?.('farm'); } catch (e) { /* */ } beacon = null; wpClear(); }

// ---------- UI ----------
const css = `
#farmAct{position:fixed;z-index:15;left:calc(14px + env(safe-area-inset-left));bottom:calc(250px + env(safe-area-inset-bottom));display:none;min-height:52px;min-width:120px;padding:6px 16px;border-radius:14px;border:3px solid #fff;background:#000;color:#fff;font:900 17px/1.1 system-ui,sans-serif;touch-action:manipulation;box-shadow:0 2px 10px #000}
#farmAct.on{display:block}
#farmPanel button[data-hold]{opacity:1;cursor:progress}
#farmPanel{position:fixed;inset:0;z-index:58;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55)}
#farmPanel.show{display:flex}#farmPanel .wrap{width:min(480px,calc(100vw - 20px));max-height:calc(100vh - 40px);overflow:auto;background:#000;color:#fff;border:3px solid #fff;border-radius:16px;padding:14px 14px 10px;font:600 15px/1.35 system-ui,sans-serif}
#farmPanel h2{margin:0 0 4px;font:900 21px/1.2 system-ui,sans-serif}#farmPanel p{margin:6px 0}#farmPanel .sub{color:#ddd;font-size:13px}
#farmPanel button{display:block;width:100%;min-height:48px;margin:8px 0 0;padding:8px 12px;border-radius:12px;border:2px solid #fff;background:#111;color:#fff;font:800 15px/1.2 system-ui,sans-serif;text-align:left;touch-action:manipulation}
#farmPanel button.pri{background:#fff;color:#000}#farmPanel button:disabled{opacity:1;color:#c8c8c8;border-style:dashed;border-color:#8a8a8a}#farmPanel button small{display:block;font-weight:600;font-size:12px;opacity:.85}
#farmPanel .row{display:flex;gap:8px}#farmPanel .row button{flex:1}
#farmPanel .xp{border-top:1px solid #444;margin-top:8px;padding-top:2px}#farmPanel .xp p{margin:4px 0}#farmPanel .xp .row button{min-height:46px;margin-top:4px;text-align:center;background:#000;color:#fff}#farmPanel .tag{font-size:12px;font-weight:800;color:#ffd400}
#farmPanel .msg{min-height:18px;margin-top:8px;color:#ffd400;font-weight:800}
#farmGuide{position:fixed;z-index:14;top:calc(122px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);display:none;align-items:center;gap:8px;width:max-content;max-width:min(460px,calc(100vw - 24px));padding:6px 6px 6px 14px;border-radius:14px;border:3px solid #ffd400;background:#000;color:#fff;font:800 16px/1.25 system-ui,sans-serif;box-shadow:0 2px 10px #000;pointer-events:none}
#farmGuide.on{display:flex}#farmGuide small{display:block;color:#fff;font-weight:700;font-size:13px}
#farmGuide button{pointer-events:auto;flex:none;width:44px;height:44px;border-radius:10px;border:2px solid #fff;background:#111;color:#fff;font:900 18px/1 system-ui,sans-serif;touch-action:manipulation}
`;
let panel, pBody, pMsg, actBtn, guideEl, pMode = 'farm', actKey = '';
function tap(el, fn) { let last = 0; const g = e => { const n = performance.now(); if (e?.type === 'click' && n - last < 700) return; if (e?.type === 'pointerup') last = n; fn(e); }; (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, g); }
function ui() {
  if (panel) return; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  panel = document.createElement('div'); panel.id = 'farmPanel'; panel.innerHTML = '<div class="wrap" role="dialog" aria-label="Farm"><div id="farmBody"></div><div class="msg" id="farmMsg" aria-live="polite"></div></div>'; document.body.appendChild(panel);
  pBody = panel.querySelector('#farmBody'); pMsg = panel.querySelector('#farmMsg');
  panel.addEventListener('pointerup', e => { if (e.target === panel) close(); });
  actBtn = document.createElement('button'); actBtn.id = 'farmAct'; actBtn.type = 'button'; document.body.appendChild(actBtn);
  tap(actBtn, () => open(actBtn.dataset.mode || 'farm'));
  guideEl = document.createElement('div'); guideEl.id = 'farmGuide'; guideEl.setAttribute('role', 'status'); guideEl.innerHTML = '<div id="farmGuideTxt"></div><button type="button" id="farmGuideX" aria-label="Hide the farm guide">✕</button>'; document.body.appendChild(guideEl);
  tap(guideEl.querySelector('#farmGuideX'), () => guideOff());
  try { window.SSX.registerMenuItem({ id: 'rmFarm', label: '🌱 Farm', onTap: () => open(at('post') ? 'post' : 'farm') }); } catch (e) { console.warn('farm menu', e); }
}
function btn(a, label, sub, o = {}) { return `<button type="button" data-a="${a}"${o.i != null ? ` data-i="${o.i}"` : ''}${o.c ? ` data-c="${o.c}"` : ''}${o.b ? ` data-b="${o.b}"` : ''}${o.n != null ? ` data-n="${o.n}"` : ''}${o.q != null ? ` data-q="${o.q}"` : ''} class="${o.pri ? 'pri' : ''}" ${o.dis ? 'disabled' : ''}>${label}${sub ? `<small>${sub}</small>` : ''}</button>`; }
function open(mode = 'farm') { if (!panel) return; guideStart(); pMode = mode; pMsg.textContent = ''; plantFor = null; settleNext = false; settleUntil = 0; render(); panel.classList.add('show'); try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ } emit('open', { mode }); }
function close() { panel?.classList.remove('show'); guideTick(true); }
let plantFor = null;
function render() {
  if (!pBody) return; const cr = credits(); let h = '';
  const here = at(pMode === 'post' ? 'post' : 'farm'), bl = blocked();
  if (pMode === 'post') {
    const d = F.day(S), list = F.buyersToday(d);
    h = `<h2>👽 ${F.SITES.post.name}</h2><p class="sub">Day ${d + 1} prices · 💰 ${cr} cr · silo ${F.siloCount(S)}</p>`;
    if (!here || bl) h += `<p>${esc(bl && onMars() && !inPit() && !floating() ? directions('post') : bl || directions('post'))}</p>`;
    for (const b of list) {
      h += `<p><b>${b.icon} ${esc(b.name)}</b> <span class="sub">pays ${b.pays === 'cash' ? 'cash' : b.pays === 'item' ? 'rare items' : 'favors'}</span></p>`;
      for (const o of b.offers) { const have = S.silo[o.crop] | 0, c = F.CROPS[o.crop], q = have ? F.quoteSale(S, b.id, o.crop, have) : null;
        const label = b.pays === 'cash' ? `${c.icon} Sell ${have || ''} ${c.name} · ${o.unit} cr each` : `${c.icon} Trade ${q?.ok ? q.qty : ''} ${c.name}`.replace(/\s+/g, ' ');
        const sub = b.pays === 'cash' ? `${o.mult >= 1.07 ? 'Good price today.' : o.mult <= 0.93 ? 'Low today.' : 'Fair today.'} You have ${have}.` : q?.ok ? (q.item ? `For ${F.ITEMS.find(i => i.id === q.item).name}.` : `For ${F.FAVORS[q.favor].name}.`) : (q?.why || `You have ${have}.`);
        h += btn('sell', label, sub, { b: b.id, c: o.crop, q: have, dis: !here || !!bl || !q?.ok }); }
    }
    if (S.favors.length) { h += `<p><b>Your favors</b></p>`; for (const f of [...new Set(S.favors)]) { const n = S.favors.filter(x => x === f).length; h += btn('favor', `${F.FAVORS[f].icon} ${F.FAVORS[f].name}${n > 1 ? ' ×' + n : ''}`, F.FAVORS[f].blurb, { c: f, dis: f !== 'cool' }); } }
  } else if (pMode === 'expand') {
    // compact sub-list: one row per expansion, price in cr AND ⭐ (two buttons), owned / next / locked in plain words
    const bal = starBal(), dis = !here || !!bl, cp = F.caps(S); let next = F.EXP_ORDER.find(id => F.canExpand(S, id).ok) || null;
    h = `<h2>🧱 Expand the farm</h2><p class="sub">💰 ${fmtN(cr)} cr${bal != null ? ` · ⭐ ${fmtN(bal)} stars to spend` : ''} · 1 cr = ${F.STAR_RATE} ⭐ · ${cp.domes}/3 domes, ${cp.racks} racks</p>`;
    if (!here || bl) h += `<p>${esc(bl && onMars() && !inPit() && !floating() ? directions('farm') : bl || directions('farm'))}</p>`;
    if (!S.owned || !S.dome) h += `<p>${S.owned ? 'Build the first greenhouse dome first.' : 'Buy the homestead first.'}</p>`;
    for (const id of F.EXP_ORDER) { const x = F.EXPANSIONS[id], v = F.canExpand(S, id), own = F.owns(S, id), st = F.starPrice(id);
      const tag = own ? '✅ owned' : v.locked ? '🔒 later' : id === next ? '⭐ next' : '';
      h += `<div class="xp" data-x="${id}"><p><b>${x.icon} ${esc(x.name)}</b>${tag ? ` <span class="tag">${tag}</span>` : ''}<br><span class="sub">${esc(own ? (x.kind === 'dome' ? `Lot ${x.n + 1} of 3, 6 racks.` : `Holds ${cp[x.key]}.`) : v.locked ? v.why : F.expandWords(id))}</span></p>`;
      if (!own) h += `<div class="row">${btn('exp', `${fmtN(x.cr)} cr`, '', { c: id, b: 'cr', dis: dis || !v.ok || cr < x.cr })}${btn('exp', `${fmtN(st)} ⭐`, '', { c: id, b: 'stars', dis: dis || !v.ok || !(bal >= st) })}</div>`;
      h += '</div>'; }
    h += btn('back', '← Back to the farm', '');
  } else {
    h = `<h2>🌱 ${F.SITES.farm.name}</h2><p class="sub">💰 ${cr} cr · Mars ${fmtH(hourNow())} · day ${F.day(S) + 1}${raid ? ' · 🚨 raid!' : ''}</p>`;
    if (!here || bl) h += `<p>${esc(bl && onMars() && !inPit() && !floating() ? directions('farm') : bl || directions('farm'))}</p>`;
    const dis = !here || !!bl;
    if (!S.owned) h += btn('buy', `🏡 Buy the homestead · ${F.PRICES.plot} cr`, 'A walled lot in open desert. Room for one greenhouse dome.', { pri: true, dis: dis || cr < F.PRICES.plot });
    else if (!S.dome) h += btn('dome', `🫧 Build the greenhouse dome · ${F.PRICES.dome} cr`, 'Keeps dust off the racks. Storms do half the damage while it is sound.', { pri: true, dis: dis || cr < F.PRICES.dome });
    else {
      const cp = F.caps(S); h += `<p>💧 Water ${Math.round(S.water)}/${cp.water} · 🔋 Power ${Math.round(S.power)}/${cp.power} · 🫧 Dome${cp.domes > 1 ? 's ×' + cp.domes : ''} ${Math.round(S.domeHp)}%</p>`;
      if (plantFor != null) {
        h += `<p><b>Plant rack ${plantFor + 1}:</b></p>`; for (const c of Object.values(F.CROPS)) h += btn('plantc', `${c.icon} ${c.name} · ${c.seed} cr`, `${c.hours} h to ripen · ${c.yield} per rack${c.contraband ? ' · dries into Glow-dust for your stash' : ''}`, { i: plantFor, c: c.id, dis: dis || cr < c.seed });
        h += btn('back', '← Back', '');
      } else {
        S.racks.forEach((r, k) => { const c = F.CROPS[r.crop];
          if (!c) h += btn('plant', `🪴 Rack ${k + 1}: empty`, 'Tap to plant.', { i: k, dis });
          else if (r.health <= 0) h += btn('harvest', `🥀 Rack ${k + 1}: ${c.name} died`, 'Clear it out.', { i: k, dis: true });
          else h += btn('harvest', `${c.icon} Rack ${k + 1}: ${c.name} · ${r.growth >= 1 ? 'ripe' : Math.floor(r.growth * 100) + '%'}`, `Health ${Math.round(r.health)}%${r.growth >= 1 ? ` · harvest ${F.yieldOf(r)}` : ''}`, { i: k, pri: r.growth >= 1, dis: dis || r.growth < 1 }); });
        const HX = window.SSX?.harvest, hireTxt = HX?.hireText ? (() => { try { return HX.hireText(); } catch (e) { return ''; } })() : '';
        if (hireTxt) h += `<p class="sub">${esc(hireTxt)}</p>`;
        if (S.racks.some(r => r.crop && r.growth >= 1)) h += btn('harvestAll', hireTxt ? '👷 Hire a hand for everything ripe' : '🧺 Harvest everything ripe', '', { pri: true, dis });
        if (S.racks.length < cp.racks) h += btn('rack', `➕ Add a hydroponic rack · ${F.PRICES.rack} cr`, `${S.racks.length}/${cp.racks} racks`, { n: S.racks.length, dis: dis || cr < F.PRICES.rack });
        const w = F.refillCost(S, 'water'), p = F.refillCost(S, 'power');
        h += `<div class="row">${btn('water', `💧 Fill · ${w.cost} cr`, '', { dis: dis || !w.units || cr < w.cost })}${btn('power', `🔋 Charge · ${p.cost} cr`, '', { dis: dis || !p.units || cr < p.cost })}</div>`;
        { const nx = F.EXP_ORDER.filter(id => !F.owns(S, id)).length; h += btn('expand', '🧱 Expand the farm', nx ? `Domes ${cp.domes}/3 · ${F.EXP_ORDER.length - nx}/${F.EXP_ORDER.length} upgrades · pay in cr or ⭐` : 'Fully expanded: 3 domes, 18 racks, big tanks.', {}); }
        if (S.domeHp < 100) h += btn('patch', `🩹 Patch the dome · ${F.PRICES.patch} cr`, 'Storm damage. Under 60% it stops shielding the crops.', { dis: dis || cr < F.PRICES.patch });
      }
    }
    const silo = Object.entries(S.silo).map(([k, v]) => `${F.CROPS[k].icon} ${v}`).join(' · ');
    if (S.owned) h += `<p>🏚️ Silo: ${silo || 'empty'} <span class="sub">(${F.siloCount(S)}/${F.caps(S).silo}). Sell at ${F.SITES.post.name}, ${(() => { const a = W(F.SITES.farm.at), b = W(F.SITES.post.at); return a && b ? Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 10) * 10 + ' m ' + F.dirWord(b.x - a.x, b.z - a.z) + ' of the farm' : 'south-east of the farm'; })()}.</span></p>`;
    h += btn('postInfo', `👽 ${F.SITES.post.name} prices`, 'See today\u2019s alien buyers.');
  }
  if (S.guide.off && !S.guide.done) h += btn('guide', '🧭 Show the farm guide', 'One step at a time, from buying the plot to your first sale.');
  h += btn('close', 'Close', '');
  const changed = h !== lastHtml; lastHtml = h; const gen = ++renderGen;
  pBody.innerHTML = h;
  pBody.querySelectorAll('button[data-a]').forEach(b => tap(b, () => { if (b.disabled || b.dataset.hold || gen !== renderGen || !b.isConnected || nowMs() < settleUntil) return; holdSheet(); act(b.dataset); }));
  if (changed && settleNext) settleUntil = nowMs() + SETTLE_MS; settleNext = true;
  if (nowMs() < settleUntil) holdSheet(settleUntil - nowMs());
}
// while the sheet re-renders (and for SETTLE_MS after the layout changed) its buttons are disabled, so a tap or a late
// touch click can't land on a button that just slid under the finger
const SETTLE_MS = 250, nowMs = () => performance.now(); let renderGen = 0, lastHtml = '', settleNext = false, holdT = 0, settleUntil = 0;
function holdSheet(ms) {
  if (!pBody) return; const gen = renderGen;
  pBody.querySelectorAll('button[data-a]').forEach(b => { if (!b.disabled) { b.disabled = true; b.dataset.hold = '1'; } });
  if (ms) { clearTimeout(holdT); holdT = setTimeout(() => { if (gen !== renderGen || !pBody) return; pBody.querySelectorAll('button[data-hold]').forEach(b => { b.disabled = false; delete b.dataset.hold; }); }, ms); }
}
const fmtH = h => { const m = Math.round(((h % 24) + 24) % 24 * 60) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
function act(d) {
  const a = d.a; let r = null;
  if (a === 'close') return close(); if (a === 'back') { plantFor = null; if (pMode === 'expand') pMode = 'farm'; return render(); } if (a === 'expand') { pMode = 'expand'; return render(); } if (a === 'postInfo') { pMode = 'post'; return render(); }
  if (a === 'plant') { plantFor = +d.i; return render(); }
  if (a === 'buy') r = buy(); else if (a === 'dome') r = buildDome(); else if (a === 'rack') r = addRack({ expect: d.n }); else if (a === 'plantc') { r = plant(+d.i, d.c); if (!r?.dup) plantFor = null; }
  else if ((a === 'harvest' || a === 'harvestAll') && typeof window.SSX?.harvest?.hire === 'function') r = window.SSX.harvest.hire(a === 'harvestAll' ? 'all' : +d.i); // the slow one-tap way
  else if (a === 'harvest') r = harvest(+d.i); else if (a === 'harvestAll') r = harvest('all'); else if (a === 'water' || a === 'power') r = refill(a); else if (a === 'patch') r = patch();
  else if (a === 'sell') { const have = S.silo[d.c] | 0; r = sell(d.b, d.c, have, { expect: d.q }); } else if (a === 'favor') r = useFavor(d.c); else if (a === 'exp') r = expand(d.c, d.b); else if (a === 'guide') r = guideOn();
  if (panel.classList.contains('show')) { const m = pMsg.textContent; render(); pMsg.textContent = r?.dup ? m : (r?.msg || ''); }
}
function refresh(force) {
  if (!actBtn) return; let mode = '', label = '';
  if (onMars() && !inPit() && !floating()) { if (at('farm')) { mode = 'farm'; label = raid ? '🚨 Farm' : '🌱 Farm'; } else if (at('post')) { mode = 'post'; label = '👽 Trade'; } }
  const k = mode + label; if (force || k !== actKey) { actKey = k; actBtn.textContent = label; actBtn.dataset.mode = mode; actBtn.setAttribute('aria-label', mode === 'post' ? 'Trade at the Xen-7 Trading Post' : 'Open the farm'); actBtn.classList.toggle('on', !!mode); }
  if (force && panel?.classList.contains('show')) { const m = pMsg.textContent; render(); pMsg.textContent = m; }
}

// ---------- first-loop guide: one caption + one waypoint, until the first sale ----------
// Waypoint: SSX.waypoint / SSX.nav / SSX.gps if any lands (set/to/add + clear/remove, guarded), else a minimap mark + a world beacon.
let beacon = null, wpKey = '', wpVia = null, gKey = '', gStep = null;
const NAV = () => { const S_ = window.SSX || {}; for (const k of ['waypoint', 'nav', 'gps']) { const n = S_[k]; if (n && (typeof n.set === 'function' || typeof n.to === 'function' || typeof n.add === 'function')) return n; } return null; };
function wpClear() {
  if (wpVia === 'api') { try { const n = NAV(); (n?.clear || n?.remove)?.call(n, 'farm-guide'); } catch (e) { /* */ } }
  try { window.SSX?.minimap?.clear?.('farm-guide'); } catch (e) { /* */ }
  if (beacon) { beacon.visible = false; } wpKey = ''; wpVia = null;
}
function wpSet(id) {
  const p = W(F.SITES[id].at); if (!p) return; const key = id + ':' + Math.round(p.x) + ',' + Math.round(p.z); if (key === wpKey && (wpVia === 'api' || beacon?.visible)) return;
  wpClear(); wpKey = key; const label = F.SITES[id].name, n = NAV();
  if (n) { try { const o = { id: 'farm-guide', x: p.x, z: p.z, label, color: '#ffd400' }; const r = (n.set || n.to || n.add).call(n, o); if (r !== false && r?.ok !== false) { wpVia = 'api'; return; } } catch (e) { /* fall back */ } }
  wpVia = 'beacon';
  try { window.SSX?.minimap?.addMarks?.('farm-guide', [{ x: p.x, z: p.z, color: '#ffd400', r: 4.5, ring: true }]); } catch (e) { /* */ }
  if (G) { if (!beacon) beacon = makeBeacon(); beacon.position.set(p.x, ground(p.x, p.z), p.z); beacon.visible = true; }
}
function makeBeacon() {
  const b = new THREE.Group(); b.name = 'farm-beacon';
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 70, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd400, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
  col.position.y = 35; b.add(col);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 14), new THREE.MeshBasicMaterial({ color: 0xffd400 })); arrow.rotation.x = Math.PI; arrow.position.y = 12; arrow.name = 'farm-beacon-arrow'; b.add(arrow);
  b.userData.arrow = arrow; G.add(b); return b;
}
let bT = 0;
function beaconTick(dt) { if (!beacon?.visible) return; bT += dt; const a = beacon.userData.arrow; a.position.y = 12 + Math.sin(bT * 2.4) * 1.2; a.rotation.y += dt * 1.5; }
function guideStart() { if (!S.guide.on && !S.guide.done) { S.guide.on = true; save(); emit('guide', { step: F.guideStep(S)?.id, why: 'start' }); } }
function guideOff() { S.guide.off = true; save(); guideTick(true); emit('guide', { step: gStep?.id || null, why: 'off' }); return res(true, 'Farm guide hidden. Turn it back on in the Farm sheet.'); }
function guideOn() { S.guide.off = false; S.guide.on = true; save(); guideTick(true); emit('guide', { step: F.guideStep(S)?.id, why: 'on' }); return res(true, '🧭 Farm guide on. Follow the yellow beacon.'); }
function guideTick(force) {
  if (!guideEl) return;
  // start the guide the first time a new player walks up to either site
  if (!S.guide.on && !S.guide.done && onMars() && (at('farm') || at('post'))) guideStart();
  const step = S.guide.on && !S.guide.off ? F.guideStep(S) : null;
  if (gStep && !step && S.guide.done && gStep.id !== 'done') { gStep = { id: 'done' }; emit('guide', { step: 'done', why: 'sale' }); say('🎉 First sale! Your farm loop is running. Grow, harvest, sell.'); }
  else if (step && step.id !== gStep?.id) { gStep = step; emit('guide', { step: step.id, why: 'step' }); }
  const show = !!step && onMars() && !inPit() && !floating() && !raid && !panel?.classList.contains('show');
  if (!step || !onMars()) wpClear(); else wpSet(step.to);
  let html = '';
  if (show) {
    const here = at(step.to), i = me(), p = W(F.SITES[step.to].at);
    let sub = here ? (step.to === 'post' ? 'Tap 👽 Trade.' : 'Tap 🌱 Farm.') : '';
    if (!here && i && p) { const d = Math.hypot(p.x - i.x, p.z - i.z); sub = `${F.SITES[step.to].name}: ${d < 1000 ? Math.round(d / 10) * 10 + ' m' : (d / 1000).toFixed(1) + ' km'} ${F.dirWord(p.x - i.x, p.z - i.z)}. Follow the yellow beacon.`; }
    if (step.id === 'grow' && here) sub = 'Keep the water and power topped up.';
    html = `${step.icon} ${esc(step.text)}<small>${esc(sub)}</small>`;
  }
  const k = show + html; if (force || k !== gKey) { gKey = k; guideEl.querySelector('#farmGuideTxt').innerHTML = html; guideEl.classList.toggle('on', show); }
}
function guideStatus() { const st = F.guideStep(S); return { on: S.guide.on, off: S.guide.off, done: S.guide.done, step: st?.id || null, text: st?.text || null, to: st?.to || null, shown: !!guideEl?.classList.contains('on'), caption: guideEl?.querySelector('#farmGuideTxt')?.textContent || '', waypoint: wpVia ? { via: wpVia, key: wpKey, beacon: beacon?.visible ? { x: Math.round(beacon.position.x), z: Math.round(beacon.position.z) } : null } : null }; }

// ---------- tick + boot ----------
let uiT = 0;
function tick(dt, tc) {
  lastTc = tc; if (!fin(dt)) return;
  hookStorm(); hookEmpire(); hookBase();
  const dh0 = clockTick(dt), dh = empOn ? 0 : dh0; // SSX.empire 'hour' drives growth once it's live: never both
  if (dh > 0) advance(dh);
  if (baseHook === 'api' && !synced && S.owned) syncBase();
  if (!onMars()) { if (G) teardown(); refresh(); guideTick(); return; }
  if (!G || G.parent !== tc.scene) build(tc.scene); else if (dirty) { dirty = false; rebuildFarm(); }
  if (restoredFrom && !restoreSaid) { restoreSaid = true; say(`🌱 ${F.SITES.farm.name} is back: dome${S.dome ? '' : ' (none)'} and ${S.racks.length} rack${S.racks.length === 1 ? '' : 's'} restored from your save.`); emit('restore', { from: restoredFrom, dome: S.dome, racks: S.racks.length }); }
  raidTick(dt, dh);
  if ((uiT -= dt) <= 0) { uiT = 0.25; refresh(); guideTick(); }
  beaconTick(dt);
}
function status() {
  return { owned: S.owned, dome: S.dome, domeHp: Math.round(S.domeHp), racks: S.racks.map(r => ({ crop: r.crop, growth: Math.round(r.growth * 1000) / 1000, health: Math.round(r.health * 10) / 10, ripe: !!r.crop && r.growth >= 1 })),
    water: S.water, power: S.power, silo: { ...S.silo }, siloCount: F.siloCount(S), favors: [...S.favors], hours: Math.round(S.hours * 100) / 100, day: F.day(S), clock: empOn ? 'SSX.empire.hour' : src, exp: { ...(S.exp || F.freshExp()) }, caps: F.caps(S), base: baseLot() ? { plot: PLOT, lots: LOT_IDS.filter(id => baseLot(id)), pieces: allPieces().map(p => ({ id: p.id, plot: p.plot, type: p.type, i: p.i, j: p.j, r: p.r })) } : (baseHook || null), empire: empHook ? { hook: empHook, live: empOn, hours: empHours } : null, hooks: { base: baseHook, baseRegistered: !!baseLot(), lotSync, empire: empHook, empireLive: empOn, yieldRaid: typeof EMP()?.yieldRaid === "function", raidSlot: (() => { try { return EMP()?.raidSlot?.() ?? null; } catch (e) { return null; } })() },
    raid: raid ? { id: raid.id, via: raid.via, engineWhy: raid.engineWhy || null, slot: raid.slot || null, asked: raid.asked || null } : null, at: onMars() ? (at('farm') ? 'farm' : at('post') ? 'post' : null) : null, storm: stormI(), stats: { ...S.stats }, restored: restoredFrom, saveErr };
}
const API = {
  status, buy, buildDome, addRack, plant, harvest, refill, patch, sell, useFavor, raid: raid_, skip,
  // mars/harvest.js: cut a ripe rack without banking, bank crops into the silo, rack spots in world metres, redraw the crops
  cut, bank: (items, o = {}) => bank_(items, o || {}), siloRoom: () => Math.max(0, F.caps(S).silo - F.siloCount(S)),
  // expansions: expand(id, 'cr'|'stars'), expansions() -> rows for the sheet, caps() -> current caps
  expand, expansions: () => F.EXP_ORDER.map(id => { const x = F.EXPANSIONS[id], v = F.canExpand(S, id); return { id, name: x.name, kind: x.kind, cr: x.cr, stars: F.starPrice(id), owned: F.owns(S, id), canBuy: !!v.ok, why: v.ok ? '' : v.why, words: F.expandWords(id) }; }), caps: () => F.caps(S), STAR_RATE: F.STAR_RATE, redraw: () => { rebuildFarm(true); return !!G; },
  rackSpots: () => { const c = W(F.SITES.farm.at); if (!c) return []; const bR = sortedRacks();
    return S.racks.map((r, k) => { const p = rackSpot(k, bR); return { i: k, x: c.x + p.x, z: c.z + p.z, rot: p.rot, lot: p.lot, crop: r.crop, ripe: !!r.crop && r.growth >= 1 && r.health > 0, planted: r.planted, n: F.yieldOf(r) }; }); },
  buyers: () => F.buyersToday(F.day(S)), clock: () => ({ hour: hourNow(), hours: S.hours, day: F.day(S), source: empOn ? 'SSX.empire.hour' : src }),
  places: () => Object.values(F.SITES).map(p => { const w = W(p.at); return { id: p.id, name: p.name, x: w?.x, z: w?.z, r: p.r }; }),
  open, close, on, CROPS: F.CROPS, PRICES: F.PRICES,
  guide: { status: guideStatus, start: () => { guideStart(); guideTick(true); return guideStatus(); }, hide: guideOff, show: guideOn },
  debug: {
    goto(id) { const s = surf(), p = W(F.SITES[id === 'post' ? 'post' : 'farm'].at); if (!s || !p) return false; s.debugMove(p.x + (id === 'post' ? 0 : 0), p.z + (id === 'post' ? 4 : 6), 0); return { x: p.x, z: p.z }; },
    storm(i = 1) { dbgStorm = F.clamp(+i || 0, 0, 1); return dbgStorm; }, raidEnd: (r = 'win') => endRaid(r), failNextExpand: (v = true) => { failNext = v !== false; return failNext; }, noRaids: v => { noRaids = v !== false; return noRaids; },
    state: () => JSON.parse(JSON.stringify(S)), reset() { AG.reset(); const c0 = credits(); for (const p of allPieces()) { try { B().remove(p.plot, p.id); } catch (e) { /* */ } } const c1 = credits(); if (c1 > c0) spend(c1 - c0); S = F.fresh(); save(true); restoredFrom = null; try { B()?.refresh?.(); } catch (e) { /* */ } synced = false; rackIds = []; raid = null; dbgStorm = 0; gStep = null; wpClear(); rebuildFarm(true); refresh(true); guideTick(true); return true; },
    reload() { S = loadState(); restoreSaid = false; synced = false; if (restoredFrom) save(); rebuildFarm(true); emit('load', {}); return status(); },
    ground: (x, z) => ground(x, z), colony: () => { const c = colony(); return c ? { x: c.x, z: c.z } : null; },
    inPit, floating, scene: () => G ? { farm: !!G.userData.fg, dome: !!G.getObjectByName('farm-dome') || basePieces().some(p => p.type === F.LOT.dome.type), crops: (() => { let n = 0; G.traverse(o => { if (o.name === 'farm-crop') n++; }); return n; })() } : null
  }
};
(function boot() {
  if (!window.SSX?.registerSurfaceTick || !window.__app || !window.SSX.registerMenuItem) { setTimeout(boot, 200); return; }
  if (window.SSX.farm) return; window.SSX.farm = API; ui();
  try { window.SSX.registerSurfaceTick(tick); } catch (e) { console.warn('farm tick', e); }
})();
