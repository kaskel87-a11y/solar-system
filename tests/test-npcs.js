// Mission NPCs e2e (WebKit phone 393x852): 1) both Halvorsen Villa guards come out at the phone NPC cap with street
// pedestrians around, the total stays <= 12 and the slots go back when the job ends; 2) Juno Pike at the Cantina
// door gives the Sable/Halvorsen tip by a context button and unlocks ☰ Heists (and repeats it, no double unlock).
// BASE=http://127.0.0.1:8991/ OUT=/workspace/pw-ben-npcs/shots/ node tests/test-npcs.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8991/', BR = process.env.BR || 'webkit';
const out = process.env.OUT || require('path').join(__dirname, '..', 'shots') + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = `npcs-393x852-${BR}`, bad = [];
const ok = (k, v, cond) => { if (cond === undefined) cond = v; if (!cond) bad.push(k); console.log(cond ? 'ok  ' : 'FAIL', k, typeof v === 'object' ? JSON.stringify(v) : v); };
async function open(browser, unlock) {
  const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const ctx = await browser.newContext({ ...iph, viewport: { width: 393, height: 852 }, screen: { width: 393, height: 852 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  const errors = []; page.on('pageerror', e => /audio device/i.test(e.message) || errors.push('PE ' + e.message.slice(0, 200)));
  const G = (f, a) => page.evaluate(f, a);
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const frames = n => G(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const shot = async name => { for (let i = 0; i < 2; i++) { try { await page.screenshot({ path: `${out}${tag}-${name}.png`, timeout: 120000 }); return true; } catch (e) {} } return false; };
  const tapEl = sel => G(async sel => { const b = document.querySelector(sel); if (!b || !b.offsetParent) return false; const r = b.getBoundingClientRect(), o = { pointerId: 62, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
    b.dispatchEvent(new PointerEvent('pointerdown', o)); await new Promise(r => setTimeout(r, 60)); b.dispatchEvent(new PointerEvent('pointerup', o)); return true; }, sel);
  await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 240000);
  await G(u => { localStorage.clear(); localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"done":true,"skipped":true}'); if (u) localStorage.setItem('ssx.heist.unlock', u); window.__app.game?.reload?.(); }, unlock || '');
  await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
  await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 240000); await sleep(1500);
  await G(() => document.getElementById('radioLater')?.click());
  return { ctx, page, G, wait, frames, shot, tapEl, errors };
}
// NPC count the way world.js counts it: live pedestrians + foot security + humans (activeNPCs) + reserved bodies
const COUNT = () => { const W = window.__app.surface.world, b = W.npcBudget(); return { live: W.debug.livePeople(), active: W.debug.activeNPCs(), reserved: b.reserved, total: b.used, cap: b.cap, slots: window.__npcSlots.list, floor: window.__npcSlots.floor }; };
(async () => {
  const browser = await pw[BR].launch();
  try {
    // ================= 1. villa guards at the phone cap =================
    {
      const T = await open(browser, '{"v":1,"unlocked":true,"tipped":true,"at":0}'); const { G, wait, frames, shot, tapEl } = T;
      // another add-on (events / turf) already holds 7 slots: with the 4 ambient floor the phone is nearly full
      await G(() => window.__app.surface.world.npcReserve('testFill', 7));
      await G(() => { const W = window.__app.surface.world, c = W.colonyAt([370, 85]); window.__app.surface.debugMove(c.x + 13, c.z + 19, 0); });
      ok('villa built', await wait(() => !!window.__villa?.state, 15000));
      await G(() => window.__villa.blind(true)); await sleep(1500);
      const pre = await G(COUNT); ok('phone budget full before the job (ambient peds present)', pre, pre.cap === 12 && pre.live >= 4 && pre.total >= 11);
      ok('before the job: the normal budget has no room for both guards', await G(() => window.__villa.state.guards.length), await G(() => window.__villa.state.guards.length < 2));
      await G(() => document.getElementById('radio') && (document.getElementById('radio').style.display = 'none'));
      await tapEl('#menuBtn'); await sleep(400); await tapEl('#heistMenu'); await wait(() => document.getElementById('heistPanel')?.classList.contains('on'), 5000);
      await tapEl('#heistPanel button[data-id="heist-halvorsen-villa"]'); ok('villa heist started', await wait(() => window.SSX.heist.active?.id === 'heist-halvorsen-villa', 8000));
      ok('both guards out on a phone', await wait(() => window.__villa.state.guards.length === 2, 5000), await G(() => window.__villa.state.guards.map(g => g.id + ':' + (g.room || 'yard'))));
      await sleep(800); const mid = await G(COUNT);
      ok('guards hold critical slots', mid.slots, mid.slots.villaGuards?.n === 2 && mid.slots.villaGuards.critical && mid.floor === 0);
      ok('ambient peds trimmed but still around', mid.live, mid.live >= 1 && mid.live < pre.live);
      ok('total NPCs <= 12', mid, mid.total <= 12 && mid.live + mid.active - mid.live + 2 + 7 <= 12);
      // shot: from the hall (roof cut away), hall guard close, yard guard through the front windows / doorway
      await G(() => { for (const c of window.SSX.heist.cameras()) window.SSX.heist.disableCamera(c.id, 120); }); // power's out for the photo
      await G(() => { window.__villa.freeze(true); window.__villa.guardAt('hv-guard-hall', 3.8); window.__villa.guardAt('hv-guard-yard', 12.85); });
      await G(() => { const s = window.__villa.state; window.__app.surface.debugMove(s.x + 1.5, s.z + 0.6, Math.atan2(3.25, -5.65)); }); // in the hall, looking out at the street
      await frames(30); const gp = await G(() => window.__villa.state.guards.map(g => [g.id, Math.round(g.x - window.__villa.state.x), Math.round(g.z - window.__villa.state.z)]));
      console.log('guards at', JSON.stringify(gp)); await shot('villa-both-guards'); await G(() => window.__villa.freeze(false));
      // ---- the job ends (quit): slots go back, the floor returns
      await G(() => window.SSX.heist.abortHeist?.('test quit')); await wait(() => !window.SSX.heist.active, 5000); await sleep(800);
      ok('quit: floor back at once', await G(() => window.__npcSlots.floor === 4 && !window.__npcSlots.list.villaGuards?.critical));
      await sleep(6500);
      const post = await G(COUNT);
      ok('quit: guard slots no longer critical, back on the normal budget', post.slots, !post.slots.villaGuards?.critical && post.floor === 4 && (post.slots.villaGuards?.n || 0) < 2);
      ok('total NPCs <= 12 after', post, post.total <= 12);
      // ---- leaving the area releases the guard slots completely
      await G(() => { const W = window.__app.surface.world, c = W.colonyAt([0, 0]); window.__app.surface.debugMove(c.x, c.z + 26, 0); }); await sleep(1500);
      ok('leaving: guard slots released', await G(COUNT), await G(() => !window.__npcSlots.list.villaGuards && !window.__app.surface.world.npcBudget().reserved.villaGuards));
      await G(() => window.__app.surface.world.npcReserve('testFill', 0));
      ok('no page errors (villa)', T.errors, T.errors.length === 0);
      await T.ctx.close();
    }
    // ================= 2. Juno Pike, the bar contact =================
    {
      const T = await open(browser, ''); const { G, wait, frames, shot, tapEl } = T;
      const menuHas = () => G(() => !!document.getElementById('heistMenu'));
      const toJuno = (dx = 0, dz = 2) => G(([dx, dz]) => { const W = window.__app.surface.world, c = W.colonyAt([35, -10]); window.__app.surface.debugMove(c.x + dx, c.z + dz, Math.atan2(-(-dx), -(-dz))); }, [dx, dz]);
      await toJuno(0, 2); ok('Juno stands by the Cantina door', await wait(() => window.__barContact.state.body, 8000), await G(() => window.__app.surface.world.districtAt()?.name));
      ok('Juno on open ground', await G(() => { const W = window.__app.surface.world, c = W.colonyAt([35, -10]); return !W.collide(c.x, c.z, 0.6); }));
      ok('no button before the unlock', await G(() => !document.getElementById('barContactBtn')?.offsetParent));
      const ids = await G(async () => (await import('./citydata.js')).CITY_MISSIONS.map(m => m.id));
      for (let k = 0; k < 3; k++) await G(id => { const P = window.__app.game.progress; P.quests[id] = { status: 'done', everDone: true, step: 0, n: 0 }; window.__app.game.save?.(); }, ids[k]);
      ok('button shows next to Juno after 3 city missions', await wait(() => !!document.getElementById('barContactBtn')?.offsetParent, 5000));
      ok('Sable holds the text while you are at the door', await G(() => !/Halvorsen/.test(document.getElementById('radioText')?.textContent || '') && !JSON.parse(localStorage.getItem('ssx.heist.unlock') || '{}').tipped));
      await tapEl('#barContactBtn');
      ok('Juno gives the tip', await wait(() => /Halvorsen Villa/.test(document.getElementById('radioText')?.textContent || ''), 5000), await G(() => document.getElementById('radioText')?.textContent));
      await G(() => document.getElementById('radio')?.classList.remove('mini')); await frames(6); await shot('bar-contact-tip');
      const s1 = await G(() => JSON.parse(localStorage.getItem('ssx.heist.unlock')));
      ok('tip given + unlocked', s1, s1.unlocked && s1.tipped);
      ok('☰ Heists entry appears', await wait(() => !!document.getElementById('heistMenu'), 4000));
      ok('the villa is on the heist board once', await G(() => window.SSX.heist.heists().filter(h => h.id === 'heist-halvorsen-villa').length === 1));
      // walk away: the button hides, Sable never doubles up
      await toJuno(0, 8); await frames(10); ok('button hides when you step away', await G(() => !document.getElementById('barContactBtn')?.offsetParent));
      await G(() => { const W = window.__app.surface.world, c = W.colonyAt([0, 0]); window.__app.surface.debugMove(c.x, c.z + 40, 0); }); await sleep(2500);
      ok('no second text from Sable', await G(() => !/Word gets around/.test(document.getElementById('radioText')?.textContent || '')));
      // back again: Juno repeats it, nothing unlocks twice
      await toJuno(-0.8, 2.2); await wait(() => !!document.getElementById('barContactBtn')?.offsetParent, 4000);
      await G(() => { const R = document.getElementById('radio'); if (R) R.style.display = 'none'; }); await frames(4); await shot('bar-contact-button');
      await G(() => { const R = document.getElementById('radio'); if (R) R.style.display = ''; });
      await tapEl('#barContactBtn'); ok('Juno repeats the tip', await wait(() => /already texted/.test(document.getElementById('radioText')?.textContent || ''), 4000));
      const s2 = await G(() => JSON.parse(localStorage.getItem('ssx.heist.unlock')));
      ok('no double unlock', s2, s2.at === s1.at && await G(() => window.SSX.heist.heists().filter(h => h.id === 'heist-halvorsen-villa').length === 1));
      ok('no page errors (bar)', T.errors, T.errors.length === 0);
      await T.ctx.close();
    }
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 200)); console.log('EXC', e.message.slice(0, 400)); }
  await browser.close();
  console.log(JSON.stringify({ tag, bad })); process.exit(bad.length ? 1 : 0);
})();
