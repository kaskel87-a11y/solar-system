// Drives empire prompts: one phone note at a time, a map pin when you tap it, and the crime job arrow.
import * as E from './empirepromptcore.js';

const KEY = 'ssx.empire.prompt.v1';
const NAMES = { dex: 'Dex Malone', vee: 'Vee Okonkwo', soren: 'Soren Pell', mags: 'Mags Ferro' };
let state = E.fresh();
try { state = E.load(localStorage.getItem(KEY)); } catch (e) { state = E.fresh(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* */ } };
let pinKey = '';

function world() {
  const props = window.SSX?.empire?.props?.() || [];
  const fronts = props.filter(p => p.owned && p.kind !== 'safehouse' && p.door).map(p => ({ id: p.id, name: p.name, kind: p.kind, pending: p.pending, cap: p.cap, x: +p.door.x, z: +p.door.z }));
  let velvet = null;
  try {
    const d = window.__app?.surface?.world?.doorList?.().find(x => x.kind === 'club');
    if (d) velvet = { x: d.x, z: d.z, name: 'Velvet office' };
  } catch (e) { velvet = null; }
  const hired = window.SSX?.crew?.state?.().crew || [];
  const crew = hired.map(m => ({ id: m.id, name: NAMES[m.id] || m.id }));
  const f = fronts[0];
  const spots = {};
  if (f) { spots.truck = { x: f.x - 55, z: f.z + 35 }; spots.drop = { x: f.x + 48, z: f.z - 20 }; }
  else if (velvet) { spots.truck = { x: velvet.x - 55, z: velvet.z + 35 }; spots.drop = { x: velvet.x + 48, z: velvet.z - 20 }; }
  let spot = null;
  try { spot = window.SSX?.crew?.spot?.() || null; } catch (e) { spot = null; }
  return { fronts, velvet, crew, spots, spot };
}
function me() {
  const i = window.__app?.surface?.info;
  return i ? { x: i.x, z: i.z } : null;
}
function applySkim(skims) {
  for (const s of skims || []) {
    const p = window.SSX?.empire?.prop?.(s.id);
    if (!p) continue;
    try { window.SSX.empire.debug.setPending(s.id, Math.max(0, Math.floor(p.pending - s.take))); } catch (e) { /* */ }
  }
}
function pin(x, z, label) {
  if (!Number.isFinite(+x)) return;
  const k = `${Math.round(x)}:${Math.round(z)}:${label || ''}`;
  if (pinKey !== k) {
    pinKey = k;
    try { window.SSX?.hudx?.setWaypoint?.({ x: +x, z: +z, label: label || 'Empire' }, true); } catch (e) { /* */ }
  }
  try { window.SSX?.guide?.aimGround?.({ id: 'empire', x: +x, z: +z, label: label || 'Empire' }); } catch (e) { /* */ }
}
function clearPin() {
  pinKey = '';
  try { window.SSX?.hudx?.setWaypoint?.(null, true); } catch (e) { /* */ }
}
const PING_CSS = `#empPing{display:none;position:fixed;z-index:12;top:calc(116px + var(--sat,0px));left:calc(108px + var(--sal,0px));right:calc(8px + var(--sar,0px));box-sizing:border-box;padding:8px 52px 8px 10px;border-radius:9px;background:#000;color:#fff;border:1px solid #fff;font:700 14px/1.35 system-ui,sans-serif;text-align:left}#empPing.on{display:block}#empPing .t{display:block}body:has(#empPing.on) #radio.mini{display:none!important}`;
function ensurePing() {
  let el = document.getElementById('empPing');
  if (el) return el;
  const st = document.createElement('style'); st.id = 'empPingCss'; st.textContent = PING_CSS; document.head.appendChild(st);
  el = document.createElement('div'); el.id = 'empPing';
  el.innerHTML = '<span class="t"></span><button type="button" class="ssx-x" aria-label="Close">✕</button>';
  document.body.appendChild(el);
  el.querySelector('.ssx-x').addEventListener('pointerup', e => { e.stopPropagation(); el.classList.remove('on'); });
  el.addEventListener('pointerup', e => { if (e.target.closest('.ssx-x')) return; pin(+el.dataset.ex, +el.dataset.ez, el.dataset.el || 'Empire'); });
  return el;
}
function show(p) {
  if (!p) return;
  const msg = p.text.startsWith(p.from) ? `📱 ${p.text}` : `📱 ${p.from}: ${p.text}`;
  try { window.__app?.toast?.(msg, 2400); } catch (e) { /* */ }
  const el = document.getElementById('toast');
  if (el) { el.dataset.emp = '1'; el.dataset.ex = String(p.x); el.dataset.ez = String(p.z); el.dataset.el = p.text; }
  // portrait hides #toast while the radio pill is up, so the same note also sits in one card over that slot
  const ping = ensurePing();
  ping.querySelector('.t').textContent = msg;
  ping.dataset.ex = String(p.x); ping.dataset.ez = String(p.z); ping.dataset.el = p.text;
  ping.classList.add('on');
  clearTimeout(show.t);
  show.t = setTimeout(() => ping.classList.remove('on'), 3200);
  pin(p.x, p.z, p.text);
  setTimeout(() => { if (state.prompt === p) { state.prompt = null; save(); } }, 8000);
}
function onHour(ev) {
  if (!ev || ev.catchUp) return;
  const r = E.tickHour(state, ev.hour, world());
  applySkim(r.skims);
  if (r.skims?.length) { try { window.__app?.toast?.(`💸 A sulking hand skimmed ${r.skims[0].take} cr off a till.`, 2200); } catch (e) { /* */ } }
  if (r.prompt) show(r.prompt);
  save();
}
function jobTick(dt) {
  if (!state.job) return;
  const p = me(); if (!p) return;
  const n = E.nearJob(state.job, p.x, p.z, dt);
  if (!n) return;
  if (n.advanced) {
    state.job = n.done ? null : n;
    if (n.paid) {
      try { window.__app?.surface?.game?.reward?.(0, n.paid); } catch (e) { /* */ }
      try { window.__app?.toast?.(`💵 Paid ${n.paid.toLocaleString('en-US')} cr.`, 2400); } catch (e) { /* */ }
      state.prompt = null;
      clearPin();
    }
    save();
  }
  const s = state.job?.steps?.[state.job.step];
  if (s) pin(s.x, s.z, s.text);
}
function nearestCrew(w) {
  let best = w.crew[0] || null, bs = -1;
  for (const c of w.crew) { const s = state.crew[c.id]?.since || 0; if (s >= bs) { bs = s; best = c; } }
  return best;
}
function talk() {
  const w = world();
  const who = nearestCrew(w) || { id: 'dex', name: 'Dex Malone' };
  const c = E.visit(state, who.id);
  const kinds = ['racket', 'truck', 'chop', 'smuggle', 'defend', 'skim'];
  const job = E.startJob(kinds[(state.n || 0) % kinds.length], w.spots, w);
  if (job) { state.job = job; state.n = (state.n || 0) + 1; state.prompt = null; }
  save();
  const line = `${who.name}: Loyalty ${Math.round(c.loyalty)} of 100. ${job ? 'I have a job. Follow the arrow.' : 'Nothing to run yet.'}`;
  try { window.__app?.toast?.(line, 3200); } catch (e) { /* */ }
  return { loyalty: c.loyalty, job, who: who.id };
}
function nearTalk() {
  const p = me(); if (!p) return false;
  const w = world();
  if (w.velvet && Math.hypot(p.x - w.velvet.x, p.z - w.velvet.z) < 18) return true;
  if (w.spot && Math.hypot(p.x - w.spot.x, p.z - w.spot.z) < 8) return true;
  return false;
}
function ensureBtn() {
  let b = document.getElementById('empTalk');
  if (b) return b;
  const sb = document.getElementById('surfBtns'); if (!sb) return null;
  b = document.createElement('button'); b.id = 'empTalk'; b.className = 'glass'; b.type = 'button';
  b.style.minHeight = '48px'; b.style.minWidth = '48px';
  sb.insertBefore(b, sb.firstChild);
  b.addEventListener('pointerup', e => { e.preventDefault(); talk(); paintBtn(); });
  return b;
}
function paintBtn() {
  const b = ensureBtn(); if (!b) return;
  const on = nearTalk() && !state.job;
  b.style.display = on ? '' : 'none';
  if (!on) return;
  const w = world(); const who = nearestCrew(w);
  const loy = who ? Math.round((state.crew[who.id]?.loyalty ?? 70)) : 70;
  b.textContent = who ? `👥 ${who.name.split(' ')[0]} · ${loy}` : '👥 Check in';
}

function boot() {
  if (!window.SSX?.empire?.on) { setTimeout(boot, 400); return; }
  const toast = document.getElementById('toast');
  if (toast && !toast.dataset.empHook) {
    toast.dataset.empHook = '1';
    toast.addEventListener('pointerup', e => {
      if (e.target.closest?.('.ssx-x')) return;
      if (toast.dataset.emp !== '1') return;
      pin(+toast.dataset.ex, +toast.dataset.ez, toast.dataset.el || 'Empire');
    });
  }
  try { window.SSX.empire.on('hour', onHour); } catch (e) { /* */ }
  let last = performance.now();
  setInterval(() => {
    const now = performance.now(); const dt = Math.min(1, (now - last) / 1000); last = now;
    try { jobTick(dt); paintBtn(); } catch (e) { /* */ }
  }, 400);
  window.SSX.empirePrompt = {
    state: () => state,
    mapPlaces: () => E.mapMarks(state),
    loyalty: id => ({ ...(state.crew[id] || { loyalty: 70, since: 0 }) }),
    talk,
    debug: {
      force(kind = 'till') {
        const w = world();
        const base = w.fronts[0] || { id: 'fr-wash', name: 'Red Dust Wash & Fold', kind: 'laundromat', pending: 450, cap: 450, x: 0, z: 0 };
        const fronts = w.fronts.length ? w.fronts : [base];
        const world2 = { ...w, fronts, velvet: w.velvet || { x: base.x, z: base.z, name: 'Velvet office' }, crew: w.crew.length ? w.crew : [{ id: 'dex', name: 'Dex Malone' }], spots: w.spots.truck ? w.spots : { truck: { x: base.x - 55, z: base.z + 35 }, drop: { x: base.x + 48, z: base.z - 20 } } };
        let p;
        if (kind === 'till') p = { kind: 'till', from: fronts[0].name, text: E.noteText('till', fronts[0].name), x: fronts[0].x, z: fronts[0].z, job: null };
        else if (kind === 'crew') p = { kind: 'crew', from: world2.crew[0].name, text: E.noteText('crew', world2.crew[0].name), x: world2.velvet.x, z: world2.velvet.z, who: world2.crew[0].id, job: null };
        else {
          const job = E.startJob(kind, world2.spots, world2);
          p = { kind, from: fronts[0].name, text: E.noteText(kind, fronts[0].name), x: job.steps[0].x, z: job.steps[0].z, job };
          state.job = job;
        }
        state.prompt = p;
        show(p);
        save();
        return p;
      },
      tick(hour, worldIn) { const r = E.tickHour(state, hour, worldIn || world()); save(); return r; },
      reset() { state = E.fresh(); pinKey = ''; save(); }
    }
  };
}
boot();
