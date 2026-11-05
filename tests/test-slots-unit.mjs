// v7.6 Velvet Airlock slots (slots.js): the paytable math. Exact RTP over every reel combination and a seeded
// 2,000,000-spin simulation must both land in 102-105 % (slightly in the player's favour), the jackpot must be rare
// and pay ~5,000 cr at the top bet, wins must scale with the bet, and the jackpot must be the top line.
// node tests/test-slots-unit.mjs
import { SLOTS, BETS, JACKPOT_AT, exactOdds, spin, multOf, payout, mulberry32, paytable } from '../slots.js';
const bad = [], ok = (k, c, v) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${k}${v !== undefined ? ': ' + v : ''}`); if (!c) bad.push(k); };
const ex = exactOdds();
ok('exact RTP 102-105%', ex.rtp >= 1.02 && ex.rtp <= 1.05, (ex.rtp * 100).toFixed(2) + '%');
ok('hit rate 35-60%', ex.hit > 0.35 && ex.hit < 0.6, (ex.hit * 100).toFixed(1) + '%');
ok('jackpot rare (1 in 1,500-20,000)', ex.jackpotOneIn > 1500 && ex.jackpotOneIn < 20000, '1 in ' + Math.round(ex.jackpotOneIn));
ok('jackpot ~5,000 at max bet', JACKPOT_AT[200] >= 4500 && JACKPOT_AT[200] <= 5500, JACKPOT_AT[200]);
ok('bets 10/50/200', BETS.join() === '10,50,200');
const top = Math.max(...Object.values(SLOTS.three), SLOTS.twoOlympus, SLOTS.twoRed);
ok('jackpot is the top line', SLOTS.three[SLOTS.jackpot] === top);
ok('table has 10 rows', paytable().length === 10);
// rules
ok('3 olympus = jackpot 25x', multOf(['olympus', 'olympus', 'olympus']).kind === 'jackpot' && payout(['olympus', 'olympus', 'olympus'], 200).win === 5000);
ok('2 olympus = 8x', payout(['olympus', 'dust', 'olympus'], 50).win === 400);
ok('2 red = 4x', payout(['red', 'rover', 'red'], 10).win === 40);
ok('1 red = bet back', payout(['dust', 'red', 'meteor'], 50).win === 50);
ok('nothing = 0', payout(['dust', 'meteor', 'rover'], 200).win === 0);
ok('3 dust = 6x', payout(['dust', 'dust', 'dust'], 10).win === 60);
// seeded simulation, per bet
for (const b of BETS) {
  const rng = mulberry32(0xC0FFEE + b), N = 2000000; let paid = 0, jp = 0, cash = 0, low = 0;
  for (let i = 0; i < N; i++) { const r = spin(b, rng); paid += r.win; if (r.kind === 'jackpot') jp++; cash += r.win - b; if (cash < low) low = cash; }
  const rtp = paid / (N * b);
  ok(`sim RTP @${b} (2M spins)`, rtp >= 1.02 && rtp <= 1.05, (rtp * 100).toFixed(2) + `% · jackpots ${jp} (1 in ${Math.round(N / Math.max(1, jp))})`);
}
// the same seed gives the same spins
const a = mulberry32(42), c = mulberry32(42); ok('seeded RNG is repeatable', [...Array(50)].every(() => spin(10, a).reels.join() === spin(10, c).reels.join()));
if (bad.length) { console.log('FAIL: ' + bad.join(', ')); process.exit(1); } console.log('slots unit OK');
// ---- v7.5.36 the Olympus Mega + the move to the gaming floor ----
{
  const S = await import('../slots.js'); const { readFileSync } = await import('fs'); const src = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  let f = 0; const t = (n, c) => { if (!c) { f++; console.log('FAIL', n); } else console.log('ok  ', n); };
  const o = S.megaOdds();
  t('mega jackpot is very rare (1 in 21,952)', Math.round(o.jackpotOneIn) === 21952);
  t('mega has a house edge at the seed (88-95 %)', o.rtp > 0.88 && o.rtp < 0.95);
  t('mega pays the pot on 🌋🌋🌋', S.megaPayout(['olympus', 'olympus', 'olympus'], 31234.5).win === 31235 && S.megaPayout(['olympus', 'olympus', 'olympus'], 31234).kind === 'mega');
  t('mega lines scale with bet', S.megaPayout(['alien', 'alien', 'alien'], 30000, 1000).win === 18000 && S.megaPayout(['red', 'dust', 'meteor'], 30000, 250).win === 225);
  { const r = S.mulberry32(7); let n = 0; const N = 400000; for (let i = 0; i < N; i++) if (S.megaSpinReels(1000, r).every(x => x === 'olympus')) n++; const exp = N * 10 * S.megaJackpotP(); t('mega 1000 bet ≈ 10x jackpot odds', Math.abs(n - exp) < 4 * Math.sqrt(exp)); }
  t('mega other lines × 90 cr', S.megaPayout(['alien', 'alien', 'alien'], 30000).win === 1800 && S.megaPayout(['red', 'dust', 'meteor'], 30000).win === 90);
  t('mega strip: 🌋 1 of 28', (() => { let n = 0, r = S.mulberry32(7); for (let i = 0; i < 56000; i++) if (S.megaStop(r) === 'olympus') n++; return Math.abs(n / 56000 - 1 / 28) < 0.004; })());
  const store = {}; globalThis.window = { localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } } };
  t('pot seeds at 25,000, grows, persists, resets', S.megaPot() === 25000 && S.addPot(5) === 25005 && store['ssx.megaPot'] === '25005' && S.megaPot() === 25005 && S.resetPot() === 25000 && S.megaPot() === 25000);
  delete globalThis.window;
  const fl = src('slotfloor.js'), it = src('interiors.js'), sw = src('sw.js'), html = src('index.html');
  t('club builds the bank, not the old corner pair', /addSlotBank\(api\)/.test(it) && !/addSlotMachines\?\.\(api/.test(it));
  t('bank on the west wall clear of the sofa (z 19.35) and the card-room partition', S.BANK.x < -32 && S.BANK.z0 + (S.BANK.n - 1) * S.BANK.gap + 0.45 < 19.35 && S.BANK.megaZ - 1.2 > 8 && S.BANK.n >= 8);
  t('baked + no lights', /mergeGeometries/.test(fl) && !/Light\(/.test(fl));
  t('mega spot opens the slots panel in mega mode', /id: 'megaslot'[^}]*act: 'slots', big: true/.test(fl) && /mega = !!\(s\?\.big \|\| s\?\.id === 'megaslot'\)/.test(src('slots.js')));
  t('sw + importmap', /`slotfloor\.js\$\{q\}`/.test(sw) && /"\.\/slotfloor\.js": "\.\/slotfloor\.js\?v=/.test(html));
  if (f) { console.log(f + ' mega FAIL'); process.exit(1); } else console.log('mega unit OK');
}
