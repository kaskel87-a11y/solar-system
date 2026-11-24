// v7.5.138 Street offers in the scummy parts of town. Adults only. Clothes stay on.
// The act is a black screen: you pay, you get a line, you get a little of your wind back.
// Tiers run 100 to 5000 cr. Red Tape Flats alley and the edge of Red Static Gulch.
// window.SSX.streetWork = { offer, buy, state, debug }
import * as THREE from 'three';

const FLATS = [-330, -120];
const GULCH = [120, 300];
const REACH = 8;
const TIERS = [
  { cr: 100, name: 'Lira Voss', age: 34, heal: 12, wear: 'a short dress, an open coat, and boots',
    pitch: 'Lira Voss, thirty-four, leans on the wall in a short dress and an open coat. "Hundred. I talk filthy and I keep the coat on. You do not get a show."',
    line: 'The alley goes black. Lira keeps the dress on, talks the nastiest thing you have heard all week, and works you with her hand until you finish in your clothes. She counts the hundred and lights a cigarette.' },
  { cr: 500, name: 'Nessa Quill', age: 29, heal: 20, wear: 'a tight skirt, a mesh top over a bra, and heels',
    pitch: 'Nessa Quill, twenty-nine, in a tight skirt and a mesh top over a bra. "Five hundred. Mouth and hands. Nothing comes off."',
    line: 'Black. Nessa stays dressed, gets on her knees in the skirt, and uses her mouth until your legs go. She wipes her lip, pockets the five hundred, and tells you to walk it off.' },
  { cr: 1500, name: 'Bram Holt', age: 41, heal: 28, wear: 'an undone work shirt, jeans, and boots',
    pitch: 'Bram Holt, forty-one, shirt open, jeans, boots. "Fifteen hundred. I put you against the wall. Clothes stay on. I do not do boys."',
    line: 'Black. Bram keeps the jeans on, presses you to the brick, and grinds until you both finish in your clothes. He buttons the shirt, takes the fifteen hundred, and tells you not to linger.' },
  { cr: 5000, name: 'Maris Quen', age: 38, heal: 40, wear: 'a long coat, a slit dress, and gloves',
    pitch: 'Maris Quen, thirty-eight, long coat over a slit dress, gloves on. "Five thousand. I take my time. You will not see a thing you are not supposed to. The dark does."',
    line: 'Black. Maris keeps the dress and the gloves on and takes her time, talking you through every filthy thing she is doing under the coat. You finish shaking. She takes the five thousand and disappears up the alley.' }
];

const app = () => window.__app;
const surf = () => app()?.surface;
const game = () => surf()?.game || app()?.game;
const world = () => surf()?.world;
const toast = (t, ms = 3200) => { try { app()?.toast?.(t, ms); } catch (e) { /* */ } };
const tryv = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } };

let btn = null, sheet = null, fade = null, figs = {}, last = null;

function at(aj) { const p = tryv(() => world().colonyAt(aj)); return p && Number.isFinite(p.x) ? p : null; }
function player() { const i = surf()?.info; return i && !i.inside ? { x: i.x, z: i.z } : null; }
function dist(aj) { const p = player(), w = at(aj); if (!p || !w) return Infinity; return Math.hypot(p.x - w.x, p.z - w.z); }
const onMars = () => { const i = surf()?.info; return !!(app()?.state?.onSurface && i && i.name === 'Mars' && !i.inside); };
function here() {
  if (dist(FLATS) <= REACH) return 'flats';
  if (dist(GULCH) <= REACH) return 'gulch';
  return '';
}

function ensure() {
  if (btn) return;
  const st = document.createElement('style'); st.id = 'sworkCss';
  st.textContent = '#sworkAct{position:fixed;z-index:13;left:calc(8px + env(safe-area-inset-left));bottom:calc(190px + env(safe-area-inset-bottom));display:none;min-height:48px;min-width:64px;max-width:170px;padding:4px 8px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 13px/1.15 system-ui,sans-serif;touch-action:manipulation}'
    + 'body.surface #sworkAct.show{display:block} body.cinematic #sworkAct,body.hxMapOpen #sworkAct,body:has(#roverMenu.show) #sworkAct{display:none!important}'
    + '#sworkSheet{position:fixed;left:0;right:0;bottom:0;z-index:18;display:none;max-height:48vh;overflow:auto;padding:12px 12px calc(12px + env(safe-area-inset-bottom));background:#000;color:#fff;border-top:2px solid #fff;box-sizing:border-box;font:14px/1.35 system-ui,sans-serif}'
    + '#sworkSheet.on{display:block}#sworkSheet h3{margin:0 0 6px}#sworkSheet button{display:block;width:100%;min-height:44px;margin-top:6px;border-radius:10px;border:2px solid #fff;background:#000;color:#fff;font:800 14px system-ui,sans-serif;text-align:left;padding:8px 10px}'
    + '#sworkFade{position:fixed;inset:0;z-index:40;display:none;align-items:center;justify-content:center;background:#000;color:#fff;text-align:center;padding:24px;font:700 16px/1.4 system-ui,sans-serif}'
    + '#sworkFade.on{display:flex}';
  document.head.appendChild(st);
  btn = document.createElement('button'); btn.id = 'sworkAct'; btn.type = 'button'; btn.textContent = 'Ask the corner';
  document.body.appendChild(btn);
  const tap = window.__onTap; if (tap) tap(btn, () => offer()); else btn.addEventListener('click', () => offer());
  sheet = document.createElement('div'); sheet.id = 'sworkSheet';
  document.body.appendChild(sheet);
  sheet.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.a === 'close') close(); else buy(+b.dataset.cr); });
  fade = document.createElement('div'); fade.id = 'sworkFade';
  document.body.appendChild(fade);
}
function close() { sheet?.classList.remove('on'); }
export function offer() {
  ensure();
  const spot = here();
  if (!spot) { toast('The corner is in a Red Tape Flats alley, or out at Red Static Gulch.'); return { ok: false }; }
  const where = spot === 'gulch' ? 'Red Static Gulch' : 'a Red Tape Flats alley';
  sheet.innerHTML = `<h3>The corner · ${where}</h3><p>Adults. Clothes stay on. The rest happens in the dark.</p>`
    + TIERS.map(t => `<button type="button" data-cr="${t.cr}">${t.cr.toLocaleString('en-US')} cr · ${t.name}, ${t.age}<br>${t.pitch}</button>`).join('')
    + '<button type="button" data-a="close">Walk away</button>';
  sheet.classList.add('on');
  return { ok: true, spot };
}
export function buy(cr) {
  ensure();
  const t = TIERS.find(x => x.cr === cr); if (!t) return { ok: false };
  const g = game();
  if (!g?.spend?.(cr)) { toast(`You need ${cr} cr.`); return { ok: false, poor: true }; }
  try { g.heal?.(t.heal); } catch (e) { /* */ }
  last = { cr, name: t.name, line: t.line };
  fade.textContent = t.line;
  fade.classList.add('on');
  clearTimeout(buy.t);
  buy.t = setTimeout(() => fade.classList.remove('on'), 2600);
  close();
  toast(`${t.name}: paid ${cr} cr.`);
  return { ok: true, cr, name: t.name, line: t.line, heal: t.heal };
}
function figure(name, color) {
  const g = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc4926a, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.9, 8), cloth); body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), skin); head.position.y = 1.6; g.add(head);
  g.name = 'corner-' + name;
  return g;
}
function showFig(key, aj, color) {
  const sc = surf()?.scene, w = at(aj); if (!sc || !w) return;
  if (!figs[key]) figs[key] = figure(key, color);
  const m = figs[key]; if (m.parent !== sc) sc.add(m);
  let y = 0; try { y = surf().height?.(w.x, w.z) || 0; } catch (e) { /* */ }
  m.position.set(w.x, y, w.z); m.visible = dist(aj) < 80;
}
function tick() {
  if (!onMars()) { btn?.classList.remove('show'); close(); return; }
  ensure();
  const spot = here();
  if (dist(FLATS) < 90) showFig('lira', FLATS, 0x4a1030);
  if (dist(GULCH) < 90) showFig('maris', GULCH, 0x201028);
  if (spot && !sheet.classList.contains('on') && !fade.classList.contains('on')) btn.classList.add('show');
  else btn.classList.remove('show');
}
function state() { return { spot: here(), sheet: !!sheet?.classList.contains('on'), fade: !!fade?.classList.contains('on'), last, tiers: TIERS.map(t => t.cr) }; }
function goto(who) {
  const w = at(who === 'gulch' ? GULCH : FLATS); if (!w) return false;
  try { surf().debugPlace(w.x + 2, w.z + 2, 0); } catch (e) { return false; }
  return true;
}
function boot() {
  if (!window.SSX?.registerSurfaceTick && !window.__app) { setTimeout(boot, 250); return; }
  window.SSX = window.SSX || {};
  if (window.SSX.streetWork) return;
  window.SSX.streetWork = { offer, buy, state, tiers: TIERS.map(t => ({ cr: t.cr, name: t.name, age: t.age })), debug: { goto, state } };
  if (typeof window.SSX.registerSurfaceTick === 'function') window.SSX.registerSurfaceTick(() => { try { tick(); } catch (e) { /* */ } });
}
if (typeof window !== 'undefined') boot();
