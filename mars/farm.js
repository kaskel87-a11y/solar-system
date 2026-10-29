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
 *   SSX.base (#24) / SSX.empire (#52)  see FARM.md "Hooks wanted": no registerPlot / registerPiece yet, so the homestead
 *                     and its dome are ours, not base pieces.
 * UI (team HUD rules): ☰ → 🌱 Farm, plus ONE context button (#farmAct) only while you stand at the homestead or the
 *   trading post. No permanent chips. Plain-word directions. One message at a time (in the open sheet, else one toast).
 *   Black/white, 48px buttons, __onTap. Safe in the Rust Pit (nothing shows or starts there) and in floating cars
 *   (land first; growth keeps going).
 * window.SSX.farm: status() buy() buildDome() addRack() plant(i, crop) harvest(i|'all') refill('water'|'power') patch()
 *   buyers() sell(buyer, crop, qty) useFavor(id) raid(opts) skip(hours) clock() places() open(mode) close() on(type?, fn)
 *   CROPS, debug.*  Events (on(), window 'ssx:farm', SSX.emit('farm:<type>')): buy, dome, rack, plant, ripe, harvest,
 *   refill, patch, wilt, storm, sale, favor, raid, raid:end, stash, day, load.
 * Save: localStorage 'ssx.farm.v1'.
 */
import * as THREE from 'three';
import * as F from './farmcore.js';

const app = () => window.__app, surf = () => app()?.surface, game = () => app()?.game || surf()?.game, world = () => surf()?.world;
const T = () => window.SSX?.time, EMP = () => window.SSX?.empire, STORM = () => window.SSX?.storm, RAIDS = () => window.SSX?.raids, CB = () => window.SSX?.contraband;
const fin = v => Number.isFinite(v);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PIT_AJ = [-292, -68], PIT_R = 12;

// ---------- state ----------
let S = (() => { try { return F.migrate(JSON.parse(localStorage.getItem(F.SAVE_KEY))); } catch (e) { return F.fresh(); } })();
const save = () => { try { localStorage.setItem(F.SAVE_KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };
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
const at = id => onMars() && distTo(id) < F.SITES[id].r + 6;
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
  try { if (t?.set && (t.hour || t.now)) { const h = (t.hour?.() ?? t.now()); t.set(((h + hours) % 24 + 24) % 24); via = 'SSX.time'; const s = srcHour(); if (s) { lastH = s.h; src = s.src; } } } catch (e) { via = 'own'; }
  const o = advance(hours, 'skip'); return { ok: true, hours, via, out: o, status: status() };
}

// ---------- actions ----------
function res(ok, msg, extra = {}) { if (msg) say(msg); refresh(true); return { ok, msg, ...extra }; }
function buy() { const n = need('farm'); if (n) return res(false, n); const v = F.canBuy(S, credits()); if (!v.ok) return res(false, v.why); if (!spend(v.cost)) return res(false, 'Short on credits.');
  S.owned = true; S.water = 40; S.power = 40; save(); rebuildFarm(); emit('buy', { price: v.cost }); return res(true, `🏡 ${F.SITES.farm.name} is yours. Build the greenhouse dome next.`, { cost: v.cost }); }
function buildDome() { const n = need('farm'); if (n) return res(false, n); const v = F.canDome(S, credits()); if (!v.ok) return res(false, v.why); if (!spend(v.cost)) return res(false, 'Short on credits.');
  S.dome = true; S.domeHp = 100; save(); rebuildFarm(); emit('dome', { price: v.cost }); return res(true, '🫧 Greenhouse dome is up. Add a hydroponic rack.', { cost: v.cost }); }
function addRack() { const n = need('farm'); if (n) return res(false, n); const v = F.canRack(S, credits()); if (!v.ok) return res(false, v.why); if (!spend(v.cost)) return res(false, 'Short on credits.');
  S.racks.push(F.freshRack()); save(); rebuildFarm(); emit('rack', { n: S.racks.length, price: v.cost }); return res(true, `🪴 Rack ${S.racks.length} installed. Plant something.`, { cost: v.cost, rack: S.racks.length - 1 }); }
function plant(i, crop) { const n = need('farm'); if (n) return res(false, n); i = i == null ? S.racks.findIndex(r => !r.crop) : i | 0; const v = F.canPlant(S, i, crop, credits()); if (!v.ok) return res(false, v.why); if (!spend(v.cost)) return res(false, 'Short on credits.');
  F.plant(S, i, crop); save(); rebuildFarm(); emit('plant', { rack: i, crop, price: v.cost }); const c = F.CROPS[crop]; return res(true, `${c.icon} ${c.name} planted. Ripe in about ${c.hours} game hours if the water and power hold.`, { rack: i, cost: v.cost }); }
function harvest(i = 'all') {
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
function toStash() {
  const C = CB(), have = S.silo.lichen | 0; if (!C?.add || !have) return 0;
  let room = have; try { const c = C.capacity?.(); if (c && fin(c.max) && fin(c.used)) room = Math.max(0, Math.min(have, c.max - c.used)); } catch (e) { /* */ }
  if (!room) return 0; let r = null; try { r = C.add(F.CROPS.lichen.contraband, room, 1); } catch (e) { return 0; }
  const n = r?.ok === false ? 0 : (fin(r?.qty) ? r.qty : room); if (n > 0) { S.silo.lichen -= n; if (S.silo.lichen <= 0) delete S.silo.lichen; emit('stash', { item: 'glowdust', n }); }
  return n;
}
function refill(what) { const n = need('farm'); if (n) return res(false, n); if (!S.owned) return res(false, 'Buy the homestead first.'); if (what !== 'water' && what !== 'power') return res(false, 'Water or power?');
  const q = F.refillCost(S, what); if (!q.units) return res(false, what === 'water' ? 'The tanks are full.' : 'The cells are full.'); if (!spend(q.cost)) return res(false, `That top-up is ${q.cost} cr.`);
  S[what] = F.LIMITS[what]; save(); emit('refill', { what, units: q.units, cost: q.cost }); return res(true, what === 'water' ? `💧 Tanks filled. ${q.cost} cr.` : `🔋 Power cells charged. ${q.cost} cr.`, q); }
function patch() { const n = need('farm'); if (n) return res(false, n); if (!S.dome) return res(false, 'No dome to patch.'); if (S.domeHp >= 100) return res(false, 'The dome is sound.'); if (!spend(F.PRICES.patch)) return res(false, `A patch kit is ${F.PRICES.patch} cr.`);
  S.domeHp = 100; save(); emit('patch', { cost: F.PRICES.patch }); return res(true, `🩹 Dome patched. ${F.PRICES.patch} cr.`); }
function sell(buyer, crop, qty = 1) {
  const n = need('post'); if (n) return res(false, n);
  const q = F.quoteSale(S, buyer, crop, qty); if (!q.ok) return res(false, q.why);
  F.applySale(S, q); let paid = '';
  if (q.cash) { give(q.cash); paid = `+${q.cash} cr`; }
  else if (q.item) paid = giveItem(q.item);
  else if (q.favor) paid = F.FAVORS[q.favor].name;
  save(); emit('sale', { ...q, paid }); if (q.favor) emit('favor', { id: q.favor, got: true });
  const b = F.BUYERS.find(x => x.id === buyer); return res(true, `${b.icon} ${b.name} took ${q.qty} ${F.CROPS[crop].name}. ${paid}.`, { ...q, paid });
}
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
  const R = RAIDS();
  if (R?.start && p) { try { const r = R.start({ id, pos: { x: p.x, z: p.z }, radius: 24, attackers: 'gang', waves, label: 'Dust raiders', onWin: info => endRaid('win', info), onLose: info => endRaid('lose', info) }); if (r && r.ok !== false) raid.via = 'SSX.raids'; else raid.engineWhy = r?.why || 'refused'; } catch (e) { console.warn('farm raid engine', e); } }
  emit('raid', { id, via: raid.via, waves, watched, silo: F.siloCount(S) });
  say(`🚨 Dust raiders are hitting ${F.SITES.farm.name}. ${at('farm') ? 'Fight them off!' : directions('farm').replace('tap Farm', 'fight them off')}`);
  refresh(true); return { ok: true, id, via: raid.via, waves, watched };
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
  box(14, 0.3, 12, mat(0x3a3340), 0, 0, 0, pg); box(1.2, 6, 1.2, mat(0x221a33, { emissive: 0x7a3cff, emissiveIntensity: 0.6 }), -4.5, 0.3, -3.5, pg);
  box(9, 0.25, 5, mat(0x5b4f73), 1.5, 3.4, -3.5, pg); for (const [x, z] of [[-2.8, -1.2], [5.8, -1.2], [-2.8, -5.8], [5.8, -5.8]]) box(0.25, 3.4, 0.25, mat(0x8d82a8), x, 0.3, z, pg);
  const skin = [0x5fd38a, 0xd07af0, 0x9fb3c8];
  F.BUYERS.forEach((b, k) => { const n = new THREE.Group(); const bd = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 1.7, 3, 8), mat(skin[k])); bd.position.y = 1.35; n.add(bd); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), mat(skin[k], { emissive: skin[k], emissiveIntensity: 0.25 })); hd.scale.set(1, 1.35, 1); hd.position.y = 2.75; n.add(hd); n.position.set(-1 + k * 2.6, 0.3, -2.4); pg.add(n); });
  const ps = sign('XEN-7 TRADING POST', '#ffffff', '#3b1d6e', 8); ps.position.set(1.5, 4.6, -1); pg.add(ps);
  scene.add(G); rebuildFarm(true);
  try { window.SSX?.minimap?.addMarks?.('farm', [{ ...fp, color: '#4ade80', r: 3, ring: true }, { ...pp, color: '#b388ff', r: 2.6, ring: true }]); } catch (e) { /* */ }
}
function rebuildFarm(force) {
  if (!G) return; const fg = G.userData.fg; const key = JSON.stringify([S.owned, S.dome, S.racks.map(r => [r.crop, Math.round(r.growth * 10), r.health > 0])]);
  if (!force && key === rackKey) return; rackKey = key;
  if (rackG) { fg.remove(rackG); rackG.traverse(o => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); }); }
  rackG = new THREE.Group(); fg.add(rackG);
  // the lot: a stake fence, a sign, a water tank and a solar mast. Unowned: a FOR SALE board.
  box(22, 0.2, 22, mat(S.owned ? 0x6b4a32 : 0x7d5a40), 0, 0, 0, rackG);
  for (let k = -5; k <= 5; k++) for (const [x, z] of [[k * 2, -11], [k * 2, 11], [-11, k * 2], [11, k * 2]]) box(0.15, 1.1, 0.15, mat(0xc9b38a), x, 0.2, z, rackG);
  const s = sign(S.owned ? 'DUSTBOWL HOMESTEAD' : 'FOR SALE · HOMESTEAD', S.owned ? '#000000' : '#ffffff', S.owned ? '#ffd84d' : '#b31b1b', 7); s.position.set(0, 2.4, 11.2); rackG.add(s);
  box(0.2, 2.2, 0.2, mat(0x555555), -3.5, 0.2, 11.1, rackG); box(0.2, 2.2, 0.2, mat(0x555555), 3.5, 0.2, 11.1, rackG);
  if (S.owned) { const tk = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.6, 14), mat(0x8ab4d8, { metalness: 0.4 })); tk.position.set(8.5, 1.5, -8.5); rackG.add(tk);
    box(0.2, 3, 0.2, mat(0x777777), -8.5, 0.2, -8.5, rackG); const pnl = box(2.6, 0.08, 1.6, mat(0x1a2a6c, { metalness: 0.6, roughness: 0.3 }), -8.5, 3.2, -8.5, rackG); pnl.rotation.x = -0.5; }
  if (S.dome) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(8, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xcfefff, transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }));
    d.position.y = 0.2; d.name = 'farm-dome'; rackG.add(d);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(8, 0.12, 6, 40), mat(0xdddddd)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; rackG.add(ring);
    const leaf = { potato: 0x6aa84f, algae: 0x2fbf71, glowberry: 0x6e5bff, lichen: 0xd9e6f2 };
    S.racks.forEach((r, k) => {
      const x = -4.5 + (k % 3) * 4.5, z = k < 3 ? -2.5 : 2.5;
      box(3.2, 0.9, 1.2, mat(0x9aa3ad, { metalness: 0.5 }), x, 0.2, z, rackG); box(3.3, 0.06, 1.3, mat(0x3b82f6, { emissive: 0x1d4ed8, emissiveIntensity: 0.4 }), x, 2.3, z, rackG);
      if (r.crop) { const g = Math.max(0.1, r.growth), dead = r.health <= 0; const c = box(3, 0.9 * g, 1, mat(dead ? 0x5a4632 : leaf[r.crop], r.crop === 'glowberry' || r.crop === 'lichen' ? { emissive: leaf[r.crop], emissiveIntensity: r.growth >= 1 ? 0.6 : 0.2 } : {}), x, 1.1, z, rackG); c.name = 'farm-crop'; }
    });
  }
}
function teardown() { if (G) { G.parent?.remove(G); G.traverse(o => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); }); } G = null; rackG = null; rackKey = ''; try { window.SSX?.minimap?.clear?.('farm'); } catch (e) { /* */ } }

// ---------- UI ----------
const css = `
#farmAct{position:fixed;z-index:15;left:calc(14px + env(safe-area-inset-left));bottom:calc(250px + env(safe-area-inset-bottom));display:none;min-height:52px;min-width:120px;padding:6px 16px;border-radius:14px;border:3px solid #fff;background:#000;color:#fff;font:900 17px/1.1 system-ui,sans-serif;touch-action:manipulation;box-shadow:0 2px 10px #000}
#farmAct.on{display:block}
#farmPanel{position:fixed;inset:0;z-index:58;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55)}
#farmPanel.show{display:flex}#farmPanel .wrap{width:min(480px,calc(100vw - 20px));max-height:calc(100vh - 40px);overflow:auto;background:#000;color:#fff;border:3px solid #fff;border-radius:16px;padding:14px 14px 10px;font:600 15px/1.35 system-ui,sans-serif}
#farmPanel h2{margin:0 0 4px;font:900 21px/1.2 system-ui,sans-serif}#farmPanel p{margin:6px 0}#farmPanel .sub{color:#ddd;font-size:13px}
#farmPanel button{display:block;width:100%;min-height:48px;margin:8px 0 0;padding:8px 12px;border-radius:12px;border:2px solid #fff;background:#111;color:#fff;font:800 15px/1.2 system-ui,sans-serif;text-align:left;touch-action:manipulation}
#farmPanel button.pri{background:#fff;color:#000}#farmPanel button:disabled{opacity:1;color:#c8c8c8;border-style:dashed;border-color:#8a8a8a}#farmPanel button small{display:block;font-weight:600;font-size:12px;opacity:.85}
#farmPanel .row{display:flex;gap:8px}#farmPanel .row button{flex:1}
#farmPanel .msg{min-height:18px;margin-top:8px;color:#ffd400;font-weight:800}
`;
let panel, pBody, pMsg, actBtn, pMode = 'farm', actKey = '';
function tap(el, fn) { let last = 0; const g = e => { const n = performance.now(); if (e?.type === 'click' && n - last < 700) return; if (e?.type === 'pointerup') last = n; fn(e); }; (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, g); }
function ui() {
  if (panel) return; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  panel = document.createElement('div'); panel.id = 'farmPanel'; panel.innerHTML = '<div class="wrap" role="dialog" aria-label="Farm"><div id="farmBody"></div><div class="msg" id="farmMsg" aria-live="polite"></div></div>'; document.body.appendChild(panel);
  pBody = panel.querySelector('#farmBody'); pMsg = panel.querySelector('#farmMsg');
  panel.addEventListener('pointerup', e => { if (e.target === panel) close(); });
  actBtn = document.createElement('button'); actBtn.id = 'farmAct'; actBtn.type = 'button'; document.body.appendChild(actBtn);
  tap(actBtn, () => open(actBtn.dataset.mode || 'farm'));
  try { window.SSX.registerMenuItem({ id: 'rmFarm', label: '🌱 Farm', onTap: () => open(at('post') ? 'post' : 'farm') }); } catch (e) { console.warn('farm menu', e); }
}
function btn(a, label, sub, o = {}) { return `<button type="button" data-a="${a}"${o.i != null ? ` data-i="${o.i}"` : ''}${o.c ? ` data-c="${o.c}"` : ''}${o.b ? ` data-b="${o.b}"` : ''} class="${o.pri ? 'pri' : ''}" ${o.dis ? 'disabled' : ''}>${label}${sub ? `<small>${sub}</small>` : ''}</button>`; }
function open(mode = 'farm') { if (!panel) return; pMode = mode; pMsg.textContent = ''; plantFor = null; render(); panel.classList.add('show'); try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ } emit('open', { mode }); }
function close() { panel?.classList.remove('show'); }
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
        const sub = b.pays === 'cash' ? `${o.mult >= 1.15 ? 'Good price today.' : o.mult <= 0.85 ? 'Low today.' : 'Fair today.'} You have ${have}.` : q?.ok ? (q.item ? `For ${F.ITEMS.find(i => i.id === q.item).name}.` : `For ${F.FAVORS[q.favor].name}.`) : (q?.why || `You have ${have}.`);
        h += btn('sell', label, sub, { b: b.id, c: o.crop, dis: !here || !!bl || !q?.ok }); }
    }
    if (S.favors.length) { h += `<p><b>Your favors</b></p>`; for (const f of [...new Set(S.favors)]) { const n = S.favors.filter(x => x === f).length; h += btn('favor', `${F.FAVORS[f].icon} ${F.FAVORS[f].name}${n > 1 ? ' ×' + n : ''}`, F.FAVORS[f].blurb, { c: f, dis: f !== 'cool' }); } }
  } else {
    h = `<h2>🌱 ${F.SITES.farm.name}</h2><p class="sub">💰 ${cr} cr · Mars ${fmtH(hourNow())} · day ${F.day(S) + 1}${raid ? ' · 🚨 raid!' : ''}</p>`;
    if (!here || bl) h += `<p>${esc(bl && onMars() && !inPit() && !floating() ? directions('farm') : bl || directions('farm'))}</p>`;
    const dis = !here || !!bl;
    if (!S.owned) h += btn('buy', `🏡 Buy the homestead · ${F.PRICES.plot} cr`, 'A walled lot in open desert. Room for one greenhouse dome.', { pri: true, dis: dis || cr < F.PRICES.plot });
    else if (!S.dome) h += btn('dome', `🫧 Build the greenhouse dome · ${F.PRICES.dome} cr`, 'Keeps dust off the racks. Storms do half the damage while it is sound.', { pri: true, dis: dis || cr < F.PRICES.dome });
    else {
      h += `<p>💧 Water ${Math.round(S.water)}/${F.LIMITS.water} · 🔋 Power ${Math.round(S.power)}/${F.LIMITS.power} · 🫧 Dome ${Math.round(S.domeHp)}%</p>`;
      if (plantFor != null) {
        h += `<p><b>Plant rack ${plantFor + 1}:</b></p>`; for (const c of Object.values(F.CROPS)) h += btn('plantc', `${c.icon} ${c.name} · ${c.seed} cr`, `${c.hours} h to ripen · ${c.yield} per rack${c.contraband ? ' · dries into Glow-dust for your stash' : ''}`, { i: plantFor, c: c.id, dis: dis || cr < c.seed });
        h += btn('back', '← Back', '');
      } else {
        S.racks.forEach((r, k) => { const c = F.CROPS[r.crop];
          if (!c) h += btn('plant', `🪴 Rack ${k + 1}: empty`, 'Tap to plant.', { i: k, dis });
          else if (r.health <= 0) h += btn('harvest', `🥀 Rack ${k + 1}: ${c.name} died`, 'Clear it out.', { i: k, dis: true });
          else h += btn('harvest', `${c.icon} Rack ${k + 1}: ${c.name} · ${r.growth >= 1 ? 'ripe' : Math.floor(r.growth * 100) + '%'}`, `Health ${Math.round(r.health)}%${r.growth >= 1 ? ` · harvest ${F.yieldOf(r)}` : ''}`, { i: k, pri: r.growth >= 1, dis: dis || r.growth < 1 }); });
        if (S.racks.some(r => r.crop && r.growth >= 1)) h += btn('harvestAll', '🧺 Harvest everything ripe', '', { pri: true, dis });
        if (S.racks.length < F.LIMITS.racks) h += btn('rack', `➕ Add a hydroponic rack · ${F.PRICES.rack} cr`, `${S.racks.length}/${F.LIMITS.racks} racks`, { dis: dis || cr < F.PRICES.rack });
        const w = F.refillCost(S, 'water'), p = F.refillCost(S, 'power');
        h += `<div class="row">${btn('water', `💧 Fill · ${w.cost} cr`, '', { dis: dis || !w.units || cr < w.cost })}${btn('power', `🔋 Charge · ${p.cost} cr`, '', { dis: dis || !p.units || cr < p.cost })}</div>`;
        if (S.domeHp < 100) h += btn('patch', `🩹 Patch the dome · ${F.PRICES.patch} cr`, 'Storm damage. Under 60% it stops shielding the crops.', { dis: dis || cr < F.PRICES.patch });
      }
    }
    const silo = Object.entries(S.silo).map(([k, v]) => `${F.CROPS[k].icon} ${v}`).join(' · ');
    if (S.owned) h += `<p>🏚️ Silo: ${silo || 'empty'} <span class="sub">(${F.siloCount(S)}/${F.LIMITS.silo}). Sell at ${F.SITES.post.name}, ${(() => { const a = W(F.SITES.farm.at), b = W(F.SITES.post.at); return a && b ? Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 10) * 10 + ' m ' + F.dirWord(b.x - a.x, b.z - a.z) + ' of the farm' : 'south-east of the farm'; })()}.</span></p>`;
    h += btn('postInfo', `👽 ${F.SITES.post.name} prices`, 'See today\u2019s alien buyers.');
  }
  h += btn('close', 'Close', '');
  pBody.innerHTML = h;
  pBody.querySelectorAll('button[data-a]').forEach(b => tap(b, () => { if (!b.disabled) act(b.dataset); }));
}
const fmtH = h => { const m = Math.round(((h % 24) + 24) % 24 * 60) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
function act(d) {
  const a = d.a; let r = null;
  if (a === 'close') return close(); if (a === 'back') { plantFor = null; return render(); } if (a === 'postInfo') { pMode = 'post'; return render(); }
  if (a === 'plant') { plantFor = +d.i; return render(); }
  if (a === 'buy') r = buy(); else if (a === 'dome') r = buildDome(); else if (a === 'rack') r = addRack(); else if (a === 'plantc') { r = plant(+d.i, d.c); plantFor = null; }
  else if (a === 'harvest') r = harvest(+d.i); else if (a === 'harvestAll') r = harvest('all'); else if (a === 'water' || a === 'power') r = refill(a); else if (a === 'patch') r = patch();
  else if (a === 'sell') { const have = S.silo[d.c] | 0; r = sell(d.b, d.c, have); } else if (a === 'favor') r = useFavor(d.c);
  if (panel.classList.contains('show')) { render(); pMsg.textContent = r?.msg || ''; }
}
function refresh(force) {
  if (!actBtn) return; let mode = '', label = '';
  if (onMars() && !inPit() && !floating()) { if (at('farm')) { mode = 'farm'; label = raid ? '🚨 Farm' : '🌱 Farm'; } else if (at('post')) { mode = 'post'; label = '👽 Trade'; } }
  const k = mode + label; if (force || k !== actKey) { actKey = k; actBtn.textContent = label; actBtn.dataset.mode = mode; actBtn.setAttribute('aria-label', mode === 'post' ? 'Trade at the Xen-7 Trading Post' : 'Open the farm'); actBtn.classList.toggle('on', !!mode); }
  if (force && panel?.classList.contains('show')) { const m = pMsg.textContent; render(); pMsg.textContent = m; }
}

// ---------- tick + boot ----------
let uiT = 0;
function tick(dt, tc) {
  lastTc = tc; if (!fin(dt)) return;
  hookStorm();
  const dh = clockTick(dt);
  if (dh > 0) advance(dh);
  if (!onMars()) { if (G) teardown(); refresh(); return; }
  if (!G || G.parent !== tc.scene) build(tc.scene); else if (dirty) { dirty = false; rebuildFarm(); }
  raidTick(dt, dh);
  if ((uiT -= dt) <= 0) { uiT = 0.25; refresh(); }
}
function status() {
  return { owned: S.owned, dome: S.dome, domeHp: Math.round(S.domeHp), racks: S.racks.map(r => ({ crop: r.crop, growth: Math.round(r.growth * 1000) / 1000, health: Math.round(r.health * 10) / 10, ripe: !!r.crop && r.growth >= 1 })),
    water: S.water, power: S.power, silo: { ...S.silo }, siloCount: F.siloCount(S), favors: [...S.favors], hours: Math.round(S.hours * 100) / 100, day: F.day(S), clock: src,
    raid: raid ? { id: raid.id, via: raid.via } : null, at: onMars() ? (at('farm') ? 'farm' : at('post') ? 'post' : null) : null, storm: stormI(), stats: { ...S.stats } };
}
const API = {
  status, buy, buildDome, addRack, plant, harvest, refill, patch, sell, useFavor, raid: raid_, skip,
  buyers: () => F.buyersToday(F.day(S)), clock: () => ({ hour: hourNow(), hours: S.hours, day: F.day(S), source: src }),
  places: () => Object.values(F.SITES).map(p => { const w = W(p.at); return { id: p.id, name: p.name, x: w?.x, z: w?.z, r: p.r }; }),
  open, close, on, CROPS: F.CROPS, PRICES: F.PRICES,
  debug: {
    goto(id) { const s = surf(), p = W(F.SITES[id === 'post' ? 'post' : 'farm'].at); if (!s || !p) return false; s.debugMove(p.x + (id === 'post' ? 0 : 0), p.z + (id === 'post' ? 4 : 6), 0); return { x: p.x, z: p.z }; },
    storm(i = 1) { dbgStorm = F.clamp(+i || 0, 0, 1); return dbgStorm; }, raidEnd: (r = 'win') => endRaid(r), noRaids: v => { noRaids = v !== false; return noRaids; },
    state: () => JSON.parse(JSON.stringify(S)), reset() { S = F.fresh(); save(); raid = null; dbgStorm = 0; rebuildFarm(true); refresh(true); return true; },
    reload() { try { S = F.migrate(JSON.parse(localStorage.getItem(F.SAVE_KEY))); } catch (e) { S = F.fresh(); } rebuildFarm(true); emit('load', {}); return status(); },
    inPit, floating, scene: () => G ? { farm: !!G.userData.fg, dome: !!G.getObjectByName('farm-dome'), crops: (() => { let n = 0; G.traverse(o => { if (o.name === 'farm-crop') n++; }); return n; })() } : null
  }
};
(function boot() {
  if (!window.SSX?.registerSurfaceTick || !window.__app || !window.SSX.registerMenuItem) { setTimeout(boot, 200); return; }
  if (window.SSX.farm) return; window.SSX.farm = API; ui();
  try { window.SSX.registerSurfaceTick(tick); } catch (e) { console.warn('farm tick', e); }
})();
