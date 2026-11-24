// v7.5.136 Take the Velvet. A short chain with plain steps and an arrow.
// You push Ines in a verbal fight, take the floor, and she ends up working your counter in Red Tape Flats.
// window.SSX.velvetTake = { start, act, choose, state, place, debug }
import * as THREE from 'three';

const ID = 'velvet-take';
const CLUB = [-30, -32];
const FLATS = [-210, -118];
const REACH = 8;
const KEY = 'ssx.velvet.take.v1';

const app = () => window.__app;
const surf = () => app()?.surface;
const game = () => surf()?.game || app()?.game;
const world = () => surf()?.world;
const toast = (t, ms = 3200) => { try { app()?.toast?.(t, ms); } catch (e) { /* */ } };
const tryv = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } };

const LINES = [
  { line: 'Ines: You walk in like the deed is already in your pocket. Say it, then.',
    opts: [{ id: 'push', t: 'The Velvet is mine. You are in the way.', n: 1 }, { id: 'wage', t: 'You keep a wage. Off this floor.', n: 2 }, { id: 'back', t: 'Forget it.', n: -1 }] },
  { line: 'Ines: I built the night shift. Thorne takes the skim. I take the bruises. You do not get to rename my house.',
    opts: [{ id: 'hard', t: 'Then you work for me, or you work nowhere.', n: 3 }, { id: 'flats', t: 'A counter in Red Tape Flats. Your name on it. Not this door.', n: 3 }] },
  { line: 'Ines: A wage. I have heard sweeter lies from men who could not pay a tab.',
    opts: [{ id: 'pack', t: 'Pack a bag. The Flats counter is yours.', n: 3 }, { id: 'anyway', t: 'Stay and watch me take the floor anyway.', n: 3 }] }
];

let save = load(), btn = null, sheet = null, node = 0, registered = false, fig = null;
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch (e) { /* fresh */ } return { v: 1, demoted: false }; }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* */ } }
const quest = () => { const q = tryv(() => game().debug.quest()); return q && q.id === ID ? q : null; };
const onMars = () => { const i = surf()?.info; return !!(app()?.state?.onSurface && i && i.name === 'Mars'); };
function at(aj) { const p = tryv(() => world().colonyAt(aj)); return p && Number.isFinite(p.x) ? p : null; }
function player() { const i = surf()?.info; return i ? { x: i.x, z: i.z } : null; }
function dist(aj) { const p = player(), w = at(aj); if (!p || !w) return Infinity; return Math.hypot(p.x - w.x, p.z - w.z); }
function inClub() { return surf()?.info?.inside?.kind === 'club'; }
function nearClub() { return inClub() || dist(CLUB) <= REACH; }

function ensureMission() {
  const g = game(); if (!g?.registerMission || registered) return;
  g.registerMission({
    id: ID, world: 'Mars', contact: 'Ines', title: 'Take the Velvet', fiction: true,
    intro: 'Ines runs the Velvet Airlock. Push her. Take the floor. She ends up working your counter in Red Tape Flats.',
    steps: [
      { type: 'goto', at: CLUB, r: -1, text: 'Talk to Ines at the Velvet door. Push her.' },
      { type: 'goto', at: CLUB, r: -1, text: 'Take the Velvet floor. The arrow is on the door.' },
      { type: 'goto', at: FLATS, r: -1, text: 'Visit Ines at her counter in Red Tape Flats.' }
    ],
    reward: { xp: 80, credits: 400 },
    success: 'Ines works your counter in Red Tape Flats. The Velvet floor is yours.'
  });
  registered = true;
}

function ensureBtn() {
  if (btn) return btn;
  const st = document.createElement('style'); st.id = 'vtakeCss';
  st.textContent = '#vtakeAct{position:fixed;z-index:13;right:calc(8px + env(safe-area-inset-right));bottom:calc(248px + env(safe-area-inset-bottom));display:none;min-height:48px;min-width:64px;max-width:160px;padding:4px 8px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 13px/1.15 system-ui,sans-serif;touch-action:manipulation}'
    + 'body.surface #vtakeAct.show{display:block} body.cinematic #vtakeAct,body.hxMapOpen #vtakeAct,body:has(#roverMenu.show) #vtakeAct{display:none!important}'
    + '#vtakeSheet{position:fixed;left:0;right:0;bottom:0;z-index:18;display:none;padding:12px 12px calc(12px + env(safe-area-inset-bottom));background:#000;color:#fff;border-top:2px solid #fff;max-height:46vh;overflow:auto;box-sizing:border-box;font:15px/1.35 system-ui,sans-serif}'
    + '#vtakeSheet.on{display:block}#vtakeSheet p{margin:0 0 8px}#vtakeSheet button{display:block;width:100%;min-height:44px;margin-top:6px;border-radius:10px;border:2px solid #fff;background:#000;color:#fff;font:800 15px system-ui,sans-serif;text-align:left;padding:8px 10px}';
  document.head.appendChild(st);
  btn = document.createElement('button'); btn.id = 'vtakeAct'; btn.type = 'button';
  document.body.appendChild(btn);
  const tap = window.__onTap; if (tap) tap(btn, () => act()); else btn.addEventListener('click', () => act());
  sheet = document.createElement('div'); sheet.id = 'vtakeSheet';
  document.body.appendChild(sheet);
  sheet.addEventListener('click', e => { const b = e.target.closest('button'); if (b) choose(b.dataset.id); });
  return btn;
}
function showBtn(label) {
  const b = ensureBtn();
  if (!label || !onMars()) { b.classList.remove('show'); b.textContent = ''; return; }
  if (b.textContent !== label) b.textContent = label;
  b.classList.add('show');
}
function paint() {
  const row = LINES[node] || LINES[0];
  sheet.innerHTML = `<p>${row.line}</p>` + row.opts.map(o => `<button type="button" data-id="${o.id}">${o.t}</button>`).join('');
  sheet.classList.add('on');
}
function closeSheet() { sheet?.classList.remove('on'); }

export function choose(id) {
  const row = LINES[node] || LINES[0];
  const o = row.opts.find(x => x.id === id); if (!o) return { ok: false };
  if (o.n < 0) { closeSheet(); toast('Ines: Then get off my step.'); return { ok: true, backed: true }; }
  if (o.n >= LINES.length) {
    closeSheet();
    const ok = !!tryv(() => game().advanceStep(), false);
    toast(ok ? 'Ines: Fine. Take the floor. I will be in the Flats, behind a counter, in a work coat. Do not ask me to like it.' : 'Not yet.');
    return { ok, took: true };
  }
  node = o.n; paint();
  return { ok: true, node };
}

export function start() {
  ensureMission();
  const g = game(); if (!g?.accept) return { ok: false };
  if (quest()) return { ok: true, on: true };
  if (save.demoted) return { ok: false, demoted: true };
  return { ok: !!g.accept(ID) };
}

export function act() {
  ensureMission(); ensureBtn();
  if (save.demoted || (quest() && quest().step >= 2 && dist(FLATS) <= REACH)) {
    if (dist(FLATS) > REACH && !save.demoted) return { ok: false, far: true };
    if (!save.demoted) { tryv(() => game().advanceStep()); save.demoted = true; persist(); }
    toast('Ines, work coat and boots, hair pinned up: The counter is clean. The Velvet is yours. I pour coffee. That is the job.');
    return { ok: true, demoted: true };
  }
  const q = quest();
  if (!q) {
    if (!nearClub()) { mark(); return { ok: false, far: true }; }
    const r = start();
    if (!r.ok) return r;
  }
  if (!nearClub()) { toast('Follow the arrow to the Velvet door.'); return { ok: false, far: true }; }
  const step = quest()?.step | 0;
  if (step === 0) { node = 0; paint(); return { ok: true, talk: true }; }
  if (step === 1) {
    const ok = !!tryv(() => game().advanceStep(), false);
    toast(ok ? 'The floor is yours. Ines is at a counter in Red Tape Flats. Follow the arrow.' : 'Not yet.');
    return { ok, floor: true };
  }
  return { ok: false };
}

function mark() {
  const w = at(CLUB); if (!w) return;
  try { window.SSX?.hudx?.setWaypoint?.({ x: w.x, z: w.z, label: 'Ines at the Velvet door' }); } catch (e) { /* */ }
  toast('Follow the arrow to Ines at the Velvet door.');
}
function point() {
  const q = quest();
  const aj = !q ? null : q.step >= 2 || save.demoted ? FLATS : CLUB;
  const w = aj && at(aj); if (!w) return;
  const label = !q ? '' : q.step === 0 ? 'Talk to Ines at the Velvet door' : q.step === 1 ? 'Take the Velvet floor' : 'Visit Ines in Red Tape Flats';
  try { window.SSX?.guide?.aimGround?.({ id: 'take', x: w.x, z: w.z, label }); } catch (e) { /* */ }
}
function figure() {
  if (fig) return fig;
  const g = new THREE.Group(); g.name = 'ines-flats';
  const coat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc4926a, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.9, 8), coat); body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), skin); head.position.y = 1.62; g.add(head);
  fig = g; return g;
}
function tick() {
  if (!onMars()) { showBtn(''); closeSheet(); return; }
  ensureMission();
  const q = quest();
  const showFig = save.demoted || (q && q.step >= 2);
  if (showFig) {
    const sc = surf()?.scene, w = at(FLATS);
    if (sc && w) { const m = figure(); if (m.parent !== sc) sc.add(m); let y = 0; try { y = surf().height?.(w.x, w.z) || 0; } catch (e) { /* */ } m.position.set(w.x, y, w.z); m.visible = true; }
  } else if (fig) fig.visible = false;
  point();
  if (sheet?.classList.contains('on')) { showBtn(''); return; }
  if (!q && !save.demoted && nearClub()) showBtn('Talk to Ines');
  else if (q && q.step === 0 && nearClub()) showBtn('Talk to Ines');
  else if (q && q.step === 1 && nearClub()) showBtn('Take the floor');
  else if ((q && q.step >= 2 && dist(FLATS) <= REACH) || (save.demoted && dist(FLATS) <= REACH)) showBtn('Visit Ines');
  else showBtn('');
}
export function placeOf() { const w = at(save.demoted ? FLATS : CLUB); return w ? { x: w.x, z: w.z, demoted: !!save.demoted } : null; }
function state() {
  const q = quest();
  return { on: !!q, step: q ? q.step : -1, text: tryv(() => game().debug.step()?.text, ''), demoted: !!save.demoted, sheet: !!sheet?.classList.contains('on'), btn: btn?.textContent || '', nearClub: nearClub(), nearFlats: dist(FLATS) <= REACH };
}
function boot() {
  if (!window.SSX?.registerSurfaceTick && !window.__app) { setTimeout(boot, 250); return; }
  window.SSX = window.SSX || {};
  window.SSX.velvetTake = { start, act, choose, state, place: placeOf, debug: { goto, reset, state } };
  try { window.SSX.registerMenuItem?.({ id: 'rmVtake', label: '🍸 Take the Velvet', onTap: () => { if (save.demoted) { const w = at(FLATS); if (w) window.SSX.hudx?.setWaypoint?.({ x: w.x, z: w.z, label: 'Ines in Red Tape Flats' }); toast('Ines works a counter in Red Tape Flats. Follow the arrow.'); return; } if (nearClub()) act(); else mark(); } }); } catch (e) { /* */ }
  if (typeof window.SSX.registerSurfaceTick === 'function') window.SSX.registerSurfaceTick(() => { try { tick(); } catch (e) { /* */ } });
}
function goto(who) {
  const w = at(who === 'flats' ? FLATS : CLUB); if (!w) return false;
  try { surf().debugPlace(w.x, w.z + 3, 0); } catch (e) { return false; }
  return true;
}
function reset() {
  try { if (quest()) game().abandon?.(); } catch (e) { /* */ }
  save = { v: 1, demoted: false }; persist(); registered = false; node = 0; closeSheet();
}
if (typeof window !== 'undefined') boot();
