// node tests/test-crimebreak-unit.mjs — crimebreakcore + crewcore pay bonus hook (v7.5.76)
import { readFileSync } from 'node:fs';
import * as C from '../mars/crimebreakcore.js';
import * as Crew from '../crewcore.js';
import * as Star from '../mars/starshopcore.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };

ok(C.KEY === 'ssx.crimebreak.v1' && C.COST_CR === 500 && C.STAR_PAY === 80 && C.BUFF_STEP === 0.05 && C.BUFF_CAP === 0.25, 'constants');
ok(C.load('junk').meets === 0 && C.payBonus(C.fresh()) === 0, 'bad save -> fresh, no buff');

const s = C.fresh();
ok(!C.canStart(s, { crew: 0, atGulch: true, credits: 9999, sol: 0 }).ok && C.canStart(s, { crew: 0, atGulch: true }).needCrew, 'no crew blocks, explains hire');
ok(!C.canStart(s, { crew: 1, atGulch: false, credits: 9999, sol: 0 }).ok, 'not at gulch');
const intro = C.canStart(s, { crew: 1, atGulch: true, credits: 0, sol: 0 });
ok(intro.ok && intro.intro && intro.cost === 0, 'first meeting is free intro');

let paid = 0;
const r1 = C.complete(s, { sol: 3, credits: 0, pay: n => { paid += n; return { ok: true }; } });
ok(r1.ok && r1.intro && r1.cost === 0 && paid === 0 && r1.stars === 80 && s.meets === 1 && s.buff === 0.05 && s.lastSol === 3, 'intro completes: +80⭐, +5% buff, no cr');

ok(!C.canStart(s, { crew: 1, atGulch: true, credits: 9999, sol: 3 }).ok, 'same sol blocked');
ok(!C.canStart(s, { crew: 1, atGulch: true, credits: 9999, sol: 3.9 }).ok, 'partial sol blocked');
ok(/sol 4/.test(C.canStart(s, { crew: 1, atGulch: true, credits: 9999, sol: 3 }).why || ''), 'cooldown message names next sol');

ok(!C.canStart(s, { crew: 1, atGulch: true, credits: 100, sol: 4 }).ok && C.canStart(s, { crew: 1, atGulch: true, credits: 100, sol: 4 }).short, 'short on buy-in');
const ready = C.canStart(s, { crew: 1, atGulch: true, credits: 500, sol: 4 });
ok(ready.ok && !ready.intro && ready.cost === 500, 'next sol ready with buy-in');

const r2 = C.complete(s, { sol: 4, credits: 500, pay: n => { paid += n; return { ok: true }; } });
ok(r2.ok && r2.cost === 500 && paid === 500 && s.meets === 2 && Math.abs(s.buff - 0.1) < 1e-9 && s.lastSol === 4, 'paid meeting stacks buff to 10%');

// rewind / clock manipulation cannot unlock early
ok(!C.canStart(s, { crew: 1, atGulch: true, credits: 9999, sol: 2 }).ok, 'rewound sol still blocked');
ok(!C.canStart(s, { crew: 1, atGulch: true, credits: 9999, sol: 4 }).ok, 'same lastSol blocked');

// stack to cap
for (let i = 0; i < 10; i++) {
  const sol = 5 + i;
  const r = C.complete(s, { sol, credits: 9999, pay: () => ({ ok: true }) });
  if (!r.ok) break;
}
ok(s.buff === C.BUFF_CAP && s.meets >= 5 && C.buffPct(s) === 25, 'buff hard-caps at +25%');

// idempotent guard
const g = C.makeGuard(() => 1000, 300);
let n = 0; const once = () => g.run('x', () => { n++; return { ok: true, n }; });
ok(once().ok && once().dup && n === 1, 'guard dedupes same-key within window');

// save round trip
const t = C.load(JSON.stringify(s));
ok(t.meets === s.meets && t.buff === s.buff && t.lastSol === s.lastSol, 'save round trip');

// crewcore payMul / jobCash honor the bonus (crime break hook)
ok(s.bought === 0, 'meetings do not increment the exchange count');
ok(Crew.payMul(1) === 1 && Crew.payMul(2) === 1.1 && Crew.payMul(1, 0.05) === 1.05 && Crew.payMul(1, 0.5) === 1.25, 'payMul + bonus capped');
ok(Crew.jobCash('hustle', 1, 0, 0) === 150 && Crew.jobCash('hustle', 1, 0, 0.05) === Math.round(150 * 1.05), 'jobCash uses bonus');
const m = Crew.member({ id: 'dex', lv: 1 }); Crew.assign(m, 'hustle', 0);
Crew.step(m, 8 * 60000, () => 0.9, () => 0, 0.25);
ok(m.bank[0].cr === Math.round(150 * 1.25) && m.bank[0].xp === Math.round(8 * 1.25), 'step banks buffed pay');

// ---------- exchange: 100 cr → 10 ⭐, separate from the meeting ----------
ok(C.EX_COST === 100 && C.EX_STARS === 10, 'exchange rate constants');
const blank = C.fresh();
ok(blank.bought === 0 && !C.canExchange(0).ok && !C.canExchange(99).ok && C.canExchange(99).short, 'new game, no exchange under 100 cr');
ok(C.canExchange(100).ok && C.canExchange(100).cost === 100 && C.canExchange(100).stars === 10, 'exact 100 cr can exchange');
let payN = 0, grantN = 0, refundN = 0, cr = 40, stars = 0;
const refuse = C.exchange(blank, {
  credits: cr,
  pay: n => { payN += n; return { ok: true }; },
  grant: () => { grantN++; return { ok: true }; }
});
ok(!refuse.ok && refuse.short && payN === 0 && grantN === 0 && blank.bought === 0 && blank.meets === 0, 'short credits never charge or grant');
cr = 100;
const exOnce = C.exchange(blank, {
  credits: cr,
  pay: n => { if (cr < n) return { ok: false, msg: 'short' }; cr -= n; payN = n; return { ok: true, refund() { cr += n; refundN++; } }; },
  grant: () => { stars += C.EX_STARS; grantN++; return { ok: true }; }
});
ok(exOnce.ok && exOnce.stars === 10 && cr === 0 && stars === 10 && blank.bought === 1 && payN === 100 && grantN === 1, 'exact balance: spend 100 then +10 ⭐');
const broke = C.exchange(blank, { credits: cr, pay: () => { payN = -1; return { ok: true }; }, grant: () => ({ ok: true }) });
ok(!broke.ok && payN === 100 && stars === 10 && blank.bought === 1, 'zero credits left does not charge again');
cr = 150; stars = 0; grantN = 0; const pile = C.fresh();
const one = C.exchange(pile, {
  credits: cr,
  pay: n => { if (cr < n) return { ok: false, msg: 'short' }; cr -= n; return { ok: true, refund() { cr += n; } }; },
  grant: () => { stars += 10; return { ok: true }; }
});
const two = C.exchange(pile, { credits: cr, pay: () => ({ ok: true }), grant: () => ({ ok: true }) });
ok(one.ok && !two.ok && cr === 50 && stars === 10 && pile.bought === 1 && pile.meets === 0, '150 cr buys one exchange and leaves 50');
let tClock = 1000; const eg = C.makeGuard(() => tClock, 300); const bag = C.fresh(); let bagCr = 500, bagStars = 0, charges = 0;
const tapEx = () => eg.run('exchange', () => C.exchange(bag, {
  credits: bagCr,
  pay: n => { if (bagCr < n) return { ok: false, msg: 'short' }; bagCr -= n; charges++; return { ok: true, refund() { bagCr += n; } }; },
  grant: () => { bagStars += 10; return { ok: true }; }
}));
const d1 = tapEx(), d2 = tapEx();
ok(d1.ok && d2.dup && charges === 1 && bagStars === 10 && bag.bought === 1 && bagCr === 400, 'double tap charges once');
tClock += 400;
ok(tapEx().ok && charges === 2 && bag.bought === 2 && bagCr === 300 && bagStars === 20, 'no cooldown: another exchange after the guard window');
const boom = C.fresh(); let boomCr = 100, boomStars = 0, booms = 0;
const blew = C.exchange(boom, {
  credits: boomCr,
  pay: n => { boomCr -= n; return { ok: true, refund() { boomCr += n; booms++; } }; },
  grant: () => { throw new Error('reward down'); }
});
ok(!blew.ok && blew.refunded && boomCr === 100 && boomStars === 0 && boom.bought === 0 && booms === 1, 'failed grant refunds the 100 cr');
const noPay = C.exchange(C.fresh(), { credits: 100, pay: () => ({ ok: false, msg: 'wallet said no' }), grant: () => { boomStars += 10; return { ok: true }; } });
ok(!noPay.ok && boomStars === 0 && /wallet/.test(noPay.why), 'spend failure grants nothing');
const meetKeep = C.fresh(); meetKeep.bought = 4;
ok(C.complete(meetKeep, { sol: 2, credits: 0, pay: () => ({ ok: true }) }).ok && meetKeep.bought === 4 && meetKeep.meets === 1 && meetKeep.buff === 0.05, 'meeting leaves the exchange count alone');
const legacy = C.load(JSON.stringify({ v: 1, meets: 2, lastSol: 9, intro: true, buff: 0.1 }));
ok(legacy.meets === 2 && legacy.lastSol === 9 && legacy.intro && Math.abs(legacy.buff - 0.1) < 1e-9 && legacy.bought === 0, 'v7.5.75 save keeps meetings and starts bought at 0');
const round = C.load(JSON.stringify({ ...legacy, bought: 6 }));
ok(round.bought === 6 && round.meets === 2 && round.lastSol === 9 && Math.abs(round.buff - 0.1) < 1e-9, 'exchange count round trips without wiping the meeting');

// ---------- gulch market quotes against the live catalog ----------
ok(!C.marketGate(false).ok && C.marketGate(false).travel && /Red Static Gulch/.test(C.marketGate(false).why) && C.marketGate(true).ok, 'market is gulch-only');
const cbSrc = readFileSync(new URL('../mars/contraband.js', import.meta.url), 'utf8');
const block = cbSrc.slice(cbSrc.indexOf('export const ITEMS'), cbSrc.indexOf('const CORE'));
const catalog = C.HOUSE.map(id => {
  const start = block.indexOf('\n  ' + id + ':');
  const slice = start < 0 ? '' : block.slice(start, block.indexOf('},', start));
  const name = /name:\s*'([^']+)'/.exec(slice);
  const supplier = /supplier:\s*(\d+)/.exec(slice);
  const max = /max:\s*(\d+)/.exec(slice);
  return name && supplier && max ? { id, name: name[1], supplier: +supplier[1], max: +max[1], icon: '•', blurb: 'fiction' } : null;
});
ok(catalog.every(Boolean), 'parsed four house products from contraband ITEMS');
const expectCr = { lowg: 20, glowdust: 40, redstatic: 75, voidhoney: 160 };
const expectStar = { lowg: 200, glowdust: 250, redstatic: 400, voidhoney: 600 };
ok(catalog.every(it => it.supplier === expectCr[it.id]) && Star.ORDER.join() === C.HOUSE.join() && C.HOUSE.every(id => Star.PRICES[id] === expectStar[id]), 'catalog credit and star prices');
const cap = { used: 0, max: 20 }, stash0 = { items: {} };
for (const it of catalog) {
  const q1 = C.marketQuote(it, 1, { credits: it.supplier, held: 0, used: 0, carry: 20 });
  const q5 = C.marketQuote(it, 5, { credits: it.supplier * 5, held: 0, used: 0, carry: 20 });
  const short = C.marketQuote(it, 1, { credits: it.supplier - 1, held: 0, used: 0, carry: 20 });
  const partial = C.marketQuote(it, 5, { credits: it.supplier * 2, held: 0, used: 0, carry: 20 });
  ok(q1.ok && q1.cost === it.supplier && q1.qty === 1, 'buy 1 ' + it.id);
  if (it.max >= 5) ok(q5.ok && q5.cost === it.supplier * 5 && q5.qty === 5, 'buy 5 ' + it.id);
  else ok(!q5.ok && q5.full && q5.cost === it.supplier * 5, 'buy 5 blocked by item cap ' + it.id);
  ok(!short.ok && short.short && short.cost === it.supplier, 'short 1 cr ' + it.id);
  if (it.max >= 5) ok(!partial.ok && partial.short, 'cannot afford full 5 ' + it.id);
  else ok(!partial.ok && partial.full, 'item cap refuses 5 before price ' + it.id);
}
const honey = catalog.find(it => it.id === 'voidhoney');
ok(!C.marketQuote(honey, 5, { credits: 99999, held: 0, used: 0, carry: 20 }).ok, 'void honey 5 never fits the item cap');
ok(!C.marketQuote(catalog[0], 1, { credits: 99999, held: 0, used: 20, carry: 20 }).ok, 'full pockets refuse even a rich buyer');
ok(!C.marketQuote(catalog[0], 5, { credits: 99999, held: 0, used: 16, carry: 20 }).ok, 'room for 4 is not room for 5');
ok(C.marketQuote(catalog[0], 1, { credits: 99999, held: 0, used: 16, carry: 20 }).ok, 'room for 4 still allows buy 1');
const away = C.present(catalog, Star.PRICES, { atGulch: false, credits: 99999, balance: 99999, stash: stash0, cap });
ok(!away.ok && away.travel && away.rows.length === 4 && away.rows[0].supplier === 20, 'away from gulch the quote is a travel prompt and still lists catalog prices');
const here = C.present(catalog, Star.PRICES, { atGulch: true, credits: 19, balance: 199, stash: stash0, cap });
ok(here.ok && here.rows.length === 4 && !here.rows[0].buys[0].ok && here.rows[0].buys[0].short && !here.rows[0].star.ok, 'on gulch, short cash and short stars are visible on the row');
const rich = C.present(catalog, Star.PRICES, { atGulch: true, credits: 99999, balance: 99999, stash: stash0, cap });
ok(rich.rows.every(r => r.buys.every(b => b.ok || r.max < b.q) && r.star.ok && r.star.price === expectStar[r.id]), 'rich gulch shopper can buy 1 and 5 except over the item cap, stars at catalog price');
const blocked = C.present(catalog, Star.PRICES, { atGulch: true, credits: 99999, balance: 99999, blocked: 'Not in the Rust Pit. Step out of the cage first.', stash: stash0, cap });
ok(blocked.rows.every(r => !r.star.ok && /Rust Pit/.test(r.star.why) && r.buys[0].ok), 'star buys respect a Star Shop block; credit buys do not');
ok(!C.marketQuote(catalog[0], 2, { credits: 99999, held: 0, used: 0, carry: 20 }).ok, 'only quantities 1 and 5');

const ui = readFileSync(new URL('../mars/crimebreak.js', import.meta.url), 'utf8');
ok(/\.spend\(100\)/.test(ui) && /\.reward\(10,\s*0\)/.test(ui), 'panel charges with spend(100) and grants with reward(10, 0)');
ok(!/progress\.xp\s*[-+]?=/.test(ui), 'panel does not write xp itself');
ok(ui.includes('100 cr → 10 ⭐'), 'button label shows the rate');
ok(/panel\.id = 'cbGulch'/.test(ui) && !/panel\.id = 'cbPanel'/.test(ui), 'crime break does not reuse contraband #cbPanel');
ok(/class="sheet"/.test(ui) && /class="foot"/.test(ui) && /S\.ui\.foot\.innerHTML/.test(ui), 'exchange, crew and close sit in a footer under a scrolling sheet');
ok(/querySelector\('\.sheet'\)/.test(ui) && /querySelector\('\.foot'\)/.test(ui) && !/sheet: wrap\.firstChild/.test(ui), 'the sheet is the .sheet node, not the close button that now leads .wrap');
ok(/max-height:450px/.test(ui) && /margin-bottom:calc\(100px/.test(ui), 'short landscape (iPhone ~393 tall) gives the sheet the leftover height and keeps the footer on screen');
ok(/panelTap\(/.test(ui) && /CB\.buy\(id, qty\)/.test(ui) && /shop\.buy\(id\)/.test(ui), 'panelTap, contraband.buy, starshop.buy');
ok(/C\.marketGate\(atGulch\(\)\)/.test(ui) && /shopGuard\.run\('exchange'/.test(ui), 'gulch gate and exchange guard');
const club = readFileSync(new URL('../interiors.js', import.meta.url), 'utf8');
ok(/id: 'velvet-exchange'/.test(club) && /crimebreak\?\.exchange/.test(club) && !/velvet-exchange[\s\S]{0,400}spend\(/.test(club), 'Velvet till calls crimebreak.exchange and does not spend on its own');
ok(!/\.sell\(/.test(ui) && !/stars\?\.refund|starshop\?\.debug\?\.reset/.test(ui), 'no selling and no star-wallet reset');

console.log(fail ? `${fail} FAILED` : 'all ok');
process.exit(fail ? 1 : 0);
