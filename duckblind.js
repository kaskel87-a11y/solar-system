// Duck Blind (v7.5.86): a marsh shoot on Earth. Walk up to the blind, or set a waypoint from the menu.
// Tap a duck before it flaps off. Three shots per duck. Ten ducks a round. Faster each round.
// Pip the hound pops out of the reeds when one gets away. Fiction only. No borrowed characters.
import * as THREE from 'three';
import * as C from './duckblindcore.js';
import { addMenuItem, tap, panelTap } from './racehooks.js';

const app = () => window.__app;
const SSX = () => window.SSX || {};
const toast = (m, ms = 2800) => { try { app()?.toast?.(m, ms); } catch (e) { /* */ } };

let S = C.loadState(null);
try { S = C.loadState(localStorage.getItem(C.SAVE_KEY)); } catch (e) { /* private mode */ }
const save = () => { try { localStorage.setItem(C.SAVE_KEY, JSON.stringify(S)); } catch (e) { /* */ } };

const R = { spot: null, mesh: null, round: 1, play: null, raf: 0, last: 0 };
const HOUND = `<svg viewBox="0 0 64 48" aria-hidden="true"><ellipse cx="34" cy="30" rx="18" ry="12" fill="#8a5a32"/><ellipse cx="18" cy="26" rx="12" ry="10" fill="#a56b3c"/><ellipse cx="10" cy="16" rx="5" ry="8" fill="#6b4224"/><ellipse cx="24" cy="14" rx="4" ry="7" fill="#6b4224"/><circle cx="14" cy="26" r="1.6" fill="#1a120c"/><ellipse cx="8" cy="30" rx="4" ry="2.4" fill="#2a2118"/></svg>`;

const CSS = `#dbAct{position:fixed;z-index:15;right:calc(8px + env(safe-area-inset-right));bottom:calc(210px + env(safe-area-inset-bottom));display:none;min-width:64px;min-height:52px;padding:6px 10px;border-radius:14px;border:2px solid #fff;background:#000;color:#fff;font:800 14px/1.1 system-ui,sans-serif;touch-action:manipulation}
#dbAct.on{display:block}
#dbCard{position:fixed;inset:0;z-index:64;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.45)}
#dbCard.on{display:flex}
#dbCard .wrap{position:relative;width:min(96vw,420px);margin:0 8px calc(12px + env(safe-area-inset-bottom));background:#000;color:#fff;border:2px solid #fff;border-radius:16px;padding:14px 14px 12px;box-sizing:border-box;font:15px/1.35 system-ui,sans-serif}
#dbCard h2{margin:0 36px 8px 0;font-size:18px}
#dbCard p{margin:0 0 10px}
#dbCard .x{position:absolute;top:8px;right:8px;width:44px;height:44px;border-radius:10px;border:2px solid #fff;background:#000;color:#fff;font:700 22px/40px system-ui,sans-serif}
#dbCard .row{display:flex;flex-wrap:wrap;gap:8px}
#dbCard .row button{flex:1 1 140px;min-height:48px;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:800 15px/1.15 system-ui,sans-serif;touch-action:manipulation}
#dbPlay{position:fixed;inset:0;z-index:72;display:none;background:linear-gradient(#7ec8f0 0%,#d8f0c8 62%,#2f6a32 62%,#1c4a28 100%);touch-action:none;overflow:hidden}
#dbPlay.on{display:block}
#dbHud{position:absolute;left:calc(8px + env(safe-area-inset-left));top:calc(8px + env(safe-area-inset-top));display:flex;flex-direction:column;gap:4px;color:#000;font:800 16px/1.2 system-ui,sans-serif;text-shadow:0 1px 0 #fff}
#dbHud .shots{display:flex;gap:4px}
#dbHud .shots i{width:18px;height:10px;border-radius:3px;background:#fff;border:2px solid #000;display:block}
#dbHud .shots i.used{background:#222}
#dbClose{position:absolute;right:calc(8px + env(safe-area-inset-right));top:calc(8px + env(safe-area-inset-top));width:44px;height:44px;border-radius:10px;border:2px solid #fff;background:#000;color:#fff;font:700 22px/40px system-ui,sans-serif}
#dbDuck{position:absolute;width:80px;height:80px;margin:-40px 0 0 -40px;padding:0;border:0;background:transparent;touch-action:manipulation}
#dbDuck svg{width:64px;height:48px;display:block;margin:16px auto 0;filter:drop-shadow(0 2px 0 rgba(0,0,0,.35))}
#dbHound{position:absolute;left:50%;bottom:0;width:96px;height:72px;margin-left:-48px;transform:translateY(110%);transition:transform .25s ease-out;pointer-events:none}
#dbHound.up{transform:translateY(0)}
#dbHound .ha{position:absolute;top:-8px;right:-6px;background:#fff;color:#000;border:2px solid #000;border-radius:10px;padding:2px 6px;font:800 14px system-ui,sans-serif}
#dbCount{position:absolute;left:calc(8px + env(safe-area-inset-left));bottom:calc(12px + env(safe-area-inset-bottom));color:#fff;font:800 14px system-ui,sans-serif;text-shadow:0 1px 2px #000}`;

const DUCK_SVG = (flip) => `<svg viewBox="0 0 64 48" style="transform:scaleX(${flip ? -1 : 1})"><ellipse cx="28" cy="28" rx="16" ry="10" fill="#c4a15a"/><circle cx="44" cy="20" r="9" fill="#2f6a32"/><polygon points="50,18 62,22 50,26" fill="#e2a040"/><ellipse cx="16" cy="30" rx="10" ry="6" fill="#8a7340"/></svg>`;

let actBtn = null, card = null, playEl = null, duckEl = null, houndEl = null;
function ensureDom() {
  if (actBtn || typeof document === 'undefined') return;
  const st = document.createElement('style'); st.id = 'dbCss'; st.textContent = CSS; document.head.appendChild(st);
  actBtn = document.createElement('button'); actBtn.id = 'dbAct'; actBtn.type = 'button'; actBtn.textContent = '🦆 Blind';
  actBtn.setAttribute('aria-label', 'Play Duck Blind'); document.body.appendChild(actBtn);
  tap(actBtn, () => openCard());
  card = document.createElement('div'); card.id = 'dbCard';
  card.innerHTML = `<div class="wrap"><button type="button" class="x" data-a="close" aria-label="Close">✕</button><h2>🦆 ${C.NAME}</h2><p id="dbBlurb"></p><div class="row"><button type="button" data-a="start">Start round</button><button type="button" data-a="close">Close</button></div></div>`;
  document.body.appendChild(card);
  panelTap(card, e => { const b = e.target?.closest?.('button'); if (b && !b.disabled) onCard(b.dataset.a); });
  playEl = document.createElement('div'); playEl.id = 'dbPlay';
  playEl.innerHTML = `<div id="dbHud"><b id="dbScore">0</b><span class="shots" id="dbShots"></span></div><button type="button" id="dbClose" aria-label="Leave">✕</button><button type="button" id="dbDuck" aria-label="Duck"></button><div id="dbHound">${HOUND}<span class="ha"></span></div><div id="dbCount"></div>`;
  document.body.appendChild(playEl);
  duckEl = playEl.querySelector('#dbDuck');
  houndEl = playEl.querySelector('#dbHound');
  tap(playEl.querySelector('#dbClose'), () => leaveRound());
  playEl.addEventListener('pointerdown', onSky);
  duckEl.addEventListener('pointerdown', onDuck);
}
function blurb() {
  return `Tap the ducks before they fly away. ${C.DUCKS} ducks, ${C.SHOTS} shots each. They fly faster every round. Best ${S.best}.`;
}
function openCard() {
  ensureDom();
  card.querySelector('#dbBlurb').textContent = blurb();
  card.classList.add('on');
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ }
  return true;
}
function closeCard() { card?.classList.remove('on'); return true; }
function onCard(a) {
  if (a === 'close') return closeCard();
  if (a === 'start') { closeCard(); return startRound(); }
}

function paintHud() {
  const p = R.play; if (!p || !playEl) return;
  playEl.querySelector('#dbScore').textContent = String(C.scoreOf(p.hits));
  const shots = p.duck ? p.duck.shots : 0;
  playEl.querySelector('#dbShots').innerHTML = [0, 1, 2].map(i => `<i class="${i >= shots ? 'used' : ''}"></i>`).join('');
  playEl.querySelector('#dbCount').textContent = `Duck ${Math.min(C.DUCKS, p.n + 1)}/${C.DUCKS} · round ${p.round}`;
}
function placeDuck() {
  const p = R.play; if (!p?.duck || !duckEl) return;
  const pt = C.duckPoint(p.duck, p.duck.t);
  const r = playEl.getBoundingClientRect();
  duckEl.style.left = (pt.x * r.width) + 'px';
  duckEl.style.top = (pt.y * r.height) + 'px';
  duckEl.innerHTML = DUCK_SVG(p.duck.from === 'right');
  duckEl.style.display = 'block';
}
function hound(msg) {
  if (!houndEl) return;
  houndEl.querySelector('.ha').textContent = msg || '';
  houndEl.classList.add('up');
  clearTimeout(houndEl._t);
  houndEl._t = setTimeout(() => houndEl.classList.remove('up'), 700);
}
function startRound() {
  ensureDom();
  stopLoop();
  R.play = { round: R.round, n: 0, hits: 0, duck: null, ms: C.flightMs(R.round), busy: false };
  playEl.classList.add('on');
  actBtn.classList.remove('on');
  nextDuck();
  R.last = performance.now();
  R.raf = requestAnimationFrame(loop);
  return true;
}
function nextDuck() {
  const p = R.play; if (!p) return;
  if (p.n >= C.DUCKS) return finishRound(true);
  p.duck = C.spawnDuck(p.round);
  p.ms = C.flightMs(p.round);
  p.busy = false;
  placeDuck();
  paintHud();
}
function hit() {
  const p = R.play; if (!p?.duck || p.busy) return false;
  p.busy = true; p.hits++; p.n++; p.duck = null;
  if (duckEl) duckEl.style.display = 'none';
  hound('');
  paintHud();
  setTimeout(() => { if (R.play === p) nextDuck(); }, 280);
  return true;
}
function miss() {
  const p = R.play; if (!p?.duck || p.busy) return false;
  p.duck.shots -= 1;
  paintHud();
  if (p.duck.shots <= 0) escape();
  return true;
}
function escape() {
  const p = R.play; if (!p?.duck || p.busy) return;
  p.busy = true; p.n++; p.duck = null;
  if (duckEl) duckEl.style.display = 'none';
  hound('Ha!');
  paintHud();
  setTimeout(() => { if (R.play === p) nextDuck(); }, 420);
}
function onDuck(e) { e.preventDefault(); e.stopPropagation(); hit(); }
function onSky(e) {
  if (!R.play || e.target.closest('#dbDuck, #dbClose')) return;
  e.preventDefault();
  miss();
}
function loop(now) {
  const p = R.play; if (!p) return;
  const dt = Math.min(0.05, Math.max(0, (now - R.last) / 1000)); R.last = now;
  if (p.duck && !p.busy && !p.frozen) {
    p.duck.t += dt / (p.ms / 1000);
    if (p.duck.t >= 1) escape();
    else placeDuck();
  }
  R.raf = requestAnimationFrame(loop);
}
function stopLoop() { if (R.raf) cancelAnimationFrame(R.raf); R.raf = 0; }
function finishRound(done) {
  const p = R.play; if (!p) return;
  stopLoop();
  const pay = C.payOf(p.hits, !!done);
  const sc = C.scoreOf(p.hits);
  if (sc > S.best) S.best = sc;
  S.rounds++; S.hits += p.hits; S.earned += pay.cr; save();
  try { app()?.game?.reward?.(pay.stars, pay.cr); } catch (e) { /* */ }
  R.round += 1;
  R.play = null;
  playEl?.classList.remove('on');
  const line = pay.perfect ? `Perfect. ${p.hits}/${C.DUCKS}. Score ${sc}. +${pay.cr} cr and ${pay.stars} ⭐.` : `${p.hits} of ${C.DUCKS}. Score ${sc}. Best ${S.best}.${pay.cr ? ` +${pay.cr} cr.` : ''}`;
  toast(`🦆 ${line}`, 4200);
  if (card) { card.querySelector('#dbBlurb').textContent = line + ' ' + blurb(); card.classList.add('on'); }
  return { hits: p.hits, score: sc, ...pay, best: S.best };
}
function leaveRound() {
  if (!R.play) { playEl?.classList.remove('on'); return; }
  return finishRound(false);
}

function here() {
  const i = app()?.surface?.info;
  if (!i || i.name !== 'Earth') return null;
  return i;
}
function plant() {
  const h = SSX().height;
  let a = C.AT.a * Math.PI / 180, d = C.AT.d, x = 0, z = 0, y = 2;
  for (let k = 0; k < 24; k++) {
    x = Math.sin(a) * d; z = -Math.cos(a) * d;
    y = typeof h === 'function' ? h(x, z) : 2;
    if (Number.isFinite(y) && y > 0.4) break;
    d += 12;
  }
  if (!Number.isFinite(y)) y = 2;
  return { x, y, z };
}
function buildMesh(scene, spot) {
  if (R.mesh) return;
  const g = new THREE.Group(); g.name = 'duckBlind';
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a28, roughness: 0.9 });
  const reed = new THREE.MeshStandardMaterial({ color: 0x3e8a32, roughness: 0.8 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 0.12), wood); wall.position.y = 0.7; g.add(wall);
  const side = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 1.4), wood); side.position.set(-1.1, 0.7, 0.5); g.add(side);
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.3, 4), reed);
    s.position.set(-1.6 + i * 0.55, 0.65, 1.1 + (i % 2) * 0.25); g.add(s);
  }
  const geo = new THREE.CylinderGeometry(0.35, 0.5, 18, 8, 1, true); geo.translate(0, 9, 0);
  const beam = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xb6e36a, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide }));
  beam.name = 'dbBeam'; beam.frustumCulled = false; g.add(beam);
  g.position.set(spot.x, spot.y, spot.z);
  scene.add(g); R.mesh = g;
}
function worldTick(dt, tc) {
  void dt;
  if (!tc || tc.name !== 'Earth' || !tc.scene) {
    if (R.mesh) { R.mesh.parent?.remove(R.mesh); R.mesh = null; }
    try { SSX().minimap?.addMarks?.('duckblind', []); } catch (e) { /* */ }
    actBtn?.classList.remove('on');
    return;
  }
  if (!R.spot) R.spot = plant();
  buildMesh(tc.scene, R.spot);
  const y = SSX().height?.(R.spot.x, R.spot.z);
  if (R.mesh && Number.isFinite(y)) R.mesh.position.y = y;
  try { SSX().minimap?.addMarks?.('duckblind', [{ x: R.spot.x, z: R.spot.z, color: '#7dce3a', r: 4 }]); } catch (e) { /* */ }
  const p = tc.player;
  const near = p && Math.hypot(p.x - R.spot.x, p.z - R.spot.z) <= C.NEAR && !R.play && !card?.classList.contains('on');
  actBtn?.classList.toggle('on', !!near);
}
function waypoint() {
  const i = here();
  if (!i) { toast('Land on Earth. The duck blind is in the marsh by the landing field.', 3200); return false; }
  if (!R.spot) R.spot = plant();
  try { SSX().hudx?.setWaypoint?.({ x: R.spot.x, z: R.spot.z, label: 'Duck Blind' }, true); } catch (e) { /* */ }
  try { SSX().guide?.aimGround?.({ id: 'duckblind', x: R.spot.x, z: R.spot.z, label: 'Blind' }); } catch (e) { /* */ }
  toast('Follow the arrow to the duck blind in the marsh.', 2800);
  return true;
}

const api = {
  version: 'v7.5.86',
  NAME: C.NAME,
  get state() {
    const p = R.play;
    return { round: R.round, best: S.best, rounds: S.rounds, earned: S.earned, spot: R.spot, playing: !!p, hits: p ? p.hits : 0, n: p ? p.n : 0, shots: p?.duck?.shots ?? 0, score: p ? C.scoreOf(p.hits) : 0 };
  },
  open: openCard, close: closeCard, start: startRound, leave: leaveRound, waypoint,
  debug: {
    at: () => R.spot || plant(),
    hit, miss,
    freeze(v = true) { if (R.play) R.play.frozen = !!v; return !!R.play?.frozen; },
    finish(hits) { const p = R.play; if (!p) return null; if (hits != null) p.hits = hits; p.n = C.DUCKS; p.duck = null; p.busy = true; return finishRound(true); },
    round: (n) => { R.round = Math.max(1, n | 0); return R.round; }
  }
};
window.SSX = window.SSX || {};
window.SSX.duckblind = api;

function boot(n = 0) {
  if (!window.SSX?.registerSurfaceTick || !window.__app?.registerMenuItem) { if (n < 400) setTimeout(() => boot(n + 1), 200); return; }
  ensureDom();
  try { addMenuItem(window.__app, { id: 'dbMenu', label: '🦆 Duck Blind', onTap: () => waypoint() }); } catch (e) { console.warn('duck blind menu', e); }
  try { window.SSX.registerSurfaceTick(worldTick); } catch (e) { console.warn('duck blind tick', e); }
}
boot();
