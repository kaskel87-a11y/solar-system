// v7.5.3 regression (CoS review #1): poker cash-out pays exactly once.
// node tests/test-poker-grant-unit.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// poker.js pulls in three/world.js, so test the shipped grant() source on its own
const src = readFileSync(new URL('../activities/poker.js', import.meta.url), 'utf8'), m = /export function grant\((.*?)\) \{(.*)\}\n/.exec(src);
assert.ok(m, 'grant() is a one-line export'); const app = () => undefined;
const grant = new Function('app', `return function grant(${m[1]}) {${m[2]}}`)(app);
let paid = 0, calls = 0; const credits = n => { calls++; paid += n; }; // returns undefined, like game.debug.credits
const game = { debug: { credits } };
assert.equal(grant(250, { surface: { game }, game }), true); assert.equal(calls, 1); assert.equal(paid, 250);
calls = paid = 0; grant(100, { game }); assert.equal(calls, 1); assert.equal(paid, 100);
calls = paid = 0; assert.equal(grant(0, { game }), false); assert.equal(grant(50, {}), false); assert.equal(calls, 0);
console.log('poker grant: PASS (pays once)');
