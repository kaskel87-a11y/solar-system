// v7.5.x Mars dirty cops and bribes (Marsmania). Grease a ColSec officer when they've got hands on you, buy your way out
// of a pull-over, and keep Deputy Rusk's precinct desk (his existing "RUSK TAKES" wall in Red Tape Flats) on retainer.
// Fiction only. M-rated: crooked cops, snitching, evidence that walks out of the locker.
//
// This does NOT add a second police system. Stars, security units, busts and backup stay in world.js (v7.4 security
// combat: world.wanted / setWanted / crime / securityList). Street danger (CoS #3/#19) stays NOT-police. Rusk stays
// Jeff's character: his barter.json rows (rusk-wipe-1/2, rusk-raid-tip) are untouched; this adds three more services to
// the same wall through SSX.contraband.registerOffer, so they show up in the same 🤝 trade list.
//
// window.SSX.bribes
//  price(opts?)            -> credits. opts { kind:'spot'|'stop'|'record'|'tipoff'|'evidence', stars, colsec, dirty, night,
//                             personality:'straight'|'greedy'|'on_take', priors, tipoff, contraband, stolen }; missing = live
//  offer(kind, opts?)      -> { ok, refused?, escalation?, cost, msg }. On the spot: 'cash' | 'product' | 'favor' (snitch;
//                             opts.gang) | 'tip' (sell out a bought heist tip) | 'namedrop' (Rusk). At a stop also 'comply' | 'run'.
//                             Desk: 'record' | 'tipoff' | 'evidence' (same as trading at Rusk's wall). opts.force skips the
//                             refusal roll (tests / scripted scenes).
//  encounter               -> the live bribe moment ({ kind, cop:{ name, personality, tell }, stars, price, options }) or null
//  contacts()              -> [{ id:'rusk', name, district, at, services:[{ id, label, price, available, why }] }, ...dorsey...]
//  record()                -> { priors, seized, tipoffSec, stats }
//  isNight()               -> SSX.time.isNight() ?? SSX.beltway.isNight ?? dangercore clock (20:00-05:00 Mars time)
//  on(event, fn)           -> 'offer' | 'paid' | 'refused' | 'stop' | 'comply' | 'run' | 'record' | 'tipoff' | 'evidence' |
//                             'snitch' | 'seized' | 'warn' (or on(fn) for all). Also window 'ssx:bribe' + SSX.emit('bribe:<type>').
//  debug                   -> { stop(opts), spot(opts), clear(), night(bool|null), personality(p|null), seize(item, qty), priors(n),
//                             tick(), state(), reset() }
const app = () => window.__app, surf = () => app()?.surface, game = () => app()?.game || surf()?.game, world = () => surf()?.world;
const CB = () => window.SSX?.contraband, REP = () => window.SSX?.rep;
const toast = (m, ms = 3200) => { try { app()?.toast?.(m, ms); } catch (e) { /* no HUD */ } };
const isTouch = () => document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = a => a[Math.floor(Math.random() * a.length)];
const r5 = v => Math.max(5, Math.round(v / 5) * 5);
let DC = null; import('../dangercore.js').then(m => { DC = m; }).catch(() => { /* standalone */ });

const KEY = 'ssx.bribes.v1', HOTKEY = 'Semicolon';
const fresh = () => ({ v: 1, priors: 0, seized: null, tipoffUntil: 0, snitch: {}, tipsSold: [], stats: { paid: 0, refused: 0, spent: 0, stops: 0 } });
let S = (() => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s?.v === 1) return { ...fresh(), ...s }; } catch (e) { /* fresh */ } return fresh(); })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };

const subs = new Set();
function emit(type, extra = {}) {
  const ev = { type, ...extra, t: Date.now() };
  for (const f of [...subs]) { try { if (!f.type || f.type === type) f.fn(ev); } catch (e) { console.warn('bribes listener', e); } }
  try { window.dispatchEvent(new CustomEvent('ssx:bribe', { detail: ev })); } catch (e) { /* old browser */ }
  try { window.SSX?.emit?.('bribe:' + type, ev); } catch (e) { /* no bus */ }
  return ev;
}
const on = (a, b) => { const s = typeof a === 'function' ? { fn: a } : { type: a, fn: b }; subs.add(s); return () => subs.delete(s); };

// ---------- inputs (all guarded) ----------
const repGet = id => { try { const v = REP()?.get?.(id); return Number.isFinite(v) ? v : 0; } catch (e) { return 0; } };
const repAdd = (id, d, why) => { try { REP()?.add?.(id, d, why); } catch (e) { /* rep optional */ } };
const stars = () => world()?.wanted || 0;
const info = () => { const i = surf()?.info; return i && i.name === 'Mars' && i.colony ? i : null; };
const district = () => { try { return CB()?.district?.() || null; } catch (e) { return null; } };
let nightOverride = null, persOverride = null;
function isNight() {
  if (nightOverride != null) return nightOverride;
  try { const t = window.SSX?.time?.isNight; if (typeof t === 'function') return !!t(); } catch (e) { /* */ }
  try { const b = window.SSX?.beltway?.isNight; if (b != null) return !!(typeof b === 'function' ? b() : b); } catch (e) { /* */ }
  if (DC?.marsHour) { const h = DC.marsHour(); return h >= 20 || h < 5; }
  return false;
}
const tipoffOn = () => S.tipoffUntil > Date.now();
const ruskCleared = () => { const g = game(); return !!(g?.flag?.('rusk_protection') || g?.progress?.quests?.['rusk-01-protection']?.everDone || repGet('colsec_dirty') >= 20); };
const stash = () => { try { return CB()?.stash?.()?.items || {}; } catch (e) { return {}; } };
const carrying = () => Object.values(stash()).reduce((n, s) => n + (s.qty || 0), 0);
function unitVal(id) { try { return CB()?.buyerPrice?.(id) || CB()?.buyerPrice?.(id, 'ares-junction') || 0; } catch (e) { return 0; } }

// ---------- pricing ----------
const PERS = {
  straight: { name: 'straight arrow', k: 1.0, refuse: 0.75, tell: ['Pressed uniform, bodycam light on. Bad idea.', 'Jaw like a bulkhead. Reads you your rights for fun.', 'Fresh from the academy. Still believes in it.'] },
  greedy: { name: 'greedy', k: 1.5, refuse: 0.2, tell: ['Eyes on your wallet, not your face. Pricey.', 'Gold tooth, second job, third ex-wife. Expensive.', 'Already counting it.'] },
  on_take: { name: 'on the take', k: 1.0, refuse: 0.06, tell: ['Bodycam "broken" again. He\u2019s done this before.', 'Rusk\u2019s crew. Envelopes on Tuesdays.', 'Yawns at your stars. Rubs his fingers together.'] }
};
const COPS = ['Ofc. Hale', 'Sgt. Brannock', 'Ofc. Mbeki', 'Cpl. Draye', 'Ofc. Kowalczyk', 'Deputy Ostrova', 'Ofc. Vance-Ito', 'Sgt. Pell', 'Ofc. Ruiz-Haddad', 'Cpl. Strand'];
function repMult(o) { return clamp(1 - o.colsec / 250 - Math.max(0, o.dirty) / 400, 0.5, 1.6); }
function liveOpts(opts = {}) {
  return { kind: 'spot', stars: stars(), colsec: repGet('colsec'), dirty: repGet('colsec_dirty'), night: isNight(), personality: enc?.cop?.personality || 'on_take',
    priors: S.priors, tipoff: tipoffOn(), contraband: carrying() > 0, stolen: !!surf()?.info?.stolen, ...opts };
}
function price(opts = {}) {
  const o = liveOpts(opts), m = repMult(o) * (1 + 0.1 * clamp(o.priors, 0, 5));
  if (o.kind === 'record') return r5((150 + 140 * o.stars + 40 * o.priors) * clamp(1 - Math.max(0, o.dirty) / 300, 0.6, 1) * (o.colsec < -30 ? 1.25 : 1));
  if (o.kind === 'tipoff') return r5(150 * clamp(1 - Math.max(0, o.dirty) / 300, 0.6, 1));
  if (o.kind === 'evidence') return S.seized ? Math.max(60, r5(0.4 * seizedValue())) : 0;
  const base = o.kind === 'stop' ? 60 + (o.contraband ? 60 : 0) + (o.stolen ? 80 : 0) : 70 + 110 * clamp(o.stars, 1, 5);
  return r5(base * m * (o.night ? 0.8 : 1) * (PERS[o.personality]?.k || 1) * (o.tipoff ? 0.75 : 1));
}
function refuseChance(o, kind) {
  const p = PERS[o.personality] || PERS.on_take;
  let c = p.refuse + 0.07 * (o.stars || 0) + (o.stars >= 4 ? 0.15 : 0) - o.colsec / 400 - o.dirty / 300 - (o.night ? 0.06 : 0) - (o.tipoff ? 0.15 : 0) + 0.04 * o.priors;
  if (kind === 'favor' || kind === 'tip') c -= 0.05;
  if (kind === 'namedrop') c = o.personality === 'straight' ? 0.85 : 0.04;
  return clamp(c, 0.02, 0.95);
}

// ---------- the bribe moment ----------
let enc = null, cd = 0, lostT = 0, stopNext = Date.now() + 90000;
function newCop(kind, o = {}) {
  let p = o.personality || persOverride;
  if (!p) { const d = district(), dirty = repGet('colsec_dirty'), r = Math.random();
    const straight = (d === 'helios-heights' || d === 'olympus-row' ? 0.4 : 0.25) - Math.max(0, dirty) / 400, greedy = 0.25;
    p = r < straight ? 'straight' : r < straight + greedy ? 'greedy' : 'on_take'; }
  return { name: o.name || pick(COPS), personality: p, tell: pick(PERS[p].tell) };
}
function gangTarget() {
  let g = null; try { g = REP()?.gangAt?.(); } catch (e) { /* */ }
  if (!g) { const d = district(); g = d === 'red-tape-flats' ? 'saltblood' : null; }
  const opts = ['saltblood', 'saints', 'dustjaws'].filter(x => (S.snitch[x] || 0) < Date.now());
  return opts.includes(g) ? g : opts[0] || null;
}
const GANG_NAME = { saltblood: 'Saltblood', saints: 'Vacuum Saints', dustjaws: 'Dustjaw Boys' };
function unsoldTip() { try { return (CB()?.tips?.() || []).find(t => !S.tipsSold.includes(`${t.t}|${t.target}`)) || null; } catch (e) { return null; } }
function options() {
  if (!enc) return [];
  const p = enc.price = price({ kind: enc.kind, personality: enc.cop.personality, stars: enc.kind === 'stop' ? 0 : stars() }), g = game(), out = [];
  out.push({ id: 'cash', label: `💸 Grease him · ${p} cr`, ok: (g?.progress?.credits ?? 0) >= p, why: 'You\u2019re short.' });
  const prod = productFor(p); out.push({ id: 'product', label: prod ? `💊 Pay in product (${prod.label})` : '💊 Pay in product', ok: !!prod, why: 'Not enough product on you.' });
  const gang = gangTarget(); if (gang) out.push({ id: 'favor', gang, label: `🐀 Snitch on ${GANG_NAME[gang]}`, ok: true });
  const tip = unsoldTip(); if (tip) out.push({ id: 'tip', label: `📝 Sell out a tip (${tip.target || tip.kind})`, ok: true });
  if (ruskCleared()) out.push({ id: 'namedrop', label: '🪪 Name-drop Rusk', ok: true });
  if (enc.kind === 'stop') { out.push({ id: 'comply', label: '🪪 Comply', ok: true }); out.push({ id: 'run', label: '🏎️ Floor it', ok: !!surf()?.info?.driving, why: 'On foot? Run where?' }); }
  return enc.options = out;
}
function productFor(price) {
  const it = Object.entries(stash()).map(([id, s]) => ({ id, qty: s.qty, v: unitVal(id) })).filter(x => x.v > 0 && x.qty > 0).sort((a, b) => a.v - b.v);
  const need = price * 1.25, take = {}; let got = 0;
  for (const x of it) { while (got < need && (take[x.id] || 0) < x.qty) { take[x.id] = (take[x.id] || 0) + 1; got += x.v; } if (got >= need) break; }
  if (got < need) return null;
  let names = {}; try { for (const i of CB()?.items?.() || []) names[i.id] = i.name; } catch (e) { /* */ }
  return { take, value: got, label: Object.entries(take).map(([id, q]) => `${q} ${names[id] || id}`).join(', ') };
}
function startEnc(kind, o = {}) {
  enc = { kind, cop: newCop(kind, o), stars: kind === 'stop' ? 0 : stars(), t0: Date.now(), until: kind === 'stop' ? Date.now() + (o.sec || 14) * 1000 : 0, price: 0, options: [] };
  options(); if (kind === 'stop') S.stats.stops++, save();
  emit(kind === 'stop' ? 'stop' : 'offer', { kind, cop: { ...enc.cop }, stars: enc.stars, price: enc.price });
  render(); return pub();
}
function endEnc(cool = 6000) { enc = null; cd = Date.now() + cool; render(); }
const pub = () => enc ? { kind: enc.kind, cop: { ...enc.cop }, stars: enc.stars, price: enc.price, until: enc.until, options: enc.options.map(x => ({ ...x })) } : null;

// world.js escalation: stars always go through world.setWanted / world.crime
function escalate(kind) {
  const w = world(), n = stars(), r = Math.random(); let what, to;
  if (r < 0.4) { what = 'star'; to = Math.min(5, n + 1); w?.setWanted?.(to, 'tried to bribe a ColSec officer'); }
  else if (r < 0.75) { what = 'backup'; to = Math.min(5, Math.max(n + 1, kind === 'stop' ? 2 : 3)); w?.setWanted?.(to, 'bribery: officer called backup'); }
  else { what = 'crime'; to = Math.min(5, Math.max(n + 1, 2)); if (w?.crime) w.crime(to, 'attempted bribery of a ColSec officer'); if ((w?.wanted || 0) < to) w?.setWanted?.(to, 'attempted bribery'); }
  return { what, stars: stars() || to };
}
const LINES = {
  ok: { straight: ['…Fine. You were never here.', 'This never happened. Neither did you.'], greedy: ['Pleasure doing predator business.', 'Pockets heavy, memory light. Beat it.', 'Next time bring more.'], on_take: ['Who? Never heard of you.', 'Paperwork just fell in the recycler.', 'Have a nice night, citizen. Heh.'] },
  no: { straight: ['A BRIBE? Hands on the hood!', 'That\u2019s attempted bribery, genius. Dispatch, I need units.', 'You just bought yourself another charge.'], greedy: ['That\u2019s an insult. Now it\u2019s personal.', 'Not enough, and now you\u2019re mine.'], on_take: ['Not with IA on the channel. Sorry, pal.', 'Wrong night. Cameras are live.'] },
  esc: { star: 'Another ★ on your file.', backup: 'He keys his radio: backup inbound.', crime: 'Bribery charge filed.' }
};
function offer(kind, opts = {}) {
  if (kind === 'record' || kind === 'tipoff' || kind === 'evidence') return deskDirect(kind);
  const w = world(), g = game();
  if (!enc) { if (!stars() && !opts.stop) return { ok: false, cost: 0, msg: 'Nobody\u2019s stopping you. Keep your money.' }; startEnc(opts.stop ? 'stop' : 'spot', opts); }
  const o = liveOpts({ kind: enc.kind, personality: enc.cop.personality, stars: enc.kind === 'stop' ? 0 : stars() }), p = price(o), cop = enc.cop;
  if (kind === 'comply') return comply();
  if (kind === 'run') { w?.setWanted?.(Math.max(stars(), 2), 'ran a ColSec stop'); emit('run', { cop }); endEnc(); return { ok: true, cost: 0, msg: `🚨 ${cop.name}: "Runner!" ★★` }; }
  let cost = 0, payDesc = '', take = null, gang = null, tip = null;
  if (kind === 'cash') { if ((g?.progress?.credits ?? 0) < p) return { ok: false, cost: 0, msg: `You\u2019re short. ${cop.name} wants ${p} cr.` }; cost = p; payDesc = `${p} cr`; }
  else if (kind === 'product') { take = productFor(p); if (!take) return { ok: false, cost: 0, msg: 'Not enough product on you to tempt him.' }; payDesc = take.label; }
  else if (kind === 'favor') { gang = opts.gang || gangTarget(); if (!gang) return { ok: false, cost: 0, msg: 'You\u2019ve got nothing new on anybody.' }; payDesc = `dirt on ${GANG_NAME[gang] || gang}`; }
  else if (kind === 'tip') { tip = unsoldTip(); if (!tip) return { ok: false, cost: 0, msg: 'No tips to sell.' }; payDesc = `your tip on ${tip.target || tip.kind}`; }
  else if (kind === 'namedrop') { if (!ruskCleared() && !opts.force) return { ok: false, cost: 0, msg: 'You don\u2019t know Rusk well enough to drop his name.' }; payDesc = 'Rusk\u2019s name'; }
  else return { ok: false, cost: 0, msg: 'Unknown bribe.' };
  const chance = refuseChance(o, kind), refused = opts.force === 'refuse' ? true : opts.force ? false : Math.random() < chance;
  if (refused) {
    if (take) { for (const [id, q] of Object.entries(take.take)) { try { CB()?.remove?.(id, q); } catch (e) { /* */ } } seize(take.take, 'bribe refused: product bagged as evidence'); }
    if (kind === 'favor') S.snitch[gang] = Date.now() + 480000;
    S.priors = Math.min(5, S.priors + 1); S.stats.refused++; save(); repAdd('colsec', -4, 'tried to bribe ColSec');
    const e = escalate(enc.kind), msg = `🚔 ${cop.name}: "${pick(LINES.no[cop.personality])}" ${LINES.esc[e.what]}${take ? ' Your product is evidence now.' : ''}`;
    emit('refused', { kind, cop, chance, escalation: e.what, stars: e.stars, encounter: enc.kind }); endEnc(20000); toast(msg, 4200);
    return { ok: false, refused: true, escalation: e.what, cost: 0, chance, msg };
  }
  if (cost && !g?.spend?.(cost)) return { ok: false, cost: 0, msg: 'You\u2019re short.' };
  if (take) for (const [id, q] of Object.entries(take.take)) { try { CB()?.remove?.(id, q); } catch (e) { /* */ } }
  if (gang) { S.snitch[gang] = Date.now() + 480000; repAdd(gang, -10, 'snitched to ColSec'); emit('snitch', { gang, cop }); }
  if (tip) S.tipsSold.push(`${tip.t}|${tip.target}`);
  const n = stars(), to = enc.kind === 'stop' ? 0 : n >= 3 ? n - 2 : 0;
  if (enc.kind !== 'stop' && n > 0) w?.setWanted?.(to, 'bribed ColSec');
  repAdd('colsec_dirty', kind === 'namedrop' ? 1 : 3, 'greased a cop'); repAdd('colsec', 1, 'paid the "fine"');
  S.stats.paid++; S.stats.spent += cost; save();
  const msg = `💸 ${cop.name}: "${pick(LINES.ok[cop.personality])}"${enc.kind !== 'stop' ? (to ? ` One cop can\u2019t call off the precinct: ${'★'.repeat(to)} left.` : ' Heat\u2019s off.') : ''}`;
  emit('paid', { kind, cop, cost, pay: payDesc, stars: to, encounter: enc.kind, chance }); endEnc(enc.kind === 'stop' ? 4000 : 8000); toast(msg, 3600);
  return { ok: true, cost, pay: payDesc, stars: to, chance, msg };
}
function comply() {
  const w = world(), g = game(), cop = enc.cop, n = carrying(); let msg;
  if (surf()?.info?.stolen) { w?.setWanted?.(Math.max(1, stars()), 'stolen ride at a ColSec stop'); msg = `🚔 ${cop.name}: "This ride\u2019s reported stolen. Out of the vehicle!" ★`; }
  else if (n > 0 && Math.random() < (tipoffOn() ? 0.3 : 0.6)) {
    const items = {}; for (const [id, s] of Object.entries(stash())) { items[id] = s.qty; try { CB()?.remove?.(id, s.qty); } catch (e) { /* */ } }
    seize(items, 'ColSec stop'); w?.setWanted?.(Math.max(1, stars()), 'contraband at a ColSec stop'); S.priors = Math.min(5, S.priors + 1); save();
    msg = `🚔 ${cop.name}: "Well, well." ${n} units seized. ★ (Rusk can make evidence disappear.)`;
  } else { const fine = 25; g?.spend?.(fine); msg = `🚔 ${cop.name}: "License checks out. ${fine} cr for the broken taillight." Move along.`; }
  emit('comply', { cop, carried: n }); endEnc(4000); toast(msg, 3800); return { ok: true, cost: 0, msg };
}

// ---------- seized evidence (undercover busts, busts, bagged bribes) ----------
function seize(items, why) {
  const it = {}; for (const [id, q] of Object.entries(items || {})) if (q > 0) it[id] = (q | 0);
  if (!Object.keys(it).length) return;
  const keep = S.seized && Date.now() - S.seized.t < 2700000 ? S.seized.items : {};
  for (const [id, q] of Object.entries(it)) keep[id] = (keep[id] || 0) + q;
  S.seized = { items: keep, t: Date.now(), why }; save(); emit('seized', { items: it, why }); syncDesk(true);
}
function seizedValue() { if (!S.seized) return 0; return Object.entries(S.seized.items).reduce((v, [id, q]) => v + (unitVal(id) || 30) * q, 0); }
let snap = {}, cbHooked = null;
function hookContraband() {
  const C = CB(); if (!C?.on || cbHooked === C) return; cbHooked = C;
  C.on(ev => { try {
    if (ev.type === 'bust') { S.priors = Math.min(5, S.priors + 1); save();
      if (ev.item && ev.qty) seize({ [ev.item]: ev.qty }, 'sold to an undercover ColSec officer');
      else if (ev.offer) { const o = C.offer?.(ev.offer); const it = {}; for (const w of o?.wantsAll || []) if (w.item !== 'credits') it[w.item] = w.qty; seize(it, `barter with ${o?.npcName || 'a contact'} went bad`); } }
    else if (ev.type === 'confiscate') { S.priors = Math.min(5, S.priors + 1); save(); seize(snap, 'busted: ColSec bagged your stash'); }
    if (ev.type !== 'confiscate') { const s = {}; for (const [id, x] of Object.entries(stash())) s[id] = x.qty; snap = s; }
  } catch (e) { console.warn('bribes contraband', e); } });
}

// ---------- Deputy Rusk's precinct desk (services on his existing wall via SSX.contraband.registerOffer) ----------
const RUSK = { npc: 'Deputy Rusk', venue: 'RUSK TAKES wall', district: 'red_tape_flats', location: [-270, -24] };
const DESK = {
  record: { id: 'rusk-clean-record', cooldownSec: 1800, label: () => `Clean record: wipe every ★ and ${S.priors} prior${S.priors === 1 ? '' : 's'}`,
    avail: () => stars() > 0 || S.priors > 0, why: 'Your file\u2019s already thin.',
    lines: { offer: 'Rusk: Your file\u2019s fat as a hauler manifest. I know a recycler.', accept: 'Rusk: Who? Never heard of you. Neither has the database.', decline: 'Rusk: Then wear it.' } },
  tipoff: { id: 'rusk-patrol-sheet', cooldownSec: 900, label: () => 'Patrol sheet: 15 min of no stops, cheaper cops, raid warnings',
    avail: () => !tipoffOn(), why: 'You\u2019ve already got this week\u2019s sheet.',
    lines: { offer: 'Rusk: Where the boys roll tonight, who\u2019s on the take, who\u2019s IA. Paper\u2019s expensive.', accept: 'Rusk: Memorise it. Then eat it.', decline: 'Rusk: Then drive careful.' } },
  evidence: { id: 'rusk-lost-evidence', cooldownSec: 600, label: () => `Lost evidence: ${seizedLabel() || 'nothing in the locker'}`,
    avail: () => !!S.seized && Date.now() - S.seized.t < 2700000, why: 'Nothing of yours in the evidence locker.',
    lines: { offer: 'Rusk: Evidence locker\u2019s a leaky place. Things walk.', accept: 'Rusk: Found it in a drawer. Funny, that.', decline: 'Rusk: It gets incinerated Friday.' } }
};
function itemName(id) { try { return (CB()?.items?.() || []).find(i => i.id === id)?.name || id; } catch (e) { return id; } }
function seizedLabel() { if (!S.seized) return ''; let names = {}; try { for (const i of CB()?.items?.() || []) names[i.id] = i.name; } catch (e) { /* */ } return Object.entries(S.seized.items).map(([id, q]) => `${q} ${names[id] || id}`).join(', '); }
function deskDo(kind) {
  const w = world();
  if (kind === 'record') { const n = stars(), p = S.priors; w?.setWanted?.(0, 'Rusk lost your file'); S.priors = 0; save(); repAdd('colsec_dirty', 4, 'bought a clean record'); emit('record', { stars: n, priors: p }); return { ok: true, msg: `🗂️ Record wiped: ${n ? '★'.repeat(n) + ' gone, ' : ''}${p} prior${p === 1 ? '' : 's'} shredded.` }; }
  if (kind === 'tipoff') {
    S.tipoffUntil = Date.now() + 900000; save(); repAdd('colsec_dirty', 2, 'bought a patrol sheet'); let heist = null;
    try { window.SSX?.raids?.warn?.({ from: 'Deputy Rusk', warnSec: 90, t: Date.now() }); } catch (e) { /* optional */ }
    try { const H = window.SSX?.heist || window.heist; if (H?.applyTip) { const a = H.active, id = a?.id || (H.heists?.() || []).map(x => x.id).find(x => !H.tips?.(x)?.patrol); if (id) heist = H.applyTip(id, { type: 'patrol' }) ? id : null; } } catch (e) { /* optional */ }
    emit('tipoff', { until: S.tipoffUntil, heist }); return { ok: true, msg: `📻 Patrol sheet for 15 min: no ColSec stops, cops on the take, raid warnings${heist ? `, guard spots for ${heist}` : ''}.` };
  }
  if (kind === 'evidence') {
    if (!S.seized) return { ok: false, msg: 'Nothing in the locker.' }; const got = [], left = {};
    for (const [id, q] of Object.entries(S.seized.items)) { let r = null; try { r = CB()?.add?.(id, q); } catch (e) { /* */ } const n = r?.ok ? r.qty : 0; if (n) got.push(`${n} ${itemName(id)}`); if (n < q) left[id] = q - n; }
    if (!got.length) return { ok: false, msg: 'No room in your pockets. Rusk keeps it warm.' };
    S.seized = Object.keys(left).length ? { ...S.seized, items: left } : null; save(); emit('evidence', { got }); return { ok: true, msg: `🧾 Evidence walked out of the locker: ${seizedLabelFrom(got)}.${S.seized ? ' Some\u2019s still in there (no room).' : ''}` };
  }
  return { ok: false, msg: 'Unknown service.' };
}
const seizedLabelFrom = got => got.join(', ');
let deskReg = {};
function syncDesk(force) {
  const C = CB(); if (!C?.registerOffer) return;
  for (const [k, d] of Object.entries(DESK)) {
    const p = price({ kind: k }) || 60, label = d.label(), sig = p + '|' + label;
    if (!force && deskReg[k] === sig) continue;
    try {
      C.registerOffer({ id: d.id, ...RUSK, wants: [{ item: 'credits', qty: p }], gives: { type: 'custom', service: k }, label, cooldownSec: d.cooldownSec, repeatable: true,
        rep: { factions: [{ faction: 'colsec_dirty', min: 0 }] }, lines: d.lines, available: () => d.avail(),
        onTrade: () => { const r = deskDo(k); setTimeout(() => syncDesk(true), 0); return r; } });
      deskReg[k] = sig;
    } catch (e) { console.warn('bribes desk', e); deskReg[k] = sig; }
  }
}
function deskDirect(kind) {
  const C = CB(), d = DESK[kind]; syncDesk(true);
  if (C?.barter) { const r = C.barter(null, null, d.id); if (!r.ok && /Not right now/.test(r.msg || '')) return { ...r, msg: d.why }; return r; }
  if (!d.avail()) return { ok: false, msg: d.why }; const p = price({ kind }); if (!game()?.spend?.(p)) return { ok: false, msg: 'You\u2019re short.' }; return deskDo(kind);
}
function contacts() {
  const C = CB(), svc = Object.entries(DESK).map(([k, d]) => { const o = C?.offer?.(d.id); return { id: d.id, service: k, label: d.label(), price: price({ kind: k }), available: o ? !!o.available : d.avail(), why: o ? o.why || '' : d.avail() ? '' : d.why }; });
  let story = []; try { story = (C?.barterOffers?.(null) || []).filter(o => /rusk/i.test(o.npc) && !Object.values(DESK).some(d => d.id === o.id)).map(o => ({ id: o.id, label: o.label, available: o.available, why: o.why || '' })); } catch (e) { /* */ }
  const out = [{ id: 'rusk', name: 'Deputy Rusk', role: 'crooked precinct desk', district: 'red-tape-flats', at: RUSK.location, services: [...svc, ...story] }];
  try { const dor = (C?.barterOffers?.(null) || []).filter(o => /dorsey/i.test(o.npc)); if (dor.length) out.push({ id: 'dorsey', name: 'Sgt. Dorsey', role: 'off-the-clock sergeant', district: dor[0].district, services: dor.map(o => ({ id: o.id, label: o.label, available: o.available, why: o.why || '' })) }); } catch (e) { /* */ }
  return out;
}

// ---------- detection: cops with hands on you, pull-over stops, tip-off warnings ----------
function copNear() {
  const w = world(), i = info(); if (!w || !i || stars() <= 0) return null;
  let best = null; const consider = (k, x, z, r) => { const d = Math.hypot(x - i.x, z - i.z); if (d < r && (!best || d < best.d)) best = { kind: k, d }; };
  try { for (const s of w.securityList?.() || []) if (s.kind !== 'drone' && s.hp > 0) consider(s.kind, s.x, s.z, s.kind === 'buggy' ? 10 : 13); } catch (e) { /* */ }
  try { for (const p of w.debug?.people?.() || []) if (p.kind === 'guard' && p.on) consider('guard', p.x, p.z, 9); } catch (e) { /* */ }
  try { if (!best && (w.debug?.bustT?.() || 0) > 0.2) best = { kind: 'hands', d: 0 }; } catch (e) { /* */ }
  return best;
}
// spot bribes work during jobs (a cop is a cop); scripted chases and stops skip quests, duels, heists and interiors
function busy(stop) { const g = game(); try { return !!(g?.isDown?.() || window.SSX?.heist?.active || world()?.inDuel || world()?.inside || (stop && (g?.debug?.quest?.() || g?.info?.combat))); } catch (e) { return false; } }
function tick() {
  hookContraband(); syncDesk(false);
  const a = app(); if (!a?.state?.onSurface || !info()) { if (enc) endEnc(0); return; }
  const now = Date.now();
  if (enc?.kind === 'spot') {
    if (!stars()) { endEnc(4000); return; }
    if (copNear()) lostT = now; else if (now - lostT > 4000) { endEnc(3000); return; }
    const p = price({ kind: 'spot', personality: enc.cop.personality }); if (p !== enc.price) { options(); render(); }
  } else if (enc?.kind === 'stop') { if (now > enc.until) { comply(); return; } renderTimer(); }
  else if (now > cd && stars() > 0 && copNear() && !busy()) { lostT = now; startEnc('spot'); }
  else if (now > stopNext) { stopNext = now + 45000; maybeStop(); }
}
function maybeStop() {
  const i = surf()?.info; if (!i?.driving || stars() || busy(true) || tipoffOn() || Date.now() < cd) return;
  const d = district(); if (!['olympus-row', 'ares-beltway', 'ares-junction', 'helios-heights'].includes(d)) return;
  const ch = 0.05 + (i.stolen ? 0.06 : 0) + (carrying() ? 0.04 : 0) + 0.02 * S.priors + (d === 'ares-beltway' ? 0.03 : 0);
  if (Math.random() < ch) { startEnc('stop'); stopNext = Date.now() + 360000; toast(`🚔 Sirens behind you. ${enc.cop.name}: "License, registration, and your sense of optimism."`, 3600); }
}
function warn(what, d = {}) { if (!tipoffOn()) return; const m = what === 'turf' ? `📻 Rusk: "Heads up: ${d.gang || 'a crew'} is hitting ${d.block || 'your block'}. You didn\u2019t hear it from me."` : what === 'raid' ? `📻 Rusk: "${d.name || 'Somebody'} is coming for your turf. Ninety seconds, maybe less."` : `📻 Rusk: "Heads up: ${what}."`; toast(m, 4200); emit('warn', { what, ...d }); }
window.addEventListener('ssx:turf', e => { try { const d = e.detail || {}; if (d.type === 'counter' || d.type === 'attack') warn('turf', { gang: d.gang || d.by || d.faction, block: d.block?.name || d.blockName || d.block }); } catch (x) { /* */ } });
window.addEventListener('ssx:rep', e => { try { const d = e.detail || {}; if (d.type === 'raid') warn('raid', { name: d.id, block: d.block }); } catch (x) { /* */ } });
window.addEventListener('ssx:raid', e => { try { warn('raid', { name: e.detail?.attackers || e.detail?.id }); } catch (x) { /* */ } });

// ---------- UI: one compact high-contrast bar (black, white, 48px targets, __onTap); no panel, no dock ----------
const css = `
#bribeBar{position:fixed;left:50%;transform:translateX(-50%);top:calc(64px + env(safe-area-inset-top));z-index:62;display:none;width:min(440px,calc(100vw - 16px));box-sizing:border-box;padding:10px;border-radius:14px;background:#000;color:#fff;border:2px solid #fff;font:14px system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.6)}
#bribeBar.show{display:block} #bribeBar .hd{display:flex;justify-content:space-between;gap:8px;font-weight:800;font-size:15px} #bribeBar .tell{font-size:12.5px;margin:3px 0 6px;opacity:.9}
#bribeBar .g{display:grid;grid-template-columns:1fr 1fr;gap:6px} #bribeBar button{min-height:48px;padding:4px 8px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 13.5px system-ui,sans-serif;touch-action:manipulation;line-height:1.15}
#bribeBar button.main{grid-column:1/-1;background:#fff;color:#000;font-size:15px} #bribeBar button:disabled{opacity:.45} #bribeBar .t{font-variant-numeric:tabular-nums}
`;
let bar = null, lastTouch = 0;
function tap(el, fn) { const g = e => { const n = performance.now(); if (e?.type === 'click' && n - lastTouch < 700) return; if (e?.type === 'pointerup') lastTouch = n; fn(e); }; (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, g); }
function ui() {
  if (bar) return; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  bar = document.createElement('div'); bar.id = 'bribeBar'; bar.setAttribute('role', 'dialog'); bar.setAttribute('aria-label', 'Bribe'); document.body.appendChild(bar);
  addEventListener('keydown', e => { if (e.code !== HOTKEY || e.repeat || !enc || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return; e.preventDefault(); const o = (enc.options || []).find(x => x.ok && x.id !== 'comply' && x.id !== 'run'); if (o) act(o); });
}
function act(o) { const r = offer(o.id, { gang: o.gang }); if (!r.ok && !r.refused) toast(r.msg, 2600); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function render() {
  ui(); if (!enc) { bar.classList.remove('show'); return; }
  const P = PERS[enc.cop.personality], st = enc.kind === 'stop' ? 'Pulled over' : '★'.repeat(stars());
  const opts = enc.options.length ? enc.options : options(), hk = isTouch() ? '' : ' (;)';
  bar.innerHTML = `<div class="hd"><span>🚔 ${esc(enc.cop.name)}</span><span>${st}${enc.kind === 'stop' ? ` · <span class="t" id="bribeT"></span>` : ''}</span></div><div class="tell">${esc(P.name)}: ${esc(enc.cop.tell)}</div><div class="g">${opts.map((o, i) => `<button type="button" data-i="${i}" class="${i === 0 ? 'main' : ''}"${o.ok ? '' : ' disabled'} aria-label="${esc(o.label)}">${esc(o.label)}${i === 0 ? hk : ''}</button>`).join('')}</div>`;
  bar.querySelectorAll('button[data-i]').forEach(b => tap(b, () => { const o = opts[+b.dataset.i]; if (o?.ok) act(o); }));
  bar.classList.add('show'); renderTimer();
}
function renderTimer() { const t = document.getElementById('bribeT'); if (t && enc?.until) t.textContent = Math.max(0, Math.ceil((enc.until - Date.now()) / 1000)) + 's'; }

// ---------- boot ----------
window.SSX = window.SSX || {};
const api = {
  price, offer, on, contacts, isNight,
  get encounter() { return pub(); },
  record: () => ({ priors: S.priors, seized: S.seized ? { ...S.seized, items: { ...S.seized.items } } : null, tipoffSec: Math.max(0, Math.round((S.tipoffUntil - Date.now()) / 1000)), stats: { ...S.stats } }),
  personalities: Object.keys(PERS), hotkey: HOTKEY,
  debug: {
    stop: (o = {}) => { if (enc) endEnc(0); return startEnc('stop', o); },
    spot: (o = {}) => { if (enc) endEnc(0); lostT = Date.now() + 600000; return startEnc('spot', o); },
    clear: () => endEnc(0), night: v => { nightOverride = v; }, personality: p => { persOverride = p || null; },
    seize: (item, qty = 1) => seize({ [item]: qty }, 'debug'), priors: n => { S.priors = clamp(n | 0, 0, 5); save(); syncDesk(true); },
    tick, state: () => JSON.parse(JSON.stringify({ S, enc: pub(), desk: deskReg })), reset: () => { S = fresh(); save(); enc = null; cd = 0; syncDesk(true); render(); },
    refuseChance: (kind = 'cash', o = {}) => refuseChance(liveOpts(o), kind)
  }
};
window.SSX.bribes = api;
setInterval(() => { try { tick(); } catch (e) { console.warn('bribes tick', e); } }, 250);
