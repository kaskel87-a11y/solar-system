// node tests/test-copbounty-unit.mjs: v7.5.12 cop bounty. A ColSec officer kill (on foot) pays a flat 500 cr + 100 ⭐ (Star Shop
// balance), once per kill, not through payoutMult; drones / cruisers pay nothing; the wanted-heat gain on the kill is unchanged.
import { readFileSync } from 'fs';
import { COP_BOUNTY, isCop, bountyFor, bountyText } from '../copbounty.js';
import * as SC from '../mars/starshopcore.js';
let fails = 0; const ok = (k, c, v) => { if (!c) { fails++; console.log('FAIL', k, v ?? ''); } };
ok('flat amounts', COP_BOUNTY.cr === 500 && COP_BOUNTY.stars === 100);
ok('officer pays', JSON.stringify(bountyFor({ kind: 'officer', foot: true })) === '{"cr":500,"stars":100}');
ok('heavy pays', bountyFor({ kind: 'heavy', foot: true })?.cr === 500);
ok('drone / buggy pay nothing', bountyFor({ kind: 'drone' }) === null && bountyFor({ kind: 'cruiser', foot: false }) === null && !isCop(null));
ok('toast text', bountyText(bountyFor({ foot: true })) === '+500 cr · +100 ⭐', bountyText(bountyFor({ foot: true })));
// game.js copBounty: lift the method out of the source and run it against a stub gain()
const gsrc = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const line = gsrc.split('\n').find(l => /^\s*copBounty\(b\)/.test(l)); ok('game.copBounty exists', !!line);
const P = { xp: 1000, credits: 50 }; let calls = 0;
const gain = (xp, cr) => { calls++; P.xp += xp; P.credits += cr; };
const G = new Function('gain', `return { ${line.trim().replace(/\/\/.*$/, '')} };`)(gain);
globalThis.SSX = { economy: { payoutMult: () => 3, job: n => n * 3, boost: n => n * 3 } }; // must be ignored
const spent = SC.fresh(); const bal0 = SC.balance ? SC.balance(spent, P.xp) : P.xp;
const r = G.copBounty(bountyFor({ kind: 'officer', foot: true }));
ok('paid flat', P.credits === 550 && r.cr === 500, P);
ok('+100 stars', (SC.balance ? SC.balance(spent, P.xp) : P.xp) - bal0 === 100);
ok('once per call', calls === 1);
ok('null bounty pays nothing', G.copBounty(null) === null && calls === 1);
ok('no payoutMult', !/payoutMult|economy/.test(line.replace(/\/\/.*$/, '')));
// world.js: paid inside secKill after the unit is spliced out (so a second hit can't pay again); crime line unchanged
const wsrc = readFileSync(new URL('../world.js', import.meta.url), 'utf8');
const sk = wsrc.slice(wsrc.indexOf('function secKill('), wsrc.indexOf('function secKill(') + 1600);
ok('spliced before pay', sk.indexOf('security.splice(i, 1)') > 0 && sk.indexOf('security.splice(i, 1)') < sk.indexOf('bountyFor(s)'));
ok('heat unchanged', sk.includes("crime(Math.min(5, wanted + 1), s.foot ? 'killed a ColSec officer' : 'destroyed security')"));
ok('toast wired', /ev\.bounty\.cr/.test(readFileSync(new URL('../index.html', import.meta.url), 'utf8')));
console.log(fails ? `copbounty unit: ${fails} FAILED` : 'copbounty unit OK'); process.exit(fails ? 1 : 0);
