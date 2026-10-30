// 💾 Save Code e2e (savecode.js): build a farm + progress in context A, export, load the code into a fresh context B through
// ☰ → 💾 Save Code (paste, Load code, confirm), reload, and check the farm is owned with its racks and credits + XP match.
// Also: a bad code shows a friendly error and changes nothing; Undo is offered after a load; 44px+; black/white; 0 console errors.
// BASE=http://127.0.0.1:8917/ BR=webkit DEV="iPhone 14" OUT=./shots/savecode/ node tests/test-savecode.js  (one browser at a time)
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8917/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || process.env.SHOTS_DIR || './shots/savecode/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const dev = desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV], ...(DEV === 'iPhone 14' ? { viewport: { width: 393, height: 852 }, screen: { width: 393, height: 852 } } : {}) };
  delete dev.defaultBrowserType;
  const tag = `${DEV}-${BR}${process.env.NOGZ ? '-nogz' + process.env.NOGZ : ''}`.replace(/\W+/g, '-').toLowerCase(), R = { tag }, bad = [], errors = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  // NOGZ=B (or A, or AB): that device has no CompressionStream / DecompressionStream, like iOS Safari / iOS Chrome before 16.4
  const NOGZ = process.env.NOGZ || '';
  const mk = async name => { const ctx = await browser.newContext(dev); if (NOGZ.includes(name)) await ctx.addInitScript(() => { try { delete window.CompressionStream; delete window.DecompressionStream; window.CompressionStream = undefined; window.DecompressionStream = undefined; } catch (e) { /* */ } }); const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(name + ' PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(name + ' CE ' + m.text()); }); return { ctx, page }; };
  const H = page => {
    const G = (f, a) => page.evaluate(f, a);
    const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
    const fr = async (n = 4) => { const f0 = await G(() => window.__frames | 0); return wait(t => (window.__frames | 0) >= t, 60000, f0 + n); };
    const box = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); if (!r.width) return null; const cs = getComputedStyle(e); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, bg: cs.backgroundColor, fg: cs.color }; }, sel);
    const tapSel = async sel => { await G(s => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel); await sleep(150); const b = await box(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(250); return b; };
    const boot = async () => { await wait(() => window.__frames > 3 && !document.getElementById('loading') && !!window.SSX?.savecode && !!window.SSX?.farm && !!window.__app?.game?.progress, 120000); await sleep(500); };
    const land = async () => { await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
      await wait(() => window.__app?.state?.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(800);
      if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click()); };
    return { G, wait, fr, box, tapSel, boot, land };
  };
  let shotN = 0; const shot = async (page, name) => { if (desk) return; await sleep(300); const f = `savecode-${++shotN}-${name}-${tag}.png`; await page.screenshot({ path: out + f }); (R.shots ||= []).push(out + f); };
  try {
    // ---- device A: build a farm + progress ----
    const A = await mk('A'), a = H(A.page);
    await A.page.goto(base + '?farmraids=0&t=' + Date.now()); await a.boot(); await a.G(() => localStorage.clear()); await A.page.reload(); await a.boot();
    await a.land();
    await a.G(() => { const g = window.__app.game; g.debug?.calm?.(true); g.progress.credits = 20000; g.save(); window.__app.surface.world.setWanted(0); window.SSX.farm.debug.noRaids?.(true); window.SSX.farm.debug.goto('farm'); });
    await a.fr(6);
    const built = [], why = [];
    for (const step of ['buy', 'buildDome', 'addRack', 'addRack', 'plant']) { const r = await a.G(s => { const F = window.SSX.farm; return s === 'plant' ? F.plant(0, 'potato') : F[s](); }, step); built.push(!!r?.ok); why.push(r?.msg || r?.why || r?.text || ''); await a.fr(3); await sleep(1300); }
    R.buildMsgs = why;
    await a.G(() => { const g = window.__app.game; g.progress.xp = 3800; g.save(); });
    const fa = await a.G(() => window.SSX.farm.status()), pa = await a.G(() => ({ xp: window.__app.game.progress.xp, credits: window.__app.game.progress.credits }));
    ok('builtA', { built, owned: fa.owned, racks: fa.racks.length, pa }, built.every(Boolean) && fa.owned && fa.dome && fa.racks.length === 2 && fa.racks[0].crop === 'potato');
    const code = await a.G(() => window.SSX.savecode.export());
    R.codeLen = code.length; R.keysA = await a.G(() => window.SSX.savecode.keys());
    ok('codeShape', code.slice(0, 12), (NOGZ.includes('A') ? /^SSX1-j\.[A-Za-z0-9_-]+$/ : /^SSX1-g\.[A-Za-z0-9_-]+$/).test(code));
    // the panel on A shows the same kind of code
    await a.G(() => document.getElementById('rmSaveCode').click()); await a.wait(() => /^SSX1-/.test(document.getElementById('scOut')?.value || ''), 10000);
    ok('panelCodeA', await a.G(() => /^SSX1-[gj]\./.test(document.getElementById('scOut').value)));
    await A.ctx.close();
    // ---- device B: fresh browser ----
    const B = await mk('B'), b = H(B.page);
    await B.page.goto(base + '?farmraids=0&t=' + Date.now()); await b.boot();
    const pb0 = await b.G(() => ({ xp: window.__app.game.progress.xp, credits: window.__app.game.progress.credits, owned: window.SSX.farm.status().owned }));
    ok('freshB', pb0, pb0.xp === 0 && !pb0.owned);
    ok('menuItem', await b.G(() => /💾 Save Code/.test(document.getElementById('rmSaveCode')?.textContent || '')));
    await b.G(() => document.getElementById('rmSaveCode').click()); await b.wait(() => document.getElementById('scPanel')?.classList.contains('show') && /^SSX1-/.test(document.getElementById('scOut')?.value || ''), 10000);
    ok('perDeviceLine', await b.G(() => document.querySelector('#scPanel .note')?.textContent), /Progress is saved per device and browser\. Use this code to move it\./.test(await b.G(() => document.querySelector('#scPanel .note')?.textContent || '')));
    const sizes = []; for (const s of ['#scCopy', '#scDl', '#scLoad', '#scFileBtn', '#scClose']) { const x = await b.box(s); sizes.push({ s, h: x?.h, w: x?.w, bg: x?.bg, fg: x?.fg }); }
    ok('targets', sizes, sizes.every(x => x.h >= 44 && x.w >= 44 && x.bg === 'rgb(0, 0, 0)' && x.fg === 'rgb(255, 255, 255)'));
    await shot(B.page, 'panel');
    // copy (clipboard may be refused in a headless browser: either way a plain message)
    await b.tapSel('#scCopy'); ok('copyMsg', await b.G(() => document.getElementById('scMsg').textContent), /copied|selected/i.test(await b.G(() => document.getElementById('scMsg').textContent)));
    // bad code: friendly error, nothing changes
    // compare the saves an import would replace (progress, farm, credits) + our own staging keys. The game's own clock / ambient
    // autosaves (ssx.time.v1 etc.) tick on their own, which made a WebKit run flake here; any change is listed in R.badCodeDiff.
    const snap = () => b.G(() => { const o = {}; for (const k of Object.keys(localStorage).sort()) o[k] = localStorage.getItem(k); return o; });
    const WATCH = /^ssx\.(progress\.v1|farm\.v1|stars\.v1|savecode\.)/;
    const before = await snap();
    await b.G(() => { document.getElementById('scIn').value = 'SSX1-g.thisisnotarealcode'; }); await b.tapSel('#scLoad'); await b.wait(() => /Nothing was changed/.test(document.getElementById('scMsg').textContent), 5000);
    ok('badCode', await b.G(() => document.getElementById('scMsg').textContent), /Nothing was changed/.test(await b.G(() => document.getElementById('scMsg').textContent)) && !(await b.G(() => !!document.getElementById('scYes'))));
    { const after = await snap(), diff = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(k => before[k] !== after[k]); R.badCodeDiff = diff;
      ok('badCodeNoChange', diff.filter(k => WATCH.test(k)), !diff.some(k => WATCH.test(k))); }
    await shot(B.page, 'bad-code');
    // paste the real code, Load, confirm
    await b.G(c => { const t = document.getElementById('scIn'); t.value = c; t.dispatchEvent(new Event('input')); }, code);
    await b.tapSel('#scLoad'); await b.wait(() => !!document.getElementById('scYes'), 5000);
    ok('confirmText', await b.G(() => document.querySelector('#scConfirm .confirm')?.textContent), /Replace the progress on this device\?/.test(await b.G(() => document.querySelector('#scConfirm .confirm')?.textContent || '')));
    await shot(B.page, 'confirm');
    const nav = B.page.waitForNavigation({ timeout: 60000 }).catch(() => null);
    const yesBox = await b.tapSel('#scYes'); R.afterYes = await b.G(() => ({ msg: document.getElementById('scMsg')?.textContent, pending: !!localStorage.getItem('ssx.savecode.pending') })).catch(e => 'nav ' + e.message.slice(0, 40)); R.yesBox = yesBox;
    R.navOk = !!(await nav); await b.boot();
    const fb = await b.G(() => window.SSX.farm.status()), pb = await b.G(() => ({ xp: window.__app.game.progress.xp, credits: window.__app.game.progress.credits }));
    ok('farmMoved', { owned: fb.owned, dome: fb.dome, racks: fb.racks.map(r => r.crop) }, fb.owned && fb.dome && fb.racks.length === 2 && fb.racks[0].crop === 'potato');
    ok('progressMoved', { pa, pb }, pb.xp === pa.xp && pb.credits === pa.credits);
    ok('applied', await b.G(() => window.SSX.savecode.applied), (await b.G(() => window.SSX.savecode.applied))?.n >= 3);
    ok('backupKept', await b.G(() => window.SSX.savecode.backup), !!(await b.G(() => window.SSX.savecode.backup)));
    // reload again: still there (no stale overwrite)
    await B.page.reload(); await b.boot();
    const fb2 = await b.G(() => window.SSX.farm.status()), pb2 = await b.G(() => ({ xp: window.__app.game.progress.xp, credits: window.__app.game.progress.credits }));
    ok('persists', { owned: fb2.owned, racks: fb2.racks.length, pb2 }, fb2.owned && fb2.racks.length === 2 && pb2.xp === pa.xp && pb2.credits === pa.credits);
    await b.G(() => document.getElementById('rmSaveCode').click()); await b.wait(() => /^SSX1-/.test(document.getElementById('scOut')?.value || ''), 10000);
    ok('undoOffered', await b.G(() => !!document.getElementById('scUndo')));
    await shot(B.page, 'after-load');
    await B.ctx.close();
    ok('noErrors', errors.slice(0, 5), errors.length === 0);
  } catch (e) { bad.push('EXC ' + e.message); }
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL ' + bad.join(', ') + ` | console errors: ${errors.length}` : 'PASS ' + tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
