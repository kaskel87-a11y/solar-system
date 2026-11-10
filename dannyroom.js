// v7.5.81 Danny's own room, off a back door on the north wall of the Velvet Airlock.
// The booth, the private show and the three-strike touch rule live here, not in Ines's VIP room.
// The 5,000 cr special is the first button on her price card and the action button in front of her.
// A missing video (assets/danny/special.mp4) gives the credits back. The 50 cr pole dance is not on her menu.
import { addBooth, SHOW_PRICE } from './privateshow.js';
import { dress, DANNY_NAME } from './clubdancers.js';

export const SPECIAL_PRICE = 5000;
export const SPECIAL_SRC = 'assets/danny/special.mp4';
// Room-local metres, inside the club shell (x -33..25, z -8..24), clear of the card table and of Ines.
export const DANNY_ROOM = {
  x0: -32.6, x1: -26.2, z0: -7.7, z1: -3.8,
  door: { x: -8.6, z: -6.55 },   // back wall of the main room, west of the stage
  back: { x: -8.6, z: -5.5, yaw: Math.PI },
  land: { x: -29.4, z: -4.45, yaw: 0 },
  pole: { x: -29.4, z: -6.35 },
  dance: { x: -29.4, z: -5.2 },
  show: { x: -28.4, z: -6.35 },
  special: { x: -29.4, z: -6.35 },
  exit: { x: -26.9, z: -4.15 }
};

const DF = DANNY_NAME.split(' ')[0];
const hop = (x, z, yaw) => { try { window.__app?.surface?.debugInside?.(x, z, yaw); } catch (e) { /* not in a room */ } };
// The price card, with Special on top. The 18+ gate runs once; after that the card is immediate.
function showMenu() {
  const open = () => { try { window.__pshow?.offer?.(); } catch (e) { /* card not ready */ } };
  try {
    if (localStorage.getItem('ssx.adult') === '1') { open(); return; }
    const g = document.getElementById('adultGate');
    if (!g) { open(); return; }
    g.style.display = 'flex';
    g._yes = () => { localStorage.setItem('ssx.adult', '1'); g.style.display = 'none'; open(); };
  } catch (e) { open(); }
}

let overlay = null, vid = null, refunded = false, started = false;

function ensureOverlay() {
  if (overlay) return overlay;
  const st = document.createElement('style');
  st.textContent = `
#dannySpecial{position:fixed;inset:0;z-index:70;display:none;background:#000}
#dannySpecial.on{display:block}
#dannySpecial video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000}
#dannySpecial button{position:absolute;z-index:2;top:calc(8px + env(safe-area-inset-top));right:calc(8px + env(safe-area-inset-right));min-width:44px;min-height:44px;padding:0 12px;border-radius:10px;border:1.5px solid #fff;background:#000;color:#fff;font:600 15px system-ui,sans-serif;touch-action:manipulation;-webkit-user-select:none;user-select:none}
body.danny-special #surfHud,body.danny-special #joy,body.danny-special #surfBtns,body.danny-special #fireBtn,body.danny-special #meleeBtn{visibility:hidden!important}
`;
  document.head.appendChild(st);
  overlay = document.createElement('div');
  overlay.id = 'dannySpecial';
  overlay.setAttribute('role', 'dialog');
  overlay.innerHTML = '<video id="dannyVid" playsinline webkit-playsinline preload="metadata" controls></video><button type="button" id="dannyVidClose" aria-label="Close">✕</button>';
  document.body.appendChild(overlay);
  vid = overlay.querySelector('video');
  vid.playsInline = true;
  vid.setAttribute('playsinline', '');
  vid.setAttribute('webkit-playsinline', '');
  const closeBtn = overlay.querySelector('button');
  const bind = window.__onTap || ((el, fn) => el.addEventListener('click', fn));
  bind(closeBtn, () => closeSpecial(false));
  vid.addEventListener('playing', () => { started = true; });
  vid.addEventListener('error', () => { if (!started) missingReel(); });
  return overlay;
}

function closeSpecial() {
  if (!overlay) return;
  try { vid.pause(); } catch (e) { /* already gone */ }
  vid.removeAttribute('src');
  try { vid.load(); } catch (e) { /* empty */ }
  overlay.classList.remove('on');
  document.body.classList.remove('danny-special');
}

function missingReel() {
  if (refunded) return;
  refunded = true;
  closeSpecial();
  try { window.__app?.surface?.game?.reward?.(0, SPECIAL_PRICE); } catch (e) { /* no wallet */ }
  try { window.__app?.toast?.(`${DF}: That reel isn't loaded. Your ${SPECIAL_PRICE.toLocaleString('en-US')} cr is back.`, 3200); } catch (e) { /* no toast */ }
}

// Pay, then play. A missing file refunds. The tap is the user gesture iOS needs for inline playback.
export function openSpecial() {
  const game = window.__app?.surface?.game;
  const toast = window.__app?.toast || (() => {});
  if (!game?.spend?.(SPECIAL_PRICE)) { toast(`${DF}: A special is ${SPECIAL_PRICE.toLocaleString('en-US')} cr.`, 2600); return { ok: false, short: true }; }
  ensureOverlay();
  refunded = false; started = false;
  overlay.classList.add('on');
  document.body.classList.add('danny-special');
  vid.src = new URL(SPECIAL_SRC, document.baseURI).href;
  const p = vid.play();
  if (p && typeof p.catch === 'function') p.catch(() => { /* error event refunds a missing file; a gesture block leaves the controls up */ });
  return { ok: true, price: SPECIAL_PRICE };
}

// interiors.js calls this while building the club. poses: { sit, idle, poleDance }
export function addDannyRoom(api, poses = {}) {
  const { box, mat } = api, R = DANNY_ROOM, sit = poses.sit, idle = poses.idle, poleDance = poses.poleDance;
  const wall = mat(0x1a0c18, { roughness: 0.85 }), velvet = mat(0x5a0a2a, { roughness: 0.9 }), black = mat(0x0c0a10), chrome = mat(0xc0c4cc, { metalness: 0.9, roughness: 0.2 }), pink = mat(0xff3cc8, { basic: true }), gold = mat(0xffd040, { basic: true });
  const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2, rw = R.x1 - R.x0, rd = R.z1 - R.z0;
  box(cx, 0.02, cz, rw - 0.2, 0.03, rd - 0.2, mat(0x140810, { roughness: 1 }));
  const H = api.h;
  box(cx, H / 2, R.z0, rw, H, 0.16, wall); api.col(cx, R.z0, rw / 2, 0.12, 'wall');
  box(R.x0, H / 2, cz, 0.16, H, rd, wall); api.col(R.x0, cz, 0.12, rd / 2, 'wall');
  box(R.x1, H / 2, cz, 0.16, H, rd, wall); api.col(R.x1, cz, 0.12, rd / 2, 'wall');
  box(cx, H / 2, R.z1, rw, H, 0.16, wall); api.col(cx, R.z1, rw / 2, 0.12, 'wall');
  box(cx, 0.08, R.z0 + 0.12, rw - 0.4, 0.04, 0.04, pink);
  api.sign(DANNY_NAME.toUpperCase(), 0xff7eb8, cx, 3.1, R.z0 + 0.16, 0, 3.2, { w: 512, h: 96, font: 'bold 52px system-ui, sans-serif' });
  api.sign('SPECIAL · 5,000 CR', 0xffd040, R.x1 - 0.2, 2.2, cz, -Math.PI / 2, 2.6, { w: 512, h: 96, font: 'bold 42px system-ui, sans-serif' });
  // the back door, on the north wall of the main room (west of the stage), not a hole into this box
  const D = R.door;
  box(D.x, 1.35, -7.82, 1.7, 2.7, 0.08, mat(0x3a0a20, { roughness: 0.55 }));
  box(D.x - 0.85, 1.35, -7.7, 0.08, 2.7, 0.08, pink); box(D.x + 0.85, 1.35, -7.7, 0.08, 2.7, 0.08, pink); box(D.x, 2.72, -7.7, 1.86, 0.08, 0.08, gold);
  api.sign("DANNY'S ROOM", 0xff7eb8, D.x, 3.35, -7.68, 0, 2.8, { w: 512, h: 96, font: 'bold 52px system-ui, sans-serif' });
  api.spot({ id: 'danny-door', x: D.x, z: D.z, r: 1.25, act: 'danny', label: "🚪 Danny's room", run() { hop(R.land.x, R.land.z, R.land.yaw); showMenu(); } });
  api.spot({ id: 'danny-back', x: R.exit.x, z: R.exit.z, r: 0.6, act: 'danny', label: '🚪 Back to the club', run() { hop(R.back.x, R.back.z, R.back.yaw); } });
  // her stage: the booth (private dance, lap, encore, three-strike rule). No 50 cr option.
  const P = R.pole;
  box(P.x, 0.12, P.z, 1.4, 0.24, 1.4, black); box(P.x, 0.26, P.z, 1.2, 0.04, 1.2, gold); box(P.x, (0.24 + H) / 2, P.z, 0.06, H - 0.24, 0.06, chrome); api.col(P.x, P.z, 0.7, 0.7);
  box(P.x, 0.25, P.z + 1.15, 0.7, 0.45, 0.7, velvet); box(P.x, 0.7, P.z + 1.4, 0.7, 0.5, 0.12, velvet);
  let privT = 0;
  const prv = api.person({ top: 0x1a1a2a, bottom: 0x1a1a2a, shoes: 0xc0c4cc, hair: 0x2a0a3a, hairStyle: 'long', skin: 0xc8946c, accent: 0xff3cc8, glow: 0xa040ff }, P.x, P.z, 0, (p, t, k, y, dt = 0.016) => {
    if (privT > 0 && poleDance) { privT -= dt; poleDance(p, t, 3, P.x, P.z, 0.24); }
    else { idle?.(p, t, 2); p.group.position.set(P.x + 0.35, 0.24, P.z + 0.25); p.group.rotation.y = 0.3; }
  });
  dress(api, prv, { dancer: 'danny', outfit: 'white', k: 3 });
  api.privateDance = (sec = 9) => { privT = sec; return sec; };
  api.sign('SPECIAL · 5,000 CR', 0xffd040, P.x, 2.05, P.z + 1.05, 0, 2.6, { w: 512, h: 96, font: 'bold 48px system-ui, sans-serif' });
  const booth = addBooth(api, { x: P.x, z: P.z, sit });
  api.spot({ id: 'show', x: R.show.x, z: R.show.z, r: 0.65, label: `💋 ${DF} · Private dance ${SHOW_PRICE}`, act: 'show', who: DANNY_NAME });
  api.spot({ id: 'danny-special', x: P.x, z: P.z, r: 2.1, act: 'danny', adult: true, label: '🎬 Special · 5,000 cr', who: DANNY_NAME, run() { return openSpecial(); } });
  return booth;
}
if (typeof window !== 'undefined') { window.SSX = window.SSX || {}; window.SSX.dannyRoom = { openSpecial, SPECIAL_PRICE, showMenu }; }
