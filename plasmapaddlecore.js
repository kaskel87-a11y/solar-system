// Plasma Paddle. Pure step. A plasma blob and two energy scoops. Not a dotted-line table.
export const KEY = 'ssx.plasmapaddle.v1';
export const WIN = 5;
export const STAKES = [0, 50, 100, 250];
export const AT = { x: -8, z: 11 };
export const fresh = () => ({ v: 1, played: 0, won: 0, lost: 0, net: 0 });
export function load(raw) {
  try { const o = JSON.parse(raw || ''); if (o && o.v === 1) return { ...fresh(), played: o.played | 0, won: o.won | 0, lost: o.lost | 0, net: o.net | 0 }; } catch (e) { /* new */ }
  return fresh();
}
export function serve(side = 1) {
  return { x: 50, y: 50, vx: 38 * side, vy: 18 };
}
export function step(s, dt, meY) {
  const ball = s.ball;
  s.me += (meY - s.me) * Math.min(1, dt * 10);
  const aim = ball.y - s.foe;
  s.foe += Math.max(-46, Math.min(46, aim * 3.2)) * dt;
  s.me = Math.max(12, Math.min(88, s.me));
  s.foe = Math.max(12, Math.min(88, s.foe));
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  if (ball.y < 6 || ball.y > 94) { ball.vy *= -1; ball.y = Math.max(6, Math.min(94, ball.y)); }
  const hit = (px, py) => Math.abs(ball.x - px) < 4 && Math.abs(ball.y - py) < 12;
  if (ball.vx < 0 && hit(10, s.me)) { ball.vx = Math.abs(ball.vx) + 2; ball.vy += (ball.y - s.me) * 1.4; ball.x = 14; }
  if (ball.vx > 0 && hit(90, s.foe)) { ball.vx = -Math.abs(ball.vx) - 1.2; ball.vy += (ball.y - s.foe) * 0.8; ball.x = 86; }
  let score = 0;
  if (ball.x < 0) { s.them++; score = -1; ball.x = 50; ball.y = 50; ball.vx = 38; ball.vy = (Math.random() - 0.5) * 30; }
  else if (ball.x > 100) { s.you++; score = 1; ball.x = 50; ball.y = 50; ball.vx = -38; ball.vy = (Math.random() - 0.5) * 30; }
  const over = s.you >= WIN || s.them >= WIN;
  return { score, over, youWin: s.you >= WIN };
}
