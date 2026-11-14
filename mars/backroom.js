// Back-room deals at the Velvet Airlock and The Thin Air. One card, one suspicion bar, one effect timer.
import * as B from './backroomcore.js';

const KEY = 'ssx.backroom.v1';
let state = B.fresh();
try { state = B.load(localStorage.getItem(KEY)); } catch (e) { state = B.fresh(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* */ } };
let pinKey = '';
let now = () => performance.now() / 1000;

function stashQty(id) {
  try { return window.SSX?.contraband?.stash?.()?.items?.[id]?.qty | 0; } catch (e) { return 0; }
}
function takeStash(id, n) {
  try { return window.SSX?.contraband?.remove?.(id, n) || 0; } catch (e) { return 0; } }
function info() { return window.__app?.surface?.info || null; }
function localOf() {
  const i = info();
  if (!i?.inside) return null;
  return { kind: i.inside.kind, x: i.x - i.inside.ax, z: i.z - i.inside.az, ax: i.inside.ax, az: i.inside.az };
}
function thinDoor() {
  try {
    const d = window.SSX?.empire?.prop?.('fr-bar')?.door;
    if (d) return { x: +d.x, z: +d.z };
  } catch (e) { /* */ }
  return null;
}
function clubDoor() {
  try {
    const d = window.__app?.surface?.world?.doorList?.().find(x => x.kind === 'club');
    if (d) return { x: d.x, z: d.z };
  } catch (e) { /* */ }
  return null;
}
function boothWorld(which) {
  if (which === 'velvet') {
    const loc = localOf();
    if (loc?.kind === 'club') return { x: loc.ax + B.VELVET.booth.x, z: loc.az + B.VELVET.booth.z, name: B.VELVET.name };
    const door = clubDoor();
    return door ? { ...door, name: B.VELVET.name } : { x: 0, z: 0, name: B.VELVET.name };
  }
  const door = thinDoor();
  if (!door) return null;
  return { x: door.x + 8, z: door.z + 6, name: B.THIN.name };
}
function atBooth() {
  const i = info(); if (!i) return null;
  const loc = localOf();
  if (loc?.kind === 'club' && Math.hypot(loc.x - B.VELVET.booth.x, loc.z - B.VELVET.booth.z) <= B.REACH) return 'velvet';
  const thin = boothWorld('thin');
  if (thin && !i.inside && Math.hypot(i.x - thin.x, i.z - thin.z) <= B.REACH) return 'thin';
  return null;
}
function inSight() {
  const loc = localOf();
  if (!loc || loc.kind !== 'club') return false;
  return Math.hypot(loc.x - (-8.1), loc.z - 1.5) < 4;
}
function ownedBar() {
  try { return !!window.SSX?.empire?.prop?.('fr-bar')?.owned; } catch (e) { return false; }
}

function pin(x, z, label) {
  if (!Number.isFinite(+x)) return;
  const k = `${Math.round(x)}:${Math.round(z)}:${label}`;
  if (pinKey !== k) {
    pinKey = k;
    try { window.SSX?.hudx?.setWaypoint?.({ x: +x, z: +z, label }, true); } catch (e) { /* */ }
  }
  try { window.SSX?.guide?.aimGround?.({ id: 'backroom', x: +x, z: +z, label }); } catch (e) { /* */ }
}

const CSS = `#dealCard{display:none;position:fixed;z-index:57;left:50%;bottom:calc(12px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(420px,calc(100vw - 16px));box-sizing:border-box;padding:10px;border-radius:14px;background:#000;color:#fff;border:1px solid #fff;font:14px/1.35 system-ui,sans-serif}
#dealCard.on{display:block}#dealCard h3{margin:0 36px 6px 0;font-size:15px}#dealCard p{margin:0 0 8px}
#dealCard .row{display:flex;flex-wrap:wrap;gap:6px}#dealCard button{min-height:48px;min-width:48px;padding:8px 10px;border-radius:10px;border:1px solid #fff;background:#000;color:#fff;font:800 14px system-ui,sans-serif;touch-action:manipulation}
#dealCard .heat{height:8px;border-radius:4px;background:#222;overflow:hidden;margin:6px 0}#dealCard .heat i{display:block;height:100%;width:0;background:linear-gradient(90deg,#9dff6a,#ffd000,#ff4060)}
#fxHud{display:none;position:fixed;z-index:8;top:calc(132px + var(--sat,0px));left:calc(10px + var(--sal,0px));width:92px;height:16px;pointer-events:none;border-radius:8px;background:rgba(0,0,0,.8);color:#fff;border:1px solid rgba(255,255,255,.4);font:800 9px/16px system-ui,sans-serif;text-align:center}
#fxHud.on{display:block}#fxVeil{display:none;position:fixed;inset:0;z-index:2;pointer-events:none}
#fxVeil.on{display:block}
@media (max-height:500px){#fxHud{top:calc(6px + var(--sat,0px));left:calc(188px + var(--sal,0px));width:84px}}`;

let card, heatEl, fxEl, veil;
function ensure() {
  if (card) return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  card = document.createElement('div'); card.id = 'dealCard'; document.body.appendChild(card);
  card.addEventListener('pointerup', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'x') close();
    else if (a === 'pack') pack(b.dataset.id);
    else if (a === 'use') use(b.dataset.id);
    else if (a === 'price') price(b.dataset.id);
    else if (a === 'glance') doGlance();
    else if (a === 'hand') doHand();
    else if (a === 'dealer') fromDealer(b.dataset.id);
  });
  fxEl = document.createElement('div'); fxEl.id = 'fxHud'; document.body.appendChild(fxEl);
  veil = document.createElement('div'); veil.id = 'fxVeil'; document.body.appendChild(veil);
}
function close() { card?.classList.remove('on'); }
function say(t) { try { window.__app?.toast?.(t, 2400); } catch (e) { /* */ } }

function render() {
  ensure();
  const deal = state.deal;
  const rows = [];
  const head = deal ? B.GOODS[deal.good].name : 'Back booth';
  if (!deal) {
    for (const id of B.GOOD_IDS) {
      const g = B.GOODS[id];
      const have = stashQty(g.from);
      rows.push(`<button data-a="pack" data-id="${id}" ${have >= g.need ? '' : 'disabled'}>Pack ${g.icon} ${g.name}</button>`);
      rows.push(`<button data-a="use" data-id="${id}" ${B.qty(state.pack, id) ? '' : 'disabled'}>Use ${g.name} ×${B.qty(state.pack, id)}</button>`);
      if (have < g.need) rows.push(`<button data-a="dealer" data-id="${id}">Buy ${g.fromName} from a dealer</button>`);
    }
    if (!B.holding(state.pack) && B.GOOD_IDS.every(id => stashQty(B.GOODS[id].from) < 1)) rows.push('<p>Ghost lichen on the farm dries into Glow-dust. Blue in Red Tape Flats sells the rest.</p>');
  } else if (deal.step === 'price') {
    rows.push('<p>Pick a price. Low is quiet. Greedy draws eyes.</p>');
    for (const k of Object.keys(B.PRICES)) {
      const p = B.PRICES[k];
      const pay = ownedBar() && atBooth() === 'thin' ? Math.round(p.pay * 1.1) : p.pay;
      rows.push(`<button data-a="price" data-id="${k}">${p.label} · ${pay} cr</button>`);
    }
  } else if (deal.step === 'handoff') {
    rows.push('<p>Hand it off before the suspicion bar fills. Glance away if it climbs.</p>');
    rows.push(`<div class="heat" aria-label="suspicion"><i style="width:${Math.round(deal.heat)}%"></i></div>`);
    rows.push('<button data-a="glance">Glance away</button><button data-a="hand">Hand off</button>');
  } else {
    rows.push(`<p>${deal.text || ''}</p>`);
  }
  card.innerHTML = `<h3>🤫 ${head}</h3><div class="row">${rows.join('')}</div><div class="row"><button data-a="x">Close</button></div>`;
  card.classList.add('on');
}

function pack(id) {
  const r = B.packOne(state.pack, id, stashQty(B.GOODS[id].from));
  if (!r.ok) { say(r.text || 'Nothing to pack.'); return r; }
  const took = takeStash(r.from, r.take);
  if (took < r.take) { say('The stash did not give it up.'); return { ok: false }; }
  state.pack = r.pack; save(); say(r.text); render(); return r;
}
function fromDealer(id) {
  const g = B.GOODS[id];
  let bought = 0;
  try { bought = window.SSX?.contraband?.buy?.(g.from, 1)?.qty || 0; } catch (e) { bought = 0; }
  if (!bought) { say(`No ${g.fromName} from the dealer.`); return { ok: false }; }
  return pack(id);
}
function use(id) {
  if (!B.qty(state.pack, id)) { say('None packed.'); return { ok: false }; }
  state.pack[id] -= 1; if (state.pack[id] <= 0) delete state.pack[id];
  state.fx = B.useGood(id, now());
  save(); paintFx(); say(`${B.GOODS[id].name}. ${B.GOODS[id].blurb}`);
  render(); return { ok: true };
}
function price(which) {
  if (!state.deal) return;
  const next = B.pickPrice(state.deal, which);
  if (ownedBar() && atBooth() === 'thin' && next.pay) next.pay = Math.round(next.pay * 1.1);
  state.deal = next;
  if (next.step === 'busted') finishBust(0.5);
  else { save(); render(); }
}
function doGlance() {
  if (!state.deal) return;
  state.deal = B.glance(state.deal); save(); render();
}
function doHand() {
  if (!state.deal) return;
  if (!B.qty(state.pack, state.deal.good)) { say('Nothing left to hand off.'); state.deal = null; save(); render(); return; }
  const r = B.handoff(state.deal);
  if (!r.ok) { say(r.text || 'Not yet.'); state.deal = r.step === 'busted' ? r : state.deal; if (r.step === 'busted') finishBust(0.2); else { save(); render(); } return; }
  state.pack[state.deal.good] -= 1; if (state.pack[state.deal.good] <= 0) delete state.pack[state.deal.good];
  try { window.__app?.surface?.game?.reward?.(0, r.pay); } catch (e) { /* */ }
  state.seen = true; state.deal = null; pinKey = '';
  try { window.SSX?.hudx?.setWaypoint?.(null, true); } catch (e) { /* */ }
  save(); say(r.text); close();
}
function finishBust(roll) {
  const r = B.bust(state.deal || {}, roll);
  const id = r.good;
  if (id && B.qty(state.pack, id)) { state.pack[id] -= 1; if (state.pack[id] <= 0) delete state.pack[id]; }
  if (r.bust === 'fine') {
    const g = window.__app?.surface?.game;
    if (!g?.spend?.(r.fine)) r.bust = 'fight';
  }
  if (r.bust === 'fight') { try { window.__app?.surface?.world?.setWanted?.(1, 'A bouncer caught a handoff.'); } catch (e) { /* */ } }
  state.deal = null; state.seen = true; save(); say(r.text); close();
}
function openBooth() {
  ensure();
  if (!atBooth()) { say('Not here. The back booth.'); return false; }
  if (!state.deal && B.holding(state.pack)) {
    const id = B.GOOD_IDS.find(k => B.qty(state.pack, k));
    state.deal = B.startDeal(id); save();
  }
  render();
  return true;
}

function paintFx() {
  if (!fxEl) return;
  const fx = B.fxAt(state.fx, now());
  if (state.fx && !fx) { state.fx = null; save(); }
  else state.fx = fx ? state.fx : null;
  fxEl.classList.toggle('on', !!fx);
  if (fx) fxEl.textContent = `${fx.phase === 'crash' ? 'crash' : fx.name} ${Math.ceil(fx.left)}s`;
  if (veil) {
    const night = fx?.kind === 'night';
    veil.classList.toggle('on', !!night);
    veil.style.background = !night ? 'transparent' : fx.phase === 'on' ? 'rgba(40,255,120,0.14)' : 'rgba(0,0,0,0.28)';
  }
}
function lessonTick() {
  if (state.seen || state.deal) return;
  const where = boothWorld('velvet') || boothWorld('thin');
  if (!where) return;
  const step = B.lesson(state.pack, where);
  pin(step.x, step.z, step.text);
}
function dealTick(dt) {
  if (!state.deal || state.deal.step !== 'handoff') return;
  const next = B.tickDeal(state.deal, dt, inSight());
  state.deal = next;
  if (next.step === 'busted') finishBust(Math.random());
  else if (card?.classList.contains('on')) {
    const bar = card.querySelector('.heat i');
    if (bar) bar.style.width = Math.round(next.heat) + '%';
  }
}

function paintNear() {
  const sb = document.getElementById('surfBtns'); if (!sb) return;
  let b = document.getElementById('dealBtn');
  if (!b) {
    b = document.createElement('button'); b.id = 'dealBtn'; b.type = 'button'; b.className = 'glass';
    b.style.minHeight = '48px'; b.textContent = '🤫 Buyer';
    sb.appendChild(b);
    b.addEventListener('pointerup', e => { e.preventDefault(); openBooth(); });
  }
  b.style.display = atBooth() === 'thin' ? '' : 'none';
}
function boot() {
  if (!window.SSX || !window.__app) { setTimeout(boot, 400); return; }
  ensure();
  let last = performance.now();
  setInterval(() => {
    const t = performance.now(); const dt = Math.min(1, (t - last) / 1000); last = t;
    try { dealTick(dt); paintFx(); lessonTick(); paintNear(); } catch (e) { /* */ }
  }, 400);
  try {
    window.SSX.registerSurfaceTick?.((dt, ctx) => {
      const b = B.fxAt(state.fx, now());
      if (!b || !ctx?.camera) return;
      if (b.kind === 'rush' && b.phase === 'on') ctx.camera.rotation.z += Math.sin(performance.now() / 80) * 0.035;
      if (b.kind === 'strong' && b.phase === 'on') ctx.camera.rotation.z += Math.sin(performance.now() / 140) * 0.018;
    });
  } catch (e) { /* */ }
  window.SSX.backroom = {
    goods: B.GOODS,
    open: openBooth,
    buff() { return B.fxAt(state.fx, now()); },
    state: () => state,
    debug: {
      setPack(id, n) { state.pack[id] = n; save(); },
      use(id) { return use(id); },
      reset() { state = B.fresh(); save(); },
      setNow(fn) { now = fn; }
    }
  };
}
boot();
