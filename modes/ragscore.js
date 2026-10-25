// Rags to Riches pure rules (no DOM, no THREE) so they can be unit-tested in node.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function propDef(data, id) { return data.properties.find(p => p.id === id) || null; }

export function upgradeCost(def, kind, lvl, data) {
  const m = data?.upgrades?.[kind]?.costMult ?? (kind === 'income' ? 0.35 : 0.3);
  return Math.round(def.price * m * (lvl + 1) / 10) * 10;
}
export function incomeRate(def, st) { return def.incomePerMin * (1 + 0.4 * (st.incomeLvl || 0)) / 60; } // credits per second
export function incomeCap(def, st) { return Math.round(def.cap * (1 + 0.5 * (st.incomeLvl || 0))); }
export function accrue(def, st, dt) {
  if (!st?.owned || (st.damaged || 0) > 0) return st.stored || 0;
  st.stored = Math.min(incomeCap(def, st), (st.stored || 0) + incomeRate(def, st) * dt);
  return st.stored;
}
export function propValue(def, st, data) {
  if (!st?.owned) return 0;
  let v = def.price * 0.7;
  for (const k of ['security', 'income']) for (let l = 0; l < (st[k === 'security' ? 'secLvl' : 'incomeLvl'] || 0); l++) v += upgradeCost(def, k, l, data) * 0.5;
  return Math.round(v);
}
export function netWorth(S, data) {
  let nw = Math.max(0, Math.round(S.cash || 0));
  for (const def of data.properties) nw += propValue(def, S.props?.[def.id], data);
  if (S.hasRover) nw += Math.round((data.rover?.price || 0) * 0.5);
  return nw;
}
// tiers are climbed in order: you need every earlier gate too (they're monotonic in the data anyway)
export function tierFor(nw, rep, data) {
  let t = 0;
  for (let i = 1; i < data.tiers.length; i++) { const g = data.tiers[i]; if (nw >= g.netWorth && rep >= g.rep) t = i; else break; }
  return t;
}
export function raidChancePerMin(def, st) { return def.raidPerMin * Math.max(0.25, 1 - 0.22 * (st.secLvl || 0)); }
export function wavePlan(def, st, mobile) {
  const sec = st.secLvl || 0;
  const waves = Math.max(1, def.raidWaves - (sec >= 2 ? 1 : 0));
  const size = clamp(def.raidSize - Math.floor(sec / 2), 2, mobile ? 6 : 9);
  return Array.from({ length: waves }, (_, i) => ({ count: Math.min(mobile ? 6 : 9, size + i) }));
}
export function raidIntegrity(def, st) { return Math.round(def.integrity * (1 + 0.35 * (st.secLvl || 0))); }
// away from the property: the outcome is rolled from security level
export function autoDefendChance(st) { return clamp(0.3 + 0.2 * (st.secLvl || 0), 0, 0.9); }
export function raidLossPenalty(def, st) { return { stored: Math.round((st.stored || 0) * 0.6), downtime: 90 }; }
export function nextGoal(S, data) {
  const nw = netWorth(S, data), t = S.tier || 0;
  if (!data.properties.some(p => S.props?.[p.id]?.owned)) {
    const cheap = data.properties.filter(p => p.tier <= t).sort((a, b) => a.price - b.price)[0];
    return { text: `Buy your first property: ${cheap.name} (${cheap.price} cr).`, need: { credits: cheap.price } };
  }
  const nt = data.tiers[t + 1];
  if (nt) {
    const parts = [];
    if (nw < nt.netWorth) parts.push(`net worth ${nw}/${nt.netWorth}`);
    if ((S.rep || 0) < nt.rep) parts.push(`rep ${S.rep || 0}/${nt.rep}`);
    return { text: `Reach ${nt.name}: ${parts.join(', ') || 'ready'}.`, need: { netWorth: nt.netWorth, rep: nt.rep } };
  }
  const left = data.properties.filter(p => !S.props?.[p.id]?.owned);
  if (left.length) return { text: `Own it all: buy ${left[0].name} (${left[0].price} cr).`, need: { credits: left[0].price } };
  return { text: 'You own the Red Planet. Max out every upgrade and keep the crews off your lawn.', need: null };
}
export function freshState(data) {
  const props = {};
  for (const p of data.properties) props[p.id] = { owned: false, stored: 0, incomeLvl: 0, secLvl: 0, damaged: 0 };
  return { v: 1, active: false, started: 0, cash: data.start.credits, rep: data.start.rep, tier: 0, props, hasRover: false,
    stash: null, stats: { raidsWon: 0, raidsLost: 0, collected: 0, hustles: 0 }, raidClock: 0, pendingSpawn: true };
}
