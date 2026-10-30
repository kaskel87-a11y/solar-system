// Red Tape Flats street life: procedural canvas textures (Snuffles). Everything is drawn here at runtime: no image files,
// no third-party art (CC0 by construction). Tag atlas: 4 x 2 cells of 256 px.
import * as THREE from 'three';

export const CELLS = { mark: 0, you0: 1, you1: 2, you2: 3, saltblood: 4, dustjaws: 5, saints: 6, buff: 7 };
export const NCELL = 8;
const rnd = s => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
const cache = {};
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; return t; };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function spray(x, cx, cy, r, col, n, R) { x.fillStyle = col; for (let i = 0; i < n; i++) { const a = R() * 6.283, d = Math.pow(R(), 1.8) * r; x.globalAlpha = 0.25 + R() * 0.5; x.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.6, 1.6); } x.globalAlpha = 1; }
function drips(x, x0, x1, y, col, n, R) { x.strokeStyle = col; for (let i = 0; i < n; i++) { const px = x0 + R() * (x1 - x0), L = 8 + R() * 38; x.lineWidth = 1.5 + R() * 2.5; x.beginPath(); x.moveTo(px, y); x.lineTo(px + (R() - 0.5) * 2, y + L); x.stroke(); x.beginPath(); x.arc(px, y + L, x.lineWidth * 0.7, 0, 6.283); x.fillStyle = col; x.fill(); } }
function piece(x, ox, oy, text, { fill, fill2, line, glow, font = 900, size = 70, skew = -0.18, R }) {
  x.save(); x.translate(ox + 128, oy + 132); x.transform(1, 0, skew, 1, 0, 0);
  x.font = `${font} ${size}px Impact, "Arial Black", system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  while (x.measureText(text).width > 226 && size > 26) { size -= 4; x.font = `${font} ${size}px Impact, "Arial Black", system-ui, sans-serif`; }
  if (glow) { x.shadowColor = glow; x.shadowBlur = 18; }
  x.lineJoin = 'round'; x.lineWidth = 16; x.strokeStyle = '#0b0b0b'; x.strokeText(text, 0, 0); x.shadowBlur = 0;
  x.lineWidth = 7; x.strokeStyle = line; x.strokeText(text, 0, 0);
  const g = x.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, fill); g.addColorStop(1, fill2); x.fillStyle = g; x.fillText(text, 0, 0);
  x.globalAlpha = 0.7; x.fillStyle = '#fff'; for (let i = 0; i < 6; i++) x.fillRect(-100 + R() * 200, -size / 2.6 + R() * 6, 4 + R() * 9, 3); x.globalAlpha = 1;
  x.restore(); drips(x, ox + 30, ox + 226, oy + 132 + size * 0.42, fill2, 7, R); spray(x, ox + 128, oy + 132, 120, line, 260, R);
}
// the atlas: 0 'TAG HERE' chalk marker, 1-3 your piece (3 styles), 4-6 rival crews, 7 grey buff (cleaned wall)
export function tagAtlas(you = 'NOBODY') {
  const key = 'atlas:' + you; if (cache[key]) return cache[key];
  const c = canvas(1024, 512), x = c.getContext('2d'), R = rnd(77);
  const cell = i => [(i % 4) * 256, Math.floor(i / 4) * 256];
  { const [ox, oy] = cell(0); x.save(); x.setLineDash([10, 8]); x.lineWidth = 5; x.strokeStyle = 'rgba(240,240,230,0.85)'; x.strokeRect(ox + 26, oy + 52, 204, 150); x.restore();
    x.fillStyle = 'rgba(240,240,230,0.9)'; x.font = '800 34px system-ui, sans-serif'; x.textAlign = 'center'; x.fillText('TAG', ox + 128, oy + 120); x.font = '700 22px system-ui'; x.fillText('\u2192 HERE \u2190', ox + 128, oy + 156);
    spray(x, ox + 128, oy + 128, 110, 'rgba(240,240,230,1)', 90, R); }
  const styles = [{ fill: '#f2f2f2', fill2: '#9a9a9a', line: '#ff2a6a', glow: '#ff2a6a' }, { fill: '#ffe04a', fill2: '#ff7a1a', line: '#1a1a1a' }, { fill: '#7affc0', fill2: '#1a9a6a', line: '#ffffff', glow: '#3affa0' }];
  styles.forEach((s, i) => { const [ox, oy] = cell(1 + i); piece(x, ox, oy, you, { ...s, R }); });
  { const [ox, oy] = cell(4); piece(x, ox, oy, 'SALTBLOOD', { fill: '#d01818', fill2: '#5a0606', line: '#f0e0d0', size: 58, skew: 0.05, R }); x.fillStyle = '#d01818'; x.font = '900 40px system-ui'; x.fillText('\u2620', ox + 128, oy + 66); }
  { const [ox, oy] = cell(5); piece(x, ox, oy, 'DJB', { fill: '#e8c030', fill2: '#8a5a10', line: '#141414', size: 96, skew: -0.3, R }); x.strokeStyle = '#e8c030'; x.lineWidth = 6; x.beginPath(); for (let k = 0; k < 7; k++) { x.lineTo(ox + 40 + k * 29, oy + 196 + (k % 2) * 16); } x.stroke(); }
  { const [ox, oy] = cell(6); piece(x, ox, oy, 'V.SAINTS', { fill: '#30d8ff', fill2: '#0a4a8a', line: '#ffffff', glow: '#30d8ff', size: 56, R }); x.strokeStyle = '#30d8ff'; x.lineWidth = 5; x.beginPath(); x.ellipse(ox + 128, oy + 70, 46, 12, 0, 0, 6.283); x.stroke(); }
  { const [ox, oy] = cell(7); x.fillStyle = 'rgba(120,116,108,0.92)'; x.fillRect(ox + 18, oy + 40, 220, 176); spray(x, ox + 128, oy + 128, 130, 'rgba(120,116,108,1)', 500, R); }
  return (cache[key] = tex(c));
}
export function puff() { // soft grey smoke
  if (cache.puff) return cache.puff; const c = canvas(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(70,66,62,0.75)'); g.addColorStop(0.55, 'rgba(60,58,56,0.35)'); g.addColorStop(1, 'rgba(50,50,50,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (cache.puff = tex(c));
}
export function flame() { // hot core, used additively
  if (cache.flame) return cache.flame; const c = canvas(64, 128), x = c.getContext('2d'), g = x.createRadialGradient(32, 96, 2, 32, 80, 60);
  g.addColorStop(0, 'rgba(255,240,180,1)'); g.addColorStop(0.3, 'rgba(255,150,40,0.9)'); g.addColorStop(0.7, 'rgba(200,50,10,0.35)'); g.addColorStop(1, 'rgba(120,20,0,0)');
  x.fillStyle = g; x.beginPath(); x.moveTo(32, 2); x.bezierCurveTo(60, 50, 64, 120, 32, 126); x.bezierCurveTo(0, 120, 4, 50, 32, 2); x.fill(); return (cache.flame = tex(c));
}
export function rust(seed = 3, base = [110, 70, 46]) { // streaky rust / corrugated metal
  const k = 'rust' + seed + base; if (cache[k]) return cache[k]; const c = canvas(128, 128), x = c.getContext('2d'), R = rnd(seed * 97 + 11);
  x.fillStyle = `rgb(${base})`; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 16; i++) { x.fillStyle = `rgba(0,0,0,${0.08 + R() * 0.1})`; x.fillRect(i * 8, 0, 3, 128); }
  for (let i = 0; i < 260; i++) { const v = R(); x.fillStyle = v < 0.5 ? `rgba(60,30,14,${R() * 0.5})` : `rgba(190,120,70,${R() * 0.35})`; x.fillRect(R() * 128, R() * 128, 2 + R() * 6, 2 + R() * 14); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return (cache[k] = t);
}
export function concrete(seed = 5) {
  const k = 'conc' + seed; if (cache[k]) return cache[k]; const c = canvas(128, 128), x = c.getContext('2d'), R = rnd(seed * 31 + 7);
  x.fillStyle = '#8a8478'; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${R() < 0.5 ? '40,36,32' : '200,190,170'},${R() * 0.18})`; x.fillRect(R() * 128, R() * 128, 1 + R() * 3, 1 + R() * 3); }
  x.strokeStyle = 'rgba(30,26,22,0.5)'; x.lineWidth = 1; for (let i = 0; i < 4; i++) { x.beginPath(); let px = R() * 128, py = R() * 128; x.moveTo(px, py); for (let j = 0; j < 6; j++) { px += (R() - 0.5) * 30; py += R() * 20; x.lineTo(px, py); } x.stroke(); }
  x.fillStyle = 'rgba(40,30,20,0.25)'; x.fillRect(0, 100, 128, 28); const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return (cache[k] = t);
}
// a hand-painted shop sign: black/white board with stencil letters (made-up names only)
export function sign(text, col = '#f0e6d0', bg = '#151311', w = 512, h = 128) {
  const k = 'sign' + text + col; if (cache[k]) return cache[k]; const c = canvas(w, h), x = c.getContext('2d'), R = rnd(text.length * 13);
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = col; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
  let size = 64; x.font = `900 ${size}px Impact, "Arial Black", system-ui`; while (x.measureText(text).width > w - 40 && size > 16) { size -= 2; x.font = `900 ${size}px Impact, "Arial Black", system-ui`; }
  x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 3);
  for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(20,14,10,${R() * 0.6})`; x.fillRect(R() * w, R() * h, 2 + R() * 10, 1 + R() * 4); }
  return (cache[k] = tex(c));
}
