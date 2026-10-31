// Soak profiler: WebKit iPhone 14 393x852, scripted play loop for DUR seconds, sample every 15 s.
// BASE=http://127.0.0.1:8971/ DUR=270 OUT=/workspace/perf7512/before.json node soak.js
const pw = require('playwright'), fs = require('fs');
const base = process.env.BASE || 'http://127.0.0.1:8971/', DUR = +(process.env.DUR || 270) * 1000, OUT = process.env.OUT || '/workspace/perf7512/soak.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function pss() { let sum = 0; for (const d of fs.readdirSync('/proc')) { if (!/^\d+$/.test(d)) continue; try { const c = fs.readFileSync(`/proc/${d}/cmdline`, 'utf8'); if (!/WebKit|pw_run|MiniBrowser/i.test(c)) continue; const m = /Pss:\s+(\d+)/.exec(fs.readFileSync(`/proc/${d}/smaps_rollup`, 'utf8')); if (m) sum += +m[1]; } catch (e) {} } return Math.round(sum / 1024); }
(async () => {
  const browser = await pw.webkit.launch();
  const ctx = await browser.newContext({ ...pw.devices['iPhone 14'], viewport: { width: 393, height: 852 } });
  await ctx.addInitScript(() => {
    const T = window.__perfT = { iv: new Set(), to: 0, toLive: new Set(), ls: 0, raf: 0 };
    const si = window.setInterval, ci = window.clearInterval, st = window.setTimeout, ct = window.clearTimeout;
    window.setInterval = function (...a) { const id = si.apply(this, a); T.iv.add(id); return id; };
    window.clearInterval = function (id) { T.iv.delete(id); return ci.call(this, id); };
    window.setTimeout = function (f, ...a) { let id; const g = typeof f === 'function' ? function (...x) { T.toLive.delete(id); return f.apply(this, x); } : f; id = st.call(this, g, ...a); T.toLive.add(id); return id; };
    window.clearTimeout = function (id) { T.toLive.delete(id); return ct.call(this, id); };
    const C = window.__cbT = {}; const key = (f, kind) => kind + ':' + (f.name || (f.toString().replace(/\s+/g, ' ').slice(0, 70)));
    const tw = (f, kind) => { if (typeof f !== 'function') return f; const k = key(f, kind); return function (...x) { const t = performance.now(); try { return f.apply(this, x); } finally { const d = performance.now() - t; const e = C[k] || (C[k] = { ms: 0, n: 0 }); e.ms += d; e.n++; } }; };
    const raf = window.requestAnimationFrame; window.requestAnimationFrame = function (f) { return raf.call(window, tw(f, 'raf')); };
    const si2 = window.setInterval; window.setInterval = function (f, ...a) { return si2.call(window, tw(f, 'iv'), ...a); };
    const st2 = window.setTimeout; window.setTimeout = function (f, ...a) { return st2.call(window, tw(f, 'to'), ...a); };
    const ael = EventTarget.prototype.addEventListener, rel = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (...a) { T.ls++; return ael.apply(this, a); };
    EventTarget.prototype.removeEventListener = function (...a) { T.ls--; return rel.apply(this, a); };
  });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message.slice(0, 160)));
  const G = (f, a) => page.evaluate(f, a);
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  await page.goto(base + '?t=' + Date.now(), { timeout: 180000 });
  await wait(() => window.__frames > 3 && !document.getElementById('loading'), 180000);
  await G(() => localStorage.clear());
  await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
  await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 180000);
  await sleep(1000);
  await G(() => { document.getElementById('radioLater')?.click(); const P = window.__app.game.progress; P.credits = 5000; window.__app.game.save(); window.__app.surface.world.setWanted(0); });
  await G(() => { const A = window.__app, S = A.surface, R = A.renderer; window.__pt = { u: 0, r: 0, n: 0 };
    const u0 = S.update.bind(S); S.update = function (...a) { const t = performance.now(); const x = u0(...a); window.__pt.u += performance.now() - t; window.__pt.n++; return x; };
    const r0 = R.render.bind(R); R.render = function (...a) { const t = performance.now(); const x = r0(...a); window.__pt.r += performance.now() - t; return x; }; });
  const version = await G(() => window.__app.version);
  const spawn = await G(() => { const i = window.__app.surface.info; return { x: i.x, z: i.z }; });
  const probes = {};
  let probing = false; const probe = async label => { probing = true; await G(([x, z]) => { const A = window.__app; A.joy.x = A.joy.y = 0; A.touchBtns.fire = false; A.touchBtns.run = false; if (A.surface.info.inside) A.surface.leaveBuilding(); if (A.surface.info.driving) A.surface.interact(); }, [spawn.x, spawn.z]); await sleep(800);
    await G(([x, z]) => { const s = window.__app.surface; s.debugPlace(x, z, 0); s.world.setWanted(0); }, [spawn.x, spawn.z]); await sleep(3000); const a = await sample(); const b = await sample(); const p = { label, calls: a.calls, geo: b.geo, tex: b.tex, progs: b.progs, objs: b.objs, ft: +((a.ftAvg + b.ftAvg) / 2).toFixed(1), upd: +((a.upd + b.upd) / 2).toFixed(1), rnd: +((a.rnd + b.rnd) / 2).toFixed(1), npc: b.npc, lights: b.lights, skinned: b.skinned, pss: pss() }; probes[label] = p; p.cb = b.cb; console.log('PROBE', JSON.stringify(p)); probing = false; };

  const sample = () => G(() => new Promise(res => {
    const A = window.__app, r = A.renderer, inf = r.info, S = A.surface, sc = S.scene;
    const CB0 = JSON.parse(JSON.stringify(window.__cbT)); inf.autoReset = false; inf.reset(); let n = 0, calls = 0, tris = 0; const F = []; const U0 = window.__pt.u, R0 = window.__pt.r, N0 = window.__pt.n; let l = performance.now(); const t0 = l;
    const f = () => { const t = performance.now(); F.push(t - l); l = t; n++; calls = Math.max(calls, inf.render.calls); tris = Math.max(tris, inf.render.triangles); inf.reset(); if (t - t0 < 2000) requestAnimationFrame(f); else done(); };
    const done = () => { inf.autoReset = true; const cb = Object.entries(window.__cbT).map(([k, v]) => [k, +(v.ms - (CB0[k]?.ms || 0)).toFixed(1), v.n - (CB0[k]?.n || 0)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 8); const fr = Math.max(1, window.__pt.n - N0), upd = +((window.__pt.u - U0) / fr).toFixed(1), rnd = +((window.__pt.r - R0) / fr).toFixed(1);
      let objs = 0, vis = 0, meshes = 0, skinned = 0, lights = 0, shadowLights = 0, points = 0, sprites = 0; const top = {};
      sc.traverse(o => { objs++; if (o.visible) vis++; if (o.isMesh) meshes++; if (o.isSkinnedMesh) skinned++; if (o.isLight) { lights++; if (o.castShadow) shadowLights++; } if (o.isPoints) points++; if (o.isSprite) sprites++; });
      sc.children.forEach(c => { const k = (c.name || c.type) + ''; top[k] = (top[k] || 0) + 1; });
      const ft = F.slice(1).sort((a, b) => a - b), avg = ft.reduce((a, b) => a + b, 0) / (ft.length || 1);
      const W = S.world, T = window.__perfT;
      res({ cb, upd, rnd, ver: A.version, calls, tris, geo: inf.memory.geometries, tex: inf.memory.textures, progs: inf.programs?.length, objs, vis, meshes, skinned, lights, shadowLights, points, sprites, top, topN: sc.children.length,
        npc: W.npcBudget?.()?.used, wanted: W.wanted, dom: document.getElementsByTagName('*').length, toasts: document.querySelectorAll('.toast, [class*=toast]').length,
        intervals: T.iv.size, timeoutsLive: T.toLive.size, listeners: T.ls, ticks: null, pr: r.getPixelRatio(), shadow: r.shadowMap.enabled,
        ftAvg: +avg.toFixed(1), ftP95: Math.round(ft[Math.floor(ft.length * 0.95)] || 0), fps: +(n / 2).toFixed(1), inside: S.info?.inside?.kind || null, driving: S.info?.driving, heap: performance.memory?.usedJSHeapSize || null });
    };
    requestAnimationFrame(f);
  }));
  await probe('0min');
  const S = []; const t0 = Date.now(); let stop = false; let nextProbe = 120000;
  const sampler = (async () => { while (!stop) { if (probing) { await sleep(300); continue; } const at = Math.round((Date.now() - t0) / 1000); try { const s = await sample(); s.t = at; s.pssMB = pss(); S.push(s); console.log(JSON.stringify({ t: at, calls: s.calls, geo: s.geo, tex: s.tex, progs: s.progs, objs: s.objs, topN: s.topN, ft: s.ftAvg, upd: s.upd, rnd: s.rnd, npc: s.npc, iv: s.intervals, ls: s.listeners, dom: s.dom, pss: s.pssMB, in: s.inside, cb: s.cb.slice(0, 5) })); fs.writeFileSync(OUT, JSON.stringify({ version, S, errors }, null, 1)); } catch (e) { console.log('sample fail', e.message); } const nx = t0 + (S.length) * 15000; await sleep(Math.max(500, nx - Date.now())); } })();
  // ---- play loop ----
  const app = f => G(f).catch(e => console.log('step err', e.message.slice(0, 120)));
  const tap = async sel => { const b = await G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; }, sel); if (b) await page.touchscreen.tap(b.x, b.y); };
  let loop = 0;
  while (Date.now() - t0 < DUR) {
    loop++; if (Date.now() - t0 > nextProbe) { await probe(Math.round(nextProbe / 60000) + 'min'); nextProbe += 120000; }
    // walk + shoot
    await app(() => { window.__app.joy.y = -1; window.__app.joy.x = 0.3; }); await sleep(5000);
    await app(() => { window.__app.joy.x = -0.5; window.__app.touchBtns.fire = true; }); await sleep(4000);
    await app(() => { window.__app.touchBtns.fire = false; window.__app.joy.x = 0; window.__app.joy.y = 0; });
    if (Date.now() - t0 > DUR) break;
    // drive
    await app(() => { const s = window.__app.surface; if (!s.info.driving) { s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 3.5, i.roverZ + 2, 0.9); } });
    await sleep(600); await app(() => { if (!window.__app.surface.info.driving) window.__app.surface.interact(); });
    await app(() => { window.__app.joy.y = -1; window.__app.touchBtns.run = true; }); await sleep(7000);
    await app(() => { window.__app.joy.x = 0.8; window.__app.touchBtns.fire = true; }); await sleep(4000);
    await app(() => { window.__app.joy.x = 0; window.__app.joy.y = 0; window.__app.touchBtns.run = false; window.__app.touchBtns.fire = false; if (window.__app.surface.info.driving) window.__app.surface.interact(); });
    await sleep(800);
    if (Date.now() - t0 > DUR) break;
    // a job: vigilante, go near the mark and shoot
    await app(() => { window.__app.surface.world.setWanted(0); try { window.SSX.jobs.start('vigilante'); } catch (e) {} });
    await sleep(1500); await app(() => { window.__app.surface.debugQuestGo?.(8); const j = window.SSX.jobs?.active?.(); const t = j?.target; if (t) { const c = window.__app.surface.info.colony; window.__app.surface.debugPlace(c.x + t.x + 4, c.z + t.z + 4, 0); } window.__app.touchBtns.fire = true; });
    await sleep(5000); await app(() => { window.__app.touchBtns.fire = false; try { window.SSX.jobs.cancel?.(); window.SSX.jobs.quit?.(); } catch (e) {} });
    if (Date.now() - t0 > DUR) break;
    // club
    await app(() => { const cd = window.__app.surface.world.doorList().find(d => d.kind === 'club'); window.__app.surface.debugPlace(cd.x, cd.z + 0.4, Math.PI); });
    await sleep(400); await app(() => window.__app.surface.enterBuilding()); await wait(() => window.__app.surface.info.inside?.kind === 'club', 8000);
    await app(() => { window.__app.game.setFlag?.('vip'); window.__app.surface.world.openVip?.(); window.__app.surface.debugInside(7.6, -4.4, 0); });
    await sleep(6000); await app(() => window.__app.surface.debugInside(0, 2, Math.PI)); await sleep(4000);
    await app(() => window.__app.surface.leaveBuilding()); await sleep(1500);
    if (Date.now() - t0 > DUR) break;
    // farm
    await app(() => { const p = window.SSX.farm?.places?.()[0]; if (p) window.__app.surface.debugMove(p.x, p.z + 3, 0); });
    await app(() => { window.__app.joy.y = -0.6; }); await sleep(5000); await app(() => { window.__app.joy.y = 0; window.__app.surface.world.setWanted(0); });
  }
  stop = true; await sampler; await probe('end');
  fs.writeFileSync(OUT, JSON.stringify({ version, probes, S, errors: errors.slice(0, 30), loops: loop }, null, 1));
  console.log('done loops', loop, 'errors', errors.length, errors.slice(0, 5));
  await browser.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
