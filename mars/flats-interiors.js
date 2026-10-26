// v7.5 Red Tape Flats interiors (Snuffles): four walk-in dives on the existing v7.3 interior framework (interiors.js
// registerInterior + the colony door system), placed as district-local blocks in Red Tape Flats like marsshops (PR #10).
//   RESTWELL BUNKS   flophouse: rent a bunk from Rooney, sleep to save and heal a bit, maybe get robbed overnight
//   BAY SIX DENTAL   chop clinic: Doc Varga patches you up for cash, no questions, wanted surcharge, never adds wanted
//   GOLD STAR PAWN   fence: Benny buys stolen goods (heist/safe loot + Marsmania stash goods) at a lowball, haggling;
//                    caged counter, and he has a sawed-off for anyone who pulls a gun
//   RINSE & REPEAT   laundromat front: Knuckles on the back door, Auntie Ro washes dirty cash for a cut
// Set dressing is built on enter and disposed on exit (phones only pay for the room you are standing in). Barks go
// through SSX.bark / registerBarks when Pumpkin's audio is loaded, grime scales with SSX.grime when present.
// Public API: window.SSX.flats (see README in mars/flats-interiors.md). All fiction, all brands made up.
import * as THREE from 'three';
import '../city.js'; // the Mars districts must be registered before we add storefronts to Red Tape Flats
import { registerInterior } from '../interiors.js';
import { districtsOf } from '../world.js';
import { ROOMS, KINDS, makeKit, deadPose } from './flats-interiors-rooms.js';
import { LINES, pick } from './flats-interiors-lines.js';

// ---------- storefronts (district-local metres in Red Tape Flats, centre [-280,-40] from Ares Junction) ----------
// Clear of the core blocks, Jeff's #10 shops (SCRAP & SLUG -20,-10 / THRIFT LOCK 42,-8 / DOC GRIM'S -6,-24 / ASHES 8,28),
// the grime shanties (#21) and the pad/vehicle slots. Doors face south (+z) like every block.
export const PLACES = {
  flats_flop: { sign: 'RESTWELL BUNKS', color: 0xffb040, at: [-44, 28, 10, 6, 5], title: 'RESTWELL BUNKS · FLOPHOUSE', who: 'Rooney' },
  flats_clinic: { sign: 'BAY SIX DENTAL', color: 0x6aff9a, at: [36, -28, 7, 5, 4], title: 'BAY SIX DENTAL · WALK-INS', who: 'Doc Varga' },
  flats_pawn: { sign: 'GOLD STAR PAWN', color: 0xffd040, at: [-36, -34, 8, 5, 4.5], title: 'GOLD STAR PAWN & LOAN', who: 'Benny' },
  flats_laund: { sign: 'RINSE & REPEAT', color: 0x40e0ff, at: [28, 40, 9, 5, 4], title: 'RINSE & REPEAT COIN-OP', who: 'Auntie Ro' }
};
const DISTRICT = 'mars-rough';
let placed = 'none';
(function placeBlocks() {
  try {
    const def = (districtsOf('Mars') || []).find(d => d?.id === DISTRICT);
    if (!def || !Array.isArray(def.blocks)) return;
    if (def.__flatsInt) { placed = 'district'; return; } def.__flatsInt = true;
    for (const k of KINDS) { const P = PLACES[k], [x, z, w, d, h] = P.at; def.blocks.push([x, z, w, d, h, P.sign, P.color, k, P.title]); }
    placed = 'district';
  } catch (e) { console.warn('flats-interiors: placement', e); }
})();

// ---------- persistent state ----------
const LS = 'ssx.flats.v1';
const S0 = () => ({ v: 1, dirty: 0, hot: [], barredUntil: 0, deadUntil: 0, bloodAt: 0, stats: { slept: 0, robbed: 0, lost: 0, patched: 0, fenced: 0, fencedCr: 0, laundered: 0, kicks: 0 } });
let ST = S0();
try { const s = JSON.parse(localStorage.getItem(LS) || 'null'); if (s?.v === 1) ST = { ...S0(), ...s, stats: { ...S0().stats, ...(s.stats || {}) } }; } catch (e) { /* private mode */ }
const save = () => { try { localStorage.setItem(LS, JSON.stringify(ST)); } catch (e) { /* private mode */ } };
let hotSeq = Date.now() % 100000;

// ---------- small helpers ----------
const app = () => window.__app, surf = () => window.__app?.surface, game = () => window.__app?.surface?.game;
const SSX = () => window.SSX || {};
const now = () => performance.now() / 1000;
const toast = (t, ms = 3000) => { try { (SSX().city?.toast || app()?.toast)?.(t, ms); } catch (e) { console.warn(e); } };
const wanted = () => { try { return SSX().city?.wanted ?? surf()?.world?.wanted ?? 0; } catch (e) { return 0; } };
const credits = () => game()?.progress?.credits ?? 0;
const pay = n => { const g = game(); if (!g || n <= 0) return; g.progress.credits += Math.round(n); g.save?.(); };
const take = n => { const g = game(); if (!g || n <= 0) return 0; const t = Math.min(g.progress.credits, Math.round(n)); g.progress.credits -= t; g.save?.(); return t; };
const health = () => { const i = game()?.info; return i ? { hp: i.hp, max: i.hpMax, sh: i.shield, smax: i.shieldMax } : { hp: 100, max: 100, sh: 0, smax: 0 }; };
// heal: there is no public partial-heal API (see API gaps); the debug health object is the only handle, restore() is full
function heal(n) { const g = game(); if (!g) return false; const H = g.debug?.H?.(); if (H && isFinite(H.hp)) { H.hp = Math.max(1, Math.min(H.max, H.hp + n)); return true; } if (n > 0) { g.restore?.(); return true; } return false; }
const GRIME = { off: 0, light: 0.4, med: 0.7, max: 1 };
function grime() { const G = SSX().grime; if (!G) return 0.7; if (G.enabled === false) return 0; const l = G.level; return typeof l === 'number' ? Math.min(1.5, l) : GRIME[l] ?? 0.7; }
const inKind = () => surf()?.info?.inside?.kind || null;
const round5 = n => Math.max(5, Math.round(n / 5) * 5);
function emit(type, detail) { try { SSX().emit?.('flats:' + type, detail); } catch (e) { /* bus optional */ } try { window.dispatchEvent(new CustomEvent('flats:' + type, { detail })); } catch (e) { /* */ } }

// ---------- barks (SSX.bark when Pumpkin's audio is up, else a toast) ----------
let barksReg = false;
function regBarks() { if (barksReg) return true; const R = SSX().registerBarks; if (typeof R !== 'function') return false; try { for (const c in LINES) R('flats_' + c, LINES[c]); barksReg = true; } catch (e) { console.warn('flats barks', e); } return barksReg; }
function say(p, name, cat, { toastToo = false } = {}) {
  const ins = surf()?.info?.inside, B = SSX().bark; let line = null;
  if (p && ins && typeof B === 'function') { regBarks(); try { line = B({ x: ins.ax + p.x, z: ins.az + p.z, kind: 'flats', name }, barksReg ? 'flats_' + cat : pick(LINES[cat]), { force: true }); } catch (e) { console.warn('flats bark', e); } }
  if (!line) { line = pick(LINES[cat]); toast(`${name}: ${line}`, 3200); } else if (toastToo) toast(`${name}: ${line}`, 3200);
  return line;
}

// ---------- UI: one black/white panel, 44px+ buttons via window.__onTap (built on open, removed on close) ----------
let panel = null, fade = null;
const CSS = `#flatsPanel{position:fixed;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:70;width:min(94vw,440px);max-height:72vh;overflow:auto;background:#000;color:#fff;border:2px solid #fff;border-radius:6px;padding:14px 14px 10px;font:15px/1.35 system-ui,sans-serif;box-shadow:0 0 0 4px rgba(0,0,0,.6)}
#flatsPanel h3{margin:0 0 6px;font:800 13px/1.2 system-ui;letter-spacing:.14em;text-transform:uppercase}#flatsPanel p{margin:0 0 10px;color:#ddd}#flatsPanel .q{font-style:italic;color:#fff}
#flatsPanel button{display:block;width:100%;min-height:48px;margin:0 0 8px;padding:10px 12px;background:#000;color:#fff;border:2px solid #fff;border-radius:4px;font:700 15px system-ui;text-align:left;touch-action:manipulation}
#flatsPanel button.on,#flatsPanel button:active{background:#fff;color:#000}#flatsPanel button[disabled]{opacity:.4}#flatsPanel button.alt{border-style:dashed;color:#bbb}
#flatsPanel small{display:block;color:#999;margin:-4px 0 8px}
#flatsFade{position:fixed;inset:0;z-index:71;background:#000;color:#eee;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font:600 17px/1.4 system-ui;opacity:0;transition:opacity .5s;pointer-events:none}#flatsFade.on{opacity:1;pointer-events:auto}`;
function css() { if (document.getElementById('flatsCss')) return; const s = document.createElement('style'); s.id = 'flatsCss'; s.textContent = CSS; document.head.appendChild(s); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function onTap(el, fn) { if (window.__onTap) window.__onTap(el, fn); else el.addEventListener('click', fn); }
// buttons: [{ label, sub?, fn, alt?, disabled? }]
function openPanel(title, text, buttons, quote) {
  css(); closePanel();
  panel = document.createElement('div'); panel.id = 'flatsPanel'; panel.setAttribute('role', 'dialog');
  panel.innerHTML = `<h3>${esc(title)}</h3>${quote ? `<p class="q">“${esc(quote)}”</p>` : ''}${text ? `<p>${esc(text)}</p>` : ''}`;
  for (const b of [...buttons, { label: 'Leave it', alt: true, fn: () => {} }]) {
    const e = document.createElement('button'); e.textContent = b.label; if (b.alt) e.className = 'alt'; if (b.disabled) e.disabled = true; panel.appendChild(e);
    if (b.sub) { const s = document.createElement('small'); s.textContent = b.sub; panel.appendChild(s); }
    onTap(e, () => { if (e.disabled) return; const keep = b.fn?.(); if (keep !== true) closePanel(); });
  }
  document.body.appendChild(panel); if (document.pointerLockElement) document.exitPointerLock?.();
  return panel;
}
function closePanel() { if (panel) { panel.remove(); panel = null; } }
function fadeOut(text, ms, then) {
  css(); fade?.remove(); fade = document.createElement('div'); fade.id = 'flatsFade'; fade.textContent = text; document.body.appendChild(fade);
  requestAnimationFrame(() => fade?.classList.add('on'));
  const f = fade; setTimeout(() => { try { then?.(); } catch (e) { console.warn(e); } f.classList.remove('on'); setTimeout(() => { f.remove(); if (fade === f) fade = null; }, 600); }, ms);
}

// ---------- live rooms: one per kind (each kind has exactly one door) ----------
const live = {}; // kind -> { kind, api, S, spots: {id: spot}, kit }
let fxScene = null, roomLight = null, lightBase = 0;
function dress(L) {
  if (L.kit) return; const R = ROOMS[L.kind];
  L.S.grime = grime(); L.kit = makeKit(L.api);
  try { R.dress(L.kit, R.def, L.S); } catch (e) { console.warn('flats dress', L.kind, e); }
  L.t0 = now(); onEnter(L);
}
function undress(L) {
  if (!L?.kit) return; L.kit.dispose(); L.kit = null; const S = L.S;
  S.open = false; if (S.doorCol) S.doorCol.on = true; S.mode = 0; S.flashT = 0; S.benny = S.flash = S.knuckles = S.ro = S.doc = S.towel = S.twitch = S.nodder = S.door = S.drums = S.counter = S.dryer6 = null;
  if (L.kind === 'flats_pawn') { if (S.hostile && !S.dead) { ST.barredUntil = Date.now() + 5 * 60e3; save(); } S.hostile = false; S.warnT = 0; S.dead = false; }
  closePanel(); if (roomLight) { roomLight.intensity = lightBase; roomLight = null; }
}
for (const kind of KINDS) {
  const R = ROOMS[kind];
  registerInterior(kind, {
    ...R.def,
    build(api) {
      const L = live[kind] = { kind, api, S: {}, spots: {}, kit: null };
      const wapi = Object.create(api); wapi.spot = s => { api.spot(s); const sp = api.spots[api.spots.length - 1]; L.spots[s.id] = sp; return sp; };
      R.layout(wapi, L.S);
      api.ticks.push((t, dt) => { L.n = (L.n || 0) + 1; dress(L); const k = L.kit; if (!k) return; for (const f of k.ticks) f(t, dt); roomTick(L, dt); });
    }
  });
}

// ---------- per-room behaviour ----------
function onEnter(L) {
  const S = L.S;
  if (L.kind === 'flats_flop') setTimeout(() => S.nodder && say(S.nodder, 'Couch guy', 'flop_junkie'), 2200);
  if (L.kind === 'flats_clinic') setTimeout(() => S.doc && say(S.doc, 'Doc Varga', 'clinic_doc'), 1200);
  if (L.kind === 'flats_laund') setTimeout(() => S.knuckles && say(S.knuckles, 'Knuckles', 'laund_knuckles'), 1500);
  if (L.kind === 'flats_pawn') {
    S.hp = 3; S.hostile = false; S.mode = 0; S.shots0 = game()?.progress?.stats?.shots ?? 0; S.dead = Date.now() < ST.deadUntil;
    if (S.dead && S.benny) { deadPose(S.benny); S.benny.group.position.y = 0.15; L.kit.ticks.length = 0; }
    else if (Date.now() < ST.barredUntil) { S.mode = 1; S.warnT = now() + 5; S.warnWhy = 'barred'; setTimeout(() => S.benny && say(S.benny, 'Benny', 'pawn_barred', { toastToo: true }), 600); }
    else setTimeout(() => S.benny && say(S.benny, 'Benny', 'pawn_owner'), 1200);
  }
  emit('enter', { kind: L.kind });
}
function roomTick(L, dt) {
  const S = L.S, t = now();
  if (L.kind === 'flats_clinic') { const sp = L.spots['fx:clinic:chair']; if (sp) sp.label = `🩸 Doc Varga · patch-up · ${clinicPrice().full} cr`; }
  if (L.kind === 'flats_pawn') pawnTick(L, dt, t);
  if (L.kind === 'flats_laund' && S.dryer6 && S.kickT > t) S.dryer6.position.x = 5.4 + Math.sin(t * 60) * 0.03;
  // flickering room light (the colony's one point light moves in with you; we only nudge its intensity)
  if (roomLight) { const g = Math.min(1, S.grime ?? 0.7), f = L.kit?.flicker ? L.kit.flicker(t) : (L.kind === 'flats_flop' ? 0.85 + 0.15 * Math.sin(t * 3.1) * Math.sin(t * 7.3) : 1); roomLight.intensity = lightBase * (1 - g * (1 - f)); }
}
function findLight() {
  const ins = surf()?.info?.inside, sc = surf()?.scene; if (!ins || !sc) return null; let best = null, bd = 4;
  sc.traverse(o => { if (o.isPointLight) { const d = Math.hypot(o.position.x - ins.ax, o.position.z - ins.az, o.position.y - (ins.floor + (ROOMS[ins.kind]?.def.h ?? 3) - 0.5)); if (d < bd) { bd = d; best = o; } } });
  return best;
}

// ---------- flophouse ----------
function flopDesk(L) {
  const S = L.S;
  if (S.rented) return openPanel('Rooney · Restwell Bunks', `You're paid up${S.rented === 'lock' ? ' (lockbox)' : ''}. Middle bunk in the dorm, left through the gap. Back room is the other way. Don't go in the back room.`, []);
  openPanel('Rooney · Restwell Bunks', 'A bunk lets you sleep it off: it saves your game and heals you a bit. Sleep with cash on you and somebody might lighten it.', [
    { label: '🛏 Bunk for the night · 15 cr', sub: 'Your stuff is your problem.', disabled: credits() < 15, fn: () => rent(false) },
    { label: '🔒 Bunk + lockbox · 30 cr', sub: 'Cash in the box. Safer. Not safe.', disabled: credits() < 30, fn: () => rent(true) }
  ], pick(LINES.flop_desk));
}
function rent(lock) { const L = live.flats_flop, g = game(); if (!L || !g) return { ok: false }; const c = lock ? 30 : 15; if (!g.spend(c)) { toast('Rooney: Cash. Up front. You got neither.', 2600); return { ok: false }; } L.S.rented = lock ? 'lock' : 'plain'; toast(`🛏 Bunk 2, middle row${lock ? ', lockbox key on a shoelace' : ''}. −${c} cr`, 2800); emit('rent', { lock }); return { ok: true, cost: c }; }
function flopBunk(L) {
  if (!L.S.rented) return;
  openPanel('Your bunk', `The mattress has a history. ${credits() >= 60 || ST.dirty > 0 ? `You're carrying ${credits()} cr${ST.dirty ? ` and ${ST.dirty} dirty` : ''}.` : ''}`, [
    { label: '😴 Sleep it off', sub: 'Saves. Heals some. Risky with cash on you.', fn: () => { fadeOut('…', 3200, () => { const r = sleep(); toast(r.msg, 5200); }); } }
  ]);
}
function sleep({ rng = Math.random } = {}) {
  const L = live.flats_flop, g = game(); if (!L || !g) return { ok: false, msg: '' };
  const lock = L.S.rented === 'lock', cash = credits(), gk = grime();
  let risk = cash >= 60 ? 0.22 + gk * 0.12 + (cash > 500 ? 0.1 : 0) : (ST.dirty > 0 ? 0.15 : 0.04); if (lock) risk *= 0.3;
  heal(Math.round(health().max * 0.35)); L.S.rented = false; ST.stats.slept++;
  let lost = 0, dirtyLost = 0, msg;
  if (rng() < risk) {
    lost = take(Math.min(600, cash * (0.15 + rng() * 0.2))); if (ST.dirty > 0 && !lock) { dirtyLost = Math.round(ST.dirty * (0.25 + rng() * 0.35)); ST.dirty -= dirtyLost; }
    ST.stats.robbed++; ST.stats.lost += lost + dirtyLost; msg = `💸 ${pick(LINES.flop_robbed)} −${lost} cr${dirtyLost ? `, −${dirtyLost} dirty` : ''}.`;
  } else msg = `😴 ${pick(LINES.flop_rest)} Game saved.`;
  save(); g.save?.(); emit('sleep', { robbed: lost + dirtyLost > 0, lost, dirtyLost });
  return { ok: true, robbed: lost + dirtyLost > 0, lost, dirtyLost, risk, msg };
}

// ---------- chop clinic ----------
function clinicPrice() {
  const h = health(), miss = Math.max(0, h.max - h.hp) + Math.max(0, h.smax - h.sh) * 0.5, w = wanted();
  const sur = w > 0 ? 35 * w + 10 * w * w : 0, full = round5(40 + miss * 0.9 + sur), half = round5(20 + miss * 0.45 + sur * 0.6);
  return { full, half, surcharge: sur, wanted: w, missing: Math.round(miss) };
}
function clinicChair(L) {
  const p = clinicPrice(), h = health(), hurt = h.hp < h.max || h.sh < h.smax, cd = ST.bloodAt > Date.now();
  openPanel('Doc Varga · Bay Six', `${hurt ? `You're down ${p.missing} points of meat.` : 'You look fine. Bleed first, then come back.'}${p.wanted ? ` Security is after you: +${p.surcharge} cr, and he still doesn't call anyone.` : ' No names, no records, no calls.'}`, [
    { label: `🩸 Full patch-up · ${p.full} cr`, sub: 'Health and shield topped off. Wanted level untouched.', disabled: !hurt || credits() < p.full, fn: () => patch(true) },
    { label: `🩹 Stop the bleeding · ${p.half} cr`, sub: 'Half of what you are missing. Staples and glue.', disabled: !hurt || credits() < p.half, fn: () => patch(false) },
    { label: '🧪 Sell a pint of blood · +25 cr', sub: cd ? 'Come back when you have refilled.' : 'Costs a quarter of your health. He has a buyer.', disabled: cd || h.hp < h.max * 0.4, fn: () => sellBlood() }
  ], p.wanted ? pick(LINES.clinic_wanted) : pick(LINES.clinic_doc));
}
function patch(full) {
  const g = game(), p = clinicPrice(), c = full ? p.full : p.half; if (!g || !g.spend(c)) { toast('Doc Varga: Cash first. I don\u2019t take IOUs from people with holes in them.', 2800); return { ok: false }; }
  const w0 = wanted(); ST.stats.patched++; save(); emit('patch', { full, cost: c });
  const pos = surf()?.info; try { if (pos) g.gore?.(pos.x, pos.y - 0.4, pos.z, { n: 6, spray: true }); } catch (e) { /* cosmetic */ }
  fadeOut(pick(LINES.clinic_patch), 2600, () => { if (full) g.restore?.(); else heal(Math.ceil(p.missing * 0.5)); toast(`🩸 Patched. −${c} cr${w0 ? ` (${p.surcharge} of it was for the heat)` : ''}.`, 3200); });
  return { ok: true, cost: c, wanted: w0 };
}
function sellBlood() {
  if (ST.bloodAt > Date.now()) return { ok: false }; const h = health(); if (h.hp < h.max * 0.4) return { ok: false };
  heal(-Math.round(h.max * 0.25)); pay(25); ST.bloodAt = Date.now() + 3 * 60e3; save();
  const pos = surf()?.info; try { if (pos) game()?.gore?.(pos.x, pos.y - 0.5, pos.z, { n: 4 }); } catch (e) { /* cosmetic */ }
  toast(`🧪 ${pick(LINES.clinic_blood)} +25 cr`, 3600); return { ok: true };
}

// ---------- pawn: fence goods ----------
const HOT_TABLE = [['Engraved gold sidearm', 240], ['Lab-grown diamond studs', 180], ['Meridian wristwatch (still ticking)', 150], ['Bundle of bearer bonds', 320], ['Antique Earth coin set', 210], ['Wedding band, "Forever, D."', 90], ['Encrypted data slate', 200], ['Platinum cufflinks', 120], ['Ceramic ashes urn (full)', 60], ['Signed zero-g ball', 110]];
const FENCE_IDS = ['ledger_chip', 'colsec_tag', 'cold_cell', 'hot_plates', 'salvage', 'red_dust_whiskey', 'ration_paste'];
const NO_FENCE = { glowdust: 'dust', glow_dust: 'dust', glow_dust_brick: 'dust', lowg: 'dust', redstatic: 'dust', voidhoney: 'dust', hive_resin: 'dust', contraband: 'crate' };
function addHot(o = {}) {
  const [n, v] = HOT_TABLE[(Math.random() * HOT_TABLE.length) | 0];
  const it = { key: 'hot:' + (++hotSeq), name: String(o.name || n).slice(0, 48), value: Math.max(5, Math.round(+o.value || v)), src: String(o.src || 'mod').slice(0, 24), t: Date.now() };
  ST.hot.push(it); if (ST.hot.length > 12) ST.hot.shift(); save(); emit('hot', it); return it.key;
}
function stashGoods() {
  const C = SSX().contraband; if (!C?.stash) return [];
  let st, items; try { st = C.stash(); items = C.items?.() || []; } catch (e) { return []; }
  const out = [];
  for (const [id, s] of Object.entries(st?.items || {})) {
    if (!s?.qty || !FENCE_IDS.includes(id)) continue; const I = items.find(i => i.id === id) || {};
    const v = I.vals?.['red-tape-flats'] ?? I.vals?.red_tape_flats ?? I.base ?? 20;
    out.push({ key: 'stash:' + id, id, name: I.name || id, value: Math.round(v * s.qty), qty: s.qty, src: 'stash' });
  }
  return out;
}
function refusedStash() { const C = SSX().contraband; try { return Object.entries(C?.stash?.().items || {}).filter(([id, s]) => s?.qty && NO_FENCE[id]).map(([id]) => NO_FENCE[id]); } catch (e) { return []; } }
function fenceable() { return [...ST.hot.map(h => ({ ...h, qty: 1 })), ...stashGoods()]; }
function lowball(v) { const w = wanted(); return Math.max(3, Math.round(v * (0.36 + Math.random() * 0.08 - 0.04 * Math.min(3, w)))); }
function pawnCage(L) {
  const S = L.S;
  if (S.dead) return openPanel('Gold Star Pawn', 'Benny is not buying anything anymore. The register is empty. You should not be here.', []);
  if (S.hostile) return;
  const goods = fenceable(), ref = refusedStash();
  S.offers ||= {};
  const btns = goods.map(gd => { const o = S.offers[gd.key] ??= { price: lowball(gd.value), tries: 0, shut: false }; return { label: `${gd.name}${gd.qty > 1 ? ` ×${gd.qty}` : ''} · ${o.shut ? 'not buying' : o.price + ' cr'}`, sub: `Worth ~${gd.value}. ${gd.src === 'stash' ? 'From your stash.' : 'Hot: ' + gd.src + '.'}`, disabled: o.shut, fn: () => { haggle(L, gd); return true; } }; });
  openPanel('Benny · Gold Star Pawn', goods.length ? 'He buys stolen goods through the slot. He lowballs everyone. You can haggle, twice, if you like living dangerously.' : `You got nothing I want. Plates, fuel cells, chips, evidence tags, scrap, and whatever you pull out of a safe or a heist. ${ref.includes('dust') ? 'No dust. ' : ''}${ref.includes('crate') ? 'No Quiet crates. ' : ''}`, btns, ref.length && goods.length ? 'No dust, no Quiet crates. I got a family.' : pick(LINES.pawn_owner));
}
function haggle(L, gd) {
  const S = L.S, o = S.offers[gd.key], dirtyP = Math.round(o.price * 1.2);
  openPanel(`Benny · ${gd.name}`, `He turns it over under the lamp. "${o.price}." Clean credits, or a bundle of dirty cash for more (wash it at Rinse & Repeat).`, [
    { label: `💳 Take ${o.price} cr clean`, fn: () => { fence(gd.key, { price: o.price }); } },
    { label: `💵 Take ${dirtyP} dirty`, sub: 'Untraceable until it is not. Needs laundering.', fn: () => { fence(gd.key, { price: dirtyP, dirty: true }); } },
    { label: '🗣 Haggle', sub: o.tries ? 'Last chance. He is losing patience.' : 'He might go up. He might go down.', disabled: o.tries >= 2, fn: () => {
      o.tries++; const ok = Math.random() < (o.tries === 1 ? 0.6 : 0.35);
      if (ok) { o.price = Math.min(Math.round(gd.value * 0.75), Math.round(o.price * (1.12 + Math.random() * 0.1))); say(S.benny, 'Benny', 'pawn_haggle_ok'); }
      else { o.price = Math.max(3, Math.round(o.price * 0.88)); say(S.benny, 'Benny', 'pawn_haggle_no'); if (o.tries >= 2) { o.shut = true; toast('Benny slides the slot shut on that one. "Not today."', 2800); return; } }
      haggle(L, gd); return true; } }
  ], pick(LINES.pawn_lowball));
}
function fence(key, { price, dirty = false } = {}) {
  const gd = fenceable().find(x => x.key === key); if (!gd) return { ok: false, msg: 'gone' };
  const S = live.flats_pawn?.S; const p = Math.max(1, Math.round(price ?? (S?.offers?.[key]?.price) ?? lowball(gd.value)));
  if (gd.src === 'stash') { const n = SSX().contraband?.remove?.(gd.id, gd.qty); if (!n) return { ok: false, msg: 'stash' }; }
  else ST.hot = ST.hot.filter(h => h.key !== key);
  if (dirty) ST.dirty += p; else pay(p);
  ST.stats.fenced++; ST.stats.fencedCr += p; save(); if (S?.offers) delete S.offers[key];
  toast(`💍 Benny takes the ${gd.name}. ${dirty ? `+${p} dirty cash (wash it)` : `+${p} cr`}.`, 3000); emit('fence', { key, name: gd.name, price: p, dirty });
  return { ok: true, price: p, dirty };
}
// pull a gun in here and Benny stops being a shopkeeper
function pawnWarn(L, why) { const S = L.S; if (S.dead || S.hostile) return; if (S.mode === 1 && now() < S.warnT) return pawnHostile(L); S.mode = 1; S.warnT = now() + 3.5; S.warnWhy = why; say(S.benny, 'Benny', 'pawn_warn', { toastToo: true }); }
function pawnHostile(L) { const S = L.S; if (S.dead || S.hostile) return; S.hostile = true; S.mode = 2; S.nextShot = now() + 0.7; closePanel(); say(S.benny, 'Benny', 'pawn_hostile', { toastToo: true }); emit('pawn', { hostile: true }); }
function pawnTick(L, dt, t) {
  const S = L.S, g = game(), info = surf()?.info; if (!S.benny || !g || !info) return;
  if (S.flashT > 0) S.flashT -= dt;
  if (S.dead) return;
  const shots = g.progress?.stats?.shots ?? 0;
  if (shots > (S.shots0 ?? shots)) { // you fired in here
    const fired = shots - S.shots0; S.shots0 = shots;
    if (!S.hostile) pawnHostile(L);
    else { const ins = info.inside, bx = ins.ax + 0.3, bz = ins.az - 2.0, yaw = surf()?.info?.yaw ?? camYaw(), dx = bx - info.x, dz = bz - info.z, fx = -Math.sin(yaw), fz = -Math.cos(yaw), c = (dx * fx + dz * fz) / (Math.hypot(dx, dz) || 1);
      if (c > 0.85) { S.hp -= fired; try { g.gore?.(bx, ins.floor + 1.3, bz, { n: 10, spray: true }); } catch (e) { /* */ } if (S.hp <= 0) pawnKill(L); } }
  }
  if (S.mode === 1 && !S.hostile && t > S.warnT) { if (S.warnWhy === 'barred') pawnHostile(L); else { S.mode = 0; toast('Benny lowers the sawed-off an inch. "Smart."', 2200); } }
  if (S.hostile && t > S.nextShot) { // he fires through the cage: two barrels, then a reload
    S.barrel = (S.barrel || 0) + 1; S.nextShot = t + (S.barrel % 2 ? 0.9 : 2.2); S.flashT = 0.08;
    const dmg = 16 + Math.random() * 10; try { const ins = info.inside; g.hurtPlayer?.(dmg, ins ? { x: ins.ax + 0.3, z: ins.az - 2.0 } : null); g.gore?.(info.x, info.y - 0.5, info.z, { n: 5, spray: true }); } catch (e) { /* */ }
    try { window.__app?.au7?.fx?.boom?.(); } catch (e) { /* optional */ }
  }
  if (S.flash) S.flash.visible = S.flashT > 0;
}
function camYaw() { const c = surf()?.camera; if (!c) return 0; const v = new THREE.Vector3(); c.getWorldDirection(v); return Math.atan2(-v.x, -v.z); }
function pawnKill(L) {
  const S = L.S, g = game(), ins = surf()?.info?.inside; S.dead = true; S.hostile = false; S.mode = 0; ST.deadUntil = Date.now() + 10 * 60e3;
  if (S.benny) { deadPose(S.benny); S.benny.group.position.y = 0.15; } if (L.kit) { L.kit.ticks.length = 0; }
  try { if (ins) g.gore?.(ins.ax + 0.3, ins.floor + 0.8, ins.az - 2.0, { n: 40, gib: true }); } catch (e) { /* */ }
  const till = 120 + ((Math.random() * 140) | 0); ST.dirty += till; save();
  try { SSX().city?.setWanted?.(Math.max(2, wanted()), 'Gold Star Pawn shooting'); } catch (e) { /* */ }
  toast(`💀 Benny's down. You empty the register through the slot: +${till} dirty cash. Somebody heard that.`, 4200); emit('pawn', { dead: true, till });
}

// ---------- laundromat ----------
function launderCut() { return Math.min(0.45, 0.18 + 0.04 * wanted() + 0.05 * Math.max(0, grime() - 0.7)); }
function laundKnuckles(L) {
  const S = L.S;
  if (ST.dirty > 0) { S.open = true; if (S.doorCol) S.doorCol.on = false; say(S.knuckles, 'Knuckles', 'laund_knuckles'); toast('Knuckles looks at your bulging pockets and steps aside. "Go on back."', 2600); return; }
  openPanel('Knuckles · Staff only', 'Big man, arms crossed, sunglasses indoors. The back room is for customers with dirty money.', [
    { label: '💳 Slip him 10 cr to look around', disabled: credits() < 10, fn: () => { if (game()?.spend(10)) { S.open = true; if (S.doorCol) S.doorCol.on = false; toast('Knuckles pockets it. "Five minutes. Touch nothing."', 2600); } } }
  ], pick(LINES.laund_knuckles));
}
function laundWash(L) {
  const S = L.S, cut = launderCut();
  if (ST.dirty <= 0) return openPanel('Auntie Ro · Back room', 'Benny at Gold Star Pawn pays dirty if you ask. Bring it here.', [], pick(LINES.laund_nothing));
  const all = ST.dirty, half = Math.ceil(all / 2), out = n => Math.floor(n * (1 - cut));
  openPanel('Auntie Ro · Back room', `You're holding ${all} dirty. She keeps ${Math.round(cut * 100)}%${wanted() ? ' (more while you are hot)' : ''}.`, [
    { label: `🧺 Wash it all · ${out(all)} cr clean`, fn: () => washFx(all) },
    { label: `🧺 Wash half · ${out(half)} cr clean`, disabled: all < 2, fn: () => washFx(half) }
  ], pick(LINES.laund_ro));
}
function washFx(n) { fadeOut('The bill counter whirs. Somewhere a dryer thumps. Auntie Ro hums.', 2000, () => { const r = launder(n); toast(`💵 Washed ${r.dirty} dirty → +${r.clean} cr (Ro kept ${r.cut}).`, 3200); }); }
function launder(n = ST.dirty) { n = Math.max(0, Math.min(ST.dirty, Math.round(n))); if (!n) return { ok: false, dirty: 0, clean: 0, cut: 0 }; const clean = Math.floor(n * (1 - launderCut())); ST.dirty -= n; pay(clean); ST.stats.laundered += n; save(); emit('launder', { dirty: n, clean }); return { ok: true, dirty: n, clean, cut: n - clean }; }
function kickDryer(L) {
  const S = L.S, t = now(); if (S.kickT > t) return; S.kickT = t + 0.6; ST.stats.kicks++;
  const r = Math.random(); if (r < 0.25) { const c = 1 + ((Math.random() * 8) | 0); pay(c); toast(`🦶 Dryer six coughs up ${c} cr in old coins.`, 2200); }
  else if (r < 0.35) { heal(-5); toast('🦶 You stub your toe on a machine older than you. −5 HP', 2200); }
  else toast(pick(['🦶 THUNK. Nothing.', '🦶 The drum turns once, sadly.', '🦶 Something rattles inside. A tooth?']), 1800);
  save();
}

// ---------- hotspot dispatch ----------
const ACTS = {
  'fx:flop:desk': L => flopDesk(L), 'fx:flop:bunk': L => flopBunk(L),
  'fx:flop:junkie': L => { say(L.S.twitch, 'Twitchy guy', 'flop_junkie'); if (Math.random() < 0.3 && credits() > 0) { const n = take(Math.min(credits(), 3 + ((Math.random() * 6) | 0))); toast(`🫳 While he talks, a hand finds your pocket. −${n} cr`, 2600); } },
  'fx:flop:nod': L => say(L.S.nodder, 'Couch guy', Math.random() < 0.5 ? 'flop_sleeper' : 'flop_junkie'),
  'fx:clinic:chair': L => clinicChair(L), 'fx:clinic:towel': L => say(L.S.towel, 'Guy with a towel', 'clinic_waiting'),
  'fx:clinic:cooler': () => toast('🧊 Two kidneys, half a liver and something you hope is a pork chop, on ice. A note: "FRESH. NOT 4 SALE (ASK)."', 4200),
  'fx:pawn:cage': L => pawnCage(L), 'fx:pawn:case': () => toast('💎 Wedding rings, a glass eye, three dog tags with the names scratched off. "Not for you," says Benny.', 3600),
  'fx:laund:knuckles': L => laundKnuckles(L), 'fx:laund:wash': L => laundWash(L), 'fx:laund:dryer': L => kickDryer(L),
  'fx:laund:regular': L => say({ x: -3.6, z: 3.9 }, 'Regular', 'laund_front')
};
function curLive() { const k = inKind(); return k && live[k]?.kit ? live[k] : null; }
function act(id) {
  const L = curLive(); const sid = id || surf()?.info?.spot?.id; if (!L || !sid || !ACTS[sid]) return false;
  if (L.kind === 'flats_pawn' && L.S.hostile && sid !== 'fx:pawn:case') return false;
  try { ACTS[sid](L); } catch (e) { console.warn('flats act', sid, e); } return true;
}
let lastAct = 0;
function tryAct() { if (panel || fade) return; const t = performance.now(); if (t - lastAct < 350) return; if (act()) lastAct = t; }

// ---------- surface hook: enter/exit, light, minimap marks ----------
let prevKind = null, marked = false;
function surfaceTick(dt, ctx) {
  fxScene = ctx?.scene || fxScene;
  const k = inKind();
  if (k !== prevKind) {
    if (prevKind && live[prevKind]) undress(live[prevKind]);
    if (k && live[k]) { roomLight = findLight(); lightBase = ROOMS[k].def.light.int; }
    prevKind = k;
  }
  if (!marked && ctx?.name === 'Mars') { marked = true; try { const ds = doors(); if (ds.length) SSX().minimap?.addMarks?.('flats', ds.map(d => ({ x: d.x, z: d.z, color: '#' + PLACES[d.kind].color.toString(16).padStart(6, '0'), r: 1.6 }))); } catch (e) { /* radar optional */ } }
  if (ctx?.name !== 'Mars' && marked) { marked = false; try { SSX().minimap?.clear?.('flats'); } catch (e) { /* */ } }
}
function doors() { try { return (surf()?.world?.doorList?.() || []).filter(d => PLACES[d.kind]); } catch (e) { return []; } }

// ---------- loot hooks: heists and cracked safes produce hot goods for Benny ----------
function hooks() {
  addEventListener('heist:done', e => { const d = e.detail || {}; if (d.success === false) return; addHot({ src: 'heist ' + (d.id || '') }); if (Math.random() < 0.5) addHot({ src: 'heist ' + (d.id || '') }); });
  try { SSX().on?.('game:crack', d => { if (d?.done) addHot({ src: 'safe' }); }); } catch (e) { console.warn('flats crack hook', e); }
  const btn = document.getElementById('driveBtn'); if (btn) onTap(btn, () => tryAct());
  addEventListener('keydown', e => { if (e.code !== 'KeyE' || e.repeat) return; const tg = e.target; if (tg && /INPUT|TEXTAREA|SELECT/.test(tg.tagName)) return; tryAct(); });
  addEventListener('keydown', e => { if (e.code === 'Escape' && panel) closePanel(); });
  // a weapon switch inside the pawn shop counts as pulling a gun
  try { SSX().on?.('game:weapon', d => { const L = curLive(); if (L?.kind === 'flats_pawn' && d && !d.rover && !d.blade) pawnWarn(L, 'weapon'); }); } catch (e) { console.warn('flats weapon hook', e); }
}

// ---------- public API ----------
const API = {
  version: 1, places: () => KINDS.map(k => { const P = PLACES[k], d = doors().find(x => x.kind === k); return { kind: k, sign: P.sign, title: P.title, who: P.who, district: DISTRICT, local: [P.at[0], P.at[1]], door: d ? { x: d.x, z: d.z, name: d.name } : null }; }),
  get placed() { return placed; }, get inside() { return curLive()?.kind || null; }, get loaded() { return KINDS.filter(k => live[k]?.kit); },
  get dirty() { return ST.dirty; }, addDirty(n, src = 'mod') { n = Math.max(0, Math.round(+n || 0)); ST.dirty += n; save(); emit('dirty', { n, src }); return ST.dirty; },
  launder, launderCut, hot: () => ST.hot.map(h => ({ ...h })), addHot, fenceable, fence, clinicPrice, patch, sellBlood, rent, sleep,
  get pawn() { const S = live.flats_pawn?.S || {}; return { mode: S.mode || 0, hostile: !!S.hostile, dead: !!S.dead || Date.now() < ST.deadUntil, hp: S.hp ?? 3, barredUntil: ST.barredUntil }; },
  provoke(why = 'test') { const L = curLive(); if (L?.kind !== 'flats_pawn') return false; pawnWarn(L, why); return true; },
  act, open: id => act(id), get ticks() { return Object.fromEntries(KINDS.map(k => [k, live[k]?.n || 0])); }, close: closePanel, get stats() { return { ...ST.stats }; },
  reset() { ST = S0(); save(); }
};
(function boot() {
  if (!window.SSX || !window.__app?.surface) { setTimeout(boot, 250); return; }
  window.SSX.flats = API; hooks(); regBarks();
  try { (window.SSX.registerSurfaceTick || (f => window.__app.surface.registerTick?.(f)))(surfaceTick); } catch (e) { console.warn('flats tick', e); }
})();
export default API;
