// Plasma Paddle cabinet in the Velvet Airlock. Drag the left side to move your scoop.
// Optional credit bet against Nix. Original neon-plasma look. Credits only.
import * as K from './plasmapaddlecore.js';
import { panelTap } from './racehooks.js';
import './velvetclub.js';

const KEY = K.KEY;
const game = () => window.__app?.surface?.game || window.__app?.game;
const toast = (t, ms) => { try { window.__app?.toast?.(t, ms); } catch (e) { /* */ } };
const credits = () => game()?.progress?.credits | 0;

let save = K.fresh(), root = null, buy = null, live = null, raf = 0, stake = 0, last = 0;
const club = () => window.SSX?.velvetclub;
const meY = { v: 50 };

function load() { try { save = K.load(localStorage.getItem(KEY)); } catch (e) { save = K.fresh(); } }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* */ } }
function spend(n) { const g = game(); return !n || !!(g && g.spend && g.spend(n)); }
function pay(n) { try { game()?.reward?.(0, n); } catch (e) { /* */ } }

const CSS = `#ppGame{position:fixed;inset:0;z-index:66;display:none;background:#07010f;color:#fff;flex-direction:column;touch-action:none}
#ppGame.on{display:flex;height:100dvh;width:100vw}
#ppGame header{display:flex;align-items:center;gap:8px;padding:calc(8px + env(safe-area-inset-top)) 8px 8px;box-sizing:border-box}
#ppGame header b{flex:1;font:800 16px/1.2 system-ui,sans-serif}
#ppGame header button,.ppStakes button{min-height:48px;min-width:48px;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:800 15px system-ui,sans-serif}
#ppGame canvas{position:relative;inset:auto;flex:1 1 0;width:100%;min-height:120px;height:auto;display:block;touch-action:none}
#ppGame .ppStakes{display:flex;flex-wrap:wrap;gap:6px;padding:8px 8px calc(8px + env(safe-area-inset-bottom));box-sizing:border-box}
#ppGame .ppStakes button{flex:1 1 42%}
#ppGame .hint{padding:0 10px 6px;font:700 13px/1.3 system-ui,sans-serif;color:#d8c8ff}
#ppBuy{position:fixed;left:0;right:0;bottom:0;z-index:67;display:none;box-sizing:border-box;padding:12px calc(12px + env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) calc(12px + env(safe-area-inset-left));background:#000;color:#fff;border-top:2px solid #fff;font:15px/1.3 system-ui,sans-serif}
#ppBuy.on{display:block}
#ppBuy h2{margin:0 48px 6px 0;font-size:18px}
#ppBuy button{min-height:48px;width:100%;margin-top:8px;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:800 16px system-ui,sans-serif}`;

function ensure() {
  if (root) return root;
  const st = document.createElement('style'); st.id = 'ppCss'; st.textContent = CSS; document.head.appendChild(st);
  root = document.createElement('div'); root.id = 'ppGame'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Plasma Paddle');
  root.innerHTML = `<header><b id="ppTitle">Plasma Paddle</b><button type="button" data-a="close" aria-label="Close">Close</button></header><p class="hint">Drag the left side. Your scoop is the cyan one. First to ${K.WIN}. Nix is on the right.</p><canvas id="ppCanvas"></canvas><div class="ppStakes" id="ppStakes"></div>`;
  document.body.appendChild(root);
  panelTap(root, e => {
    const b = e.target?.closest?.('button'); if (!b) return;
    if (b.dataset.a === 'close') return close();
    if (b.dataset.a === 'stake') return start(+b.dataset.n);
  });
  const cv = root.querySelector('canvas');
  let down = false;
  const setY = (ev) => {
    const r = cv.getBoundingClientRect();
    const y = (ev.clientY - r.top) / Math.max(1, r.height);
    meY.v = Math.max(8, Math.min(92, y * 100));
  };
  cv.addEventListener('pointerdown', e => { if (e.cancelable) e.preventDefault(); down = true; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* */ } if (!live || live.over) start(0); setY(e); });
  cv.addEventListener('pointermove', e => { if (down) setY(e); });
  cv.addEventListener('pointerup', () => { down = false; });
  cv.addEventListener('pointercancel', () => { down = false; });
  return root;
}
function stakesNow() { return club()?.perk?.().paddleStakes || K.STAKES; }
function paintStakes() {
  const box = root.querySelector('#ppStakes');
  const cr = credits();
  box.innerHTML = stakesNow().map(n => `<button type="button" data-a="stake" data-n="${n}">${n ? n + ' cr vs Nix' : 'Just play'}</button>`).join('') + `<span style="flex:1 1 100%;font:700 13px system-ui,sans-serif">${club()?.line?.() || ''} ${cr} cr. A win pays double.</span>`;
}
function showBuy() {
  ensure();
  if (!buy) {
    buy = document.createElement('div'); buy.id = 'ppBuy'; buy.setAttribute('role', 'dialog'); buy.setAttribute('aria-label', 'Buy Plasma Paddle');
    document.body.appendChild(buy);
    panelTap(buy, e => {
      const b = e.target?.closest?.('button'); if (!b) return;
      if (b.dataset.a === 'close') buy.classList.remove('on');
      if (b.dataset.a === 'buy') { const r = club()?.buy?.('paddle'); if (r?.ok) { buy.classList.remove('on'); open(); } }
    });
  }
  buy.innerHTML = `<h2>Plasma Paddle</h2><p>A cabinet in the lobby. Drag the scoop, first to ${K.WIN}. Locked until you buy it.</p><p>${club()?.line?.() || ''}</p><p>Price 50,000 cr. You have ${credits()} cr.</p><button type="button" data-a="buy">Buy · 50,000 cr</button><button type="button" data-a="close">Close</button>`;
  buy.classList.add('on');
}
function draw() {
  const cv = root.querySelector('canvas');
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.floor(w * dpr) || cv.height !== Math.floor(h * dpr)) { cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr); }
  const x = cv.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, w, h);
  const g = x.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#14001f'); g.addColorStop(1, '#001018');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(255,60,200,0.55)'; x.lineWidth = 3;
  x.beginPath(); x.ellipse(w / 2, h / 2, w * 0.42, h * 0.38, 0, 0, Math.PI * 2); x.stroke();
  x.strokeStyle = 'rgba(80,255,255,0.25)'; x.beginPath(); x.ellipse(w / 2, h / 2, w * 0.22, h * 0.16, 0, 0, Math.PI * 2); x.stroke();
  const s = live;
  if (!s) {
    x.fillStyle = '#fff'; x.font = '800 22px system-ui,sans-serif'; x.textAlign = 'center';
    x.fillText('Plasma Paddle', w / 2, h / 2);
    return;
  }
  const X = px => px / 100 * w, Y = py => py / 100 * h;
  const scoop = (px, py, col) => {
    x.strokeStyle = col; x.lineWidth = 8; x.lineCap = 'round';
    x.beginPath(); x.arc(X(px), Y(py), 28, px < 50 ? -1.1 : Math.PI - 1.1, px < 50 ? 1.1 : Math.PI + 1.1); x.stroke();
  };
  scoop(10, s.me, '#7af0ff');
  scoop(90, s.foe, '#ff4ad8');
  const trail = s.trail || [];
  trail.forEach((p, i) => {
    x.fillStyle = `rgba(180,255,80,${0.15 + i / trail.length * 0.5})`;
    x.beginPath(); x.arc(X(p.x), Y(p.y), 6 + i, 0, Math.PI * 2); x.fill();
  });
  const ball = x.createRadialGradient(X(s.ball.x), Y(s.ball.y), 2, X(s.ball.x), Y(s.ball.y), 16);
  ball.addColorStop(0, '#f8ffd0'); ball.addColorStop(1, 'rgba(120,255,60,0)');
  x.fillStyle = ball; x.beginPath(); x.arc(X(s.ball.x), Y(s.ball.y), 16, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#fff'; x.font = '800 20px system-ui,sans-serif'; x.textAlign = 'center';
  x.fillText(`YOU ${s.you}  ·  NIX ${s.them}`, w / 2, 28);
}
function frame(t) {
  if (!root?.classList.contains('on')) return;
  const dt = Math.min(0.04, last ? (t - last) / 1000 : 0.016); last = t;
  if (live && !live.over) {
    K.step(live, dt, meY.v);
    live.trail = (live.trail || []).concat([{ x: live.ball.x, y: live.ball.y }]).slice(-8);
    if (live.you >= K.WIN || live.them >= K.WIN) endMatch();
  }
  draw();
  raf = requestAnimationFrame(frame);
}
function start(n) {
  if (!club()?.owns?.('paddle')) return showBuy();
  if (live && !live.over) return;
  if (!stakesNow().includes(n)) return;
  if (n && credits() < n) { toast(`You need ${n} cr.`, 2200); return; }
  if (n && !spend(n)) { toast(`You need ${n} cr.`, 2200); return; }
  stake = n;
  live = { ball: K.serve(Math.random() < 0.5 ? 1 : -1), me: 50, foe: 50, you: 0, them: 0, trail: [] };
  meY.v = 50;
  root.querySelector('#ppTitle').textContent = n ? `Plasma Paddle · ${n} cr` : 'Plasma Paddle';
  root.querySelector('#ppStakes').innerHTML = '';
}
function endMatch() {
  if (!live || live.done) return;
  live.done = true; live.over = true;
  const youWin = live.you >= K.WIN;
  save.played++;
  if (youWin) { save.won++; if (stake) { pay(stake * 2); save.net += stake; } }
  else { save.lost++; save.net -= stake; }
  persist();
  try { club()?.play?.(stake); } catch (e) { /* */ }
  const msg = youWin ? (stake ? `You beat Nix. Paid ${stake * 2} cr.` : 'You beat Nix.') : (stake ? `Nix takes it. You lose ${stake} cr.` : 'Nix takes it.');
  toast(msg, 3200);
  root.querySelector('#ppTitle').textContent = msg;
  paintStakes();
  stake = 0;
}
function open() {
  if (!club()?.owns?.('paddle')) { showBuy(); try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ } return { ok: true, buy: true }; }
  ensure(); root.classList.add('on'); paintStakes(); live = null;
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ }
  last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  return { ok: true };
}
function close() { root?.classList.remove('on'); cancelAnimationFrame(raf); live = null; }

export function addPlasmaCabinet(api) {
  const { box, mat } = api, A = K.AT;
  const body = mat(0x14081c, { roughness: 0.5, metalness: 0.4 });
  const glow = mat(0x7af0ff, { emissive: 0x7af0ff, emissiveIntensity: 0.8 });
  const hot = mat(0xff4ad8, { emissive: 0xff4ad8, emissiveIntensity: 0.7 });
  const shell = box(A.x, 0.7, A.z, 0.7, 1.4, 0.55, body);
  const screen = box(A.x, 1.15, A.z + 0.28, 0.5, 0.42, 0.04, glow);
  const marquee = box(A.x, 1.55, A.z, 0.74, 0.16, 0.58, hot);
  api.col(A.x, A.z, 0.4, 0.35);
  const sale = api.sign('50,000 CR', 0xffd040, A.x, 2.15, A.z + 0.4, 0, 2.2, { w: 512, h: 96, font: 'bold 64px system-ui, sans-serif' });
  const title = api.sign('PLASMA PADDLE', 0x7af0ff, A.x, 2.15, A.z + 0.4, 0, 2.2, { w: 512, h: 96, font: 'bold 40px system-ui, sans-serif' });
  api.sign('DRAG TO SCOOP', 0xff4ad8, A.x, 1.75, A.z + 0.4, 0, 1.8, { h: 72, font: 'bold 36px system-ui, sans-serif' });
  const spot = api.spot({ id: 'plasmapaddle', x: A.x, z: A.z + 1.15, r: 1.25, label: 'Buy Plasma Paddle', act: 'velvet', run: () => open() });
  Object.defineProperty(spot, 'label', { configurable: true, get() { return club()?.owns?.('paddle') ? 'Play Plasma Paddle' : 'Buy Plasma Paddle · 50,000 cr'; } });
  api.ticks.push(() => {
    const owned = !!club()?.owns?.('paddle');
    sale.visible = !owned; title.visible = owned;
    shell.visible = true;
    const heat = club()?.perk?.().skin === 'heat';
    glow.emissive?.setHex(heat ? 0xffb020 : 0x7af0ff); glow.color?.setHex(heat ? 0xffb020 : 0x7af0ff);
    hot.emissive?.setHex(heat ? 0xff3030 : 0xff4ad8); hot.color?.setHex(heat ? 0xff3030 : 0xff4ad8);
    screen.visible = owned; marquee.visible = owned;
  });
}

function boot() {
  if (!window.SSX) { setTimeout(boot, 300); return; }
  if (window.SSX.plasmapaddle) return;
  load();
  window.SSX.plasmapaddle = { open, close, AT: K.AT, state: () => ({ ...save, owned: !!club()?.owns?.('paddle') }) };
  try { window.SSX.registerMenuItem?.({ id: 'rmPaddle', label: '🟢 Plasma Paddle', onTap: () => { if (window.__app?.surface?.info?.inside?.kind === 'club') open(); else toast('Plasma Paddle is a cabinet in the Velvet lobby.', 3200); } }); } catch (e) { /* */ }
}
boot();
export default { addPlasmaCabinet };
