// v7.5 Red Tape Flats street life (Snuffles): the district's outdoor underworld, loaded only while you are in or near
// Red Tape Flats and disposed when you leave (phones only pay for it when they are standing in it).
//   graffiti     find or buy spray cans, tag the marked walls, earn street cred; ColSec may see you (wanted via the
//                existing system); rival crews (Saltblood / Dustjaw Boys / Vacuum Saints) paint over your pieces
//   barrels      burn-barrel crowds at night (SSX.time.isNight, with a Mars-clock fallback): fire, smoke, chatter, fights
//   dealers      street dealers sell SSX.contraband product at a corner markup; junkies beg, buy and nod off
//   tow yard     HOOK & CROOK TOWING: sell or strip a stolen ride, buy a hot ride with no plates (SSX.garage), and
//                Lou's tow truck hooks your rover if you leave it parked in the Flats
// Every cross-module call is feature-detected and no-ops when the module is missing. Public API: window.SSX.street
// (docs: mars/street.md). All fiction, all brands made up, all art drawn at runtime.
import * as THREE from 'three';
import { marsHour } from '../dangercore.js';
import { LINES, pick } from './street-lines.js';
import { createTags } from './street-tags.js';
import { createCrowds } from './street-crowds.js';
import { createTow } from './street-tow.js';

const DISTRICT = 'mars-rough', CDIST = 'red-tape-flats', AJ0 = [-280, -40]; // district-local -> AJ-relative offset
const LOAD_R = 170, UNLOAD_R = 230;
const PHONE = typeof window !== 'undefined' && (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || Math.min(innerWidth, innerHeight) < 600 || matchMedia?.('(pointer: coarse)')?.matches);

// ---------- persistent state ----------
const LS = 'ssx.street.v1';
const S0 = () => ({ v: 1, tag: 'NOBODY', style: 0, cans: 0, cred: 0, tags: {}, canAt: {}, impound: null, seen: 0, stats: { tagged: 0, covered: 0, lost: 0, spotted: 0, bought: 0, sold: 0, begged: 0, fights: 0, towed: 0, fenced: 0, stripped: 0, hot: 0 } });
let ST = S0();
try { const s = JSON.parse(localStorage.getItem(LS) || 'null'); if (s?.v === 1) ST = { ...S0(), ...s, stats: { ...S0().stats, ...(s.stats || {}) } }; } catch (e) { /* private mode */ }
const save = () => { ST.seen = Date.now(); try { localStorage.setItem(LS, JSON.stringify(ST)); } catch (e) { /* private mode */ } };

// ---------- guarded helpers ----------
const X = () => window.SSX || {};
const surf = () => window.__app?.surface, game = () => window.__app?.surface?.game, world = () => window.__app?.surface?.world;
const toast = (t, ms = 3000) => { try { (X().city?.toast || window.__app?.toast)?.(t, ms); } catch (e) { /* no HUD */ } };
const wanted = () => { try { return X().city?.wanted ?? world()?.wanted ?? 0; } catch (e) { return 0; } };
const credits = () => game()?.progress?.credits ?? 0;
function pay(n, xp = 0) { const g = game(); n = Math.round(n); if (!g || n <= 0) return 0; if (g.reward) g.reward(xp, n); else { g.progress.credits += n; g.save?.(); } return n; }
function take(n) { const g = game(); n = Math.round(n); if (!g || n <= 0) return true; if (credits() < n) return false; if (g.spend) return !!g.spend(n); g.progress.credits -= n; g.save?.(); return true; }
function crime(n, why) { // the existing wanted system: world.crime when present (adds on top), else setWanted(max)
  try { const w = world(); if (w?.crime) return w.crime(n, why); const s = X().city?.setWanted || w?.setWanted; s?.(Math.max(wanted(), n), why); } catch (e) { console.warn('street crime', e); }
}
function emit(type, detail) { try { X().emit?.('street:' + type, detail); } catch (e) { /* bus optional */ } try { window.dispatchEvent(new CustomEvent('ssx:street', { detail: { type, ...detail } })); } catch (e) { /* */ } }
function rep(id, d, why) { try { const R = X().rep; if (R?.add) R.add(id, d, why); } catch (e) { /* SSX.rep (#20) optional */ } }
let nightOv = null;
function night() {
  if (nightOv != null) return nightOv;
  try { const T = X().time; if (typeof T?.isNight === 'function') return !!T.isNight(); } catch (e) { /* SSX.time (#30) optional */ }
  const h = marsHour(); return h >= 21 || h < 5;
}
let barksReg = false;
function regBarks() { if (barksReg) return true; const R = X().registerBarks; if (typeof R !== 'function') return false; try { for (const c in LINES) R('street_' + c, LINES[c]); barksReg = true; } catch (e) { console.warn('street barks', e); } return barksReg; }
let lastToast = 0;
function say(at, name, cat, { toastToo = false, quiet = false } = {}) {
  const B = X().bark; let line = null;
  if (at && typeof B === 'function') { regBarks(); try { line = B({ x: at.x, z: at.z, kind: 'street', name }, barksReg ? 'street_' + cat : pick(LINES[cat]), { force: true }); } catch (e) { console.warn('street bark', e); } }
  if (!line) { line = pick(LINES[cat] || ['...']); if (!quiet || performance.now() - lastToast > 9000) { lastToast = performance.now(); toast(`${name}: ${line}`, 3200); } } else if (toastToo) toast(`${name}: ${line}`, 3200);
  return line;
}

// ---------- UI: black/white, 44px+ buttons through window.__onTap ----------
const CSS = `#stAct{position:fixed;z-index:13;left:calc(10px + env(safe-area-inset-left));top:50%;display:none;min-height:52px;min-width:140px;max-width:62vw;padding:0 16px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:800 15px system-ui,sans-serif;touch-action:manipulation;text-align:left}
#stAct.show{display:block}body.indoors #stAct{display:none!important}#stAct:active{background:#fff;color:#000}
#stPanel{position:fixed;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:70;width:min(94vw,440px);max-height:72vh;overflow:auto;background:#000;color:#fff;border:2px solid #fff;border-radius:6px;padding:14px 14px 10px;font:15px/1.35 system-ui,sans-serif;box-shadow:0 0 0 4px #000}
#stPanel h3{margin:0 0 6px;font:800 13px/1.2 system-ui;letter-spacing:.14em;text-transform:uppercase}#stPanel p{margin:0 0 10px;color:#ddd}#stPanel .q{font-style:italic;color:#fff}
#stPanel button{display:block;width:100%;min-height:48px;margin:0 0 8px;padding:10px 12px;background:#000;color:#fff;border:2px solid #fff;border-radius:4px;font:700 15px system-ui;text-align:left;touch-action:manipulation}
#stPanel button:active{background:#fff;color:#000}#stPanel button[disabled]{opacity:.4}#stPanel button.alt{border-style:dashed;color:#bbb}#stPanel small{display:block;color:#999;margin:-4px 0 8px}
#stChip{position:fixed;z-index:12;right:calc(10px + env(safe-area-inset-right));top:calc(108px + env(safe-area-inset-top));display:none;padding:6px 10px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 12px system-ui;pointer-events:none}#stChip.show{display:block}body.indoors #stChip{display:none!important}`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function onTap(el, fn) { if (window.__onTap) window.__onTap(el, fn); else el.addEventListener('click', fn); }
function css() { if (document.getElementById('stCss')) return; const s = document.createElement('style'); s.id = 'stCss'; s.textContent = CSS; document.head.appendChild(s); }
let panel = null, panelRe = null;
// buttons: [{ label, sub?, fn, alt?, disabled? }]; fn returning true keeps the panel open (it is re-rendered through reopen)
function openPanel(title, text, buttons, quote, reopen = null) {
  css(); closePanel(); panelRe = reopen;
  panel = document.createElement('div'); panel.id = 'stPanel'; panel.setAttribute('role', 'dialog');
  panel.innerHTML = `<h3>${esc(title)}</h3>${quote ? `<p class="q">\u201c${esc(quote)}\u201d</p>` : ''}${text ? `<p>${esc(text)}</p>` : ''}`;
  for (const b of [...buttons, { label: 'Walk away', alt: true, fn: () => {} }]) {
    const e = document.createElement('button'); e.textContent = b.label; if (b.alt) e.className = 'alt'; if (b.disabled) e.disabled = true; panel.appendChild(e);
    if (b.sub) { const s = document.createElement('small'); s.textContent = b.sub; panel.appendChild(s); }
    onTap(e, () => { if (e.disabled) return; let keep = false; try { keep = b.fn?.(); } catch (er) { console.warn('street panel', er); } if (keep === true && panelRe) panelRe(); else if (keep !== true) closePanel(); });
  }
  document.body.appendChild(panel); if (document.pointerLockElement) document.exitPointerLock?.();
  return panel;
}
function closePanel() { if (panel) { panel.remove(); panel = null; } panelRe = null; }
let actBtn = null, chip = null, act = null;
function ensureUI() {
  if (actBtn) return; css();
  actBtn = document.createElement('button'); actBtn.id = 'stAct'; actBtn.type = 'button'; document.body.appendChild(actBtn);
  onTap(actBtn, () => { const a = act; if (a) try { a.fn(); } catch (e) { console.warn('street act', e); } });
  chip = document.createElement('div'); chip.id = 'stChip'; document.body.appendChild(chip);
  addEventListener('keydown', e => { if (e.code === 'KeyY' && !e.repeat && act && actBtn.classList.contains('show') && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) { e.preventDefault(); try { act.fn(); } catch (er) { console.warn(er); } } });
}
function showAct(a) { act = a; if (!actBtn) return; if (!a) { actBtn.classList.remove('show'); return; } const l = a.label + (PHONE ? '' : '  [Y]'); if (actBtn.textContent !== l) actBtn.textContent = l; actBtn.classList.add('show'); }
function showChip(t) { if (!chip) return; if (!t) { chip.classList.remove('show'); return; } if (chip.textContent !== t) chip.textContent = t; chip.classList.add('show'); }

// ---------- shared kit for the parts ----------
const SH = {}; // shared geometry
function geo() { if (SH.box) return SH; SH.box = new THREE.BoxGeometry(1, 1, 1); SH.cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 12); SH.cyl6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6); SH.sph = new THREE.SphereGeometry(0.5, 10, 8); SH.plane = new THREE.PlaneGeometry(1, 1); SH.torus = new THREE.TorusGeometry(0.5, 0.18, 6, 12); for (const k in SH) SH[k].userData.shared = true; return SH; }
const credTitle = c => c >= 400 ? 'King of the Flats' : c >= 150 ? 'Writer' : c >= 50 ? 'Up-and-comer' : 'Toy';
let live = null, D = null, T = 0, lastPhone = null, reserved = 0;
const K = {
  THREE, PHONE, DISTRICT, CDIST, ST, save, X, surf, game, world, toast, say, wanted, credits, pay, take, crime, emit, rep, night, pick, LINES,
  openPanel, closePanel, get panelOpen() { return !!panel; },
  get D() { return D; }, get T() { return T; },
  // district-local metres -> world {x, y, z}; AJ-relative [x, z] for SSX.contraband / SSX.turf
  hgt(x, z) { try { const y = live?.height ? live.height(x, z) : X().city?.height?.(x, z); return Number.isFinite(y) ? y : 0; } catch (e) { return 0; } },
  L(lx, lz, dy = 0) { const x = D.x + lx, z = D.z + lz; return { x, y: K.hgt(x, z) + dy, z }; },
  AJ: (lx, lz) => [AJ0[0] + lx, AJ0[1] + lz], ajOfWorld: (x, z) => [AJ0[0] + x - D.x, AJ0[1] + z - D.z],
  geo, mats: {},
  mat(key, o) { return K.mats[key] ||= new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o }); },
  box(par, m, x, y, z, sx, sy, sz, ry = 0, g = geo().box) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.y = ry; o.matrixAutoUpdate = false; o.updateMatrix(); par.add(o); return o; },
  cred(n, why) { ST.cred = Math.max(0, ST.cred + n); save(); emit('cred', { cred: ST.cred, delta: n, why }); return ST.cred; },
  credTitle, // NPC budget: phones stay <= 12 people with world colonists (>= 4), security on foot, game humans and other reservations
  budget(want) {
    let others = 0, hum = 0, foot = 0;
    try { const b = X().city?.npcBudget?.() || world()?.npcBudget?.(); if (b?.reserved) for (const k in b.reserved) if (k !== 'street') others += b.reserved[k]; } catch (e) { /* */ }
    try { hum = game()?.humanCount?.() || 0; } catch (e) { /* */ }
    try { foot = (world()?.securityList?.() || []).filter(s => s.foot).length; } catch (e) { /* */ }
    const ex = K.extra || 0; // Lou at the tow yard counter is always on while the district is loaded
    return PHONE ? Math.max(0, Math.min(want, 5 - ex, 12 - 4 - others - hum - foot - ex)) : Math.max(0, Math.min(want, 16, 40 - 8 - others - hum - foot - ex));
  },
  reserve(n) { if (n === reserved) return; reserved = n; try { (X().city?.npcReserve || world()?.npcReserve)?.('street', n); } catch (e) { /* */ } },
  extra: 0,
  player: null // filled every frame: { x, z, y, driving, stolen, kind, speed, inside, rover, car, ctx }
};

const parts = [createTags(K), createCrowds(K), createTow(K)];
const [TAGS, CROWDS, TOW] = parts;

function findDistrict(w) { try { return (w?.districts?.() || []).find(d => d.id === DISTRICT) || null; } catch (e) { return null; } }
function load(c) {
  const root = new THREE.Group(); root.name = 'streetLife'; root.userData.street = true; c.scene.add(root);
  live = { root, scene: c.scene, height: c.height, at: Date.now() }; ensureUI();
  for (const p of parts) { try { p.build(root); } catch (e) { console.warn('street build', e); } }
  emit('load', { district: DISTRICT });
}
function unload() {
  if (!live) return; for (const p of parts) { try { p.dispose(); } catch (e) { console.warn('street dispose', e); } }
  const r = live.root; r.parent?.remove(r);
  r.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) if (!Object.values(K.mats).includes(m)) m.dispose?.(); });
  for (const k in K.mats) { K.mats[k].dispose(); delete K.mats[k]; }
  live = null; K.reserve(0); showAct(null); showChip(null); closePanel(); try { X().minimap?.clear?.('street'); } catch (e) { /* */ }
  emit('unload', {});
}
let markT = 0;
function marks() {
  const M = []; for (const p of parts) { try { M.push(...(p.marks?.() || [])); } catch (e) { /* */ } }
  try { X().minimap?.addMarks?.('street', M); } catch (e) { /* */ }
}
function tick(dt, c) {
  if (window.SSX && window.SSX.street !== API) window.SSX.street = API;
  if (c.name !== 'Mars') { if (live) unload(); return; }
  if (!D || D.__w !== c.world) { D = findDistrict(c.world); if (D) D.__w = c.world; }
  if (!D) return;
  const car = c.car, src = car || c.player, d = Math.hypot(src.x - D.x, src.z - D.z);
  if (!live && d < LOAD_R) load(c); else if (live && d > UNLOAD_R) unload();
  for (const p of parts) { try { p.always?.(dt, c, !!live); } catch (e) { console.warn('street always', e); } }
  if (!live) return;
  dt = Math.min(0.1, dt); T += dt;
  const inside = !!c.world?.inside;
  K.player = { x: src.x, z: src.z, y: src.y ?? c.height(src.x, src.z), yaw: car ? car.yaw : c.player.yaw, driving: !!car, stolen: !!car && car !== c.rover, kind: car ? (car.kind || 'rover') : null, speed: car ? Math.abs(car.speed || 0) : 0, inside, rover: c.rover, car, ctx: c, d };
  live.root.visible = !inside;
  let best = null;
  for (const p of parts) { try { p.tick(dt, T, K.player); if (!inside && !panel) for (const a of p.acts?.(K.player) || []) if (!best || a.d < best.d) best = a; } catch (e) { console.warn('street tick', e); } }
  showAct(inside || panel ? null : best);
  showChip(inside || d > 75 ? null : `\ud83c\udfa8 ${ST.cans} \u00b7 cred ${ST.cred}`);
  if ((markT -= dt) <= 0) { markT = 1.5; marks(); }
}
(function hook() {
  let tries = 0; const t = setInterval(() => {
    const R = window.SSX?.registerSurfaceTick; if (typeof R === 'function') { clearInterval(t); window.SSX.street = API; try { R(tick); } catch (e) { console.warn('street hook', e); } regBarks(); }
    else if (++tries > 600) clearInterval(t);
  }, 250);
})();

// ---------- public API: window.SSX.street ----------
const API = {
  get loaded() { return !!live; }, get district() { return DISTRICT; },
  get cred() { return ST.cred; }, get title() { return credTitle(ST.cred); }, get cans() { return ST.cans; },
  addCans(n = 1) { ST.cans = Math.max(0, Math.min(20, ST.cans + (n | 0))); save(); return ST.cans; },
  get tagName() { return ST.tag; }, setTag(text) { const t = String(text || '').toUpperCase().replace(/[^A-Z0-9 .!-]/g, '').slice(0, 10).trim(); if (!t) return ST.tag; ST.tag = t; save(); TAGS.retexture?.(); return t; },
  isNight: () => night(), setNight(v) { nightOv = v == null ? null : !!v; return night(); },
  tags: () => TAGS.list(), tag: id => TAGS.tagAt(id), rivalPaint: id => TAGS.rival(id),
  crowds: () => CROWDS.list(), npcs: () => CROWDS.npcs(), fight: i => CROWDS.fight(i),
  tow: { get impound() { return ST.impound ? { ...ST.impound } : null; }, hook: () => TOW.hook(true), pay: () => TOW.payImpound(), yard: () => TOW.yard(), quote: () => TOW.quote(), sell: () => TOW.sell(false), strip: () => TOW.sell(true), buyHot: kind => TOW.buyHot(kind), stock: () => TOW.stock() },
  stats: () => ({ ...ST.stats }), state: () => JSON.parse(JSON.stringify(ST)),
  on(fn) { const h = e => fn(e.detail); addEventListener('ssx:street', h); return () => removeEventListener('ssx:street', h); },
  reset() { const t = ST.tag; Object.assign(ST, S0(), { tag: t }); save(); TAGS.refresh?.(); return true; },
  debug: { forceSeen(p) { if (p == null) delete ST.forceSeen; else ST.forceSeen = +p; return ST.forceSeen ?? null; }, act: () => act ? act.label : null, doAct: () => { if (act) { act.fn(); return true; } return false; }, budget: w => K.budget(w), reserved: () => reserved, panel: () => panel ? panel.textContent : null, tap: label => { const b = panel && [...panel.querySelectorAll('button')].find(x => x.textContent.startsWith(label)); if (!b) return false; b.click(); return true; }, close: () => closePanel(), local: (x, z) => D ? [x - D.x, z - D.z] : null, world: (lx, lz) => D ? K.L(lx, lz) : null, parts: () => ({ tags: TAGS.debug?.(), crowds: CROWDS.debug?.(), tow: TOW.debug?.() }) }
};
window.SSX = window.SSX || {};
window.SSX.street = API;
export default API;
