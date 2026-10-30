// money boost e2e: a Mars job pays payoutMult x on the phone, the toast shows the doubled amount, a second job inside
// 4 minutes adds the plain-word streak bonus, and a knocked-out NPC near you drops 20-80 cr once (far away: nothing).
// BASE=http://127.0.0.1:8996/ BR=webkit OUT=/tmp/ node tests/test-economy.js   (DEV=desktop for 1280x800)
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8996/', BR = process.env.BR || 'webkit', desk = process.env.DEV === 'desktop';
const out = process.env.OUT || require('path').join(__dirname, '..', 'shots') + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const ctx = await browser.newContext(desk ? { viewport: { width: 1280, height: 800 } } : { ...iph, viewport: { width: 393, height: 852 }, screen: { width: 393, height: 852 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('ec')) { sessionStorage.setItem('ec', 1); localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); } });
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  const errors = []; page.on('pageerror', e => /audio device/i.test(e.message) || errors.push(e.message.slice(0, 200)));
  const G = (f, a) => page.evaluate(f, a), bad = [], tag = `economy-${desk ? '1280x800' : '393x852'}-${BR}`;
  const ok = (k, v, c) => { if (c === undefined) c = v; if (!c) bad.push(k); console.log(c ? 'ok  ' : 'FAIL', k, typeof v === 'object' ? JSON.stringify(v) : v); };
  const wait = (f, ms = 30000, a) => page.waitForFunction(f, a, { timeout: ms, polling: 100 }).then(() => true, () => false);
  const shot = async n => { try { await page.screenshot({ path: `${out}${tag}-${n}.png`, timeout: 120000 }); console.log('shot', `${out}${tag}-${n}.png`); } catch (e) { console.log('shot failed', e.message); } };
  const cr = () => G(() => window.__app.game.progress.credits);
  const job = type => G(type => new Promise(res => { const J = window.SSX.jobs; let off = null; const t = setTimeout(() => res({ err: 'no complete' }), 8000);
    off = J.on('complete', e => { clearTimeout(t); off?.(); res({ pay: e.pay, base: e.base, tip: e.tip }); }); const s = J.start(type); if (!s.ok) { clearTimeout(t); res({ err: s.msg }); return; } J.debug.complete(); }), type);
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 240000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 240000); await sleep(1500);
    await G(() => { document.getElementById('radioLater')?.click(); window.SSX.control?.debug?.next?.(9999); });
    ok('one knob: SSX.economy.payoutMult = 2', await G(() => window.SSX.economy?.payoutMult), await G(() => window.SSX.economy?.payoutMult === 2));
    await G(() => window.SSX.economy.debug.reset());
    // ---- job 1: vigilante bounty
    const c0 = await cr(); const j1 = await job('vigilante'); const c1 = await cr();
    ok('vigilante pays 2x (bounty + speed bonus)', { ...j1, got: c1 - c0 }, !j1.err && j1.pay === 2 * (j1.base + j1.tip) && c1 - c0 === j1.pay);
    ok('toast shows the doubled pay', await wait(p => (document.getElementById('toast')?.textContent || '').includes(`+${p} cr`), 3000, j1.pay), await G(() => document.getElementById('toast')?.textContent));
    await sleep(300); await shot('doubled-payout');
    // ---- job 2 inside 4 minutes: streak bonus (age the clock past the 20 s same-job guard)
    await sleep(3000); await G(() => window.SSX.economy.debug.ageStreak(30));
    const c2 = await cr(); const j2 = await job('vigilante'); await sleep(300); const c3 = await cr();
    ok('2nd job: 2x pay + 25 cr streak', { ...j2, got: c3 - c2 }, !j2.err && c3 - c2 === j2.pay + 25);
    ok('plain-word streak toast', await wait(() => /2 jobs back to back: \+25 cr bonus/.test(document.getElementById('toast')?.textContent || ''), 9000), await G(() => document.getElementById('toast')?.textContent));
    await sleep(300); await shot('streak-bonus');
    // ---- knocked-out NPC near you drops once; far away pays nothing
    const k = await G(() => { const i = window.__app.surface.info, P = window.__app.game.progress, a = P.credits;
      dispatchEvent(new CustomEvent('ssx:npc-down', { detail: { x: i.x + 3, z: i.z, name: 'Junkie' } })); const b = P.credits;
      dispatchEvent(new CustomEvent('ssx:npc-down', { detail: { x: i.x + 500, z: i.z, name: 'Junkie' } })); return { near: b - a, far: P.credits - b }; });
    ok('KO drop near: 20-80 cr, far: 0', k, k.near >= 20 && k.near <= 80 && k.far === 0);
    ok('no page errors', errors, !errors.length);
  } catch (e) { console.log('CRASH', e.stack); bad.push('crash'); }
  console.log(JSON.stringify({ tag, bad })); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
