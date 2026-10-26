// v7.5.x Mars fight club (Marsmania): the Rust Pit, a chain-link cage on the Red Tape Flats scrubland.
// Bare-knuckle and blade bouts against a ranked ladder of 8 ring fighters, a champion's belt with title defences,
// stakes on your own fights and bets on the undercard (NPC vs NPC, odds from ratings). Fiction only, no real brands.
//
// Built on the v7.4 duel system in world.js, not a new combat model: your bouts are world.challenge('fists'|'blades',
// 0, null, { as, tag }) duels. `as` (the small world.js extension in this PR) lets a ladder fighter borrow the nearest
// free colonist's body for the bout, with its name, toughness, hit power, purse and an overhead label; the body is
// restored afterwards. So the core duel HUD, yield button, crowd ring, duel camera and legal status all carry over:
// while world.inDuel is true, crime() ignores hits on the duelist and bystanders, so ring hits never draw ColSec and
// your wanted level stays put. Undercard bouts are simulated (two figures in the cage), never touching security.
//
// Integrations, all feature-detected and optional:
//  SSX.rep (PR #20)         -> gang fixers: a crew offers cash to take a dive (rep up if you do, down if you cross them);
//                              beating a gang's fighter costs a little rep; trusted crews whisper which undercard is fixed.
//  SSX.contraband (PR #9)   -> a fixer's sweetener comes as 2 Glow-dust into your stash (carry limits apply).
//  SSX.bribes (PR #23)      -> with Rusk's patrol sheet live, fixers pay 25% more (nobody's watching the books);
//                              with stars on you the pit points you at Rusk (the cage won't let you in hot).
//
// window.SSX.fight
//  ladder()                 -> [{ rank, id, name, rating, w, l, gang, champ, you }] top first (you are id 'you')
//  status()                 -> { at, near, inCage, you:{ rank, rating, w, l, champ, defences }, bout, card, offer, defence, bets }
//  odds(a, b)               -> { a, b, pA } decimal odds for a beating b (house margin 8%)
//  challenge(id, { style: 'bare'|'blade', stake, fix: 'take'|'refuse' }) -> { ok, msg, offer?, odds? }
//                              be in the cage; only fighters up to 2 ranks above you (the champ takes the #2 contender).
//                              When a fixer has an offer on that bout you get { ok:false, offer } back: answer with fix.
//  bet(id, stake)           -> { ok, msg, odds }   back a fighter on the current undercard (before the bell)
//  card()                   -> the undercard { a, b, oddsA, oddsB, phase:'open'|'live'|'done', startsIn, winner, whisper }
//  on(type?, fn)            -> unsubscribe fn; also window 'ssx:fight' CustomEvents and SSX.emit('fight:<type>')
//                              types: challenge, start, result, fix, bet, card, cardLive, cardResult, payout, champ, defence,
//                              stripped, change
//  open() / close()         -> the panel (☰ "🥊 Rust Pit", key ], dock 🥊 on #ssxDock when present, the cage beacon)
//  debug                    -> goto(), card(a, b, { fixed, winner }), runCard(), resolveCard(id), fix(id), defence(), expire(),
//                              setRank(n), reset(), state(), inCage
import * as THREE from 'three';

const KEY = 'ssx.fight.v1', HOTKEY = 'BracketRight';
const CAGE_AT = [-292, -68], R_CAGE = 6.4, R_NEAR = 10;
const R_PIT = 12; // v7.5.4: the Rust Pit grounds (cage + apron); ColSec holds fire in here (world.js updateSecurity), same radius as mars/pursuit.js
const CARD_EVERY = 90, CARD_LIVE = 12, DEFENCE_EVERY = 1200, DEFENCE_WINDOW = 600, MARGIN = 0.92;
const STAKES = [0, 50, 100, 250];
const GANGS = { saltblood: 'Saltblood', saints: 'Vacuum Saints', dustjaws: 'Dustjaw Boys' };
const FIGHTERS = [
  { id: 'rust', name: 'Mother Rust', rating: 1720, blurb: 'Champion. Forty fights, one ear, no mercy.', gang: null },
  { id: 'bonesaw', name: 'Bonesaw Kell', rating: 1610, blurb: 'Saltblood\u2019s favourite son. Tape on both fists.', gang: 'saltblood' },
  { id: 'gravel', name: 'Gravel Tooth', rating: 1530, blurb: 'Grinds his teeth on the walk-out. You can hear it.', gang: null },
  { id: 'vacuum', name: 'Sister Vacuum', rating: 1450, blurb: 'Vacuum Saints. Prays before, during and after.', gang: 'saints' },
  { id: 'rivet', name: 'Rivet Jaw Doyle', rating: 1380, blurb: 'Dustjaw Boys. Welded his own respirator shut.', gang: 'dustjaws' },
  { id: 'slag', name: 'Slag Petey', rating: 1300, blurb: 'Smelter hand. Hands like hot ingots.', gang: null },
  { id: 'tinlung', name: 'Tin Lung Marro', rating: 1220, blurb: 'Wheezes, keeps coming.', gang: null },
  { id: 'wetsock', name: 'Wet Sock', rating: 1140, blurb: 'Nobody remembers how he got the name. He does.', gang: null },
];
const FX = Object.fromEntries(FIGHTERS.map(f => [f.id, f]));
const STYLE = { bare: { duel: 'fists', name: 'Bare-knuckle', icon: '👊' }, blade: { duel: 'blades', name: 'Blades', icon: '🔪' } };

const fresh = () => ({ v: 1, order: [...FIGHTERS.map(f => f.id), 'you'], ratings: Object.fromEntries(FIGHTERS.map(f => [f.id, f.rating])),
  rec: Object.fromEntries(FIGHTERS.map((f, i) => [f.id, { w: 30 - i * 3, l: 4 + i * 2 }])), you: { rating: 1000, w: 0, l: 0, ko: 0, defences: 0, belts: 0 },
  defenceDue: 0, defenceBy: 0, card: null, bets: [], stats: { bouts: 0, bets: 0, betWon: 0, betLost: 0, dives: 0, crossed: 0, earned: 0 } });
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1 && Array.isArray(s.order) && s.order.length === 9) { const f = fresh(); return { ...f, ...s, you: { ...f.you, ...s.you }, stats: { ...f.stats, ...s.stats }, ratings: { ...f.ratings, ...s.ratings }, rec: { ...f.rec, ...s.rec } }; } } catch (e) { /* fresh */ } return fresh(); }
let S = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };

// ---------- plumbing ----------
const app = () => window.__app, surf = () => app()?.surface, game = () => app()?.game || surf()?.game, world = () => surf()?.world;
const toast = (m, ms = 3200) => { try { app()?.toast?.(m, ms); } catch (e) { /* no HUD */ } };
const radio = (text, who) => { try { if (window.SSX?.city?.radio) return window.SSX.city.radio(text, who); } catch (e) { /* fall through */ } toast(`📻 ${who}: ${text}`, 4200); };
const isTouch = () => document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmtT = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const credits = () => game()?.progress?.credits ?? 0;
const spend = n => { if (!n) return true; try { return !!game()?.spend?.(n); } catch (e) { return false; } };
const pay = n => { if (n > 0) try { game()?.reward?.(0, n); } catch (e) { /* ignore */ } };
const rep = () => (typeof window.SSX?.rep?.add === 'function' ? window.SSX.rep : null);
const repAdd = (id, d, why) => { try { rep()?.add(id, d, why); } catch (e) { /* no rep */ } };
const repGet = id => { try { return Number(rep()?.get?.(id)) || 0; } catch (e) { return 0; } };
const tipoffOn = () => { try { return (window.SSX?.bribes?.record?.().tipoffSec | 0) > 0; } catch (e) { return false; } };
const nameOf = id => id === 'you' ? 'You' : FX[id]?.name || id;
const ratingOf = id => id === 'you' ? S.you.rating : S.ratings[id] ?? 1000;
const rankOf = id => S.order.indexOf(id) + 1; // 1 = champ; you at 9 = unranked
const youRanked = () => rankOf('you') <= 8;
const isChamp = () => S.order[0] === 'you';
const subs = new Map();
function emit(type, extra = {}) {
  const ev = { type, ...extra };
  for (const k of [type, '*']) for (const f of subs.get(k) || []) { try { f(ev); } catch (e) { console.warn('fight listener', e); } }
  try { window.dispatchEvent(new CustomEvent('ssx:fight', { detail: ev })); } catch (e) { /* old browser */ }
  try { window.SSX?.emit?.('fight:' + type, ev); } catch (e) { /* bus optional */ }
  if (type !== 'change') emit('change', { what: type });
}
function on(a, b) { const [k, f] = typeof a === 'function' ? ['*', a] : [String(a), b]; if (typeof f !== 'function') return () => {}; if (!subs.has(k)) subs.set(k, new Set()); subs.get(k).add(f); return () => subs.get(k)?.delete(f); }
function here() { const i = surf()?.info; if (!i || i.name !== 'Mars' || !i.colony) return null; return { x: i.x - i.colony.x, z: i.z - i.colony.z, info: i, cx: i.colony.x, cz: i.colony.z }; }
const cageDist = () => { const h = here(); return h ? Math.hypot(h.x - CAGE_AT[0], h.z - CAGE_AT[1]) : Infinity; };
const inCage = () => cageDist() < R_CAGE + 1.5 && !here()?.info?.inside && !here()?.info?.driving;

// ---------- odds and ratings ----------
const pWin = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / 400));
const toOdds = p => Math.max(1.05, Math.round(MARGIN / clamp(p, 0.03, 0.97) * 100) / 100);
function odds(a, b) { const p = pWin(ratingOf(a), ratingOf(b)); return { a: toOdds(p), b: toOdds(1 - p), pA: Math.round(p * 1000) / 1000 }; }
function elo(w, l, k = 32) { const p = pWin(ratingOf(w), ratingOf(l)), d = Math.round(k * (1 - p)); setRating(w, ratingOf(w) + d); setRating(l, ratingOf(l) - d); return d; }
function setRating(id, v) { v = Math.round(clamp(v, 700, 2200)); if (id === 'you') S.you.rating = v; else S.ratings[id] = v; }
function rec(id) { return id === 'you' ? S.you : S.rec[id]; }
// winner takes the loser's place if it was above (the ladder shifts down one between them)
function climb(w, l) { const iw = S.order.indexOf(w), il = S.order.indexOf(l); if (iw < 0 || il < 0 || iw < il) return false; S.order.splice(iw, 1); S.order.splice(il, 0, w); return true; }
function ladder() { return S.order.map((id, i) => ({ rank: id === 'you' && i === 8 ? null : i + 1, id, name: nameOf(id), rating: ratingOf(id), w: rec(id).w, l: rec(id).l, gang: FX[id]?.gang || null, champ: i === 0, you: id === 'you' })); }
const fighterStats = id => { const r = ratingOf(id), k = (r - 1000) / 1000; return { tough: Math.round((0.7 + k * 1.5) * 100) / 100, dmg: Math.round((0.8 + k) * 100) / 100 }; };
const purseFor = id => rankOf(id) === 1 ? 400 : 40 + (9 - rankOf(id)) * 30;
function eligible(id) {
  if (!FX[id]) return 'No such fighter.';
  const me = rankOf('you'), them = rankOf(id);
  if (isChamp()) return them === 2 ? null : 'The champ only takes the #2 contender.';
  if (them > me) return `${nameOf(id)} is below you. Punch up.`;
  if (me - them > 2) return `Climb first: you can call out fighters up to 2 ranks above you (#${Math.max(1, me - 2)}+).`;
  return null;
}

// ---------- your bouts (v7.4 duels) ----------
let bout = null, offer = null, lastDuelSeen = null;
function makeOffer(id, force) {
  if (isChamp() || !rep() && !force) return null;
  const gang = FX[id].gang && GANGS[FX[id].gang] ? FX[id].gang : Object.keys(GANGS)[(rankOf(id) + S.stats.bouts) % 3];
  const base = 120 + (9 - rankOf(id)) * 40, pay = Math.round(base * (tipoffOn() ? 1.25 : 1));
  return { id, gang, gangName: GANGS[gang], pay, glow: !!window.SSX?.contraband?.add, until: Date.now() + 120000 };
}
function challenge(id, opts = {}) {
  const style = STYLE[opts.style] ? opts.style : 'bare', T = STYLE[style], w = world(), g = game();
  if (bout) return { ok: false, msg: 'You\u2019re already in a bout.' };
  if (!w || !here()) return { ok: false, msg: 'The Rust Pit is on Mars, in the Flats.' };
  if (!inCage() && !opts.force) return { ok: false, msg: 'Step into the cage first. Follow the white beam.' };
  const why = eligible(id); if (why) return { ok: false, msg: why };
  if ((w.wanted | 0) > 0) return { ok: false, msg: `Lose the heat first: the Pit doesn\u2019t open for wanted faces.${window.SSX?.bribes ? ' Deputy Rusk can make stars go away.' : ''}` };
  if (w.inDuel) return { ok: false, msg: 'One fight at a time.' };
  const stake = Math.max(0, Math.round(opts.stake || 0)), od = odds('you', id);
  if (stake > credits()) return { ok: false, msg: `You don\u2019t have ${stake} cr to stake.` };
  // a fixer may want a word first
  if (offer && offer.id === id && offer.until > Date.now()) {
    if (opts.fix !== 'take' && opts.fix !== 'refuse') return { ok: false, offer: { ...offer }, msg: `${offer.gangName} want you to go down. ${offer.pay} cr${offer.glow ? ' + 2 Glow-dust' : ''}.` };
  } else if (opts.fix !== 'refuse' && !opts.noFix && !isChamp() && (opts.forceFix || Math.random() < 0.3) && (rep() || opts.forceFix)) {
    offer = makeOffer(id, opts.forceFix); if (offer) { emit('fix', { offer: { ...offer } }); return { ok: false, offer: { ...offer }, msg: `${offer.gangName} want you to go down. ${offer.pay} cr${offer.glow ? ' + 2 Glow-dust' : ''}.` }; }
  }
  const dive = opts.fix === 'take' && offer?.id === id ? { ...offer } : null; offer = null;
  if (stake && !spend(stake)) return { ok: false, msg: `You don\u2019t have ${stake} cr to stake.` };
  const st = fighterStats(id), defence = isChamp(), tag = { fc: true, id, n: S.stats.bouts + 1 };
  let r = null;
  try { r = w.challenge(T.duel, 0, null, { as: { name: nameOf(id), tough: st.tough, dmg: st.dmg, purse: purseFor(id), label: `🥊 #${rankOf(id)} ${nameOf(id).toUpperCase()}` }, tag }); } catch (e) { r = { ok: false, msg: e.message }; }
  if (!r?.ok) { if (stake) pay(stake); return { ok: false, msg: r?.msg || 'Nobody to fight.' }; }
  bout = { id, style, stake, odds: od.a, dive, defence, tag, wanted0: w.wanted | 0, t0: Date.now() };
  lastDuelSeen = w.lastDuel; S.stats.bouts++; save();
  if (dive) toast(`🤫 The fix is in. Go down to ${nameOf(id)} (yield or get KO\u2019d) and ${dive.gangName} pay.`, 4200);
  emit('start', { id, name: nameOf(id), style, stake, odds: od.a, dive: !!dive, defence, purse: purseFor(id) });
  return { ok: true, msg: `${T.icon} ${T.name} vs #${rankOf(id)} ${nameOf(id)}${stake ? ` · ${stake} cr on you @ ${od.a}` : ''}. Purse ${purseFor(id)} cr.`, odds: od.a };
}
function checkBout() {
  const w = world(); if (!bout || !w) return;
  const d = w.lastDuel; if (w.inDuel || !d || d === lastDuelSeen) return;
  lastDuelSeen = d; if (!d.tag || d.tag.fc !== true || d.tag.n !== bout.tag.n) return;
  finishBout(d);
}
function finishBout(d) {
  const b = bout; bout = null; const id = b.id, name = nameOf(id), win = !!d.win, w = world();
  const voided = d.why === 'abandon' || d.why === 'chicken';
  let payout = 0, msg = '';
  if (voided) { if (b.stake) pay(b.stake); msg = 'Bout called off. Stake back.'; }
  else {
    const R0 = rankOf('you');
    if (win) { S.you.w++; rec(id).l++; if (d.why === 'ko-win') S.you.ko++; elo('you', id); climb('you', id); if (b.stake) { payout = Math.round(b.stake * b.odds); pay(payout); } }
    else { S.you.l++; rec(id).w++; elo(id, 'you'); const i = S.order.indexOf('you'); if (i < 8 && i >= 0) { S.order.splice(i, 1); S.order.splice(i + 1, 0, 'you'); } }
    S.stats.earned += (d.credits || 0) + payout - (win ? 0 : b.stake);
    if (b.dive) {
      if (!win) { pay(b.dive.pay); S.stats.dives++; repAdd(b.dive.gang, 4, 'took a dive in the Rust Pit');
        let glow = 0; if (b.dive.glow) try { const r = window.SSX.contraband.add('glowdust', 2, 1); glow = r?.qty ?? (r?.ok ? 2 : 0); } catch (e) { /* stash full */ }
        msg = `🤫 ${b.dive.gangName} pay up: ${b.dive.pay} cr${glow ? ` + ${glow} Glow-dust` : ''}. Nobody saw a thing.`; emit('payout', { kind: 'dive', credits: b.dive.pay, glow }); }
      else { S.stats.crossed++; repAdd(b.dive.gang, -8, 'crossed a Rust Pit fix'); msg = `😬 You were paid to lose. ${b.dive.gangName} will remember that.`; }
    }
    if (win && FX[id].gang && !b.dive) repAdd(FX[id].gang, -1, `beat ${name} in the Rust Pit`);
    const R1 = rankOf('you');
    if (win && R1 === 1 && R0 !== 1) { S.you.belts++; S.defenceDue = Date.now() + DEFENCE_EVERY * 1000; S.defenceBy = 0; msg = `🏆 CHAMPION OF THE RUST PIT. ${name} hands over the belt. Defend it when the contender calls.`; emit('champ', { from: id }); radio('New champ in the Pit. Somebody tell Mother Rust\u2019s mother.', 'Pit announcer'); }
    else if (b.defence) { if (win) { S.you.defences++; S.defenceDue = Date.now() + DEFENCE_EVERY * 1000; S.defenceBy = 0; msg = `🏆 Title defended against ${name}. ${S.you.defences} defence${S.you.defences === 1 ? '' : 's'}.`; emit('defence', { result: 'win', id }); }
      else { S.defenceDue = 0; S.defenceBy = 0; msg = `💔 ${name} takes the belt.`; emit('defence', { result: 'lose', id }); } }
    if (!msg) msg = win ? `🥊 ${name} is down. ${d.credits ? `Purse ${d.credits} cr` : ''}${payout ? ` · stake paid ${payout} cr` : ''}. You\u2019re #${R1 <= 8 ? R1 : '–'}.` : `🩹 ${name} wins it. ${b.stake ? `Stake gone. ` : ''}You\u2019re #${R1 <= 8 ? R1 : '–'}.`;
  }
  save();
  const res = { id, name, win, why: d.why, style: b.style, stake: b.stake, payout, purse: d.credits || 0, dive: !!b.dive, defence: b.defence, rank: rankOf('you') <= 8 ? rankOf('you') : null, wanted: w?.wanted | 0, wantedBefore: b.wanted0 };
  emit('result', res); toast(msg, 4600); lastResult = res; render();
}
let lastResult = null;

// ---------- title defence ----------
function stepDefence() {
  if (!isChamp()) { S.defenceDue = 0; S.defenceBy = 0; return; }
  const now = Date.now();
  if (!S.defenceDue) { S.defenceDue = now + DEFENCE_EVERY * 1000; save(); }
  if (!S.defenceBy && now >= S.defenceDue) { S.defenceBy = now + DEFENCE_WINDOW * 1000; save(); emit('defence', { due: true, id: S.order[1], by: S.defenceBy }); radio(`${nameOf(S.order[1])} wants the belt. Rust Pit, ${Math.round(DEFENCE_WINDOW / 60)} minutes, or it\u2019s theirs.`, 'Pit announcer'); }
  if (S.defenceBy && now >= S.defenceBy && !bout) strip();
}
function strip() { const c = S.order[1]; S.order.splice(0, 1); S.order.splice(1, 0, 'you'); S.defenceDue = 0; S.defenceBy = 0; save(); emit('stripped', { to: c }); toast(`💔 No-show. The Pit hands your belt to ${nameOf(c)}.`, 4200); render(); }

// ---------- undercard (NPC vs NPC) ----------
function newCard(a, b, o = {}) {
  if (!a || !b) { const pool = S.order.filter(id => id !== 'you'), i = Math.floor(Math.random() * (pool.length - 1)); a = pool[i]; b = pool[i + 1]; if (Math.random() < 0.5) [a, b] = [b, a]; }
  const od = odds(a, b), fixed = o.fixed ?? Math.random() < 0.2, under = od.pA < 0.5 ? a : b;
  const fixer = fixed ? (FX[under].gang || FX[a === under ? b : a].gang || Object.keys(GANGS)[Math.floor(Math.random() * 3)]) : null;
  S.card = { a, b, oddsA: od.a, oddsB: od.b, pA: od.pA, at: Date.now() + (o.sec ?? CARD_EVERY) * 1000, phase: 'open', winner: null, fixed: !!fixed, fixer, rigged: fixed ? (o.winner || under) : (o.winner || null), n: (S.card?.n || 0) + 1 };
  S.bets = []; save(); emit('card', { card: pubCard() }); return pubCard();
}
function pubCard() {
  const c = S.card; if (!c) return null; const now = Date.now();
  const whisper = c.fixed && c.fixer && repGet(c.fixer) >= 20 && c.phase === 'open' ? `🤫 ${GANGS[c.fixer]} whisper: ${nameOf(c.rigged)} takes it. Don\u2019t ask.` : null;
  return { a: c.a, b: c.b, nameA: nameOf(c.a), nameB: nameOf(c.b), oddsA: c.oddsA, oddsB: c.oddsB, phase: c.phase, startsIn: c.phase === 'open' ? Math.max(0, Math.round((c.at - now) / 1000)) : 0,
    endsIn: c.phase === 'live' ? Math.max(0, Math.round((c.at + CARD_LIVE * 1000 - now) / 1000)) : 0, winner: c.winner, whisper, n: c.n, bets: S.bets.map(b => ({ ...b })) };
}
function bet(id, stake) {
  const c = S.card; stake = Math.round(stake || 0);
  if (!c || c.phase !== 'open') return { ok: false, msg: 'Betting\u2019s closed. Wait for the next card.' };
  if (id !== c.a && id !== c.b) return { ok: false, msg: `${nameOf(id)} isn\u2019t on this card.` };
  if (stake < 10) return { ok: false, msg: 'Minimum bet 10 cr.' };
  if (S.bets.reduce((n, b) => n + b.stake, 0) + stake > 1000) return { ok: false, msg: 'The bookie caps you at 1000 cr a card.' };
  if (!spend(stake)) return { ok: false, msg: `You don\u2019t have ${stake} cr.` };
  const o = id === c.a ? c.oddsA : c.oddsB; S.bets.push({ id, stake, odds: o }); S.stats.bets++; save();
  emit('bet', { id, stake, odds: o }); return { ok: true, msg: `🎟️ ${stake} cr on ${nameOf(id)} @ ${o}.`, odds: o };
}
function goLive() { const c = S.card; c.phase = 'live'; c.at = Date.now(); save(); emit('cardLive', { card: pubCard() }); }
function resolveCard(force) {
  const c = S.card; if (!c || c.phase === 'done') return null;
  const w = force || c.rigged || (Math.random() < c.pA ? c.a : c.b), l = w === c.a ? c.b : c.a;
  c.winner = w; c.phase = 'done'; c.doneAt = Date.now(); rec(w).w++; rec(l).l++; elo(w, l, 24); const moved = climb(w, l);
  let won = 0, lost = 0; for (const b of S.bets) { if (b.id === w) { const p = Math.round(b.stake * b.odds); won += p; S.stats.betWon++; } else { lost += b.stake; S.stats.betLost++; } }
  pay(won); S.stats.earned += won - lost; save();
  const res = { winner: w, loser: l, name: nameOf(w), upset: moved, won, lost, fixed: c.fixed };
  emit('cardResult', res); if (won || lost) emit('payout', { kind: 'bet', credits: won, lost });
  if (cageDist() < 60 || S.bets.length) toast(`🥊 Undercard: ${nameOf(w)} beats ${nameOf(l)}${moved ? ' (upset, they swap ranks)' : ''}.${won ? ` You collect ${won} cr.` : lost ? ` Your ${lost} cr is gone.` : ''}`, 4200);
  return res;
}
function stepCard() {
  const now = Date.now(), c = S.card;
  if (!c) return newCard();
  if (c.phase === 'open' && now >= c.at) goLive();
  else if (c.phase === 'live' && now >= c.at + CARD_LIVE * 1000) resolveCard();
  else if (c.phase === 'done' && now >= (c.doneAt || 0) + 8000) newCard();
}

// ---------- the cage ----------
const ray = new THREE.Raycaster(), V0 = new THREE.Vector3(), DOWN = new THREE.Vector3(0, -1, 0);
let terrain = null;
function terrainMeshes(scene) {
  if (terrain && terrain.length && terrain[0].parent?.parent === scene) return terrain;
  const count = new Map(); for (const c of scene.children) { const m = c.isGroup && c.children[0]; if (m?.isMesh && m.material) count.set(m.material, (count.get(m.material) || 0) + 1); }
  let mat = null, n = 3; for (const [k, v] of count) if (v > n) { n = v; mat = k; }
  terrain = mat ? scene.children.filter(c => c.isGroup && c.children[0]?.material === mat).map(c => c.children[0]) : []; return terrain;
}
function groundY(wx, wz, fallback) { const w = world(); try { const y = w?.groundAt?.(wx, wz); if (Number.isFinite(y)) return y; } catch (e) { /* raycast */ }
  const s = surf(); if (!s?.scene) return fallback; const list = terrainMeshes(s.scene); if (!list.length) return fallback; V0.set(wx, 4000, wz); ray.set(V0, DOWN); ray.far = 8000; const hit = ray.intersectObjects(list, false)[0]; return hit ? hit.point.y : fallback; }
function labelTex(text) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 64; const x = c.getContext('2d');
  let fs = 28; x.font = `bold ${fs}px system-ui, sans-serif`; while (fs > 14 && x.measureText(text).width > 290) { fs -= 2; x.font = `bold ${fs}px system-ui, sans-serif`; }
  x.textAlign = 'center'; x.textBaseline = 'middle'; const w = Math.min(314, x.measureText(text).width + 26);
  x.fillStyle = 'rgba(0,0,0,0.9)'; x.fillRect(160 - w / 2, 8, w, 48); x.strokeStyle = '#fff'; x.lineWidth = 2; x.strokeRect(160 - w / 2, 8, w, 48); x.fillStyle = '#fff'; x.fillText(text, 160, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let G = null, figs = null, sign = null, signText = '';
const signLabel = () => { const c = S.card; return c?.phase === 'live' ? `🥊 LIVE: ${nameOf(c.a).toUpperCase()} vs ${nameOf(c.b).toUpperCase()}` : `🥊 THE RUST PIT · ${isChamp() ? 'YOUR HOUSE' : 'FIGHT NIGHT'}`; };
function figure(col, trim) {
  const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: col }), t = new THREE.MeshLambertMaterial({ color: trim });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 1.05, 8), m); body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), m); head.position.y = 1.8; g.add(head);
  const arms = []; for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.62), t); a.position.set(0.36 * s, 1.3, 0.22); g.add(a); arms.push(a); }
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), m); l.position.set(0.13 * s, 0.28, 0); g.add(l); }
  g.userData.arms = arms; return g;
}
function build(h) {
  const s = surf(); G = new THREE.Group(); G.name = 'mars-fightclub'; s.scene.add(G);
  const wx = h.cx + CAGE_AT[0], wz = h.cz + CAGE_AT[1], y = groundY(wx, wz, h.info.y - 1.7); G.position.set(wx, y, wz);
  const white = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }), black = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const mat = new THREE.Mesh(new THREE.CylinderGeometry(R_CAGE, R_CAGE, 0.12, 8), black); mat.position.y = 0.06; mat.rotation.y = Math.PI / 8; G.add(mat);
  const line = new THREE.Mesh(new THREE.RingGeometry(R_CAGE - 0.35, R_CAGE - 0.15, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })); line.rotation.x = -Math.PI / 2; line.rotation.z = Math.PI / 8; line.position.y = 0.13; G.add(line);
  const fence = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.35 });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, b = (i + 1) / 8 * Math.PI * 2, x0 = Math.cos(a) * R_CAGE, z0 = Math.sin(a) * R_CAGE, x1 = Math.cos(b) * R_CAGE, z1 = Math.sin(b) * R_CAGE;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6), white); post.position.set(x0, 1.3, z0); G.add(post);
    if (i === 2) continue; // the gate
    const L = Math.hypot(x1 - x0, z1 - z0), panel = new THREE.Mesh(new THREE.PlaneGeometry(L, 2.2, 8, 5), fence); panel.position.set((x0 + x1) / 2, 1.25, (z0 + z1) / 2); panel.rotation.y = -Math.atan2(z1 - z0, x1 - x0); G.add(panel);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 0.08, 0.08), white); rail.position.set((x0 + x1) / 2, 2.55, (z0 + z1) / 2); rail.rotation.y = -Math.atan2(z1 - z0, x1 - x0); G.add(rail);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 70, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending })); beam.position.y = 37; G.add(beam);
  sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(signText = signLabel()), transparent: true, depthWrite: false })); sign.position.y = 4.4; sign.scale.set(5.6, 1.12, 1); G.add(sign);
  figs = [figure(0xf0f0f0, 0x111111), figure(0x1a1a1a, 0xf0f0f0)]; figs[0].position.set(-1.4, 0.12, 0); figs[1].position.set(1.4, 0.12, 0); figs[0].rotation.y = Math.PI / 2; figs[1].rotation.y = -Math.PI / 2;
  for (const f of figs) { f.visible = false; G.add(f); }
}
function teardown() { if (G) { G.parent?.remove(G); G.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose?.(); }); } G = null; figs = null; sign = null; }
function animate(now) {
  if (!G) return; const c = S.card, live = c?.phase === 'live', done = c?.phase === 'done';
  if (signLabel() !== signText) { const m = sign.material; m.map?.dispose(); m.map = labelTex(signText = signLabel()); m.needsUpdate = true; }
  const busy = !!world()?.inDuel && cageDist() < 20;
  for (const [i, f] of figs.entries()) {
    f.visible = (live || done) && !busy;
    if (!f.visible) continue; const s = i ? -1 : 1, t = now / 1000 + i * 0.7;
    if (live) { const lunge = Math.max(0, Math.sin(t * 3.1 + i * 1.9)); f.position.x = -s * (1.4 - lunge * 0.55); f.position.y = 0.12 + Math.abs(Math.sin(t * 6)) * 0.06; f.userData.arms[(Math.floor(t * 2) + i) % 2].position.z = 0.22 + lunge * 0.4; f.rotation.z = 0; }
    else { const lost = nameOf(c.winner) !== nameOf(i ? c.b : c.a); f.rotation.z = lost ? s * 1.35 : 0; f.position.y = lost ? 0.35 : 0.12; }
  }
}

// ---------- tick ----------
let lastFrame = 0, saveT = 0, near = false;
function loop() { requestAnimationFrame(loop); const now = performance.now(); if (now - lastFrame < 100) return; lastFrame = now; try { tick(now); } catch (e) { console.warn('fight tick', e); } }
function tick(now) {
  stepCard(); stepDefence(); checkBout();
  const st = app()?.state, h = here(), s = surf();
  if (!h || !st?.onSurface || st.transitioning) { if (G) teardown(); if (bout && !world()?.inDuel) { const b = bout; bout = null; if (b.stake) pay(b.stake); emit('result', { id: b.id, win: false, why: 'abandon', voided: true }); } setNear(false); renderHud(); return; }
  if (!G || G.parent !== s.scene) { teardown(); build(h); }
  animate(now);
  const i = h.info; setNear(!i.inside && (!i.driving || Math.abs(i.speed) < 4) && cageDist() < R_NEAR && !world()?.inDuel);
  renderHud(); if (panel?.classList.contains('show')) renderThrottled();
  if ((saveT += 0.1) > 5) { saveT = 0; save(); }
}

// ---------- UI (high contrast: black/white, 44px+ targets, window.__onTap) ----------
const css = `
#fcPanel{position:fixed;inset:0;z-index:61;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55)} #fcPanel.show{display:flex}
#fcPanel .wrap{width:min(500px,calc(100vw - 12px));max-height:calc(100vh - 24px - env(safe-area-inset-top));display:flex;flex-direction:column;overflow:hidden;margin:0 6px calc(8px + env(safe-area-inset-bottom));border-radius:16px;background:#000;color:#fff;border:2px solid #fff;font:14px/1.35 system-ui,sans-serif}
#fcBody{overflow-y:auto;padding:12px 14px 4px;-webkit-overflow-scrolling:touch} #fcPanel h2{margin:0 0 4px;font-size:18px} #fcPanel h3{margin:12px 0 6px;font-size:14px;letter-spacing:.04em;text-transform:uppercase}
#fcPanel .sub{margin:0 0 6px;font-size:12.5px;opacity:.92} #fcPanel .row{display:flex;gap:6px;align-items:center;justify-content:space-between;border-top:1px solid #fff4;padding:6px 0}
#fcPanel .row small{display:block;font-size:12px;opacity:.85} #fcPanel .row > div{min-width:0;flex:1} #fcPanel .row.me{background:#fff;color:#000;border-radius:8px;padding:6px 8px}
#fcPanel button{min-height:46px;min-width:56px;padding:4px 10px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 13.5px system-ui,sans-serif;touch-action:manipulation;flex:none}
#fcPanel button.main{background:#fff;color:#000} #fcPanel button:disabled{opacity:.4} #fcPanel .warn{color:#ffd400}
#fcPanel .seg{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0} #fcPanel .seg button{flex:1} #fcPanel .seg button.on{background:#fff;color:#000}
#fcPanel .msg{min-height:20px;padding:4px 14px;font-weight:700} #fcPanel .foot{display:flex;padding:8px 14px 12px} #fcPanel .foot button{flex:1}
#fcPanel .offer{border:2px solid #fff;border-radius:10px;padding:8px;margin:6px 0} #fcPanel .offer .seg button{min-width:0}
#fcAct{position:fixed;z-index:13;left:calc(10px + env(safe-area-inset-left));top:60%;display:none;min-height:52px;min-width:130px;max-width:70vw;padding:0 12px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 14px system-ui,sans-serif;touch-action:manipulation}
body.surface #fcAct.show{display:block} body.indoors #fcAct{display:none!important} body.duel #fcAct{display:none!important}
#fcHud{position:fixed;z-index:12;left:50%;transform:translateX(-50%);top:calc(112px + env(safe-area-inset-top));display:none;align-items:center;gap:8px;max-width:calc(100vw - 16px);box-sizing:border-box;padding:6px 6px 6px 12px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:700 13px/1.25 system-ui,sans-serif}
@media (max-width:640px){#fcHud{top:calc(256px + env(safe-area-inset-top));width:calc(100vw - 16px)} #fcHud .tx{flex:1}}
body.surface #fcHud.show{display:flex} body.duel #fcHud{display:none!important} #fcHud .tx{min-width:0} #fcHud .l1,#fcHud .l2{white-space:nowrap;overflow:hidden;text-overflow:ellipsis} #fcHud .warn{color:#ffd400}
#fcHud button{min-height:44px;min-width:64px;padding:0 12px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 13.5px system-ui,sans-serif;touch-action:manipulation;flex:none}
`;
let panel = null, body = null, msgEl = null, actBtn = null, hud = null, hudTx = null, lastMsg = '', lastTouch = 0, hudKey = '', pick = { style: 'bare', stake: 0, bet: 50 }, pendingOffer = null;
function tap(el, fn) { const g = e => { const n = performance.now(); if (e?.type === 'click' && n - lastTouch < 700) return; if (e?.type === 'pointerup') lastTouch = n; fn(e); }; (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, g); }
function dockButton(id, label, aria, order, fn) {
  const attach = () => { const d = document.getElementById('ssxDock'); if (!d) return false; if (document.getElementById(id)) return true;
    const b = document.createElement('button'); b.id = id; b.type = 'button'; b.textContent = label; b.setAttribute('aria-label', aria); b.style.order = String(order); d.appendChild(b); tap(b, fn); return true; };
  if (attach()) return;
  try { const mo = new MutationObserver(() => { if (attach()) mo.disconnect(); }); mo.observe(document.body, { childList: true }); } catch (e) { /* no dock button */ }
}
function ui() {
  if (panel) return; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  panel = document.createElement('div'); panel.id = 'fcPanel';
  panel.innerHTML = '<div class="wrap" role="dialog" aria-label="Rust Pit"><div id="fcBody"></div><div class="msg" id="fcMsg" aria-live="polite"></div><div class="foot"><button id="fcClose" type="button">Close</button></div></div>';
  document.body.appendChild(panel); body = panel.querySelector('#fcBody'); msgEl = panel.querySelector('#fcMsg'); tap(panel.querySelector('#fcClose'), close);
  body.addEventListener('pointerdown', () => {}, { passive: true });
  actBtn = document.createElement('button'); actBtn.id = 'fcAct'; actBtn.type = 'button'; actBtn.setAttribute('aria-label', 'Rust Pit'); document.body.appendChild(actBtn); tap(actBtn, () => open());
  hud = document.createElement('div'); hud.id = 'fcHud'; hud.innerHTML = '<div class="tx"><div class="l1"></div><div class="l2"></div></div><button id="fcHudBtn" type="button">Pit</button>'; document.body.appendChild(hud);
  hudTx = [hud.querySelector('.l1'), hud.querySelector('.l2')]; tap(hud.querySelector('.tx'), () => open()); tap(hud.querySelector('#fcHudBtn'), () => open());
  dockButton('dockFight', '🥊\nPit', 'Rust Pit (])', 8, toggle);
  addEventListener('keydown', e => {
    if (e.code !== HOTKEY || e.repeat || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    if (!app()?.state?.onSurface && !panel.classList.contains('show')) return; e.preventDefault(); toggle();
  });
}
function toggle() { panel?.classList.contains('show') ? close() : open(); }
function open() { ui(); lastMsg = ''; panel.classList.add('show'); if (document.pointerLockElement) document.exitPointerLock(); render(); }
function close() { panel?.classList.remove('show'); }
function setNear(v) { if (!actBtn) return; if (v !== near) { near = v; actBtn.textContent = `🥊 Rust Pit${isTouch() ? '' : ' (])'}`; actBtn.classList.toggle('show', !!v); } }
function say(m) { lastMsg = m || ''; if (msgEl) msgEl.textContent = lastMsg; }
function render() {
  if (!panel || !panel.classList.contains('show')) return;
  const L = ladder(), me = rankOf('you'), c = pubCard(), d = Math.round(cageDist()), champ = isChamp();
  let html = `<h2>🥊 The Rust Pit</h2><p class="sub">Chain-link cage on the Flats scrub. Sanctioned: to KO or yield. ColSec look the other way while you\u2019re in the ring.${Number.isFinite(d) && !inCage() ? ` · ${d} m away` : ''}</p>`;
  html += `<p class="sub"><b>You:</b> ${champ ? '🏆 CHAMPION' : me <= 8 ? `#${me}` : 'unranked'} · rating ${S.you.rating} · ${S.you.w}W ${S.you.l}L${S.you.defences ? ` · ${S.you.defences} defences` : ''}</p>`;
  if (S.defenceBy) html += `<p class="sub warn">⚠️ Title defence: ${esc(nameOf(S.order[1]))} is waiting. ${fmtT((S.defenceBy - Date.now()) / 1000)} or you\u2019re stripped.</p>`;
  if (pendingOffer) { const o = pendingOffer;
    html += `<div class="offer"><b>🤫 ${esc(o.gangName)} have a word</b><small style="display:block">Go down to ${esc(nameOf(o.id))} (yield or get KO\u2019d): ${o.pay} cr${o.glow ? ' + 2 Glow-dust' : ''}. Win anyway and they\u2019ll remember.</small><div class="seg"><button type="button" data-fix="take">Take the dive</button><button type="button" data-fix="refuse" class="main">Fight straight</button></div></div>`; }
  html += `<h3>Bout</h3><div class="seg" role="group" aria-label="Style">${Object.entries(STYLE).map(([k, T]) => `<button type="button" data-style="${k}" class="${pick.style === k ? 'on' : ''}">${T.icon} ${T.name}</button>`).join('')}</div>`;
  html += `<div class="seg" role="group" aria-label="Stake on yourself">${STAKES.map(s => `<button type="button" data-stake="${s}" class="${pick.stake === s ? 'on' : ''}">${s ? s + ' cr' : 'No stake'}</button>`).join('')}</div>`;
  if (!inCage()) html += `<p class="sub">Step into the cage to call a fighter out. Follow the white beam.</p>`;
  html += `<h3>The ladder</h3>`;
  for (const f of L) {
    if (f.you) { html += `<div class="row me"><div><b>${f.rank ? '#' + f.rank : '–'} You</b><small>${f.rating} · ${f.w}W ${f.l}L</small></div></div>`; continue; }
    const why = eligible(f.id), od = odds('you', f.id);
    html += `<div class="row"><div><b>${f.champ ? '🏆' : '#' + f.rank} ${esc(f.name)}</b><small>${f.rating} · ${f.w}W ${f.l}L${f.gang ? ` · ${esc(GANGS[f.gang])}` : ''} · you @ ${od.a}</small></div>${why ? '' : `<button type="button" data-ch="${f.id}" class="main" ${inCage() && !bout ? '' : 'disabled'}>Fight</button>`}</div>`;
  }
  if (c) {
    html += `<h3>Undercard</h3><p class="sub">${esc(c.nameA)} vs ${esc(c.nameB)} · ${c.phase === 'open' ? `bell in ${fmtT(c.startsIn)}` : c.phase === 'live' ? `LIVE · ${c.endsIn}s` : `${esc(nameOf(c.winner))} wins`}</p>`;
    if (c.whisper) html += `<p class="sub warn">${esc(c.whisper)}</p>`;
    if (c.phase === 'open') {
      html += `<div class="seg" role="group" aria-label="Bet size">${[25, 50, 100, 250].map(s => `<button type="button" data-bs="${s}" class="${pick.bet === s ? 'on' : ''}">${s}</button>`).join('')}</div>`;
      html += `<div class="seg"><button type="button" data-bet="${c.a}">${esc(c.nameA)} @ ${c.oddsA}</button><button type="button" data-bet="${c.b}">${esc(c.nameB)} @ ${c.oddsB}</button></div>`;
    }
    if (c.bets.length) html += `<p class="sub">Your tickets: ${c.bets.map(b => `${b.stake} on ${esc(nameOf(b.id))} @ ${b.odds}`).join(' · ')}</p>`;
  }
  body.innerHTML = html; msgEl.textContent = lastMsg;
  body.querySelectorAll('[data-style]').forEach(b => tap(b, () => { pick.style = b.dataset.style; render(); }));
  body.querySelectorAll('[data-stake]').forEach(b => tap(b, () => { pick.stake = +b.dataset.stake; render(); }));
  body.querySelectorAll('[data-bs]').forEach(b => tap(b, () => { pick.bet = +b.dataset.bs; render(); }));
  body.querySelectorAll('[data-bet]').forEach(b => tap(b, () => { say(bet(b.dataset.bet, pick.bet).msg); render(); }));
  body.querySelectorAll('[data-ch]').forEach(b => tap(b, () => doChallenge(b.dataset.ch)));
  body.querySelectorAll('[data-fix]').forEach(b => tap(b, () => { const o = pendingOffer; pendingOffer = null; if (o) doChallenge(o.id, b.dataset.fix); }));
}
function doChallenge(id, fix) {
  const r = challenge(id, { style: pick.style, stake: pick.stake, fix });
  if (r.offer) { pendingOffer = r.offer; say(r.msg); render(); return; }
  say(r.msg); if (r.ok) { close(); toast('⚔️ ' + r.msg, 2800); } else render();
}
function renderHud() {
  if (!hud) return; let l1 = null, l2 = '', warn = false;
  const c = S.card, mine = S.bets.length && c && c.phase !== 'done';
  if (S.defenceBy) { l1 = `🏆 TITLE DEFENCE · ${nameOf(S.order[1])}`; l2 = `Rust Pit · ⏱ ${fmtT((S.defenceBy - Date.now()) / 1000)}${Number.isFinite(cageDist()) ? ` · ${Math.round(cageDist())} m` : ''}`; warn = S.defenceBy - Date.now() < 120000; }
  else if (mine) { const t = S.bets.map(b => `${b.stake} on ${nameOf(b.id)} @ ${b.odds}`).join(', '); l1 = `🥊 ${nameOf(c.a)} vs ${nameOf(c.b)} · ${c.phase === 'live' ? 'LIVE' : 'bell ' + fmtT((c.at - Date.now()) / 1000)}`; l2 = `🎟️ ${t}`; }
  if (!l1) { if (hud.classList.contains('show')) { hud.classList.remove('show'); hudKey = ''; } return; }
  const k = l1 + l2 + warn; if (k !== hudKey) { hudKey = k; hudTx[0].textContent = l1; hudTx[1].textContent = l2; hudTx[0].classList.toggle('warn', warn); }
  hud.classList.add('show');
}
let panelT = 0; function renderThrottled() { const n = performance.now(); if (n - panelT > 1000) { panelT = n; render(); } }

// ---------- API ----------
function status() {
  const c = pubCard();
  return { at: [...CAGE_AT], near, inCage: inCage(), you: { rank: rankOf('you') <= 8 ? rankOf('you') : null, rating: S.you.rating, w: S.you.w, l: S.you.l, ko: S.you.ko, champ: isChamp(), defences: S.you.defences, belts: S.you.belts },
    bout: bout ? { id: bout.id, name: nameOf(bout.id), style: bout.style, stake: bout.stake, odds: bout.odds, dive: !!bout.dive, defence: bout.defence } : null, last: lastResult ? { ...lastResult } : null,
    card: c, offer: offer ? { ...offer } : null, defence: S.defenceBy ? { id: S.order[1], name: nameOf(S.order[1]), secLeft: Math.round((S.defenceBy - Date.now()) / 1000) } : isChamp() ? { nextIn: Math.round((S.defenceDue - Date.now()) / 1000) } : null,
    bets: S.bets.map(b => ({ ...b })), stats: { ...S.stats } };
}
window.SSX = window.SSX || {};
const API = {
  ladder, status, inPit: () => cageDist() < R_PIT || (!!bout && !!world()?.inDuel), odds: (a, b) => odds(a, b), challenge, bet, card: pubCard, on, open, close, fighters: FIGHTERS.map(f => ({ id: f.id, name: f.name, blurb: f.blurb, gang: f.gang })), hotkey: HOTKEY,
  debug: {
    goto() { const h = here(), s = surf(); if (!h) return false; s.debugMove(h.cx + CAGE_AT[0] + 1.5, h.cz + CAGE_AT[1] + 1, 0); return true; },
    card: (a, b, o = {}) => newCard(a, b, { sec: 60, ...o }), runCard() { if (S.card?.phase === 'open') goLive(); return pubCard(); }, resolveCard: id => resolveCard(id),
    fix(id) { offer = makeOffer(id, true); return offer && { ...offer }; },
    defence() { if (!isChamp()) return false; S.defenceDue = Date.now() - 1; S.defenceBy = 0; stepDefence(); return status().defence; },
    expire() { if (!S.defenceBy) return false; S.defenceBy = Date.now() - 1; stepDefence(); return !isChamp(); },
    setRank(n) { const i = S.order.indexOf('you'); S.order.splice(i, 1); S.order.splice(clamp(n, 1, 9) - 1, 0, 'you'); if (n === 1) { S.defenceDue = Date.now() + DEFENCE_EVERY * 1000; S.defenceBy = 0; } save(); return rankOf('you'); },
    reset() { S = fresh(); bout = null; offer = null; pendingOffer = null; save(); emit('change', { what: 'reset' }); },
    state: () => JSON.parse(JSON.stringify({ S, bout, offer, near })), get inCage() { return inCage(); }
  }
};
(function boot() {
  if (!window.SSX || !window.__app) { setTimeout(boot, 200); return; }
  window.SSX.fight = API; ui();
  try { window.SSX.registerMenuItem?.({ id: 'rmFight', label: '🥊 Rust Pit', onTap: () => open() }); } catch (e) { console.warn('fight menu', e); }
  requestAnimationFrame(loop);
})();
