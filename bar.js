// v7.6 Velvet Airlock space-liquor bar (Jeff). One file: the pure rules (house drinks, the bar's bottle buy price,
// the daily demand cap, how drunk stacks and wears off) plus addBarCounter(api) for interiors.js (a short counter at
// the north end of the club's west bar, its own bartender and a 'SPACE LIQUOR' sign) and clubBar(...) for index.html
// (the menu and the cheap drunk effects). The menu's MAIN option is "Sell your bottles": the bar buys Collin's farm
// moonshine/hooch at the best price in town, BAR.mult (1.3x) whatever the aliens pay, up to BAR.dailyCap bottles a
// day (saved in localStorage 'ssx.bar.v1'). Drinking (house drinks for cr, or your own bottles) is the second option.
// SSX.liquor (the farm still, Marsmania) is optional: every call to it is typeof-checked and try/caught, and with no
// SSX.liquor the sell and own-bottle sections are simply hidden. Drunk effects are phone-cheap on purpose: a small
// camera roll/yaw wobble after the camera update, one CSS vignette div (a 1px backdrop blur only when heavily drunk),
// a little sideways drift on movement, slurred toasts. Too much = fade to black and you wake up outside the club door.
// Fiction only: invented drinks, cr are the game's play money.

export const DRINKS = [
  { id: 'lager', icon: '🍺', name: 'Red Dust Lager', price: 15, units: 1, line: 'Cold, cheap, faintly iron-flavoured.' },
  { id: 'nebula', icon: '🍸', name: 'Nebula Negroni', price: 30, units: 1.6, line: 'Swirls purple when you tilt it.' },
  { id: 'comet', icon: '☄️', name: 'Comet Tail Shot', price: 45, units: 2.4, line: 'It is on fire. Drink it anyway.' },
  { id: 'breaker', icon: '🚀', name: 'Airlock Breaker', price: 60, units: 3.4, line: 'House special. Nova won’t say what’s in it.' },
];
export const DRUNK = {
  max: 10, // level cap
  tipsy: 1, drunk: 3.5, heavy: 6, blackout: 9, // reach blackout = fade out, wake up outside
  decayA: 0.045, decayB: 1 / 90, // dD/dt = -(A + D*B): a 3-4 drink buzz (~5) wears off in ~70 s, a light one in ~50 s
  afterBlackout: 3, // you wake up still a bit wobbly
};
export const BAR = {
  mult: 1.3, // the Velvet Airlock pays 1.3x the alien trading-post price: best in town
  dailyCap: 12, // bottles the bar buys per day (real calendar day, local time)
  key: 'ssx.bar.v1',
  // alien base price per bottle when SSX.liquor doesn't expose one (matched against the bottle's id/type/name)
  base: [['brandy', 80], ['whisk', 75], ['wine', 70], ['moonshine', 60], ['shine', 60], ['gin', 55], ['vodka', 55], ['rum', 55], ['hooch', 40], ['beer', 20], ['ale', 20], ['cider', 25]],
  baseDefault: 45,
  units: [['brandy', 2.6], ['whisk', 2.6], ['moonshine', 3.2], ['shine', 3.2], ['hooch', 2.6], ['wine', 1.6], ['beer', 1], ['ale', 1], ['cider', 1]],
  unitsDefault: 2.2,
};

// ---------- pure rules (no DOM) ----------
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function decay(D, dt) { if (!(D > 0)) return 0; return Math.max(0, D - (DRUNK.decayA + D * DRUNK.decayB) * Math.max(0, dt)); }
export function soberTime(D) { const a = DRUNK.decayA, b = DRUNK.decayB; return D > 0 ? Math.log((D + a / b) / (a / b)) / b : 0; } // closed form of decay()
export function addDrink(D, units) { return clamp((D || 0) + Math.max(0, +units || 0), 0, DRUNK.max); }
export function stage(D) { return D >= DRUNK.blackout ? 'blackout' : D >= DRUNK.heavy ? 'heavy' : D >= DRUNK.drunk ? 'drunk' : D >= DRUNK.tipsy ? 'tipsy' : 'sober'; }
// what the effects look like at level D (k: 0..1 intensity)
export function effects(D) {
  const k = clamp((D || 0) / 8, 0, 1), st = stage(D || 0);
  return { k, stage: st, roll: 0.06 * k, yaw: 0.035 * k, vignette: +(Math.min(0.95, k * 1.05)).toFixed(3), blur: st === 'heavy' || st === 'blackout' ? 1 : 0, drift: 0.5 * k };
}
// slur a line: harder the drunker. rng injectable for tests.
export function slur(text, k = 0.5, rng = Math.random) {
  if (!(k > 0.15)) return text;
  let s = String(text).replace(/s(?=[aeiou\s.,!?]|$)/gi, m => (rng() < k ? (m === 'S' ? 'Sh' : 'sh') : m));
  s = s.replace(/([aeiou])/gi, (m) => (rng() < k * 0.25 ? m + m : m));
  if (k > 0.5) s = s.replace(/ /g, () => (rng() < k * 0.15 ? '… ' : ' '));
  if (k > 0.35 && rng() < k) s += rng() < 0.5 ? ' *hic*' : ' …wha?';
  return s;
}
const lc = v => String(v ?? '').toLowerCase();
const byType = (it, table, dflt) => { const s = `${lc(it?.id)} ${lc(it?.type)} ${lc(it?.kind)} ${lc(it?.name)}`; for (const [k, v] of table) if (s.includes(k)) return v; return dflt; };
const num = v => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : (v && typeof v === 'object' ? num(v.alien ?? v.price ?? v.cr ?? v.value) : null));
// the alien (trading post) price per bottle: SSX.liquor's own number if it exposes one, else a per-type default
export function basePrice(it, L) {
  const id = it?.id;
  if (L) {
    for (const f of ['alienPrice', 'alienPriceOf', 'priceOf', 'price', 'sellPrice']) {
      if (typeof L[f] === 'function') { try { const v = num(L[f](id, it)); if (v) return v; } catch (e) { /* */ } }
    }
    try { const p = L.prices ?? L.PRICES ?? L.alienPrices; const v = num(typeof p === 'function' ? p()?.[id] : p?.[id]); if (v) return v; } catch (e) { /* */ }
  }
  const own = num(it?.alienPrice) ?? num(it?.alien) ?? num(it?.price) ?? num(it?.value) ?? num(it?.sell) ?? num(it?.worth);
  return own ?? byType(it, BAR.base, BAR.baseDefault);
}
export function barPrice(it, L) { return Math.round(basePrice(it, L) * BAR.mult); }
export function drinkUnits(it) { const abv = +(it?.abv ?? it?.proof / 2); if (num(it?.units)) return clamp(it.units, 0.5, 4); if (abv > 0) return clamp(abv / 15, 0.6, 4); return byType(it, BAR.units, BAR.unitsDefault); }
const title = s => String(s).replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
// any inventory shape -> [{ id, name, icon, qty, raw }]
export function normInventory(raw) {
  const out = [];
  const push = (id, v) => {
    if (id == null) return; const o = v && typeof v === 'object' ? v : { qty: v };
    const qty = Math.floor(+(o.qty ?? o.count ?? o.n ?? o.amount ?? o.bottles ?? (typeof v === 'number' ? v : 1)) || 0);
    if (qty <= 0) return;
    const ex = out.find(x => x.id === id); if (ex) { ex.qty += qty; return; }
    out.push({ ...o, id: String(id), name: o.name || o.label || title(id), icon: o.icon || '🍾', qty, raw: v });
  };
  if (Array.isArray(raw)) for (const it of raw) { if (it && typeof it === 'object') push(it.id ?? it.type ?? it.kind ?? it.name, it); else if (typeof it === 'string') push(it, 1); }
  else if (raw && typeof raw === 'object') { const r = Array.isArray(raw.bottles) ? raw.bottles : Array.isArray(raw.items) ? raw.items : null; if (r) return normInventory(r); for (const [k, v] of Object.entries(raw)) push(k, v); }
  return out;
}
// the daily demand cap (state is { day, sold } in save)
export function dayKey(d = new Date()) { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
export function capLeft(state, day, cap = BAR.dailyCap) { return state && state.day === day ? Math.max(0, cap - (state.sold | 0)) : cap; }
export function recordSale(state, day, n) { const sold = (state && state.day === day ? state.sold | 0 : 0) + Math.max(0, n | 0); return { ...(state || {}), day, sold }; }
// how many of qty the bar takes right now and what it pays
export function quote(it, qty, L, left) { const n = Math.max(0, Math.min(qty | 0, it?.qty ?? 0, left | 0)), each = barPrice(it, L); return { n, each, total: n * each }; }
export const soldLine = (n, cr) => `Sold ${n} bottle${n === 1 ? '' : 's'} · +${cr} cr`;

// ---------- SSX.liquor adapter (all guarded) ----------
export function liquorAdapter(get = () => globalThis.SSX?.liquor) {
  const L = () => { try { const l = get(); return l && (typeof l === 'object' || typeof l === 'function') ? l : null; } catch (e) { return null; } };
  function list() {
    const l = L(); if (!l) return [];
    try {
      for (const f of ['inventory', 'list', 'bottles', 'stock']) {
        const v = l[f]; if (v == null) continue;
        const raw = typeof v === 'function' ? v.call(l) : v; const n = normInventory(raw); if (n.length || raw) return n;
      }
    } catch (e) { console.warn('[bar] SSX.liquor inventory', e); }
    return [];
  }
  const qtyOf = id => list().find(x => x.id === id)?.qty ?? 0;
  function take(id, n = 1) { // -> how many actually left the inventory
    const l = L(); if (!l || !(n > 0)) return 0;
    const fn = typeof l.take === 'function' ? 'take' : typeof l.remove === 'function' ? 'remove' : null; if (!fn) return 0;
    const before = qtyOf(id); let r;
    try { r = l[fn](id, n); if (r === false || r?.ok === false) return 0; } catch (e) { console.warn('[bar] SSX.liquor.' + fn, e); return 0; }
    const after = qtyOf(id); if (before > after) return Math.min(n, before - after); // trust the inventory first
    if (typeof r === 'number' && r > 0) return Math.min(n, r); if (r === true || r?.ok === true) return n; return 0;
  }
  return {
    get ok() { const l = L(); return !!l && (typeof l.take === 'function' || typeof l.remove === 'function') && ['inventory', 'list', 'bottles', 'stock'].some(f => l[f] != null); },
    get raw() { return L(); }, list, take, price: it => barPrice(it, L()), base: it => basePrice(it, L()),
  };
}

// ---------- interiors.js: the counter ----------
// a short counter at the north end of the club's west bar, its own bartender, a 'SPACE LIQUOR' sign, a few bottles.
// Spot (-8.2, -1.9) r 1.1: 3.4 m from the old 'bar' spot (r 2.0), well away from Danny, the private-dance spots,
// the slots corner (-7.7, 6.45), the stage and the upstairs door.
export const COUNTER = { x: -8.2, z: -1.9, r: 1.1 };
export function addBarCounter(api, { x = COUNTER.x, z = COUNTER.z, r = COUNTER.r, wall = -11 } = {}) {
  const { box, mat } = api;
  const top = mat(0x1a0f22, { roughness: 0.35, metalness: 0.4 }), trim = mat(0x7af0ff, { basic: true }), neon = mat(0xffd040, { basic: true });
  box(x - 1.2, 1.12, z, 0.7, 0.06, 1.3, top); // counter top over the bar's north end
  box(x - 0.86, 0.95, z, 0.03, 0.05, 1.3, trim); // cyan trim
  const cols = [0x6aff9a, 0xffb040, 0xff4a6a, 0x7ac8ff];
  for (let i = 0; i < 4; i++) box(x - 1.3, 1.31, z - 0.45 + i * 0.3, 0.09, 0.32, 0.09, mat(cols[i], { basic: true }));
  box(x - 1.05, 1.21, z + 0.35, 0.12, 0.12, 0.12, neon); // tip jar glow
  try { api.sign?.('SPACE LIQUOR', '#7af0ff', x - 0.75, 2.75, z, Math.PI / 2, 1.8); } catch (e) { /* */ }
  try { api.person?.({ top: 0x0a0a14, bottom: 0x101010, hair: 0x2a1a10, hairStyle: 'long', skin: 0xa0704a, accent: 0x7af0ff }, wall + 0.75, z, -Math.PI / 2, (p, t) => { p.arms[1].rotation.x = 1.1 + Math.sin(t * 2.2) * 0.25; p.head.rotation.y = Math.sin(t * 0.4) * 0.4; }); } catch (e) { /* */ }
  api.spot({ id: 'liquor', x, z, r, label: '🥃 Nova · Sell bottles', act: 'liquor', who: 'Nova' });
}

// ---------- index.html: the menu + drunk effects ----------
const CSS = `
body.barNear #driveBtn{background:#000!important;color:#fff!important;border:1.5px solid #fff!important}
#barPanel{position:fixed;inset:0;z-index:58;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.66);touch-action:manipulation}
#barPanel.on{display:flex}
#barCard{width:min(400px,calc(100vw - 20px));max-height:calc(100dvh - 20px);overflow-y:auto;box-sizing:border-box;padding:12px;border-radius:16px;background:#000;color:#fff;border:1.5px solid #7af0ff;box-shadow:0 0 22px rgba(122,240,255,.35);font:14px/1.35 system-ui,sans-serif;-webkit-overflow-scrolling:touch}
#barCard .hd{display:flex;align-items:center;gap:8px} #barCard .hd b{flex:1;font-size:16px;letter-spacing:.04em;color:#7af0ff}
#barCash{font-weight:700;font-variant-numeric:tabular-nums}
#barCard h4{margin:12px 0 4px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#ffd040}
#barCard h4.main{font-size:15px;color:#3cff8a} #barCard .sub{color:#aaa;font-size:12px;margin-bottom:4px}
.barRow{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid #222}
.barRow .n{flex:1;min-width:0} .barRow .n small{display:block;color:#999;font-size:11.5px}
.barBtn{min-height:44px;min-width:64px;padding:0 10px;border-radius:10px;border:1.5px solid #fff;background:#000;color:#fff;font:700 14px system-ui,sans-serif;touch-action:manipulation}
.barBtn:active{background:#fff;color:#000} .barBtn:disabled{opacity:.4}
#barSell .barBtn.all{border-color:#3cff8a}
#barMsg{min-height:20px;margin-top:8px;text-align:center;font-weight:700} #barMsg.ok{color:#3cff8a} #barMsg.bad{color:#ff7a7a}
#barMeter{height:8px;border-radius:4px;background:#222;overflow:hidden;margin-top:4px} #barMeter i{display:block;height:100%;width:0;background:linear-gradient(90deg,#3cff8a,#ffd040,#ff3cc8)}
#barCard .r{display:flex;gap:8px;margin-top:10px} #barCard .r .barBtn{flex:1}
#barClose{min-width:44px;flex:0 0 44px}
#barDrunk{position:fixed;inset:0;z-index:2;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 30%,rgba(70,0,60,.55) 68%,rgba(8,0,10,.95) 100%)}
#barDrunk::after{content:'';position:absolute;inset:0;background:radial-gradient(circle at 46% 50%,rgba(255,60,200,.16),rgba(0,0,0,0) 55%);animation:barSwim 4.5s ease-in-out infinite alternate}
#barDrunk.heavy{-webkit-backdrop-filter:blur(1px);backdrop-filter:blur(1px)}
@keyframes barSwim{0%{transform:translate(-2%,0)}100%{transform:translate(2%,1%)}}
@media (orientation:landscape) and (max-height:520px){#barCard{width:min(620px,calc(100vw - 24px))}}
`;
export function clubBar({ surface, toast = () => {}, onTap = (el, fn) => el.addEventListener('click', fn), fx = {}, hud = () => {}, liquor = liquorAdapter() } = {}) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const veil = document.createElement('div'); veil.id = 'barDrunk'; document.body.appendChild(veil);
  const el = document.createElement('div'); el.id = 'barPanel'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = `<div id="barCard"><div class="hd"><b>🥃 SPACE LIQUOR · Nova</b><span id="barCash"></span><button class="barBtn" id="barClose" aria-label="Close">✕</button></div>
<div id="barSell"></div><div id="barDrinks"></div><div id="barOwn"></div>
<div class="sub" style="margin-top:10px">Buzz: <span id="barStage">sober</span></div><div id="barMeter"><i></i></div>
<div id="barMsg"></div><div class="r"><button class="barBtn" id="barLeave">Leave</button></div></div>`;
  document.body.appendChild(el);
  const $ = id => document.getElementById(id);
  const game = () => surface?.game || window.__app?.surface?.game || window.__app?.game;
  const credits = () => game()?.progress?.credits ?? 0;
  const grant = n => { const g = game(); if (!g || !(n > 0)) return; if (typeof g.debug?.credits === 'function') g.debug.credits(n); else { g.progress.credits += n; try { g.save?.(); } catch (e) { /* */ } } };
  const loadS = () => { try { const s = JSON.parse(localStorage.getItem(BAR.key) || 'null'); return s && typeof s === 'object' ? s : {}; } catch (e) { return {}; } };
  const saveS = s => { try { localStorage.setItem(BAR.key, JSON.stringify(s)); } catch (e) { /* */ } };
  let open = false, openedAt = 0, D = 0, out = false, slurT = 6, lastPos = null, t = 0, lastVeil = -1, dayOverride = null, stats = { sold: 0, earned: 0, drinks: 0, blackouts: 0 };
  const today = () => dayOverride || dayKey();
  const left = () => capLeft(loadS(), today());
  const say = (s, cls = '') => { const m = $('barMsg'); m.textContent = s; m.className = cls; };
  const sl = s => slur(s, effects(D).k);
  const ghost = () => performance.now() - openedAt < 300;

  function render() {
    $('barCash').textContent = credits().toLocaleString('en-US') + ' cr';
    const hasL = liquor.ok, inv = hasL ? liquor.list() : [], n = left();
    // 1) MAIN: sell your bottles (only when the farm still exists)
    const sell = $('barSell');
    if (!hasL) { sell.innerHTML = ''; sell.style.display = 'none'; }
    else {
      sell.style.display = '';
      const rows = inv.map(it => { const p = liquor.price(it), q = quote(it, it.qty, liquor.raw, n); return `<div class="barRow"><span class="n">${it.icon} ${esc(it.name)} ×${it.qty}<small>${p} cr each · aliens pay ${liquor.base(it)}</small></span><button class="barBtn" data-sell="${esc(it.id)}" data-n="1"${n ? '' : ' disabled'}>Sell 1</button><button class="barBtn all" data-sell="${esc(it.id)}" data-n="all"${n ? '' : ' disabled'}>All · ${q.total} cr</button></div>`; }).join('');
      sell.innerHTML = `<h4 class="main">💰 Sell your bottles</h4><div class="sub">Best price in town: ${BAR.mult}× what the aliens pay. ${n ? `Nova buys ${n} more today.` : 'Nova is stocked up for today. Come back tomorrow.'}</div>${rows || '<div class="sub">No bottles on you. Run some through the farm still.</div>'}`;
    }
    // 2) house drinks
    $('barDrinks').innerHTML = `<h4>🍸 House drinks</h4>` + DRINKS.map(d => `<div class="barRow"><span class="n">${d.icon} ${d.name}<small>${d.line}</small></span><button class="barBtn" data-drink="${d.id}">${d.price} cr</button></div>`).join('');
    // 3) your own bottles, to drink
    const own = $('barOwn');
    if (!hasL || !inv.length) { own.innerHTML = ''; own.style.display = 'none'; }
    else { own.style.display = ''; own.innerHTML = `<h4>🧺 Drink your own</h4>` + inv.map(it => `<div class="barRow"><span class="n">${it.icon} ${esc(it.name)} ×${it.qty}<small>Nova pours it, no charge</small></span><button class="barBtn" data-own="${esc(it.id)}">Drink</button></div>`).join(''); }
    for (const b of el.querySelectorAll('[data-sell]')) onTap(b, () => sellBottles(b.dataset.sell, b.dataset.n === 'all' ? Infinity : 1));
    for (const b of el.querySelectorAll('[data-drink]')) onTap(b, () => buyDrink(b.dataset.drink));
    for (const b of el.querySelectorAll('[data-own]')) onTap(b, () => drinkOwn(b.dataset.own));
    meter();
  }
  function meter() { const s = el.querySelector('#barMeter i'); if (s) s.style.width = Math.round(clamp(D / DRUNK.blackout, 0, 1) * 100) + '%'; const g = $('barStage'); if (g) g.textContent = stage(D); }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function sellBottles(id, want = 1, force = false) {
    if (!force && (!open || ghost())) return null;
    if (!liquor.ok) return { ok: false, why: 'noliquor' };
    const it = liquor.list().find(x => x.id === id); if (!it) { say('You don’t have that bottle.', 'bad'); return { ok: false, why: 'none' }; }
    const n = left(); if (!n) { say('Nova: “Shelf’s full today, hon. Tomorrow.”', 'bad'); fx.dry?.(); toast('🥃 The bar is stocked up for today.'); render(); return { ok: false, why: 'cap' }; }
    const q = quote(it, want === Infinity ? it.qty : want, liquor.raw, n); if (!q.n) return { ok: false, why: 'none' };
    const took = liquor.take(id, q.n); if (!took) { say('The bottle won’t come out of your bag. (Still error.)', 'bad'); return { ok: false, why: 'take' }; }
    const pay = took * q.each; grant(pay); saveS(recordSale(loadS(), today(), took));
    stats.sold += took; stats.earned += pay; fx.cash?.(); hud();
    const line = soldLine(took, pay); toast('🍾 ' + line, 2800); render(); say(line, 'ok');
    return { ok: true, n: took, each: q.each, total: pay, left: left() };
  }
  function buyDrink(id, force = false) {
    if (!force && (!open || ghost())) return null;
    const d = DRINKS.find(x => x.id === id); if (!d) return null;
    if (credits() < d.price || !game()?.spend?.(d.price)) { say(`Short on cr: the ${d.name} is ${d.price} cr, you have ${credits()}.`, 'bad'); fx.dry?.(); return { ok: false, why: 'broke' }; }
    hud(); return drink(d.units, `${d.icon} ${d.name}. ${d.line}`, d.price);
  }
  function drinkOwn(id, force = false) {
    if (!force && (!open || ghost())) return null;
    const it = liquor.ok && liquor.list().find(x => x.id === id); if (!it) return { ok: false, why: 'none' };
    if (!liquor.take(id, 1)) { say('The cork won’t budge.', 'bad'); return { ok: false, why: 'take' }; }
    return drink(drinkUnits(it), `${it.icon} Your own ${it.name}. Nova pours it neat.`, 0);
  }
  function drink(units, line, paid) {
    D = addDrink(D, units); stats.drinks++; slurT = 10;
    const st = stage(D); render();
    say(sl(st === 'blackout' ? 'Nova: “Okay, that one’s on the floor now.”' : line), 'ok');
    toast('🥃 ' + sl(st === 'heavy' ? 'The room is doing a slow lap around you.' : st === 'drunk' ? 'Everything is very funny right now.' : st === 'tipsy' ? 'Warm glow. Nice.' : 'Smooth.'), 2200);
    if (st === 'blackout') setTimeout(blackout, 700);
    return { ok: true, level: D, stage: st, paid };
  }
  function blackout() {
    if (out) return; out = true; stats.blackouts++; close();
    const fb = $('fadeBlack'); if (fb) { fb.textContent = 'The floor tilts up to meet you…'; fb.classList.add('on'); }
    setTimeout(() => {
      try { if (surface?.info?.inside) surface.leaveBuilding(); } catch (e) { console.warn('[bar] leave', e); }
      D = DRUNK.afterBlackout; lastPos = null;
      setTimeout(() => { if (fb) { fb.classList.remove('on'); setTimeout(() => { if (!fb.classList.contains('on')) fb.textContent = ''; }, 700); } out = false; hud();
        toast('😵 You wake up on the curb outside the Velvet Airlock. Your head is pounding.', 4200); }, 1600);
    }, 1400);
  }
  function show() {
    if (open || out) return; if (window.__pshow?.active || window.__cprivate?.active || window.__slots?.isOpen) return;
    if (document.pointerLockElement) document.exitPointerLock();
    open = true; openedAt = performance.now(); el.classList.add('on'); document.body.classList.remove('barNear'); say(''); render();
  }
  function close() { if (!open) return; open = false; el.classList.remove('on'); hud(); }
  onTap($('barLeave'), () => close()); onTap($('barClose'), () => close());
  window.addEventListener('keydown', e => {
    if (!open) return;
    if (e.code.startsWith('Key') || e.code.startsWith('Arrow') || e.code.startsWith('Digit') || e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); }
    if (e.code === 'Escape') close();
  }, true);

  // per frame (runs after the camera update): decay, sway, drift, vignette, slurred asides, the prompt
  surface?.registerTick?.((dt, ctx) => {
    try {
      const inside = !!surface.info?.inside, sp = surface.info?.spot;
      document.body.classList.toggle('barNear', !open && inside && sp?.act === 'liquor');
      if (open && !inside) close();
      t += dt; D = decay(D, dt); const fx2 = effects(D);
      if (D > 0.02 && ctx?.camera) { ctx.camera.rotation.z += Math.sin(t * 0.9) * fx2.roll; ctx.camera.rotateY(Math.sin(t * 0.63 + 1.3) * fx2.yaw); }
      const p = ctx?.player;
      if (p && !ctx.car && fx2.drift > 0.01 && lastPos && !open) { const dx = p.x - lastPos.x, dz = p.z - lastPos.z, m = Math.hypot(dx, dz); if (m > 1e-4 && m < 0.5) { const s = Math.sin(t * 1.1) * fx2.drift; p.x += -dz * s; p.z += dx * s; } }
      lastPos = p ? { x: p.x, z: p.z } : null;
      const v = fx2.vignette; if (Math.abs(v - lastVeil) > 0.01) { veil.style.opacity = v; lastVeil = v; }
      veil.classList.toggle('heavy', !!fx2.blur);
      if (D >= DRUNK.drunk && !open && (slurT -= dt) <= 0) { slurT = 12 + Math.random() * 6; toast('🥴 ' + slur(['I love this place. I love all of you.', 'Is the floor supposed to do that?', 'One more. No. Yes. Maybe.', 'Who put two moons in the sky?'][(Math.random() * 4) | 0], fx2.k), 2200); }
      if (open) meter();
    } catch (e) { /* */ }
  });

  const api = { open: show, close, sell: sellBottles, buy: buyDrink, drinkOwn, drinks: DRINKS, rules: BAR, liquor,
    get isOpen() { return open; }, get level() { return D; }, get stage() { return stage(D); }, get out() { return out; }, get stats() { return { ...stats }; },
    get capLeft() { return left(); }, get day() { return today(); },
    debug: { setLevel: v => { D = clamp(+v || 0, 0, DRUNK.max); lastVeil = -1; meter(); }, setDay: d => { dayOverride = d || null; if (open) render(); }, render, blackout } };
  try { window.__bar = api; (window.SSX = window.SSX || {}).bar = api; } catch (e) { /* */ }
  return api;
}
