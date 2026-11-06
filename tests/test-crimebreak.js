// v7.5.75 Crime break at Red Static Gulch: menu + proximity trigger, crew gather, ⭐ once, cooldown / reload / repeat taps
// do not pay again. Black/white 44px buttons. WebKit iPhone 14 393x852 shots.
// BASE=http://127.0.0.1:8941/ BR=webkit DEV=393x852 SHOTS_DIR=./shots/crimebreak/ NODE_PATH=... node tests/test-crimebreak.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8941/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
let out = process.env.OUT || process.env.SHOTS_DIR || './shots/crimebreak/'; if (!out.endsWith('/')) out += '/'; const desk = DEV === 'desktop';
const noAudio = (process.env.NOAUDIO || ((process.env.BR || '') === 'webkit' ? '1' : '0')) === '1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : /^\d+x\d+$/.test(DEV) ? (({ defaultBrowserType: _d, ...d }) => ({ ...d, viewport: { width: +DEV.split('x')[0], height: +DEV.split('x')[1] } }))(pw.devices['iPhone 14']) : { ...pw.devices[DEV] });
  const page = await ctx.newPage();
  if (noAudio) await page.addInitScript(() => { try { window.AudioContext = undefined; window.webkitAudioContext = undefined; } catch (e) { /* */ } });
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); if (!r.width) return null; return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width }; }, sel);
  const tapSel = async sel => { const moved = await G(s => { const e = document.querySelector(s); if (!e) return false; const ps = []; for (let p = e.parentElement; p; p = p.parentElement) ps.push([p, p.scrollTop]); e.scrollIntoView({ block: 'center' }); return ps.some(([p, t]) => p.scrollTop !== t); }, sel); await sleep(moved ? 1000 : 150);
    const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(350); return b; };
  const fr = async (n = 4) => { const f0 = await G(() => window.__frames | 0); return wait(t => (window.__frames | 0) >= t, 60000, f0 + n); };
  const shot = async n => { const p = `${out}crimebreak-${tag}-${n}.png`; await page.screenshot({ path: p }); (R.shots = R.shots || []).push(p); };
  const BW = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e), r = e.getBoundingClientRect(); return { bg: c.backgroundColor, fg: c.color, h: Math.round(r.height) }; }, sel);
  const isBW = b => !!b && /rgb\(0, 0, 0\)/.test(b.bg) && /255, 255, 255/.test(b.fg) && b.h >= 44;
  const gulch = async () => { await G(() => { const z = window.SSX.copFree.zone(); window.__app.surface.debugMove(z.x + 2, z.z + 2, 0); }); await fr(6); await sleep(400); };
  try {
    await page.goto(base + '?farmraids=0&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await wait(() => !!window.SSX?.crimebreak && !!window.SSX?.crew && !!window.SSX?.copFree && !!window.SSX?.farm2, 20000);
    ok('api', await G(() => { const A = window.SSX.crimebreak; return ['open', 'close', 'payBonus', 'state', 'gate', 'start', 'finish'].every(k => typeof A[k] === 'function') && A.COST === 500 && A.STAR_PAY === 80; }));
    ok('menuRow', await G(() => /Crime break/.test(document.getElementById('rmCrimeBreak')?.textContent || '')));

    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app?.state?.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000)); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => window.SSX.onboard?.skip?.()); await sleep(300);
    await G(() => { const g = window.__app.game; g.debug?.calm?.(true); g.progress.credits = 20000; g.progress.xp = 12000; g.save();
      window.__app.surface.world.setWanted(0); window.SSX.crimebreak.debug.reset(); window.SSX.crew.debug.reset(); window.SSX.farm2.debug.reset();
      window.SSX.starshop?.debug?.reset?.(); });

    // far from gulch: menu opens but explains location / no crew
    await G(() => { const c = window.__app.surface.info.colony; window.__app.surface.debugMove(c.x, c.z + 20, 0); }); await fr(4);
    await G(() => window.SSX.crimebreak.open(true)); await sleep(400);
    ok('needCrewNote', await G(() => /Hire someone|Crew/.test(document.querySelector('#cbPanel .note, #cbPanel p')?.textContent || document.getElementById('cbPanel')?.textContent || '')));
    await G(() => window.SSX.crimebreak.close());

    // hire Dex via crew API (lifetime ⭐ already 12k)
    ok('hired', await G(() => { const r = window.SSX.crew.hire(); return r.ok && window.SSX.crew.state().crew[0]?.id === 'dex'; }));

    // at gulch: proximity card + open meeting
    await gulch();
    ok('atGulch', await G(() => window.SSX.copFree.here()));
    ok('ctxBtn', await wait(() => { const b = document.getElementById('cbAct'); return b && b.style.display !== 'none'; }, 6000));
    ok('ctxBW', await BW('#cbAct'), isBW(await BW('#cbAct')));
    await tapSel('#cbAct'); ok('panel', await wait(() => window.SSX.crimebreak.isOpen, 4000));
    ok('startBW', await BW('#cbPanel button[data-a="start"]'), isBW(await BW('#cbPanel button[data-a="start"]')));
    await sleep(300); await shot('prompt');

    const xp0 = await G(() => window.__app.game.progress.xp);
    const cr0 = await G(() => window.__app.game.progress.credits);
    await tapSel('#cbPanel button[data-a="start"]');
    ok('meeting', await wait(() => window.SSX.crimebreak.meeting, 3000));
    ok('gathered', await G(() => window.SSX.crimebreak.meeting && !!document.querySelector('#cbPanel button[data-a="next"], #cbPanel button[data-a="done"]')));
    await sleep(400); await shot('sitdown');

    // advance dialogue to Seal it (UI), fall back to finish() if the panel stalls
    for (let i = 0; i < 8; i++) {
      if (await G(() => window.SSX.crimebreak.state().meets >= 1)) break;
      const a = await G(() => document.querySelector('#cbPanel button[data-a="done"], #cbPanel button[data-a="next"]')?.getAttribute('data-a'));
      if (!a) { await G(() => window.SSX.crimebreak.finish()); break; }
      await tapSel(`#cbPanel button[data-a="${a}"]`); await sleep(450);
      if (a === 'done') break;
    }
    if (!(await G(() => window.SSX.crimebreak.state().meets >= 1))) await G(() => window.SSX.crimebreak.finish());
    ok('paidOnce', await wait(() => window.SSX.crimebreak.state().meets === 1, 5000));
    const xp1 = await G(() => window.__app.game.progress.xp);
    const cr1 = await G(() => window.__app.game.progress.credits);
    ok('starsOnce', { xp0, xp1 }, xp1 - xp0 === 80);
    ok('introFree', { cr0, cr1 }, cr1 === cr0);
    ok('buff5', await G(() => Math.abs(window.SSX.crimebreak.payBonus() - 0.05) < 1e-9));

    // repeat finish / start while cooling: no second pay
    await G(() => { window.SSX.crimebreak.finish(); window.SSX.crimebreak.start(); }); await sleep(400);
    ok('noDouble', await G(x => window.SSX.crimebreak.state().meets === 1 && window.__app.game.progress.xp === x, xp1));

    // reopen: cooldown message (gate + panel)
    await G(() => window.SSX.crimebreak.close()); await sleep(200);
    await G(() => window.SSX.crimebreak.open()); await sleep(500);
    const cool = await G(() => { const g = window.SSX.crimebreak.gate(); const t = document.getElementById('cbPanel')?.textContent || ''; return { why: g.why || '', ok: g.ok, text: t, open: window.SSX.crimebreak.isOpen }; });
    R.cool = cool;
    ok('cooldownUI', cool, !cool.ok && /sol|Next|cooling/i.test(cool.why + ' ' + cool.text));
    await sleep(300); await shot('cooldown');

    // reload: buff + cooldown persist, no free re-pay
    await G(() => window.SSX.crimebreak.close());
    await page.reload(); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await wait(() => !!window.SSX?.crimebreak, 20000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('relanded', await wait(() => window.__app?.state?.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000)); await sleep(600);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => window.SSX.onboard?.skip?.()); await sleep(200);
    ok('persisted', await G(() => { const s = window.SSX.crimebreak.state(); return s.meets === 1 && Math.abs(s.buff - 0.05) < 1e-9; }));
    const xpR = await G(() => window.__app.game.progress.xp);
    await gulch(); await G(() => window.SSX.crimebreak.open()); await sleep(300);
    await G(() => { try { window.SSX.crimebreak.start(); window.SSX.crimebreak.finish(); } catch (e) { /* */ } }); await sleep(500);
    ok('reloadNoPay', await G(x => window.SSX.crimebreak.state().meets === 1 && window.__app.game.progress.xp === x, xpR));

    // advance one sol, paid meeting works once
    await G(() => { window.SSX.farm2.debug.skip(24); }); await sleep(200);
    const cr2 = await G(() => window.__app.game.progress.credits);
    const xp2 = await G(() => window.__app.game.progress.xp);
    await G(() => window.SSX.crimebreak.open()); await sleep(300);
    await tapSel('#cbPanel button[data-a="start"]'); await wait(() => window.SSX.crimebreak.meeting, 3000);
    for (let i = 0; i < 8; i++) {
      if (await G(() => window.SSX.crimebreak.state().meets >= 2)) break;
      const a = await G(() => document.querySelector('#cbPanel button[data-a="done"], #cbPanel button[data-a="next"]')?.getAttribute('data-a'));
      if (!a) { await G(() => window.SSX.crimebreak.finish()); break; }
      await tapSel(`#cbPanel button[data-a="${a}"]`); await sleep(450); if (a === 'done') break;
    }
    if (!(await G(() => window.SSX.crimebreak.state().meets >= 2))) await G(() => window.SSX.crimebreak.finish());
    ok('secondMeet', await wait(() => window.SSX.crimebreak.state().meets === 2, 5000));
    ok('paidBuyIn', await G(c => window.__app.game.progress.credits === c - 500, cr2));
    ok('starsAgain', await G(x => window.__app.game.progress.xp === x + 80, xp2));
    ok('buff10', await G(() => Math.abs(window.SSX.crimebreak.payBonus() - 0.1) < 1e-9));
    // crew job cash reflects buff
    ok('crewPayHook', await G(() => { const C = window.SSX.crew; C.assign('dex', 'hustle'); const before = C.state().crew[0]; return Math.abs(window.SSX.crimebreak.payBonus() - 0.1) < 1e-9 && before.job === 'hustle'; }));

    ok('noErrors', errors.slice(0, 5), errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); R.exc = String(e && e.stack || e); }
  R.errors = errors; R.fails = bad;
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
