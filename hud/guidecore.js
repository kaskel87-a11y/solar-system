// Shared screen math for the one mission pointer (v7.5.85). No DOM, no three.js.
// nx, ny are NDC (y up). The point stays outside the middle half of the screen.

export function fmtRange(d) {
  if (!Number.isFinite(d) || d < 0) return '';
  if (d >= 1000) return (d / 1000).toFixed(d >= 10000 ? 0 : 1) + ' km';
  return Math.round(d) + ' m';
}

export function edgePointer(nx, ny, W, H) {
  let x = Number.isFinite(nx) ? nx : 0, y = Number.isFinite(ny) ? ny : 1;
  const ang = Math.atan2(x, y);
  const ax = Math.abs(x), ay = Math.abs(y);
  if (ax < 0.5 && ay < 0.5) { if (ax >= ay) x = (x < 0 ? -1 : 1) * 0.82; else y = (y < 0 ? -1 : 1) * 0.82; }
  x = Math.max(-0.92, Math.min(0.92, x));
  y = Math.max(-0.7, Math.min(0.9, y));
  let px = (x * 0.5 + 0.5) * W, py = (-y * 0.5 + 0.5) * H;
  const top = 62, bot = Math.min(H - 150, H * 0.78);
  px = Math.max(36, Math.min(W - 36, px));
  py = Math.max(top, Math.min(Math.max(top, bot), py));
  const L = W * 0.25, R = W * 0.75, T = H * 0.25, B = H * 0.75;
  if (px > L && px < R && py > T && py < B) {
    const dl = px - L, dr = R - px, dt = py - T, db = B - py, m = Math.min(dl, dr, dt, db);
    if (m === dl) px = L - 28; else if (m === dr) px = R + 28; else if (m === dt) py = Math.max(top, T - 28); else py = Math.min(Math.max(top, bot), B + 28);
  }
  return { x: px, y: py, ang };
}

// Surface bearing: 0 is straight ahead, positive is to the right. Same yaw math as the ➤ chip.
export function bearingNdc(dx, dz, yaw) {
  const cy = Math.cos(yaw || 0), sy = Math.sin(yaw || 0);
  const sx = dx * cy - dz * sy, sz = dx * sy + dz * cy;
  const ang = Math.atan2(sx, -sz);
  return { nx: Math.sin(ang), ny: Math.cos(ang), ang };
}
