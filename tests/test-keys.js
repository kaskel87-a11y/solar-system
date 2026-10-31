// v7.5.16 (Collin: "Dealer" had no key; every on-screen action needs a keyboard shortcut on desktop).
// Desktop Chromium: at the dealer, garage, a race start line, the farm and the ship, every visible action button must have a
// binding (SSX.keys.audit(): own module key, Enter / Shift+Enter, or 1-9 in an open card) and show it on the button.
// Then: Enter at the dealer opens the dealer sheet, 1-9 are on its options, Esc closes it; Enter at the start line starts the race,
// Enter on the result card is Rematch. A touch context hides every key label.
// BASE=http://127.0.0.1:8977/ node tests/test-keys.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8889/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
(async () => {
  const browser = await pw.chromium.launch({ args: ARGS });
  const R = {}, bad = [], errors = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  async function boot(opts) {
    const ctx = await browser.newContext(opts); const page = await ctx.newPage(); page.setDefaultTimeout(180000);
    page.on('pageerror', e => /audio device/i.test(e.message) || errors.push('PE ' + e.message.slice(0, 200)));
    const G = (f, a) => page.evaluate(f, a), wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 200 }); return true; } catch (e) { return false; } };
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 180000);
    await G(() => { localStorage.clear(); localStorage.setItem('ssx.adult', '1'); localStorage.setItem('ssx.onboard.v1', '{"v":1,"status":"done","done":true,"skipped":true}'); localStorage.setItem('ssx.firehint.v1', '1'); });
    await page.reload(); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 180000);
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(1000);
    await G(() => { document.getElementById('radioLater')?.click(); const g = window.__app.game; g.debug?.calm?.(true); g.setAliens?.(false); g.debug?.credits?.(5000); });
    await wait(() => !!window.SSX?.keys, 10000);
    return { page, G, wait, ctx };
  }
  // every visible action button bound + labelled (own "(X)" in its text, or the ::after key label)
  const auditAt = async (G, where) => {
    await sleep(900);
    const a = await G(() => { const out = window.SSX.keys.audit();
      for (const e of out) if (e.kind === 'context') { const el = e.id ? document.getElementById(e.id) : null; const after = el ? getComputedStyle(el, '::after').content : ''; e.shown = !!el && (/\([^)]+\)\s*$/.test(el.textContent.trim()) || /\(/.test(after)); }
      return out; });
    const miss = a.filter(e => !e.key || (e.kind === 'context' && !e.shown));
    R['audit_' + where] = a.map(e => `${e.label || e.kind}=${e.key}`).join(' | ');
    ok('bound_' + where, miss.length ? miss : true, !miss.length);
    return a;
  };
  try {
    const { page, G, wait } = await boot({ viewport: { width: 1366, height: 768 } });
    await page.mouse.move(10, 10);
    await auditAt(G, 'ship');
    // dealer: the context button gets Enter, Enter opens the sheet, 1-9 on its options, Esc closes it
    await G(() => window.__dealer.tp('dealer', 13));
    ok('dealerCtx', await wait(() => window.__dealer.ctx?.shown, 8000));
    const da = await auditAt(G, 'dealer');
    const dl = da.find(e => e.id === 'dlrCtxBtn'); ok('dealerKey', dl ? `${dl.label} -> ${dl.key}` : null, dl?.key === 'Enter');
    R.dealerLabel = await G(() => { const b = document.getElementById('dlrCtxBtn'); return b.textContent + getComputedStyle(b, '::after').content; });
    await page.keyboard.press('Enter');
    ok('enterOpensDealer', await wait(() => !!window.__dealer.sheet, 4000));
    await auditAt(G, 'dealerSheet');
    R.sheetNums = await G(() => [...document.querySelectorAll('.kbNum')].slice(0, 4).map(b => b.dataset.kbn + ':' + b.textContent.trim().slice(0, 20)));
    ok('sheetNumbered', R.sheetNums.length > 0);
    await page.keyboard.press('Escape');
    ok('escClosesDealer', await wait(() => !window.__dealer.sheet, 4000));
    // garage
    await G(() => window.__dealer.tp('garage', 8)); await auditAt(G, 'garage');
    // farm (first place), if the farm module is on
    const fp = await G(() => (window.SSX.farm?.places?.() || [])[0] || null);
    if (fp) { await G(p => window.__app.surface.debugMove(p.x + 2, p.z + 2, 0), fp); await auditAt(G, 'farm'); }
    // race start line: Race (Enter); Enter starts it, and Rematch is Enter on the result card
    await G(() => window.__race.reload()); const gut = (await G(() => window.__race.tracks())).find(t => t.id === 'mars-gutter');
    await G(g => { const fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw); window.__app.surface.debugMove(g.x - fx * 9, g.z - fz * 9, g.yaw); }, gut.gates[0]);
    ok('raceCtx', await wait(() => getComputedStyle(document.getElementById('raceCtxBtn')).display !== 'none', 6000));
    R.raceLabel = await G(() => document.getElementById('raceCtxBtn').textContent);
    ok('raceLabelEnter', R.raceLabel, /Race \(Enter\)/.test(R.raceLabel));
    await auditAt(G, 'raceStart');
    await page.keyboard.press('Enter');
    ok('enterStartsRace', await wait(() => !!window.__race.state, 6000));
    await G(() => window.__race.quit()); await sleep(600);
    await G(() => window.__race.showResult({ id: 'mars-gutter', name: 'Gutter Sprint', done: true, won: true, time: 61000, best: 30000, credits: 120, xp: 40, buyIn: 0 })); await sleep(500);
    const resOn = await G(() => document.getElementById('raceResult')?.classList.contains('on'));
    R.resultCard = resOn;
    if (resOn) { await auditAt(G, 'raceResult'); await page.keyboard.press('Enter'); ok('enterRematch', await wait(() => !!window.__race.state, 6000)); await G(() => window.__race.quit?.()); }
    // typing in a text field: Enter must not fire actions
    await G(() => window.__dealer.tp('dealer', 13)); await wait(() => window.__dealer.ctx?.shown, 8000);
    await G(() => { const i = document.createElement('input'); i.id = 'kbTypeProbe'; i.style.cssText = 'position:fixed;left:10px;top:10px;z-index:99'; document.body.appendChild(i); i.focus(); });
    await page.keyboard.press('Enter'); await sleep(500);
    ok('typingIgnored', await G(() => !window.__dealer.sheet));
    await G(() => document.getElementById('kbTypeProbe').remove());
    R.hintBar = await G(() => document.getElementById('surfHelp').textContent);
    ok('hintBar', /Enter main action/.test(R.hintBar) && /1-9/.test(R.hintBar) && /Esc close/.test(R.hintBar));
    await page.screenshot({ path: '/tmp/keys-desktop.png' });
    await page.context().close();
    // touch: labels hidden
    const T = await boot({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
    await T.G(() => window.__dealer.tp('dealer', 13)); await T.wait(() => window.__dealer.ctx?.shown, 8000); await sleep(900);
    R.touchLabel = await T.G(() => { const b = document.getElementById('dlrCtxBtn'); return { text: b.textContent, after: getComputedStyle(b, '::after').content, touch: document.body.classList.contains('touch') }; });
    ok('touchNoLabels', R.touchLabel.touch && !/\(/.test(R.touchLabel.text) && !/\(/.test(R.touchLabel.after));
  } catch (e) { errors.push('TEST ' + e.stack); }
  R.errors = errors; R.bad = bad; console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(bad.length || errors.length ? 1 : 0);
})();
