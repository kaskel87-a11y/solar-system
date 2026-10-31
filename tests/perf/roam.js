// Roaming leak probe: teleport through many spots (drive-style), check geometries/textures/objects/PSS keep bounded.
const pw = require('playwright'), fs = require('fs');
const base = process.env.BASE || 'http://127.0.0.1:8971/'; const sleep = ms => new Promise(r => setTimeout(r, ms));
function pss() { let sum = 0; for (const d of fs.readdirSync('/proc')) { if (!/^\d+$/.test(d)) continue; try { const c = fs.readFileSync(`/proc/${d}/cmdline`, 'utf8'); if (!/WebKit|pw_run/i.test(c)) continue; const m = /Pss:\s+(\d+)/.exec(fs.readFileSync(`/proc/${d}/smaps_rollup`, 'utf8')); if (m) sum += +m[1]; } catch (e) {} } return Math.round(sum / 1024); }
(async () => {
  const browser = await pw.webkit.launch(); const ctx = await browser.newContext({ ...pw.devices['iPhone 14'], viewport: { width: 393, height: 852 } }); const page = await ctx.newPage();
  const G = (f, a) => page.evaluate(f, a); const wait = async (f, ms = 30000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 180000);
  await G(() => localStorage.clear()); await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
  await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 180000); await sleep(1000);
  const st = () => G(() => { const r = window.__app.renderer, sc = window.__app.surface.scene; let o = 0, m = 0, v = 0; sc.traverse(x => { o++; if (x.isMesh) { m++; if (x.visible) v++; } }); const top = {}; sc.children.forEach(c => { let n = 0; c.traverse(() => n++); const k = c.name || c.type; top[k] = (top[k] || 0) + n; });
    return { geo: r.info.memory.geometries, tex: r.info.memory.textures, progs: r.info.programs.length, objs: o, meshes: m, chunks: window.__app.surface.info.chunks, top }; });
  const c = await G(() => window.__app.surface.info.colony); const ds = await G(() => window.__app.surface.world.districts().map(d => ({ id: d.id, x: d.x, z: d.z })));
  console.log('districts', JSON.stringify(ds));
  const spots = []; for (const d of ds) spots.push([d.x, d.z]); for (let a = 0; a < 12; a++) spots.push([c.x + Math.cos(a) * 900, c.z + Math.sin(a) * 900]);
  const rows = []; let first = null;
  for (let lap = 0; lap < 3; lap++) for (const [x, z] of spots) {
    await G(([x, z]) => window.__app.surface.debugMove(x, z, 0), [x, z]); await sleep(2500);
    const s = await st(); s.pss = pss(); if (!first) first = s.top; rows.push(s); console.log(lap, Math.round(x), Math.round(z), JSON.stringify({ geo: s.geo, tex: s.tex, progs: s.progs, objs: s.objs, meshes: s.meshes, chunks: s.chunks, pss: s.pss }));
  }
  const last = rows[rows.length - 1].top; const diff = Object.keys({ ...first, ...last }).map(k => [k, (first[k] || 0), (last[k] || 0)]).filter(x => x[1] !== x[2]).sort((a, b) => (b[2] - b[1]) - (a[2] - a[1]));
  console.log('top diff', JSON.stringify(diff.slice(0, 25)));
  fs.writeFileSync(process.env.OUT || '/workspace/perf7512/roam.json', JSON.stringify(rows, null, 1)); await browser.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
