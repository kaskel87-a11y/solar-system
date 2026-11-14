// Camera-relative stick and pit fight rules. node tests/test-pitfight-unit.mjs
import * as F from '../mars/pitfightcore.js';
let fails = 0;
const ok = (n, c) => { if (!c) { fails++; console.log('FAIL', n); } else console.log('ok  ', n); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

const up = F.stickWorld(0, -1, 0);
ok('stick up at yaw 0 moves the way the camera looks (-z)', near(up.x, 0) && near(up.z, -1) && near(up.len, 1));
const right = F.stickWorld(1, 0, 0);
ok('stick right at yaw 0 moves +x', near(right.x, 1) && near(right.z, 0));
const up90 = F.stickWorld(0, -1, Math.PI / 2);
ok('stick up at yaw 90 moves -x', near(up90.x, -1) && near(up90.z, 0));
const right90 = F.stickWorld(1, 0, Math.PI / 2);
ok('stick right at yaw 90 moves -z', near(right90.x, 0) && near(right90.z, -1));
ok('a dead stick does not move', near(F.stickWorld(0, 0, 0.4).len, 0));

const s = F.fresh('Rusk');
ok('style is one of three', !!F.STYLES[s.style]);
ok('punch starts a combo', F.punch(s).step === 1);
ok('second punch', F.punch(s).step === 2);
const fin = F.punch(s, true);
ok('held third punch is the finisher', fin.finisher && fin.dmg > 2);
ok('stamina dropped', s.sta < F.STAMINA);
ok('dodge spends stamina and grants i-frames', F.dodge(s).ok && s.dodge > 0);
const whiff = F.absorb(s, 12);
ok('dodge ignores the hit', whiff.dodge && whiff.dmg === 0);
s.dodge = 0; F.blockDown(s); s.blockT = 0.05;
const par = F.absorb(s, 10);
ok('a fresh block parries', par.parry && par.dmg === 0);
F.blockUp(s); F.blockDown(s); s.blockT = 0.4;
const chip = F.absorb(s, 8);
ok('a held block chips the hit', !chip.parry && chip.dmg > 0 && chip.dmg < 8);
s.sta = 100;
ok('charge needs a hold', F.chargeStart(s) && !F.chargeRelease(s).ok);
s.charge = F.CHARGE;
ok('a full charge is a special', F.chargeRelease(s).special);
ok('round is 75 seconds', F.ROUND_S >= 60 && F.ROUND_S <= 90 && F.timeLeft(F.fresh('a')) === F.ROUND_S);
ok('tips say how to fight', /Punch/.test(F.tipsText) && /parry/.test(F.tipsText) && /camera/.test(F.tipsText));
const empty = F.fresh('x'); empty.sta = 0;
ok('no swing with no stamina', F.punch(empty).ok === false && F.dodge(empty).ok === false);

if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('all good');
