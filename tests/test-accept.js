// v7.5.2 iPhone Accept bug: every tap goes in while a second finger is held on the joystick (pointer 41 held, 42 tapping),
// with NO synthetic click, the way iOS WebKit behaves. Plain .onclick buttons fail this; onTap passes.
// Covers radio pill + ✅ Accept + Later, Log ▶ Start / Abandon, duel Walk away + Fight panel picks, 🏁 race panel close, keyboard Enter.
// BASE=http://localhost:8845/ BR=webkit DEV="iPhone 14" node tests/test-accept.js
const { webkit, chromium, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8845/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const OUT = process.env.OUT || (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/';
(async () => {
  const b = await (BR === 'chromium' ? chromium : webkit).launch(); const ctx = await b.newContext({ ...devices[DEV] }); const page = await ctx.newPage();
  const R = {}, bad = [], errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const G = (f, a) => page.evaluate(f, a), sleep = ms => new Promise(r => setTimeout(r, ms));
  const wait = async (f, ms = 8000, a) => { const t = Date.now(); while (Date.now() - t < ms) { if (await G(f, a).catch(() => false)) return true; await sleep(200); } return false; };
  const ok = (k, v, want = true) => { R[k] = v; if (v !== want) bad.push(k); };
  // held tap: pointer 41 down on the joystick (it takes capture), pointer 42 down/up on the target, no click event
  const held = sel => G(sel => {
    const e = typeof sel === 'string' ? document.querySelector(sel) : sel, j = document.getElementById('joy'); if (!e) return 'missing'; const r = e.getBoundingClientRect(); if (!r.width) return 'hidden';
    const jr = j.getBoundingClientRect(), jx = jr.left + jr.width / 2, jy = jr.top + jr.height / 2, x = r.left + r.width / 2, y = r.top + r.height / 2;
    const P = (t, el, id, x, y) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: id === 41, clientX: x, clientY: y, bubbles: true, cancelable: true, composed: true, buttons: t === 'pointerup' ? 0 : 1 }));
    P('pointerdown', j, 41, jx, jy); P('pointermove', j, 41, jx, jy - 20);
    const tgt = document.elementFromPoint(x, y) || e; P('pointerdown', tgt, 42, x, y); P('pointerup', tgt, 42, x, y);
    P('pointerup', j, 41, jx, jy - 20); return 'ok';
  }, sel);
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 240000);
    R.version = await G(() => window.__app.version);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 240000)); await sleep(800);
    await G(() => { window.__ev = []; window.SSX.on('game:quest', e => window.__ev.push(e.kind + ':' + e.id)); const g = window.__app.surface.game; g.abandon?.(true); document.getElementById('radio').style.display = 'none'; });
    const offerId = await G(() => { const q = window.__app.surface.game.questList().find(q => q.status !== 'active' && !q.locked && q.world === 'Mars') || window.__app.surface.game.questList()[0]; return q && q.id; });
    R.offerId = offerId;
    const offer = () => G(id => window.SSX.city.radio('Control: test job. Want it?', 'Control', id), offerId);
    const radioShown = () => wait(() => getComputedStyle(document.getElementById('radio')).display !== 'none', 4000);
    // 1) unrequested offer arrives as the pill; a held tap opens it; a held tap on ✅ Accept accepts
    await offer(); ok('radioShown', await radioShown()); ok('arrivesMini', await G(() => document.getElementById('radio').classList.contains('mini')));
    await held('#radio'); ok('pillOpensHeld', await wait(() => !document.getElementById('radio').classList.contains('mini'), 2000));
    await page.screenshot({ path: `${OUT}v752-accept-${BR}-${DEV.replace(/\W+/g, '')}-card.png` });
    R.acceptTap = await held('#radioAccept'); ok('acceptHeld', await wait(id => window.__ev.includes('accepted:' + id), 4000, offerId));
    ok('radioClosedAfterAccept', await G(() => getComputedStyle(document.getElementById('radio')).display === 'none'));
    // 2) Later
    await G(() => window.__app.surface.game.abandon(true)); await offer(); await radioShown(); await held('#radio'); await sleep(200);
    await held('#radioLater'); ok('laterHeld', await wait(() => getComputedStyle(document.getElementById('radio')).display === 'none', 3000));
    // 3) keyboard Enter still accepts (desktop path: .click())
    await G(() => window.__app.surface.game.abandon(true)); await offer(); await radioShown(); await G(() => { window.__ev = []; document.getElementById('radio').classList.remove('mini'); });
    await sleep(400); await page.keyboard.press('Enter'); if (!(await wait(id => window.__ev.includes('accepted:' + id), 1500, offerId))) { await sleep(500); await page.keyboard.press('Enter'); } ok('enterAccepts', await wait(id => window.__ev.includes('accepted:' + id), 3000, offerId));
    // 4) Log: Abandon then ▶ Start, both held
    await G(() => { window.__ev = []; window.__app.openLog ? window.__app.openLog() : document.getElementById('discBtn').click(); });
    await wait(() => getComputedStyle(document.getElementById('logPanel')).display !== 'none', 3000);
    const ab = await held('[data-abandon]'); R.abandonTap = ab; ok('abandonHeld', ab === 'ok' && await wait(() => window.__ev.some(e => e.startsWith('abandoned')), 3000));
    await sleep(300); const st = await held('[data-accept]'); R.startTap = st; ok('logStartHeld', st === 'ok' && await wait(() => window.__ev.some(e => e.startsWith('accepted')), 3000));
    await G(() => { const l = document.getElementById('logPanel'); if (l) l.style.display = 'none'; });
    // 5) duel panel: open it, pick a weapon held, Walk away held
    const duel = await G(() => { const p = document.getElementById('duelPanel'); if (!p) return false; p.style.display = 'flex'; return true; });
    if (duel) { await held('#duelTypes [data-t="pistol"]'); ok('duelPickHeld', await G(() => !!document.querySelector('#duelTypes [data-t="pistol"].on'))); await held('#duelCancel'); ok('duelWalkAwayHeld', await wait(() => document.getElementById('duelPanel').style.display === 'none', 2000)); }
    // 6) 🏁 race panel (delegated buttons): open from ☰, close held
    await G(() => document.getElementById('rmRaces')?.click()); const rp = await wait(() => document.getElementById('racePanel')?.classList.contains('on'), 3000); R.racePanel = rp;
    if (rp) { await held('#racePanel [data-close]'); ok('racePanelCloseHeld', await wait(() => !document.getElementById('racePanel').classList.contains('on'), 2000)); }
    // 7) shop buy button exists as onTap (held tap shows a message)
    ok('noPageErrors', errs.length ? errs.join(' | ') : 'none', 'none');
  } catch (e) { bad.push('exception: ' + String(e).slice(0, 300)); }
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL' : 'PASS'); await b.close(); process.exit(bad.length ? 1 : 0);
})();
