// v7.5 (Jeff): walk-in shops in every Mars district. Gun stores, a clothing store, a pharmacy and a bar per district,
// each with its own flavour and price tier: Red Tape Flats (cheap, sketchy), Olympus Row (mid-range), Helios Heights (luxury).
// Built entirely on public APIs: registerInterior + the v7.3 walk-in ware system (tap an item or stand at it and press the
// context button). Items use ids prefixed 'ms:' and are bought through game.shopItem/buy, which this module wraps.
// Storefronts follow Steve's layouts (solar-system-story/mars-city/*.json). If a v7.5 district builder is present the blocks go
// into the matching district; otherwise (v7.4 main) they are placed AJ-relative on the colony with a flattened pad each.
// All game fiction. M-rated: guns, booze, back-alley pharmacology, crime rumours. No nudity, no sexual content.
import * as THREE from 'three';
// Core imports: plain specifiers; index.html's import map adds the version, so world/game/interiors are the same
// instances index.html loaded (v7.5.3; the old import.meta.url ?v= trick is gone).
const [{ COLONIES, districtsOf }, { COSMETICS, WEAPONS }, { registerInterior, INTERIORS, buildHuman }] =
  await Promise.all([import('./world.js'), import('./game.js'), import('./interiors.js')]);

// ---------- districts (AJ-relative centres, from the v7.5 brief) ----------
const DIST = {
  rtf: { name: 'Red Tape Flats', centre: [-280, -40], match: /red.?tape|rough/i },
  oly: { name: 'Olympus Row', centre: [0, -430], match: /olympus|downtown/i },
  hel: { name: 'Helios Heights', centre: [320, 80], match: /helios|gated/i }
};

// ---------- new cosmetics: listed only in these shops (no `shop` price, so the old venues don't show them) ----------
const NEW_COS = {
  bandana: { rustrag: ['Rust Rag', 0x8a3a20], dustkings: ['Dust Kings Yellow', 0xd8b020], scrapper: ['Scrapper Grey', 0x6a6a6a],
    corpteal: ['Corporate Teal', 0x1aa0a0], pinstripe: ['Pinstripe Navy', 0x1c2a4a], ivorysilk: ['Ivory Silk', 0xf0e6d8], goldthread: ['Gold Thread', 0xd4af37] },
  paint: { primer: ['Primer Grey', 0x6c6c66], burnout: ['Burnout Black', 0x1c1a18], meridian: ['Meridian Teal', 0x2a8a8a], chrome: ['Chrome', 0xd8dde4],
    pearl: ['Pearl', 0xf4f1ea], goldleaf: ['Gold Leaf', 0xc9a227] }
};
for (const k in NEW_COS) for (const [id, [name, color]] of Object.entries(NEW_COS[k])) if (COSMETICS[k] && !COSMETICS[k][id]) COSMETICS[k][id] = { name, color };

// ---------- rumours / job tips ----------
const RUMORS = {
  rtf: [
    'Wrench pays 300 a head for rovers with the plates still on. Bring them to the chop shop after dark.',
    'The water tower guards change shift at the top of the hour. Ninety seconds where nobody\u2019s looking.',
    'NO NAME\u2019s runners use the hab stacks as a cut-through. Somebody\u2019s been jumping them for the cash.',
    'Security\u2019s scared of the Flats. Lose them in the stacks and they give up after a block.',
    'Old Doyle got buried with his credit chip. Ashes to ashes, chip to whoever digs first.'
  ],
  oly: [
    'Meridian Tower\u2019s freight lift has no camera on floor nine. Couriers love it. So do thieves.',
    'A precinct clerk sells patrol routes for the price of a bowl of noodles. Ask for extra chilli.',
    'The Static\u2019s owner owes money to the wrong people. Collect for them and they\u2019ll pay a cut.',
    'Somebody\u2019s been paying cash for transit passes. Big cash. Something\u2019s moving through the tube.',
    'The bank\u2019s armored rover leaves at shift change. The driver takes the long way past the noodle bar.'
  ],
  hel: [
    'Voss is out of town. The guardhouse thinks the gardener has a key. The gardener has a price.',
    'Sable keeps a racing rover in the garage and the code is her birthday. Everybody knows her birthday.',
    'The Kline estate wants someone discreet to make a reporter\u2019s rover break down. Pays four figures.',
    'Clubhouse poker night. Quinn always loses and always pays in bearer chips.',
    'The guards at the gate take a 50 credit "parking fee". Pay it and nobody remembers you.'
  ]
};

// ---------- the shops ----------
// item: { id, name, desc, price, kind, ...}  kinds: weapon(w) melee(w) ammo(ammo,n) medkit heal(hp,shield,woozy,buff) bandana(c) paint(c) rumor
const SHOPS = {
  rtf: [
    { kind: 'guns', key: 'ms_guns_rtf', sign: 'SCRAP & SLUG', color: 0xff7a2a, at: [-20, -10, 7, 4, 4], keeper: 'Mags', items: [
      { id: 'shotgun', name: 'Sawn Breacher', desc: 'Used. Barrel cut down with a grinder. Comes with 12 shells.', price: 110, kind: 'weapon', w: 'shotgun' },
      { id: 'smg', name: 'Viper SMG (no serial)', desc: 'Serial filed off. Comes with 60 rounds.', price: 200, kind: 'weapon', w: 'smg' },
      { id: 'blade', name: 'Hot vibro-machete', desc: 'Fell off a cargo crawler. Melee hits land 3\u00d7 harder.', price: 160, kind: 'melee', w: 'blade' },
      { id: 'shells', name: 'Loose shells \u00d712', desc: 'Some of them are even live.', price: 20, kind: 'ammo', ammo: 'shells', n: 12 },
      { id: 'shells24', name: 'Bulk buckshot \u00d724', desc: 'A coffee can of shells.', price: 36, kind: 'ammo', ammo: 'shells', n: 24 },
      { id: 'rounds', name: 'Reloads \u00d760', desc: 'Hand-packed SMG rounds.', price: 25, kind: 'ammo', ammo: 'rounds', n: 60 }
    ] },
    { kind: 'clothes', key: 'ms_clothes_rtf', sign: 'THRIFT LOCK', color: 0xd8b020, at: [42, -8, 7, 4, 4], keeper: 'Pin', items: [
      { id: 'rustrag', name: 'Rust Rag bandana', price: 25, kind: 'bandana', c: 'rustrag' },
      { id: 'dustkings', name: 'Dust Kings colours', price: 35, kind: 'bandana', c: 'dustkings' },
      { id: 'scrapper', name: 'Scrapper Grey bandana', price: 30, kind: 'bandana', c: 'scrapper' },
      { id: 'primer', name: 'Rover wrap: Primer Grey', price: 40, kind: 'paint', c: 'primer' },
      { id: 'burnout', name: 'Rover wrap: Burnout Black', price: 50, kind: 'paint', c: 'burnout' }
    ] },
    { kind: 'pharm', key: 'ms_pharm_rtf', sign: 'DOC GRIM\u2019S', color: 0x6aff6a, at: [-6, -24, 6, 4, 3.5], keeper: 'Doc Grim', items: [
      { id: 'medkit', name: 'Patched medkit', desc: 'Heals 50. Mostly sterile. Carry up to 3.', price: 25, kind: 'medkit' },
      { id: 'stim', name: 'Back-alley stim', desc: '+60 health right now. Leaves you woozy for 25 s.', price: 30, kind: 'heal', hp: 60, woozy: 25 },
      { id: 'pills', name: 'Bootleg painkillers', desc: '+25 health. Mild wooze.', price: 10, kind: 'heal', hp: 25, woozy: 10 },
      { id: 'cell', name: 'Cracked shield cell', desc: 'Refills your shield. Sparks a bit.', price: 35, kind: 'heal', shield: true }
    ] },
    { kind: 'bar', key: 'ms_bar_rtf', sign: 'ASHES TO ORBIT', color: 0xb070ff, at: [8, 28, 5, 3, 3], keeper: 'Widow Kaye', steve: /ASHES/i, items: [
      { id: 'rotgut', name: 'Rotgut', desc: '+15 health. Room spins for 20 s.', price: 6, kind: 'heal', hp: 15, woozy: 20 },
      { id: 'funeral', name: 'Funeral shot', desc: 'Liquid courage: +25 max shield for 60 s. A little woozy.', price: 15, kind: 'heal', hp: 5, buff: { smax: 25, t: 60 }, woozy: 8 },
      { id: 'water', name: 'Tap water', desc: '+5 health. Probably fine.', price: 2, kind: 'heal', hp: 5 },
      { id: 'round', name: 'Buy the mourners a round', desc: 'Grief loosens tongues. A job tip.', price: 15, kind: 'rumor' }
    ] }
  ],
  oly: [
    { kind: 'guns', key: 'ms_guns_oly', sign: 'MERIDIAN ARMS', color: 0x40d0ff, at: [-38, -36, 8, 5, 4], keeper: 'Dana Okafor', items: [
      { id: 'shotgun', name: 'Breacher shotgun', desc: '8-pellet scattergun. Comes with 12 shells.', price: 150, kind: 'weapon', w: 'shotgun' },
      { id: 'smg', name: 'Viper SMG', desc: 'Compact caseless SMG. Comes with 60 rounds.', price: 260, kind: 'weapon', w: 'smg' },
      { id: 'railrifle', name: 'Scoped rail rifle', desc: 'Punches through a line of anything. Comes with 6 slugs.', price: 420, kind: 'weapon', w: 'railrifle' },
      { id: 'shells', name: 'Shotgun shells \u00d712', price: 30, kind: 'ammo', ammo: 'shells', n: 12 },
      { id: 'rounds', name: 'SMG rounds \u00d760', price: 35, kind: 'ammo', ammo: 'rounds', n: 60 },
      { id: 'slugs', name: 'Rail slugs \u00d76', price: 45, kind: 'ammo', ammo: 'slugs', n: 6 }
    ] },
    { kind: 'clothes', key: 'ms_clothes_oly', sign: 'THREADLINE', color: 0x1ad0c0, at: [44, -14, 8, 5, 4], keeper: 'Theo', items: [
      { id: 'corpteal', name: 'Corporate Teal bandana', price: 70, kind: 'bandana', c: 'corpteal' },
      { id: 'pinstripe', name: 'Pinstripe Navy bandana', price: 70, kind: 'bandana', c: 'pinstripe' },
      { id: 'meridian', name: 'Rover wrap: Meridian Teal', price: 90, kind: 'paint', c: 'meridian' },
      { id: 'chrome', name: 'Rover wrap: Chrome', price: 120, kind: 'paint', c: 'chrome' }
    ] },
    { kind: 'pharm', key: 'ms_pharm_oly', sign: 'OLYMPUS CARE', color: 0x40ff9a, at: [-2, -24, 7, 4, 4], keeper: 'Pharmacist Ruiz', items: [
      { id: 'medkit', name: 'Trauma medkit', desc: 'Heals 50. Carry up to 3.', price: 40, kind: 'medkit' },
      { id: 'stim', name: 'Combat stim', desc: '+35 health and a full shield.', price: 45, kind: 'heal', hp: 35, shield: true },
      { id: 'cell', name: 'Shield cell', desc: 'Refills your shield.', price: 35, kind: 'heal', shield: true },
      { id: 'focus', name: 'Focus tabs', desc: '+15 health, +20 max shield for 60 s.', price: 20, kind: 'heal', hp: 15, buff: { smax: 20, t: 60 } }
    ] },
    { kind: 'bar', key: 'ms_bar_oly', sign: 'RED PLANET NOODLE', color: 0xff3a3a, at: [14, 14, 5, 3, 3], keeper: 'Cook Lin', steve: /NOODLE/i, items: [
      { id: 'noodles', name: 'Red Planet noodle bowl', desc: 'Chilli broth. +30 health.', price: 8, kind: 'heal', hp: 30 },
      { id: 'sake', name: 'Synth-sake', desc: '+10 health, +20 max shield for 60 s. Slightly woozy.', price: 14, kind: 'heal', hp: 10, buff: { smax: 20, t: 60 }, woozy: 8 },
      { id: 'tea', name: 'Hot tea', desc: '+8 health. Clears the head.', price: 4, kind: 'heal', hp: 8, sober: true },
      { id: 'round', name: 'Ask the cook', desc: 'Lin hears everything over the counter. A job tip.', price: 20, kind: 'rumor' }
    ] }
  ],
  hel: [
    { kind: 'guns', key: 'ms_guns_hel', sign: 'AURUM ARMORY', color: 0xffd060, at: [24, 4, 8, 5, 4], keeper: 'Mr. Albrecht', items: [
      { id: 'smg', name: 'Engraved Viper SMG', desc: 'Gold inlay, same kick. Comes with 60 rounds.', price: 330, kind: 'weapon', w: 'smg' },
      { id: 'railrifle', name: 'Bespoke rail rifle', desc: 'Hand-wound coils. Comes with 6 slugs.', price: 504, kind: 'weapon', w: 'railrifle' },
      { id: 'launcher', name: 'Frag launcher, walnut stock', desc: 'Lobs frags, 5 m blast. Comes with 4 frags.', price: 576, kind: 'weapon', w: 'launcher' },
      { id: 'cleaver', name: 'Thermal cleaver', desc: 'Red-hot steel in a velvet case.', price: 360, kind: 'melee', w: 'cleaver' },
      { id: 'slugs', name: 'Match slugs \u00d76', price: 55, kind: 'ammo', ammo: 'slugs', n: 6 },
      { id: 'grenades', name: 'Frag grenades \u00d74', price: 75, kind: 'ammo', ammo: 'grenades', n: 4 }
    ] },
    { kind: 'clothes', key: 'ms_clothes_hel', sign: 'HELIOS ATELIER', color: 0xf0d8a0, at: [14, -34, 8, 5, 4], keeper: 'Madame Voclain', items: [
      { id: 'ivorysilk', name: 'Ivory Silk bandana', price: 150, kind: 'bandana', c: 'ivorysilk' },
      { id: 'goldthread', name: 'Gold Thread bandana', price: 200, kind: 'bandana', c: 'goldthread' },
      { id: 'pearl', name: 'Rover wrap: Pearl', price: 250, kind: 'paint', c: 'pearl' },
      { id: 'goldleaf', name: 'Rover wrap: Gold Leaf', price: 300, kind: 'paint', c: 'goldleaf' }
    ] },
    { kind: 'pharm', key: 'ms_pharm_hel', sign: 'VITAE CLINIC', color: 0x9affe0, at: [-24, 2, 8, 5, 4], keeper: 'Dr. Hale', items: [
      { id: 'medkit', name: 'Concierge medkit', desc: 'Heals 50. Monogrammed. Carry up to 3.', price: 70, kind: 'medkit' },
      { id: 'drip', name: 'Nanite drip', desc: 'Full health and full shield.', price: 120, kind: 'heal', hp: 999, shield: true },
      { id: 'longevity', name: 'Longevity shot', desc: '+50 health, +40 max shield for 120 s.', price: 90, kind: 'heal', hp: 50, buff: { smax: 40, t: 120 } }
    ] },
    { kind: 'bar', key: 'ms_bar_hel', sign: 'THE GILDED LOCK', color: 0xffc040, at: [-14, -36, 8, 5, 4], keeper: 'Sterling', items: [
      { id: 'whisky', name: 'Vintage Earth whisky', desc: '+40 health, +25 max shield for 90 s.', price: 60, kind: 'heal', hp: 40, buff: { smax: 25, t: 90 } },
      { id: 'champagne', name: 'Champagne flute', desc: '+25 health. Bubbles go straight to your head.', price: 45, kind: 'heal', hp: 25, woozy: 10 },
      { id: 'oxygen', name: 'Oxygen hit', desc: '+20 health and clears any wooze.', price: 25, kind: 'heal', hp: 20, sober: true },
      { id: 'round', name: 'Tip the bartender', desc: 'Sterling serves the whole estate. Premium job tips.', price: 80, kind: 'rumor' }
    ] }
  ]
};
const ITEMS = new Map(); // full id -> { ...item, d, shop }
for (const d in SHOPS) for (const s of SHOPS[d]) for (const it of s.items) { it.fid = `ms:${d}:${it.id}`; ITEMS.set(it.fid, { ...it, d, shop: s }); }

// ---------- effects: temporary buffs and the woozy debuff ----------
const FX = { woozyUntil: 0, buffs: [], rumors: [] };
let woozyTimer = 0;
const gameCanvas = () => [...document.querySelectorAll('canvas')].sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
function setWoozy(sec) {
  FX.woozyUntil = Math.max(FX.woozyUntil, performance.now() + sec * 1000);
  const cv = gameCanvas(); if (cv) { cv.style.transition = 'filter 0.8s'; cv.style.filter = 'blur(1.4px) saturate(1.6) hue-rotate(18deg)'; }
  document.body.dataset.msWoozy = '1';
  clearTimeout(woozyTimer); woozyTimer = setTimeout(sober, FX.woozyUntil - performance.now());
}
function sober() { FX.woozyUntil = 0; const cv = gameCanvas(); if (cv) cv.style.filter = ''; delete document.body.dataset.msWoozy; }
function addBuff(game, b) {
  const H = game.debug?.H?.(); if (!H) return false;
  H.smax += b.smax; H.shield = Math.min(H.smax, H.shield + b.smax);
  const rec = { smax: b.smax, until: performance.now() + b.t * 1000 }; FX.buffs.push(rec);
  setTimeout(() => { H.smax = Math.max(1, H.smax - rec.smax); H.shield = Math.min(H.shield, H.smax); FX.buffs = FX.buffs.filter(x => x !== rec); }, b.t * 1000);
  return true;
}

// ---------- the shop logic (wraps game.shopItem / shopList / buy for 'ms:' ids) ----------
function itemState(game, it) {
  const P = game.progress, H = game.debug?.H?.() || { hp: 100, max: 100, shield: 0, smax: 60 };
  const own = id => P.unlocks.includes(id);
  let owned = false, equipped = false, ok = true, why = '';
  if (it.kind === 'weapon') { owned = own('weapon:' + it.w); equipped = owned && P.equip.weapon === it.w; }
  if (it.kind === 'melee') { owned = own('melee:' + it.w); equipped = owned && P.equip.weapon === it.w; }
  if (it.kind === 'bandana' || it.kind === 'paint') { owned = own(`${it.kind}:${it.c}`); equipped = owned && P.equip[it.kind] === it.c; }
  if (it.kind === 'ammo') {
    const gun = Object.keys(WEAPONS).find(k => WEAPONS[k].ammo === it.ammo && k !== 'rifle');
    if (gun && it.ammo !== 'shells' && !own('weapon:' + gun)) { ok = false; why = 'Needs the ' + (WEAPONS[gun]?.name || 'gun'); }
    else if ((P.inv[it.ammo] || 0) >= game.ammoCap(it.ammo)) { ok = false; why = 'Full'; }
  }
  if (it.kind === 'medkit' && (P.inv.medkits || 0) >= 3) { ok = false; why = 'Carrying 3'; }
  void H;
  return { id: it.fid, name: it.name, desc: it.desc || '', price: it.price, owned, equipped, ok: ok && !owned, why, afford: P.credits >= it.price, kind: it.kind,
    ammo: it.ammo, color: it.c ? COSMETICS[it.kind]?.[it.c]?.color : undefined, group: it.shop.sign, venues: ['ms:' + it.shop.key] };
}
function doBuy(game, it) {
  const P = game.progress, L = itemState(game, it);
  if ((it.kind === 'weapon' || it.kind === 'melee') && L.owned) { if (P.equip.weapon !== it.w) game.switchWeapon(it.w); return { ok: true, msg: `${it.name} in hand.`, equip: true }; }
  if ((it.kind === 'bandana' || it.kind === 'paint') && L.owned) { game.equip(it.kind, it.c); return { ok: true, msg: `Wearing ${it.name}.` }; }
  if (!L.ok) return { ok: false, msg: L.why || 'Not for sale.' };
  if (P.credits < it.price) return { ok: false, msg: `Short ${it.price - P.credits} credits.` };
  P.credits -= it.price;
  let msg = `${it.name}: yours.`; const H = game.debug?.H?.();
  if (it.kind === 'weapon') {
    P.unlocks.push('weapon:' + it.w); const w = WEAPONS[it.w], start = { shotgun: 12, smg: 60, railrifle: 6, launcher: 4 }[it.w] || 12;
    if (w?.ammo) P.inv[w.ammo] = Math.min(game.ammoCap(w.ammo), (P.inv[w.ammo] || 0) + start);
    game.save(); game.switchWeapon(it.w);
  } else if (it.kind === 'melee') { P.unlocks.push('melee:' + it.w); game.save(); game.switchWeapon(it.w); }
  else if (it.kind === 'ammo') P.inv[it.ammo] = Math.min(game.ammoCap(it.ammo), (P.inv[it.ammo] || 0) + it.n);
  else if (it.kind === 'medkit') P.inv.medkits = (P.inv.medkits || 0) + 1;
  else if (it.kind === 'bandana' || it.kind === 'paint') { P.unlocks.push(`${it.kind}:${it.c}`); game.save(); game.equip(it.kind, it.c); msg = `${it.name}: yours, and you\u2019re wearing it.`; }
  else if (it.kind === 'heal') {
    if (H) { if (it.hp) H.hp = Math.min(H.max, H.hp + it.hp); if (it.shield) H.shield = H.smax; } else if (it.hp >= 999) game.restore?.();
    if (it.buff) addBuff(game, it.buff);
    if (it.sober) sober();
    if (it.woozy) { setWoozy(it.woozy); msg = `${it.name}. Whoa. The room\u2019s tilting.`; }
    else msg = `${it.name}. ${it.buff ? 'You feel bulletproof.' : 'That hit the spot.'}`;
  } else if (it.kind === 'rumor') {
    const pool = RUMORS[it.d], r = pool[(FX.rumors.length + Math.floor(Math.random() * pool.length)) % pool.length]; FX.rumors.push(r);
    msg = `${it.shop.keeper} leans in: \u201c${r}\u201d`;
  }
  game.save();
  return { ok: true, msg, rumor: it.kind === 'rumor' || undefined };
}
function patchGame(game) {
  if (!game || game.__marsShops) return; game.__marsShops = true;
  const si = game.shopItem, sl = game.shopList, b = game.buy;
  game.shopItem = id => (typeof id === 'string' && id.startsWith('ms:')) ? (ITEMS.has(id) ? itemState(game, ITEMS.get(id)) : null) : si(id);
  game.buy = id => (typeof id === 'string' && id.startsWith('ms:')) ? (ITEMS.has(id) ? doBuy(game, ITEMS.get(id)) : { ok: false, msg: 'Not for sale.' }) : b(id);
  game.shopList = (venue = null, all = false) => {
    if (typeof venue === 'string' && venue.startsWith('ms:')) { const s = Object.values(SHOPS).flat().find(x => 'ms:' + x.key === venue); const r = sl(null, false); return { ...r, venue, items: s ? s.items.map(it => itemState(game, ITEMS.get(it.fid))) : [] }; }
    return sl(venue, all);
  };
}

// ---------- interiors ----------
const FACE = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] };
function tagDraw(ctx2, it) {
  const c = ctx2.canvas, w = c.width, h = c.height; ctx2.clearRect(0, 0, w, h);
  ctx2.fillStyle = 'rgba(10,10,14,0.92)'; ctx2.fillRect(0, 0, w, h);
  const st = !it ? '' : it.equipped ? 'EQUIPPED' : it.owned ? 'OWNED' : !it.ok ? (it.why || 'LOCKED').toUpperCase() : `${it.price} cr`;
  const col = !it ? '#888' : it.owned ? '#7dffb0' : !it.ok ? '#ff9a6a' : it.afford ? '#ffe680' : '#ff5a5a';
  ctx2.strokeStyle = col; ctx2.lineWidth = 4; ctx2.strokeRect(3, 3, w - 6, h - 6); ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
  const fit = (s, fs) => { ctx2.font = `bold ${fs}px system-ui, sans-serif`; while (ctx2.measureText(s).width > w - 16 && fs > 12) { fs -= 2; ctx2.font = `bold ${fs}px system-ui, sans-serif`; } };
  fit(it?.name || '', 30); ctx2.fillStyle = '#fff'; ctx2.fillText(it?.name || '', w / 2, h * 0.32);
  fit(st, 36); ctx2.fillStyle = col; ctx2.fillText(st, w / 2, h * 0.72);
}
function model(api, it) {
  const { G, mk, mat } = api, g = new THREE.Group();
  const add = (geo, m, x, y, z, sx, sy, sz, rz = 0) => { const o = mk(geo, m, x, y, z, sx, sy, sz); o.rotation.z = rz; g.add(o); return o; };
  const dark = mat(0x1e2024, { metalness: 0.6, roughness: 0.4 }), steel = mat(0x8a9098, { metalness: 0.8, roughness: 0.3 }), wood = mat(0x5a3a22), gold = mat(0xd4af37, { metalness: 0.9, roughness: 0.25 });
  const lux = it.d === 'hel', k = it.kind;
  if (k === 'weapon') {
    const id = it.w, L = { shotgun: it.d === 'rtf' ? 0.75 : 1.0, smg: 0.62, railrifle: 1.3, launcher: 0.9 }[id] || 0.9;
    add(G.box, dark, 0, 0, 0, L, 0.1, 0.08); add(G.box, id === 'shotgun' || lux ? wood : dark, -L / 2 - 0.12, -0.05, 0, 0.3, 0.16, 0.07); add(G.box, dark, -0.05, -0.12, 0, 0.08, 0.2, 0.06);
    if (id === 'smg') add(G.box, dark, 0.08, -0.16, 0, 0.06, 0.24, 0.05);
    if (id === 'railrifle') { add(G.box, mat(0x9fd8ff, { basic: true }), 0.15, 0.07, 0, L * 0.7, 0.03, 0.09); add(G.cyl, dark, -0.1, 0.12, 0, 0.04, 0.3, 0.04, Math.PI / 2); }
    if (id === 'launcher') add(G.cyl, steel, 0.15, 0, 0, 0.09, 0.6, 0.09, Math.PI / 2);
    if (lux) add(G.box, gold, 0, 0.055, 0, L * 0.5, 0.012, 0.085);
    if (it.d === 'rtf') add(G.box, mat(0x7a3a1a, { roughness: 1 }), 0.1, 0, 0, 0.12, 0.11, 0.09); // tape wrap
  } else if (k === 'melee') {
    add(G.box, mat(lux ? 0x3a1a10 : 0x222222), -0.35, 0, 0, 0.26, 0.06, 0.06);
    add(G.box, it.w === 'cleaver' ? mat(0xff7a30, { emissive: 0xff4a10, emissiveIntensity: 0.6, metalness: 0.6 }) : mat(0x9ff4ff, { emissive: 0x2a8a9a, emissiveIntensity: 0.4, metalness: 0.8 }), 0.12, 0, 0, 0.7, it.w === 'cleaver' ? 0.16 : 0.07, 0.02);
  } else if (k === 'ammo') {
    const c = { shells: 0xffb347, rounds: 0xffe066, slugs: 0x9fd8ff, grenades: 0xff7a20 }[it.ammo] || 0xffb347;
    add(G.box, mat(it.d === 'rtf' ? 0x5a4a3a : 0x3d4a2a), 0, 0, 0, 0.36, 0.2, 0.22); add(G.box, mat(c, { basic: true }), 0, 0.02, 0.113, 0.36, 0.05, 0.005);
    if (it.ammo === 'grenades') for (const x of [-0.1, 0.1]) add(G.sph, mat(0x4a5a2a), x, 0.15, 0, 0.07);
  } else if (k === 'medkit') { add(G.box, mat(lux ? 0xf8f4ea : 0xf2f2f2), 0, 0, 0, 0.36, 0.22, 0.18); add(G.box, mat(0xd02020, { basic: true }), 0, 0, 0.092, 0.2, 0.06, 0.005); add(G.box, mat(0xd02020, { basic: true }), 0, 0, 0.092, 0.06, 0.16, 0.005); }
  else if (k === 'bandana') { const t = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 3), mat(COSMETICS.bandana[it.c]?.color ?? 0xd23b3b, { roughness: 0.9 })); api.disposables.push(t.geometry); t.rotation.z = Math.PI; t.scale.z = 0.15; g.add(t); }
  else if (k === 'paint') { add(G.cyl, mat(COSMETICS.paint[it.c]?.color ?? 0x888888, { metalness: 0.5, roughness: 0.3 }), 0, 0, 0, 0.13, 0.3, 0.13); add(G.cyl, steel, 0, 0.16, 0, 0.13, 0.02, 0.13); }
  else if (k === 'rumor') { add(G.box, mat(0xf0e0b0), 0, 0, 0, 0.22, 0.02, 0.14); add(G.cyl, mat(0xffd040, { metalness: 0.8 }), 0.12, 0.03, 0, 0.04, 0.02, 0.04); add(G.cyl, mat(0xffd040, { metalness: 0.8 }), 0.06, 0.05, 0.03, 0.04, 0.02, 0.04); }
  else if (k === 'heal') {
    if (it.shop.kind === 'bar') { // a drink
      const glass = mat(0xbfe8ff, { transparent: true, opacity: 0.35, roughness: 0.05 });
      if (/noodle|bowl/i.test(it.name)) { add(G.cyl, mat(0xc0201a), 0, 0, 0, 0.16, 0.12, 0.16); add(G.cyl, mat(0xffc070), 0, 0.06, 0, 0.14, 0.01, 0.14); }
      else { add(G.cyl, mat(it.woozy ? 0x8a5a10 : it.buff ? 0xc08a20 : 0x9fd8ff, { roughness: 0.3 }), 0, -0.02, 0, 0.06, 0.12, 0.06); add(G.cyl, glass, 0, 0, 0, 0.07, 0.18, 0.07); add(G.cyl, mat(0x2a4a2a, { roughness: 0.2 }), -0.18, 0.05, 0, 0.06, 0.32, 0.06); }
    } else if (it.shield) { add(G.cyl, mat(0x8fe0ff, { emissive: 0x3a8aaa, emissiveIntensity: 0.8 }), 0, 0, 0, 0.08, 0.26, 0.08); add(G.cyl, steel, 0, 0.15, 0, 0.09, 0.04, 0.09); }
    else { add(G.cyl, mat(0xffffff, { transparent: true, opacity: 0.6 }), 0, 0, 0, 0.04, 0.26, 0.04, Math.PI / 2); add(G.cyl, mat(it.woozy ? 0xff40a0 : 0x40ff90, { emissive: it.woozy ? 0xa01060 : 0x10a050, emissiveIntensity: 0.7 }), 0, 0, 0, 0.03, 0.2, 0.03, Math.PI / 2); add(G.cyl, steel, 0.17, 0, 0, 0.006, 0.1, 0.006, Math.PI / 2); }
  } else add(G.box, mat(0x888888), 0, 0, 0, 0.3, 0.2, 0.2);
  return g;
}
function ware(api, o, it, x, y, z, face = 's', opts = {}) {
  const id = it.fid, st = o.shop?.item(id); if (!st) return null;
  const [fx, fz] = FACE[face], yaw = Math.atan2(fx, fz);
  const m = model(api, ITEMS.get(id)); m.position.set(x, y, z); m.rotation.y = yaw + (opts.turn || 0); if (opts.scale) m.scale.setScalar(opts.scale); api.g.add(m);
  m.traverse(c => { c.userData.ware = id; });
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 112; const c2 = cv.getContext('2d'); tagDraw(c2, st);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; api.disposables.push(tex);
  const tag = new THREE.Mesh(api.G.plane, new THREE.MeshBasicMaterial({ map: tex })); api.disposables.push(tag.material);
  tag.position.set(x + fx * (opts.tagOut ?? 0.12), opts.tagY ?? (y - 0.3), z + fz * (opts.tagOut ?? 0.12)); tag.rotation.y = yaw; if (opts.tagTilt) tag.rotation.x = -opts.tagTilt;
  const ts = opts.tagScale || 0.8; tag.scale.set(ts, ts * 0.4375, 1); tag.userData.ware = id; api.g.add(tag);
  const spot = api.spot({ id: 'ware:' + id, x: x + fx * (opts.reach ?? 0.95), z: z + fz * (opts.reach ?? 0.95), r: opts.r ?? 0.75, label: '🛒 ' + it.name, act: 'buy', ware: id });
  const w = { id, m, tag, c2, tex, key: '', spot, x, y, z }; api.wares.push(w);
  // keep our tags fresh (the core ware ticker redraws through o.shop.item too; this covers custom fields)
  return w;
}
function wallRack(api, x, y, z, len, face, col = 0x9a8a68) { const [fx, fz] = FACE[face], ax = fz !== 0; api.box(x - fx * 0.03, y, z - fz * 0.03, ax ? len : 0.05, 1.6, ax ? 0.05 : len, api.mat(col, { roughness: 0.9 })); api.box(x + fx * 0.02, y + 0.85, z + fz * 0.02, ax ? len : 0.06, 0.05, ax ? 0.06 : len, api.mat(0xfff0c0, { basic: true })); }
function glassCase(api, x, z, len, depth = 0.8, body = 0x2a2c30) {
  const { box, mat } = api; box(x, 0.45, z, len, 0.9, depth, mat(body, { metalness: 0.5, roughness: 0.4 })); box(x, 0.92, z, len * 0.94, 0.03, depth * 0.9, mat(0xfff4d0, { basic: true }));
  box(x, 1.12, z, len, 0.4, depth, mat(0xbfe8ff, { transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false })); api.col(x, z, len / 2 + 0.05, depth / 2 + 0.05);
}
function reset(h) { h.hips.position.y = h.base; h.hips.rotation.set(0, 0, 0); h.torso.rotation.set(0, 0, 0); h.head.rotation.set(0, 0, 0); for (const a of h.arms) a.rotation.set(0, 0, 0); for (const l of h.legs) l.rotation.set(0, 0, 0); }
const idle = (h, t, k = 0) => { reset(h); const s = Math.sin(t * 1.6 + k); h.hips.position.y = h.base - Math.abs(s) * 0.02; h.torso.rotation.z = s * 0.03; h.head.rotation.y = Math.sin(t * 0.4 + k * 2) * 0.4; h.arms[0].rotation.x = 0.1; h.arms[1].rotation.x = 0.1; };
const wipe = (h, t) => { reset(h); h.arms[1].rotation.x = 1.3; h.arms[1].rotation.z = Math.sin(t * 3) * 0.35; h.torso.rotation.x = 0.12; h.head.rotation.y = Math.sin(t * 0.3) * 0.5; };
const browse = (h, t, k) => { reset(h); h.head.rotation.x = 0.25; h.head.rotation.y = Math.sin(t * 0.3 + k) * 0.5; h.arms[0].rotation.x = 0.5 + Math.sin(t * 0.7) * 0.1; };
const THEME = {
  rtf: { wall: 0x3a2c24, floor: 0x1c1712, ceil: 0x120e0c, light: { color: 0xffb070, int: 45 }, rack: 0x6a5a40, case: 0x3a3028,
    keeper: { top: 0x4a3a2a, bottom: 0x2a2620, hair: 0x2a1a10, hairStyle: 'mohawk', skin: 0xa06a48, accent: 0xff7a2a }, guest: { top: 0x5a2a20, bottom: 0x2a2a2a, hair: 0x111111, hairStyle: 'cap', skin: 0x6a4028 } },
  oly: { wall: 0x2a3038, floor: 0x1a1d22, ceil: 0x121418, light: { color: 0xe8f4ff, int: 70 }, rack: 0x8a9098, case: 0x2a2c30,
    keeper: { top: 0x1c2a4a, bottom: 0x22252b, hair: 0x241a12, hairStyle: 'short', skin: 0x6a4028, accent: 0x40d0ff }, guest: { top: 0x3a4250, bottom: 0x23252b, hair: 0x9a7a4a, hairStyle: 'long', skin: 0xe0b090 } },
  hel: { wall: 0x3a3428, floor: 0x2a2620, ceil: 0x1a1814, light: { color: 0xfff0d0, int: 80 }, rack: 0x5a3a22, case: 0x2a2018,
    keeper: { top: 0x101014, bottom: 0x101014, hair: 0xb0b0b0, hairStyle: 'short', skin: 0xe0b090, accent: 0xd4af37 }, guest: { top: 0xf0e6d8, bottom: 0x2a2a2a, hair: 0x3a2a1a, hairStyle: 'bun', skin: 0xc68a64, shades: true } }
};
function decor(api, d, s) {
  const { box, mat, w, h } = api, D = api.d;
  if (d === 'rtf') { // grime and graffiti
    api.sign('NO REFUNDS. NO NAMES.', 0xff5a3a, -w / 2 + 0.06, 3.0, 0.5, Math.PI / 2, 3.6, { h: 96 });
    for (let k = 0; k < 3; k++) box(w / 2 - 0.7, 0.3 + k * 0.6, D / 2 - 1.2 - (k % 2) * 0.3, 0.9, 0.55, 0.9, mat(k % 2 ? 0x6a5030 : 0x5a4428));
    api.col(w / 2 - 0.7, D / 2 - 1.3, 0.5, 0.6, 'tall');
  } else if (d === 'oly') {
    api.sign('LICENSED \u00b7 OLYMPUS ROW', 0x40d0ff, -w / 2 + 0.06, 3.0, 0.5, Math.PI / 2, 3.6, { h: 96 });
    box(-w / 2 + 0.6, 0.5, D / 2 - 1.2, 0.5, 1.0, 0.5, mat(0x2a6a3a)); box(-w / 2 + 0.6, 1.3, D / 2 - 1.2, 0.6, 0.7, 0.6, mat(0x3a8a4a)); api.col(-w / 2 + 0.6, D / 2 - 1.2, 0.35, 0.35);
  } else { // gold trim, carpet
    box(0, 0.01, 0.6, w * 0.6, 0.02, D * 0.5, mat(0x5a1018, { roughness: 1 }));
    box(0, h - 0.3, -D / 2 + 0.03, w, 0.06, 0.03, mat(0xd4af37, { metalness: 0.9, roughness: 0.25 }));
    api.sign('BY APPOINTMENT \u00b7 HELIOS HEIGHTS', 0xf0d8a0, -w / 2 + 0.06, 3.0, 0.5, Math.PI / 2, 3.6, { h: 96 });
  }
  void s;
}
function buildGuns(api, o, d, s) {
  const T = THEME[d], { box, mat, w } = api, D = api.d;
  wallRack(api, 0, 2.2, -D / 2 + 0.06, 10, 's', T.rack);
  for (let k = 0; k < 6; k++) { const gx = -4 + k * 1.6, gy = 2.85, z = -D / 2 + 0.14; box(gx, gy, z, 1.2, 0.1, 0.06, mat(0x1a1b1e)); box(gx - 0.5, gy - 0.1, z, 0.3, 0.22, 0.06, mat(k % 2 ? 0x5a3a22 : 0x2a2a2a)); }
  const longs = s.items.filter(i => i.kind === 'weapon' || i.kind === 'melee'), small = s.items.filter(i => i.kind === 'ammo');
  longs.forEach((it, k) => ware(api, o, it, -3.3 + k * 2.2, 1.75, -D / 2 + 0.16, 's', { tagY: 1.3, reach: 1.0, r: 1.0 }));
  glassCase(api, -0.6, 0.6, 5.2, 0.8, T.case);
  small.forEach((it, k) => ware(api, o, it, -2.4 + k * 1.8, 1.02, 0.6, 's', { tagY: 1.5, tagOut: 0.45, reach: 0.95, r: 0.8 }));
  api.sign(o.title || s.sign, s.color, 0, 3.6, -D / 2 + 0.06, 0, 4.4);
  box(w / 2 - 1.2, 0.55, -1.2, 0.8, 1.1, 2.4, mat(T.case)); api.col(w / 2 - 1.2, -1.2, 0.45, 1.25);
  api.person(T.keeper, w / 2 - 0.5, -1.2, -Math.PI / 2, (p, t) => idle(p, t, 0.3));
  api.person(T.guest, -3.2, 2.6, Math.PI * 0.9, (p, t, k) => browse(p, t, k), 1.1);
  decor(api, d, s);
}
function buildClothes(api, o, d, s) {
  const T = THEME[d], { box, mat, w } = api, D = api.d;
  const bands = s.items.filter(i => i.kind === 'bandana'), paints = s.items.filter(i => i.kind === 'paint');
  wallRack(api, 0, 2.0, -D / 2 + 0.06, 9, 's', T.rack);
  bands.forEach((it, k) => ware(api, o, it, -3 + k * 2.0, 1.75, -D / 2 + 0.16, 's', { tagY: 1.3, reach: 1.0, r: 0.95, scale: 1.3 }));
  // paint/wrap swatches on a plinth line along the east wall
  box(w / 2 - 0.5, 0.45, 0.6, 0.8, 0.9, 4.6, mat(T.case)); api.col(w / 2 - 0.5, 0.6, 0.45, 2.35);
  paints.forEach((it, k) => ware(api, o, it, w / 2 - 0.5, 1.07, -0.6 + k * 2.2, 'w', { tagY: 1.55, tagOut: 0.45, reach: 1.0, r: 0.9 }));
  // mannequins in the window wearing the colours (buildHuman with a bandana)
  bands.slice(0, 3).forEach((it, k) => {
    const x = -w / 2 + 1.2, z = -1.6 + k * 1.6, c = COSMETICS.bandana[it.c]?.color ?? 0xffffff;
    const p = buildHuman({ top: d === 'hel' ? 0x101014 : d === 'oly' ? 0x2a3850 : 0x4a3a2a, bottom: 0x23252b, skin: 0xd8d8d8, hairStyle: 'bald' });
    p.group.position.set(x, 0.12, z); p.group.rotation.y = Math.PI / 2; api.g.add(p.group);
    const bd = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.22, 3), mat(c, { roughness: 0.9 })); api.disposables.push(bd.geometry); bd.rotation.x = Math.PI; bd.position.set(0, 1.5, -0.1); bd.scale.z = 0.5; p.group.add(bd);
    box(x, 0.06, z, 0.6, 0.12, 0.6, mat(0x2a2a2a)); api.col(x, z, 0.35, 0.35, 'tall');
  });
  box(-w / 2 + 0.03, 1.6, 2.4, 0.02, 2.2, 1.2, mat(0xd8e8f0, { metalness: 1, roughness: 0.05 })); // mirror
  api.sign(o.title || s.sign, s.color, 0, 3.4, -D / 2 + 0.06, 0, 4.4);
  box(2.6, 0.55, 1.6, 2.0, 1.1, 0.7, mat(T.case)); api.col(2.6, 1.6, 1.05, 0.4);
  api.person(T.keeper, 2.6, 0.9, Math.PI, (p, t) => idle(p, t, 0.7));
  decor(api, d, s);
}
function buildPharm(api, o, d, s) {
  const T = THEME[d], { box, mat, w } = api, D = api.d, white = mat(d === 'rtf' ? 0xb0b0a0 : 0xe8eef0, { roughness: 0.5 });
  box(0, 0.55, -1.6, w - 3, 1.1, 0.9, white); box(0, 1.13, -1.6, w - 2.8, 0.06, 1.0, mat(0x9adfc0)); api.col(0, -1.6, (w - 3) / 2 + 0.05, 0.5);
  for (const y of [1.5, 2.2, 2.9]) box(0, y, -D / 2 + 0.25, w - 2, 0.05, 0.4, white);
  for (let k = 0; k < 14; k++) box(-4 + k * 0.6, 1.65 + (k % 3) * 0.7, -D / 2 + 0.25, 0.25, 0.25, 0.22, mat([0xffffff, 0xff6a6a, 0x6aaaff, 0xffd040][k % 4]));
  s.items.forEach((it, k) => ware(api, o, it, -(s.items.length - 1) * 0.75 + k * 1.5, 1.27, -1.6, 's', { tagY: 1.6, tagOut: 0.52, reach: 1.05, r: 0.8 }));
  api.sign('+', s.color, -w / 2 + 0.06, 3.0, -1.6, Math.PI / 2, 1.2, { w: 128, h: 128, font: 'bold 110px system-ui, sans-serif' });
  api.sign(o.title || s.sign, s.color, 0, 3.6, -D / 2 + 0.06, 0, 4.0);
  api.person(T.keeper, 1.2, -2.6, 0, (p, t) => idle(p, t, 0.5));
  if (d === 'rtf') { box(w / 2 - 0.8, 0.45, 1.5, 0.7, 0.9, 1.8, mat(0x6a6a6a)); api.col(w / 2 - 0.8, 1.5, 0.4, 0.95); api.sign('CASH ONLY. DON\u2019T ASK.', 0xff5a3a, w / 2 - 0.06, 2.6, 1.0, -Math.PI / 2, 3.0, { h: 96 }); }
  else decor(api, d, s);
}
function buildBar(api, o, d, s) {
  const T = THEME[d], { box, mat, w } = api, D = api.d, wood = mat(d === 'hel' ? 0x3a2414 : d === 'oly' ? 0x6a2a20 : 0x4a3424, { roughness: 0.6 }), top = mat(d === 'hel' ? 0x1a1a1a : 0x8a5a32, { roughness: 0.3, metalness: d === 'hel' ? 0.5 : 0 });
  box(0, 0.55, -2.4, w - 4, 1.1, 0.9, wood); box(0, 1.13, -2.4, w - 3.8, 0.08, 1.1, top); api.col(0, -2.4, (w - 4) / 2 + 0.05, 0.6);
  box(0, 1.6, -D / 2 + 0.25, w - 3, 0.06, 0.4, wood); box(0, 2.15, -D / 2 + 0.25, w - 3, 0.06, 0.4, wood);
  for (let k = 0; k < 18; k++) { const x = -(w - 4) / 2 + k * (w - 4) / 17; box(x, 1.8 + (k % 2) * 0.55, -D / 2 + 0.25, 0.12, 0.34, 0.12, mat([0x6aff9a, 0xffb040, 0xff4a6a, 0x7ac8ff, 0xd8a0ff][k % 5], { basic: true })); }
  s.items.forEach((it, k) => ware(api, o, it, -(s.items.length - 1) * 0.8 + k * 1.6, 1.28, -2.3, 's', { tagY: 1.62, tagOut: 0.6, reach: 1.15, r: 0.85 }));
  api.sign(o.title || s.sign, s.color, 0, 3.4, -D / 2 + 0.06, 0, 4.4);
  api.person(T.keeper, 2.6, -3.4, 0, (p, t) => wipe(p, t));
  // a regular on a stool, a couple of tables
  for (const [x, z] of [[-w / 2 + 1.8, 1.4], [w / 2 - 1.8, 1.6]]) { box(x, 0.75, z, 1.1, 0.06, 1.1, top); box(x, 0.38, z, 0.12, 0.76, 0.12, mat(0x6a6e76, { metalness: 0.6 })); api.col(x, z, 0.6, 0.6); }
  api.person(T.guest, -w / 2 + 1.8, 2.3, Math.PI, (p, t, k) => idle(p, t, k), 2.2);
  if (d === 'rtf') api.sign('IN LOVING MEMORY OF EVERYONE WHO OWED US', 0xb070ff, w / 2 - 0.06, 3.0, -0.5, -Math.PI / 2, 4.2, { h: 96 });
  else if (d === 'oly') api.sign('\u62c9\u9762 \u00b7 NOODLES \u00b7 SAKE', 0xff3a3a, w / 2 - 0.06, 3.0, -0.5, -Math.PI / 2, 3.6, { h: 96 });
  decor(api, d, s);
}
const BUILD = { guns: buildGuns, clothes: buildClothes, pharm: buildPharm, bar: buildBar };
const SIZE = { guns: [12, 9, 4.5], clothes: [12, 9, 4.2], pharm: [11, 8, 4.2], bar: [14, 10, 4.6] };
const NAME = { guns: 'Gun store', clothes: 'Clothing store', pharm: 'Pharmacy', bar: 'Bar' };
for (const d in SHOPS) for (const s of SHOPS[d]) {
  const T = THEME[d], [w, dd, h] = SIZE[s.kind];
  registerInterior(s.key, { name: NAME[s.kind], w, d: dd, h, wall: T.wall, floor: T.floor, ceil: T.ceil, trim: s.color, light: T.light, store: s.kind === 'bar' ? undefined : s.kind, music: s.kind === 'bar' ? 'cantina' : undefined,
    build(api, o) { BUILD[s.kind](api, o, d, s); } });
}

// ---------- storefronts ----------
// v7.5 district builder present: drop local-coordinate blocks into the matching district (re-skin Steve's noodle/funeral bars).
// v7.4 main: push AJ-relative blocks onto the colony and flatten a pad under each one (see layout patch below).
const placed = [];
let mode = null;
function placeBlocks() {
  if (mode) return mode;
  const ds = (typeof districtsOf === 'function' ? districtsOf('Mars') : []) || [];
  const built = ds.filter(x => Array.isArray(x?.blocks) && (x.origin || x.centre));
  if (built.length) {
    mode = 'district';
    for (const d in SHOPS) {
      const def = built.find(x => DIST[d].match.test(`${x.id || ''} ${x.name || ''}`)); if (!def) { mode = 'mixed'; continue; }
      for (const s of SHOPS[d]) {
        const hit = s.steve && def.blocks.find(b => s.steve.test(b[5] || ''));
        if (hit) { hit[7] = s.key; hit[8] = hit[8] || s.sign; placed.push({ d, key: s.key, local: true, block: hit }); continue; }
        const [x, z, w, dd, h] = s.at, b = [x, z, w, dd, h, s.sign, s.color, s.key, s.sign]; def.blocks.push(b); placed.push({ d, key: s.key, local: true, block: b });
      }
    }
    if (mode === 'district') return mode;
  }
  mode = mode || 'colony';
  const C = COLONIES.Mars; if (!C) return mode;
  for (const d in SHOPS) {
    if (placed.some(p => p.d === d)) continue;
    const [ox, oz] = DIST[d].centre;
    for (const s of SHOPS[d]) { const [x, z, w, dd, h] = s.at, b = [ox + x, oz + z, w, dd, h, s.sign, s.color, s.key, s.sign]; C.blocks.push(b); placed.push({ d, key: s.key, local: false, block: b }); }
  }
  return mode;
}
function patchWorld(world) {
  if (!world || world.__marsShops) return; world.__marsShops = true;
  const lay = world.layout;
  world.layout = function (name, safePoint) {
    if (name === 'Mars') placeBlocks();
    const flats = lay.call(this, name, safePoint) || [];
    if (name === 'Mars' && flats.length) {
      const base = flats[0];
      for (const p of placed) if (!p.local) { const [x, z, w, dd] = p.block, r1 = Math.max(w, dd) / 2 + 6; flats.push({ x: base.x + x, z: base.z + z + 1, r1, r2: r1 + 26, y: base.y }); }
    }
    return flats;
  };
}

// ---------- boot: wait for the app, then wrap game + world ----------
function boot() {
  const s = window.__app?.surface;
  if (!s?.game || !s?.world) return void setTimeout(boot, 250);
  patchGame(s.game); patchWorld(s.world);
}
boot();
window.__marsShops = {
  SHOPS, ITEMS, RUMORS, DIST, FX, placed, get mode() { return mode; },
  interiors: () => Object.keys(INTERIORS).filter(k => k.startsWith('ms_')),
  woozy: () => FX.woozyUntil > performance.now(), buffs: () => FX.buffs.length
};
