// v7.5.9 💾 Save Code: the game open in a 2nd tab must not undo an import. Tab 1 loads a code (UI: paste, Load, Yes); tab 2 keeps
// autosaving its old progress every 100 ms the whole time. After both reload, both show the imported credits / XP, tab 2 got the
// "loading in another tab" notice, and the importing tab stopped writing game saves once the import was staged.
// BASE=http://127.0.0.1:8866/ BR=webkit DEV="iPhone 14" node tests/test-savecode-tabs.js   (DEV=desktop for 1366x768)
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8866/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const dev = desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV], viewport: { width: 393, height: 852 }, screen: { width: 393, height: 852 } }; delete dev.defaultBrowserType;
  const ctx = await browser.newContext(dev), R = {}, bad = [], errors = [];
  const ok = (k, v, c) => { R[k] = v; if (!c) bad.push(k); };
  const mk = async () => { const p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message.slice(0, 160))); return p; };
  const boot = p => p.waitForFunction(() => window.__frames > 3 && !document.getElementById('loading') && !!window.SSX?.savecode && !!window.__app?.game?.progress, null, { timeout: 180000, polling: 150 });
  try {
    // the code to import: 7777 cr / 4321 xp, made from a throwaway save on this origin
    const p1 = await mk(); await p1.goto(base + '?t=' + Date.now()); await boot(p1);
    await p1.evaluate(() => { const g = window.__app.game; g.progress.credits = 7777; g.progress.xp = 4321; g.save(); });
    const code = await p1.evaluate(() => window.SSX.savecode.export());
    await p1.evaluate(() => { const g = window.__app.game; g.progress.credits = 11; g.progress.xp = 22; g.save(); });
    const p2 = await mk(); await p2.goto(base + '?t=' + Date.now()); await boot(p2);
    // tab 2 keeps saving its old progress (11 / 22) like a running game does, on a fast timer
    await p2.evaluate(() => { const g = window.__app.game; g.progress.credits = 11; g.progress.xp = 22; window.__spam = setInterval(() => { try { g.save(); } catch (e) { } }, 100); window.__notice = ''; const t = window.__app.toast; window.__app.toast = (m, ms) => { window.__notice += m + ' | '; return t?.(m, ms); }; });
    // tab 1: UI import
    await p1.evaluate(() => document.getElementById('rmSaveCode').click()); await p1.waitForFunction(() => /^SSX1-/.test(document.getElementById('scOut')?.value || ''), null, { timeout: 15000 });
    await p1.evaluate(c => { document.getElementById('scIn').value = c; }, code); await p1.evaluate(() => document.getElementById('scLoad').click());
    await p1.waitForFunction(() => !!document.getElementById('scYes'), null, { timeout: 8000 });
    const nav1 = p1.waitForNavigation({ timeout: 60000 }).catch(() => null), nav2 = p2.waitForNavigation({ timeout: 60000 }).catch(() => null);
    await p1.evaluate(() => document.getElementById('scYes').click());
    R.lockedAfterYes = await p1.evaluate(() => window.SSX.savecode.locked).catch(() => 'navigated');
    R.notice2 = await p2.waitForFunction(() => /another tab/.test(window.__notice), null, { timeout: 8000 }).then(() => p2.evaluate(() => window.__notice)).catch(() => null);
    R.nav = [!!(await nav1), !!(await nav2)]; await boot(p1); await boot(p2); await sleep(1500);
    const v1 = await p1.evaluate(() => ({ cr: window.__app.game.progress.credits, xp: window.__app.game.progress.xp, applied: window.SSX.savecode.applied }));
    const v2 = await p2.evaluate(() => ({ cr: window.__app.game.progress.credits, xp: window.__app.game.progress.xp }));
    ok('tab1Imported', v1, v1.cr === 7777 && v1.xp === 4321 && v1.applied?.n >= 1);
    ok('tab2Reloaded', { v2, nav: R.nav, notice: R.notice2 }, R.nav[1] && v2.cr === 7777 && v2.xp === 4321 && !!R.notice2);
    ok('lockedAfterYes', R.lockedAfterYes, R.lockedAfterYes === true || R.lockedAfterYes === 'navigated');
    // and a fresh reload still has it (nothing stale wrote over it on the way out)
    await p2.reload(); await boot(p2); await sleep(800); const v3 = await p2.evaluate(() => ({ cr: window.__app.game.progress.credits, xp: window.__app.game.progress.xp, locked: window.SSX.savecode.locked }));
    ok('persists', v3, v3.cr === 7777 && v3.xp === 4321 && v3.locked === false);
    ok('noErrors', errors, !errors.length);
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 200)); }
  console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : `PASS savecode-tabs ${DEV}-${BR}`); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
