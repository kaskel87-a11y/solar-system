// Regression: Wolde's "Discovery" (wolde-02-discovery) used to end itself on its heist step. The impound heist has
// alarm.failAt 4, and heist.js counted stars you already had, so walking in at 4★ blew the job on the first frame
// ("4★ before you got clean") and storymars2 failed the mission. Now only stars the job raises count.
// Plays it at 4★ on a phone: the job holds, break in -> crack -> get clear -> the mission moves on to "Lose the heat".
// BASE=http://127.0.0.1:8994/ BR=webkit OUT=/tmp/ node tests/test-wolde-heist.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8994/', BR = process.env.BR || 'webkit', desk = process.env.DEV === 'desktop';
const out = process.env.OUT || require('path').join(__dirname, '..', 'shots') + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const ctx = await browser.newContext(desk ? { viewport: { width: 1280, height: 800 } } : { ...iph, viewport: { width: 393, height: 852 }, screen: { width: 393, height: 852 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('wh')) { sessionStorage.setItem('wh', 1); localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); }
    window.__hlog = []; for (const e of ['start', 'stage', 'safe:result', 'escape', 'done', 'fail']) addEventListener('heist:' + e, ev => window.__hlog.push([e, ev.detail])); });
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  const errors = []; page.on('pageerror', e => /audio device/i.test(e.message) || errors.push(e.message.slice(0, 200)));
  const G = (f, a) => page.evaluate(f, a), bad = [], tag = `wolde-heist-${desk ? '1280x800' : '393x852'}-${BR}`;
  const ok = (k, v, c) => { if (c === undefined) c = v; if (!c) bad.push(k); console.log(c ? 'ok  ' : 'FAIL', k, typeof v === 'object' ? JSON.stringify(v) : v); };
  const wait = (f, ms = 30000, a) => page.waitForFunction(f, a, { timeout: ms, polling: 150 }).then(() => true, () => false);
  const shot = async n => { try { await page.screenshot({ path: `${out}${tag}-${n}.png`, timeout: 120000 }); console.log('shot', `${out}${tag}-${n}.png`); } catch (e) { console.log('shot failed', e.message); } };
  const heal = () => G(() => window.__app.game.restore());
  const move = (x, z, yaw = 0) => G(([x, z, yaw]) => window.__app.surface.debugMove(x, z, yaw), [x, z, yaw]);
  const press = async () => { if (desk) await page.keyboard.press('KeyG'); else await G(() => { const b = document.getElementById('heistBtn'), r = b.getBoundingClientRect(), o = { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; b.dispatchEvent(new PointerEvent('pointerdown', o)); b.dispatchEvent(new PointerEvent('pointerup', o)); }); };
  const state = () => G(() => { const g = window.__app.game, a = window.SSX.heist.active; return { quest: g.info.quest?.id || null, step: g.info.quest?.step, text: g.info.quest?.text, stage: a?.stage || null, wanted: window.__app.surface.world.wanted, fail: (window.__hlog.find(e => e[0] === 'fail') || [])[1]?.fail || null }; });
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 240000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 240000); await sleep(1500);
    await G(() => { document.getElementById('radioLater')?.click(); });
    // ---- walk in hot: 4★ from earlier trouble, then take Wolde's job
    await G(() => window.__app.surface.world.setWanted(4, 'test: earlier trouble'));
    ok('accepted Discovery at 4★', await G(() => window.__app.game.accept('wolde-02-discovery') && window.__app.surface.world.wanted === 4));
    await wait(() => !!window.SSX.heist.active?.w, 8000); await sleep(3000);
    const s0 = await state();
    ok('the heist step holds at 4★ (was: blown on frame 1, mission over)', s0, s0.quest === 'wolde-02-discovery' && s0.step === 0 && s0.stage === 'case' && !s0.fail);
    // 4★ ColSec busts you on contact, so let the old heat cool before playing the job (this test is about the mission, not the chase)
    await G(() => window.__app.surface.world.setWanted(0, 'test: old heat cooled')); await sleep(1500);
    ok('still on the job after cooling off', await G(() => window.SSX.heist.active?.stage === 'case' && window.__app.game.info.quest?.id === 'wolde-02-discovery'));
    await G(() => { window.__healT = setInterval(() => window.__app.game.restore(), 100); });
    // ---- play it: break in, crack the locker, get clear
    const w = await G(() => { const a = window.SSX.heist.active; for (const c of window.SSX.heist.cameras()) if (c.heistId === a.id) window.SSX.heist.disableCamera?.(c.id, 600); return a.w; });
    await heal(); await move(w.door.x, w.door.z + 0.8, 0);
    ok('break-in button', await wait(() => window.SSX.heist.action === '🔓 Break in', 8000));
    await press(); ok('inside', await wait(() => window.SSX.heist.active?.stage === 'crack', 8000));
    await heal(); await move(w.safe.x, w.safe.z + 0.6, 0);
    ok('crack button', await wait(() => window.SSX.heist.action === '🔐 Crack safe', 8000));
    await press(); ok('safe dial up', await wait(() => !!document.getElementById('hsDial'), 6000)); await sleep(500);
    const dial = await G(() => { const r = document.getElementById('hsDial').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width * 0.42 }; });
    await G(async (dial) => {
      const root = document.getElementById('hsSafe'), sl = ms => new Promise(r => setTimeout(r, ms));
      const pt = a => ({ clientX: dial.x + dial.R * Math.sin(a * Math.PI / 180), clientY: dial.y - dial.R * Math.cos(a * Math.PI / 180) });
      const P = (type, a) => root.dispatchEvent(new PointerEvent(type, { pointerId: 11, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, ...pt(a) }));
      for (let guard = 0; guard < 8; guard++) {
        const s = window.SSX.heist.debug.safe(); if (!s || s.done) break; window.__app.game.restore();
        let a = s.angle; const tg = s.targets[s.idx]; P('pointerdown', a);
        let diff = ((tg - a) % 360 + 540) % 360 - 180;
        while (Math.abs(diff) > 1.5) { const st = Math.sign(diff) * Math.min(2.5, Math.abs(diff)); a += st; diff -= st; P('pointermove', a); await new Promise(r => requestAnimationFrame(r)); }
        await sl(950); P('pointerup', a); await sl(100);
      }
    }, dial);
    ok('locker cracked', await wait(() => window.__hlog.some(e => e[0] === 'safe:result' && e[1].success), 30000));
    ok('escape stage', await wait(() => window.SSX.heist.active?.stage === 'escape', 5000));
    await G(() => window.__app.surface.world.setWanted(1, 'test: a guard saw you leave')); // a little heat so "Lose the heat" has something to lose
    for (let k = 1; k <= 6 && (await G(() => window.SSX.heist.active?.stage === 'escape')); k++) { await heal(); await move(w.site.x + 30 * k, w.site.z + 30 * k, 0); await sleep(700); }
    ok('got clear (heist:escape)', await wait(() => window.__hlog.some(e => e[0] === 'escape'), 15000));
    ok('mission moves on to "Lose the heat"', await wait(() => window.__app.game.info.quest?.id === 'wolde-02-discovery' && window.__app.game.info.quest.step === 1, 10000));
    const s1 = await state(); ok('never blown', s1, !s1.fail && /Lose the heat/i.test(s1.text || ''));
    await G(() => clearInterval(window.__healT)); await G(() => window.SSX.missionHelp?.close?.()); await sleep(800); await shot('lose-the-heat');
    await G(() => window.__app.surface.world.setWanted(0, 'test: lost them'));
    ok('mission completes', await wait(() => !!window.__app.game.progress.quests?.['wolde-02-discovery']?.everDone, 10000));
    ok('no page errors', errors, !errors.length);
  } catch (e) { console.log('CRASH', e.stack); bad.push('crash'); }
  console.log(JSON.stringify({ tag, bad })); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
