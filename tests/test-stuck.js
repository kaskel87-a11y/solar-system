// Stuck? help + Door Shift troublemaker markers e2e. Phone (WebKit 393x852, default) or DEV=desktop (1280x800).
// BASE=http://127.0.0.1:8995/ BR=webkit OUT=/tmp/stuck/ node tests/test-stuck.js     (BR=chromium DEV=desktop for the desktop pass)
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8995/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || '393x852';
const out = process.env.OUT || require('path').join(__dirname, '..', 'shots') + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const { defaultBrowserType: _d, ...iph } = pw.devices['iPhone 14'], desk = DEV === 'desktop';
  const ctx = await browser.newContext(desk ? { viewport: { width: 1280, height: 800 } } : { ...iph, viewport: { width: 393, height: 852 }, screen: { width: 393, height: 852 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  const errors = []; page.on('pageerror', e => /audio device/i.test(e.message) || errors.push('PE ' + e.message.slice(0, 200)));
  const G = (f, a) => page.evaluate(f, a), R = {}, bad = [], tag = `stuck-${desk ? '1280x800' : '393x852'}-${BR}`;
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); console.log(cond ? 'ok  ' : 'FAIL', k, typeof v === 'object' ? JSON.stringify(v) : v); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const frames = n => G(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const shot = async name => { for (let i = 0; i < 2; i++) { try { await page.screenshot({ path: `${out}${tag}-${name}.png`, timeout: 120000 }); console.log('shot', `${out}${tag}-${name}.png`); return true; } catch (e) {} } return false; };
  // pointer tap on an element: pointerdown -> pointerup (same id unless told otherwise, optional drift = a swipe)
  const tapEl = (sel, o = {}) => G(async ([sel, o]) => { const b = document.querySelector(sel); if (!b) return false; const r = b.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    const ev = (t, id, dx = 0) => new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: x + dx, clientY: y });
    b.dispatchEvent(ev('pointerdown', 41)); await new Promise(r => setTimeout(r, 60)); b.dispatchEvent(ev('pointerup', o.id ?? 41, o.drift || 0)); return true; }, [sel, o]);
  const click = async sel => desk ? page.click(sel, { timeout: 5000 }).then(() => true, () => false) : tapEl(sel);
  const popOpen = () => G(() => window.SSX.missionHelp.popOpen());
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 240000);
    await G(() => { localStorage.clear(); localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); });
    await G(() => window.__app.game?.reload?.());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 240000); await sleep(1500);
    await G(() => { document.getElementById('radioLater')?.click(); window.__app.game.setAliens?.(true); });
    ok('mission help loaded', await wait(() => !!window.SSX?.missionHelp && !!window.__activities?.quit, 20000));

    // ---------- 1. Door Shift: the troublemakers spawn as people, each with a red ◆ + a red minimap dot ----------
    const credits0 = await G(() => window.__app.game.info.credits);
    await G(() => window.__activities.warp('act-static-bounce')); await frames(10);
    ok('door shift started', await G(() => window.__activities.start('act-static-bounce').ok));
    for (let k = 0; k < 12 && (await G(() => window.__app.game.debug.step()?.type)) !== 'defeat'; k++) { await G(() => window.__app.surface.debugQuestGo(0.5)); await frames(8); }
    const st = await G(() => window.__app.game.debug.step());
    ok('on the troublemaker step', { type: st?.type, wave: st?.wave, ambush: !!st?.ambush }, st?.type === 'defeat' && st.wave.every(t => t === 'goon') && !st.ambush);
    await G(() => window.__app.surface.debugQuestGo(14)); await frames(10);
    ok('troublemakers spawn', await wait(() => window.__app.game.debug.agents().filter(a => a.src === 'quest').length === 2, 10000), await G(() => window.__app.game.debug.agents().filter(a => a.src === 'quest').map(a => a.type)));
    await G(() => window.__app.game.debug.calm(true)); await frames(12);
    const mk = await G(() => window.SSX.missionHelp.markers());
    ok('a red ◆ over each troublemaker (world)', mk, mk.foes === 2 && mk.world === 2);
    ok('a red dot for each on the minimap', mk, mk.minimap === 2);
    await frames(4); const mm = await G(() => window.__app.mapInfo?.() || null);
    ok('minimap draws them', mm, !!mm && (mm.marks || 0) >= 2 && (mm.aliens || 0) >= 2);
    if (!desk) {
      const np = await G(() => { const W = window.__app.surface.world, g = window.__app.game; return { people: W.debug.livePeople(), hum: g.humanCount(), budget: W.npcBudget(), floor: window.SSX.npcSlots.floor() }; });
      ok('phone: the wave holds a critical NPC slot (#67)', np, np.budget.reserved.questFoes === 2 && np.floor === 0);
      ok('phone: 12 or fewer NPCs with the wave up', np, np.people + np.hum <= 12);
    }
    await shot('doorshift-markers'); try { await page.locator('#miniMap').screenshot({ path: `${out}${tag}-doorshift-minimap.png` }); console.log('shot', `${out}${tag}-doorshift-minimap.png`); } catch (e) {}

    // ---------- 2. Stuck? on the card ----------
    const b = await G(() => { const e = document.getElementById('hxStuck'); if (!e) return null; const cs = getComputedStyle(e), r = e.getBoundingClientRect(); return { on: e.classList.contains('vis'), parent: e.parentNode?.id, bg: cs.backgroundColor, fg: cs.color, w: r.width, h: r.height, text: e.textContent, inView: r.right <= innerWidth && r.bottom <= innerHeight && r.left >= 0 && r.top >= 0 }; });
    ok('Stuck? on the mission card', b, b && b.on && b.parent === 'hxCard' && b.inView);
    ok('black button, white text', b, b && /rgb\(0, 0, 0\)/.test(b.bg) && /rgb\(255, 255, 255\)/.test(b.fg) && b.text === 'Stuck?');
    ok('44 px tap target', b, b && b.w >= 44 && b.h >= 44);
    if (!desk) {
      await tapEl('#hxStuck', { drift: 40 }); await frames(4); ok('a swipe over it does nothing', !(await popOpen()));
      await tapEl('#hxStuck', { id: 42 }); await frames(4); ok('pointerup from another finger does nothing', !(await popOpen()));
    }
    await click('#hxStuck'); await frames(4);
    const p1 = await G(() => ({ open: window.SSX.missionHelp.popOpen(), text: window.SSX.missionHelp.text(), skip: !!document.querySelector('#stuckPop .skip'), quit: !!document.querySelector('#stuckPop .quit'), pops: document.querySelectorAll('#stuckPop.on').length }));
    ok('tap: one plain hint (what, how far, which way, the marks)', p1, p1.open && /troublemakers/i.test(p1.text) && /(\d+ m|right next to you)/.test(p1.text) && /(ahead|right|left|behind|next to you)/.test(p1.text) && /red ◆/.test(p1.text));
    ok('no skip / quit before 3 min', p1, !p1.skip && !p1.quit);
    const pinged = await G(() => window.SSX.missionHelp.markers());
    await shot('stuck-hint'); try { await page.locator('#miniMap').screenshot({ path: `${out}${tag}-stuck-minimap.png` }); } catch (e) {}
    await page.keyboard.press('Digit6'); await frames(3); ok('key 6 closes it', !(await popOpen()));
    await page.keyboard.press('Digit6'); await frames(3); ok('key 6 opens it', await popOpen());
    await page.keyboard.press('KeyH'); await frames(2); // H is still ship travel (untouched); just make sure nothing of ours breaks
    await G(() => window.SSX.missionHelp.close());
    if (await G(() => !!window.__app.state.onSurface && window.__app.surface.info?.name !== 'Mars')) ok('H did not move us off Mars', false);
    // 3 min still: Skip this step / Quit job show up
    await G(() => window.SSX.missionHelp.debugStall(200)); await frames(2);
    await click('#hxStuck'); await frames(4);
    const p2 = await G(() => ({ text: window.SSX.missionHelp.text(), why: document.querySelector('#stuckPop .why')?.textContent, skip: !!document.querySelector('#stuckPop .skip'), quit: document.querySelector('#stuckPop .quit')?.textContent }));
    ok('after 3 min: Skip this step + Quit job, no penalty', p2, p2.skip && p2.quit === 'Quit job' && /No penalty/.test(p2.why || ''));
    await shot('stuck-stalled');
    const s0 = await G(() => window.__app.game.info.quest?.step);
    await click('#stuckPop .skip'); await frames(8);
    const s1 = await G(() => ({ done: !window.__app.game.info.quest, step: window.__app.game.info.quest?.step, type: window.__app.game.debug.step()?.type, foes: window.__app.game.debug.agents().filter(a => a.src === 'quest').length, credits: window.__app.game.info.credits, pop: window.SSX.missionHelp.popOpen() }));
    ok('Skip moves on (next step, or the last step finishes at once), wave gone, pop closed', { s0, s1 }, (s1.step === s0 + 1 || s1.done) && s1.foes === 0 && !s1.pop);
    ok('no credits lost', { credits0, now: s1.credits }, s1.credits >= credits0);
    // missing target: troublemakers vanish mid-step -> the way out shows at once
    await G(() => window.__activities.abandon()); await frames(4);
    await G(() => { const P = window.__app.game.progress; for (const k of Object.keys(P.quests)) if (/static-bounce/.test(k)) delete P.quests[k]; });
    await G(() => window.__activities.warp('act-static-bounce')); await frames(6); await G(() => window.__activities.start('act-static-bounce', true));
    for (let k = 0; k < 12 && (await G(() => window.__app.game.debug.step()?.type)) !== 'defeat'; k++) { await G(() => window.__app.surface.debugQuestGo(0.5)); await frames(8); }
    await G(() => window.__app.surface.debugQuestGo(14)); await wait(() => window.__app.game.debug.agents().some(a => a.src === 'quest'), 10000);
    await G(() => window.__app.game.debug.clear()); await frames(10);
    await click('#hxStuck'); await frames(4);
    const p3 = await G(() => ({ text: window.SSX.missionHelp.text(), skip: !!document.querySelector('#stuckPop .skip'), quit: !!document.querySelector('#stuckPop .quit') }));
    ok('target gone: way out at once', p3, p3.skip && p3.quit && /can't find/.test(p3.text));
    const c1 = await G(() => window.__app.game.info.credits);
    await click('#stuckPop .quit'); await frames(6);
    const q = await G(() => ({ act: window.__activities.active, quest: window.__app.game.info.quest, credits: window.__app.game.info.credits, btn: document.getElementById('hxStuck')?.classList.contains('vis') }));
    ok('Quit job ends it with no penalty', q, !q.act && !q.quest && q.credits >= c1 && !q.btn);
    // one pop-up at a time: with the side-jobs panel up, Stuck? won't stack on it
    await G(() => window.__activities.warp('act-static-bounce')); await G(() => window.__activities.start('act-static-bounce', true)); await frames(6);
    await G(() => window.__activities.openPanel?.()); await frames(3);
    const o = await G(() => ({ ...window.SSX.missionHelp.open('test'), pops: document.querySelectorAll('#stuckPop.on').length, panel: !!document.querySelector('[id$="Panel"].on') }));
    ok('no second pop-up over a panel', o, o.panel && !o.ok && !o.pops);
    await G(() => window.__activities.closePanel?.()); await G(() => window.__activities.abandon()); await frames(4);

    // ---------- 3. story mission + farm guide ----------
    const story = await G(() => { const g = window.__app.game, l = g.questList('Mars').filter(q => !q.active); for (const q of l) if (g.accept(q.id)) return q.id; return null; });
    await frames(10);
    await click('#hxStuck'); await frames(4);
    const p4 = await G(() => ({ text: window.SSX.missionHelp.text(), cur: window.SSX.missionHelp.current() }));
    ok('story mission: hint with way + distance', { story, text: p4.text }, !!story && p4.text.length > 10 && (/\b\d+(\.\d)? (m|km)\b|You're there|right here|right next/.test(p4.text) || p4.cur?.kind === 'none'));
    await G(() => { window.SSX.missionHelp.close(); window.__app.game.abandon(); }); await frames(6);
    const fg = await G(() => { const F = window.SSX.farm; if (!F) return null; F.guide.show?.(); F.guide.start?.(); return F.guide.status(); });
    await frames(10);
    const fb = await G(() => ({ shown: window.SSX.farm?.guide.status().shown, parent: document.getElementById('hxStuck')?.parentNode?.id, on: document.getElementById('hxStuck')?.classList.contains('vis') }));
    if (fg && fb.shown) {
      ok('farm guide: Stuck? on it', fb, fb.parent === 'farmGuide' && fb.on);
      await click('#hxStuck'); await frames(4);
      const t = await G(() => window.SSX.missionHelp.text());
      ok('farm guide hint names the place', t, /Dustbowl Homestead|Xen-7 Trading Post/.test(t) && /yellow beacon|You're there/.test(t));
      await shot('stuck-farm');
      await G(() => window.SSX.missionHelp.close());
    } else ok('farm guide shows', { fg, fb }, false);
    ok('no page errors', errors, !errors.length);
  } catch (e) { console.log('CRASH', e.stack); bad.push('crash'); }
  console.log(JSON.stringify({ tag, bad })); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
