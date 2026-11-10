// Slap, 100 cr, then Tiny. Resets when you leave; the door ban does not.
import { mkdirSync, writeFileSync, symlinkSync, existsSync } from 'fs';
mkdirSync(new URL('../node_modules/three', import.meta.url), { recursive: true });
writeFileSync(new URL('../node_modules/three/package.json', import.meta.url), JSON.stringify({ name: 'three', type: 'module', exports: { '.': './build/three.module.min.js', './addons/*': './addons/*' } }));
for (const p of ['build', 'addons']) {
  const t = new URL(`../node_modules/three/${p}`, import.meta.url);
  if (!existsSync(t)) symlinkSync(new URL(`../vendor/three/${p}`, import.meta.url).pathname, t);
}
const { clubTouch, resetTouchStrikes, touchStrikes, touchBanLeft, banMsg, touchLine, TOUCH_FEE, dannyBikini, DANNY_BIKINIS } = await import('../clubdancers.js');

let fails = 0;
const ok = (n, c) => { if (!c) { fails++; console.log('FAIL', n); } else console.log('ok  ', n); };
resetTouchStrikes();
const a = clubTouch();
ok('first touch is a slap', a.n === 1 && !a.kick && a.fee === 0 && /Slapped/.test(touchLine()) && /100 cr/.test(touchLine()));
const b = clubTouch();
ok('second touch is the fee', b.n === 2 && b.fee === TOUCH_FEE && TOUCH_FEE === 100 && !b.kick && /100 cr paid/.test(touchLine()));
const c = clubTouch();
ok('third touch kicks and bans', c.n === 3 && c.kick && touchStrikes() === 0 && touchBanLeft() > 15000 && /Hands off/.test(banMsg()));
resetTouchStrikes();
ok('leaving clears the count, not the ban', touchStrikes() === 0 && touchBanLeft() > 0);
ok('danny bikinis only', DANNY_BIKINIS.join() === 'aqua,white,black' && dannyBikini('crop') === 'white' && dannyBikini('string') === 'white' && dannyBikini('aqua') === 'aqua' && dannyBikini('black') === 'black');
if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('all good');
