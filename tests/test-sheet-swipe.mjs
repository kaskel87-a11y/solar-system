// v7.6 (hud/hudx.js tap guard): swiping a scrolling sheet (☰ menu, shop, farm) must not fire the button the finger started on;
// a tap right after a scroll is ignored; a plain tap still fires exactly once. iPhone 14 WebKit, touch pointer events.
// cd /workspace/pw && BASE=http://127.0.0.1:8873/ BR=webkit node /path/to/tests/test-sheet-swipe.mjs
import { createRequire } from 'module';
const require = createRequire(process.cwd() + '/');
const { webkit, chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8873/', BR = process.env.BR || 'webkit';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const { defaultBrowserType, ...ip } = devices['iPhone 14']; const vp = { width: 393, height: 852 };
const b = await (BR === 'webkit' ? webkit : chromium).launch();
const page = await (await b.newContext({ ...ip, viewport: vp, screen: vp })).newPage();
const errors = [], R = { br: BR }, bad = [];
page.on('console', m => { if (m.type() === 'error' && !/audio device|AudioContext/i.test(m.text())) errors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => { if (!/Failed to start the audio device/.test(e.message)) errors.push('PE ' + e.message.slice(0, 200)); });
const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v; if (!cond) bad.push(k); };
const G = (f, a) => page.evaluate(f, a), wait = async (f, t = 20000, a) => { try { await page.waitForFunction(f, a, { timeout: t }); return true; } catch { return false; } };
try {
  await page.goto(BASE + '?t=' + Date.now()); ok('loaded', await wait(() => window.__frames > 3 && !document.getElementById('loading') && !!window.SSX?.onboard, 180000)); ok('guard', await G(() => !!window.__hxTapGuard));
  await G(() => { try { window.SSX.onboard.skip(); } catch (e) { /* */ } });
  await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
  ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 180000)); await sleep(1500);
  await G(() => { const r = document.getElementById('radioLater'); if (r && getComputedStyle(document.getElementById('radio')).display !== 'none') r.click(); window.__app.surface.game.setAliens?.(false); });
  // in-page helpers: probe buttons (window.__onTap / plain click / registerMenuItem) + synthetic touch gestures
  await G(() => {
    const W = window.__sw = { n: {} }; const hit = k => () => { W.n[k] = (W.n[k] || 0) + 1; };
    W.scroller = el => { for (let e = el.parentElement; e; e = e.parentElement) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1) return e; } return null; };
    W.probe = (host, k) => { // a tall spacer so the sheet scrolls, then 2 probe buttons in the middle of it
      if (!document.getElementById('swSp_' + k)) { const sp = document.createElement('div'); sp.id = 'swSp_' + k; sp.style.cssText = 'height:900px;flex:none;grid-column:1/-1'; host.appendChild(sp); }
      for (const [id, how] of [['swTap_' + k, 'tap'], ['swClick_' + k, 'click']]) { if (document.getElementById(id)) continue; const bt = document.createElement('button'); bt.id = id; bt.type = 'button'; bt.className = 'btn'; bt.textContent = id; bt.style.cssText = 'min-height:48px;display:block;width:100%';
        host.insertBefore(bt, document.getElementById('swSp_' + k)); if (how === 'tap') window.__onTap(bt, hit(id)); else bt.addEventListener('click', hit(id)); }
    };
    let pid = 500;
    const pe = (el, type, x, y, id) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y }));
    const ctr = el => { el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; };
    const nudge = (sc, d) => { const t = sc.scrollTop; sc.scrollTop += d; if (sc.scrollTop === t) sc.scrollTop -= d; if (sc.scrollTop !== t) W.scrolled = (W.scrolled || 0) + 1; else W.stuck = (W.stuck || 0) + 1; }; // a sheet at its end scrolls the other way
    const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    // swipe: finger down on the button, the sheet scrolls under it, finger lifts 70 px away; iOS may still send a late click
    W.swipe = async sel => { const el = document.querySelector(sel); const [x, y] = ctr(el); await new Promise(r => setTimeout(r, 400)); const sc = W.scroller(el), id = ++pid;
      pe(el, 'pointerdown', x, y, id); for (let i = 1; i <= 7; i++) { pe(el, 'pointermove', x, y - i * 10, id); if (sc) nudge(sc, 10); await frame(); }
      pe(el, 'pointerup', x, y - 70, id); el.click(); await new Promise(r => setTimeout(r, 80)); return !!sc; };
    // the finger hardly moves but the sheet scrolled (momentum) since touch start
    W.scrollTap = async sel => { const el = document.querySelector(sel); const [x, y] = ctr(el); await new Promise(r => setTimeout(r, 400)); const sc = W.scroller(el), id = ++pid;
      pe(el, 'pointerdown', x, y, id); if (sc) { nudge(sc, 30); await frame(); } const r2 = el.getBoundingClientRect(); pe(el, 'pointerup', x, y + 3, id); el.click(); await new Promise(r => setTimeout(r, 80)); return r2.top; };
    // a tap < 150 ms after a fling ended
    W.afterFling = async sel => { const el = document.querySelector(sel); const [x0] = ctr(el); await new Promise(r => setTimeout(r, 400)); const sc = W.scroller(el); if (sc) { const ev = new Promise(r => { sc.addEventListener('scroll', r, { once: true }); setTimeout(r, 1500); }); nudge(sc, 2); await ev; } // tap right as the scroll lands (headless frames can be slow)
      const r = el.getBoundingClientRect(), x = x0, y = r.y + r.height / 2, id = ++pid; pe(el, 'pointerdown', x, y, id); pe(el, 'pointerup', x, y, id); el.click(); await new Promise(r => setTimeout(r, 80)); };
    W.tap = async sel => { const el = document.querySelector(sel); const [x, y] = ctr(el); await new Promise(r => setTimeout(r, 400)); const id = ++pid; pe(el, 'pointerdown', x, y, id); await new Promise(r => setTimeout(r, 60)); pe(el, 'pointerup', x, y, id); el.click(); await new Promise(r => setTimeout(r, 80)); };
    window.SSX.registerMenuItem({ id: 'swMenuItem', label: '🧪 swipe probe', onTap: hit('swMenuItem') });
  });
  const counts = () => G(() => ({ ...window.__sw.n }));
  const sheets = [
    ['menu', async () => { await G(() => document.getElementById('menuBtn').click()); return wait(() => document.getElementById('roverMenu').classList.contains('show'), 5000); }, () => G(() => document.getElementById('roverMenu')), '#roverMenu'],
    ['shop', async () => { await G(() => window.__app.openShop()); return wait(() => getComputedStyle(document.getElementById('shopPanel')).display !== 'none', 5000); }, null, '#shopPanel .wrap'],
    ['farm', async () => { await G(() => window.SSX.farm?.open?.('farm')); return wait(() => { const p = document.getElementById('farmPanel'); return !!p && getComputedStyle(p).display !== 'none' && p.getBoundingClientRect().height > 0; }, 5000); }, null, '#farmPanel .wrap'],
  ];
  for (const [k, open, , host] of sheets) {
    ok(k + 'Open', await open());
    await G(([h, k]) => window.__sw.probe(document.querySelector(h), k), [host, k]);
    const ids = ['swTap_' + k, 'swClick_' + k].concat(k === 'menu' ? ['swMenuItem'] : []);
    if (k === 'menu') await G(() => { const m = document.getElementById('swMenuItem'), t = document.getElementById('swTap_menu'); t.after(m); }); // keep the ☰ probe in the scrolling part
    const c0 = await counts();
    for (const id of ids) { R[k + '_scrolls_' + id] = await G(s => window.__sw.swipe(s), '#' + id); await G(s => window.__sw.scrollTap(s), '#' + id); await G(s => window.__sw.afterFling(s), '#' + id); }
    const c1 = await counts(); const scr = await G(() => { const r = `${window.__sw.scrolled || 0} scrolled, ${window.__sw.stuck || 0} stuck`; window.__sw.scrolled = window.__sw.stuck = 0; return r; }); ok(k + 'ReallyScrolled', scr, scr.endsWith(' 0 stuck'));
    ok(k + 'SwipeNoFire', ids.map(i => `${i}:${(c1[i] || 0) - (c0[i] || 0)}`).join(' '), ids.every(i => (c1[i] || 0) === (c0[i] || 0)));
    ok(k + 'StillOpen', null, k === 'menu' ? await G(() => document.getElementById('roverMenu').classList.contains('show')) : true);
    // a real button: swipe over the first visible one, nothing changes (sheet stays open)
    const realSel = await G(h => { const b = [...document.querySelectorAll(h + ' button')].find(x => x.offsetParent && !/^sw/.test(x.id) && !/close|✕/i.test(x.textContent + x.id)); if (b) b.dataset.swreal = '1'; return b ? '[data-swreal="1"]' : null; }, host);
    if (realSel) { const before = await G(h => document.querySelector(h).closest('[id]').outerHTML.length, host); await G(s => window.__sw.swipe(s), realSel);
      ok(k + 'RealSwipeKeepsSheet', null, await G(([k]) => k === 'menu' ? document.getElementById('roverMenu').classList.contains('show') : getComputedStyle(document.getElementById(k === 'shop' ? 'shopPanel' : 'farmPanel')).display !== 'none', [k]));
      await G(() => { const e = document.querySelector('[data-swreal="1"]'); if (e) delete e.dataset.swreal; }); }
    // plain tap still fires exactly once
    for (const id of ids.filter(i => i !== 'swMenuItem')) { await sleep(250); await G(s => window.__sw.tap(s), '#' + id); }
    const c2 = await counts();
    ok(k + 'TapFiresOnce', ids.filter(i => i !== 'swMenuItem').map(i => `${i}:${(c2[i] || 0) - (c1[i] || 0)}`).join(' '), ids.filter(i => i !== 'swMenuItem').every(i => (c2[i] || 0) - (c1[i] || 0) === 1));
    if (k === 'menu') { await sleep(250); await G(() => window.__sw.tap('#swMenuItem')); const c3 = await counts(); ok('menuItemTapFires', (c3.swMenuItem || 0) - (c2.swMenuItem || 0), (c3.swMenuItem || 0) - (c2.swMenuItem || 0) === 1); }
    ok(k + 'PanY', await G(h => getComputedStyle(document.querySelector(h)).touchAction, host), /pan-y|manipulation|auto/.test(await G(h => getComputedStyle(document.querySelector(h)).touchAction, host)));
    // close the sheet
    await G(k => { if (k === 'menu') document.getElementById('roverMenu').classList.remove('show'); else if (k === 'shop') document.getElementById('shopClose')?.click(); else window.SSX.farm?.close?.(); document.querySelectorAll('[id^="swSp_"],[id^="swTap_"],[id^="swClick_"]').forEach(e => e.remove()); }, k); await sleep(300);
  }
} catch (e) { errors.push('TEST ' + String(e).slice(0, 300)); }
ok('noErrors', errors.slice(0, 5), errors.length === 0);
R.bad = bad; R.pass = bad.length === 0; console.log(JSON.stringify(R, null, 1)); await b.close(); process.exit(bad.length ? 1 : 0);
