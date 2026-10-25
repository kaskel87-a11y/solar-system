// Static Hold'em — phone-friendly Texas Hold'em modal for act-static-poker.
// No new core hooks. Uses game credits via spend/debug.credits. Optional SSX.bark.
import { tap, panelTap } from '../racehooks.js';
import {
  freshDeck, evalBest, cmpScore, strength01, cardLabel, HAND_NAMES,
} from './poker-eval.js';

const BUYINS = [50, 150, 400];
const SMALL = 5, BIG = 10; // blinds in chips (= credits at 1:1)

const CSS = `
#pokerPanel { position: fixed; inset: 0; z-index: 15; display: none; background: rgba(6,10,18,0.97); color: #f2f6ff;
  padding: calc(12px + var(--sat,0px)) calc(12px + var(--sar,0px)) calc(12px + var(--sab,0px)) calc(12px + var(--sal,0px));
  box-sizing: border-box; overflow-y: auto; -webkit-overflow-scrolling: touch; touch-action: manipulation; }
#pokerPanel.on { display: flex; flex-direction: column; }
#pokerPanel .ph { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
#pokerPanel .ph h2 { margin: 0; font-size: 1.05rem; flex: 1; }
#pokerPanel .ph .cash { font-size: 0.85rem; opacity: 0.85; }
#pokerPanel .close, #pokerPanel .ghost { min-height: 44px; min-width: 44px; border-radius: 12px; font-weight: 800; color: #fff;
  background: rgba(40,56,96,0.95); border: 1px solid rgba(120,160,255,0.35); padding: 0 12px; font-size: 0.85rem; touch-action: none; }
#pokerPanel .table { flex: 1; display: flex; flex-direction: column; gap: 8px; justify-content: space-between; min-height: 0; }
#pokerPanel .seats { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
#pokerPanel .seat { flex: 1 1 40%; min-width: 120px; max-width: 180px; padding: 8px 10px; border-radius: 12px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); font-size: 0.78rem; }
#pokerPanel .seat.me { border-color: rgba(100,200,255,0.55); background: rgba(40,80,140,0.35); }
#pokerPanel .seat.fold { opacity: 0.45; } #pokerPanel .seat.turn { box-shadow: 0 0 0 2px #7ad0ff; }
#pokerPanel .seat b { display: block; font-size: 0.88rem; }
#pokerPanel .board { text-align: center; padding: 10px 8px; border-radius: 14px; background: rgba(20,80,40,0.35);
  border: 1px solid rgba(80,180,100,0.35); min-height: 64px; }
#pokerPanel .board .pot { font-size: 0.9rem; margin-bottom: 4px; opacity: 0.9; }
#pokerPanel .cards { display: flex; gap: 5px; justify-content: center; flex-wrap: wrap; }
#pokerPanel .card { width: 42px; height: 58px; border-radius: 7px; background: #f7f3ea; color: #111; display: flex; align-items: center;
  justify-content: center; font-weight: 900; font-size: 0.95rem; border: 1px solid #ccc; }
#pokerPanel .card.red { color: #c0182a; } #pokerPanel .card.back { background: #1a3a6a; color: #9cf; border-color: #2a5080; font-size: 0.7rem; }
#pokerPanel .log { font-size: 0.72rem; opacity: 0.75; min-height: 1.4em; text-align: center; padding: 0 4px; }
#pokerPanel .actions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; padding-top: 6px; }
#pokerPanel .actions button { min-height: 56px; border-radius: 14px; font-weight: 900; font-size: 0.95rem; color: #fff;
  border: 1px solid rgba(255,255,255,0.25); touch-action: none; }
#pokerPanel .actions .fold { background: linear-gradient(135deg, #6a2030, #a03040); }
#pokerPanel .actions .call { background: linear-gradient(135deg, #204a30, #2a8a50); }
#pokerPanel .actions .raise { background: linear-gradient(135deg, #2a4080, #4060c0); }
#pokerPanel .actions button:disabled { opacity: 0.35; }
#pokerPanel .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
#pokerPanel .row2 button { min-height: 48px; border-radius: 12px; font-weight: 800; color: #fff;
  background: rgba(40,56,96,0.95); border: 1px solid rgba(120,160,255,0.35); touch-action: none; font-size: 0.82rem; }
#pokerPanel .buyin { display: flex; flex-direction: column; gap: 10px; max-width: 360px; margin: 24px auto; text-align: center; }
#pokerPanel .buyin button.go { min-height: 52px; border-radius: 14px; font-weight: 900; font-size: 0.95rem; color: #fff;
  background: linear-gradient(135deg, rgba(60,200,255,0.95), rgba(80,120,255,0.95)); border: none; touch-action: none; }
#pokerPanel .buyin .hint { opacity: 0.7; font-size: 0.8rem; }
`;

let panel = null, G = null, onClose = null, rng = Math.random;

function ssx() { return typeof window !== 'undefined' ? window.SSX : null; }
function app() { return typeof window !== 'undefined' ? window.__app : null; }
function toast(m, ms = 2400) { app()?.toast?.(m, ms); }

/** Feature-detect Pumpkin SSX.bark — no-op when missing. */
export function tryBark(npc, categoryOrText, opts) {
  const b = ssx()?.bark;
  if (typeof b !== 'function') return false;
  try { b(npc, categoryOrText, opts); return true; } catch (e) { return false; }
}

function credits() { return app()?.surface?.game?.progress?.credits ?? app()?.game?.progress?.credits ?? 0; }
function spend(n) {
  const g = app()?.surface?.game || app()?.game;
  if (!g) return false;
  if (typeof g.spend === 'function') return g.spend(n);
  const P = g.debug?.P?.(); if (!P || P.credits < n) return false;
  P.credits -= n; g.debug?.credits?.(0); return true;
}
function grant(n) { app()?.surface?.game?.debug?.credits?.(n) || app()?.game?.debug?.credits?.(n); }

function ensurePanel() {
  if (panel) return panel;
  if (!document.getElementById('pokerCss')) {
    const st = document.createElement('style'); st.id = 'pokerCss'; st.textContent = CSS; document.head.appendChild(st);
  }
  panel = document.createElement('div'); panel.id = 'pokerPanel'; panel.setAttribute('role', 'dialog');
  document.body.appendChild(panel);
  return panel;
}

function cardHtml(c, hidden = false) {
  if (hidden || c == null) return `<span class="card back">?</span>`;
  const lab = cardLabel(c), red = lab[1] === 'h' || lab[1] === 'd';
  return `<span class="card${red ? ' red' : ''}">${lab[0]}<small>${lab[1]}</small></span>`;
}

function isMobile() {
  return !!(document.body.classList.contains('touch') || (typeof window !== 'undefined' && window.matchMedia?.('(pointer:coarse)').matches));
}

function makePlayers(buyIn, nAi) {
  const names = ['Brick', 'Nyx', 'Pixel', 'Marrow', 'Vale'];
  const me = { id: 'you', name: 'You', chips: buyIn, hole: [], bet: 0, folded: false, allIn: false, human: true };
  const ais = [];
  for (let i = 0; i < nAi; i++) {
    ais.push({
      id: 'ai' + i, name: names[i % names.length], chips: buyIn, hole: [], bet: 0, folded: false, allIn: false, human: false,
      style: 0.35 + rng() * 0.4, // aggression
    });
  }
  return [me, ...ais];
}

function living(players) { return players.filter(p => !p.folded && p.chips + p.bet > 0); }
function active(players) { return players.filter(p => !p.folded && !p.allIn); }

function openBuyIn(ctx) {
  const el = ensurePanel();
  const cr = credits();
  el.innerHTML = `<div class="ph"><h2>🃏 Static Hold'em</h2><button class="close" data-x="1">✕</button></div>
    <div class="buyin">
      <div class="hint">Nyx's VIP back room. Fiction chips, real credits. Guns stay holstered.<br>Your wallet: <b>${cr}</b> cr</div>
      ${BUYINS.map(b => `<button class="go" data-buy="${b}" ${cr < b ? 'disabled' : ''}>Buy in ${b} cr</button>`).join('')}
      <button class="ghost" data-x="1">Walk away</button>
      <div class="hint">Tip the dealer mid-hand for a peek (costs credits). Get caught and Brick invents stairs.</div>
    </div>`;
  el.classList.add('on');
  document.body.classList.add('poker-open');
  const on = e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.x) { closeTable('Walked away.'); return; }
    const buy = +t.dataset.buy; if (!buy) return;
    if (!spend(buy)) { toast('Short on credits.'); return; }
    startTable(buy, ctx);
  };
  panelTap(el, on);
  tryBark({ name: 'Nyx', kind: 'contact' }, 'poker_offer') || tryBark({ name: 'Nyx' }, "VIP table. Ante's up. Don't make Brick invent stairs.");
}

function startTable(buyIn, ctx) {
  const nAi = isMobile() ? 2 : 3;
  G = {
    buyIn, players: makePlayers(buyIn, nAi), deck: [], board: [], pot: 0, street: 'preflop',
    toAct: 0, dealer: 0, currentBet: 0, minRaise: BIG, hand: 0, maxHands: 4,
    log: '', cheated: false, tipUsed: false, ctx, closed: false,
  };
  tryBark({ name: 'Nyx' }, 'poker_start');
  newHand();
}

function newHand() {
  if (!G || G.closed) return;
  G.hand++;
  if (G.hand > G.maxHands) { cashOut(true); return; }
  const broke = G.players.filter(p => p.chips < BIG);
  for (const p of broke) { if (!p.human) p.chips = 0; }
  if (G.players[0].chips < BIG) { G.log = 'You can’t cover the blind.'; render(); setTimeout(() => cashOut(false), 900); return; }
  const seated = G.players.filter(p => p.chips >= BIG || p.human);
  if (seated.filter(p => !p.human && p.chips >= BIG).length < 1) { G.log = 'Table folded. Cash out.'; render(); setTimeout(() => cashOut(true), 800); return; }

  G.deck = freshDeck(rng);
  G.board = [];
  G.pot = 0;
  G.street = 'preflop';
  G.currentBet = 0;
  G.minRaise = BIG;
  G.tipUsed = false;
  G.dealer = (G.dealer + 1) % G.players.length;
  for (const p of G.players) {
    p.hole = []; p.bet = 0; p.folded = p.chips < BIG && !p.human; p.allIn = false;
    if (p.chips <= 0 && !p.human) p.folded = true;
  }
  // deal
  for (const p of G.players) if (!p.folded) { p.hole = [G.deck.pop(), G.deck.pop()]; }
  // blinds
  const order = actOrder(true);
  const sb = order[0], bb = order[1] || order[0];
  postBlind(sb, SMALL);
  postBlind(bb, BIG);
  G.currentBet = BIG;
  G.toAct = order[2] ? G.players.indexOf(order[2]) : G.players.indexOf(sb);
  G.acted = new Set();
  G.log = `Hand ${G.hand}/${G.maxHands} · blinds ${SMALL}/${BIG}`;
  render();
  maybeAi();
}

function postBlind(p, amt) {
  const pay = Math.min(p.chips, amt);
  p.chips -= pay; p.bet += pay; G.pot += pay;
  if (p.chips === 0) p.allIn = true;
}

function actOrder(fromDealer = false) {
  const n = G.players.length;
  const start = (G.dealer + (fromDealer ? 1 : 1)) % n;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = G.players[(start + i) % n];
    if (!p.folded && (p.chips > 0 || p.bet > 0)) out.push(p);
  }
  return out;
}

function toCall(p) { return Math.max(0, G.currentBet - p.bet); }

function markActed(p) { (G.acted ||= new Set()).add(p.id); }
function doFold(p) {
  p.folded = true; markActed(p);
  G.log = `${p.name} folds.`;
  tryBark({ name: p.name }, p.human ? 'poker_fold' : 'poker_ai_fold');
  afterAction();
}
function doCall(p) {
  const need = toCall(p);
  const pay = Math.min(p.chips, need);
  p.chips -= pay; p.bet += pay; G.pot += pay;
  if (p.chips === 0) p.allIn = true; markActed(p);
  G.log = need === 0 ? `${p.name} checks.` : `${p.name} calls ${pay}.`;
  afterAction();
}
function doRaise(p, toTotal) {
  const target = Math.max(G.currentBet + G.minRaise, toTotal);
  const need = Math.min(p.chips, target - p.bet);
  if (need <= 0) return doCall(p);
  p.chips -= need; p.bet += need; G.pot += need;
  const raised = p.bet - G.currentBet;
  if (raised > 0) { G.minRaise = Math.max(G.minRaise, raised); G.currentBet = p.bet; }
  if (p.chips === 0) p.allIn = true; markActed(p);
  // Raising re-opens action
  G.acted = new Set([p.id]);
  G.log = `${p.name} raises to ${p.bet}.`;
  afterAction();
}

function afterAction() {
  const alive = G.players.filter(p => !p.folded);
  if (alive.length === 1) { win(alive, 'everyone else folded'); return; }
  // advance toAct
  const n = G.players.length;
  let next = -1;
  for (let i = 1; i <= n; i++) {
    const j = (G.toAct + i) % n;
    const p = G.players[j];
    if (!p.folded && !p.allIn) { next = j; break; }
  }
  // betting round done when all active matched currentBet
  const contenders = G.players.filter(p => !p.folded && !p.allIn);
  const matched = contenders.every(p => p.bet === G.currentBet) || contenders.length === 0;
  // Also need everyone to have acted at least once this street — track via all matched after a full orbit
  if (matched && contenders.length <= 1 && G.players.filter(p => !p.folded && p.chips > 0).every(p => p.bet === G.currentBet || p.allIn || p.folded)) {
    // if only one can still bet, go to showdown path via streets
  }
  if (matched && streetSettled()) {
    nextStreet();
    return;
  }
  if (next < 0) { nextStreet(); return; }
  G.toAct = next;
  render();
  maybeAi();
}

function streetSettled() {
  const needAct = G.players.filter(p => !p.folded && !p.allIn);
  if (!needAct.length) return true;
  const acted = G.acted || new Set();
  return needAct.every(p => p.bet === G.currentBet && acted.has(p.id));
}

function nextStreet() {
  // pull bets into pot already tracked; reset street bets
  for (const p of G.players) p.bet = 0;
  G.currentBet = 0;
  G.minRaise = BIG;
  if (G.street === 'preflop') {
    G.street = 'flop';
    G.board.push(G.deck.pop(), G.deck.pop(), G.deck.pop());
    G.log = 'Flop.';
  } else if (G.street === 'flop') {
    G.street = 'turn'; G.board.push(G.deck.pop()); G.log = 'Turn.';
  } else if (G.street === 'turn') {
    G.street = 'river'; G.board.push(G.deck.pop()); G.log = 'River.';
  } else {
    showdown(); return;
  }
  // first to act = left of dealer
  const order = actOrder(true);
  G.toAct = order.length ? G.players.indexOf(order[0]) : 0;
  G.acted = new Set();
  render();
  maybeAi();
}

function showdown() {
  const alive = G.players.filter(p => !p.folded);
  const scored = alive.map(p => ({ p, ...evalBest([...p.hole, ...G.board]) }));
  scored.sort((a, b) => cmpScore(b.score, a.score));
  const best = scored[0].score;
  const winners = scored.filter(s => cmpScore(s.score, best) === 0).map(s => s.p);
  const names = winners.map(w => `${w.name} (${evalBest([...w.hole, ...G.board]).name})`).join(', ');
  G.log = `Showdown: ${names}`;
  win(winners, null);
}

function win(winners, why) {
  const share = Math.floor(G.pot / winners.length);
  let rem = G.pot - share * winners.length;
  for (const w of winners) { w.chips += share + (rem > 0 ? 1 : 0); if (rem > 0) rem--; }
  G.pot = 0;
  if (why) G.log = `${winners.map(w => w.name).join(' & ')} wins (${why}).`;
  tryBark({ name: winners[0]?.name || 'Nyx' }, winners.some(w => w.human) ? 'poker_win' : 'poker_lose');
  render(true);
  setTimeout(() => { if (G && !G.closed) newHand(); }, 1400);
}

function maybeAi() {
  if (!G || G.closed) return;
  const p = G.players[G.toAct];
  if (!p || p.human || p.folded || p.allIn) return;
  setTimeout(() => aiAct(p), 380 + rng() * 420);
}

function aiAct(p) {
  if (!G || G.closed || G.players[G.toAct] !== p) return;
  const need = toCall(p);
  let str = 0.35;
  try {
    const known = G.board.length >= 3 ? evalBest([...p.hole, ...G.board]) : null;
    if (known) str = strength01(known.score);
    else {
      // preflop: pair / high cards
      const [a, b] = p.hole;
      const ra = a >> 2, rb = b >> 2;
      str = 0.2 + Math.max(ra, rb) / 30 + (ra === rb ? 0.35 : 0) + ((a & 3) === (b & 3) ? 0.08 : 0);
    }
  } catch (e) {}
  const bluff = rng() < 0.12 * p.style;
  const wantRaise = str > 0.62 || bluff;
  const wantFold = str < 0.28 && need > 0 && !bluff;
  if (wantFold && need >= BIG) return doFold(p);
  if (wantRaise && p.chips > need) {
    const to = G.currentBet + Math.max(G.minRaise, BIG * (1 + Math.floor(str * 3)));
    return doRaise(p, Math.min(p.bet + p.chips, to));
  }
  return doCall(p);
}

function humanFold() { const p = G.players[0]; if (G.players[G.toAct] !== p) return; doFold(p); }
function humanCall() { const p = G.players[0]; if (G.players[G.toAct] !== p) return; doCall(p); }
function humanRaise() {
  const p = G.players[0]; if (G.players[G.toAct] !== p) return;
  const to = G.currentBet + Math.max(G.minRaise, BIG * 2);
  doRaise(p, to);
}

function tipDealer() {
  if (!G || G.tipUsed || G.board.length < 3) { toast('Dealer shrugs. Tip after the flop.'); return; }
  const cost = 25;
  if (!spend(cost)) { toast('Short for a tip.'); return; }
  G.tipUsed = true;
  // Peek: show one opponent's hole briefly in log; chance of getting caught
  const foe = G.players.find(p => !p.human && !p.folded);
  if (foe) {
    G.log = `Dealer coughs: ${foe.name} holds ${cardLabel(foe.hole[0])} ${cardLabel(foe.hole[1])}.`;
    G.cheated = true;
  }
  const caught = rng() < 0.28;
  if (caught) {
    G.log += ' Brick saw that.';
    tryBark({ name: 'Brick', kind: 'bouncer' }, 'poker_cheat_caught') || tryBark({ name: 'Brick' }, 'Cheat. Stairs time.');
    const world = app()?.surface?.world;
    world?.setWanted?.(2, 'cheating at Static Hold\'em');
    world?.crime?.(2, 'cheating at cards');
    // Spawn a couple of "bouncers" if aliens API exists (stand-in)
    app()?.surface?.game?.debug?.spawn?.('crawler', 6, 0.4, true);
    app()?.surface?.game?.debug?.spawn?.('crawler', 6, -0.4, true);
    toast('🚨 Caught cheating. Bouncers inbound.');
    render();
    setTimeout(() => cashOut(false, true), 700);
    return;
  }
  tryBark({ name: 'Nyx' }, 'poker_tip');
  render();
}

function cashOut(voluntary = true, banned = false) {
  if (!G || G.closed) return;
  G.closed = true;
  const me = G.players[0];
  const chips = Math.max(0, me.chips | 0);
  if (chips > 0) grant(chips);
  const delta = chips - G.buyIn;
  const msg = banned ? `Banned. Cashed ${chips} cr.`
    : voluntary ? (delta >= 0 ? `Nyx: Stack's yours. +${delta} cr.` : `Nyx: Broke-ish. ${chips} cr back.`)
    : `Cashed ${chips} cr.`;
  toast(msg);
  tryBark({ name: 'Nyx' }, delta >= 0 ? 'poker_cashout_win' : 'poker_cashout_lose');
  const cb = onClose;
  closeTable(null, true);
  cb?.({ ok: true, credits: chips, delta, banned });
}

function closeTable(why, silent = false) {
  if (why && !silent) toast(why);
  G = null;
  if (panel) { panel.classList.remove('on'); panel.innerHTML = ''; panel.__ptap = null; }
  document.body.classList.remove('poker-open');
}

function render(showdown = false) {
  if (!G) return;
  const el = ensurePanel();
  const me = G.players[0];
  const myTurn = G.players[G.toAct] === me && !me.folded && !G.closed;
  const need = toCall(me);
  const seats = G.players.map((p, i) => {
    const hole = p.human || showdown || (G.cheated && G.tipUsed && !p.human && G.log.includes(p.name))
      ? p.hole.map(c => cardHtml(c)).join('')
      : p.folded ? '' : cardHtml(null, true) + cardHtml(null, true);
    return `<div class="seat${p.human ? ' me' : ''}${p.folded ? ' fold' : ''}${i === G.toAct ? ' turn' : ''}">
      <b>${p.name}${p.human ? ' (you)' : ''}</b>
      ${p.chips} cr${p.bet ? ` · bet ${p.bet}` : ''}${p.folded ? ' · folded' : ''}${p.allIn ? ' · all-in' : ''}
      <div class="cards">${hole}</div></div>`;
  }).join('');
  el.innerHTML = `<div class="ph"><h2>🃏 Static Hold'em</h2>
    <span class="cash">Pot ${G.pot} · You ${me.chips}</span>
    <button class="close" data-cash="1">Cash out</button></div>
    <div class="table">
      <div class="seats">${seats}</div>
      <div class="board"><div class="pot">${G.street.toUpperCase()} · Hand ${G.hand}/${G.maxHands}</div>
        <div class="cards">${G.board.map(c => cardHtml(c)).join('') || '<span class="hint">Waiting for flop…</span>'}</div></div>
      <div class="log">${G.log || ''}</div>
      <div class="actions">
        <button class="fold" data-fold="1" ${myTurn ? '' : 'disabled'}>Fold</button>
        <button class="call" data-call="1" ${myTurn ? '' : 'disabled'}>${need ? 'Call ' + need : 'Check'}</button>
        <button class="raise" data-raise="1" ${myTurn && me.chips > need ? '' : 'disabled'}>Raise</button>
      </div>
      <div class="row2">
        <button data-tip="1">Tip dealer (25)</button>
        <button data-cash="1">Cash out</button>
      </div>
    </div>`;
  el.classList.add('on');
  panelTap(el, e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.cash) { cashOut(true); return; }
    if (t.dataset.fold) { humanFold(); return; }
    if (t.dataset.call) { humanCall(); return; }
    if (t.dataset.raise) { humanRaise(); return; }
    if (t.dataset.tip) { tipDealer(); return; }
  });
}

/** Open the Hold'em modal. opts.onClose({ok, credits, delta, banned}) */
export function openPokerTable(opts = {}) {
  onClose = opts.onClose || null;
  if (typeof opts.rng === 'function') rng = opts.rng;
  openBuyIn(opts.ctx || null);
  return { ok: true };
}

export function closePokerTable(why) { closeTable(why || 'Closed.'); }
export function closePoker(why) { closeTable(why || 'Left the table.'); }
export function pokerIsOpen() { return !!(G && panel?.classList.contains('on')); }

export function pokerState() {
  if (!G) return null;
  return {
    hand: G.hand, street: G.street, pot: G.pot, toAct: G.toAct,
    players: G.players.map(p => ({ name: p.name, chips: p.chips, folded: p.folded, human: p.human, bet: p.bet })),
    board: G.board.map(cardLabel),
  };
}

// Debug
if (typeof window !== 'undefined') {
  window.__poker = { open: openPokerTable, close: closePokerTable, state: pokerState, eval: () => import('./poker-eval.js') };
}
