// Chicken Shit Bingo. Pure rules. Sixteen numbered squares, one pays, the rest lose.
// Fiction only: a club bird and credits. No real gambling.
export const KEY = 'ssx.chickenbingo.v1';
export const COLS = 4;
export const ROWS = 4;
export const STAKES = [250, 500, 1000];
export const PAY = 10;
export const ROUND_S = 16;
export const PIT = { x: 6, z: 10 };
export const NPCS = [
  { id: 'nix', name: 'Nix' },
  { id: 'bex', name: 'Bex' },
  { id: 'harlo', name: 'Harlo' }
];
export const EXTRA = [
  { id: 'juno', name: 'Juno' },
  { id: 'peck', name: 'Peck' }
];

export const squares = () => Array.from({ length: COLS * ROWS }, (_, i) => String(i + 1));
export const fresh = () => ({ v: 1, played: 0, won: 0, lost: 0, net: 0 });
export function load(raw) {
  try { const o = JSON.parse(raw || ''); if (o && o.v === 1) return { ...fresh(), played: o.played | 0, won: o.won | 0, lost: o.lost | 0, net: o.net | 0 }; } catch (e) { /* new */ }
  return fresh();
}
export function npcBets(rng = Math.random, extra = 0) {
  const all = squares();
  const crew = NPCS.concat(EXTRA.slice(0, Math.max(0, extra | 0)));
  return crew.map(n => ({ id: n.id, name: n.name, square: all[Math.floor(rng() * all.length)], stake: STAKES[Math.floor(rng() * STAKES.length)] }));
}
export function path(rng, steps, end) {
  const all = squares(), out = [];
  for (let i = 0; i < Math.max(1, steps) - 1; i++) out.push(all[Math.floor(rng() * all.length)]);
  out.push(end);
  return out;
}
export function settle(square, player, npcs) {
  const hit = !!(player && player.square === square);
  const stake = player?.stake | 0;
  const pay = hit ? stake * PAY : 0;
  const reactions = (npcs || []).map(n => {
    const win = n.square === square;
    const line = win ? `${n.name}: ${square}! Pay me, you cheap bastards.` : `${n.name}: Shit. Not ${n.square}.`;
    return { id: n.id, name: n.name, square: n.square, stake: n.stake, win, line };
  });
  return { square, hit, stake, pay, lost: hit ? 0 : stake, reactions };
}
export function cellAt(id) {
  const n = +id;
  if (!Number.isInteger(n) || n < 1 || n > COLS * ROWS) return null;
  const i = n - 1;
  return { c: i % COLS, r: Math.floor(i / COLS) };
}
