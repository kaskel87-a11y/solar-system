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
      { type: 'goto', at: [-66, 80], r: 7, text: 'Follow the beam to the Rust Belt Loop, west bend' },
      { type: 'tail', at: [-66, 80], path: [[-66, 80], [-112, 40], [-118, -10], [-96, -48], [-60, -62], [-34, -60]], speed: 6.5, close: 6, lose: 60, text: 'Follow the delivery rover to the Velvet. Stay back' },
      { type: 'goto', at: [-30, -59], r: 5, text: 'Follow the beam behind the Velvet and catch the driver' },
      { type: 'pick', at: [-30, -59], who: 'Pell', text: 'Bribe Pell (200 cr) or fight him. Use the card',
        prompt: 'Pell is swapping Ines\u2019s crates for watered ones. "Thorne pays me. Thorne pays everybody."',
        options: [{ id: 'bribe', label: 'Bribe him for the truth (200 cr)', cost: 200, flag: 'pell_bribed', line: 'Pell: Thorne\u2019s orders. His accountant does the swap sheets. Grisby. Don\u2019t tell him I said.' },
          { id: 'beat', label: 'Beat it out of him', flag: 'pell_beat', line: 'Pell: You want it the hard way? Fine!' }] },
      { type: 'pellfight', at: [-30, -60], text: 'Fight Pell behind the Velvet. The beam is on him' }] }),
  M({ id: IDS[1], title: 'Comped', requires: [IDS[0]],
    intro: 'Ines: Thorne\u2019s accountant, Grisby, cooks the Hold\u2019em books in my own Dome Room. Win a hand at his table, then lift his ledger slate when he isn\u2019t looking. Mina will walk past it. Use her.',
    success: 'Ines: Three years of skim. We own him now.', failLine: 'Ines: Grisby saw your face. Lay low and try again.',
    reward: { xp: 60, credits: 900 },
    steps: [
      { type: 'enter', building: CLUB, text: 'Go in the Velvet Airlock. The beam is on the door' },
      { type: 'pokerwin', at: [-30, -34], text: 'Dome Room, east wing: tap Hold\u2019em and win 1 hand' },
      { type: 'swipe', at: [-30, -34], text: 'Stand at Grisby\u2019s slate until it lifts. Beam marks it' },
      { type: 'escape', at: [-30, 45], text: 'Get 70m from the door, or drop Thorne\u2019s bouncers' }] }),
  M({ id: IDS[2], title: 'Closing Time', requires: [IDS[1]],
    intro: 'Ines: Thorne knows. He\u2019s sending men with fuel cans to torch my office. Hold the door. Nobody gets to my back bar.',
    success: 'Ines: He tried to burn me out. So we take everything.', failLine: 'Ines: Smoke damage I can fix. Go again.',
    reward: { xp: 90, credits: 1200 },
    steps: [
      { type: 'goto', at: [-30, -24], r: 7, text: 'Follow the beam to the Velvet\u2019s front door' },
      { type: 'defeat', at: [-30, -16], wave: ['goon', 'goon', 'enforcer'], text: 'Fight the first arsonists outside the door' },
      { type: 'defeat', at: [-30, -16], wave: ['goon', 'enforcer', 'enforcer'], text: 'Fight the second wave outside the door' },
      { type: 'chase', at: [-44, -24], path: [[-44, -24], [-24, -70], [-12, -160], [-4, -260], ROW_END], speed: 9.5, text: 'Get in a ride. Stay on the arsonist\u2019s rover' }] }),
  M({ id: IDS[3], title: 'Upstairs Vote', requires: [IDS[2]],
    intro: 'Ines: I need Upstairs on side. Sable runs the girls and the girls run the floor. She\u2019ll want something. She always wants something.',
    success: 'Sable: Fine, sugar. My girls follow the money, and the money\u2019s you.', failLine: 'Ines: Vik put you on the canvas. Go back when you can stand.',
    reward: { xp: 120, credits: 1500 },
    steps: [
      { type: 'enter', building: CLUB, text: 'Go in the Velvet Airlock. The beam is on the door' },
      { type: 'vote', at: [-30, -34], text: 'VIP room, back wall: talk to Sable at Upstairs' },
      { type: 'pit', at: [-292, -68], text: 'Walk into the Rust Pit cage. Fists, best 2 of 3' }] }),
  M({ id: IDS[4], title: 'House Always Wins', requires: [IDS[3]],
    intro: 'Ines: Thorne\u2019s coming tonight with a buyout and a crew. He thinks I can\u2019t stop him. Bring the ledger. Hand it to him in front of everybody.',
    success: 'Ines: Boss. Pour yourself one. On the house. Which is yours.', failLine: 'Ines: He\u2019s still standing. So are we. Again.',
    reward: { xp: 400, credits: 5000 },
    steps: [
      { type: 'enter', building: CLUB, text: 'Go in the Velvet Airlock. The beam is on the door' },
      { type: 'handover', at: [-30, -34], text: 'Dome Room: walk to Thorne and tap Hand over' },
      { type: 'defeat', at: [-30, -14], wave: ['thornesuit'], text: 'Fight Thorne\u2019s suit out front. The beam marks him' },
      { type: 'pick', at: [-30, -14], who: 'Marcus Thorne', text: 'Choose: he signs the deed, or he goes to Deimos',
        prompt: 'Thorne is on his knees in the dust, suit smoking. The deed is in his breast pocket.',
        options: [{ id: 'sign', label: 'He signs the deed over (at gunpoint)', flag: 'thorne_signed', line: 'Thorne: Take it. It never made money anyway. ...It made a lot of money.' },
          { id: 'space', label: 'Out the airlock: next ore hauler to Deimos', flag: 'thorne_spaced', line: 'Brick: One passenger, economy, no return. He\u2019ll live. He\u2019ll hate Deimos.' }] }] })
];
for (const q of MISSIONS) GM.registerMission(q);
function gate() { // re-register mission 1 without the lock once Ines would talk business
  const g = game(), bottles = (() => { try { return X().velvetDeal?.state?.()?.bottles | 0; } catch (e) { return 0; } })(), stars = g?.progress?.xp || 0;
  const open = VA.unlocked(bottles, stars), q = MISSIONS[0], want = open ? [] : [LOCKED];
  if (q.requires.length !== want.length) { q.requires = want; GM.registerMission(q); }
  if (open && !S.hinted && g && !g.progress.quests?.[IDS[0]]?.everDone) { S.hinted = true; save(); radio('Ines: You\u2019ve been good for my bar. Come see me in the VIP room. Five jobs, and the Velvet is yours.', 'Ines'); try { offerBeam(); } catch (e) { /* */ } }
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
function showStep(s, line) { if (!s || !line) return; s._base = line; s.text = line; }
function aimAt(tg, x, z) { if (tg && Number.isFinite(x) && Number.isFinite(z)) { tg.x = x; tg.z = z; } }
function indoorsAim(on) { try { document.body.classList.toggle('ines-aim', !!on); } catch (e) { /* */ } }
// room-local spot -> world xz (the minimap and the ➤ arrow use this; the column sits on the ground under the club)
function roomAt(world, lx, lz) {
  const ins = world?.inside;
  if (!ins || ins.kind !== 'club' || !Number.isFinite(ins.ax)) return null;
  return { x: ins.ax + lx, z: ins.az + lz };
}
function spawnNear(g, types, x, z, r = 14, src = 'quest') {
  const room = Math.min((MOBILE ? 3 : 5) - ours(g).length, types.length); if (room <= 0 || !g.hostiles) return 0;
  return g.hostiles(types.slice(0, room), x, z, { r, src, faction: 'velvetarc' });
}
function local(app) { // player position in club room-local metres (null outside the Velvet)
  const w = app.surface.world, ins = w.inside, i = app.surface.info; if (!ins || ins.kind !== 'club' || !i?.inside) return null;
  return { x: i.x - ins.ax, z: i.z - ins.az };
}
const flagged = (g, q, f) => g.flag(`story:${q}:${f}`);
function cleanup() {
  closeSheet(); indoorsAim(false); R.pickFor = null;
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
  R.sawBouncer = false;
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
  if (performance.now() - (R.gateT || 0) > 1000) { R.gateT = performance.now(); try { gate(); } catch (e) { /* */ } try { hookAll(app); } catch (e) { console.warn('velvetarc hooks', e); } if (app.state?.onSurface) { try { maybeBrief(app); } catch (e) { /* */ } } }
  if (!app.state?.onSurface) return;
  const q = g.debug.quest(), def = q && mine(q.id);
  if (R.qid && (!q || q.id !== R.qid)) { const p = R.qid; R.qid = null; R.key = null; questEnded(app, g, p); }
  if (!q || !def) return;
  R.qid = q.id; const s = def.steps[q.step]; if (!s) return;
  const key = `${q.id}:${q.step}`;
  if (key !== R.key) {
    const prev = R.key; R.key = key; startStep(app, g, q, s);
    if (g.debug.quest()?.step !== q.step) return;
    const line = s.text || s.prompt || '';
    toast(prev ? `Step done. Next: ${line}` : line, prev ? 3600 : 3200);
  }
  const info = app.surface.info, world = app.surface.world, inside = !!(info?.inside && world.inside), tg = g.debug.target(), L = local(app);
  const door = world.doorFor?.(CLUB);
  indoorsAim(false);
  switch (s.type) {
    case 'pick': {
      if (inside) { showStep(s, 'Step outside. Then use the card: bribe or fight.'); if (door) aimAt(tg, door.x, door.z); return; }
      showStep(s, 'Use the card: bribe him, or fight him.');
      if (R.pickFor !== key) pickSheet(g, q, s, key);
      return;
    }
    case 'tail': {
      if (inside) { showStep(s, 'Step outside. The beam is the delivery rover.'); if (door) aimAt(tg, door.x, door.z); return; }
      const T = R.tail; if (!T) return; const goal = T.pts[T.i], gp = T.group.position, dx = goal.x - gp.x, dz = goal.z - gp.z, d = Math.hypot(dx, dz);
      const st = Math.min(d, s.speed * dt); gp.x += dx / (d || 1) * st; gp.z += dz / (d || 1) * st; gp.y = groundY(app); T.group.rotation.y = Math.atan2(-dx, -dz);
      if (tg) { tg.x = gp.x; tg.z = gp.z; }
      if (d < 0.6) { T.i++; if (T.i >= T.pts.length) { cleanup(); toast('\ud83d\ude9a The rover backs up behind the Velvet. Somebody starts unloading.', 3000); return nextStep(g); } }
      const pd = Math.hypot(gp.x - info.x, gp.z - info.z);
      T.seen = pd < s.close ? T.seen + dt : Math.max(0, T.seen - dt); T.lost = pd > s.lose ? T.lost + dt : 0;
      showStep(s, pd < s.close ? 'Too close. Fall back. The beam is the rover.' : pd > s.lose - 10 ? 'Losing the rover. The beam is on it. Catch up.' : `Follow the delivery rover. Stay back. ${Math.round(pd)} m.`);
      if (T.seen > 3) { cleanup(); return failJob(g, 'Pell made you. Trail\u2019s cold.'); }
      if (T.lost > 7) { cleanup(); return failJob(g, 'You lost the rover. Trail\u2019s cold.'); }
      return;
    }
    case 'pellfight': {
      if (inside) { showStep(s, 'Step outside. Pell is behind the club.'); if (door) aimAt(tg, door.x, door.z); return; }
      const c = world.colonyAt(s.at);
      if (!R.spawned) {
        aimAt(tg, c.x, c.z);
        showStep(s, 'Follow the beam behind the Velvet. Pell is there.');
        if (Math.hypot(c.x - info.x, c.z - info.z) < 40) { if (spawnNear(g, ['pell'], c.x, c.z, 5) > 0) R.spawned = true; }
        return;
      }
      const pell = g.debug.agents().find(a => a.type === 'pell');
      if (!pell) { toast('Pell, from the dirt: "Grisby! Thorne\u2019s accountant! He does the swap sheets!"', 4200); return nextStep(g); }
      aimAt(tg, pell.x, pell.z);
      showStep(s, 'Fight Pell. The beam is on him.');
      return;
    }
    case 'pokerwin': {
      if (!L) { showStep(s, 'Go in the Velvet. Beam is on the door.'); if (door) aimAt(tg, door.x, door.z); return; }
      const table = roomAt(world, WING.table.x, WING.table.z); if (table) { aimAt(tg, table.x, table.z); indoorsAim(true); }
      const st = (() => { try { return pokerIsOpen() ? pokerState() : null; } catch (e) { return null; } })();
      if (!st) { R.hand = null; const d = table ? Math.round(Math.hypot(L.x - WING.table.x, L.z - WING.table.z)) : 0; showStep(s, d ? `Dome Room, east wing. Tap Hold\u2019em at Grisby\u2019s table (${d} m). Win 1 hand.` : 'You are at Grisby\u2019s table. Tap Hold\u2019em and win 1 hand.'); return; }
      const me = st.players.find(p => p.human); if (!me) return;
      if (!R.hand) R.hand = { hand: st.hand, start: me.chips + (me.bet || 0) };
      if (st.hand !== R.hand.hand) { const won = me.chips > R.hand.start; R.hand = { hand: st.hand, start: me.chips + (me.bet || 0) };
        if (won) { toast('\ud83c\udccf Grisby slides the pot your way and sniffs. He opens his slate to log it. Now you know where it lives.', 4200); return nextStep(g); } }
      showStep(s, 'Win this hand. Stay at Grisby\u2019s table.'); return;
    }
    case 'swipe': {
      if (!L) { showStep(s, 'Go back in the Velvet. Beam is on the door.'); if (door) aimAt(tg, door.x, door.z); R.swipe = { p: 0 }; return; }
      const slate = roomAt(world, WING.ledger.x, WING.ledger.z); if (slate) { aimAt(tg, slate.x, slate.z); indoorsAim(true); }
      const atSlate = Math.hypot(L.x - (WING.ledger.x + 0.1), L.z - (WING.ledger.z - 0.8)) < VA.SWIPE.range, now = performance.now() / 1000;
      const m = VA.swipeTick(R.swipe, dt, { atSlate, looking: VA.grisbyLooking(now), screened: minaNear() }); R.swipe = m;
      if (m.state === 'caught') toast('\ud83d\udc40 Grisby looks up. You study the ceiling. Start again.', 2200);
      if (m.state === 'done') { S.ledgerGone = true; save(); toast('\ud83d\udcd2 Slate up your sleeve. Grisby is still counting.', 3000); return nextStep(g); }
      showStep(s, !atSlate ? 'Stand at the beam: Grisby\u2019s slate, Dome Room.' : m.state === 'wait' ? 'He\u2019s looking. Wait, or let Mina walk between you.' : `Lifting the slate\u2026 ${Math.round(m.p / VA.SWIPE.seconds * 100)}%`);
      return;
    }
    case 'escape': {
      const out = world.colonyAt?.(s.at);
      if (inside) { showStep(s, 'Get out the front door. Then follow the beam away from the club.'); if (door) aimAt(tg, door.x, door.z); return; }
      if (out) aimAt(tg, out.x, out.z);
      if (!R.spawned && door) { R.spawned = true; const n = spawnNear(g, ['bouncer', 'bouncer', 'bouncer'], door.x, door.z + 8, 6); if (n > 0) toast('Three of Thorne\u2019s bouncers come out after you.', 2600); }
      const d = door ? Math.hypot(info.x - door.x, info.z - door.z) : 999, left = g.debug.agents().filter(a => a.type === 'bouncer').length;
      if (left > 0) R.sawBouncer = true;
      showStep(s, left > 0 ? `Get 70 m from the door (${Math.round(d)}/70) or drop the bouncers (${left} left).` : `Follow the beam out. ${Math.round(d)}/70 m from the door.`);
      if (d > 70 || (R.sawBouncer && left === 0)) { toast('Clear. Ines will want that slate.', 2400); return nextStep(g); }
      return;
    }
    case 'chase': {
      if (inside) { showStep(s, 'Step outside and get in a ride. The beam is the rover.'); return; }
      const C = R.chase; if (!C) return; const goal = C.pts[C.i], gp = C.group.position, dx = goal.x - gp.x, dz = goal.z - gp.z, d = Math.hypot(dx, dz);
      const st = Math.min(d, s.speed * dt); gp.x += dx / (d || 1) * st; gp.z += dz / (d || 1) * st; gp.y = groundY(app); C.group.rotation.y = Math.atan2(-dx, -dz);
      if (tg) { tg.x = gp.x; tg.z = gp.z; }
      const px = app.surface.info.x, pz = app.surface.info.z, pd = Math.hypot(gp.x - px, gp.z - pz), r = VA.chaseTick(C, dt, pd); C.t = r.t;
      if (r.stopped) { cleanup(); toast('\ud83d\udca5 You run him off the road. Fuel cans everywhere, nobody lit. He talks: Thorne, all the way up.', 4200); return nextStep(g); }
      if (d < 0.6) { C.i++; if (C.i >= C.pts.length) { cleanup(); return failJob(g, 'He made Olympus Row. Thorne\u2019s lawyers will have him out by breakfast.'); } }
      showStep(s, !info.driving ? `Get in a ride. The rover is ${Math.round(pd)} m. Beam is on it.` : pd <= VA.CHASE.close ? `Alongside him. Hold it. ${Math.round(r.t / VA.CHASE.hold * 100)}%` : `Stay on the rover. ${Math.round(pd)} m. Don\u2019t let him reach Olympus Row.`);
      return;
    }
    case 'vote': {
      if (!L) { showStep(s, 'Go in the Velvet. Beam is on the door.'); if (door) aimAt(tg, door.x, door.z); return; }
      const sable = roomAt(world, 8.8, -6.1); if (sable) { aimAt(tg, sable.x, sable.z); indoorsAim(true); }
      const near = Math.hypot(L.x - 8.8, L.z + 6.1) < 2.4;
      showStep(s, near ? 'Talk to Sable. Pay 2,500 cr, or she sends you to the Pit.' : `VIP room, back wall, Upstairs door. ${Math.round(Math.hypot(L.x - 8.8, L.z + 6.1))} m.`);
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
      if (inside) { showStep(s, 'Step outside. The Rust Pit is in Red Tape Flats.'); return; }
      const P = R.pit, d = world.lastDuel;
      showStep(s, `Walk into the Rust Pit cage. Score ${S.pitWins}-${S.pitLosses}. Need 2 wins.`);
      if (P.live && !world.inDuel && d && d !== P.seen) {
        P.live = false; P.seen = d; const res = VA.pitResult(S, !!d.win); save();
        if (res === 'won') { toast('\ud83e\udd4a Vik Dorran taps the mat. "The paper\u2019s yours. Tell Sable we\u2019re square."', 4200); return nextStep(g); }
        if (res === 'lost') return failJob(g, 'Vik Dorran took two of three.');
        toast(d.win ? '\ud83e\udd4a Round to you. Again.' : '\ud83e\udd4a Vik takes that one. Again.', 2400);
      }
      return;
    }
    case 'handover': {
      if (!L) { showStep(s, 'Go in the Velvet. Beam is on the door.'); if (door) aimAt(tg, door.x, door.z); return; }
      const spot = roomAt(world, WING.handover.x, WING.handover.z); if (spot) { aimAt(tg, spot.x, spot.z); indoorsAim(true); }
      const nearH = Math.hypot(L.x - WING.handover.x, L.z - WING.handover.z) < WING.handover.r;
      showStep(s, nearH ? 'Tap Hand over on the button.' : `Dome Room. Walk to Thorne. ${Math.round(Math.hypot(L.x - WING.handover.x, L.z - WING.handover.z))} m.`);
      return;
    }
    case 'defeat': {
      if (inside) { showStep(s, 'Step outside. The fight is at the beam by the door.'); if (door) aimAt(tg, door.x, door.z + 6); return; }
      if (!R.boss) return; const a = g.debug.agents().find(x => x.type === 'thornesuit'); if (!a) return;
      const ph = VA.bossPhase(a.hp / R.boss.max);
      if (ph > R.boss.phase) { R.boss.phase = ph; spawnNear(g, ph === 2 ? ['goon', 'goon'] : ['enforcer', 'enforcer', 'goon'], a.x, a.z, 10, 'varc');
        toast(ph === 2 ? '\u2699\ufe0f Thorne\u2019s shoulder guns fold out. His crew pours out of the cars.' : '\ud83d\udd25 The suit is sparking. Thorne screams for his last men.', 3200); }
      aimAt(tg, a.x, a.z);
      showStep(s, `Fight Thorne\u2019s suit. ${Math.max(0, Math.round(a.hp / R.boss.max * 100))}% left. Phase ${R.boss.phase}/3.`);
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
  if (g && typeof g.talk === 'function' && !g.talk.__varc) { // first talk with Ines says what she is for, without eating the job offer on the radio
    const orig = g.talk;
    const wrapped = function (contact) {
      const r = orig.apply(this, arguments);
      try {
        if (contact === 'Ines' && !S.owned && !S.briefed) {
          S.briefed = true; save();
          setTimeout(() => toast('Ines: Thorne owns this club. ' + VA.unlockHint(bottlesNow(), starsNow()) + ' Five jobs after that, and the Velvet is yours. \u2630 \u2192 \ud83c\udf78 The Velvet.', 4200), 700);
        }
      } catch (e) { /* */ }
      return r;
    };
    wrapped.__varc = true; g.talk = wrapped;
  }
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
// ---------- find the arc: Collin asked what Ines is for. The five jobs already end in the deed. This only points at them. ----------
const escH = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function bottlesNow() { try { return X().velvetDeal?.state?.()?.bottles | 0; } catch (e) { return 0; } }
function starsNow() { return game()?.progress?.xp || 0; }
function chain() {
  const qs = game()?.progress?.quests || {};
  const steps = IDS.map(id => ({ id, title: mine(id)?.title || id, done: !!qs[id]?.everDone }));
  const next = steps.find(s => !s.done) || null;
  return { steps, done: steps.filter(s => s.done).length, total: IDS.length, next, active: game()?.info?.quest?.id || null, unlocked: VA.unlocked(bottlesNow(), starsNow()), owned: !!S.owned };
}
function clubPoint() {
  try {
    const w = APP()?.surface?.world;
    const d = w?.doorFor?.('club') || w?.doorFor?.(CLUB);
    if (d && Number.isFinite(d.x) && Number.isFinite(d.z)) return { x: d.x, z: d.z };
    const c = w?.colonyAt?.([-30, -34]);
    if (c && Number.isFinite(c.x)) return { x: c.x, z: c.z };
  } catch (e) { /* */ }
  return null;
}
function waypoint(quiet) {
  const g = game(), qid = g?.info?.quest?.id;
  if (qid && IDS.includes(qid)) {
    const wp = g.waypoint?.();
    if (wp && Number.isFinite(wp.x)) { try { X().hudx?.setWaypoint?.({ x: wp.x, z: wp.z, label: mine(qid)?.title || 'Ines' }, true); } catch (e) { /* */ } if (!quiet) toast('Follow the beam. That job ends with the Velvet in your name.', 2800); return true; }
  }
  const p = clubPoint();
  if (!p) { if (!quiet) toast('Land on Mars. Ines is at the Velvet Airlock in Ares Junction.'); return false; }
  try { X().hudx?.setWaypoint?.({ x: p.x, z: p.z, label: 'Ines \u00b7 take the Velvet' }, !!quiet); } catch (e) { /* */ }
  return true;
}
function offerBeam() { if (game()?.info?.quest) return false; return waypoint(true); }
function maybeBrief(app) {
  if (S.briefed || S.owned) return;
  const w = app.surface?.world, i = app.surface?.info;
  if (!i || i.name !== 'Mars') return;
  const inside = w?.inside?.kind === 'club';
  let near = false; try { const d = w?.doorFor?.('club'); near = !!(d && Number.isFinite(d.x) && Math.hypot(i.x - d.x, i.z - d.z) < 22); } catch (e) { near = false; }
  if (!inside && !near) return;
  S.briefed = true; save();
  toast('Ines: Thorne owns this club and skims it dry. Sell me ten bottles, or make 3,000 stars. Five jobs after that, and the Velvet is yours. \u2630 \u2192 \ud83c\udf78 The Velvet.', 4800);
  offerBeam();
}
function startNext() {
  const g = game();
  if (!g?.accept) { toast('Land on Mars first.'); return { ok: false }; }
  if (S.owned) { toast('The Velvet is already yours. Collect the till at Ines\u2019s desk.'); return { ok: false, owned: true }; }
  const c = chain();
  if (!c.unlocked) { openGuide(); return { ok: false, locked: true }; }
  if (!c.next) { toast('Every job is done.'); return { ok: false }; }
  if (APP()?.surface?.info?.name !== 'Mars') { toast('Ines: Mars jobs. On Mars.'); return { ok: false }; }
  if (c.active === c.next.id) { waypoint(false); return { ok: true, already: true }; }
  const ok = !!g.accept(c.next.id);
  if (ok) waypoint(true);
  return { ok, id: c.next.id };
}
function openGuide() {
  const c = chain(), b = bottlesNow();
  const rows = c.steps.map(s => (s.done ? '\u2713 ' : '\u00b7 ') + s.title).join('  ');
  const text = c.owned
    ? 'The Velvet Airlock is yours. Ines manages it. The till is at her desk in the east wing: 8% of the floor, plus 400 cr a day, 1 star per 10 cr. The dark green beam marks the club. Upstairs is free, and ColSec leaves the place alone. ' + rows
    : 'Ines runs the back bar. Marcus Thorne owns the club and skims it. Five jobs from her put the deed in your name: a cut of the tables, a daily till, Ines as manager, and the dark green business beam. ' + (c.unlocked ? 'She will talk business in the VIP room.' : VA.unlockHint(b, starsNow())) + ' Jobs ' + c.done + '/' + c.total + (c.next ? '. Next: ' + c.next.title + '.' : '.') + ' ' + rows;
  const buttons = [{ id: 'wp', label: '\ud83d\udccd Beam to Ines', on: () => { waypoint(false); return false; } }];
  if (!c.owned && c.unlocked && c.next) buttons.unshift({ id: 'go', label: (c.active === c.next.id ? '\ud83d\udccd You are on ' : '\u25b6 Start ') + c.next.title, on: () => { const r = startNext(); if (!r?.ok) return false; closeSheet(); } });
  openSheet('Take over the Velvet Airlock', text, buttons);
}
function logHtml() {
  const c = chain();
  const rows = c.steps.map(s => `${s.done ? '\u2705' : '\u00b7'} ${escH(s.title)}`).join('<br>');
  let lead, btns;
  if (c.owned) {
    lead = 'You own it. Ines manages the floor. Collect the till at her desk. The dark green beam marks the club.';
    btns = '<button type="button" class="btn" data-varc="wp">\ud83d\udccd Beam to the Velvet</button>';
  } else if (!c.unlocked) {
    lead = `Ines runs the back bar. Thorne owns the club. ${escH(VA.unlockHint(bottlesNow(), starsNow()))} Then five jobs, and the deed is yours.`;
    btns = '<button type="button" class="btn" data-varc="wp">\ud83d\udccd Beam to Ines</button>';
  } else {
    lead = `Five jobs, then the Velvet is yours: a cut of the floor, a daily till, Ines as manager, dark green beam. Next: ${escH(c.next?.title || 'done')}.`;
    btns = `<button type="button" class="btn" data-varc="go">\u25b6 ${c.active === c.next?.id ? 'On it' : 'Start ' + escH(c.next?.title || '')}</button><button type="button" class="btn" data-varc="wp">\ud83d\udccd Beam</button>`;
  }
  return `<div class="item${c.owned ? ' done' : ''}" id="varcLog"><b>\ud83c\udfdb\ufe0f Take over the Velvet Airlock</b> <small>\u00b7 ${c.done}/${c.total}</small><br>${lead}<br><small>${rows}</small><div class="row">${btns}</div></div>`;
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
  missions: IDS.slice(), logHtml, waypoint, startNext, openGuide, progress: chain,
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
  try {
    if (!document.getElementById('varcCss')) { const css = document.createElement('style'); css.id = 'varcCss'; css.textContent = '#logPanel #varcLog .row button{min-height:48px;flex:1}body.indoors.ines-aim #hxWay.on{display:flex!important}'; document.head.appendChild(css); }
    X().registerMenuItem?.({ id: 'rmVelvet', label: '\ud83c\udf78 The Velvet', onTap: () => openGuide() });
  } catch (e) { console.warn('velvet guide', e); }
  let last = performance.now();
  setInterval(() => { const now = performance.now(), dt = Math.min(0.5, (now - last) / 1000); last = now; if (document.hidden) return; try { tick(app, dt); pitTick(app); } catch (e) { console.warn('velvetarc', e); } }, 100);
}
if (typeof window !== 'undefined') {
  (function expose() { if (!window.SSX) { setTimeout(expose, 200); return; } window.SSX.velvetArc = api; })();
  window.__velvetArc = api;
  if (window.__app?.game) initVelvetArc(window.__app);
  else { const bt = setInterval(() => { if (window.__app?.game) { clearInterval(bt); initVelvetArc(window.__app); } }, 120); }
}
