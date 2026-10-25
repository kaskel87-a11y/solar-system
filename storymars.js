// v7.5 Mars story chains (ROADMAP 4 / Chief of Staff item 3): the deferred Rook, Vesna, Kestrel, Ines and Rusk jobs from the
// story pack (data/story via missions-data.js). Dialogue, rewards and prerequisites come from the pack through game.storyToQuest;
// this file only re-maps each job's steps onto what v7.4 can run, adds human wave types (goon, enforcer, guard, squad, sdrone)
// through game.registerAgentType, and drives the step types the core doesn't know (hold, choice, tail, escort2, cleanexit,
// rrace, build, runtrack) from its own tick. Core touch points: one import + initStoryMars(window.__app) in index.html and the
// registerAgentType hook in game.js. Import URLs must match the core's ?v= exactly (shared module instances).
import * as THREE from 'three';
import * as GM from './game.js?v=7.5.1';
import * as W from './world.js?v=7.5.1';
import { tap } from './planets/hooks.js?v=7.5.1';
import { STORY } from './missions-data.js?v=7.5.1';

// ---------- core shims: prefer a real core API when Grok Bot adds one, else the v7.4 debug/test surface ----------
const nextStep = g => (typeof g.advanceStep === 'function' ? g.advanceStep() : g.debug.advance());
function failJob(app, g, why) {
  if (typeof g.failStep === 'function') return g.failStep(why);
  const q = g.info?.quest; g.abandon(); app.toast?.(`❌ ${q ? q.title + ': ' : ''}${why} Talk to them again to retry.`, 4200);
}
const spawnNear = (g, type, dist, ang) => (typeof g.spawnWave === 'function' ? g.spawnWave(type, dist, ang) : g.debug.spawn(type, dist, ang, true));
const hostiles = g => g.debug.agents().filter(a => a.src === 'quest' || a.src === 'debug' || a.src === 'minion');

// ---------- human wave types (M-rated GTA tone: guns, no gore beyond the core FX) ----------
const geo = {}, mats = {};
function res() {
  if (geo.torso) return;
  geo.torso = new THREE.BoxGeometry(0.56, 0.72, 0.32).translate(0, 1.32, 0);
  geo.head = new THREE.SphereGeometry(0.17, 12, 10).translate(0, 1.88, 0);
  geo.leg = new THREE.BoxGeometry(0.2, 0.9, 0.22).translate(0, -0.45, 0); // pivot at the hip
  geo.arm = new THREE.BoxGeometry(0.15, 0.62, 0.17).translate(0, -0.3, 0);
  geo.gun = new THREE.BoxGeometry(0.09, 0.13, 0.62);
  geo.visor = new THREE.BoxGeometry(0.3, 0.08, 0.06);
  geo.helmet = new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.9, 0);
  geo.drone = new THREE.SphereGeometry(0.42, 14, 10); geo.rotor = new THREE.CylinderGeometry(0.34, 0.34, 0.04, 14); geo.eye = new THREE.SphereGeometry(0.12, 10, 8);
  const M = (c, o = {}) => Object.assign(new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o }), { userData: { shared: true } });
  Object.assign(mats, { skin: M(0xc08a64), skin2: M(0x6b4430), pants: M(0x2b2b30), gun: M(0x1a1a1a, { metalness: 0.6, roughness: 0.4 }),
    goon: M(0x8a2a1a), enforcer: M(0x111114), guard: M(0x3e4f66), squad: M(0x1b2433), suit: M(0x5a5f6a),
    glowR: Object.assign(new THREE.MeshBasicMaterial({ color: 0xff3a2a }), { userData: { shared: true } }), glowB: Object.assign(new THREE.MeshBasicMaterial({ color: 0x5ab0ff }), { userData: { shared: true } }),
    drone: M(0x2a3242, { metalness: 0.7, roughness: 0.35 }) });
}
// faces -z (game.js turns agents with atan2(-dx, -dz))
export function buildHuman(kind) {
  res();
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const jacket = mats[kind] || mats.goon, mk = (G, m) => new THREE.Mesh(G, m);
  body.add(mk(geo.torso, jacket), mk(geo.head, kind === 'enforcer' || kind === 'goon' ? mats.skin2 : mats.skin));
  if (kind === 'squad' || kind === 'guard') { body.add(mk(geo.helmet, jacket)); const v = mk(geo.visor, mats.glowB); v.position.set(0, 1.9, -0.17); body.add(v); }
  if (kind === 'goon') { const band = mk(geo.visor, mats.glowR); band.position.set(0, 1.93, -0.16); body.add(band); }
  const legs = [];
  for (const x of [-0.14, 0.14]) { const l = mk(geo.leg, mats.pants); l.position.set(x, 0.92, 0); body.add(l); legs.push(l); }
  for (const x of [-0.36, 0.36]) { const a = mk(geo.arm, jacket); a.position.set(x, 1.64, 0); a.rotation.x = -1.2; body.add(a); }
  if (kind !== 'accountant') { const gun = mk(geo.gun, mats.gun); gun.position.set(0.3, 1.45, -0.55); body.add(gun); }
  return { group: g, body, legs, kind: 'human' };
}
function buildSecDrone() {
  res();
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  body.add(new THREE.Mesh(geo.drone, mats.drone)); const e = new THREE.Mesh(geo.eye, mats.glowR); e.position.set(0, 0, -0.38); body.add(e);
  const wings = []; for (const s of [-1, 1]) { const r = new THREE.Mesh(geo.rotor, mats.gun); r.position.set(s * 0.55, 0.25, 0); body.add(r); wings.push(r); }
  return { group: g, body, wings, kind: 'sdrone' };
}
export const HUMAN_TYPES = {
  goon: { name: 'Saltblood goon', hp: 6, speed: 6.5, hover: 0, r: 0.8, cy: 1.15, attack: 'shoot', dmg: 6, burst: 2, cd: 2.2, range: 32, keep: 13, xp: 18, credits: 15, flank: true, human: true },
  enforcer: { name: 'Sable enforcer', hp: 18, armor: 0.25, speed: 5.5, hover: 0, r: 0.95, cy: 1.3, scale: 1.18, attack: 'shoot', dmg: 10, burst: 3, cd: 2.3, range: 36, keep: 10, xp: 45, credits: 40, human: true },
  guard: { name: 'Bank guard', hp: 8, armor: 0.15, speed: 6, hover: 0, r: 0.8, cy: 1.15, attack: 'shoot', dmg: 7, burst: 3, cd: 2.4, range: 38, keep: 14, xp: 22, credits: 18, flank: true, human: true },
  squad: { name: 'Security squad', hp: 12, armor: 0.35, speed: 6.5, hover: 0, r: 0.85, cy: 1.15, attack: 'shoot', dmg: 9, burst: 3, cd: 2.1, range: 40, keep: 12, xp: 35, credits: 25, flank: true, human: true },
  sdrone: { name: 'Security drone', hp: 4, speed: 9, hover: 4, r: 1.0, cy: 0, attack: 'shoot', dmg: 6, burst: 2, cd: 2.4, range: 34, keep: 12, xp: 14, credits: 10 }
};
for (const [t, T] of Object.entries(HUMAN_TYPES)) GM.registerAgentType?.(t, T, t === 'sdrone' ? buildSecDrone : () => buildHuman(t));

// ---------- the missions: pack dialogue/rewards/prereqs + steps the engine can run ----------
const DOOR = [-30, -27]; // Velvet Airlock front door (+z face of the club block)
const MOON_LOOP = [[50, -40], [120, -20], [150, 50], [100, 120], [20, 100], [0, 35]];
const STEPS = {
  'rook-03-case': { note: 'Bank interior isn\u2019t built yet: you case First Junction Trust\u2019s lot from outside.', steps: [
    { type: 'goto', at: [-4, -40], r: 5, text: 'Walk up to First Junction Trust. Look poor.' },
    { type: 'collect', at: [-4, -40], spread: 7, n: 3, item: 'camera', nowanted: 'fail', text: 'Snap the vault door, cameras and guard rota' },
    { type: 'goto', at: [0, -45], r: 2.5, item: 'keycard', nowanted: 'fail', text: 'Lift the guard\u2019s keycard (from behind)' },
    { type: 'cleanexit', at: [36, -26], r: 4, text: 'Back to Rook without heat' }] },
  'rook-04-crew': { steps: [
    { type: 'choice', id: 'quality', prompt: 'Hire fees come out of your cut. Pros cost more but fail less in the vault.', text: 'Pick your crew: pros or cheap',
      options: [{ id: 'pros', label: 'Hire pros (\u2212900 cr)', cost: 900, line: 'Rook: Expensive. Good. Expensive is quiet.' }, { id: 'cheap', label: 'Hire cheap (\u2212200 cr)', cost: 200, line: 'Rook: Cheap. We\u2019ll see.' }] },
    { type: 'choice', id: 'driller', prompt: 'Who drills the vault?', text: 'Hire a driller',
      options: [{ id: 'ozzie', label: 'Ozzie (pricey, solid)', line: 'Ozzie: I bring the drill, you bring the money. Nobody touches my drill.' }, { id: 'drunk', label: 'The cantina drunk (cheap)', line: 'Drunk: I drilled a vault once. Or a wall. Something drilled.' }] },
    { type: 'choice', id: 'hacker', prompt: 'Who gets you past the vault locks?', text: 'Hire inside help',
      options: [{ id: 'penny', label: 'Penny Okoro (vault engineer)', line: 'Penny: I designed those locks. I hated those locks.' }, { id: 'halo', label: 'Halo (DJ, fence)', line: 'Halo: I\u2019ll spin the alarms into a remix. You\u2019re welcome.' }] },
    { type: 'choice', id: 'wheel', prompt: 'Who drives the getaway?', text: 'Hire a wheelman',
      options: [{ id: 'kestrel', label: 'Kestrel', line: 'Kestrel: I don\u2019t brake. Hold on to something.' }, { id: 'self', label: 'Drive it yourself', line: 'Rook: Your neck. Literally.' }] },
    { type: 'goto', at: [-280, -40], r: 14, text: 'Bring the crew to the Red Tape Flats safehouse' }] },
  'vesna-04-cook': { steps: [
    { type: 'goto', a: -60, d: 380, r: 14, text: 'Reach the pumping station' },
    { type: 'defeat', a: -60, d: 380, wave: ['goon', 'goon', 'goon', 'goon'], text: 'Clear out the Saltblood squatters' },
    { type: 'hold', a: -60, d: 380, r: 12, seconds: 40, wave: ['goon', 'goon'], text: 'Hold while Vesna fires up the cooker' },
    { type: 'choice', id: 'cook', fromPack: true, text: 'One cook surrendered. Decide.' }] },
  'kestrel-03-fix': { note: 'One rival (race.js) stands in for the Tycho field.', steps: [
    { type: 'choice', id: 'fix', fromPack: true, text: 'Throw it or win it?' },
    { type: 'take', text: 'Grab a fast vehicle (try a hover bike)' },
    { type: 'rrace', pts: MOON_LOOP, par: 46, rival: 'The Ceres kid', text: 'Race the Tycho field' },
    { type: 'defeat', at: [0, 35], wave: ['goon', 'goon', 'goon'], only: 'fix=win', text: 'Tycho goons want their money back' },
    { type: 'clean', text: 'Lose whoever\u2019s mad at you' }] },
  'kestrel-04-track': { steps: [
    { type: 'build', gates: 6, prop: 'ramp', text: 'Build a track: 6+ gates and a ramp (\u2630 \u2192 Race \u2192 Build)' },
    { type: 'runtrack', text: 'Run your own track once' }] },
  'ines-01-door': { steps: [
    { type: 'goto', at: DOOR, r: 5, text: 'Get to the Velvet Airlock' },
    { type: 'defeat', at: [-30, -22], wave: ['goon', 'goon', 'goon'], text: 'Help Brick clear the door' },
    { type: 'enter', building: 'Velvet Airlock', text: 'Go inside to the VIP room' }] },
  'ines-02-pour': { steps: [
    { type: 'enter', building: 'Velvet Airlock', text: 'Talk to the bartender' },
    { type: 'tail', path: [[-28, -22], [-8, -48], [-58, -54], [-64, -16], [-46, -9]], speed: 5, text: 'Tail the supply hauler. Not too close.' },
    { type: 'goto', at: [-50, -24], r: 4, vehicle: 'stolen', text: 'Steal the tainted hauler' },
    { type: 'goto', a: 120, d: 300, r: 12, vehicle: 'stolen', text: 'Dump it in the canyon' }] },
  'ines-03-guest': { steps: [
    { type: 'enter', building: 'Velvet Airlock', text: 'Collect the accountant in VIP' },
    { type: 'escort2', at: [-38, 10], r: 7, wave: ['goon', 'goon', 'sdrone'], text: 'Walk him to the pad' },
    { type: 'take', text: 'Fly him out (the shuttle\u2019s on the pad)' }] },
  'ines-04-lastcall': { note: 'Combat can\u2019t happen indoors in v7.4, so you hold the club door from outside.', steps: [
    { type: 'enter', building: 'Velvet Airlock', text: 'Get inside before the lockdown' },
    { type: 'hold', at: [-30, -22], r: 14, seconds: 90, wave: ['goon', 'goon', 'goon', 'enforcer'], text: 'Step out and defend the club door' },
    { type: 'defeat', at: [-30, -20], wave: ['enforcer'], text: 'Take down Mr. Sable\u2019s enforcer' },
    { type: 'choice', id: 'nephew', fromPack: true, text: 'The enforcer begs. Decide.' }] },
  'rusk-02-sweep': { steps: [
    { type: 'goto', at: [-262, -64], r: 14, text: 'Ride out to the Saltblood stash in Red Tape Flats' },
    { type: 'defeat', at: [-262, -64], wave: ['goon', 'goon', 'goon', 'goon', 'enforcer'], text: 'Win the firefight' },
    { type: 'collect', at: [-262, -64], spread: 8, n: 3, item: 'contraband', text: 'Grab the dust before the patrol does' }] },
  'rusk-03-ia': { requires: ['rusk-02-sweep', 'rook-04-crew'], note: 'Needs rook-04 instead of the deferred rook-05.', steps: [
    { type: 'goto', at: [6, -21], r: 4, text: 'Pick Rusk up at the post' },
    { type: 'take', text: 'Steal a ride' },
    { type: 'goto', at: [320, 80], r: 14, wanted: 4, vehicle: 'stolen', text: 'Outrun the IA squad to Helios Heights' },
    { type: 'choice', id: 'fate', fromPack: true, prompt: 'IA wants Rusk. His name\u2019s all over the payoff books. What do you do?', text: 'Decide Rusk\u2019s fate' }] }
};
// what each choice option does beyond setting its flag
const EFFECTS = {
  'kestrel-03-fix:throw': { onDone: { credits: 800 } },
  'rusk-03-ia:betray': { run: ({ world }) => world?.setWanted?.(0, 'IA deal') },
  'rusk-03-ia:execute': { run: ({ world }) => world?.crime?.(2, 'left a deputy to die') },
  'vesna-04-cook:execute': { run: ({ world }) => world?.crime?.(1, 'executed a prisoner') }
};
export const DEFERRED = {
  'rook-05-withdrawal': 'Set on Ceres (Occator Exchange): needs the Ceres hub, interplanetary travel step, Exchange vault interior and Tether Hopper. rusk-03-ia now unlocks off rook-04-crew instead.'
};
export const SHIPPED = Object.keys(STEPS);

function buildQuests(story) {
  const out = [];
  for (const id of SHIPPED) {
    const m = story.missions.find(x => x.id === id); if (!m) continue;
    const q = GM.storyToQuest({ ...m, world: m.world.includes('Moon') && !m.world.includes('Mars') ? 'Moon' : 'Mars' });
    const def = STEPS[id];
    q.steps = def.steps.map(s => {
      const c = { ...s };
      if (c.type === 'choice' && c.fromPack && m.choice) { c.prompt ||= m.choice.prompt; c.options = m.choice.options.map(o => ({ id: o.id, label: o.label, line: o.line })); }
      return c;
    });
    if (def.requires) q.requires = def.requires;
    q.storymars = true; q.note = def.note || '';
    out.push(q);
  }
  return out;
}
export const QUESTS = buildQuests(STORY);
for (const q of QUESTS) { GM.registerMission(q); const i = GM.STORY_DEFERRED.indexOf(q.id); if (i >= 0) GM.STORY_DEFERRED.splice(i, 1); }

// ---------- UI: a bottom sheet for choices / prompts (transient; the centre stays clear) ----------
let sheet = null;
function ensureSheet() {
  if (sheet) return sheet;
  const css = document.createElement('style'); css.id = 'smCss';
  css.textContent = `#smSheet{position:fixed;left:0;right:0;bottom:0;z-index:16;display:none;padding:12px calc(14px + var(--sar,0px)) calc(14px + var(--sab,0px)) calc(14px + var(--sal,0px));
background:rgba(4,6,16,.94);color:#fff;border-top:1px solid rgba(255,255,255,.25);max-height:52vh;overflow-y:auto;box-sizing:border-box;font-size:.9rem;line-height:1.35}
#smSheet .wrap{max-width:560px;margin:0 auto}#smSheet .who{font-weight:800;color:#ffd25a;font-size:.78rem;letter-spacing:.04em;text-transform:uppercase}
#smSheet .p{margin:4px 0 10px}#smSheet .opts{display:flex;flex-direction:column;gap:8px}
#smSheet button{min-height:44px;padding:8px 12px;border-radius:10px;font-weight:700;text-align:left;touch-action:manipulation;background:#111;color:#fff;border:1px solid rgba(255,255,255,.55)}
#smSheet button:disabled{color:#b4b4b4;border-style:dashed;border-color:#6b6b6b}`;
  document.head.appendChild(css);
  sheet = document.createElement('div'); sheet.id = 'smSheet'; sheet.innerHTML = '<div class="wrap"><div class="who"></div><div class="p"></div><div class="opts"></div></div>';
  document.body.appendChild(sheet); return sheet;
}
function openSheet(who, text, buttons) {
  const el = ensureSheet(); el.querySelector('.who').textContent = who; el.querySelector('.p').textContent = text;
  const box = el.querySelector('.opts'); box.innerHTML = '';
  for (const b of buttons) { const btn = document.createElement('button'); btn.textContent = b.label; btn.dataset.opt = b.id; btn.disabled = !!b.disabled; tap(btn, () => { if (!btn.disabled) b.on(); }); box.appendChild(btn); }
  el.style.display = 'block';
}
const closeSheet = () => { if (sheet) sheet.style.display = 'none'; };

// ---------- the step runner ----------
const S = { key: null, t: 0, spawnT: 0, k: 0, last: 0, tail: null, esc: null, seen: 0, lost: 0, raced: false, track: null, sheetFor: null };
const flagKey = (qid, cid, opt) => `story:${qid}:${cid}=${opt}`;
const chose = (g, qid, cond) => { const [cid, opt] = cond.split('='); return g.flag(flagKey(qid, cid, opt)); };
function cleanup(app) {
  closeSheet(); S.sheetFor = null;
  if (S.tail) { S.tail.group.parent?.remove(S.tail.group); S.tail = null; }
  if (S.esc) { S.esc.group.parent?.remove(S.esc.group); S.esc = null; }
}
function setText(s, extra) { s._base ??= s.text; s.text = extra ? `${s._base} ${extra}` : s._base; }
const groundY = app => (app.surface.info?.y ?? 1.7) - 1.7;

function startStep(app, g, q, s) {
  cleanup(app); S.t = 0; S.spawnT = 2; S.k = 0; S.seen = 0; S.lost = 0; S.raced = false;
  if (s._base) s.text = s._base;
  if (s.type === 'tail') {
    const c = W.buildVehicle('hauler'); const scene = app.surface.scene, p = s.path.map(pt => app.surface.world.colonyAt(pt));
    c.group.position.set(p[0].x, groundY(app), p[0].z); scene.add(c.group); S.tail = { group: c.group, pts: p, i: 1 };
  }
  if (s.type === 'escort2') {
    const h = buildHuman('accountant'); const i = app.surface.info; h.group.position.set(i.x + 1.5, groundY(app), i.z + 1.5); app.surface.scene.add(h.group);
    S.esc = { ...h, hp: 100, x: i.x + 1.5, z: i.z + 1.5, spawned: false, phase: 0 };
  }
}
function choiceSheet(app, g, q, s) {
  const def = GM.QUESTS.find(x => x.id === q.id), credits = g.progress.credits;
  openSheet(def?.contact || 'Choice', s.prompt || s.text, s.options.map(o => ({ id: o.id, label: o.label, disabled: o.cost && credits < o.cost, on: () => {
    if (o.cost && !g.spend(o.cost)) return;
    g.setFlag(flagKey(q.id, s.id, o.id)); EFFECTS[`${q.id}:${o.id}`]?.run?.({ app, g, world: app.surface.world });
    closeSheet(); S.sheetFor = null; if (o.line) app.toast?.(`💬 ${o.line}`, 3600); nextStep(g);
  } })));
  S.sheetFor = S.key;
  if (s.options.every(o => o.cost && credits < o.cost)) { closeSheet(); failJob(app, g, `Can\u2019t afford the fees (${Math.min(...s.options.map(o => o.cost))} cr).`); }
}

// ---- v7.5 contraband barter (Marsmania's SSX.contraband API), fully guarded: nothing runs until window.SSX.contraband
// exists, so this ships before that code lands. Offers are the Ozzie / Rusk / Ines / Vesna / Rook rows of Steve's
// solar-system-story/mars-city/barter.json, copied verbatim (do not edit here; re-copy when the file changes).
// Marsmania loads barter.json itself, so when an offer is already registered we only ATTACH our story handler
// (unlock a job) and never re-register or re-apply its gives. We register an offer ourselves only if it is missing,
// and then we apply the engine-side give (weapon/ammo/wanted_clear/venue_access) too. Items stay Marsmania's.
export const BARTER = [{"id":"ozzie-iron-t1-breacher","npc":"Ozzie","venue":"Ozzie's Iron (back counter)","district":"red_tape_flats","location":[16,-38],"tier":1,"wants":[{"item":"glow_dust","qty":2}],"gives":{"type":"weapon","weaponId":"shotgun","ammo":{"ammoId":"shells","qty":12}},"cooldownSec":600,"rep":{"factions":[{"faction":"ozzie","min":0}]},"risk":{"bust_chance":0.03,"wanted_on_bust":1,"wanted_on_trade":0},"lines":{"offer":"Ozzie: Tier 1. No receipts, no serials.","accept":"Ozzie: Keep it pointed at strangers.","decline":"Ozzie: Then stop fogging my glass.","caught":"Ozzie: ColSec at the door. You never bought anything here."},"repeatable":true},{"id":"ozzie-iron-t2-viper","npc":"Ozzie","venue":"Ozzie's Iron (back counter)","district":"red_tape_flats","location":[16,-38],"tier":2,"wants":[{"item":"glow_dust","qty":3},{"item":"salvage","qty":4}],"gives":{"type":"weapon","weaponId":"smg","ammo":{"ammoId":"rounds","qty":60}},"cooldownSec":900,"rep":{"factions":[{"faction":"ozzie","min":15}]},"risk":{"bust_chance":0.05,"wanted_on_bust":1,"wanted_on_trade":0},"lines":{"offer":"Ozzie: Tier 2. No receipts, no serials.","accept":"Ozzie: Keep it pointed at strangers.","decline":"Ozzie: Then stop fogging my glass.","caught":"Ozzie: ColSec at the door. You never bought anything here."},"repeatable":true},{"id":"ozzie-iron-t3-railrifle","npc":"Ozzie","venue":"Ozzie's Iron (back counter)","district":"red_tape_flats","location":[16,-38],"tier":3,"wants":[{"item":"glow_dust_brick","qty":1}],"gives":{"type":"weapon","weaponId":"railrifle","ammo":{"ammoId":"slugs","qty":6}},"cooldownSec":1800,"rep":{"factions":[{"faction":"ozzie","min":35}],"missions_done":["ozzie-01-testfire"]},"risk":{"bust_chance":0.08,"wanted_on_bust":2,"wanted_on_trade":0},"lines":{"offer":"Ozzie: Tier 3. No receipts, no serials.","accept":"Ozzie: Keep it pointed at strangers.","decline":"Ozzie: Then stop fogging my glass.","caught":"Ozzie: ColSec at the door. You never bought anything here."},"repeatable":true},{"id":"ozzie-iron-t4-launcher","npc":"Ozzie","venue":"Ozzie's Iron (back counter)","district":"red_tape_flats","location":[16,-38],"tier":4,"wants":[{"item":"glow_dust_brick","qty":1},{"item":"ledger_chip","qty":1}],"gives":{"type":"weapon","weaponId":"launcher","ammo":{"ammoId":"grenades","qty":4}},"cooldownSec":3600,"rep":{"factions":[{"faction":"ozzie","min":60}],"missions_done":["ozzie-02-hotiron"]},"risk":{"bust_chance":0.12,"wanted_on_bust":2,"wanted_on_trade":0},"lines":{"offer":"Ozzie: Tier 4. No receipts, no serials.","accept":"Ozzie: Keep it pointed at strangers.","decline":"Ozzie: Then stop fogging my glass.","caught":"Ozzie: ColSec at the door. You never bought anything here."},"repeatable":true},{"id":"ozzie-iron-ammo-bulk","npc":"Ozzie","venue":"Ozzie's Iron (back counter)","district":"red_tape_flats","location":[16,-38],"tier":1,"wants":[{"item":"salvage","qty":6}],"gives":{"type":"ammo_bundle","ammo":[{"ammoId":"shells","qty":12},{"ammoId":"rounds","qty":60}],"onlyOwned":true},"cooldownSec":300,"rep":{"factions":[{"faction":"ozzie","min":5}]},"risk":{"bust_chance":0.0,"wanted_on_bust":0,"wanted_on_trade":0},"lines":{"offer":"Ozzie: Scrap for brass. Fair trade, for once.","accept":"Ozzie: Loaded. Go be loud somewhere else.","decline":"Ozzie: Brass costs, friend.","caught":"Ozzie: Not today. Badge outside."},"repeatable":true},{"id":"rusk-wipe-1","npc":"Deputy Rusk","venue":"RUSK TAKES wall","district":"red_tape_flats","location":[-270,-24],"wants":[{"item":"glow_dust","qty":2}],"gives":{"type":"wanted_clear","stars":1},"requires":{"wanted_min":1},"cooldownSec":600,"rep":{"factions":[{"faction":"colsec_dirty","min":0}]},"risk":{"bust_chance":0.1,"wanted_on_bust":1,"wanted_on_trade":0,"note":"On bust Rusk keeps the product and adds a star."},"lines":{"offer":"Rusk: One star? Two baggies and the paperwork gets lost.","accept":"Rusk: Who? Never heard of you.","decline":"Rusk: Then enjoy the attention.","caught":"Rusk: You tried to bribe a deputy? That's another star, genius."},"repeatable":true},{"id":"rusk-wipe-2","npc":"Deputy Rusk","venue":"RUSK TAKES wall","district":"red_tape_flats","location":[-270,-24],"wants":[{"item":"glow_dust_brick","qty":1},{"item":"colsec_tag","qty":1}],"gives":{"type":"wanted_clear","stars":2},"requires":{"wanted_min":2},"cooldownSec":1800,"rep":{"factions":[{"faction":"colsec_dirty","min":20}],"missions_done":["rusk-01-protection"]},"risk":{"bust_chance":0.15,"wanted_on_bust":1,"wanted_on_trade":0,"note":"On bust Rusk keeps the product and adds a star."},"lines":{"offer":"Rusk: Two stars is real work. Brick and an evidence tag.","accept":"Rusk: Your file just fell in the recycler.","decline":"Rusk: Your funeral. Literally, maybe.","caught":"Rusk: You tried to bribe a deputy? That's another star, genius."},"repeatable":true},{"id":"rusk-raid-tip","npc":"Deputy Rusk","venue":"RUSK TAKES wall","district":"red_tape_flats","location":[-270,-24],"wants":[{"item":"glow_dust","qty":1},{"item":"credits","qty":120}],"gives":{"type":"raid_tip","scope":"next_colsec_raid","warnSec":90,"reveals":["district","target","eta"]},"cooldownSec":1200,"rep":{"factions":[{"faction":"colsec_dirty","min":10}]},"risk":{"bust_chance":0.05,"wanted_on_bust":1,"wanted_on_trade":0},"lines":{"offer":"Rusk: Want to know where the boys hit next? It'll cost you.","accept":"Rusk: Ninety seconds' warning. Don't say I'm generous.","decline":"Rusk: Then be surprised.","caught":"Rusk: You tried to bribe a deputy? That's another star, genius."},"repeatable":true},{"id":"ines-velvet-vip","npc":"Ines","venue":"Velvet Airlock","district":"red_tape_flats","location":[-30,-36],"wants":[{"item":"red_dust_whiskey","qty":2},{"item":"credits","qty":80}],"gives":{"type":"venue_access","venueId":"velvet_airlock_vip","durationSec":900},"cooldownSec":900,"rep":{"factions":[{"faction":"velvet","min":0}],"missions_done":["ines-01-door"]},"risk":{"bust_chance":0.0,"wanted_on_bust":0,"wanted_on_trade":0},"lines":{"offer":"Ines: VIP is for people who bring something. Bottles talk.","accept":"Ines: Booth three. Hands to yourself, eyes on the stage.","decline":"Ines: Floor's fine for you, then.","caught":"Ines: Not tonight. ColSec is drinking at the bar."},"repeatable":true},{"id":"ines-velvet-vip-dust","npc":"Ines","venue":"Velvet Airlock","district":"red_tape_flats","location":[-30,-36],"wants":[{"item":"glow_dust","qty":1}],"gives":{"type":"venue_access","venueId":"velvet_airlock_vip","durationSec":1800},"cooldownSec":1800,"rep":{"factions":[{"faction":"velvet","min":20}],"missions_done":["ines-02-pour"]},"risk":{"bust_chance":0.08,"wanted_on_bust":1,"wanted_on_trade":0,"note":"Ines hates dust in her bar; she takes it off the street, not into it."},"lines":{"offer":"Ines: That baggie leaves with me, not with a patron. Deal?","accept":"Ines: Off the floor and into my safe. VIP all night.","decline":"Ines: Then keep it out of my club.","caught":"Ines: Bouncers. Now. Get him out."},"repeatable":true},{"id":"vesna-product-unlock-cook","npc":"Vesna","venue":"The Blue Room back door","district":"red_tape_flats","location":[-256,-54],"wants":[{"item":"hive_resin","qty":6}],"gives":{"type":"unlock_job","missionId":"vesna-04-cook","chain":"vesna-glow"},"repeatable":false,"cooldownSec":0,"rep":{"factions":[{"faction":"saltblood","min":0}],"missions_done":["vesna-03-resin"]},"risk":{"bust_chance":0.05,"wanted_on_bust":1,"wanted_on_trade":0},"wiredBy":"Jeff","lines":{"offer":"Vesna: Keep your credits. I need resin. Six jars.","accept":"Vesna: Good. Now I need a real lab. Talk to me.","decline":"Vesna: No resin, no lab, no money.","caught":"Vesna: Patrol. Drop it and walk."}},{"id":"vesna-product-restock","npc":"Vesna","venue":"The Blue Room back door","district":"red_tape_flats","location":[-256,-54],"wants":[{"item":"hive_resin","qty":4}],"gives":{"type":"item","item":"glow_dust","qty":3},"cooldownSec":900,"rep":{"factions":[{"faction":"saltblood","min":10}],"missions_done":["vesna-04-cook"]},"risk":{"bust_chance":0.08,"wanted_on_bust":1,"wanted_on_trade":0},"wiredBy":"Jeff","lines":{"offer":"Vesna: Resin in, dust out. Don't sample.","accept":"Vesna: Three baggies. Sell, don't smoke.","decline":"Vesna: Then go burn more nests.","caught":"Vesna: Cook shack's hot. Not now."},"repeatable":true},{"id":"rook-product-unlock-crew","npc":"Rook","venue":"Red Planet Noodle back booth","district":"olympus_row","location":[18,-416],"wants":[{"item":"glow_dust_brick","qty":1},{"item":"contraband","qty":1}],"gives":{"type":"unlock_job","missionId":"rook-04-crew","chain":"rook-heist"},"repeatable":false,"cooldownSec":0,"rep":{"factions":[{"faction":"quiet","min":0}],"missions_done":["rook-03-case"]},"risk":{"bust_chance":0.06,"wanted_on_bust":1,"wanted_on_trade":0},"wiredBy":"Jeff","lines":{"offer":"Rook: Credits leave trails. Product doesn't. Bring me a brick and a crate.","accept":"Rook: That buys a seat at the table. Let's pick a crew.","decline":"Rook: Then you're still a courier.","caught":"Rook: Eyes on us. Order the noodles and leave."}},{"id":"rook-product-unlock-withdrawal","npc":"Rook","venue":"Red Planet Noodle back booth","district":"olympus_row","location":[18,-416],"wants":[{"item":"ledger_chip","qty":2}],"gives":{"type":"unlock_job","missionId":"rook-05-withdrawal","chain":"rook-heist"},"repeatable":false,"cooldownSec":0,"rep":{"factions":[{"faction":"quiet","min":20}],"missions_done":["rook-04-crew"]},"risk":{"bust_chance":0.08,"wanted_on_bust":1,"wanted_on_trade":0},"wiredBy":"Jeff","lines":{"offer":"Rook: Two Quiet chips and I can read the vault schedule.","accept":"Rook: Schedule's cracked. The Big Withdrawal is on.","decline":"Rook: No chips, no vault.","caught":"Rook: Kline's people. Go."}}];
export const BARTER_STORY = { // the chain hooks wired by Jeff (wiredBy: "Jeff" in barter.json)
  'vesna-product-unlock-cook': 'vesna-04-cook', 'rook-product-unlock-crew': 'rook-04-crew', 'rook-product-unlock-withdrawal': null, // null = mission deferred: inert
};
const unlockJob = (g, id) => { const q = GM.QUESTS.find(x => x.id === id); if (!q) return false; q.requires = []; g.setFlag('barter:unlock:' + id); return true; };
function storyTrade(app, o) { // our part of a trade: advance the story chain
  const g = app.game; if (!(o.id in BARTER_STORY)) return { ok: true };
  const mid = BARTER_STORY[o.id];
  if (!mid) return { ok: false, inert: true, msg: 'Rook: Withdrawal\u2019s not ready. Keep your chips.' };
  if (g.progress.quests[mid]?.everDone || g.flag('barter:unlock:' + mid)) return { ok: false, msg: `${o.npc}: Already yours.` };
  unlockJob(g, mid); const q = GM.QUESTS.find(x => x.id === mid);
  return { ok: true, unlocked: mid, msg: `${o.lines?.accept || o.npc + ': Deal.'} New job: ${q?.title || mid}.` };
}
function engineGive(app, o) { // only for offers we registered ourselves (Marsmania absent from the list)
  const g = app.game, P = g.progress, W = app.surface?.world, gv = o.gives || {}, own = w => P.unlocks.includes('weapon:' + w);
  const addA = (id, n) => { P.inv[id] = (P.inv[id] || 0) + n; };
  if (gv.type === 'weapon') { if (!own(gv.weaponId)) P.unlocks.push('weapon:' + gv.weaponId); if (gv.ammo) addA(gv.ammo.ammoId, gv.ammo.qty); }
  else if (gv.type === 'ammo_bundle') { const need = { shells: 'shotgun', rounds: 'smg', slugs: 'railrifle', grenades: 'launcher' };
    for (const a of gv.ammo || []) if (!gv.onlyOwned || a.ammoId === 'shells' || own(need[a.ammoId])) addA(a.ammoId, a.qty); }
  else if (gv.type === 'wanted_clear') { if (!W?.wanted) return { ok: false, msg: 'Rusk: You\u2019re clean. Don\u2019t waste my evidence.' }; W.setWanted(Math.max(0, W.wanted - (gv.stars || 1)), 'rusk wipe'); }
  else if (gv.type === 'venue_access' && gv.venueId === 'velvet_airlock_vip') g.setFlag('vip');
  g.save?.(); return { ok: true };
}
const B = { mine: new Set(), attached: new Map(), last: 0 };
function barterCheck(app) {
  const C = window.SSX?.contraband; if (!C) return;
  const getO = id => C.getOffer?.(id) ?? C.offers?.[id] ?? (C.offers instanceof Map ? C.offers.get(id) : undefined);
  for (const o of BARTER) {
    const story = o.id in BARTER_STORY, cur = getO(o.id);
    if (B.mine.has(o.id)) continue;
    if (cur) { // Marsmania's: attach the story hook once per offer object; nothing to do for non-story rows
      if (!story || B.attached.get(o.id) === cur) continue;
      if (typeof C.onTrade === 'function') C.onTrade(o.id, ctx => storyTrade(app, o, ctx));
      else { const prev = cur.onTrade; cur.onTrade = ctx => { const r = storyTrade(app, o, ctx); if (r.ok === false) return r; const p = prev ? prev(ctx) : { ok: true }; return { ...r, ...(p || {}), msg: r.msg || p?.msg }; }; }
      B.attached.set(o.id, cur); continue;
    }
    if (typeof C.registerOffer !== 'function') continue;
    try {
      const r = C.registerOffer({ ...JSON.parse(JSON.stringify(o)), onTrade: ctx => { const s = storyTrade(app, o, ctx); if (s.ok === false) return s; const e = story ? { ok: true } : engineGive(app, o); const res = { ...s, ...e, msg: e.msg || s.msg || o.lines?.accept }; if (res.msg) app.toast?.(`💬 ${res.msg}`, 3200); return res; } });
      if (r !== false) B.mine.add(o.id);
    } catch (e) { console.warn('storymars barter', o.id, e); B.mine.add(o.id); }
  }
}
function tick(app, dt) {
  if (window.SSX?.contraband && performance.now() - B.last > 1000) { B.last = performance.now(); barterCheck(app); }
  const g = app.game; if (!g?.debug || !app.state?.onSurface) { if (S.key) { cleanup(app); S.key = null; } return; }
  const q = g.debug.quest(), def = q && GM.QUESTS.find(x => x.id === q.id);
  if (!q || !def?.storymars) { if (S.key) { cleanup(app); S.key = null; } return; }
  const s = def.steps[q.step]; if (!s) return;
  const key = `${q.id}:${q.step}`;
  if (key !== S.key) { S.key = key; startStep(app, g, q, s); }
  if (s.only && !chose(g, q.id, s.only)) return nextStep(g);
  const info = app.surface.info, world = app.surface.world, tg = g.debug.target(), inside = !!world.inside;
  const near = tg ? Math.hypot(tg.x - info.x, tg.z - info.z) : 1e9, wanted = world.wanted || 0;
  if (s.nowanted === 'fail' && wanted > 0) return failJob(app, g, def.failLine?.replace(/^[^:]{1,22}:\s*/, '') || 'They made you.');
  switch (s.type) {
    case 'choice': if (S.sheetFor !== key) choiceSheet(app, g, q, s); return;
    case 'cleanexit':
      setText(s, wanted > 0 ? '(lose the heat first)' : '');
      if (!inside && wanted === 0 && near < (tg.r || 4) + (info.driving ? 2.5 : 0)) nextStep(g); return;
    case 'hold': {
      if (inside) { setText(s, '(step outside)'); return; }
      const r = s.r || 10, inZone = near < r + 2;
      if (inZone) S.t += dt;
      const left = Math.max(0, Math.ceil(s.seconds - S.t));
      setText(s, inZone ? `(${left} s)` : `(get back to the spot · ${left} s)`);
      if (g.info.aliensOn && inZone) { S.spawnT -= dt; if (S.spawnT <= 0 && hostiles(g).length < 3) { S.spawnT = 7; spawnNear(g, s.wave[S.k++ % s.wave.length], 20 + Math.random() * 6, Math.random() * 6.28); } }
      if (S.t >= s.seconds) { g.debug.clear(); app.toast?.('🛡️ Held. The rest of them scatter.', 2400); nextStep(g); }
      return;
    }
    case 'tail': {
      if (inside) { setText(s, '(step outside)'); return; }
      const T = S.tail; if (!T) return; const goal = T.pts[T.i], gp = T.group.position, dx = goal.x - gp.x, dz = goal.z - gp.z, d = Math.hypot(dx, dz);
      const step = Math.min(d, s.speed * dt); gp.x += dx / (d || 1) * step; gp.z += dz / (d || 1) * step; gp.y = groundY(app); T.group.rotation.y = Math.atan2(-dx, -dz);
      tg.x = gp.x; tg.z = gp.z; // the quest arrow / minimap follow the hauler
      if (d < 0.6) { T.i++; if (T.i >= T.pts.length) { app.toast?.('📦 The hauler parks at the depot. Meridian crates. Interesting.', 3000); cleanup(app); return nextStep(g); } }
      const pd = Math.hypot(gp.x - info.x, gp.z - info.z);
      S.seen = pd < 7 ? S.seen + dt : Math.max(0, S.seen - dt); S.lost = pd > 55 ? S.lost + dt : 0;
      setText(s, pd < 7 ? '(too close!)' : pd > 45 ? '(losing him)' : `(${Math.round(pd)} m)`);
      if (S.seen > 3) return failJob(app, g, 'The driver made you. Trail\u2019s cold.');
      if (S.lost > 6) return failJob(app, g, 'You lost the hauler. Trail\u2019s cold.');
      return;
    }
    case 'escort2': {
      const E = S.esc; if (!E) return;
      if (inside) { E.group.visible = false; setText(s, '(head outside, he follows)'); return; } E.group.visible = true;
      const bx = info.x + 1.8, bz = info.z + 1.8, dx = bx - E.x, dz = bz - E.z, d = Math.hypot(dx, dz);
      if (d > 22) { E.x = bx; E.z = bz; } else if (d > 1.2) { const v = Math.min(d, (d > 6 ? 9 : 5) * dt); E.x += dx / d * v; E.z += dz / d * v; E.phase += dt; }
      E.group.position.set(E.x, groundY(app), E.z); E.group.rotation.y = Math.atan2(-dx, -dz);
      const w = Math.sin(E.phase * 9) * (d > 1.2 ? 0.5 : 0); E.legs.forEach((l, i) => { l.rotation.x = i ? w : -w; });
      if (!E.spawned && g.info.aliensOn) { S.t += dt; if (S.t > 3) { E.spawned = true; s.wave.forEach((t, k) => spawnNear(g, t, 22 + k * 3, k * 2.1)); app.toast?.('🔫 Saltblood spotted him. Keep him moving.', 2400); } }
      const threats = hostiles(g).filter(a => Math.hypot(a.x - E.x, a.z - E.z) < 30).length;
      E.hp -= threats * 2.2 * dt; if (E.hp <= 0) return failJob(app, g, 'The accountant took one in the head. So did the lead.');
      setText(s, `(accountant ${Math.max(0, Math.round(E.hp))}%)`);
      if (near < (tg.r || 7) && Math.hypot(tg.x - E.x, tg.z - E.z) < (tg.r || 7) + 3) { app.toast?.('🧳 He\u2019s at the pad, sweating through his suit.', 2400); nextStep(g); }
      return;
    }
    case 'rrace': {
      const RA = window.__race; if (!RA) { setText(s, '(race module missing)'); return; }
      if (!S.raced) {
        if (!info.driving) { setText(s, '(get in a ride)'); return; }
        const r = RA.start({ id: q.id, world: def.world, name: 'Tycho field', loop: false, laps: 1, par: s.par || 46, anchor: 'colony', rival: { name: s.rival || 'Rival', kind: def.world === 'Moon' ? 'hoverbike' : 'buggy' }, purse: 0,
          blurb: 'Fixed race.', gates: s.pts.map(p => [p[0], p[1]]), props: [] });
        if (r.ok) S.raced = true; else { setText(s, `(${r.why})`); return; }
      }
      const res = RA.result;
      if (RA.state || !res || res.id !== q.id) return;
      const throwIt = chose(g, q.id, 'fix=throw');
      if (!res.done) return failJob(app, g, 'You crashed. Nobody gets paid.');
      if (throwIt && res.won) return failJob(app, g, 'You were paid to lose. The bookies noticed.');
      if (!throwIt && !res.won) return failJob(app, g, 'The kid beat you. Kestrel\u2019s pride is bleeding.');
      if (throwIt) { g.reward(0, 800); app.toast?.('💰 Bookies pay out: +800 cr', 2600); }
      return nextStep(g);
    }
    case 'build': {
      const RA = window.__race; if (!RA) return;
      const ok = (RA.data?.tracks || []).find(t => t.world === def.world && t.gates.length >= s.gates && (t.props || []).some(p => p.t === s.prop));
      if (ok) { g.setFlag(`story:${q.id}:track=${ok.id}`); S.track = ok.id; closeSheet(); return nextStep(g); }
      if (S.sheetFor !== key && !RA.builder?.open && !inside && Date.now() > (S.snooze || 0)) { S.sheetFor = key; openSheet(def.contact, s.text, [{ id: 'build', label: '🛠 Open the track builder', on: () => { closeSheet(); RA.openBuilder(); } }, { id: 'later', label: 'Later', on: () => { closeSheet(); S.sheetFor = null; S.snooze = Date.now() + 20000; } }]); }
      return;
    }
    case 'runtrack': {
      const RA = window.__race; if (!RA) return;
      const mine = (RA.data?.tracks || []).filter(t => t.world === def.world && t.gates.length >= 6).map(t => t.id);
      if (RA.state && mine.includes(RA.state.id)) S.raced = key; // only a run started during this step counts, never a stale result
      const res = RA.result; if (S.raced === key && !RA.state && res && mine.includes(res.id) && res.done) { S.raced = null; return nextStep(g); }
      if (S.sheetFor !== key && !RA.state && !inside && mine.length && Date.now() > (S.snooze || 0)) { S.sheetFor = key; openSheet(def.contact, s.text, [{ id: 'race', label: '🏁 Race my track', on: () => { closeSheet(); const r = RA.start(mine[mine.length - 1]); if (!r.ok) { app.toast?.(`🚫 ${r.why}`, 2400); S.sheetFor = null; } } }, { id: 'later', label: 'Later', on: () => { closeSheet(); S.sheetFor = null; S.snooze = Date.now() + 20000; } }]); }
      return;
    }
  }
}
export function initStoryMars(app) {
  if (!app || app.__storymars) return; app.__storymars = true;
  for (const mid of Object.values(BARTER_STORY)) if (mid && app.game?.flag?.('barter:unlock:' + mid)) unlockJob(app.game, mid); // barter unlocks survive reloads
  let last = performance.now();
  setInterval(() => { const now = performance.now(), dt = Math.min(0.5, (now - last) / 1000); last = now; if (document.hidden) return; try { tick(app, dt); } catch (e) { console.warn('storymars', e); } }, 100);
  // test/debug hooks
  window.__storymars = { shipped: SHIPPED, deferred: DEFERRED, get state() { return { key: S.key, t: S.t, tail: S.tail ? { x: S.tail.group.position.x, z: S.tail.group.position.z, i: S.tail.i } : null, esc: S.esc ? { x: S.esc.x, z: S.esc.z, hp: S.esc.hp } : null, sheet: sheet?.style.display === 'block' }; },
    skip(sec) { S.t += sec; }, types: Object.keys(HUMAN_TYPES), barter: { offers: BARTER.map(o => o.id), get registered() { return [...B.mine]; }, get attached() { return [...B.attached.keys()]; } } };
}
