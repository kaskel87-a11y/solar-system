/*
 * mars/control.js: Control radios job offers on Mars, like it does on Earth (v7.6, Marsmania).
 *
 * Why it never happened on Mars: game.js offerNext() is one-shot (4.5 s after landing, 9 s after a quest ends) and only
 * offers unfinished, non-contact story quests (QUESTS.filter(... && !q.contact ...)). Every Mars job a player actually
 * does (taxi / paramedic / vigilante shifts, the side activities, Beltway jobs, smuggling, the farm, contact work) lives
 * in its own module, not in QUESTS, so once the few Mars story quests are done Control has nothing to say, ever.
 *
 * This file adds an idle-time offer loop on the Mars surface (timing in controlcore.js): first offer ~20 s after landing,
 * ~20 s after any job ends, then every 30-45 s while you stay idle. Later snoozes ~45 s. No cap. One offer at a time:
 * nothing fires while any radio caption is up. It uses the core radio card (#radio, ✅ Accept / Later) through
 * SSX.city.radio(text, 'Control', 'mctl:<job>') and catches its own ids: game.accept is wrapped (ids starting 'mctl:'
 * go here, everything else goes to the core unchanged) and the Later handler (window.__tapOf) is wrapped the same way.
 *
 * Idle means: on the Mars surface, landed (no intro), not down, no quest/contact job, no SSX.jobs shift, no side
 * activity (window.__activities), no Beltway job, no smuggling run, no race (window.__race), no heist, no stars (world.wanted),
 * not in the Rust Pit (world.inDuel / SSX.fight), not in custody / jail / a consequences screen, no turf fight, no farm
 * raid, no First Day tour step, and no big panel open. Floating cars (SSX.gravity) are fine: nothing here moves the car.
 *
 * Offers (only ones whose module is loaded and that can start right now):
 *   SSX.jobs        taxi, paramedic, vigilante shifts        -> start(type)
 *   activities      Door Shift, Scrap Run, Blue Drop, Dust Fare, Pad to Plaza (off cooldown) -> __activities.start(id)
 *   SSX.beltway     convoy hijack, toll shakedown            -> start(type)
 *   SSX.smuggle     smuggling run                            -> start() at the pad, else a waypoint to the pad
 *   SSX.farm        farm chores (ripe crops / empty racks)   -> waypoint to the homestead
 *   contact work    game.jobBoard() city jobs from contacts  -> the core game.accept(id)
 * Waypoints: SSX.hudx.setWaypoint, else SSX.waypoint/nav/gps (set/to/add), plus one plain-word toast.
 *
 * window.SSX.control: state() busy() candidates() offerNow(key?) later() accept() on(fn) TIMES
 *   debug.setTimes({ first, after, every:[a,b], later, wayp }) debug.next(sec) debug.reset()
 * Events: SSX.emit('control:offer' | 'control:accept' | 'control:later' | 'control:expired', { key, id, title })
 */
import * as K from './controlcore.js';
import { directions } from './farmcore.js';

const app = () => window.__app, surf = () => app()?.surface, game = () => surf()?.game, world = () => surf()?.world, X = () => window.SSX || {};
const fin = v => Number.isFinite(v);
const T = { ...K.TIMES };
let S = K.fresh(), pendAge = 0, lastNow = 0, iv = 0;
const subs = new Set();
function emit(type, d = {}) {
  const ev = { type, ...d, t: Date.now() };
  for (const f of [...subs]) { try { f(ev); } catch (e) { console.warn('control listener', e); } }
  try { X().emit?.('control:' + type, ev); } catch (e) { /* */ }
  return ev;
}
const toast = (m, ms = 3200) => { try { (app()?.toast || X().city?.toast)?.(m, ms); } catch (e) { /* */ } };
const radioEl = () => document.getElementById('radio');
const radioUp = () => { const r = radioEl(); return !!r && getComputedStyle(r).display !== 'none'; };

// ---------- where am I ----------
function colony() { const c = surf()?.info?.colony; return c && fin(c.x) && fin(c.z) ? c : null; }
function onMars() {
  const a = app(), i = surf()?.info; if (!a?.state?.onSurface || a.state.transitioning) return false;
  if (!i || i.name !== 'Mars' || !colony()) return false;
  if ((i.intro || 0) > 0) return false; // still in the landing reveal
  return true;
}
const W = at => { const c = colony(); return c ? { x: c.x + at[0], z: c.z + at[1] } : null; };
const me = () => { const i = surf()?.info; return i && fin(i.x) && fin(i.z) ? i : null; };

// ---------- busy: any reason not to offer a job right now (null = idle) ----------
const PANELS = ['sheet', 'jobPanel', 'beltPanel', 'farmPanel', 'cqPanel', 'cqScreen', 'logPanel', 'racePanel', 'duelPanel', 'labPanel', 'fcPanel', 'turfPanel', 'repPanel', 'cbPanel', 'actPanel',
  'basePanel', 'empPanel', 'heistPanel', 'pokerPanel', 'flatsPanel', 'grimePanel', 'stPanel', 'ssPanel', 'colPanel', 'roverMenu'];
function panelOpen() {
  for (const id of PANELS) {
    const e = document.getElementById(id); if (!e) continue;
    if (e.classList.contains('show') || e.classList.contains('open') || e.classList.contains('on')) return id;
    const d = e.style.display; if (d && d !== 'none') return id;
  }
  return null;
}
const tryB = f => { try { return !!f(); } catch (e) { return false; } };
function busy() {
  const g = game(), w = world(), x = X();
  if (tryB(() => g?.isDown?.())) return 'down';
  if (tryB(() => g?.info?.quest)) return 'quest';
  if (tryB(() => x.jobs?.active?.())) return 'job';
  if (tryB(() => window.__activities?.active)) return 'activity';
  if (tryB(() => x.beltway?.active?.())) return 'beltway';
  if (tryB(() => x.smuggle?.state?.run)) return 'smuggle';
  if (tryB(() => window.__race?.state)) return 'race';
  if (tryB(() => x.heist?.active)) return 'heist';
  if (tryB(() => x.fastTravel?.busy)) return 'travel';
  if (tryB(() => (w?.wanted | 0) > 0)) return 'wanted';
  if (tryB(() => w?.inDuel) || tryB(() => x.fight?.inPit?.())) return 'pit';
  if (tryB(() => { const c = x.consequences?.status?.(); return c && (c.custody || c.jail || c.pending); })) return 'custody';
  if (tryB(() => x.turf?.fight?.())) return 'turf';
  if (tryB(() => x.farm?.status?.()?.raid)) return 'raid';
  if (tryB(() => x.onboard?.state?.status === 'active')) return 'tour';
  const p = panelOpen(); if (p) return 'panel:' + p;
  return null;
}

// ---------- the offers ----------
const JOB_META = {
  taxi: ['Taxi shift', 'Pick up fares around Ares Junction. Any car will do.'],
  paramedic: ['Paramedic shift', 'Get hurt colonists to a clinic before the clock runs out.'],
  vigilante: ['Vigilante shift', 'ColSec has a bounty on a crook nearby. Bring them in.']
};
const ACTS = {
  'act-static-bounce': 'Work the door at The Static. Keep the line moving.',
  'act-wrench-scrap': 'Pull parts in the Flats and sell them at the chop shop.',
  'act-blue-courier': 'Run a sealed bag of glow-dust to a dead drop. Don\u2019t get stopped.',
  'act-beltway-taxi': 'Drive a fare across the Beltway. Smooth driving pays more.',
  'act-beltway-delivery': 'Haul a crate from the pad to the plaza.'
};
const BELT = { hijack: ['Convoy hijack', 'Stop a cargo hauler on the Beltway and grab the crates.'], shakedown: ['Toll shakedown', 'Lean on a checkpoint booth for its cash.'] };
const PAD_AJ = [-38, 10];
function setWay(p, label) {
  if (!p) return false;
  try { const h = X().hudx; if (typeof h?.setWaypoint === 'function') { h.setWaypoint({ x: p.x, z: p.z, label }); return true; } } catch (e) { /* */ }
  for (const k of ['waypoint', 'nav', 'gps']) { const n = X()[k]; const f = n && (n.set || n.to || n.add); if (typeof f === 'function') { try { const r = f.call(n, { id: 'control-job', x: p.x, z: p.z, label, color: '#ffd400' }); if (r !== false) return true; } catch (e) { /* */ } } }
  return false;
}
function wayTo(p, name, verb) { const i = me(); setWay(p, name); const msg = i && p ? directions(i, p, name, verb) : `Go to ${name} and ${verb}.`; toast('🧭 ' + msg, 4200); return { ok: true, how: 'waypoint', msg }; }
const okRes = r => r === true || (r && r.ok !== false && r !== false);

function candidates() {
  const out = [], x = X(), g = game();
  // SSX.jobs (#12)
  const J = x.jobs; if (J && typeof J.start === 'function') for (const t of (J.types || Object.keys(JOB_META))) {
    if (!JOB_META[t]) continue; if (t === 'vigilante' && (world()?.wanted | 0) >= 2) continue;
    out.push({ key: t, title: JOB_META[t][0], blurb: JOB_META[t][1], go: () => { const r = J.start(t); return okRes(r) ? { ok: true, how: 'started' } : { ok: false, msg: r?.msg || 'That shift can\u2019t start right now.' }; } });
  }
  // side activities (activities/runner.js)
  const A = window.__activities; if (A && typeof A.start === 'function') {
    let list = []; try { list = A.list() || []; } catch (e) { /* */ }
    const cd = (() => { try { return A.data?.cooldownUntil || {}; } catch (e) { return {}; } })();
    for (const a of list) {
      if (!ACTS[a.id] || a.deferred || (cd[a.id] || 0) > Date.now()) continue;
      out.push({ key: a.id, title: a.name, blurb: ACTS[a.id], go: () => { const r = A.start(a.id); return okRes(r) ? { ok: true, how: 'started' } : { ok: false, msg: r?.why || 'That job isn\u2019t open right now.' }; } });
    }
  }
  // Beltway (#16)
  const B = x.beltway; if (B && typeof B.start === 'function') {
    const ids = (B.activities || []).map(a => a.id);
    for (const t of Object.keys(BELT)) if (ids.includes(t)) out.push({ key: 'belt-' + t, title: BELT[t][0], blurb: BELT[t][1], go: () => { const r = B.start(t); return okRes(r) ? { ok: true, how: 'started' } : { ok: false, msg: r?.msg || 'Not right now.' }; } });
  }
  // smuggling (SSX.smuggle)
  const M = x.smuggle; if (M && typeof M.start === 'function') {
    let why = 'x'; try { why = M.state?.why ?? null; } catch (e) { /* */ }
    if (why === null || why === 'notPad') out.push({ key: 'smuggle', title: 'Smuggling run', blurb: 'Gutter Pell has a sealed crate for Phobos. Fly it past customs.',
      go: () => { let w = 'x'; try { w = M.state?.why ?? null; } catch (e) { /* */ } if (w === null) { const r = M.start(); if (okRes(r)) return { ok: true, how: 'started' }; } return wayTo(W(PAD_AJ), 'the Ares Junction landing pad', 'tap 📦 RUN'); } });
  }
  // farm chores (SSX.farm)
  const F = x.farm; if (F && typeof F.status === 'function') {
    let st = null; try { st = F.status(); } catch (e) { /* */ }
    if (st?.owned && st.dome && Array.isArray(st.racks) && st.racks.length) {
      const ripe = st.racks.filter(r => r.ripe).length, empty = st.racks.filter(r => !r.crop).length;
      if (ripe || empty) out.push({ key: 'farm', title: 'Farm chores', blurb: ripe ? `${ripe} rack${ripe > 1 ? 's are' : ' is'} ready to harvest at the homestead.` : `${empty} rack${empty > 1 ? 's are' : ' is'} empty. Plant something.`,
        go: () => { let p = null; try { p = (F.places() || []).find(q => q.id === 'farm'); } catch (e) { /* */ } return wayTo(p && fin(p.x) ? p : null, 'Dustbowl Homestead', 'tap Farm'); } });
    }
  }
  // contact work: the core city job board (contacts never get radioed by offerNext)
  if (g && typeof g.jobBoard === 'function') {
    let jb = []; try { jb = g.jobBoard() || []; } catch (e) { /* */ }
    for (const q of jb.slice(0, 4)) if (!q.active && !q.locked && q.contact) out.push({ key: 'tip-' + q.id, quest: q.id, title: q.title, blurb: `${q.contact} has work for you. Pays ${q.credits || 0}.`, go: () => { const r = origAccept(q.id); return r === false ? { ok: false, msg: 'That job is gone.' } : { ok: true, how: 'started' }; } });
  }
  return out;
}

// ---------- radio card hooks (guarded; re-applied if the game object changes) ----------
let origAcceptFn = null;
function origAccept(id) { const g = game(); const f = origAcceptFn || g?.accept; return typeof f === 'function' ? f.call(g, id) : false; }
function hookAccept() {
  const g = game(); if (!g || typeof g.accept !== 'function' || g.accept.__mctl) return;
  try {
    const orig = g.accept; origAcceptFn = orig;
    const wrapped = function (id, ...rest) { if (typeof id === 'string' && id.startsWith('mctl:')) return accept(id); return orig.call(this, id, ...rest); };
    wrapped.__mctl = true; g.accept = wrapped;
  } catch (e) { console.warn('control accept hook', e); }
}
function hookLater() {
  const el = document.getElementById('radioLater'); if (!el || typeof window.__tapOf !== 'function') return;
  try {
    const t = window.__tapOf(el); if (!t || typeof t.fn !== 'function' || t.fn.__mctl) return;
    const orig = t.fn; const fn = function (e) { if (pendingShown()) { later(); return; } return orig.call(this, e); };
    fn.__mctl = true; t.fn = fn;
  } catch (e) { console.warn('control later hook', e); }
}
function pendingShown() { const p = S.pending; if (!p) return false; const t = document.getElementById('radioText'); return radioUp() && !!t && t.textContent === p.text; }
let cur = null; // the live offer { key, id, text, title, go }
function hideRadio() { const r = radioEl(); if (r) { r.style.display = 'none'; r.classList.remove('mctl'); } }

function offerNow(key) {
  if (!onMars()) return { ok: false, why: 'not on Mars' };
  if (S.pending && pendingShown()) return { ok: false, why: 'offer already up' };
  const c = candidates(); if (!c.length) { K.resolve(S, 'none', { T }); return { ok: false, why: 'no jobs' }; }
  const k = key && c.some(o => o.key === key) ? key : K.pick(S, c.map(o => o.key));
  const o = c.find(q => q.key === k);
  const text = `Control: got a job if you\u2019re bored: "${o.title}". ${o.blurb} Want it?`;
  cur = { ...o, id: 'mctl:' + o.key, text };
  hookAccept(); hookLater();
  try { X().city?.radio?.(text, 'Control', cur.id); } catch (e) { console.warn('control radio', e); return { ok: false, why: 'radio failed' }; }
  if (!radioUp()) { cur = null; K.resolve(S, 'none', { T }); return { ok: false, why: 'radio hidden' }; }
  radioEl()?.classList.add('mctl');
  K.shown(S, cur); pendAge = 0;
  emit('offer', { key: o.key, id: cur.id, title: o.title });
  return { ok: true, key: o.key, text };
}
function accept(id) {
  const o = cur && (!id || id === cur.id) ? cur : null; if (!o) return false;
  cur = null; hideRadio(); S.pending = null; S.next = 1e6; // held until the start below resolves it
  // run the job a beat later so its own radio line / toast isn't hidden by the radio card closing
  setTimeout(() => {
    let r; try { r = o.go(); } catch (e) { console.warn('control start', e); r = { ok: false, msg: 'That job can\u2019t start right now.' }; }
    if (!r?.ok) { toast(r?.msg || 'That job can\u2019t start right now.', 2800); K.resolve(S, 'none', { T }); }
    else K.resolve(S, r.how === 'waypoint' ? 'waypoint' : 'started', { T });
    emit('accept', { key: o.key, id: o.id, title: o.title, ok: !!r?.ok, how: r?.how || null });
  }, 60);
  return true;
}
function later() {
  const o = cur; if (!o && !S.pending) return false;
  cur = null; hideRadio(); K.resolve(S, 'later', { T });
  toast('📻 OK. Control will check back soon.', 2200);
  emit('later', { key: o?.key, id: o?.id, title: o?.title, next: S.next });
  return true;
}

// ---------- loop ----------
function tick() {
  const now = performance.now(), dt = lastNow ? (now - lastNow) / 1000 : 0; lastNow = now;
  if (document.hidden) return;
  try {
    hookAccept(); hookLater();
    if (S.pending) {
      pendAge += Math.min(dt, 1);
      if (!pendingShown()) { // closed by the radio's own timeout, or another caption replaced it
        const o = cur; cur = null; radioEl()?.classList.remove('mctl');
        // a quest accept through the core id never comes here; an mctl accept/later already resolved
        if (S.pending) { K.resolve(S, 'expired', { T, age: pendAge }); emit('expired', { key: o?.key, id: o?.id, title: o?.title }); }
      }
      return;
    }
    const m = onMars();
    const b = m ? busy() : null;
    if (K.step(S, { dt, onMars: m, busy: b, radioUp: m && radioUp(), T }) === 'offer') offerNow();
  } catch (e) { console.warn('control tick', e); }
}
function css() {
  if (document.getElementById('mctlCss')) return;
  const s = document.createElement('style'); s.id = 'mctlCss';
  s.textContent = '#radio.mctl #radioAccept,#radio.mctl #radioLater{background:#000!important;color:#fff!important;border:2px solid #fff!important;min-height:48px;min-width:112px;font-weight:800;box-shadow:none!important}';
  document.head.appendChild(s);
}

const API = {
  TIMES: T, state: () => ({ ...S, pending: S.pending ? { ...S.pending } : null, bag: [...S.bag], onMarsNow: onMars(), busy: busy(), radioUp: radioUp() }),
  busy, candidates: () => candidates().map(o => ({ key: o.key, title: o.title, blurb: o.blurb })), offerNow, accept: () => accept(cur?.id), later,
  on(fn) { if (typeof fn !== 'function') return () => {}; subs.add(fn); return () => subs.delete(fn); },
  debug: {
    setTimes(o = {}) { for (const k of Object.keys(K.TIMES)) if (o[k] != null) T[k] = o[k]; return { ...T }; },
    next(sec) { S.next = +sec; return S.next; },
    reset() { S = K.fresh(); cur = null; pendAge = 0; Object.assign(T, K.TIMES); return true; }
  }
};
(function boot(n = 0) {
  if (!window.SSX || !window.__app) { if (n < 600) setTimeout(() => boot(n + 1), 200); return; }
  if (window.SSX.control) return;
  window.SSX.control = API; css();
  iv = setInterval(tick, 250);
})();
