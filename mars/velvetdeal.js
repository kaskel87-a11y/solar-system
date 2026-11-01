// v7.5.26 Ines's side deal at the Velvet Airlock (Collin: "Can I use my contraband at the velvet airlock ... making a deal with Ines?").
// Everything goes through systems that already exist, nothing is duplicated:
//  - Ines's 🤝 panel (mars/contraband.js barter, her barter.json beacon) gets new rows via SSX.contraband.registerOffer:
//      Off the floor: she buys a lot of product at a flat, no-risk rate (BUYOUT in velvetdealcore.js), +2 Velvet rep.
//      Ines's errand: starts the next job of a 3-job chain through the core mission engine (game.registerMission + accept).
//  - Job pay: the mission reward (money boost applies); repeats are topped up to full pay here. mars/rep.js gives +8 Velvet
//    rep per job on its own (ids start with 'ines-'). Finishing job 3 comps a free private show with Danny (privateshow.js reads
//    the comp from localStorage KEY) and opens the VIP rope for good.
//  - Danny's product payment itself lives in privateshow.js (same core file).
// Window API: SSX.velvetDeal = { state(), jobs, buyout, next(), registered, debug: { reset(), set(patch) } }.
// Wiring: one <script type="module"> in index.html, import map, sw.js precache. Rules: mars/velvetdealcore.js.
import * as V from './velvetdealcore.js';

const app = () => window.__app, game = () => app()?.game || app()?.surface?.game;
const toast = (m, ms = 3400) => { try { app()?.toast?.(m, ms); } catch (e) { /* */ } };
let S = V.fresh(); try { S = V.loadState(localStorage.getItem(V.KEY)); } catch (e) { /* private mode */ }
const reload = () => { try { S = V.loadState(localStorage.getItem(V.KEY)); } catch (e) { /* */ } return S; }; // privateshow.js spends comps
const save = () => { try { localStorage.setItem(V.KEY, JSON.stringify(S)); } catch (e) { /* */ } };
const boost = n => { try { const b = window.SSX?.economy?.boost; const v = typeof b === 'function' ? b(n) : n; return Number.isFinite(v) ? v : n; } catch (e) { return n; } };
const R = { missions: false, offers: false, wait0: 0, unsub: null };

function jobLabel() { const j = V.nextJob(reload()), i = V.jobIndex(j.id); return `Ines\u2019s errand ${i + 1}/${V.JOBS.length}: ${j.title} \u00b7 ${boost(j.credits)} cr${i === V.JOBS.length - 1 ? ' + a free show' : ''}`; }
function jobOffer(C) {
  C.registerOffer({ id: 'ines-side-job', npc: V.NPC, district: V.DISTRICT, wants: [], gives: { type: 'custom' }, label: jobLabel(), repeatable: true,
    lines: { accept: 'Ines: Quietly. Always quietly.' },
    onTrade: ctx => {
      const g = game(); if (!g) return { ok: false, msg: 'Not in game.' };
      if (g.info?.quest) return { ok: false, msg: `Ines: Finish \u201c${g.info.quest.title}\u201d first. One mess at a time.` };
      if (app()?.surface?.info?.name !== 'Mars') return { ok: false, msg: 'Ines: Mars jobs. On Mars.' };
      const j = V.nextJob(reload());
      if (!g.accept(j.id)) return { ok: false, msg: 'Ines: Not now. Come back in a minute.' };
      setTimeout(() => { try { window.SSX?.contraband?.close?.(); } catch (e) { /* */ } }, 50);
      return { ok: true, msg: `New job: ${j.title}.` };
    } });
}
function registerOffers(C) {
  const have = (C.npcs?.() || []).some(n => n.id === V.NPC);
  const npcDef = have ? undefined : { name: 'Ines', role: 'Velvet Airlock', district: V.DISTRICT, at: V.AT, line: 'Ines: VIP is for people who bring something.' };
  for (const b of V.BUYOUT) {
    C.registerOffer({ id: b.id, npc: V.NPC, district: V.DISTRICT, wants: [{ item: b.item, qty: b.qty }], gives: { type: 'cash', credits: b.credits },
      label: `Off the floor: ${b.credits} cr`, cooldownSec: b.cooldownSec, repeatable: true, ...(npcDef ? { npcDef } : {}),
      lines: { accept: ['Ines: Off the floor and into my safe. Here.', 'Ines: Count it later. Not here.', 'Ines: My girls stay clean, my patrons stay happy. Take the money.'][Math.floor(Math.random() * 3)] },
      onTrade: () => { try { window.SSX?.rep?.add?.('velvet', V.BUY_REP, 'sold product to Ines'); } catch (e) { /* */ } S = reload(); S.bought++; save(); return { ok: true }; } });
  }
  jobOffer(C); R.offers = true;
}
function registerMissions(g) { for (const j of V.JOBS) g.registerMission(V.missionDef(j)); R.missions = true; }
function onQuest(ev) {
  if (ev?.kind !== 'done' || V.jobIndex(ev.id) < 0) return;
  const j = V.JOBS[V.jobIndex(ev.id)], g = game(), full = boost(j.credits), top = V.topUp(full, ev.credits);
  if (top > 0 && g?.reward) { g.reward(0, top); setTimeout(() => toast(`🍸 Ines pays full rate: +${top} cr (${full} cr total).`, 3200), 1800); }
  const r = V.finishJob(reload(), ev.id); S = r.s; S.paid += full; save();
  if (r.comp) { try { if (!g?.flag?.('vip')) g?.setFlag?.('vip'); } catch (e) { /* */ } setTimeout(() => toast('💋 Ines comped you a private show with Danny. VIP rope\u2019s open for you.', 4200), 4200); }
  try { const C = window.SSX?.contraband; if (C?.registerOffer) jobOffer(C); } catch (e) { console.warn('[velvetdeal]', e); }
}
(function boot() {
  const X = window.SSX, C = X?.contraband, g = game();
  if (!X || typeof X.on !== 'function' || !C?.registerOffer || !g?.registerMission) { setTimeout(boot, 300); return; }
  // let contraband.js load mars/barter.json first (its replace pass would otherwise race our rows), max 8 s
  if (C.barterSource !== 'barter.json') { R.wait0 ||= performance.now(); if (performance.now() - R.wait0 < 8000) { setTimeout(boot, 300); return; } }
  try { registerMissions(g); } catch (e) { console.warn('[velvetdeal] missions', e); }
  try { registerOffers(C); } catch (e) { console.warn('[velvetdeal] offers', e); }
  try { R.unsub = X.on('game:quest', onQuest) || null; } catch (e) { console.warn('[velvetdeal] bus', e); }
})();
const API = {
  state: () => ({ ...reload() }), jobs: V.JOBS.map(j => ({ id: j.id, title: j.title, credits: j.credits })), buyout: V.BUYOUT.map(b => ({ ...b })),
  next: () => V.nextJob(reload()).id, get registered() { return R.missions && R.offers; },
  debug: { reset() { S = V.fresh(); save(); try { const C = window.SSX?.contraband; if (C?.registerOffer) jobOffer(C); } catch (e) { /* */ } }, set(p) { S = V.loadState({ ...reload(), ...p, v: 1 }); save(); try { jobOffer(window.SSX.contraband); } catch (e) { /* */ } }, onQuest },
};
(function expose() { if (!window.SSX) { setTimeout(expose, 200); return; } window.SSX.velvetDeal = API; })();
