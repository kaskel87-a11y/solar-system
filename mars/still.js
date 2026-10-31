// Mars moonshine still at the Dustbowl Homestead (window.SSX.still + window.SSX.liquor). Rules + numbers: mars/stillcore.js.
// Fiction only: made-up spirits, no real brands, no how-to.
// - Buy it once (1,800 cr or 1,800 ⭐ via SSX.stars, same 1:1 rate as #95's STAR_RATE). It stands by the dome's west wall.
// - Brew: a batch takes up to 12 crops of one kind from the farm's silo (SSX.farm.siloTake) and turns them into bottles over
//   in-game hours (the farm's clock: SSX.empire hour / SSX.time / its own). Potato moonshine, Algae gin, Glow-berry hooch,
//   Ghost lichen absinthe.
// - Crates: bottles pack into crates of 6 that ride in your rover (a crate stack follows the car you drive, plus one caption).
// - Sell: the Xen-7 aliens buy them (the trading post's 👽 Trade sheet gets a 🥃 row). Jeff's Velvet Airlock bar (#93) reads
//   SSX.liquor: inventory() -> [{ id, name, n }], take(id, n) -> number taken, alienPrice(id) -> cr a bottle; add / sell too.
// - BUSTED (game:down why=busted, #56 consequences own the fine): ColSec takes only the crates in your rover. No extra fine;
//   bottles at the still stay safe.
// - UI: one 🥃 Still row in the farm sheet (SSX.farmRows), one 🥃 context button at the still, one caption at a time. Refused
//   in the Rust Pit. Save: ssx.still.v1 + ssx.still.v1.bak (#83 pattern: an owned still is never lost to one bad read).
import * as THREE from 'three';
import * as K from './stillcore.js';
import { makeActGuard, CROPS } from './farmcore.js';

const app = () => window.__app, surf = () => app()?.surface, game = () => app()?.game || surf()?.game;
const FARM = () => window.SSX?.farm, STARS = () => window.SSX?.stars;
const fin = Number.isFinite;
const STILL_AT = [-8.2, -6.0];   // lot-local metres: west of the dome, north of the solar panel
const NEAR_R = 3.2, POST_R = 12, FARM_R = 15;
let S = K.fresh(), restoredFrom = null, saveErr = null;
function load() { try { const r = K.recover(localStorage.getItem(K.SAVE_KEY), localStorage.getItem(K.BAK_KEY)); S = r.s; restoredFrom = r.restored ? r.from : null; } catch (e) { S = K.fresh(); } }
function save() {
  try { const raw = localStorage.getItem(K.SAVE_KEY); if (!K.mayOverwrite(S, raw)) return; const j = JSON.stringify(S); localStorage.setItem(K.SAVE_KEY, j); if (S.owned) localStorage.setItem(K.BAK_KEY, j); saveErr = null; }
  catch (e) { saveErr = String(e?.name || e); }
}
load(); if (restoredFrom) save();
const subs = new Set();
function emit(type, ev = {}) { const e = { type, ...ev }; for (const f of subs) { try { f(e); } catch (x) { console.warn('still on', x); } } try { window.dispatchEvent(new CustomEvent('ssx:still', { detail: e })); } catch (x) { /* */ } return e; }
function toast(m, ms = 2800) { if (!m) return; if (panel?.classList.contains('show')) { pMsg.textContent = m; return; } try { app()?.toast?.(m, ms); } catch (e) { /* */ } }
const credits = () => game()?.progress?.credits | 0;
function payCr(n) { const g = game(); if (!g?.progress || credits() < n) return false; g.progress.credits -= n; try { g.save(); } catch (e) { /* */ } return true; }
function earnCr(n) { const g = game(); if (!g?.progress || !(n > 0)) return; g.progress.credits += n; try { g.save(); } catch (e) { /* */ } }
const starBal = () => { try { const b = STARS()?.balance?.(); return fin(b) ? b : 0; } catch (e) { return 0; } };
const AG = makeActGuard(() => performance.now(), 600);
const res = (ok, msg, x = {}) => ({ ok, msg, ...x });

// ---------- where things are ----------
function place(id) { try { const p = FARM()?.places?.().find(q => q.id === id); return p && fin(p.x) && fin(p.z) ? p : null; } catch (e) { return null; } }
const stillW = () => { const c = place('farm'); return c ? { x: c.x + STILL_AT[0], z: c.z + STILL_AT[1] } : null; };
let tcLast = null;
function me() { const t = tcLast; const p = t?.car || t?.player; return p && fin(p.x) ? p : null; }
const dist = (a, b) => (a && b ? Math.hypot(a.x - b.x, a.z - b.z) : Infinity);
function inPit() { try { return !!FARM()?.debug?.inPit?.(); } catch (e) { return false; } }
const farmOwned = () => { try { return !!FARM()?.status?.().owned; } catch (e) { return false; } };
const nearStill = () => !tcLast?.car && dist(me(), stillW()) < NEAR_R;
const atFarm = () => dist(me(), place('farm')) < FARM_R;
const atPost = () => dist(me(), place('post')) < POST_R;
const hoursNow = () => { try { const h = FARM()?.clock?.().hours; return fin(h) ? h : 0; } catch (e) { return 0; } };
const siloHas = c => { try { return FARM()?.status?.().silo?.[c] | 0; } catch (e) { return 0; } };
function blocked() { if (inPit()) return 'No still business in the Rust Pit.'; if (!place('farm')) return 'The still is at the Dustbowl Homestead on Mars.'; return null; }

// ---------- actions (idempotent: one guard key each, all-or-nothing charges) ----------
function buy(cur = 'cr') {
  return AG.run('buy', () => {
    const b = blocked(); if (b) return res(false, b);
    if (S.owned) return res(false, 'You already own the still.', { why: 'owned' });
    if (!farmOwned()) return res(false, 'Buy the Dustbowl Homestead first.');
    if (!atFarm()) return res(false, 'Go to the Dustbowl Homestead to buy the still.');
    if (cur === 'stars' && typeof STARS()?.spend !== 'function') return res(false, '⭐ aren\u2019t available here. Pay in cr.');
    const r = K.buy(S, cur, { cr: credits(), stars: starBal() }, (c, n) => {
      if (c === 'stars') { try { return STARS().spend(n, 'still') || { ok: false }; } catch (e) { return { ok: false, msg: '⭐ payment failed.' }; } }
      return payCr(n) ? { ok: true } : { ok: false, msg: 'Not enough cr.' };
    });
    if (r.ok) { save(); emit('buy', { cur, n: r.n }); }
    toast(r.msg, 3200); return r;
  });
}
function brew(crop, n = K.BATCH_MAX) {
  return AG.run('brew', () => {
    const b = blocked(); if (b) return res(false, b);
    if (!nearStill() && !atFarm()) return res(false, 'Go to the still at the Dustbowl Homestead.');
    const F = FARM(); if (typeof F?.siloTake !== 'function') return res(false, 'The silo isn\u2019t ready yet.');
    const r = K.start(S, crop, n, siloHas(crop), hoursNow(), (c, k) => F.siloTake(c, k));
    if (r.ok) { save(); emit('brew', { crop, n: r.n, id: r.id, hours: r.hours }); }
    toast(r.msg, 3000); return r;
  });
}
function loadCrates() {
  return AG.run('load', () => {
    const b = blocked(); if (b) return res(false, b); if (!nearStill() && !atFarm()) return res(false, 'Load crates at the still.');
    const r = K.load(S); if (r.ok) { save(); emit('load', { n: r.n, crates: r.crates }); syncCargo(); } toast(r.msg); return r;
  });
}
function unloadCrates() {
  return AG.run('unload', () => {
    const b = blocked(); if (b) return res(false, b); if (!nearStill() && !atFarm()) return res(false, 'Unload crates at the still.');
    const r = K.unload(S); if (r.ok) { save(); emit('unload', { n: r.n }); syncCargo(); } toast(r.msg); return r;
  });
}
function sell(id, n) {
  return AG.run('sell:' + id, () => {
    if (inPit()) return res(false, 'No still business in the Rust Pit.');
    if (!atPost()) return res(false, 'The Xen-7 aliens buy bottles at the trading post.');
    const k = n == null ? (S.carried[id] | 0) : n;
    const r = K.sell(S, id, k); if (r.ok) { earnCr(r.cr); save(); emit('sell', { id, n: r.n, cr: r.cr, to: 'xen7' }); syncCargo(); } toast(r.msg); return r;
  });
}
// BUSTED: only the crates in your rover go. The consequences module (#56) owns any fine; we add none.
let lastBusted = null;
function onBust() {
  const P = game()?.progress?.stats; if (P && fin(P.busted)) lastBusted = P.busted;
  const r = K.confiscate(S); if (!r.n) return null; save(); syncCargo();
  const msg = K.seizeText(r); emit('seized', { n: r.n, crates: r.crates }); lastSeize = msg;
  setTimeout(() => toast(msg, 4200), 2600); return r;
}
let lastSeize = '';

// ---------- SSX.liquor (Jeff's bar, #93): the bottles you carry ----------
const liquor = {
  inventory: () => K.inventory(S),
  take(id, n = 1) { if (inPit()) return 0; const k = K.take(S, id, n); if (k) { save(); emit('take', { id, n: k }); syncCargo(); } return k; },
  alienPrice: id => K.alienPrice(id),
  add(id, n = 1) { const k = K.add(S, id, n); if (k) { save(); emit('add', { id, n: k }); syncCargo(); } return k; },
  sell: (id, n) => sell(id, n)
};

// ---------- the still + the crates in your rover ----------
let scene = null, still = null, cargo = null, glow = null;
function mat(c, o = {}) { return new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.7, metalness: o.m ?? 0.1, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 0 }); }
function buildStill() {
  const g = new THREE.Group(); g.name = 'still';
  const copper = mat(0xb4643a, { r: 0.35, m: 0.8 }), wood = mat(0x6b4a2b), iron = mat(0x3a3a3a, { m: 0.6 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 1.2, 18), copper); pot.position.y = 0.95; g.add(pot);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.7, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), copper); cap.position.y = 1.55; g.add(cap);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.6, 10), copper); neck.position.y = 2.4; g.add(neck);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.3, 8), copper); arm.rotation.z = Math.PI / 2.6; arm.position.set(0.6, 2.45, 0); g.add(arm);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 18), copper); coil.rotation.x = Math.PI / 2; coil.position.set(1.25, 1.6, 0); g.add(coil);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 14), wood); barrel.position.set(1.25, 0.5, 0); g.add(barrel);
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.35, 1.7), iron); box.position.y = 0.18; g.add(box);
  glow = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.06), mat(0xff6a1a, { e: 0xff5a00, ei: 1.4 })); glow.position.set(0, 0.2, 0.86); g.add(glow);
  const crate = buildCrate(); crate.position.set(-1.1, 0.3, 0.4); crate.name = 'still-crate'; g.add(crate);
  return g;
}
let crateGeo = null, crateMat = null, capMat = null;
function buildCrate() {
  crateGeo ||= new THREE.BoxGeometry(0.8, 0.5, 0.56); crateMat ||= mat(0xa8763e, { e: 0x5a3414, ei: 0.55 }); capMat ||= mat(0xf0f0dc, { r: 0.3, e: 0x9a9a80, ei: 0.5 }); // a little self-light so a crate still reads at night
  const c = new THREE.Group(); c.add(new THREE.Mesh(crateGeo, crateMat));
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 6), capMat); b.position.set(-0.24 + i * 0.24, 0.32, 0); c.add(b); }
  return c;
}
function buildCargo() { const g = new THREE.Group(); g.name = 'still-cargo'; for (let i = 0; i < K.CARRY_CRATES; i++) { const c = buildCrate(); c.position.set((i % 2) * 0.86 - 0.43, 0.25 + Math.floor(i / 2) * 0.52, 0); c.visible = false; g.add(c); } g.visible = false; return g; }
// crates ride on the roof of the car you drive: its top from the rover mesh when we can read it, else a rover-ish 1.7 m
let roofOf = null, roofH = 1.7, roofT = 0;
function roofTop(tc, gy) { // the car you see can be a garage skin (the base rover group hides), so measure the visible wide meshes (roof, deck; not masts or lamps) on its spot
  const c = tc.car; let top = -Infinity; const b = new THREE.Box3();
  try { tc.scene.traverseVisible(o => { if (!o.isMesh || o === tc.player?.mesh) return; let p = o; while (p) { if (p === cargo || p === still) return; p = p.parent; } const e = o.matrixWorld.elements; if (!o.geometry || Math.hypot(e[12] - c.x, e[14] - c.z) > 4) return;
    b.setFromObject(o); if (b.isEmpty() || b.max.x - b.min.x > 8 || b.max.z - b.min.z > 8 || b.max.y - b.min.y > 5) return;
    const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2; if (Math.hypot(cx - c.x, cz - c.z) > 1.6 || b.min.y > gy + 4) return; if (Math.max(b.max.x - b.min.x, b.max.z - b.min.z) < 1.1) return; top = Math.max(top, b.max.y); }); } catch (e) { /* */ }
  return fin(top) && top - gy > 0.6 && top - gy < 4.5 ? top - gy - 0.05 : 1.7; }
function syncCargo() { if (!cargo) return; const n = K.crates(K.count(S.carried)); cargo.children.forEach((c, i) => { c.visible = i < n; }); }
function ground(x, z) { try { const h = FARM()?.debug?.ground?.(x, z); if (fin(h)) return h; } catch (e) { /* */ } return 0; }

// ---------- UI: one context button, one caption, a small sheet ----------
const css = `
#stillAct{position:fixed;z-index:15;left:calc(14px + env(safe-area-inset-left));bottom:calc(374px + env(safe-area-inset-bottom));display:none;min-height:52px;min-width:120px;padding:6px 16px;border-radius:14px;border:3px solid #fff;background:#000;color:#fff;font:900 17px/1.1 system-ui,sans-serif;touch-action:manipulation}
#stillAct.on{display:block}
#stillCap{position:fixed;z-index:14;top:calc(122px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);display:none;width:max-content;max-width:min(460px,calc(100vw - 24px));padding:7px 14px;border-radius:14px;border:3px solid #fff;background:#000;color:#fff;font:800 16px/1.25 system-ui,sans-serif;pointer-events:none}
#stillCap.on{display:block}#stillCap small{display:block;font-weight:700;font-size:13px}
#stillPanel{position:fixed;inset:0;z-index:58;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55)}
#stillPanel.show{display:flex}#stillPanel .wrap{width:min(480px,calc(100vw - 20px));max-height:calc(100vh - 40px);overflow:auto;background:#000;color:#fff;border:3px solid #fff;border-radius:16px;padding:14px 14px 10px;font:600 15px/1.35 system-ui,sans-serif}
#stillPanel h2{margin:0 0 4px;font:900 21px/1.2 system-ui,sans-serif}#stillPanel p{margin:6px 0}#stillPanel .sub{color:#ddd;font-size:13px}
#stillPanel button{display:block;width:100%;min-height:48px;margin:8px 0 0;padding:8px 12px;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:800 15px/1.2 system-ui,sans-serif;text-align:left;touch-action:manipulation}
#stillPanel button.pri{border-width:3px}#stillPanel button:disabled{opacity:1;color:#c8c8c8;border-style:dashed;border-color:#8a8a8a}#stillPanel button small{display:block;font-weight:600;font-size:12px;opacity:.85}
#stillPanel .msg{min-height:18px;margin-top:8px;color:#ffd400;font-weight:800}
body.stillCapOn #farmGuide{display:none!important}
`;
let actBtn = null, capEl = null, panel = null, pBody = null, pMsg = null, pMode = 'still', actKey = '', capKey = '';
function tap(el, fn) { let last = 0; const g = e => { const n = performance.now(); if (e?.type === 'click' && n - last < 700) return; if (e?.type === 'pointerup') last = n; fn(e); }; (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, g); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function ui() {
  if (actBtn) return; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  actBtn = document.createElement('button'); actBtn.id = 'stillAct'; actBtn.type = 'button'; actBtn.textContent = '🥃 Still'; actBtn.setAttribute('aria-label', 'Open the moonshine still'); document.body.appendChild(actBtn);
  tap(actBtn, () => open('still'));
  capEl = document.createElement('div'); capEl.id = 'stillCap'; capEl.setAttribute('role', 'status'); document.body.appendChild(capEl);
  panel = document.createElement('div'); panel.id = 'stillPanel'; panel.innerHTML = '<div class="wrap" role="dialog" aria-label="Moonshine still"><div id="stillBody"></div><div class="msg" id="stillMsg" aria-live="polite"></div></div>'; document.body.appendChild(panel);
  pBody = panel.querySelector('#stillBody'); pMsg = panel.querySelector('#stillMsg');
  panel.addEventListener('pointerup', e => { if (e.target === panel) close(); });
  // one row in the farm sheet (farm mode) and one in the trading post's 👽 Trade sheet (post mode)
  (window.SSX.farmRows ||= []).push({ id: 'still', row: farmRow, tap: () => open(lastRowMode) });
}
let lastRowMode = 'still';
function farmRow(ctx) {
  if (ctx.mode === 'post') { const n = K.count(S.carried); if (!n) return null; lastRowMode = 'post'; return { label: `🥃 Sell moonshine · ${n} bottle${n === 1 ? '' : 's'} in your rover`, sub: 'The aliens pay about 1.75x the raw crop.', pri: true }; }
  if (ctx.mode !== 'farm' || !ctx.owned) return null; lastRowMode = 'still';
  if (!S.owned) return { label: `🥃 Moonshine still · ${K.PRICE.toLocaleString('en-US')} cr or ⭐`, sub: 'Turns silo crops into bottles worth more.' };
  return { label: '🥃 Still', sub: stillLine() };
}
function stillLine() {
  const h = hoursNow(), b = S.batch, home = K.count(S.home), car = K.count(S.carried);
  const parts = [b ? `Brewing ${b.n} ${K.RECIPES[b.crop].name}, ready in ${Math.ceil(K.hoursLeft(S, h))} h` : 'Idle'];
  if (home) parts.push(`${home} bottle${home === 1 ? '' : 's'} ready`); if (car) parts.push(`${K.crates(car)} crate${K.crates(car) === 1 ? '' : 's'} in your rover`);
  return parts.join(' · ');
}
function btn(a, label, sub, o = {}) { return `<button type="button" data-a="${a}"${o.c ? ` data-c="${o.c}"` : ''} class="${o.pri ? 'pri' : ''}" ${o.dis ? 'disabled' : ''}>${label}${sub ? `<small>${sub}</small>` : ''}</button>`; }
const stockWords = m => K.BOTTLE_IDS.filter(id => m[id] > 0).map(id => `${K.BOTTLES[id].icon} ${m[id]} ${K.BOTTLES[id].name}`).join(', ');
let pGen = 0;
function render() {
  if (!pBody) return; const b = blocked(), cr = credits(), stars = starBal(), h = hoursNow();
  let x = '';
  if (pMode === 'post') {
    x += `<h2>👽 Sell moonshine</h2><p class="sub">💰 ${cr} cr · the Xen-7 aliens pay per bottle${window.__bar ? '. The Velvet Airlock bar pays more.' : '.'}</p>`;
    const inv = K.inventory(S), here = atPost();
    if (!inv.length) x += '<p>No bottles in your rover. Load crates at the still.</p>';
    for (const it of inv) x += btn('sell', `${K.BOTTLES[it.id].icon} Sell ${it.n} ${esc(it.name)} · ${K.alienPrice(it.id)} cr each`, `${K.alienPrice(it.id) * it.n} cr in all`, { c: it.id, pri: true, dis: !!b || !here });
    if (!here) x += '<p class="sub">Drive to the Xen-7 Trading Post to sell.</p>';
  } else {
    x += `<h2>🥃 Moonshine still</h2><p class="sub">💰 ${cr} cr · ⭐ ${stars}${b ? ' · ' + esc(b) : ''}</p>`;
    if (!S.owned) {
      x += `<p>A copper still by the dome. It turns silo crops into bottles the aliens pay about 1.75x the raw crop for.</p>`;
      const where = !farmOwned() ? 'Buy the Dustbowl Homestead first.' : !atFarm() ? 'Go to the Dustbowl Homestead to buy it.' : '';
      x += btn('buy', `🥃 Buy the still · ${K.PRICE.toLocaleString('en-US')} cr`, where || 'Charged once.', { c: 'cr', pri: true, dis: !!b || !!where || cr < K.PRICE });
      x += btn('buy', `⭐ Buy the still · ${K.PRICE_STARS.toLocaleString('en-US')} ⭐`, where || (stars < K.PRICE_STARS ? `You have ${stars} ⭐.` : 'Charged once.'), { c: 'stars', dis: !!b || !!where || stars < K.PRICE_STARS || !STARS()?.spend });
    } else {
      const bt = S.batch;
      x += bt ? `<p>🔥 Brewing ${bt.n} ${esc(K.RECIPES[bt.crop].name)}. Ready in ${Math.ceil(K.hoursLeft(S, h))} h (${Math.round(K.progress(S, h) * 100)}%).</p>` : '<p>The still is idle. Pick a crop from the silo.</p>';
      if (!bt) for (const c of K.CROP_IDS) { const have = siloHas(c); if (!have) continue; const R = K.RECIPES[c], n = Math.min(have, K.BATCH_MAX);
        x += btn('brew', `${R.icon} Brew ${n} ${esc(CROPS[c].name)} → ${esc(R.name)}`, `${R.hours} h · ${K.alienPrice(R.id)} cr a bottle (raw: ${CROPS[c].price} cr)`, { c, dis: !!b }); }
      if (!bt && !K.CROP_IDS.some(c => siloHas(c))) x += '<p class="sub">The silo is empty. Harvest a rack first.</p>';
      const home = K.count(S.home), car = K.count(S.carried);
      x += `<p>🏚️ At the still: ${home ? esc(stockWords(S.home)) : 'no bottles'}.</p>`;
      x += `<p>📦 In your rover: ${car ? `${K.crates(car)} crate${K.crates(car) === 1 ? '' : 's'} (${esc(stockWords(S.carried))})` : 'no crates'}. Room for ${K.CARRY_CRATES} crates of ${K.CRATE}.</p>`;
      if (home) x += btn('load', '📦 Load crates into your rover', `Up to ${K.CARRY_CRATES} crates. If ColSec busts you, they take these.`, { pri: true, dis: !!b || !K.carryRoom(S) });
      if (car) x += btn('unload', '📦 Unload crates here', 'Bottles at the still are safe from ColSec.', { dis: !!b });
      x += '<p class="sub">Sell at the Xen-7 Trading Post (👽 Trade).</p>';
    }
  }
  x += btn('close', 'Close', '');
  const gen = ++pGen; pBody.innerHTML = x;
  pBody.querySelectorAll('button[data-a]').forEach(el => tap(el, () => { if (el.disabled || gen !== pGen || !el.isConnected || performance.now() - openedAt < OPEN_GUARD_MS) return; act(el.dataset); }));
}
function act(d) {
  const a = d.a; if (a === 'close') return close(); let r = null;
  if (a === 'buy') r = buy(d.c); else if (a === 'brew') r = brew(d.c); else if (a === 'load') r = loadCrates(); else if (a === 'unload') r = unloadCrates(); else if (a === 'sell') r = sell(d.c);
  if (panel.classList.contains('show')) { const m = pMsg.textContent; if (!r?.dup) openedAt = performance.now(); render(); pMsg.textContent = r?.dup ? m : (r?.msg || ''); } // a 2nd tap can't land on the button that slid in
}
// the click that opened the sheet (a mouse click after the pointerup, a late touch click), or a 2nd tap after a re-render,
// must not land on a button that is under it now
const OPEN_GUARD_MS = 400; let openedAt = -1e9;
function open(mode = 'still') { if (!panel) return; openedAt = performance.now(); pMode = mode === 'post' ? 'post' : 'still'; pMsg.textContent = ''; render(); panel.classList.add('show'); try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ } emit('open', { mode: pMode }); }
function close() { panel?.classList.remove('show'); }
// one caption at a time: ours only shows while you drive with crates aboard, and steps aside for any other caption or sheet
function otherUp() { return !!document.querySelector('#farmPanel.show, #hvPanel.show, #stillPanel.show, #hvCap.on, #dlrSheet, #cqScreen.on'); }
function refreshUi(force) {
  if (!actBtn) return; const onMars = !!place('farm'), pit = inPit();
  const showAct = onMars && !pit && nearStill() && farmOwned() && !otherUp();
  if (force || actBtn.classList.contains('on') !== showAct) actBtn.classList.toggle('on', showAct);
  const car = K.count(S.carried); let cap = '';
  if (onMars && !pit && tcLast?.car && car) cap = `📦 ${K.crates(car)} crate${K.crates(car) === 1 ? '' : 's'} of moonshine in your rover (${car} bottles).<small>Sell at the Xen-7 Trading Post${window.__bar ? ' or the Velvet Airlock bar' : ''}.</small>`;
  if (otherUp()) cap = '';
  if (force || cap !== capKey) { capKey = cap; capEl.innerHTML = cap; capEl.classList.toggle('on', !!cap); document.body.classList.toggle('stillCapOn', !!cap); }
}

// ---------- per frame ----------
let uiT = 0;
function tick(dt, tc) {
  tcLast = tc; if (!fin(dt)) return;
  const sw = stillW();
  if (!sw) { if (still) still.visible = false; if (cargo) cargo.visible = false; if ((uiT -= dt) <= 0) { uiT = 0.25; refreshUi(); } return; }
  if (scene !== tc.scene && tc.scene) { scene = tc.scene; still = buildStill(); cargo = buildCargo(); scene.add(still, cargo); syncCargo(); }
  if (still) { still.visible = S.owned; if (S.owned) { still.position.set(sw.x, ground(sw.x, sw.z) - 0.05, sw.z); if (glow) glow.material.emissiveIntensity = S.batch ? 1.2 + Math.sin(performance.now() / 180) * 0.4 : 0.1; } }
  const c = tc.car, n = K.count(S.carried);
  if (cargo) { cargo.visible = !!c && n > 0 && fin(c.x);
    if (cargo.visible) { const yaw = c.yaw || 0, gy = ground(c.x, c.z); if (roofOf !== c || (roofT -= dt) <= 0) { roofOf = c; roofT = 1.5; roofH = roofTop(tc, gy); }
      cargo.position.set(c.x - Math.sin(yaw) * 0.5, gy + roofH, c.z - Math.cos(yaw) * 0.5); cargo.rotation.y = yaw; } }
  if ((uiT -= dt) <= 0) {
    uiT = 0.25;
    const done = K.step(S, hoursNow()); if (done) { save(); emit('ready', done); toast(`🫙 ${done.n} ${K.nameOf(done.id)} ready at the still.`, 3200); if (panel?.classList.contains('show')) render(); }
    const P = game()?.progress?.stats; if (P && fin(P.busted)) { if (lastBusted !== null && P.busted > lastBusted) onBust(); lastBusted = P.busted; } // fallback when game:down isn't on the bus
    refreshUi();
  }
}

// ---------- API ----------
function status() {
  const h = hoursNow();
  return { owned: S.owned, paidWith: S.paidWith, batch: S.batch ? { ...S.batch, left: K.hoursLeft(S, h), progress: K.progress(S, h) } : null, home: { ...S.home }, carried: { ...S.carried },
    crates: K.crates(K.count(S.carried)), hours: h, stats: { ...S.stats }, at: { still: nearStill(), farm: atFarm(), post: atPost() }, pit: inPit(), spot: stillW(), restored: restoredFrom, saveErr,
    ui: { act: actBtn?.classList.contains('on') ? actBtn.textContent : '', caption: capEl?.classList.contains('on') ? capEl.textContent : '', panel: !!panel?.classList.contains('show') }, lastSeize };
}
const api = {
  status, buy, brew, load: loadCrates, unload: unloadCrates, sell, open, close, liquor,
  on: f => { if (typeof f !== 'function') return () => {}; subs.add(f); return () => subs.delete(f); },
  PRICES: { still: K.PRICE, stillStars: K.PRICE_STARS, starRate: K.STAR_RATE, bottles: Object.fromEntries(K.BOTTLE_IDS.map(id => [id, K.alienPrice(id)])) },
  rules: { CRATE: K.CRATE, CARRY_CRATES: K.CARRY_CRATES, BATCH_MAX: K.BATCH_MAX, RECIPES: K.RECIPES },
  debug: {
    reset() { AG.reset(); S = K.fresh(); try { localStorage.removeItem(K.SAVE_KEY); localStorage.removeItem(K.BAK_KEY); } catch (e) { /* */ } restoredFrom = null; lastSeize = ''; syncCargo(); return status(); },
    reload() { load(); syncCargo(); return status(); }, state: () => JSON.parse(JSON.stringify(S)), bust: () => onBust(), ag: () => AG.reset(), roof: () => roofH,
    goto() { const s = surf(), p = stillW(); if (!s || !p) return false; s.debugMove(p.x + 1.6, p.z + 1.6, 0); return p; }
  }
};
(function boot() {
  if (!window.SSX?.registerSurfaceTick || !window.__app || !window.SSX.registerMenuItem) { setTimeout(boot, 200); return; }
  if (window.SSX.still) return; window.SSX.still = api; window.SSX.liquor ||= liquor; ui();
  try { window.SSX.on?.('game:down', d => { if (/bust/i.test(d?.why || '')) { try { onBust(); } catch (e) { console.warn('still bust', e); } } }); } catch (e) { /* no bus: the tick's busted counter covers it */ }
  try { window.SSX.registerSurfaceTick(tick); } catch (e) { console.warn('still tick', e); }
})();
