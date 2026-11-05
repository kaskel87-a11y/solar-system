// Velvet expansion: Ines's arc "House Always Wins" (Chief of Staff, story/ines-arc.md) and owning the Velvet Airlock.
// Collin: "What's the point of Ines? Can I take over the Velvet Airlock at some point?" Yes: five jobs from Ines, then the deed.
//   Unlock: 10+ bottles sold to Ines (SSX.velvetDeal) or 3,000 lifetime stars. Talk to Ines in the Velvet's VIP room.
//   1 Short Pour         tail the delivery rover from the Rust Belt Loop to the club, catch Pell, bribe (200) or beat him
//   2 Comped             win a Hold'em hand at the Velvet, swipe Grisby's ledger slate (15 s, while he isn't looking or
//                        Mina the waitress screens you), get out past Thorne's bouncers
//   3 Closing Time       (the doc's "Last Call"; that title is taken by ines-04) two waves of arsonists at the door, then
//                        chase the arsonist's rover and stop it before Olympus Row
//   4 Upstairs Vote      Sable's price: pay her Deimos Lockup debt (2,500 cr) or beat Vik Dorran at the Rust Pit (best 2/3)
//   5 House Always Wins  hand Thorne the ledger in the Dome Room, beat his armored suit (3 phases), he signs or gets spaced
// Owning it (mars/velvetarccore.js has the rules): 8% of all table + slot action and 400 cr per game day into the office till
// (collect at Ines's desk, 1 star per 10 cr), a dark green beam over the club, Ines as manager with new lines, Upstairs free and
// 25% off the private show, an office safe for contraband with no limit, no ColSec raids on the Velvet, and Brick lets you in
// at 1-2 stars. Every hook into other systems is feature-detected; a missing module never breaks a step.
// Window API: SSX.velvetArc = { owned(), showMult(), state(), ...spot hooks used by velvetwing.js, debug }.
import * as THREE from 'three';
import * as GM from '../game.js';
import * as W from '../world.js';
import * as VA from './velvetarccore.js';
import { buildHuman } from '../storymars.js';
import { WING } from '../velvetwing.js';
import { grantStars, frontStars } from '../starmixcore.js';
import { pokerIsOpen, pokerState } from '../activities/poker.js';
import { tap as hookTap } from '../planets/hooks.js';

const MOBILE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const X = () => (typeof window !== 'undefined' && window.SSX) || {};
const APP = () => (typeof window !== 'undefined' ? window.__app : null);
const game = () => APP()?.surface?.game || APP()?.game || null;
const toast = (t, ms = 3200) => { try { (X().city?.toast || APP()?.toast)?.(t, ms); } catch (e) { /* hud not up */ } };
const radio = (text, who) => { try { if (X().city?.radio) X().city.radio(text, who); else APP()?.toast?.('\ud83d\udcfb ' + text, 4200); } catch (e) { /* */ } };
const tapEl = (el, fn) => (typeof window.__onTap === 'function' ? window.__onTap(el, fn) : hookTap(el, fn));
const nextStep = g => (typeof g.advanceStep === 'function' ? g.advanceStep() : g.debug.advance());
const failJob = (g, why) => { if (typeof g.failStep === 'function') return g.failStep(why); g.abandon?.(); toast('\u274c ' + why, 4200); };

// ---------- persistent state ----------
let S = VA.fresh();
try { S = VA.load(localStorage.getItem(VA.KEY)); } catch (e) { /* private mode */ }
const save = () => { try { localStorage.setItem(VA.KEY, JSON.stringify(S)); } catch (e) { /* */ } };

// ---------- wave types: Pell, Thorne's bouncers, Thorne's armored suit ----------
export const TYPES = {
  pell: { name: 'Pell (driver)', hp: 9, speed: 6.5, hover: 0, r: 0.8, cy: 1.15, attack: 'shoot', dmg: 3, burst: 1, cd: 2.6, range: 18, keep: 6, xp: 10, credits: 20, human: true },
  bouncer: { name: 'Thorne\u2019s bouncer', hp: 14, armor: 0.2, speed: 6, hover: 0, r: 0.95, cy: 1.3, scale: 1.15, attack: 'shoot', dmg: 6, burst: 2, cd: 2.4, range: 28, keep: 9, xp: 24, credits: 20, human: true },
  thornesuit: { name: 'Marcus Thorne (armored suit)', hp: VA.BOSS.hp, armor: 0.45, speed: 4.2, hover: 0, r: 1.15, cy: 1.6, scale: 1.45, attack: 'shoot', dmg: 9, burst: 4, cd: 1.9, range: 40, keep: 12, xp: 0, credits: 0, human: true }
};
function buildSuit() {
  const h = buildHuman('suit'), m = new THREE.MeshStandardMaterial({ color: 0x2a2e36, metalness: 0.85, roughness: 0.3 }), glow = new THREE.MeshBasicMaterial({ color: 0x2aff7a });
  const plate = (w, hh, d, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), m); b.position.set(x, y, z); h.body.add(b); return b; };
  plate(0.62, 0.5, 0.36, 0, 1.45, 0); plate(0.3, 0.16, 0.36, -0.42, 1.78, 0); plate(0.3, 0.16, 0.36, 0.42, 1.78, 0); plate(0.34, 0.3, 0.34, 0, 2.0, 0);
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.02), glow); v.position.set(0, 2.02, -0.18); h.body.add(v);
  return h;
}
const LOOK = { pell: 'goon', bouncer: 'enforcer' };
for (const [t, T] of Object.entries(TYPES)) GM.registerAgentType?.(t, T, t === 'thornesuit' ? buildSuit : () => buildHuman(LOOK[t]));

// ---------- the missions (AJ-relative metres; the club door is at [-30, -32.5], the building spans z -52.5..-32.5) ----------
const CLUB = 'Velvet Airlock', ROW_END = [0, -390];
const M = def => ({ world: 'Mars', contact: 'Ines', fiction: true, story: true, velvetArc: true, ...def });
export const IDS = ['ines-arc-1-shortpour', 'ines-arc-2-comped', 'ines-arc-3-closingtime', 'ines-arc-4-upstairs', 'ines-arc-5-house'];
const LOCKED = 'ines-arc-locked'; // never done: mission 1 requires it until the unlock check passes (see gate())
export const MISSIONS = [
  M({ id: IDS[0], title: 'Short Pour', requires: [LOCKED],
    intro: 'Ines: Thorne\u2019s waterin\u2019 my stock and blamin\u2019 me. Find out who. His delivery rover runs the Rust Belt Loop to my back door. Follow it. Don\u2019t get made.',
    success: 'Ines: Huh. You\u2019re useful. Don\u2019t let it go to your head.', failLine: 'Ines: Lost him? Then go find him again.',
    reward: { xp: 40, credits: 600 },
    steps: [
      { type: 'goto', at: [-66, 80], r: 7, text: 'Get to the Rust Belt Loop (west bend), where Thorne\u2019s delivery rover passes' },
      { type: 'tail', path: [[-66, 80], [-112, 40], [-118, -10], [-96, -48], [-60, -62], [-34, -60]], speed: 6.5, close: 6, lose: 60, text: 'Tail the delivery rover to the Velvet (not too close)' },
      { type: 'goto', at: [-30, -59], r: 5, text: 'Catch the driver behind the Velvet' },
      { type: 'pick', who: 'Pell', prompt: 'Pell is swapping Ines\u2019s crates for watered ones. "Thorne pays me. Thorne pays everybody."',
        options: [{ id: 'bribe', label: 'Bribe him for the truth (200 cr)', cost: 200, flag: 'pell_bribed', line: 'Pell: Thorne\u2019s orders. His accountant does the swap sheets. Grisby. Don\u2019t tell him I said.' },
          { id: 'beat', label: 'Beat it out of him', flag: 'pell_beat', line: 'Pell: You want it the hard way? Fine!' }] },
      { type: 'pellfight', at: [-30, -60], text: 'Put Pell down' }] }),
  M({ id: IDS[1], title: 'Comped', requires: [IDS[0]],
    intro: 'Ines: Thorne\u2019s accountant, Grisby, cooks the Hold\u2019em books in my own Dome Room. Win a hand at his table, then lift his ledger slate when he isn\u2019t looking. Mina will walk past it. Use her.',
    success: 'Ines: Three years of skim. We own him now.', failLine: 'Ines: Grisby saw your face. Lay low and try again.',
    reward: { xp: 60, credits: 900 },
    steps: [
      { type: 'enter', building: CLUB, text: 'Go into the Velvet Airlock' },
      { type: 'pokerwin', at: [-30, -34], text: 'Win a hand of Hold\u2019em at Grisby\u2019s table (the Dome Room, east wing)' },
      { type: 'swipe', at: [-30, -34], text: 'Swipe Grisby\u2019s ledger slate' },
      { type: 'escape', at: [-30, -34], text: 'Get out through the airlock: Thorne\u2019s bouncers are onto you' }] }),
  M({ id: IDS[2], title: 'Closing Time', requires: [IDS[1]],
    intro: 'Ines: Thorne knows. He\u2019s sending men with fuel cans to torch my office. Hold the door. Nobody gets to my back bar.',
    success: 'Ines: He tried to burn me out. So we take everything.', failLine: 'Ines: Smoke damage I can fix. Go again.',
    reward: { xp: 90, credits: 1200 },
    steps: [
      { type: 'goto', at: [-30, -24], r: 7, text: 'Get to the Velvet\u2019s front door' },
      { type: 'defeat', at: [-30, -16], wave: ['goon', 'goon', 'enforcer'], text: 'Stop the first wave of arsonists' },
      { type: 'defeat', at: [-30, -16], wave: ['goon', 'enforcer', 'enforcer'], text: 'Stop the second wave' },
      { type: 'chase', path: [[-44, -24], [-24, -70], [-12, -160], [-4, -260], ROW_END], speed: 9.5, text: 'Stop the arsonist\u2019s rover before Olympus Row (stay close to it)' }] }),
  M({ id: IDS[3], title: 'Upstairs Vote', requires: [IDS[2]],
    intro: 'Ines: I need Upstairs on side. Sable runs the girls and the girls run the floor. She\u2019ll want something. She always wants something.',
    success: 'Sable: Fine, sugar. My girls follow the money, and the money\u2019s you.', failLine: 'Ines: Vik put you on the canvas. Go back when you can stand.',
    reward: { xp: 120, credits: 1500 },
    steps: [
      { type: 'enter', building: CLUB, text: 'Go into the Velvet Airlock' },
      { type: 'vote', at: [-30, -34], text: 'Talk to Sable at the Upstairs door (VIP room)' },
      { type: 'pit', at: [-292, -60], text: 'Beat Vik Dorran at the Rust Pit, best 2 of 3 (Red Tape Flats)' }] }),
  M({ id: IDS[4], title: 'House Always Wins', requires: [IDS[3]],
    intro: 'Ines: Thorne\u2019s coming tonight with a buyout and a crew. He thinks I can\u2019t stop him. Bring the ledger. Hand it to him in front of everybody.',
    success: 'Ines: Boss. Pour yourself one. On the house. Which is yours.', failLine: 'Ines: He\u2019s still standing. So are we. Again.',
    reward: { xp: 400, credits: 5000 },
    steps: [
      { type: 'enter', building: CLUB, text: 'Go into the Velvet Airlock' },
      { type: 'handover', at: [-30, -34], text: 'Hand Thorne the ledger in the Dome Room, in front of the floor' },
      { type: 'defeat', at: [-30, -14], wave: ['thornesuit'], text: 'Take Thorne\u2019s armored suit apart out front' },
      { type: 'pick', who: 'Marcus Thorne', prompt: 'Thorne is on his knees in the dust, suit smoking. The deed is in his breast pocket.',
        options: [{ id: 'sign', label: 'He signs the deed over (at gunpoint)', flag: 'thorne_signed', line: 'Thorne: Take it. It never made money anyway. ...It made a lot of money.' },
          { id: 'space', label: 'Out the airlock: next ore hauler to Deimos', flag: 'thorne_spaced', line: 'Brick: One passenger, economy, no return. He\u2019ll live. He\u2019ll hate Deimos.' }] }] })
];
for (const q of MISSIONS) GM.registerMission(q);
function gate() { // re-register mission 1 without the lock once Ines would talk business
  const g = game(), bottles = (() => { try { return X().velvetDeal?.state?.()?.bottles | 0; } catch (e) { return 0; } })(), stars = g?.progress?.xp || 0;
  const open = VA.unlocked(bottles, stars), q = MISSIONS[0], want = open ? [] : [LOCKED];
  if (q.requires.length !== want.length) { q.requires = want; GM.registerMission(q); }
  if (open && !S.hinted && g && !g.progress.quests?.[IDS[0]]?.everDone) { S.hinted = true; save(); radio('Ines: You\u2019ve been good for my bar. Come see me in the VIP room. I\u2019ve got a real job.', 'Ines'); }
  return open;
}

// ---------- bottom sheet (same look as storymars2's: black buttons, white text, arming window) ----------
let sheet = null, sheetTok = 0, sheetAt = 0, sheetFired = false;
function ensureSheet() {
  if (sheet) return sheet;
  const css = document.createElement('style');
  css.textContent = `#varcSheet{position:fixed;left:0;right:0;bottom:0;z-index:16;display:none;padding:10px calc(12px + var(--sar,0px)) calc(12px + var(--sab,0px)) calc(12px + var(--sal,0px));background:rgba(4,10,8,.95);color:#fff;border-top:1px solid rgba(255,255,255,.3);max-height:46vh;overflow-y:auto;box-sizing:border-box;font-size:.88rem;line-height:1.32}
#varcSheet .wrap{max-width:560px;margin:0 auto}#varcSheet .who{font-weight:800;color:#6aff9a;font-size:.76rem;letter-spacing:.04em;text-transform:uppercase}
#varcSheet .p{margin:3px 0 8px}#varcSheet .opts{display:flex;flex-direction:column;gap:7px}
#varcSheet button{min-height:44px;padding:8px 12px;border-radius:10px;font-weight:700;text-align:left;touch-action:manipulation;background:#000;color:#fff;border:1px solid rgba(255,255,255,.6);font-size:.88rem}
#varcSheet button:disabled{color:#b4b4b4;border-style:dashed;border-color:#6b6b6b}`;
  document.head.appendChild(css);
  sheet = document.createElement('div'); sheet.id = 'varcSheet'; sheet.innerHTML = '<div class="wrap"><div class="who"></div><div class="p"></div><div class="opts"></div></div>';
  document.body.appendChild(sheet); return sheet;
}
const sheetOpen = () => !!sheet && sheet.style.display === 'block';
const closeSheet = () => { if (sheet) sheet.style.display = 'none'; };
function controlsLift() {
  if (!document.body?.classList.contains('touch')) return 0; let top = null;
  for (const id of ['joy', 'fireBtn', 'meleeBtn', 'jumpBtn', 'runBtn', 'driveBtn', 'actBtn']) { const e = document.getElementById(id); if (!e) continue; const r = e.getBoundingClientRect(); if (r.width < 1 || r.bottom < innerHeight * 0.55) continue; if (top === null || r.top < top) top = r.top; }
  return top === null ? 0 : Math.max(0, Math.round(innerHeight - top + 6));
}
function openSheet(who, text, buttons) {
  const el = ensureSheet(); el.querySelector('.who').textContent = who; el.querySelector('.p').textContent = text;
  const box = el.querySelector('.opts'); box.innerHTML = ''; const tok = ++sheetTok; sheetFired = false; sheetAt = performance.now();
  for (const b of [...buttons, { id: 'close', label: 'Close', on: () => closeSheet() }]) {
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = b.label; btn.dataset.opt = b.id; btn.disabled = !!b.disabled;
    tapEl(btn, () => { if (btn.disabled || tok !== sheetTok || sheetFired || !sheetOpen() || performance.now() - sheetAt < 320) return; sheetFired = true; if (b.on() === false) sheetFired = false; });
    box.appendChild(btn);
  }
  const lift = controlsLift(); el.style.bottom = lift + 'px'; el.style.maxHeight = Math.max(150, Math.round(innerHeight * 0.6 - lift)) + 'px'; el.style.display = 'block';
}

// ---------- the step runner ----------
const R = { key: null, qid: null, t: 0, k: 0, tail: null, chase: null, swipe: { p: 0 }, hand: null, pit: null, boss: null, pickFor: null, outT: 0, spawned: false, doorWas: false };
const mine = id => MISSIONS.find(q => q.id === id);
const groundY = app => (app.surface.info?.y ?? 1.7) - 1.7;
const ours = g => g.debug.agents().filter(a => a.src === 'quest' || a.src === 'varc');
const minaNear = () => { try { const p = window.__velvetWing?.mina?.(); return !!p && Math.hypot(p.x - WING.ledger.x, p.z - WING.ledger.z) < 2.1; } catch (e) { return false; } };
function setText(s, extra) { s._base ??= s.text; s.text = extra ? `${s._base} ${extra}` : s._base; }
function spawnNear(g, types, x, z, r = 14, src = 'quest') {
  const room = Math.min((MOBILE ? 3 : 5) - ours(g).length, types.length); if (room <= 0 || !g.hostiles) return 0;
  return g.hostiles(types.slice(0, room), x, z, { r, src, faction: 'velvetarc' });
}
function local(app) { // player position in club room-local metres (null outside the Velvet)
  const w = app.surface.world, ins = w.inside, i = app.surface.info; if (!ins || ins.kind !== 'club') return null;
  return { x: i.x - ins.ax, z: i.z - ins.az };
}
const flagged = (g, q, f) => g.flag(`story:${q}:${f}`);
function cleanup() {
  closeSheet(); R.pickFor = null;
  for (const k of ['tail', 'chase']) if (R[k]) { R[k].group.parent?.remove(R[k].group); R[k] = null; }
}
function startStep(app, g, q, s) {
  cleanup(); R.t = 0; R.k = 0; R.outT = 0; R.spawned = false; R.swipe = { p: 0 }; R.hand = null; R.boss = null;
  if (s._base) s.text = s._base;
  if (s.type === 'tail' || s.type === 'chase') {
    const c = W.buildVehicle(s.type === 'chase' ? 'rover' : 'hauler'), p = s.path.map(pt => app.surface.world.colonyAt(pt));
    c.group.position.set(p[0].x, groundY(app), p[0].z); app.surface.scene.add(c.group); R[s.type] = { group: c.group, pts: p, i: 1, seen: 0, lost: 0, near: 0 };
    if (s.type === 'chase') toast('\ud83d\udd25 The last one jumps in a rover and floors it for Olympus Row. Grab a ride and get on him.', 4200);
  }
  if (s.type === 'vote') { try { if (!g.flag('vip')) g.setFlag('vip'); app.surface.world.openVip?.(); } catch (e) { /* */ } toast('Tiny unhooks the rope: "Sable\u2019s waiting on you. Upstairs door."', 3400); }
  if (s.type === 'pit') { if (flagged(g, IDS[3], 'paid_sable')) { toast('\ud83d\udcb8 Debt paid. Vik Dorran can keep his teeth.', 2600); return nextStep(g); } S.pitWins = 0; S.pitLosses = 0; save(); R.pit = { seen: app.surface.world.lastDuel || null, live: false }; }
  if (s.type === 'pellfight' && flagged(g, IDS[0], 'pell_bribed')) return nextStep(g);
  if (s.type === 'handover') toast('\ud83d\udcd2 Thorne is in the Dome Room with his crew. Walk up and hand him the ledger.', 3600);
  if (s.type === 'defeat' && s.wave?.includes('thornesuit')) { R.boss = { phase: 1, max: VA.BOSS.hp }; toast('\ud83c\udf78 The waitresses duck behind the bar. Thorne steps out of a crate in an armored suit.', 4200); }
}
function questEnded(app, g, qid) {
  cleanup();
  if (qid === IDS[4] && g.progress.quests?.[qid]?.everDone && !S.owned) {
    VA.own(S, g.flag(`story:${IDS[4]}:thorne_spaced`) ? 'spaced' : 'signed'); save();
    setTimeout(() => radio('Ines: The deed\u2019s in your name. The Velvet Airlock is yours, boss. Your office is open: east wing, behind the Dome Room.', 'Ines'), 1600);
    emitOwned();
  }
}
function pickSheet(g, q, s, key) {
  R.pickFor = key; const cr = g.progress.credits;
  openSheet(s.who || 'Ines', s.prompt || s.text, s.options.map(o => ({ id: o.id, label: o.label, disabled: !!(o.cost && cr < o.cost), on: () => {
    const q2 = g.debug.quest(); if (!q2 || `${q2.id}:${q2.step}` !== key) return false;
    if (o.cost && !g.spend(o.cost)) return false;
    if (o.flag) g.setFlag(`story:${q.id}:${o.flag}`);
    closeSheet(); if (o.line) toast('\ud83d\udcac ' + o.line, 4200); R.pickFor = null; nextStep(g);
  } })));
}
function tick(app, dt) {
  const g = app.game || app.surface?.game; if (!g?.debug) return;
  if (performance.now() - (R.gateT || 0) > 1000) { R.gateT = performance.now(); try { gate(); } catch (e) { /* */ } try { hookAll(app); } catch (e) { console.warn('velvetarc hooks', e); } }
  if (!app.state?.onSurface) return;
  const q = g.debug.quest(), def = q && mine(q.id);
  if (R.qid && (!q || q.id !== R.qid)) { const p = R.qid; R.qid = null; R.key = null; questEnded(app, g, p); }
  if (!q || !def) return;
  R.qid = q.id; const s = def.steps[q.step]; if (!s) return;
  const key = `${q.id}:${q.step}`; if (key !== R.key) { R.key = key; startStep(app, g, q, s); if (g.debug.quest()?.step !== q.step) return; }
  const info = app.surface.info, world = app.surface.world, inside = !!world.inside, tg = g.debug.target(), L = local(app);
  const door = world.doorFor?.(CLUB);
  switch (s.type) {
    case 'pick': { if (inside) { setText(s, '(step outside)'); return; } if (R.pickFor !== key) pickSheet(g, q, s, key); return; }
    case 'tail': {
      if (inside) { setText(s, '(step outside)'); return; }
      const T = R.tail; if (!T) return; const goal = T.pts[T.i], gp = T.group.position, dx = goal.x - gp.x, dz = goal.z - gp.z, d = Math.hypot(dx, dz);
      const st = Math.min(d, s.speed * dt); gp.x += dx / (d || 1) * st; gp.z += dz / (d || 1) * st; gp.y = groundY(app); T.group.rotation.y = Math.atan2(-dx, -dz);
      if (tg) { tg.x = gp.x; tg.z = gp.z; }
      if (d < 0.6) { T.i++; if (T.i >= T.pts.length) { cleanup(); toast('\ud83d\ude9a The rover backs up behind the Velvet. Somebody starts unloading.', 3000); return nextStep(g); } }
      const pd = Math.hypot(gp.x - info.x, gp.z - info.z);
      T.seen = pd < s.close ? T.seen + dt : Math.max(0, T.seen - dt); T.lost = pd > s.lose ? T.lost + dt : 0;
      setText(s, pd < s.close ? '(too close!)' : pd > s.lose - 10 ? '(losing them)' : `(${Math.round(pd)} m)`);
      if (T.seen > 3) { cleanup(); return failJob(g, 'Pell made you. Trail\u2019s cold.'); }
      if (T.lost > 7) { cleanup(); return failJob(g, 'You lost the rover. Trail\u2019s cold.'); }
      return;
    }
    case 'pellfight': {
      if (inside) { setText(s, '(step outside)'); return; }
      if (!R.spawned) { const c = world.colonyAt(s.at); if (Math.hypot(c.x - info.x, c.z - info.z) < 40) { R.spawned = spawnNear(g, ['pell'], c.x, c.z, 5) > 0 || R.t > 3; } R.t += dt; return; }
      if (!g.debug.agents().some(a => a.type === 'pell')) { toast('\ud83d\udcac Pell, from the dirt: "Grisby! Thorne\u2019s accountant! He does the swap sheets!"', 4200); return nextStep(g); }
      return;
    }
    case 'pokerwin': {
      if (!L) { setText(s, inside ? '' : '(go inside)'); return; }
      const st = (() => { try { return pokerIsOpen() ? pokerState() : null; } catch (e) { return null; } })();
      if (!st) { R.hand = null; setText(s, ''); return; }
      const me = st.players.find(p => p.human); if (!me) return;
      if (!R.hand) R.hand = { hand: st.hand, start: me.chips + (me.bet || 0) };
      if (st.hand !== R.hand.hand) { const won = me.chips > R.hand.start; R.hand = { hand: st.hand, start: me.chips + (me.bet || 0) };
        if (won) { toast('\ud83c\udccf Grisby slides the pot your way and sniffs. He opens his slate to log it. Now you know where it lives.', 4200); return nextStep(g); } }
      setText(s, '(playing)'); return;
    }
    case 'swipe': {
      if (!L) { setText(s, inside ? '' : '(go inside)'); R.swipe = { p: 0 }; return; }
      const atSlate = Math.hypot(L.x - (WING.ledger.x + 0.1), L.z - (WING.ledger.z - 0.8)) < VA.SWIPE.range, now = performance.now() / 1000;
      const m = VA.swipeTick(R.swipe, dt, { atSlate, looking: VA.grisbyLooking(now), screened: minaNear() }); R.swipe = m;
      if (m.state === 'caught') toast('\ud83d\udc40 Grisby looks up. You study the ceiling. Start again.', 2200);
      if (m.state === 'done') { S.ledgerGone = true; save(); toast('\ud83d\udcd2 Slate up your sleeve. Grisby is still counting.', 3000); return nextStep(g); }
      setText(s, !atSlate ? '(the slate is on its stand behind Grisby\u2019s chair)' : m.state === 'wait' ? '(he\u2019s looking: wait, or let Mina screen you)' : `(${Math.round(m.p / VA.SWIPE.seconds * 100)}%)`);
      return;
    }
    case 'escape': {
      if (inside) { setText(s, '(out the front door)'); return; }
      if (!R.spawned && door) { R.spawned = true; spawnNear(g, ['bouncer', 'bouncer', 'bouncer'], door.x, door.z + 8, 6); toast('\ud83d\udeaa Three of Thorne\u2019s bouncers come out after you.', 2600); }
      const d = door ? Math.hypot(info.x - door.x, info.z - door.z) : 999, left = g.debug.agents().filter(a => a.type === 'bouncer').length;
      setText(s, `(${Math.round(d)}/70 m, or drop them: ${left} left)`);
      if (d > 70 || (R.spawned && left === 0)) { toast('\ud83c\udfc3 Clear. Ines will want that slate.', 2400); return nextStep(g); }
      return;
    }
    case 'chase': {
      if (inside) { setText(s, '(step outside)'); return; }
      const C = R.chase; if (!C) return; const goal = C.pts[C.i], gp = C.group.position, dx = goal.x - gp.x, dz = goal.z - gp.z, d = Math.hypot(dx, dz);
      const st = Math.min(d, s.speed * dt); gp.x += dx / (d || 1) * st; gp.z += dz / (d || 1) * st; gp.y = groundY(app); C.group.rotation.y = Math.atan2(-dx, -dz);
      if (tg) { tg.x = gp.x; tg.z = gp.z; }
      const px = app.surface.info.x, pz = app.surface.info.z, pd = Math.hypot(gp.x - px, gp.z - pz), r = VA.chaseTick(C, dt, pd); C.t = r.t;
      if (r.stopped) { cleanup(); toast('\ud83d\udca5 You run him off the road. Fuel cans everywhere, nobody lit. He talks: Thorne, all the way up.', 4200); return nextStep(g); }
      if (d < 0.6) { C.i++; if (C.i >= C.pts.length) { cleanup(); return failJob(g, 'He made Olympus Row. Thorne\u2019s lawyers will have him out by breakfast.'); } }
      setText(s, pd <= VA.CHASE.close ? `(alongside: ${Math.round(r.t / VA.CHASE.hold * 100)}%)` : `(${Math.round(pd)} m)`);
      return;
    }
    case 'vote': {
      if (!L) { setText(s, inside ? '' : '(go inside)'); return; }
      const near = Math.hypot(L.x - 8.8, L.z + 6.1) < 2.4; setText(s, near ? '' : '(VIP room, back corner)');
      if (near && R.pickFor !== key && !sheetOpen()) {
        R.pickFor = key; const cr = g.progress.credits;
        openSheet('Sable', 'Sable: Ines wants my girls on her side. I owe the Deimos Lockup 2,500, and Vik Dorran holds the paper. Make one of those go away, sugar.', [
          { id: 'pay', label: 'Pay the Deimos Lockup debt (2,500 cr)', disabled: cr < 2500, on: () => { if (g.debug.quest()?.step !== q.step || !g.spend(2500)) return false; g.setFlag(`story:${q.id}:paid_sable`); closeSheet(); toast('\ud83d\udcac Sable: Paid in full. Look at you.', 3000); nextStep(g); } },
          { id: 'pit', label: 'Lean on Vik Dorran at the Rust Pit (best 2 of 3)', on: () => { if (g.debug.quest()?.step !== q.step) return false; closeSheet(); toast('\ud83d\udcac Sable: Vik fights Thursdays and every other day. Rust Pit, Red Tape Flats.', 3600); nextStep(g); } }]);
      }
      if (!near && R.pickFor === key) { R.pickFor = null; closeSheet(); }
      return;
    }
    case 'pit': {
      if (inside) { setText(s, '(step outside)'); return; }
      const P = R.pit, d = world.lastDuel; setText(s, `(${S.pitWins}-${S.pitLosses})`);
      if (P.live && !world.inDuel && d && d !== P.seen) {
        P.live = false; P.seen = d; const res = VA.pitResult(S, !!d.win); save();
        if (res === 'won') { toast('\ud83e\udd4a Vik Dorran taps the mat. "The paper\u2019s yours. Tell Sable we\u2019re square."', 4200); return nextStep(g); }
        if (res === 'lost') return failJob(g, 'Vik Dorran took two of three.');
        toast(d.win ? '\ud83e\udd4a Round to you. Again.' : '\ud83e\udd4a Vik takes that one. Again.', 2400);
      }
      return;
    }
    case 'handover': { if (!L) setText(s, inside ? '' : '(go inside)'); else setText(s, Math.hypot(L.x - WING.handover.x, L.z - WING.handover.z) < WING.handover.r ? '(tap Hand over)' : ''); return; }
    case 'defeat': {
      if (!R.boss) return; const a = g.debug.agents().find(x => x.type === 'thornesuit'); if (!a) return;
      const ph = VA.bossPhase(a.hp / R.boss.max);
      if (ph > R.boss.phase) { R.boss.phase = ph; spawnNear(g, ph === 2 ? ['goon', 'goon'] : ['enforcer', 'enforcer', 'goon'], a.x, a.z, 10, 'varc');
        toast(ph === 2 ? '\u2699\ufe0f Thorne\u2019s shoulder guns fold out. His crew pours out of the cars.' : '\ud83d\udd25 The suit is sparking. Thorne screams for his last men.', 3200); }
      setText(s, `(suit ${Math.max(0, Math.round(a.hp / R.boss.max * 100))}% \u00b7 phase ${R.boss.phase}/3)`);
      return;
    }
  }
}
// Pit bouts: started from the context of the step (a 🥊 button would need index.html; the step starts it when you're in the cage)
function pitTick(app) {
  const g = app.game || app.surface?.game, q = g?.debug?.quest(); if (!q || q.id !== IDS[3] || mine(q.id).steps[q.step]?.type !== 'pit' || !R.pit || R.pit.live) return;
  const w = app.surface.world, h = w.colonyAt([-292, -68]), i = app.surface.info; if (w.inside || i.driving || w.inDuel) return;
  if (Math.hypot(i.x - h.x, i.z - h.z) > 6) return;
  if ((w.wanted | 0) > 0) { if (performance.now() - (R.pitWarn || 0) > 5000) { R.pitWarn = performance.now(); toast('Lose the heat first: the Pit doesn\u2019t open for wanted faces.', 2400); } return; }
  let r = null; try { r = w.challenge('fists', 0, null, { as: { name: 'Vik Dorran', tough: 1.25, dmg: 1.1, purse: 0, label: '\ud83e\udd4a VIK DORRAN \u00b7 LOAN SHARK' }, tag: { varc: true, n: S.pitWins + S.pitLosses + 1 } }); } catch (e) { r = { ok: false, msg: e.message }; }
  if (r?.ok) { R.pit.live = true; R.pit.seen = w.lastDuel; toast(`\ud83e\udd4a Bout ${S.pitWins + S.pitLosses + 1}: Vik Dorran. Bare knuckles.`, 2400); }
  else if (performance.now() - (R.pitWarn || 0) > 5000) { R.pitWarn = performance.now(); if (r?.msg) toast(r.msg, 2400); }
}

// ---------- owning it: spend tap (8%), day pay, beam, raids, manager lines ----------
const inClub = () => APP()?.surface?.world?.inside?.kind === 'club';
// the poker buy-in is paid while only the panel is up (pokerIsOpen() turns true once the table exists)
const gameOpen = () => { try { return !!(window.__slots?.isOpen || window.__clubGames?.isOpen?.() || pokerIsOpen() || document.getElementById('pokerPanel')?.classList.contains('on')); } catch (e) { return false; } };
const H = { spend: null, raids: null, barkT: 0, wasInside: false };
function hookAll(app) {
  const g = app.surface?.game || app.game;
  if (g && typeof g.spend === 'function' && !g.spend.__varc) { // wager tap: only while you own it, inside the club, with a game open
    const orig = g.spend; const wrapped = function (n) { const ok = orig.apply(this, arguments); try { if (ok && S.owned && n > 0 && inClub() && gameOpen()) { VA.addTake(S, n); save(); } } catch (e) { /* */ } return ok; };
    wrapped.__varc = true; g.spend = wrapped;
  }
  const RD = X().raids; if (RD?.start && !RD.start.__varc) { // ColSec leaves your club alone
    const orig = RD.start; const wrapped = function (o) { try { if (S.owned && o && o.attackers === 'colsec' && Array.isArray(o.pos) && Math.hypot(o.pos[0] + 30, o.pos[1] + 42.5) < 45) return { ok: false, why: 'velvet-owned' }; } catch (e) { /* */ } return orig.apply(this, arguments); };
    wrapped.__varc = true; RD.start = wrapped;
  }
  if (!H.tickReg && typeof X().registerSurfaceTick === 'function') { H.tickReg = true; X().registerSurfaceTick((dt, tc) => { try { surfTick(dt, tc); } catch (e) { console.warn('velvetarc tick', e); } }); }
}
function surfTick(dt, tc) {
  try { const h = X().time?.hour?.(); if (typeof h === 'number' && VA.tickHour(S, h)) save(); } catch (e) { /* */ }
  // the dark green ownership beam + green waypoint tint come from Ben's mars/ownedbeams.js (reads SSX.velvetArc.owned())
  // Ines the manager
  const ins = inClub();
  if (S.owned && ins && !H.wasInside) { H.barkT = 40; setTimeout(() => say(S.till >= 1 ? `Your house, your rules, boss. Till\u2019s at ${Math.floor(S.till)} cr. Office is open.` : 'Your house, your rules, boss.'), 900); }
  H.wasInside = ins;
  if (S.owned && ins) { H.barkT -= dt; if (H.barkT <= 0) { H.barkT = 75 + Math.random() * 45; say(VA.MANAGER_BARKS[Math.floor(Math.random() * VA.MANAGER_BARKS.length)]); } }
}
function say(line) { try { if (X().bark?.('Ines', line, { force: true })) return; } catch (e) { /* */ } toast('\ud83d\udcac Ines: ' + line, 3600); }
const ownedListeners = [];
function emitOwned() { try { X().ownedbeams?.refresh?.(); } catch (e) { /* */ } for (const f of ownedListeners) { try { f(); } catch (e) { /* */ } } try { window.dispatchEvent(new CustomEvent('velvet:owned', { detail: { ending: S.ending } })); } catch (e) { /* */ } }

// ---------- spot hooks for velvetwing.js (labels are read every HUD refresh) ----------
function questStep() { const g = game(), q = g?.debug?.quest(); const s = q && mine(q.id)?.steps[q.step]; return s ? { g, q, s } : null; }
function deskSpot() {
  const g = game(); if (!S.owned || !g) return;
  const r = VA.collect(S); save();
  if (!r.cr) { say('Till\u2019s empty, boss. Go make the floor busy.'); return; }
  g.reward?.(0, r.cr); const st = grantStars(g, frontStars(r.cr)); toast(`\ud83d\udcbc Ines counts it out: +${r.cr} cr${st ? `, +${st}\u2605` : ''}. "The house always wins. You\u2019re the house."`, 4200);
}
function safeSpot() {
  if (!S.owned) return; const C = X().contraband;
  if (!C?.stash) { toast('\ud83d\udd12 The safe is empty and your pockets are clean.', 2400); return; }
  const st = C.stash(), cat = (() => { try { return Object.fromEntries((C.items?.() || []).map(i => [i.id, i])); } catch (e) { return {}; } })();
  const nm = id => `${cat[id]?.icon || '\ud83d\udce6'} ${cat[id]?.name || id}`, btns = [];
  for (const [id, v] of Object.entries(st.items || {})) if (v.qty > 0) btns.push({ id: 'in-' + id, label: `Put in: ${nm(id)} \u00d7${v.qty}`, on: () => { const n = C.remove(id, v.qty) | 0; VA.safeIn(S, id, n); save(); toast(`\ud83d\udd12 ${n} \u00d7 ${nm(id)} in the safe.`, 2400); safeSpot(); } });
  for (const [id, q] of Object.entries(S.safe)) btns.push({ id: 'out-' + id, label: `Take out: ${nm(id)} (${q} in the safe)`, on: () => {
    const cap = (() => { try { const c = C.capacity(); return Math.max(0, (c.max | 0) - (c.used | 0)); } catch (e) { return q; } })(), want = Math.min(q, cap || 0);
    if (want <= 0) { toast('\ud83c\udf92 Your pockets are full. Leave it in the safe.', 2400); return false; }
    const r = C.add(id, want), got = typeof r?.qty === 'number' ? r.qty : r?.ok === false ? 0 : want; VA.safeOut(S, id, got); save(); toast(got ? `\ud83c\udf92 Took ${got} \u00d7 ${nm(id)}.` : 'Your pockets are full.', 2400); safeSpot(); } });
  openSheet('\ud83d\udd12 Office safe', `No limit, no cops. ${VA.safeTotal(S)} units inside.`, btns);
}
function ledgerSpot() { const x = questStep(); toast(x?.s.type === 'swipe' ? '\ud83d\udcd2 Stand here while Grisby looks away. Mina walking past covers you too.' : '\ud83d\udcd2 Grisby\u2019s slate. He watches it like a hawk.', 2800); }
function handoverSpot() {
  const x = questStep(); if (!x || x.s.type !== 'handover') return;
  closeSheet(); toast('\ud83d\udcd2 You hold the slate up so the whole Dome Room can see it. Three years of skim. Thorne goes pale, then red.', 4200);
  setTimeout(() => say('Your buyout\u2019s dead, Marcus. Everybody here just watched you steal from them.'), 2200);
  setTimeout(() => { toast('\ud83d\udcac Thorne: "Fine. We do it the old way. Outside."', 3200); const y = questStep(); if (y?.q.id === x.q.id && y.q.step === x.q.step) nextStep(x.g); }, 4800);
}
const api = {
  owned: () => !!S.owned, showMult: () => (S.owned ? VA.PERKS.showMult : 1), upstairsFree: () => !!S.owned && VA.PERKS.upstairsFree,
  state: () => ({ ...S, safe: { ...S.safe }, ids: IDS.slice(), unlocked: (() => { try { return gate(); } catch (e) { return false; } })() }),
  grisbyLooking: () => VA.grisbyLooking(performance.now() / 1000), ledgerGone: () => !!S.ledgerGone,
  thorneHere: () => questStep()?.s.type === 'handover',
  ledgerOn: () => !S.ledgerGone && questStep()?.s.type === 'swipe', ledgerLabel: () => `\ud83d\udcd2 Ledger slate \u00b7 ${Math.round((R.swipe.p || 0) / VA.SWIPE.seconds * 100)}%`, ledgerSpot,
  handoverOn: () => questStep()?.s.type === 'handover', handoverLabel: () => '\ud83d\udcd2 Hand Thorne the ledger', handoverSpot,
  deskLabel: () => `\ud83d\udcbc Ines \u00b7 manager \u00b7 collect ${Math.floor(S.till)} cr`, deskSpot,
  safeLabel: () => `\ud83d\udd12 Office safe (${VA.safeTotal(S)})`, safeSpot,
  onOwned: f => { if (typeof f === 'function') ownedListeners.push(f); },
  missions: IDS.slice(),
  get runner() { return { key: R.key, swipe: R.swipe.p || 0, tail: R.tail && { x: +R.tail.group.position.x.toFixed(1), z: +R.tail.group.position.z.toFixed(1), i: R.tail.i }, chase: R.chase && { t: R.chase.t || 0, i: R.chase.i }, boss: R.boss, pit: R.pit && { ...R.pit, seen: undefined }, sheet: sheetOpen() }; },
  debug: {
    reset() { S = VA.fresh(); save(); try { X().ownedbeams?.refresh?.(); } catch (e) { /* */ } }, own(ending = 'signed') { VA.own(S, ending); save(); emitOwned(); }, unown() { S.owned = false; save(); try { X().ownedbeams?.refresh?.(); } catch (e) { /* */ } },
    addTake(n) { return VA.addTake(S, n); }, day() { if (!S.owned) return 0; S.days++; S.till = Math.min(VA.TAKE.cap, S.till + VA.TAKE.perDay); save(); return S.till; },
    set(p) { Object.assign(S, p || {}); save(); }, swipeDone() { R.swipe.p = VA.SWIPE.seconds - 0.01; }, chaseDone() { if (R.chase) R.chase.t = VA.CHASE.hold; },
    pick(id) { const b = sheet?.querySelector(`button[data-opt="${id}"]`); if (!b || b.disabled || !sheetOpen()) return false; sheetAt = 0; b.click(); return true; },
    pitWin() { S.pitWins = VA.PIT.wins; save(); const x = questStep(); if (x?.s.type === 'pit') nextStep(x.g); }
  }
};
// ---------- boot ----------
export function initVelvetArc(app) {
  if (!app || app.__velvetArc) return; app.__velvetArc = true;
  let last = performance.now();
  setInterval(() => { const now = performance.now(), dt = Math.min(0.5, (now - last) / 1000); last = now; if (document.hidden) return; try { tick(app, dt); pitTick(app); } catch (e) { console.warn('velvetarc', e); } }, 100);
}
if (typeof window !== 'undefined') {
  (function expose() { if (!window.SSX) { setTimeout(expose, 200); return; } window.SSX.velvetArc = api; })();
  window.__velvetArc = api;
  if (window.__app?.game) initVelvetArc(window.__app);
  else { const bt = setInterval(() => { if (window.__app?.game) { clearInterval(bt); initVelvetArc(window.__app); } }, 120); }
}
