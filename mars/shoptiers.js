// v7.5.45 shop restock tiers (Collin: "After I buy out a store of stuff, weapons etc, I want it to be replaced with more items.
// Keeps expanding the weapons and shops."). Buy out a shop's one-time stock and it restocks with the next tier: Ozzie's Iron and
// the three district gun stores roll out 4 new tiers (11 new guns/blades from mars/arsenal.js + a gauss optic + new ammo), the
// clothing stores and Meridian Depot 2 tiers of new colours and wraps. Data + save in mars/shoptierscore.js.
// Wraps game.shopList / shopItem / buy (after marsshops.js) for 'st:<shop>:<item>' ids, appends the rolled-out tiers to the shop's
// full list, and puts a NEW STOCK shelf in each interior (window.SSX_SHOPTIER.rack, called by interiors.js + marsshops.js).
// Shelf slots are 'st:<shop>:#k' ids that always show the newest tier, so the shelf restocks in place while you stand there.
import * as THREE from 'three';
import { COSMETICS } from '../game.js';
import * as TC from './shoptierscore.js';

for (const k in TC.NEW_COS) for (const [id, [name, color]] of Object.entries(TC.NEW_COS[k])) if (COSMETICS[k] && !COSMETICS[k][id]) COSMETICS[k][id] = { name, color };

let S = TC.shared();
const app = () => window.__app || null;
const A = () => window.SSX?.arsenal || null;
const toast = (m, ms = 4200) => { try { app()?.toast?.(m, ms); } catch (e) { /* no toast */ } };
const tierOf = key => S.shops[key] || 1;
let G0 = null, orig = null, coreOf = null;
const cores = () => { if (!coreOf && A()) { coreOf = {}; for (const [id, d] of Object.entries(A().defs())) coreOf[id] = d.core; } return coreOf || {}; };

function owns(game, it) {
  const P = game.progress, a = A();
  if (it.kind === 'gun' || it.kind === 'melee') return !!a?.owned(it.a);
  if (it.kind === 'mod') return !!a?.hasMod(it.a, it.mod);
  if (it.kind === 'bandana' || it.kind === 'paint') return P.unlocks.includes(`${it.kind}:${it.c}`);
  return false;
}
function baseLeft(game, key) { // one-time base items still on the shelf
  const T = TC.TIER_SHOPS[key]; if (!T || !orig) return 99;
  const venue = key.startsWith('ms_') ? 'ms:' + key : key;
  let items = []; try { items = orig.shopList.call(game, venue).items || []; } catch (e) { return 99; }
  return items.filter(i => T.base.includes(i.kind) && !i.owned).length;
}
function state(game, key, it, slotId) {
  const P = game.progress, own = owns(game, it), a = A();
  let ok = true, why = '';
  if (!a && it.kind !== 'bandana' && it.kind !== 'paint') { ok = false; why = 'Back room\u2019s locked'; }
  else if (it.kind === 'mod' && !a.owned(it.a)) { ok = false; why = 'Needs the ' + (a.defs()[it.a]?.name || 'gun'); }
  const equipped = own && ((it.kind === 'gun' || it.kind === 'melee') ? P.equip.weapon === cores()[it.a] : (it.kind === 'bandana' || it.kind === 'paint') ? P.equip[it.kind] === it.c : false);
  return { id: slotId || `st:${key}:${it.id}`, name: it.name, desc: equipped ? 'Equipped' : it.desc || (own ? 'Owned. Tap to equip' : ''), price: it.price, owned: own && TC.ONE_TIME.has(it.kind), equipped, ok: ok && !(own && TC.ONE_TIME.has(it.kind)), why, afford: P.credits >= it.price,
    kind: it.kind === 'gun' ? 'weapon' : it.kind, tierItem: true, tier: it.tier, color: it.c ? COSMETICS[it.kind]?.[it.c]?.color : undefined, group: `🆕 Tier ${it.tier} \u00b7 ${TC.tierLabel(key, it.tier)}`, venues: [key] };
}
// 'st:<key>:<id>' or a shelf slot 'st:<key>:#k' -> { key, it } (it null = sealed crate)
function resolve(id) {
  const m = /^st:([a-z_]+):(.+)$/.exec(id || ''); if (!m || !TC.TIER_SHOPS[m[1]]) return null; const key = m[1];
  if (m[2][0] === '#') { const t = tierOf(key); return { key, it: t >= 2 ? TC.tierItems(key, t)[+m[2].slice(1)] || null : null, slot: true }; }
  return { key, it: TC.unlockedItems(key, tierOf(key)).find(x => x.id === m[2]) || null };
}
function sealed(game, key, id) {
  const n = baseLeft(game, key);
  return { id, name: 'Sealed crate', desc: '', price: 0, owned: false, equipped: false, ok: false, why: n ? `Buy out the shop (${n} left)` : 'Restocking', afford: false, kind: 'locked', venues: [key] };
}
function shopItem(game, id) { const r = resolve(id); if (!r) return null; return r.it ? state(game, r.key, r.it, r.slot ? id : null) : r.slot ? sealed(game, r.key, id) : null; }
// v7.5.77 street iron: si:<shop>:<id>, on the full list from day one. Not a restock tier.
function streetResolve(id) {
  const m = /^si:([a-z_]+):(.+)$/.exec(id || ''); if (!m) return null;
  const it = TC.streetFor(m[1]).find(x => x.id === m[2]); if (!it) return null;
  return { key: m[1], it };
}
function streetRow(game, key, it) {
  const P = game.progress, own = owns(game, it), a = A();
  const equipped = own && P.equip.weapon === cores()[it.a];
  return { id: `si:${key}:${it.id}`, name: it.name, desc: equipped ? 'Equipped' : (it.desc || ''), price: it.price, owned: own, equipped, ok: !!a && !own, why: a ? '' : 'Back room\u2019s locked', afford: P.credits >= it.price, kind: 'weapon', group: 'Weapons', venues: [key] };
}
function buyStreet(game, id) {
  const r = streetResolve(id); if (!r) return { ok: false, msg: 'Not for sale.' };
  const it = r.it, P = game.progress, a = A(), own = owns(game, it);
  if (!a) return { ok: false, msg: 'Back room\u2019s locked.' };
  if (own) { a.equip(it.a); return { ok: true, msg: `${it.name} in hand.`, equip: true }; }
  if (P.credits < it.price) return { ok: false, msg: `Short ${it.price - P.credits} credits.` };
  P.credits -= it.price;
  const got = a.give(it.a, it.ammo || 0);
  if (!got?.ok) { P.credits += it.price; return got || { ok: false, msg: 'Not for sale.' }; }
  a.equip(it.a); game.save();
  try { game.onEvent?.('bought', { id, name: it.name }); } catch (e) { /* */ }
  return { ok: true, msg: `${it.name}: yours, and it\u2019s in your hands.` };
}
function buy(game, id) {
  const r = resolve(id); if (!r) return { ok: false, msg: 'Not for sale.' };
  const T = TC.TIER_SHOPS[r.key];
  if (!r.it) { const n = baseLeft(game, r.key); return { ok: false, msg: n ? `🔒 Sealed crates. Buy out ${T.name} (${n} item${n > 1 ? 's' : ''} left) and new stock rolls in.` : 'Restocking. Check back.' }; }
  const it = r.it, P = game.progress, a = A(), own = owns(game, it);
  if (own && (it.kind === 'gun' || it.kind === 'melee')) { a.equip(it.a); return { ok: true, msg: `${it.name} in hand.`, equip: true }; }
  if (own && (it.kind === 'bandana' || it.kind === 'paint')) { game.equip(it.kind, it.c); return { ok: true, msg: `Wearing ${it.name}.` }; }
  if (own) return { ok: false, msg: 'Already fitted.' };
  const L = state(game, r.key, it); if (!L.ok) return { ok: false, msg: L.why || 'Not for sale.' };
  if (P.credits < it.price) return { ok: false, msg: `Short ${it.price - P.credits} credits.` };
  P.credits -= it.price; let msg = `${it.name}: yours.`;
  if (it.kind === 'gun' || it.kind === 'melee') { a.give(it.a, it.ammo || 0); a.equip(it.a); msg = `${it.name}: yours, and it\u2019s in your hands.`; }
  else if (it.kind === 'mod') { const m = a.addMod(it.a, it.mod); msg = m.msg; }
  else if (it.kind === 'ammo') { const m = a.give(`ammo:${it.cal}:${it.type}`, it.n); msg = m.ok ? `${it.name}: loaded up.` : m.msg; }
  else if (it.kind === 'bandana' || it.kind === 'paint') { P.unlocks.push(`${it.kind}:${it.c}`); game.save(); game.equip(it.kind, it.c); msg = `${it.name}: yours, and you\u2019re wearing it.`; }
  game.save(); try { game.onEvent?.('bought', { id, name: it.name }); } catch (e) { /* */ }
  check(game, true);
  return { ok: true, msg };
}
// roll every shop forward that's been bought out. loud: toast it (a purchase); quiet on boot (one summary toast)
function check(game = G0, loud = false) {
  if (!game?.progress) return [];
  const rolled = [];
  for (const key of Object.keys(TC.TIER_SHOPS)) {
    let t = tierOf(key);
    for (let guard = 0; guard < 8; guard++) { const n = TC.nextTier(key, t, baseLeft(game, key) === 0, it => owns(game, it)); if (n === t) break; t = n; }
    if (t !== tierOf(key)) { S.shops[key] = t; rolled.push({ key, tier: t }); }
  }
  if (rolled.length) {
    TC.save(S);
    const r = rolled[0], T = TC.TIER_SHOPS[r.key];
    if (loud || rolled.length) toast(`🆕 New stock in! ${T.name} \u00b7 Tier ${r.tier}: ${TC.tierLabel(r.key, r.tier).toLowerCase()}${rolled.length > 1 ? ` (+${rolled.length - 1} more shop${rolled.length > 2 ? 's' : ''})` : ''}`, 4800);
    try { app()?.surface?.world?.refreshWares?.(); } catch (e) { /* */ }
  }
  return rolled;
}
function patch(game) {
  if (!game || game.__shopTiers) return; game.__shopTiers = true; G0 = game;
  orig = { shopList: game.shopList, shopItem: game.shopItem, buy: game.buy };
  game.shopItem = id => {
    if (typeof id === 'string' && id.startsWith('si:')) { const s = streetResolve(id); return s ? streetRow(game, s.key, s.it) : null; }
    return (typeof id === 'string' && id.startsWith('st:')) ? shopItem(game, id) : orig.shopItem.call(game, id);
  };
  game.buy = id => {
    if (typeof id === 'string' && id.startsWith('si:')) return buyStreet(game, id);
    if (typeof id === 'string' && id.startsWith('st:')) return buy(game, id);
    const r = orig.buy.call(game, id); if (r?.ok) { try { check(game, true); } catch (e) { console.warn('shoptiers', e); } } return r;
  };
  game.shopList = (venue = null, all = false) => {
    const r = orig.shopList.call(game, venue, all), key = typeof venue === 'string' ? venue.replace(/^ms:/, '') : null;
    if (!key || !TC.TIER_SHOPS[key]) return r;
    const t = tierOf(key), extra = TC.unlockedItems(key, t).sort((a, b) => b.tier - a.tier).map(it => state(game, key, it)); // newest tier on top
    const street = TC.streetFor(key).map(it => streetRow(game, key, it));
    return { ...r, items: [...extra, ...street, ...(r.items || [])], tier: t, tierMax: TC.maxTier(key), tierLabel: TC.tierLabel(key, t), title: TC.TIER_SHOPS[key].name };
  };
  setTimeout(() => { try { check(game); } catch (e) { console.warn('shoptiers', e); } }, 4000);
}

// ---------- the NEW STOCK shelf (built into each interior) ----------
const FACE = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] };
function signTex(c2, key) {
  const c = c2.canvas, t = tierOf(key), max = TC.maxTier(key); c2.clearRect(0, 0, c.width, c.height);
  c2.fillStyle = '#000'; c2.fillRect(0, 0, c.width, c.height); c2.strokeStyle = t > 1 ? '#ffd400' : '#888'; c2.lineWidth = 6; c2.strokeRect(3, 3, c.width - 6, c.height - 6);
  c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillStyle = '#fff';
  const a = t > 1 ? `NEW STOCK \u00b7 TIER ${t}/${max}` : 'NEW STOCK: SEALED', b = t > 1 ? TC.tierLabel(key, t) + (t >= max ? ' \u00b7 TOP SHELF' : '') : 'BUY OUT THE SHOP TO OPEN';
  c2.font = 'bold 46px system-ui, sans-serif'; c2.fillText(a, c.width / 2, c.height * 0.34);
  c2.font = 'bold 30px system-ui, sans-serif'; c2.fillStyle = t > 1 ? '#ffd400' : '#bbb'; c2.fillText(b, c.width / 2, c.height * 0.74);
}
function model(api, it) {
  const { G, mk, mat } = api, g = new THREE.Group(), add = (geo, m, x, y, z, sx, sy, sz, rz = 0) => { const o = mk(geo, m, x, y, z, sx, sy, sz); o.rotation.z = rz; g.add(o); return o; };
  const dark = mat(0x1e2024, { metalness: 0.6, roughness: 0.4 }), steel = mat(0x8a9098, { metalness: 0.8, roughness: 0.3 }), rust = mat(0x7a3a1a, { roughness: 1 }), gold = mat(0xd4af37, { metalness: 0.9, roughness: 0.25 });
  const crate = mat(0x4a3a24, { roughness: 1 });
  if (!it) { add(G.box, crate, 0, -0.05, 0, 0.7, 0.45, 0.45); add(G.box, mat(0x2a2016), 0, -0.05, 0.23, 0.72, 0.06, 0.02); add(G.box, mat(0xffd400, { basic: true }), 0, 0.05, 0.231, 0.3, 0.08, 0.005); return g; }
  const k = it.kind, id = it.a;
  if (k === 'gun') {
    const L = { revolver: 0.45, kingpin: 0.45, riothog: 0.9, hellhound: 1.0, needler: 0.6, dustbiter: 1.25, thumper: 0.8, widowmaker: 1.4 }[id] || 0.8, body = id === 'kingpin' ? gold : dark;
    add(G.box, body, 0, 0, 0, L, 0.1, 0.08); add(G.box, id === 'kingpin' ? mat(0xf4f0e8) : id === 'riothog' || id === 'hellhound' ? mat(0x5a3a22) : dark, -L / 2 - 0.08, -0.07, 0, 0.2, 0.18, 0.07, id === 'revolver' || id === 'kingpin' ? -0.5 : 0);
    if (id === 'revolver' || id === 'kingpin') add(G.cyl, id === 'kingpin' ? gold : steel, -0.05, 0, 0, 0.07, 0.12, 0.07, Math.PI / 2);
    if (id === 'riothog' || id === 'thumper') add(G.cyl, steel, 0.0, -0.12, 0, 0.13, 0.12, 0.13); // drum
    if (id === 'dustbiter') { add(G.box, rust, 0.05, -0.14, 0, 0.18, 0.16, 0.14); add(G.cyl, steel, L / 2 + 0.15, 0, 0, 0.03, 0.4, 0.03, Math.PI / 2); add(G.box, dark, 0.35, -0.16, 0, 0.03, 0.2, 0.03); }
    if (id === 'needler') add(G.box, mat(0xa0ffd0, { basic: true }), 0.1, 0.06, 0, L * 0.5, 0.02, 0.085);
    if (id === 'widowmaker') { add(G.box, mat(0xff3040, { basic: true }), 0.15, 0.07, 0, L * 0.6, 0.03, 0.09); add(G.cyl, dark, -0.05, 0.13, 0, 0.045, 0.32, 0.045, Math.PI / 2); }
    if (id === 'thumper') add(G.cyl, steel, 0.25, 0, 0, 0.08, 0.5, 0.08, Math.PI / 2);
    if (id === 'hellhound') add(G.box, mat(0xff5020, { emissive: 0xff2000, emissiveIntensity: 0.6 }), L / 2 - 0.1, 0.0, 0, 0.2, 0.11, 0.09);
    if (id === 'riothog' || id === 'dustbiter') add(G.box, rust, -0.15, 0.0, 0, 0.1, 0.11, 0.09); // tape wrap
  } else if (k === 'melee') {
    add(G.box, mat(0x2a1a10), -0.32, 0, 0, 0.36, 0.05, 0.05);
    if (id === 'hatchet') add(G.box, rust, 0.0, 0.08, 0, 0.18, 0.22, 0.03);
    else if (id === 'gnasher') { add(G.box, steel, 0.2, 0, 0, 0.7, 0.12, 0.03); for (let i = 0; i < 6; i++) add(G.box, dark, -0.08 + i * 0.12, 0.07, 0, 0.04, 0.04, 0.035); add(G.box, mat(0xffa020), -0.12, 0, 0, 0.14, 0.14, 0.08); }
    else { add(G.box, mat(0x5a3a22), 0.05, 0, 0, 0.5, 0.05, 0.05); add(G.box, steel, 0.35, 0, 0, 0.2, 0.28, 0.16); add(G.box, steel, 0.47, 0.0, 0, 0.12, 0.05, 0.05); }
  } else if (k === 'ammo') {
    const c = { heavy: 0xffc040, frag: 0xff7a20, rail: 0xff3040 }[it.cal] || 0xffe066;
    add(G.box, mat(0x3d4a2a), 0, 0, 0, 0.36, 0.2, 0.22); add(G.box, mat(c, { basic: true }), 0, 0.02, 0.113, 0.36, 0.05, 0.005);
    if (it.cal === 'frag') for (const x of [-0.1, 0.1]) add(G.sph, mat(0x4a5a2a), x, 0.15, 0, 0.07);
  } else if (k === 'mod') { add(G.cyl, dark, 0, 0, 0, 0.06, 0.4, 0.06, Math.PI / 2); add(G.cyl, mat(0xff3040, { basic: true }), 0.2, 0, 0, 0.065, 0.01, 0.065, Math.PI / 2); }
  else if (k === 'bandana') { const t = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 3), mat(COSMETICS.bandana[it.c]?.color ?? 0xd23b3b, { roughness: 0.9 })); api.disposables.push(t.geometry); t.rotation.z = Math.PI; t.scale.z = 0.15; g.add(t); }
  else if (k === 'paint') { add(G.cyl, mat(COSMETICS.paint[it.c]?.color ?? 0x888888, { metalness: 0.5, roughness: 0.3 }), 0, 0, 0, 0.13, 0.3, 0.13); add(G.cyl, steel, 0, 0.16, 0, 0.13, 0.02, 0.13); }
  return g;
}
// opts: { x, z, face: 's'|'n'|'e'|'w' (direction the shelf faces), len, venue (counter-list spot, ms shops) }
function rack(api, o, key, opts = {}) {
  if (!TC.TIER_SHOPS[key]) return null;
  const { box, mat } = api, [fx, fz] = FACE[opts.face || 's'], along = fz !== 0 ? [1, 0] : [0, 1], yaw = Math.atan2(fx, fz), len = opts.len || 4.2, x0 = opts.x || 0, z0 = opts.z || 0;
  const n = Math.max(...TC.TIER_SHOPS[key].tiers.map(t => t.items.length)), y = 1.0;
  // the shelf: a long low crate table with a yellow hazard edge
  box(x0, 0.45, z0, along[0] ? len : 0.8, 0.9, along[1] ? len : 0.8, mat(0x2a2620, { roughness: 0.9 }));
  box(x0 + fx * 0.41, 0.86, z0 + fz * 0.41, along[0] ? len : 0.02, 0.06, along[1] ? len : 0.02, mat(0xffd400, { basic: true }));
  api.col(x0, z0, (along[0] ? len : 0.8) / 2 + 0.05, (along[1] ? len : 0.8) / 2 + 0.05);
  // tier sign on a post behind the shelf
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const c2 = cv.getContext('2d'); signTex(c2, key);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; api.disposables.push(tex);
  const sg = new THREE.Mesh(api.G.plane, new THREE.MeshBasicMaterial({ map: tex })); api.disposables.push(sg.material);
  sg.position.set(x0 - fx * 0.3, 2.05, z0 - fz * 0.3); sg.rotation.y = yaw; sg.scale.set(Math.min(len, 3.2), Math.min(len, 3.2) / 4, 1); api.g.add(sg);
  box(x0 - fx * 0.32, 1.25, z0 - fz * 0.32, 0.08, 0.7, 0.08, mat(0x50555c, { metalness: 0.7 }));
  const slots = [];
  for (let k = 0; k < n; k++) {
    const off = -len / 2 + len * (k + 0.5) / n, x = x0 + along[0] * off, z = z0 + along[1] * off, id = `st:${key}:#${k}`;
    const holder = new THREE.Group(); holder.position.set(x, y, z); holder.rotation.y = yaw; holder.scale.setScalar(1.3); api.g.add(holder);
    const tcv = document.createElement('canvas'); tcv.width = 256; tcv.height = 112; const tc2 = tcv.getContext('2d');
    const ttex = new THREE.CanvasTexture(tcv); ttex.colorSpace = THREE.SRGBColorSpace; api.disposables.push(ttex);
    const tag = new THREE.Mesh(api.G.plane, new THREE.MeshBasicMaterial({ map: ttex })); api.disposables.push(tag.material);
    tag.position.set(x + fx * 0.46, 0.62, z + fz * 0.46); tag.rotation.y = yaw; tag.scale.set(0.8, 0.35, 1); tag.userData.ware = id; api.g.add(tag);
    const spot = api.spot({ id: 'ware:' + id, x: x + fx * 1.0, z: z + fz * 1.0, r: Math.min(0.7, len / n / 2), label: '🛒 New stock', act: 'buy', ware: id });
    const w = { id, m: holder, tag, c2: tc2, tex: ttex, key: '', spot, x, y, z }; api.wares.push(w); slots.push(w);
  }
  if (opts.venue) api.spot({ id: 'tierlist:' + key, x: x0 + fx * 1.0 + along[0] * (len / 2 + 0.7), z: z0 + fz * 1.0 + along[1] * (len / 2 + 0.7), r: 0.6, label: '🧾 Full list + new stock', act: 'shop', venue: opts.venue, who: opts.who || TC.TIER_SHOPS[key].name });
  let shown = -1;
  const sync = () => {
    const t = tierOf(key); if (t === shown) return; shown = t; signTex(c2, key); tex.needsUpdate = true;
    const items = t >= 2 ? TC.tierItems(key, t) : [];
    slots.forEach((w, k) => {
      for (const c of [...w.m.children]) w.m.remove(c);
      const it = t >= 2 ? items[k] : null; if (t >= 2 && !it) { w.tag.visible = false; w.spot.r = 0; return; }
      const m = model(api, it); m.traverse(c => { c.userData.ware = w.id; }); w.m.add(m); w.tag.visible = true; w.spot.r = Math.min(0.7, len / n / 2);
      w.spot.label = it ? '🛒 ' + it.name : '🔒 Sealed crate'; w.key = '';
    });
  };
  sync(); api.ticks.push(() => sync());
  return { slots, sync };
}

window.SSX_SHOPTIER = { rack, check: () => check(G0, true), state: () => JSON.parse(JSON.stringify(S)), tierOf, reload: () => { S = TC.reloadShared(); return S; },
  set: (key, t) => { if (!TC.TIER_SHOPS[key]) return false; S.shops[key] = Math.max(1, Math.min(TC.maxTier(key), t | 0)); TC.save(S); return true; }, core: TC };
// boot after marsshops.js has wrapped the game (so 'ms:' venues come back through us), re-patch if the game is rebuilt
let waited = 0;
(function boot() {
  const g = app()?.surface?.game;
  if (g && !g.__shopTiers && (g.__marsShops || waited > 8000)) { try { patch(g); } catch (e) { console.warn('shoptiers', e); } }
  waited += 500; setTimeout(boot, g?.__shopTiers ? 2000 : 500);
})();
