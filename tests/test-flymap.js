// v7.5.116 Fly ship here. Real touch taps on iPhone SE and iPhone 14 portrait.
// The trip starts, or the card shows one plain reason. The button stays on screen and at least 44px.
// BASE=http://127.0.0.1:8765/ node tests/test-flymap.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8765/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const bad = [];
  const R = {};
  for (const name of ['iPhone SE', 'iPhone 14']) {
    const dev = (({ defaultBrowserType, ...o }) => o)(pw.devices[name]);
    const page = await (await browser.newContext({ ...dev, hasTouch: true })).newPage();
    const G = (f, a) => page.evaluate(f, a);
    const wait = (f, ms = 90000) => page.waitForFunction(f, null, { timeout: ms, polling: 200 }).then(() => true).catch(() => false);
    const tag = name.replace(/\s+/g, '');
    try {
      await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
      if (!await wait(() => window.__frames > 3 && !document.getElementById('loading'))) bad.push(tag + ' boot');
      await G(() => localStorage.clear());
      await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
      if (!await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0)) bad.push(tag + ' land');
      await sleep(300);
      await G(() => {
        window.SSX.onboard?.skip?.();
        window.__app.surface.game.abandon?.();
        window.__app.surface.world.setWanted(3);
        const i = window.__app.surface.info;
        window.__app.surface.debugMove(i.x + 600, i.z + 400, 0);
        window.SSX.hudx.openMap();
      });
      if (!await wait(() => document.getElementById('hxMap')?.classList.contains('on'))) bad.push(tag + ' map');
      await sleep(250);
      let spot = null;
      for (let n = 0; n < 8 && !spot?.inside; n++) { spot = await G(() => window.__hxMapDebug.marker()); await sleep(80); }
      R[tag] = { spot };
      if (!(spot && spot.inside)) bad.push(tag + ' marker');
      else await page.touchscreen.tap(spot.x, spot.y);
      await sleep(200);
      const opened = await G(() => {
        const b = document.getElementById('hxLocFly');
        const card = document.getElementById('hxLoc');
        if (!b || !card?.classList.contains('on')) return { on: false };
        const r = b.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { on: true, h: r.height, top: r.top, bottom: r.bottom, ih: innerHeight, iw: innerWidth, left: r.left, right: r.right, hit: hit === b, fs: parseFloat(getComputedStyle(b).fontSize) };
      });
      R[tag].btn = opened;
      if (!(opened.on && opened.h >= 44 && opened.fs >= 15 && opened.hit && opened.top >= 0 && opened.left >= 0 && opened.bottom <= opened.ih && opened.right <= opened.iw)) bad.push(tag + ' button');
      await page.tap('#hxLocFly');
      await sleep(250);
      const blocked = await G(() => {
        const w = document.getElementById('hxFlyWhy');
        const r = w.getBoundingClientRect();
        const s = getComputedStyle(w);
        return { text: w.textContent, on: w.classList.contains('on'), h: r.height, display: s.display, fs: parseFloat(s.fontSize), color: s.color, hop: window.SSX.shiphop.hopping, map: document.getElementById('hxMap').classList.contains('on') };
      });
      R[tag].blocked = blocked;
      if (!(blocked.map && !blocked.hop && blocked.on && blocked.display !== 'none' && blocked.fs >= 15 && blocked.color === 'rgb(255, 255, 255)' && /Can't fly with 3 stars/.test(blocked.text) && /Lose the heat first/.test(blocked.text))) bad.push(tag + ' reason');
      const still = await G(() => {
        const b = document.getElementById('hxLocFly');
        const r = b.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { h: r.height, bottom: r.bottom, ih: innerHeight, hit: hit === b };
      });
      if (!(still.h >= 44 && still.hit && still.bottom <= still.ih)) bad.push(tag + ' still');
      await G(() => window.__app.surface.world.setWanted(0));
      await page.tap('#hxLocFly');
      await sleep(200);
      const flew = await G(() => ({ hop: window.SSX.shiphop.hopping, phase: window.SSX.shiphop.phase, map: document.getElementById('hxMap').classList.contains('on'), alt: window.__app.surface.shipPose()?.alt || 0 }));
      R[tag].flew = flew;
      if (!(flew.hop && !flew.map && (flew.phase === 'up' || flew.alt > 0))) bad.push(tag + ' flew');
      if (name === 'iPhone 14') await page.screenshot({ path: '/opt/cursor/artifacts/fly-ship-iphone14.png' });
    } catch (e) { bad.push(tag + ' throw'); R[tag + 'err'] = String(e.stack || e).slice(0, 500); }
    await page.close();
  }
  console.log(JSON.stringify({ R, bad }, null, 2));
  await browser.close();
  if (bad.length) { console.log('FAILED ' + bad.join(', ')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
