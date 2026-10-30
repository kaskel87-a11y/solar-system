// node tests/test-starshop-unit.mjs: ⭐ Star Shop pure logic (mars/starshopcore.js) + rank safety (game.js rankOf)
import * as C from '../mars/starshopcore.js';
import { readFileSync } from 'node:fs';
// game.js imports three, so lift RANKS + rankOf straight out of its source (the same lines the game runs)
const src = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const { rankOf } = new Function(src.match(/export const RANKS = .*;/)[0].replace('export ', '') + '\n' + src.match(/export function rankOf\(xp\).*/)[0].replace('export ', '') + '\nreturn { rankOf };')();
let bad = 0; const ok = (k, c, v) => { if (!c) { bad++; console.log('FAIL', k, v === undefined ? '' : JSON.stringify(v)); } };
const xp = 3800, s = C.fresh();
ok('prices', Object.values(C.PRICES).every(p => p >= 200 && p <= 600) && C.ORDER.every(id => C.PRICES[id]), C.PRICES);
ok('start', C.balance(s, xp) === 3800);
const rank0 = rankOf(xp).name;
let r = C.spend(s, xp, C.PRICES.voidhoney, 'contraband:voidhoney');
ok('spend', r.ok && r.balance === 3200 && s.spent === 600, r);
ok('rankSame', rankOf(xp).name === rank0 && rankOf(xp).name === 'Legend', rankOf(xp)); // xp itself never changes
// can't overspend
const s2 = C.fresh(); r = C.spend(s2, 500, 600); ok('overspend', !r.ok && r.short === 100 && s2.spent === 0, r);
ok('exact', C.spend(s2, 500, 500).ok && C.balance(s2, 500) === 0 && !C.spend(s2, 500, 1).ok);
ok('badN', !C.spend(C.fresh(), 100, 0).ok && !C.spend(C.fresh(), 100, -5).ok && !C.spend(C.fresh(), 100, NaN).ok);
// balance follows new XP (earning more stars after spending), never negative if XP is clawed back
ok('earnMore', C.balance(s, xp + 100) === 3300); ok('clawed', C.balance(s, 100) === 0);
// reset save: XP 0 clears spent
const s3 = C.fresh(); C.spend(s3, 1000, 400); ok('reconcile', C.reconcile(s3, 0) && s3.spent === 0 && !C.reconcile(s3, 0));
C.refund(s, 600); ok('refund', s.spent === 0);
// migrate
ok('migrate', C.migrate({ v: 1, spent: 250.7, log: [{ n: 250 }] }).spent === 250 && C.migrate('x').spent === 0 && C.migrate({ v: 2, spent: 9 }).spent === 0 && C.migrate({ v: 1, spent: -4 }).spent === 0);
// double tap: same key twice in one frame charges once; again after 300 ms is allowed; busy lock blocks re-entry
{ let t = 1000; const G = C.makeGuard(() => t); const w = C.fresh(); let units = 0;
  const tapBuy = id => G.run('buy:' + id, () => { const v = C.spend(w, xp, C.PRICES[id], id); if (v.ok) units++; return v; });
  const a = tapBuy('glowdust'), b = tapBuy('glowdust');
  ok('doubleTap', a.ok && b.dup && w.spent === 250 && units === 1, { a, b, spent: w.spent });
  t += 100; ok('stillDup', tapBuy('glowdust').dup && w.spent === 250);
  t += 400; ok('later', tapBuy('glowdust').ok && w.spent === 500 && units === 2);
  let inner = null; G.run('outer', () => { inner = G.run('other', () => ({ ok: true })); return { ok: true }; });
  ok('busy', inner && inner.dup, inner); ok('unlocked', !G.busy);
  t += 400; let threw = false; try { G.run('boom', () => { throw new Error('x'); }); } catch (e) { threw = true; } ok('unlockAfterThrow', threw && !G.busy); }
console.log(bad ? `FAIL ${bad}` : 'starshop unit OK'); process.exit(bad ? 1 : 0);
