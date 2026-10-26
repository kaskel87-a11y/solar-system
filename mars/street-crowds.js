// Red Tape Flats street life, part 2: burn barrels, the night crowds around them, street dealers and junkies (Snuffles).
// People are pooled per slot and only the nearest ones are shown, inside the shared NPC budget (phones: at most 5 of ours
// and never past 12 people on screen with colonists, security on foot and game humans). Product goes through
// SSX.contraband (buy / sell with risk / remove); with no contraband module the dealers have nothing and junkies only beg.
import * as THREE from 'three';
import { buildHuman } from '../interiors.js';
import { puff, flame, rust } from './street-tex.js';
import { pickRant, mangle, volume } from './street-rant.js';

export const BARRELS = [ // district-local; open ground clear of blocks, #10 shops, #21 shanties, #32 doors and vehicle slots
  { id: 'b-south', name: 'the south lot barrel', at: [-2, -36] },
  { id: 'b-west', name: 'the pad-fence barrel', at: [-53, -1] },
  { id: 'b-north', name: 'the north alley barrel', at: [2, 40] }
];
export const DEALERS = [{ id: 'needles', name: 'Needles', at: [-14, -31] }, { id: 'sugar', name: 'Sugar', at: [36, 31] }];
export const JUNKIES = [{ id: 'twitch', name: 'Twitch', at: [-8, -40] }, { id: 'lenny', name: 'Lenny', at: [30, 33] }, { id: 'moth', name: 'Moth', at: [-47, 4] }, { id: 'dez', name: 'Dez', at: [6, 45] }];
const CORE = ['glowdust', 'lowg', 'redstatic', 'voidhoney'], MARKUP = 1.35;
const CROWD_LOOK = [
  { top: 0x4a4034, bottom: 0x2a2620, skin: 0xb07a58, hair: 0x2a2018, hairStyle: 'cap', bulk: 1.15 }, { top: 0x5a3a2a, bottom: 0x22201c, skin: 0x6a4630, hair: 0x101010, hairStyle: 'short' },
  { top: 0x3a4248, bottom: 0x302a22, skin: 0xd0a080, hair: 0x7a6a50, hairStyle: 'long' }, { top: 0x5a5444, bottom: 0x1e1e20, skin: 0x8a5a3a, hair: 0x111111, hairStyle: 'bald', bulk: 1.2 },
  { top: 0x6a2a22, bottom: 0x2a2a2e, skin: 0xc89070, hair: 0x3a2a1a, hairStyle: 'bun' }, { top: 0x2e2c28, bottom: 0x3a3428, skin: 0x5a3a28, hair: 0x111111, hairStyle: 'mohawk' }
];
const DEALER_LOOK = { needles: { top: 0x1a1a1c, bottom: 0x22242a, skin: 0xc8946a, hair: 0x101010, hairStyle: 'cap', shades: true, accent: 0x3affc0 }, sugar: { top: 0x3a1a2a, bottom: 0x1a1a1e, skin: 0x7a5038, hair: 0x2a1a10, hairStyle: 'bun', shades: true, accent: 0xff4a9a } };
const JUNK_LOOK = [{ top: 0x5a5a48, bottom: 0x2a2620, skin: 0xb8967a, hair: 0x4a3a2a, hairStyle: 'long', bulk: 0.85 }, { top: 0x3a2a24, bottom: 0x2a2a30, skin: 0x9a7a62, hair: 0x1a1410, hairStyle: 'short', bulk: 0.82 },
  { top: 0x40463a, bottom: 0x1e1c1a, skin: 0xd0b4a0, hair: 0x8a7050, hairStyle: 'short', bulk: 0.8 }, { top: 0x2a2a2a, bottom: 0x3a342c, skin: 0x6a4a36, hair: 0x101010, hairStyle: 'cap', bulk: 0.86 }];
const NAMES = ['Dez', 'Rook', 'Big Ollie', 'Mags', 'Spoon', 'Cutter', 'Nan', 'Pockets', 'Hollis', 'Two-Tone', 'Gums', 'Vee'];

export function createCrowds(K) {
  let root = null, slots = [], fx = [], selT = 0, shown = 0, fights = [], dbg = { built: 0, fights: 0, sold: 0, bought: 0 };
  const R = () => Math.random();
  const C = () => { const c = K.X().contraband; return c && typeof c.buy === 'function' ? c : null; };
  const faceYaw = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z)); // buildHuman faces -z
  function mkSlots() {
    slots = []; const per = K.PHONE ? 3 : 4;
    BARRELS.forEach((b, bi) => { const c = K.L(b.at[0], b.at[1]); for (let k = 0; k < per; k++) { const a = k / per * Math.PI * 2 + bi; slots.push({ key: b.id + ':' + k, role: 'crowd', barrel: bi, a, home: c, name: NAMES[(bi * 4 + k) % NAMES.length], look: CROWD_LOOK[(bi * 2 + k) % CROWD_LOOK.length] }); } });
    for (const d of DEALERS) slots.push({ key: d.id, role: 'dealer', id: d.id, name: d.name, home: K.L(d.at[0], d.at[1]), look: DEALER_LOOK[d.id] });
    JUNKIES.forEach((j, i) => slots.push({ key: j.id, role: 'junkie', id: j.id, name: j.name, home: K.L(j.at[0], j.at[1]), look: JUNK_LOOK[i % JUNK_LOOK.length] }));
    for (const s of slots) { s.x = s.home.x; s.z = s.home.z; s.yaw = 0; s.st = 'idle'; s.t = R() * 5; s.cool = 0; s.on = false; s.gone = 0; }
  }
  function buildBarrels(g) {
    fx = []; const mBar = K.mat('st_barrel', { map: rust(21, [70, 44, 30]), roughness: 0.8, metalness: 0.45 }), mRim = K.mat('st_rim', { color: 0x2a1c14, metalness: 0.6, roughness: 0.5 }), mCoal = K.mat('st_coal', { color: 0x1a0a04, emissive: 0xff5a10, emissiveIntensity: 1.4 }),
      mCrate = K.mat('st_crate', { map: rust(31, [90, 72, 50]), roughness: 0.95 }), mGlow = new THREE.MeshBasicMaterial({ color: 0xff6a20, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const b of BARRELS) {
      const c = K.L(b.at[0], b.at[1]), grp = new THREE.Group(); grp.position.set(c.x, c.y, c.z); g.add(grp);
      K.box(grp, mBar, 0, 0.45, 0, 0.62, 0.9, 0.62, 0, K.geo().cyl); K.box(grp, mRim, 0, 0.9, 0, 0.66, 0.04, 0.66, 0, K.geo().cyl); K.box(grp, mRim, 0, 0.3, 0, 0.64, 0.04, 0.64, 0, K.geo().cyl); K.box(grp, mCoal, 0, 0.86, 0, 0.55, 0.05, 0.55, 0, K.geo().cyl);
      K.box(grp, mCrate, 2.0, 0.25, 0.6, 0.9, 0.5, 0.6, 0.4); K.box(grp, mCrate, -1.7, 0.2, -1.2, 1.4, 0.16, 0.8, 1.1);
      const glow = new THREE.Mesh(K.geo().plane, mGlow); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.04; glow.scale.set(6, 6, 1); grp.add(glow);
      const flames = [], smoke = [];
      for (let i = 0; i < 2; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flame(), color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.position.set((i - 0.5) * 0.15, 1.2, 0); grp.add(s); flames.push(s); }
      for (let i = 0; i < (K.PHONE ? 4 : 7); i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff(), color: 0xffffff, depthWrite: false, transparent: true, opacity: 0 })); s.userData.t = i / (K.PHONE ? 4 : 7); grp.add(s); smoke.push(s); }
      fx.push({ grp, flames, smoke, glow, c, fightT: 40 + R() * 80, chatT: 4 + R() * 8 });
    }
  }
  function human(s) {
    if (s.h) return s.h; const h = buildHuman(s.look); s.h = h; h.group.visible = false; h.group.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } }); root.add(h.group); return h;
  }
  function pose(h) { h.hips.position.y = h.base; h.hips.rotation.set(0, 0, 0); h.torso.rotation.set(0, 0, 0); h.head.rotation.set(0, 0, 0); for (const a of h.arms) a.rotation.set(0, 0, 0); for (const l of h.legs) l.rotation.set(0, 0, 0); h.group.rotation.set(0, 0, 0); }
  K.posePlain = pose; K.walkAnim = (h, t, k) => walk(h, t, k);
  function walk(h, t, k = 1) { const s = Math.sin(t * 7) * 0.55 * k; h.legs[0].rotation.x = s; h.legs[1].rotation.x = -s; h.arms[0].rotation.x = -s * 0.7; h.arms[1].rotation.x = s * 0.7; h.hips.position.y = h.base + Math.abs(Math.cos(t * 7)) * 0.03 * k; }
  function lie(s, h) { h.group.rotation.x = -Math.PI / 2; h.group.position.y = K.hgt(s.x, s.z) + 0.2; h.arms[0].rotation.z = 0.9; h.legs[1].rotation.x = 0.4; }
  function select(P) {
    const night = K.night(), out = [];
    for (const s of slots) {
      if (s.dead || s.flee) { out.push({ s, d: -99 }); continue; } // bodies and runners stay until street-combat lets go
      if (s.gone > K.T) continue; if (s.role === 'crowd' && !night) continue;
      const d = Math.hypot(s.home.x - P.x, s.home.z - P.z); if (d < 70) out.push({ s, d: d + (s.role === 'dealer' ? -6 : 0) });
    }
    out.sort((a, b) => a.d - b.d); const n = K.budget(out.length), pick = new Set(out.slice(0, n).map(o => o.s));
    for (const f of fights) { if (!pick.has(f.a) || !pick.has(f.b)) f.over = true; }
    for (const s of slots) { const on = pick.has(s); if (on && !s.on) { human(s); s.on = true; s.x = s.role === 'crowd' ? s.home.x + Math.cos(s.a) * 1.3 : s.home.x; s.z = s.role === 'crowd' ? s.home.z + Math.sin(s.a) * 1.3 : s.home.z; s.st = 'idle'; s.t = R() * 3; } if (!on && s.on) { s.on = false; if (s.h) s.h.group.visible = false; s.st = 'idle'; } if (s.h) s.h.group.visible = on && !P.inside; }
    shown = pick.size; K.reserve(shown + (K.extra || 0) + (K.tweak || 0));
  }
  // ---------- per-role behaviour ----------
  function crowdTick(s, h, dt, t, P) {
    if (s.fight) return; const b = BARRELS[s.barrel], c = s.home, a = s.a + Math.sin(t * 0.13 + s.a) * 0.08;
    if (s.st === 'down') { s.t -= dt; lie(s, h); if (s.t <= 0) s.st = 'idle'; return; }
    s.x = c.x + Math.cos(a) * 1.3; s.z = c.z + Math.sin(a) * 1.3; s.yaw = faceYaw(s.x, s.z, c.x, c.z);
    pose(h); h.arms[0].rotation.x = h.arms[1].rotation.x = 1.05 + Math.sin(t * 1.3 + s.a * 3) * 0.08; h.torso.rotation.z = Math.sin(t * 0.7 + s.a) * 0.05; h.head.rotation.x = Math.sin(t * 0.5 + s.a * 2) * 0.12;
    s.t -= dt; if (s.t <= 0) { s.t = 4 + R() * 8; s.drink = R() < 0.35 ? 1.8 : 0; }
    if (s.drink > 0) { s.drink -= dt; h.arms[1].rotation.x = 2.5; h.head.rotation.x = -0.4; }
    void b;
  }
  function dealerTick(s, h, dt, t, P) {
    const d = Math.hypot(P.x - s.x, P.z - s.z); pose(h);
    s.yaw = d < 14 ? faceYaw(s.x, s.z, P.x, P.z) : faceYaw(s.x, s.z, K.D.x, K.D.z);
    h.hips.rotation.z = Math.sin(t * 0.6) * 0.04; h.arms[1].rotation.x = -0.15; h.arms[1].rotation.z = 0.28; h.head.rotation.y = Math.sin(t * 0.4) * 0.3;
    s.t -= dt; if (s.t <= 0) s.t = 6 + R() * 6; if (s.t < 1.4) { h.arms[0].rotation.x = 2.2; h.arms[0].rotation.z = -0.2; }
    if (d < 7 && !P.driving && K.T > s.cool) { s.cool = K.T + 28; K.say(s, s.name, 'dealer', { quiet: true }); }
  }
  function junkieTick(s, h, dt, t, P) {
    pose(h); const d = Math.hypot(P.x - s.x, P.z - s.z); s.t -= dt;
    if (s.st === 'down') { lie(s, h); if (s.t <= 0) { s.st = 'wander'; s.t = 4; s.tx = null; } return; }
    if (s.st === 'idle' || s.t <= 0 && s.st !== 'approach' && s.st !== 'wait') { const r = R(); s.st = r < 0.4 ? 'nod' : r < 0.65 ? 'scratch' : 'wander'; s.t = 5 + R() * 8; s.tx = null; }
    if (s.st !== 'approach' && s.st !== 'wait' && s.st !== 'high' && d < 10 && !P.driving && !P.inside && K.T > s.cool && R() < dt * 0.25) { s.st = 'approach'; s.t = 18; s.cool = K.T + 50; s.mood = 0.55 + R() * 0.35; }
    if (s.st === 'wander' || s.st === 'leave') {
      if (K.night() && d < 30 && !P.inside && K.T > (s.rantT || 0)) { s.rantT = K.T + 12 + R() * 13; K.yell(s, s.name, mangle(pickRant(), volume(d)), volume(d)); } // yelling at nobody
      if (!s.tx) { const a = R() * 6.283, r = 1.5 + R() * 4.5; s.tx = { x: s.home.x + Math.cos(a) * r, z: s.home.z + Math.sin(a) * r }; }
      const dx = s.tx.x - s.x, dz = s.tx.z - s.z, L = Math.hypot(dx, dz); if (L < 0.3) { s.tx = null; if (s.st === 'leave') { s.st = 'nod'; s.t = 8; } }
      else { const lurch = Math.sin(t * 1.9 + s.home.x) > 0.85 ? 1.9 : 1, v = 0.55 * lurch * dt; s.x += dx / L * v + Math.sin(t * 3.1) * 0.012; s.z += dz / L * v + Math.cos(t * 2.7) * 0.012; s.yaw = faceYaw(s.x, s.z, s.tx.x, s.tx.z) + Math.sin(t * 2.3) * 0.25; }
      walk(h, t * 0.7, 0.7); h.torso.rotation.z = Math.sin(t * 1.7) * 0.2; h.torso.rotation.x = 0.18 + (Math.sin(t * 1.9 + s.home.x) > 0.85 ? 0.25 : 0); h.head.rotation.z = Math.sin(t * 1.1) * 0.25;
    } else if (s.st === 'nod' || s.st === 'high') {
      const jerk = Math.sin(t * 0.9 + s.home.z) > 0.96; h.torso.rotation.x = jerk ? 0.05 : 0.42 + Math.sin(t * 0.8) * 0.12; h.head.rotation.x = jerk ? -0.2 : 0.7; h.hips.position.y = h.base - 0.07; h.legs[0].rotation.x = h.legs[1].rotation.x = -0.12;
      h.arms[0].rotation.x = h.arms[1].rotation.x = 0.35; h.torso.rotation.z = Math.sin(t * 0.5) * 0.12; h.group.rotation.z = Math.sin(t * 0.6) * 0.04;
      if (d < 5 && K.T > (s.barkT || 0)) { s.barkT = K.T + 35; K.say(s, s.name, 'junkieNod', { quiet: true }); }
      if (s.st === 'high' && s.t <= 0) { s.st = 'wander'; s.t = 6; }
    } else if (s.st === 'scratch') {
      h.arms[0].rotation.x = 2.6; h.arms[0].rotation.z = Math.sin(t * 15) * 0.25; h.arms[1].rotation.x = 0.95; h.arms[1].rotation.z = -0.45 + Math.sin(t * 13) * 0.15; h.head.rotation.z = 0.3; h.torso.rotation.y = Math.sin(t * 9) * 0.06;
      if (d < 5 && K.T > (s.barkT || 0)) { s.barkT = K.T + 35; K.say(s, s.name, 'junkieScratch', { quiet: true }); }
    } else if (s.st === 'approach' || s.st === 'wait') {
      s.yaw = faceYaw(s.x, s.z, P.x, P.z);
      if (d > 1.6 && s.st === 'approach') { const v = 0.9 * dt; s.x += (P.x - s.x) / d * v; s.z += (P.z - s.z) / d * v; walk(h, t, 0.8); h.torso.rotation.x = 0.15; }
      else { if (s.st === 'approach') { s.st = 'wait'; K.say(s, s.name, 'junkie'); } h.arms[0].rotation.x = 1.2; h.arms[0].rotation.z = -0.2; h.torso.rotation.x = 0.12; h.head.rotation.x = Math.sin(t * 2) * 0.1; }
      if (s.t <= 0 || d > 16 || P.driving) { if (d < 25) K.say(s, s.name, 'junkieNo', { quiet: true }); s.st = 'leave'; s.t = 10; s.tx = null; }
    }
  }
  // ---------- fights at the barrels ----------
  function fight(bi) {
    const f0 = fx[bi]; if (!f0) return null; const at = slots.filter(s => s.on && s.role === 'crowd' && s.barrel === bi && s.st !== 'down' && !s.fight);
    if (at.length < 2) return null; const a = at[0], b = at[1]; const F = { a, b, t: 0, bi, hits: 0 }; a.fight = b.fight = F; fights.push(F);
    K.say(a, a.name, 'fight', { quiet: true }); K.ST.stats.fights++; K.save(); dbg.fights++; K.emit('fight', { barrel: BARRELS[bi].id, a: a.name, b: b.name }); return { a: a.name, b: b.name };
  }
  function fightTick(F, dt, t) {
    const { a, b } = F; F.t += dt; const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    if (F.over || !a.h || !b.h) { a.fight = b.fight = null; return false; }
    if (F.t < 1.2) { for (const s of [a, b]) { s.x += (mx - s.x) * dt * 1.2; s.z += (mz - s.z) * dt * 1.2; } }
    for (const [s, o] of [[a, b], [b, a]]) { const h = s.h; pose(h); s.yaw = faceYaw(s.x, s.z, o.x, o.z); const dd = Math.hypot(o.x - s.x, o.z - s.z); if (dd < 0.85 && dd > 0.01) { s.x -= (o.x - s.x) / dd * 0.02; s.z -= (o.z - s.z) / dd * 0.02; } h.torso.rotation.x = 0.2; h.arms[0].rotation.x = h.arms[1].rotation.x = 1.3; }
    if (F.t >= 1.2 && F.t < 4.6) {
      const ph = (F.t * 2.6) % 2, hitter = ph < 1 ? a : b, other = hitter === a ? b : a; hitter.h.arms[ph < 1 ? 0 : 1].rotation.x = 1.6 + Math.sin(ph * Math.PI) * 0.4; hitter.h.torso.rotation.y = Math.sin(ph * Math.PI) * 0.4;
      const k = Math.floor(F.t * 1.3); if (k !== F.hits) { F.hits = k; other.h.head.rotation.x = -0.4; try { K.game()?.gore?.(other.x, K.hgt(other.x, other.z) + 1.55, other.z, { n: 0.25, spray: true }); } catch (e) { /* */ } if (k === 3) K.say(other, other.name, 'fight', { quiet: true }); }
    }
    if (F.t >= 4.6) { b.st = 'down'; b.t = 9; a.fight = b.fight = null; K.say(a, a.name, 'fightOver', { quiet: true }); return false; }
    return true;
  }
  // ---------- panels ----------
  function dealerPanel(s) {
    const c = C(), wanted = K.wanted();
    const render = () => {
      if (!c) return K.openPanel(`${s.name} \u00b7 corner`, 'Supply\u2019s dry tonight. (The contraband module isn\u2019t loaded.)', [], K.pick(K.LINES.dealer));
      if (wanted > 0) return K.openPanel(`${s.name} \u00b7 corner`, 'You\u2019re glowing with heat. Lose the stars first.', [], 'Walk. Now. Before ColSec follows you over here.');
      const items = (c.items?.() || []).filter(i => CORE.includes(i.id)), st = c.stash?.()?.items || c.stash?.() || {}, cap = c.capacity?.();
      const btns = items.map(i => { const price = Math.ceil((c.supplierPrice?.(i.id) ?? i.supplier) * MARKUP / 5) * 5, held = st[i.id]?.qty || 0;
        return { label: `${i.icon || '\ud83d\udce6'} ${i.name} \u2014 ${price} cr`, sub: `Blue sells it for less. ${s.name} is right here. You hold ${held}.`, disabled: K.credits() < price, fn: () => {
          if (!K.take(price)) { K.say(s, s.name, 'dealerBroke'); return true; }
          const r = c.buy(i.id, 1, { free: true, fresh: 0.85 });
          if (!r?.ok) { K.pay(price); K.toast(`${s.name}: ${r?.msg || 'No.'}`, 2400); return true; }
          K.ST.stats.bought++; K.save(); dbg.bought++; K.toast(`\ud83d\udc8a ${s.name}: ${K.pick(K.LINES.dealerSold)} (+1 ${i.name}, -${price} cr)`, 2600); K.emit('buy', { from: s.id, item: i.id, price }); return true; } }; });
      K.openPanel(`${s.name} \u00b7 street prices`, `Corner markup on Blue\u2019s product. Cash only.${cap ? ` Pockets: ${cap.used}/${cap.max}.` : ''} You have ${K.credits()} cr.`, btns, K.pick(K.LINES.dealer), render);
    };
    render();
  }
  function junkiePanel(s) {
    const c = C(); s.st = 'wait'; s.t = 30;
    const st = c ? (c.stash?.()?.items || {}) : {}, items = c ? (c.items?.() || []).filter(i => i.contraband !== false && st[i.id]?.qty > 0) : [];
    const mood = s.mood || 0.7, btns = [];
    for (const i of items.slice(0, 4)) { const price = Math.max(5, Math.round((c.buyerPrice?.(i.id, K.CDIST) ?? i.base ?? 40) * mood));
      btns.push({ label: `Sell 1 ${i.name} \u2014 ${price} cr`, sub: 'Street deal. Could be a narc. Could be seen.', fn: () => {
        const r = c.sell(i.id, 1, K.CDIST, { risk: true, pay: false });
        if (r?.bust) { K.say(s, s.name, 'junkieNarc', { toastToo: true }); K.toast(r.msg, 3600); K.emit('bust', { junkie: s.id, item: i.id }); s.st = 'leave'; s.t = 10; s.tx = null; return; }
        if (!r?.ok) { K.toast(r?.msg || 'No deal.', 2600); return; }
        K.pay(price, 2); K.ST.stats.sold++; K.save(); dbg.sold++; K.say(s, s.name, 'junkieThanks', { toastToo: true }); if (r.seen) K.toast('\ud83d\udea8 Somebody saw that.', 2000);
        K.emit('sell', { junkie: s.id, item: i.id, price, seen: !!r.seen }); s.st = 'high'; s.t = 25; } }); }
    btns.push({ label: 'Give 5 cr', sub: 'For "oxygen".', disabled: K.credits() < 5, fn: () => { if (!K.take(5)) return; K.ST.stats.begged++; K.cred(1, 'charity'); K.rep('junkies', 1, 'spare change'); K.say(s, s.name, 'junkieThanks', { toastToo: true }); if (R() < 0.35) setTimeout(() => K.say(s, s.name, 'junkieTip', { toastToo: true }), 2200); s.st = 'leave'; s.t = 10; s.tx = null; } });
    if (items.length) btns.push({ label: 'Give a free hit', sub: 'Cheapest thing you\u2019re holding.', fn: () => { const it = items.slice().sort((a, b) => (a.base || 0) - (b.base || 0))[0]; if (!c.remove(it.id, 1)) return; K.cred(2, 'free hit'); K.rep('junkies', 2, 'a free hit'); K.say(s, s.name, 'junkieThanks', { toastToo: true }); if (R() < 0.6) setTimeout(() => K.say(s, s.name, 'junkieTip', { toastToo: true }), 2400); K.emit('gift', { junkie: s.id, item: it.id }); s.st = 'high'; s.t = 30; } });
    btns.push({ label: 'Shove him off', fn: () => { K.rep('junkies', -1, 'shoved a junkie'); K.say(s, s.name, 'junkieNo', { toastToo: true }); s.st = 'down'; s.t = 6; K.emit('shove', { junkie: s.id }); } });
    K.openPanel(`${s.name} \u00b7 strung out`, items.length ? `${s.name} has crumpled credits and no patience. Pays ${Math.round(mood * 100)}% of the corner price.` : `${s.name} wants product or credits. You\u2019re holding nothing they want.`, btns, K.pick(K.LINES.junkie));
  }
  function barrelPanel(bi) {
    const b = BARRELS[bi], f = fx[bi], people = slots.filter(s => s.on && s.role === 'crowd' && s.barrel === bi && s.st !== 'down'), who = people[0];
    K.openPanel(`Burn barrel \u00b7 ${b.name.replace(/^the /, '')}`, `${people.length} people warming their hands. Smells like burning tyres and worse.`, [
      { label: 'Buy a round (10 cr)', sub: 'Red Dust whiskey. Loosens tongues.', disabled: K.credits() < 10, fn: () => { if (!K.take(10)) return; K.cred(1, 'bought a round'); K.say(who || f.c, who?.name || 'Drifter', 'bottle', { toastToo: true }); setTimeout(() => K.say(who || f.c, who?.name || 'Drifter', 'rumor', { toastToo: true }), 2600); K.emit('round', { barrel: b.id }); } },
      { label: 'Ask what\u2019s going on', fn: () => K.say(who || f.c, who?.name || 'Drifter', 'rumor', { toastToo: true }) },
      { label: 'Mouth off', sub: 'Two of them will take it personally.', fn: () => mouthOff(bi) }
    ], K.pick(K.LINES.barrelHello));
  }
  function mouthOff(bi) {
    const f = fx[bi], ppl = slots.filter(s => s.on && s.role === 'crowd' && s.barrel === bi).slice(0, 2); if (!ppl.length) return;
    K.say(ppl[0], ppl[0].name, 'mouthOff', { toastToo: true });
    for (const s of ppl) { s.gone = K.T + 180; s.on = false; if (s.h) s.h.group.visible = false; }
    let n = 0; try { n = K.X().city?.hostiles?.(ppl.map(() => 'thug'), f.c.x, f.c.z, { r: 2 }) || K.game()?.hostiles?.(ppl.map(() => 'thug'), f.c.x, f.c.z, { r: 2 }) || 0; } catch (e) { console.warn('street hostiles', e); }
    if (!n) { try { K.game()?.hurtPlayer?.(10, { x: f.c.x, z: f.c.z }); } catch (e) { /* */ } K.toast('\ud83d\udca2 They jump you, get a few kicks in and scatter.', 2600); }
    K.emit('mouthoff', { barrel: BARRELS[bi].id, hostiles: n }); selT = 0;
  }
  return {
    build(g) { root = g; mkSlots(); buildBarrels(g); selT = 0; dbg.built++; },
    dispose() { for (const s of slots) if (s.h) { s.h.group.parent?.remove(s.h.group); s.h = null; } slots = []; fx = []; fights = []; root = null; shown = 0; },
    tick(dt, t, P) {
      const night = K.night();
      for (const f of fx) { // fire and smoke run every frame (cheap); crowd chatter and fights only at night near the player
        const k = night ? 1 : 0.45; f.flames.forEach((s, i) => { const fl = 0.75 + Math.sin(t * (11 + i * 4) + i) * 0.12 + Math.sin(t * 23 + i * 2) * 0.08; s.scale.set(0.55 * fl * k + 0.1, 1.1 * fl * k + 0.15, 1); s.position.y = 1.0 + 0.35 * fl * k; });
        f.glow.material.opacity = (night ? 0.28 : 0.08) + Math.sin(t * 13) * 0.03;
        for (const s of f.smoke) { s.userData.t = (s.userData.t + dt * 0.16) % 1; const u = s.userData.t; s.position.set(Math.sin(u * 5 + s.id) * 0.35 + u * 0.8, 1.3 + u * 5.5, Math.cos(u * 4 + s.id) * 0.3); const sc = 0.5 + u * 2.6; s.scale.set(sc, sc, 1); s.material.opacity = Math.sin(u * Math.PI) * (night ? 0.55 : 0.3); }
        const d = Math.hypot(P.x - f.c.x, P.z - f.c.z);
        if (night && d < 45 && (f.fightT -= dt) <= 0) { f.fightT = 70 + R() * 90; fight(fx.indexOf(f)); }
        if (night && d < 18 && (f.chatT -= dt) <= 0) { f.chatT = 9 + R() * 8; const ppl = slots.filter(s => s.on && s.role === 'crowd' && s.barrel === fx.indexOf(f) && !s.fight && s.st !== 'down'); if (ppl.length) { const s = ppl[(R() * ppl.length) | 0]; K.say(s, s.name, 'barrel', { quiet: true }); } }
      }
      if ((selT -= dt) <= 0) { selT = 0.6; select(P); }
      fights = fights.filter(F => fightTick(F, dt, t));
      for (const s of slots) { if (!s.on || !s.h) continue; const h = s.h;
        if (K.combat?.drive?.(s, h, dt, t, P)) continue;
        if (!s.fight) { if (s.role === 'crowd') crowdTick(s, h, dt, t, P); else if (s.role === 'dealer') dealerTick(s, h, dt, t, P); else junkieTick(s, h, dt, t, P); }
        if (s.st !== 'down') { h.group.position.set(s.x, K.hgt(s.x, s.z), s.z); h.group.rotation.y = s.yaw; } else h.group.rotation.y = s.yaw;
        h.group.position.x = s.x; h.group.position.z = s.z; }
    },
    acts(P) {
      if (P.driving) return []; const out = [];
      for (const s of slots) { if (!s.on || s.st === 'down' || s.fight || s.dead || s.flee || s.role === 'crowd') continue; const d = Math.hypot(P.x - s.x, P.z - s.z); if (d > 2.5) continue;
        if (s.role === 'dealer') out.push({ d, label: `\ud83d\udc8a Buy from ${s.name}`, fn: () => dealerPanel(s) });
        else out.push({ d, label: `\ud83e\udd44 Talk to ${s.name}`, fn: () => junkiePanel(s) }); }
      fx.forEach((f, bi) => { const d = Math.hypot(P.x - f.c.x, P.z - f.c.z); if (d < 3.2 && slots.some(s => s.on && s.role === 'crowd' && s.barrel === bi)) out.push({ d: d + 0.8, label: '\ud83d\udd25 Warm up at the barrel', fn: () => barrelPanel(bi) }); });
      return out;
    },
    marks() { const M = []; for (const d of DEALERS) { const p = K.L(d.at[0], d.at[1]); M.push({ x: p.x, z: p.z, r: 2.2, color: '#d0d0d0' }); } if (K.night()) for (const b of BARRELS) { const p = K.L(b.at[0], b.at[1]); M.push({ x: p.x, z: p.z, r: 2.4, color: '#ff8a30' }); } return M; },
    list: () => BARRELS.map((b, i) => { const p = K.D ? K.L(b.at[0], b.at[1]) : null; return { id: b.id, name: b.name, local: [...b.at], x: p?.x, z: p?.z, people: slots.filter(s => s.on && s.role === 'crowd' && s.barrel === i).length, fighting: fights.some(f => f.bi === i) }; }),
    npcs: () => slots.filter(s => s.on).map(s => ({ key: s.key, role: s.role, name: s.name, state: s.fight ? 'fight' : s.st, x: +s.x.toFixed(2), z: +s.z.toFixed(2) })),
    fight: (i = 0) => fight(i),
    slots: () => slots, reselect() { selT = 0; },
    colliders() { // burn barrels (cylinders) and the crate beside each one; the flat pallet is walkable
      const out = []; for (const b of BARRELS) { const c = K.L(b.at[0], b.at[1]); out.push({ type: 'cyl', x: c.x, z: c.z, r: 0.42, tag: 'barrel:' + b.id });
        out.push({ type: 'box', x: c.x + 2.0, z: c.z + 0.6, hx: 0.45, hz: 0.3, yaw: 0.4, tag: 'crate:' + b.id }); } return out; },
    debug: () => ({ ...dbg, shown, slots: slots.length, built: slots.filter(s => s.h).length, fights: fights.length })
  };
}
