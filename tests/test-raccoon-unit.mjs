// Unit tests for mars/raccooncore.js (Raccoon Rover: loot, pickpocket, heat, barks, save). node tests/test-raccoon-unit.mjs
import * as RC from '../mars/raccooncore.js';
import { readFileSync } from 'node:fs';
let fails = 0; const ok = (name, c, extra = '') => { console.log(`${c ? 'PASS' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`); if (!c) fails++; };
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
// spec + placement
ok('spec is a drivable VEHICLES entry, not listed at the dealer', typeof RC.SPEC.vmax === 'number' && RC.SPEC.price === 1200 && RC.SPEC.dealer === false);
ok('junkyard sits in Red Tape Flats (centre [-280,-40])', Math.hypot(RC.junkAJ()[0] + 280, RC.junkAJ()[1] + 40) < 56);
ok('8 dumpsters, unique ids', RC.DUMPSTERS.length === 8 && new Set(RC.DUMPSTERS.map(d => d.id)).size === 8);
ok('aj2world / world2aj round-trip', (() => { const c = { x: 100, z: -50 }, [x, z] = RC.aj2world(-310, -2, c), [a, b] = RC.world2aj(x, z, c); return a === -310 && b === -2 && x === -210; })());
// lines: short, raccoon-tagged, nothing sexual
const all = Object.values(RC.LINES).flat();
ok('every bark line <= 65 chars', all.every(l => [...l].length <= 65), `(${all.length} lines)`);
ok('every line is tagged 🦝', all.every(l => l.startsWith('🦝')));
ok('no sexual content', !all.some(l => /\b(sex|horny|naked|nude|boob|dick|cock|pussy|tits)\b/i.test(l)));
ok('categories are snake_case raccoon_* keys', Object.keys(RC.LINES).every(k => /^raccoon_[a-z_]+$/.test(k)));
// barker
const b = RC.createBarker();
ok('first bark allowed', b.can(0, 'raccoon_crash')); b.mark(0, 'raccoon_crash');
ok('global gap blocks', !b.can(2, 'raccoon_idle'));
ok('category gap blocks the same category', !b.can(8, 'raccoon_crash') && b.can(8, 'raccoon_idle'));
ok('urgent categories need only half the gap', b.can(3.1, 'raccoon_loot') && !b.can(2.9, 'raccoon_loot'));
ok('category reopens after catGap', b.can(14.1, 'raccoon_crash'));
// loot picking
const car = { x: 0, z: 0, speed: 2 }, T = [{ id: 'dump:a', x: 3, z: 0, kind: 'dumpster', r: 0.8 }, { id: 'car:1', x: 0, z: 5, kind: 'car', r: 1.2 }, { id: 'dump:far', x: 20, z: 0, kind: 'dumpster' }];
const seen = new Map();
ok('nearest target in range', RC.lootPick(car, T, seen, 100)?.id === 'dump:a');
ok('too fast: nothing', RC.lootPick({ ...car, speed: 9 }, T, seen, 100) === null);
ok('reverse speed counts too', RC.lootPick({ ...car, speed: -9 }, T, seen, 100) === null);
ok('global loot gap', RC.lootPick(car, T, seen, 100, 95) === null);
seen.set('dump:a', 100);
ok('looted dumpster skipped, next target', RC.lootPick(car, T, seen, 120)?.id === 'car:1');
ok('dumpster refills after cooldown', RC.lootPick(car, T, seen, 100 + RC.LOOT.dumpsterCd + 1)?.id === 'dump:a');
seen.set('car:1', 120);
ok('cars are robbed once', RC.lootPick({ x: 0, z: 5, speed: 0 }, [T[1]], seen, 99999) === null);
ok('out of range: nothing', RC.lootPick({ x: 50, z: 50, speed: 0 }, T, new Map(), 0) === null);
// loot rolls
const L1 = RC.rollLoot('dumpster', seq(0.9, 0.5, 0.99)), L2 = RC.rollLoot('car', seq(0.1, 0.0, 0.0));
ok('credit roll (dumpster 10-60)', L1.credits >= 10 && L1.credits <= 60 && !L1.item && !L1.witness);
ok('item roll + witness', L2.credits === 0 && RC.ITEMS.includes(L2.item) && L2.witness === true);
let wit = 0; for (let i = 0; i < 4000; i++) if (RC.rollLoot('car').witness) wit++;
ok('witness chance is small (~12%)', wit / 4000 > 0.07 && wit / 4000 < 0.17, `(${(wit / 40).toFixed(1)}%)`);
// pickpocket
const ppl = [{ kind: 'colonist', x: 10, z: 0 }, { kind: 'guard', x: 5, z: 0, on: false }, { kind: 'contact', x: 0, z: 13, name: 'Wrench' }, { kind: 'dog', x: 1, z: 0 }, { kind: 'colonist', x: 30, z: 0 }];
ok('nearest pickable, skips off/dogs', RC.pickTarget(0, 0, ppl)?.i === 0);
ok('range respected', RC.pickTarget(25, 25, ppl, 14) === null);
ok('empty list', RC.pickTarget(0, 0, []) === null && RC.pickTarget(0, 0, null) === null);
ok('pick success pays 20-80 (civilian)', (() => { const r = RC.rollPick('colonist', seq(0.1, 0.5)); return r.ok && r.credits === 50; })());
ok('guard pays more', RC.rollPick('guard', seq(0.1, 1)).credits === 150);
ok('pick failure pays nothing', (() => { const r = RC.rollPick('guard', seq(0.9)); return !r.ok && r.credits === 0; })());
// blocking (floating / race / job / indoors)
ok('allowed on Mars', RC.blocked({ onMars: true }) === null);
ok('floating pauses loot + pickpocket', /floating/.test(RC.blocked({ onMars: true, floating: true })));
ok('race / job / inside block', /race/.test(RC.blocked({ onMars: true, race: true })) && /job/.test(RC.blocked({ onMars: true, job: true })) && /indoors/.test(RC.blocked({ onMars: true, inside: true })));
ok('off Mars blocked', RC.blocked({}) === 'Mars only');
// heat
ok('stealing: at least +1 heat', RC.wantedOnEnter(false, 0, 0) === 1 && RC.wantedOnEnter(false, 2, 2) === 3);
ok('stealing seen by witness: no double count', RC.wantedOnEnter(false, 0, 1) === 1);
ok('stealing caps at 5', RC.wantedOnEnter(false, 5, 5) === 5);
ok('owned: undo core car-theft heat', RC.wantedOnEnter(true, 0, 1) === 0 && RC.wantedOnEnter(true, 2, 3) === 2);
ok('bump clamps 0..5', RC.bump(4) === 5 && RC.bump(5) === 5 && RC.bump(0, -1) === 0);
// gravity bark mapping, runner step
ok('gravity categories', RC.gravityCat('ZERO-G') === 'raccoon_zerog' && RC.gravityCat('LOW-G') === 'raccoon_lowg' && RC.gravityCat('MARS') === 'raccoon_marsg');
const s1 = RC.stepToward(0, 0, 10, 0, 7, 0.5);
ok('runner steps at speed', Math.abs(s1.x - 3.5) < 1e-9 && !s1.arrived);
ok('runner arrives', RC.stepToward(9.5, 0, 10, 0, 7, 0.5).arrived);
// save
ok('load tolerates junk', (() => { const s = RC.loadState('{oops'); return s.owned === false && s.loot === 0 && s.how === null; })());
ok('load keeps fields', (() => { const s = RC.loadState(JSON.stringify({ owned: true, how: 'stole', garage: 1, loot: 3, picks: 2, busts: 1, cr: 99 })); return s.owned && s.how === 'stole' && s.garage && s.loot === 3 && s.cr === 99; })());
// key: free on main (danger 1-4, gravity 2, everything else letters)
const src = ['index.html', 'surface.js', 'danger.js', 'dangerhooks.js', 'mars/jobs.js', 'mars/turf.js', 'race.js', 'trackbuilder.js', 'controlmode.js', 'heist.js', 'carmeet.js', 'dealership.js'].map(f => { try { return readFileSync(new URL('../' + f, import.meta.url), 'utf8'); } catch (e) { return ''; } }).join('\n');
ok('Digit5 unused by core files', RC.PICK_KEY === 'Digit5' && !/['"]Digit5['"]/.test(src) && !/key === ['"]5['"]/.test(src));
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
