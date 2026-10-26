// Red Tape Flats street life, part 3: HOOK & CROOK TOWING (Snuffles). A tow yard and fence on the east edge of the Flats,
// separate from Wrench's chop shop (the contraband barter 'chop' offer at WRENCH'S, which scraps a ride and clears heat).
// Lou buys a stolen ride whole (more cash, no heat cleared) or strips it for parts (less cash, a part for your current ride
// through SSX.garage, else salvage through SSX.contraband), sells hot rides with no plates into your SSX.garage lock-up,
// and his tow truck hooks your rover if you leave it parked in the Flats. Everything cross-module is guarded.
import * as THREE from 'three';
import { VEHICLES } from '../world.js';
import { buildHuman } from '../interiors.js';
import { rust, sign, concrete } from './street-tex.js';

export const YARD = { at: [46, 24], w: 12, d: 9, office: [42.2, 21.6], counter: [42.2, 23.5], slot: [45.6, 25.6], truck: [50.4, 25.4], drop: [46.5, 25.5], dropR: 6 };
const VAL = { buggy: 260, hoverbike: 300, hauler: 340, shuttle: 420 }, VAL0 = 220;
const HOT = [{ kind: 'buggy', price: 900 }, { kind: 'hoverbike', price: 1250 }, { kind: 'hauler', price: 700 }];
const PART_SLOTS = ['engine', 'handling', 'brakes', 'boost'];

function chainTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.strokeStyle = 'rgba(170,170,160,0.95)'; x.lineWidth = 2.2;
  for (let i = -64; i < 128; i += 12) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 64, 64); x.stroke(); x.beginPath(); x.moveTo(i + 64, 0); x.lineTo(i, 64); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; }
let chain = null;

export function createTow(K) {
  let root = null, lou = null, light = null, parkT = 0, rollT = 0, offerDone = false, dbg = { built: 0 };
  const garage = () => { const G = K.X().garage; return G && typeof G.grantVehicle === 'function' ? G : null; };
  const contra = () => { const c = K.X().contraband; return c && typeof c.add === 'function' ? c : null; };
  const hasItem = id => { try { return !!contra()?.items?.().some(i => i.id === id); } catch (e) { return false; } };
  function build(g) {
    const m = { corr: K.mat('st_corr2', { map: rust(14, [130, 120, 104]), roughness: 0.7, metalness: 0.5 }), dark: K.mat('st_dark', { color: 0x1a1816, roughness: 0.7 }), conc: K.mat('st_conc2', { map: concrete(8) }),
      yel: K.mat('st_yel', { color: 0xc89a1a, roughness: 0.55, metalness: 0.3 }), hulk: K.mat('st_hulk', { map: rust(27, [88, 52, 36]), roughness: 0.9, metalness: 0.3 }), glass: K.mat('st_glass', { color: 0x0a0c0e, roughness: 0.15, metalness: 0.6 }),
      amber: K.mat('st_amber', { color: 0x3a2200, emissive: 0xffa020, emissiveIntensity: 0.3 }), tyre: K.mat('st_tyre', { color: 0x121212, roughness: 0.95 }) };
    chain ||= chainTex();
    const mesh = K.mat('st_chain', { map: chain, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.5 });
    const [cx, cz] = YARD.at, x0 = cx - YARD.w / 2, x1 = cx + YARD.w / 2, z0 = cz - YARD.d / 2 - 0.1, z1 = cz + YARD.d / 2;
    const fence = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2, ry = Math.atan2(bz - az, bx - ax), p = K.L(mx, mz);
      const pg = new THREE.PlaneGeometry(L, 2.5), uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * L / 0.7, uv.getY(i) * 2.5 / 0.7); const pl = new THREE.Mesh(pg, mesh); pl.position.set(p.x, p.y + 1.25, p.z); pl.rotation.y = -ry; g.add(pl);
      K.box(g, m.dark, p.x, p.y + 2.5, p.z, L, 0.06, 0.06, -ry); for (let k = 0; k <= Math.ceil(L / 3); k++) { const t = k / Math.ceil(L / 3), q = K.L(ax + (bx - ax) * t, az + (bz - az) * t); K.box(g, m.dark, q.x, q.y + 1.3, q.z, 0.08, 2.6, 0.08); } };
    fence(x0, z0, x0, z1); fence(x1, z0, x1, z1); fence(x0, z1, cx - 2.5, z1); fence(cx + 3.5, z1, x1, z1);
    // gate sign over the opening
    const gs = K.L(cx + 0.5, z1); for (const k of [-3, 3]) K.box(g, m.dark, gs.x + k, gs.y + 1.9, gs.z, 0.16, 3.8, 0.16);
    const sg = new THREE.Mesh(K.geo().plane, K.mat('st_hcsign', { map: sign('HOOK & CROOK TOWING', '#f2e8d0', '#121110'), emissive: 0xffffff, emissiveMap: sign('HOOK & CROOK TOWING', '#f2e8d0', '#121110'), emissiveIntensity: 0.35 }));
    sg.position.set(gs.x, gs.y + 3.4, gs.z + 0.06); sg.scale.set(6, 1.1, 1); g.add(sg); const sb = sg.clone(); sb.rotation.y = Math.PI; sb.position.z -= 0.12; g.add(sb);
    const sub = new THREE.Mesh(K.geo().plane, K.mat('st_hcsub', { map: sign('WE TOW IT \u00b7 YOU OWE IT \u00b7 CASH ONLY', '#d8d0b8', '#2a1a10', 512, 96) })); sub.position.set(gs.x, gs.y + 2.6, gs.z + 0.06); sub.scale.set(4.4, 0.6, 1); g.add(sub);
    // office portacabin with a caged counter window (faces south, into the yard)
    const o = K.L(YARD.office[0], YARD.office[1]); K.box(g, m.corr, o.x, o.y + 1.35, o.z, 3.6, 2.7, 2.6); K.box(g, m.dark, o.x, o.y + 2.75, o.z, 3.8, 0.12, 2.8);
    K.box(g, m.glass, o.x, o.y + 1.55, o.z + 1.31, 1.6, 0.9, 0.04); for (let k = -3; k <= 3; k++) K.box(g, m.dark, o.x + k * 0.25, o.y + 1.55, o.z + 1.35, 0.03, 0.95, 0.03);
    K.box(g, m.dark, o.x, o.y + 1.05, o.z + 1.5, 1.8, 0.08, 0.4); K.box(g, m.conc, o.x - 1.4, o.y + 0.1, o.z + 1.6, 0.7, 0.2, 0.5);
    const os = new THREE.Mesh(K.geo().plane, K.mat('st_office', { map: sign('OFFICE \u00b7 IMPOUND \u00b7 PARTS', '#f0f0f0', '#101010', 512, 96) })); os.position.set(o.x, o.y + 2.35, o.z + 1.32); os.scale.set(2.6, 0.45, 1); g.add(os);
    // Lou behind the counter (one static person; counted in the street NPC budget)
    lou = buildHuman({ top: 0x2a3a4a, bottom: 0x2a3a4a, skin: 0xc8946a, hair: 0x5a5a54, hairStyle: 'bald', bulk: 1.35, accent: 0xc89a1a }); lou.group.position.set(o.x, o.y, o.z + 0.75); g.add(lou.group);
    // tow truck (made-up model), parked nose to the gate
    const tr = K.L(YARD.truck[0], YARD.truck[1]), T = new THREE.Group(); T.position.set(tr.x, tr.y, tr.z); g.add(T);
    K.box(T, m.yel, 0, 1.3, 1.6, 2.2, 1.7, 1.8); K.box(T, m.glass, 0, 1.75, 2.52, 1.9, 0.6, 0.04); K.box(T, m.dark, 0, 0.7, -0.6, 2.1, 0.5, 4.6); K.box(T, m.yel, 0, 1.05, -1.4, 2.2, 0.2, 3.0);
    const boom = K.box(T, m.dark, 0, 2.0, -2.2, 0.25, 0.25, 2.6); boom.rotation.x = 0.45; boom.updateMatrix(); K.box(T, m.dark, 0, 1.3, -3.4, 0.08, 1.2, 0.08);
    for (const [wx, wz] of [[-1, 1.6], [1, 1.6], [-1, -1.6], [1, -1.6], [-1, -2.6], [1, -2.6]]) { const w = K.box(T, m.tyre, wx * 1.05, 0.45, wz, 0.9, 0.36, 0.9, 0, K.geo().cyl); w.rotation.z = Math.PI / 2; w.updateMatrix(); }
    light = K.box(T, m.amber, 0, 2.25, 1.4, 1.6, 0.14, 0.3);
    const tl = new THREE.Mesh(K.geo().plane, K.mat('st_hcdoor', { map: sign('HOOK & CROOK', '#121110', '#c89a1a', 256, 64) })); tl.position.set(1.11, 1.3, 1.6); tl.rotation.y = Math.PI / 2; tl.scale.set(1.4, 0.36, 1); T.add(tl);
    T.rotation.y = 0;
    // stripped hulks on blocks, tyre stack, oil stains
    for (const [hx, hz, ry] of [[46.4, 21.4, 0.25], [50.4, 21.2, -0.15]]) { const h = K.L(hx, hz); K.box(g, m.hulk, h.x, h.y + 0.75, h.z, 3.6, 0.8, 1.8, ry); K.box(g, m.hulk, h.x - 0.2, h.y + 1.35, h.z, 1.8, 0.5, 1.6, ry); for (const k of [-1.2, 1.2]) K.box(g, m.conc, h.x + k * Math.cos(ry), h.y + 0.17, h.z - k * Math.sin(ry), 0.4, 0.34, 1.6, ry); }
    const ts = K.L(41.2, 27.4); for (let i = 0; i < 4; i++) { K.box(g, m.tyre, ts.x + (i % 2) * 0.1, ts.y + 0.15 + i * 0.3, ts.z, 0.9, 0.28, 0.9, i * 0.4, K.geo().cyl); }
    const oil = K.mat('st_oil', { color: 0x050505, transparent: true, opacity: 0.6, roughness: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const [ox, oz, s] of [[45.6, 25.6, 2.4], [48.5, 23.4, 1.4], [43.6, 26.8, 1.0]]) { const p = K.L(ox, oz); const d = new THREE.Mesh(K.geo().plane, oil); d.rotation.x = -Math.PI / 2; d.position.set(p.x, p.y + 0.03, p.z); d.scale.set(s, s * 0.7, 1); g.add(d); }
  }
  const quoteFor = (kind, strip) => { const base = VAL[kind] ?? VAL0, heat = Math.max(0.5, 1 - 0.12 * K.wanted()); return Math.round(base * heat * (strip ? 0.45 : 1) / 5) * 5; };
  function despawn() { try { const s = K.X().despawnVehicle; if (typeof s === 'function') return !!s(); return !!K.surf()?.chopVehicle?.(); } catch (e) { console.warn('street despawn', e); return false; } }
  function sell(strip) {
    const P = K.player; if (!P?.stolen) return { ok: false, msg: 'Lou: That\u2019s not a stolen ride. Or it\u2019s yours. Either way, no.' };
    const kind = P.kind, cash = quoteFor(kind, strip); if (!despawn()) return { ok: false, msg: 'Lou: Can\u2019t get a hook on it. Pull in closer.' };
    K.pay(cash, strip ? 8 : 12); let extra = '';
    if (strip) {
      K.ST.stats.stripped++; const G = garage();
      let r = null; if (G?.grantUpgrade) { const order = PART_SLOTS.slice().sort(() => Math.random() - 0.5); for (const sl of order) { try { r = G.grantUpgrade('current', sl, 1); } catch (e) { r = null; } if (r?.ok) break; } }
      if (r?.ok) extra = ` ${r.msg}`; else if (hasItem('salvage')) { contra().add('salvage', 2); extra = ' +2 salvage.'; } else { const b = Math.round(cash * 0.3); K.pay(b); extra = ` +${b} cr in loose parts.`; }
      if (hasItem('hot_plates') && Math.random() < 0.5) { contra().add('hot_plates', 1); extra += ' +1 hot plates.'; }
    } else K.ST.stats.fenced++;
    K.save(); K.say(lou ? louPos() : P, 'Lou', strip ? 'louStrip' : 'louBuy');
    const msg = `\ud83d\udd27 Hook & Crook: ${strip ? 'stripped' : 'bought'} the ${VEHICLES[kind]?.name || kind} for ${cash} cr.${extra}${K.wanted() ? ' Your stars stay. Lou doesn\u2019t do miracles; Wrench does.' : ''}`;
    K.toast(msg, 4200); K.emit(strip ? 'strip' : 'fence', { kind, cash }); return { ok: true, cash, msg };
  }
  const louPos = () => { const o = K.L(YARD.office[0], YARD.office[1]); return { x: o.x, z: o.z + 0.75 }; };
  function stock() { const day = Math.floor(Date.now() / (24 * 120000)); return HOT.filter((h, i) => VEHICLES[h.kind] && ((day + i) % 3 !== 2)).map(h => ({ ...h, name: VEHICLES[h.kind].name })); }
  function buyHot(kind) {
    const G = garage(), h = stock().find(x => x.kind === kind); if (!h) return { ok: false, msg: 'Lou: Not on the lot today.' };
    if (!G) return { ok: false, msg: 'Lou: Where you gonna keep it? Get a lock-up first. (Garage module not loaded.)' };
    if (!K.take(h.price)) return { ok: false, msg: `Lou: ${h.price} cr. Cash. You\u2019re short.` };
    let r = null; try { r = G.grantVehicle(kind, { noPlates: true }); } catch (e) { r = { ok: false, msg: String(e?.message || e) }; }
    if (!r?.ok) { K.pay(h.price); return { ok: false, msg: `Lou: ${r?.msg || 'Paperwork problem.'} Money back.` }; }
    K.ST.stats.hot++; K.save(); K.emit('hot', { kind, price: h.price, ride: r.ride }); return { ok: true, msg: `\ud83d\udd11 ${r.msg || h.name + ' in your lock-up.'} No plates. Don\u2019t get pulled over.` };
  }
  function moveRover(rv, lx, lz) {
    const p = K.L(lx, lz); rv.x = p.x; rv.z = p.z; rv.y = p.y; rv.yaw = Math.PI * 0.5; rv.vy = 0; rv.speed = 0; rv.steer = 0; rv.prevG = null; rv.air = false; rv.pitch = 0; rv.roll = 0;
    rv.group?.position.set(rv.x, rv.y, rv.z); rv.group?.rotation.set(0, rv.yaw, 0);
  }
  function hook(force) {
    const rv = K.player?.rover || K.surf()?.__lastRover; if (!rv) return { ok: false, msg: 'No rover.' };
    if (K.player?.car === rv) return { ok: false, msg: 'You\u2019re driving it.' };
    moveRover(rv, YARD.slot[0], YARD.slot[1]); const fee = 60 + 25 * K.wanted(); const s = K.L(YARD.slot[0], YARD.slot[1]);
    K.ST.impound = { fee, t: Date.now(), x: s.x, z: s.z }; K.ST.stats.towed++; K.save(); parkT = 0;
    K.toast(`\ud83d\udea8 Your rover got hooked. HOOK & CROOK TOWING, east Flats. Impound: ${fee} cr.`, 4200); K.emit('towed', { fee, forced: !!force });
    return { ok: true, fee };
  }
  function payImpound() {
    const I = K.ST.impound; if (!I) return { ok: false, msg: 'Nothing impounded.' };
    if (!K.take(I.fee)) return { ok: false, msg: `Lou: ${I.fee} cr. I take cash, not stories.` };
    K.ST.impound = null; K.save(); K.emit('impoundPaid', { fee: I.fee }); return { ok: true, msg: `\ud83d\udd27 Paid ${I.fee} cr. Your rover\u2019s by the truck. Keys are in it. Of course they are.` };
  }
  function office() {
    const I = K.ST.impound, G = garage(), btns = [];
    const done = r => { K.toast(r.msg, 3400); return true; };
    if (I) btns.push({ label: `Pay the impound \u2014 ${I.fee} cr`, sub: 'Drive it out without paying and Lou calls it in.', disabled: K.credits() < I.fee, fn: () => done(payImpound()) });
    btns.push({ label: 'Spray cans \u00d73 \u2014 25 cr', sub: `You have ${K.ST.cans}.`, disabled: K.credits() < 25, fn: () => { if (!K.take(25)) return true; K.ST.cans = Math.min(20, K.ST.cans + 3); K.save(); K.emit('cans', { cans: K.ST.cans }); K.toast(`\ud83c\udfa8 Three cans. You have ${K.ST.cans}.`, 2000); return true; } });
    for (const h of stock()) btns.push({ label: `\ud83d\udd11 ${h.name}, no plates \u2014 ${h.price} cr`, sub: G ? 'Goes straight into your lock-up. Lou never saw you.' : 'Needs a lock-up (the garage module isn\u2019t loaded).', disabled: !G || K.credits() < h.price, fn: () => done(buyHot(h.kind)) });
    btns.push({ label: 'How does this work?', fn: () => { K.toast('Lou: Pull a stolen ride into the yard and I\u2019ll buy it whole or strip it. Park your own heap in the Flats and my truck takes it. Cans, plates, rides. No receipts.', 6000); return true; } });
    K.openPanel('HOOK & CROOK TOWING \u00b7 Lou', `${K.credits()} cr on you.${I ? ' Your rover is in the impound.' : ''}`, btns, K.pick(K.LINES.lou), office);
  }
  function dropPanel() {
    const P = K.player, kind = P.kind, n = VEHICLES[kind]?.name || kind;
    K.openPanel('HOOK & CROOK \u00b7 drop-off', `Lou looks over the ${n}. Stars on you: ${K.wanted()}. Lou pays less when it\u2019s hot.`, [
      { label: `Sell it whole \u2014 ${quoteFor(kind, false)} cr`, sub: 'Cash. Your heat stays (Wrench\u2019s chop clears heat; Lou doesn\u2019t).', fn: () => { const r = sell(false); if (!r.ok) K.toast(r.msg, 2600); } },
      { label: `Strip it for parts \u2014 ${quoteFor(kind, true)} cr + a part`, sub: garage() ? 'A free upgrade on your current ride (garage).' : 'Salvage or loose parts (no garage loaded).', fn: () => { const r = sell(true); if (!r.ok) K.toast(r.msg, 2600); } }
    ], K.pick(K.LINES.lou));
  }
  function regOffer() {
    if (offerDone) return; const c = K.X().contraband; if (!c?.registerOffer || !hasItem('hot_plates')) return; offerDone = true;
    try { c.registerOffer({ id: 'hookcrook-plates', npc: 'lou-hook', district: K.CDIST, wants: { item: 'hot_plates', qty: 1 }, gives: { type: 'cash', credits: 90 }, label: 'Lou buys hot plates: 90 cr', cooldownSec: 60, repeatable: true,
      npcDef: { name: 'Lou Hook', role: 'tow yard fence', district: K.CDIST, at: K.AJ(44, 31), line: 'Plates? I collect \u2019em.' } }); } catch (e) { console.warn('street registerOffer', e); }
  }
  function colliders() { // fence runs (gate gap left open), office, truck, hulks, tyre stack; same numbers build() uses
    const [cx, cz] = YARD.at, x0 = cx - YARD.w / 2, x1 = cx + YARD.w / 2, z0 = cz - YARD.d / 2 - 0.1, z1 = cz + YARD.d / 2, out = [], T = 0.2;
    const seg = (ax, az, bx, bz, tag) => { const a = K.L(Math.min(ax, bx), Math.min(az, bz)), b = K.L(Math.max(ax, bx), Math.max(az, bz)); out.push({ type: 'box', x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, hx: Math.max(T, (b.x - a.x) / 2), hz: Math.max(T, (b.z - a.z) / 2), tag }); };
    seg(x0, z0, x0, z1, 'fence:w'); seg(x1, z0, x1, z1, 'fence:e'); seg(x0, z1, cx - 2.5, z1, 'fence:sw'); seg(cx + 3.5, z1, x1, z1, 'fence:se');
    const o = K.L(YARD.office[0], YARD.office[1]); out.push({ type: 'box', x: o.x, z: o.z, hx: 1.8, hz: 1.3, tag: 'office' });
    const tr = K.L(YARD.truck[0], YARD.truck[1]); out.push({ type: 'box', x: tr.x, z: tr.z - 0.45, hx: 1.1, hz: 2.95, tag: 'truck' });
    for (const [hx, hz, ry] of [[46.4, 21.4, 0.25], [50.4, 21.2, -0.15]]) { const h = K.L(hx, hz); out.push({ type: 'box', x: h.x, z: h.z, hx: 1.8, hz: 0.9, yaw: ry, tag: 'hulk' }); }
    const ts = K.L(41.2, 27.4); out.push({ type: 'cyl', x: ts.x + 0.05, z: ts.z, r: 0.5, tag: 'tyres' }); return out;
  }
  return {
    colliders,
    build(g) { root = g; build(g); K.extra = 1; dbg.built++; },
    dispose() { lou?.group.parent?.remove(lou.group); root = null; lou = null; light = null; K.extra = 0; },
    always(dt, c, loaded) {
      regOffer(); const rv = c.rover; if (!rv || !K.D) return; if (K.surf()) K.surf().__lastRover = rv;
      const I = K.ST.impound;
      if (I) { const away = Math.hypot(rv.x - I.x, rv.z - I.z); if (c.car === rv || away > 8) { K.ST.impound = null; K.save(); K.crime(1, 'skipped the Hook & Crook impound fee'); const p = louPos(); K.say(p, 'Lou', 'louJumped', { toastToo: true }); K.emit('impoundJumped', {}); } return; }
      const parkedHere = c.car !== rv && Math.hypot(rv.x - K.D.x, rv.z - K.D.z) < 72, pl = c.car || c.player, far = Math.hypot(pl.x - rv.x, pl.z - rv.z) > 30 || !!c.world?.inside;
      if (!parkedHere) { parkT = 0; return; } if (!far) { parkT = Math.max(0, parkT - dt * 2); return; }
      parkT += dt; if (parkT < 75) return; if ((rollT -= dt) > 0) return; rollT = 20;
      if (Math.random() < (K.night() ? 0.3 : 0.15)) hook(false);
    },
    tick(dt, t, P) { if (light) { const on = (t * 2.2 % 1) < 0.5; light.material.emissiveIntensity = on ? 1.6 : 0.25; }
      if (lou) { const h = lou; h.torso.rotation.z = Math.sin(t * 0.5) * 0.04; h.head.rotation.y = Math.sin(t * 0.3) * 0.5; h.arms[0].rotation.x = 0.6; h.arms[1].rotation.x = 0.6; } },
    acts(P) {
      const out = [], c = K.L(YARD.counter[0], YARD.counter[1]), dz = K.L(YARD.drop[0], YARD.drop[1]);
      if (P.driving && P.stolen) { const d = Math.hypot(P.x - dz.x, P.z - dz.z); if (d < YARD.dropR && P.speed < 3) out.push({ d, label: '\ud83d\udd27 Sell this ride to Lou', fn: dropPanel }); }
      if (!P.driving) { const d = Math.hypot(P.x - c.x, P.z - c.z); if (d < 2.6) out.push({ d, label: K.ST.impound ? '\ud83d\udd27 Impound counter' : '\ud83d\udd27 Hook & Crook counter', fn: office }); }
      return out;
    },
    marks() { const p = K.L(YARD.at[0], YARD.at[1]); return [{ x: p.x, z: p.z, r: K.ST.impound ? 3.6 : 2.8, color: K.ST.impound ? '#ff3030' : '#c89a1a', ring: true }]; },
    hook, payImpound, sell, buyHot, stock, quote: () => K.player?.stolen ? { kind: K.player.kind, whole: quoteFor(K.player.kind, false), strip: quoteFor(K.player.kind, true) } : null,
    yard: () => { const p = K.D ? K.L(YARD.at[0], YARD.at[1]) : null, c = K.D ? K.L(YARD.counter[0], YARD.counter[1]) : null, s = K.D ? K.L(YARD.slot[0], YARD.slot[1]) : null; return { name: 'HOOK & CROOK TOWING', local: [...YARD.at], x: p?.x, z: p?.z, counter: c, slot: s, drop: K.D ? K.L(YARD.drop[0], YARD.drop[1]) : null }; },
    debug: () => ({ ...dbg, parkT: +parkT.toFixed(1), offer: offerDone })
  };
}
