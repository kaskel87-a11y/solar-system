// v7.5.99 hang glider. Buy and turn it on from ☰ → Hang glider. Jets are the upgrade on that page.
// surface.js skips the walk while flying() is true. This tick then moves you.
import * as THREE from 'three';
import * as C from './glidercore.js';

const KEY = 'ssx.glider.v1';
const app = () => window.__app, surf = () => app()?.surface, game = () => surf()?.game || app()?.game;
const toast = (t, ms = 2800) => { try { app()?.toast?.(t, ms); } catch (e) { /* */ } };
const EYE = 1.7;
const pad = { glide: false, left: false, right: false, boost: false };
let save = { owned: false, on: true, jets: false };
try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && typeof j === 'object') save = { owned: !!j.owned, on: j.on !== false, jets: !!j.jets }; } catch (e) { /* fresh */ }
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* */ } };
const flag = id => { try { return !!game()?.flag?.(id); } catch (e) { return false; } };
const owned = () => save.owned || flag('glider');
const jets = () => (save.jets || flag('gliderjets')) && owned();
const ready = () => owned() && save.on;

const s = C.fresh();
let lastTc = null, wing = null, shown = false;

function groundY(tc, x, z, feet) {
  try {
    const h = tc.world?.playerGround && Number.isFinite(feet) ? tc.world.playerGround(x, z, feet) : tc.world?.groundAt?.(x, z);
    if (Number.isFinite(h)) return h;
  } catch (e) { /* */ }
  return tc.height ? tc.height(x, z) : 0;
}
function spend(n) { const g = game(); if (!g?.spend) return false; return !!g.spend(n); }
function buyGlider() {
  if (owned()) return { ok: false, why: 'You already have the hang glider.' };
  if (!spend(C.PRICE)) return { ok: false, why: `The hang glider is ${C.PRICE} cr.` };
  save.owned = true; save.on = true; persist(); try { game()?.setFlag?.('glider'); } catch (e) { /* */ }
  return { ok: true, why: 'Hang glider on. Run and tap Glide, or tap Glide as you fall. Left and Right steer.' };
}
function buyJets() {
  if (!owned()) return { ok: false, why: 'Buy the hang glider first.' };
  if (jets()) return { ok: false, why: 'Jets are already on the wing.' };
  if (!spend(C.JET_PRICE)) return { ok: false, why: `Jets are ${C.JET_PRICE} cr.` };
  save.jets = true; persist(); try { game()?.setFlag?.('gliderjets'); } catch (e) { /* */ }
  return { ok: true, why: 'Jets fitted. While you glide, hold Boost to climb.' };
}
function setOn(v) { if (!owned()) return false; save.on = !!v; persist(); if (!save.on) s.flying = false; return save.on; }

const CSS = `#hgBar{position:fixed;z-index:8;left:calc(8px + env(safe-area-inset-left));bottom:calc(122px + env(safe-area-inset-bottom));display:none;gap:8px;pointer-events:auto}
body.touch.surface.hg-on:not(.driving):not(.indoors) #hgBar{display:flex}
#hgBar button{width:56px;height:56px;min-width:48px;min-height:48px;border-radius:14px;border:2px solid #fff;background:#000;color:#fff;font:800 14px/1.1 system-ui,sans-serif;touch-action:none;padding:0}
#hgBar button.on{background:#fff;color:#000}
#hgBar button.wide{width:auto;min-width:72px;padding:0 10px}
#hgSheet{position:fixed;left:0;right:0;bottom:0;z-index:64;display:none;box-sizing:border-box;padding:12px calc(12px + env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) calc(12px + env(safe-area-inset-left));background:#000;color:#fff;border-top:2px solid #fff;font:15px/1.35 system-ui,sans-serif}
#hgSheet.on{display:block} #hgSheet h2{margin:0 0 6px;font-size:18px} #hgSheet p{margin:0 0 8px}
#hgSheet .row{display:flex;gap:8px;flex-wrap:wrap}
#hgSheet button{min-height:48px;min-width:48px;flex:1 1 140px;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:800 16px/1.15 system-ui,sans-serif;touch-action:manipulation}`;

let sheet = null, bar = null;
function ensureUi() {
  if (document.getElementById('hgCss')) return;
  const st = document.createElement('style'); st.id = 'hgCss'; st.textContent = CSS; document.head.appendChild(st);
  bar = document.createElement('div'); bar.id = 'hgBar';
  bar.innerHTML = '<button type="button" id="hgLeft" aria-label="Steer left">◀</button><button type="button" id="hgGlide" class="wide" aria-label="Glide">Glide</button><button type="button" id="hgRight" aria-label="Steer right">▶</button><button type="button" id="hgBoost" class="wide" aria-label="Boost">Boost</button>';
  document.body.appendChild(bar);
  const hold = (id, key) => {
    const el = bar.querySelector(id);
    const down = e => { e.preventDefault(); pad[key] = true; el.classList.add('on'); try { el.setPointerCapture?.(e.pointerId); } catch (err) { /* */ } };
    const up = () => { pad[key] = false; el.classList.remove('on'); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  };
  hold('#hgLeft', 'left'); hold('#hgRight', 'right'); hold('#hgGlide', 'glide'); hold('#hgBoost', 'boost');
  sheet = document.createElement('div'); sheet.id = 'hgSheet'; sheet.setAttribute('role', 'dialog'); document.body.appendChild(sheet);
  sheet.addEventListener('pointerup', e => {
    const b = e.target?.closest?.('button'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'close') sheet.classList.remove('on');
    else if (a === 'buy') note(buyGlider());
    else if (a === 'jets') note(buyJets());
    else if (a === 'toggle') { setOn(!save.on); renderSheet(); }
  });
}
function note(r) { toast(r.why, 3600); renderSheet(); }
function renderSheet() {
  if (!sheet) return;
  const have = owned(), jet = jets();
  const toggle = have ? `<button type="button" data-a="toggle">${save.on ? 'Glider on' : 'Glider off'}</button>` : `<button type="button" data-a="buy">Buy glider · ${C.PRICE} cr</button>`;
  const jetBtn = jet ? '' : `<button type="button" data-a="jets">${have ? 'Buy jets · ' + C.JET_PRICE + ' cr' : 'Jets need the glider'}</button>`;
  sheet.innerHTML = `<h2>Hang glider</h2><p>${C.HOW}</p><p>${have ? (save.on ? 'The glider is on.' : 'The glider is off.') : 'You do not own it yet.'} ${jet ? 'Jets are fitted. Hold Boost to climb.' : ''}</p><div class="row">${toggle}${jetBtn}<button type="button" data-a="close">Close</button></div>`;
}
function openSheet() { ensureUi(); renderSheet(); sheet.classList.add('on'); try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ } }

function buildWing() {
  const g = new THREE.Group(); g.name = 'hangglider';
  const cloth = new THREE.MeshStandardMaterial({ color: 0xd4552a, roughness: 0.85, side: THREE.DoubleSide });
  const bar = new THREE.MeshStandardMaterial({ color: 0x2a241c, metalness: 0.4, roughness: 0.5 });
  const wing = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.04, 1.15), cloth); wing.position.set(0, 2.15, -0.15); g.add(wing);
  const keel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.5), bar); keel.position.set(0, 2.05, -0.1); g.add(keel);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 6), bar); nose.rotation.x = Math.PI / 2; nose.position.set(0, 2.15, -0.85); g.add(nose);
  for (const sx of [-0.7, 0.7]) {
    const n = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 6), new THREE.MeshBasicMaterial({ color: 0x7fe9ff, transparent: true, opacity: 0.85 }));
    n.name = 'jet'; n.rotation.x = Math.PI; n.position.set(sx, 1.85, 0.15); n.visible = false; g.add(n);
  }
  return g;
}
function visuals(tc, on, lit) {
  if (!tc?.scene) return;
  if (!wing) wing = buildWing();
  if (on && wing.parent !== tc.scene) tc.scene.add(wing);
  const p = tc.player;
  wing.visible = !!(on && p);
  if (!wing.visible) return;
  wing.position.set(p.x, p.y - EYE, p.z);
  wing.rotation.set(lit ? -0.25 : -0.08, p.yaw, pad.left ? 0.35 : pad.right ? -0.35 : 0);
  wing.children.forEach(o => { if (o.name === 'jet') o.visible = !!lit; });
}

function tick(dt, tc) {
  lastTc = tc;
  const p = tc?.player;
  const mars = tc?.name === 'Mars' && app()?.state?.onSurface && !tc.car && !tc.world?.inside;
  document.body.classList.toggle('hg-on', !!(ready() && mars));
  const boostBtn = document.getElementById('hgBoost');
  if (boostBtn) boostBtn.style.display = jets() ? '' : 'none';
  if (!ready() || !mars || !p) { s.flying = false; visuals(tc, false, false); return; }
  const keys = app()?.keys || {}, joy = app()?.joy || { x: 0, y: 0 };
  const held = pad.glide || !!keys.KeyG;
  const steer = (pad.left || keys.KeyA ? -1 : 0) + (pad.right || keys.KeyD ? 1 : 0) + (joy.x || 0);
  const feet = p.y - EYE, gy = groundY(tc, p.x, p.z, feet), alt = Math.max(0, feet - gy);
  const running = !!(p.running && p.moving > 0.3) || Math.hypot(s.vx, s.vz) >= C.RUN_SPEED;
  const r = C.step(s, { dt, yaw: p.yaw, steer: Math.max(-1, Math.min(1, steer)), grounded: !!p.grounded && !s.flying, alt, vy: p.vy, held, boost: pad.boost || !!(keys.ShiftLeft || keys.ShiftRight), jets: jets(), running });
  if (r.flying) {
    let nx = p.x + r.vx * dt, nz = p.z + r.vz * dt;
    const c = tc.world?.collidePlayer?.(nx, nz, 0.45, p.y - EYE);
    if (c) { nx = c.x; nz = c.z; }
    p.x = nx; p.z = nz; p.yaw = r.yaw; p.faceYaw = r.yaw; p.vy = r.vy; p.y += r.vy * dt;
    const gy2 = groundY(tc, p.x, p.z, p.y - EYE);
    if (p.y <= gy2 + EYE) { p.y = gy2 + EYE; p.vy = 0; p.grounded = true; s.flying = false; s.vx = 0; s.vz = 0; }
    else p.grounded = false;
    if (r.launched && !shown) { shown = true; toast(jets() ? 'Gliding. Left and Right steer. Hold Boost to climb.' : 'Gliding. Left and Right steer. Buy jets from ☰ → Hang glider to climb.', 4200); }
  }
  visuals(tc, r.flying, r.thrusting);
}

function boot() {
  const S = window.SSX; if (!S?.registerSurfaceTick || !app()) { setTimeout(boot, 300); return; }
  if (S.glider) return;
  ensureUi();
  S.glider = {
    PRICE: C.PRICE, JET_PRICE: C.JET_PRICE, HOW: C.HOW,
    owned, jets, on: () => save.on, flying: () => s.flying, fuel: () => s.fuel,
    buy: buyGlider, buyJets, setOn, open: openSheet,
    debug: {
      lift(m = 14) { const p = lastTc?.player; if (!p) return false; p.y += m; p.vy = -0.4; p.grounded = false; return true; },
      hold(o = {}) { if (o.glide != null) pad.glide = !!o.glide; if (o.boost != null) pad.boost = !!o.boost; if (o.left != null) pad.left = !!o.left; if (o.right != null) pad.right = !!o.right; return { ...pad, flying: s.flying, fuel: s.fuel }; },
      state: () => ({ flying: s.flying, fuel: s.fuel, vx: s.vx, vz: s.vz, owned: owned(), jets: jets(), on: save.on })
    }
  };
  S.registerSurfaceTick((dt, tc) => { try { tick(dt, tc); } catch (e) { console.warn('glider', e); } });
  try { S.registerMenuItem?.({ id: 'rmGlider', label: '🪂 Hang glider', onTap: () => openSheet() }); } catch (e) { /* */ }
  addEventListener('keydown', e => { if (e.code === 'KeyG' && ready()) pad.glide = true; });
  addEventListener('keyup', e => { if (e.code === 'KeyG') pad.glide = false; });
}
if (typeof window !== 'undefined') boot();
export default { boot };
