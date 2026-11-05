// node tests/test-empire-hour-unit.mjs: SSX.empire.on('hour') ticker (empirecore.hourCrossings / makeHourTicker) + wiring checks
import * as E from '../empirecore.js';
import { readFileSync } from 'fs';
let fails = 0; const ok = (n, c) => { if (!c) { fails++; console.log('FAIL', n); } else console.log('ok  ', n); };
const J = a => a.join();
ok('no change', J(E.hourCrossings(9.2, 9.2)) === '' && J(E.hourCrossings(9.2, 9.9)) === '');
ok('one hour', J(E.hourCrossings(9.9, 10.05)) === '10');
ok('exact boundary', J(E.hourCrossings(9.5, 10)) === '10');
ok('wraps midnight', J(E.hourCrossings(23.7, 0.2)) === '0' && J(E.hourCrossings(22.5, 1.5)) === '23,0,1');
ok('sleep jump 22 -> 7', E.hourCrossings(22, 7).length === 9 && E.hourCrossings(22, 7).at(-1) === 7);
ok('capped', E.hourCrossings(1, 0.5).length <= 24 && E.hourCrossings(0, 23.99, 5).length === 5);
ok('junk', J(E.hourCrossings(NaN, 3)) === '' && J(E.hourCrossings(3, undefined)) === '');
// ticker with a fake clock, no fronts involved at all
let h = 8.6, src = 'real'; const got = [];
const T = E.makeHourTicker(() => ({ hour: h, source: src, night: false, band: 'day' }), d => got.push(d));
ok('first pump = baseline only', T.pump() === 0 && got.length === 0 && T.last === 8.6);
h = 8.9; T.pump(); ok('same hour silent', got.length === 0);
h = 9.01; T.pump(); ok('fires at 9', got.length === 1 && got[0].hour === 9 && got[0].prev === 8 && !got[0].catchUp && got[0].source === 'real');
T.pump(); T.pump(); ok('idempotent', got.length === 1);
h = 12.2; T.pump(); ok('jump fires each hour, last not catchUp', J(got.slice(1).map(d => d.hour)) === '10,11,12' && got[1].catchUp && got[2].catchUp && !got[3].catchUp && got[1].prev === 9);
src = 'SSX.time'; h = 3; T.pump(); ok('clock source switch: rebaseline, no burst', got.length === 4 && T.last === 3);
h = 4.5; T.pump(); ok('then ticks on the new clock', got.length === 5 && got[4].hour === 4 && got[4].source === 'SSX.time');
const bad = E.makeHourTicker(() => { throw new Error('x'); }, () => {}); ok('clock throws -> 0, no throw', bad.pump() === 0);
let n = 0; const thr = E.makeHourTicker(() => ({ hour: n }), () => { throw new Error('listener'); }); thr.pump(); n = 1.5; let threw = false; try { thr.pump(); } catch (e) { threw = true; } ok('listener throw contained', !threw && thr.fired === 1);
// wiring: income path untouched, '*' excludes hour, pending queue + interval + tick pump present
const src2 = readFileSync(new URL('../empire.js', import.meta.url), 'utf8');
ok('tick pumps before the Mars-only return', /hourTicker\.pump\(\);[^\n]*\n\s*if \(!S\.on \|\| !\/mars\/i/.test(src2));
ok('timer pump (off Mars / in space)', /setInterval\(\(\) => \{ try \{ hourTicker\.pump\(\)/.test(src2));
ok('pending queue drained', src2.includes('SSX._pendingEmpire') && src2.includes('SSX_pending?.empire'));
ok("'*' listeners don't get hour", src2.includes("if (evt !== 'hour') for (const f of [...(listeners['*']"));
ok('income code unchanged', src2.includes("const ck = clock(); if (D.lastHour == null) D.lastHour = ck.hour; const hrs = EC.hoursBetween(D.lastHour, ck.hour); D.lastHour = ck.hour;"));
// raid slot sharing
ok('raidSlot free', E.raidSlot(null) === 'free' && E.raidSlot(undefined) === 'free' && E.raidSlot({}) === 'free');
ok('raidSlot ours', E.raidSlot({ id: 'empire-den' }) === 'ours' && E.raidSlot('empire-x') === 'ours');
ok('raidSlot other', E.raidSlot({ id: 'farm-raid-3' }) === 'other' && E.raidSlot('base-aj') === 'other');
ok('yield swaps defense before stop', /S\.defense = \{ engine: 'hold'[^\n]*yielded: true \};[^\n]*\n\s*try \{ H\.raids\(\)\?\.stop\?\.\(df\.id, 'empire:yield'\)/.test(src2));
ok('hourly roll skipped while another raid runs', src2.includes("if (!S.force.noThreats && slot() !== 'other')"));
ok('defend goes to hold when slot busy', src2.includes("if (R && slot() === 'other') r = { ok: false, why: 'raid slot busy' }"));
ok('raid:request listener', src2.includes("addEventListener('raid:request'"));
console.log(fails ? `FAIL ${fails}` : 'PASS hour unit'); process.exit(fails ? 1 : 0);
