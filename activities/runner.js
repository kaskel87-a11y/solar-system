// Mars repeatable side-activity runner (steve/mars-activities).
// Loads activities/side-activities.json. Entry: context button near a start + ☰ "Mars side jobs".
// ONE shared tick hook: surface.js calls activityTick(dt, ctx) next to raceTick.
// Districts resolved by distance to AJ-relative centres until registerDistrict lands.
// Does NOT build an ambient event spawner (CoS encounter director owns random-events.json).
import { addMenuItem, tap } from '../racehooks.js?v=7.4';
import { openPokerTable, closePoker, pokerIsOpen, tryBark } from './poker.js?v=7.4';

const LS = 'ssx.mars.act.v1';
const DISTRICTS = {
  'mars-downtown': { id: 'mars-downtown', name: 'Olympus Row', centre: [0, -430] },
  'mars-rough': { id: 'mars-rough', name: 'Red Tape Flats', centre: [-280, -40] },
  'mars-gated': { id: 'mars-gated', name: 'Helios Heights', centre: [320, 80] },
  'mars-highway': { id: 'mars-highway', name: 'Ares Beltway', centre: [0, -200] },
};
// Core gaps that block a honest loop — skip (no broken UI). Taxi/leaderboard degrade instead.
const DEFERRED = new Set(); // Static Hold'em now playable via activities/poker.js
const DEGRADE = {
  'act-beltway-taxi': 'simple_taxi',       // no smooth-drive meter → flat delivery fare
  'act-beltway-trial': 'local_best_only',  // no online leaderboard → localStorage best
};

const CSS = `
#actCtxBtn { background: linear-gradient(135deg, rgba(60,200,255,0.75), rgba(80,120,255,0.75)) !important; border-color: rgba(160,220,255,0.55) !important; }
#actChip { display: none; pointer-events: none; padding: 6px 10px; border-radius: 10px; background: rgba(8,16,36,0.82); border: 1px solid rgba(120,180,255,0.35); color: #e8f0ff; font-size: 0.72rem; line-height: 1.25; margin-bottom: 6px; max-width: 220px; }
#actChip.on { display: block; }
#actChip b { color: #9ad0ff; }
#actPanel { position: fixed; inset: 0; z-index: 14; display: none; background: rgba(8,4,12,0.95); overflow-y: auto; -webkit-overflow-scrolling: touch; color: #fff;
  padding: calc(16px + var(--sat, 0px)) calc(16px + var(--sar, 0px)) calc(24px + var(--sab, 0px)) calc(16px + var(--sal, 0px)); box-sizing: border-box; }
#actPanel.on { display: block; } #actPanel .wrap { max-width: 640px; margin: 0 auto; } #actPanel h2 { margin: 6px 0 2px; }
#actPanel .sub { opacity: 0.7; font-size: 0.8rem; margin-bottom: 10px; }
#actPanel .item { padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,0.06); margin-bottom: 8px; font-size: 0.84rem; border: 1px solid rgba(255,255,255,0.08); }
#actPanel .item.deferred { opacity: 0.55; } #actPanel .item small { opacity: 0.72; display: block; margin-top: 2px; }
#actPanel .item .row { display: flex; gap: 6px; margin-top: 8px; }
#actPanel button { min-height: 40px; border-radius: 10px; font-weight: 800; color: #fff; background: rgba(40,56,96,0.95); border: 1px solid rgba(120,160,255,0.35); padding: 0 12px; font-size: 0.82rem; }
#actPanel button.go { background: linear-gradient(135deg, rgba(60,200,255,0.95), rgba(80,120,255,0.95)); border: none; flex: 1; }
#actPanel .close { float: right; } #actPanel .foot { display: flex; gap: 8px; margin-top: 12px; } #actPanel .foot button { flex: 1; }
`;

let pack = null, data = load(), ui = null, C = null, lastTick = 0;
let active = null; // { def, missionId, startedAt, streakPaid, duelArmed, gates, gi, t0, mode }
let nearAct = null, ctxT = 0, chipT = 0;
let registered = false;

function load() {
  try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { return {}; }
}
function save() { try { localStorage.setItem(LS, JSON.stringify(data)); } catch (e) {} }
function toast(msg, ms = 2800) {
  const a = app(); if (a?.toast) a.toast(msg, ms);
  else if (C?.game) {/* no-op */}
}

/** Feature-detect Marsmania contraband/price API — fallback to fixed payouts. */
function contrabandPayout(kind, fallback) {
  const S = typeof window !== 'undefined' ? window.SSX : null;
  if (!S) return fallback;
  try {
    if (typeof S.contrabandPrice === 'function') {
      const v = S.contrabandPrice(kind);
      if (typeof v === 'number' && v >= 0) return v;
    }
    if (typeof S.contraband === 'function') {
      const v = S.contraband(kind);
      if (typeof v === 'number' && v >= 0) return v;
      if (v && typeof v.price === 'number') return v.price;
    }
    if (S.prices && typeof S.prices[kind] === 'number') return S.prices[kind];
    if (typeof S.price === 'function') {
      const v = S.price(kind);
      if (typeof v === 'number' && v >= 0) return v;
    }
  } catch (e) {}
  return fallback;
}

function sayNpc(npc, category, fallbackText) {
  if (tryBark({ name: npc, kind: 'contact' }, category)) return;
  if (fallbackText) toast(fallbackText);
}
function app() { return typeof window !== 'undefined' ? window.__app : null; }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function districtAt(x, z) {
  let best = null, bd = 1e9;
  for (const d of Object.values(DISTRICTS)) {
    const dist = Math.hypot(d.centre[0] - x, d.centre[1] - z);
    if (dist < bd) { bd = dist; best = d; }
  }
  // Prefer Beltway when far from the three hubs but near the highway centre
  const hwy = DISTRICTS['mars-highway'];
  const hd = Math.hypot(hwy.centre[0] - x, hwy.centre[1] - z);
  if (bd > 140 && hd < 160) return hwy;
  return best;
}

async function ensurePack() {
  if (pack) return pack;
  const url = new URL('./side-activities.json', import.meta.url);
  const res = await fetch(url);
  pack = await res.json();
  return pack;
}

function phoneCap(def) {
  const mobile = !!(C && (C.isMobile || document.body.classList.contains('touch')));
  return mobile ? (def.caps?.phone_npc_max ?? 6) : (def.caps?.desktop_npc_max ?? 10);
}

function compileSteps(def) {
  const steps = [];
  let tpl = def.loop?.steps_template || [];
  // Convoy: prefer escort variant (street intercept is fine too — pick escort)
  if (!tpl.length && def.loop?.steps_escort) tpl = def.loop.steps_escort;
  // Funeral bets: run-yourself alley race from local pts
  if (!tpl.length && def.loop?.alley_pts_local) {
    const c = DISTRICTS[def.district]?.centre || [0, 0];
    const pts = def.loop.alley_pts_local.map(([x, z]) => [c[0] + x, c[1] + z]);
    tpl = [{ type: 'take', text: 'Grab a ride' }, { type: 'race', pts, limit: def.loop.limit_s || 55, text: 'Run the alley' }];
  }
  // Resolve at_aj_from pools (taxi)
  const poolPick = (key, i) => {
    const pool = def.loop?.[key];
    if (!Array.isArray(pool) || !pool.length) return def.location?.at_aj || [0, -200];
    return pool[i % pool.length];
  };
  let poolIdx = 0;
  for (const s of tpl) {
    if (s.type === 'duel') {
      // Handled by runner (v7.4 challenge); emit a goto stand-in so registerMission stays valid
      const at = s.at || def.location?.at_aj || [0, 0];
      steps.push({ type: 'goto', at, r: 5, text: s.text || 'Win the bout (duel)' });
      continue;
    }
    if (s.type === 'enter') {
      // District buildings aren't in the live colony yet — clock-in is a goto at the activity start
      const at = def.location?.at_aj || s.at || [0, 0];
      steps.push({ type: 'goto', at, r: 5, text: s.text || `Clock in (${s.building || 'spot'})` });
      continue;
    }
    const out = { type: s.type, text: s.text };
    if (s.at_aj_from) { out.at = poolPick(s.at_aj_from, poolIdx++); }
    else if (s.at_aj) out.at = s.at_aj;
    else if (s.at_local) {
      const c = DISTRICTS[def.district]?.centre || [0, 0];
      out.at = [c[0] + s.at_local[0], c[1] + s.at_local[1]];
    } else if (s.at) out.at = s.at;
    if (s.r != null) out.r = s.r;
    if (s.vehicle) out.vehicle = s.vehicle;
    if (s.wave) {
      const cap = phoneCap(def);
      out.wave = s.wave.slice(0, Math.max(1, Math.min(s.wave.length, cap - 1)));
    }
    if (s.ambush) out.ambush = true;
    if (s.pts) out.pts = s.pts;
    if (s.limit != null) out.limit = s.limit;
    if (s.item) out.item = s.item;
    if (s.keep) out.keep = true;
    if (s.n != null) out.n = s.n;
    if (s.building) out.building = s.building;
    // drop unsupported types quietly
    if (!['goto', 'collect', 'defeat', 'return', 'take', 'clean', 'race', 'enter'].includes(out.type)) continue;
    if (out.type === 'race' && !Array.isArray(out.pts)) continue;
    if ((out.type === 'goto' || out.type === 'return' || out.type === 'defeat') && !out.at) {
      out.at = def.location?.at_aj || [0, -200];
    }
    if (out.type === 'defeat' && !out.wave) out.wave = ['crawler', 'crawler'];
    steps.push(out);
  }
  // Ensure at least one reachable step
  if (!steps.length) {
    const at = def.location?.at_aj || [0, -200];
    steps.push({ type: 'goto', at, r: 6, text: def.summary || def.name });
  }
  // Taxi degrade: treat as delivery gotos (passenger flavour in intro)
  if (DEGRADE[def.id] === 'simple_taxi' && !steps.some(s => s.type === 'goto')) {
    const at = def.location?.at_aj || [0, -200];
    steps.push({ type: 'goto', at, r: 8, text: 'Pick up the fare' });
    steps.push({ type: 'goto', at: [at[0] + 40, at[1] - 80], r: 8, text: 'Drop them off' });
  }
  return steps;
}

function missionId(def) { return `act-${def.id}`; }

function registerAll() {
  if (registered || !pack || !C?.game?.registerMission) return;
  for (const def of pack.activities || []) {
    if (DEFERRED.has(def.id)) continue;
    const steps = compileSteps(def);
    if (!steps.length) continue;
    try {
      C.game.registerMission({
        id: missionId(def),
        world: 'Mars',
        contact: def.contact || null,
        title: def.name,
        intro: `${def.contact || 'Board'}: ${def.summary || def.name}`,
        fiction: true,
        steps,
        reward: {
          xp: def.rewards?.base?.xp || 30,
          credits: def.rewards?.base?.credits || 50,
          badge: def.rewards?.streak_3?.badge || def.rewards?.gold_bonus?.badge || undefined,
        },
      });
    } catch (e) { console.warn('[activities] register', def.id, e.message); }
  }
  registered = true;
}

function clears(id) { return (data.clears ||= {})[id] || 0; }
function streak(id) { return (data.streak ||= {})[id] || 0; }
function bestTime(id) { return (data.best ||= {})[id]; }
function onCooldown(id) {
  const until = (data.cooldownUntil ||= {})[id] || 0;
  return until > Date.now() ? until : 0;
}
function setCooldown(def) {
  const sec = def.loop?.cooldown_s || def.cooldown_s || 90;
  (data.cooldownUntil ||= {})[def.id] = Date.now() + sec * 1000;
  save();
}

function scaleReward(def) {
  const base = { ...(def.rewards?.base || { credits: 50, xp: 30 }) };
  const n = clears(def.id);
  // credits *= 1 + 0.08 * min(clears, 10) when scaling string says so; always apply mild scale
  const mult = 1 + 0.08 * Math.min(n, 10);
  base.credits = Math.round((base.credits || 0) * mult);
  const st = streak(def.id);
  if (def.rewards?.streak_bonus && st > 0 && st % (def.rewards.streak_bonus.every || 3) === 0) {
    base.credits += def.rewards.streak_bonus.credits || 0;
  }
  return base;
}

function resetMissionProgress(id) {
  const P = C?.game?.debug?.P?.();
  if (!P) return;
  P.quests = P.quests || {};
  // Allow re-accept: clear active/done so registerMission accept works again
  delete P.quests[id];
  if (P.active?.Mars === id) delete P.active.Mars;
}

function startActivity(def, opts = {}) {
  if (!C?.game || C.name !== 'Mars') return { ok: false, why: 'Land on Mars first.' };
  if (DEFERRED.has(def.id)) return { ok: false, why: `${def.name} is deferred.` };
  if (active) return { ok: false, why: 'Already on a side job. Finish or abandon it.' };
  const cd = onCooldown(def.id);
  if (cd && !opts.ignoreCooldown) return { ok: false, why: `Cooldown ${Math.ceil((cd - Date.now()) / 1000)}s.` };
  registerAll();
  const mid = missionId(def);
  resetMissionProgress(mid);
  // Ensure aliens on for defeat waves
  const needsAliens = compileSteps(def).some(s => s.type === 'defeat');
  if (needsAliens) C.game.setAliens?.(true);

  const mode = def.loop?.type || 'generic';
  if (mode === 'poker') {
    sayNpc(def.contact || 'Nyx', 'poker_offer', def.bark?.offer);
    active = { def, missionId: mid, startedAt: performance.now(), mode: 'poker' };
    updateMenu();
    openPokerTable({
      ctx: C,
      onClose: (res) => {
        if (!active || active.def.id !== def.id) return;
        if (res?.banned) {
          failActivity("Nyx: Broke. Bar's still open. Table isn't.");
          return;
        }
        if (res && res.delta != null && res.delta >= 0) {
          (data.clears ||= {})[def.id] = clears(def.id) + 1;
          (data.streak ||= {})[def.id] = streak(def.id) + 1;
          setCooldown(def); save();
          sayNpc('Nyx', 'poker_success', def.bark?.success);
        } else {
          (data.streak ||= {})[def.id] = 0; save();
          sayNpc('Nyx', 'poker_fail', def.bark?.fail);
        }
        active = null; updateMenu(); setChip(null);
      },
    });
    return { ok: true };
  }
  if (mode === 'duel_ladder') {
    active = { def, missionId: mid, startedAt: performance.now(), mode, duelArmed: true, roundsLeft: def.loop.rounds || 1, wager: def.loop.wager_default || 100 };
    armDuel(def);
    sayNpc('Marrow', 'pit_crowd', `🥊 ${def.name}: wager ${active.wager} cr. Fists only.`);
    tryBark({ name: 'crowd', kind: 'colonist' }, 'pit_cheer');
    updateMenu();
    return { ok: true };
  }

  const ok = C.game.accept(mid);
  if (!ok) return { ok: false, why: 'Could not start job (engine refused).' };
  active = { def, missionId: mid, startedAt: performance.now(), mode, duelArmed: false };
  const bark = def.bark?.offer || def.bark?.start;
  if (bark) toast(bark);
  else toast(`📋 ${def.name}`);
  updateMenu();
  return { ok: true };
}

function armDuel(def) {
  const w = C.world;
  if (!w?.challenge) return;
  // Place a willing fighter next to the player
  const name = w.debugDuelist?.(false) || w.debugDuelist?.(true);
  const r = w.challenge('fists', active.wager, name || undefined);
  if (!r?.ok) toast(`🥊 ${r?.msg || 'No fighter. Try again.'}`);
}

function abandonActivity(why) {
  if (!active) return;
  const id = active.missionId;
  if (active.mode === 'poker') {
    closePoker(why || 'Left the table.');
    active = null;
    updateMenu();
    setChip(null);
    return;
  }
  try { C.game.abandon?.(); } catch (e) {}
  resetMissionProgress(id);
  if (C.world?.inDuel) C.world.yieldDuel?.();
  toast(why || 'Side job dropped.');
  active = null;
  updateMenu();
  setChip(null);
}

function completeActivity(extra = {}) {
  if (!active) return;
  const def = active.def;
  (data.clears ||= {})[def.id] = clears(def.id) + 1;
  (data.streak ||= {})[def.id] = streak(def.id) + 1;
  // Time trial local best (degraded leaderboard)
  if (extra.time != null && (DEGRADE[def.id] === 'local_best_only' || def.loop?.type === 'time_trial')) {
    const prev = bestTime(def.id);
    if (prev == null || extra.time < prev) {
      (data.best ||= {})[def.id] = extra.time;
      toast(`⭐ New local best: ${extra.time.toFixed(1)}s`);
    }
  }
  let bonus = scaleReward(def);
  // Blue Drop / Scrap Run: prefer Marsmania contraband price when SSX exposes it
  if (def.id === 'act-blue-courier') {
    const px = contrabandPayout('glow_dust', contrabandPayout('contraband', bonus.credits));
    bonus = { ...bonus, credits: px };
  } else if (def.id === 'act-wrench-scrap') {
    const px = contrabandPayout('salvage', contrabandPayout('scrap', bonus.credits));
    bonus = { ...bonus, credits: px };
  }
  // Mission accept already paid base via engine; top up scaling / market delta
  const baseCr = def.rewards?.base?.credits || 50;
  const top = Math.max(0, bonus.credits - baseCr);
  if (top > 0) C.game.debug?.credits?.(top);
  setCooldown(def);
  const bark = def.bark?.complete || def.bark?.win;
  sayNpc(def.contact || 'Board', 'activity_complete', bark || `✅ ${def.name} +${bonus.credits} cr`);
  active = null;
  updateMenu();
  setChip(null);
  save();
}

function failActivity(why) {
  if (!active) return;
  (data.streak ||= {})[active.def.id] = 0;
  save();
  abandonActivity(why || 'Job failed.');
}

// ---------- UI ----------
function ensureUI() {
  if (ui && document.getElementById('actCtxBtn')) return ui;
  if (!document.getElementById('actCss')) {
    const st = document.createElement('style'); st.id = 'actCss'; st.textContent = CSS; document.head.appendChild(st);
  }
  const stack = document.getElementById('stackR'), btns = document.getElementById('surfBtns');
  const chip = document.createElement('div'); chip.id = 'actChip'; stack?.prepend(chip);
  const ctx = document.createElement('button'); ctx.id = 'actCtxBtn'; ctx.className = 'glass'; ctx.style.display = 'none'; ctx.textContent = '📋 Job';
  btns?.prepend(ctx);
  tap(ctx, () => {
    if (active) { abandonActivity('Walked away from the job.'); return; }
    if (nearAct) {
      const r = startActivity(nearAct);
      if (!r.ok) toast(`🚫 ${r.why}`);
    }
  });
  const m = addMenuItem(app(), {
    id: 'rmActivities',
    label: '📋 Mars side jobs',
    onTap: () => { if (active) abandonActivity('Quit side job.'); else openPanel(); },
  });
  const panel = document.createElement('div'); panel.id = 'actPanel'; document.body.appendChild(panel);
  panel.addEventListener('click', onPanelClick);
  ui = { chip, ctx, m, panel, near: null };
  return ui;
}

function updateMenu() {
  if (!ui?.m) return;
  ui.m.textContent = active ? '🏳️ Quit side job' : '📋 Mars side jobs';
}

function setChip(html) {
  if (!ui) return;
  if (html == null) { ui.chip.classList.remove('on'); ui.chip.innerHTML = ''; return; }
  ui.chip.innerHTML = html; ui.chip.classList.add('on');
}

function openPanel() {
  if (!ensureUI() || !pack) return;
  const px = C?.car ? C.car.x : C?.player?.x || 0, pz = C?.car ? C.car.z : C?.player?.z || 0;
  const here = districtAt(px, pz);
  const items = (pack.activities || []).map(def => {
    const deferred = DEFERRED.has(def.id);
    const deg = DEGRADE[def.id];
    const at = def.location?.at_aj || [0, 0];
    const dist = Math.round(Math.hypot(at[0] - px, at[1] - pz));
    const cd = onCooldown(def.id);
    const cdTxt = cd ? ` · cooldown ${Math.ceil((cd - Date.now()) / 1000)}s` : '';
    const best = bestTime(def.id);
    const bestTxt = best != null ? ` · best ${best.toFixed(1)}s` : '';
    const note = deferred ? 'Deferred'
      : def.loop?.type === 'poker' ? 'Hold\'em modal · tip dealer at your own risk'
      : deg === 'simple_taxi' ? 'Simple taxi (no smooth-drive meter)'
      : deg === 'local_best_only' ? `Local best only${bestTxt}`
      : `${clears(def.id)} clears · streak ${streak(def.id)}`;
    const inDistrict = def.district === here?.id;
    return `<div class="item${deferred ? ' deferred' : ''}" data-id="${esc(def.id)}">
      <b>${esc(def.name)}</b> · ${esc(DISTRICTS[def.district]?.name || def.district)}${inDistrict ? ' · here' : ''}
      <small>${esc(def.summary || '')}</small>
      <small>${esc(def.contact || '?')} · ${dist} m${cdTxt} · ${esc(note)}</small>
      <div class="row">${deferred
        ? '<button disabled>Deferred</button>'
        : `<button class="go" data-start="${esc(def.id)}">Start</button><button data-warp="${esc(def.id)}">Warp to start</button>`}
      </div></div>`;
  }).join('');
  ui.panel.innerHTML = `<div class="wrap"><button class="close" data-close="1">✕</button>
    <h2>📋 Mars side jobs</h2>
    <div class="sub">${esc(here?.name || 'Mars')} · Olympus Row / Red Tape Flats / Helios Heights / Beltway<br>
    Hold'em live. Taxi & time trials run degraded. No ambient events (CoS).</div>
    ${items}
    <div class="foot"><button data-close="1">Close</button></div></div>`;
  ui.panel.classList.add('on');
}

function closePanel() { ui?.panel.classList.remove('on'); }

function onPanelClick(e) {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.close) { closePanel(); return; }
  const id = t.dataset.start || t.dataset.warp;
  const def = pack?.activities?.find(a => a.id === id); if (!def) return;
  if (t.dataset.warp) {
    const at = def.location?.at_aj || DISTRICTS[def.district]?.centre || [0, -200];
    C?.player && (C.player.x = at[0], C.player.z = at[1]);
    // surface debugMove if available
    app()?.surface?.debugMove?.(at[0], at[1], 0);
    toast(`Warped to ${def.name}`);
    closePanel();
    return;
  }
  if (t.dataset.start) {
    closePanel();
    const r = startActivity(def);
    if (!r.ok) toast(`🚫 ${r.why}`);
  }
}

function updateChip() {
  if (!active || !ui) { setChip(null); return; }
  // Poker modal owns the screen — hide activity HUD chrome so it cannot overlap itself / pad
  if (active.mode === 'poker' || pokerIsOpen()) { setChip(null); return; }
  chipT -= 1; if (chipT > 0) return; chipT = 4;
  const def = active.def;
  const info = C.game?.info;
  const q = info?.quest;
  let line = esc(def.name);
  if (active.mode === 'duel_ladder') {
    line += `<br>Rounds left ${active.roundsLeft} · wager ${active.wager}`;
    if (C.world?.inDuel) line += ' · <b>DUEL</b>';
  } else if (q && q.id === active.missionId) {
    line += `<br>${esc(q.text || q.title || '')}`;
  } else {
    line += '<br>In progress…';
  }
  const best = bestTime(def.id);
  if (best != null) line += `<br>Local best ${best.toFixed(1)}s`;
  setChip(`<b>📋 Job</b><br>${line}`);
}

function watchActive() {
  if (!active || !C?.game) return;
  const def = active.def;
  if (active.mode === 'poker') return; // modal owns the loop

  // Duel ladder: watch world.lastDuel
  if (active.mode === 'duel_ladder') {
    if (C.world?.inDuel) return;
    const L = C.world?.lastDuel;
    if (L && active.duelWatch !== L) {
      active.duelWatch = L;
      if (L.win || L.why === 'win' || L.credits > 0 && /win/i.test(L.why || '')) {
        active.roundsLeft--;
        if (active.roundsLeft <= 0) completeActivity();
        else { toast(`🥊 Round won. ${active.roundsLeft} left.`); armDuel(def); }
      } else if (L.why && /yield|lose|fail/i.test(L.why)) {
        failActivity('You lost the bout.');
      }
    }
    // Fail if wanted spikes hard or gun used — soft check
    if ((C.world?.wanted || 0) >= 3) failActivity('Stars. Pit closed.');
    return;
  }

  // Mission-backed: detect completion / abandon
  const P = C.game.debug?.P?.();
  const qs = P?.quests?.[active.missionId];
  const activeId = P?.active?.Mars;
  if (qs?.everDone && qs.status === 'done') {
    // Capture race time if any
    let time = null;
    if (def.loop?.type === 'time_trial' || DEGRADE[def.id] === 'local_best_only') {
      time = (performance.now() - active.startedAt) / 1000;
    }
    completeActivity({ time });
    return;
  }
  if (activeId && activeId !== active.missionId) {
    // Something else took the quest slot
    active = null; updateMenu(); setChip(null);
    return;
  }
  if (!activeId && qs && qs.status !== 'done' && performance.now() - active.startedAt > 800) {
    // Abandoned via engine
    (data.streak ||= {})[def.id] = 0; save();
    active = null; updateMenu(); setChip(null);
  }

  // Fail conditions from def.fail (wanted)
  if ((C.world?.wanted || 0) >= 3 && (def.fail || []).some(f => /wanted/i.test(f))) {
    failActivity('Wanted 3+. Job blown.');
  }
}

// ---------- tick ----------
export function activityTick(dt, ctx) {
  C = ctx; lastTick = performance.now();
  if (ctx.name !== 'Mars') {
    if (ui) ui.ctx.style.display = 'none';
    if (active) { active = null; setChip(null); }
    return;
  }
  ensureUI();
  if (!pack) {
    ensurePack().then(() => { registerAll(); }).catch(e => console.warn('[activities] pack', e));
    return;
  }
  if (!registered) registerAll();

  watchActive();
  updateChip();

  // Idle: context button near an activity start (not during active job / race)
  if (pokerIsOpen() || (active && active.mode === 'poker')) {
    ui.ctx.style.display = 'none';
    setChip(null);
    return;
  }
  if (active) {
    ui.ctx.style.display = 'block';
    ui.ctx.textContent = active.mode === 'poker' ? '🃏 Leave table' : '🏳️ Quit job';
    return;
  }
  if (window.__race?.state) { ui.ctx.style.display = 'none'; return; }

  ctxT -= dt; if (ctxT > 0) return; ctxT = 0.25;
  const px = ctx.car ? ctx.car.x : ctx.player.x, pz = ctx.car ? ctx.car.z : ctx.player.z;
  let best = null, bd = 18;
  for (const def of pack.activities || []) {
    if (DEFERRED.has(def.id)) continue;
    const at = def.location?.at_aj; if (!at) continue;
    const d = Math.hypot(at[0] - px, at[1] - pz);
    if (d < bd) { bd = d; best = def; }
  }
  nearAct = best;
  const show = !!best && !ctx.game?.isDown?.();
  ui.ctx.style.display = show ? 'block' : 'none';
  if (show) ui.ctx.textContent = `📋 ${best.name}`;
}

// Leave surface cleanup
setInterval(() => {
  if (!lastTick || performance.now() - lastTick < 700 || app()?.state?.onSurface) return;
  if (active) { active = null; }
  if (pokerIsOpen()) closePoker(null);
  if (ui) { ui.ctx.style.display = 'none'; closePanel(); setChip(null); }
}, 500);

// ---------- test / debug ----------
window.__activities = {
  get pack() { return pack; },
  get active() { return active ? { id: active.def.id, mode: active.mode, missionId: active.missionId } : null; },
  get data() { return data; },
  get district() {
    if (!C) return null;
    const px = C.car ? C.car.x : C.player.x, pz = C.car ? C.car.z : C.player.z;
    return districtAt(px, pz);
  },
  list: () => (pack?.activities || []).map(a => ({
    id: a.id, name: a.name, district: a.district,
    deferred: DEFERRED.has(a.id), degrade: DEGRADE[a.id] || null,
    at: a.location?.at_aj, clears: clears(a.id), best: bestTime(a.id),
  })),
  playable: () => (pack?.activities || []).filter(a => !DEFERRED.has(a.id)).map(a => a.id),
  deferred: () => [...DEFERRED],
  poker: () => window.__poker,
  start: (id) => { const d = pack?.activities?.find(a => a.id === id); return d ? startActivity(d, { ignoreCooldown: true }) : { ok: false, why: 'unknown' }; },
  abandon: () => abandonActivity('debug abandon'),
  complete: () => completeActivity(),
  openPanel, closePanel,
  warp(id) {
    const d = pack?.activities?.find(a => a.id === id); if (!d) return false;
    const at = d.location?.at_aj || [0, -200];
    app()?.surface?.debugMove?.(at[0], at[1], 0);
    return true;
  },
  reload: async () => { pack = null; registered = false; data = load(); await ensurePack(); registerAll(); },
  counts: () => ({ ctx: ui?.ctx?.style?.display, chip: ui?.chip?.classList?.contains('on'), registered }),
};

ensurePack().catch(() => {});
