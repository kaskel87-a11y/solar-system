// v7.4 ambient events: pure rules for Steve's mars-city/random-events.json (copied read-only to data/random-events.json).
// The street-danger director owns the ONE spawn budget: its global cooldown, "one thing at a time" and the <=12 phone
// NPC cap cover muggings, fights, street chases and these vignettes alike. This file only classifies events (what
// our primitives can run), checks triggers, picks by district weight + per-event cooldown, and plans outcomes.
// No DOM, no three.js: node-tested in tests/test-danger-unit.mjs.

// our district names -> the file's district keys
export const DISTRICT_KEY = { downtown: 'mars-downtown', rough: 'mars-rough', gated: 'mars-gated', highway: 'mars-highway' };

// NPC tokens we can stand up with danger.js NPCs (kind = suit/body, role = behaviour). Anything else is an engine need.
// ColSec tokens are deliberately absent: police and security belong to world.js (v7.4 security combat).
export const NPC_MAP = {
  civ: { kind: 'colonist' }, thief: { kind: 'junkie', role: 'thief' }, saltblood: { kind: 'thug' }, recruit: { kind: 'victim' },
  crawler: { kind: 'thug', weapon: 'pipe' }, exec: { kind: 'colonist', role: 'victim' }, mugger: { kind: 'junkie', weapon: 'knife' },
  tourist: { kind: 'victim' }, preacher: { kind: 'colonist' }, hacker_kid: { kind: 'victim' }, bruiser: { kind: 'thug' },
  quiet_courier: { kind: 'thug' }, guard: { kind: 'colonist' }, racer: { kind: 'junkie' }
};
// what each missing feature is, for the PR / stub list
const NEED = {
  weather: 'weather flag (dust_storm)', props: 'prop spawner (wrecks, crates, billboards, drones)', vehicles: 'ambient vehicle spawner / runaway AI',
  fx: 'screen/world FX hook', sky_fx: 'sky FX (meteor streak)', alarms: 'environmental alarm VFX', lights_out: 'district light dimming',
  colsec: 'ColSec ambient units (world.js owns security)', starts: 'start-activity API (duel / short race)', enter_helios: 'Helios gate access flag',
  vehicle: 'give-vehicle API', heal: 'heal API (game.heal)', if_contraband: 'contraband scan', at: 'named spawn anchors (plaza, beltway node)',
  checkpoint_or_pullin: 'pull-over / checkpoint spawn', near_club_or_bar: 'venue proximity flag', inside_district_r: 'district radius flag'
};
const CHOICE_HARD = ['starts', 'enter_helios', 'vehicle', 'heal', 'if_contraband', 'success', 'fail'];
const SPAWN_HARD = ['props', 'vehicles', 'fx', 'sky_fx', 'alarms', 'lights_out', 'checkpoint_or_pullin'];
const SPAWN_AT_OK = [undefined]; // named anchors are not built yet
const TRIG_HARD = ['weather', 'near_club_or_bar', 'inside_district_r'];

export function classifyChoice(c, mobile = true) {
  const o = c.outcome || {}, why = [];
  for (const k of CHOICE_HARD) if (o[k] !== undefined) why.push(NEED[k] || k);
  return { ok: why.length === 0, why };
}
// support: 'full' (every choice runs), 'partial' (>= 2 choices run; the rest are hidden), 'stub' (logged, never spawned)
export function classify(ev) {
  const why = [];
  const sp = ev.spawn || {};
  for (const k of SPAWN_HARD) if (sp[k]) why.push(NEED[k] || k);
  if (!SPAWN_AT_OK.includes(sp.at)) why.push(NEED.at);
  for (const k of TRIG_HARD) if (ev.triggers?.[k]) why.push(NEED[k] || k);
  for (const t of sp.npcs || []) if (!NPC_MAP[t]) why.push(t === 'colsec' ? NEED.colsec : `NPC type "${t}"`);
  const choices = (ev.choices || []).map(c => ({ ...c, ...classifyChoice(c) }));
  const runnable = choices.filter(c => c.ok);
  for (const c of choices) if (!c.ok) why.push(...c.why.map(w => `${c.id}: ${w}`));
  const blocked = why.some(w => !w.includes(': ')); // spawn/trigger needs block the whole event
  const support = blocked || runnable.length < 2 ? 'stub' : runnable.length === choices.length ? 'full' : 'partial';
  return { id: ev.id, support, why: [...new Set(why)], choices: runnable.map(c => c.id) };
}
export function normalize(json) {
  const events = (json && Array.isArray(json.events)) ? json.events : [];
  const rules = { max_active_phone: 1, max_active_desktop: 2, global_cooldown_s: 90, suppress_wanted_min: 4, ...(json?.spawn_rules || {}) };
  return { rules, events: events.filter(e => e && e.id && e.world === 'Mars').map(e => ({ ...e, _c: classify(e) })) };
}

// the player's situation -> does this event's trigger block pass?  s = { onFoot, driving, wanted, hour, hp, hpMax, district }
export function timeOk(t, hour) {
  const night = hour >= 20 || hour < 5, dusk = (hour >= 17 && hour < 20) || (hour >= 5 && hour < 7);
  if (!t || t === 'any') return true; if (t === 'night') return night; if (t === 'day') return !night && !dusk; if (t === 'dusk') return dusk; return true;
}
export function triggerOk(ev, s) {
  const t = ev.triggers || {};
  if (t.on_foot && !s.onFoot) return false;
  if (t.vehicle && !s.driving) return false;
  if (t.wanted_max !== undefined && s.wanted > t.wanted_max) return false;
  if (t.wanted_min !== undefined && s.wanted < t.wanted_min) return false;
  if (!timeOk(t.time, s.hour ?? 12)) return false;
  if (t.night_or_dusk && timeOk('day', s.hour ?? 12)) return false;
  if (t.player_hp_below !== undefined && !(s.hp < t.player_hp_below)) return false;
  if (t.near_helios_gate && s.district !== 'gated') return false;
  return true;
}
export function weight(ev, district) { const k = DISTRICT_KEY[district]; return k ? (ev.districts?.[k] || 0) : 0; }
export function eligibleEvents(A, s, now, cooldowns = {}) {
  if (!A || (s.wanted || 0) >= A.rules.suppress_wanted_min) return [];
  return A.events.filter(e => e._c.support !== 'stub' && weight(e, s.district) > 0 && triggerOk(e, s) && now - (cooldowns[e.id] ?? -1e9) >= (e.cooldown_s || 0));
}
export function pick(A, s, now, cooldowns, rng = Math.random) {
  const list = eligibleEvents(A, s, now, cooldowns); if (!list.length) return null;
  const tot = list.reduce((a, e) => a + weight(e, s.district), 0); let r = rng() * tot;
  for (const e of list) { r -= weight(e, s.district); if (r <= 0) return e; }
  return list[list.length - 1];
}
// how many of the event's NPCs we may stand up: the event's own phone cap, the file's 6/10 cap, and the shared budget
export function npcPlan(ev, room, mobile = true) {
  const want = (ev.spawn?.npcs || []).filter(t => NPC_MAP[t]);
  const evCap = mobile ? (ev.spawn?.phone_npc_max ?? ev.caps?.phone_npc_max ?? 6) : (ev.caps?.desktop_npc_max ?? 10);
  const n = Math.max(0, Math.min(want.length, evCap, mobile ? (ev.caps?.phone_npc_max ?? 6) : 99, room));
  return want.slice(0, n).map(t => ({ token: t, ...NPC_MAP[t] }));
}
// a choice -> what the runtime does. kind: instant | fight | catch | shoot
export function planChoice(ev, choiceId, env = {}, rng = Math.random) {
  const c = (ev.choices || []).find(x => x.id === choiceId); if (!c) return null;
  const o = c.outcome || {};
  const fx = { credits: o.credits || 0, xp: o.xp || 0, wanted: o.wanted || 0, rep: o.rep || null, flag: o.flag || null, item: o.item || o.chance_item || null, info: o.info || o.lore || null };
  if (o.requires_flag_any && !o.requires_flag_any.some(f => env.flags?.[f])) return { id: c.id, kind: 'locked', fx: {}, bark: null };
  if (fx.credits < 0 && (env.credits ?? 0) < -fx.credits) return { id: c.id, kind: 'broke', fx: {}, bark: null };
  let kind = 'instant', extra = [];
  if (Array.isArray(o.fight)) { kind = 'fight'; extra = o.fight.filter(t => NPC_MAP[t]); }
  else if (o.fight_chance && rng() < o.fight_chance) kind = 'fight';
  else if (/^goto\b/.test(o.steps_hint || '')) kind = 'catch';
  else if (/^shoot/.test(c.id)) kind = 'shoot';
  const tm = /(\d+)\s*s\b/.exec(o.steps_hint || ''); const time = tm ? +tm[1] : 20;
  return { id: c.id, label: c.label, kind, extra, time, fx, bark: ev.barks?.[c.id] || o.bark || null };
}
export function choiceUsable(ev, choiceId) { return ev._c ? ev._c.choices.includes(choiceId) : true; }
export function stubList(A) { return A.events.filter(e => e._c.support !== 'full').map(e => ({ id: e.id, support: e._c.support, why: e._c.why })); }
