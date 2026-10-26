// Grime pass: procedural canvas textures (self-made, CC0). Everything is painted at runtime on small canvases, so the
// pass ships zero image files and texture memory stays tiny: atlases are 512 px on phones, 1024 px on desktop.
// Pure-ish: needs a DOM canvas + THREE. No real brands anywhere; all names are in-world fiction.
import * as THREE from 'three';

export function rng(seed = 1) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const cvs = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true, rep = false) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.userData.grime = true; return t; };

// small value-noise field (tileable), used for blotches, rust and stains
function noiseField(n, seed) { const r = rng(seed), g = new Float32Array(n * n); for (let i = 0; i < g.length; i++) g[i] = r(); return (x, y) => { x = ((x % n) + n) % n; y = ((y % n) + n) % n; const x0 = x | 0, y0 = y | 0, x1 = (x0 + 1) % n, y1 = (y0 + 1) % n, fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); const a = g[y0 * n + x0], b = g[y0 * n + x1], c = g[y1 * n + x0], d = g[y1 * n + x1]; return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; }; }
function fbm(seed) { const fs = [noiseField(8, seed), noiseField(16, seed + 1), noiseField(32, seed + 2), noiseField(64, seed + 3)]; return (u, v) => fs[0](u * 8, v * 8) * 0.5 + fs[1](u * 16, v * 16) * 0.25 + fs[2](u * 32, v * 32) * 0.15 + fs[3](u * 64, v * 64) * 0.1; }
// paint a cell from a per-pixel fn(u, v) -> [r, g, b, a] (0..255)
function paintCell(x, X, Y, S, fn) { const id = x.getImageData(X, Y, S, S), d = id.data; for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const o = (j * S + i) * 4, p = fn(i / S, j / S); d[o] = p[0]; d[o + 1] = p[1]; d[o + 2] = p[2]; d[o + 3] = p[3]; } x.putImageData(id, X, Y); }
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------- wall grime atlas (4x4): rust streaks, water stains, soot, cracks, blotches ----------
export const WALL_CELLS = { rust: [0, 1, 2], water: [3, 4], soot: [5, 6, 7], crack: [8, 9], blotch: [10, 11], leak: [12, 13], burn: [14], drip: [15] };
export function wallAtlas(size = 1024, seed = 7) {
  const c = cvs(size), x = c.getContext('2d', { willReadFrequently: true }), S = size / 4, r = rng(seed);
  for (let k = 0; k < 16; k++) {
    const X = (k % 4) * S, Y = Math.floor(k / 4) * S, n = fbm(seed + k * 13), cols = [];
    const streaks = []; for (let i = 0; i < 18; i++) streaks.push({ u: r(), w: 0.006 + r() * 0.03, len: 0.3 + r() * 0.7, a: 0.3 + r() * 0.7 });
    let fn;
    if (k <= 2 || k === 12 || k === 13) { // rust / leak streaks hanging from the top edge
      const rust = k <= 2;
      fn = (u, v) => { let a = 0; for (const s of streaks) { const du = Math.abs(u - s.u - Math.sin(v * 9 + s.u * 30) * 0.004); if (du < s.w && v < s.len) a = Math.max(a, s.a * (1 - du / s.w) * (1 - v / s.len)); }
        const nn = n(u, v); a = clamp(a * (0.6 + nn * 0.8) + sstep(0.12, 0, v) * 0.7 * nn); const e = 1 - sstep(0.4, 0.5, Math.abs(u - 0.5)); a *= e;
        return rust ? [120 + nn * 60, 52 + nn * 30, 20 + nn * 10, a * 235] : [30 + nn * 20, 28 + nn * 18, 22 + nn * 14, a * 200]; };
    } else if (k === 3 || k === 4) { // tide-line water stains
      fn = (u, v) => { const nn = n(u, v), d = Math.hypot((u - 0.5) * 1.3, (v - 0.55) * 0.9) + (nn - 0.5) * 0.35, ring = Math.exp(-Math.pow((d - 0.36) / 0.02, 2)) * 0.8, fill = sstep(0.42, 0.2, d) * 0.35; const a = clamp(ring + fill) * (0.5 + nn * 0.6); return [70 + nn * 30, 62 + nn * 26, 50 + nn * 20, a * 210]; };
    } else if (k >= 5 && k <= 7) { // soot / ground splash creeping up from the bottom
      fn = (u, v) => { const nn = n(u, v * 0.6), h = 1 - v, a = clamp(sstep(0.55 + nn * 0.35, 0, h) * (0.7 + nn * 0.5)) * (1 - sstep(0.42, 0.5, Math.abs(u - 0.5))); return [14 + nn * 14, 12 + nn * 10, 10 + nn * 8, a * 235]; };
    } else if (k === 8 || k === 9) { // cracks: drawn as branching polylines
      x.save(); x.beginPath(); x.rect(X, Y, S, S); x.clip();
      const crack = (px, py, ang, len, w, depth) => { x.lineWidth = w; x.strokeStyle = 'rgba(10,8,6,0.85)'; x.beginPath(); x.moveTo(px, py); let cx = px, cy = py; for (let i = 0; i < 10; i++) { ang += (r() - 0.5) * 0.9; cx += Math.cos(ang) * len / 10; cy += Math.sin(ang) * len / 10; x.lineTo(cx, cy); if (depth < 3 && r() < 0.18) crack(cx, cy, ang + (r() - 0.5) * 2, len * 0.5, w * 0.6, depth + 1); } x.stroke(); x.strokeStyle = 'rgba(200,180,160,0.18)'; x.lineWidth = w * 0.5; x.stroke(); };
      for (let i = 0; i < 3; i++) crack(X + S * (0.2 + r() * 0.6), Y + S * (0.1 + r() * 0.3), Math.PI / 2 + (r() - 0.5), S * (0.5 + r() * 0.4), Math.max(1, S / 90), 0);
      x.restore(); continue;
    } else if (k === 14) { // scorch mark
      fn = (u, v) => { const nn = n(u, v), d = Math.hypot(u - 0.5, (v - 0.7) * 0.8) + (nn - 0.5) * 0.25, a = clamp(sstep(0.48, 0.05, d) * 1.1 + sstep(0.5, 0, Math.abs(u - 0.5)) * sstep(0.9, 0, v) * 0.3 * nn); return [10 + nn * 10, 8 + nn * 8, 6 + nn * 6, a * 240]; };
    } else if (k === 15) { // paint drips
      fn = (u, v) => { let a = 0; for (const s of streaks.slice(0, 10)) { const du = Math.abs(u - s.u); if (du < s.w * 0.5 && v < s.len) a = Math.max(a, s.a * (1 - du / (s.w * 0.5))); } return [20, 18, 16, a * 200]; };
    } else { // blotchy grime
      fn = (u, v) => { const nn = n(u, v), d = Math.hypot(u - 0.5, v - 0.5); const a = clamp(sstep(0.5, 0.15, d + (nn - 0.5) * 0.4) * sstep(0.35, 0.7, nn) * 1.4); return [40 + nn * 30, 34 + nn * 24, 26 + nn * 18, a * 190]; };
    }
    paintCell(x, X, Y, S, fn);
  }
  return tex(c);
}

// ---------- graffiti atlas (4x4): tags, throw-ups, stencils, wheat-paste posters ----------
// crews and slogans are in-world fiction (Saltblood, Red Tape, Dust Kings...). Profanity is on purpose (mature rating).
export const TAGS = ['SALTBLOOD', 'RED TAPE', 'DUST KINGS', 'MARROW', 'SPIT VALVE', 'NO GODS NO METERS', 'FUCK COLSEC', 'RUSK EATS SHIT', 'BREATHE FREE', 'KEEP OUT', 'VOID BOYZ', 'SNITCHES = O2 LEAKS'];
export const GRAF_CELLS = { tag: [0, 1, 2, 3, 4, 5], throwup: [6, 7], stencil: [8, 9, 10], poster: [11, 12, 13, 14, 15] };
const SPRAY = ['#e8e4dc', '#ff3b2f', '#ffd23a', '#36e0ff', '#8cff3a', '#ff4fd8', '#111111', '#f08a24'];
function spray(x, text, cx, cy, maxW, fs, col, r, outline) {
  x.font = `900 ${fs}px Impact, "Arial Black", system-ui, sans-serif`; let w = x.measureText(text).width; if (w > maxW) { fs *= maxW / w; x.font = `900 ${fs}px Impact, "Arial Black", system-ui, sans-serif`; w = maxW; }
  x.save(); x.translate(cx, cy); x.rotate((r() - 0.5) * 0.22); x.transform(1, 0, (r() - 0.5) * 0.5, 1, 0, 0); x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = col; x.shadowBlur = fs * 0.18; // overspray haze
  if (outline) { x.lineJoin = 'round'; x.lineWidth = fs * 0.22; x.strokeStyle = outline; x.strokeText(text, 0, 0); }
  x.fillStyle = col; x.fillText(text, 0, 0); x.shadowBlur = 0;
  // drips from the bottom of the letters
  x.strokeStyle = col; x.lineCap = 'round'; for (let i = 0; i < 6 + r() * 8; i++) { const dx = (r() - 0.5) * w * 0.9, l = fs * (0.2 + r() * 1.1); x.lineWidth = Math.max(1, fs * (0.03 + r() * 0.04)); x.beginPath(); x.moveTo(dx, fs * 0.3); x.lineTo(dx + (r() - 0.5) * 2, fs * 0.3 + l); x.stroke(); }
  x.restore();
}
function weather(x, X, Y, S, seed, k = 0.55) { // fade + flake the paint so it sits in the wall instead of on it
  const n = fbm(seed), id = x.getImageData(X, Y, S, S), d = id.data;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const o = (j * S + i) * 4, nn = n(i / S, j / S); d[o + 3] *= clamp(1 - k * sstep(0.35, 0.75, nn) - (nn > 0.72 ? 0.6 : 0)); const f = 0.75 + nn * 0.3; d[o] *= f; d[o + 1] *= f; d[o + 2] *= f; }
  x.putImageData(id, X, Y);
}
export function graffitiAtlas(size = 1024, seed = 11) {
  const c = cvs(size), x = c.getContext('2d', { willReadFrequently: true }), S = size / 4, r = rng(seed);
  const POSTERS = [
    ['WANTED', 'DEAD OR BREATHING', '5,000 CR', '#d8c9a0', '#2a1a10'], ['LUNGFUL', 'CANNED AIR · NOW IN MINT', 'BREATHE LIKE YOU MEAN IT', '#2a6a8a', '#f0f0e0'],
    ['MISSING', 'TOMAS "TICK" ORR · 14', 'LAST SEEN: CHOP ROW', '#e0dccf', '#1a1a1a'], ['MERIDIAN', 'WE DIG DEEPER', 'DON\u2019T ASK WHAT WE HIT', '#141414', '#ff7a20'],
    ['THE PIT', 'FRIDAY · BARE KNUCKLE', 'NO REFUNDS · NO MEDICS', '#7a1010', '#f0e0c0']
  ];
  for (let k = 0; k < 16; k++) {
    const X = (k % 4) * S, Y = Math.floor(k / 4) * S, cx = X + S / 2, cy = Y + S / 2;
    x.save(); x.beginPath(); x.rect(X, Y, S, S); x.clip();
    if (k <= 5) { const t = TAGS[(k * 5 + 3) % TAGS.length]; spray(x, t, cx, cy, S * 0.92, S * 0.3, SPRAY[(k * 3) % SPRAY.length], r, r() < 0.4 ? '#0b0b0b' : null); }
    else if (k <= 7) { // throw-up: fat outlined bubble letters with a fill fade
      const t = ['SALT', 'DUST'][k - 6], fs = S * 0.5; x.font = `900 ${fs}px "Arial Black", Impact, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
      x.lineWidth = fs * 0.34; x.strokeStyle = '#0a0a0a'; x.strokeText(t, cx, cy); x.lineWidth = fs * 0.18; x.strokeStyle = '#f2f2ea'; x.strokeText(t, cx, cy);
      const g = x.createLinearGradient(0, cy - fs / 2, 0, cy + fs / 2); g.addColorStop(0, k === 6 ? '#ff2a2a' : '#30d0ff'); g.addColorStop(1, k === 6 ? '#701010' : '#1a3aa0'); x.fillStyle = g; x.fillText(t, cx, cy);
      x.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(cx + (r() - 0.5) * S * 0.6, cy - fs * 0.2 + (r() - 0.5) * fs * 0.2, S * 0.012, 0, 7); x.fill(); }
    } else if (k <= 10) { // stencils: hard-edged spray through a mask
      const t = ['COLSEC\nKILLS', 'OBEY\nTHE METER', 'NO O2\nNO PEACE'][k - 8].split('\n'); x.fillStyle = k === 9 ? '#111' : '#e8e2d6'; x.font = `900 ${S * 0.2}px "Courier New", monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
      t.forEach((l, i) => { const s = l.split(''); let o = -x.measureText(l).width / 2; for (const ch of s) { const cw = x.measureText(ch).width; x.fillText(ch, cx + o + cw / 2, cy + (i - 0.5) * S * 0.24); o += cw; } });
      // stencil bridges: thin cuts through letters
      x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 12; i++) x.fillRect(X + r() * S, Y + S * 0.25 + r() * S * 0.5, S * 0.008, S * 0.06); x.globalCompositeOperation = 'source-over';
      if (k === 8) { x.strokeStyle = '#e8e2d6'; x.lineWidth = S * 0.02; x.beginPath(); x.arc(cx, cy, S * 0.42, 0, 7); x.stroke(); }
    } else { // wheat-paste poster, torn and sun-bleached
      const [h1, h2, h3, bg, fg] = POSTERS[k - 11], pw = S * 0.62, ph = S * 0.86, px = cx - pw / 2, py = cy - ph / 2;
      x.fillStyle = bg; x.beginPath(); x.moveTo(px, py); for (let i = 0; i <= 10; i++) x.lineTo(px + pw * i / 10, py + (r() < 0.3 ? r() * 8 : 0)); for (let i = 0; i <= 14; i++) x.lineTo(px + pw - (r() < 0.25 ? r() * 14 : 0), py + ph * i / 14);
      for (let i = 10; i >= 0; i--) x.lineTo(px + pw * i / 10, py + ph - (r() < 0.5 ? r() * ph * 0.25 : 0)); x.closePath(); x.fill();
      x.fillStyle = fg; x.textAlign = 'center'; x.font = `900 ${S * 0.13}px Impact, "Arial Black", sans-serif`; x.fillText(h1, cx, py + ph * 0.2);
      if (k === 11 || k === 13) { x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(cx - pw * 0.3, py + ph * 0.27, pw * 0.6, ph * 0.33); x.fillStyle = 'rgba(200,190,170,0.25)'; x.beginPath(); x.arc(cx, py + ph * 0.38, pw * 0.13, 0, 7); x.fill(); x.fillRect(cx - pw * 0.2, py + ph * 0.48, pw * 0.4, ph * 0.12); }
      x.fillStyle = fg; x.font = `700 ${S * 0.055}px system-ui, sans-serif`; x.fillText(h2, cx, py + ph * 0.72); x.font = `600 ${S * 0.045}px system-ui, sans-serif`; x.fillText(h3, cx, py + ph * 0.82);
      // someone tagged over it
      if (r() < 0.6) spray(x, ['FAKE', 'LIES', 'FUCK OFF', 'X'][Math.floor(r() * 4)], cx, cy + ph * 0.1, pw, S * 0.14, SPRAY[1 + Math.floor(r() * 4)], r, null);
      weather(x, X, Y, S, seed + k * 7, 0.35); x.restore(); continue;
    }
    weather(x, X, Y, S, seed + k * 7); x.restore();
  }
  return tex(c);
}

// ---------- ground atlas (4x4): oil slicks, puddles, stains, cracks, litter, glass, tyre marks ----------
export const GROUND_CELLS = { oil: [0, 1], puddle: [2, 3], stain: [4, 5, 6], crack: [7, 8], litter: [9, 10, 11], glass: [12, 13], skid: [14], drain: [15] };
export function groundAtlas(size = 1024, seed = 23) {
  const c = cvs(size), x = c.getContext('2d', { willReadFrequently: true }), S = size / 4, r = rng(seed);
  for (let k = 0; k < 16; k++) {
    const X = (k % 4) * S, Y = Math.floor(k / 4) * S, n = fbm(seed + k * 17), cx = X + S / 2, cy = Y + S / 2;
    if (k <= 3) { const oil = k <= 1; paintCell(x, X, Y, S, (u, v) => { const nn = n(u, v), d = Math.hypot(u - 0.5, v - 0.5) + (nn - 0.5) * 0.45, a = sstep(0.46, 0.3, d);
      if (!oil) return [24 + nn * 18, 22 + nn * 16, 22 + nn * 18, a * 230];
      const ph = d * 40 + nn * 8; return [40 + 60 * (0.5 + 0.5 * Math.sin(ph)), 30 + 60 * (0.5 + 0.5 * Math.sin(ph + 2.1)), 30 + 70 * (0.5 + 0.5 * Math.sin(ph + 4.2)), a * 235]; }); continue; }
    if (k <= 6) { paintCell(x, X, Y, S, (u, v) => { const nn = n(u, v), d = Math.hypot(u - 0.5, v - 0.5) + (nn - 0.5) * 0.5, a = sstep(0.5, 0.1, d) * (0.5 + nn * 0.6); return k === 6 ? [70 + nn * 20, 8, 6, a * 200] : [18 + nn * 16, 15 + nn * 12, 12 + nn * 10, a * 220]; }); continue; } // k=6: dried blood
    x.save(); x.beginPath(); x.rect(X, Y, S, S); x.clip();
    if (k <= 8) { const crack = (px, py, ang, len, w, dp) => { x.lineWidth = w; x.strokeStyle = 'rgba(6,5,4,0.9)'; x.beginPath(); x.moveTo(px, py); let qx = px, qy = py; for (let i = 0; i < 12; i++) { ang += (r() - 0.5) * 0.8; qx += Math.cos(ang) * len / 12; qy += Math.sin(ang) * len / 12; x.lineTo(qx, qy); if (dp < 3 && r() < 0.2) crack(qx, qy, ang + (r() - 0.5) * 2.2, len * 0.45, w * 0.6, dp + 1); } x.stroke(); };
      for (let i = 0; i < 4; i++) crack(cx, cy, r() * 6.28, S * 0.45, Math.max(1.2, S / 70), 0); }
    else if (k <= 11) { // litter: wrappers, receipts, cans, a cig-butt scatter
      for (let i = 0; i < 26; i++) { const px = X + S * (0.1 + r() * 0.8), py = Y + S * (0.1 + r() * 0.8), w = S * (0.03 + r() * 0.08), h = w * (0.4 + r() * 0.8); x.save(); x.translate(px, py); x.rotate(r() * 6.3);
        const t = r(); x.fillStyle = t < 0.4 ? `rgba(${200 + r() * 40},${190 + r() * 40},${170 + r() * 30},0.85)` : t < 0.7 ? ['#b02020', '#2050a0', '#e0a020', '#208040', '#601070'][Math.floor(r() * 5)] : '#9a9a96'; x.fillRect(-w / 2, -h / 2, w, h);
        x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(-w / 2, h * 0.1, w, h * 0.4); x.restore(); }
      x.fillStyle = '#d8c8a8'; for (let i = 0; i < 20; i++) x.fillRect(X + r() * S, Y + r() * S, S * 0.012, S * 0.004); }
    else if (k <= 13) { // broken glass: bright shards
      for (let i = 0; i < 40; i++) { const px = cx + (r() - 0.5) * S * 0.8 * r(), py = cy + (r() - 0.5) * S * 0.8 * r(), s = S * (0.01 + r() * 0.03); x.fillStyle = `rgba(${180 + r() * 70},${220 + r() * 35},${220 + r() * 35},${0.5 + r() * 0.5})`; x.beginPath(); x.moveTo(px, py - s); x.lineTo(px + s * r(), py + s); x.lineTo(px - s, py + s * r()); x.closePath(); x.fill(); } }
    else if (k === 14) { x.strokeStyle = 'rgba(8,8,8,0.6)'; x.lineCap = 'round'; for (const o of [-0.12, 0.12]) { x.lineWidth = S * 0.07; x.beginPath(); x.moveTo(X + S * (0.5 + o), Y); x.bezierCurveTo(X + S * (0.6 + o), Y + S * 0.4, X + S * (0.3 + o), Y + S * 0.6, X + S * (0.45 + o), Y + S); x.stroke(); } }
    else { x.fillStyle = '#151515'; x.fillRect(cx - S * 0.3, cy - S * 0.3, S * 0.6, S * 0.6); x.fillStyle = '#050505'; for (let i = 0; i < 7; i++) x.fillRect(cx - S * 0.26, cy - S * 0.26 + i * S * 0.08, S * 0.52, S * 0.04);
       }
    x.restore();
  }
  return tex(c);
}

// ---------- materials textures for props ----------
export function corrugatedTex(size = 256, seed = 31, hue = 0) { // rusty corrugated sheet (shanties, fences)
  const c = cvs(size), x = c.getContext('2d', { willReadFrequently: true }), n = fbm(seed); paintCell(x, 0, 0, size, (u, v) => { const rib = 0.75 + 0.25 * Math.sin(u * Math.PI * 24), nn = n(u, v), rust = sstep(0.45, 0.75, nn + (1 - v) * 0.15 + Math.sin(u * 60) * 0.02);
    const base = hue ? [90, 100, 96] : [120, 118, 112]; return [(base[0] * (1 - rust) + 130 * rust) * rib, (base[1] * (1 - rust) + 58 * rust) * rib, (base[2] * (1 - rust) + 26 * rust) * rib, 255]; }); return tex(c, true, true); }
export function fabricTex(size = 128, seed = 41, col = [70, 66, 58]) { // dirty fabric / tarp / blankets
  const c = cvs(size), x = c.getContext('2d', { willReadFrequently: true }), n = fbm(seed); paintCell(x, 0, 0, size, (u, v) => { const nn = n(u, v), weave = 0.92 + 0.08 * ((Math.floor(u * size / 2) + Math.floor(v * size / 2)) % 2), dirt = 0.55 + nn * 0.6; return [col[0] * dirt * weave, col[1] * dirt * weave, col[2] * dirt * weave, 255]; }); return tex(c, true, true); }
export function cartTex(size = 128) { // wire-mesh for shopping carts / chain link: alpha-tested grid
  const c = cvs(size), x = c.getContext('2d', { willReadFrequently: true }); x.strokeStyle = '#b8bcc0'; x.lineWidth = 2; for (let i = 0; i <= 8; i++) { const p = i * size / 8; x.beginPath(); x.moveTo(p, 0); x.lineTo(p, size); x.moveTo(0, p); x.lineTo(size, p); x.stroke(); } x.strokeStyle = 'rgba(130,70,30,0.8)'; x.lineWidth = 1; for (let i = 0; i < 20; i++) { const p = Math.random() * size; x.beginPath(); x.moveTo(p, 0); x.lineTo(p, size); x.stroke(); } return tex(c); }
export function rustMetalTex(size = 128, seed = 51) { const c = cvs(size), x = c.getContext('2d', { willReadFrequently: true }), n = fbm(seed); paintCell(x, 0, 0, size, (u, v) => { const nn = n(u, v), r = sstep(0.3, 0.7, nn); return [60 + r * 80, 50 + r * 30, 44 + r * 8, 255]; }); return tex(c, true, true); }
export function sootTex(size = 128, seed = 61) { const c = cvs(size), x = c.getContext('2d', { willReadFrequently: true }), n = fbm(seed); paintCell(x, 0, 0, size, (u, v) => { const nn = n(u, v); return [20 + nn * 30, 18 + nn * 20, 16 + nn * 14, 255]; }); return tex(c, true, true); }
export function puffTex(size = 64) { // soft smoke puff
  const c = cvs(size), x = c.getContext('2d', { willReadFrequently: true }), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, size, size);
  const id = x.getImageData(0, 0, size, size), d = id.data, n = fbm(71); for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) d[(j * size + i) * 4 + 3] *= 0.5 + n(i / size, j / size) * 0.8; x.putImageData(id, 0, 0); return tex(c); }
export function flameTex(size = 64) { const c = cvs(size, size * 2), x = c.getContext('2d', { willReadFrequently: true }), g = x.createRadialGradient(size / 2, size * 1.6, 2, size / 2, size * 1.3, size * 0.9); g.addColorStop(0, 'rgba(255,250,210,1)'); g.addColorStop(0.3, 'rgba(255,170,40,0.95)'); g.addColorStop(0.7, 'rgba(200,50,10,0.5)'); g.addColorStop(1, 'rgba(80,10,0,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(size * 0.1, size * 2); x.quadraticCurveTo(size * 0.2, size * 0.6, size / 2, 0); x.quadraticCurveTo(size * 0.8, size * 0.6, size * 0.9, size * 2); x.fill(); return tex(c); }

// ---------- broken neon: lit letters, dead tubes, and the letters that buzz ----------
// returns { lit, flick } textures of the same layout: lit = board + always-on letters + dead (dark) tubes, flick = only the
// flickering letters (drawn on a separate quad so the buzz is a visibility toggle, no texture re-upload)
export function neonSign(text, color, { dead = [], flicker = [], w = 512, h = 128, board = true } = {}) {
  const mk = () => { const c = cvs(w, h); return [c, c.getContext('2d', { willReadFrequently: true })]; }, [c1, a] = mk(), [c2, b] = mk(), col = '#' + color.toString(16).padStart(6, '0');
  if (board) { a.fillStyle = 'rgba(12,10,10,0.92)'; a.fillRect(0, 0, w, h); const n = fbm(text.length * 7); const id = a.getImageData(0, 0, w, h), d = id.data; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = (j * w + i) * 4, nn = n(i / w, j / h); d[o] += nn * 40 * (j / h); d[o + 1] += nn * 22 * (j / h); d[o + 2] += nn * 10 * (j / h); } a.putImageData(id, 0, 0);
    a.strokeStyle = 'rgba(60,50,40,0.9)'; a.lineWidth = 4; a.strokeRect(3, 3, w - 6, h - 6); }
  let fs = h * 0.62; const font = s => `600 ${s}px "Arial Narrow", "Helvetica Neue", system-ui, sans-serif`; a.font = font(fs); while (a.measureText(text).width > w * 0.9 && fs > 10) { fs -= 2; a.font = font(fs); } b.font = a.font;
  const tw = a.measureText(text).width; let ox = (w - tw) / 2; const y = h * 0.56;
  for (const g of [a, b]) { g.textBaseline = 'middle'; g.lineJoin = 'round'; }
  [...text].forEach((ch, i) => {
    const cw = a.measureText(ch).width, isDead = dead.includes(i), isFl = flicker.includes(i), g = isFl ? b : a;
    if (ch !== ' ') {
      if (isDead || isFl) { a.lineWidth = fs * 0.07; a.strokeStyle = 'rgba(90,80,75,0.85)'; a.strokeText(ch, ox, y); } // the glass tube, unlit
      if (!isDead) { g.shadowColor = col; g.shadowBlur = fs * 0.45; g.lineWidth = fs * 0.075; g.strokeStyle = col; g.strokeText(ch, ox, y); g.shadowBlur = fs * 0.15; g.lineWidth = fs * 0.03; g.strokeStyle = '#fff'; g.strokeText(ch, ox, y); g.shadowBlur = 0; }
    }
    ox += cw;
  });
  return { lit: tex(c1), flick: tex(c2) };
}


// big soft dirt blanket laid over a district disc: grime patches, tyre arcs, a dark ring where foot traffic wears the dust
export function dirtBlanketTex(size = 512, seed = 81) {
  const c = cvs(size), x = c.getContext('2d', { willReadFrequently: true }), n = fbm(seed), m = fbm(seed + 9);
  paintCell(x, 0, 0, size, (u, v) => { const dx = u - 0.5, dy = v - 0.5, r = Math.hypot(dx, dy) * 2, edge = 1 - sstep(0.78, 1, r), nn = n(u * 1.3, v * 1.3), mm = m(u * 3, v * 3);
    const patch = sstep(0.42, 0.72, nn) * 0.75 + sstep(0.55, 0.8, mm) * 0.35, ring = Math.exp(-((r - 0.55) ** 2) / 0.02) * 0.25;
    const a = clamp((patch + ring) * edge) * 0.5, k = 0.6 + mm * 0.5; return [70 * k, 54 * k, 42 * k, a * 255]; });
  x.globalCompositeOperation = 'source-over'; const r = rng(seed);
  for (let i = 0; i < 7; i++) { x.strokeStyle = `rgba(22,18,14,${0.25 + r() * 0.25})`; x.lineWidth = size * (0.008 + r() * 0.008); const cx = size * (0.2 + r() * 0.6), cy = size * (0.2 + r() * 0.6), rr = size * (0.1 + r() * 0.3), a0 = r() * 6.3;
    for (const o of [0, size * 0.025]) { x.beginPath(); x.arc(cx, cy, rr + o, a0, a0 + 0.8 + r() * 1.6); x.stroke(); } }
  return tex(c);
}
// soft radial glow (neon light spill on walls / ground)
export function glowTex(size = 128) { const c = cvs(size), x = c.getContext('2d', { willReadFrequently: true }), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(0.4, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, size, size); return tex(c); }
// concrete with cracks and seep stains (jersey barriers, overpass pillars)
export function concreteTex(size = 256, seed = 91) { const c = cvs(size), x = c.getContext('2d', { willReadFrequently: true }), n = fbm(seed); paintCell(x, 0, 0, size, (u, v) => { const nn = n(u, v), s = sstep(0.5, 0.8, nn) * 0.35 + (1 - v) * 0.12; const b = 150 - s * 90 + nn * 20; return [b, b * 0.96, b * 0.9, 255]; });
  const r = rng(seed); x.strokeStyle = 'rgba(30,26,22,0.7)'; x.lineWidth = 1.5; for (let i = 0; i < 6; i++) { let px = r() * size, py = r() * size; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 8; k++) { px += (r() - 0.5) * 30; py += r() * 22; x.lineTo(px, py); } x.stroke(); } return tex(c, true, true); }

// sky-ish environment for wet / glossy materials only (never set as scene.environment)
export function envTex(renderer) {
  const c = cvs(256, 128), x = c.getContext('2d', { willReadFrequently: true }), g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#1a1214'); g.addColorStop(0.45, '#c07850'); g.addColorStop(0.52, '#f0b080'); g.addColorStop(0.56, '#40281c'); g.addColorStop(1, '#120c0a'); x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 14; i++) { x.fillStyle = ['#ff3b5c', '#36e0ff', '#ffd23a'][i % 3]; x.globalAlpha = 0.5; x.fillRect(Math.random() * 256, 58 + Math.random() * 6, 4 + Math.random() * 8, 2); } x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromEquirectangular(t); pm.dispose(); t.dispose(); return rt.texture;
}
