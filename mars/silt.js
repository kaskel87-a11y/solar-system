// v7.5.132 Silt's debt (Red Tape Flats).
// Silt Venn pays you to lean on Jory Pell and bring the take back. Words and a shove. No gun, no ColSec, no stars.
// Steps say what to do. The quest beam and the edge arrow mark the spot. The button only shows when you are there.
// window.SSX.silt = { mark(), start(), act(), state(), place(), debug }
import * as THREE from 'three';

const ID = 'flats-silt';
const SILT_AJ = [-240, -76];
const JORY_AJ = [-350, -90]; // west of the Pit, clear of the betting window
const REACH = 5.5;
const PAY = { credits: 280, xp: 45 };

const app = () => window.__app;
const surf = () => app()?.surface;
const game = () => surf()?.game || app()?.game;
const world = () => surf()?.world;
const toast = (t, ms = 2800) => { try { app()?.toast?.(t, ms); } catch (e) { /* */ } };
const tryv = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } };

let btn = null, silt = null, jory = null, registered = false, mmT = 0;
const quest = () => { const q = tryv(() => game().debug.quest()); return q && q.id === ID ? q : null; };
const wanted = () => tryv(() => surf().info.wanted, 0) | 0;
const onMars = () => { const i = surf()?.info; return !!(app()?.state?.onSurface && i && i.name === 'Mars' && !i.inside); };
function at(aj) { const p = tryv(() => world().colonyAt(aj)); return p && Number.isFinite(p.x) ? p : null; }
function player() { const i = surf()?.info; return i ? { x: i.x, z: i.z } : null; }
function dist(aj) { const p = player(), w = at(aj); if (!p || !w) return Infinity; return Math.hypot(p.x - w.x, p.z - w.z); }

function figure(name, coat) {
  const g = new THREE.Group(); g.name = 'silt-' + name;
  const cloth = new THREE.MeshStandardMaterial({ color: coat, roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc4926a, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.85, 8), cloth); body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), skin); head.position.y = 1.62; g.add(head);
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 6), dark); leg.position.set(0.12 * s, 0.35, 0); g.add(leg); }
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 8, 256, 48); x.fillStyle = '#fff'; x.font = '700 28px sans-serif'; x.textAlign = 'center'; x.fillText(name, 128, 42);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sp.position.y = 2.15; sp.scale.set(1.8, 0.45, 1); g.add(sp);
  return g;
}
function place(mesh, aj) {
  const sc = surf()?.scene, w = at(aj); if (!sc || !w || !mesh) return;
  if (mesh.parent !== sc) sc.add(mesh);
  let y = 0; try { const h = surf().height?.(w.x, w.z); if (Number.isFinite(h)) y = h; } catch (e) { /* flat */ }
  mesh.position.set(w.x, y, w.z); mesh.visible = true;
}
function hide(mesh) { if (mesh) mesh.visible = false; }

function ensureMission() {
  const g = game(); if (!g?.registerMission || registered) return;
  g.registerMission({
    id: ID, world: 'Mars', contact: 'Silt Venn', title: "Silt's debt", fiction: true,
    intro: 'Silt Venn: Jory Pell skipped on a debt. Find him in the west alley. Lean on him. Bring the take back. No guns. ColSec stays out of it.',
    steps: [
      // r is negative so walking onto the spot does not finish the step. The button calls advanceStep.
      { type: 'goto', at: JORY_AJ, r: -1, text: 'Find Jory Pell in the west alley of Red Tape Flats' },
      { type: 'goto', at: SILT_AJ, r: -1, text: 'Bring the take back to Silt Venn in Red Tape Flats' }
    ],
    reward: { xp: PAY.xp, credits: PAY.credits },
    success: 'Silt Venn: He paid. Your cut is in. ColSec never heard a word.'
  });
  registered = true;
}

function ensureBtn() {
  if (btn) return btn;
  const st = document.createElement('style'); st.id = 'siltCss';
  st.textContent = '#siltAct{position:fixed;z-index:13;right:calc(8px + env(safe-area-inset-right));bottom:calc(190px + env(safe-area-inset-bottom));display:none;min-height:48px;min-width:64px;max-width:150px;padding:4px 8px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 13px/1.15 system-ui,sans-serif;touch-action:manipulation}'
    + 'body.surface #siltAct.show{display:block} body.indoors #siltAct,body.cinematic #siltAct,body.hxMapOpen #siltAct,body:has(#roverMenu.show) #siltAct{display:none!important}';
  document.head.appendChild(st);
  btn = document.createElement('button'); btn.id = 'siltAct'; btn.type = 'button';
  document.body.appendChild(btn);
  const tap = window.__onTap; if (tap) tap(btn, () => act()); else btn.addEventListener('click', () => act());
  return btn;
}

function showBtn(label) {
  const b = ensureBtn();
  if (!label || !onMars()) { b.classList.remove('show'); b.textContent = ''; return; }
  if (b.textContent !== label) b.textContent = label;
  b.classList.add('show');
}

export function placeOf() { const w = at(SILT_AJ); return w ? { x: w.x, z: w.z } : null; }

export function mark() {
  const w = at(SILT_AJ); if (!w) return { ok: false, msg: 'Silt is on Mars.' };
  try { window.SSX?.hudx?.setWaypoint?.({ x: w.x, z: w.z, label: 'Silt Venn in Red Tape Flats' }); } catch (e) { /* */ }
  toast('Follow the arrow to Silt Venn in Red Tape Flats.');
  return { ok: true, x: w.x, z: w.z };
}

export function start() {
  ensureMission();
  const g = game(); if (!g?.accept) return { ok: false, msg: 'Not ready.' };
  if (!onMars()) return { ok: false, msg: 'Silt is on Mars, in Red Tape Flats.' };
  if (quest()) return { ok: true, msg: 'Already on it. Follow the arrow.' };
  const stars = wanted();
  const ok = g.accept(ID);
  return { ok: !!ok, wanted: wanted(), same: wanted() === stars, msg: ok ? 'Find Jory Pell in the west alley. Tap Lean on him.' : 'Silt will not start that.' };
}

export function act() {
  ensureMission();
  const q = quest();
  const stars = wanted();
  if (!q) {
    if (dist(SILT_AJ) > REACH) return mark();
    const r = start();
    toast(r.ok ? 'Silt: West alley. Jory Pell. Lean on him. Do not make it a ColSec problem.' : (r.msg || 'Not now.'));
    return { ...r, wanted: wanted(), clean: wanted() === stars };
  }
  const step = q.step | 0;
  const who = step === 0 ? JORY_AJ : SILT_AJ;
  if (dist(who) > REACH) { toast(step === 0 ? 'Follow the arrow to Jory Pell.' : 'Follow the arrow back to Silt.'); return { ok: false, far: true, wanted: wanted() }; }
  const ok = !!tryv(() => game().advanceStep(), false);
  if (ok && step === 0) toast('Jory: Alright, alright. Take it. Tell Silt I am square.');
  return { ok, step, wanted: wanted(), clean: wanted() === stars };
}

function point() {
  const q = quest();
  const aj = q ? (q.step === 0 ? JORY_AJ : SILT_AJ) : null;
  const w = aj && at(aj); if (!w) return;
  const label = q.step === 0 ? 'Find Jory Pell in the west alley of Red Tape Flats' : 'Bring the take back to Silt Venn in Red Tape Flats';
  try { window.SSX?.guide?.aimGround?.({ id: 'silt', x: w.x, z: w.z, label }); } catch (e) { /* */ }
}
function tick() {
  if (!onMars()) { hide(silt); hide(jory); showBtn(''); return; }
  ensureMission();
  // Phones only build the two figures once you are in the Flats. A mesh at the colony was enough to knock WebKit over.
  if (!quest() && dist(SILT_AJ) > 140 && dist(JORY_AJ) > 140) { hide(silt); hide(jory); showBtn(''); return; }
  if (!silt) silt = figure('Silt', 0x3a3428);
  place(silt, SILT_AJ);
  const q = quest();
  if (q && q.step === 0) { if (!jory) jory = figure('Jory', 0x6a3030); place(jory, JORY_AJ); }
  else hide(jory);
  const now = performance.now();
  if (now - mmT > 800) {
    mmT = now;
    const w = at(q && q.step === 0 ? JORY_AJ : SILT_AJ);
    try {
      const m = window.SSX?.minimap;
      if (m?.addMarks && w) m.addMarks('silt', [{ x: w.x, z: w.z, color: '#f5d76e', r: 4, icon: '💼', clamp: true }]);
    } catch (e) { /* */ }
  }
  point();
  if (!q && dist(SILT_AJ) <= REACH) showBtn('Talk to Silt');
  else if (q && q.step === 0 && dist(JORY_AJ) <= REACH) showBtn('Lean on Jory');
  else if (q && q.step === 1 && dist(SILT_AJ) <= REACH) showBtn('Hand it over');
  else showBtn('');
}

function boot() {
  const X = window.SSX; if (!X?.registerSurfaceTick && !window.__app) { setTimeout(boot, 250); return; }
  window.SSX = X || {};
  window.SSX.silt = { mark, start, act, state, place: placeOf, debug: { goto, reset, wanted, quest } };
  try { X?.registerMenuItem?.({ id: 'rmSilt', label: "💼 Silt's debt", onTap: () => { const q = quest(); if (q) { toast(q.step === 0 ? 'Follow the arrow to Jory Pell. Tap Lean on him.' : 'Follow the arrow back to Silt. Tap Hand it over.'); return; } if (dist(SILT_AJ) <= REACH) act(); else mark(); } }); } catch (e) { /* menu later */ }
  if (typeof X?.registerSurfaceTick === 'function') X.registerSurfaceTick(() => { try { tick(); } catch (e) { /* */ } });
  else setInterval(() => { try { tick(); } catch (e) { /* */ } }, 200);
}
function state() {
  const q = quest();
  return { on: !!q, step: q ? q.step : -1, text: tryv(() => game().debug.step()?.text, ''), wanted: wanted(), nearSilt: dist(SILT_AJ) <= REACH, nearJory: dist(JORY_AJ) <= REACH, btn: btn?.textContent || '', btnOn: !!btn?.classList.contains('show') };
}
function goto(who) {
  const w = at(who === 'jory' ? JORY_AJ : SILT_AJ); if (!w) return false;
  const x = w.x, z = w.z + 3.2, yaw = Math.atan2(-(w.x - x), -(w.z - z));
  try { surf().debugPlace(x, z, yaw); } catch (e) { return false; }
  return true;
}
function reset() {
  try { if (quest()) game().abandon?.(); } catch (e) { /* */ }
  registered = false;
}

if (typeof window !== 'undefined') boot();
