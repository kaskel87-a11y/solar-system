// v7.6 test: private dances from any stage dancer (clubprivate.js). Walk up to Rhea / Kiara at the stage edge: the action
// button reads 'Private dance' (black, white text), 18+ gate, offer, pay, VIP booth scene, Tip, Leave back to the club,
// short-on-credits message, touching gets you thrown out, and Danny's own private show is untouched.
// BASE=http://localhost:8765/ BR=webkit DEV="iPhone 14" SHOTS_DIR=shots node tests/test-privdance.js   (DEV=desktop BR=chromium for keys)
const pw = require('playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', 'shots')) + '/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const vp = process.env.VP && process.env.VP.split('x').map(Number); // e.g. VP=393x852 on DEV="iPhone 14"
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV], ...(vp ? { viewport: { width: vp[0], height: vp[1] } } : {}) }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const tag = `${DEV}${vp ? '-' + process.env.VP : ''}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 120 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2, t = document.elementFromPoint(x, y); return { x, y, w: r.width, h: r.height, top: t && (t.id || t.closest('[id]')?.id) }; }, sel);
  const tapSel = async sel => { const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); return b; };
  const act = async () => { if (desk) await page.keyboard.press('KeyE'); else await tapSel('#driveBtn'); };
  const label = () => G(() => document.getElementById('driveBtn').textContent);
  const credits = () => G(() => window.__app.game.progress.credits);
  const shot = async n => { const p = `${out}privdance-${tag}-${n}.png`; await page.screenshot({ path: p }); (R.shots = R.shots || []).push(p); };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000)); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { const P = window.__app.game.progress; P.credits = 1000; window.__app.game.save(); window.__app.surface.world.setWanted(0); });
    const cd = await G(() => window.__app.surface.world.doorList().find(d => d.kind === 'club'));
    await G(([x, z]) => window.__app.surface.debugPlace(x, z + 0.4, Math.PI), [cd.x, cd.z]); await sleep(300);
    await G(() => window.__app.surface.enterBuilding()); ok('inClub', await wait(() => window.__app.surface.info.inside?.kind === 'club', 8000)); await sleep(800);
    ok('moduleUp', await G(() => !!window.__cprivate && window.__cprivate.price));
    const nb = await G(() => { const b = window.__app.surface.world.npcBudget?.(); return b ? { used: b.used, cap: b.cap } : null; });
    ok('npcBudget', nb && `${nb.used}/${nb.cap}`, !nb || (nb.used <= nb.cap && (desk || nb.cap <= 12)));
    // 1) Rhea: prompt near her (black button, white text)
    await G(() => window.__app.surface.debugInside(-2.8, -4.0, 0));
    ok('promptRhea', await wait(() => /Private dance/.test(document.getElementById('driveBtn').textContent) && window.__app.surface.info.spot?.id === 'privdance:rhea' && document.body.classList.contains('cpNear'), 5000));
    R.label = await label();
    const bw = await G(() => { const c = getComputedStyle(document.getElementById('driveBtn')); return c.backgroundColor + ' / ' + c.color; });
    ok('promptBW', bw, /rgba?\(0, 0, 0(, 1)?\)/.test(bw) && /255, 255, 255/.test(bw.split('/')[1]));
    await sleep(1500); await shot('prompt');
    await act(); ok('adultGate', await wait(() => getComputedStyle(document.getElementById('adultGate')).display === 'flex', 3000));
    await tapSel('#adultYes'); ok('offer', await wait(() => getComputedStyle(document.getElementById('cpOffer')).display === 'flex' && /Rhea Nebula/.test(document.getElementById('cpName').textContent) && /120 cr/.test(document.getElementById('cpYes').textContent), 3000));
    const pf = await G(() => { const e = document.getElementById('driveBtn'); return e.scrollHeight <= e.clientHeight + 1; }); ok('promptFits', pf);
    const yb = await center('#cpYes'); ok('offerBtn44', `${Math.round(yb.w)}x${Math.round(yb.h)} top=${yb.top}`, yb.h >= 44 && yb.top === 'cpYes');
    const c0 = await credits(); await tapSel('#cpYes');
    ok('paid', await wait(c => window.__app.game.progress.credits === c - window.__cprivate.price, 4000, c0));
    ok('sceneOpen', await wait(() => window.__cprivate.active && window.__cprivate.state.ready && document.body.classList.contains('cpshow') && getComputedStyle(document.getElementById('cpShow')).display === 'flex', 20000));
    await sleep(1500);
    ok('camInBooth', await G(() => window.__cprivate.state.camInBooth));
    ok('herSign', await G(() => window.__cprivate.state.signName && window.__cprivate.state.dannySignHidden));
    ok('hudHidden', await G(() => getComputedStyle(document.getElementById('surfHud')).visibility === 'hidden'));
    ok('caption', await G(() => document.getElementById('cpCap').textContent), await G(() => /^Rhea:/.test(document.getElementById('cpCap').textContent)));
    await sleep(800); await shot('scene');
    const tb = await center('#cpTip'); ok('tipBtn44', `${Math.round(tb.w)}x${Math.round(tb.h)} top=${tb.top}`, tb.h >= 44 && tb.top === 'cpTip');
    const l0 = await G(() => window.__cprivate.state.left), c1 = await credits();
    if (desk) await page.keyboard.press('KeyT'); else await tapSel('#cpTip'); await sleep(400);
    ok('tip', await G(([l, c]) => window.__cprivate.state.tips === 1 && window.__cprivate.state.left > l + 4 && window.__app.game.progress.credits === c - 20, [l0, c1]));
    R.tipLine = await G(() => document.getElementById('cpCap').textContent);
    await sleep(600); await shot('after-tip');
    if (desk) await page.keyboard.press('Escape'); else await tapSel('#cpLeave');
    ok('leaveEnds', await wait(() => !window.__cprivate.active && !document.getElementById('fadeBlack').classList.contains('on'), 6000));
    ok('backInClub', await G(() => window.__app.surface.info.inside?.kind === 'club' && !document.body.classList.contains('pshow') && !document.body.classList.contains('cinebars')));
    await sleep(500); await shot('back-in-club');
    // 2) Kiara: short on credits -> message, no charge, no scene
    await G(() => window.__app.surface.debugInside(2.8, -4.0, 0));
    ok('promptKiara', await wait(() => /Private dance/.test(document.getElementById('driveBtn').textContent) && window.__app.surface.info.spot?.id === 'privdance:kiara', 5000));
    await G(() => { window.__app.game.progress.credits = 50; window.__app.game.save(); });
    await act(); await wait(() => getComputedStyle(document.getElementById('cpOffer')).display === 'flex', 3000); await tapSel('#cpYes');
    ok('brokeMsg', await wait(() => /Kiara: A song is/.test(document.getElementById('toast')?.textContent || ''), 3000));
    ok('brokeNoCharge', await G(() => window.__app.game.progress.credits === 50 && !window.__cprivate.active));
    // 3) Kiara with money: touch brings Tiny, thrown out
    await G(() => { window.__app.game.progress.credits = 1000; window.__app.game.save(); }); await sleep(2600);
    await act(); await wait(() => getComputedStyle(document.getElementById('cpOffer')).display === 'flex', 3000); await tapSel('#cpYes');
    ok('kiaraScene', await wait(() => window.__cprivate.active && window.__cprivate.state.id === 'kiara' && window.__cprivate.state.ready, 20000)); await sleep(1200);
    if (desk) await page.keyboard.press('KeyE'); else await tapSel('#cpTouch');
    ok('bouncer', await wait(() => /TINY/.test(document.getElementById('cpCap').textContent), 3000));
    ok('thrownOut', await wait(() => !window.__app.surface.info.inside && !window.__cprivate.active, 8000));
    await wait(() => !document.getElementById('fadeBlack').classList.contains('on'), 6000);
    // 4) Danny's own flow untouched (her 150 show from the VIP room)
    await G(() => window.__app.surface.enterBuilding()); ok('reEnter', await wait(() => window.__app.surface.info.inside?.kind === 'club', 8000)); await sleep(500);
    await G(() => { window.__app.game.setFlag?.('vip'); window.__app.surface.world.openVip(); window.__app.surface.debugInside(6.55, -5.3, 0); });
    ok('dannyLabel', await wait(() => /Private show 150/.test(document.getElementById('driveBtn').textContent) && !document.body.classList.contains('cpNear'), 4000));
    await act(); ok('dannyOffer', await wait(() => getComputedStyle(document.getElementById('pshowOffer')).display === 'flex', 3000));
    ok('dannyButtons', await G(() => /Private show · 150/.test(document.getElementById('pshowYes').textContent) && /Lap dance · 250/.test(document.getElementById('pshowLap').textContent)));
    const c3 = await credits(); await tapSel('#pshowYes');
    ok('dannyPaid150', await wait(c => window.__app.game.progress.credits === c - 150, 4000, c3));
    ok('dannyShow', await wait(() => window.__pshow.active && window.__pshow.state.ready && !window.__cprivate.active, 20000));
    await sleep(1000); if (desk) await page.keyboard.press('Escape'); else await tapSel('#pshowLeave');
    ok('dannyLeave', await wait(() => !window.__pshow.active && !document.getElementById('fadeBlack').classList.contains('on'), 6000));
    await G(() => window.__app.surface.leaveBuilding());
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 300)); }
  R.errors = errors.slice(0, 5); if (errors.length) bad.push('errors');
  R.bad = bad; console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
