// v7.3: every visible button / chip in every panel must have text contrast >= 4.5:1 against its effective background.
// Effective background = own + ancestors' background colours composited (gradients use their lightest stop), over black (the canvas).
// BASE=http://localhost:8765/ DEV="iPhone 14" BR=webkit node test-contrast.js    (DEV=desktop for 1440x900)
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://localhost:8765/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const out = process.env.OUT || '/workspace/solar-system/shots/', PFX = process.env.PFX || 'contrast';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = DEV.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + BR;
(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  let d; if (DEV === 'desktop') d = { viewport: { width: 1440, height: 900 } }; else { const { defaultBrowserType, ...x } = devices[DEV]; d = x; }
  const ctx = await browser.newContext(d); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message));
  const G = (f, a) => page.evaluate(f, a), R = { tag, states: {} }, bad = [];
  const wait = async (f, ms = 30000) => { try { await page.waitForFunction(f, null, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
  const scan = async (name, scope = 'body') => {
    const res = await G(scope => {
      const parse = s => { const m = s && s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v[3] ?? 1]; };
      const stops = s => (s.match(/rgba?\([^)]+\)/g) || []).map(parse);
      const lum = c => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      const over = (top, bot) => [0, 1, 2].map(i => top[i] * top[3] + bot[i] * (1 - top[3])).concat(1);
      const vis = e => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; for (let x = e; x; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
      const out = [];
      for (const e of document.querySelectorAll(`${scope} button, ${scope} .chip`)) {
        if (!vis(e) || !e.textContent.trim()) continue;
        const layers = []; let op = 1;
        for (let x = e; x; x = x.parentElement) { const cs = getComputedStyle(x); op *= +cs.opacity; const bg = parse(cs.backgroundColor); const gs = cs.backgroundImage !== 'none' ? stops(cs.backgroundImage) : [];
          let layer = bg && bg[3] > 0 ? bg : null; if (gs.length) { const g = gs.reduce((a, b) => lum(b) > lum(a) ? b : a); layer = layer ? over(g, layer) : g; }
          if (layer) layers.push(layer); }
        let bgc = [0, 0, 0, 1]; for (let i = layers.length - 1; i >= 0; i--) bgc = over(layers[i], bgc);
        const tc0 = parse(getComputedStyle(e).color); const tc = over([tc0[0], tc0[1], tc0[2], tc0[3] * op], bgc);
        const L1 = lum(tc), L2 = lum(bgc), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        out.push({ id: e.id || e.dataset.buy || e.dataset.tab || '', text: e.textContent.trim().slice(0, 24), ratio: +ratio.toFixed(2), bg: bgc.slice(0, 3).map(Math.round).join(',') });
      }
      return out;
    }, scope);
    const low = res.filter(r => r.ratio < 4.5);
    R.states[name] = { n: res.length, min: res.length ? Math.min(...res.map(r => r.ratio)) : null, low };
    if (low.length) bad.push(name + ':' + low.map(l => `${l.id || l.text}=${l.ratio}`).join('|'));
    await page.screenshot({ path: `${out}${PFX}-${tag}-${name}.png` });
  };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000); await sleep(800);
    await scan('overview');
    await G(() => window.__app.select?.(window.__app.bodies.find(b => b.name === 'Mars').mesh)); await sleep(900); await scan('fact-card');
    await G(() => document.getElementById('flyBtn').click()); await sleep(1500); await scan('flying');
    await G(() => { localStorage.removeItem('ssx.progress.v1'); window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh); });
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    await G(() => window.__app.game.debug.credits(300));
    await G(() => { const s = window.__app.surface, v = s.world.debug.people().find(p => p.name === 'Vesna' || p.name === 'Rook'); s.debugMove(v.x + 1.5, v.z + 1.5, 0); }); await sleep(700);
    await G(() => document.getElementById('driveBtn').click()); await wait(() => document.getElementById('radioBtns').style.display === 'flex', 5000);
    await G(() => document.getElementById('radio').classList.remove('mini')); await sleep(200); await scan('radio-offer', '#radio');
    await G(() => document.getElementById('radioLater').click());
    await G(() => document.getElementById('menuBtn').click()); await sleep(300); await scan('menu', '#roverMenu');
    await G(() => document.getElementById('ctlBtn').click()); await sleep(300); await scan('controls', '#ctlPanel');
    await G(() => window.__app.openControls(false));
    await G(() => document.getElementById('settingsBtn').click()); await sleep(400);
    for (const t of ['tabQuests', 'tabDisc', 'tabRewards', 'tabSettings']) { await G(t => document.querySelector(`#logTabs [data-tab="${t}"]`).click(), t); await sleep(250); await scan('log-' + t, '#logPanel'); }
    R.toggles = await G(() => ['setAliens', 'setVoice'].map(id => { const b = document.getElementById(id); return b ? `${b.textContent}:${b.className}:${getComputedStyle(b).color}:${getComputedStyle(b).backgroundColor}` : 'missing'; }));
    if (!R.toggles.every(t => /:(rgb\(17, 17, 17\))$/.test(t))) bad.push('toggleNotBlack');
    if (!R.toggles.every(t => /^ON:.*\bon\b.*rgb\(74, 222, 128\)|^OFF:.*\boff\b.*rgb\(180, 180, 180\)/.test(t))) bad.push('toggleOnOffColour');
    await G(() => document.getElementById('logClose').click());
    for (const v of ['guns', 'supply', 'depot', 'bar']) { await G(v => window.__app.openShop(v, 'Clerk'), v); await sleep(300); await scan('shop-' + v, '#shopPanel'); await G(() => document.getElementById('shopClose').click()); }
    await scan('surface-hud');
  } catch (e) { bad.push('EXC ' + e.message.slice(0, 300)); }
  if (errors.length) { R.errors = errors.slice(0, 5); bad.push('errors'); }
  R.bad = bad; console.log(JSON.stringify(R)); await browser.close(); process.exit(bad.length ? 1 : 0);
})();
