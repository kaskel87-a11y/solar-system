// Multi-planet expansion test (planets/*.js): first landing on Venus, then ☰ → 🌍 Colonies fast travel through
// Mercury, Titan, Europa and Io. At each colony: colony + contacts + signature vehicle exist, Take the signature ride by touch,
// talk to a contact by touch and accept a job, the HUD has no overlaps and keeps the middle 50% clear, draw calls stay near Mars.
// BASE=http://localhost:8781/ DEV="iPhone 14" BR=webkit node test-planets.js
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8781/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const out = process.env.OUT || '/tmp/', PFX = process.env.PFX || 'planets';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
const WORLDS = [
  { w: 'Venus', colony: 'Sulfur Gate', veh: 'acid_crawler', contact: 'Dee Varga', permit: 'mars-hotcargo' },
  { w: 'Mercury', colony: 'Shadowline Array', veh: 'sun_skimmer', contact: 'Dr. Takacs', permit: 'mars-salvage' },
  { w: 'Titan', colony: 'Kraken Landing', veh: 'methane_skiff', contact: 'Lark', permit: 'moon-invitational' },
  { w: 'Europa', colony: 'Conamara Station', veh: 'crevasse_sled', contact: 'Juno Reyes', permit: 'titan-wetwork' },
  { w: 'Io', colony: 'Loki Forge', veh: 'lava_runner', contact: 'Cinder', permit: 'europa-transfer' }
];
function measure() {
  const hud = document.getElementById('surfHud'); const W = innerWidth, H = innerHeight;
  const EXPAND = new Set(['stackR', 'surfBtns', 'ctxBar']), SKIP = new Set(['crosshair', 'hurt', 'downMsg', 'roverMenu']);
  const vis = e => { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity < 0.05 || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const items = [];
  const add = (e, clip) => { if (!e || SKIP.has(e.id) || !vis(e)) return; let r = e.getBoundingClientRect(); r = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    if (clip) { r = { l: Math.max(r.l, clip.l), t: Math.max(r.t, clip.t), r: Math.min(r.r, clip.r), b: Math.min(r.b, clip.b) }; if (r.r - r.l < 1 || r.b - r.t < 1) return; }
    items.push({ id: e.id || e.className, ...r }); };
  for (const e of hud.children) {
    if (EXPAND.has(e.id)) { if (!vis(e)) continue; const pr = e.getBoundingClientRect(), ov = getComputedStyle(e).overflow !== 'visible'; for (const c of e.children) add(c, ov ? { l: pr.left, t: pr.top, r: pr.right, b: pr.bottom } : null); }
    else add(e);
  }
  for (const id of ['joy', 'discPop', 'fact-panel']) if (!hud.contains(document.getElementById(id))) add(document.getElementById(id));
  const overlaps = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const a = items[i], b = items[j]; if (a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5) overlaps.push(`${a.id}×${b.id}`); }
  const C = { l: W * 0.25, r: W * 0.75, t: H * 0.25, b: H * 0.75 };
  return { n: items.length, overlaps, center: items.filter(a => a.l < C.r && C.l < a.r && a.t < C.b && C.t < a.b).map(a => a.id) };
}
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const { defaultBrowserType, ...d } = devices[DEV];
  const ctx = await browser.newContext(d); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const shot = s => page.screenshot({ path: `${out}${PFX}-${tag}-${s}.png` });
  const tapAt = async sel => { const r = await G(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, sel); if (r) await page.touchscreen.tap(r.x, r.y); return !!r; };
  const landed = w => wait(w => { const s = window.__app.state; return s.onSurface && !s.transitioning && s.info?.name === w && window.__app.surface.info?.intro === 0; }, 120000, w);
  const calls = () => G(async () => { await new Promise(r => setTimeout(r, 600)); return window.__app.renderer.info.render.calls; });
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => { ['ssx.game.v1', 'ssx.planets.v1'].forEach(k => localStorage.removeItem(k)); });
    ok('api', await G(() => JSON.stringify(window.__app.planets?.list)), await G(() => window.__app.planets?.list?.length === 5));
    ok('menuBtn', await G(() => !!document.querySelector('#roverMenu #colBtn')));
    // baseline: Mars draw calls
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh)); await landed('Mars'); await sleep(1500);
    await G(() => window.__app.game.debug.clear());
    const marsCalls = await calls(); R.marsCalls = marsCalls;
    // permits: Venus locked until Rook's referral
    await G(() => { window.__app.toggleMenu(true); }); await sleep(200); await tapAt('#colBtn');
    ok('panelOpen', await wait(() => getComputedStyle(document.getElementById('colPanel')).display !== 'none', 5000));
    ok('venusLocked', await G(() => document.querySelector('#colList [data-go="Venus"]')?.textContent), await G(() => document.querySelector('#colList [data-go="Venus"]')?.disabled === true));
    await shot('panel-locked'); await tapAt('#colClose'); await sleep(200);
    await G(() => { const P = window.__app.game.progress; P.credits = 1000; window.__app.game.save(); });
    for (let i = 0; i < WORLDS.length; i++) {
      const W = WORLDS[i], k = W.w.toLowerCase();
      // unlock the permit (as if the referral job was done) and fast travel via ☰ → 🌍 Colonies
      await G(id => { const P = window.__app.game.progress; P.quests[id] = { ...(P.quests[id] || {}), status: 'done', everDone: true }; window.__app.game.save(); }, W.permit);
      await G(() => window.__app.toggleMenu(true)); await sleep(250);
      await tapAt('#colBtn'); await sleep(300);
      const cr0 = await G(() => window.__app.game.progress.credits);
      const label = await G(w => document.querySelector(`#colList [data-go="${w}"]`)?.textContent, W.w);
      if (i === 0) await shot('panel');
      await tapAt(`#colList [data-go="${W.w}"]`);
      const t0 = Date.now(); const arrived = await landed(W.w); R[k + '_travelS'] = Math.round((Date.now() - t0) / 1000);
      ok(k + '_travel', label, arrived && /Travel/.test(label || ''));
      if (!arrived) continue;
      ok(k + '_fee', await G(() => window.__app.game.progress.credits), (await G(() => window.__app.game.progress.credits)) === cr0 - 40);
      await sleep(1500); await G(() => window.__app.game.debug.clear()); await sleep(300);
      const info = await G(() => window.__app.surface.info);
      ok(k + '_colony', info.colony?.name, info.colony?.name === W.colony);
      const ppl = await G(() => window.__app.surface.world.debug.people());
      const contacts = ppl.filter(p => p.kind === 'contact').length; R[k + '_people'] = ppl.length;
      ok(k + '_contacts', contacts, contacts >= 2);
      ok(k + '_npcCap', ppl.length, ppl.length <= 12);
      const m = await G(measure); ok(k + '_hud', m.overlaps.length || m.center.length ? JSON.stringify(m) : `ok ${m.n}`, !m.overlaps.length && !m.center.length);
      await shot(k + '-landing');
      const c = await calls(); ok(k + '_calls', c, c <= marsCalls * 1.25 + 20);
      // signature vehicle: Take by touch, then Exit
      const v = await G(k => window.__app.surface.world.debug.vehicles().find(v => v.kind === k && v.parked), W.veh);
      ok(k + '_vehicle', !!v);
      if (v) {
        await G(v => { window.__app.game.debug.clear(); window.__app.surface.world.setWanted(0); window.__app.surface.debugMove(v.x + 3.4, v.z + 1.2, 1.2); }, v);
        const shown = await wait(() => /Take/.test(document.getElementById('driveBtn').textContent) && getComputedStyle(document.getElementById('driveBtn')).display !== 'none', 10000);
        await tapAt('#driveBtn');
        const got = await wait(k => window.__app.surface.info.driving && window.__app.surface.info.vehicle === k, 6000, W.veh);
        ok(k + '_take', shown && got);
        if (got) { const m2 = await G(measure); ok(k + '_hudDrive', m2.overlaps.length ? m2.overlaps.join() : 'ok', !m2.overlaps.length); await shot(k + '-drive'); }
        await sleep(300); await tapAt('#driveBtn'); ok(k + '_exit', await wait(() => !window.__app.surface.info.driving, 6000));
        await G(() => window.__app.surface.world.setWanted(0));
      }
      // talk to the contact by touch and accept the job
      const cp = await G(n => window.__app.surface.world.debug.people().find(p => p.kind === 'contact' && p.name === n) || window.__app.surface.world.debug.people().find(p => p.kind === 'contact'), W.contact);
      if (await G(() => document.getElementById('radio').getBoundingClientRect().height > 0 && getComputedStyle(document.getElementById('radioLater')).display !== 'none')) { await tapAt('#radioLater'); await sleep(300); }
      if (cp) await G(p => window.__app.surface.debugMove(p.x + 1.5, p.z + 1.5, 0), cp);
      const talkShown = await wait(() => /💬/.test(document.getElementById('driveBtn').textContent), 10000);
      await tapAt('#driveBtn');
      const offered = await wait(() => getComputedStyle(document.getElementById('radioAccept')).display !== 'none' && document.getElementById('radio').getBoundingClientRect().height > 0 && / cr\]/.test(document.getElementById('radioText').textContent), 8000);
      if (offered) await tapAt('#radioAccept');
      const q = await (async () => { await wait(() => !!window.__app.game.info.quest, 6000); return G(() => window.__app.game.info.quest); })();
      ok(k + '_job', q?.title, talkShown && offered && !!q && q.id.startsWith(k + '-'));
      await shot(k + '-job');
    }
    // the Io visit persisted, the radio carries local DJ lines
    ok('visited', await G(() => window.__app.planets.state().visited.join()), (await G(() => window.__app.planets.state().visited.length)) === 5);
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 300)); }
  R.errors = errors.filter(e => !/favicon|404/.test(e)).slice(0, 8);
  if (R.errors.length) bad.push('errors');
  console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS');
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
