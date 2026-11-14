// Boss lounge (v7.5.95). After SSX.velvetArc.owned(), the east-wing office chair is yours.
// Sit, and a hired crew member (SSX.crew, Marsmania's roster) walks up with a job.
// Jobs: rob First Junction Trust (SSX.heist), handle a problem on the floor, collect a marker.
// Troublemakers wander in. Throw them out with fists (game.melee, bare hands, no guns indoors).
// Every step has a plain sentence on the edge arrow. Nothing here exists before you own the club.
import * as THREE from 'three';
import { ROSTER } from '../crewcore.js';
import { bearingNdc, fmtRange } from '../hud/guidecore.js';
import { panelTap, tap } from '../racehooks.js';
import * as B from './bossloungecore.js';

const W = () => (typeof window !== 'undefined' ? window : null);
const SSX = () => W()?.SSX;
const APP = () => W()?.__app;
const game = () => APP()?.surface?.game || APP()?.game;
const world = () => APP()?.surface?.world;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toast = (t, ms = 3200) => { try { APP()?.toast?.(t, ms); } catch (e) { /* */ } };

const S = { ui: null, save: null, offer: null, job: null, gen: 0, fighter: null, fig: null, crewFig: null, crewT: 0, troubleT: 0, seenClub: false, hold: 0, marking: null };
let D = B.fresh();

function load() { try { D = B.load(localStorage.getItem(B.KEY)); } catch (e) { D = B.fresh(); } }
function save() { try { localStorage.setItem(B.KEY, JSON.stringify(D)); } catch (e) { /* private mode */ } }
const owned = () => { try { return !!SSX()?.velvetArc?.owned?.(); } catch (e) { return false; } };
const hired = () => { try { return (SSX()?.crew?.state?.()?.crew || []).map(m => m.id); } catch (e) { return []; } };
const inClub = () => world()?.inside?.kind === 'club';
const inBank = () => world()?.inside?.kind === 'bank';
const heist = () => SSX()?.heist;

function localPos() {
  const w = world(), i = APP()?.surface?.info, ins = w?.inside;
  if (!ins || !i?.inside) return null;
  return { x: i.x - ins.ax, z: i.z - ins.az, yaw: i.viewYaw || 0, wx: i.x, wz: i.z };
}
function toWorld(lx, lz) {
  const ins = world()?.inside; if (!ins) return null;
  return { x: ins.ax + lx, z: ins.az + lz };
}

// ---------- sheet ----------
const CSS = `#blSheet{position:fixed;left:0;right:0;bottom:0;z-index:64;display:none;box-sizing:border-box;padding:12px calc(12px + env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) calc(12px + env(safe-area-inset-left));background:#000;color:#fff;border-top:2px solid #fff;max-height:min(42vh,360px);overflow:auto;-webkit-overflow-scrolling:touch;font:15px/1.35 system-ui,sans-serif}
#blSheet.on{display:block}
#blSheet .who{font-weight:800;letter-spacing:.04em;text-transform:uppercase;font-size:12px;opacity:.8}
#blSheet h2{margin:2px 0 6px;font-size:18px}
#blSheet q{display:block;font-style:italic;margin:6px 0}
#blSheet .step{margin:6px 0 8px;padding:8px 10px;border:2px solid #fff;border-radius:10px;font-weight:700}
#blSheet .row{display:flex;flex-wrap:wrap;gap:8px}
#blSheet button{min-height:48px;min-width:120px;flex:1 1 140px;padding:10px 12px;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:800 16px/1.15 system-ui,sans-serif;touch-action:manipulation}
#blAct{display:none;background:#000!important;color:#fff!important;border:3px solid #fff!important;min-height:52px;min-width:160px;padding:8px 14px;border-radius:14px;font:900 16px/1.15 system-ui,sans-serif}
body.bl-job #heistBtn{min-height:48px!important;height:auto!important;background:#000!important;color:#fff!important;border:2px solid #fff!important;font:800 15px/1.15 system-ui,sans-serif!important}`;

function ensureUi() {
  if (S.ui || typeof document === 'undefined') return S.ui;
  const st = document.createElement('style'); st.id = 'blCss'; st.textContent = CSS; document.head.appendChild(st);
  const panel = document.createElement('div'); panel.id = 'blSheet'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Boss lounge');
  panel.innerHTML = '<div class="who"></div><h2></h2><q></q><div class="step"></div><div class="row"></div>';
  document.body.appendChild(panel);
  panelTap(panel, e => { const b = e.target?.closest?.('button'); if (!b || b.disabled) return; if (performance.now() < S.hold) return; act(b.dataset.a); });
  S.ui = panel; return panel;
}
const sheetOn = () => !!S.ui?.classList.contains('on');
function paint(who, title, line, step, buttons) {
  const el = ensureUi(); if (!el) return;
  el.querySelector('.who').textContent = who || '';
  el.querySelector('h2').textContent = title || '';
  el.querySelector('q').textContent = line || '';
  const s = el.querySelector('.step'); s.textContent = step || ''; s.style.display = step ? '' : 'none';
  el.querySelector('.row').innerHTML = buttons.map(b => `<button type="button" data-a="${b.a}">${esc(b.t)}</button>`).join('');
  el.classList.add('on');
  S.hold = performance.now() + 360;
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ }
}
function closeSheet() { S.ui?.classList.remove('on'); S.offer = null; hideCrew(); }

function act(a) {
  if (a === 'close' || a === 'later') { closeSheet(); return; }
  if (a === 'crew') { closeSheet(); try { SSX()?.crew?.open?.(); } catch (e) { /* */ } return; }
  if (a === 'take') return take();
  if (a === 'drop') { drop('You dropped it.'); closeSheet(); return; }
  if (a === 'show') { closeSheet(); return; }
}

// ---------- sit ----------
export function seatLabel() {
  if (!owned()) return '';
  if (S.job) return '🪑 Chair · job on';
  return '🪑 Sit · boss chair';
}
export function sit() {
  if (!owned()) return { ok: false, why: 'The chair is not yours yet.' };
  if (!inClub()) return { ok: false, why: 'The chair is in the Velvet.' };
  if (S.job) {
    paint(`${S.job.name} · crew`, B.JOBS[S.job.id].name, 'You are already on a job.', stepSentence(), [
      { a: 'show', t: 'Show me' }, { a: 'drop', t: 'Drop it' }
    ]);
    showCrew(S.job.who); return { ok: true, busy: true };
  }
  const offer = B.pitch(hired(), Math.random, { heistBusy: !!heist()?.active });
  if (!offer.ok) {
    paint('The chair', 'Boss lounge', offer.why, 'Hire a crew, then sit down again. They bring the jobs.', [
      { a: 'crew', t: '👥 Open Crew' }, { a: 'close', t: 'Close' }
    ]);
    return offer;
  }
  S.offer = offer;
  paint(`${offer.name} · crew`, `${B.JOBS[offer.job].icon} ${B.JOBS[offer.job].name}`, offer.line, `${offer.brief} Pays ${offer.pay} cr.`, [
    { a: 'take', t: 'Take the job' }, { a: 'later', t: 'Not now' }
  ]);
  showCrew(offer.who);
  return { ok: true, offer };
}
function take() {
  const offer = S.offer; if (!offer?.ok) return { ok: false };
  const job = B.accept(offer); if (!job) return { ok: false };
  S.job = job; S.offer = null; S.gen++;
  if (job.id === 'marker') S.marking = markerSpot();
  if (job.id === 'floor') spawnFighter(B.FLOOR[job.floor], 'floor');
  closeSheet();
  document.body.classList.add('bl-job');
  toast(`${job.name}: ${stepSentence()}`, 3400);
  return { ok: true, id: job.id };
}
function drop(why) {
  const n = ++S.gen;
  void n;
  try { const H = heist(), a = H?.active; if (a && a.id === B.HEIST_ID) H.abortHeist('dropped'); } catch (e) { /* */ }
  S.job = null; S.marking = null; clearFighter();
  document.body.classList.remove('bl-job');
  clearAim();
  if (why) toast(why, 2600);
}

// ---------- crew figure ----------
const MAT = {}; const mat = c => (MAT[c] ||= new THREE.MeshLambertMaterial({ color: c }));
let GEO = null;
function person(look, name) {
  GEO ||= { legs: new THREE.BoxGeometry(0.42, 0.85, 0.24), torso: new THREE.BoxGeometry(0.56, 0.72, 0.3), head: new THREE.BoxGeometry(0.28, 0.3, 0.28), hat: new THREE.BoxGeometry(0.34, 0.1, 0.34) };
  const g = new THREE.Group(), add = (geo, c, y) => { const o = new THREE.Mesh(geo, mat(c)); o.position.y = y; g.add(o); };
  add(GEO.legs, look.body, 0.43); add(GEO.torso, look.coat, 1.22); add(GEO.head, look.skin, 1.74); add(GEO.hat, look.hat, 1.96);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const x = cv.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 256, 64); x.strokeStyle = '#fff'; x.lineWidth = 6; x.strokeRect(4, 4, 248, 56);
  x.fillStyle = '#fff'; x.font = '800 36px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(name, 128, 34);
  const tex = new THREE.CanvasTexture(cv), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.position.y = 2.35; sp.scale.set(1.15, 0.29, 1); g.add(sp);
  g.name = 'boss-lounge-' + name; return g;
}
function clubAnchor() {
  const ins = world()?.inside, scene = APP()?.surface?.scene;
  if (!ins || ins.kind !== 'club' || !scene || !Number.isFinite(ins.ax)) return null;
  return { scene, x: ins.ax, y: Number.isFinite(ins.floor) ? ins.floor : 0, z: ins.az };
}
function put(fig, lx, lz) {
  const a = clubAnchor(); if (!a || !fig) return false;
  if (fig.parent !== a.scene) a.scene.add(fig);
  fig.position.set(a.x + lx, a.y, a.z + lz);
  return true;
}
function showCrew(id) {
  const r = ROSTER.find(q => q.id === id); if (!r || !clubAnchor()) return;
  hideCrew();
  S.crewFig = person(r.look, B.crewName(id));
  S.crewT = 0; put(S.crewFig, B.OFFICE_DOOR.x, B.OFFICE_DOOR.z);
}
function hideCrew() { S.crewFig?.parent?.remove(S.crewFig); S.crewFig = null; }
function moveCrew(dt) {
  const f = S.crewFig; if (!f) return;
  S.crewT += dt; const k = Math.min(1, S.crewT / 1.15);
  const x = B.OFFICE_DOOR.x + (B.CREW_AT.x - B.OFFICE_DOOR.x) * k, z = B.OFFICE_DOOR.z + (B.CREW_AT.z - B.OFFICE_DOOR.z) * k;
  put(f, x, z);
  f.rotation.y = Math.atan2(B.SEAT.x - x, B.SEAT.z - z);
}

// ---------- fighters (floor job + troublemakers) ----------
function spawnFighter(def, kind) {
  clearFighter();
  if (!def || !clubAnchor()) return null;
  const look = kind === 'floor'
    ? { body: 0x2a1a14, coat: 0x6a1a1a, hat: 0x111, skin: 0xc49a74 }
    : { body: 0x222, coat: 0x8a3a2a, hat: 0x1a1a1a, skin: 0xd8b08c };
  const fig = person(look, def.name);
  put(fig, def.x, def.z);
  fig.rotation.y = Math.PI;
  S.fighter = { ...def, kind, hits: 0, fig };
  return S.fighter;
}
function clearFighter() {
  S.fighter?.fig?.parent?.remove(S.fighter.fig); S.fighter = null;
  document.body.classList.remove('lounge-fists');
}
function fighterWorld() {
  const f = S.fighter; if (!f) return null;
  return { x: f.fig.position.x, z: f.fig.position.z, hits: f.hits, name: f.name };
}

export function fists() {
  return !!(owned() && inClub() && S.fighter && !S.fighter.down && S.fighter.hits < B.TOSS_HITS);
}
export function fistAt() { return fists() ? fighterWorld() : null; }
export function fistsNear() {
  if (!fists()) return false;
  const L = localPos(), w = fighterWorld(); if (!L || !w) return false;
  return Math.hypot(L.wx - w.x, L.wz - w.z) < 6.5;
}
// game.melee calls this with the swing direction. Bare fists only. Returns true on a hit.
export function punch(px, pz, fx, fz) {
  const f = S.fighter, w = fighterWorld(); if (!f || !w || f.hits >= B.TOSS_HITS) return false;
  if (f.down) return false;
  if (!B.inFront(px, pz, fx, fz, w.x, w.z)) return false;
  const r = B.strike(f.hits); f.hits = r.hits;
  f.fig.position.x += fx * 0.28; f.fig.position.z += fz * 0.28;
  if (r.down) ko(f); else toast(`${f.name} ${f.hits}/${B.TOSS_HITS}. Keep punching.`, 1600);
  return true;
}
function ko(f) {
  if (f.down) return; f.down = true; f.hits = B.TOSS_HITS;
  f.fig.rotation.z = 1.15; f.fig.position.y = 0.15;
  const kind = f.kind, name = f.name;
  setTimeout(() => {
    if (f.paid) return; f.paid = true;
    if (S.fighter === f) clearFighter();
    if (kind === 'floor' && S.job?.id === 'floor') payJob();
    else if (kind === 'trouble') {
      const n = B.noteToss(D); save();
      try { game()?.reward?.(0, B.TOSS_PAY); } catch (e) { /* */ }
      toast(`${name} is out the door. +${n.cr} cr.`, 2800);
      S.troubleT = 0;
    }
  }, 650);
}

// ---------- bank heist (SSX.heist, First Junction Trust) ----------
const RG = { on: false, safe: null, site: null };
function relOf(p) {
  const c = world()?.colonyAt?.([0, 0]); if (!c || !p) return null;
  return { x: +(p.x - c.x).toFixed(2), z: +(p.z - c.z).toFixed(2) };
}
function bankDef() {
  const w = world(); const d = w?.doorList?.().find(x => x.kind === 'bank'); const door = relOf(d); if (!door) return null;
  const cam = (id, x, z, phase) => ({ id, x, z, yaw: Math.atan2(door.x - x, door.z - z), fov: 70, range: 12, sweep: 28, phase, label: 'the Trust camera' });
  return {
    id: B.HEIST_ID, title: 'First Junction Trust', world: 'Mars', rel: 'colony', payout: false,
    site: { x: door.x, z: door.z, r: 10 }, escapeR: 55,
    door, safe: { x: door.x, z: door.z - 3.2, tier: 'hard', time: 50 },
    power: { x: door.x - 8, z: door.z + 4, s: 40 },
    cameras: [cam('bl-cam0', door.x - 6, door.z + 6, 0), cam('bl-cam1', door.x + 6, door.z + 5, 1.4), cam('bl-cam2', door.x + 1, door.z + 11, 2.2)],
    alarm: { wanted: B.BANK_WANTED, responseS: 16, failAt: null },
    loot: { credits: B.JOBS.bank.pay },
    guards: [{ id: 'bl-door', x: door.x - 4, z: door.z + 3, route: [{ x: door.x + 4, z: door.z + 3 }] }]
  };
}
function startBank() {
  const H = heist(); if (!H?.registerHeist || !H.startHeist) { drop('The bank job is not available.'); return; }
  if (H.active) { drop('A heist is already running. Finish it, then sit down again.'); return; }
  let def; try { def = bankDef(); } catch (e) { def = null; }
  if (!def) { drop('First Junction Trust is not on the map.'); return; }
  try { H.registerHeist(def); } catch (e) { console.warn('bosslounge heist', e); drop('Could not set up the bank.'); return; }
  const gen = S.gen;
  S.job.step = 'door';
  try {
    H.startHeist(def.id).then(res => {
      if (gen !== S.gen || S.job?.id !== 'bank') return;
      if (res?.success) payJob();
      else { const why = res?.fail || 'The bank job fell apart.'; S.job = null; S.gen++; document.body.classList.remove('bl-job'); clearAim(); toast(`Bank job blown. ${why}`, 3600); }
    }).catch(e => { console.warn('bosslounge start', e); if (gen === S.gen) drop('Could not start the bank job.'); });
  } catch (e) { drop('Could not start the bank job.'); }
}
function gateBank() {
  const H = heist(), a = H?.active; if (!a || a.id !== B.HEIST_ID || !a.w) { RG.on = false; return; }
  const W = a.w;
  if (!RG.on) { RG.on = true; RG.safe = { x: W.safe.x, z: W.safe.z }; RG.site = { x: W.site.x, z: W.site.z }; }
  const ins = world()?.inside, bank = inBank();
  if (bank && ins) { W.safe.x = ins.ax + 6.4; W.safe.z = ins.az - 5.25; W.site.x = ins.ax; W.site.z = ins.az; }
  else if (RG.safe) { W.safe.x = RG.safe.x; W.safe.z = RG.safe.z; W.site.x = RG.site.x; W.site.z = RG.site.z; }
  const stage = a.stage;
  if (stage === 'crack' || stage === 'breakin') S.job.step = 'crack';
  else if (stage === 'escape') S.job.step = 'out';
  else if (stage === 'clean') S.job.step = 'clean';
  else S.job.step = 'door';
}

// ---------- marker ----------
function markerSpot() {
  const d = world()?.doorFor?.('club') || world()?.doorList?.().find(x => x.kind === 'club');
  if (!d) return { x: 0, z: 0 };
  let x = d.x + 14, z = d.z + 6;
  try { const f = world().freeSpot?.(x, z, 1.2); if (f) { x = f.x; z = f.z; } } catch (e) { /* */ }
  return { x, z };
}
function ensureAct() {
  const sb = document.getElementById('surfBtns'); if (!sb || typeof document === 'undefined') return null;
  if (!S.act) {
    S.act = document.createElement('button'); S.act.id = 'blAct'; S.act.className = 'glass'; S.act.type = 'button'; S.act.textContent = '💵 Collect the marker';
    sb.insertBefore(S.act, sb.firstChild); tap(S.act, () => collectMarker());
  }
  return S.act;
}
function collectMarker() {
  if (S.job?.id !== 'marker' || S.job.step !== 'collect') return;
  payJob();
}

// ---------- pay ----------
function payJob() {
  const job = S.job; if (!job) return;
  const p = B.noteJob(D, job); if (!p) return;
  S.job = null; S.gen++; S.marking = null; clearFighter(); RG.on = false;
  document.body.classList.remove('bl-job'); clearAim();
  const btn = S.act; if (btn) btn.style.display = 'none';
  save();
  try { game()?.reward?.(0, p.cr); } catch (e) { /* */ }
  const heat = p.wanted ? ' Lose any stars you still have before the next one.' : '';
  toast(`${p.name} done. +${p.cr} cr.${heat}`, 3600);
}

function stepSentence() {
  const j = S.job; if (!j) return '';
  if (j.id === 'bank') return B.bankStep(j.step);
  if (j.id === 'floor') return B.FLOOR[j.floor]?.step || 'Punch him. Fists.';
  if (j.id === 'marker') return j.step === 'collect' ? 'Tap Collect the marker. He pays. No stars.' : 'Leave the Velvet. The arrow points at the marker outside.';
  return '';
}

// ---------- arrow ----------
function guide() { return SSX()?.guide; }
function clearAim() { try { guide()?.clear?.('lounge'); } catch (e) { /* */ } }
function aimAt(wx, wz, text) {
  const i = APP()?.surface?.info; const g = guide(); if (!i || !g?.aim || !Number.isFinite(wx)) return;
  const dx = wx - i.x, dz = wz - i.z, dist = Math.hypot(dx, dz);
  if (dist < 1.6) { g.aim({ id: 'lounge', label: text, nx: 0, ny: 0.9 }); return; }
  const b = bearingNdc(dx, dz, i.viewYaw || 0);
  g.aim({ id: 'lounge', label: `${text} ${fmtRange(dist)}`, nx: b.nx, ny: b.ny });
}
function aimLocal(lx, lz, text) {
  const w = toWorld(lx, lz); if (!w) { clearAim(); return; }
  aimAt(w.x, w.z, text);
}
function aimJob() {
  if (sheetOn()) { clearAim(); return; }
  const j = S.job;
  if (S.fighter) { const f = S.fighter; aimAt(f.fig.position.x, f.fig.position.z, f.step || stepSentence() || `Punch ${f.name}.`); return; }
  if (!j) { clearAim(); return; }
  const text = stepSentence();
  if (j.id === 'marker') {
    if (inClub()) { j.step = 'walk'; aimLocal(B.LEAVE.x, B.LEAVE.z, text); return; }
    if (S.marking) {
      const i = APP()?.surface?.info, d = Math.hypot((i?.x || 0) - S.marking.x, (i?.z || 0) - S.marking.z);
      if (d < 2.4) j.step = 'collect';
      aimAt(S.marking.x, S.marking.z, stepSentence()); return;
    }
  }
  if (j.id === 'bank') {
    if (j.step === 'leave' || (inClub() && j.step === 'door' && !heist()?.active)) { aimLocal(B.LEAVE.x, B.LEAVE.z, B.bankStep('leave')); return; }
    const a = heist()?.active, w = a?.w;
    if (w && a.id === B.HEIST_ID) {
      const goal = j.step === 'crack' ? w.safe : j.step === 'out' ? w.site : w.door;
      if (j.step === 'clean') { aimAt(w.site.x, w.site.z, B.bankStep('clean')); return; }
      aimAt(goal.x, goal.z, text); return;
    }
    const d = world()?.doorList?.().find(x => x.kind === 'bank');
    if (d) aimAt(d.x, d.z, text);
  }
}

// ---------- trouble ----------
function maybeTrouble(dt) {
  if (!owned() || !inClub() || S.job || S.fighter || sheetOn()) { if (!inClub()) S.troubleT = 0; return; }
  S.troubleT += dt;
  const need = D.tossed ? B.TROUBLE_GAP : B.TROUBLE_FIRST;
  if (S.troubleT < need) return;
  const pick = B.TROUBLE[D.tossed % B.TROUBLE.length];
  spawnFighter(pick, 'trouble');
  toast(`${pick.name} is in the club. ${pick.step}`, 3200);
}

// ---------- tick ----------
function tick(dt) {
  if (!owned()) {
    if (S.job || S.fighter || sheetOn()) { closeSheet(); drop(''); }
    document.body.classList.remove('lounge-fists', 'bl-job');
    return;
  }
  if (sheetOn()) moveCrew(dt);
  else if (!S.job) hideCrew();
  if (S.job?.id === 'bank') {
    if (S.job.step === 'leave' && !inClub()) startBank();
    if (heist()?.active?.id === B.HEIST_ID) gateBank();
  }
  if (S.job?.id === 'marker') {
    const btn = ensureAct();
    const show = S.job.step === 'collect' && !inClub();
    if (btn) btn.style.display = show ? 'block' : 'none';
  } else if (S.act) S.act.style.display = 'none';
  maybeTrouble(dt);
  const near = fistsNear();
  document.body.classList.toggle('lounge-fists', near);
  if (S.fighter || S.job) aimJob();
  else clearAim();
  if (inClub() && !S.seenClub) { S.seenClub = true; setTimeout(() => { if (owned() && inClub()) toast('Your chair is in the office, west wall. Sit. Your crew comes to you.', 4200); }, 700); }
}

function boot() {
  if (!W()?.SSX?.registerSurfaceTick || !APP()) { setTimeout(boot, 300); return; }
  if (W().SSX.bosslounge) return;
  load();
  W().SSX.bosslounge = api;
  W().SSX.registerSurfaceTick((dt) => { try { tick(dt); } catch (e) { console.warn('bosslounge', e); } });
}
const api = {
  version: 1, key: B.KEY, owned, seatLabel, sit,
  fists, fistsNear, fistAt, punch,
  step: stepSentence,
  state: () => ({ owned: owned(), job: S.job ? { ...S.job } : null, offer: S.offer ? { ...S.offer } : null, sheet: sheetOn(), fighter: S.fighter ? { name: S.fighter.name, kind: S.fighter.kind, hits: S.fighter.hits, x: +S.fighter.fig.position.x.toFixed(2), z: +S.fighter.fig.position.z.toFixed(2) } : null, tossed: D.tossed, jobs: D.jobs, cr: D.cr, heist: heist()?.active?.id || null }),
  close: closeSheet,
  debug: {
    reset() { D = B.fresh(); save(); drop(''); closeSheet(); S.troubleT = 0; S.seenClub = false; return true; },
    spawn(id) { const t = B.TROUBLE.find(x => x.id === id) || B.TROUBLE[0]; return !!spawnFighter(t, 'trouble'); },
    hit() { const w = fighterWorld(), L = localPos(); if (!w || !L) return false; const dx = w.x - L.wx, dz = w.z - L.wz, n = Math.hypot(dx, dz) || 1; return punch(L.wx, L.wz, dx / n, dz / n); },
    offer(job, floor) { const ids = hired(); const who = ids[0] || 'dex'; const o = { ok: true, who, name: B.crewName(who), job, floor: floor || 'rowdy', line: 'Test.', brief: 'Test.', pay: B.JOBS[job].pay, wanted: B.JOBS[job].wanted }; S.offer = o; return take(); },
    preview(job = 'bank') {
      const who = hired()[0]; if (!who || !owned()) return false;
      const rng = () => job === 'floor' ? 0.34 : job === 'marker' ? 0.7 : 0;
      const offer = B.pitch([who], rng);
      if (!offer.ok) return false;
      S.offer = offer;
      paint(`${offer.name} · crew`, `${B.JOBS[offer.job].icon} ${B.JOBS[offer.job].name}`, offer.line, `${offer.brief} Pays ${offer.pay} cr.`, [
        { a: 'take', t: 'Take the job' }, { a: 'later', t: 'Not now' }
      ]);
      showCrew(who); S.crewT = 5; moveCrew(0); return offer;
    }
  }
};
if (typeof window !== 'undefined') boot();
export default api;
