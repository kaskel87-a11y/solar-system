// Back-room deals (v7.5.110). Pure: no DOM. Invented street goods only.
// Supply is packed from the existing fictional stash (farm Glow-dust and the dealers' stock).
export const HEAT_MAX = 100;
export const HAND_AT = 70;
export const HEAT_PER_S = 7;
export const GLANCE = 14;
export const FINE = 250;
export const REACH = 5;

export const GOODS = {
  glowcap: { id: 'glowcap', name: 'Glowcap', icon: '🟢', from: 'glowdust', fromName: 'Glow-dust', need: 1, effect: 'night', secs: 22, crash: 10, blurb: 'The dark turns green. Then the lights burn.' },
  redhaze: { id: 'redhaze', name: 'Red Haze', icon: '🔴', from: 'redstatic', fromName: 'Red Static', need: 1, effect: 'slowaim', secs: 18, crash: 10, blurb: 'Aim goes slow and sure. Then your hands drag.' },
  iondust: { id: 'iondust', name: 'Ion Dust', icon: '⚡', from: 'lowg', fromName: 'Low-G', need: 1, effect: 'rush', secs: 16, crash: 10, blurb: 'You move fast and the picture shakes. Then you stall.' },
  slowtime: { id: 'slowtime', name: 'Slowtime', icon: '🟣', from: 'voidhoney', fromName: 'Void Honey', need: 1, effect: 'strong', secs: 16, crash: 10, blurb: 'Hits land harder and the controls smear. Then you are weak.' }
};
export const GOOD_IDS = Object.keys(GOODS);

export const PRICES = {
  low: { pay: 80, heat: 6, label: 'Low' },
  fair: { pay: 140, heat: 16, label: 'Fair' },
  greedy: { pay: 220, heat: 40, label: 'Greedy' }
};

export const VELVET = { id: 'velvet', name: 'Velvet Airlock', booth: { x: 2.4, z: 11.2 } };
export const THIN = { id: 'thin', name: 'The Thin Air' };

export function fresh() { return { v: 1, pack: {}, deal: null, fx: null, seen: false }; }
export function load(raw) {
  let o = raw;
  if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) { o = null; } }
  const f = fresh();
  if (!o || o.v !== 1) return f;
  f.pack = o.pack && typeof o.pack === 'object' ? o.pack : {};
  f.deal = o.deal && o.deal.good ? o.deal : null;
  f.fx = o.fx && o.fx.kind ? o.fx : null;
  f.seen = !!o.seen;
  return f;
}

export function qty(pack, id) { return Math.max(0, pack[id] | 0); }
export function holding(pack) { return GOOD_IDS.reduce((n, id) => n + qty(pack, id), 0); }

export function packOne(pack, id, have) {
  const g = GOODS[id];
  if (!g) return { ok: false, why: 'bad' };
  if ((have | 0) < g.need) return { ok: false, why: 'short', text: `Need ${g.need} ${g.fromName}. The farm dries ghost lichen into Glow-dust. Dealers sell the rest.` };
  return { ok: true, take: g.need, from: g.from, pack: { ...pack, [id]: qty(pack, id) + 1 }, text: `Packed 1 ${g.name}.` };
}

export function startDeal(good) {
  const g = GOODS[good];
  if (!g) return null;
  return { good, price: null, pay: 0, heat: 0, step: 'price' };
}

export function pickPrice(deal, which) {
  const p = PRICES[which];
  if (!deal || !p) return deal;
  const heat = Math.min(HEAT_MAX, deal.heat + p.heat);
  return { ...deal, price: which, pay: p.pay, heat, step: heat >= HEAT_MAX ? 'busted' : 'handoff' };
}

export function tickDeal(deal, dt, inSight) {
  if (!deal || deal.step !== 'handoff') return deal;
  const add = Math.max(0, dt) * HEAT_PER_S * (inSight ? 1.8 : 1);
  const heat = Math.min(HEAT_MAX, deal.heat + add);
  return { ...deal, heat, step: heat >= HEAT_MAX ? 'busted' : 'handoff' };
}

export function glance(deal) {
  if (!deal || deal.step !== 'handoff') return deal;
  return { ...deal, heat: Math.max(0, deal.heat - GLANCE) };
}

export function handoff(deal) {
  if (!deal || deal.step !== 'handoff') return { ...deal, ok: false, why: 'step' };
  if (deal.heat >= HAND_AT) return { ...deal, ok: false, why: 'hot', text: 'Too many eyes. Glance away, then hand it off.' };
  return { ...deal, ok: true, step: 'done', text: `Paid ${deal.pay} cr.` };
}

export function bustKind(roll) {
  const r = Math.max(0, Math.min(0.999, +roll || 0));
  return r < 0.34 ? 'stash' : r < 0.67 ? 'fine' : 'fight';
}
export function bust(deal, roll = 0) {
  const kind = bustKind(roll);
  const text = kind === 'fine' ? `Spotted. The stash is gone and the fine is ${FINE} cr.` : kind === 'fight' ? 'Spotted. The bouncer swings. The stash is gone.' : 'Spotted. They take the stash.';
  return { ...deal, ok: false, step: 'busted', bust: kind, fine: kind === 'fine' ? FINE : 0, text };
}

export function useGood(good, now) {
  const g = GOODS[good];
  if (!g) return null;
  return { id: g.id, name: g.name, kind: g.effect, until: now + g.secs, crashUntil: now + g.secs + g.crash };
}
export function fxAt(fx, now) {
  if (!fx) return null;
  if (now >= fx.crashUntil) return null;
  if (now >= fx.until) return { ...fx, phase: 'crash', left: Math.max(0, fx.crashUntil - now) };
  return { ...fx, phase: 'on', left: Math.max(0, fx.until - now) };
}

export function lesson(pack, where) {
  if (!holding(pack)) return { id: 'pack', text: 'Pack a street good. Glow-dust from the farm becomes Glowcap. Dealers sell the rest.', x: where.x, z: where.z };
  return { id: 'booth', text: `A buyer is signalling at the ${where.name} back booth. Walk over.`, x: where.x, z: where.z };
}
export function stepText(deal) {
  if (!deal) return null;
  if (deal.step === 'price') return 'Pick a price. Low is quiet. Greedy draws eyes.';
  if (deal.step === 'handoff') return 'Hand it off before the suspicion bar fills. Glance away if it climbs.';
  if (deal.step === 'done') return deal.text || 'Paid.';
  if (deal.step === 'busted') return deal.text || 'Spotted.';
  return null;
}
