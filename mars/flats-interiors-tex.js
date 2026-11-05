// Red Tape Flats interiors: procedural canvas textures (stained plaster, filthy tile, mattresses, gauze, cardboard,
// handwritten signs). Drawn at runtime, nothing downloaded: written for this repo, CC0. Every texture is created when
// you walk in and disposed when you leave (see flats-interiors.js dress/undress).
import * as THREE from 'three';

let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const hex = c => '#' + c.toString(16).padStart(6, '0');
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, repeat) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 2; return t;
}
function blot(x, cx, cy, r, col, a) { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0)); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }

// stained, water-damaged plaster: drips from the top, tide marks, smoke above head height, hand smears low down
export function wall(base = 0x5a5246, { size = 256, s = 3, dirt = 1, repeat = [3, 1] } = {}) {
  seed = s * 7919 + 13; const [c, x] = canvas(size, size); x.fillStyle = hex(base); x.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,240,220'},${0.02 + rnd() * 0.05})`; x.fillRect(rnd() * size, rnd() * size, 2 + rnd() * 6, 2 + rnd() * 6); }
  for (let i = 0; i < 9 * dirt; i++) blot(x, rnd() * size, rnd() * size, 14 + rnd() * 50, 'rgba(60,44,20,A)', 0.18 + rnd() * 0.2);
  const top = x.createLinearGradient(0, 0, 0, size * 0.45); top.addColorStop(0, 'rgba(20,16,10,0.55)'); top.addColorStop(1, 'rgba(20,16,10,0)'); x.fillStyle = top; x.fillRect(0, 0, size, size * 0.45);
  for (let i = 0; i < 14 * dirt; i++) { const dx = rnd() * size, len = 30 + rnd() * size * 0.7; const g = x.createLinearGradient(0, 0, 0, len); g.addColorStop(0, 'rgba(70,50,20,0.45)'); g.addColorStop(1, 'rgba(70,50,20,0)'); x.fillStyle = g; x.fillRect(dx, 0, 1.5 + rnd() * 4, len); }
  for (let i = 0; i < 4; i++) { x.strokeStyle = `rgba(80,60,30,${0.25 + rnd() * 0.2})`; x.lineWidth = 2; x.beginPath(); const y = size * (0.55 + rnd() * 0.3); x.moveTo(0, y); for (let k = 0; k <= 8; k++) x.lineTo(k * size / 8, y + (rnd() - 0.5) * 14); x.stroke(); }
  const low = x.createLinearGradient(0, size * 0.75, 0, size); low.addColorStop(0, 'rgba(10,8,6,0)'); low.addColorStop(1, 'rgba(10,8,6,0.6)'); x.fillStyle = low; x.fillRect(0, size * 0.75, size, size * 0.25);
  for (let i = 0; i < 5 * dirt; i++) { x.fillStyle = `rgba(30,20,12,${0.15 + rnd() * 0.2})`; const hx = rnd() * size, hy = size * (0.55 + rnd() * 0.2); for (let f = 0; f < 4; f++) x.fillRect(hx + f * 5, hy + rnd() * 3, 3, 10 + rnd() * 6); }
  return tex(c, repeat);
}
// cracked lino / tile with grime in the grout and a few dark spills
export function floor(base = 0x4a443a, { size = 256, s = 5, tiles = 8, spills = 6, blood = 0, repeat = [3, 3] } = {}) {
  seed = s * 104729 + 7; const [c, x] = canvas(size, size); x.fillStyle = hex(base); x.fillRect(0, 0, size, size);
  const t = size / tiles; for (let i = 0; i < tiles; i++) for (let j = 0; j < tiles; j++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,250,230'},${rnd() * 0.12})`; x.fillRect(i * t + 1, j * t + 1, t - 2, t - 2); }
  x.strokeStyle = 'rgba(14,10,6,0.75)'; x.lineWidth = 2; for (let i = 0; i <= tiles; i++) { x.beginPath(); x.moveTo(i * t, 0); x.lineTo(i * t, size); x.stroke(); x.beginPath(); x.moveTo(0, i * t); x.lineTo(size, i * t); x.stroke(); }
  for (let i = 0; i < 6; i++) { x.strokeStyle = 'rgba(10,8,6,0.6)'; x.lineWidth = 1; x.beginPath(); let px = rnd() * size, py = rnd() * size; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (rnd() - 0.5) * 30; py += (rnd() - 0.5) * 30; x.lineTo(px, py); } x.stroke(); }
  for (let i = 0; i < spills; i++) blot(x, rnd() * size, rnd() * size, 12 + rnd() * 34, 'rgba(24,18,8,A)', 0.35 + rnd() * 0.3);
  for (let i = 0; i < blood; i++) blot(x, rnd() * size, rnd() * size, 8 + rnd() * 26, 'rgba(90,6,6,A)', 0.55 + rnd() * 0.3);
  return tex(c, repeat);
}
// a bare, piss-yellow mattress with rust rings, burn holes and ticking stripes
export function mattress(s = 1) {
  seed = s * 31337 + 1; const [c, x] = canvas(128, 256); x.fillStyle = '#b8ac86'; x.fillRect(0, 0, 128, 256);
  x.fillStyle = 'rgba(80,90,120,0.22)'; for (let i = 0; i < 128; i += 10) x.fillRect(i, 0, 3, 256);
  for (let i = 0; i < 7; i++) { const cx = rnd() * 128, cy = rnd() * 256, r = 14 + rnd() * 34; blot(x, cx, cy, r, 'rgba(150,110,30,A)', 0.55); x.strokeStyle = 'rgba(110,70,20,0.5)'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, r * 0.8, 0, 7); x.stroke(); }
  for (let i = 0; i < 3; i++) blot(x, rnd() * 128, rnd() * 256, 10 + rnd() * 16, 'rgba(100,20,10,A)', 0.5);
  for (let i = 0; i < 4; i++) { x.fillStyle = '#1a120a'; x.beginPath(); x.arc(rnd() * 128, rnd() * 256, 2 + rnd() * 4, 0, 7); x.fill(); }
  return tex(c);
}
// bloody gauze / rags: white cloth, soaked red centre
export function gauze(s = 2, soak = 1) {
  seed = s * 7 + 3; const [c, x] = canvas(128, 128); x.clearRect(0, 0, 128, 128);
  x.fillStyle = 'rgba(236,230,220,0.95)'; x.beginPath(); for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, r = 40 + rnd() * 20; x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } x.closePath(); x.fill();
  x.strokeStyle = 'rgba(180,170,160,0.6)'; for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(20 + rnd() * 90, 20 + rnd() * 90); x.lineTo(20 + rnd() * 90, 20 + rnd() * 90); x.stroke(); }
  blot(x, 60 + rnd() * 10, 60 + rnd() * 10, 34 * soak, 'rgba(120,8,8,A)', 0.95); blot(x, 64, 64, 18 * soak, 'rgba(70,0,0,A)', 0.9);
  return tex(c);
}
// a dark pool (blood or worse) for the floor
export function pool(s = 4, col = 'rgba(80,4,4,A)') {
  seed = s * 3 + 9; const [c, x] = canvas(128, 128); x.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 8; i++) blot(x, 64 + (rnd() - 0.5) * 50, 64 + (rnd() - 0.5) * 50, 18 + rnd() * 26, col, 0.9);
  for (let i = 0; i < 14; i++) blot(x, rnd() * 128, rnd() * 128, 2 + rnd() * 5, col, 0.9);
  return tex(c);
}
// spray-paint tags and scrawled warnings (made-up crews)
export function tag(text, color = 0xff3050, { w = 256, h = 96, s = 6, font = 'bold 54px Impact, system-ui, sans-serif', drip = true } = {}) {
  seed = s * 17 + 5; const [c, x] = canvas(w, h); x.clearRect(0, 0, w, h);
  x.font = font; let size = parseInt(/(\d+)px/.exec(font)[1], 10); while (x.measureText(text).width > w - 16 && size > 12) { size -= 2; x.font = font.replace(/\d+px/, size + 'px'); }
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.save(); x.translate(w / 2, h / 2); x.rotate((rnd() - 0.5) * 0.15);
  x.shadowColor = hex(color); x.shadowBlur = 6; x.fillStyle = hex(color); x.fillText(text, 0, 0); x.restore();
  if (drip) { x.fillStyle = hex(color); for (let i = 0; i < 7; i++) x.fillRect(w * 0.15 + rnd() * w * 0.7, h * 0.62, 2, 6 + rnd() * h * 0.3); }
  return tex(c);
}
// handwritten cardboard / paper sign
export function note(text, { w = 256, h = 128, paper = '#d8cfb4', ink = '#1a1410', font = 'bold 30px "Comic Sans MS", "Marker Felt", system-ui', s = 8 } = {}) {
  seed = s * 23 + 1; const [c, x] = canvas(w, h); x.fillStyle = paper; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 5; i++) blot(x, rnd() * w, rnd() * h, 10 + rnd() * 30, 'rgba(90,70,30,A)', 0.25);
  x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'middle';
  const lines = String(text).split('\n'); let size = parseInt(/(\d+)px/.exec(font)[1], 10); x.font = font;
  while (lines.some(l => x.measureText(l).width > w - 20) && size > 10) { size -= 2; x.font = font.replace(/\d+px/, size + 'px'); }
  lines.forEach((l, i) => x.fillText(l, w / 2 + (rnd() - 0.5) * 4, h / 2 + (i - (lines.length - 1) / 2) * size * 1.15));
  return tex(c);
}
// banded cash (dirty money stacks on the counting table)
export function cash() {
  seed = 99; const [c, x] = canvas(128, 64); x.fillStyle = '#5a6e4a'; x.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 64; i += 3) { x.fillStyle = `rgba(20,30,10,${0.2 + rnd() * 0.2})`; x.fillRect(0, i, 128, 1); }
  x.fillStyle = '#e8e0c0'; x.fillRect(52, 0, 24, 64); x.fillStyle = '#1a1a10'; x.font = 'bold 14px system-ui'; x.fillText('1K', 54, 36);
  return tex(c);
}
// a CRT/TV screen with static
export function staticScreen() { const [c, x] = canvas(64, 48); const id = x.createImageData(64, 48); for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 200 | 0; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); return tex(c); }
