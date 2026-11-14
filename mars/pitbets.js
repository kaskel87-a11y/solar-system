// v7.5.98: watch an NPC fight at The Pit and bet on it.
// The window and the seat are mars/pitringcore.js BOOK and SEAT. Rules are pitbetscore.js.
// Arrow: SSX.guide.aim every tick, with the plain step on the label.
import * as THREE from 'three';
import * as K from './pitringcore.js';
import * as B from './pitbetscore.js';

const app = () => window.__app, surf = () => app()?.surface, game = () => app()?.game || surf()?.game;
const ring = () => window.SSX?.pitRing;
const toast = (t, ms) => { try { app()?.toast?.(t, ms); } catch (e) { /* */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

let card = null, booth = null, seatMark = null, figs = null, sheet = null, act = null, pick = null, paid = false;
const V = new THREE.Vector3();

function worldAt(local) {
  const c = ring()?.centre?.(); if (!c) return null;
  const y = ring()?.ground?.() || 0;
  return { x: c.x + local.x, y, z: c.z + local.z };
}
function here() { return surf()?.info || null; }
function distTo(local) {
  const w = worldAt(local), i = here(); if (!w || !i) return Infinity;
  return Math.hypot(i.x - w.x, i.z - w.z);
}
function onMars() {
  const a = app(), i = here();
  return !!(a?.state?.onSurface && !a.state.transitioning && i?.name === 'Mars' && !i.inside && !i.driving);
}

function ensureCard(now) {
  if (card) return;
  const [a, b] = B.pickPair(Math.random);
  card = B.freshCard(a, b, now); pick = null; paid = false;
}
function nameOf(id) { return B.BY[id]?.name || id; }

const CSS = `#pbSheet{position:fixed;left:0;right:0;bottom:0;z-index:64;display:none;box-sizing:border-box;padding:12px calc(12px + env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) calc(12px + env(safe-area-inset-left));background:#000;color:#fff;border-top:2px solid #fff;font:15px/1.35 system-ui,sans-serif;max-height:52vh;overflow:auto}
#pbSheet.on{display:block} #pbSheet h2{margin:0 0 6px;font-size:18px} #pbSheet p{margin:0 0 8px}
#pbSheet .row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
#pbSheet button{min-height:48px;min-width:48px;flex:1 1 140px;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:800 16px/1.15 system-ui,sans-serif;touch-action:manipulation}
#pbSheet button.on{background:#fff;color:#000}
#pbAct{position:fixed;z-index:13;left:calc(10px + env(safe-area-inset-left));bottom:calc(118px + env(safe-area-inset-bottom));display:none;min-height:48px;min-width:48px;padding:0 14px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:800 15px system-ui,sans-serif;touch-action:manipulation}
body.surface #pbAct.on{display:block} body.indoors #pbAct{display:none!important}`;

function ensureCss() {
  if (document.getElementById('pbCss')) return;
  const st = document.createElement('style'); st.id = 'pbCss'; st.textContent = CSS; document.head.appendChild(st);
}
function ensureUi() {
  ensureCss();
  if (sheet) return;
  sheet = document.createElement('div'); sheet.id = 'pbSheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Pit bets');
  document.body.appendChild(sheet);
  sheet.addEventListener('pointerup', onSheet);
  act = document.createElement('button'); act.id = 'pbAct'; act.type = 'button'; act.textContent = 'Place a bet';
  document.body.appendChild(act);
  act.addEventListener('pointerup', e => { e.preventDefault(); openSheet(); });
}
function renderSheet() {
  if (!sheet) return;
  const c = card;
  if (!c) { sheet.innerHTML = '<h2>Pit bets</h2><p>No card up. Wait by the window.</p><div class="row"><button type="button" data-a="close">Close</button></div>'; return; }
  const mine = c.bet ? `<p>You have ${c.bet.stake} cr on ${esc(nameOf(c.bet.id))} at ${c.bet.odds}.</p>` : '<p>Pick a fighter, then a stake, before the bell.</p>';
  const phase = c.phase === 'open' ? 'Book is open.' : c.phase === 'live' ? 'The fight is on. Betting is closed.' : `${esc(nameOf(c.winner))} took it.`;
  const fighters = [c.a, c.b].map(id => {
    const odds = id === c.a ? c.oddsA : c.oddsB;
    return `<button type="button" data-a="pick" data-id="${id}" class="${pick === id ? 'on' : ''}">${esc(nameOf(id))}<br>${odds.toFixed(2)}</button>`;
  }).join('');
  const stakes = c.phase === 'open' && !c.bet ? B.STAKES.map(n => `<button type="button" data-a="stake" data-n="${n}">${n} cr</button>`).join('') : '';
  sheet.innerHTML = `<h2>Pit bets</h2><p>${phase} ${mine}</p><div class="row">${fighters}</div><div class="row">${stakes}<button type="button" data-a="close">Close</button></div>`;
}
function openSheet() { ensureUi(); sheet.classList.add('on'); renderSheet(); try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ } }
function closeSheet() { sheet?.classList.remove('on'); }
function onSheet(e) {
  const b = e.target?.closest?.('button'); if (!b) return;
  if (b.dataset.a === 'close') { closeSheet(); return; }
  if (b.dataset.a === 'pick') { pick = b.dataset.id; renderSheet(); return; }
  if (b.dataset.a === 'stake') place(pick, +b.dataset.n);
}
function place(id, stake) {
  const q = B.quote(card, id, stake);
  if (!q.ok) { toast(q.why, 2400); return q; }
  const g = game();
  if (!g?.spend?.(q.stake)) { toast(`You need ${q.stake} cr.`, 2400); return { ok: false, why: 'credits' }; }
  B.takeBet(card, id, q.stake);
  toast(`${q.stake} cr on ${nameOf(id)} at ${q.odds}. Sit in the stands.`, 3200);
  renderSheet();
  return q;
}

function boothTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#140c08'; x.fillRect(0, 0, 512, 256);
  x.strokeStyle = '#f97316'; x.lineWidth = 10; x.strokeRect(8, 8, 496, 240);
  x.fillStyle = '#ff5a1f'; x.font = '900 92px Impact, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('BETS', 256, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildProps() {
  const w = worldAt(K.BOOK); if (!w || booth) return;
  const s = surf(); if (!s?.scene) return;
  booth = new THREE.Group(); booth.name = 'pit-bets';
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a3428, roughness: 0.85 });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.15, 0.7), wood); desk.position.y = 0.58; booth.add(desk);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.7), new THREE.MeshBasicMaterial({ map: boothTex() }));
  face.position.set(0, 1.55, -0.36); booth.add(face);
  booth.position.set(w.x, w.y, w.z); booth.rotation.y = Math.atan2(-K.BOOK.x, -K.BOOK.z);
  s.scene.add(booth);
  const seat = worldAt(K.SEAT);
  seatMark = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.7), new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0x7a3410, roughness: 0.6 }));
  seatMark.position.set(seat.x, seat.y + 0.7, seat.z); seatMark.name = 'pit-seat';
  s.scene.add(seatMark);
}
function figure(col) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.9, 0.28), new THREE.MeshLambertMaterial({ color: col })); body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshLambertMaterial({ color: col })); head.position.y = 1.7; g.add(head);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 })); arm.position.set(0.28, 1.2, 0.2); g.add(arm); g.userData.arm = arm;
  return g;
}
function ensureFigs() {
  if (figs || !surf()?.scene) return;
  const w = worldAt({ x: 0, z: 0 }); if (!w) return;
  figs = [figure(0xc45a32), figure(0x2a3a55)];
  figs.forEach(f => { f.visible = false; f.position.y = w.y; surf().scene.add(f); });
}
function poseFigs(now) {
  if (!figs || !card) return;
  const w = worldAt({ x: 0, z: 0 }); if (!w) return;
  const live = card.phase === 'live', done = card.phase === 'done';
  figs.forEach((f, i) => {
    f.visible = live || done;
    if (!f.visible) return;
    const s = i ? 1 : -1, t = now / 1000 + i;
    const lunge = live ? Math.max(0, Math.sin(t * 3.2)) : 0;
    f.position.set(w.x + s * (1.5 - lunge * 0.45), w.y, w.z);
    f.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    f.userData.arm.position.z = 0.2 + lunge * 0.35;
    if (done && card.winner && ((i === 0 && card.winner !== card.a) || (i === 1 && card.winner !== card.b))) f.rotation.z = s * 1.2;
    else f.rotation.z = 0;
  });
}

function aimAt(local, id, label, yOff) {
  const w = worldAt(local), cam = app()?.camera, g = window.SSX?.guide; if (!w || !cam || !g?.aim) return;
  V.set(w.x, w.y + (yOff || 1.4), w.z); V.project(cam);
  g.aim({ id, label, nx: V.x, ny: V.y });
}
function tickAim() {
  const g = window.SSX?.guide; if (!g) return;
  if (!onMars() || !worldAt(K.BOOK) || surf()?.world?.inDuel) { g.clear?.('pitbet'); return; }
  const near = distTo({ x: 0, z: 0 }) < 70;
  if (!near || !card) { g.clear?.('pitbet'); act?.classList.remove('on'); return; }
  const atBook = distTo(K.BOOK) < 2.6, atSeat = distTo(K.SEAT) < 2.3;
  if (act) act.classList.toggle('on', card.phase === 'open' && atBook && !sheet?.classList.contains('on'));
  if (card.phase === 'open' && !card.bet && !atBook) aimAt(K.BOOK, 'pitbet', B.WINDOW_STEP, 1.6);
  else if (card.bet && card.phase !== 'done' && !atSeat) aimAt(K.SEAT, 'pitbet', B.SEAT_STEP, 1.2);
  else if (card.phase === 'live') aimAt({ x: 0, z: 0 }, 'pitbet', B.WATCH_STEP, 1.4);
  else g.clear?.('pitbet');
}

function tick(dt, tc) {
  void dt;
  if (tc?.name !== 'Mars') return;
  const now = Date.now();
  if (onMars() && worldAt(K.BOOK)) { ensureCard(now); buildProps(); ensureFigs(); }
  if (!card) { tickAim(); return; }
  const r = B.step(card, now);
  card = r.card;
  if (r.event === 'bell') toast('Bell. The fight is on.', 2000);
  if (r.event === 'done') {
    const won = r.pay || 0;
    if (won && !paid) { paid = true; try { game()?.reward?.(0, won); } catch (e) { /* */ } }
    toast(won ? `${nameOf(r.winner)} wins. You collect ${won} cr.` : `${nameOf(r.winner)} wins.`, 3200);
    if (sheet?.classList.contains('on')) renderSheet();
  }
  if (r.event === 'next') { card = null; ensureCard(now); if (sheet?.classList.contains('on')) renderSheet(); }
  poseFigs(now); tickAim();
}

function boot() {
  const S = window.SSX; if (!S?.registerSurfaceTick || !app()) { setTimeout(boot, 300); return; }
  if (S.pitbets) return;
  ensureUi();
  S.pitbets = {
    card: () => card && { ...card, bet: card.bet ? { ...card.bet } : null },
    place, open: openSheet, close: closeSheet,
    HOW: 'At The Pit in Red Tape Flats. Follow the arrow to the betting window, put credits on a fighter, then sit in the marked seat.',
    WINDOW_STEP: B.WINDOW_STEP, SEAT_STEP: B.SEAT_STEP,
    debug: {
      force(a = 'cinder', b = 'pebble', openS = 60) { card = B.freshCard(a, b, Date.now(), openS); pick = null; paid = false; return card; },
      bell() { if (card?.phase === 'open') { card.phase = 'live'; card.at = Date.now(); } return card; },
      finish(id) { if (!card) return null; card.force = id || card.a; card.phase = 'live'; card.at = Date.now() - B.LIVE_S * 1000; return card; },
      reset() { card = null; paid = false; pick = null; return true; }
    }
  };
  S.registerSurfaceTick((dt, tc) => { try { tick(dt, tc); } catch (e) { console.warn('pitbets', e); } });
  try { S.registerMenuItem?.({ id: 'rmPitbets', label: '🥊 Pit bets', onTap: () => openSheet() }); } catch (e) { /* */ }
}
if (typeof window !== 'undefined') boot();
export default { boot };
