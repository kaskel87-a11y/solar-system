// Mission depth e2e (WebKit/Chromium, phone 393x852): plays Vale's moving mark, the first heist (tip -> ☰ Heists -> clean
// getaway, plus a legacy-save reload), and a best-of-3 Pit series to the purse.
// BASE=http://127.0.0.1:8971/ BR=webkit OUT=/workspace/pw-ben-depth/shots/ ONLY=mark,heist,pit node tests/test-depth.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8971/', BR = process.env.BR || 'webkit', ONLY = (process.env.ONLY || 'mark,heist,pit').split(',');
const out = process.env.OUT || require('path').join(__dirname, '..', 'shots') + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'];
  const ctx = await browser.newContext({ ...iph, viewport: { width: 393, height: 852 }, screen: { width: 393, height: 852 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  const errors = []; page.on('pageerror', e => /audio device/i.test(e.message) || errors.push('PE ' + e.message.slice(0, 200)));
  const G = (f, a) => page.evaluate(f, a), R = {}, bad = [], tag = `depth-393x852-${BR}`;
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); console.log(cond ? 'ok  ' : 'FAIL', k, typeof v === 'object' ? JSON.stringify(v) : v); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const frames = n => G(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const shot = async name => { for (let i = 0; i < 2; i++) { try { await page.screenshot({ path: `${out}${tag}-${name}.png`, timeout: 120000 }); return true; } catch (e) {} } return false; };
  const tapEl = sel => G(async sel => { const b = document.querySelector(sel); if (!b) return false; const r = b.getBoundingClientRect(), o = { pointerId: 61, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
    b.dispatchEvent(new PointerEvent('pointerdown', o)); await new Promise(r => setTimeout(r, 60)); b.dispatchEvent(new PointerEvent('pointerup', o)); return true; }, sel);
  const aj = (x, z) => G(([x, z]) => { const w = window.__app.surface.world.colonyAt([x, z]); window.__app.surface.debugMove(w.x, w.z, 0); }, [x, z]);
  const radio = () => G(() => { const r = document.getElementById('radio'); return r && getComputedStyle(r).display !== 'none' ? (document.getElementById('radioFrom').textContent + ': ' + document.getElementById('radioText').textContent) : null; });
  async function land(prep) {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 240000);
    await G(prep); await G(() => window.__app.game?.reload?.());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 240000); await sleep(1500);
    await G(() => document.getElementById('radioLater')?.click());
  }
  const freshSave = () => { localStorage.clear(); localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"done":true,"skipped":true}'); };
  try {
    await land(freshSave);
    await G(() => { window.__app.game.setAliens?.(true); });
    // ---------------- 1. Vale's mark ----------------
    if (ONLY.includes('mark')) {
      await aj(-34, -414);
      ok('vale started', await G(() => window.__activities.start('act-vale-scanner').ok));
      await wait(() => window.__app.game.debug.quest()?.id === 'act-act-vale-scanner', 8000);
      await G(() => window.__app.surface.debugQuestGo(0.5)); // step 0: the board at the precinct
      ok('on the mark step', await wait(() => !!window.__app.game.debug.step()?.mark, 10000));
      await aj(0, -560); await frames(10);
      const far = await G(() => ({ text: window.__app.game.info.quest?.text, m: window.__activities.mark, wp: window.__app.surface.waypoint() }));
      ok('step says who and where', far.text, /Kessa Vane/.test(far.text || '') && /Olympus Row/.test(far.text || ''));
      ok('no marker from far away', far.m, !!far.m && !far.m.show && !far.wp);
      ok('mark has a body (NPC budget allowed)', far.m?.body);
      const m1 = await G(() => window.__activities.mark); await sleep(3000); const m2 = await G(() => window.__activities.mark);
      ok('mark moves or waits on her loop', { m1, m2 }, !!m1 && !!m2);
      // walk toward her until about 50 m: the marker appears
      await G(() => { const m = window.__activities.mark, W = window.__app.surface.world; let best = null; // stand ~45 m out with a clear sight line
        for (let k = 0; k < 24 && !best; k++) { const a = k / 24 * Math.PI * 2, px = m.x + Math.sin(a) * 30, pz = m.z + Math.cos(a) * 30; let clear = true; for (let t = 0.05; t <= 1; t += 0.03) if (W.collide(px + (m.x - px) * t, pz + (m.z - pz) * t, 0.4)) { clear = false; break; } if (clear) best = [px, pz, a]; }
        const [px, pz, a] = best || [m.x + 30, m.z, Math.PI / 2]; window.__app.surface.debugMove(px, pz, a); });
      ok('marker appears within 60 m', await wait(() => window.__activities.mark?.show && !!window.__app.surface.waypoint(), 8000), await G(() => window.__activities.mark));
      await frames(10); await shot('mark-marker'); try { await page.locator('#miniMap').screenshot({ path: `${out}${tag}-mark-minimap.png` }); } catch (e) {}
      // confront: walk up to her (she keeps moving; debugQuestGo follows the live marker)
      for (let k = 0; k < 8 && (await G(() => !!window.__app.game.debug.step()?.mark)); k++) { await G(() => window.__app.surface.debugQuestGo(0.6)); await frames(4); }
      ok('reaching her completes the step', await wait(() => window.__app.game.debug.step()?.type === 'defeat', 8000), await G(() => window.__app.game.info.quest?.text));
      const hand = await G(() => { const t = window.__app.game.debug.target(), m = window.__activities.mark; return { t: t && [Math.round(t.x), Math.round(t.z)], m }; });
      ok('the muscle shows up where she was', hand, !!hand.t && hand.m?.found && Math.hypot(hand.t[0] - hand.m.x, hand.t[1] - hand.m.z) < 4);
      // tip path: restart, stay far away, Vale's tip line turns the marker on
      await G(() => window.__activities.abandon()); await G(() => { const g = window.__app.game; const P = g.progress; delete P.quests['act-act-vale-scanner']; });
      await aj(-34, -414); await G(() => window.__activities.start('act-vale-scanner')); await G(() => window.__app.surface.debugQuestGo(0.5));
      await wait(() => !!window.__app.game.debug.step()?.mark, 10000); await aj(0, -560); await frames(6);
      await G(() => window.__activities.markTip()); await frames(6);
      const tipT = await wait(() => /Vale/i.test(document.getElementById('radioFrom')?.textContent || '') && /Kessa/.test(document.getElementById('radioText')?.textContent || ''), 6000);
      ok('tip line from Vale', await radio(), tipT);
      ok('tip turns the marker on from far away', await G(() => window.__activities.mark?.show && !!window.__app.surface.waypoint()));
      await G(() => window.__activities.abandon()); await frames(4);
      ok('abandon clears the mark + its NPC slot', await G(() => window.__activities.mark === null && !window.__app.surface.world.npcBudget().reserved.valeMark));
    }
    // ---------------- 2. first heist ----------------
    if (ONLY.includes('heist')) {
      const menuHas = () => G(() => !!document.getElementById('heistMenu'));
      ok('no Heists entry before the tip', !(await menuHas()));
      const ids = await G(async () => (await import('./citydata.js')).CITY_MISSIONS.map(m => m.id));
      for (let k = 0; k < 3; k++) {
        await G(id => { const P = window.__app.game.progress; P.quests[id] = { status: 'done', everDone: true, step: 0, n: 0 }; window.__app.game.save?.(); }, ids[k]);
        await sleep(1300); if (k < 2) ok(`still locked after ${k + 1} mission(s)`, !(await menuHas()));
      }
      ok('informant texts after 3 city missions', await wait(() => /Halvorsen Villa/.test(document.getElementById('radioText')?.textContent || ''), 8000), await radio());
      await G(() => document.getElementById('radio')?.classList.remove('mini')); await frames(3); await shot('heist-tip');
      ok('unlock saved', await G(() => JSON.parse(localStorage.getItem('ssx.heist.unlock') || '{}')), await G(() => { const s = JSON.parse(localStorage.getItem('ssx.heist.unlock') || '{}'); return s.v === 1 && s.unlocked && s.tipped; }));
      ok('☰ Heists entry appears', await menuHas());
      await G(() => document.getElementById('radio').style.display = 'none');
      await tapEl('#menuBtn'); await sleep(600); await shot('heist-menu');
      await tapEl('#heistMenu'); ok('heist board lists the villa', await wait(() => /Halvorsen Villa/.test(document.getElementById('heistPanel')?.textContent || '') && document.getElementById('heistPanel').classList.contains('on'), 5000));
      await tapEl('#heistPanel button[data-id="heist-halvorsen-villa"]'); ok('heist started', await wait(() => window.SSX.heist.active?.id === 'heist-halvorsen-villa', 5000));
      await G(() => { window.__hlog = []; for (const e of ['done', 'escape', 'safe:result']) window.SSX.heist.on(e, d => window.__hlog.push([e, d])); });
      ok('villa placed', await wait(() => !!window.SSX.heist.active?.w, 10000));
      const w = await G(() => { const H = window.SSX.heist.active, W = window.__app.surface.world; return { door: H.w.door, safe: H.w.safe, site: H.w.site, free: !W.collide(H.w.site.x, H.w.site.z + 10, 0.5) }; });
      const zone = await G(s => window.__app.surface.world.districtAt?.(s.x, s.z)?.name || null, w.site);
      ok('villa on open ground in Helios Heights', { zone, free: w.free }, w.free && /Helios/.test(zone || ''));
      await G(() => { for (const c of window.SSX.heist.cameras()) window.SSX.heist.disableCamera(c.id, 300); window.__app.surface.world.setWanted(0); });
      await G(d => window.__app.surface.debugMove(d.x, d.z + 0.8, 0), w.door); await frames(8);
      ok('break-in button at the door', await wait(() => /Break in/.test(window.SSX.heist.action || ''), 8000), await G(() => window.SSX.heist.action));
      await shot('heist-door');
      await tapEl('#heistBtn'); ok('inside: crack stage', await wait(() => window.SSX.heist.active?.stage === 'crack', 8000));
      await G(d => window.__app.surface.debugMove(d.x, d.z + 0.6, 0), w.safe); await frames(6);
      ok('crack button at the safe', await wait(() => /Crack/.test(window.SSX.heist.action || ''), 8000));
      const c0 = await G(() => window.__app.game.progress.credits);
      await G(() => { const H = window.SSX.heist, o = H.safeCrack; H.safeCrack = () => { H.safeCrack = o; return Promise.resolve({ success: true, ok: true, time: 20, noise: 0 }); }; });
      await tapEl('#heistBtn');
      ok('safe open: escape', await wait(() => window.SSX.heist.active?.stage === 'escape', 8000));
      await G(s => window.__app.surface.debugMove(s.x + 45, s.z + 30, 0), w.site);
      await wait(() => window.SSX.heist.active?.stage !== 'escape', 15000); await G(() => window.__app.surface.world.setWanted(0, 'test: lost them'));
      ok('clean getaway', await wait(() => window.__hlog.some(e => e[0] === 'done' && e[1].success), 10000), await G(() => window.__hlog.map(e => e[0])));
      ok('loot paid', await G(c => window.__app.game.progress.credits - c, c0), await G(c => window.__app.game.progress.credits > c, c0));
      // returning player with a legacy save and no new missions: unlocked, no second text
      await land(() => { localStorage.setItem('ssx.heist.unlock', 'true'); });
      await sleep(2500);
      ok('legacy save migrates (menu, no repeat text)', await G(() => ({ s: localStorage.getItem('ssx.heist.unlock'), menu: !!document.getElementById('heistMenu'), radio: document.getElementById('radioText')?.textContent })), await G(() => { const s = JSON.parse(localStorage.getItem('ssx.heist.unlock')); return s.v === 1 && s.unlocked && s.tipped && !!document.getElementById('heistMenu') && !/Halvorsen/.test(document.getElementById('radioText')?.textContent || ''); }));
    }
    // ---------------- 3. the Pit, best of 3 ----------------
    if (ONLY.includes('pit')) {
      await G(() => window.__activities.warp('act-pit-fight')); await frames(6); await G(() => window.__app.surface.world.setWanted(0));
      const c0 = await G(() => window.__app.game.progress.credits);
      ok('pit started', await G(() => window.__activities.start('act-pit-fight').ok));
      const line = () => G(() => (document.getElementById('actChip')?.innerText || '').replace(/\s+/g, ' '));
      const fight = async win => { // win: swing until KO; lose: yield once it starts
        await wait(() => window.__app.surface.info.duel?.phase === 'fight', 20000);
        if (!win) { await G(() => window.__app.surface.world.yieldDuel()); return; }
        for (let k = 0; k < 90 && (await G(() => !!window.__app.surface.info.duel)); k++) {
          await G(() => { const s = window.__app.surface, d = s.info.duel, i = s.info; if (!d || d.phase !== 'fight') return; s.debugPlace(d.x + 1.1, d.z, Math.atan2(-(d.x - i.x), -(d.z - i.z))); });
          await G(() => { const b = document.getElementById('meleeBtn'); if (!b) return; const r = b.getBoundingClientRect(), o = { pointerId: 71, pointerType: 'touch', isPrimary: false, bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; b.dispatchEvent(new PointerEvent('pointerdown', o)); b.dispatchEvent(new PointerEvent('pointerup', o)); });
          await sleep(300);
        }
      };
      ok('round 1 line', await wait(() => /Round 1 of 3 · You 0 – 0/.test(document.getElementById('actChip')?.innerText || ''), 8000), await line());
      await fight(true);
      ok('round 1 to you: break, then round 2', await wait(() => /Round 2 of 3 · You 1 – 0/.test(document.getElementById('actChip')?.innerText || ''), 10000), await line());
      ok('about 5 s break', await G(() => { const p = window.__activities.pit; return p && p.breakUntil - performance.now() > 2500; }));
      await frames(4); await shot('pit-round2');
      ok('new / recovered fighter for round 2', await wait(() => !!window.__app.surface.info.duel, 12000), await G(() => window.__app.surface.info.duel?.name));
      await fight(false);
      ok('round 2 to them: 1 – 1', await wait(() => /Round 3 of 3 · You 1 – 1/.test(document.getElementById('actChip')?.innerText || ''), 10000), await line());
      ok('nothing paid mid-series', await G(c => window.__app.game.progress.credits <= c, c0));
      await wait(() => !!window.__app.surface.info.duel, 12000); await fight(true);
      ok('series won 2–1: purse paid once', await wait(() => !window.__activities.active && window.__activities.pitPay?.result === 'win', 12000), await G(() => window.__activities.pitPay));
      await shot('pit-payout');
      const toastT = await G(() => document.getElementById('toast')?.textContent || '');
      ok('purse toast', toastT, /Series won 2–1\. Purse \+200 cr/.test(toastT));
      const paid = await G(c => window.__app.game.progress.credits - c, c0); ok('purse paid exactly once', paid, paid === 200);
      // walk out still forfeits
      await G(() => window.__activities.start('act-pit-fight')); await wait(() => window.__app.surface.info.duel?.phase === 'fight', 20000);
      await G(() => { const s = window.__app.surface, d = s.info.duel; if (d) s.debugPlace(d.cx + 16, d.cz, 0); }); 
      ok('walk out forfeits the series', await wait(() => !window.__activities.active, 8000));
    }
  } catch (e) { bad.push('EXC ' + e.message); console.log('EXC', e.message); }
  R.errors = errors.slice(0, 8); if (R.errors.length) console.log(R.errors); ok('no page errors', R.errors.length === 0, R.errors.length === 0);
  console.log(JSON.stringify({ tag, bad }));
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
