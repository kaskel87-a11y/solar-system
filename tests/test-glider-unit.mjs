// v7.5.99 hang glider. node tests/test-glider-unit.mjs
import { readFileSync } from 'fs';
import * as G from '../mars/glidercore.js';

let fails = 0;
const ok = (n, c) => { if (!c) { fails++; console.log('FAIL', n); } else console.log('ok  ', n); };
const src = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

ok('no launch while standing', !G.canLaunch({ grounded: true, running: false, alt: 0, vy: 0, held: true, flying: false }));
ok('running start', G.canLaunch({ grounded: true, running: true, alt: 0, vy: 0, held: true, flying: false }));
ok('catch a fall', G.canLaunch({ grounded: false, running: false, alt: 8, vy: -2, held: true, flying: false }));
ok('needs the button', !G.canLaunch({ grounded: false, running: false, alt: 8, vy: -2, held: false, flying: false }));

const run = G.fresh();
let pose = null;
for (let t = 0; t < 0.6; t += 0.05) pose = G.step(run, { dt: 0.05, yaw: 0, steer: 0, grounded: t === 0, running: true, alt: 1, vy: pose?.vy || 0, held: true, boost: false, jets: false });
ok('glide is much faster than a sprint', pose.flying && Math.hypot(pose.vx, pose.vz) > 20, Math.hypot(pose.vx, pose.vz).toFixed(1));
ok('a run hops you off the ground', pose.vy > -1);

const fall = G.fresh();
const caught = G.step(fall, { dt: 0.05, yaw: 0, steer: 0, grounded: false, running: false, alt: 10, vy: -4, held: true, boost: false, jets: false });
ok('a fall deploys the wing', caught.flying && caught.launched);

const turned = G.fresh(); turned.flying = true; turned.vx = 0; turned.vz = -G.SPEED;
let yawed = { yaw: 0, vy: -2 };
for (let i = 0; i < 4; i++) yawed = G.step(turned, { dt: 0.05, yaw: yawed.yaw, steer: 1, grounded: false, running: false, alt: 6, vy: yawed.vy, held: true, boost: false, jets: false });
ok('right steer yaws', yawed.yaw > 0.2, yawed.yaw);

const bare = G.fresh(); bare.flying = true; bare.vx = 0; bare.vz = -G.SPEED;
let noJet = { yaw: 0, vy: 0 };
for (let i = 0; i < 4; i++) noJet = G.step(bare, { dt: 0.05, yaw: 0, steer: 0, grounded: false, running: false, alt: 6, vy: noJet.vy, held: true, boost: true, jets: false });
ok('without jets you do not climb', noJet.vy < 1 && bare.fuel === G.FUEL, noJet.vy);

const jet = G.fresh(); jet.flying = true; jet.vx = 0; jet.vz = -G.SPEED;
let up = { yaw: 0, vy: 0 };
for (let i = 0; i < 4; i++) up = G.step(jet, { dt: 0.05, yaw: 0, steer: 0, grounded: false, running: false, alt: 6, vy: up.vy, held: true, boost: true, jets: true });
ok('jets climb and burn fuel', up.thrusting && up.vy > 1 && jet.fuel < G.FUEL, up.vy + ' ' + jet.fuel);
ok('boost is faster than the glide', Math.hypot(up.vx, up.vz) >= Math.hypot(noJet.vx, noJet.vz));

const text = src('mars/glider.js') + src('mars/glidercore.js');
ok('plain instructions', /Hang glider/.test(G.HOW) && /Glide/.test(G.HOW) && /Boost/.test(G.HOW));
ok('phone buttons are at least 48', /min-height:48px/.test(text) && /min-width:48px/.test(text));
ok('not a film wing', !/lightsaber|star wars/i.test(text));

if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('glider unit ok');
