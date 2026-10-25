// v7.4 street danger: random encounters on colony streets. A director rolls for trouble by district and Mars hour;
// implemented here: the glow-dust junkie knife mugging (approach -> standoff with Pay / Fight / Run / Talk on the
// context buttons -> outcomes, loot and heat) and ambient NPC-on-NPC street fights. Street (gang / junkie) car chases
// and the Red Tape Run set-piece live in pursuit.js. Police is NOT ours: stars and ColSec response go through
// world.crime / world.setWanted (v7.4 security combat owns cover, backup and the 4-5★ heavies).
// Phone budget: world colonists/guards/contacts + our NPCs + chase drivers <= 12 (20 desktop).
// Pure rules: dangercore.js. Core access: dangerhooks.js. Wiring: surface.js calls dangerTick(dt, ctx) once a frame.
//
// HUD rules: nothing permanent. One chip in the right-hand stack during a standoff, the choice buttons take over the
// context-button column for those seconds, speech bubbles live in the world over heads, centre of the screen stays clear.
import * as THREE from 'three';
import * as DC from './dangercore.js';
import { addMenuItem, tapButton, patchWorld } from './dangerhooks.js';
import { pursuitTick, pursuitHittables, pursuitReset, pursuitDebug, pursuitStart, pursuitNpcCount, pursuitOnGangKill, setPieceStart, setNpcBudget } from './pursuit.js';
import { MARS_CITY } from './streetdata.js';
import { ambientLoad, ambientInit, ambientAny, ambientStart, ambientTick, ambientClear, ambientActive, ambientDebug } from './ambient.js';

const LS_KEY = 'ssx.danger.v1';
const LS = (() => { try { return window.localStorage; } catch (e) { return { getItem: () => null, setItem: () => {} }; } })();
let settings = (() => { try { return { on: true, ...JSON.parse(LS.getItem(LS_KEY) || '{}') }; } catch (e) { return { on: true }; } })();
const saveSettings = () => { try { LS.setItem(LS_KEY, JSON.stringify(settings)); } catch (e) { /* private mode */ } };
const app = () => window.__app;
const toast = (m, ms) => app()?.toast?.(m, ms);
const isTouch = () => typeof document !== 'undefined' && document.body.classList.contains('touch');

let C = null, root = null, planet = null, lastTick = 0, ui = null, time = 0;
let director = DC.createDirector();
let mug = null;                 // the active mugging
let fights = [];                // ambient fights: { a, b, t, over }
let npcs = [];                  // everything with a body we own
let splats = [];
const stats = { muggings: 0, fights: 0, chases: 0, outcomes: {}, lastOutcome: null, kills: 0, skippedBudget: 0 };
let saltbloodHeat = 0;          // you killed their boys / wrecked their cars: gang chases get likelier (decays)
// how many more bodies we may put on the street right now (phone cap 12, desktop 20 incl. world people)
function budget() { const P = C?.player, w = C?.world; const wp = P ? DC.nearCount(w?.debug?.people?.(), P.x, P.z) : 0, sec = P ? DC.nearCount(w?.securityList?.(), P.x, P.z) : 0; return DC.npcBudget(wp + sec, npcs.filter(n => n.alive).length + pursuitNpcCount(), isTouch()); }

// ---------- assets (all flagged shared so surface.exit()'s dispose pass leaves them alone) ----------
const A = {};
function assets() {
  if (A.ok) return A; A.ok = true;
  const sh = o => { o.userData.shared = true; return o; };
  const M = (c, o = {}) => sh(new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.05, ...o }));
  A.torso = sh(new THREE.CapsuleGeometry(0.27, 0.5, 4, 10)); A.head = sh(new THREE.SphereGeometry(0.21, 14, 10));
  A.visor = sh(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)); A.visor.rotateX(-Math.PI / 2);
  A.limb = sh(new THREE.CapsuleGeometry(0.085, 0.5, 3, 8)); A.limb.translate(0, -0.3, 0);
  A.leg = sh(new THREE.CapsuleGeometry(0.11, 0.62, 3, 8)); A.leg.translate(0, -0.38, 0);
  A.boot = sh(new THREE.BoxGeometry(0.2, 0.12, 0.32)); A.tank = sh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8));
  A.blade = sh(new THREE.BoxGeometry(0.03, 0.04, 0.32)); A.blade.translate(0, 0, -0.18);
  A.pipe = sh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6)); A.pipe.rotateX(Math.PI / 2); A.pipe.translate(0, 0, -0.38);
  A.tape = sh(new THREE.BoxGeometry(0.56, 0.07, 0.58)); A.hood = sh(new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62));
  A.pool = sh(new THREE.CircleGeometry(1, 20)); A.pool.rotateX(-Math.PI / 2);
  A.drop = sh(new THREE.SphereGeometry(0.05, 5, 4));
  A.suit = { junkie: M(0x6b5a44, { roughness: 0.95 }), thug: M(0x1d1d22, { roughness: 0.6 }), colonist: M(0x8a96a6), victim: M(0x7d8c7a) };
  A.skin = M(0xb98e72); A.grime = M(0x3a3127, { roughness: 1 }); A.red = M(0xb3121b, { roughness: 0.5 }); A.steel = M(0xd0d4da, { metalness: 0.9, roughness: 0.25 });
  A.glowEye = sh(new THREE.MeshStandardMaterial({ color: 0x0a1a30, emissive: 0x39b8ff, emissiveIntensity: 2.4, roughness: 0.2 }));
  A.visorM = M(0x10161f, { roughness: 0.15, metalness: 0.6 }); A.tankM = M(0x9aa0a8, { metalness: 0.5 });
  A.blood = sh(new THREE.MeshStandardMaterial({ color: 0x5a0306, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  A.bloodD = sh(new THREE.MeshBasicMaterial({ color: 0x8a0a0a }));
  return A;
}
// a person with arms (the colony's people have none; a mugging needs a knife hand)
function buildNpc(kind) {
  const a = assets(), g = new THREE.Group(), suit = a.suit[kind] || a.suit.colonist, body = new THREE.Group(); g.add(body);
  const add = (geo, mat, x, y, z, p = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; };
  add(a.torso, suit, 0, 1.22, 0);
  const head = add(a.head, kind === 'junkie' ? a.grime : suit, 0, 1.86, 0);
  add(a.visor, kind === 'junkie' ? a.glowEye : a.visorM, 0, 1.87, -0.07);
  add(a.tank, a.tankM, 0.1, 1.3, 0.28); if (kind !== 'junkie') add(a.tank, a.tankM, -0.1, 1.3, 0.28);
  if (kind === 'thug') { add(a.tape, a.red, 0, 1.4, 0); add(a.tape, a.red, 0, 1.05, 0); }             // Saltblood red tape
  if (kind === 'junkie') { add(a.hood, a.grime, 0, 1.9, 0.02); head.scale.set(1, 1, 1.05); }
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.36, 1.55, 0); body.add(sh); add(a.limb, suit, 0, 0, 0, sh); arms.push(sh);
    const hip = new THREE.Group(); hip.position.set(s * 0.14, 0.86, 0); body.add(hip); add(a.leg, suit, 0, 0, 0, hip); add(a.boot, a.grime, 0, -0.8, -0.05, hip); legs.push(hip);
  }
  return { g, body, head, arms, legs };
}
function giveWeapon(n, w) {
  if (!w || w === 'fists') return; const a = assets();
  const m = new THREE.Mesh(w === 'knife' ? a.blade : a.pipe, a.steel); m.position.set(0, -0.62, -0.02); n.arms[1].add(m); n.weaponMesh = m; m.visible = w !== 'knife';
}

// ---------- speech bubbles (in-world sprites, not HUD) ----------
function bubbleTex(text, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
  let fs = 34; x.font = `800 ${fs}px system-ui, sans-serif`; while (x.measureText(text).width > 480 && fs > 16) { fs -= 2; x.font = `800 ${fs}px system-ui, sans-serif`; }
  const w = Math.min(500, x.measureText(text).width + 30);
  x.fillStyle = 'rgba(8,8,12,0.82)'; x.beginPath(); x.roundRect?.((512 - w) / 2, 14, w, 64, 18); if (!x.roundRect) x.rect((512 - w) / 2, 14, w, 64); x.fill();
  x.strokeStyle = color; x.lineWidth = 3; x.stroke(); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 47);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// our bark key -> SSX.bark category (mugger lines keep their beat as a hint: npc.barkBeat)
const barkCat = key => /^junkie/.test(key) ? 'mugger' : /^fight/.test(key) ? 'fighter' : key === 'bystander' ? 'bystander' : null;
function say(n, key, vars, ms = 2600, color = '#ff5a5a') {
  const line = DC.fill(DC.pick(DC.BARKS[key] || [key]), vars); if (!line) return '';
  // Pumpkin's PR #5 captioned barks: SSX.bark(npc, category). Use it when present; it handles the line unless it returns false.
  const ext = typeof window !== 'undefined' && typeof window.SSX?.bark === 'function' ? window.SSX.bark : null;
  if (ext && barkCat(key)) { try { n.barkBeat = key; const r = ext(n, barkCat(key)); if (r !== false) { n.lastLine = typeof r === 'string' ? r : line; return n.lastLine; } } catch (e) { /* fall back to our bubble */ } }
  if (n.bubble) { n.bubble.material.map.dispose(); n.bubble.material.dispose(); n.g.remove(n.bubble); }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex(line, color), transparent: true, depthWrite: false, depthTest: false }));
  s.position.y = 2.45; s.scale.set(3.6, 0.68, 1); s.renderOrder = 20; n.g.add(s); n.bubble = s; n.bubbleT = ms / 1000; n.lastLine = line;
  return line;
}

// ---------- NPC bookkeeping ----------
function spawnNpc(kind, x, z, extra = {}) {
  const b = buildNpc(kind), H = C.height(x, z);
  const n = { kind, ...b, x, z, y: H, yaw: 0, hp: 3, alive: true, hostile: false, phase: Math.random() * 6, speed: 0, swingT: 0, down: 0, t: 0, ...extra };
  b.g.position.set(x, H, z); root.add(b.g); npcs.push(n);
  n.hittable = { get x() { return n.x; }, get y() { return n.y + 1.2; }, get z() { return n.z; }, r: 0.7, kind: 'npc', get alive() { return n.alive; }, get hostile() { return n.hostile; }, hit: (d, how, from, knock) => hurtNpc(n, d, how, from, knock) };
  return n;
}
function removeNpc(n) {
  if (n.bubble) { n.bubble.material.map.dispose(); n.bubble.material.dispose(); }
  root.remove(n.g); npcs = npcs.filter(o => o !== n);
}
function face(n, tx, tz, dt, k = 8) { const fy = Math.atan2(-(tx - n.x), -(tz - n.z)); n.yaw += Math.atan2(Math.sin(fy - n.yaw), Math.cos(fy - n.yaw)) * Math.min(1, dt * k); }
function moveTo(n, tx, tz, sp, dt) {
  const dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz); if (d < 0.05) { n.speed = 0; return d; }
  const st = Math.min(d, sp * dt); let nx = n.x + dx / d * st, nz = n.z + dz / d * st;
  const c = C.world.collide?.(nx, nz, 0.4); if (c) { nx = c.x; nz = c.z; }
  n.x = nx; n.z = nz; n.speed = sp; face(n, tx, tz, dt); return d;
}
function animate(n, dt) {
  n.phase += dt; n.t += dt;
  if (n.bubble && (n.bubbleT -= dt) <= 0) { n.bubble.material.map.dispose(); n.bubble.material.dispose(); n.g.remove(n.bubble); n.bubble = null; }
  n.y = C.height(n.x, n.z);
  if (!n.alive) { n.down = Math.min(1, n.down + dt * 2.6); n.body.rotation.x = -Math.PI / 2 * n.down; n.body.position.y = 0.25 * n.down; n.g.position.set(n.x, n.y, n.z); n.g.rotation.y = n.yaw; return; }
  const w = n.speed > 0.3 ? Math.sin(n.phase * (n.speed > 3.5 ? 13 : 8)) * Math.min(0.9, n.speed / 5) : 0;
  n.legs[0].rotation.x = w; n.legs[1].rotation.x = -w; n.arms[0].rotation.x = -w * 0.8;
  if (n.swingT > 0) { n.swingT = Math.max(0, n.swingT - dt); const p = 1 - n.swingT / 0.35; n.arms[1].rotation.x = -2.4 * Math.sin(Math.min(1, p) * Math.PI) - 0.4; }
  else n.arms[1].rotation.x = n.armed ? -1.25 + Math.sin(n.phase * 9) * 0.06 : w * 0.8;   // knife held out, shaking
  if (n.twitch) n.head.rotation.y = Math.sin(n.phase * 17) * 0.12;
  n.g.position.set(n.x, n.y, n.z); n.g.rotation.y = n.yaw;
}
function bloodPool(x, z, r = 1.1) {
  const a = assets(), m = new THREE.Mesh(A.pool, a.blood); m.position.set(x, C.height(x, z) + 0.03, z); m.scale.setScalar(0.1); m.userData.grow = r; root.add(m); splats.push({ m, t: 0, r });
  if (splats.length > 14) { const o = splats.shift(); root.remove(o.m); }
}
function bloodSpray(x, y, z) { // a few droplets
  const a = assets();
  for (let i = 0; i < 8; i++) { const d = new THREE.Mesh(a.drop, a.bloodD); d.position.set(x, y, z); d.userData.v = new THREE.Vector3((Math.random() - 0.5) * 4, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 4); d.userData.life = 0.9; root.add(d); splats.push({ m: d, drop: true, t: 0 }); }
}
const inColony = (x, z) => { const c = C?.world?.colony; return !!c && Math.hypot(x - c.x, z - c.z) < 90; };

function hurtNpc(n, dmg, how, from, knock = 0) {
  if (!n.alive) return true;
  n.hp -= dmg; bloodSpray(n.x, n.y + 1.3, n.z);
  if (from && knock) { const d = Math.hypot(n.x - from.x, n.z - from.z) || 1; n.x += (n.x - from.x) / d * knock * 0.6; n.z += (n.z - from.z) / d * knock * 0.6; }
  n.byPlayer = true;
  if (n.hp <= 0) killNpc(n, how);
  else n.onHurt?.(how);
  return true;
}
function killNpc(n, how) {
  n.alive = false; n.hostile = false; n.armed = false; n.speed = 0; if (n.weaponMesh) n.weaponMesh.visible = true;
  bloodPool(n.x, n.z, 0.9 + Math.random() * 0.6);
  if (n.byPlayer) stats.kills++;
  n.onDeath?.(how); n.despawn = 40;
}

// ---------- the knife mugging ----------
function startMugging(force) {
  if (budget() < 1) { stats.skippedBudget++; return null; }
  const P = C.player, yaw = C.player.yaw ?? 0;
  // come out of the dark from behind-left or behind-right, 18-24 m out
  const side = Math.random() < 0.5 ? -1 : 1, a = yaw + Math.PI + side * (0.5 + Math.random() * 0.5), r = force?.dist ?? 20 + Math.random() * 4;
  let x = P.x - Math.sin(a) * r, z = P.z - Math.cos(a) * r;
  const c = C.world.collide?.(x, z, 0.5); if (c) { x = c.x; z = c.z; }
  const g = C.game, credits = g.progress.credits;
  const n = spawnNpc('junkie', x, z, { hp: DC.MUG.hp, twitch: true, role: 'mugger' }); giveWeapon(n, 'knife');
  mug = { n, phase: 'approach', t: 0, demand: DC.demandFor(credits), talks: 0, stabCd: 0, paid: 0, outcome: null, chaseT: 0 };
  n.onHurt = () => { if (!mug || mug.n !== n) return; say(n, 'junkieHit', null, 1400); if (mug.phase === 'approach' || mug.phase === 'standoff') commit('fight', { attacked: true }); else if (mug.phase === 'fleeing') { mug.phase = 'fight'; n.hostile = true; n.armed = true; } };
  n.onDeath = how => onMuggerDown(how);
  say(n, 'junkieApproach', null, 2600, '#ffb35a');
  stats.muggings++; director.active = 1;
  return mug;
}
function onMuggerDown(how) {
  const m = mug; if (!m) return; say(m.n, 'junkieDown', null, 2400);
  const gun = how === 'shot' || how === 'blast';
  const heat = DC.heatForMugger({ phase: m.phase, killed: true, gun, witnessed: inColony(m.n.x, m.n.z), inColony: inColony(m.n.x, m.n.z) });
  if (heat) C.world.crime?.(heat.min, heat.why);
  const loot = DC.muggerLoot(Math.random, m.paid), P = C.game.progress;
  P.credits += loot.credits; P.xp += 12; C.game.save?.();
  toast(`🔪 Junkie down. You lift ${loot.credits} cr${m.paid ? ' (yours, plus his)' : ''}${loot.dust ? ' and a baggie of glow-dust' : ''}.${heat ? ` 🚨 ${heat.why}.` : ''}`, 3400);
  end(heat ? 'killed-heat' : 'killed');
}
function setChoices(on) {
  ensureUI(); document.body.classList.toggle('danger-standoff', !!on); ui.choices.classList.toggle('on', !!on);
  if (on) { const k = !isTouch(); ui.pay.textContent = `💰 Pay ${mug.demand}${k ? ' (1)' : ''}`; ui.fight.textContent = `🔪 Fight${k ? ' (2)' : ''}`; ui.run.textContent = `🏃 Run${k ? ' (3)' : ''}`; ui.talk.textContent = `🗣 Talk${k ? ' (4)' : ''}`; }
}
function setEvCard(title, line, opts, pick) {
  ensureUI(); const box = ui.evBox; box.innerHTML = '';
  if (title == null) { box.classList.remove('on'); if (!mug || mug.phase !== 'standoff') document.body.classList.remove('danger-standoff'); setChip(null); return; }
  const k = !isTouch();
  (opts || []).slice(0, 3).forEach((o, i) => { const b = document.createElement('button'); b.className = 'glass dzEv'; b.dataset.choice = o.id; b.textContent = o.label + (k ? ` (${i + 1})` : ''); b.__pick = () => pick(o.id); tapButton(b, () => pick(o.id)); box.appendChild(b); });
  box.classList.add('on'); document.body.classList.add('danger-standoff');
  setChip(`📻 <b>${esc(title)}</b>${line ? `<br><i>${esc(line)}</i>` : ''}`);
}
function setChip(html) { ensureUI(); if (html == null) { ui.chip.classList.remove('on'); ui.chip.innerHTML = ''; return; } if (ui.chip.innerHTML !== html) ui.chip.innerHTML = html; ui.chip.classList.add('on'); }
function commit(choice, o = {}) {
  const m = mug; if (!m || (m.phase !== 'standoff' && !(o.attacked && m.phase === 'approach'))) return null;
  const g = C.game, P = g.progress;
  const env = { credits: P.credits, xp: P.xp, armed: !!g.info?.canFire && !['blade', 'cleaver'].includes(P.equip.weapon), dog: !!C.dogNear, night: DC.timeBand(DC.marsHour()) === 'night', saltbloodRep: (P.flags || []).filter(f => /^vesna-|saltblood/.test(f)).length };
  const out = o.attacked ? { result: 'fight', bark: 'junkieFight', lunge: false } : DC.resolveChoice(choice, m, env);
  m.outcome = out.result; stats.outcomes[out.result] = (stats.outcomes[out.result] || 0) + 1; stats.lastOutcome = { choice, ...out };
  setChoices(false); setChip(null); say(m.n, out.bark, null, 2400);
  if (out.result === 'paid') { g.spend?.(out.paid) || (P.credits -= out.paid); m.paid = out.paid; m.phase = 'fleeing'; m.t = 0; m.n.armed = false; toast(`💸 −${out.paid} cr. He backs off, grinning.`, 2400); }
  else if (out.result === 'fight') { m.phase = 'fight'; m.t = 0; m.n.hostile = true; m.n.armed = true; if (out.lunge) m.stabCd = 0; else m.stabCd = 0.8;
    if (!o.attacked) toast(out.why === 'broke' ? '🔪 You\u2019re broke and he\u2019s pissed. Fight!' : out.why === 'twitch' ? '🔪 Wrong words. He lunges!' : `🔪 Fight! ${isTouch() ? 'FIRE or 👊' : 'Click/F or C'}`, 2200); }
  else if (out.result === 'chase') { m.phase = 'chase'; m.t = 0; m.n.hostile = true; m.n.armed = true; toast('🏃 RUN! He\u2019s right behind you.', 2000); }
  else if (out.result === 'talked' || out.result === 'tip') { m.phase = 'fleeing'; m.t = 0; m.n.armed = false; P.xp += out.xp || 0; g.save?.();
    toast(out.result === 'tip' ? `🗣 Talked down, and he talks: “${m.n.lastLine}” +${out.xp} XP` : `🗣 Talked him down. +${out.xp} XP`, 3200); }
  else if (out.result === 'shoved') { g.hurtPlayer(out.dmg, { x: m.n.x, z: m.n.z }); m.phase = 'fleeing'; m.t = 0; m.n.armed = false; toast('🫸 Empty pockets. He shoves you into the wall and stalks off, cursing.', 2600); }
  else if (out.result === 'stabbed') { stab(m.n, out.dmg); if (out.paid) { g.spend?.(out.paid) || (P.credits -= out.paid); m.paid = out.paid; } m.phase = 'fleeing'; m.t = 0; toast(`🩸 He cuts you and grabs ${out.paid} cr.`, 2600); }
  return out;
}
function stab(n, dmg) {
  n.swingT = 0.35; const P = C.player;
  C.game.hurtPlayer(dmg, { x: n.x, z: n.z }); bloodSpray(P.x, (C.car ? C.car.y + 1 : P.y - 0.5), P.z);
}
function updateMugging(dt) {
  const m = mug, n = m.n, P = C.player, d = Math.hypot(P.x - n.x, P.z - n.z);
  m.t += dt; m.stabCd -= dt;
  if (!n.alive) return;
  // abort: you drove off, went inside or picked up stars during the approach
  if ((m.phase === 'approach' || m.phase === 'standoff') && (C.car || C.inside || C.world.wanted > 0)) { if (m.phase === 'standoff') { setChoices(false); setChip(null); } m.phase = 'fleeing'; m.t = 0; n.armed = false; say(n, 'Fuck this.', null, 1500); return; }
  if (m.phase === 'approach') {
    moveTo(n, P.x, P.z, d > 10 ? 3.4 : 2.4, dt);
    if (d < DC.MUG.reach + 0.4) { m.phase = 'standoff'; m.t = 0; n.armed = true; if (n.weaponMesh) n.weaponMesh.visible = true; n.speed = 0; say(n, 'junkieDemand', { n: m.demand }, 9000); setChoices(true); }
    else if (m.t > 30) end('lost-interest');
  } else if (m.phase === 'standoff') {
    face(n, P.x, P.z, dt); n.speed = 0; if (d > DC.MUG.reach + 0.2) moveTo(n, P.x, P.z, 2.2, dt);
    const left = Math.max(0, DC.MUG.standoff - m.t);
    setChip(`<b>🔪 Mugging</b> <span class="t">${left.toFixed(0)}s</span><br><i>“${esc(n.lastLine || '')}”</i><div class="bar"><i style="width:${(left / DC.MUG.standoff * 100).toFixed(0)}%"></i></div>`);
    if (d > 6.5) commit('run');                 // you just bolted
    else if (left <= 0) commit('timeout');
  } else if (m.phase === 'fight' || m.phase === 'chase') {
    const sp = m.phase === 'chase' ? DC.MUG.speed : d > 2 ? 4.6 : 0;
    if (d > DC.MUG.stabRange * 0.8) moveTo(n, P.x, P.z, sp, dt); else { n.speed = 0; face(n, P.x, P.z, dt); }
    if (d < DC.MUG.stabRange && m.stabCd <= 0 && !C.game.isDown()) { m.stabCd = DC.MUG.stabCd + Math.random() * 0.4; if (Math.random() < 0.72) stab(n, 9 + Math.random() * 6); else n.swingT = 0.35; }
    if (m.phase === 'chase') { m.chaseT += dt; if (d > DC.MUG.giveUp || (m.chaseT > DC.MUG.chaseTime && d > 9)) { say(n, 'junkieGiveUp', null, 2200); m.phase = 'fleeing'; m.t = 0; n.armed = false; n.hostile = false; stats.outcomes.escaped = (stats.outcomes.escaped || 0) + 1; toast('😮‍💨 Lost him.', 1600); } }
    if (C.game.isDown()) { m.phase = 'fleeing'; m.t = 0; n.hostile = false; }
    if (d > 90) end('gone');
  } else if (m.phase === 'fleeing') {
    const away = Math.atan2(n.x - P.x, n.z - P.z); moveTo(n, n.x + Math.sin(away) * 6, n.z + Math.cos(away) * 6, 5.2, dt);
    if (m.t > 9 || d > 60) end(m.outcome || 'fled');
  }
}
function end(why) {
  if (mug) { if (mug.phase === 'standoff') { setChoices(false); setChip(null); } const n = mug.n; mug.endedAs = why; stats.lastEnd = why; if (n.alive) removeNpc(n); else n.despawn = Math.min(n.despawn ?? 30, 30); mug = null; }
  director.active = fights.length ? 1 : 0;
}

// ---------- ambient fights ----------
function startFight(force) {
  if (budget() < 2) { stats.skippedBudget++; return null; }
  const P = C.player, yaw = P.yaw ?? 0, dist = force?.dist ?? 26 + Math.random() * 14, a = yaw + (Math.random() - 0.5) * 1.2;
  const cx = P.x - Math.sin(a) * dist, cz = P.z - Math.cos(a) * dist;
  const kind = DC.pickFight(Math.random, C.district), fa = kind.a, fb = kind.b === 'junkie' && kind.a === 'junkie' ? 'junkie' : kind.b === 'colonist' ? 'victim' : kind.b;
  const A1 = spawnNpc(fa, cx + 1, cz, { hp: 3.5, role: 'aggressor', fight: true }), B1 = spawnNpc(fb, cx - 1, cz, { hp: 3, role: 'victim', fight: true });
  giveWeapon(A1, kind.weapon); if (kind.weapon === 'knife' && A1.weaponMesh) A1.weaponMesh.visible = true;
  const f = { kind, a: A1, b: B1, t: 0, over: false, helpers: [] };
  if (kind.helpers) for (let i = 0; i < kind.helpers && budget() > 0; i++) { const h = spawnNpc('thug', cx + 2, cz + 1.5, { hp: 3, role: 'aggressor', fight: true }); f.helpers.push(h); }
  for (const n of [A1, B1, ...f.helpers]) {
    n.onHurt = () => { say(n, 'junkieHit', null, 1200); if (n.role === 'aggressor') n.hostile = true; };
    n.onDeath = how => { if (n.byPlayer && n.kind === 'thug') saltbloodHeat += 1; const heat = n.byPlayer ? DC.heatForFighter({ role: n.role, killed: true, witnessed: inColony(n.x, n.z) }) : null; if (heat) C.world.crime?.(heat.min, heat.why);
      if (n.byPlayer && n.role === 'aggressor') { C.game.progress.xp += 8; C.game.progress.credits += 10; C.game.save?.(); toast('🩸 Stepped in. The other guy owes you one. +10 cr', 2200); } };
  }
  say(A1, 'fightStart', null, 2600, '#ff8a3a');
  fights.push(f); stats.fights++; director.active = 1;
  return f;
}
function updateFight(f, dt) {
  f.t += dt; const crew = [f.a, ...f.helpers], P = C.player;
  for (const n of crew) {
    if (!n.alive) continue;
    // anyone who got hit by you turns on you
    const tgt = n.hostile ? { x: P.x, z: P.z, me: true } : f.b.alive ? f.b : null;
    if (!tgt) { const away = Math.atan2(n.x - P.x, n.z - P.z); moveTo(n, n.x + Math.sin(away) * 4, n.z + Math.cos(away) * 4, 2.2, dt); continue; }
    const d = Math.hypot(tgt.x - n.x, tgt.z - n.z);
    if (d > 1.4) moveTo(n, tgt.x + (n === f.a ? 0 : 0.8), tgt.z, tgt.me ? 4.2 : 2.6, dt); else { n.speed = 0; face(n, tgt.x, tgt.z, dt); }
    n.swingCd = (n.swingCd ?? 0.4) - dt;
    if (d < 1.7 && n.swingCd <= 0) {
      n.swingCd = 0.6 + Math.random() * 0.5; n.swingT = 0.35;
      if (tgt.me) { if (!C.game.isDown()) { C.game.hurtPlayer(f.kind.weapon === 'fists' ? 6 : 11, { x: n.x, z: n.z }); } }
      else if (Math.random() < 0.7) { const dmg = DC.swing(f.kind.weapon); f.b.hp -= dmg; bloodSpray(f.b.x, f.b.y + 1.4, f.b.z); f.b.x += Math.sin(-n.yaw) * 0.3; f.b.z += -Math.cos(n.yaw) * 0.3; if (Math.random() < 0.3) say(Math.random() < 0.5 ? n : f.b, 'fightMid', null, 1400, '#ff8a3a'); if (f.b.hp <= 0) { killNpc(f.b, 'npc'); say(n, 'fightEnd', null, 2400, '#ff8a3a'); } }
    }
  }
  // the victim backs off and throws the odd weak punch
  if (f.b.alive) { const a = f.a.alive ? f.a : crew.find(n => n.alive); if (a) { const d = Math.hypot(a.x - f.b.x, a.z - f.b.z); face(f.b, a.x, a.z, dt); if (d < 1.2) moveTo(f.b, f.b.x + (f.b.x - a.x), f.b.z + (f.b.z - a.z), 1.6, dt); else f.b.speed = 0; } else { const away = Math.atan2(f.b.x - P.x, f.b.z - P.z); moveTo(f.b, f.b.x + Math.sin(away) * 4, f.b.z + Math.cos(away) * 4, 4, dt); } }
  const anyHostile = crew.some(n => n.alive && n.hostile), dp = Math.hypot(f.a.x - P.x, f.a.z - P.z);
  if (!f.over && (!f.b.alive || crew.every(n => !n.alive))) { f.over = true; f.overT = 0; }
  if (f.over) f.overT += dt;
  if ((f.over && f.overT > 14 && !anyHostile) || dp > 140 || f.t > 75) endFight(f);
}
function endFight(f) {
  for (const n of [f.a, f.b, ...f.helpers]) { if (n.alive) removeNpc(n); else n.despawn = Math.min(n.despawn ?? 20, 20); }
  fights = fights.filter(o => o !== f); director.active = mug || fights.length ? 1 : 0;
}
// driving through people
function runOver(dt) {
  const car = C.car; if (!car || Math.abs(car.speed) < 8) return;
  for (const n of npcs) { if (!n.alive) continue; if (Math.hypot(n.x - car.x, n.z - car.z) < (car.spec?.r || 2.2) * 0.8 + 0.4) {
    n.byPlayer = true; const was = n.hostile; killNpc(n, 'car'); car.speed *= 0.85;
    if (!was && inColony(n.x, n.z)) C.world.crime?.(1, 'hit-and-run'); } }
}

// ---------- UI ----------
const CSS = `
#dangerChip { display: none; padding: 7px 10px; border-radius: 12px; background: rgba(40,6,8,0.78); border: 1px solid rgba(255,80,80,0.5); color: #fff; font-size: 0.78rem; line-height: 1.25; max-width: min(260px, 62vw); }
#dangerChip.on { display: block; } #dangerChip .t { float: right; color: #ff9a9a; font-weight: 800; } #dangerChip i { opacity: 0.92; }
#dangerChip .bar { height: 3px; border-radius: 2px; background: rgba(255,255,255,0.15); margin-top: 5px; } #dangerChip .bar i { display: block; height: 100%; background: #ff4a4a; border-radius: 2px; }
#dangerChoices { display: none; } #dangerChoices.on { display: contents; }
#dzEvChoices { display: none; } #dzEvChoices.on { display: contents; } #dzEvChoices button { background: rgba(60,40,10,0.82) !important; border-color: rgba(255,200,120,0.5) !important; font-weight: 700; max-width: 46vw; font-size: 0.8rem; line-height: 1.15; white-space: normal; }
#dangerChoices button { background: rgba(120,14,20,0.82) !important; border-color: rgba(255,120,120,0.55) !important; font-weight: 800; }
#dangerChoices #dzPay { background: rgba(20,90,50,0.85) !important; border-color: rgba(120,255,170,0.5) !important; }
body.danger-standoff #petBtn, body.danger-standoff #driveBtn, body.danger-standoff #radioBtn, body.danger-standoff #jumpBtn, body.danger-standoff #runBtn, body.danger-standoff #raceCtxBtn, body.danger-standoff #dzRedTape { display: none !important; }
`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function ensureUI() {
  if (ui && document.getElementById('dangerChip')) return ui;
  const st = document.createElement('style'); st.id = 'dangerCss'; st.textContent = CSS; document.head.appendChild(st);
  const chip = document.createElement('div'); chip.id = 'dangerChip'; document.getElementById('stackR')?.prepend(chip);
  const choices = document.createElement('div'); choices.id = 'dangerChoices';
  const mk = (id, fn) => { const b = document.createElement('button'); b.id = id; b.className = 'glass'; choices.appendChild(b); tapButton(b, fn); return b; };
  const pay = mk('dzPay', () => commit('pay')), fight = mk('dzFight', () => commit('fight')), run = mk('dzRun', () => commit('run')), talk = mk('dzTalk', () => commit('talk'));
  document.getElementById('surfBtns')?.prepend(choices);
  // Red Tape Run: a context button, only while you're driving at the Red Tape Flats start and nothing else is on
  const redTape = document.createElement('button'); redTape.id = 'dzRedTape'; redTape.className = 'glass'; redTape.textContent = '🏁 Red Tape Run'; redTape.style.display = 'none';
  tapButton(redTape, () => { if (pursuitStart('setpiece')) { stats.chases++; redTape.style.display = 'none'; } });
  document.getElementById('surfBtns')?.prepend(redTape);
  const menu = addMenuItem({ id: 'rmDanger', label: menuLabel(), onTap: () => { settings.on = !settings.on; saveSettings(); menu && (menu.textContent = menuLabel()); toast(settings.on ? '🔪 Street danger on. Watch your back.' : '😇 Street danger off. The streets are (unrealistically) safe.', 2400); if (!settings.on) clearAll(); } });
  window.addEventListener('keydown', e => {
    if (!mug || mug.phase !== 'standoff' || e.repeat) return; const k = { Digit1: 'pay', Digit2: 'fight', Digit3: 'run', Digit4: 'talk' }[e.code];
    if (k) { e.preventDefault(); e.stopImmediatePropagation(); commit(k); }
  }, true);
  // ambient event card: up to 3 dynamic buttons in the same context column (random-events.json choices)
  const evBox = document.createElement('div'); evBox.id = 'dzEvChoices'; document.getElementById('surfBtns')?.prepend(evBox);
  window.addEventListener('keydown', e => { if (!evBox.classList.contains('on') || e.repeat) return; const i = { Digit1: 0, Digit2: 1, Digit3: 2 }[e.code]; const b = evBox.children[i]; if (b) { e.preventDefault(); e.stopImmediatePropagation(); b.__pick?.(); } }, true);
  ui = { chip, choices, pay, fight, run, talk, menu, redTape, evBox };
  ambientInit({
    budget: () => budget(), mobile: () => isTouch(), player: () => C.player, driving: () => !!C.car, credits: () => C.game.progress.credits, progress: () => C.game.progress,
    save: () => C.game.save?.(), crime: (n, why) => C.world.crime?.(n, why), isDown: () => C.game.isDown(), inDuel: () => !!C.world.inDuel, toast,
    spawn: (kind, x, z, extra) => { const c = C.world.collide?.(x, z, 0.5); return spawnNpc(kind, c ? c.x : x, c ? c.z : z, extra); }, weapon: giveWeapon, remove: removeNpc,
    kill: (n, how) => { n.byPlayer = true; killNpc(n, how); }, moveTo: (n, x, z, sp, dt) => moveTo(n, x, z, sp, dt),
    say: (n, line, ms, color) => say(n, line, null, ms, color), hurt: (d, n) => { C.game.hurtPlayer(d, { x: n.x, z: n.z }); bloodSpray(C.player.x, C.player.y - 0.5, C.player.z); },
    chip: html => setChip(html), card: (title, line, opts, pick) => setEvCard(title, line, opts, pick)
  });
  return ui;
}
const menuLabel = () => settings.on ? '🔪 Street danger: on' : '😇 Street danger: off';

function clearAll() {
  if (mug) end('cleared'); for (const f of [...fights]) endFight(f); ambientClear();
  for (const n of [...npcs]) removeNpc(n); for (const s of splats) root?.remove(s.m); splats = [];
  if (ui) { setChoices(false); setChip(null); }
  pursuitReset(C, !!C);
}

// ---------- the hook ----------
// ctx: { scene, camera, height(x,z), player, car (driving vehicle or null), rover, game, world, name, inside, dog }
export function dangerTick(dt, ctx) {
  dt = Math.min(dt, 0.1); time += dt;
  C = ctx; lastTick = performance.now();
  if (!root || root.parent !== ctx.scene || planet !== ctx.name) { // new planet / new surface session
    root = new THREE.Group(); root.name = 'danger'; ctx.scene.add(root); planet = ctx.name; npcs = []; splats = []; mug = null; fights = []; director = DC.createDirector(); pursuitReset(ctx, true);
  }
  if (ctx.name === 'Mars') ambientLoad();
  ensureUI(); setNpcBudget(() => budget()); pursuitOnGangKill(k => { if (k !== 'junkie') saltbloodHeat += 1.5; });
  patchWorld(ctx.world, [() => npcs.map(n => n.hittable), () => pursuitHittables()]);
  const P = ctx.player, d = ctx.dog; C.dogNear = !!d && Math.hypot(d.x - P.x, d.z - P.z) < 8;
  const col = ctx.world.colony; C.district = DC.districtAt(P.x, P.z, col, { city: ctx.name === 'Mars' ? MARS_CITY : null, driving: !!ctx.car, speed: ctx.car ? Math.abs(ctx.car.speed) : 0 });
  saltbloodHeat = Math.max(0, saltbloodHeat - dt / 300);
  const down = ctx.game.isDown();
  // a legal duel is on (world.inDuel): nobody else jumps in. Muggers back off, street fights break up, chases peel away.
  const duel = !!ctx.world.inDuel;
  if (duel && (mug || fights.length || ambientActive() || pursuitDebug.state?.active)) { stats.duelCleared = (stats.duelCleared || 0) + 1; if (mug) end('duel'); ambientClear(); for (const f of [...fights]) endFight(f); if (pursuitDebug.state?.active) pursuitReset(ctx); }
  if (down && mug && mug.phase !== 'fleeing') { if (mug.phase === 'standoff') { setChoices(false); setChip(null); } mug.phase = 'fleeing'; mug.t = 0; mug.n.hostile = false; }
  // the director
  if (settings.on && col) {
    const racing = !!window.__race?.state, info = ctx.game.info;
    const s = { district: C.district, hour: DC.marsHour(), onFoot: !ctx.car, driving: !!ctx.car, speed: ctx.car ? Math.abs(ctx.car.speed) : 0, wanted: ctx.world.wanted, inside: !!ctx.inside, busy: down || racing || !!info.combat || ctx.intro > 0, inDuel: duel, questActive: !!info.quest, saltbloodHeat };
    if (ctx.name === 'Mars') { s.hp = info.hp ?? 100; s.ambientReady = ambientAny(s, director.t); C.lastSituation = s; }
    if (ambientActive()) director.active = 1; else if (!mug && !fights.length) director.active = 0;
    const type = director.tick(dt, s);
    if (type === 'mugging') startMugging(); else if (type === 'fight') startFight();
    else if (type === 'gangChase') startChase();
    else if (type === 'ambient') ambientStart(s, director.t);
  }
  // Red Tape Run start: driving within 30 m of the Flats hub, no chase, no standoff
  if (ui?.redTape) { const st = setPieceStart(), chase = pursuitDebug.state; const show = !!(settings.on && !duel && st && ctx.car && !chase?.active && !(mug && mug.phase === 'standoff') && Math.hypot(P.x - st.x, P.z - st.z) < 30);
    if ((ui.redTape.style.display !== 'none') !== show) ui.redTape.style.display = show ? '' : 'none'; }
  if (mug) updateMugging(dt);
  for (const f of [...fights]) updateFight(f, dt);
  ambientTick(dt);
  runOver(dt);
  for (const n of [...npcs]) { animate(n, dt); if (!n.alive && n.despawn !== undefined && (n.despawn -= dt) <= 0) removeNpc(n); }
  for (const s of [...splats]) { s.t += dt;
    if (s.drop) { const v = s.m.userData.v; v.y -= 9 * dt; s.m.position.addScaledVector(v, dt); if ((s.m.userData.life -= dt) <= 0 || s.m.position.y < ctx.height(s.m.position.x, s.m.position.z)) { root.remove(s.m); splats = splats.filter(o => o !== s); } }
    else if (s.m.scale.x < s.r) s.m.scale.setScalar(Math.min(s.r, 0.1 + s.t * 0.5)); }
  pursuitTick(dt, ctx, settings.on);
}

function startChase(kind) {
  kind = kind || (C.district === 'rough' || C.district === 'highway' ? 'gang' : 'junkie');
  const ok = pursuitStart(kind); if (ok) stats.chases++; else stats.skippedBudget++; return ok;
}

// leaving the surface: hide our HUD and drop encounters
setInterval(() => {
  if (!lastTick || performance.now() - lastTick < 700 || app()?.state?.onSurface) return;
  if (mug || fights.length || npcs.length) clearAll(); else pursuitReset(C);
  if (ui) { setChoices(false); setChip(null); }
}, 500);

// ---------- test / debug hooks ----------
window.__danger = {
  get state() { return { on: settings.on, district: C?.district, hour: DC.marsHour(), mug: mug ? { phase: mug.phase, demand: mug.demand, outcome: mug.outcome, hp: mug.n.hp, alive: mug.n.alive, d: C ? Math.hypot(C.player.x - mug.n.x, C.player.z - mug.n.z) : null, line: mug.n.lastLine } : null,
    fights: fights.map(f => ({ kind: f.kind.id, over: f.over, a: f.a.alive, b: f.b.alive, d: C ? Math.hypot(C.player.x - f.a.x, C.player.z - f.a.z) : null })), npcs: npcs.length, splats: splats.length, stats, ui: ui ? { chip: ui.chip.classList.contains('on'), choices: ui.choices.classList.contains('on') } : null }; },
  force(type, o) { if (!C) return false; director.force(type); return type === 'mugging' ? !!startMugging(o) : type === 'fight' ? !!startFight(o) : type === 'gangChase' ? !!startChase(o?.kind) : type === 'setpiece' ? !!pursuitStart('setpiece', o) : type === 'ambient' ? !!ambientStart(C.lastSituation || { district: C.district, wanted: C.world.wanted }, director.t, o?.id) : false; },
  budget: () => ({ room: budget(), world: C?.player ? DC.nearCount(C.world?.debug?.people?.(), C.player.x, C.player.z) + DC.nearCount(C.world?.securityList?.(), C.player.x, C.player.z) : 0, worldAll: C?.world?.debug?.people?.().length ?? 0, ours: npcs.filter(n => n.alive).length, chase: pursuitNpcCount(), cap: isTouch() ? DC.NPC_CAP.phone : DC.NPC_CAP.desktop }),
  get saltbloodHeat() { return saltbloodHeat; }, setSaltbloodHeat(v) { saltbloodHeat = v; },
  ambient: ambientDebug, ambientChoose: id => { const b = ui?.evBox?.querySelector(`[data-choice="${id}"]`); b?.__pick?.(); return !!b; },
  choose: c => commit(c), clear: clearAll, setEnabled(on) { settings.on = !!on; saveSettings(); if (ui?.menu) ui.menu.textContent = menuLabel(); if (!on) clearAll(); },
  mugFastForward(sec = 1) { if (mug?.phase !== 'standoff') return false; mug.t = Math.max(mug.t, DC.MUG.standoff - sec); return true; }, // tests: swiftshader under load runs game time slowly
  setClock: h => DC.setClock(h), director: () => ({ t: director.t, grace: director.grace, log: director.log.slice(-10), active: director.active }), skipGrace() { director.grace = 0; director.last = -1e9; director.since = {}; },
  hitMugger(dmg = 1.2) { if (mug) hurtNpc(mug.n, dmg, 'shot', C.player); return mug ? mug.n.hp : null; },
  muggerFront(dist = 3, side = 0.35) { if (!mug || !C) return; const P = C.player, y = P.faceYaw ?? P.yaw ?? 0; mug.n.x = P.x - Math.sin(y + side) * dist; mug.n.z = P.z - Math.cos(y + side) * dist; },
  muggerTo(dist) { if (!mug || !C) return; const P = C.player, a = Math.atan2(mug.n.x - P.x, mug.n.z - P.z); mug.n.x = P.x + Math.sin(a) * dist; mug.n.z = P.z + Math.cos(a) * dist; },
  npcs: () => npcs.map(n => ({ kind: n.kind, role: n.role, x: n.x, y: n.y, z: n.z, alive: n.alive, hostile: n.hostile, hp: n.hp })),
  pursuit: pursuitDebug
};
