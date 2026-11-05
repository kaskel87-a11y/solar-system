// v7.5.33 Helios Heights guest pass (Collin: "bribe a ColSec cop or gate guard to get into Helios Heights"). Pure rules,
// no DOM: unit-tested in tests/test-heliospass-unit.mjs, run by mars/heliospass.js.
// Slip Porter (Helios gate, private security) or a ColSec cop at the gate 350 cr, 1 void honey or 3 glow-dust: you get ONE
// pass = one entry into the gated district + one heist inside it. The pass is used up when you walk/drive back out of
// Helios (no job started), or GRACE_S after the heist ends (success or blown: time to walk out before security escorts you).
// Without a pass the restriction stays exactly as it was (Rags to Riches: Porter turns you away below Helios tier).
export const KEY = 'ssx.heliospass.v1';
export const HELIOS = { centre: [320, 80], r: 62 }; // AJ-relative, same circle as modes/rags-data.json (districts.helios)
export const PRICE_CR = 350;
export const PRODUCT = [{ item: 'voidhoney', qty: 1, name: 'void honey' }, { item: 'glowdust', qty: 3, name: 'glow-dust' }];
export const GRACE_S = 45;
export const OFFER_COOL_S = 20; // rags: the offer pops at most every 20 s at the gate; normal mode checkpoint: 600 s
const n0 = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);

export function fresh() { return { v: 1, pass: null, bought: 0, used: 0, jobs: 0 }; }
export function load(raw) {
  let o; try { o = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { o = null; }
  if (!o || typeof o !== 'object' || o.v !== 1) return fresh();
  const p = o.pass && typeof o.pass === 'object' ? { at: n0(o.pass.at), entered: !!o.pass.entered, job: o.pass.job ? String(o.pass.job) : null, out: n0(o.pass.out), via: String(o.pass.via || 'cash') } : null;
  return { v: 1, pass: p, bought: n0(o.bought), used: n0(o.used), jobs: n0(o.jobs) };
}
export const inHelios = (aj, h = HELIOS) => !!aj && Math.hypot(aj[0] - h.centre[0], aj[1] - h.centre[1]) < h.r;

// what you can pay with right now: [{ kind: 'cash'|'product', cr?, item?, qty?, label }]
export function options(stash, credits, wanted = 0) {
  if (wanted > 0) return [];
  const out = [];
  if (n0(credits) >= PRICE_CR) out.push({ kind: 'cash', cr: PRICE_CR, label: `\u{1F4B5} Slip them ${PRICE_CR} cr` });
  for (const p of PRODUCT) if (n0(stash?.[p.item]) >= p.qty) out.push({ kind: 'product', item: p.item, qty: p.qty, label: `\u{1F381} Slip them ${p.qty} ${p.name}` });
  return out;
}
export const priceLine = () => `${PRICE_CR} cr, ${PRODUCT.map(p => p.qty + ' ' + p.name).join(' or ')}`;

export function buy(s, now, via = 'cash') {
  if (s.pass) return { s, ok: false, why: 'held' };
  return { s: { ...s, pass: { at: now, entered: false, job: null, out: 0, via }, bought: s.bought + 1 }, ok: true };
}
// may you be inside Helios right now? (the gate kick asks this)
export const allow = (s, now) => !!s.pass && !(s.pass.out && now >= s.pass.out);
// every ~0.5 s: { s, ev: null | 'enter' | 'used' }
export function tick(s, here, now, heistActive = false) {
  const p = s.pass; if (!p) return { s, ev: null };
  const inside = inHelios(here);
  if (p.out && now >= p.out) return { s: { ...s, pass: null, used: s.used + 1 }, ev: 'used' };
  if (!p.entered && inside) return { s: { ...s, pass: { ...p, entered: true } }, ev: 'enter' };
  if (p.entered && !inside && !heistActive && !(p.job && !p.out)) return { s: { ...s, pass: null, used: s.used + 1 }, ev: 'used' };
  return { s, ev: null };
}
// a heist that starts inside Helios while the pass is live is the pass's one job
export function jobStart(s, id, here) {
  const p = s.pass; if (!p || p.job || p.out || !inHelios(here)) return { s, ok: false };
  return { s: { ...s, pass: { ...p, entered: true, job: String(id || 'heist') }, jobs: s.jobs + 1 }, ok: true };
}
export function jobEnd(s, id, now) {
  const p = s.pass; if (!p || !p.job || p.out || (id && p.job !== String(id))) return { s, ok: false };
  return { s: { ...s, pass: { ...p, out: now + GRACE_S * 1000 } }, ok: true };
}
export function status(s, now) {
  const p = s.pass; if (!p) return '';
  if (p.out) return `\u{1F3F0} Helios pass: ${Math.max(0, Math.ceil((p.out - now) / 1000))} s to walk out`;
  if (p.job) return '\u{1F3F0} Helios pass: job running';
  return p.entered ? '\u{1F3F0} Helios pass: inside, one heist left' : '\u{1F3F0} Helios pass: one entry + one heist';
}
