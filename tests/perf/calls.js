const pw = require('playwright'); const base = process.env.BASE || 'http://127.0.0.1:8971/'; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw.webkit.launch(); const ctx = await browser.newContext({ ...pw.devices['iPhone 14'], viewport: { width: 393, height: 852 } }); const page = await ctx.newPage();
  const G = (f, a) => page.evaluate(f, a); const wait = async (f, ms = 30000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 180000);
  await G(() => localStorage.clear()); await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
  await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 180000); await sleep(2000);
  const spots = JSON.parse(process.env.SPOTS || '[null,[0,-200],[0,-630],[-280,-240]]');
  for (const sp of spots) {
    if (sp) { await G(sp => window.__app.surface.debugMove(sp[0], sp[1], 0), sp); await sleep(2500); }
    const r = await G(() => new Promise(res => { const sc = window.__app.surface.scene, cnt = {}, D = {}; const hooks = [];
      const path = o => { const p = []; let x = o; while (x && x.parent && x.parent !== sc) { x = x.parent; } return (x?.name || x?.type || '?'); };
      sc.traverse(o => { if (o.isMesh || o.isPoints || o.isLine || o.isSprite) { const k = path(o) + (o.isInstancedMesh ? '[inst]' : ''); const prev = o.onBeforeRender; o.onBeforeRender = function (...a) { cnt[k] = (cnt[k] || 0) + 1; D[k] = (D[k] || 0) + (o.geometry?.index?.count || o.geometry?.attributes?.position?.count || 0) / 3; return prev.apply(this, a); }; hooks.push([o, prev]); } });
      requestAnimationFrame(() => { for (const k in cnt) cnt[k] = 0; for (const k in D) D[k] = 0; requestAnimationFrame(() => { hooks.forEach(([o, p]) => o.onBeforeRender = p); const arr = Object.entries(cnt).map(([k, v]) => [k, v, Math.round(D[k])]).sort((a, b) => b[1] - a[1]); res({ total: arr.reduce((a, b) => a + b[1], 0), tris: arr.reduce((a, b) => a + b[2], 0), top: arr.slice(0, 18), far: window.__app.surface.camera.far, fog: window.__app.surface.scene.fog && (window.__app.surface.scene.fog.far || window.__app.surface.scene.fog.density), pr: window.__app.renderer.getPixelRatio(), shadow: window.__app.renderer.shadowMap.enabled }); }); }); }));
    console.log(JSON.stringify(sp), JSON.stringify(r));
  }
  await browser.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
