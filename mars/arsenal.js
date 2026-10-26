// Mars gunplay + arsenal overhaul (Marsmania). Extends the game's own combat path instead of running a second one:
// guns are entries in game.js WEAPONS and fire through game.fire() (bolts, auto-aim, crime on discharge, hitWorld ->
// security/people damage, headshots, gore), melee goes through game.melee() -> world.meleeWorld. This module adds
// magazines + reload, recoil + bloom, ammo types with reserves, mods, hit reactions, blood decals, a weapon wheel, the
// Rust Pit fists-only rule, and (mars/gunsmith.js) Bore's black-market bench in Red Tape Flats.
// Game fiction: invented weapons, invented makers, invented contraband. Loaded by one <script type="module"> in index.html.
import * as THREE from 'three';
import { WEAPONS } from '../game.js';
import { initGunsmith } from './gunsmith.js';

/**
 * window.SSX.arsenal
 *  weapons()          -> [{ id, name, icon, kind:'gun'|'melee'|'core', owned, equipped, mag, magSize, reserve, ammoType, mods }]
 *  equip(id)          -> { ok, msg }   arsenal ids (pistol smg shotgun rifle rail knife bat) or the game's own
 *                        (blaster launcher railrifle blade cleaver -> game.switchWeapon)
 *  current()          -> null | { id, name, kind, mag, magSize, reserve, ammoType, reloading, charge, mods, scoped, core? }
 *  ammo(id?)          -> { cal, types:{ std:n, hollow:n, ap:n, slug:n }, sel, mag } for a weapon (default: current)
 *  give(id, ammo?, type?) -> { ok, msg }  grant a weapon (and ammo), or ammo only when owned. id may be 'ammo:<cal>:<type>'
 *  mods(id?)          -> { owned:[...], fits:[...] } for a weapon (default: current)
 *  addMod(id, mod)    -> { ok, msg }   suppressor | extmag | scope
 *  setAmmo(type)      -> { ok, msg }   std | hollow | ap (unloads the mag back to its box, then reloads)
 *  reload()           -> bool          scope(on?) -> bool   wheel(open?) -> bool
 *  inPit()            -> true where only fists are allowed (Rust Pit, a duel, SSX.fight cage) unless SSX.fight allows weapons
 *  on(event, fn) | on(fn) -> unsubscribe.  Events: equip shot dry reload reloaded hit head decal kill give mod ammo wheel pit trade
 *                        Also window 'ssx:arsenal' { detail } and SSX bus 'arsenal:<type>'.
 *  gunsmith           -> { open(), close(), at(), catalog(), trade(id, pay:'stash'|'cash'|'favor') } (mars/gunsmith.js)
 *  debug              -> test helpers (see bottom)
 * Keys: hold Q = wheel (tap Q still cycles), B reload, Z scope, O ammo type. Phone: long-press the 🔫 HUD chip or the 🎯 dock button.
 * Persistence: localStorage 'ssx.arsenal.v1' (owned, mags, ammo boxes, ammo choice, mods). The equipped weapon and the
 * game's own ammo (rounds, shells) stay in the game save.
 */

const KEY = 'ssx.arsenal.v1';
const PIT_AJ = [-292, -68], PIT_R = 12;
const fin = v => typeof v === 'number' && isFinite(v);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ammo: 'std' light rounds and std shells ARE the game's own P.inv.rounds / P.inv.shells (shop, crates, quests keep working)
export const TYPES = {
  std: { name: 'Standard', short: 'STD', dmg: 1 },
  hollow: { name: 'Hollow-point', short: 'HP', dmg: 1.35, armor: 0.7 },
  ap: { name: 'Armour-piercing', short: 'AP', dmg: 1.1, armor: 1 / 0.6, pierceArmor: true },
  slug: { name: 'Coil slug', short: 'SLUG', dmg: 1 }
};
export const CALS = { light: { name: 'Light rounds', types: ['std', 'hollow', 'ap'], core: 'rounds' }, shell: { name: 'Shells', types: ['std', 'ap'], core: 'shells' }, heavy: { name: 'Heavy rounds', types: ['std', 'hollow', 'ap'] }, rail: { name: 'Coil slugs', types: ['slug'] } };
export const MODS = { suppressor: { name: 'Suppressor', icon: '🤫', blurb: 'No "discharging a weapon" crime, quieter shots, -8% damage.' }, extmag: { name: 'Extended mag', icon: '➕', blurb: '+50% magazine, slightly slower reload.' }, scope: { name: 'Scope', icon: '🔭', blurb: 'Zoom (Z / 🔭) and half the bloom while scoped.' } };
// core = the game.js WEAPONS id this gun fires through. smg + shotgun are the game's own guns (Ozzie's / colony shop).
export const ARS = {
  pistol: { core: 'ar_pistol', name: 'Kestrel M3 sidearm', icon: '🔫', kind: 'gun', cal: 'light', mag: 12, reload: 1.1, recoil: 0.035, bloom: 0.012, bloomMax: 0.06, knock: 0.35, mods: ['suppressor', 'extmag', 'scope'],
    base: { name: 'Kestrel M3 sidearm', cd: 0.2, dmg: 1.6, speed: 150, color: 0xffe066, size: 0.55, life: 0.8, spread: 0.006 } },
  smg: { core: 'smg', name: 'Viper SMG', icon: '🔫', kind: 'gun', cal: 'light', mag: 30, reload: 1.6, recoil: 0.018, bloom: 0.006, bloomMax: 0.08, knock: 0.2, mods: ['suppressor', 'extmag'], unlock: 'weapon:smg' },
  shotgun: { core: 'shotgun', name: 'Breacher shotgun', icon: '💥', kind: 'gun', cal: 'shell', mag: 6, reload: 2.3, recoil: 0.09, bloom: 0.02, bloomMax: 0.05, knock: 0.25, mods: ['extmag'], unlock: 'weapon:shotgun' },
  rifle: { core: 'ar_rifle', name: 'Longwatch AR-7 battle rifle', icon: '🎯', kind: 'gun', cal: 'heavy', mag: 24, reload: 1.9, recoil: 0.03, bloom: 0.008, bloomMax: 0.06, knock: 0.5, mods: ['suppressor', 'extmag', 'scope'],
    base: { name: 'Longwatch AR-7', cd: 0.12, dmg: 2.2, speed: 170, color: 0xffe066, size: 0.6, life: 0.9, spread: 0.004 } },
  rail: { core: 'ar_rail', name: 'Halcyon coil lance', icon: '⚡', kind: 'gun', cal: 'rail', mag: 3, reload: 2.8, charge: 1.2, recoil: 0.12, bloom: 0, bloomMax: 0, knock: 1.6, mods: ['scope'], rare: true,
    base: { name: 'Halcyon coil lance', cd: 0.6, dmg: 16, speed: 460, color: 0xff5cf0, size: 1.5, life: 0.45, pierce: true, beam: true, rail: true } },
  knife: { core: 'ar_knife', name: 'Gutter knife', icon: '🔪', kind: 'melee', mult: 3, knockMult: 0.7, mods: [], base: { name: 'Gutter knife', cd: 0.4, dmg: 0, speed: 1, color: 0xffffff, size: 0.01, life: 0.01 } },
  bat: { core: 'ar_bat', name: 'Slugger bat', icon: '🏏', kind: 'melee', mult: 2.2, knockMult: 2.6, mods: [], base: { name: 'Slugger bat', cd: 0.5, dmg: 0, speed: 1, color: 0xffffff, size: 0.01, life: 0.01 } }
};
const CORE_EXTRA = [['blaster', 'rifle', '🔫', 'Plasma blaster', u => true], ['railrifle', 'railrifle', '⚡', 'Rail rifle', u => u.includes('weapon:railrifle')], ['launcher', 'launcher', '💣', 'Frag launcher', u => u.includes('weapon:launcher')],
  ['blade', 'blade', '🗡️', 'Vibro-machete', u => u.includes('melee:blade')], ['cleaver', 'cleaver', '🪓', 'Thermal cleaver', u => u.includes('melee:cleaver')]];
const BYCORE = {}; for (const [id, a] of Object.entries(ARS)) { a.id = id; BYCORE[a.core] = a; }

// ---------- state ----------
const fresh = () => ({ v: 1, owned: { pistol: true, knife: true }, mags: { pistol: { n: 12, type: 'std' } }, res: {}, sel: {}, mods: {}, debt: null, starter: false });
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1 && s.owned) return { ...fresh(), ...s }; } catch (e) { /* fresh */ } return fresh(); }
let S = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };
const R = { reload: null, bloom: 0, kick: 0, charge: 0, chargeReq: -9, scoped: false, swing: null, quiet: false, last: null, tNow: 0, pitNote: -9, dryNote: -9 };
const stats = { shots: 0, hits: 0, heads: 0, reloads: 0, dry: 0, pitBlocks: 0, swings: 0, decals: 0 };
let subs = [];
function emit(type, d = {}) {
  const ev = { ...d, type };
  for (const f of [...subs]) { try { if (!f.t || f.t === type) f.fn(ev); } catch (e) { console.warn('arsenal sub', e); } }
  try { window.dispatchEvent(new CustomEvent('ssx:arsenal', { detail: ev })); } catch (e) { /* old browser */ }
  try { window.SSX?.emit?.('arsenal:' + type, ev); } catch (e) { /* no bus */ }
}
function on(a, b) { const s = typeof a === 'function' ? { fn: a } : { t: a, fn: b }; if (typeof s.fn !== 'function') return () => {}; subs.push(s); return () => { subs = subs.filter(x => x !== s); }; }

const app = () => window.__app || null;
const surf = () => app()?.surface || null;
const game = () => surf()?.game || null;
const world = () => surf()?.world || null;
const P = () => game()?.progress || null;
const toast = (m, ms = 2600) => { try { app()?.toast?.(m, ms); } catch (e) { /* no toast */ } };
const mobile = () => !!(T?.isMobile ?? matchMedia?.('(pointer: coarse)')?.matches);
let T = null; // last surface tick context

// ---------- ownership / ammo ----------
function owned(id) { const a = ARS[id]; if (!a) return false; if (a.unlock && P()?.unlocks?.includes(a.unlock)) return true; return !!S.owned[id]; }
const hasMod = (id, m) => !!S.mods[id]?.includes(m);
const magCap = a => Math.round(a.mag * (hasMod(a.id, 'extmag') ? 1.5 : 1));
const magOf = id => { const a = ARS[id]; if (!a || a.kind !== 'gun') return null; const m = S.mags[id] || (S.mags[id] = { n: 0, type: CALS[a.cal].types[0] }); if (!fin(m.n)) m.n = 0; return m; };
function resGet(cal, type) { const c = CALS[cal], p = P(); if (c?.core && type === 'std' && p?.inv) return p.inv[c.core] | 0; return S.res[cal + ':' + type] | 0; }
function resSet(cal, type, n) { n = Math.max(0, n | 0); const c = CALS[cal], p = P(); if (c?.core && type === 'std' && p?.inv) { p.inv[c.core] = n; try { game().save(); } catch (e) { /* */ } return; } S.res[cal + ':' + type] = n; save(); }
const selOf = a => { const t = S.sel[a.id]; return CALS[a.cal].types.includes(t) ? t : CALS[a.cal].types[0]; };
function curArs() { const p = P(); const a = p && BYCORE[p.equip?.weapon]; return a && owned(a.id) ? a : null; }

// ---------- the Rust Pit / duels: fists only ----------
// cheap per-call position (surface.info builds a big object; this runs several times a frame)
function pos() {
  const w = world(); if (T?.player && fin(T.player.x)) { const c = T.car; return { x: c ? c.x : T.player.x, z: c ? c.z : T.player.z, driving: !!c, inside: !!w?.inside, name: T.name }; }
  const i = surf()?.info; return i ? { x: i.x, z: i.z, driving: !!i.driving, inside: !!i.inside, name: i.name } : null;
}
function colony() { const c = world()?.colony; return c && fin(c.x) ? c : null; }
function pitAt() { const c = colony(); if (!c) return null; let at = PIT_AJ; try { const s = window.SSX?.fight?.status?.(); if (Array.isArray(s?.at)) at = s.at; } catch (e) { /* no fight club */ } return { x: c.x + at[0], z: c.z + at[1] }; }
function inPit() {
  try { const F = window.SSX?.fight; if (F && (F.allowWeapons?.() === true || F.status?.()?.weapons === true)) return false; } catch (e) { /* guarded */ }
  const w = world(); if (w?.inDuel) return true;
  try { if (window.SSX?.fight?.debug?.inCage) return true; } catch (e) { /* guarded */ }
  const i = pos(); if (!i || i.name !== 'Mars' || i.driving) return false;
  const p = pitAt(); return !!p && fin(i.x) && Math.hypot(i.x - p.x, i.z - p.z) < PIT_R;
}
const onFoot = () => { const i = pos(); return !!i && !i.driving && !i.inside; };

// ---------- WEAPONS entries (the game's fire() reads these) ----------
function installWeapons() {
  for (const a of Object.values(ARS)) {
    if (a.base) { WEAPONS[a.core] = { ...a.base }; a.base0 = { ...a.base }; }
    else if (WEAPONS[a.core]) { a.base0 = { ...WEAPONS[a.core] }; delete WEAPONS[a.core].ammo; delete a.base0.ammo; } // smg/shotgun: magazine-fed now, rounds/shells are the reserve
  }
}
function prep(a) { // per-shot stats: ammo type, bloom, mods
  const W = WEAPONS[a.core], b = a.base0; if (!W || !b) return;
  const m = magOf(a.id), t = TYPES[m?.type] || TYPES.std, scoped = R.scoped && hasMod(a.id, 'scope');
  W.dmg = b.dmg * t.dmg * (hasMod(a.id, 'suppressor') ? 0.92 : 1);
  W.spread = (b.spread || 0) + R.bloom * (scoped ? 0.5 : 1) + R.kick * 0.25;
  W.pierce = !!b.pierce;
}

// ---------- firing (wraps game.fire / game.update / game.melee) ----------
let origFire = null, origUpdate = null, origMelee = null, origHit = null, origMeleeWorld = null, origShot = null;
function note(kind, msg) { if (R.tNow - (R[kind] ?? -9) > 2.5) { R[kind] = R.tNow; toast(msg); } }
function fireReq(aim, src) {
  const g = game(); if (!g || !origFire) return false;
  if (!onFoot()) return origFire.call(g, aim); // rover turret / drive-by: the game's own rules
  if (inPit()) { stats.pitBlocks++; emit('pit', { src }); note('pitNote', '🥊 Rust Pit rules: fists only. Use 👊 melee.'); return false; }
  const a = curArs(); if (!a) return origFire.call(g, aim);
  if (a.kind === 'melee') return swing(a);
  if (R.reload) return false;
  const m = magOf(a.id);
  if (m.n <= 0) { if (!startReload(a)) { stats.dry++; emit('dry', { id: a.id }); note('dryNote', `${a.icon} ${a.name}: empty. ${a.rare ? 'Bore sells coil slugs.' : 'Buy ammo from Bore or the gun shop.'}`); } return false; }
  if (a.charge) { R.chargeReq = R.tNow; R.chargeAim = aim; if (R.charge < a.charge) return false; }
  prep(a);
  let aim2 = aim; if (aim && fin(aim.x)) aim2 = { x: aim.x + (Math.random() - 0.5) * R.bloom * 2, y: aim.y + R.kick };
  R.quiet = hasMod(a.id, 'suppressor'); R.last = { id: a.id, type: m.type, knock: a.knock, t: R.tNow };
  let ok = false; try { ok = !!origFire.call(g, aim2); } finally { R.quiet = false; }
  if (ok) {
    m.n--; save(); stats.shots++; R.charge = 0;
    R.bloom = Math.min(a.bloomMax, R.bloom + a.bloom); R.kick = Math.min(0.25, R.kick + a.recoil);
    emit('shot', { id: a.id, mag: m.n, ammoType: m.type, suppressed: hasMod(a.id, 'suppressor') });
    if (m.n <= 0) startReload(a);
  }
  return ok;
}
function swing(a) {
  const g = game(); if (!g || !origMelee) return false;
  R.swing = a; let ok = false; try { ok = !!origMelee.call(g); } finally { R.swing = null; }
  if (ok) { stats.swings++; emit('shot', { id: a.id, melee: true }); }
  return ok;
}
function startReload(a) {
  if (!a || a.kind !== 'gun' || R.reload) return false;
  const m = magOf(a.id), cap = magCap(a); if (m.n >= cap) return false;
  const type = selOf(a); if (m.n > 0 && m.type !== type) { resSet(a.cal, m.type, resGet(a.cal, m.type) + m.n); m.n = 0; }
  m.type = type; if (resGet(a.cal, type) <= 0) return false;
  R.reload = { id: a.id, t: a.reload * (hasMod(a.id, 'extmag') ? 1.12 : 1), total: a.reload }; R.charge = 0;
  emit('reload', { id: a.id, ammoType: type }); return true;
}
function finishReload() {
  const a = ARS[R.reload.id]; R.reload = null; if (!a) return;
  const m = magOf(a.id), cap = magCap(a), have = resGet(a.cal, m.type), n = Math.min(cap - m.n, have);
  if (n > 0) { resSet(a.cal, m.type, have - n); m.n += n; save(); stats.reloads++; }
  emit('reloaded', { id: a.id, mag: m.n, ammoType: m.type });
}

// ---------- world damage hooks: headshots on people, AP vs armour, hit reactions, decals ----------
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Vector3();
let tgtCache = { t: -1, sec: [], ppl: [] };
function targets() {
  if (tgtCache.t === R.tNow) return tgtCache; const w = world(), h = T?.height || ((x, z) => w?.groundAt?.(x, z) ?? 0);
  let sec = [], ppl = []; try { sec = (w?.securityList?.() || []).filter(s => !['drone', 'gunship', 'buggy'].includes(s.kind)).map(s => ({ ...s, base: s.y, cy: s.y + 1.2, r: 0.75, head: 1.7, sec: true })); } catch (e) { /* */ }
  try { ppl = (w?.debug?.people?.() || []).filter(p => p.on && p.kind !== 'contact').map(p => { const g = h(p.x, p.z); return { ...p, base: g, cy: g + 1.2, r: 0.6, head: 1.55 }; }); } catch (e) { /* */ }
  return (tgtCache = { t: R.tNow, sec, ppl });
}
function preHit(p0, p1) {
  const L = targets(); _a.copy(p1).sub(p0); const L2 = _a.lengthSq(); let best = null, bt = 2;
  for (const o of [...L.sec, ...L.ppl]) {
    if (!fin(o.x) || !fin(o.cy)) continue; _c.set(o.x, o.cy, o.z);
    const t = L2 ? clamp(_b.copy(_c).sub(p0).dot(_a) / L2, 0, 1) : 0; _q.copy(p0).addScaledVector(_a, t);
    if (_q.distanceTo(_c) < o.r && t < bt) { bt = t; best = { o, y: _q.y, x: _q.x, z: _q.z, head: _q.y > o.base + o.head && o.kind !== 'heavy' }; }
  }
  return best;
}
function wrapHit(p0, p1, b) {
  let info = null; const ours = R.last && R.tNow - R.last.t < 3;
  try { if (b && fin(p0?.x) && fin(p1?.x)) info = preHit(p0, p1); } catch (e) { info = null; }
  const d0 = b?.dmg; let mult = 1;
  if (info && b) {
    if (info.head && !info.o.sec) mult *= 2.5; // people had no head check in hitWorld; security already gets x2.5 there
    const t = ours ? TYPES[R.last.type] : null; if (t && info.o.kind === 'heavy') mult *= t.armor || 1;
    b.dmg = d0 * mult;
  }
  let r = false; try { r = origHit.call(world(), p0, p1, b); } finally { if (b && info) b.dmg = d0; }
  if (r && info) afterHit(info, p0, p1, d0 * mult);
  return r;
}
function afterHit(info, p0, p1, dmg) {
  stats.hits++; if (info.head) stats.heads++;
  const fx = p1.x - p0.x, fz = p1.z - p0.z, L = Math.hypot(fx, fz) || 1, ux = fx / L, uz = fz / L;
  emit(info.head ? 'head' : 'hit', { kind: info.o.kind, head: info.head, dmg: +dmg.toFixed(2), x: info.x, z: info.z });
  if (info.head) emit('hit', { kind: info.o.kind, head: true, dmg: +dmg.toFixed(2) });
  decal(info.o.x + ux * (0.8 + Math.random() * 0.8), info.o.z + uz * (0.8 + Math.random() * 0.8), info.head ? 1.1 : 0.7);
  if (Math.random() < 0.5) decal(info.o.x + (Math.random() - 0.5), info.o.z + (Math.random() - 0.5), 0.45);
  // hit reaction: a zero-damage shove through the game's own melee path (pushes people and foot security, no extra damage)
  const w = world(), kn = (R.last?.knock ?? 0.3) * (info.head ? 1.4 : 1);
  if (w && origMeleeWorld && !w.inDuel && kn > 0) { try { R.shove = true; origMeleeWorld.call(w, info.o.x - ux * 0.6, info.o.z - uz * 0.6, ux, uz, 0.9, 0, kn); } catch (e) { /* */ } finally { R.shove = false; } }
}
function wrapMeleeWorld(x, z, fx, fz, range, dmg, knock) {
  const a = R.swing; if (!a || R.shove) return origMeleeWorld.call(world(), x, z, fx, fz, range, dmg, knock);
  const r = origMeleeWorld.call(world(), x, z, fx, fz, range + (a.id === 'bat' ? 0.4 : 0), dmg * a.mult, (knock || 0.9) * a.knockMult);
  if (r) { stats.hits++; emit('hit', { kind: 'melee', id: a.id }); decal(x + fx * range * 0.8, z + fz * range * 0.8, a.id === 'knife' ? 0.8 : 0.5); }
  return r;
}

// ---------- blood decals (M-rated; cheap: one shared texture, capped, fading) ----------
let decals = [], decTex = null, decGeo = null;
function decalTex() {
  if (decTex) return decTex; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const blob = (cx, cy, r, a) => { x.fillStyle = `rgba(120,0,6,${a})`; x.beginPath(); x.arc(cx, cy, r, 0, 6.283); x.fill(); };
  blob(64, 64, 30, 0.9); for (let i = 0; i < 26; i++) { const an = Math.random() * 6.283, d = 18 + Math.random() * 40; blob(64 + Math.cos(an) * d, 64 + Math.sin(an) * d, 2 + Math.random() * 9, 0.85); }
  x.globalCompositeOperation = 'source-atop'; blob(56, 58, 14, 0.35);
  decTex = new THREE.CanvasTexture(c); decGeo = new THREE.PlaneGeometry(1, 1); decGeo.rotateX(-Math.PI / 2); return decTex;
}
function decal(x, z, s = 0.8) {
  const sc = T?.scene; if (!sc || !fin(x) || !fin(z)) return null;
  try {
    const m = new THREE.Mesh(decGeo || (decalTex(), decGeo), new THREE.MeshBasicMaterial({ map: decalTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, opacity: 0.92 }));
    const gy = T.height?.(x, z); m.position.set(x, (fin(gy) ? gy : 0) + 0.04, z); m.rotation.y = Math.random() * 6.283; m.scale.setScalar(s * (0.7 + Math.random() * 0.6));
    m.renderOrder = 2; sc.add(m); const d = { m, t: 45, sc }; decals.push(d); stats.decals++;
    while (decals.length > (mobile() ? 28 : 56)) { const o = decals.shift(); o.sc.remove(o.m); o.m.material.dispose(); }
    emit('decal', { x, z, n: decals.length }); return d;
  } catch (e) { return null; }
}
function tickDecals(dt) {
  for (const d of [...decals]) { d.t -= dt; if (d.sc !== T?.scene || d.t <= 0) { d.sc.remove(d.m); d.m.material.dispose(); decals.splice(decals.indexOf(d), 1); } else if (d.t < 8) d.m.material.opacity = 0.92 * d.t / 8; }
}

// ---------- equip / cycle ----------
function wheelItems() {
  const u = P()?.unlocks || [], cur = P()?.equip?.weapon, out = [];
  for (const a of Object.values(ARS)) if (owned(a.id)) out.push({ id: a.id, core: a.core, name: a.name, icon: a.icon, kind: a.kind, equipped: cur === a.core });
  for (const [id, core, icon, name, has] of CORE_EXTRA) if (has(u)) out.push({ id, core, name, icon, kind: 'core', equipped: cur === core });
  return out;
}
function equip(id) {
  const g = game(), p = P(); if (!g || !p) return { ok: false, msg: 'Not in the field.' };
  const a = ARS[id];
  if (a) {
    if (!owned(id)) return { ok: false, msg: `You don\u2019t own a ${a.name}.` };
    if (p.equip.weapon !== a.core) { R.reload = null; R.charge = 0; R.bloom = 0; if (!hasMod(id, 'scope')) R.scoped = false; }
    p.equip.weapon = a.core; try { g.save(); } catch (e) { /* */ }
    emit('equip', { id, core: a.core, name: a.name }); return { ok: true, msg: `${a.icon} ${a.name}` };
  }
  const c = CORE_EXTRA.find(q => q[0] === id || q[1] === id); if (!c) return { ok: false, msg: 'Unknown weapon.' };
  if (!c[4](p.unlocks || [])) return { ok: false, msg: `You don\u2019t own a ${c[3]}.` };
  R.reload = null; R.scoped = false;
  if (p.equip.weapon !== c[1]) { const ok = g.switchWeapon(c[1]); if (!ok && p.equip.weapon !== c[1]) { p.equip.weapon = c[1]; g.save(); } }
  emit('equip', { id: c[0], core: c[1], name: c[3] }); return { ok: true, msg: `${c[2]} ${c[3]}` };
}
function cycle() { const L = wheelItems(); if (!L.length) return false; const i = L.findIndex(q => q.equipped); const n = L[(i + 1) % L.length]; const r = equip(n.id); if (r.ok) toast(r.msg, 1400); return r.ok; }
function setAmmo(type) {
  const a = curArs(); if (!a || a.kind !== 'gun') return { ok: false, msg: 'No gun in hand.' };
  const types = CALS[a.cal].types; if (!type) type = types[(types.indexOf(selOf(a)) + 1) % types.length];
  if (!types.includes(type)) return { ok: false, msg: `${a.name} takes ${types.join(' / ')}.` };
  S.sel[a.id] = type; save(); const m = magOf(a.id);
  if (m.type !== type) { R.reload = null; startReload(a); }
  emit('ammo', { id: a.id, ammoType: type }); return { ok: true, msg: `${a.icon} ${TYPES[type].name} (${resGet(a.cal, type)})` };
}
function give(id, ammo = 0, type) {
  if (/^ammo:/.test(id)) { const [, cal, t] = id.split(':'); if (!CALS[cal] || !CALS[cal].types.includes(t)) return { ok: false, msg: 'Unknown ammo.' }; resSet(cal, t, resGet(cal, t) + (ammo | 0)); emit('give', { id, ammo }); return { ok: true, msg: `${CALS[cal].name} (${TYPES[t].short}) +${ammo | 0}` }; }
  const a = ARS[id]; if (!a) return { ok: false, msg: 'Unknown weapon.' };
  const had = owned(id); S.owned[id] = true; if (a.unlock && P() && !P().unlocks.includes(a.unlock)) { P().unlocks.push(a.unlock); try { game().save(); } catch (e) { /* */ } }
  if (a.kind === 'gun') { const t = type && CALS[a.cal].types.includes(type) ? type : CALS[a.cal].types[0]; if (ammo) resSet(a.cal, t, resGet(a.cal, t) + (ammo | 0)); const m = magOf(a.id); if (!had && m.n <= 0) { m.type = t; const n = Math.min(magCap(a), resGet(a.cal, t)); resSet(a.cal, t, resGet(a.cal, t) - n); m.n = n; } }
  save(); emit('give', { id, ammo, had }); return { ok: true, msg: had ? `${a.name}: ammo +${ammo | 0}` : `${a.icon} ${a.name}: yours.` };
}
function addMod(id, mod) {
  const a = ARS[id]; if (!a || !MODS[mod]) return { ok: false, msg: 'Unknown mod.' };
  if (!a.mods.includes(mod)) return { ok: false, msg: `A ${MODS[mod].name.toLowerCase()} won\u2019t fit the ${a.name}.` };
  if (hasMod(id, mod)) return { ok: false, msg: 'Already fitted.' };
  (S.mods[id] ||= []).push(mod); save(); emit('mod', { id, mod }); return { ok: true, msg: `${MODS[mod].icon} ${MODS[mod].name} on the ${a.name}.` };
}
function current() {
  const p = P(); if (!p) return null; const a = curArs();
  if (!a) { const c = CORE_EXTRA.find(q => q[1] === p.equip?.weapon); return { id: c ? c[0] : p.equip?.weapon, name: c ? c[3] : p.equip?.weapon, kind: 'core', core: true }; }
  const m = a.kind === 'gun' ? magOf(a.id) : null;
  return { id: a.id, name: a.name, icon: a.icon, kind: a.kind, mag: m?.n ?? null, magSize: m ? magCap(a) : null, reserve: m ? resGet(a.cal, selOf(a)) : null, ammoType: m ? m.type : null, sel: m ? selOf(a) : null,
    reloading: R.reload ? +(R.reload.t.toFixed(2)) : 0, charge: a.charge ? +(R.charge / a.charge).toFixed(2) : null, mods: [...(S.mods[a.id] || [])], scoped: R.scoped && hasMod(a.id, 'scope'), bloom: +R.bloom.toFixed(3) };
}
function ammo(id) { const a = ARS[id] || curArs(); if (!a || a.kind !== 'gun') return null; const types = {}; for (const t of CALS[a.cal].types) types[t] = resGet(a.cal, t); return { cal: a.cal, types, sel: selOf(a), mag: { ...magOf(a.id) } }; }
function weapons() { const cur = P()?.equip?.weapon; return [...Object.values(ARS).map(a => ({ id: a.id, name: a.name, icon: a.icon, kind: a.kind, owned: owned(a.id), equipped: cur === a.core, rare: !!a.rare, ...(a.kind === 'gun' ? { mag: magOf(a.id).n, magSize: magCap(a), reserve: resGet(a.cal, selOf(a)), ammoType: magOf(a.id).type, cal: a.cal } : {}), mods: [...(S.mods[a.id] || [])], fits: [...a.mods] })),
  ...wheelItems().filter(q => q.kind === 'core').map(q => ({ id: q.id, name: q.name, icon: q.icon, kind: 'core', owned: true, equipped: q.equipped }))]; }

// ---------- UI: ammo pill, reticle, weapon wheel ----------
const css = `
#arHud{position:fixed;z-index:9;left:50%;transform:translateX(-50%);bottom:calc(92px + env(safe-area-inset-bottom));display:none;align-items:center;gap:6px;padding:4px;border-radius:14px;background:#000;color:#fff;border:2px solid #fff;font:700 14px system-ui,sans-serif}
body.surface:not(.indoors) #arHud.show{display:flex}
#arHud button{min-height:44px;min-width:44px;border-radius:10px;border:2px solid #fff;background:#111;color:#fff;font:700 14px system-ui,sans-serif;padding:0 10px;touch-action:manipulation}
#arHud button.on{background:#ffd400;color:#000;border-color:#ffd400} #arHud .rl{color:#ffd400} #arHud .lo{color:#ff6b6b}
#arRet{position:fixed;left:50%;top:50%;z-index:8;pointer-events:none;border:2px solid rgba(255,255,255,.9);border-radius:50%;transform:translate(-50%,-50%);display:none;box-shadow:0 0 0 1px #000}
body.surface:not(.indoors) #arRet.show{display:block}
#arWheel{position:fixed;inset:0;z-index:60;display:none;background:rgba(0,0,0,.78);touch-action:none}
#arWheel.open{display:block}
#arWheel .slot{position:absolute;width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;background:#000;color:#fff;border:3px solid #fff;font:700 12px system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:4px;text-align:center;line-height:1.05;touch-action:manipulation}
#arWheel .slot .i{font-size:24px} #arWheel .slot.eq{border-color:#3ee07a} #arWheel .slot.hi{background:#ffd400;color:#000;border-color:#ffd400}
#arWheel .mid{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:150px;text-align:center;color:#fff;font:700 14px system-ui,sans-serif;pointer-events:none}
#arWheel .mid b{display:block;font-size:16px;color:#ffd400;margin-bottom:4px}
#arWheel #arWheelX{position:absolute;right:calc(14px + env(safe-area-inset-right));top:calc(14px + env(safe-area-inset-top));min-width:56px;min-height:56px;border-radius:50%;background:#000;color:#fff;border:3px solid #fff;font:700 22px system-ui,sans-serif}
#ssxDock #arDockBtn{font-size:20px}
@media (max-width:640px){#arHud{left:calc(10px + env(safe-area-inset-left));transform:none;bottom:calc(340px + env(safe-area-inset-bottom));font-size:13px} #arWheel .slot{width:76px;height:76px;margin:-38px 0 0 -38px;font-size:11px}}`;
let hud = null, hudTx = null, rlBtn = null, scBtn = null, amBtn = null, ret = null, wheel = null, wheelHi = -1, wheelOpenT = 0;
const tap = (el, fn) => { if (window.__onTap) window.__onTap(el, fn); else { el.addEventListener('pointerup', e => { e.preventDefault(); fn(e); }); } };
function ui() {
  if (hud) return; const st = document.createElement('style'); st.id = 'arCss'; st.textContent = css; document.head.appendChild(st);
  hud = document.createElement('div'); hud.id = 'arHud'; hud.innerHTML = '<button id="arAmmo" type="button" aria-label="Reload"><span class="tx"></span></button><button id="arType" type="button" aria-label="Ammo type">STD</button><button id="arScope" type="button" aria-label="Scope">🔭</button>';
  document.body.appendChild(hud); rlBtn = hud.querySelector('#arAmmo'); hudTx = rlBtn.querySelector('.tx'); amBtn = hud.querySelector('#arType'); scBtn = hud.querySelector('#arScope');
  tap(rlBtn, () => { const a = curArs(); if (a?.kind === 'gun') startReload(a); else openWheel(); });
  tap(amBtn, () => { const r = setAmmo(); toast(r.msg, 1500); });
  tap(scBtn, () => scope());
  ret = document.createElement('div'); ret.id = 'arRet'; document.body.appendChild(ret);
  wheel = document.createElement('div'); wheel.id = 'arWheel'; wheel.setAttribute('role', 'dialog'); wheel.setAttribute('aria-label', 'Weapon wheel'); document.body.appendChild(wheel);
  wheel.addEventListener('pointermove', e => { if (!wheel.classList.contains('open') || e.pointerType !== 'mouse') return; hiAt(e.clientX, e.clientY); });
  wheel.addEventListener('pointerup', e => { if (e.target === wheel && performance.now() - wheelOpenT > 350) closeWheel(); });
  hookGearChip(); dockButton();
}
function renderWheel() {
  const L = wheelItems(), W = innerWidth, H = innerHeight, cx = W / 2, cy = H / 2, r = Math.max(118, Math.min(W, H) * 0.34);
  wheel.innerHTML = '<div class="mid"><b>ARSENAL</b><span id="arWheelInfo"></span></div><button id="arWheelX" type="button" aria-label="Close weapon wheel">✕</button>';
  L.forEach((it, i) => {
    const an = -Math.PI / 2 + i * 2 * Math.PI / L.length, b = document.createElement('button'); b.type = 'button'; b.className = 'slot' + (it.equipped ? ' eq' : ''); b.dataset.id = it.id;
    const a = ARS[it.id], m = a?.kind === 'gun' ? magOf(a.id) : null;
    b.innerHTML = `<span class="i">${it.icon}</span><span>${it.name.split(' ').slice(0, 2).join(' ')}</span>${m ? `<span>${m.n}/${resGet(a.cal, selOf(a))}</span>` : ''}`;
    b.style.left = (cx + Math.cos(an) * r) + 'px'; b.style.top = (cy + Math.sin(an) * r) + 'px'; b.setAttribute('aria-label', it.name);
    wheel.appendChild(b); tap(b, () => { if (performance.now() - wheelOpenT < 250) return; pick(it.id); });
  });
  tap(wheel.querySelector('#arWheelX'), () => closeWheel());
  const c = current(); wheel.querySelector('#arWheelInfo').textContent = c ? `${c.name}${c.mag != null ? ` · ${c.mag}/${c.magSize}` : ''}` : '';
}
function hiAt(x, y) {
  const slots = [...wheel.querySelectorAll('.slot')]; if (!slots.length) return; const dx = x - innerWidth / 2, dy = y - innerHeight / 2;
  if (Math.hypot(dx, dy) < 50) { wheelHi = -1; } else { let an = Math.atan2(dy, dx) + Math.PI / 2; if (an < 0) an += 2 * Math.PI; wheelHi = Math.round(an / (2 * Math.PI / slots.length)) % slots.length; }
  slots.forEach((s, i) => s.classList.toggle('hi', i === wheelHi)); const s = slots[wheelHi]; if (s) wheel.querySelector('#arWheelInfo').textContent = s.getAttribute('aria-label');
}
function openWheel() { ui(); if (!game()) return false; renderWheel(); wheel.classList.add('open'); wheelOpenT = performance.now(); wheelHi = -1; emit('wheel', { open: true }); return true; }
function closeWheel(sel = false) { if (!wheel?.classList.contains('open')) return false; if (sel && wheelHi >= 0) { const s = wheel.querySelectorAll('.slot')[wheelHi]; if (s) pick(s.dataset.id, true); } wheel.classList.remove('open'); emit('wheel', { open: false }); return true; }
function pick(id, keep) { const r = equip(id); toast(r.msg, 1400); if (!keep) closeWheel(); emit('wheel', { pick: id, ok: r.ok }); return r.ok; }
function scope(onv) { const a = curArs(); if (!a || !hasMod(a.id, 'scope')) { R.scoped = false; return false; } R.scoped = onv == null ? !R.scoped : !!onv; return R.scoped; }
// long-press the 🔫 HUD chip -> wheel; a short tap cycles every weapon (the game's own and the arsenal's)
function hookGearChip() {
  let t = null, long = false, sx = 0, sy = 0, lastTouch = 0;
  const isChip = e => !!e.target?.closest?.('#gearChip');
  document.addEventListener('pointerdown', e => { if (!isChip(e)) return; long = false; sx = e.clientX; sy = e.clientY; clearTimeout(t); t = setTimeout(() => { long = true; openWheel(); }, 450); }, true);
  document.addEventListener('pointermove', e => { if (t && Math.hypot(e.clientX - sx, e.clientY - sy) > 14) { clearTimeout(t); t = null; } }, true);
  document.addEventListener('pointerup', e => { if (!isChip(e)) { clearTimeout(t); t = null; return; } clearTimeout(t); t = null; if (e.pointerType === 'mouse') { if (long) { e.stopImmediatePropagation(); e.preventDefault(); } return; }
    e.stopImmediatePropagation(); e.preventDefault(); lastTouch = performance.now(); if (!long) cycle(); }, true);
  document.addEventListener('click', e => { if (!isChip(e)) return; e.stopImmediatePropagation(); e.preventDefault(); if (performance.now() - lastTouch < 700) return; if (long) { long = false; return; } cycle(); }, true);
}
function dockButton() {
  const attach = () => { const d = document.getElementById('ssxDock'); if (!d) return false; if (document.getElementById('arDockBtn')) return true;
    const b = document.createElement('button'); b.id = 'arDockBtn'; b.type = 'button'; b.textContent = '🎯'; b.setAttribute('aria-label', 'Weapon wheel'); b.style.order = '6'; d.appendChild(b); tap(b, () => openWheel()); return true; };
  if (attach()) return; try { const mo = new MutationObserver(() => { if (attach()) mo.disconnect(); }); mo.observe(document.body, { childList: true }); } catch (e) { /* no dock */ }
}
function keys() {
  let qT = null, qLong = false;
  const typing = e => /input|textarea|select/i.test(e.target?.tagName || '') || e.target?.isContentEditable;
  window.addEventListener('keydown', e => {
    if (typing(e) || !document.body.classList.contains('surface')) return;
    if (e.code === 'KeyQ') { e.stopImmediatePropagation(); e.preventDefault(); if (e.repeat || qT) return; qLong = false; qT = setTimeout(() => { qLong = true; openWheel(); }, 220); return; }
    if (e.repeat) return;
    if (e.code === 'KeyB') { const a = curArs(); if (a) startReload(a); }
    else if (e.code === 'KeyZ' && !document.body.classList.contains('builder')) scope();
    else if (e.code === 'KeyO') { const r = setAmmo(); toast(r.msg, 1500); }
    else if (e.code === 'Escape' && wheel?.classList.contains('open')) closeWheel();
  }, true);
  window.addEventListener('keyup', e => { if (e.code !== 'KeyQ' || !qT && !qLong) return; e.stopImmediatePropagation(); clearTimeout(qT); qT = null; if (qLong) { qLong = false; closeWheel(true); } else cycle(); }, true);
}
function renderHud() {
  if (!hud) return; const c = current(), a = curArs(), show = !!c && document.body.classList.contains('surface');
  hud.classList.toggle('show', show && (!!a || false)); ret.classList.toggle('show', show && a?.kind === 'gun' && !mobile());
  if (!show || !a) return;
  let tx; if (a.kind === 'melee') tx = `${a.icon} ${a.name.split(' ').pop()}`; else if (R.reload) tx = `${a.icon} <span class="rl">RELOAD ${R.reload.t.toFixed(1)}s</span>`;
  else tx = `${a.icon} <span class="${c.mag === 0 ? 'lo' : ''}">${c.mag}/${c.magSize}</span> · ${c.reserve}${a.charge && R.charge > 0 ? ` <span class="rl">⚡${Math.round(100 * R.charge / a.charge)}%</span>` : ''}`;
  if (hudTx.dataset.t !== tx) { hudTx.dataset.t = tx; hudTx.innerHTML = tx; }
  amBtn.style.display = a.kind === 'gun' && CALS[a.cal].types.length > 1 ? '' : 'none'; amBtn.textContent = a.kind === 'gun' ? TYPES[c.sel].short : '';
  scBtn.style.display = hasMod(a.id, 'scope') ? '' : 'none'; scBtn.classList.toggle('on', !!c.scoped);
  const px = Math.round(22 + (R.bloom + R.kick * 0.25) * 900); ret.style.width = ret.style.height = px + 'px'; ret.style.marginTop = (-R.kick * 120) + 'px';
}

// ---------- tick ----------
function tick(dt, tc) {
  T = tc; if (!fin(dt) || dt <= 0) return; dt = Math.min(dt, 0.1); R.tNow += dt;
  const a = curArs();
  if (R.reload) { if (!a || a.id !== R.reload.id) R.reload = null; else { R.reload.t -= dt; if (R.reload.t <= 0) finishReload(); } }
  R.bloom = Math.max(0, R.bloom - dt * 0.12); R.kick *= Math.exp(-dt * 6); if (R.kick < 1e-4) R.kick = 0;
  if (a?.charge) { if (R.tNow - R.chargeReq < 0.2 && !R.reload && magOf(a.id).n > 0 && !inPit()) R.charge = Math.min(a.charge, R.charge + dt); else R.charge = Math.max(0, R.charge - dt * 2); }
  else R.charge = 0;
  const cam = tc?.camera, z = R.scoped && a && hasMod(a.id, 'scope') && onFoot() ? (a.id === 'rail' ? 3 : 2.2) : 1;
  if (cam && cam.zoom !== z) { cam.zoom = z; cam.updateProjectionMatrix?.(); } if (z === 1 && R.scoped && (!a || !hasMod(a.id, 'scope'))) R.scoped = false;
  tickDecals(dt); renderHud();
}

// ---------- boot ----------
function hookGame() {
  const g = game(), w = world(); if (!g || !w || g.__arsenal) return !!g?.__arsenal;
  installWeapons();
  origFire = g.fire; origUpdate = g.update; origMelee = g.melee; origHit = w.hitWorld; origMeleeWorld = w.meleeWorld; origShot = w.shotFired;
  g.fire = function (aim) { try { return fireReq(aim, 'tap'); } catch (e) { console.warn('arsenal fire', e); return origFire.call(g, aim); } };
  g.update = function (dt, input) {
    let held = false, aim = null;
    try { if (input?.fire && onFoot() && (curArs() || inPit())) { held = true; aim = input.fireAim || null; input.fire = false; } } catch (e) { held = false; }
    try { return origUpdate.call(g, dt, input); } finally { if (held) { input.fire = true; try { fireReq(aim, 'held'); } catch (e) { console.warn('arsenal held fire', e); } } }
  };
  g.melee = function () { try { if (onFoot() && inPit()) { /* fists are fine in the pit */ } const a = curArs(); if (a?.kind === 'melee' && !inPit()) return swing(a); } catch (e) { /* fall through */ } return origMelee.call(g); };
  if (typeof origHit === 'function') w.hitWorld = function (p0, p1, b) { try { return wrapHit(p0, p1, b); } catch (e) { console.warn('arsenal hit', e); return false; } };
  if (typeof origMeleeWorld === 'function') w.meleeWorld = function (...a) { try { return wrapMeleeWorld(...a); } catch (e) { console.warn('arsenal melee', e); return false; } };
  if (typeof origShot === 'function') w.shotFired = function (...a) { if (R.quiet) { emit('quiet', {}); return; } return origShot.apply(w, a); };
  g.__arsenal = true;
  if (!S.starter) { S.starter = true; const p = P(); if (p?.inv) p.inv.rounds = (p.inv.rounds | 0) + 24; save(); try { g.save(); } catch (e) { /* */ } }
  try { window.SSX?.on?.('game:secDown', () => rareDrop()); } catch (e) { /* no bus */ }
  return true;
}
function rareDrop() { // ColSec armouries: the odd coil slug, very rarely the lance itself
  const r = Math.random(); if (r < 0.015 && !owned('rail')) { give('rail', 2); toast('⚡ A Halcyon coil lance in the wreck. Rare iron.', 3200); }
  else if (r < 0.07 && owned('rail')) { give('ammo:rail:slug', 1); toast('⚡ Coil slug +1', 1800); }
}
const API = {
  weapons, equip, current, ammo, give, mods: id => { const a = ARS[id] || curArs(); return a ? { owned: [...(S.mods[a.id] || [])], fits: [...a.mods] } : null; }, addMod, setAmmo,
  reload: () => { const a = curArs(); return !!a && startReload(a); }, scope, wheel: o => o === false ? closeWheel() : openWheel(), inPit, on, cycle,
  defs: () => JSON.parse(JSON.stringify(ARS)), types: () => ({ ...TYPES }), cals: () => ({ ...CALS }), modDefs: () => ({ ...MODS }),
  pos, state: () => S, saveState: save, emit, toast, owned, resGet, resSet, hasMod,
  debug: {
    fire: aim => fireReq(aim || null, 'debug'), hold: (sec = 1) => { R.chargeReq = R.tNow + sec; return true; }, charge: () => { const a = curArs(); if (a?.charge) { R.charge = a.charge; R.chargeReq = R.tNow; } return R.charge; },
    reloadNow: () => { if (R.reload) R.reload.t = 0; return true; }, setMag: (n, id) => { const a = ARS[id] || curArs(); if (!a || a.kind !== 'gun') return false; magOf(a.id).n = n; save(); return true; },
    cd: () => { try { game().debug?.H?.(); } catch (e) { /* */ } return true; }, seg: (p0, p1, dmg = 1) => world().hitWorld(new THREE.Vector3(p0.x, p0.y, p0.z), new THREE.Vector3(p1.x, p1.y, p1.z), { dmg }),
    decals: () => decals.length, decal: (x, z) => !!decal(x, z), pit: () => pitAt(), stats: () => ({ ...stats }), R: () => ({ reload: R.reload, bloom: R.bloom, kick: R.kick, charge: R.charge, scoped: R.scoped }),
    reset: () => { S = fresh(); S.starter = true; save(); R.reload = null; R.charge = 0; R.scoped = false; return true; }, load: () => { S = load(); return S; }
  }
};
function boot() {
  const ready = () => window.SSX?.registerSurfaceTick && game() && world();
  if (!ready()) { setTimeout(boot, 250); return; }
  if (!hookGame()) { setTimeout(boot, 250); return; }
  window.SSX.arsenal = API; ui(); keys();
  try { window.SSX.registerSurfaceTick((dt, tc) => { try { tick(dt, tc); } catch (e) { console.warn('arsenal tick', e); } }); } catch (e) { console.warn('arsenal tick hook', e); }
  try { API.gunsmith = initGunsmith(API); } catch (e) { console.warn('gunsmith', e); }
  emit('ready', {});
}
boot();
