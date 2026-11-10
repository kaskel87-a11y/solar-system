// v7.5.26 Velvet Airlock side deals: pure rules + data (no DOM, no THREE). Runtime: mars/velvetdeal.js and privateshow.js.
// 1) Pay Danny's private show / lap dance in product (or product + credits) instead of credits.
// 2) Ines's side deal: she buys product off you "off the floor" (no street risk) and runs a 3-job repeatable errand chain.
// Fiction only, M-rated: invented drugs, invented people, crooked colony. Adults only; the show itself is unchanged.
// tests/test-velvetdeal-unit.mjs

export const KEY = 'ssx.velvetdeal.v1';
export const NPC = 'ines';                     // barter.json's Ines (slug of "Ines"): her existing 🤝 beacon at the Velvet Airlock
export const DISTRICT = 'red-tape-flats';      // the district barter.json files her under
export const AT = [-30, -36];                  // AJ-relative, same as barter.json

// ---------- 1) Danny takes product ----------
// Credit prices live in privateshow.js (SHOW_PRICE = LAP_PRICE = 500). Baskets track Flats street value
// (glow-dust ~71, red static ~128, low-g ~45, void honey ~270): 7×71=497, 4×128=512, 11×45=495, 2×270=540.
// Same basket for both modes. Split is 3 glow-dust (~213) + 285 cr ≈ 498.
export const PRODUCT_ORDER = ['glowdust', 'redstatic', 'lowg', 'voidhoney'];
export const DANNY_PRODUCT = {
  show: { glowdust: 7, redstatic: 4, lowg: 11, voidhoney: 2 },
  lap: { glowdust: 7, redstatic: 4, lowg: 11, voidhoney: 2 },
};
export const SPLIT = { show: { item: 'glowdust', qty: 3, cr: 285 }, lap: { item: 'glowdust', qty: 3, cr: 285 } }; // product + cash
export const ICON = { glowdust: '🔵', redstatic: '⚡', lowg: '🎈', voidhoney: '🍯' };
export const NAME = { glowdust: 'Glow-dust', redstatic: 'Red Static', lowg: 'Low-G', voidhoney: 'Void Honey' };

// stash: { [item]: qty }   credits: number   comps: number of free shows Ines has comped you
// -> [{ kind:'product'|'split'|'comp', item?, qty?, cr, label }] (only the ones you can pay right now; best first)
export function payOptions(mode, stash = {}, credits = 0, comps = 0) {
  const m = DANNY_PRODUCT[mode] ? mode : 'show', out = [], have = id => Math.max(0, Math.floor(+stash?.[id] || 0));
  const title = m === 'lap' ? 'Lap dance' : 'Private dance';
  if (comps > 0) out.push({ kind: 'comp', cr: 0, label: title + ' · on Ines' });
  const p = PRODUCT_ORDER.find(id => have(id) >= DANNY_PRODUCT[m][id]);
  if (p) out.push({ kind: 'product', item: p, qty: DANNY_PRODUCT[m][p], cr: 0, label: `${title} · ${DANNY_PRODUCT[m][p]} ${ICON[p]} ${NAME[p]}` });
  const s = SPLIT[m]; if (have(s.item) >= s.qty && credits >= s.cr && p !== s.item) out.push({ kind: 'split', item: s.item, qty: s.qty, cr: s.cr, label: `${title} · ${s.qty} ${ICON[s.item]} + ${s.cr} cr` });
  return out;
}
// one line for the offer card when you hold nothing she takes
export function priceHint() {
  const f = m => PRODUCT_ORDER.map(id => `${DANNY_PRODUCT[m][id]} ${ICON[id]}`).join(' / ');
  return `She takes product too: show ${f('show')} · lap ${f('lap')}`;
}

// ---------- 2a) Ines buys product off the floor ----------
// Flat rates: better than the Flats corners, a touch under a good Olympus Row corner, but zero bust risk and no
// saturation. Cooldown per lot so it can't replace dealing.
export const BUYOUT = [
  { id: 'ines-side-buy-dust', item: 'glowdust', qty: 3, credits: 330, cooldownSec: 480 },
  { id: 'ines-side-buy-static', item: 'redstatic', qty: 2, credits: 380, cooldownSec: 480 },
  { id: 'ines-side-buy-lowg', item: 'lowg', qty: 4, credits: 220, cooldownSec: 480 },
  { id: 'ines-side-buy-honey', item: 'voidhoney', qty: 1, credits: 400, cooldownSec: 600 },
];
export const BUY_REP = 2; // velvet rep per lot
// v7.5.27 Ines buys bottles too (Collin: Nova was "stocked up for today" with 9 potato moonshine on him). Every kind,
// no daily cap, SHINE.mult x what the Xen-7 aliens pay (Nova pays BAR.mult 1.3x but only BAR.dailyCap a day).
export const SHINE = { mult: 1.2, rep: 1, repMax: 4 }; // +1 Velvet rep per sale of 5+ bottles, up to +4
// inv: [{ id, name, icon, qty }] (bar.js normInventory shape); base(it) -> alien cr a bottle
export function shineQuote(inv, base, mult = SHINE.mult) {
  const rows = []; let n = 0, total = 0;
  for (const it of Array.isArray(inv) ? inv : []) { const q = Math.floor(+it?.qty || 0); if (!(q > 0)) continue; const b = +base?.(it) || 0; if (!(b > 0)) continue;
    const each = Math.round(b * mult); rows.push({ id: it.id, name: it.name || it.id, icon: it.icon || '\u{1F37E}', qty: q, each, total: each * q }); n += q; total += each * q; }
  return { n, total, rows };
}
export const shineRep = n => n >= 5 ? Math.min(SHINE.repMax, Math.max(SHINE.rep, Math.floor(n / 5))) : 0;
export function shineLabel(q) { return q && q.n ? `Bottles: all ${q.n} you carry \u2192 ${q.total} cr (${SHINE.mult}\u00d7 alien, no cap)` : `Bottles: she buys every kind, ${SHINE.mult}\u00d7 alien price, no daily cap`; }

// ---------- 2b) Ines's errands: a 3-job chain that loops ----------
// Steps use only the core mission engine's step types (goto / defeat / take / clean). Ids start with 'ines-' so
// mars/rep.js pays +8 Velvet rep per job by itself. reward.credits is the first-run pay; repeats are topped up to the
// same figure by velvetdeal.js (the core only pays 25% on repeats). Finishing job 3 comps you a free show with Danny.
export const JOBS = [
  { id: 'ines-side-case', title: 'Off the Books', credits: 200, xp: 60,
    intro: 'Ines: Tiny left a case by the back door. Don\u2019t open it, don\u2019t drop it, don\u2019t let a badge see it. My guy on Olympus Row is waiting.',
    success: 'Ines: He says it arrived dry. Good. You\u2019re useful.',
    steps: [{ type: 'goto', at: [-30, -54], r: 3, item: 'contraband', text: 'Follow the beam behind the Velvet and grab her case' },
      { type: 'goto', at: [12, -410], r: 8, wanted: 1, text: 'Carry the case to the beam on Olympus Row' }] },
  { id: 'ines-side-debt', title: 'Bar Tab', credits: 275, xp: 80,
    intro: 'Ines: Corwin Pell drank eleven hundred credits of my whiskey and moved up to Helios Heights. Go remind him. His bodyguards are cheap, so don\u2019t be.',
    success: 'Ines: Eleven hundred and change. Tell Tiny he owes you a drink. Just one.',
    steps: [{ type: 'goto', at: [300, 72], r: 8, text: 'Follow the beam to Corwin Pell in Helios Heights' },
      { type: 'defeat', at: [300, 72], wave: ['goon', 'goon'], text: 'Fight his two bodyguards. The beam is the spot' },
      { type: 'goto', at: [306, 80], r: 3, item: 'contraband', text: 'Follow the beam and pick up the bag by the gate' },
      { type: 'goto', at: [-30, -22], r: 5, text: 'Follow the beam back to the Velvet with her money' }] },
  { id: 'ines-side-deputy', title: 'Last Call', credits: 350, xp: 100,
    intro: 'Ines: A ColSec deputy drinks free in my club and writes my bouncers up for fun. Take his ride, lose it in the canyon, lose his friends. Nobody saw you.',
    success: 'Ines: He walked home. In the dust. In his good shoes. Danny\u2019s next song is on the house.',
    steps: [{ type: 'take', text: 'Steal a street car. The beam marks the nearest. Not your rover' },
      { type: 'goto', a: 120, d: 300, r: 12, vehicle: 'stolen', text: 'Drive that stolen car to the canyon beam' },
      { type: 'clean', text: 'Hide until the wanted stars fade' }] },
];
export const CHAIN_COMP = 1;                   // free Danny show after job 3
export function missionDef(j) {
  return { id: j.id, world: 'Mars', contact: 'Ines', title: j.title, fiction: true, intro: j.intro, success: j.success,
    requires: ['ines-01-door'], // only for talk(): the 🤝 panel starts them straight away
    steps: j.steps.map(s => ({ ...s })), reward: { xp: j.xp, credits: j.credits } };
}

// ---------- state ----------
export function fresh() { return { v: 1, next: 0, runs: 0, chains: 0, comps: 0, usedComps: 0, paid: 0, bought: 0, productShows: 0, bottles: 0, bottleCr: 0 }; }
export function loadState(raw) {
  let o = raw; if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch (e) { o = null; } }
  const s = fresh(); if (!o || typeof o !== 'object' || o.v !== 1) return s;
  for (const k of Object.keys(s)) if (k !== 'v') { const n = Math.floor(+o[k]); s[k] = Number.isFinite(n) && n >= 0 ? n : 0; }
  s.next %= JOBS.length; return s;
}
export const nextJob = s => JOBS[(s?.next || 0) % JOBS.length];
export const jobIndex = id => JOBS.findIndex(j => j.id === id);
// a job finished: advance the chain; returns { s, comp } (comp = true when the loop closed)
export function finishJob(s, id) {
  const i = jobIndex(id), t = { ...s }; if (i < 0) return { s: t, comp: false };
  t.runs++; t.next = (i + 1) % JOBS.length; const comp = i === JOBS.length - 1;
  if (comp) { t.chains++; t.comps += CHAIN_COMP; }
  return { s: t, comp };
}
// repeat runs: the core paid paidNow; top up to the full (boosted) figure
export const topUp = (full, paidNow) => Math.max(0, Math.round((+full || 0) - (+paidNow || 0)));
export const useComp = s => (s.comps > 0 ? { ...s, comps: s.comps - 1, usedComps: s.usedComps + 1 } : null);
