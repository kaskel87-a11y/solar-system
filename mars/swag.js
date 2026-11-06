// Planum Swag (v7.5.68). Slick's shop on the ice beside Frostbite Benny: an open-west lobby in the
// Velvet Airlock palette (three walls, roof, framed mouth, counter, neon). Snow threads (the wardrobe),
// boards you keep, bowling balls, cartoon liquor and crater drugs, and a short ban if you insult the help.
// Owning a board skips Benny's 50 cr rental. The rental stays for anyone who has not bought one.
// Phone: one building, two people, no PointLights, no GLBs, no per-frame allocation. Effects are one CSS veil.
// Pure rules: ./swagcore.js.  window.SSX.swag  window.__swag
import * as THREE from 'three';
import * as W from './swagcore.js';
import { nearZone } from './icecapcore.js';
import { buildHuman } from '../interiors.js';

const app = () => window.__app, surf = () => app()?.surface, game = () => surf()?.game;
const tryv = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
const toast = (t, ms = 2800) => { try { app()?.toast?.(t, ms); } catch (e) { /* */ } log.push(t); if (log.length > 40) log.shift(); };
const log = [];
const fmt = n => Math.round(n).toLocaleString('en-US');
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const now = () => Date.now();
const credits = () => +(tryv(() => game()?.progress?.credits, 0) || 0);
function spend(n) { const g = game(); if (!g || credits() < n) return false; if (g.spend) return !!g.spend(n); g.progress.credits -= n; tryv(() => g.save()); return true; }
function refund(n) { const g = game(); if (!g?.progress || !(n > 0)) return; g.progress.credits += Math.round(n); tryv(() => g.save()); }

let st = W.fresh();
try { st = W.parse(localStorage.getItem(W.SAVE_KEY)); } catch (e) { /* private mode */ }
const save = () => { try { localStorage.setItem(W.SAVE_KEY, JSON.stringify(st)); } catch (e) { /* */ } };
let threadSync = false;
function syncThreads(wearId) {
  const g = window.SSX?.skins?.grant; if (typeof g !== 'function') return;
  if (threadSync && !wearId) return;
  const owned = window.SSX.skins.owned || [];
  for (const id of st.threads) if (!owned.includes(id)) g(id, false);
  const wear = wearId || (!threadSync ? st.wear : null);
  threadSync = true;
  if (wear && st.threads.includes(wear)) g(wear, true);
}

const css = `
#swagPanel{position:fixed;z-index:72;left:calc(8px + env(safe-area-inset-left));right:calc(8px + env(safe-area-inset-right));bottom:calc(8px + env(safe-area-inset-bottom));max-width:560px;margin:0 auto;max-height:min(62vh,520px);display:none;flex-direction:column;background:#000;color:#fff;border:3px solid #fff;border-radius:14px;font:14px/1.3 system-ui,sans-serif;box-shadow:0 8px 28px #000}
#swagPanel.on{display:flex}
#swagPanel .hd{display:flex;align-items:center;gap:8px;padding:8px 10px 6px;border-bottom:1px solid #444}
#swagPanel .hd .t{flex:1;font:900 17px/1.15 system-ui,sans-serif}#swagPanel .hd .t small{display:block;font:600 12px system-ui,sans-serif;color:#ccc}
#swagPanel .hd .cr{font-weight:800;white-space:nowrap}
#swagPanel button{min-height:44px;min-width:44px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 14px system-ui,sans-serif;touch-action:manipulation;padding:0 10px}
#swagPanel button.on{background:#fff;color:#000}#swagPanel button:disabled{border-style:dashed;border-color:#777;color:#aaa}
#swagPanel .ban{margin:8px 10px 0;padding:8px;border:2px solid #fff;border-radius:10px;font-weight:800}
#swagPanel .ban button{display:block;width:100%;margin-top:6px}
#swagPanel .list{overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y;padding:4px 10px 8px}
#swagPanel .sec{font:800 11px system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#bbb;padding:8px 0 2px}
#swagPanel .row{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid #2a2a2a;flex-wrap:wrap}
#swagPanel .row .ic{font-size:22px;width:28px;text-align:center}#swagPanel .row .nm{flex:1;font-weight:800}#swagPanel .row .nm small{display:block;font-weight:500;color:#ccc;font-size:12px}
#swagPanel .foot{display:flex;gap:6px;padding:8px;border-top:1px solid #444;flex-wrap:wrap}
#swagPanel .foot button{flex:1}
#swagAsk{padding:8px 10px 10px;border-top:1px solid #fff;font-weight:800}
#swagAsk .q{margin-bottom:6px}
#swagAsk .r{display:flex;gap:6px;flex-wrap:wrap}#swagAsk .r button{flex:1}
#swagChip{position:fixed;z-index:16;top:calc(108px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);display:none;max-width:calc(100vw - 24px);padding:6px 12px;border-radius:12px;border:3px solid #fff;background:#000;color:#fff;font:900 14px/1.2 system-ui,sans-serif;pointer-events:none;text-align:center}
#swagChip.on{display:block}
#swagVeil{position:fixed;inset:-10%;z-index:12;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 42%, transparent 42%, rgba(0,0,0,.62) 100%)}
#swagVeil.buzz{opacity:.5;animation:swagBuzz 1.15s ease-in-out infinite}
#swagVeil.wobble{opacity:.72;background:radial-gradient(circle at 50% 42%, rgba(80,40,120,.18) 20%, rgba(0,0,0,.72) 100%);animation:swagWob 0.7s ease-in-out infinite}
#swagVeil.courage{opacity:.42;background:radial-gradient(circle at 50% 40%, rgba(40,90,40,.28), rgba(0,0,0,.45) 78%)}
@keyframes swagBuzz{50%{transform:rotate(1deg) translateX(7px)}}
@keyframes swagWob{50%{transform:rotate(-2.2deg) translate(10px,-6px)}}
body.swagOpen :is(#hxMore,#hxMoreP,#surfHelp,#icecapAct,#cfLayer,#skPanel,#skBtn){display:none!important}
body.icecapBowling :is(#swagPanel,#swagChip,#swagVeil){display:none!important}
`;

let panel, chip, veil, askWho = '', open = false, stall = null, stallScene = null, slick = null, pebble = null, simT = 0;
function realTap(el, fn) {
  let down = null, maxMove = 0, lastUp = 0;
  el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; down = { id: e.pointerId, x: e.clientX, y: e.clientY }; maxMove = 0; });
  el.addEventListener('pointermove', e => { if (down && e.pointerId === down.id) maxMove = Math.max(maxMove, Math.hypot(e.clientX - down.x, e.clientY - down.y)); });
  el.addEventListener('pointercancel', () => { down = null; });
  el.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') return; const d = down; down = null; if (!d || d.id !== e.pointerId || maxMove >= 10) return; e.preventDefault(); lastUp = performance.now(); fn(e.target); });
  el.addEventListener('click', e => { if (performance.now() - lastUp < 700) return; fn(e.target); });
}
function ui() {
  if (panel) return;
  const stl = document.createElement('style'); stl.textContent = css; document.head.appendChild(stl);
  panel = document.createElement('div'); panel.id = 'swagPanel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Planum Swag');
  panel.innerHTML = `<div class="hd"><div class="t">🛍️ Planum Swag<small>Slick's shop · threads, boards, trouble</small></div><div class="cr"></div><button type="button" data-a="x" aria-label="Close">✕</button></div><div class="ban" hidden></div><div class="list"></div><div id="swagAsk" hidden></div><div class="foot"></div>`;
  document.body.appendChild(panel);
  chip = document.createElement('div'); chip.id = 'swagChip'; chip.setAttribute('role', 'status'); document.body.appendChild(chip);
  veil = document.createElement('div'); veil.id = 'swagVeil'; document.body.appendChild(veil);
  realTap(panel, t => { const b = t?.closest?.('button'); if (!b || !panel.contains(b)) return; onBtn(b.dataset.a, b.dataset.id); });
}
const SECS = [['thread', 'Snow threads'], ['board', 'Boards'], ['ball', 'Bowling balls'], ['liquor', 'Liquor'], ['drug', 'Crater chems']];
let paintKey = '';
function render() {
  if (!panel) return; const t = now(), ban = W.banned(st, t), rows = W.rows(st, credits(), t);
  const key = `${credits()}|${Math.ceil(W.banLeft(st, t) / 1000)}|${askWho}|${st.wear}|${st.board}|${st.ball}|${st.threads.join()}|${st.boards.join()}|${st.balls.join()}|${JSON.stringify(st.bag)}|${st.banUntil}`;
  if (key === paintKey) return; paintKey = key;
  panel.querySelector('.cr').textContent = `💰 ${fmt(credits())} cr`;
  const banEl = panel.querySelector('.ban');
  banEl.hidden = !ban;
  if (ban) banEl.innerHTML = `🚫 BANNED ${W.fmtLeft(W.banLeft(st, t))}. Slick won't sell until it runs out.<button type="button" data-a="fine">Pay ${W.FINE} cr fine · clear it</button>`;
  panel.querySelector('.list').innerHTML = SECS.map(([kind, title]) => {
    const rs = rows.filter(r => r.kind === kind); if (!rs.length) return '';
    return `<div class="sec">${title}</div>` + rs.map(r => {
      let btn;
      if (ban) btn = `<button type="button" disabled>Banned</button>`;
      else if (r.kind === 'drug' || r.kind === 'liquor') {
        const use = r.qty ? `<button type="button" data-a="use" data-id="${r.id}">Use ×${r.qty}</button>` : '';
        const buy = r.qty >= W.STACK ? `<button type="button" disabled>Full</button>` : `<button type="button" data-a="buy" data-id="${r.id}" ${r.afford ? '' : 'disabled'}>Buy · ${fmt(r.price)}</button>`;
        btn = ban ? `<button type="button" disabled>Banned</button>` : use + buy;
      } else if (r.worn) btn = `<button type="button" class="on" disabled>Wearing</button>`;
      else if (r.owned) btn = `<button type="button" data-a="wear" data-id="${r.id}">Wear</button>`;
      else btn = `<button type="button" data-a="buy" data-id="${r.id}" ${r.afford ? '' : 'disabled'}>Buy · ${fmt(r.price)}</button>`;
      return `<div class="row"><div class="ic">${r.icon}</div><div class="nm">${esc(r.name)}<small>${esc(r.blurb)}</small></div>${btn}</div>`;
    }).join('');
  }).join('');
  const foot = panel.querySelector('.foot'), ask = panel.querySelector('#swagAsk');
  if (askWho && W.MOUTHS[askWho]) {
    foot.hidden = true; ask.hidden = false;
    const m = W.MOUTHS[askWho];
    ask.innerHTML = `<div class="q">Insult ${esc(m.who)}? “${esc(m.line)}” Ban is ${W.fmtLeft(W.BAN_MS)}, or pay the fine and walk it back.</div><div class="r"><button type="button" data-a="say" data-id="${m.id}">Say it · banned</button><button type="button" data-a="avoid" data-id="${m.id}">Pay ${W.FINE} cr fine</button><button type="button" data-a="nah">Never mind</button></div>`;
  } else { ask.hidden = true; ask.innerHTML = ''; foot.hidden = false; foot.innerHTML = ban ? '' : `<button type="button" data-a="ask" data-id="slick">Insult Slick</button><button type="button" data-a="ask" data-id="pebble">Insult Pebble</button>`; }
}
function show(on) { ui(); open = !!on; panel.classList.toggle('on', open); document.body.classList.toggle('swagOpen', open); if (open) { askWho = ''; paintKey = ''; render(); } }
function explain(r) {
  if (!r) return;
  if (r.why === 'banned') toast(`🚫 Banned ${W.fmtLeft(r.left)}. Pay ${W.FINE} cr or wait it out.`, 3200);
  else if (r.why === 'broke') toast(`💸 You need ${fmt(r.need || r.price || W.FINE)} cr more. You have ${fmt(credits())}.`, 2800);
  else if (r.why === 'owned') toast('You already own that.', 2000);
  else if (r.why === 'full') toast('Pockets are full of that one. Use some first.', 2400);
  else if (r.why === 'none') toast('You don\'t have any of that.', 2000);
  else if (r.why === 'clear') toast('No ban to pay off.', 1800);
  else if (r.why === 'need') toast('Buy it first.', 1800);
}
function onBtn(a, id) {
  if (a === 'x') { show(false); return; }
  if (a === 'ask') { askWho = id; render(); return; }
  if (a === 'nah') { askWho = ''; render(); return; }
  if (a === 'buy') return buy(id);
  if (a === 'wear') return wear(id);
  if (a === 'use') return use(id);
  if (a === 'fine') return fine(false);
  if (a === 'say') return say(id);
  if (a === 'avoid') return fine(true);
}
function buy(id) {
  const q = W.buy(st, id, credits(), now()); if (!q.ok) { explain(q); render(); return q; }
  if (q.price > 0 && !spend(q.price)) { toast(`💸 ${q.item.name} is ${fmt(q.price)} cr.`); render(); return { ok: false, why: 'broke' }; }
  st = q.state; save();
  if (q.item.kind === 'thread') syncThreads(id);
  const gear = q.item.kind === 'board' || q.item.kind === 'ball' ? ' It\'s the one you\'re using.' : q.item.kind === 'thread' ? ' You\'re wearing it. ☰ Wardrobe keeps it.' : ` In your pocket (×${st.bag[id] || 1}).`;
  toast(`🛍️ ${q.item.name} · −${fmt(q.price)} cr.${gear}`, 2800);
  render(); return { ok: true, id };
}
function wear(id) {
  const q = W.equip(st, id, now()); if (!q.ok) { explain(q); render(); return q; }
  st = q.state; save();
  if (W.BY_ID[id]?.kind === 'thread') syncThreads(id);
  toast(id === 'house' ? '🪨 Back on Benny\'s boulder.' : `Wearing ${W.BY_ID[id]?.name || id}.`, 2000);
  render(); return q;
}
function use(id) {
  const q = W.useItem(st, id, now()); if (!q.ok) { explain(q); render(); return q; }
  st = q.state; save();
  const line = q.fx.kind === 'courage' ? 'Your pulse is loud. Bad ideas feel easy.' : q.fx.kind === 'wobble' ? 'The ice leans. Walk it off.' : 'Warm buzz. The lamps smear a little.';
  toast(`${q.item.icon} ${q.item.name}. ${line}`, 2800);
  render(); paintChip(true); return q;
}
function say(id) {
  const q = W.insult(st, id, now()); askWho = '';
  if (!q.ok) { explain(q); render(); return q; }
  st = q.state; save();
  toast(`🚫 “${q.line}” ${q.who} bans you for ${W.fmtLeft(q.left)}. Pay ${W.FINE} cr to clear it, or wait.`, 4200);
  render(); paintChip(true); return q;
}
function fine(avoid) {
  const q = W.payFine(st, credits(), now(), avoid); if (!q.ok) { explain(q); render(); return q; }
  if (!spend(q.price)) { toast(`💸 The fine is ${W.FINE} cr. You have ${fmt(credits())}.`, 2800); render(); return { ok: false, why: 'broke' }; }
  st = q.state; save(); askWho = '';
  toast(q.avoided ? `💸 −${W.FINE} cr. Slick pockets it and lets the insult die.` : `💸 −${W.FINE} cr. Ban lifted. Slick is still watching you.`, 3200);
  render(); paintChip(true); return q;
}

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.72, ...o });
function box(g, w, h, d, m, x, y, z) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; }
// The ice rises about 3 m from the west mouth to the east wall. Walls are vertical, buried
// a metre into the snow at their centre so the ends still meet the slope. The roof is level,
// 4.6 m above the high (east) side. Collision stays the five slabs in swagcore (no header).
function buildShop(tc) {
  const g = new THREE.Group(); g.name = 'planum-swag';
  const S = W.SHELL, D = W.DOOR, H = tc.height.bind(tc);
  const midX = (S.x0 + S.x1) / 2, midZ = (S.z0 + S.z1) / 2, doorZ = (D.z0 + D.z1) / 2;
  const yEast = H(S.x1 - 0.4, midZ), yWest = H(S.x0 + 0.5, doorZ);
  const roofY = yEast + 4.65, doorTop = yWest + D.h;
  // No PointLight (the club interior borrows lights[0]). Emissive keeps the purple readable on the ice.
  const wallM = M(0x6a3478, { roughness: 0.82, emissive: 0x4a1848, emissiveIntensity: 0.72 });
  const velvet = M(0x8a2048, { roughness: 0.9, emissive: 0x5a1030, emissiveIntensity: 0.55 });
  const black = M(0x1a1020, { roughness: 0.55, emissive: 0x140810, emissiveIntensity: 0.4 });
  const chrome = M(0xc0c4cc, { metalness: 0.9, roughness: 0.22, emissive: 0x404448, emissiveIntensity: 0.25 });
  const topM = M(0xc43a78, { roughness: 0.32, emissive: 0xff3cc8, emissiveIntensity: 0.35 });
  const pink = new THREE.MeshBasicMaterial({ color: 0xff3cc8 });
  const roofM = M(0x140810, { roughness: 1, emissive: 0x1a0814, emissiveIntensity: 0.5 });
  const bury = 1.05;
  const raise = (x, z, sx, sz, mat, top) => { const gy = H(x, z), y0 = gy - bury, h = Math.max(0.4, top - y0); return box(g, sx, h, sz, mat, x, y0 + h / 2, z); };
  // north / south in two runs so a 12 m wall does not float off the slope
  for (const [x, sx] of [[(S.x0 + midX) / 2, midX - S.x0], [(midX + S.x1) / 2, S.x1 - midX]]) {
    raise(x, S.z1 - S.t / 2, sx, S.t, wallM, roofY);
    raise(x, S.z0 + S.t / 2, sx, S.t, wallM, roofY);
  }
  raise(S.x1 - S.t / 2, midZ, S.t, S.z1 - S.z0, wallM, roofY);
  for (const s of W.SLABS) if (s.id.startsWith('west')) raise(s.x, s.z, s.hx * 2, s.hz * 2, wallM, roofY);
  if (roofY > doorTop + 0.2) box(g, S.t, roofY - doorTop, D.z1 - D.z0, wallM, S.x0 + S.t / 2, (doorTop + roofY) / 2, doorZ);
  const fx = S.x0 + S.t + 0.04;
  box(g, 0.08, D.h, 0.08, pink, fx, yWest + D.h / 2, D.z0);
  box(g, 0.08, D.h, 0.08, pink, fx, yWest + D.h / 2, D.z1);
  box(g, 0.08, 0.08, (D.z1 - D.z0) + 0.16, pink, fx, doorTop, doorZ);
  const leaf = box(g, 0.08, 2.45, 1.45, M(0x161018, { metalness: 0.4, roughness: 0.45 }), S.x0 + 1.15, yWest + 1.22, D.z0 - 0.2);
  leaf.rotation.y = 0.55;
  box(g, (S.x1 - S.x0) + 0.7, 0.18, (S.z1 - S.z0) + 0.7, roofM, midX, roofY + 0.08, midZ);
  const run = box(g, 8.4, 0.035, 2.15, velvet, midX + 0.3, (yWest + yEast) / 2 + 0.04, midZ);
  run.rotation.z = -Math.atan2(yEast - yWest, (S.x1 - S.x0) - 1);
  const cX = S.x1 - S.t - 0.95, cY = H(cX, midZ);
  box(g, 0.72, 1.05, 4.4, black, cX, cY + 0.52, midZ);
  box(g, 0.86, 0.06, 4.6, topM, cX - 0.04, cY + 1.08, midZ);
  box(g, 0.04, 0.05, 4.5, chrome, cX - 0.42, cY + 1.02, midZ);
  box(g, 7.2, 0.045, 0.05, pink, midX, roofY - 0.28, midZ);
  box(g, 0.06, 0.035, D.z1 - D.z0, pink, S.x0 + 0.7, yWest + 0.03, doorZ);
  const decks = [0xc45a28, 0x141416, 0x2a1848], stripes = [0xf2e6c8, 0x3cf0ff, 0xff4ad4];
  for (let i = 0; i < 3; i++) {
    const x = midX - 1.2 + i * 0.85, z = S.z1 - S.t - 0.45, y = H(x, z) + 1.15;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 1.15), M(decks[i])); b.position.set(x, y, z); b.rotation.x = -0.35; g.add(b);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.16), M(stripes[i])); stripe.position.copy(b.position); stripe.position.y += 0.03; stripe.rotation.x = b.rotation.x; g.add(stripe);
  }
  for (let i = 0; i < 3; i++) {
    const x = cX - 0.35, z = midZ - 0.9 + i * 0.7;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), M([0x6a8a4a, 0x1a1a1c, 0xc81e1e][i]));
    b.position.set(x, H(x, z) + 1.28, z); g.add(b);
  }
  const signMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, map: canvasTex(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#0c0610'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#ff3cc8'; ctx.lineWidth = 10; ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#ff3cc8'; ctx.font = '900 52px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText("SLICK'S SWAG", w / 2, 62);
    ctx.fillStyle = '#fff'; ctx.font = '700 20px system-ui,sans-serif'; ctx.fillText('threads · boards · trouble', w / 2, 100);
  }) });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.35), signMat);
  sign.position.set(S.x0 + 1.6, roofY + 1.15, midZ); sign.rotation.y = -Math.PI / 2; g.add(sign);
  box(g, 0.12, 1.35, 0.12, black, S.x0 + 1.6, roofY + 0.55, midZ - 2.45);
  box(g, 0.12, 1.35, 0.12, black, S.x0 + 1.6, roofY + 0.55, midZ + 2.45);
  const lintel = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 0.42), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, map: canvasTex(512, 72, (ctx, w, h) => {
    ctx.fillStyle = '#0c0610'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#ff3cc8'; ctx.font = '700 36px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('threads · boards · trouble', w / 2, h / 2);
  }) }));
  lintel.position.set(fx + 0.02, doorTop + 0.38, doorZ); lintel.rotation.y = -Math.PI / 2; g.add(lintel);
  slick = buildHuman({ top: 0xf2f2f2, bottom: 0x1a1a1a, skin: 0xc8946a, hair: 0x111111, hairStyle: 'bun', shades: true, bulk: 1.05, accent: 0xff4ad4 });
  const sx = S.x1 - S.t - 0.2;
  slick.group.name = 'swag-slick'; slick.group.userData.human = true;
  slick.group.position.set(sx, H(sx, midZ), midZ); slick.group.rotation.y = Math.PI / 2; g.add(slick.group);
  pebble = buildHuman({ top: 0x3a4250, bottom: 0x2a241c, skin: 0xd0a080, hair: 0x4a3020, hairStyle: 'cap', bulk: 0.95 });
  const px = midX + 0.4, pz = midZ - 2.15;
  pebble.group.name = 'swag-pebble'; pebble.group.userData.human = true;
  pebble.group.position.set(px, H(px, pz), pz); pebble.group.rotation.y = Math.PI + 0.5; g.add(pebble.group);
  tc.scene.add(g); stall = g; stallScene = tc.scene;
  tryv(() => window.SSX?.minimap?.addMarks?.('swag', [{ x: W.SPOT.x, z: W.SPOT.z, color: '#ff3cc8', r: 3, label: 'Swag' }]));
}
let solidOff = [];
function clearSolids() { for (const fn of solidOff) tryv(fn); solidOff = []; }
function wallsUp() {
  const w = surf()?.world, s = W.SLABS[0];
  if (!w?.collide || !w.colony || !s) return false;
  return !!tryv(() => w.collide(s.x, s.z, 0.15));
}
function ensureSolids() {
  const w = surf()?.world;
  if (!w?.addSolid || !w.colony) return false;
  if (wallsUp()) return true;
  clearSolids();
  const next = [];
  for (const s of W.SLABS) {
    const rm = w.addSolid({ x: s.x, z: s.z, h: 12, box: [s.hx, s.hz], zone: 'planum-swag', nocam: false, r: Math.max(s.hx, s.hz) });
    if (typeof rm !== 'function') { for (const fn of next) tryv(fn); return false; }
    next.push(rm);
  }
  solidOff = next;
  return true;
}
function idle(h, t, arm) { if (!h) return; h.hips.rotation.set(0, 0, 0); h.torso.rotation.set(0, 0, Math.sin(t) * 0.04); h.head.rotation.set(0, Math.sin(t * 0.6) * 0.4, 0); h.arms[0].rotation.set(0, 0, 0); h.arms[1].rotation.set(arm, 0, 0); for (const l of h.legs) l.rotation.set(0, 0, 0); }

let chipKey = '';
function paintChip(force) {
  if (!chip) return;
  const t = now(), ban = W.banned(st, t), fx = W.fxView(st, t);
  const bowling = document.body.classList.contains('icecapBowling');
  const text = ban ? `🚫 BANNED ${W.fmtLeft(W.banLeft(st, t))} · pay ${W.FINE} cr at the shop` : fx ? `${fx.chip} · ${W.fmtLeft(fx.left)}` : '';
  const key = `${text}|${fx?.kind || ''}|${bowling}|${open}`;
  if (!force && key === chipKey) return; chipKey = key;
  chip.classList.toggle('on', !!text && !open && !bowling);
  chip.textContent = text;
  veil.className = '';
  if (fx && !bowling) veil.classList.add(fx.kind);
}
function nearStall(tc) { const p = tc?.player; if (!p) return false; return Math.hypot(p.x - W.SPOT.x, p.z - W.SPOT.z) < W.NEAR + 1.2; }
function tick(dt, tc) {
  simT += dt; syncThreads();
  const mars = tc?.name === 'Mars' && tc.scene && nearZone(tc.player?.x || 0, tc.player?.z || 0, 80);
  if (!mars) { if (stall) stall.visible = false; if (open) show(false); paintChip(false); return; }
  if (stall && stallScene && stallScene !== tc.scene) { tryv(() => stallScene.remove(stall)); stall = null; clearSolids(); }
  if (!stall || stallScene !== tc.scene) { stall = null; buildShop(tc); }
  stall.visible = true;
  if (!wallsUp()) ensureSolids();
  idle(slick, simT * 1.3, 0.35); idle(pebble, simT * 1.1 + 1, 0.9 + Math.sin(simT) * 0.15);
  if (open && !nearStall(tc)) show(false);
  else if (open) render();
  paintChip(false);
}
function boot() {
  const X = window.SSX; if (!X?.registerSurfaceTick) return false;
  if (X.swag !== api) X.swag = api;
  X.registerSurfaceTick(tick); ui(); return true;
}
const api = {
  open: () => { show(true); return true; }, close: () => show(false),
  buy, wear, use, insult: say, payFine: () => fine(false), avoid: () => fine(true),
  hasBoard: () => W.hasBoard(st), needsRent: rented => W.needsRent(st, rented),
  boardLook: () => W.boardLook(st), ballLook: () => W.ballLook(st), ride: () => W.rideOf(st), ball: () => W.bowlOf(st),
  prompt: () => W.prompt(st, now()), spot: () => ({ ...W.SPOT, near: W.NEAR }),
  slide: (x, z, r) => W.slideBoard(x, z, r), slabs: () => W.SLABS, shell: () => W.SHELL,
  state: () => ({ ...W.norm(st), credits: credits(), banned: W.banned(st, now()), left: W.banLeft(st, now()) })
};
window.__swag = { core: W, api, log: () => log.slice(), open: () => show(true), render };
if (window.SSX) window.SSX.swag = api;
if (!boot()) { const iv = setInterval(() => { if (boot()) clearInterval(iv); }, 250); }
