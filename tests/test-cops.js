// v7.5.136 cops in cars can be shot. The first shot raises heat and does not bust you.
// BASE=http://127.0.0.1:8771/ node tests/test-cops.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8771/';
const only = process.env.ONLY || 'chromium:iPhone 14,webkit:iPhone 14,chromium:desktop';
const out = (process.env.OUT || '/opt/cursor/artifacts/').replace(/\/?$/, '/');
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const bad = [];
  for (const pair of only.split(',')) {
    const [BR, DEV] = pair.split(':');
    const desk = DEV === 'desktop';
    const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
    const dev = desk ? { viewport: { width: 1280, height: 800 } }
      : (({ defaultBrowserType, ...o }) => ({ ...o, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }))(pw.devices[DEV] || pw.devices['iPhone 14']);
    const ctx = await browser.newContext(dev);
    await ctx.addInitScript(() => { localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => { if (!/audio/i.test(e.message)) errors.push(e.message.slice(0, 160)); });
    const G = f => page.evaluate(f);
    const wait = async f => page.waitForFunction(f, null, { timeout: 120000, polling: 100 });
    const tag = BR + '-' + DEV;
    try {
      await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
      await wait(() => window.__frames > 3 && !document.getElementById('loading'));
      const ver = await G(() => document.querySelector('meta[name="app-version"]').content);
      if (ver !== 'v7.5.136') bad.push(tag + ' version ' + ver);
      await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
      await wait(() => window.__app.state.onSurface && window.__app.surface.info?.intro === 0);
      const r = await G(() => {
        const s = window.__app.surface, w = s.world, g = window.__app.game, i = s.info;
        w.setWanted(0);
        const px = i.x, pz = i.z;
        w.debug.spawnSecurity('officer', { x: px + 2, z: pz });
        const offs = w.debug.security().filter(q => q.kind === 'officer');
        const off = offs[offs.length - 1];
        const oy = (off.y || 0) + 1.2;
        const shot = w.hitWorld({ x: off.x - 1, y: oy, z: off.z }, { x: off.x, y: oy, z: off.z }, { dmg: 3 });
        const left = w.debug.security().filter(q => q.kind === 'officer');
        const foot = { shot, before: off.hp, hp: left.find(q => Math.hypot(q.x - off.x, q.z - off.z) < 1)?.hp ?? 0, n: offs.length, wanted: w.wanted, down: g.info.down, grace: w.debug.copGrace() };
        w.setWanted(0);
        const car = w.debug.plantCruiser(px + 4, pz + 4);
        let hp = 40, hits = 0, dead = false;
        while (hp > 0 && hits < 6) {
          const cy = w.groundAt(car.x, car.z) + 1.15;
          w.hitWorld({ x: car.x - 1.2, y: cy, z: car.z }, { x: car.x, y: cy, z: car.z }, { dmg: 14 });
          const row = w.debug.traffic().find(t => Math.hypot(t.x - car.x, t.z - car.z) < 1.5);
          hp = row ? (row.hp == null ? 40 : row.hp) : -1;
          dead = !row || row.cop === false || hp <= 0;
          if (dead) break;
          hits++;
        }
        const cruiser = { hits, hp, wanted: w.wanted, down: g.info.down, grace: w.debug.copGrace(), dead };
        const pu = window.SSX.pursuit.debug.plantCar(px + 8, pz + 2);
        const py = pu ? w.groundAt(pu.x, pu.z) + 1.2 : 2;
        const pursuit = pu ? { ...pu, shot: w.hitWorld({ x: pu.x - 1.2, y: py, z: pu.z }, { x: pu.x, y: py, z: pu.z }, { dmg: 10 }), down: g.info.down, wanted: w.wanted } : null;
        return { foot, cruiser, pursuit };
      });
      if (!r.foot.shot || !(r.foot.wanted >= 1) || r.foot.down || !(r.foot.grace > 0)) bad.push(tag + ' foot ' + JSON.stringify(r.foot));
      if (!r.cruiser.dead || r.cruiser.down || !(r.cruiser.wanted >= 1)) bad.push(tag + ' car ' + JSON.stringify(r.cruiser));
      if (!r.pursuit || !r.pursuit.shot || r.pursuit.down) bad.push(tag + ' pursuit ' + JSON.stringify(r.pursuit));
      if (errors.length) bad.push(tag + ' ' + errors[0]);
      if (BR === 'chromium' && !desk) await page.screenshot({ path: out + 'iphone_cops_390.png' });
      console.log(tag, JSON.stringify(r), errors.length ? errors[0] : 'clean');
    } catch (e) {
      bad.push(tag + ' ' + e.message.split('\n')[0]);
      console.log(tag, 'FAIL', e.message.split('\n')[0]);
    }
    await browser.close();
  }
  console.log(bad.length ? 'FAILED ' + bad.join(' | ') : 'PASS');
  process.exit(bad.length ? 1 : 0);
})();
