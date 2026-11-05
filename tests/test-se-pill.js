// M2: #radio mini pill must be visible + tappable on iPhone SE 375x667 with the tutorial card up
const pw = require('playwright'); const BR = process.env.BR || 'webkit', base = process.env.BASE || 'http://127.0.0.1:8972/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await pw[BR].launch(); const ctx = await br.newContext({ ...pw.devices['iPhone SE'], viewport: { width: 375, height: 667 } }); const page = await ctx.newPage();
  const G = (f, a) => page.evaluate(f, a); const wait = async (f, ms = 30000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
  await wait(() => !!window.SSX?.onboard && document.getElementById('obLine') && !document.getElementById('obLine').hidden, 20000); console.log('ob', await G(() => JSON.stringify(localStorage.getItem('ssx.onboard.v1'))));
  await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
  await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(2500);
  const c = await G(() => window.__app.surface.info.colony); await G(([x, z]) => window.__app.surface.debugPlace(x + 8, z + 26.5, 0), [c.x, c.z]); await sleep(3500);
  await G(() => window.__app.surface.game.talk('Vesna')); await sleep(1500);
  const m = () => G(() => { const r = document.getElementById('radio'), b = r.getBoundingClientRect(), e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    const card = [...document.querySelectorAll('#stackR > *')].filter(x => x.getBoundingClientRect().height && getComputedStyle(x).display !== 'none').map(x => { const q = x.getBoundingClientRect(); return `${x.id || x.className}@${Math.round(q.y)}+${Math.round(q.height)}`; });
    return { cls: r.className, disp: getComputedStyle(r).display, box: [b.x, b.y, b.width, b.height].map(Math.round), hit: e ? (e.closest('#radio') ? 'radio' : e.id || e.tagName) : null, tut: [document.getElementById('hxCard')?.textContent?.slice(0,60), getComputedStyle(document.getElementById('hxCard')||document.body).display, document.getElementById('obLine')?.hidden, (document.getElementById('obLine')?.textContent||'').slice(0,50)], stack: card }; });
  console.log('dbg', JSON.stringify(await G(() => { const r = document.getElementById('radio'); const out = []; for (let e = r; e && e !== document.body; e = e.parentElement) { const c = getComputedStyle(e), b = e.getBoundingClientRect(); out.push([e.id || e.className, c.overflow, c.maxHeight, c.pointerEvents, c.visibility, c.opacity, c.zIndex, c.position, [b.x, b.y, b.width, b.height].map(Math.round).join(',')]); }
    const b = r.getBoundingClientRect(); out.push(document.elementsFromPoint(b.x + b.width / 2, b.y + b.height / 2).slice(0, 5).map(e => e.id || e.tagName)); return out; })));
  const o = await m(); console.log(JSON.stringify(o)); await page.screenshot({ path: `/workspace/perf7512/se-pill-${BR}.png` });
  if (o.hit === 'radio') { const b = o.box; await page.touchscreen.tap(b[0] + b[2] / 2, b[1] + b[3] / 2); await sleep(700); console.log('afterTap', JSON.stringify(await m())); }
  console.log(o.hit === 'radio' ? 'PASS se pill' : 'FAIL se pill'); await br.close();
})().catch(e => { console.error(e); process.exit(1); });
