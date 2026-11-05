// v7.5.34 Velvet Airlock table games (Collin: "2 more gambling games in the club" -> Blackjack + Roulette). Rules live in
// clubgamescore.js (pure); this file builds the two lobby tables (dealer NPC + hanging sign + walk-up spot) and the
// tap-to-open panel. Cards reuse poker-eval's cardFace (rank + suit symbol, hearts/diamonds red). In-game credits only:
// the stake is taken when you deal / spin, winnings are paid back through the same game credit path as poker.
// Buttons are black with white text and bound with panelTap (touch on pointerup, mouse on click, no ghost clicks).
import { panelTap } from './racehooks.js';
import { cardFace, cardLabel } from './activities/poker-eval.js';
import { grant } from './activities/poker.js';
import * as C from './clubgamescore.js';

export const BJ_TABLE = { x: -24, z: 16 }; // club room-local metres: south-west lobby, west of the door runner
export const RL_TABLE = { x: 2, z: 16 }; // south-east lobby, east of the runner, clear of the sofas at x 9.5
export const DEALERS = { blackjack: 'Rook', roulette: 'Sal' };

// ---------- the tables (interiors.js calls this while building the club; poses from interiors.js, no import cycle) ----------
export function addClubGames(api, poses = {}) {
  const { box, mat, G } = api;
  const felt = mat(0x0e5a32, { roughness: 0.95 }), wood = mat(0x2a140a, { roughness: 0.5 }), brass = mat(0xc8a040, { metalness: 0.8, roughness: 0.3 });
  const red = mat(0xb0101e), white = mat(0xf7f3ea), black = mat(0x111111);
  const cyl = (m, x, y, z, rx, h, rz) => { const o = api.mk(G.cyl, m, x, y, z, rx, h, rz); api.g.add(o); return o; };
  const dealer = (look, x, z, k) => api.person(look, x, z, 0, (h, t) => { poses.idle?.(h, t, 1); const q = (t * 0.7 + k) % 1; h.arms[1].rotation.x = 1.0 + (q < 0.3 ? Math.sin(q / 0.3 * Math.PI) * 0.35 : 0); h.arms[0].rotation.x = 0.9; }, 7 + k);
  // Blackjack: half-moon felt, dealer on the flat (north) side facing the door
  { const { x, z } = BJ_TABLE;
    cyl(wood, x, 0.36, z, 0.4, 0.72, 0.4); cyl(wood, x, 0.76, z, 1.75, 0.08, 1.05); cyl(felt, x, 0.81, z, 1.6, 0.03, 0.92);
    box(x, 0.84, z - 0.62, 0.5, 0.05, 0.3, black); // the shoe
    for (const [dx, c] of [[-0.6, red], [0, white], [0.6, red]]) box(x + dx, 0.84, z + 0.35, 0.3, 0.012, 0.42, c); // betting boxes
    api.col(x, z, 1.75, 1.05);
    dealer({ top: 0x101010, bottom: 0x101010, hair: 0xd0d0d0, hairStyle: 'short', skin: 0x7a4a2a, accent: 0xff3cc8 }, x, z - 1.45, 0); api.col(x, z - 1.45, 0.3, 0.3);
    api.sign('BLACKJACK', 0xffd040, x, 3.3, z - 2.4, 0, 3.6, { w: 768, h: 160, font: 'bold 96px system-ui, sans-serif' });
    api.sign('ROOK DEALS \u00b7 PAYS 3:2 \u00b7 10\u2013100 CR', 0xffffff, x, 2.6, z - 2.4, 0, 3.6, { h: 72 });
    api.spot({ id: 'blackjack', x, z: z + 1.9, r: 1.4, label: '\u{1F0A1} Blackjack \u00b7 10\u2013100 cr', act: 'blackjack', who: DEALERS.blackjack });
  }
  // Roulette: long felt layout, the wheel at the west end (spins slowly)
  { const { x, z } = RL_TABLE;
    box(x, 0.4, z, 3.4, 0.8, 1.5, wood); box(x + 0.45, 0.81, z, 2.3, 0.02, 1.2, felt);
    for (let i = 0; i < 3; i++) box(x - 0.15 + i * 0.6, 0.83, z - 0.1, 0.5, 0.01, 0.8, i === 1 ? black : red); // number blocks
    cyl(wood, x - 1.15, 0.86, z, 0.6, 0.1, 0.6); const wheel = cyl(red, x - 1.15, 0.93, z, 0.48, 0.04, 0.48); cyl(brass, x - 1.15, 1.0, z, 0.06, 0.14, 0.06);
    api.ticks?.push?.(t => { wheel.rotation.y = t * 0.9; });
    api.col(x, z, 1.75, 0.8);
    dealer({ top: 0x5a0a2a, bottom: 0x101010, hair: 0x101010, hairStyle: 'bun', skin: 0xe0b090, accent: 0xffd040 }, x - 0.6, z - 1.2, 1); api.col(x - 0.6, z - 1.2, 0.3, 0.3);
    api.sign('ROULETTE', 0xff3cc8, x, 3.3, z - 2.4, 0, 3.6, { w: 768, h: 160, font: 'bold 96px system-ui, sans-serif' });
    api.sign('SAL SPINS \u00b7 SINGLE ZERO \u00b7 10\u2013100 CR', 0xffffff, x, 2.6, z - 2.4, 0, 3.6, { h: 72 });
    api.spot({ id: 'roulette', x, z: z + 1.6, r: 1.4, label: '\u{1F3A1} Roulette \u00b7 10\u2013100 cr', act: 'roulette', who: DEALERS.roulette });
  }
}

// ---------- panel ----------
const CSS = `
#clubGame { position: fixed; inset: 0; z-index: 15; display: none; background: rgba(6,6,12,0.97); color: #fff; overflow-y: auto; -webkit-overflow-scrolling: touch;
  padding: calc(12px + var(--sat,0px)) calc(12px + var(--sar,0px)) calc(12px + var(--sab,0px)) calc(12px + var(--sal,0px)); box-sizing: border-box; touch-action: manipulation;
  font-family: system-ui, -apple-system, sans-serif; }
#clubGame.on { display: flex; flex-direction: column; gap: 10px; }
#clubGame .ph { display: flex; align-items: center; gap: 8px; } #clubGame .ph h2 { margin: 0; font-size: 1.1rem; flex: 1; }
#clubGame .rules { font-size: 0.78rem; opacity: 0.75; } #clubGame .log { min-height: 1.4em; text-align: center; font-weight: 700; }
#clubGame button { background: #000; color: #fff; border: 1px solid #fff; border-radius: 12px; min-height: 44px; min-width: 44px; padding: 0 12px; font-size: 0.95rem; font-weight: 800; touch-action: manipulation; }
#clubGame button:disabled { opacity: 0.4; } #clubGame button.sel { border-width: 3px; }
#clubGame .row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; } #clubGame .row button { flex: 1 1 28%; }
#clubGame .felt { background: #0e3a22; border: 1px solid #2a6a42; border-radius: 14px; padding: 10px; text-align: center; }
#clubGame .felt b { display: block; font-size: 0.85rem; margin-bottom: 6px; }
#clubGame .cards { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; min-height: 70px; }
#clubGame .card { width: 50px; height: 70px; border-radius: 8px; background: #fff; color: #111; display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-weight: 900; font-size: 1.35rem; line-height: 1; border: 1px solid #bbb; }
#clubGame .card .st { font-size: 1.55rem; margin-top: 2px; font-family: 'Apple Symbols', 'Segoe UI Symbol', system-ui, sans-serif; font-variant-emoji: text; }
#clubGame .card.red { color: #d0101e; } #clubGame .card.back { background: #3a0a2a; color: #ff9ad8; font-size: 1rem; }
#clubGame .ball { width: 84px; height: 84px; border-radius: 50%; margin: 4px auto; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; font-weight: 900; border: 3px solid #fff; }
#clubGame .ball.red { background: #c0101e; } #clubGame .ball.black { background: #111; } #clubGame .ball.green { background: #0a7a3a; }
#clubGame .hist { font-size: 0.85rem; letter-spacing: 1px; } #clubGame .hist .r { color: #ff4a5a; } #clubGame .hist .g { color: #4adf8a; }
`;
const app = () => window.__app;
const credits = () => app()?.surface?.game?.progress?.credits ?? app()?.game?.progress?.credits ?? 0;
function spend(n) {
  const g = app()?.surface?.game || app()?.game; if (!g) return false;
  if (typeof g.spend === 'function') return g.spend(n);
  const P = g.debug?.P?.(); if (!P || P.credits < n) return false; P.credits -= n; g.debug?.credits?.(0); return true;
}
const pay = n => (n > 0 ? grant(n) : false);
let el = null, game = null, rng = Math.random, bj = null, rl = { chip: 10, pick: 17, last: null, hist: [], spinning: false, net: 0 }, log = '', net = 0;
export const cardHtml = (c, hidden) => { if (hidden) return '<span class="card back">\u2726</span>'; const f = cardFace(c); return `<span class="card ${f.red ? 'red' : 'blk'}" data-card="${cardLabel(c)}"><span class="rk">${f.r}</span><span class="st">${f.s}\ufe0e</span></span>`; };
function ensure() {
  if (el) return el;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  el = document.createElement('div'); el.id = 'clubGame'; document.body.appendChild(el);
  panelTap(el, e => { const b = e.target?.closest?.('button'); if (b && !b.disabled) act(b.dataset); });
  return el;
}
function head(title) { return `<div class="ph"><h2>${title}</h2><span>\u{1F4B0} ${Math.round(credits())} cr</span><button data-a="close">\u2715 Leave</button></div>`; }
function render() {
  if (!el) return;
  if (game === 'blackjack') {
    const live = bj && !bj.done, p = bj && C.handValue(bj.player), d = bj && C.handValue(live ? bj.dealer.slice(0, 1) : bj.dealer);
    el.innerHTML = head('\u{1F0A1} Velvet Blackjack') + `<div class="rules">Rook deals. ${C.BJ_RULES}. In-game credits only.</div>
      <div class="felt"><b>Rook${bj ? ` \u00b7 ${d.total}${live ? ' + ?' : ''}` : ''}</b><div class="cards" id="bjD">${bj ? bj.dealer.map((c, i) => cardHtml(c, live && i === 1)).join('') : ''}</div></div>
      <div class="felt"><b>You${bj ? ` \u00b7 ${p.total}${p.soft && !p.bust ? ' (soft)' : ''} \u00b7 bet ${bj.staked} cr` : ''}</b><div class="cards" id="bjP">${bj ? bj.player.map(c => cardHtml(c)).join('') : ''}</div></div>
      <div class="log" id="cgLog">${log}</div>` +
      (live ? `<div class="row"><button data-a="hit">Hit</button><button data-a="stand">Stand</button><button data-a="double" ${C.bjCanDouble(bj) && credits() >= bj.bet ? '' : 'disabled'}>Double (${bj.bet})</button></div>`
        : `<div class="row">${C.BJ_BETS.map(b => `<button data-a="deal" data-bet="${b}" ${credits() >= b ? '' : 'disabled'}>Deal ${b} cr</button>`).join('')}</div>`) +
      `<div class="rules" style="text-align:center">Session: ${net >= 0 ? '+' : ''}${net} cr</div>`;
  } else {
    const n = rl.last, kinds = Object.entries(C.RL_BETS), dis = rl.spinning || credits() < rl.chip ? 'disabled' : '';
    el.innerHTML = head('\u{1F3A1} Velvet Roulette') + `<div class="rules">Sal spins. Single zero. Even bets pay 1:1, dozens 2:1, a single number 35:1. Zero loses every outside bet. In-game credits only.</div>
      <div class="felt"><div class="ball ${n == null ? 'green' : C.colorOf(n)}" id="rlBall">${n == null ? '\u2013' : n}</div>
      <div class="hist">${rl.hist.map(h => `<span class="${h === 0 ? 'g' : C.RED.has(h) ? 'r' : ''}">${h}</span>`).join(' \u00b7 ') || 'No spins yet'}</div></div>
      <div class="log" id="cgLog">${log}</div>
      <div class="row">${C.RL_CHIPS.map(c => `<button data-a="chip" data-c="${c}" class="${rl.chip === c ? 'sel' : ''}">${rl.chip === c ? '\u2713 ' : ''}${c} cr</button>`).join('')}</div>
      <div class="row">${kinds.map(([k, lab]) => `<button data-a="bet" data-k="${k}" ${dis}>${k === 'red' ? '\u{1F534} ' : k === 'black' ? '\u26AB ' : ''}${lab}</button>`).join('')}</div>
      <div class="row"><button data-a="pick" data-d="-1">\u2212</button><button data-a="bet" data-k="num" ${dis}>Number ${rl.pick} (35:1)</button><button data-a="pick" data-d="1">+</button></div>
      <div class="rules" style="text-align:center">Session: ${net >= 0 ? '+' : ''}${net} cr \u00b7 tap a bet to spin</div>`;
  }
}
function bjEnd() { if (!bj?.done) return; pay(bj.payout); net += bj.payout - bj.staked; log = `${C.BJ_SAY[bj.result]}${bj.payout ? ` +${bj.payout} cr` : ''}`; }
function act(d) {
  const a = d.a;
  if (a === 'close') return closeClubGame();
  if (game === 'blackjack') {
    if (a === 'deal') { const b = +d.bet; if (!spend(b)) { log = 'Short on cr.'; return render(); } bj = C.bjDeal(b, rng); log = 'Cards out.'; bjEnd(); }
    else if (a === 'hit') { C.bjHit(bj, rng); bjEnd(); }
    else if (a === 'stand') { C.bjStand(bj, rng); bjEnd(); }
    else if (a === 'double') { if (!C.bjCanDouble(bj) || !spend(bj.bet)) { log = 'Short on cr to double.'; return render(); } C.bjDouble(bj, rng); bjEnd(); }
    return render();
  }
  if (a === 'chip') { rl.chip = +d.c; return render(); }
  if (a === 'pick') { rl.pick = (rl.pick + +d.d + 37) % 37; return render(); }
  if (a === 'bet' && !rl.spinning) {
    const stake = rl.chip, kind = d.k, pick = rl.pick; if (!spend(stake)) { log = 'Short on cr.'; return render(); }
    const lab = kind === 'num' ? `#${pick}` : C.RL_BETS[kind]; rl.spinning = true; log = `${stake} cr on ${lab}. No more bets\u2026`; render();
    const n = C.spin(rng), quick = !!window.__clubGamesFast;
    let k = 0; const iv = setInterval(() => { const b = el?.querySelector('#rlBall'); if (b) { const f = Math.floor(Math.random() * 37); b.textContent = f; b.className = 'ball ' + C.colorOf(f); } if (++k > 8) clearInterval(iv); }, 90);
    setTimeout(() => {
      clearInterval(iv); const won = C.rlPayout(kind, stake, n, pick); pay(won); net += won - stake;
      rl.last = n; rl.hist = [n, ...rl.hist].slice(0, 10); rl.spinning = false;
      log = `${n} ${C.colorOf(n)}. ${won ? `${lab} wins +${won} cr` : `${lab} loses`}.`; render();
    }, quick ? 60 : 1000);
  }
}
export function openClubGame(kind) {
  if (kind !== 'blackjack' && kind !== 'roulette') return { ok: false, why: 'no such game' };
  if (el?.classList.contains('on')) return { ok: false, why: 'open' };
  ensure(); game = kind; bj = null; net = 0; log = kind === 'blackjack' ? 'Rook: \u201cPlace a bet, friend.\u201d' : 'Sal: \u201cPick a chip, pick a bet.\u201d';
  el.classList.add('on'); render(); return { ok: true };
}
export function closeClubGame() { if (bj && !bj.done) { C.bjStand(bj, rng); bjEnd(); } el?.classList.remove('on'); game = null; app()?.toast?.(`You leave the table ${net >= 0 ? '+' : ''}${net} cr.`, 2400); return true; }
export const clubGameOpen = () => !!el?.classList.contains('on');
if (typeof window !== 'undefined') window.__clubGames = { open: openClubGame, close: closeClubGame, isOpen: clubGameOpen, setRng: f => { rng = typeof f === 'function' ? f : Math.random; }, state: () => ({ game, bj: bj && { ...bj, p: C.handValue(bj.player).total }, rl: { ...rl }, net }), core: C };
