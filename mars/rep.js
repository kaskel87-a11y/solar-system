// v7.5.x Mars faction reputation (Marsmania). Every crew in the colony keeps score on you, -100..+100.
// Self-contained add-on: one <script type="module"> in index.html. Talks to the game only through window.__app and window.SSX.
// It LISTENS to the other Mars modules (it doesn't patch them): window 'ssx:turf' 'ssx:job' 'ssx:beltway' 'ssx:npc-down',
// SSX.contraband.on(), SSX.on('game:quest' | 'game:poof' | 'raid:start'). Every integration is feature-detected and guarded.
// Fiction only: invented gangs, cops and contacts, no real brands. M-rated: violence, crime, fictional drugs, language.

/**
 * window.SSX.rep — public API. Ids are lowercase slugs (see FACTIONS and ALIAS below, mirrored in mars/REP.md).
 *  get(id)                    -> integer -100..+100 (0 neutral). Unknown ids -> 0. Aliases resolve (vacuum-saints -> saints).
 *  tier(id)                   -> { id, name, min, max, rep, faction }   Marked / Hated / Wary / Neutral / Known / Trusted / Family
 *  add(id, delta, why?)       -> new value (clamped). Emits 'change' and, when the tier moves, 'tier' + a toast.
 *  all()                      -> [{ id, name, kind:'gang'|'law'|'street'|'contact', rep, tier, tierId }]
 *  on(event, fn) | on(fn)     -> unsubscribe. Events: 'change' { id, rep, delta, why }, 'tier' { id, from, to, rep },
 *                                'hostile' { id, n }, 'raid' { id, block?, engine }, 'backup' { id, ok, why? }.
 *  priceMultiplier(idOrDistrict?, pos?) -> street price factor from the crew that owns the corner (0.7 Marked .. 1.2 Family).
 *                                pos {x,z} | [x,z] AJ-relative; default the player. Not on gang turf -> 1.
 *  gangAt(pos?)               -> gang id whose turf this is (SSX.turf blocks, else the Flats = saltblood) or null
 *  backup(id?)                -> call a favour: SSX.danger.spawnBackup({ faction, count, durationSec }) at Trusted+ (5 min cooldown)
 *  open() / close()           -> the rep panel (☰ "🩸 Rep", key ` (backquote), phone dock 🩸 on #ssxDock when it exists)
 *  ids, factions, tiers       -> static tables
 *  debug                      -> set(id, v), reset(), seed(), hostile(id?), raid(id?), tick(sec), state(), log()
 * Also emits window event 'ssx:rep' and SSX.emit('rep:<event>') on the core bus.
 * Persistence: localStorage 'ssx.rep.v1' (no game flags: a 'saltblood' flag would feed dangercore's flag count).
 * Saltblood starts from dangercore's flagsToRep(count of flags /^vesna-|saltblood/), so talk-down odds don't jump.
 */

const KEY = 'ssx.rep.v1';
const FACTIONS = {
  saltblood: { name: 'Saltblood', kind: 'gang', icon: '🩸', col: '#ff3b3b', types: ['thug', 'goon', 'thug', 'enforcer'], game: 'Saltblood', blurb: 'Red tape on both arms. Runs the Flats for the Quiet. Never forgets a face.' },
  saints: { name: 'Vacuum Saints', kind: 'gang', icon: '🕯️', col: '#c39bff', types: ['goon', 'enforcer', 'goon'], game: 'Vacuum Saints', blurb: 'Funeral-bar cult off Funeral Mile. Sends you to orbit. Means it.' },
  dustjaws: { name: 'Dustjaw Boys', kind: 'gang', icon: '🦷', col: '#ffb03a', types: ['thug', 'thug', 'goon', 'thug'], game: 'Dustjaw Boys', blurb: 'Scrap-strippers in welded respirator jaws. Loud, many, cheap, petty.' },
  junkies: { name: 'Dust-heads', kind: 'street', icon: '💉', col: '#9fe870', blurb: 'The glow-dust crowd. They talk to each other, and they remember who paid.' },
  colsec: { name: 'ColSec', kind: 'law', icon: '🚔', col: '#5ad1ff', blurb: 'Colony Security. Bounties win friends; dead guards and bullion jobs don\u2019t.' },
  // barter.json rep channels (contraband offers gate on these: offer.rep.factions[{ faction, min }])
  ozzie: { name: 'Ozzie\u2019s Iron', kind: 'contact', icon: '🔫', blurb: 'Gun counter in the Flats. Better iron for regulars.' },
  colsec_dirty: { name: 'Deputy Rusk', kind: 'contact', icon: '💵', blurb: 'The badge that takes envelopes.' },
  velvet: { name: 'Velvet Airlock', kind: 'contact', icon: '🍸', blurb: 'Ines\u2019s club. Velvet rope, sticky floors.' },
  cantina: { name: 'The Cantina', kind: 'contact', icon: '🥃', blurb: 'Dutch\u2019s bar. Clean rides for clean faces.' },
  helios_staff: { name: 'Helios staff', kind: 'contact', icon: '🧹', blurb: 'Porters, mechanics, guards who hate their bosses.' },
  free_operators: { name: 'Free operators', kind: 'contact', icon: '🗝️', blurb: 'Freelance crooks: Nyx, Dorsey, Halloran.' },
  quiet: { name: 'The Quiet', kind: 'contact', icon: '🤫', blurb: 'Rook\u2019s people. Money that doesn\u2019t make noise.' }
};
const ALIAS = { 'vacuum-saints': 'saints', vacuum_saints: 'saints', vacuumsaints: 'saints', saint: 'saints', 'vacuum saints': 'saints',
  dustjaw: 'dustjaws', 'dustjaw-boys': 'dustjaws', dustjaw_boys: 'dustjaws', 'dustjaw boys': 'dustjaws', junkie: 'junkies', 'dust-heads': 'junkies',
  security: 'colsec', 'colony-security': 'colsec', 'colony security': 'colsec', colsec_downtown: 'colsec', 'colsec-dirty': 'colsec_dirty', rusk: 'colsec_dirty',
  helios: 'helios_staff', 'helios-staff': 'helios_staff', 'free-operators': 'free_operators', 'the-quiet': 'quiet', 'salt-blood': 'saltblood' };
const TIERS = [
  { id: 'marked', name: 'Marked', min: -100, max: -60, price: 0.7 }, { id: 'hated', name: 'Hated', min: -59, max: -30, price: 0.8 },
  { id: 'wary', name: 'Wary', min: -29, max: -10, price: 0.9 }, { id: 'neutral', name: 'Neutral', min: -9, max: 9, price: 1 },
  { id: 'known', name: 'Known', min: 10, max: 29, price: 1.05 }, { id: 'trusted', name: 'Trusted', min: 30, max: 59, price: 1.12 },
  { id: 'family', name: 'Family', min: 60, max: 100, price: 1.2 }];
const UP = { known: ['{g} know your face now. That\u2019s a start, not a favour.', 'Word on {g} corners: you\u2019re not a cop. Probably.'],
  trusted: ['{g} trust you. Their backup answers your call now.', '{g} put your name on the good list. Don\u2019t fuck it up.'],
  family: ['You\u2019re Family to {g}. They\u2019d bleed for you. They will.', '{g} call you blood now. Tape on the arm, if you want it.'],
  neutral: ['{g} let it go. For now.', '{g} stopped spitting when you walk by.'], wary: ['{g} are watching you less. Still watching.'], hated: ['{g} still hate you. Just slightly less loudly.'] };
const DOWN = { known: ['{g} cooled on you.'], neutral: ['{g} don\u2019t owe you shit anymore.', 'Whatever you had with {g}, it\u2019s gone.'],
  wary: ['{g} are side-eyeing you. Watch your corners.', '{g} started asking who you run with.'],
  hated: ['{g} HATE you. Expect company in their blocks.', '{g} spray your name on the wall. Not the nice way.'],
  marked: ['You\u2019re MARKED by {g}. They shoot on sight. Every block, every night.', '{g} put a price on your visor. Sleep light.'],
  trusted: ['{g} still trust you. Barely.'] };
// barter channels by story-quest prefix (game.js quest ids): finishing a quest = +8 with that crew
const QUEST_CH = [[/^(marrow|vesna|wrench)-/, 'saltblood'], [/^ozzie-/, 'ozzie'], [/^rusk-/, 'colsec_dirty'], [/^ines-/, 'velvet'], [/^dutch-/, 'cantina'],
  [/^(porter|torque)-/, 'helios_staff'], [/^(nyx|dorsey|halloran)-/, 'free_operators'], [/^rook-/, 'quiet']];
const GANG_IDS = ['saltblood', 'saints', 'dustjaws'];
const DISTRICTS = { 'red-tape-flats': { centre: [-280, -40], r: 95, gang: 'saltblood' }, 'olympus-row': { centre: [0, -430], r: 110 }, 'helios-heights': { centre: [320, 80], r: 95 }, 'ares-junction': { centre: [0, 0], r: 70 }, 'ares-beltway': { centre: [0, -220], r: 28 } };

const app = () => window.__app, surf = () => app()?.surface, game = () => app()?.game || surf()?.game;
const toast = (m, ms = 3200) => { try { app()?.toast?.(m, ms); } catch (e) { /* no HUD */ } };
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = v => Math.max(-100, Math.min(100, Math.round(v)));
const isTouch = () => document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
function canon(id) { if (id == null) return null; const s = String(id).trim().toLowerCase(); if (FACTIONS[s]) return s; if (ALIAS[s]) return ALIAS[s]; const t = s.replace(/[\s_]+/g, '-'); return ALIAS[t] || (FACTIONS[t.replace(/-/g, '_')] ? t.replace(/-/g, '_') : null); }
// free text (npc names, checkpoint factions, game agent factions) -> faction id
function sniff(text) { const s = String(text || '').toLowerCase(); if (!s) return null;
  if (/escort/.test(s)) return null; if (/saltblood|salt blood|red tape crew/.test(s)) return 'saltblood'; if (/saint/.test(s)) return 'saints'; if (/dustjaw/.test(s)) return 'dustjaws';
  if (/junkie|dust-?head|mugger/.test(s)) return 'junkies'; if (/colsec|colony sec|security officer|deputy|guard\b|\bcop\b/.test(s)) return 'colsec'; if (/helios/.test(s)) return 'helios_staff'; return null; }

// ---------- state ----------
const fresh = () => ({ v: 1, rep: {}, seeded: false, log: [], flags: {}, cd: {} });
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1 && s.rep) return { ...fresh(), ...s }; } catch (e) { /* fresh */ } return fresh(); }
let S = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };
const subs = new Map();
function emit(type, extra = {}) {
  const ev = { type, ...extra };
  for (const k of [type, '*']) for (const f of subs.get(k) || []) { try { f(ev); } catch (e) { console.warn('rep listener', e); } }
  try { window.dispatchEvent(new CustomEvent('ssx:rep', { detail: ev })); } catch (e) { /* old browser */ }
  try { window.SSX?.emit?.('rep:' + type, ev); } catch (e) { /* bus optional */ }
}
function on(a, b) { const [k, f] = typeof a === 'function' ? ['*', a] : [String(a), b]; if (typeof f !== 'function') return () => {}; if (!subs.has(k)) subs.set(k, new Set()); subs.get(k).add(f); return () => subs.get(k)?.delete(f); }
const get = id => { const k = canon(id); return k ? (S.rep[k] | 0) : 0; };
const tierOf = v => TIERS.find(t => v >= t.min && v <= t.max) || TIERS[3];
function tier(id) { const k = canon(id), v = get(id), t = tierOf(v); return { id: t.id, name: t.name, min: t.min, max: t.max, rep: v, faction: k }; }

// dangercore (CoS, PR #19) owns the Saltblood flag scale; mirror it when the export isn't there yet
let DC = null; import('../dangercore.js').then(m => { DC = m; }).catch(() => { /* standalone */ });
const SALT_FLAG = () => DC?.SALTBLOOD_FLAG instanceof RegExp ? DC.SALTBLOOD_FLAG : /^vesna-|saltblood/;
const flagsToRep = n => typeof DC?.flagsToRep === 'function' ? DC.flagsToRep(n) : Math.max(-100, Math.min(100, Math.round((+n || 0) * 100 / 3)));
function seed() {
  const P = game()?.progress; if (!P) return false;
  const flags = Array.isArray(P.flags) ? P.flags : [], re = SALT_FLAG();
  S.rep.saltblood = clamp(flagsToRep(flags.filter(f => re.test(f)).length));
  const q = P.quests || {}; for (const id in q) if (q[id]?.everDone) for (const [rx, ch] of QUEST_CH) if (ch !== 'saltblood' && rx.test(id)) S.rep[ch] = clamp((S.rep[ch] | 0) + 8);
  S.seeded = true; save(); emit('change', { id: null, what: 'seed' }); render(); return true;
}

const lastWhy = {};
function add(id, delta, why = '', o = {}) {
  const k = canon(id); delta = Math.round(+delta || 0); if (!k || !delta) return k ? get(k) : 0;
  if (!S.seeded) seed(); // seed first so a later seed never overwrites earned rep
  const before = get(k), after = clamp(before + delta); if (after === before) return after;
  S.rep[k] = after; S.log.unshift({ id: k, d: after - before, why: String(why || '').slice(0, 60), t: Date.now() }); S.log = S.log.slice(0, 14);
  const t0 = tierOf(before), t1 = tierOf(after);
  if (t0 !== t1) {
    const up = after > before, F = FACTIONS[k], lines = (up ? UP : DOWN)[t1.id] || [`${F.name}: ${t1.name}.`];
    if (!o.quiet) toast(`${F.icon || '🩸'} ${F.name}: ${t0.name} → ${t1.name}. ${pick(lines).replace(/\{g\}/g, F.name)}`, 4200);
    // no game flags on purpose: 'rep:saltblood:*' would match dangercore's /^vesna-|saltblood/ flag count and feed back into the seed
    emit('tier', { id: k, from: t0.id, to: t1.id, rep: after });
  }
  save(); lastWhy[k] = why; emit('change', { id: k, rep: after, delta: after - before, why }); render(); return after;
}

// ---------- where am I / whose corner is this ----------
function here() { const s = surf(), i = s?.info; if (!i || i.name !== 'Mars' || !i.colony) return null; return { x: i.x - i.colony.x, z: i.z - i.colony.z, wx: i.x, wz: i.z, info: i, cx: i.colony.x, cz: i.colony.z }; }
const toAJ = pos => { if (Array.isArray(pos)) return { x: +pos[0], z: +pos[1] }; if (pos && isFinite(pos.x)) return { x: +pos.x, z: +pos.z }; const h = here(); return h ? { x: h.x, z: h.z } : null; };
function districtAt(p) { let best = null, bd = 1e9; for (const id in DISTRICTS) { const D = DISTRICTS[id], d = Math.hypot(p.x - D.centre[0], p.z - D.centre[1]); if (d < D.r && d / D.r < bd) { bd = d / D.r; best = id; } } return best; }
function gangAt(pos) {
  const p = toAJ(pos); if (!p) return null;
  try { const o = window.SSX?.turf?.ownerAt?.({ x: p.x, z: p.z }); if (o && o.owner) return GANG_IDS.includes(o.owner) ? o.owner : (o.owner === 'player' ? null : canon(o.owner)); } catch (e) { /* turf optional */ }
  return DISTRICTS[districtAt(p)]?.gang || null;
}
function priceMultiplier(arg, pos) {
  let g = canon(arg); if (g && !GANG_IDS.includes(g) && g !== 'junkies') return 1;
  if (!g) { if (arg && !/rough|flats|red-tape/i.test(String(arg)) && !pos) return 1; g = gangAt(pos); }
  if (!g) return 1; return tierOf(get(g)).price;
}

// ---------- listeners (all guarded) ----------
const near = (x, z, r) => { const h = here(); return !!h && Math.hypot(h.wx - x, h.wz - z) < r; };
const killBudget = {}; // per faction per minute, so a massacre doesn't hit -100 in one alley
function killed(f, d, why) { const k = canon(f); if (!k) return; const m = Math.floor(Date.now() / 60000), b = killBudget[k]?.m === m ? killBudget[k] : (killBudget[k] = { m, n: 0 }); if (b.n <= -20) return; b.n += d; add(k, d, why); }
function onNpcDown(d = {}) {
  if (d.byPlayer === false || /escort/i.test(d.name || '')) return; const x = +d.x, z = +d.z; if (Number.isFinite(x) && !d.byPlayer && !near(x, z, 35)) return;
  const f = canon(d.faction) || sniff(d.name); if (!f) return;
  killed(f, f === 'junkies' ? -2 : f === 'colsec' ? -5 : -4, `dropped ${d.name || 'one of theirs'}`);
}
let squad = null; // { id, until } last hit squad we sent, for kill attribution
function onPoof(ev = {}) { // game.js human agents (thug/goon/enforcer/guard) don't carry a faction on 'poof'; attribute by context
  if (!ev.human) return; const t = String(ev.type || ''); if (!/thug|goon|enforcer|guard|sdrone/.test(t)) return;
  if (/guard|sdrone/.test(t)) { const h = here(); if (h && districtAt(h) === 'helios-heights') killed('helios_staff', -1, 'dropped private security'); else killed('colsec', -3, 'dropped a guard'); return; }
  let g = null; try { g = window.SSX?.turf?.fight?.()?.gang || null; } catch (e) { /* turf optional */ }
  if (!g && squad && squad.until > Date.now()) g = squad.id; if (!g) g = sniff(ev.name) || gangAt();
  if (g) killed(g, -2, 'killed a ' + (ev.name || t));
}
function onTurf(e) {
  const v = e?.detail || {}, g = canon(v.gang); if (!g) return;
  if (v.type === 'attack') add(g, -5, 'hit their block');
  else if (v.type === 'captured') { add(g, -12, 'took ' + (v.block || 'a block')); for (const o of GANG_IDS) if (o !== g) add(o, 2, `${FACTIONS[g].name} lost a block`, { quiet: true }); }
  else if (v.type === 'defended') add(g, -4, 'held your block');
  else if (v.type === 'lost') add(g, 3, 'they took their block back');
  if ((v.type === 'attack' || v.type === 'counter')) allyCheck(g, 'turf');
}
function onJob(e) {
  const v = e?.detail || {}; if (v.type !== 'complete' && v.type !== 'fail') return;
  const g = sniff(v.note);
  if (v.type === 'complete' && v.job === 'vigilante') { add('colsec', 3, 'bounty collected'); if (g && g !== 'colsec') add(g, -8, 'took down their man for ColSec'); }
  else if (v.type === 'complete' && v.job === 'paramedic' && g) add(g, g === 'junkies' ? 4 : 6, 'saved one of theirs');
  else if (v.type === 'fail' && v.job === 'paramedic' && g) add(g, -2, 'let their guy bleed');
}
function onBelt(e) {
  const v = e?.detail || {};
  if (v.type === 'shakedown') { const f = sniff(v.faction) || canon(v.faction); if (f) add(f, f === 'colsec' ? -5 : -6, 'shook down their booth'); }
  else if (v.type === 'payout' && v.how === 'armored') add('colsec', -8, 'hit a ColSec bullion run');
  else if (v.type === 'cargo') add('colsec', -1, 'hijacked a hauler');
  else if (v.type === 'fenced') add('saltblood', 1, 'fenced cargo through the Flats');
}
let offerFac = new Map(); // offer id -> [faction ids] from barter.json
fetch(new URL('./barter.json', import.meta.url), { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(d => { for (const o of d?.offers || []) offerFac.set(o.id, (o.rep?.factions || []).map(f => canon(f.faction)).filter(Boolean)); }).catch(() => { /* optional */ });
function onContraband(ev = {}) {
  if (ev.type === 'sell') { const g = gangAt(); if (!g) return; const t = tierOf(get(g)); if (t.min >= 10) add(g, 1, 'paid the street tax'); else add(g, ev.seen ? -3 : -2, 'dealt on their corner'); add('junkies', 1, 'kept the dust flowing', { quiet: true }); }
  else if (ev.type === 'bust') add('colsec', -3, 'busted dealing');
  else if (ev.type === 'barter') { let fs = offerFac.get(ev.offer) || []; if (!fs.length) { try { const o = window.SSX?.contraband?.offer?.(ev.offer); fs = (o?.rep?.factions || o?.factions || []).map(f => canon(f.faction || f)).filter(Boolean); if (!fs.length && o?.gives?.faction) fs = [canon(o.gives.faction)]; } catch (e) { /* ignore */ } } for (const f of new Set(fs)) add(f, 3, 'did business'); }
}
function onQuest(ev = {}) { if (ev.kind !== 'done' || !ev.id) return; for (const [rx, ch] of QUEST_CH) if (rx.test(ev.id)) add(ch, 8, 'finished ' + ev.id); }

// ---------- effects: hostile on sight, revenge raids, backup ----------
const T = { hostile: 20, raid: 240 + Math.random() * 240, poll: 0 };
const busy = () => { try { if (window.SSX?.turf?.fight?.()) return true; } catch (e) { /* */ } return false; };
function sendSquad(g, force) {
  const h = here(), F = FACTIONS[g], G = game(); if (!h || !F?.types || !G?.hostiles || h.info.inside) return 0;
  const marked = get(g) <= -60, n = Math.min(isTouch() ? 2 : 3, marked ? 3 : 2), a = Math.random() * Math.PI * 2, r = 16;
  let got = 0; try { got = G.hostiles(F.types.slice(0, n), h.wx + Math.cos(a) * r, h.wz + Math.sin(a) * r, { faction: F.game, src: 'rep', r: 3 }) || 0; } catch (e) { console.warn('rep hostiles', e); }
  if (got || force) { squad = { id: g, until: Date.now() + 120000 }; toast(`${F.icon} ${pick([`${F.name} clocked you. They\u2019re coming.`, `${F.name} on the corner. Guns out. You know why.`, `“That\u2019s the one.” ${F.name} rolling up.`])}`, 3200); emit('hostile', { id: g, n: got }); }
  return got;
}
function tickHostile() {
  const h = here(); if (!h || h.info.inside || busy()) return; const g = gangAt(); if (!g) return; const v = get(g); if (v > -30) return;
  const cd = (S.cd['h:' + g] || 0) - Date.now(); if (cd > 0) return;
  if (Math.random() < (v <= -60 ? 0.5 : 0.2)) { if (sendSquad(g)) { S.cd['h:' + g] = Date.now() + (v <= -60 ? 90000 : 180000); save(); } }
}
function revengeRaid(gForce) {
  const haters = gForce ? [canon(gForce)] : GANG_IDS.filter(g => get(g) <= -30).sort((a, b) => get(a) - get(b)); if (!haters.length || !haters[0]) return { ok: false, msg: 'Nobody hates you enough.' };
  const T0 = window.SSX?.turf;
  if (T0?.blocks && T0?.counter) { // turf owns the fight; it rides SSX.raids (Steve, PR #13) itself when that engine is loaded
    let blocks = []; try { blocks = T0.blocks().filter(b => b.owner === 'player'); } catch (e) { /* */ }
    for (const g of haters) { const b = blocks.find(x => x.lostBy === g) || blocks.find(x => canon(x.lostBy) === g); if (!b) continue; let r = null; try { r = T0.counter(b.id); } catch (e) { r = null; }
      if (r?.ok) { toast(`${FACTIONS[g].icon} ${FACTIONS[g].name} want ${b.name} back, and they want you bleeding. Revenge raid.`, 3800); emit('raid', { id: g, block: b.id, engine: 'turf' }); return { ok: true, id: g, block: b.id }; } }
  }
  const R = window.SSX?.raids, h = here();
  if (!T0 && R?.start && h && !h.info.inside) { const g = haters[0]; let r = null;
    try { r = R.start({ id: 'rep-' + g, pos: { x: h.wx, z: h.wz }, radius: 22, attackers: 'gang', waves: [{ count: 2 }, { count: 3 }], label: `${FACTIONS[g].name} revenge`, onWin: () => add(g, -2, 'beat their revenge squad'), onLose: () => add(g, 4, 'they got their pound of flesh') }); } catch (e) { r = null; }
    if (r?.ok) { emit('raid', { id: g, engine: 'raids' }); return { ok: true, id: g, engine: 'raids' }; } }
  return { ok: false, msg: 'No turf of yours for them to hit.' };
}
const BACKUP = { trusted: { count: 2, durationSec: 90 }, family: { count: 3, durationSec: 150 } };
function backup(id, auto) {
  const g = canon(id) || GANG_IDS.filter(x => get(x) >= 30).sort((a, b) => get(b) - get(a))[0];
  if (!g || !GANG_IDS.includes(g)) return { ok: false, msg: 'No crew owes you that much.' };
  const t = tierOf(get(g)), F = FACTIONS[g]; if (t.min < 30) return { ok: false, msg: `${F.name} won\u2019t ride for you. You\u2019re ${t.name}. Get to Trusted.` };
  const cd = (S.cd['b:' + g] || 0) - Date.now(); if (cd > 0) return { ok: false, msg: `${F.name} already sent people. Ask again in ${Math.ceil(cd / 60000)} min.` };
  const D = window.SSX?.danger; if (typeof D?.spawnBackup !== 'function') return { ok: false, msg: `${F.name} would come, but nobody\u2019s answering the radio (street danger isn\u2019t loaded).` };
  try { const cur = D.backup; if (cur && cur.faction && canon(cur.faction) !== g && !cur.leaving) return { ok: false, msg: `${FACTIONS[canon(cur.faction)]?.name || 'Another crew'} are already riding with you. ${F.name} won’t share a car with them.` }; } catch (e) { /* optional */ }
  let r = null; try { r = D.spawnBackup({ faction: g, ...BACKUP[t.id], src: 'rep' }); } catch (e) { r = { ok: false, why: 'error' }; }
  const ok = r == null ? true : r.ok !== false; emit('backup', { id: g, ok, why: r?.why || null, auto: !!auto });
  if (!ok) return { ok: false, msg: r?.why === 'faction' ? `${F.name} don\u2019t run escorts yet.` : `${F.name} couldn\u2019t make it (${r?.why || 'busy'}).` };
  S.cd['b:' + g] = Date.now() + 300000; save(); return { ok: true, msg: `${F.icon} ${F.name} are on the way. ${pick(['Don\u2019t make them regret it.', 'Point and they shoot.', 'Family looks after family.'])}` };
}
function allyCheck(enemy, src) { // a fight with someone else: a crew that loves you may jump in
  const e = canon(enemy); const g = GANG_IDS.filter(x => x !== e && get(x) >= 30).sort((a, b) => get(b) - get(a))[0]; if (!g) return;
  if (Math.random() > (get(g) >= 60 ? 0.85 : 0.5)) return; const r = backup(g, true); if (r.ok) toast(`${FACTIONS[g].icon} ${FACTIONS[g].name} heard about the ${src === 'turf' ? 'block war' : 'raid'}. ${r.msg}`, 3600);
}

// ---------- loop ----------
let lastT = performance.now(), hooked = { c: false, price: false };
function hookContraband() {
  const C = window.SSX?.contraband; if (!C || hooked.c) return; hooked.c = true;
  try { C.on?.(onContraband); } catch (e) { console.warn('rep contraband', e); }
  // price: register if contraband ever grows a hook (same probe as turf.js); otherwise SSX.rep.priceMultiplier is there to call
  const fn = ['registerPriceModifier', 'addPriceModifier', 'priceHook', 'registerPriceHook'].find(k => typeof C[k] === 'function');
  try { if (fn) { C[fn]((ctx = {}, pos) => priceMultiplier(ctx.district ?? ctx, ctx.pos ?? pos)); hooked.price = true; } else if (Array.isArray(C.priceModifiers)) { C.priceModifiers.push((ctx = {}) => priceMultiplier(ctx.district, ctx.pos)); hooked.price = true; } } catch (e) { console.warn('rep price hook', e); }
}
function tick(dt) {
  T.poll -= dt; if (T.poll <= 0) { T.poll = 1; hookContraband(); hookBus(); if (!S.seeded) seed(); }
  const h = here(), st = app()?.state; if (!h || !st?.onSurface) return;
  T.hostile -= dt; if (T.hostile <= 0) { T.hostile = 20; tickHostile(); }
  T.raid -= dt; if (T.raid <= 0) { T.raid = 240 + Math.random() * 240; if (Math.hypot(h.x, h.z) < 800 && !busy() && GANG_IDS.some(g => get(g) <= -30) && Math.random() < 0.6) revengeRaid(); }
}
function loop() { requestAnimationFrame(loop); const n = performance.now(); if (n - lastT < 250) return; const dt = Math.min(1, (n - lastT) / 1000); lastT = n; try { tick(dt); } catch (e) { console.warn('rep tick', e); } }
let busHooked = false;
function hookBus() { const X = window.SSX; if (busHooked || typeof X?.on !== 'function') return; busHooked = true;
  try { X.on('game:quest', onQuest); X.on('game:poof', onPoof); X.on('raid:start', d => { if (!String(d?.id || '').startsWith('rep-')) allyCheck(d?.attackers === 'colsec' ? 'colsec' : null, 'raid'); }); } catch (e) { console.warn('rep bus', e); } }
window.addEventListener('ssx:npc-down', e => { try { onNpcDown(e.detail || {}); } catch (x) { console.warn('rep npc-down', x); } });
window.addEventListener('ssx:turf', e => { try { onTurf(e); } catch (x) { console.warn('rep turf', x); } });
window.addEventListener('ssx:job', e => { try { onJob(e); } catch (x) { console.warn('rep job', x); } });
window.addEventListener('ssx:beltway', e => { try { onBelt(e); } catch (x) { console.warn('rep beltway', x); } });

// ---------- UI (high contrast: black buttons, white text, 44px+ targets, window.__onTap) ----------
const css = `
#repPanel{position:fixed;inset:0;z-index:61;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55)} #repPanel.show{display:flex}
#repPanel .wrap{width:min(460px,calc(100vw - 12px));max-height:calc(100vh - 24px - env(safe-area-inset-top));display:flex;flex-direction:column;overflow:hidden;margin:0 6px calc(8px + env(safe-area-inset-bottom));padding:14px;border-radius:16px;background:#000;color:#fff;border:2px solid #fff;font:14px system-ui,sans-serif;box-sizing:border-box}
#repBody{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch} #repPanel .msg,#repPanel .foot{flex:none}
#repPanel h2{margin:0 0 2px;font-size:18px} #repPanel h3{margin:12px 0 0;font-size:14px;letter-spacing:.06em;text-transform:uppercase;opacity:.9} #repPanel .sub{margin:0 0 8px;font-size:13px;opacity:.85}
#repPanel .it{padding:9px 0;border-top:1px solid rgba(255,255,255,.3)} #repPanel .it b{font-size:15px} #repPanel .it small{display:block;font-size:12px;opacity:.85;margin-top:2px}
#repPanel .tb{display:flex;justify-content:space-between;gap:8px} #repPanel .tb span{font-weight:800}
#repPanel .bar{position:relative;height:12px;border:1px solid #fff;border-radius:4px;margin:6px 0 2px;overflow:hidden;background:#111} #repPanel .bar i{position:absolute;top:0;bottom:0;display:block} #repPanel .bar u{position:absolute;left:50%;top:-1px;bottom:-1px;width:2px;background:#fff}
#repPanel .ticks{display:flex;justify-content:space-between;font-size:10px;opacity:.7}
#repPanel button{width:100%;min-height:46px;margin-top:6px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 14px system-ui,sans-serif;touch-action:manipulation} #repPanel button:disabled{opacity:.45}
#repPanel .row{display:flex;justify-content:space-between;gap:8px;font-size:13px;padding:4px 0;border-top:1px solid rgba(255,255,255,.15)}
#repPanel .msg{min-height:1.2em;margin:8px 0;font-weight:700} #repPanel .foot{display:flex;gap:8px}
`;
let panel, body, msgEl, lastMsg = '', lastTouchAct = 0;
function tap(el, fn) {
  const g = e => { const n = performance.now(); if (e?.type === 'click' && n - lastTouchAct < 700) return; if (e?.type === 'pointerup') lastTouchAct = n; fn(e); };
  (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, g);
}
// Phone button on the shared #ssxDock (v7.5.3: owned by mars/turf.js). We never create a dock: if #ssxDock isn't on the
// page yet we wait for it and attach once it appears; with no dock at all this adds nothing (use ☰ → 🩸 Rep).
function dockButton(id, label, aria, order, fn) {
  const attach = () => {
    const d = document.getElementById('ssxDock'); if (!d) return false;
    if (document.getElementById(id)) return true;
    const b = document.createElement('button'); b.id = id; b.type = 'button'; b.textContent = label; b.setAttribute('aria-label', aria); b.style.order = String(order); d.appendChild(b); tap(b, fn); return true;
  };
  if (attach()) return;
  try { const mo = new MutationObserver(() => { if (attach()) mo.disconnect(); }); mo.observe(document.body, { childList: true }); } catch (e) { /* no observer: no dock button */ }
}
const toggle = () => panel?.classList.contains('show') ? close() : open();
function ui() {
  if (panel) return; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  panel = document.createElement('div'); panel.id = 'repPanel'; panel.innerHTML = '<div class="wrap" role="dialog" aria-label="Reputation"><div id="repBody"></div><div class="msg" id="repMsg"></div><div class="foot"><button id="repClose" type="button">Close</button></div></div>';
  document.body.appendChild(panel); body = panel.querySelector('#repBody'); msgEl = panel.querySelector('#repMsg');
  tap(panel.querySelector('#repClose'), close);
  dockButton('dockRep', '🩸\nRep', 'Reputation (`)', 5, toggle);
  addEventListener('keydown', e => { if (e.code !== 'Backquote' || e.repeat || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return; if (!app()?.state?.onSurface && !panel.classList.contains('show')) return; e.preventDefault(); toggle(); });
}
function open() { ui(); lastMsg = ''; panel.classList.add('show'); if (document.pointerLockElement) document.exitPointerLock(); render(); }
function close() { panel?.classList.remove('show'); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function bar(v, col) { const w = Math.abs(v) / 2, l = v >= 0 ? 50 : 50 - w; return `<div class="bar" aria-hidden="true"><i style="left:${l}%;width:${w}%;background:${col}"></i><u></u></div><div class="ticks"><span>Marked</span><span>Neutral</span><span>Family</span></div>`; }
function render() {
  if (!panel || !panel.classList.contains('show')) return;
  const gHere = gangAt(); let html = `<h2>🩸 Street rep</h2><p class="sub">${gHere ? `You\u2019re on ${esc(FACTIONS[gHere].name)} turf (${esc(tierOf(get(gHere)).name)}, street price ×${priceMultiplier(gHere).toFixed(2)}). ` : ''}Take turf, deal, run jobs and drop bodies: every crew keeps score. Hated crews hit you on sight and raid your blocks; Trusted crews ride with you.</p>`;
  for (const id of [...GANG_IDS, 'junkies', 'colsec']) {
    const F = FACTIONS[id], v = get(id), t = tierOf(v), last = S.log.find(l => l.id === id);
    const canBack = GANG_IDS.includes(id) && t.min >= 30;
    html += `<div class="it"><div class="tb"><b>${F.icon} ${esc(F.name)}</b><span>${esc(t.name)} · ${v > 0 ? '+' : ''}${v}</span></div>${bar(v, F.col)}<small>${esc(F.blurb)}</small>${last ? `<small>Last: ${last.d > 0 ? '+' : ''}${last.d} ${esc(last.why)}</small>` : ''}${GANG_IDS.includes(id) ? `<small>Their corners: street price ×${t.price.toFixed(2)}${v <= -30 ? ' · ⚠️ hostile on sight' : ''}</small>` : ''}${canBack ? `<button type="button" data-back="${id}">📞 Call ${esc(F.name)} backup</button>` : ''}</div>`;
  }
  html += '<h3>Contacts (barter)</h3>';
  for (const id in FACTIONS) if (FACTIONS[id].kind === 'contact') { const v = get(id); html += `<div class="row"><span>${FACTIONS[id].icon} ${esc(FACTIONS[id].name)}</span><span>${esc(tierOf(v).name)} · ${v > 0 ? '+' : ''}${v}</span></div>`; }
  html += `<p class="sub" style="margin-top:8px">Key \` (backquote) or ☰ → 🩸 Rep.</p>`;
  body.innerHTML = html; msgEl.textContent = lastMsg;
  body.querySelectorAll('button[data-back]').forEach(b => tap(b, () => { const r = backup(b.dataset.back); lastMsg = r.msg; if (r.ok) { close(); toast(r.msg, 3000); return; } render(); }));
}

// ---------- boot ----------
const API = {
  get, tier, add: (id, d, why) => add(id, d, why), all: () => Object.keys(FACTIONS).map(id => { const v = get(id), t = tierOf(v); return { id, name: FACTIONS[id].name, kind: FACTIONS[id].kind, rep: v, tier: t.name, tierId: t.id }; }),
  on, priceMultiplier, gangAt, backup: id => backup(id), open, close, canon,
  ids: Object.keys(FACTIONS), get factions() { return Object.fromEntries(Object.entries(FACTIONS).map(([k, f]) => [k, { name: f.name, kind: f.kind, blurb: f.blurb }])); }, tiers: TIERS.map(t => ({ ...t })), aliases: { ...ALIAS },
  debug: {
    set(id, v) { const k = canon(id); if (!k) return null; return add(k, clamp(v) - get(k), 'debug'); },
    reset() { S = fresh(); seed(); save(); emit('change', { what: 'reset' }); render(); }, seed, hostile: id => sendSquad(canon(id) || gangAt() || 'saltblood', true), raid: id => revengeRaid(id),
    tick: sec => tick(+sec || 1), state: () => JSON.parse(JSON.stringify({ ...S, hooked, squad })), log: () => S.log.slice()
  }
};
(function boot() {
  if (!window.SSX || !window.__app) { setTimeout(boot, 200); return; }
  window.SSX.rep = API; ui();
  try { window.SSX.registerMenuItem({ id: 'rmRep', label: '🩸 Rep', onTap: () => open() }); } catch (e) { console.warn('rep menu', e); }
  hookContraband(); hookBus(); requestAnimationFrame(loop);
})();
