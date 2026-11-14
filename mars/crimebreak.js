// Crime break at Red Static Gulch (v7.5.76): ☰ → 👥 Crime break (anywhere) + a proximity card at the gulch.
// Sit-down: pays ⭐ via game.reward, stacks a permanent crew-payoff buff (SSX.crimebreak.payBonus).
// Free intro once, then 500 cr + 1-sol cooldown. Separate fixed exchange: 100 cr → 10 lifetime ⭐, no cooldown, no crew.
// Market (credit Buy 1 / Buy 5 and one star each) only while you are standing at the gulch. Rules: crimebreakcore.js.
// Panel id is #cbGulch. #cbPanel belongs to mars/contraband.js (Blue’s sheet) and is not reused here.
// Fiction only. Black buttons, white text, 48px+, panelTap / tap. Never touches swag files.
import * as THREE from 'three';
import * as C from './crimebreakcore.js';
import { ROSTER } from '../crewcore.js';
import { panelTap, tap } from '../racehooks.js';

const W = () => (typeof window !== 'undefined' ? window : null), SSX = () => W()?.SSX, APP = () => W()?.__app;
const game = () => APP()?.surface?.game || APP()?.game;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const S = { ui: null, root: null, figs: {}, colKey: '', near: false, line: 0, meeting: false, note: '', tab: 'meet' };
let holdUntil = 0; // swallow the click that lands on a button the opening finger just uncovered
let D = C.fresh();
const guard = C.makeGuard();      // sit-down begin / finish
const shopGuard = C.makeGuard();  // exchange + market taps (separate, so a meeting does not eat a purchase)

function load() { try { D = C.load(localStorage.getItem(C.KEY)); } catch (e) { D = C.fresh(); } }
function save() { try { localStorage.setItem(C.KEY, JSON.stringify(D)); } catch (e) { /* private mode */ } }
const toast = (t, ms = 3000) => { try { APP()?.toast?.(t, ms); } catch (e) { /* */ } };
const credits = () => game()?.progress?.credits | 0;
const crewHired = () => { try { return SSX()?.crew?.state?.()?.crew?.length | 0; } catch (e) { return 0; } };
const crewIds = () => { try { return (SSX()?.crew?.state?.()?.crew || []).map(m => m.id); } catch (e) { return []; } };
const atGulch = () => { try { return !!SSX()?.copFree?.here?.(); } catch (e) { return false; } };
const EXPLAIN = '100 cr buys 10 lifetime ⭐. They add to your lifetime stars and can be spent in the Star Shop (lifetime minus stars you already spent). Rank is not lowered or reset.';
// one in-game sol = one farm/game day (24 game hours). Prefer farm2, then farm, then SSX.time elapsed.
function solNow() {
  try { const h = SSX()?.farm2?.status?.()?.hours; if (Number.isFinite(h)) return Math.floor(h / 24); } catch (e) { /* */ }
  try { const c = SSX()?.farm?.clock?.(); if (Number.isFinite(c?.day)) return c.day | 0; if (Number.isFinite(c?.hours)) return Math.floor(c.hours / 24); } catch (e) { /* */ }
  try { const t = SSX()?.time; const h = t?.hours?.() ?? t?.hour?.(); if (Number.isFinite(h) && Number.isFinite(t?.days)) return t.days | 0; } catch (e) { /* */ }
  return Math.floor(performance.now() / 1440000);
}
function gate() { return C.canStart(D, { crew: crewHired(), atGulch: atGulch(), credits: credits(), sol: solNow() }); }
function show(r) {
  if (!r || r.dup) return r;
  S.note = r.ok ? (r.msg || 'Done.') : ('❌ ' + (r.why || r.msg || 'Couldn’t do that.'));
  render(); toast(S.note, r.ok ? 3200 : 3600); return r;
}

// ---------- panel ----------
const CSS = `#cbGulch{position:fixed;inset:0;z-index:80;display:none;align-items:flex-end;justify-content:center;background:transparent;pointer-events:none}
#cbGulch.on{display:flex}
#cbGulch .wrap{position:relative;pointer-events:auto;width:min(96vw,440px);max-height:min(62vh,calc(100vh - 180px - env(safe-area-inset-bottom)));margin:0 8px calc(150px + env(safe-area-inset-bottom));background:#000;color:#fff;border:2px solid #fff;border-radius:16px;padding:0;font:14px/1.35 system-ui,sans-serif;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden}
#cbGulch .x{position:absolute;top:6px;right:6px;z-index:3;width:44px;height:44px;min-width:44px;min-height:44px;flex:none;padding:0;line-height:40px}
#cbGulch .sheet{flex:1 1 auto;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;padding:12px 12px 8px}
#cbGulch .foot{flex:none;display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px 12px;background:#000;border-top:2px solid #fff}
#cbGulch .foot:empty{display:none}
#cbGulch h2{margin:2px 0 6px;font-size:17px}#cbGulch q{display:block;font-style:italic;opacity:.9;margin:8px 0}
#cbGulch .who{font-weight:800;opacity:.75;font-size:12px;letter-spacing:.04em;text-transform:uppercase}
#cbGulch .note{margin:6px 0;padding:8px 10px;border:2px solid #fff;border-radius:10px;font-weight:700}
#cbGulch .sub{margin:4px 0;font-size:13px}
#cbGulch .sum,#cbGulch .wallet{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}#cbGulch .sum b,#cbGulch .wallet b{padding:4px 8px;border-radius:8px;border:1px solid #555;font-size:12px}
#cbGulch .tabs,#cbGulch .acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
#cbGulch button{min-height:48px;min-width:64px;flex:1 1 120px;padding:8px 10px;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:800 14px/1.15 system-ui,sans-serif;touch-action:manipulation}
#cbGulch button:disabled{opacity:.45}#cbGulch button.on{border-width:3px}
#cbGulch .row{padding:8px 0;border-top:1px solid #444}#cbGulch .row b{font-size:15px}#cbGulch .row small{display:block;font-size:12px;margin-top:2px}
#cbAct{display:none;background:#000!important;color:#fff!important;border:3px solid #fff!important;min-height:52px;padding:6px 14px;border-radius:14px;font:900 16px/1.15 system-ui,sans-serif}
@media (max-height:450px){#cbGulch .wrap{max-height:calc(100dvh - 108px - env(safe-area-inset-bottom));margin-bottom:calc(100px + env(safe-area-inset-bottom))}}`;
function ensureUi() {
  if (S.ui || typeof document === 'undefined') return S.ui;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const panel = document.createElement('div'); panel.id = 'cbGulch'; panel.innerHTML = '<div class="wrap"><button type="button" class="x" data-a="close" aria-label="Close">✕</button><div class="sheet"></div><div class="foot"></div></div>'; document.body.appendChild(panel);
  panelTap(panel, e => { const b = e.target?.closest?.('button'); if (b && !b.disabled) act(b.dataset); });
  const wrap = panel.querySelector('.wrap');
  // v7.5.80 put the ✕ first inside .wrap. firstChild is that button, so painting
  // the sheet into it crammed the title and tabs into a narrow column.
  S.ui = { panel, wrap, sheet: wrap.querySelector('.sheet'), foot: wrap.querySelector('.foot') }; return S.ui;
}
const panelOn = () => !!S.ui?.panel.classList.contains('on');
let gulchRAF = 0;
function aimGulch() {
  const i = APP()?.surface?.info;
  if (!panelOn() || !i?.colony || atGulch()) { SSX()?.guide?.clear?.('crimebreak'); return; }
  SSX()?.guide?.aimGround?.({ id: 'crimebreak', x: i.colony.x + 150, z: i.colony.z + 330, label: 'Gulch' });
}
function trackGulch() { aimGulch(); if (panelOn()) gulchRAF = requestAnimationFrame(trackGulch); }
function open(force = false) {
  void force; // menu passes nothing; tests still call open(true). The sheet always opens: exchange needs only a ready game.
  if (!ensureUi()) return false;
  S.meeting = false; S.line = 0; S.note = ''; if (!S.tab) S.tab = 'meet';
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ }
  S.ui.panel.classList.add('on'); render(); trackGulch(); return true;
}
function close() { S.ui?.panel.classList.remove('on'); S.meeting = false; S.line = 0; S.note = ''; clearFigs(true); if (gulchRAF) cancelAnimationFrame(gulchRAF); SSX()?.guide?.clear?.('crimebreak'); return true; }
function act(ds) {
  // tabs can switch immediately; purchase / exchange / sit-down wait out the click that opened the sheet
  if (performance.now() < holdUntil && ds?.a !== 'tab') return;
  const a = ds?.a; if (a === 'close') return close();
  if (a === 'tab') {
    if (S.meeting) { S.meeting = false; S.line = 0; clearFigs(false); }
    S.tab = ds.t === 'ex' || ds.t === 'mkt' ? ds.t : 'meet'; render(); return;
  }
  if (a === 'crew') { close(); try { SSX()?.crew?.open?.(); } catch (e) { /* */ } return; }
  if (a === 'start') return begin();
  if (a === 'next') return nextLine();
  if (a === 'done') return finish();
  if (a === 'exchange') return doExchange();
  if (a === 'mbuy') return marketBuy(ds.i, +ds.q);
  if (a === 'mstar') return marketStar(ds.i);
}
function begin() {
  return guard.run('begin', () => {
    const g = gate(); if (!g.ok) { S.note = '❌ ' + g.why; render(); return g; }
    S.meeting = true; S.line = 0; S.note = ''; gather(); render(); return { ok: true };
  });
}
function nextLine() {
  if (!S.meeting) return;
  if (S.line + 1 < speak().length) { S.line++; render(); return; }
  finish();
}
function speak() {
  const ids = new Set(crewIds());
  const lines = C.LINES.filter(l => {
    const id = ROSTER.find(r => r.name.startsWith(l.who) || r.name.includes(l.who))?.id;
    return !id || ids.has(id);
  });
  return lines.length ? lines : C.LINES.slice(0, 1);
}
function finish() {
  return guard.run('finish:' + D.meets, () => {
    if (!S.meeting) return { ok: false, dup: true };
    const sol = solNow();
    const r = C.complete(D, {
      sol, credits: credits(),
      pay: n => { const g = game(); if (!g?.spend?.(n)) return { ok: false, msg: `Need ${n} cr.` }; return { ok: true }; }
    });
    if (!r.ok) { S.note = '❌ ' + (r.why || 'Couldn\'t finish.'); S.meeting = false; render(); return r; }
    save();
    try { if (r.stars > 0) game()?.reward?.(r.stars, 0); } catch (e) { /* */ }
    S.meeting = false; S.note = r.msg; render();
    toast(r.msg, 3800);
    setTimeout(() => { try { clearFigs(false); } catch (e) { /* */ } }, 1800);
    return r;
  });
}
// 100 cr → 10 lifetime ⭐. spend(100) once, then reward(10, 0). A failed grant puts the 100 cr back and does not touch xp.
function doExchange() {
  return shopGuard.run('exchange', () => {
    const g = game();
    if (!g || typeof g.spend !== 'function' || typeof g.reward !== 'function') return show({ ok: false, why: 'Game isn’t ready.' });
    const r = C.exchange(D, {
      credits: credits(),
      pay(n) {
        if (n !== 100) return { ok: false, msg: 'Bad exchange rate.' };
        const have = Number(g.progress?.credits);
        if (!(have >= 100)) return { ok: false, msg: `Need 100 cr. You have ${Math.max(0, have | 0)} cr.` };
        if (!g.spend(100)) return { ok: false, msg: `Need 100 cr. You have ${Math.max(0, g.progress?.credits | 0)} cr.` };
        return { ok: true, refund() { g.progress.credits = (Number(g.progress.credits) || 0) + 100; try { g.save(); } catch (e) { /* */ } } };
      },
      grant() { g.reward(10, 0); return { ok: true }; }
    });
    if (r?.ok) save();
    return show(r);
  });
}
function marketView() {
  const CB = SSX()?.contraband, shop = SSX()?.starshop;
  let blocked = null; try { blocked = shop?.blocked?.() || null; } catch (e) { blocked = 'Star Shop isn’t available.'; }
  let balance = 0; try { balance = SSX()?.stars?.balance?.() || 0; } catch (e) { /* */ }
  let prices = {}; try { prices = shop?.prices?.() || {}; } catch (e) { prices = {}; }
  let items = []; try { items = CB?.items?.() || []; } catch (e) { items = []; }
  let stash = { items: {} }; try { stash = CB?.stash?.() || stash; } catch (e) { /* */ }
  let cap = { used: 0, max: 0 }; try { cap = CB?.capacity?.() || cap; } catch (e) { /* */ }
  return C.present(items, prices, { atGulch: atGulch(), credits: credits(), balance, blocked, stash, cap });
}
function marketBuy(id, qty) {
  return shopGuard.run('cr:' + id + ':' + qty, () => {
    const gateM = C.marketGate(atGulch()); if (!gateM.ok) return show(gateM);
    const CB = SSX()?.contraband;
    if (!CB?.buy || !CB?.items) return show({ ok: false, why: 'Stash isn’t loaded.' });
    const item = (CB.items() || []).find(i => i.id === id);
    const cap = CB.capacity?.() || { used: 0, max: 0 };
    const held = CB.stash?.().items?.[id]?.qty || 0;
    const q = C.marketQuote(item, qty, { credits: credits(), held, used: cap.used, carry: cap.max });
    if (!q.ok) return show(q);
    const r = CB.buy(id, qty);
    if (!r?.ok) return show({ ok: false, why: r?.msg || 'Couldn’t buy.', ...r });
    return show({ ok: true, ...r, msg: r.msg || `Bought ${r.qty}.` });
  });
}
function marketStar(id) {
  return shopGuard.run('star:' + id, () => {
    const gateM = C.marketGate(atGulch()); if (!gateM.ok) return show(gateM);
    const shop = SSX()?.starshop, CB = SSX()?.contraband;
    if (!shop?.buy || !shop?.prices) return show({ ok: false, why: 'Star Shop isn’t loaded.' });
    let blocked = null; try { blocked = shop.blocked?.() || null; } catch (e) { blocked = 'Star Shop isn’t available.'; }
    if (blocked) return show({ ok: false, why: blocked });
    const price = shop.prices()?.[id];
    const item = (CB?.items?.() || []).find(i => i.id === id);
    const cap = CB?.capacity?.() || { used: 0, max: 0 };
    const held = CB?.stash?.().items?.[id]?.qty || 0;
    let balance = 0; try { balance = SSX()?.stars?.balance?.() || 0; } catch (e) { /* */ }
    const q = C.starQuote(item, price, { balance, held, used: cap.used, carry: cap.max, blocked });
    if (!q.ok) return show(q);
    const r = shop.buy(id);
    if (r?.dup) return r;
    if (!r?.ok) return show({ ok: false, why: r?.msg || 'Couldn’t buy with stars.' });
    return show(r);
  });
}
function walletLine() {
  const cr = credits(), xp = game()?.progress?.xp, life = Number.isFinite(+xp) ? Math.max(0, Math.floor(+xp)) : 0;
  let spent = null, bal = null;
  try { spent = SSX()?.stars?.spent?.(); bal = SSX()?.stars?.balance?.(); } catch (e) { /* */ }
  const bits = [`<b>💰 ${cr} cr</b>`, `<b>⭐ ${life} lifetime</b>`];
  if (bal != null) bits.push(`<b>${bal} to spend</b>`);
  if (spent != null) bits.push(`<b>${spent} spent</b>`);
  bits.push(`<b>Exchanges ${D.bought | 0}</b>`);
  return `<div class="wallet">${bits.join('')}</div>`;
}
function tabs() {
  const t = S.tab || 'meet';
  const b = (id, label) => `<button type="button" data-a="tab" data-t="${id}" class="${t === id ? 'on' : ''}" aria-pressed="${t === id ? 'true' : 'false'}">${label}</button>`;
  return `<div class="tabs">${b('meet', 'Sit-down')}${b('ex', 'Exchange')}${b('mkt', 'Market')}</div>`;
}
function exchangeBtns(extra = '') {
  return `<button type="button" data-a="exchange">100 cr → 10 ⭐</button>${extra}<button type="button" data-a="close">Close</button>`;
}
function marketHtml(view) {
  if (!view.ok) return `<h2>Market</h2><p>${esc(view.why || 'Market is at Red Static Gulch.')}</p><p class="sub">Walk to Red Static Gulch to buy. The exchange still works from this menu.</p>`;
  let html = `<h2>Market</h2><p class="sub">Red Static Gulch. Same stash as Blue. Full price before you buy. Carrying ${view.used}/${view.carry || 0}.</p>`;
  if (!view.rows.length) return html + '<p>Stash isn’t loaded.</p>';
  for (const row of view.rows) {
    const fresh = row.fresh != null ? ` · ${Math.round(Number(row.fresh) * 100)}% fresh` : '';
    const starBit = row.starPrice != null ? ` · ⭐ ${row.starPrice} each` : '';
    const msgs = [];
    for (const b of row.buys) if (!b.ok && b.why) msgs.push(b.why);
    if (row.starPrice != null && !row.star.ok && row.star.why) msgs.push(row.star.why);
    html += `<div class="row" data-item="${esc(row.id)}"><b>${esc(row.icon)} ${esc(row.name)}</b> ×${row.held | 0} · ${row.held | 0}/${row.max}${fresh}<small>${esc(row.blurb)}</small><small>${row.supplier} cr each · 5 for ${row.supplier * 5} cr${starBit}</small>${msgs.length ? `<small>${esc(msgs[0])}</small>` : ''}<div class="acts">`;
    for (const b of row.buys) {
      html += `<button type="button" data-a="mbuy" data-i="${esc(row.id)}" data-q="${b.q}">Buy ${b.q} · ${row.supplier * b.q} cr</button>`;
    }
    if (row.starPrice != null) html += `<button type="button" data-a="mstar" data-i="${esc(row.id)}">⭐ ${row.starPrice}</button>`;
    html += '</div></div>';
  }
  return html;
}
function paint(body, foot) {
  if (!S.ui?.sheet) return;
  S.ui.sheet.innerHTML = body;
  S.ui.foot.innerHTML = foot || '';
  holdUntil = performance.now() + 320;
}
function render() {
  if (!S.ui) return;
  const g = gate();
  if (S.meeting) {
    const lines = speak(), L = lines[Math.min(S.line, lines.length - 1)];
    let body = '';
    if (S.note) body += `<div class="note">${esc(S.note)}</div>`;
    body += '<h2>👥 Crime break</h2>';
    let foot = '';
    if (L) {
      body += `<div class="who">${esc(L.who)}</div><q>${esc(L.text)}</q>`;
      const last = S.line >= lines.length - 1;
      foot = `<button type="button" data-a="${last ? 'done' : 'next'}">${last ? '💵 Seal it' : 'Next'}</button>`;
    }
    paint(body, foot); return;
  }
  let body = tabs();
  if (S.note) body += `<div class="note">${esc(S.note)}</div>`;
  body += '<h2>👥 Crime break</h2>' + walletLine();
  const tab = S.tab || 'meet';
  let foot = '';
  if (tab === 'ex') { body += `<h2>Exchange</h2><p class="sub">${esc(EXPLAIN)}</p>`; foot = exchangeBtns(); }
  else if (tab === 'mkt') { body += marketHtml(marketView()); foot = '<button type="button" data-a="close">Close</button>'; }
  else {
    const buff = C.buffPct(D), next = C.nextSol(D);
    body += `<div class="sum"><b>Meetings ${D.meets}</b><b>Crew pay +${buff}%</b>${next != null ? `<b>Next sol ${next}</b>` : '<b>Intro free</b>'}<b>⭐ ${C.STAR_PAY}</b></div>`;
    if (g.needCrew) {
      body += `<p>Nobody on your crew yet. Hire someone first, then come back to the gulch for the sit-down. The exchange does not need a crew.</p><p class="sub">${esc(EXPLAIN)}</p>`;
      foot = exchangeBtns('<button type="button" data-a="crew">👥 Open Crew</button>');
    } else if (!g.ok) {
      body += `<p>${esc(g.why || 'Not right now.')}</p><p class="sub">${esc(EXPLAIN)}</p>`;
      foot = exchangeBtns();
    } else {
      const cost = g.intro ? 'Free intro' : `${C.COST_CR} cr buy-in`;
      const ids = crewIds();
      body += `<p>Call your people to the gulch. Sit-down pays ${C.STAR_PAY} ⭐ and bumps crew job payoffs (+5%, cap +25%). ${esc(cost)}.</p>`;
      if (ids.length) body += `<p>Showing: ${esc(ids.map(id => ROSTER.find(r => r.id === id)?.name.split(' ')[0] || id).join(', '))}.</p>`;
      body += `<p class="sub">${esc(EXPLAIN)}</p>`;
      foot = `<button type="button" data-a="start">👥 Call them in</button><button type="button" data-a="exchange">100 cr → 10 ⭐</button><button type="button" data-a="close">Close</button>`;
    }
  }
  paint(body, foot);
}

// ---------- world: gather hired crew around the player at the gulch ----------
const MAT = {}; const mat = c => (MAT[c] ||= new THREE.MeshLambertMaterial({ color: c }));
let GEO = null;
function figure(r) {
  GEO ||= { legs: new THREE.BoxGeometry(0.42, 0.85, 0.24), torso: new THREE.BoxGeometry(0.56, 0.72, 0.3), head: new THREE.BoxGeometry(0.28, 0.3, 0.28), hat: new THREE.BoxGeometry(0.31, 0.12, 0.31) };
  const g = new THREE.Group(), L = r.look, add = (geo, m, y) => { const o = new THREE.Mesh(geo, mat(m)); o.position.y = y; g.add(o); return o; };
  add(GEO.legs, L.body, 0.43); add(GEO.torso, L.coat, 1.22); add(GEO.head, L.skin, 1.74); add(GEO.hat, L.hat, 1.93); g.name = 'crimebreak-' + r.id; return g;
}
function gather() {
  const tc = APP()?.surface; if (!tc?.scene || !/mars/i.test(tc.info?.name || '')) return;
  const c = SSX()?.city?.colony?.(); if (!c) return;
  const key = `${Math.round(c.x)}|${Math.round(c.z)}`;
  if (!S.root || S.colKey !== key) { S.root?.parent?.remove(S.root); S.root = new THREE.Group(); S.root.name = 'crimebreak-crew'; tc.scene.add(S.root); S.figs = {}; S.colKey = key; }
  const car = tc.car, pl = tc.player || tc.info;
  const px = Number.isFinite(car?.x) ? car.x : (Number.isFinite(pl?.x) ? pl.x : null);
  const pz = Number.isFinite(car?.z) ? car.z : (Number.isFinite(pl?.z) ? pl.z : null);
  if (!Number.isFinite(px) || !Number.isFinite(pz)) return;
  const ids = crewIds(); S.root.visible = true;
  ids.forEach((id, i) => {
    const r = ROSTER.find(q => q.id === id); if (!r) return;
    let f = S.figs[id]; if (!f) { f = S.figs[id] = figure(r); S.root.add(f); }
    const ang = (i / Math.max(1, ids.length)) * Math.PI * 2 + 0.4, rad = 2.2;
    const x = px + Math.cos(ang) * rad, z = pz + Math.sin(ang) * rad;
    let y = 0; try { y = tc.height?.(x, z) || 0; } catch (e) { /* */ }
    f.position.set(x, y, z); f.rotation.y = Math.atan2(px - x, pz - z); f.visible = true;
  });
  for (const [id, f] of Object.entries(S.figs)) if (!ids.includes(id)) f.visible = false;
}
function clearFigs(hide) {
  if (!S.root) return;
  if (hide) { S.root.visible = false; return; }
  for (const f of Object.values(S.figs)) f.visible = false;
  S.root.visible = false;
}
function setNear(on) {
  if (S.near === on) return; S.near = on;
  const sb = document.getElementById('surfBtns'); if (!sb) return;
  if (!S.btn) { S.btn = document.createElement('button'); S.btn.id = 'cbAct'; S.btn.className = 'glass'; sb.insertBefore(S.btn, sb.firstChild); tap(S.btn, () => open()); }
  S.btn.style.display = on ? 'block' : 'none'; if (on) S.btn.textContent = '👥 Crime break';
}
function worldTick() {
  if (!atGulch()) { setNear(false); if (!S.meeting) clearFigs(true); return; }
  setNear(!panelOn()); // prompt at the gulch even with no crew: the sheet explains the sit-down and still offers the exchange and market
  if (S.meeting) gather();
}

export const crimebreak = {
  version: 1, key: C.KEY, COST: C.COST_CR, STAR_PAY: C.STAR_PAY, BUFF_STEP: C.BUFF_STEP, BUFF_CAP: C.BUFF_CAP,
  EX_COST: C.EX_COST, EX_STARS: C.EX_STARS, HOUSE: C.HOUSE,
  open, close, get isOpen() { return panelOn(); }, get meeting() { return S.meeting; },
  state: () => JSON.parse(JSON.stringify(D)), payBonus: () => C.payBonus(D), buffPct: () => C.buffPct(D),
  sol: solNow, gate, start: begin, finish, save, reload() { load(); return true; },
  exchange: doExchange, exchange10: doExchange, marketBuy, marketStar, catalog: marketView,
  debug: {
    reset() { D = C.fresh(); save(); S.meeting = false; S.tab = 'meet'; S.note = ''; return true; },
    setSol(n) { try { const F = SSX()?.farm2; const cur = F?.status?.()?.hours || 0; const want = (+n || 0) * 24; if (F?.debug?.skip && want > cur) F.debug.skip(want - cur); } catch (e) { /* */ } return solNow(); },
    force(sol) { D.lastSol = sol - C.COOLDOWN_SOLS; save(); return true; },
    status() { return { bought: D.bought | 0, tab: S.tab, meeting: S.meeting, atGulch: atGulch(), note: S.note, credits: credits() }; }
  }
};

(function boot() {
  if (typeof window === 'undefined') return;
  if (!window.SSX?.registerSurfaceTick || !window.__app) { setTimeout(boot, 300); return; }
  if (window.SSX.crimebreak) return; load(); window.SSX.crimebreak = crimebreak;
  try { window.SSX.registerMenuItem({ id: 'rmCrimeBreak', label: '👥 Crime break', onTap: () => open() }); } catch (e) { console.warn('crimebreak menu', e); }
  window.SSX.registerSurfaceTick(() => { try { worldTick(); } catch (e) { /* */ } });
  addEventListener('pagehide', () => { try { save(); } catch (e) { /* */ } });
})();
