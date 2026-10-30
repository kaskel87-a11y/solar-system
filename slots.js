// v7.6 Velvet Airlock slot machines ("Red Planet Slots"). Two grimy cabinets in the club's south-west corner, by the
// bar end and well away from the poles, Danny's private stage, the VIP room and the upstairs door. Walk up: the action
// button reads '🎰 Play' (black, white text; E on desktop) and opens a 3-reel slot with Mars symbols, bets of 10 / 50 /
// 200 in-game cr, a payout table and big flashing wins. In-game credits only; nothing here touches real money.
// Odds: every reel is the same weighted strip (SLOTS.reel). The paytable is a multiple of the bet, so the return is the
// same at every bet: exactly 103.66 % over the long run (slightly in the player's favour, by design: Collin's always broke).
// Jackpot: three 🌋 Olympus Mons pays 25x the bet = 5,000 cr at the 200 bet (1,250 at 50, 250 at 10; see JACKPOT_AT),
// about 1 spin in 3,049. Tune everything in SLOTS; tests/test-slots-unit.mjs checks the RTP stays in 102-105 %.
// Hooks (both guarded, so a failure here never breaks the club): interiors.js calls addSlotMachines(api, ...) while
// building the club; index.html calls clubSlots(...) once and routes the 'slots' hotspot to slots.open(spot).

export const BETS = [10, 50, 200];
export const SLOTS = {
  // one reel strip, used for all three reels: weight = how many stops of the 29 show that symbol
  reel: [
    { id: 'dust', icon: '🌪️', name: 'Dust devil', w: 7 },
    { id: 'meteor', icon: '☄️', name: 'Meteor', w: 6 },
    { id: 'red', icon: '🔴', name: 'Red planet', w: 5 },
    { id: 'rover', icon: '🚙', name: 'Rover', w: 4 },
    { id: 'rocket', icon: '🚀', name: 'Rocket', w: 3 },
    { id: 'alien', icon: '👽', name: 'Alien', w: 2 },
    { id: 'olympus', icon: '🌋', name: 'Olympus Mons', w: 2 },
  ],
  three: { olympus: 25, alien: 20, rocket: 15, rover: 12, red: 11, meteor: 9, dust: 6 }, // x bet for three of a kind
  twoOlympus: 8, // any two 🌋 (not three)
  twoRed: 4, // any two 🔴 (not three)
  oneRed: 1, // any single 🔴: your bet back
  jackpot: 'olympus',
  big: 10, // a win of at least this many times the bet gets the full flashing / shaking treatment
};
export const JACKPOT_AT = Object.fromEntries(BETS.map(b => [b, b * SLOTS.three[SLOTS.jackpot]])); // { 10: 250, 50: 1250, 200: 5000 }
const SYM = Object.fromEntries(SLOTS.reel.map(s => [s.id, s]));
const TOTAL = SLOTS.reel.reduce((a, s) => a + s.w, 0);

// small seeded RNG (tests); the game itself uses Math.random
export function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function stop(rng = Math.random) { let r = rng() * TOTAL; for (const s of SLOTS.reel) { if ((r -= s.w) < 0) return s.id; } return SLOTS.reel[SLOTS.reel.length - 1].id; }
export function spinReels(rng = Math.random) { return [stop(rng), stop(rng), stop(rng)]; }
// what a line of three pays, as a multiple of the bet
export function multOf(reels) {
  const [a, b, c] = reels, n = id => reels.filter(x => x === id).length;
  if (a === b && b === c) return { mult: SLOTS.three[a] || 0, kind: a === SLOTS.jackpot ? 'jackpot' : 'three' };
  if (n(SLOTS.jackpot) === 2) return { mult: SLOTS.twoOlympus, kind: 'two' };
  if (n('red') === 2) return { mult: SLOTS.twoRed, kind: 'two' };
  if (n('red') === 1) return { mult: SLOTS.oneRed, kind: 'one' };
  return { mult: 0, kind: 'none' };
}
export function payout(reels, bet) { const m = multOf(reels); return { ...m, win: Math.round(m.mult * bet), big: m.mult >= SLOTS.big }; }
export function spin(bet, rng = Math.random) { const reels = spinReels(rng); return { reels, bet, ...payout(reels, bet) }; }
// the exact long-run return (sum over all 29^3 lines), plus hit rate and jackpot odds
export function exactOdds() {
  let rtp = 0, hit = 0, jp = 0;
  for (const a of SLOTS.reel) for (const b of SLOTS.reel) for (const c of SLOTS.reel) {
    const p = a.w * b.w * c.w / TOTAL ** 3, m = multOf([a.id, b.id, c.id]); rtp += p * m.mult; if (m.mult > 0) hit += p; if (m.kind === 'jackpot') jp += p;
  }
  return { rtp, hit, jackpotOneIn: 1 / jp };
}
export function paytable() {
  const t = Object.entries(SLOTS.three).sort((x, y) => y[1] - x[1]).map(([id, m]) => ({ icons: SYM[id].icon.repeat(3), mult: m, jackpot: id === SLOTS.jackpot }));
  return [...t, { icons: SYM[SLOTS.jackpot].icon.repeat(2) + ' any', mult: SLOTS.twoOlympus }, { icons: SYM.red.icon.repeat(2) + ' any', mult: SLOTS.twoRed }, { icons: SYM.red.icon + ' any', mult: SLOTS.oneRed }];
}

// ---------- interiors.js (club build): two grimy cabinets against a wall, one hotspot, colliders ----------
// x, z: the middle of the pair (room-local); the screens face -z (into the room) unless face = 1
export function addSlotMachines(api, { x = -7.7, z = 7.6, face = -1, gap = 1.25 } = {}) {
  const { box, mat } = api, out = face; // front face is at z + out * depth/2
  const body = mat(0x2b2724, { roughness: 0.85, metalness: 0.45 }), rust = mat(0x5a3418, { roughness: 1 }), grime = mat(0x16130f, { roughness: 1 });
  const chrome = mat(0xb8bcc4, { metalness: 0.9, roughness: 0.35 }), glass = mat(0x0a0a10, { roughness: 0.2, metalness: 0.3 });
  const marq = [mat(0xff3cc8, { basic: true }), mat(0xffd040, { basic: true })], lit = mat(0xfff0c0, { basic: true }), red = mat(0xd0201a, { roughness: 0.4 });
  const bulbs = [];
  for (const s of [-1, 1]) {
    const cx = x + s * gap / 2, D = 0.7, fz = z + out * D / 2;
    box(cx, 0.45, z, 0.9, 0.9, D, body); // base
    box(cx, 1.35, z - out * 0.05, 0.86, 0.9, D - 0.1, body); // screen housing
    box(cx, 1.98, z - out * 0.02, 0.92, 0.38, D - 0.04, grime); // marquee box
    box(cx, 1.98, fz + out * 0.005, 0.8, 0.26, 0.02, marq[s < 0 ? 0 : 1]); // marquee glow
    box(cx, 1.35, fz - out * 0.04, 0.72, 0.5, 0.02, glass); // screen
    for (let i = 0; i < 3; i++) box(cx + (i - 1) * 0.22, 1.35, fz - out * 0.03, 0.18, 0.36, 0.01, lit); // reel windows
    box(cx, 1.35, fz - out * 0.025, 0.72, 0.03, 0.01, mat(0xff2a2a, { basic: true })); // pay line
    box(cx, 0.86, fz + out * 0.08, 0.86, 0.06, 0.24, chrome); // button deck
    for (let i = 0; i < 3; i++) box(cx - 0.22 + i * 0.22, 0.9, fz + out * 0.1, 0.12, 0.03, 0.08, mat([0xff3030, 0x30ff60, 0xffd040][i], { basic: true }));
    box(cx, 0.32, fz + out * 0.04, 0.5, 0.12, 0.1, chrome); // coin tray
    box(cx + 0.47, 1.25, z, 0.04, 0.5, 0.06, chrome); box(cx + 0.5, 1.55, z, 0.05, 0.6, 0.05, chrome); // lever
    api.mk && api.G?.sph && api.g.add(api.mk(api.G.sph, red, cx + 0.5, 1.88, z, 0.07));
    // grime: rust streaks, a dented kick plate, a sticker
    box(cx - 0.3, 0.55, fz + out * 0.005, 0.12, 0.5, 0.01, rust); box(cx + 0.25, 0.1, fz + out * 0.005, 0.6, 0.14, 0.01, grime); box(cx + 0.28, 0.62, fz + out * 0.006, 0.14, 0.1, 0.01, mat(0xc8c0a0, { roughness: 1 }));
    for (let i = 0; i < 6; i++) bulbs.push(box(cx - 0.4 + i * 0.16, 2.2, fz + out * 0.01, 0.05, 0.05, 0.05, marq[(i + (s < 0 ? 0 : 1)) % 2]));
    api.col(cx, z, 0.48, D / 2 + 0.05);
  }
  api.sign('SLOTS', 0xffd040, x, 2.95, z - out * 0.3, out < 0 ? Math.PI : 0, 1.8, { w: 256, h: 64, font: 'bold 50px system-ui, sans-serif' });
  api.sign('LOOSEST SLOTS ON MARS', 0xff3cc8, x, 2.5, z - out * 0.3, out < 0 ? Math.PI : 0, 2.2, { w: 512, h: 128, font: 'bold 52px system-ui, sans-serif' });
  api.ticks.push(t => { const k = Math.floor(t * 4); for (let i = 0; i < bulbs.length; i++) bulbs[i].visible = ((i + k) % 3) !== 0; });
  return api.spot({ id: 'slots', x, z: z + out * 1.15, r: 1.35, label: '🎰 Play', act: 'slots' });
}

// ---------- the slot overlay (index.html) ----------
const CSS = `
body.slNear #driveBtn{background:#000!important;color:#fff!important;border:1.5px solid #fff!important}
#slPanel{position:fixed;inset:0;z-index:58;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.66);touch-action:manipulation}
#slPanel.on{display:flex}
#slCard{position:relative;width:min(400px,calc(100vw - 20px));max-height:calc(100dvh - 16px);overflow-y:auto;box-sizing:border-box;padding:12px;border-radius:16px;background:#000;color:#fff;border:1.5px solid #ff3cc8;box-shadow:0 0 24px rgba(255,60,200,.45);font:14px/1.35 system-ui,sans-serif;-webkit-user-select:none;user-select:none}
#slCard .hd{display:flex;align-items:center;gap:8px} #slCard .hd b{flex:1;font-size:16px;letter-spacing:.04em;color:#ffd040}
#slCash{font-weight:700;font-variant-numeric:tabular-nums}
#slReels{display:flex;gap:8px;margin:10px 0 6px;padding:8px;border-radius:12px;background:#140c18;border:1px solid #3a2440;position:relative}
#slReels::after{content:'';position:absolute;left:6px;right:6px;top:50%;height:2px;background:rgba(255,42,42,.6)}
.slReel{flex:1;height:78px;display:flex;align-items:center;justify-content:center;font-size:46px;border-radius:8px;background:linear-gradient(#ddd4c0,#fff8e8 45%,#fff8e8 55%,#cfc6b0);color:#000;overflow:hidden}
.slReel.spin{filter:blur(1.5px);animation:slRoll .09s linear infinite}
@keyframes slRoll{0%{transform:translateY(-6px)}100%{transform:translateY(6px)}}
#slMsg{min-height:44px;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:700;font-size:15px;border-radius:10px;padding:2px 8px}
#slMsg.win{color:#3cff8a} #slMsg.lose{color:#bbb;font-weight:500} #slMsg.broke{color:#ff7a7a}
#slMsg.big{font-size:22px;color:#000;animation:slFlash .18s steps(2) infinite}
@keyframes slFlash{0%{background:#ffd040}50%{background:#ff3cc8}100%{background:#7af0ff}}
#slCard.shake{animation:slShake .45s linear 2}
@keyframes slShake{0%,100%{transform:translate(0,0)}20%{transform:translate(-7px,3px) rotate(-1deg)}40%{transform:translate(6px,-4px) rotate(1deg)}60%{transform:translate(-5px,-2px)}80%{transform:translate(5px,3px)}}
#slCard .r{display:flex;gap:8px;margin-top:8px}
.slBtn{flex:1;min-height:46px;border-radius:10px;border:1.5px solid #fff;background:#000;color:#fff;font:700 15px system-ui,sans-serif;touch-action:manipulation}
.slBtn:active,.slBtn.on{background:#fff;color:#000}
.slBtn.sel{background:#ffd040;color:#000;border-color:#ffd040}
#slSpin{flex:2;background:#ff3cc8;border-color:#ff3cc8;color:#fff;font-size:17px} #slSpin:disabled{opacity:.55}
#slClose{flex:0 0 44px;min-width:44px;min-height:44px}
#slPay{display:grid;grid-template-columns:1fr auto 1fr auto;gap:2px 8px;margin-top:10px;padding-top:8px;border-top:1px solid #333;font-size:12.5px;align-items:center}
#slPay .m{text-align:right;font-weight:700;color:#ffd040;font-variant-numeric:tabular-nums} #slPay .jp{color:#ff3cc8}
#slCard .ft{margin-top:6px;color:#999;font-size:11px;text-align:center} body.touch #slCard .keys{display:none}
@media (orientation:landscape) and (max-height:520px){#slCard{width:min(760px,calc(100vw - 24px));display:grid;grid-template-columns:1.1fr 1fr;column-gap:14px;padding:8px 12px} #slCard .hd{grid-column:1/-1} #slPay{margin-top:6px;border-top:0;padding-top:0} .slReel{height:58px!important;font-size:34px!important} #slReels{margin:6px 0 4px} #slMsg{min-height:36px} #slCard .r{margin-top:6px}}
@media (max-height:700px){.slReel{height:64px;font-size:38px} #slPay{font-size:11.5px} #slCard{padding:10px}}
`;
// opts: { surface, toast, onTap, fx, actx: () => AudioContext, hud }
export function clubSlots({ surface, toast = () => {}, onTap = (el, fn) => el.addEventListener('click', fn), fx = {}, actx = () => null, hud = () => {} } = {}) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'slPanel'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  const pt = paytable().map(p => `<span${p.jackpot ? ' class="jp"' : ''}>${p.icons}</span><span class="m${p.jackpot ? ' jp' : ''}">${p.mult}×${p.jackpot ? ' JACKPOT' : ''}</span>`).join('');
  el.innerHTML = `<div id="slCard"><div class="hd"><b>🎰 RED PLANET SLOTS</b><span id="slCash"></span><button class="slBtn" id="slClose" aria-label="Close">✕</button></div>
<div class="main"><div id="slReels"><div class="slReel" id="slR0">🌋</div><div class="slReel" id="slR1">🌋</div><div class="slReel" id="slR2">🌋</div></div>
<div id="slMsg">Pick a bet and pull.</div>
<div class="r" id="slBets">${BETS.map(b => `<button class="slBtn slBet" data-b="${b}">${b} cr</button>`).join('')}</div>
<div class="r"><button class="slBtn" id="slSpin"></button><button class="slBtn" id="slLeave">Leave</button></div></div>
<div class="side"><div id="slPay">${pt}</div>
<div class="ft">Jackpot: 🌋🌋🌋 pays ${JACKPOT_AT[BETS[BETS.length - 1]].toLocaleString('en-US')} cr at ${BETS[BETS.length - 1]}. House cr only.<span class="keys"> · Space/E spin · 1 2 3 bet · Esc leave</span></div></div></div>`;
  document.body.appendChild(el);
  const $ = id => document.getElementById(id), card = $('slCard'), msg = $('slMsg'), R = [0, 1, 2].map(i => $('slR' + i)), spinBtn = $('slSpin');
  const game = () => surface?.game || window.__app?.surface?.game || window.__app?.game;
  const credits = () => game()?.progress?.credits ?? 0;
  const grant = n => { const g = game(); if (!g || !(n > 0)) return; if (typeof g.debug?.credits === 'function') g.debug.credits(n); else { g.progress.credits += n; try { g.save?.(); } catch (e) { /* */ } } };
  let open = false, bet = BETS[0], S = null, last = null, openedAt = 0, forced = null, stats = { spins: 0, wagered: 0, won: 0, jackpots: 0 };
  const say = (t, cls = '') => { msg.textContent = t; msg.className = cls; };
  const cash = () => { $('slCash').textContent = credits().toLocaleString('en-US') + ' cr'; };
  const setBet = b => { if (S || !BETS.includes(b)) return; bet = b; for (const x of el.querySelectorAll('.slBet')) x.classList.toggle('sel', +x.dataset.b === b); spinBtn.textContent = `SPIN · ${b} cr`; };

  // ---- sound (Web Audio one-shots, same style as audio7's fx) ----
  function osc(type, f, t, dur, vol, f1) { const a = actx(); if (!a) return; const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05); }
  const now = () => actx()?.currentTime ?? 0;
  const snd = {
    pull() { try { const t = now(); osc('sawtooth', 160, t, 0.25, 0.05, 60); osc('triangle', 900, t + 0.05, 0.08, 0.04); } catch (e) { /* */ } },
    tick() { try { osc('square', 1200 + Math.random() * 300, now(), 0.02, 0.018); } catch (e) { /* */ } },
    stop(i) { try { const t = now(); osc('square', 220 - i * 30, t, 0.09, 0.07, 90); } catch (e) { /* */ } },
    win(big) { try { const t = now(), n = big ? [523, 659, 784, 1047, 1319, 1568] : [784, 1047, 1319]; n.forEach((f, i) => osc('triangle', f, t + i * 0.09, 0.22, big ? 0.08 : 0.06)); if (big) for (let i = 0; i < 10; i++) osc('square', 1800 + (i % 3) * 400, t + 0.6 + i * 0.06, 0.05, 0.03); } catch (e) { /* */ } },
    jackpot() { try { const t = now(); [523, 659, 784, 1047, 784, 1047, 1319, 1568, 2093].forEach((f, i) => { osc('triangle', f, t + i * 0.12, 0.3, 0.09); osc('square', f / 2, t + i * 0.12, 0.2, 0.025); }); for (let i = 0; i < 24; i++) osc('triangle', 2000 + (i % 4) * 350, t + 1.2 + i * 0.05, 0.05, 0.035); } catch (e) { /* */ } },
    lose() { try { const t = now(); osc('triangle', 330, t, 0.16, 0.04); osc('triangle', 247, t + 0.14, 0.26, 0.04); } catch (e) { /* */ } },
  };

  function show() {
    if (open) return; if (window.__pshow?.active || window.__cprivate?.active) return;
    if (document.pointerLockElement) document.exitPointerLock();
    open = true; openedAt = performance.now(); el.classList.add('on'); document.body.classList.remove('slNear'); setBet(bet); cash();
    if (!S) { msg.className = ''; if (!msg.textContent) say('Pick a bet and pull.'); }
  }
  function close() { if (!open) return; settle(); open = false; el.classList.remove('on'); card.classList.remove('shake'); hud(); }
  function doSpin() {
    if (!open || S || performance.now() - openedAt < 300) return null; // swallow the tap that opened us
    if (credits() < bet || !game()?.spend?.(bet)) { say(`Short on cr. A ${bet} cr spin needs ${bet} cr; you have ${credits()}.`, 'broke'); fx.dry?.(); card.classList.remove('shake'); return { ok: false, why: 'broke' }; }
    const res = forced ? { reels: forced, bet, ...payout(forced, bet) } : spin(bet); forced = null;
    stats.spins++; stats.wagered += bet; cash(); hud(); snd.pull();
    say('Spinning…'); card.classList.remove('shake'); spinBtn.disabled = true;
    S = { res, t0: performance.now(), stopped: 0, last: 0, timer: 0, settled: false };
    R.forEach(r => r.classList.add('spin'));
    const icons = SLOTS.reel.map(s => s.icon), STOPS = [650, 950, 1250];
    const step = () => {
      if (!S) return; const t = performance.now() - S.t0;
      while (S.stopped < 3 && t >= STOPS[S.stopped]) { const i = S.stopped++; R[i].classList.remove('spin'); R[i].textContent = SYM[res.reels[i]].icon; snd.stop(i); }
      for (let i = S.stopped; i < 3; i++) R[i].textContent = icons[(Math.random() * icons.length) | 0];
      if (t - S.last > 90 && S.stopped < 3) { S.last = t; snd.tick(); }
      if (S.stopped >= 3) { settle(); return; }
      S.timer = setTimeout(step, 70);
    };
    step();
    return { ok: true, ...res };
  }
  // pay out exactly once, when the last reel lands (or right away if you walk off mid-spin)
  function settle() {
    if (!S || S.settled) return; S.settled = true; clearTimeout(S.timer); const { res } = S;
    R.forEach((r, i) => { r.classList.remove('spin'); r.textContent = SYM[res.reels[i]].icon; });
    if (res.win > 0) grant(res.win); stats.won += res.win; if (res.kind === 'jackpot') stats.jackpots++;
    S = null; spinBtn.disabled = false; cash(); hud(); last = res;
    if (res.kind === 'jackpot') { say(`🌋 JACKPOT! +${res.win.toLocaleString('en-US')} cr`, 'big'); snd.jackpot(); shake(); fx.cash?.(); }
    else if (res.big) { say(`BIG WIN! +${res.win.toLocaleString('en-US')} cr`, 'big'); snd.win(true); shake(); }
    else if (res.win > res.bet) { say(`WIN +${res.win} cr`, 'win'); snd.win(false); }
    else if (res.win === res.bet) { say(`🔴 Bet back: +${res.win} cr`, 'win'); snd.win(false); }
    else { say(['Nothing. The machine hums smugly.', 'Dust. Pull again?', 'So close. (It wasn’t.)', 'The house thanks you.'][(Math.random() * 4) | 0], 'lose'); snd.lose(); }
  }
  function shake() { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); try { navigator.vibrate?.([60, 40, 120]); } catch (e) { /* */ } }

  for (const b of el.querySelectorAll('.slBet')) onTap(b, () => setBet(+b.dataset.b));
  onTap(spinBtn, () => doSpin()); onTap($('slLeave'), () => close()); onTap($('slClose'), () => close());
  window.addEventListener('keydown', e => {
    if (!open) return;
    if (e.code.startsWith('Key') || e.code.startsWith('Arrow') || e.code.startsWith('Digit') || e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); }
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') doSpin(); else if (e.code === 'Escape') close();
    else if (/^Digit[1-3]$/.test(e.code)) setBet(BETS[+e.code.slice(5) - 1]);
  }, true);
  // the black/white prompt while you stand at the machines; close if you leave the club some other way
  surface?.registerTick?.(() => { try { const inside = !!surface.info?.inside, sp = surface.info?.spot; document.body.classList.toggle('slNear', !open && inside && sp?.act === 'slots'); if (open && !inside) close(); } catch (e) { /* */ } });

  const api = { open: show, close, spin: doSpin, setBet, settle, bets: BETS, table: SLOTS, odds: exactOdds,
    get isOpen() { return open; }, get spinning() { return !!S; }, get bet() { return bet; }, get last() { return last; }, get stats() { return { ...stats }; },
    debugNext(reels) { forced = Array.isArray(reels) && reels.length === 3 && reels.every(r => SYM[r]) ? reels.slice() : null; return !!forced; } }; // tests only
  window.__slots = api;
  queueMicrotask(() => { if (window.SSX) window.SSX.slots = api; });
  return api;
}
