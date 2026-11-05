// ☰ → ☀️ Brightness (brightness.js): before/after iPhone shots at midnight + dusk, the menu + picker by touch, the level
// surviving a reload, Max > Normal > before at night, day untouched at Normal, values restored after every render,
// interiors lifted, mars/time.js night bounds kept, no errors. One browser at a time.
// SHOTS_DIR=$PWD/.shots/bright BASE=http://127.0.0.1:8861/ BR=webkit node tests/test-brightness.js
const { chromium, webkit, devices } = require('playwright');
const { execFileSync } = require('child_process');
const base = process.env.BASE || 'http://127.0.0.1:8861/', BR = process.env.BR || 'webkit';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', '.shots', 'bright')) + '/';
const fs = require('fs'); try { fs.mkdirSync(out, { recursive: true }); } catch (e) {}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lumOf = f => +execFileSync('python3', ['-c', `from PIL import Image,ImageStat;im=Image.open('${f}').convert('L');w,h=im.size;print(round(ImageStat.Stat(im.crop((0,int(h*.22),w,int(h*.72)))).mean[0],2))`]).toString().trim();

(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const { defaultBrowserType, ...dev } = devices['iPhone 14 Pro'];
  const R = { br: BR }, bad = [], errs = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = !!v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  async function session(before) {
    const ctx = await browser.newContext({ ...dev, viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 }); const page = await ctx.newPage();
    if (before) await page.route(/\/brightness(core)?\.js/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'export {};' }));
    page.on('pageerror', e => errs.push('PE ' + e.message));
    page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /\[brightness\]|\[time\]/.test(m.text()))) errs.push(m.text().slice(0, 200)); });
    const G = (f, a) => page.evaluate(f, a);
    const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
    const frames = n => G(n => new Promise(r => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
    const shot = async s => { const f = `${out}bright-${s}.png`; await page.screenshot({ path: f, timeout: 15000 }); return { f, lum: lumOf(f) }; };
    const land = async () => {
      await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
      await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
      await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(1200);
    };
    const at = async h => { await G(h => { window.SSX.time.set(h); window.SSX.time.freeze(true); }, h); await frames(12); await sleep(2800); };
    await page.goto(base + '?t=' + Date.now(), { timeout: 120000 });
    await wait(() => window.__frames > 3, 120000);
    await G(() => { try { localStorage.removeItem('ssx.time.v1'); localStorage.removeItem('ssx.bright.v1'); } catch (e) {} });
    await land(); await wait(() => !!window.SSX?.time, 15000);
    // the default landing view (ship, colony streets and signs ahead), like the reported iPhone screenshot
    await frames(10); await sleep(800);
    return { ctx, page, G, wait, frames, shot, at };
  }
  try {
    // ---------- before: main without brightness.js ----------
    let P = await session(true);
    await P.at(12); R.noonBefore = await P.shot('noon-before');
    await P.at(0); R.midBefore = await P.shot('midnight-before'); R.hemiBefore = await P.G(() => window.__time.light);
    await P.at(19.1); R.duskBefore = await P.shot('dusk-before');
    await P.ctx.close();
    // ---------- after: default Normal ----------
    P = await session(false); const { G, at, shot, frames, wait, page } = P;
    ok('installed', await G(() => { const b = window.SSX.brightness; return b && { level: b.get(), st: b.state() }; }), await G(() => window.SSX.brightness?.get() === 'normal' && window.__bright.S.wrapped && window.__bright.S.filter));
    await at(12); R.noonAfter = await shot('noon-after');
    ok('noonUntouched', { before: R.noonBefore.lum, after: R.noonAfter.lum }, Math.abs(R.noonAfter.lum - R.noonBefore.lum) < Math.max(4, R.noonBefore.lum * 0.06));
    await at(0); R.midAfter = await shot('midnight-after');
    const nt = await G(() => ({ light: window.__time.light, look: window.SSX.time.look(), renders: window.__bright.S.renders, lights: window.__bright.S.lights, exp: window.__app.renderer.toneMappingExposure, base: window.__time.base }));
    R.nightAfter = nt;
    ok('midnightBrighter', { before: R.midBefore.lum, after: R.midAfter.lum }, R.midAfter.lum > R.midBefore.lum * 1.35 && R.midAfter.lum > R.midBefore.lum + 4);
    ok('stillNight', { after: R.midAfter.lum, noon: R.noonAfter.lum }, R.midAfter.lum < R.noonAfter.lum * 0.75);
    // time.js night bounds (same as tests/test-time.js nightLook): sun-fill < 0.25 x day, hemi < 0.5 x day; outside render() the values are time.js's own
    ok('timeBounds', nt.light, nt.light.i < nt.base.light * 0.25 && nt.light.hemi < nt.base.hemi * 0.5 && Math.abs(nt.light.hemi - nt.look.hemi) < 1e-6 && Math.abs(nt.exp - 1.1) < 1e-6);
    await at(19.1); R.duskAfter = await shot('dusk-after');
    ok('duskNotDarker', { before: R.duskBefore.lum, after: R.duskAfter.lum }, R.duskAfter.lum >= R.duskBefore.lum - 1);
    // ---------- the menu, by touch ----------
    await at(0);
    await page.tap('#menuBtn'); await sleep(400);
    ok('menuItem', await G(() => document.getElementById('brightMenuBtn')?.textContent), await G(() => /Brightness: Normal/.test(document.getElementById('brightMenuBtn')?.textContent || '')));
    await page.tap('#brightMenuBtn'); await sleep(400);
    ok('panelOpens', null, await G(() => document.getElementById('brightPanel')?.style.display === 'block' && !document.getElementById('roverMenu').classList.contains('show')));
    await page.tap('#bright-max'); await frames(8); await sleep(600);
    ok('maxSaved', await G(() => localStorage.getItem('ssx.bright.v1')), await G(() => localStorage.getItem('ssx.bright.v1') === 'max' && window.SSX.brightness.get() === 'max' && /Max/.test(document.getElementById('brightMenuBtn').textContent)));
    R.panel = await shot('menu-panel');
    await page.tap('#brightDone'); await sleep(400);
    ok('panelCloses', null, await G(() => document.getElementById('brightPanel').style.display === 'none'));
    R.midMax = await shot('midnight-max');
    ok('maxBrighter', { normal: R.midAfter.lum, max: R.midMax.lum }, R.midMax.lum > R.midAfter.lum * 1.2);
    // ---------- interiors: lifted at High / Max, values put back after render ----------
    const inn = await G(async () => {
      const s = window.__app.surface, d = s.world.doorList().find(x => x.kind === 'cantina') || s.world.doorList()[0]; s.enterBuilding(s.world.doorFor(d.kind));
      await new Promise(r => setTimeout(r, 1500)); const sc = window.__bright.S;
      const hemis = []; s.scene?.traverse?.(o => { if (o.isHemisphereLight || o.isAmbientLight) hemis.push(o.intensity); });
      return { inside: !!s.info.inside, kind: d.kind, renders: sc.renders, hemis };
    });
    ok('interior', inn, inn.inside);
    R.inMax = await shot('interior-max'); await G(() => window.SSX.brightness.set('normal')); await frames(8); await sleep(500); R.inNormal = await shot('interior-normal');
    ok('interiorLifted', { normal: R.inNormal.lum, max: R.inMax.lum }, R.inMax.lum > R.inNormal.lum + 2);
    await G(() => window.__app.surface.leaveBuilding()); await frames(4);
    // ---------- persists across a reload ----------
    await G(() => window.SSX.brightness.set('high'));
    await page.reload(); await wait(() => !!window.SSX?.brightness, 120000);
    ok('persists', await G(() => window.SSX.brightness.get()), await G(() => window.SSX.brightness.get() === 'high'));
    await G(() => window.SSX.brightness.set('normal'));
    R.look = await G(() => window.SSX.brightness.state().look);
    await P.ctx.close();
  } catch (e) { bad.push('EXC ' + e.message.split('\n')[0]); }
  const real = errs.filter(e => !/favicon|ERR_|net::|Failed to load resource|WebGL|GL_/i.test(e));
  ok('noErrors', real.slice(0, 6), real.length === 0);
  for (const k of Object.keys(R)) if (R[k]?.f) R[k] = { lum: R[k].lum, f: R[k].f.replace(out, '') };
  console.log(JSON.stringify(R, null, 1));
  console.log(bad.length ? 'FAIL: ' + bad.join(' | ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
