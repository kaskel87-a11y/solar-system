// Fast travel on Mars (Pumpkin). On the full map (hud/hudmap.js, opened by tapping the minimap) tap a known place: a sheet
// slides up with a black "Travel here" button. Short fade, cheap fee (25 cr, free to your base), the ride you're driving comes
// with you. Blocked while wanted or during a mission / race / heist / smuggling run / job / turf war, with a plain-word toast.
// Taps here are real taps only: the same pointerId, under 10 px of movement between pointerdown and pointerup. A swipe or a
// scroll on the map (canvas, list, buttons) never fires anything (capture-phase guard on #hxMap, so hudmap.js taps too).
// Pure logic: ./fasttravelcore.js. Hooks: one <script> line in index.html (+ import map), one sw.js precache line, and
// hud/hudmap.js asks SSX.fastTravel for its places (list) and offer(p) (tap). Everything else is feature-detected.
import * as C from './fasttravelcore.js';

const app = () => window.__app, surf = () => app()?.surface, world = () => surf()?.world, X = () => window.SSX || {};
const toast = (m, ms = 2600) => { try { app()?.toast?.(m, ms); } catch (e) { /* */ } log.push(m); if (log.length > 40) log.shift(); };
const log = [];
const tryv = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
const onMars = () => { const s = app()?.state; return !!s?.onSurface && !s.transitioning && surf()?.info?.name === 'Mars'; };
function colony() { const c = surf()?.info?.colony; return c && C.fin(c.x) ? c : null; }
function aj(p) { const c = colony(), a = Array.isArray(p) ? p : p && [p.x, p.z]; return c && a && C.fin(+a[0]) && C.fin(+a[1]) ? { x: c.x + +a[0], z: c.z + +a[1] } : null; }
const md = () => tryv(() => surf()?.mapData?.());

// ---------- known places, read from the live game every time (each source feature-detected) ----------
function rawPlaces() {
  const out = [], add = (kind, p, o = {}) => { if (p && C.fin(p.x) && C.fin(p.z)) out.push({ kind, x: p.x, z: p.z, ...o }); };
  // your base: SSX.base owned plots (the farm's plot is listed as the farm, not as a base)
  tryv(() => { for (const p of X().base?.plots?.() || []) if (p.owned && p.world && p.id !== 'farm' && !/homestead/i.test(p.name || '')) add('base', p.world, { id: 'base:' + p.id, name: `Your base · ${p.name}`, sub: 'Free' }); });
  // farm + trading post: SSX.farm.places() (world coords)
  tryv(() => { for (const p of X().farm?.places?.() || []) add(p.id === 'post' ? 'post' : 'farm', p, { id: p.id === 'post' ? 'post' : 'farm', name: p.name }); });
  // spaceport: where your Starship sits
  tryv(() => { const s = md()?.ship; add('spaceport', s, { name: 'Spaceport (your ship)' }); });
  // districts: world.districts() kinds downtown / rough / gated, arriving at their fast-travel spot
  tryv(() => { for (const d of world()?.districts?.() || []) if (C.KINDS[d.kind] && ['downtown', 'rough', 'gated'].includes(d.kind)) add(d.kind, d.fast || d, { id: d.kind, name: `${C.KINDS[d.kind].name} · ${d.name}`, district: d.id }); });
  // the Pit: SSX.fight.status().at (Ares Junction coords)
  tryv(() => { const a = X().fight?.status?.()?.at; add('pit', aj(a), { name: 'The Pit (fight club)' }); });
  // Danny's club: the Velvet Airlock door
  tryv(() => { const d = world()?.doorFor?.('velvet') || world()?.doorFor?.('club'); add('club', d && C.fin(d.x) ? { x: d.x, z: d.z } : aj([-30, -27]), { name: "Danny's club · Velvet Airlock" }); });
  // owned turf: SSX.turf.blocks() owner 'player', at the flag
  tryv(() => { for (const b of X().turf?.blocks?.() || []) if (b.owner === 'player') add('turf', aj(b.flag), { id: 'turf:' + b.id, name: `Your turf · ${b.name}` }); });
  return out;
}
let cache = { t: -1e9, list: [] };
function places(force) { const n = performance.now(); if (force || n - cache.t > 1000) cache = { t: n, list: C.normPlaces(rawPlaces()) }; return cache.list; }
// hudmap.js list hook: the places as map markers (cat 'places' always shows; sub line says the fee)
function mapPlaces() { return onMars() ? places(true).map(p => ({ id: 'ft:' + p.id, ft: p.id, cat: 'places', icon: p.icon, name: p.name, sub: `Fast travel · ${p.fee ? p.fee + ' cr' : 'free'}`, x: p.x, z: p.z })) : []; }

// ---------- can you go? ----------
function ctx(place) {
  const s = app()?.state || {}, m = md(), q = tryv(() => surf()?.game?.info?.quest);
  return {
    onMars: onMars(), flying: !!s.flying && !s.onSurface, // the space-flight flag stays on after you land busy: !!busy || !!(surf()?.info?.intro > 0),
    wanted: +(world()?.wanted || 0),
    smuggling: !!tryv(() => X().smuggle?.state?.run),
    heist: !!tryv(() => X().heist?.active),
    race: !!tryv(() => window.__race?.state),
    turf: !!tryv(() => X().turf?.fight?.()),
    beltway: !!tryv(() => X().beltway?.active?.()),
    job: !!tryv(() => X().jobs?.active?.()),
    mission: !!tryv(() => window.__activities?.active) || !!(q && q.timer != null),
    credits: +(tryv(() => surf()?.game?.progress?.credits, 0) || 0),
    here: m ? { x: m.x, z: m.z } : null, place
  };
}
const why = place => C.blockReason(ctx(place));

// ---------- the hop ----------
let busy = false, fadeEl = null, frames = null, last = null;
function fade(on) {
  if (!fadeEl) { fadeEl = document.createElement('div'); fadeEl.id = 'ftFade'; fadeEl.style.cssText = `position:fixed;inset:0;z-index:60;background:#000;opacity:0;pointer-events:none;transition:opacity ${C.FADE_MS}ms ease`; document.body.appendChild(fadeEl); }
  fadeEl.style.pointerEvents = on ? 'auto' : 'none'; void fadeEl.offsetWidth; fadeEl.style.opacity = on ? '1' : '0';
  return new Promise(r => setTimeout(r, C.FADE_MS + 20));
}
const nextFrames = n => new Promise(r => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
// frame timer: dt of every frame from 1 s before the hop to 2 s after it, split at the arrival
function frameRec() {
  const rec = { before: [], after: [], arrivedAt: 0 }; let lastT = performance.now(), end = Infinity;
  const f = t => { const dt = t - lastT; lastT = t; (rec.arrivedAt ? rec.after : rec.before).push(dt); if (t < end) requestAnimationFrame(f); };
  requestAnimationFrame(f); rec.arrive = () => { rec.arrivedAt = performance.now(); end = rec.arrivedAt + 2000; }; return rec;
}
function spot(p) {
  const s = surf(), drv = !!md()?.driving; let x = p.x, z = p.z;
  // a little south of the marker so you don't land inside the beacon / door / stall; then the world's own free-spot nudge
  z += drv ? 6 : 3;
  const c = tryv(() => world()?.collide?.(x, z, drv ? 2.5 : 0.6)); if (c && C.fin(c.x) && C.fin(c.z)) { x = c.x; z = c.z; }
  return { x, z, drv, s };
}
async function travel(id) {
  const p = places(true).find(q => q.id === id || q.kind === id); if (!p) { toast('🚀 That place is not on this map.'); return { ok: false, why: 'unknown' }; }
  const w = why(p); if (w) { toast(`🚀 ${w}`, 2800); return { ok: false, why: w }; }
  if (p.fee > 0) { const g = surf()?.game, ok = tryv(() => (g?.spend ? g.spend(p.fee) : app()?.game?.spend?.(p.fee)), false); if (!ok) { toast(`🚀 You need ${p.fee} cr.`); return { ok: false, why: 'broke' }; } }
  busy = true; frames = frameRec();
  try {
    tryv(() => X().hudx?.closeMap?.());
    await fade(true);
    const { x, z, drv, s } = spot(p);
    // districts go through the surface's own district hop (moves your car with you); everything else through debugMove,
    // which moves the car when you're driving and you when you're on foot
    let moved = false;
    if (p.kind !== 'base' && ['downtown', 'rough', 'gated'].includes(p.kind)) { const r = tryv(() => s.fastTravel?.(p.kind === 'downtown' ? 'mars-downtown' : p.kind === 'rough' ? 'mars-rough' : 'mars-gated')); moved = !!r?.ok; }
    if (!moved) moved = !!tryv(() => s.debugMove(x, z, Math.PI), false);
    frames.arrive();
    await nextFrames(C.HOLD_FRAMES); // stay black while the new chunks and NPC slots settle in
    await fade(false);
    last = { id: p.id, name: p.name, fee: p.fee, x, z, driving: drv, moved, t: Date.now() };
    toast(`🚀 ${p.name}${p.fee ? ` · −${p.fee} cr` : ''}`, 2000); emit('travel', last);
    return { ok: moved, ...last };
  } finally { busy = false; }
}

// ---------- the sheet inside the map ----------
let sheet = null, cur = null;
const css = `#ftSheet{position:absolute;left:calc(8px + env(safe-area-inset-left));right:calc(8px + env(safe-area-inset-right));bottom:calc(8px + env(safe-area-inset-bottom));z-index:3;display:none;flex-direction:column;gap:6px;padding:10px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:600 14px system-ui,sans-serif;box-shadow:0 -4px 24px rgba(0,0,0,.6)}
#ftSheet.on{display:flex} #ftSheet .nm{font:800 16px system-ui,sans-serif} #ftSheet .why{font-size:12px;color:#ffd400} #ftSheet .why:empty{display:none}
#ftSheet .row{display:flex;gap:6px} #ftSheet button{min-height:44px;min-width:44px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 15px system-ui,sans-serif;touch-action:manipulation;padding:0 12px}
#ftSheet #ftGo{flex:1} #ftSheet button[aria-disabled="true"]{border-style:dashed;border-color:#777}`;
// real tap only: same pointerId, < TAP_PX moved (max over the gesture); keyboard / mouse click still work
function realTap(el, fn) {
  let down = null, maxMove = 0, lastTouch = 0;
  el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; down = { id: e.pointerId, x: e.clientX, y: e.clientY }; maxMove = 0; });
  el.addEventListener('pointermove', e => { if (down && e.pointerId === down.id) maxMove = Math.max(maxMove, Math.hypot(e.clientX - down.x, e.clientY - down.y)); });
  el.addEventListener('pointercancel', e => { if (down && e.pointerId === down.id) down = null; });
  el.addEventListener('pointerup', e => { if (!down || e.pointerType === 'mouse') return; const d = down; down = null; lastTouch = performance.now();
    if (!C.isRealTap(d, { id: e.pointerId, x: e.clientX, y: e.clientY }, maxMove)) { taps.swipes++; return; } e.preventDefault(); taps.fired++; fn(e); });
  el.addEventListener('click', e => { if (performance.now() - lastTouch < 700) return; fn(e); });
}
const taps = { fired: 0, swipes: 0, blocked: 0 };
function ensureSheet(map) {
  if (sheet && sheet.parentNode === map) return sheet;
  if (!document.getElementById('ftCss')) { const st = document.createElement('style'); st.id = 'ftCss'; st.textContent = css; document.head.appendChild(st); }
  sheet = document.createElement('div'); sheet.id = 'ftSheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Fast travel');
  sheet.innerHTML = '<div class="nm"></div><div class="sub"></div><div class="why"></div><div class="row"><button id="ftGo" type="button">🚀 Travel here</button><button id="ftWp" type="button" aria-label="Set waypoint">📍</button><button id="ftX" type="button" aria-label="Close">✕</button></div>';
  map.appendChild(sheet);
  realTap(sheet.querySelector('#ftGo'), () => { if (!cur) return; const w = why(cur); if (w) { taps.blocked++; toast(`🚀 ${w}`, 2800); paint(); return; } const id = cur.id; hide(); travel(id); });
  realTap(sheet.querySelector('#ftWp'), () => { if (!cur) return; tryv(() => X().hudx?.setWaypoint?.({ x: cur.x, z: cur.z, label: cur.name })); hide(); tryv(() => X().hudx?.closeMap?.()); });
  realTap(sheet.querySelector('#ftX'), () => hide());
  return sheet;
}
function paint() {
  if (!sheet || !cur) return; const w = why(cur);
  sheet.querySelector('.nm').textContent = `${cur.icon} ${cur.name}`;
  sheet.querySelector('.sub').textContent = cur.fee ? `Fast travel · ${cur.fee} cr` : 'Fast travel · free';
  sheet.querySelector('.why').textContent = w || '';
  const go = sheet.querySelector('#ftGo'); go.setAttribute('aria-disabled', w ? 'true' : 'false'); go.textContent = cur.fee ? `🚀 Travel here · ${cur.fee} cr` : '🚀 Travel here · free';
}
function hide() { cur = null; sheet?.classList.remove('on'); }
// hudmap.js tap hook: true = it's a known place, the sheet is up (hudmap skips its waypoint)
function offer(p) {
  if (!onMars()) return false;
  const q = C.matchPlace(p, places(true)); if (!q) return false;
  const map = document.getElementById('hxMap'); if (!map) return false;
  ensureSheet(map); cur = q; paint(); sheet.classList.add('on'); emit('offer', { id: q.id });
  return true;
}

// ---------- swipe guard for the whole map: a pointerup that moved >= TAP_PX (or is a different finger) never reaches hudmap's taps ----------
const gest = new Map(); let swallowUntil = 0;
const inMap = e => !!(e.target?.closest && e.target.closest('#hxMap'));
addEventListener('pointerdown', e => { if (inMap(e) && e.pointerType !== 'mouse') gest.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY, max: 0 }); }, true);
addEventListener('pointermove', e => { const g = gest.get(e.pointerId); if (g) g.max = Math.max(g.max, Math.hypot(e.clientX - g.x, e.clientY - g.y)); }, true);
addEventListener('pointercancel', e => { gest.delete(e.pointerId); }, true);
addEventListener('pointerup', e => {
  if (e.pointerType === 'mouse' || !inMap(e)) { gest.delete(e.pointerId); return; }
  const g = gest.get(e.pointerId); gest.delete(e.pointerId);
  if (g && C.isRealTap(g, { id: e.pointerId, x: e.clientX, y: e.clientY }, g.max)) return;
  if (sheet && sheet.contains(e.target)) return; // the sheet's own buttons count it themselves
  e.stopPropagation(); swallowUntil = performance.now() + 700; guard.swallowed++;
}, true);
addEventListener('click', e => { if (performance.now() < swallowUntil && inMap(e) && e.isTrusted) { e.stopPropagation(); e.preventDefault(); swallowUntil = 0; } }, true);
const guard = { swallowed: 0 };
// the sheet goes away with the map
new MutationObserver(() => { const m = document.getElementById('hxMap'); if (cur && m && !m.classList.contains('on')) hide(); }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

// ---------- warm-up: build the place list once on landing so the first map tap costs nothing ----------
let warmed = false;
setInterval(() => { attach(); if (onMars()) { if (!warmed) { warmed = true; places(true); } } else warmed = false; }, 1000);

// ---------- API ----------
const subs = new Set();
function emit(type, d) { for (const f of subs) { try { f(type, d); } catch (e) { /* */ } } }
const API = {
  places: () => places(true).map(p => ({ ...p })), mapPlaces, offer, travel, why: id => { const p = places(true).find(q => q.id === id || q.kind === id); return p ? why(p) : 'unknown'; },
  fee: C.FEE, get busy() { return busy; }, get last() { return last ? { ...last } : null; },
  on(fn) { if (typeof fn !== 'function') return () => {}; subs.add(fn); return () => subs.delete(fn); },
  debug: { log: () => log.slice(), taps: () => ({ ...taps, ...guard }), frames: () => frames ? { before: C.frameStats(frames.before), after: C.frameStats(frames.after), afterRaw: frames.after.slice(0, 40).map(v => Math.round(v * 10) / 10) } : null, sheet: () => cur ? { id: cur.id, why: why(cur) } : null, hide }
};
// index.html replaces window.SSX = {...} after the module imports run, so re-attach until it sticks (and if it is ever replaced again)
const attach = () => { const w = window; if (!w.SSX) w.SSX = {}; if (w.SSX.fastTravel !== API) w.SSX.fastTravel = API; };
attach(); (function boot(n = 0) { attach(); if (n < 100 && !window.__app) setTimeout(() => boot(n + 1), 100); })();
