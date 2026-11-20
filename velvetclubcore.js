// Velvet Airlock club level. Pure numbers. Games and wagers raise XP. Levels open perks.
export const KEY = 'ssx.velvetclub.v1';
export const PRICE = 50000;
export const STEPS = [0, 80, 220, 480, 900];
export const BASE_BINGO = [250, 500, 1000];
export const BASE_PADDLE = [0, 50, 100, 250];

export const fresh = () => ({ v: 1, xp: 0, games: 0, bingo: false, paddle: false });

export function load(raw) {
  try {
    const o = JSON.parse(raw || '');
    if (o && o.v === 1) return { ...fresh(), xp: Math.max(0, o.xp | 0), games: Math.max(0, o.games | 0), bingo: !!o.bingo, paddle: !!o.paddle };
  } catch (e) { /* new */ }
  return fresh();
}

export function level(xp) {
  let lv = 1;
  for (let i = 1; i < STEPS.length; i++) if ((xp | 0) >= STEPS[i]) lv = i + 1;
  return lv;
}

export function gain(wager) { return 15 + Math.floor(Math.max(0, wager | 0) / 20); }

export function perk(lv) {
  const n = Math.max(1, lv | 0);
  return {
    level: n,
    bingoStakes: n >= 2 ? BASE_BINGO.concat(2500) : BASE_BINGO.slice(),
    paddleStakes: n >= 2 ? BASE_PADDLE.concat(500) : BASE_PADDLE.slice(),
    extraNpc: n >= 3 ? 2 : 0,
    skin: n >= 4 ? 'heat' : 'stock',
    vipBooth: n >= 5
  };
}

export function perkLine(lv) {
  return ['', 'Bigger bets open at level 2.', 'Two more bettors join the grid.', 'The cabinet gets a new skin.', 'The VIP booth opens.'][Math.max(0, (lv | 0) - 1)] || 'The VIP booth is open.';
}

export function short(xp) { return `Velvet level ${level(xp)} · ${xp | 0} XP`; }
export function line(xp) {
  const lv = level(xp);
  const next = STEPS[lv];
  const tail = next == null ? 'VIP booth is open.' : `${next - (xp | 0)} XP to level ${lv + 1}.`;
  return `${short(xp)}. ${tail}`;
}
