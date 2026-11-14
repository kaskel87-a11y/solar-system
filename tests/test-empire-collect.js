// v7.5.106 Collect All on the Empire sheet. BASE=http://127.0.0.1:8765/ BR=chromium DEV="iPhone SE" node tests/test-empire-collect.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'iPhone SE';
const out = (process.env.OUT || '/tmp/empire/').replace(/\/?$/, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const dev = (({ defaultBrowserType, ...o }) => o)(pw.devices[DEV] || pw.devices['iPhone SE']);
  const page = await (await browser.newContext(dev)).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/audio device|Failed to load resource|WebGL/i.test(m.text())) errors.push('C ' + m.text()); });
  const G = (f, a) => page.evaluate(f, a), R = {}, bad = [];
  const ok = (k, v) => { R[k] = v; if (!v) bad.push(k); };
  const wait = async (f, ms = 30000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  try {
    await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
    ok('booted', await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000));
    ok('version', await G(() => document.querySelector('meta[name="app-version"]').content) === 'v7.5.106');
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await sleep(400);
    ok('ready', await wait(() => window.SSX.empire?.ready, 30000));
    await G(() => {
      const E = window.SSX.empire;
      window.SSX.onboard?.skip?.();
      E.debug.force({ noThreats: true });
      E.debug.grant('fr-wash'); E.debug.grant('fr-bar'); E.debug.grant('sh-rim');
      E.debug.setPending('fr-wash', 8152); E.debug.setPending('fr-bar', 1200);
      window.__app.surface.game.reward(0, 5000);
      window.__app.surface.world.setWanted(0);
      E.open();
      const t = document.getElementById('toast'); if (t) t.classList.remove('on');
    });
    ok('open', await wait(() => window.SSX.empire.isOpen, 4000));
    const ui = await G(() => {
      const w = document.querySelector('#empPanel .wrap');
      const t = w.innerText;
      const btn = w.querySelector('button.collectAll');
      const br = btn.getBoundingClientRect(), wr = w.getBoundingClientRect();
      const names = [...w.querySelectorAll('h3')].map(h => h.textContent);
      const afterH = h => { const out = []; let n = h.nextElementSibling; while (n && n.tagName !== 'H3') { const b = n.querySelector('b'); if (b) out.push(b.textContent); n = n.nextElementSibling; } return out; };
      const ownNames = afterH(w.querySelector('h3'));
      const own = ownNames.join(' | ');
      const buttons = [...w.querySelectorAll('button')].map(b => ({ h: b.getBoundingClientRect().height, r: b.getBoundingClientRect().right, text: b.textContent }));
      return {
        point: /Places you own earn credits every game hour/.test(t),
        heads: names.join('|'),
        label: btn.textContent,
        disabled: btn.disabled,
        washFirst: own.indexOf('Red Dust') >= 0 && own.indexOf('Red Dust') < own.indexOf('Thin Air'),
        own: own.slice(0, 240),
        goSee: /Go see/.test(t) && !/\bLook\b/.test(t),
        fits: wr.left >= -1 && wr.right <= innerWidth + 1 && buttons.every(b => b.r <= innerWidth + 1 && b.h >= 44),
        overflow: w.scrollWidth <= w.clientWidth + 2
      };
    });
    R.ui = ui;
    ok('point', ui.point && ui.heads === 'You own|For sale');
    ok('collectLabel', ui.label === 'Collect 9,352 cr' && !ui.disabled);
    ok('sorted', ui.washFirst && ui.goSee);
    ok('fits', ui.fits && ui.overflow);
    await page.screenshot({ path: out + 'empire-iphone.png' });
    const before = await G(() => window.__app.surface.game.info.credits);
    await page.locator('#empPanel button.collectAll').click();
    await sleep(300);
    const after = await G(() => ({ cr: window.__app.surface.game.info.credits, pend: window.SSX.empire.pending(), label: document.querySelector('#empPanel button.collectAll').textContent }));
    R.after = after;
    ok('collected', after.cr - before === 9352 && after.pend === 0 && after.label === 'Collect 0 cr');
    await G(() => { window.SSX.empire.debug.setPending('fr-bar', 400); window.__app.surface.world.setWanted(2, 'test'); window.SSX.empire.open(); });
    await sleep(200);
    const heat = await G(() => { const b = document.querySelector('#empPanel button.collectAll'); return { text: b.textContent, disabled: b.disabled }; });
    R.heat = heat;
    ok('copsBlock', heat.disabled && heat.text === 'Lose the cops first');
    const blocked = await G(() => { const r = window.SSX.empire.collectAll(); return { ok: r.ok, pend: window.SSX.empire.pending() }; });
    ok('apiBlocks', blocked.ok === false && blocked.pend === 400);
    await G(() => window.__app.surface.world.setWanted(0));
    ok('console', errors.length === 0);
    if (errors.length) R.errors = errors.slice(0, 6);
  } catch (e) { bad.push('throw'); R.throw = String(e.stack || e).slice(0, 500); }
  console.log(JSON.stringify(R, null, 2));
  if (bad.length) { console.log('FAILED ' + bad.join(', ')); process.exit(1); }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
