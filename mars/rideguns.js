// v7.5.96 mounted guns. Buy them at the Meridian Depot (game.js shop, kind ridekit).
// Once you own them, every car you drive — your rover, a bought car, a stolen ride — has the mount.
// FIRE is the same button the rover turret already uses. Hitting a person still raises stars.
import * as THREE from 'three';
import * as R from './ridegunscore.js';
import { panelTap } from '../racehooks.js';

const SSX = () => (typeof window !== 'undefined' ? window.SSX : null);
const APP = () => (typeof window !== 'undefined' ? window.__app : null);
const game = () => APP()?.surface?.game || APP()?.game;
const ups = () => { try { return game()?.progress?.upgrades || []; } catch (e) { return []; } };
const owned = () => R.has(ups(), R.GUNS);
const rockets = () => R.mode(ups()) === 'rocket';

export function weapon() { return owned() ? R.weapon(ups()) : null; }

let guns = null, ui = null;
function ensureGuns() {
  if (guns) return guns;
  const g = new THREE.Group(); g.name = 'rideguns';
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.6, roughness: 0.4 });
  const hot = new THREE.MeshStandardMaterial({ color: 0xc8a24a, metalness: 0.5, roughness: 0.35 });
  const tube = new THREE.MeshStandardMaterial({ color: 0x6a2a14, metalness: 0.4, roughness: 0.45 });
  for (const x of [-0.28, 0.28]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.7), metal); b.position.set(x, 0.55, -0.9); g.add(b);
    const rkt = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 8), tube); rkt.rotation.x = Math.PI / 2; rkt.position.set(x, 0.7, -0.7); rkt.name = 'rkt'; g.add(rkt);
  }
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.28), hot); housing.position.set(0, 0.52, -0.55); g.add(housing);
  guns = g; return g;
}
function tick(dt, tc) {
  void dt;
  const driving = !!(tc?.car && !tc.world?.inside);
  if (typeof document !== 'undefined') document.body.classList.toggle('rideguns', driving && owned());
  const car = tc?.car; if (!car?.group) { guns?.parent?.remove(guns); return; }
  if (!owned()) { guns?.parent?.remove(guns); return; }
  const g = ensureGuns();
  if (g.parent !== car.group) car.group.add(g);
  g.visible = true;
  for (const o of g.children) if (o.name === 'rkt') o.visible = rockets();
}

const CSS = `#rgSheet{position:fixed;left:0;right:0;bottom:0;z-index:64;display:none;box-sizing:border-box;padding:12px calc(12px + env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) calc(12px + env(safe-area-inset-left));background:#000;color:#fff;border-top:2px solid #fff;font:15px/1.35 system-ui,sans-serif}
#rgSheet.on{display:block} #rgSheet h2{margin:0 0 6px;font-size:18px} #rgSheet p{margin:0 0 8px}
#rgSheet .row{display:flex;gap:8px;flex-wrap:wrap} #rgSheet button{min-height:48px;flex:1 1 140px;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:800 16px/1.15 system-ui,sans-serif;touch-action:manipulation}
body.touch.driving.rideguns:not(.indoors) #fireBtn{display:block!important;width:64px;height:64px;min-width:54px;min-height:54px}`;

function ensureCss() {
  if (typeof document === 'undefined' || document.getElementById('rgCss')) return;
  const st = document.createElement('style'); st.id = 'rgCss'; st.textContent = CSS; document.head.appendChild(st);
}
function open() {
  ensureCss();
  if (!ui && typeof document !== 'undefined') {
    ui = document.createElement('div'); ui.id = 'rgSheet'; ui.innerHTML = '<h2>🔫 Ride guns</h2><p></p><div class="row"><button type="button" data-a="depot">📍 Point at the Depot</button><button type="button" data-a="close">Close</button></div>';
    document.body.appendChild(ui);
    panelTap(ui, e => { const b = e.target?.closest?.('button'); if (!b) return; if (b.dataset.a === 'close') ui.classList.remove('on'); else point(); });
  }
  const w = weapon();
  ui.querySelector('p').textContent = w
    ? `You have ${w.name} on every car you drive. Tap FIRE. Shooting people brings stars. ${rockets() ? '' : 'Rockets are the next case at the Depot.'}`
    : R.HOW;
  ui.classList.add('on');
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ }
}
function point() {
  ui?.classList.remove('on');
  const d = APP()?.surface?.world?.doorFor?.('depot') || APP()?.surface?.world?.doorList?.().find(x => x.kind === 'depot');
  if (d && SSX()?.guide?.aimGround) { /* aim is per frame; a waypoint sticks */ }
  try { SSX()?.hudx?.setWaypoint?.({ x: d?.x, z: d?.z, label: 'Depot' }); } catch (e) { /* */ }
  try { APP()?.toast?.('The Depot is in Ares Junction. The arrow points at the door. Mounted guns are on the wall.', 4000); } catch (e) { /* */ }
}
function boot() {
  const S = SSX(); if (!S?.registerSurfaceTick || !APP()) { setTimeout(boot, 300); return; }
  if (S.rideguns) return;
  ensureCss();
  S.rideguns = { weapon, owned, rockets, open, HOW: R.HOW, covers: R.covers, GUNS: R.GUNS, ROCKETS: R.ROCKETS };
  S.registerSurfaceTick((dt, tc) => { try { tick(dt, tc); } catch (e) { console.warn('rideguns', e); } });
  try { S.registerMenuItem?.({ id: 'rmRideguns', label: '🔫 Ride guns', onTap: () => open() }); } catch (e) { /* */ }
}
if (typeof window !== 'undefined') boot();
