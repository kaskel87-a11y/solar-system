// Shared screen math for the one mission pointer (v7.5.85). No DOM, no three.js.
// nx, ny are NDC (y up). The point stays outside the middle half of the screen.

export function fmtRange(d) {
  if (!Number.isFinite(d) || d < 0) return '';
  if (d >= 1000) return (d / 1000).toFixed(d >= 10000 ? 0 : 1) + ' km';
  return Math.round(d) + ' m';
}

// The edge chip names the objective and then the distance. A long line used to collapse to "◆ 120 m".
export function chipLabel(label) {
  const raw = String(label || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  const dm = raw.match(/(\d+(?:\.\d+)?\s*(?:m|km))\s*$/i);
  const dist = dm ? dm[1].replace(/\s+/g, ' ') : '';
  let name = dm ? raw.slice(0, dm.index) : raw;
  name = name.replace(/[◆➤]/g, ' ').replace(/\s*\([^)]*\)\s*/g, ' ');
  name = name.replace(/\s+/g, ' ').trim().replace(/[.,;:·\-–—]+$/g, '').trim();
  const stop = name.search(/[.!?]/);
  if (stop >= 8) name = name.slice(0, stop).trim();
  name = name.replace(/^(?:please\s+)?(?:go|walk|drive|head|fly|run|sneak|get)\s+(?:back\s+)?(?:to|into|inside)\s+/i, '');
  name = name.replace(/^(?:follow(?:\s+the\s+arrow)?\s+to\s+)/i, '');
  name = name.replace(/\s+\b(?:at|to|in|on|of|near)(?:\s+the)?$/i, '').trim();
  if (name.length > 28) {
    const parts = name.split(/\b(?:at|to|inside|outside|behind|near|on|of|in)\s+/i);
    let place = '';
    for (let i = 1; i < parts.length; i++) {
      let phrase = parts[i].split(/[,.]/)[0].replace(/\s+and\b.*$/i, '').replace(/\s+before\b.*$/i, '').trim();
      if (/^(?:with|a|an|your|every|each|order)\b/i.test(phrase)) continue;
      phrase = phrase.replace(/^(?:the\s+)(?![A-Z])/i, '');
      if (phrase.length >= 3) place = phrase;
    }
    name = place ? (place.length > 28 ? place.slice(0, 26).trim() + '…' : place) : name.slice(0, 26).trim() + '…';
  }
  if (!/[A-Za-z]/.test(name)) return dist ? '◆ ' + dist : raw.slice(0, 28);
  return dist ? `${name} ${dist}` : name;
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
