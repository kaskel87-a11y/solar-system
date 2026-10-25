// v7.4 ambient events runtime: runs the "full"/"partial" vignettes from data/random-events.json (Steve's
// mars-city/random-events.json, copied read-only) with street-danger primitives: NPCs, barks, a choice card, a fight,
// a fleeing NPC to catch. The street-danger director decides WHEN (shared global cooldown, one encounter at a time,
// the <=12 phone NPC budget); this file decides WHICH event (district weight + per-event cooldown) and runs it.
// Events needing engine features we don't have are stubs: classified, logged, never spawned (see ambientcore.js).
import * as AC from './ambientcore.js';

let A = null, loadP = null, api = null, ev = null;
const cooldowns = {}, stats = { started: 0, choices: {}, ended: {}, skipped: 0, loadError: null, last: null };
const FLAGS_KEY = 'ssx.ambient.v1';
const flags = (() => { try { return JSON.parse(localStorage.getItem(FLAGS_KEY) || '{}'); } catch (_) { return {}; } })();
const saveFlags = () => { try { localStorage.setItem(FLAGS_KEY, JSON.stringify(flags)); } catch (_) {} };

export function ambientLoad(url) {
  if (loadP) return loadP;
  loadP = fetch(url || new URL('./data/random-events.json', import.meta.url)).then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
    .then(j => { A = AC.normalize(j); return A; }).catch(e => { stats.loadError = String(e?.message || e); A = null; return null; });
  return loadP;
}
export function ambientInit(a) { api = a; }
export const ambientActive = () => !!ev;
// the director asks this before rolling 'ambient': is there any event that could run right here, right now?
export function ambientAny(s, now) { return !!A && AC.eligibleEvents(A, s, now, cooldowns).length > 0; }

export function ambientStart(s, now, force) {
  if (!A || ev || !api) return null;
  const e = force ? A.events.find(x => x.id === force) : AC.pick(A, s, now, cooldowns);
  if (!e || (force && e._c.support === 'stub')) return null;
  const plan = AC.npcPlan(e, api.budget(), api.mobile());
  if ((e.spawn?.npcs || []).length && !plan.length) { stats.skipped++; return null; }
  cooldowns[e.id] = now;
  const P = api.player(), yaw = api.driving() ? (P.yaw ?? 0) : (P.faceYaw ?? P.yaw ?? 0), r = Math.min(22, e.spawn?.near_player_m ?? e.spawn?.ahead_m ?? 16), ahead = e.spawn?.ahead_m !== undefined || !!api.driving();
  const a = ahead ? yaw : yaw + (Math.random() < 0.5 ? 0.35 : -0.35); // in view: vignettes are meant to be seen
  const cx = P.x - Math.sin(a) * r, cz = P.z - Math.cos(a) * r;
  const npcs = plan.map((p, i) => { const t = (i / Math.max(1, plan.length)) * Math.PI * 2, n = api.spawn(p.kind, cx + Math.cos(t) * 1.6, cz + Math.sin(t) * 1.6, { role: p.role || 'ambient', token: p.token, hp: 3 });
    if (p.weapon) api.weapon(n, p.weapon); n.onDeath = how => onDeath(n, how); n.onHurt = () => onHurt(n); return n; });
  ev = { e, npcs, t: 0, phase: 'choose', window: Math.min(22, e.duration_s || 30), dur: e.duration_s || 45, plan: null, cx, cz, hostiles: [] };
  stats.started++; stats.last = e.id;
  const spot = e.barks?.spot; if (spot) { if (npcs[0]) api.say(npcs[0], spot, 3200, '#ffd08a'); else api.toast(`📻 ${spot}`, 2600); } // the chip carries the line too
  api.card(e.name, spot, e._c.choices.map(id => { const c = e.choices.find(x => x.id === id); return { id, label: c.label }; }), id => ambientChoose(id));
  return e.id;
}
export function ambientChoose(id) {
  if (!ev || ev.phase !== 'choose' || !AC.choiceUsable(ev.e, id)) return null;
  const pl = AC.planChoice(ev.e, id, { credits: api.credits(), flags });
  if (!pl) return null;
  if (pl.kind === 'locked' || pl.kind === 'broke') { api.toast(pl.kind === 'broke' ? '💸 You can\u2019t cover that.' : '🔒 Nobody here knows that name.', 1800); return pl.kind; }
  stats.choices[id] = (stats.choices[id] || 0) + 1; ev.plan = pl; api.card(null);
  if (pl.bark && ev.npcs[0]?.alive) api.say(ev.npcs[0], pl.bark, 2800);
  if (pl.kind === 'instant') { reward(pl.fx); finish('done'); }
  else if (pl.kind === 'fight') {
    const extra = AC.npcPlan({ spawn: { npcs: pl.extra }, caps: ev.e.caps }, api.budget(), api.mobile());
    const P = api.player();
    for (const p of extra) { const n = api.spawn(p.kind, ev.cx + (Math.random() - 0.5) * 6, ev.cz + (Math.random() - 0.5) * 6, { role: 'ambient', hp: 3 }); if (p.weapon) api.weapon(n, p.weapon); n.onDeath = how => onDeath(n, how); n.onHurt = () => onHurt(n); ev.npcs.push(n); }
    // who turns on you: muggers/crawlers/saltblood/bruiser/heckled preacher. Victims (exec, recruit, tourist) back off.
    ev.hostiles = ev.npcs.filter(n => n.alive && n.role !== 'victim' && n.kind !== 'victim');
    if (!ev.hostiles.length && ev.npcs[0]) ev.hostiles = [ev.npcs[0]];
    for (const n of ev.hostiles) { n.hostile = true; n.armed = true; n.atkCd = 0.6 + Math.random(); }
    if (pl.fx.wanted > 0) { api.crime(pl.fx.wanted, ev.e.name); pl.fx = { ...pl.fx, wanted: 0 }; } // jumping in is the crime, not winning
    ev.phase = 'fight'; ev.t = 0; api.chip(`👊 ${ev.e.name}`); void P;
  } else if (pl.kind === 'catch') { const n = ev.npcs[0]; if (!n) { reward(pl.fx); return finish('done'); } n.fleeing = true; ev.phase = 'catch'; ev.t = 0; api.chip(`🏃 Catch them: ${pl.time}s`); }
  else if (pl.kind === 'shoot') { const n = ev.npcs[0]; if (n?.alive) api.kill(n, 'shot'); reward(pl.fx); finish('done'); }
  return pl.kind;
}
function reward(fx) {
  const P = api.progress(); let msg = [];
  if (fx.credits) { P.credits = Math.max(0, P.credits + fx.credits); msg.push(`${fx.credits > 0 ? '+' : ''}${fx.credits} cr`); }
  if (fx.xp) { P.xp += fx.xp; msg.push(`+${fx.xp} XP`); }
  if (fx.item) { flags['item:' + fx.item] = (flags['item:' + fx.item] || 0) + 1; msg.push(`📦 ${fx.item}`); }        // engine_need: inventory addItem
  if (fx.rep) for (const [k, v] of Object.entries(fx.rep)) { flags['rep:' + k] = (flags['rep:' + k] || 0) + v; msg.push(`${k} ${v > 0 ? '+' : ''}${v}`); } // engine_need: rep system
  if (fx.flag) flags[fx.flag] = true;
  if (fx.info) msg.push('🗒 noted');
  saveFlags(); api.save();
  if (fx.wanted > 0) api.crime(fx.wanted, ev?.e?.name || 'street event');   // stars only through world.crime
  if (msg.length) api.toast(`✨ ${ev?.e?.name}: ${msg.join(' · ')}`, 2600);
}
function onHurt(n) { if (!ev) return; if (ev.phase === 'choose' || ev.phase === 'catch' && !n.fleeing) { // you started it: everyone who can fight, fights
  ev.plan = { kind: 'fight', fx: { xp: 15 } }; api.card(null); ev.hostiles = ev.npcs.filter(o => o.alive && o.kind !== 'victim'); for (const o of ev.hostiles) { o.hostile = true; o.armed = true; o.atkCd = 0.5; } ev.phase = 'fight'; ev.t = 0; } }
function onDeath(n, how) {
  if (!ev) return;
  if (ev.phase === 'catch' && n === ev.npcs[0]) { const o = ev.e.choices.find(c => /^shoot|^drop/.test(c.id)); if (o) reward(AC.planChoice(ev.e, o.id, { credits: api.credits(), flags }).fx); finish('killed'); return; }
  if (ev.phase === 'choose') { api.card(null); api.crime(1, `${ev.e.name}: assault`); finish('killed'); }
}
function finish(why) {
  if (!ev) return; stats.ended[why] = (stats.ended[why] || 0) + 1;
  for (const n of ev.npcs) { n.hostile = false; n.armed = false; n.fleeing = false; if (n.alive) n.leaveT = 0; }
  ev.phase = 'leaving'; ev.t = 0; ev.why = why; api.chip(null); api.card(null);
}
export function ambientTick(dt) {
  if (!ev || !api) return;
  ev.t += dt; const P = api.player(), down = api.isDown();
  if (ev.phase === 'choose') { if (ev.t > ev.window || Math.hypot(P.x - ev.cx, P.z - ev.cz) > 70) { api.card(null); finish('ignored'); } return; }
  if (ev.phase === 'fight') {
    let alive = 0;
    for (const n of ev.hostiles) { if (!n.alive) continue; alive++;
      const d = api.moveTo(n, P.x, P.z, 3.6, dt);
      if (d < 1.7 && (n.atkCd -= dt) <= 0 && !down && !api.inDuel()) { n.atkCd = 1.0 + Math.random() * 0.5; n.swingT = 0.35; api.hurt(n.weaponMesh ? 8 : 5, n); } }
    if (!alive) { reward(ev.plan.fx); finish('won'); } else if (down || ev.t > 60 || Math.hypot(P.x - ev.cx, P.z - ev.cz) > 90) finish(down ? 'lost' : 'fled');
    return;
  }
  if (ev.phase === 'catch') { const n = ev.npcs[0];
    if (!n?.alive) return finish('gone');
    const dx = n.x - P.x, dz = n.z - P.z, d = Math.hypot(dx, dz) || 1; api.moveTo(n, n.x + dx / d * 4, n.z + dz / d * 4, 4.4, dt);
    api.chip(`🏃 Catch them: ${Math.max(0, Math.ceil(ev.plan.time - ev.t))}s`);
    if (d < 2.4) { n.fleeing = false; n.speed = 0; reward(ev.plan.fx); if (ev.plan.bark) api.say(n, ev.plan.bark, 2400); finish('caught'); }
    else if (ev.t > ev.plan.time) { api.toast('💨 Gone. Not your tanks anyway.', 1800); finish('escaped'); }
    return;
  }
  if (ev.phase === 'leaving') { // NPCs walk away, then despawn; the director stays blocked until they're gone
    for (const n of ev.npcs) if (n.alive) { const dx = n.x - P.x, dz = n.z - P.z, d = Math.hypot(dx, dz) || 1; api.moveTo(n, n.x + dx / d * 3, n.z + dz / d * 3, 2.2, dt); }
    if (ev.t > 6) { for (const n of ev.npcs) if (n.alive) api.remove(n); else n.despawn = Math.min(n.despawn ?? 20, 20); ev = null; }
  }
}
export function ambientClear() { if (!ev) return; api?.card(null); api?.chip(null); for (const n of ev.npcs) if (n.alive) api?.remove(n); ev = null; }
export const ambientDebug = {
  get loaded() { return !!A; }, get state() { return { active: ev ? { id: ev.e.id, phase: ev.phase, npcs: ev.npcs.filter(n => n.alive).length, why: ev.why || null } : null, ...stats, cooldowns: { ...cooldowns } }; },
  events: () => A ? A.events.map(e => ({ id: e.id, support: e._c.support, choices: e._c.choices })) : [], stubs: () => A ? AC.stubList(A) : [],
  resetCooldowns() { for (const k in cooldowns) delete cooldowns[k]; }, flags: () => ({ ...flags })
};
