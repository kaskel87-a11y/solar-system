// v7.5.7 hotfix regression: a farm save written by v7.5.5 (tag 974154e: bought homestead, dome, 3 racks, potatoes in rack 1,
// 1980 cr left) loads on main still owned with its racks; a lost, broken or unowned farm save comes back from SSX.base's record
// (ssx.base.v1 keeps the farm-dome / farm-rack pieces) with no charge; base.refresh() and a stale unowned write never downgrade it.
// BASE=http://127.0.0.1:<port>/ SHOTS_DIR=./shots/farmfix/ [BR=webkit DEV="iPhone 14"] node tests/test-farm-restore.js --workers=1
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8896/', BR = process.env.BR || 'webkit', DEV = process.env.DEV || 'iPhone 14';
const out = process.env.SHOTS_DIR || process.env.OUT || './shots/farmfix/', desk = DEV === 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
// captured from v7.5.5 (974154e) after buy + dome + 3 racks + plant, WebKit iPhone 14
const V755 = {
 "ssx.farm.v1": "{\"v\":1,\"owned\":true,\"dome\":true,\"domeHp\":100,\"racks\":[{\"crop\":\"potato\",\"growth\":0.0032666666666692377,\"health\":100,\"planted\":0.11571666666673508},{\"crop\":null,\"growth\":0,\"health\":100,\"planted\":0},{\"crop\":null,\"growth\":0,\"health\":100,\"planted\":0}],\"water\":40,\"power\":40,\"silo\":{},\"favors\":[],\"hours\":0.14838333333342746,\"lastRaidH\":-99,\"stats\":{\"planted\":1,\"harvested\":0,\"sold\":0,\"earned\":0,\"raids\":0,\"raidsWon\":0,\"stolen\":0,\"stormLoss\":0,\"wilted\":0},\"guide\":{\"on\":true,\"done\":false,\"off\":false}}",
 "ssx.base.v1": "{\"v\":1,\"plots\":{\"aj-north\":{\"owned\":false,\"pieces\":[],\"stash\":{\"credits\":0,\"medkits\":0},\"nextId\":1,\"boughtAt\":0},\"flats-scrap\":{\"owned\":false,\"pieces\":[],\"stash\":{\"credits\":0,\"medkits\":0},\"nextId\":1,\"boughtAt\":0},\"helios-ridge\":{\"owned\":false,\"pieces\":[],\"stash\":{\"credits\":0,\"medkits\":0},\"nextId\":1,\"boughtAt\":0},\"farm-homestead\":{\"owned\":true,\"pieces\":[{\"id\":1,\"type\":\"farm-dome\",\"i\":2,\"j\":0,\"r\":0,\"hp\":200},{\"id\":2,\"type\":\"farm-rack\",\"i\":3,\"j\":7,\"r\":0,\"hp\":100},{\"id\":3,\"type\":\"farm-rack\",\"i\":6,\"j\":7,\"r\":0,\"hp\":100},{\"id\":4,\"type\":\"farm-rack\",\"i\":2,\"j\":7,\"r\":0,\"hp\":100}],\"stash\":{\"credits\":0,\"medkits\":0},\"nextId\":5,\"boughtAt\":1793328805141}}}",
 "ssx.progress.v1": "{\"v\":1,\"xp\":0,\"credits\":1980,\"badges\":[],\"unlocks\":[\"paint:steel\",\"bandana:none\",\"kit:stock\"],\"equip\":{\"paint\":\"steel\",\"bandana\":\"none\",\"weapon\":\"rifle\",\"rover\":\"cannon\",\"kit\":\"stock\"},\"quests\":{},\"active\":{},\"rare\":{},\"settings\":{\"aliens\":true,\"voice\":true,\"radio\":0},\"stats\":{\"kills\":0,\"deaths\":0,\"shots\":0,\"busted\":0,\"stolen\":0},\"inv\":{\"medkits\":1,\"shells\":0,\"rounds\":24,\"slugs\":0,\"grenades\":0},\"upgrades\":[],\"maxhp\":0,\"maxammo\":0,\"flags\":[],\"garage\":{\"v\":1,\"rides\":[{\"id\":\"stock\",\"kind\":\"rover\",\"paint\":\"factory\",\"kit\":\"stock\",\"wheels\":\"stock\",\"glow\":\"none\",\"up\":{\"engine\":0,\"handling\":0,\"brakes\":0,\"boost\":0},\"owned\":{\"paint\":[\"factory\"],\"kit\":[\"stock\"],\"wheels\":[\"stock\"],\"glow\":[\"none\"]},\"spent\":0}],\"active\":\"stock\",\"rep\":0,\"clock\":0,\"meet\":null,\"wins\":0,\"races\":0,\"nextId\":1}}"
};
const FRESH_UNOWNED = JSON.stringify({ v: 1, owned: false, dome: false, domeHp: 100, racks: [], water: 0, power: 0, silo: {}, favors: [], hours: 3, lastRaidH: -99, stats: { planted: 0, harvested: 0, sold: 0, earned: 0, raids: 0, raidsWon: 0, stolen: 0, stormLoss: 0, wilted: 0 }, guide: { on: false, done: false, off: false } });
const downgraded = () => { const b = JSON.parse(V755['ssx.base.v1']); b.plots['farm-homestead'].owned = false; return JSON.stringify(b); }; // what base persists after a refresh saw the farm unowned
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await pw[BR].launch(BR === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const R = { tag: `${DEV}-${BR}`.replace(/\W+/g, '-').toLowerCase() }, bad = [], errors = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  async function run(name, seed, check) {
    const ctx = await browser.newContext(desk ? { viewport: { width: 1366, height: 768 } } : { ...pw.devices[DEV], viewport: { width: 393, height: 852 } }); const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(name + ' PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(name + ' CE ' + m.text()); });
    await ctx.addInitScript(s => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); for (const [k, v] of Object.entries(s)) if (v != null) localStorage.setItem(k, v); }, seed);
    const G = (f, a) => page.evaluate(f, a);
    const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 150 }); return true; } catch (e) { return false; } };
    const boot = async () => { await page.goto(base + '?farmraids=0&t=' + Date.now()); await wait(() => window.__frames > 3 && !document.getElementById('loading'), 120000); await wait(() => !!window.SSX?.farm, 20000);
      await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
      await wait(() => window.__app?.state?.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000); await sleep(1200);
      await G(() => { const p = window.SSX.farm.places().find(q => q.id === 'farm'); window.__app.surface.debugMove(p.x, p.z + 12, 0); }); await sleep(1500); };
    const snap = () => G(() => { const s = window.SSX.farm.status(), b = window.SSX.base?.state?.('farm-homestead');
      return { owned: s.owned, dome: s.dome, racks: s.racks.length, crop0: s.racks[0]?.crop || null, restored: s.restored, saveErr: s.saveErr, credits: window.__app.game.progress.credits,
        baseOwned: b?.owned, basePieces: (b?.pieces || []).map(p => p.type).sort().join(','), stored: JSON.parse(localStorage.getItem('ssx.farm.v1') || 'null')?.owned, bak: !!localStorage.getItem('ssx.farm.v1.bak'),
        scene: window.SSX.farm.debug.scene() }; });
    try { await boot(); await check({ page, G, wait, boot, snap }); } catch (e) { bad.push(name + ': ' + e.message); }
    await ctx.close();
  }
  const PIECES = 'farm-dome,farm-rack,farm-rack,farm-rack';
  // 1) the v7.5.5 save as it is
  await run('v755', V755, async ({ G, boot, snap }) => {
    const a = await snap(); ok('v755', a, a.owned && a.dome && a.racks === 3 && a.crop0 === 'potato' && a.restored === null && a.credits === 1980 && a.baseOwned === true && a.basePieces === PIECES);
    // base.refresh() / syncOwners() and a stale unowned write (another tab, an old build) never downgrade it
    await G(() => { window.SSX.base.refresh(); window.SSX.base.syncOwners(); localStorage.setItem('ssx.farm.v1', JSON.stringify({ v: 1, owned: false, racks: [] })); window.SSX.farm.skip(1); });
    const g = await snap(); ok('noDowngrade', g, g.owned && g.baseOwned === true && g.stored === true && g.racks === 3);
    await boot(); const b = await snap(); ok('v755Reload', b, b.owned && b.racks === 3 && b.credits === 1980 && b.basePieces === PIECES);
  });
  // 2) the farm save is gone, SSX.base still has the pieces: restored, no charge, one message
  await run('lost', { ...V755, 'ssx.farm.v1': null }, async ({ page, G, boot, snap }) => {
    const a = await snap(); ok('lostRestored', a, a.owned && a.dome && a.racks === 3 && a.restored === 'base' && a.credits === 1980 && a.baseOwned === true && a.basePieces === PIECES && a.stored === true && a.bak && a.scene?.dome);
    await page.screenshot({ path: out + `farm-restored-${R.tag}.png` }); R.shot = out + `farm-restored-${R.tag}.png`;
    await boot(); const b = await snap(); ok('lostReload', b, b.owned && b.racks === 3 && b.restored === null && b.credits === 1980);
  });
  // 3) a fresh, unowned farm save over a base that already synced to unowned (the for-sale state Collin saw)
  await run('forSale', { ...V755, 'ssx.farm.v1': FRESH_UNOWNED, 'ssx.base.v1': downgraded() }, async ({ snap }) => {
    const a = await snap(); ok('forSaleRestored', a, a.owned && a.dome && a.racks === 3 && a.restored === 'base' && a.credits === 1980 && a.baseOwned === true && a.basePieces === PIECES);
  });
  // 4) a broken farm save with its mirror: the mirror wins (crops kept)
  await run('corrupt', { ...V755, 'ssx.farm.v1': '{"v":1,"owned":tr', 'ssx.farm.v1.bak': V755['ssx.farm.v1'] }, async ({ snap }) => {
    const a = await snap(); ok('corruptRestored', a, a.owned && a.racks === 3 && a.crop0 === 'potato' && a.restored === 'backup' && a.credits === 1980);
  });
  // 5) debug.reset still resets (a real reset is not undone)
  await run('reset', V755, async ({ G, boot, snap }) => {
    await G(() => window.SSX.farm.debug.reset()); await boot(); const a = await snap(); ok('resetStays', a, !a.owned && a.racks === 0 && !a.basePieces && a.restored === null);
  });
  ok('consoleErrors', errors.length, errors.length === 0); if (errors.length) R.errors = errors.slice(0, 8);
  console.log(JSON.stringify(R, null, 1)); console.log(bad.length ? 'FAIL ' + bad.join(', ') : 'PASS ' + R.tag);
  await browser.close(); process.exit(bad.length ? 1 : 0);
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
