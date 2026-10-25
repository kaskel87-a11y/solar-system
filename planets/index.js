// Multi-planet expansion (steve/multi-planet). planets/*.js are pure data; planets/hooks.js is the ONLY file that touches core
// (v7.3 registerColony / registerMission / menu hooks when present, v7.2 registries otherwise).
// Core touch points: one import + initPlanets(window.__app) in index.html, and the VEHICLE_BUILDERS hook in world.js.
import { registerColony, registerMission, registerCosmetics, registerVehicles, colonyOf, missionsFor, addMenuItem, tap, STATIONS } from './hooks.js?v=7.5.1';
import { EXT_VEHICLES } from './vehicles.js?v=7.5.1';
import venus from './venus.js?v=7.5.1';
import mercury from './mercury.js?v=7.5.1';
import titan from './titan.js?v=7.5.1';
import europa from './europa.js?v=7.5.1';
import io from './io.js?v=7.5.1';
import referrals from './referrals.js?v=7.5.1';

export const PLANETS = [venus, mercury, titan, europa, io];
const KEY = 'ssx.planets.v1', FEE = 40;

// ---------- registration (runs at import, before any landing builds a colony) ----------
registerVehicles(EXT_VEHICLES);
referrals.forEach(registerMission);
for (const p of PLANETS) { registerColony(p.world, p.colony); registerCosmetics(p.cosmetics); p.quests.forEach(registerMission); }

// ---------- persistent travel state ----------
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
let S = Object.assign({ visited: [] }, load());
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };
const HOME = [{ world: 'Mars', colony: colonyOf('Mars') }, { world: 'Moon', colony: colonyOf('Moon') }].filter(h => h.colony);

export function initPlanets(app) {
  if (!app || app.__planets) return; app.__planets = true;
  const doneQ = id => !!app.game?.progress?.quests?.[id]?.everDone;
  const unlocked = p => !p.permit || S.visited.includes(p.world) || doneQ(p.permit.quest);

  // ---- ☰ menu entry (no new permanent HUD button) ----
  const css = document.createElement('style');
  css.textContent = `#colPanel{position:fixed;inset:0;z-index:14;display:none;background:rgba(4,6,16,.94);overflow-y:auto;-webkit-overflow-scrolling:touch;padding:calc(16px + var(--sat,0px)) calc(16px + var(--sar,0px)) calc(24px + var(--sab,0px)) calc(16px + var(--sal,0px));box-sizing:border-box;color:#fff}
#colPanel .wrap{max-width:640px;margin:0 auto}#colPanel h2{margin:6px 0 4px}#colPanel p.sub{margin:0 0 12px;opacity:.7;font-size:.82rem}
#colPanel .item{padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.06);margin-bottom:8px;font-size:.88rem;line-height:1.4}
#colPanel .item b{color:#ffd25a}#colPanel .item.here{border-left:3px solid #38bdf8}#colPanel .item.locked{opacity:.55}
#colPanel .item small{display:block;opacity:.75}#colPanel .row{display:flex;gap:8px;margin-top:8px}
#colPanel .row button{min-height:40px;padding:6px 14px;border-radius:10px;font-weight:700;touch-action:manipulation}
#colClose{position:sticky;top:0;float:right}`;
  document.head.appendChild(css);
  const panel = document.createElement('div'); panel.id = 'colPanel';
  panel.innerHTML = '<div class="wrap"><button id="colClose" class="btn">✕ Close</button><h2>🌍 Colonies</h2><p class="sub">Fast travel: auto-flies you there and lands. Manual flight always works too.</p><div id="colList"></div></div>';
  document.body.appendChild(panel);
  const close = () => { panel.style.display = 'none'; };
  tap(document.getElementById('colClose'), close);
  addMenuItem(app, { id: 'colBtn', label: '🌍 Colonies', onTap: () => open() });

  function entries() {
    return [...HOME.map(h => ({ world: h.world, colony: h.colony, home: true })), ...PLANETS.map(p => ({ world: p.world, colony: p.colony, p }))];
  }
  function render() {
    const st = app.state, here = st.onSurface ? st.info?.name : null, cr = app.game?.progress?.credits ?? 0;
    const list = panel.querySelector('#colList'); list.innerHTML = '';
    for (const e of entries()) {
      const open_ = e.home || unlocked(e.p), visited = e.home || S.visited.includes(e.world), fee = visited ? 0 : FEE;
      const it = document.createElement('div'); it.className = 'item' + (here === e.world ? ' here' : '') + (open_ ? '' : ' locked'); it.dataset.world = e.world;
      const jobs = missionsFor(e.world).filter(q => q.contact).length;
      it.innerHTML = `<b>${e.colony.name}</b> · ${e.world}<small>${e.p ? (e.p.colony.contacts || []).map(c => c.name).join(', ') + ' · ' : ''}${jobs} jobs${e.p ? ' · ride: ' + EXT_VEHICLES[e.p.vehicles[0]].name : ''}</small>`;
      const row = document.createElement('div'); row.className = 'row';
      const go = document.createElement('button'); go.className = 'btn'; go.dataset.go = e.world;
      if (here === e.world) { go.textContent = '📍 You are here'; go.disabled = true; }
      else if (!open_) { go.textContent = `🔒 Permit: job from ${e.p.permit.from}`; go.disabled = true; }
      else { go.textContent = fee ? `🚀 Travel · ${fee} cr` : '🚀 Travel · free'; if (fee > cr) { go.disabled = true; go.textContent = `🚀 Need ${fee} cr`; } else tap(go, () => travelTo(e.world, fee)); }
      row.appendChild(go); it.appendChild(row); list.appendChild(it);
    }
  }
  function open() { render(); panel.style.display = 'block'; }

  function travelTo(world, fee = 0) {
    const body = app.bodies.find(b => b.name === world); if (!body) return false;
    const st = app.state; if (st.transitioning || (st.onSurface && st.info?.name === world)) return false;
    if (fee) { const P = app.game?.progress; if (!P || P.credits < fee) return false; P.credits -= fee; app.game.save?.(); }
    close(); app.toast?.(`🚀 Course set: ${colonyOf(world)?.name || world}`);
    if (!st.onSurface) { app.landOn(body.mesh); return true; }
    app.takeOff();
    const t0 = performance.now(), wait = () => {
      const s = app.state;
      if (!s.onSurface && !s.transitioning && s.flying) return app.landOn(body.mesh);
      if (performance.now() - t0 < 15000) setTimeout(wait, 150);
    };
    setTimeout(wait, 150);
    return true;
  }

  // ---- visit tracking + local DJ lines merged into the stock stations while on a colony world ----
  const ORIG = STATIONS.map(s => s.dj ? [...s.dj] : null);
  let lastWorld = null;
  setInterval(() => {
    const st = app.state, w = st.onSurface ? st.info?.name : null;
    if (w === lastWorld) return; lastWorld = w;
    const p = PLANETS.find(x => x.world === w);
    if (p && !S.visited.includes(w)) { S.visited.push(w); persist(); }
    STATIONS.forEach((s, i) => { if (ORIG[i]) s.dj = p?.radio && s.id !== 'void' ? [...p.radio, ...ORIG[i]] : [...ORIG[i]]; });
  }, 1000);

  const quests = {}; for (const q of [...referrals, ...PLANETS.flatMap(p => p.quests)]) (quests[q.world] ||= []).push(q.id);
  app.planets = { list: PLANETS.map(p => p.world), quests, open, close, render, travelTo, unlocked: w => { const p = PLANETS.find(x => x.world === w); return !p || unlocked(p); }, state: () => S };
}
