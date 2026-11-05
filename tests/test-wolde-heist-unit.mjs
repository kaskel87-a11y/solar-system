// starFail: a heist's failAt only counts stars the job itself raised (wolde-02-discovery died on frame 1 when you walked in at 4★).
import { starFail } from '../heistcore.js';
let n = 0, bad = 0; const ok = (k, c) => { n++; if (!c) { bad++; console.log('FAIL', k); } else console.log('ok  ', k); };
const run = (failAt, seq) => { let f, out = []; for (const w of seq) { const [b, nf] = starFail(failAt, w, f); f = nf; out.push(b); } return out; };
ok('clean start, reach 4★ -> blown', run(4, [0, 2, 4]).join() === 'false,false,true');
ok('walk in at 4★ and stay there -> not blown', run(4, [4, 4, 4]).every(b => !b));
ok('walk in at 4★, go to 5★ -> blown', run(4, [4, 4, 5]).pop() === true);
ok('walk in at 4★, shake to 2★, back to 4★ -> blown', run(4, [4, 2, 4]).pop() === true);
ok('walk in at 5★ -> never blown by stars you already had', run(4, [5, 5]).every(b => !b));
ok('no failAt -> never blown', run(null, [0, 5]).every(b => !b));
ok('floor starts at the first reading', starFail(4, 4, undefined)[1] === 4 && starFail(4, 1, 3)[1] === 1);
console.log(`${n - bad}/${n} passed`); process.exit(bad ? 1 : 0);
