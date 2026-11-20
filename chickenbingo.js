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
let pick = 'B2', stake = 500, drop = null;
const club = () => window.SSX?.velvetclub;
const TOP = 0.96;

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
#csbBanner{position:fixed;z-index:30;left:8px;right:8px;top:calc(58px + env(safe-area-inset-top));display:none;padding:8px 10px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:800 15px/1.3 system-ui,sans-serif;text-align:center}
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
  document.body.appendChild(sheet); document.body.appendChild(banner);
  panelTap(sheet, onTap);
  ui = { sheet, banner };
  return ui;
}
function squareOf(id) {
  const at = K.cellAt(id); if (!at) return { x: K.PIT.x, z: K.PIT.z };
  const x0 = K.PIT.x - 0.72, z0 = K.PIT.z - 0.72;
  return { x: x0 + at.c * 0.48, z: z0 + at.r * 0.48 };
}
function stakesNow() { return club()?.perk?.().bingoStakes || K.STAKES; }

export function addChickenBingo(api, poses = {}) {
  const { box, mat } = api;
  const wood = mat(0x6b3a1a, { roughness: 0.75 }), felt = mat(0x1c140e, { roughness: 0.95 }), leg = mat(0x2a160c, { roughness: 0.8 });
  const gold = mat(0xffd040, { basic: true });
  const yolk = mat(0xf2e2a0);
  box(K.PIT.x, 0.9, K.PIT.z, 2.2, 0.1, 2.2, wood);
  box(K.PIT.x, 0.96, K.PIT.z, 2.05, 0.02, 2.05, felt);
  for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) box(K.PIT.x + dx, 0.44, K.PIT.z + dz, 0.08, 0.88, 0.08, leg);
  K.squares().forEach(id => {
    const p = squareOf(id);
    box(p.x, 0.98, p.z, 0.42, 0.015, 0.42, felt);
    api.sign(id, 0xfff0c0, p.x, 1.01, p.z, 0, 0.36, { h: 64, font: 'bold 40px system-ui, sans-serif' });
  });
  const sale = api.sign('50,000 CR', 0xffd040, K.PIT.x, 1.85, K.PIT.z + 1.2, Math.PI, 2.4, { w: 512, h: 96, font: 'bold 64px system-ui, sans-serif' });
  const title = api.sign('CHICKEN SHIT BINGO', 0xffd040, K.PIT.x, 1.85, K.PIT.z + 1.2, Math.PI, 2.6, { w: 640, h: 96, font: 'bold 42px system-ui, sans-serif' });
  const g = new THREE.Group();
  g.add(api.mk(api.G.box, yolk, 0, 0.22, 0, 0.34, 0.22, 0.42));
  g.add(api.mk(api.G.box, yolk, 0, 0.4, -0.2, 0.16, 0.14, 0.16));
  g.add(api.mk(api.G.box, mat(0xff2244, { emissive: 0xff2244, emissiveIntensity: 0.5 }), 0, 0.5, -0.2, 0.08, 0.08, 0.1));
  g.add(api.mk(api.G.box, gold, 0, 0.38, -0.3, 0.08, 0.05, 0.1));
  g.add(api.mk(api.G.box, leg, -0.08, 0.08, 0.05, 0.04, 0.16, 0.04));
  g.add(api.mk(api.G.box, leg, 0.08, 0.08, 0.05, 0.04, 0.16, 0.04));
  g.add(api.mk(api.G.box, yolk, 0, 0.24, 0.24, 0.12, 0.1, 0.1));
  g.scale.setScalar(1.35);
  api.g.add(g);
  bird = g;
  const home = squareOf('B2');
  g.position.set(home.x, TOP, home.z);
  poop = api.mk(api.G.sph, mat(0xe2c070, { basic: true }), 0, 1.2, 0, 0.16, 0.12, 0.16);
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
  Object.defineProperty(spot, 'label', { configurable: true, get() { return club()?.owns?.('bingo') ? 'Bet the bingo grid' : 'Buy bingo table · 50,000 cr'; } });
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

function moveBird(t, dt) {
  if (!bird) return;
  const id = round ? round.path[Math.min(round.path.length - 1, Math.floor((K.ROUND_S - round.left) / K.ROUND_S * round.path.length))] : 'B2';
  const p = squareOf(id || 'B2');
  bird.position.x += (p.x - bird.position.x) * 0.12;
  bird.position.z += (p.z - bird.position.z) * 0.12;
  bird.position.y = TOP + Math.abs(Math.sin(t * 9)) * 0.06;
  bird.rotation.y = Math.atan2(p.x - bird.position.x, p.z - bird.position.z);
  if (drop && poop) {
    drop.t += dt;
    const k = Math.min(1, drop.t / 0.7);
    poop.visible = true;
    poop.position.set(drop.x + (drop.to.x - drop.x) * k, drop.y + (TOP + 0.02 - drop.y) * k * k, drop.z + (drop.to.z - drop.z) * k);
    if (k >= 1 && !drop.landed) {
      if (splat) { splat.position.set(drop.to.x, 0.995, drop.to.z); splat.visible = true; }
      poop.position.set(drop.to.x, TOP + 0.08, drop.to.z);
      poop.visible = true;
      drop.landed = true;
      drop.hold = 2.4;
    } else if (drop.landed) {
      drop.hold -= dt;
      if (drop.hold <= 0) poop.visible = false;
    }
  }
  if (round && ui?.banner.classList.contains('on')) ui.banner.textContent = `Bird is on ${id}. ${Math.ceil(round.left)}s. Your square: ${round.player.square}.`;
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
  const cells = K.squares().map(id => `<button type="button" data-a="sq" data-id="${id}" class="${pick === id ? 'on' : ''}">${id}</button>`).join('');
  const stakes = list.map(n => `<button type="button" data-a="stake" data-n="${n}" class="${stake === n ? 'on' : ''}">${n} cr</button>`).join('');
  const note = round ? `Round is live. ${Math.ceil(round.left)}s left.` : `Pick a square. Watch the bird. The square it shits on pays ${K.PAY} to 1. You have ${credits()} cr.`;
  sheet.innerHTML = `<button type="button" class="x" data-a="close" aria-label="Close">✕</button><h2>Chicken Shit Bingo</h2><p>${club()?.line?.() || ''}</p><p>${note}</p><div class="grid">${cells}</div><div class="row">${stakes}</div><div class="row"><button type="button" class="go" data-a="bet">Bet ${stake} cr on ${pick}</button></div>`;
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
  if (b.dataset.a === 'sq') { pick = b.dataset.id; paint(); return; }
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
  const end = K.squares()[Math.floor(Math.random() * 16)];
  const npcs = K.npcBets(Math.random, club()?.perk?.().extraNpc || 0);
  persist();
  drop = null;
  round = { player: { square: pick, stake }, npcs, end, path: K.path(Math.random, 8, end), left: K.ROUND_S, t: 0 };
  if (splat) splat.visible = false;
  if (poop) poop.visible = false;
  ensureUi();
  ui.sheet.classList.remove('on');
  ui.banner.classList.add('on');
  ui.banner.textContent = `Bets are in. ${npcs.map(n => n.name + ' ' + n.square).join('. ')}. ${K.ROUND_S}s.`;
  toast(`${npcs.map(n => n.name + ' ' + n.square).join('. ')}.`, 2800);
}
function finish() {
  const r = round; if (!r) return;
  const result = K.settle(r.end, r.player, r.npcs);
  if (result.hit) { pay(result.pay); save.won++; save.net += result.pay - result.stake; }
  else { save.lost++; save.net -= result.stake; }
  save.played++; persist();
  try { club()?.play?.(r.player.stake); } catch (e) { /* */ }
  const p = squareOf(r.end);
  if (!drop?.landed && splat) { splat.position.set(p.x, 0.995, p.z); splat.visible = true; }
  if (!(drop && drop.landed)) { if (poop) poop.visible = false; drop = null; }
  const you = result.hit ? `You win ${result.pay} cr.` : `You lose ${result.stake} cr.`;
  const line = result.reactions.find(x => x.win)?.line || result.reactions[0].line;
  if (ui) { ui.banner.classList.add('on'); ui.banner.textContent = `${r.end} hits. ${you} ${line}`; }
  toast(`${r.end}. ${you}`, 3600);
  round = null;
  setTimeout(() => ui?.banner.classList.remove('on'), 6000);
}
function tick(dt) {
  if (!round) return;
  round.left -= dt;
  if (!drop && round.left <= 1.15) {
    const to = squareOf(round.end);
    drop = { x: bird?.position.x || to.x, z: bird?.position.z || to.z, y: (bird?.position.y || TOP) + 0.35, to, t: 0, landed: false };
  }
  if (round.left <= 0) finish();
}

function boot() {
  if (!window.SSX?.registerSurfaceTick) { setTimeout(boot, 300); return; }
  if (window.SSX.chickenbingo) return;
  load();
  window.SSX.chickenbingo = {
    open, close, PIT: K.PIT, STAKES: K.STAKES, squares: K.squares,
    state: () => ({ ...save, live: !!round, owned: !!club()?.owns?.('bingo') }),
    debug: {
      rush() { if (round) round.left = 0.2; return !!round; },
      splat: () => !!splat?.visible,
      poop: () => !!poop?.visible,
      bird: () => bird ? { x: bird.position.x, y: bird.position.y, z: bird.position.z } : null
    }
  };
  window.SSX.registerSurfaceTick((dt) => { try { tick(dt); } catch (e) { /* */ } });
  try { window.SSX.registerMenuItem?.({ id: 'rmBingo', label: '🐔 Chicken Shit Bingo', onTap: () => { if (window.__app?.surface?.info?.inside?.kind === 'club') open(); else toast('Chicken Shit Bingo is in the Velvet lobby, south of the stage.', 3200); } }); } catch (e) { /* */ }
}
boot();
export default { addChickenBingo };
