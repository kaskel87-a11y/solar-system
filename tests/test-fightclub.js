// Mars fight club (mars/fightclub.js, SSX.fight, the Rust Pit): cage + beacon, panel contrast / 44px taps, ladder,
// bare-knuckle and blade bouts on the v7.4 duel system (borrowed body, named fighter), stake @ odds, wanted never moves,
// yield -> drop a rank, a fixer's dive (paid), beating the champ -> belt, title defence + no-show strip,
// undercard bet @ odds with an upset swap, hotkey, no console errors.
// BASE=http://127.0.0.1:8887/ BR=webkit DEV="iPhone 14" OUT=./shots/fight/ node tests/test-fightclub.js   (DEV=desktop; one browser at a time)
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8887/', BR = process.env.BR || 'chromium', DEV = process.env.DEV || 'desktop';
const out = process.env.OUT || process.env.SHOTS_DIR || './shots/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CE ' + m.text()); });
  const tag = `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase();
  const G = (f, a) => page.evaluate(f, a), R = { tag }, bad = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 200 }); return true; } catch (e) { return false; } };
  const center = sel => G(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width }; }, sel);
  const tapSel = async sel => { const b = await center(sel); if (!b) throw new Error('no ' + sel); if (desk) await page.mouse.click(b.x, b.y); else await page.touchscreen.tap(b.x, b.y); await sleep(400); };
  // fight the current duel with real melee swings until it ends; track wanted the whole time
  const brawl = async (ms = desk ? 300000 : 180000) => { const t0 = Date.now(); let maxW = 0, shot = false;
    while (Date.now() - t0 < ms) { const s = await G(() => { const w = window.__app.surface.world; const d = w.duel, sf = window.__app.surface, i = sf.info; if (d?.phase === 'fight') { sf.debugPlace(i.x, i.z, Math.atan2(-(d.x - i.x), -(d.z - i.z))); window.__app.game.melee(); } return { d: !!w.inDuel, w: w.wanted, ph: w.duel?.phase, b: !!window.SSX.fight.status().bout }; }); if (!s.d && !s.b && Date.now() - t0 > 1500) { maxW = Math.max(maxW, s.w | 0); break; } maxW = Math.max(maxW, s.w);
      if (!shot && s.ph === 'fight' && !desk && process.env.SHOT_BOUT !== '0') { shot = true; await page.screenshot({ path: out + `fight-bout-${tag}.png` }); } await sleep(300); }
    return maxW; };
  try {
    await page.goto(base + '?t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000);
    await G(() => localStorage.clear());
    await wait(() => !!window.SSX?.fight, 15000);
    ok('api', await G(() => ['ladder', 'status', 'odds', 'challenge', 'bet', 'card', 'on', 'open', 'close'].every(k => typeof window.SSX.fight[k] === 'function') && !!window.SSX.fight.debug));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 90000); await sleep(800);
    if (await G(() => getComputedStyle(document.getElementById('radio')).display !== 'none')) await G(() => document.getElementById('radioLater')?.click());
    await G(() => { window.__app.game.debug.calm?.(true); window.__app.game.progress.credits = 20000; window.SSX.fight.debug.reset(); window.__app.surface.world.setWanted(0);
      window.__fev = []; window.addEventListener('ssx:fight', e => { if (e.detail.type !== 'change') window.__fev.push(e.detail); }); });
    R.district = await G(() => { const a = window.SSX.fight.status().at; return window.SSX.contraband?.districtAt?.(a[0], a[1]) ?? null; });
    const L0 = await G(() => window.SSX.fight.ladder());
    ok('ladder', L0.map(f => f.name).join(','), L0.length === 9 && L0[0].champ && L0[0].name === 'Mother Rust' && L0[8].you && L0[8].rank === null);
    ok('oddsFromRatings', await G(() => window.SSX.fight.odds('rust', 'wetsock')), (o => o.a < 1.2 && o.b > 4 && o.pA > 0.9)(await G(() => window.SSX.fight.odds('rust', 'wetsock'))));
    ok('awayRefused', await G(() => window.SSX.fight.challenge('wetsock').ok === false));
    await G(() => window.SSX.fight.debug.goto()); await sleep(1500);
    ok('actButton', await wait(() => document.getElementById('fcAct')?.classList.contains('show'), 8000));
    ok('inCage', await G(() => window.SSX.fight.status().inCage));
    await tapSel('#fcAct');
    R.panel = await G(() => { const p = document.querySelector('#fcPanel .wrap'), cs = getComputedStyle(p), btns = [...document.querySelectorAll('#fcPanel button')].filter(b => b.offsetParent); const r = p.getBoundingClientRect();
      return { show: document.getElementById('fcPanel').classList.contains('show'), bg: cs.backgroundColor, color: cs.color, minH: Math.min(...btns.map(b => b.getBoundingClientRect().height)), n: btns.length, fits: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight }; });
    ok('panel', R.panel, R.panel.show && R.panel.bg === 'rgb(0, 0, 0)' && R.panel.color === 'rgb(255, 255, 255)' && R.panel.minH >= 44 && R.panel.fits);
    ok('onlyBottomOpen', await G(() => [...document.querySelectorAll('#fcPanel [data-ch]')].map(b => b.dataset.ch).join(',')), (await G(() => [...document.querySelectorAll('#fcPanel [data-ch]')].map(b => b.dataset.ch).join(','))) === 'tinlung,wetsock');
    if (!desk) await page.screenshot({ path: out + `fight-panel-${tag}.png` });
    // bout 1: bare-knuckle vs Wet Sock, 50 cr on yourself, through the panel
    await tapSel('#fcPanel [data-stake="50"]');
    const c0 = await G(() => window.__app.game.progress.credits);
    await G(() => document.querySelector('#fcPanel [data-ch="wetsock"]').scrollIntoView({ block: 'center' })); await sleep(200);
    await tapSel('#fcPanel [data-ch="wetsock"]');
    R.b1start = await G(() => ({ duel: window.__app.surface.world.duel, bout: window.SSX.fight.status().bout, panel: document.getElementById('fcPanel').classList.contains('show') }));
    ok('boutStarts', R.b1start, R.b1start.duel?.name === 'Wet Sock' && R.b1start.duel?.label === 'Fists' && R.b1start.bout?.stake === 50 && !R.b1start.panel);
    R.b1maxWanted = await brawl();
    R.b1 = await G(c0 => ({ last: window.SSX.fight.status().last, you: window.SSX.fight.status().you, cr: window.__app.game.progress.credits - c0, wanted: window.__app.surface.world.wanted }), c0);
    ok('bareWin', R.b1, R.b1.last?.win && R.b1.you.rank === 8 && R.b1.last.payout === Math.round(50 * R.b1start.bout.odds) && R.b1.cr === R.b1.last.payout + R.b1.last.purse - 50);
    ok('noSecurity', { max: R.b1maxWanted, after: R.b1.wanted }, R.b1maxWanted === 0 && R.b1.wanted === 0);
    ok('bodyRestored', await G(() => !window.SSX.fight.ladder().some(() => false) && !window.__app.surface.world.inDuel));
    // bout 2: blades vs Tin Lung (API)
    await sleep(1500); await G(() => window.SSX.fight.debug.goto()); await sleep(600);
    R.b2s = await G(() => window.SSX.fight.challenge('tinlung', { style: 'blade', noFix: true }));
    ok('bladeStart', R.b2s, R.b2s.ok && (await G(() => window.__app.surface.world.duel?.label)) === 'Blades');
    const w2 = await brawl();
    R.b2 = await G(() => window.SSX.fight.status()); 
    ok('bladeWin', { last: R.b2.last, rank: R.b2.you.rank, wanted: w2 }, R.b2.last?.win && R.b2.last.style === 'blade' && R.b2.you.rank === 7 && w2 === 0);
    // bout 3: yield -> drop a rank
    await sleep(1500); await G(() => window.SSX.fight.debug.goto()); await sleep(600);
    R.b3s = await G(() => window.SSX.fight.challenge('slag', { noFix: true }).ok); await sleep(1200);
    await G(() => window.__app.surface.world.yieldDuel()); await wait(() => !window.SSX.fight.status().bout, 15000);
    R.b3 = await G(() => window.SSX.fight.status());
    ok('yieldDrops', { s: R.b3s, last: R.b3.last, rank: R.b3.you.rank }, R.b3s && R.b3.last?.win === false && R.b3.you.rank === 8);
    // bout 4: a fixer's dive (SSX.rep optional; forced offer here)
    await sleep(1500); await G(() => window.SSX.fight.debug.goto()); await sleep(600);
    R.fix = await G(() => { const F = window.SSX.fight; const o = F.debug.fix('tinlung'); const r1 = F.challenge('tinlung'); const g0 = window.SSX.contraband?.stash?.().items?.glowdust?.qty | 0, c0 = window.__app.game.progress.credits; const r2 = F.challenge('tinlung', { fix: 'take' }); window.__fx = { g0, c0 }; return { o, offered: !!r1.offer && !r1.ok, ok: r2.ok, dive: F.status().bout?.dive }; });
    await sleep(1200); await G(() => window.__app.surface.world.yieldDuel()); await wait(() => !window.SSX.fight.status().bout, 15000);
    R.dive = await G(() => ({ last: window.SSX.fight.status().last, cr: window.__app.game.progress.credits - window.__fx.c0, glow: (window.SSX.contraband?.stash?.().items?.glowdust?.qty | 0) - window.__fx.g0, ev: window.__fev.filter(e => e.type === 'payout').map(e => e.kind) }));
    ok('dive', { fix: R.fix, dive: R.dive }, R.fix.offered && R.fix.ok && R.fix.dive && R.dive.last?.dive && R.dive.cr === R.fix.o.pay && (!R.fix.o.glow || R.dive.glow === 2) && R.dive.ev.includes('dive'));
    // title: #2 beats the champ with blades
    await sleep(1500); await G(() => { window.SSX.fight.debug.setRank(2); window.SSX.fight.debug.goto(); }); await sleep(600);
    R.t = await G(() => window.SSX.fight.challenge('rust', { style: 'blade', noFix: true }));
    await brawl(); R.title = await G(() => ({ st: window.SSX.fight.status(), top: window.SSX.fight.ladder()[0].id, ev: window.__fev.some(e => e.type === 'champ') }));
    ok('champion', { start: R.t.ok, last: R.title.st.last, champ: R.title.st.you.champ, ev: R.title.ev }, R.t.ok && R.title.st.you.champ && R.title.top === 'you' && R.title.ev);
    R.def = await G(() => { const F = window.SSX.fight; const c2 = F.ladder()[1]; const d = F.debug.defence(); const hud = document.getElementById('fcHud').classList.contains('show'); return { d, c2: c2.id, c2n: c2.name, hud, onlyContender: F.challenge('gravel').ok === false }; });
    await wait(() => getComputedStyle(document.getElementById('fcHud')).display !== 'none', 8000); R.hud = await G(() => ({ show: getComputedStyle(document.getElementById('fcHud')).display !== 'none', t: document.querySelector('#fcHud .l1')?.textContent }));
    R.strip = await G(() => { const F = window.SSX.fight; const s = F.debug.expire(); return { s, champ: F.status().you.champ, top: F.ladder()[0].name, ev: window.__fev.some(e => e.type === 'stripped') }; });
    ok('titleDefence', { def: R.def, hud: R.hud, strip: R.strip }, R.def.d?.id === R.def.c2 && R.hud.show && /TITLE DEFENCE/.test(R.hud.t) && R.def.onlyContender && R.strip.s && !R.strip.champ && R.strip.top === R.def.c2n && R.strip.ev);
    // undercard: bet the underdog, run it, upset swap
    R.card = await G(() => { const F = window.SSX.fight; const c = F.debug.card('gravel', 'slag', { fixed: false }); const c0 = window.__app.game.progress.credits; const b = F.bet('slag', 100); const dup = F.bet('wetsock', 50); window.__c0 = c0; return { c, b, dup: dup.ok, r0: F.ladder().findIndex(f => f.id === 'gravel') }; });
    await wait(() => getComputedStyle(document.getElementById('fcHud')).display !== 'none', 8000); R.cardHud = await G(() => ({ show: getComputedStyle(document.getElementById('fcHud')).display !== 'none', t: document.querySelector('#fcHud .l2')?.textContent }));
    await G(() => window.SSX.fight.debug.runCard()); await sleep(1600);
    if (!desk) await page.screenshot({ path: out + `fight-undercard-${tag}.png` });
    R.cardRes = await G(() => { const F = window.SSX.fight; const r = F.debug.resolveCard('slag'); return { r, cr: window.__app.game.progress.credits - window.__c0, r1: F.ladder().findIndex(f => f.id === 'slag'), card: F.card() }; });
    ok('undercardBet', { card: R.card, hud: R.cardHud, res: R.cardRes }, R.card.b.ok && !R.card.dup && R.card.c.oddsB > R.card.c.oddsA && R.cardHud.show && R.cardRes.r.won === Math.round(100 * R.card.b.odds) && R.cardRes.cr === R.cardRes.r.won - 100 && R.cardRes.r1 === R.card.r0 && R.cardRes.r.upset);
    // hotkey + persistence
    if (desk) { await G(() => window.SSX.fight.close()); await page.keyboard.press('BracketRight'); await sleep(300); ok('hotkey', await G(() => document.getElementById('fcPanel').classList.contains('show'))); await page.keyboard.press('BracketRight'); }
    ok('persist', await G(() => { const s = JSON.parse(localStorage.getItem('ssx.fight.v1') || 'null'); return !!s && s.you.w >= 3 && s.order.length === 9; }));
    ok('wantedNever', await G(() => window.__app.surface.world.wanted), (await G(() => window.__app.surface.world.wanted)) === 0);
    R.events = await G(() => [...new Set(window.__fev.map(e => e.type))]);
    await G(() => window.SSX.fight.open()); await sleep(500); await page.screenshot({ path: out + `fight-${tag}.png` }); R.shot = out + `fight-${tag}.png`;
  } catch (e) { errors.push('TEST ' + e.message); }
  R.errors = errors; R.bad = bad; console.log(JSON.stringify(R)); await browser.close(); process.exit(bad.length || errors.length ? 1 : 0);
})();
