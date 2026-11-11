// Duck Blind (v7.5.86). Pure rules: no DOM, no three.js. An original marsh shoot on Earth.
// Ten ducks a round, three shots each. A duck that is not hit flies off. Later rounds are faster.

export const SAVE_KEY = 'ssx.duckblind.v1';
export const NAME = 'Duck Blind';
export const DUCKS = 10;
export const SHOTS = 3;
export const PAY_CR = 20;
export const PAY_STARS = 5;
export const NEAR = 8;
// Compass from Earth's landing pad: east-southeast, clear of the fox, the redwood and the picnic.
export const AT = { a: 115, d: 78 };

export function flightMs(round) {
  const r = Math.max(1, round | 0);
  return Math.max(900, Math.round(2600 / (1 + (r - 1) * 0.35)));
}
export function spawnDuck(round, rng = Math.random) {
  return {
    from: rng() < 0.5 ? 'left' : 'right',
    lane: 0.16 + rng() * 0.42,
    amp: 0.06 + rng() * 0.1,
    phase: rng() * Math.PI * 2,
    shots: SHOTS,
    t: 0
  };
}
// t is 0..1 along the flight. x,y are fractions of the sky (y from the top).
export function duckPoint(duck, t) {
  const u = Math.max(0, Math.min(1, t));
  const x = duck.from === 'left' ? u : 1 - u;
  const y = duck.lane + Math.sin(u * Math.PI * 1.5 + (duck.phase || 0)) * (duck.amp || 0);
  return { x, y: Math.max(0.1, Math.min(0.62, y)) };
}
export function scoreOf(hits) { return Math.max(0, hits | 0) * 100; }
export function payOf(hits, finished) {
  const h = Math.max(0, Math.min(DUCKS, hits | 0));
  return { cr: h * PAY_CR, stars: finished && h >= DUCKS ? PAY_STARS : 0, perfect: finished && h >= DUCKS };
}
export function loadState(raw) {
  let o = null; try { o = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { o = null; }
  o = o && typeof o === 'object' ? o : {};
  const n = (v) => Number.isFinite(+v) ? +v : 0;
  return { v: 1, best: n(o.best), rounds: n(o.rounds), hits: n(o.hits), earned: n(o.earned) };
}
