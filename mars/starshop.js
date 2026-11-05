/*
 * mars/starshop.js: ⭐ Star Shop (Marsmania, v7.6). Spend stars (the HUD ⭐, game.progress.xp) on Blue's contraband
 * instead of credits. Fictional space drugs only (Low-G, Glow-dust, Red Static, Void Honey from mars/contraband.js).
 * Rank is safe: progress.xp is never lowered. What you spend is kept in its own counter (localStorage 'ssx.stars.v1'),
 * and spendable stars = lifetime stars - spent. Rank keeps counting every star you ever earned.
 * Where: ☰ → ⭐ Star Shop (anywhere on Mars, Blue's runner drops it in your stash), and a "⭐ 250" button next to Buy 1 / Buy 5
 * at Blue's (The Blue Room, Red Tape Flats). Never in the Rust Pit. Taps and API calls are idempotent: a busy lock plus a
 * 300 ms per-item dedupe ({ ok:false, dup:true }), and buttons ignore taps for 250 ms after each redraw.
 * window.SSX.stars:    balance() lifetime() spent() canSpend(n) spend(n, reason) refund(n) on(fn) -> unsubscribe
 * window.SSX.starshop: prices() buy(item) open() close() status() blocked() debug.reset()
 * Guarded: needs window.__app.game and SSX.contraband for buying; everything else is feature-detected.
 */
import * as C from './starshopcore.js';

const app = () => window.__app, surf = () => app()?.surface, game = () => app()?.game || surf()?.game, world = () => surf()?.world;
const CB = () => window.SSX?.contraband;
const fin = v => Number.isFinite(v);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => Number(n || 0).toLocaleString('en-US');
const PIT_AJ = [-292, -68], PIT_R = 12;

// ---------- state ----------
let S = (() => { try { return C.migrate(JSON.parse(localStorage.getItem(C.SAVE_KEY))); } catch (e) { return C.fresh(); } })();
const save = () => { try { localStorage.setItem(C.SAVE_KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };
const subs = new Set();
function emit(type, d = {}) {
  const ev = { type, ...d, balance: balance() };
  for (const f of [...subs]) { try { f(ev); } catch (e) { console.warn('stars listener', e); } }
  try { window.dispatchEvent(new CustomEvent('ssx:stars', { detail: ev })); } catch (e) { /* */ }
}
const lifetime = () => { const x = Number(game()?.progress?.xp); return fin(x) ? Math.max(0, Math.floor(x)) : 0; };
function sync() { if (game()?.progress && C.reconcile(S, lifetime())) save(); }
function balance() { sync(); return C.balance(S, lifetime()); }
function spendRaw(n, reason) { sync(); const r = C.spend(S, lifetime(), n, reason); if (r.ok) { save(); emit('spend', { n: r.n, reason }); } return r; }
const guard = C.makeGuard();
const STARS = {
  balance, lifetime, spent: () => S.spent, canSpend: n => C.canSpend(S, lifetime(), n),
  spend: (n, reason = '') => guard.run('spend:' + reason + ':' + n, () => { if (!game()?.progress) return { ok: false, msg: 'Not in game.' }; return spendRaw(n, reason); }),
  refund: n => { C.refund(S, n); save(); emit('refund', { n }); render(); return balance(); },
  on: fn => { if (typeof fn !== 'function') return () => {}; subs.add(fn); return () => subs.delete(fn); }
};

// ---------- where you are ----------
const onMars = () => { const i = surf()?.info; return !!(app()?.state?.onSurface && i?.name === 'Mars' && i.colony); };
function inPit() {
  try { if (world()?.inDuel) return true; } catch (e) { /* */ }
  try { if (window.SSX?.fight?.debug?.inCage) return true; } catch (e) { /* */ }
  try { const i = surf()?.info, c = i?.colony; let at = PIT_AJ; const s = window.SSX?.fight?.status?.()?.at; if (Array.isArray(s)) at = s;
    if (i && c && fin(i.x) && Math.hypot(i.x - c.x - at[0], i.z - c.z - at[1]) < PIT_R) return true; } catch (e) { /* */ }
  return false;
}
function blocked() {
  if (!game()?.progress) return 'Not in game.';
  if (!CB()) return 'The stash isn\u2019t loaded.';
  if (!onMars()) return 'Star buys only work on Mars. Land on Mars first.';
  if (inPit()) return 'Not in the Rust Pit. Step out of the cage first.';
  return null;
}
const itemInfo = id => { try { return CB()?.items?.().find(x => x.id === id) || null; } catch (e) { return null; } };
function room(id) {
  try { const cb = CB(), I = itemInfo(id); if (!cb || !I) return 0; const cap = cb.capacity(), have = cb.stash().items[id]?.qty || 0;
    return Math.max(0, Math.min((I.max || 99) - have, cap.max - cap.used)); } catch (e) { return 0; }
}

// ---------- buying ----------
function buy(id) {
  return guard.run('buy:' + id, () => {
    const price = C.PRICES[id]; if (!price) return { ok: false, msg: 'Blue doesn\u2019t sell that for stars.' };
    const why = blocked(); if (why) return { ok: false, msg: why };
    const I = itemInfo(id); if (!I) return { ok: false, msg: 'Unknown product.' };
    const v = C.canSpend(S, lifetime(), price); if (!v.ok) return { ok: false, short: v.short, msg: v.msg };
    if (room(id) < 1) return { ok: false, msg: `No room: you can carry ${I.max} ${I.name} and 20 units in all.` };
    const r = CB().add(id, 1, 1); if (!r?.ok) return { ok: false, msg: r?.msg || 'No room in your stash.' };
    const s = spendRaw(price, 'contraband:' + id);
    if (!s.ok) { try { CB().remove(id, 1); } catch (e) { /* */ } return { ok: false, msg: s.msg }; }
    emit('buy', { item: id, price });
    return { ok: true, item: id, price, balance: balance(), msg: `Bought 1 ${I.name} for ${fmt(price)} ⭐. It\u2019s in your stash. ${fmt(balance())} ⭐ left.` };
  });
}

// ---------- UI (black buttons, white text, 44px+ targets, window.__onTap) ----------
const css = `
#ssPanel{position:fixed;inset:0;z-index:62;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55)}
#ssPanel.show{display:flex}
#ssPanel .wrap{width:min(460px,calc(100vw - 12px));max-height:calc(100vh - 24px - env(safe-area-inset-top));display:flex;flex-direction:column;overflow:hidden;margin:0 6px calc(8px + env(safe-area-inset-bottom));padding:14px;border-radius:16px;background:#000;color:#fff;border:2px solid #fff;font:14px system-ui,sans-serif;box-sizing:border-box}
#ssBody{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch}
#ssPanel h2{margin:0 0 4px;font-size:18px} #ssPanel .sub{margin:0 0 8px;font-size:13px;color:#fff}
#ssPanel .bal{margin:4px 0 8px;padding:8px 10px;border:2px solid #fff;border-radius:10px;font-weight:800;font-size:16px}
#ssPanel .it{display:grid;grid-template-columns:1fr auto;gap:6px 8px;align-items:center;padding:9px 0;border-top:1px solid rgba(255,255,255,.4)}
#ssPanel .it b{font-size:15px} #ssPanel .it small{display:block;font-size:12px;color:#fff}
#ssPanel button,#cbPanel button.ssStar{min-height:46px;min-width:64px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 14px system-ui,sans-serif;touch-action:manipulation}
#ssPanel .it button{grid-column:1/-1;width:100%} #cbPanel button.ssStar{flex:1}
#ssPanel button:disabled,#cbPanel button.ssStar:disabled{opacity:.4}
#ssPanel .msg{min-height:1.3em;margin:8px 0;font-weight:700;color:#fff} #ssPanel .foot{display:flex;gap:8px} #ssPanel .foot button{flex:1}
#cbPanel .ssBal{margin:0 0 8px;font-size:13px;font-weight:800;color:#fff}
`;
let panel, bodyEl, msgEl, lastMsg = '', lastTouch = 0;
function tap(el, fn) {
  const g = e => { const n = performance.now(); if (e?.type === 'click' && n - lastTouch < 700) return; if (e?.type === 'pointerup') lastTouch = n; fn(e); };
  (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, g);
}
// buttons drawn into a fresh sheet stay disabled for 250 ms, so the finger that opened/redrew it can't buy by accident
// (a data-hold flag, not `disabled`, so the button doesn't flash to the grey disabled style after every tap)
function hold(btns) { for (const b of btns) { if (b.disabled) continue; b.dataset.hold = '1'; setTimeout(() => { delete b.dataset.hold; }, 250); } }
function ui() {
  if (panel) return; const st = document.createElement('style'); st.id = 'ssCss'; st.textContent = css; document.head.appendChild(st);
  panel = document.createElement('div'); panel.id = 'ssPanel';
  panel.innerHTML = '<div class="wrap" role="dialog" aria-label="Star Shop"><div id="ssBody"></div><div class="msg" id="ssMsg" aria-live="polite"></div><div class="foot"><button id="ssClose" type="button">Close</button></div></div>';
  document.body.appendChild(panel); bodyEl = panel.querySelector('#ssBody'); msgEl = panel.querySelector('#ssMsg');
  tap(panel.querySelector('#ssClose'), close);
}
function open() {
  ui(); try { CB()?.close?.(); } catch (e) { /* */ }
  const why = blocked(); lastMsg = why && !/^Not in game|stash isn/.test(why) ? why : '';
  panel.classList.add('show'); if (document.pointerLockElement) document.exitPointerLock(); render();
}
function close() { panel?.classList.remove('show'); }
function render() {
  if (!panel || !panel.classList.contains('show')) return;
  const b = balance(), cb = CB(), why = blocked(); let cap = null, cr = game()?.progress?.credits | 0; try { cap = cb?.capacity(); } catch (e) { /* */ }
  let rows = '';
  for (const id of C.ORDER) {
    const I = itemInfo(id); if (!I) continue; const p = C.PRICES[id], rm = room(id), off = !!why || b < p || rm < 1;
    const note = b < p ? `Need ${fmt(p - b)} more ⭐` : rm < 1 ? 'No room in your stash' : '';
    rows += `<div class="it"><div><b>${I.icon} ${esc(I.name)}</b><small>${esc(I.blurb)}</small></div><div style="text-align:right"><b>⭐ ${fmt(p)}</b><small>or ${fmt(I.supplier)} cr at Blue\u2019s</small></div>` +
      `<button type="button" data-ss="${id}" data-off="${off ? 1 : 0}" ${off ? 'disabled' : ''} aria-label="Buy 1 ${esc(I.name)} for ${p} stars">${note ? esc(note) : `Buy 1 for ${fmt(p)} ⭐`}</button></div>`;
  }
  bodyEl.innerHTML = `<h2>⭐ Star Shop</h2><p class="sub">Pay with stars instead of credits. Blue\u2019s runner drops it in your stash. Your rank stays the same: it counts every star you ever earned.</p>` +
    `<div class="bal" id="ssBal">⭐ ${fmt(b)} stars to spend</div><p class="sub">💰 ${fmt(cr)} cr${cap ? ` \u00b7 Carrying ${cap.used}/${cap.max} units` : ''}</p>` + (rows || '<p class="sub">The stash isn\u2019t loaded yet.</p>');
  msgEl.textContent = lastMsg;
  const btns = [...bodyEl.querySelectorAll('button[data-ss]')];
  for (const x of btns) tap(x, () => { if (x.disabled || x.dataset.hold) return; const r = buy(x.dataset.ss); if (r.dup) return; lastMsg = r.msg || ''; render(); });
  hold(btns);
}
// Blue's sheet (#cbPanel, mars/contraband.js): add a "⭐ price" button next to Buy 1 / Buy 5, and the star balance under the header.
// We only watch #cbBody's own children (contraband redraws it with innerHTML), so our additions never retrigger us.
function decorateBlue() {
  const body = document.getElementById('cbBody'); if (!body) return;
  const buys = [...body.querySelectorAll('button[data-a="buy"][data-q="1"]')]; if (!buys.length || CB()?.near?.kind !== 'sup') return;
  const b = balance(), why = blocked(), mine = [];
  if (!body.querySelector('.ssBal')) { const p = document.createElement('p'); p.className = 'ssBal'; p.textContent = `⭐ ${fmt(b)} stars to spend (rank stays the same)`; const h = body.querySelector('.sub'); h ? h.after(p) : body.prepend(p); }
  for (const bb of buys) {
    const id = bb.dataset.i, p = C.PRICES[id], acts = bb.parentElement; if (!p || !acts || acts.querySelector('.ssStar')) continue;
    const x = document.createElement('button'); x.type = 'button'; x.className = 'ssStar'; x.dataset.ss = id; x.textContent = `⭐ ${fmt(p)}`;
    x.setAttribute('aria-label', `Buy 1 for ${p} stars`); const off = !!why || b < p || room(id) < 1; x.dataset.off = off ? '1' : '0'; x.disabled = off;
    acts.appendChild(x); mine.push(x);
    tap(x, () => { if (x.disabled || x.dataset.hold) return; const r = buy(id); if (r.dup) return; const m = document.getElementById('cbMsg'); decorateBlue(); if (m) m.textContent = r.msg || ''; });
  }
  hold(mine);
}
function watchBlue() {
  const attach = () => { const body = document.getElementById('cbBody'); if (!body) return false; try { new MutationObserver(() => decorateBlue()).observe(body, { childList: true }); } catch (e) { return true; } decorateBlue(); return true; };
  if (attach()) return; let n = 0; const t = setInterval(() => { if (attach() || ++n > 150) clearInterval(t); }, 200);
}

// ---------- boot ----------
const API = {
  prices: () => ({ ...C.PRICES }), buy, open, close, blocked, render,
  status: () => ({ balance: balance(), lifetime: lifetime(), spent: S.spent, open: !!panel?.classList.contains('show'), blocked: blocked(), log: S.log.map(e => ({ ...e })) }),
  debug: { reset() { S = C.fresh(); save(); render(); }, inPit, room }
};
(function boot() {
  if (!window.SSX || !window.__app) { setTimeout(boot, 200); return; }
  window.SSX.stars = STARS; window.SSX.starshop = API; ui();
  try { window.SSX.registerMenuItem({ id: 'rmStarShop', label: '⭐ Star Shop', onTap: () => open() }); } catch (e) { console.warn('starshop menu', e); }
  watchBlue();
  const hook = () => { try { const cb = CB(); if (!cb?.on) return false; cb.on(ev => { if (ev?.type === 'change') render(); }); return true; } catch (e) { return true; } };
  if (!hook()) { let n = 0; const t = setInterval(() => { if (hook() || ++n > 150) clearInterval(t); }, 200); }
})();
