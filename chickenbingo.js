// Chicken Shit Bingo in the Velvet Airlock lobby. Walk up to the grid, bet a square, watch the bird.
// Credits only. The pit is room-local (chickenbingocore.PIT).
import * as THREE from 'three';
import * as K from './chickenbingocore.js';
import { panelTap } from './racehooks.js';
import './velvetclub.js';

const KEY = K.KEY;
const game = () => window.__app?.surface?.game || window.__app?.game;
const toast = (t, ms) => { try { window.__app?.toast?.(t, ms); } catch (e) { /* */ } };
const credits = () => game()?.progress?.credits | 0;

let save = K.fresh(), round = null, ui = null, bird = null, splat = null, poop = null;
let pick = '7', stake = 500, rims = {};
const club = () => window.SSX?.velvetclub;
const TOP = 0.96;
const RIM = 0x6b3a1a, MINE = 0x8ec8f0, WIN = 0xf0c43a;

function load() { try { save = K.load(localStorage.getItem(KEY)); } catch (e) { save = K.fresh(); } }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* */ } }
function spend(n) { const g = game(); return !!(g && g.spend && g.spend(n)); }
function pay(n) { const g = game(); if (!n) return; try { g?.reward?.(0, n); } catch (e) { if (g?.progress) g.progress.credits = (g.progress.credits | 0) + n; } }

const CSS = `#csbSheet{position:fixed;left:0;right:0;bottom:0;z-index:64;display:none;box-sizing:border-box;padding:10px calc(10px + env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) calc(10px + env(safe-area-inset-left));background:#000;color:#fff;border-top:2px solid #fff;font:15px/1.3 system-ui,sans-serif;max-height:min(62vh,520px);overflow:auto}
#csbSheet.on{display:block}
#csbSheet h2{margin:0 48px 6px 0;font-size:18px}
#csbSheet p{margin:0 0 8px}
#csbSheet .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0}
#csbSheet .grid button{min-height:48px;min-width:0;padding:4px;border-radius:10px;border:2px solid #fff;background:#000;color:#fff;font:800 16px system-ui,sans-serif}
#csbSheet .grid button.on{background:#fff;color:#000}
#csbSheet .row{display:flex;flex-wrap:wrap;gap:6px}
#csbSheet .row button,#csbSheet .go{min-height:48px;flex:1 1 100px;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:800 15px/1.15 system-ui,sans-serif}
#csbSheet .row button.on{background:#fff;color:#000}
#csbSheet .x{position:absolute;top:8px;right:8px;width:44px;height:44px;border-radius:10px;border:2px solid #fff;background:#000;color:#fff;font:700 20px system-ui,sans-serif}
#csbBanner{position:relative;z-index:1;display:none;width:100%;max-width:100%;box-sizing:border-box;padding:8px 14px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:800 16px/1.2 system-ui,sans-serif;text-align:center;pointer-events:none}
#csbBanner.on{display:block}`;

function ensureCss() {
  if (document.getElementById('csbCss')) return;
  const st = document.createElement('style'); st.id = 'csbCss'; st.textContent = CSS; document.head.appendChild(st);
}
function ensureUi() {
  ensureCss();
  if (ui) return ui;
  const sheet = document.createElement('div'); sheet.id = 'csbSheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Chicken Shit Bingo');
  const banner = document.createElement('div'); banner.id = 'csbBanner';
  (document.getElementById('stackR') || document.body).appendChild(banner);
  document.body.appendChild(sheet);
  panelTap(sheet, onTap);
  ui = { sheet, banner };
  return ui;
}
function squareOf(id) {
  const at = K.cellAt(id); if (!at) return { x: K.PIT.x, z: K.PIT.z };
  return { x: K.PIT.x - 0.69 + at.c * 0.46, z: K.PIT.z - 0.69 + at.r * 0.46 };
}
function numTex(n) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#f4efe2';
  x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#1a120c';
  x.font = '800 72px system-ui, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(String(n), 64, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function frameTable() {
  const s = window.__app?.surface;
  if (!s?.debugInside) return false;
  try { window.__bingoEye = 0.6; s.setView?.('first'); s.debugInside(K.PIT.x, K.PIT.z + 4.15, 0, -0.72); } catch (e) { return false; }
  return true;
}
function paintRims() {
  const mine = round?.player?.square, win = round?.landed;
  for (const id in rims) {
    const hex = win === id ? WIN : mine === id ? MINE : RIM;
    rims[id].material.color.setHex(hex);
  }
}
let pillT = 0;
function showPill(text) {
  const b = ensureUi().banner;
  b.textContent = text;
  b.classList.add('on');
  const n = ++pillT;
  setTimeout(() => { if (n !== pillT) return; b.classList.remove('on'); if (round?.phase === 'done') round = null; }, 3000);
}
function stakesNow() { return club()?.perk?.().bingoStakes || K.STAKES; }

export function addChickenBingo(api, poses = {}) {
  const { box, mat } = api;
  const wood = mat(0x6b3a1a, { roughness: 0.75 }), felt = mat(0x1c140e, { roughness: 0.95 }), leg = mat(0x2a160c, { roughness: 0.8 });
  box(K.PIT.x, 0.9, K.PIT.z, 2.3, 0.1, 2.3, wood);
  box(K.PIT.x, 0.96, K.PIT.z, 2.12, 0.02, 2.12, felt);
  for (const [dx, dz] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]]) box(K.PIT.x + dx, 0.44, K.PIT.z + dz, 0.08, 0.88, 0.08, leg);
  K.squares().forEach(id => {
    const p = squareOf(id);
    const rim = new THREE.MeshBasicMaterial({ color: RIM });
    const pad = box(p.x, 0.985, p.z, 0.42, 0.02, 0.42, rim);
    rims[id] = pad;
    const face = new THREE.Mesh(api.G.plane, new THREE.MeshBasicMaterial({ map: numTex(id), transparent: true, depthWrite: false }));
    face.rotation.x = -Math.PI / 2;
    face.position.set(p.x, 1.002, p.z);
    face.scale.set(0.36, 0.36, 1);
    api.g.add(face);
  });
  const sale = api.sign('50,000 CR', 0xffd040, K.PIT.x, 1.85, K.PIT.z + 1.2, Math.PI, 2.4, { w: 512, h: 96, font: 'bold 64px system-ui, sans-serif' });
  const title = api.sign('CHICKEN SHIT BINGO', 0xffd040, K.PIT.x, 1.85, K.PIT.z + 1.2, Math.PI, 2.6, { w: 640, h: 96, font: 'bold 42px system-ui, sans-serif' });
  const g = new THREE.Group();
  const toy = mat(0xf0c43a, { basic: true }), comb = mat(0xd01212, { basic: true }), beak = mat(0xf07818, { basic: true }), eye = mat(0x161616, { basic: true });
  const cube = (m, x, y, z, s) => api.mk(api.G.box, m, x, y, z, s, s, s);
  g.add(api.mk(api.G.box, beak, -0.07, 0.08, 0.02, 0.07, 0.16, 0.07));
  g.add(api.mk(api.G.box, beak, 0.07, 0.08, 0.02, 0.07, 0.16, 0.07));
  g.add(cube(toy, 0, 0.3, 0, 0.3));
  g.add(cube(toy, 0, 0.54, -0.04, 0.2));
  g.add(api.mk(api.G.box, comb, 0, 0.68, -0.04, 0.07, 0.08, 0.12));
  g.add(cube(beak, 0, 0.5, -0.16, 0.08));
  g.add(cube(eye, -0.05, 0.56, -0.14, 0.035));
  g.add(cube(eye, 0.05, 0.56, -0.14, 0.035));
  g.add(cube(toy, -0.2, 0.3, 0, 0.08));
  g.add(cube(toy, 0.2, 0.3, 0, 0.08));
  g.add(cube(toy, 0, 0.36, 0.2, 0.1));
  g.scale.setScalar(1.15);
  api.g.add(g);
  bird = g;
  const home = squareOf('7');
  g.position.set(home.x, TOP, home.z);
  poop = new THREE.Group();
  const dung = mat(0x5c3414, { basic: true });
  poop.add(api.mk(api.G.box, dung, 0, 0.06, 0, 0.22, 0.12, 0.18));
  poop.add(api.mk(api.G.box, dung, 0.06, 0.14, 0.03, 0.12, 0.1, 0.12));
  api.g.add(poop); poop.visible = false;
  splat = box(home.x, 0.995, home.z, 0.46, 0.025, 0.36, mat(0xd09040, { basic: true }));
  splat.visible = false;
  const looks = [
    { top: 0x6a3030, hair: 0x101010, x: K.PIT.x - 1.8, z: K.PIT.z + 0.2 },
    { top: 0x2a3a6a, hair: 0xd0b070, x: K.PIT.x + 1.8, z: K.PIT.z + 0.2 },
    { top: 0x3a3a3a, hair: 0x3a1a10, x: K.PIT.x, z: K.PIT.z - 1.7 }
  ];
  const crowd = [];
  looks.forEach((L, i) => api.person({ top: L.top, bottom: 0x1a1a22, hair: L.hair, hairStyle: 'short', skin: 0xc49a74 }, L.x, L.z, i === 2 ? 0 : (i ? -Math.PI / 2 : Math.PI / 2), (p, t) => poses.idle?.(p, t, i)));
  [{ x: K.PIT.x - 1.7, z: K.PIT.z - 1.2 }, { x: K.PIT.x + 1.7, z: K.PIT.z - 1.1 }].forEach((p, i) => {
    const h = api.person({ top: i ? 0x204040 : 0x402030, bottom: 0x111118, hair: 0x202020, hairStyle: 'short', skin: 0xb88860 }, p.x, p.z, i ? 0.8 : -0.6, (q, t) => poses.idle?.(q, t, i + 3));
    h.group.visible = false; crowd.push(h.group);
  });
  const booth = new THREE.Group();
  booth.add(box(0, 0.4, 0, 1.4, 0.4, 0.55, mat(0x4a1030, { roughness: 0.7 })));
  booth.position.set(K.PIT.x + 3.1, 0, K.PIT.z);
  api.g.add(booth);
  const boothSign = api.sign('VIP BOOTH', 0xffd040, K.PIT.x + 3.1, 1.5, K.PIT.z + 0.4, Math.PI, 1.8, { h: 72, font: 'bold 40px system-ui, sans-serif' });
  booth.visible = false; boothSign.visible = false;
  const spot = api.spot({ id: 'chickenbingo', x: K.PIT.x, z: K.PIT.z + 1.7, r: 1.45, label: 'Buy bingo table', act: 'velvet', run: () => open() });
  Object.defineProperty(spot, 'label', { configurable: true, get() { return club()?.owns?.('bingo') ? 'Bet a number' : 'Buy bingo table · 50,000 cr'; } });
  api.spot({ id: 'velvetvip', x: K.PIT.x + 3.1, z: K.PIT.z + 0.9, r: 1.1, label: 'Sit the VIP booth', act: 'velvet', cond: () => !!club()?.perk?.().vipBooth, run: () => { toast('VIP booth. The house pours. You watch the bird.', 2600); return { ok: true }; } });
  api.ticks.push((t, dt) => {
    const owned = !!club()?.owns?.('bingo');
    sale.visible = !owned; title.visible = owned;
    const showCrowd = (club()?.level?.() || 1) >= 3;
    crowd.forEach(c => { c.visible = showCrowd; });
    const vip = !!club()?.perk?.().vipBooth;
    booth.visible = vip; boothSign.visible = vip;
    moveBird(t, dt || 0.016);
  });
}

const BIRD = 1.15;
function restBird(t) {
  bird.scale.setScalar(BIRD);
  bird.rotation.x = 0;
  bird.position.y = TOP + Math.abs(Math.sin(t * 8)) * 0.03;
}
function squatBird(k) {
  const u = Math.max(0, Math.min(1, k));
  bird.scale.setScalar(BIRD);
  bird.position.y = TOP - 0.05 * u;
  bird.rotation.x = 1.05 * u;
}
function clearMark() {
  if (poop) poop.visible = false;
  if (splat) splat.visible = false;
  for (const id in rims) rims[id].material.color.setHex(RIM);
}
function moveBird(t, dt) {
  if (!bird) return;
  if (!round) { window.__bingoEye = 0; restBird(t); return; }
  const destId = round.hops[round.hop];
  const dest = squareOf(destId);
  if (round.hold) return;
  const dx = dest.x - bird.position.x, dz = dest.z - bird.position.z, dist = Math.hypot(dx, dz) || 0.0001;
  if (round.phase === 'walk') {
    restBird(t);
    if (dist < 0.06) {
      bird.position.x = dest.x; bird.position.z = dest.z;
      round.phase = round.hop === round.hops.length - 1 ? 'squat' : 'pause';
      round.phaseT = 0;
    } else {
      const step = Math.min(dist, dt * 1.05);
      bird.position.x += dx / dist * step;
      bird.position.z += dz / dist * step;
      bird.rotation.y = Math.atan2(dx, dz);
    }
  } else if (round.phase === 'pause') {
    restBird(t);
    bird.position.y = TOP;
    round.phaseT += dt;
    if (round.phaseT > 0.5) { round.hop++; round.phase = 'walk'; round.phaseT = 0; }
  } else if (round.phase === 'squat') {
    round.phaseT += dt;
    squatBird(Math.min(1, round.phaseT / 0.65));
    bird.position.x = dest.x; bird.position.z = dest.z;
    if (round.phaseT > 0.7) { round.phase = 'drop'; round.phaseT = 0; round.dropFrom = { x: bird.position.x, z: bird.position.z, y: bird.position.y + 0.28 }; }
  } else if (round.phase === 'drop') {
    squatBird(1);
    round.phaseT += dt;
    const k = Math.min(1, round.phaseT / 0.45);
    const from = round.dropFrom || { x: dest.x, z: dest.z, y: TOP + 0.4 };
    if (poop) {
      poop.visible = true;
      poop.position.set(from.x + (dest.x - from.x) * k, from.y + (TOP + 0.07 - from.y) * k * k, from.z + (dest.z - from.z) * k);
    }
    if (k >= 1 && !round.landed) markWinner(destId);
  }
}

function paintBuy() {
  const { sheet } = ensureUi();
  const have = credits();
  sheet.innerHTML = `<button type="button" class="x" data-a="close" aria-label="Close">✕</button><h2>Chicken Shit Bingo</h2><p>A table in the lobby. The bird runs the squares and shits on one. Locked until you buy it.</p><p>${club()?.line?.() || ''}</p><p>Price 50,000 cr. You have ${have} cr.</p><div class="row"><button type="button" class="go" data-a="buy">Buy · 50,000 cr</button></div>`;
  sheet.classList.add('on');
}
function paint() {
  if (!club()?.owns?.('bingo')) return paintBuy();
  const { sheet } = ensureUi();
  const list = stakesNow();
  if (!list.includes(stake)) stake = list[0];
  if (!K.squares().includes(pick)) pick = '7';
  const stakes = list.map(n => `<button type="button" data-a="stake" data-n="${n}" class="${stake === n ? 'on' : ''}">${n} cr</button>`).join('');
  sheet.innerHTML = `<button type="button" class="x" data-a="close" aria-label="Close">✕</button><h2>Chicken Shit Bingo</h2><p>${club()?.line?.() || ''}</p><p>Look at the board. Pick a number. It pays ${K.PAY} to 1. You have ${credits()} cr.</p><p>Your number: ${pick}</p><div class="row"><button type="button" data-a="num" data-d="-1">Lower</button><button type="button" data-a="num" data-d="1">Higher</button></div><div class="row">${stakes}</div><div class="row"><button type="button" class="go" data-a="bet">Bet ${stake} cr on ${pick}</button></div>`;
  sheet.classList.add('on');
}
function open() {
  if (!club()?.owns?.('bingo')) { paintBuy(); try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ } return { ok: true, buy: true }; }
  if (round) { ensureUi().banner.classList.add('on'); return { ok: true, live: true }; }
  paint();
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ }
  return { ok: true };
}
function close() { ui?.sheet.classList.remove('on'); }
function onTap(e) {
  const b = e.target?.closest?.('button'); if (!b) return;
  if (b.dataset.a === 'close') { close(); return; }
  if (b.dataset.a === 'buy') { const r = club()?.buy?.('bingo'); if (r?.ok) paint(); return; }
  if (b.dataset.a === 'num') {
    const n = Math.max(1, Math.min(K.squares().length, (+pick || 1) + (+b.dataset.d || 0)));
    pick = String(n); paint(); return;
  }
  if (b.dataset.a === 'stake') { stake = +b.dataset.n; paint(); return; }
  if (b.dataset.a === 'bet') place();
}
function place() {
  if (!club()?.owns?.('bingo')) { paintBuy(); return; }
  if (round) { toast('Wait for this bird to finish.', 2000); return; }
  const list = stakesNow();
  if (!list.includes(stake) || !K.squares().includes(pick)) return;
  if (credits() < stake) { toast(`You need ${stake} cr.`, 2200); return; }
  if (!spend(stake)) { toast(`You need ${stake} cr.`, 2200); return; }
  try { club()?.play?.(stake); } catch (e) { /* level chip */ }
  const all = K.squares();
  const end = all[Math.floor(Math.random() * all.length)];
  const npcs = K.npcBets(Math.random, club()?.perk?.().extraNpc || 0);
  const hops = [];
  for (let i = 0; i < 3; i++) hops.push(all[Math.floor(Math.random() * all.length)]);
  hops.push(end);
  persist();
  clearMark();
  round = { player: { square: pick, stake }, npcs, end, hops, hop: 0, phase: 'walk', phaseT: 0, hold: false, landed: null };
  paintRims();
  ensureUi();
  ui.sheet.classList.remove('on');
  ui.banner.classList.remove('on');
  frameTable();
}
function markWinner(id) {
  if (!round || round.landed) return;
  round.landed = id;
  const p = squareOf(id);
  if (bird) { bird.scale.setScalar(BIRD); bird.rotation.set(0.35, Math.PI, 0); bird.position.set(p.x, TOP, p.z - 0.2); }
  if (poop) { poop.visible = true; poop.position.set(p.x, 1.01, p.z + 0.06); }
  if (splat) { splat.visible = true; splat.position.set(p.x, 1.0, p.z); }
  paintRims();
  const result = K.settle(id, round.player, round.npcs);
  if (result.hit) { pay(result.pay); save.won++; save.net += result.pay - result.stake; }
  else { save.lost++; save.net -= result.stake; }
  save.played++; persist();
  try { /* XP was granted when the bet was placed */ } catch (e) { /* */ }
  showPill(`Plopped on ${id}!`);
  round.phase = 'done';
}
function tick() { /* the bird runs on the room tick, so the board and the drop stay in step */ }

function boot() {
  if (!window.SSX?.registerSurfaceTick) { setTimeout(boot, 300); return; }
  if (window.SSX.chickenbingo) return;
  load();
  window.SSX.chickenbingo = {
    open, close, PIT: K.PIT, STAKES: K.STAKES, squares: K.squares,
    state: () => ({ ...save, live: !!round, owned: !!club()?.owns?.('bingo') }),
    debug: {
      frame: () => frameTable(),
      stand(id = '6') {
        if (!bird) return false;
        const p = squareOf(String(id));
        if (round) { round.hold = true; round.phase = 'pause'; round.hops = [String(id)]; round.hop = 0; }
        bird.scale.setScalar(BIRD);
        bird.rotation.set(0, Math.PI, 0);
        bird.position.set(p.x, TOP, p.z);
        frameTable();
        return true;
      },
      phase: () => round?.phase || 'idle',
      squat() {
        if (!bird) return false;
        const id = '11';
        if (!round) round = { hops: [id], hop: 0, phase: 'squat', phaseT: 0.4, hold: true, player: { square: pick, stake }, end: id };
        else { round.hops = [id]; round.hop = 0; round.phase = 'squat'; round.hold = true; }
        const p = squareOf(id);
        bird.position.set(p.x, TOP, p.z - 0.06);
        bird.rotation.y = Math.PI;
        squatBird(0.85);
        frameTable();
        return true;
      },
      plop(id) {
        const n = String(id || round?.end || '7');
        if (!round) round = { player: { square: pick, stake }, npcs: [], end: n, hops: [n], hop: 0, phase: 'drop', hold: false, landed: null };
        round.end = n; round.hold = false;
        markWinner(n);
        frameTable();
        return n;
      },
      splat: () => !!splat?.visible,
      poop: () => !!poop?.visible,
      bird: () => bird ? { x: bird.position.x, y: bird.position.y, z: bird.position.z, squat: bird.rotation.x > 0.4 } : null,
      pill: () => document.getElementById('csbBanner')?.textContent || ''
    }
  };
  window.SSX.registerSurfaceTick((dt) => { try { tick(dt); } catch (e) { /* */ } });
  try { window.SSX.registerMenuItem?.({ id: 'rmBingo', label: '🐔 Chicken Shit Bingo', onTap: () => { if (window.__app?.surface?.info?.inside?.kind === 'club') open(); else toast('Chicken Shit Bingo is in the Velvet lobby, south of the stage.', 3200); } }); } catch (e) { /* */ }
}
boot();
export default { addChickenBingo };
