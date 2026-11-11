// v7.5.42 Crew: hire people once your lifetime ⭐ hits 10k (more slots at 25k / 50k / 100k), send them on timed jobs that run on the
// real clock (and while you're away), collect cr + ⭐. Rules live in crewcore.js. Cash goes through Ben's Empire layer (PR #52):
// with a front owned it's washed into that front's till (+15%, collect at the counter like any front income; SSX.empire.launder),
// without one it's paid from this panel. Upgrades cost cr + spendable ⭐ (SSX.stars, the Star Shop wallet).
// World: the crew hang out in Ares Junction near the Red Dust Wash (4 boxes each, shared materials, culled past 90 m).
// ☰ → 👥 Crew, the 👥 Crew button in the Empire panel, or walk up to them. window.SSX.crew (debug API for tests).
import * as THREE from 'three';
import * as C from './crewcore.js';
import { panelTap, tap } from './racehooks.js';

const W = () => (typeof window !== 'undefined' ? window : null), SSX = () => W()?.SSX, APP = () => W()?.__app;
const game = () => APP()?.surface?.game, esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const S = { ui: null, root: null, figs: {}, spot: null, colKey: '', near: null, tc: null, now: () => Date.now(), rng: Math.random, note: '', warned: {} };
let D = C.fresh();
function load() { try { D = C.load(localStorage.getItem(C.KEY)); } catch (e) { D = C.fresh(); } }
function save() { try { localStorage.setItem(C.KEY, JSON.stringify(D)); } catch (e) { /* private mode */ } }
const stars = () => Math.max(0, game()?.progress?.xp | 0);
const credits = () => game()?.progress?.credits | 0;
const toast = (t, ms = 2800) => { if (panelOn()) { S.note = t; render(); return; } try { APP()?.toast?.(t, ms); } catch (e) { /* */ } };
const emp = () => { const E = SSX()?.empire; return E && typeof E.launder === 'function' ? E : null; };
const fronts = () => { try { return emp()?.fronts?.() || []; } catch (e) { return []; } };
const frontRate = id => fronts().find(f => f.id === id)?.rate || 0;
const roster = id => C.ROSTER.find(r => r.id === id);
const meetBonus = () => { try { return SSX()?.crimebreak?.payBonus?.() || 0; } catch (e) { return 0; } };
const fmtT = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`; };

// ---------- the clock ----------
function pump() {
  const now = S.now(); let changed = false;
  for (const m of D.crew) {
    const done = C.step(m, now, S.rng, frontRate, meetBonus()); if (!done.length) continue; changed = true;
    const r = roster(m.id), last = done[done.length - 1];
    toast(last.bust ? `🚨 ${r.name} got picked up by ColSec. Bail him out or wait ${C.HOLD_MIN} min (☰ → 👥 Crew).` : `👥 ${r.name}: ${C.JOBS[last.job].name} done. Collect in ☰ → 👥 Crew.`, 3600);
  }
  const nx = C.canHire(D, stars()); if (nx && !S.warned[nx.id]) { S.warned[nx.id] = 1; if (!D.met.includes(nx.id)) setTimeout(() => toast(`👥 Word's out about your ⭐. ${nx.name.split(' ')[0]} wants to work for you: ☰ → 👥 Crew.`, 4200), 1500); }
  if (changed) save(); if (panelOn()) render();
}

// ---------- actions ----------
function hire() { const m = C.hire(D, stars()); if (!m) return { ok: false, why: `Next crew slot at ${C.nextSlot(stars())?.toLocaleString() ?? '—'} ⭐.` }; if (!D.met.includes(m.id)) D.met.push(m.id); save(); toast(`🤝 ${roster(m.id).name} is on your crew. Give him a job.`); return { ok: true, id: m.id }; }
function assign(id, job) {
  const m = D.crew.find(q => q.id === id); if (!m) return { ok: false, why: 'Not on your crew.' };
  if (m.held > S.now()) return { ok: false, why: 'He\u2019s in holding.' }; const f = fronts(), ok = C.canAssign(m, job, f); if (!ok.ok) return ok;
  const best = f.slice().sort((a, b) => b.rate - a.rate)[0]?.id || null; C.assign(m, job, S.now(), best); save(); return { ok: true };
}
function stop(id) { const m = D.crew.find(q => q.id === id); if (!m) return { ok: false }; m.job = null; m.at = 0; save(); return { ok: true }; }
function collect(id) {
  const m = D.crew.find(q => q.id === id); if (!m || !m.bank.length) return { ok: false, why: 'Nothing to collect.' };
  const pref = m.bank.find(b => b.front)?.front || m.front, r = C.collect(D, m), g = game(); let where = null, cr = r.cr;
  try { const cut = SSX()?.mobboss?.crewCut?.() || 0; if (cut > 0 && cr > 0) cr = Math.round(cr * (1 + cut)); } catch (e) { /* */ }
  if (cr > 0) { const E = emp(); if (E && fronts().length) { cr = Math.round(cr * (1 + C.WASH)); const w = E.launder(cr, pref); where = w?.name || null; if (!w) cr = r.cr; } }
  if (!where && cr > 0) g?.reward?.(0, cr); if (r.xp > 0) g?.reward?.(r.xp, 0);
  save(); const b = r.busts ? ` (${r.busts} bust${r.busts > 1 ? 's' : ''})` : '';
  toast(where ? `🧺 ${cr} cr washed through ${where}, collect it at the counter. +${r.xp} ⭐${b}` : `💵 +${cr} cr, +${r.xp} ⭐ from ${roster(m.id).name.split(' ')[0]}${b}`, 3400);
  return { ok: true, ...r, cr, where };
}
function bail(id) {
  const m = D.crew.find(q => q.id === id), now = S.now(); if (!m || !(m.held > now)) return { ok: false, why: 'He\u2019s not in holding.' };
  const b = m.bank.slice().reverse().find(x => x.bust)?.bail || 200; if (credits() < b || !game()?.spend?.(b)) return { ok: false, why: `Bail is ${b} cr.` };
  C.bail(m, now); D.stats.bail += b; save(); toast(`🔓 Paid ${b} cr bail. ${roster(m.id).name.split(' ')[0]} is back on the job.`); return { ok: true, cost: b };
}
function level(id) {
  const m = D.crew.find(q => q.id === id), c = C.canLevel(m); if (!c) return { ok: false, why: 'Maxed out.' }; const St = SSX()?.stars;
  let cost = c.cr; try { const off = SSX()?.mobboss?.levelOff?.() || 0; if (off > 0) cost = Math.max(1, Math.round(c.cr * (1 - off))); } catch (e) { /* */ }
  if (credits() < cost) return { ok: false, why: `Need ${cost} cr.` }; if (!St || !St.canSpend?.(c.xp)) return { ok: false, why: `Need ${c.xp} spendable ⭐.` };
  const r = St.spend(c.xp, 'crew:' + id); if (r && r.ok === false) return { ok: false, why: `Need ${c.xp} spendable ⭐.` }; if (!game()?.spend?.(cost)) { St.refund?.(c.xp); return { ok: false, why: `Need ${cost} cr.` }; }
  m.lv++; save(); toast(`⬆️ ${roster(id).name.split(' ')[0]} is level ${m.lv}: ${m.lv === 2 ? 'boosting rides unlocked' : 'fronts and scores unlocked'}.`); return { ok: true, lv: m.lv };
}

// ---------- panel ----------
const CSS = `#crewPanel{position:fixed;inset:0;z-index:57;display:none;align-items:flex-end;justify-content:center;background:rgba(4,6,12,.5)}
#crewPanel.on{display:flex}#crewPanel .wrap{width:min(96vw,460px);max-height:78vh;overflow:auto;-webkit-overflow-scrolling:touch;margin-bottom:calc(8px + env(safe-area-inset-bottom));background:rgba(12,14,18,.97);border:1px solid rgba(255,255,255,.18);border-radius:16px;padding:12px;color:#e8ecf4;font:13px system-ui,sans-serif;box-sizing:border-box}
#crewPanel h2{margin:2px 0 6px;font-size:16px}#crewPanel .sum{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}#crewPanel .sum b{padding:3px 8px;border-radius:8px;background:rgba(255,255,255,.08);font-size:12px}
#crewPanel .m{border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:8px;margin:6px 0;background:rgba(255,255,255,.03)}#crewPanel .m q{display:block;font-style:italic;opacity:.85;margin:4px 0}
#crewPanel .bar{height:6px;border-radius:3px;background:rgba(255,255,255,.12);margin:5px 0;overflow:hidden}#crewPanel .bar i{display:block;height:100%;background:#d8d8d8}
#crewPanel .btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}#crewPanel button{min-height:44px;padding:8px 12px;border-radius:10px;border:1px solid #555;background:#000;color:#fff;font:600 13px system-ui,sans-serif;touch-action:manipulation}
#crewPanel button:disabled{opacity:.45}#crewPanel .note{background:rgba(255,255,255,.08);border-radius:8px;padding:6px 8px;margin:4px 0}#crewPanel small{opacity:.75}
#crewBtn{background:#000!important;color:#fff!important}`;
function ensureUi() {
  if (S.ui || typeof document === 'undefined') return S.ui;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const panel = document.createElement('div'); panel.id = 'crewPanel'; panel.innerHTML = '<div class="wrap"></div>'; document.body.appendChild(panel);
  panel.addEventListener('pointerdown', e => { if (e.target === panel) close(); });
  panelTap(panel, e => { const b = e.target?.closest?.('button'); if (b && !b.disabled) act(b.dataset); });
  S.ui = { panel, wrap: panel.firstChild }; return S.ui;
}
const panelOn = () => !!S.ui?.panel.classList.contains('on');
function open() { ensureUi(); S.ui.panel.classList.add('on'); pump(); render(); clearInterval(S.iv); S.iv = setInterval(() => panelOn() ? render() : clearInterval(S.iv), 1000); return true; }
function close() { S.ui?.panel.classList.remove('on'); S.note = ''; clearInterval(S.iv); return true; }
function act(ds) {
  const a = ds.a, id = ds.id; let r = null; if (a === 'close') return close();
  if (a === 'empire') { close(); try { SSX()?.empire?.open?.(); } catch (e) { /* */ } return; }
  if (a === 'hire') r = hire(); else if (a === 'job') r = assign(id, ds.job); else if (a === 'stop') r = stop(id); else if (a === 'collect') r = collect(id); else if (a === 'bail') r = bail(id); else if (a === 'lv') r = level(id);
  if (r && !r.ok && r.why) S.note = '❌ ' + r.why; render();
}
function memberHtml(m, now, fr) {
  const r = roster(m.id), st = C.busy(m, now), J = C.JOBS[m.job], lv = C.canLevel(m), sp = SSX()?.stars?.balance?.() ?? 0;
  let line = st === 'held' ? `🚨 In holding · out in ${fmtT(m.held - now)}` : st === 'full' ? `⏸️ Waiting for you: ${m.bank.length} jobs done` : st === 'working' ? `${J.icon} ${J.name} · ${fmtT(m.at + J.min * 60000 - now)} left` : '💤 Idle';
  const bar = st === 'working' ? `<div class="bar"><i style="width:${Math.round(C.progress(m, now) * 100)}%"></i></div>` : '';
  const bank = m.bank.length ? (() => { let cr = 0, xp = 0, bu = 0; for (const b of m.bank) { cr += b.cr; xp += b.xp; bu += b.bust ? 1 : 0; } return `<div>📦 ${m.bank.length}/${C.BANK} done: ${cr} cr · ${xp} ⭐${bu ? ` · 🚨 ${bu} bust` : ''}</div>`; })() : '';
  const jobs = C.ORDER.map(k => { const q = C.JOBS[k], ok = C.canAssign(m, k, fr), cash = C.jobCash(k, m.lv, q.front ? (fr.slice().sort((a, b) => b.rate - a.rate)[0]?.rate || 0) : 0, meetBonus());
    return `<button data-a="job" data-id="${m.id}" data-job="${k}" ${!ok.ok || st === 'held' || m.job === k ? 'disabled' : ''} title="${esc(q.blurb)}">${q.icon} ${q.name} · ${q.min}m · ${cash} cr${m.lv < q.tier ? ` · 🔒 Lv${q.tier}` : ''}</button>`; }).join('');
  let btns = ''; if (m.bank.length) btns += `<button data-a="collect" data-id="${m.id}">💵 Collect</button>`;
  if (st === 'held') { const b = m.bank.slice().reverse().find(x => x.bust)?.bail || 200; btns += `<button data-a="bail" data-id="${m.id}" ${credits() < b ? 'disabled' : ''}>🔓 Bail ${b} cr</button>`; }
  if (m.job) btns += `<button data-a="stop" data-id="${m.id}">⏹ Stand down</button>`;
  if (lv) btns += `<button data-a="lv" data-id="${m.id}" ${credits() < lv.cr || sp < lv.xp ? 'disabled' : ''}>⬆️ Lv${m.lv + 1}: ${lv.cr} cr + ${lv.xp} ⭐</button>`;
  return `<div class="m"><b>${esc(r.name)}</b> <small>· Lv${m.lv} · bust ${Math.round(C.bustOf(m.job || 'hustle', m.lv) * 100)}%</small><div>${line}</div>${bar}${bank}<div class="btns">${btns}</div><div class="btns">${jobs}</div></div>`;
}
function render() {
  if (!S.ui) return; const now = S.now(), xp = stars(), fr = fronts(), nx = C.canHire(D, xp), ns = C.nextSlot(xp);
  const recruit = nx ? `<div class="m"><b>${esc(nx.name)}</b><q>“${esc(nx.intro)}”</q><div class="btns"><button data-a="hire">🤝 Hire ${esc(nx.name.split(' ')[0])}</button></div></div>` : '';
  const locked = !D.crew.length && !nx ? `<div class="note">🔒 Your first crew member shows up at ${C.SLOTS[0].toLocaleString()} ⭐. You have ${xp.toLocaleString()} ⭐.</div>` : '';
  const wash = fr.length ? `🧺 Cash is washed through your fronts (+${Math.round(C.WASH * 100)}%). Collect it at the counter.` : '🏢 Own a front (☰ → 🏢 Empire) and crew cash gets washed through it for +15%.';
  S.ui.wrap.innerHTML = `${S.note ? `<div class="note">${esc(S.note)}</div>` : ''}<h2>👥 Crew</h2><div class="sum"><b>⭐ ${xp.toLocaleString()}</b><b>${D.crew.length}/${C.slotsFor(xp)} slots</b>${ns ? `<b>next slot ${ns.toLocaleString()} ⭐</b>` : ''}<b>jobs ${D.stats.jobs} · busts ${D.stats.busts}</b></div>
${locked}${D.crew.map(m => memberHtml(m, now, fr)).join('')}${recruit}<small>${wash} Jobs keep running while you're away, up to ${C.BANK} each.</small>
<div class="btns"><button data-a="empire">🏢 Empire</button><button data-a="close">Close</button></div>`;
}

// ---------- the crew in the world (Ares Junction, by the Red Dust Wash) ----------
const MAT = {}; const mat = c => (MAT[c] ||= new THREE.MeshLambertMaterial({ color: c }));
let GEO = null;
function figure(r) {
  GEO ||= { legs: new THREE.BoxGeometry(0.42, 0.85, 0.24), torso: new THREE.BoxGeometry(0.56, 0.72, 0.3), head: new THREE.BoxGeometry(0.28, 0.3, 0.28), hat: new THREE.BoxGeometry(0.31, 0.12, 0.31) };
  const g = new THREE.Group(), L = r.look, add = (geo, m, y) => { const o = new THREE.Mesh(geo, mat(m)); o.position.y = y; g.add(o); return o; };
  add(GEO.legs, L.body, 0.43); add(GEO.torso, L.coat, 1.22); add(GEO.head, L.skin, 1.74); add(GEO.hat, L.hat, 1.93); g.name = 'crew-' + r.id; return g;
}
function worldTick(dt, tc) {
  S.tc = tc; if (!/mars/i.test(tc.name || '')) { if (S.root) S.root.visible = false; setNear(null); return; }
  const c = SSX()?.city?.colony?.(); if (!c) return; const key = `${Math.round(c.x)}|${Math.round(c.z)}`;
  if (!S.root || S.colKey !== key) { S.root?.parent?.remove(S.root); S.root = new THREE.Group(); S.root.name = 'crew'; tc.scene.add(S.root); S.figs = {}; S.colKey = key;
    let x = c.x - 50, z = c.z + 30; try { const q = tc.world?.freeSpot?.(x, z, 1.4); if (q) { x = q.x; z = q.z; } } catch (e) { /* */ } S.spot = { x, z }; }
  const px = tc.car ? tc.car.x : tc.player.x, pz = tc.car ? tc.car.z : tc.player.z, d = Math.hypot(px - S.spot.x, pz - S.spot.z), now = S.now();
  // who's standing around: hired crew who are idle / waiting / back from holding, plus the next recruit waiting to meet you
  const show = D.crew.filter(m => C.busy(m, now) !== 'working' && C.busy(m, now) !== 'held').map(m => m.id); const nx = C.canHire(D, stars()); if (nx) show.push(nx.id);
  S.root.visible = d < 90 && !tc.world?.inside && show.length > 0; if (!S.root.visible) { setNear(null); return; }
  show.forEach((id, i) => { const r = roster(id); let f = S.figs[id]; if (!f) { f = S.figs[id] = figure(r); S.root.add(f); }
    const x = S.spot.x + (i - (show.length - 1) / 2) * 1.1, z = S.spot.z + (i % 2) * 0.5; f.position.set(x, tc.height(x, z), z); f.rotation.y = Math.atan2(px - x, pz - z); f.visible = true; });
  for (const [id, f] of Object.entries(S.figs)) if (!show.includes(id)) f.visible = false;
  setNear(d < 4.5 && !tc.car ? show[0] : null);
}
function setNear(id) {
  if (S.near === id) return; S.near = id; const sb = document.getElementById('surfBtns'); if (!sb) return;
  if (!S.btn) { S.btn = document.createElement('button'); S.btn.id = 'crewBtn'; S.btn.className = 'glass'; sb.insertBefore(S.btn, sb.firstChild); tap(S.btn, () => open()); }
  S.btn.style.display = id ? '' : 'none'; if (id) S.btn.textContent = `👥 ${roster(id).name.split(' ')[0]}`;
}

export const crew = {
  version: 1, key: C.KEY, open, close, get isOpen() { return panelOn(); }, hire, assign, stop, collect, bail, level, pump,
  state: () => JSON.parse(JSON.stringify(D)), slots: () => C.slotsFor(stars()), stars, spot: () => (S.spot ? { ...S.spot } : null), save, reload() { load(); return true; },
  debug: { clock(fn) { S.now = typeof fn === 'function' ? fn : () => Date.now(); return true; }, rng(fn) { S.rng = typeof fn === 'function' ? fn : Math.random; return true; }, reset() { D = C.fresh(); save(); return true; } }
};
(function boot() {
  if (typeof window === 'undefined') return;
  if (!window.SSX?.registerSurfaceTick || !window.__app) { setTimeout(boot, 300); return; }
  if (window.SSX.crew) return; load(); window.SSX.crew = crew;
  try { window.SSX.registerMenuItem({ id: 'rmCrew', label: '👥 Crew', onTap: () => open() }); } catch (e) { console.warn('crew menu', e); }
  window.SSX.registerSurfaceTick((dt, tc) => { try { worldTick(dt, tc); } catch (e) { console.warn('crew tick', e); } });
  pump(); setInterval(() => { try { pump(); } catch (e) { /* */ } }, 5000);
  addEventListener('pagehide', () => { try { save(); } catch (e) { /* */ } });
})();
