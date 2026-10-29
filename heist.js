// Heist mechanics (v7.5 Mars city): case -> break in -> crack safe -> escape -> lose the heat.
// Generic and data-driven: Grok Bot's district/mansion/bank builder calls the small API below; this module builds no
// district geometry (the ?heisttest=1 sample is test-only throwaway). No police/security AI, no chases: alarms raise
// world wanted via heisthooks.js, and the getaway is published as the `heist:escape` event for pursuit.js.
//
//   import { heist } from './heist.js'   (also window.SSX.heist / window.__app.heist once initHeist runs)
//   heist.safeCrack({ tier | difficulty, time, title }) -> Promise<{ success, ok, reason, time, noise, tier, tumblers }>
//   heist.addCamera({ id, x, z, yaw, fov, range, sweep, level, world, rel }) / heist.removeCamera(id) / heist.disableCamera(id, s)
//   heist.alarm(level, why)                            -> raises wanted (setWanted / crime), emits 'alarm'
//   heist.registerHeist(def) / heist.startHeist(id)    -> Promise<{ success, loot, fail, stage, t }>
//   heist.fromMansion(building, originAj, extra)       -> def from Steve's gated-community.json
//   heist.on(evt, fn) / off(evt, fn); every event is also window CustomEvent `heist:<evt>` with the same detail.
//   v7.5.4: def.guards [{ id, x, z, route:[{x,z}] }] patrol and answer alarms (guards.js); heist.guards.* / heist.camBlocked / heist.los
import * as THREE from 'three';
import { normHeist, createRun, escapePayload, heistFromMansion, SAFE_TIERS, applyTipTo, tipSafeOpts, heistCovers } from './heistcore.js';
import { safeCrack, safeState, safeOpen, cancelSafe } from './safecrack.js';
import { createCameras } from './cameras.js';
import { raiseAlarm, heat, securityNear, toWorld, isIndoors, payout, addMenuItem, tap } from './heisthooks.js';
import { createGuards } from './guards.js';
import { losClear, boxHit, pushOut, losCache } from './heistlos.js';

const listeners = {};
function emit(name, detail) {
  for (const fn of listeners[name] || []) { try { fn(detail); } catch (e) { console.error('heist listener', name, e); } }
  try { window.dispatchEvent(new CustomEvent('heist:' + name, { detail })); } catch (e) { /* node */ }
  heist.log.push([name, detail && (detail.id || detail.why || detail.reason || '')]); if (heist.log.length > 60) heist.log.shift();
}
const HEISTS = new Map(); const TIPS = new Map(); // heistId -> { cameras, patrol, safeEase }
const cams = createCameras();
const guards = createGuards({
  emit, alarm: (lvl, why, at) => heist.alarm(lvl, why, at),
  onBackup: last => { // investigate -> backup: a guard radios it in (+1 star, private security rolls out via heist:alarm:response)
    if (!run || !ctxL) return; run.responded = true; const d = run.def, W = ctxL.world, at = last || run.w?.site || ctxL.player;
    raiseAlarm(W, Math.min(5, (W?.wanted | 0) + 1), `${d.title}: guards called for backup`); emit('alarm:response', { id: d.id, x: at.x, z: at.z, wanted: W ? W.wanted : 0, by: 'guards' });
    toast('📻 A guard radioed it in. Backup is on the way.', 2600);
  },
  onLockdown: A => { if (!run) return; emit('lockdown', { id: run.def.id, s: A.lockLeft, posts: guards.list().map(g => g.post).filter(Boolean) }); toast(`🔒 Lockdown! Doors and gates sealing. ${Math.round(A.lockLeft)}s to get the loot out.`, 3200); },
  onSealed: () => { if (!run) return; const d = run.def;
    if (STAGE_IDX(run.stage) <= STAGE_IDX('crack')) return finish(false, 'locked down: the vault sealed');
    if (run.stage === 'escape') { raiseAlarm(ctxL?.world, Math.min(5, (ctxL?.world?.wanted | 0) + 1), `${d.title}: gates sealed`); toast('🔒 Gates sealed. Fight your way out.', 2600); } }
});
let appRef = null, menuOn = false;
let boxes = []; const losC = losCache(0.12); // heist-local LOS / camera / collision boxes (the ?heisttest=1 villa walls)
let ctxL = null, run = null, runDone = null, marks = null, ui = null, actNow = null, busy = false, lastAlarmT = -99, clock = 0;

// ---------- markers (rings on the ground for door / safe / power box) ----------
const RG = new THREE.RingGeometry(0.9, 1.15, 28), RM = {};
function ring(color) { const m = new THREE.Mesh(RG, RM[color] ||= Object.assign(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }), { userData: { shared: true } })); m.rotation.x = -Math.PI / 2; return m; }
function placeMarks(ctx) {
  dropMarks(); const d = run.def, g = new THREE.Group(); g.name = 'heistMarks'; ctx.scene.add(g);
  const put = (p, c) => { const m = ring(c); m.position.set(p.x, ctx.height(p.x, p.z) + 0.08, p.z); g.add(m); return m; };
  marks = { g, door: put(run.w.door, 0xffd040), safe: put(run.w.safe, 0x3cff8a), power: run.w.power ? put(run.w.power, 0x6ad0ff) : null, sample: null };
  if (d.sample) marks.sample = buildSample(ctx, g);
}
function dropMarks() { boxes = []; guards.setBoxes(boxes); if (marks) { marks.g.parent?.remove(marks.g); marks.g.traverse(o => { if (o.isMesh && !o.material.userData?.shared) o.material.dispose(); }); } marks = null; }
// TEST-ONLY placeholder "mansion" for ?heisttest=1: two low walls, a safe and a power box. Grok Bot's district build replaces this.
function buildSample(ctx, g) {
  const w = run.w, y = (x, z) => ctx.height(x, z), mat = new THREE.MeshStandardMaterial({ color: 0xe8eaec, roughness: 0.7 }), box = new THREE.BoxGeometry(1, 1, 1);
  const B = (x, z, sx, sy, sz, m = mat) => { const o = new THREE.Mesh(box, m); o.scale.set(sx, sy, sz); o.position.set(x, y(x, z) + sy / 2, z); g.add(o); return o; };
  const W = (x, z, sx, sy, sz) => { B(x, z, sx, sy, sz); boxes.push({ x, z, hx: sx / 2, hz: sz / 2, top: y(x, z) + sy }); }; // v7.5.4: walls block cameras, guards, the follow camera and you
  const sx = w.site.x, sz = w.site.z; W(sx - 6, sz, 0.4, 2.8, 12); W(sx + 6, sz, 0.4, 2.8, 12); W(sx, sz - 6, 12.4, 2.8, 0.4); guards.setBoxes(boxes);
  B(w.safe.x, w.safe.z - 0.6, 1, 1.1, 0.8, new THREE.MeshStandardMaterial({ color: 0x3a3f4a, metalness: 0.6, roughness: 0.4 }));
  if (w.power) B(w.power.x, w.power.z - 0.4, 0.6, 1.2, 0.3, new THREE.MeshStandardMaterial({ color: 0x8a6a20 }));
  return true;
}

// ---------- HUD: one chip in the right stack + one context button in #surfBtns (hidden unless there's an action) ----------
const CSS = `#heistChip { display: none; padding: 4px 9px; border-radius: 9px; font-size: 0.7rem; line-height: 1.3; background: rgba(8,10,20,0.66); border: 1px solid rgba(255,208,64,0.5); color: #fff; white-space: nowrap; text-shadow: 0 1px 2px rgba(0,0,0,.8); }
#heistChip.on { display: block; } #heistChip .eye { display: inline-block; width: 38px; height: 6px; border-radius: 3px; background: rgba(255,255,255,.15); vertical-align: middle; margin-left: 6px; overflow: hidden; }
@media (max-width: 520px) { #heistChip { white-space: normal; max-width: min(64vw, 300px); } } /* v7.5.4: the guard / lockdown suffix wraps instead of running off a phone */
#heistChip.lock { border-color: #ff8a3c; background: rgba(60,14,8,0.72); } #heistChip .eye i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #ffb020, #ff2a2a); } #heistChip.seen { border-color: #ff3c3c; }
#heistBtn { display: none; height: 44px !important; font-size: 0.72rem !important; touch-action: manipulation !important; background: rgba(160,110,10,0.7) !important; border-color: rgba(255,208,64,0.6) !important; }
body:not(.touch) #heistBtn { font-size: 0.8rem !important; }
#heistPanel { position: fixed; inset: 0; z-index: 55; display: none; align-items: flex-end; justify-content: center; background: rgba(4,6,12,.55); }
#heistPanel.on { display: flex; } #heistPanel .wrap { width: min(94vw, 460px); max-height: 78vh; overflow: auto; margin-bottom: calc(10px + env(safe-area-inset-bottom)); background: rgba(12,15,26,.94); border: 1px solid rgba(255,255,255,.16); border-radius: 16px; padding: 12px 14px; color: #e8ecf4; font: 13px system-ui, sans-serif; }
#heistPanel h2 { margin: 2px 0 8px; font-size: 16px; } #heistPanel .row { display: flex; gap: 8px; align-items: center; padding: 8px 0; border-top: 1px solid rgba(255,255,255,.08); }
#heistPanel .row div { flex: 1; } #heistPanel small { opacity: .7; } #heistPanel button { min-height: 44px; min-width: 64px; border-radius: 10px; border: 1px solid rgba(255,255,255,.25); background: rgba(40,48,70,.9); color: #fff; font-weight: 700; }`;
function ensureUi() {
  if (ui || typeof document === 'undefined') return ui;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const chip = document.createElement('div'); chip.id = 'heistChip'; chip.setAttribute('aria-live', 'polite');
  const stack = document.getElementById('stackR'); if (stack) stack.insertBefore(chip, document.getElementById('questTrack')?.nextSibling || null); else document.body.appendChild(chip);
  const btn = document.createElement('button'); btn.id = 'heistBtn'; btn.className = 'glass';
  const sb = document.getElementById('surfBtns'); if (sb) sb.insertBefore(btn, sb.firstChild); else document.body.appendChild(btn);
  tap(btn, () => doAction());
  addEventListener('keydown', e => { if (e.code === 'KeyG' && !e.repeat && !safeOpen() && actNow) { e.preventDefault(); doAction(); } });
  const panel = document.createElement('div'); panel.id = 'heistPanel'; panel.innerHTML = '<div class="wrap"></div>'; document.body.appendChild(panel);
  { let bp = null; // backdrop tap closes: same-pointer pointerdown -> pointerup (iOS drops clicks while a thumb rests on the stick)
    panel.addEventListener('pointerdown', e => { bp = e.target === panel ? e.pointerId : null; });
    panel.addEventListener('pointerup', e => { if (e.target === panel && e.pointerId === bp) panel.classList.remove('on'); bp = null; });
    panel.addEventListener('pointercancel', () => { bp = null; }); }
  ui = { chip, btn, panel }; return ui;
}
function setAction(a) {
  actNow = a; if (!ui) return;
  const touch = document.body.classList.contains('touch');
  ui.btn.style.display = a ? 'block' : 'none'; if (a) ui.btn.textContent = a.label + (touch ? '' : ' (G)');
}
const STAGE_TEXT = { case: 'Sneak to the door', breakin: 'Picking the lock…', crack: 'Find and crack the safe', escape: 'Run from the building', clean: 'Lose your wanted stars' };
function renderChip(meter, dist) {
  if (!ui) return; const c = ui.chip;
  if (!run || run.stage === 'done' || run.stage === 'failed') { c.classList.remove('on'); return; }
  c.classList.add('on'); c.classList.toggle('seen', meter > 0.05);
  const gp = guards.phase, gt = gp === 'investigate' ? ' · 🔦 guards checking' : gp === 'backup' ? ' · 📻 backup called' : gp === 'lockdown' ? ` · 🔒 ${Math.floor(guards.lockLeft / 60)}:${String(Math.floor(guards.lockLeft % 60)).padStart(2, '0')}` : gp === 'sealed' ? ' · 🔒 sealed' : '';
  c.classList.toggle('lock', gp === 'lockdown' || gp === 'sealed');
  c.innerHTML = `🕵️ <b>${run.def.title}</b> · ${STAGE_TEXT[run.stage] || run.stage}${dist != null ? ` · ${Math.round(dist)} m` : ''}${gt}<span class="eye" title="Camera detection"><i style="width:${Math.round(meter * 100)}%"></i></span>`;
}
function overview() {
  ensureUi(); const w = ui.panel.firstChild, rows = [...HEISTS.values()].map(d => {
    const live = run && run.def.id === d.id && !['done', 'failed'].includes(run.stage);
    return `<div class="row"><div><b>${d.title}</b><br><small>${d.world} · safe ${d.safe.tier} (${SAFE_TIERS[d.safe.tier].tumblers} tumblers) · ${d.cameras.length} cameras · alarm ${d.alarm.wanted}★ · response ${d.alarm.responseS}s</small>${live ? `<br><small>▶ ${STAGE_TEXT[run.stage]}${run.alarm ? ' · 🚨 alarm' : ''}</small>` : ''}</div>${live ? '<button data-act="quit">Abort</button>' : `<button data-id="${d.id}">Start</button>`}</div>`;
  }).join('');
  w.innerHTML = `<h2>🕵️ Heists</h2><small>Case the cameras (cut power or a camera from behind), break in, crack the safe with one thumb, then get clear and lose the heat.</small>${rows || '<p>No jobs on the board.</p>'}<div class="row"><div></div><button data-act="close">Close</button></div>`;
  for (const b of w.querySelectorAll('button')) tap(b, () => { if (b.dataset.act === 'close') ui.panel.classList.remove('on'); else if (b.dataset.act === 'quit') { heist.abortHeist('abandoned'); ui.panel.classList.remove('on'); } else { ui.panel.classList.remove('on'); heist.startHeist(b.dataset.id); } });
  ui.panel.classList.add('on');
}
// ☰ 🕵️ Heists appears only once a heist is registered (no permanent HUD button)
function ensureMenu() { if (menuOn || !appRef || typeof document === 'undefined') return; menuOn = true; ensureUi(); addMenuItem(appRef, { id: 'heistMenu', label: '🕵️ Heists', onTap: () => overview() }); }
const toast = (m, ms) => (typeof window !== 'undefined' && window.__app?.toast?.(m, ms));

// ---------- actions ----------
async function doAction() {
  const a = actNow; if (!a || busy) return; busy = true;
  try { await a.fn(); } finally { busy = false; }
}
function crackFlow() {
  const d = run.def; emit('safe:open', { id: d.id, tier: d.safe.tier });
  return heist.safeCrack({ tier: d.safe.tier, ...tipSafeOpts(d.safe.tier, d.safe.time, TIPS.get(d.id)), title: d.title + ' safe', seed: d.safe.seed }).then(res => {
    if (!run || run.def !== d) return res;
    emit('safe:result', { id: d.id, ...res });
    if (res.success) { run.loot = { ...d.loot }; emit('loot', { id: d.id, loot: run.loot }); run.advance('escape'); emitStage(); toast(`💰 Safe's open. ${d.loot.credits ? d.loot.credits + ' cr in the bag. ' : ''}Get away from the building.`, 3000); }
    else if (res.reason === 'noise' || res.reason === 'timeout') { heist.alarm(d.alarm.wanted, res.reason === 'noise' ? `${d.title}: safe alarm` : `${d.title}: safe timer tripped`); toast('🚨 The safe screamed. Try again or run.', 3000); }
    return res;
  });
}
function emitStage() { if (run) emit('stage', { id: run.def.id, stage: run.stage, t: +run.t.toFixed(2) }); }

// ---------- per-frame (surface.js calls heistTick(dt, ctx) next to raceTick) ----------
export function heistTick(dt, ctx) {
  ctxL = ctx; clock += dt;
  const P = ctx.player, car = ctx.car;
  if (boxes.length && !isIndoors(ctx.world)) { const o = car || P, c = pushOut(boxes, o.x, o.z, car ? 1.4 : 0.4); if (c) { o.x = c.x; o.z = c.z; if (car) { P.x = c.x; P.z = c.z; car.speed = (car.speed || 0) * 0.5; } } } // villa walls are solid
  const tgt = { x: P.x, z: P.z, hidden: isIndoors(ctx.world), speed: car ? Math.abs(car.speed || 0) : 0, see: cam => canSee(ctx, cam) };
  const cv = cams.update(dt, ctx, tgt, cam => {
    emit('camera:alert', { id: cam.id, heistId: cam.heistId, x: cam.x, z: cam.z, level: cam.level });
    heist.alarm(cam.level, cam.label ? `spotted by ${cam.label}` : 'spotted by a security camera');
  });
  if (!run) { setAction(null); renderChip(0, null); return; }
  if (run.stage === 'done' || run.stage === 'failed') return;
  if (run.w) guards.tick(dt, ctx, run); if (!run) return; // a sealed lockdown can end the run
  const d = run.def;
  if (ctx.name !== d.world) return heist.abortHeist('left ' + d.world);
  if (!run.w) { run.w = resolve(ctx.world, d); if (!run.w) return; placeMarks(ctx); }
  run.t += dt; const w = run.w, H = heat(ctx.world);
  const dist = p => Math.hypot(P.x - p.x, P.z - p.z);
  if (ctx.game?.isDown?.()) return finish(false, 'downed');
  if (d.alarm.failAt && H.wanted >= d.alarm.failAt && STAGE_IDX(run.stage) < STAGE_IDX('clean')) return finish(false, `${d.alarm.failAt}★ before you got clean`);
  // alarm response: after responseS, if you're still on site, private security calls it in (+1 star). Units are Grok Bot's.
  if (run.alarm && !run.responded && run.t - run.alarmT >= d.alarm.responseS) { // (guards usually radio it in first: guards.js onBackup)
    run.responded = true;
    if (dist(w.site) < w.site.r * 2) { raiseAlarm(ctx.world, Math.min(5, H.wanted + 1), `${d.title}: private security response`); emit('alarm:response', { id: d.id, x: w.site.x, z: w.site.z, wanted: ctx.world.wanted }); }
  }
  let act = null, goal = null;
  const onFoot = !car;
  if (w.power && onFoot && dist(w.power) < 2.2 && !run.powerCut && STAGE_IDX(run.stage) <= STAGE_IDX('crack')) act = { label: '⚡ Cut power', fn: async () => { run.powerCut = true; for (const c of cams.list()) if (c.heistId === d.id) cams.disable(c.id, d.power?.s ?? 45); emit('camera:disabled', { id: d.id, all: true, s: d.power?.s ?? 45 }); toast('⚡ Cameras dark for a bit. Move.', 2500); } };
  else if (onFoot && cv.near && cv.nearD < 2.4 && cv.near.heistId === d.id && STAGE_IDX(run.stage) <= STAGE_IDX('crack')) { const c = cv.near; act = { label: '✂️ Cut camera', fn: async () => { cams.disable(c.id); emit('camera:disabled', { id: c.id, heistId: d.id, s: c.disabledFor }); toast('✂️ Camera loop spliced.', 2000); } }; }
  if (run.stage === 'case') {
    goal = w.door;
    if (onFoot && dist(w.door) < 2.4 && !act) act = { label: '🔓 Break in', fn: async () => {
      run.advance('breakin'); run.tBreak = run.t; emitStage(); await new Promise(r => setTimeout(r, (d.breakinMs ?? 1200) * guards.breakinMul)); // lockdown: the door is barred, picking takes longer
      if (run && run.stage === 'breakin') { if (dist(w.door) > 4) { run.stage = 'case'; toast('🔓 You walked away from the lock. Go back to the door.', 2000); return; } run.advance('crack'); emitStage(); toast('🔓 You\u2019re in. Find the safe and crack it.', 2000); }
    } };
  } else if (run.stage === 'crack') {
    goal = w.safe;
    if (onFoot && dist(w.safe) < 2.2 && !act) act = { label: '🔐 Crack safe', fn: crackFlow };
  } else if (run.stage === 'escape') {
    goal = w.site;
    if (dist(w.site) > d.escapeR * guards.escapeMul) { // lockdown: gates sealed, you have to get farther out
      const sec = securityNear(ctx.world, P.x, P.z, 120);
      const payload = escapePayload(run, { x: P.x, z: P.z, wanted: H.wanted, evading: H.evading, security: sec, vehicle: car ? (car.kind || 'rover') : null });
      run.advance('clean'); emit('escape', { ...payload, name: payload.title }); emitStage(); // name: index.html's getaway toast reads d.name
      if (H.wanted === 0) return finish(true);
    }
  } else if (run.stage === 'clean') {
    if (H.wanted === 0) return finish(true);
  }
  setAction(act); renderChip(cv.maxMeter, goal ? dist(goal) : null);
  if (marks) { marks.door.visible = run.stage === 'case'; marks.safe.visible = run.stage === 'crack'; if (marks.power) marks.power.visible = !run.powerCut && STAGE_IDX(run.stage) <= STAGE_IDX('crack'); const s = 1 + Math.sin(clock * 4) * 0.08; for (const m of [marks.door, marks.safe]) m.scale.set(s, s, s); }
}
// camera line of sight: lens (mast top) -> your chest, against world buildings/domes + heist-local walls
function blockedAt(ctx) { const W = ctx?.world; return (x, y, z) => (boxes.length > 0 && boxHit(boxes, x, y, z)) || !!W?.camBlocked?.(x, y, z); }
function canSee(ctx, cam) {
  return losC(cam.id, clock, () => { const P = ctx.player, py = (ctx.car ? (ctx.car.y ?? ctx.height(P.x, P.z)) : ctx.height(P.x, P.z)) + 1.2;
    return losClear({ x: cam.x, y: ctx.height(cam.x, cam.z) + (cam.y ?? 3), z: cam.z }, { x: P.x, y: py, z: P.z }, blockedAt(ctx), { skipA: 1.0 }); });
}
const STAGE_IDX = s => ['case', 'breakin', 'crack', 'escape', 'clean', 'done', 'failed'].indexOf(s);
function resolve(world, d) {
  const out = {}; for (const k of ['site', 'door', 'safe', 'power']) { if (!d[k]) continue; const p = toWorld(world, d[k], d.rel); if (!p) return null; out[k] = { ...d[k], ...p }; }
  return out;
}
function finish(success, fail) {
  if (!run) return; const d = run.def;
  if (success) { run.advance('done'); if (d.payout) payout(ctxL?.game, d.loot.credits); } else { run.failWith(fail); if (safeOpen()) cancelSafe(); }
  const res = { id: d.id, success, loot: success ? run.loot : null, fail: success ? null : fail, stage: run.stage, t: +run.t.toFixed(2), alarm: run.alarm };
  emit(success ? 'done' : 'fail', res); if (success) emit('clean', { id: d.id });
  toast(success ? `🕵️ ${d.title}: clean getaway.` : `🕵️ ${d.title} blown: ${fail}.`, 3500);
  cams.removeWhere(c => c.heistId === d.id); guards.stop(); dropMarks(); setAction(null);
  const r = runDone; run = null; runDone = null; renderChip(0, null); r?.(res);
}

// ---------- public API ----------
export const heist = {
  version: 1, log: [],
  on(evt, fn) { (listeners[evt] ||= []).push(fn); return () => heist.off(evt, fn); },
  off(evt, fn) { listeners[evt] = (listeners[evt] || []).filter(f => f !== fn); },
  // also takes { difficulty } (game.crack's number: 0-1 easy, 2 medium, 3 hard, 4+ vault) and adds ok (= success) to the result
  safeCrack(opts = {}) {
    ensureUi(); const o = { ...opts };
    if (!o.tier && Number.isFinite(o.difficulty)) o.tier = ['easy', 'easy', 'medium', 'hard'][o.difficulty] || 'vault';
    return safeCrack(o).then(r => ({ ...r, ok: !!r.success }));
  },
  addCamera: def => cams.add(def), removeCamera: id => cams.remove(id), disableCamera: (id, s) => cams.disable(id, s),
  cameras: () => cams.list().map(c => ({ id: c.id, heistId: c.heistId, x: c.wx ?? c.x, z: c.wz ?? c.z, yaw: c.yaw, meter: +c.meter.toFixed(3), disabled: c.disabledFor > 0, level: c.level })),
  // alarm(level, why): raise heat to `level` stars, or one star more if you're already that hot. Emits 'alarm'.
  alarm(level, why = 'alarm', at = null) {
    const world = ctxL?.world; const before = world ? world.wanted : 0;
    if (run) { const p = at || ctxL?.player; if (guards.alert(p ? { x: p.x, z: p.z } : null, why) === 'investigate') toast('🔦 Guards heard it. They are coming to look.', 2200); }
    if (clock - lastAlarmT < 0.5 && before >= level) return { op: 'none', n: before };
    lastAlarmT = clock; const act = raiseAlarm(world, level, why);
    if (run && !run.alarm) { run.alarm = true; run.alarmT = run.t; }
    emit('alarm', { level, why, before, wanted: world ? world.wanted : 0, op: act.op, heistId: run?.def.id || null }); return act;
  },
  registerHeist(def) { const d = normHeist(def); HEISTS.set(d.id, d); ensureMenu(); return d.id; },
  heists: () => [...HEISTS.values()].map(d => ({ id: d.id, title: d.title, world: d.world, tier: d.safe.tier, cameras: d.cameras.length })),
  fromMansion: heistFromMansion,
  // applyTip(heistId, tip): informant intel. Unknown types / heists are ignored (returns null). Emits 'tip' with the
  // reveal data so the minimap owner can draw it: cameras -> [{id,x,z,yaw,fov,range}], patrol -> def.guards spots.
  applyTip(heistId, tip) {
    const d = HEISTS.get(heistId); if (!d) return null;
    const tips = TIPS.get(heistId) || {}; const t = applyTipTo(tips, tip); if (!t) return null; TIPS.set(heistId, tips);
    const out = { id: heistId, type: t.type };
    if (t.type === 'cameras') out.cameras = d.cameras.map((c, i) => ({ id: c.id || `${d.id}-cam${i}`, x: c.x, z: c.z, yaw: c.yaw || 0, fov: c.fov || 70, range: c.range || 14, rel: d.rel }));
    if (t.type === 'patrol') out.guards = (d.guards || []).map(g => ({ x: g.x, z: g.z, rel: d.rel }));
    if (t.type === 'safe') out.ease = tips.safeEase;
    emit('tip', out); return out;
  },
  tips: id => ({ ...(TIPS.get(id) || {}) }),
  startHeist(id) {
    const d = HEISTS.get(id); if (!d) return Promise.reject(new Error('unknown heist ' + id));
    if (run) heist.abortHeist('replaced');
    ensureUi(); run = createRun(d); run.w = null;
    for (const c of d.cameras) cams.add({ world: d.world, rel: d.rel, ...c, heistId: d.id });
    guards.start(d);
    emit('start', { id: d.id, title: d.title }); emitStage(); toast(`🕵️ ${d.title}: sneak to the door. Dodge the cameras or cut them up close.`, 3000);
    return new Promise(r => { runDone = r; });
  },
  abortHeist(why = 'abandoned') { if (run) finish(false, why); },
  // active: null when idle, else the run info ({ id, stage, t, alarm, loot, w }). It is also callable, active(kind, name) -> bool,
  // because game.heistAt(kind, name) (world.js interiors' heist()) calls SSX.heist.active?.(kind, name); a plain object threw.
  get active() {
    if (!run) return null; const d = run.def;
    const fn = (kind, name) => { // v7.5.3: scoped to this heist's target (heistCovers), not every vault/safe in the city
      if (!run) return false; if (!kind && !name) return true; if (d.kind || d.name) return heistCovers(d, null, null, kind, name);
      const W = ctxL?.world || window.__app?.surface?.world, site = run.w?.site || (d.site && toWorld(W, d.site, d.rel));
      const door = (W?.doorList?.() || []).find(o => o.kind === kind && (!name || o.name === name));
      return heistCovers(d, site, door, kind, name);
    };
    return Object.assign(fn, { id: d.id, stage: run.stage, t: +run.t.toFixed(2), alarm: run.alarm, loot: run.loot, w: run.w, guards: guards.phase, lockdown: guards.lockdown, lockLeft: +guards.lockLeft.toFixed(1), escapeR: d.escapeR * guards.escapeMul });
  },
  get action() { return actNow ? actNow.label : null; },
  // v7.5.4 guards (guards.js): list() -> [{ id, x, z, state: patrol|investigate|search|engage|post|down, hp, meter, post }],
  // phase: calm|investigate|backup|lockdown|sealed, setOptions({ fire }) (tests), reserved = NPC slots held via world.npcReserve
  guards: { list: () => guards.list(), get phase() { return guards.phase; }, get lockLeft() { return guards.lockLeft; }, get reserved() { return guards.reserved; }, setOptions: o => guards.setOptions(o), debug: guards.debug },
  // follow-camera / LOS helpers scoped to heist sites: camBlocked(x, y, z) is true inside a heist-local wall (the city's own
  // buildings are world.camBlocked already); los(a, b) marches a 3D segment against both
  camBlocked: (x, y, z) => boxes.length > 0 && boxHit(boxes, x, y, z),
  los: (a, b) => losClear(a, b, blockedAt(ctxL)),
  act: () => doAction(),
  overview,
  debug: { safe: safeState, safeOpen, ctx: () => ctxL }
};

// sample heist near Ares Junction for ?heisttest=1 (test-only; colony-relative metres, AJ = Mars colony centre)
export const SAMPLE = {
  id: 'heist-sample', title: 'TEST VILLA', world: 'Mars', rel: 'colony', sample: true, payout: true,
  site: { x: 70, z: 34, r: 12 }, door: { x: 70, z: 41 }, safe: { x: 70, z: 30, tier: 'medium', time: 45 }, power: { x: 62, z: 42, s: 45 },
  cameras: [{ id: 'tv-cam0', x: 64, z: 28, yaw: Math.PI * 0.25, range: 12, sweep: 30, label: 'the villa camera' }, { id: 'tv-cam1', x: 76, z: 28, yaw: -Math.PI * 0.25, range: 12, sweep: 30, phase: 1.3, label: 'the villa camera' },
    { id: 'tv-cam2', x: 76, z: 40, yaw: -Math.PI * 0.75, range: 10, sweep: 25, phase: 2.1, label: 'the porch camera' }],
  alarm: { wanted: 2, responseS: 18 }, loot: { credits: 250, item: 'contraband' },
  guards: [{ id: 'tv-front', x: 61, z: 46, route: [{ x: 79, z: 46 }] }, { id: 'tv-yard', x: 66.5, z: 35, route: [{ x: 73.5, z: 35 }] }, { id: 'tv-back', x: 80, z: 23, route: [{ x: 60, z: 23 }] }],
  lockdown: { lockdownS: 75 }
};

export function initHeist(app) {
  if (typeof window === 'undefined') return heist;
  window.SSX && (window.SSX.heist = heist); if (app) app.heist = heist;
  appRef = app || null; if (HEISTS.size) ensureMenu();
  if (/[?&]heisttest=1/.test(location.search)) {
    const t = +(location.search.match(/[?&]heisttime=(\d+)/) || [])[1]; // tests on slow software-GL boxes stretch the safe timer
    heist.registerHeist(t ? { ...SAMPLE, safe: { ...SAMPLE.safe, time: t } } : SAMPLE);
  }
  return heist;
}
