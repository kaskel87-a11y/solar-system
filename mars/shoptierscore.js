// v7.5.45 shop restock tiers: pure data + save logic (no DOM, no three.js), unit-tested in node.
// Collin: "After I buy out a store of stuff, weapons etc, I want it to be replaced with more items. Keeps expanding the weapons and shops."
// Buy out every one-time item a shop sells (its base stock + every tier it has rolled out) and the shop restocks with the next
// tier: new guns/melee (mars/arsenal.js ARS entries, fired through game.fire), new wraps and colours, at higher prices.
// The Red Line Motors lot follows the same idea (dealership.js): buy every model on the lot once and a new wave rolls in.
// Save: localStorage 'ssx.shoptiers.v1' = { v:1, shops: { <shopKey>: tier }, dealer: { wave, bought: [kind...] } } (savecode.js).
// All game fiction: invented guns, invented makers.
export const KEY = 'ssx.shoptiers.v1';

// tiered pools. Item: { id, kind, name, desc, price, ... }
//  kind gun|melee: a = arsenal id, ammo = rounds that come with it; ammo: cal/type/n (consumable); mod: a + mod; bandana|paint: c = COSMETICS id
const GUN_TIERS = [
  { label: 'BACK-ROOM CRATES', items: [
    { id: 'revolver', kind: 'gun', a: 'revolver', ammo: 18, name: 'Gutterking .50 revolver', price: 560, desc: 'Six-shot hand cannon. Heavy rounds, ugly kick, drops people where they stand. Comes with 18 rounds.' },
    { id: 'riothog', kind: 'gun', a: 'riothog', ammo: 24, name: 'Riot Hog drum shotgun', price: 680, desc: 'Semi-auto, 12-shell drum. Lifted off a riot-control crawler. Comes with 24 shells.' },
    { id: 'hatchet', kind: 'melee', a: 'hatchet', name: 'Rust Belt hatchet', price: 340, desc: 'Chipped, heavy, honest. Hits 2.6\u00d7 and knocks them flat.' },
    { id: 'heavy36', kind: 'ammo', cal: 'heavy', type: 'std', n: 36, name: 'Heavy rounds \u00d736', price: 45, desc: 'For the Gutterking, the Longwatch and anything big.' }
  ] },
  { label: 'CARTEL SURPLUS', items: [
    { id: 'needler', kind: 'gun', a: 'needler', ammo: 90, name: 'Needle-Rat flechette SMG', price: 860, desc: 'Spits steel needles that go through the first guy and into the second. Comes with 90 rounds.' },
    { id: 'dustbiter', kind: 'gun', a: 'dustbiter', ammo: 90, name: 'Dustbiter LMG', price: 1150, desc: '90-round belt. Hold the trigger and redecorate. Comes with 90 heavy rounds.' },
    { id: 'gnasher', kind: 'melee', a: 'gnasher', name: 'Gnasher chain-machete', price: 780, desc: 'A machete with a chainsaw where the edge should be. Hits 4.2\u00d7. Messy.' },
    { id: 'hollow36', kind: 'ammo', cal: 'heavy', type: 'hollow', n: 36, name: 'Hollow-point heavies \u00d736', price: 85, desc: 'Opens up on impact. Bad news for anything without armour.' }
  ] },
  { label: 'MILITARY BLACK BOX', items: [
    { id: 'thumper', kind: 'gun', a: 'thumper', ammo: 6, name: 'Thumper drum launcher', price: 1600, desc: 'Six-round revolving grenade drum. 5.5 m blast. Feeds on frag grenades. Comes with 6.' },
    { id: 'widowmaker', kind: 'gun', a: 'widowmaker', ammo: 8, name: 'Widowmaker gauss rifle', price: 2100, desc: 'Charge, release, punch a hole through a whole squad. Takes coil slugs. Comes with 8.' },
    { id: 'widowscope', kind: 'mod', a: 'widowmaker', mod: 'scope', name: 'Widowmaker optic', price: 320, desc: 'Fits the Widowmaker. Right mouse / 🔭 to zoom.' },
    { id: 'frags6', kind: 'ammo', cal: 'frag', type: 'std', n: 6, name: 'Frag grenades \u00d76', price: 90, desc: 'For the Thumper and the frag launcher.' },
    { id: 'slugs6', kind: 'ammo', cal: 'rail', type: 'slug', n: 6, name: 'Coil slugs \u00d76', price: 80, desc: 'Gauss and coil-lance food.' }
  ] },
  { label: 'COLLECTOR\u2019S VAULT', items: [
    { id: 'kingpin', kind: 'gun', a: 'kingpin', ammo: 24, name: 'Gilded Gutterking', price: 3200, desc: 'Gold-plated .50 with a pearl grip. Hits harder than the original and everyone knows you\u2019re rich. 24 rounds.' },
    { id: 'hellhound', kind: 'gun', a: 'hellhound', ammo: 32, name: 'Hellhound slug-thrower', price: 2800, desc: 'Ten-pellet scattergun that throws red-hot slugs. Comes with 32 shells.' },
    { id: 'skullsplitter', kind: 'melee', a: 'skullsplitter', name: 'Skullsplitter warhammer', price: 2400, desc: 'Two-handed sledge with a spike. Hits 5.5\u00d7 and sends them flying.' },
    { id: 'ap36', kind: 'ammo', cal: 'heavy', type: 'ap', n: 36, name: 'AP heavies \u00d736', price: 120, desc: 'Armour-piercing. ColSec hates these.' }
  ] }
];
// new colours (added to COSMETICS by shoptiers.js; no `shop` price so the old counters don't list them)
export const NEW_COS = {
  bandana: { bloodrag: ['Dried Blood rag', 0x5a0a0a], toxicslime: ['Toxic Slime', 0x7aff20], oilslick: ['Oil Slick', 0x1a2a3a], neonhex: ['Neon Hex', 0xff2a8a], carbonweave: ['Carbon Weave', 0x222428], dustdevil: ['Dust Devil', 0xb08050] },
  paint: { rustbucket: ['Rust Bucket', 0x6a3a1a], bilegreen: ['Bile Green', 0x5a6a1a], matteblood: ['Matte Blood', 0x4a0808], hazmat: ['Hazmat Yellow', 0xd0e020],
    scorched: ['Scorched', 0x2a1a10], warpaint: ['War Paint Red', 0x8a1010], sandstorm: ['Sandstorm', 0xc8a060], midnightchrome: ['Midnight Chrome', 0x2a3040], radioactive: ['Radioactive', 0x40ff40], bonewhite: ['Bone White', 0xe8e0c8] }
};
const CLOTHES_TIERS = [
  { label: 'FRESH OFF THE CRAWLER', items: [
    { id: 'bloodrag', kind: 'bandana', c: 'bloodrag', name: 'Dried Blood rag', price: 90 }, { id: 'toxicslime', kind: 'bandana', c: 'toxicslime', name: 'Toxic Slime bandana', price: 90 },
    { id: 'oilslick', kind: 'bandana', c: 'oilslick', name: 'Oil Slick bandana', price: 110 }, { id: 'rustbucket', kind: 'paint', c: 'rustbucket', name: 'Rover wrap: Rust Bucket', price: 140 },
    { id: 'bilegreen', kind: 'paint', c: 'bilegreen', name: 'Rover wrap: Bile Green', price: 140 }] },
  { label: 'STOLEN DESIGNER', items: [
    { id: 'neonhex', kind: 'bandana', c: 'neonhex', name: 'Neon Hex bandana', price: 180 }, { id: 'carbonweave', kind: 'bandana', c: 'carbonweave', name: 'Carbon Weave bandana', price: 200 },
    { id: 'dustdevil', kind: 'bandana', c: 'dustdevil', name: 'Dust Devil bandana', price: 160 }, { id: 'matteblood', kind: 'paint', c: 'matteblood', name: 'Rover wrap: Matte Blood', price: 260 },
    { id: 'hazmat', kind: 'paint', c: 'hazmat', name: 'Rover wrap: Hazmat Yellow', price: 260 }] }
];
const DEPOT_TIERS = [
  { label: 'SALVAGE PAINT', items: [
    { id: 'scorched', kind: 'paint', c: 'scorched', name: 'Rover paint: Scorched', price: 180 }, { id: 'warpaint', kind: 'paint', c: 'warpaint', name: 'Rover paint: War Paint Red', price: 180 },
    { id: 'sandstorm', kind: 'paint', c: 'sandstorm', name: 'Rover paint: Sandstorm', price: 180 }] },
  { label: 'CUSTOM SHOP', items: [
    { id: 'midnightchrome', kind: 'paint', c: 'midnightchrome', name: 'Rover paint: Midnight Chrome', price: 320 }, { id: 'radioactive', kind: 'paint', c: 'radioactive', name: 'Rover paint: Radioactive', price: 300 },
    { id: 'bonewhite', kind: 'paint', c: 'bonewhite', name: 'Rover paint: Bone White', price: 300 }] }
];
// shops that restock. base: which kinds of their own stock count toward a buy-out. mult: district price scale.
export const TIER_SHOPS = {
  guns: { name: 'Ozzie\u2019s Iron', tiers: GUN_TIERS, mult: 1, base: ['weapon', 'melee'] },
  ms_guns_rtf: { name: 'Scrap & Slug', tiers: GUN_TIERS, mult: 0.85, base: ['weapon', 'melee'] },
  ms_guns_oly: { name: 'Meridian Arms', tiers: GUN_TIERS, mult: 1, base: ['weapon', 'melee'] },
  ms_guns_hel: { name: 'Aurum Armory', tiers: GUN_TIERS, mult: 1.25, base: ['weapon', 'melee'] },
  ms_clothes_rtf: { name: 'Thrift Lock', tiers: CLOTHES_TIERS, mult: 0.8, base: ['bandana', 'paint'] },
  ms_clothes_oly: { name: 'Threadline', tiers: CLOTHES_TIERS, mult: 1, base: ['bandana', 'paint'] },
  ms_clothes_hel: { name: 'Helios Atelier', tiers: CLOTHES_TIERS, mult: 1.6, base: ['bandana', 'paint'] },
  depot: { name: 'Meridian Depot', tiers: DEPOT_TIERS, mult: 1, base: ['roverup', 'roverwpn', 'upgrade', 'paint', 'kit'] }
};
export const ONE_TIME = new Set(['gun', 'melee', 'mod', 'bandana', 'paint']);
export const maxTier = key => 1 + (TIER_SHOPS[key]?.tiers.length || 0); // tier 1 = the shop's original stock
export const priceOf = (key, it) => Math.round(it.price * (TIER_SHOPS[key]?.mult || 1) / 5) * 5;
// every tier item the shop has rolled out so far (tier 2..t), newest last
export function unlockedItems(key, tier) { const T = TIER_SHOPS[key]; if (!T) return []; const out = []; for (let i = 0; i < Math.min(tier - 1, T.tiers.length); i++) for (const it of T.tiers[i].items) out.push({ ...it, tier: i + 2, price: priceOf(key, it) }); return out; }
export function tierItems(key, tier) { const T = TIER_SHOPS[key]?.tiers[tier - 2]; return T ? T.items.map(it => ({ ...it, tier, price: priceOf(key, it) })) : []; }
export const tierLabel = (key, tier) => tier <= 1 ? 'ORIGINAL STOCK' : TIER_SHOPS[key]?.tiers[tier - 2]?.label || '';
// next tier once base stock + every unlocked tier's one-time items are owned. ownedBase: bool, ownedTier: item -> bool
export function nextTier(key, tier, ownedBase, ownedTier) {
  if (!TIER_SHOPS[key] || tier >= maxTier(key) || !ownedBase) return tier;
  const all = unlockedItems(key, tier).filter(it => ONE_TIME.has(it.kind));
  return all.every(ownedTier) ? tier + 1 : tier;
}

// ---------- Red Line Motors restock waves ----------
export const DEALER_WAVES = [
  { label: 'THE LOT', kinds: null }, // wave 1: everything not listed below
  { label: 'WAR RIGS', kinds: ['regolith_reaper', 'ghost_sled'] }
];
export const dealerHidden = wave => DEALER_WAVES.slice(Math.max(1, wave)).flatMap(w => w.kinds || []);
// next wave when every model on the lot has been bought at least once
export function dealerNext(wave, lotKinds, bought) { return wave < DEALER_WAVES.length && lotKinds.length && lotKinds.every(k => bought.includes(k)) ? wave + 1 : wave; }

// ---------- state ----------
export const fresh = () => ({ v: 1, shops: {}, dealer: { wave: 1, bought: [] } });
export function parse(raw) {
  let s = null; try { s = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { s = null; }
  const f = fresh(); if (!s || s.v !== 1) return f;
  for (const [k, t] of Object.entries(s.shops || {})) if (TIER_SHOPS[k] && Number.isFinite(t)) f.shops[k] = Math.max(1, Math.min(maxTier(k), t | 0));
  const d = s.dealer || {}; f.dealer.wave = Math.max(1, Math.min(DEALER_WAVES.length, (d.wave | 0) || 1)); f.dealer.bought = Array.isArray(d.bought) ? d.bought.filter(x => typeof x === 'string').slice(0, 64) : [];
  return f;
}
export function load() { try { return parse(localStorage.getItem(KEY)); } catch (e) { return fresh(); } }
export function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ } }
// one live state object per page, shared by mars/shoptiers.js (shops) and dealership.js (dealer waves) so neither clobbers the other
let live = null;
export const shared = () => live || (live = load());
export const reloadShared = () => (live = load());
