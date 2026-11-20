// Chicken Shit Bingo in the Velvet Airlock lobby. Walk up to the grid, bet a square, watch the bird.
// Credits only. The pit is room-local (chickenbingocore.PIT).
import * as THREE from 'three';
import * as K from './chickenbingocore.js';
import { panelTap } from './racehooks.js';

const KEY = K.KEY;
const game = () => window.__app?.surface?.game || window.__app?.game;
const toast = (t, ms) => { try { window.__app?.toast?.(t, ms); } catch (e) { /* */ } };
const credits = () => game()?.progress?.credits | 0;

let save = K.fresh(), round = null, ui = null, bird = null, splat = null;
let pick = 'B2', stake = 500;

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
  const x0 = K.PIT.x - 1.05, z0 = K.PIT.z - 1.05;
  return { x: x0 + at.c * 0.7, z: z0 + at.r * 0.7 };
}

export function addChickenBingo(api, poses = {}) {
  const { box, mat } = api;
  const wood = mat(0x3a2414, { roughness: 0.8 }), felt = mat(0x1a140c, { roughness: 0.95 });
  const gold = mat(0xffd040, { basic: true });
  box(K.PIT.x, 0.04, K.PIT.z, 3.2, 0.04, 3.2, wood);
  K.squares().forEach(id => {
    const p = squareOf(id);
    box(p.x, 0.08, p.z, 0.62, 0.02, 0.62, felt);
    api.sign(id, 0xfff0c0, p.x, 0.12, p.z, 0, 0.45, { h: 64, font: 'bold 40px system-ui, sans-serif' });
  });
  api.sign('CHICKEN SHIT BINGO', 0xffd040, K.PIT.x, 2.4, K.PIT.z - 1.9, 0, 3.4, { w: 640, h: 96, font: 'bold 42px system-ui, sans-serif' });
  api.sign('BET A SQUARE', 0xffffff, K.PIT.x, 1.9, K.PIT.z + 1.85, Math.PI, 2.2, { h: 72, font: 'bold 40px system-ui, sans-serif' });
  const g = new THREE.Group();
  const body = api.mk(api.G.box, mat(0xf2e2a0), 0, 0.28, 0, 0.28, 0.22, 0.36);
  const head = api.mk(api.G.box, mat(0xf2e2a0), 0, 0.42, -0.16, 0.14, 0.12, 0.12);
  const comb = api.mk(api.G.box, mat(0xff2244, { emissive: 0xff2244, emissiveIntensity: 0.4 }), 0, 0.5, -0.16, 0.06, 0.06, 0.08);
  const beak = api.mk(api.G.box, gold, 0, 0.4, -0.24, 0.06, 0.04, 0.08);
  g.add(body, head, comb, beak);
  api.g.add(g);
  bird = g;
  splat = box(K.PIT.x, 0.1, K.PIT.z, 0.16, 0.02, 0.16, mat(0x6a4a28));
  splat.visible = false;
  const home = squareOf('B2');
  g.position.set(home.x, 0, home.z);
  const looks = [
    { top: 0x6a3030, hair: 0x101010, x: K.PIT.x - 2.1, z: K.PIT.z },
    { top: 0x2a3a6a, hair: 0xd0b070, x: K.PIT.x + 2.1, z: K.PIT.z - 0.4 },
    { top: 0x3a3a3a, hair: 0x3a1a10, x: K.PIT.x, z: K.PIT.z - 2.15 }
  ];
  looks.forEach((L, i) => api.person({ top: L.top, bottom: 0x1a1a22, hair: L.hair, hairStyle: 'short', skin: 0xc49a74 }, L.x, L.z, i === 2 ? 0 : (i ? -Math.PI / 2 : Math.PI / 2), (p, t) => poses.idle?.(p, t, i)));
  api.spot({ id: 'chickenbingo', x: K.PIT.x, z: K.PIT.z + 2.15, r: 1.35, label: 'Bet the bingo grid', act: 'velvet', run: () => open() });
  api.ticks.push((t) => moveBird(t));
}

function moveBird(t) {
  if (!bird) return;
  const id = round ? round.path[Math.min(round.path.length - 1, Math.floor((K.ROUND_S - round.left) / K.ROUND_S * round.path.length))] : 'B2';
  const p = squareOf(id || 'B2');
  bird.position.x += (p.x - bird.position.x) * 0.08;
  bird.position.z += (p.z - bird.position.z) * 0.08;
  bird.position.y = Math.abs(Math.sin(t * 8)) * 0.04;
  bird.rotation.y = Math.sin(t * 2) * 0.4;
  if (round && ui) ui.banner.textContent = `Bird is on ${id}. ${Math.ceil(round.left)}s. Your square: ${round.player.square}.`;
}

function paint() {
  const { sheet } = ensureUi();
  const cells = K.squares().map(id => `<button type="button" data-a="sq" data-id="${id}" class="${pick === id ? 'on' : ''}">${id}</button>`).join('');
  const stakes = K.STAKES.map(n => `<button type="button" data-a="stake" data-n="${n}" class="${stake === n ? 'on' : ''}">${n} cr</button>`).join('');
  const note = round ? `Round is live. ${Math.ceil(round.left)}s left.` : `Pick a square. The bird shits where it stops. That square pays ${K.PAY} to 1. You have ${credits()} cr.`;
  sheet.innerHTML = `<button type="button" class="x" data-a="close" aria-label="Close">✕</button><h2>Chicken Shit Bingo</h2><p>${note}</p><div class="grid">${cells}</div><div class="row">${stakes}</div><div class="row"><button type="button" class="go" data-a="bet">Bet ${stake} cr on ${pick}</button></div>`;
  sheet.classList.add('on');
}
function open() {
  if (round) { ensureUi().banner.classList.add('on'); return { ok: true, live: true }; }
  paint();
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ }
  return { ok: true };
}
function close() { ui?.sheet.classList.remove('on'); }
function onTap(e) {
  const b = e.target?.closest?.('button'); if (!b) return;
  if (b.dataset.a === 'close') { close(); return; }
  if (b.dataset.a === 'sq') { pick = b.dataset.id; paint(); return; }
  if (b.dataset.a === 'stake') { stake = +b.dataset.n; paint(); return; }
  if (b.dataset.a === 'bet') place();
}
function place() {
  if (round) { toast('Wait for this bird to finish.', 2000); return; }
  if (!K.STAKES.includes(stake) || !K.squares().includes(pick)) return;
  if (credits() < stake) { toast(`You need ${stake} cr.`, 2200); return; }
  if (!spend(stake)) { toast(`You need ${stake} cr.`, 2200); return; }
  const end = K.squares()[Math.floor(Math.random() * 16)];
  const npcs = K.npcBets();
  persist();
  round = { player: { square: pick, stake }, npcs, end, path: K.path(Math.random, 8, end), left: K.ROUND_S, t: 0 };
  if (splat) splat.visible = false;
  ensureUi();
  ui.sheet.classList.remove('on');
  ui.banner.classList.add('on');
  ui.banner.textContent = `Bets are in. Nix is on ${npcs[0].square}. Bex on ${npcs[1].square}. Harlo on ${npcs[2].square}. ${K.ROUND_S}s.`;
  toast(`${npcs.map(n => n.name + ' ' + n.square).join('. ')}.`, 2800);
}
function finish() {
  const r = round; if (!r) return;
  const result = K.settle(r.end, r.player, r.npcs);
  if (result.hit) { pay(result.pay); save.won++; save.net += result.pay - result.stake; }
  else { save.lost++; save.net -= result.stake; }
  save.played++; persist();
  const p = squareOf(r.end);
  if (splat) { splat.position.set(p.x, 0.1, p.z); splat.visible = true; }
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
  if (round.left <= 0) finish();
}

function boot() {
  if (!window.SSX?.registerSurfaceTick) { setTimeout(boot, 300); return; }
  if (window.SSX.chickenbingo) return;
  load();
  window.SSX.chickenbingo = { open, close, PIT: K.PIT, STAKES: K.STAKES, squares: K.squares, state: () => ({ ...save, live: !!round }) };
  window.SSX.registerSurfaceTick((dt) => { try { tick(dt); } catch (e) { /* */ } });
  try { window.SSX.registerMenuItem?.({ id: 'rmBingo', label: '🐔 Chicken Shit Bingo', onTap: () => { if (window.__app?.surface?.info?.inside?.kind === 'club') open(); else toast('Chicken Shit Bingo is in the Velvet lobby, south of the stage.', 3200); } }); } catch (e) { /* */ }
}
boot();
export default { addChickenBingo };
