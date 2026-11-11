// Themed lock-ups: prices, per-garage save, and the three looks staying visually distinct. No DOM, no three.js.
import * as GC from '../garagecore.js';
let fails = 0, n = 0;
const ok = (name, c, extra = '') => { n++; if (!c) { fails++; console.log('FAIL', name, extra); } else console.log('ok  ', name); };
const T = GC.GARAGE_THEMES, ids = ['scrap', 'neon', 'highroller', 'stock'];

ok('four looks', ids.every(id => T[id] && T[id].id === id));
ok('list order', GC.themeList().map(t => t.id).join(',') === ids.join(','));
ok('prices', T.scrap.price === 240 && T.neon.price === 480 && T.highroller.price === 1400 && T.stock.price === 0);
ok('price order', T.scrap.price < T.neon.price && T.neon.price < T.highroller.price);
ok('scrap near an underglow', T.scrap.price >= GC.GLOWS.cyan.price && T.scrap.price < GC.KITS.widebody.price);
ok('neon near a body kit', T.neon.price >= GC.KITS.street.price && T.neon.price <= GC.KITS.widebody.price);
ok('high-roller under a mid car', T.highroller.price > GC.MODELS.dust_runner.price && T.highroller.price < GC.MODELS.red_comet.price);
ok('unique lights', new Set(ids.map(id => T[id].light)).size === 4);
ok('unique walls and floors', new Set(ids.map(id => T[id].wall)).size === 4 && new Set(ids.map(id => T[id].floor)).size === 4);
ok('unique signs and ambient', new Set(ids.map(id => T[id].sign)).size === 4 && new Set(ids.map(id => T[id].ambient)).size === 4);
ok('props differ', new Set(ids.map(id => JSON.stringify(T[id].props))).size === 4 && T.highroller.props.length > T.stock.props.length);
ok('ambient kinds', T.neon.ambient === 'pulse' && T.scrap.ambient === 'flicker' && T.highroller.ambient === 'shimmer' && T.stock.ambient === 'steady');
ok('key', GC.THEME_KEY === 'ssx.garagetheme.v1' && GC.LOCKUP_ID === 'redline');

for (const raw of [null, undefined, '', 'nope', 5, [], {}]) {
  const s = GC.parseThemes(raw);
  ok('parse ' + JSON.stringify(raw), s.v === 1 && Object.keys(s.byId).length === 0 && GC.themeIdOf(s, 'redline') === 'stock');
}
const dirty = GC.parseThemes(JSON.stringify({ v: 9, byId: { redline: 'neon', other: 'nope', '': 'scrap', x: 3 }, owned: { redline: ['scrap', 'scrap', 'ghost'] } }));
ok('parse keeps known looks', dirty.byId.redline === 'neon' && !dirty.byId.other && !dirty.byId['']);
ok('fitted implies owned', dirty.owned.redline.includes('neon') && dirty.owned.redline.includes('scrap') && !dirty.owned.redline.includes('ghost'));
ok('parse idempotent', JSON.stringify(GC.parseThemes(JSON.stringify(dirty))) === JSON.stringify(dirty));

const empty = GC.freshThemes();
ok('unknown theme', GC.quoteTheme(empty, 'redline', 'velvet', 9999).why === 'theme');
ok('bad garage id', GC.quoteTheme(empty, '', 'neon', 9999).why === 'garage');
ok('fitted stock', GC.quoteTheme(empty, 'redline', 'stock', 0).why === 'fitted');
const short = GC.quoteTheme(empty, 'redline', 'neon', 100);
ok('short on neon', !short.ok && short.why === 'funds' && short.need === 380 && short.price === 480);
ok('can afford scrap', GC.quoteTheme(empty, 'redline', 'scrap', 240).ok && GC.quoteTheme(empty, 'redline', 'scrap', 240).price === 240);
ok('quote does not mutate', GC.themeIdOf(empty, 'redline') === 'stock');

let s = GC.commitTheme(empty, 'redline', 'neon');
ok('commit redline', GC.themeIdOf(s, 'redline') === 'neon' && GC.themeIdOf(s, 'bay-b') === 'stock');
ok('owned only on that garage', s.owned.redline.includes('neon') && !(s.owned['bay-b'] || []).includes('neon'));
ok('refit free', GC.quoteTheme(s, 'redline', 'neon', 0).why === 'fitted');
s = GC.commitTheme(s, 'redline', 'stock');
ok('stock clears fit', GC.themeIdOf(s, 'redline') === 'stock' && s.owned.redline.includes('neon'));
ok('put neon back free', GC.quoteTheme(s, 'redline', 'neon', 0).ok && GC.quoteTheme(s, 'redline', 'neon', 0).price === 0);
ok('other garage still pays', GC.quoteTheme(s, 'bay-b', 'neon', 0).why === 'funds' && GC.quoteTheme(s, 'bay-b', 'neon', 480).price === 480);
s = GC.commitTheme(s, 'bay-b', 'scrap');
ok('two garages', GC.themeIdOf(s, 'redline') === 'stock' && GC.themeIdOf(s, 'bay-b') === 'scrap' && s.owned['bay-b'].join(',') === 'scrap' && !s.owned['bay-b'].includes('neon'));
ok('commit unknown no-op', JSON.stringify(GC.commitTheme(s, 'bay-b', 'nope')) === JSON.stringify(GC.parseThemes(JSON.stringify(s))));

console.log(fails ? `${fails}/${n} FAILED` : `ALL PASS (${n})`);
process.exit(fails ? 1 : 0);
