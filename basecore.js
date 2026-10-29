// Mars base building: pure logic (no DOM, no THREE). Plots, piece catalogue, grid maths, placement rules, costs and
// the save format. base.js renders and drives it; tests/test-base-unit.mjs covers it in node.
//
// Grid: each plot is SIZE x SIZE cells of CELL metres, centred on the plot's AJ-relative position (Ares Junction centre,
// same axes as world.js: x east, z south). Cell (i, j): i along +x, j along +z. A piece is anchored at its min-corner cell
// and rotated in 90° steps (r = 0..3), so footprints and colliders stay axis-aligned.

export const CELL = 2, SIZE = 10, HALF = CELL * SIZE / 2;
export const SAVE_KEY = 'ssx.base.v1';
export const REFUND = 0.5;            // fraction of the build cost you get back when you remove a piece yourself
export const PIECE_CAP = 60;          // pieces per plot (render budget: a few hundred instances total)

// Plots: AJ-relative centres picked off the Ares Beltway polyline, the race-track gates and the other v7.5 lots
// (Red Line Motors [58,46]/[80,30], car meet [-6,-78]). See /workspace/solar-system-story/mars-city/*.json.
export const PLOTS = [
  { id: 'aj-north', name: 'Junction Ridge Lot', district: 'Ares Junction', aj: [65, -65], price: 1500, blurb: 'Two minutes from the cantina. Neighbours mind their own business, mostly.' },
  { id: 'flats-scrap', name: 'Flats Scrap Lot', district: 'Red Tape Flats', aj: [-180, -66], price: 900, blurb: 'Cheap because the Saltbloods drive past it every night. Build walls.' },
  { id: 'helios-ridge', name: 'Helios Ridge Lot', district: 'Helios Heights', aj: [215, 20], price: 4000, blurb: 'Ridge-top view of the mansions. The HOA can\u2019t see you from here.' }
];

// Piece catalogue. fp = [w, d] in cells at r = 0. colliders = local AABBs [cx, cz, hw, hd] in metres, relative to the
// footprint centre, at r = 0 (the front of a piece faces +z at r = 0). max = per-plot limit.
export const PIECES = {
  wall:   { id: 'wall',   name: 'Wall',   icon: '🧱', cost: 60,   hp: 100, fp: [1, 1], max: 48, colliders: [[0, 0, 1.0, 0.25]], blurb: '2 m reinforced regolith panel.' },
  gate:   { id: 'gate',   name: 'Gate',   icon: '🚪', cost: 150,  hp: 120, fp: [1, 1], max: 8,  colliders: [[-0.9, 0, 0.12, 0.25], [0.9, 0, 0.12, 0.25]], blurb: 'Opens for you, nobody else.' },
  garage: { id: 'garage', name: 'Garage', icon: '🚗', cost: 800,  hp: 300, fp: [2, 3], max: 1,  colliders: [[0, -2.85, 2.0, 0.2], [-1.85, 0, 0.2, 3.0], [1.85, 0, 0.2, 3.0]], blurb: 'Your rover comes home here when you land.' },
  stash:  { id: 'stash',  name: 'Stash',  icon: '💰', cost: 300,  hp: 150, fp: [1, 1], max: 1,  colliders: [[0, 0, 0.65, 0.5]], blurb: 'Credits and medkits in here don\u2019t get fined when you\u2019re busted.' },
  turret: { id: 'turret', name: 'Turret', icon: '🔫', cost: 1000, hp: 200, fp: [1, 1], max: 4,  colliders: [[0, 0, 0.45, 0.45]], blurb: 'Auto-fires at security and raiders inside 32 m.', range: 32, rate: 0.9, dmg: 1 }
};
export const PIECE_IDS = Object.keys(PIECES);        // kept in sync (in place) by registerPiece
export const BUILTIN_PLOTS = PLOTS.map(p => p.id), BUILTIN_PIECES = PIECE_IDS.slice();

// ---------- add-on registry (SSX.base.registerPlot / registerPiece) ----------
// Pure: validates and normalises a def, then adds or replaces it by id (a duplicate id replaces, never throws). Built-in ids
// can't be replaced. Returns { ok, id, replaced } or { ok: false, why }. base.js wraps these, re-reads the save and redraws.
const num = (v, d) => Number.isFinite(+v) ? +v : d;
const clampI = (v, lo, hi, d) => Math.max(lo, Math.min(hi, Math.round(num(v, d))));
export function normPlot(def) {
  if (!def || typeof def !== 'object') return { ok: false, why: 'registerPlot(def): def must be an object' };
  const id = typeof def.id === 'string' && def.id.trim() ? def.id.trim() : null; if (!id) return { ok: false, why: 'registerPlot: id (string) required' };
  const at = Array.isArray(def.aj) ? def.aj : Array.isArray(def.at) ? def.at : (def.at && typeof def.at === 'object') ? [def.at.x, def.at.z] : null; // colony-relative [x, z]
  if (!at || !Number.isFinite(+at[0]) || !Number.isFinite(+at[1])) return { ok: false, why: `registerPlot(${id}): at / aj = [x, z] relative to the colony centre required` };
  return { ok: true, plot: { id, name: String(def.name || id), district: String(def.district || 'Mars'), aj: [+at[0], +at[1]], price: Math.max(0, Math.round(num(def.price, 0))),
    blurb: String(def.blurb || ''), addon: true, owner: typeof def.owned === 'function' ? def.owned : null, pieces: Array.isArray(def.pieces) ? def.pieces.map(String) : null } };
}
export function normPiece(def) {
  if (!def || typeof def !== 'object') return { ok: false, why: 'registerPiece(def): def must be an object' };
  const id = typeof def.id === 'string' && /^[a-z0-9_-]+$/i.test(def.id) ? def.id : null; if (!id) return { ok: false, why: 'registerPiece: id (letters, digits, - or _) required' };
  const fp = [clampI(def.fp?.[0] ?? def.w, 1, SIZE, 1), clampI(def.fp?.[1] ?? def.d, 1, SIZE, 1)];
  const hw = fp[0] * CELL / 2, hd = fp[1] * CELL / 2;
  const colliders = Array.isArray(def.colliders) ? def.colliders.filter(c => Array.isArray(c) && c.length === 4 && c.every(v => Number.isFinite(+v))).map(c => c.map(Number))
    : def.solid === false ? [] : [[0, 0, hw * 0.9, hd * 0.9]];
  return { ok: true, piece: { id, name: String(def.name || id), icon: String(def.icon || '📦'), cost: Math.max(0, Math.round(num(def.cost, 100))), hp: Math.max(1, Math.round(num(def.hp, 100))),
    fp, max: clampI(def.max, 1, SIZE * SIZE, 4), colliders, blurb: String(def.blurb || ''), addon: true, plots: Array.isArray(def.plots) ? def.plots.map(String) : null,
    h: Math.max(0.2, num(def.h ?? def.height, 2.4)), color: Number.isFinite(+def.color) ? +def.color : 0x8a96a8, parts: def.parts ?? null, onPlace: typeof def.onPlace === 'function' ? def.onPlace : null } };
}
export function addPlot(def) {
  const n = normPlot(def); if (!n.ok) return n; if (BUILTIN_PLOTS.includes(n.plot.id)) return { ok: false, why: `registerPlot: ${n.plot.id} is a built-in lot` };
  const k = PLOTS.findIndex(p => p.id === n.plot.id); if (k >= 0) PLOTS[k] = n.plot; else PLOTS.push(n.plot); return { ok: true, id: n.plot.id, replaced: k >= 0, plot: n.plot };
}
export function addPieceType(def) {
  const n = normPiece(def); if (!n.ok) return n; if (BUILTIN_PIECES.includes(n.piece.id)) return { ok: false, why: `registerPiece: ${n.piece.id} is a built-in piece` };
  const replaced = !!PIECES[n.piece.id]; PIECES[n.piece.id] = n.piece; if (!PIECE_IDS.includes(n.piece.id)) PIECE_IDS.push(n.piece.id); return { ok: true, id: n.piece.id, replaced, piece: n.piece };
}
// pieces allowed on a plot: built-ins everywhere unless the plot lists its own; add-on pieces where their def.plots allows
export function piecesFor(plotId) { const pl = plotById(plotId); return PIECE_IDS.filter(t => { const T = PIECES[t]; if (pl?.pieces && !pl.pieces.includes(t)) return false; return !T.plots || T.plots.includes(plotId); }); }
export const TURRET = { range: 32, rate: 0.9, dmg: 1 };

export const plotById = id => PLOTS.find(p => p.id === id) || null;
export const footprint = (type, r) => { const [w, d] = PIECES[type].fp; return (r & 1) ? [d, w] : [w, d]; };
// local (plot-centred) metres of a cell's centre, and the cell under a local point
export const cellCentre = (i, j) => ({ x: (i + 0.5) * CELL - HALF, z: (j + 0.5) * CELL - HALF });
export const cellAt = (lx, lz) => ({ i: Math.floor((lx + HALF) / CELL), j: Math.floor((lz + HALF) / CELL) });
export const inPlot = (lx, lz, margin = 0) => Math.abs(lx) <= HALF + margin && Math.abs(lz) <= HALF + margin;
// centre of a piece's footprint in local metres
export function pieceCentre(p) { const [w, d] = footprint(p.type, p.r); return { x: (p.i + w / 2) * CELL - HALF, z: (p.j + d / 2) * CELL - HALF }; }
export const yawOf = r => (r & 3) * Math.PI / 2;   // THREE rotation.y for rotation step r
export function rotXZ(x, z, r) { switch (r & 3) { case 1: return [z, -x]; case 2: return [-x, -z]; case 3: return [-z, x]; default: return [x, z]; } } // same as THREE rotation.y = yawOf(r)
// where a footprint goes when the cursor sits at local (lx, lz): centred on the cursor, snapped to the grid
export function snap(type, r, lx, lz) { const [w, d] = footprint(type, r); return { i: Math.round((lx + HALF) / CELL - w / 2), j: Math.round((lz + HALF) / CELL - d / 2) }; }
export function cellsOf(p) { const [w, d] = footprint(p.type, p.r), out = []; for (let a = 0; a < w; a++) for (let b = 0; b < d; b++) out.push([p.i + a, p.j + b]); return out; }
// colliders in local metres: [{ x0, x1, z0, z1 }]
export function collidersOf(p) {
  const c = pieceCentre(p);
  return PIECES[p.type].colliders.map(([cx, cz, hw, hd]) => { const [x, z] = rotXZ(cx, cz, p.r), [w, d] = (p.r & 1) ? [hd, hw] : [hw, hd]; return { x0: c.x + x - w, x1: c.x + x + w, z0: c.z + z - d, z1: c.z + z + d }; });
}
export function pieceAt(state, i, j) { for (const p of state.pieces) for (const [a, b] of cellsOf(p)) if (a === i && b === j) return p; return null; }

// ---------- per-plot state ----------
export const emptyPlot = () => ({ owned: false, pieces: [], stash: { credits: 0, medkits: 0 }, nextId: 1, boughtAt: 0 });
export function freshSave() { const s = { v: 1, plots: {} }; for (const p of PLOTS) s.plots[p.id] = emptyPlot(); return s; }
// repairs partial / corrupt / older data; never throws
// Unknown plot ids and piece types are kept verbatim (s.plots[id] / plot.later) so an add-on that registers after the save
// loads gets its data back: base.js re-runs migrate on its own state after every register call.
export function migrate(raw) {
  const s = freshSave(); if (!raw || typeof raw !== 'object') return s;
  for (const [id, o] of Object.entries(raw.plots && typeof raw.plots === 'object' ? raw.plots : {})) if (!plotById(id) && o && typeof o === 'object' && /^[\w-]{1,40}$/.test(id) && (o.owned || o.pieces?.length)) s.plots[id] = JSON.parse(JSON.stringify(o));
  for (const p of PLOTS) {
    const o = raw.plots?.[p.id]; if (!o || typeof o !== 'object') continue; const t = s.plots[p.id];
    t.owned = !!o.owned; t.boughtAt = +o.boughtAt || 0;
    t.stash = { credits: Math.max(0, Math.floor(+o.stash?.credits || 0)), medkits: Math.max(0, Math.floor(+o.stash?.medkits || 0)) };
    let maxId = 0; const later = [];
    for (const q of [...(Array.isArray(o.pieces) ? o.pieces : []), ...(Array.isArray(o.later) ? o.later : [])]) {
      if (q && typeof q.type === 'string' && !PIECES[q.type] && later.length < PIECE_CAP) { later.push({ ...q }); maxId = Math.max(maxId, +q.id || 0); continue; }
      if (!q || !PIECES[q.type]) continue;
      const pc = { id: Number.isFinite(+q.id) && +q.id > 0 ? +q.id : 0, type: q.type, i: q.i | 0, j: q.j | 0, r: (q.r | 0) & 3, hp: Number.isFinite(+q.hp) ? Math.max(1, Math.min(PIECES[q.type].hp, +q.hp)) : PIECES[q.type].hp };
      if ((!t.owned && !p.owner) || !canPlace({ ...t, owned: true }, pc.type, pc.i, pc.j, pc.r, { free: true }).ok) continue; // drop overlaps / out-of-grid (add-on lots keep theirs while unowned)
      if (!pc.id || t.pieces.some(x => x.id === pc.id)) pc.id = 0;
      t.pieces.push(pc); maxId = Math.max(maxId, pc.id);
    }
    for (const pc of t.pieces) if (!pc.id) pc.id = ++maxId;
    if (later.length) t.later = later; // piece types whose add-on hasn't registered (yet)
    t.nextId = Math.max(+o.nextId || 1, maxId + 1);
  }
  return s;
}
export function load(ls) { try { return migrate(JSON.parse(ls.getItem(SAVE_KEY))); } catch (e) { return freshSave(); } }
export function save(ls, s) { try { ls.setItem(SAVE_KEY, JSON.stringify(s)); return true; } catch (e) { return false; } }

// placement check. opts: { credits (number, omit = don't check), free (skip cost + caps) }
export function canPlace(state, type, i, j, r, opts = {}) {
  const T = PIECES[type]; if (!T) return { ok: false, why: 'Unknown piece' };
  if (opts.plotId && !piecesFor(opts.plotId).includes(type)) return { ok: false, why: 'Can\u2019t build that on this lot' };
  if (!state.owned) return { ok: false, why: 'Buy the lot first' };
  const [w, d] = footprint(type, r);
  if (i < 0 || j < 0 || i + w > SIZE || j + d > SIZE) return { ok: false, why: 'Off your lot' };
  for (let a = 0; a < w; a++) for (let b = 0; b < d; b++) if (pieceAt(state, i + a, j + b)) return { ok: false, why: 'Something\u2019s already there' };
  if (!opts.free) {
    if (state.pieces.length >= PIECE_CAP) return { ok: false, why: `Lot is full (${PIECE_CAP} pieces)` };
    if (state.pieces.filter(p => p.type === type).length >= T.max) return { ok: false, why: `Max ${T.max} ${T.name.toLowerCase()}${T.max > 1 ? 's' : ''} per lot` };
    if (opts.credits != null && opts.credits < T.cost) return { ok: false, why: `Short ${T.cost - opts.credits} cr` };
  }
  return { ok: true, why: '', cost: T.cost };
}
export function addPiece(state, type, i, j, r) { const p = { id: state.nextId++, type, i, j, r: r & 3, hp: PIECES[type].hp }; state.pieces.push(p); return p; }
export function removePiece(state, id) { const k = state.pieces.findIndex(p => p.id === id); if (k < 0) return null; return state.pieces.splice(k, 1)[0]; }
export const refundOf = p => Math.floor(PIECES[p.type].cost * REFUND * (p.hp / PIECES[p.type].hp));

// circle (player / car) vs piece colliders, local metres. Returns the push-out { x, z } or null. gates are open to you.
export function pushOut(state, lx, lz, rad) {
  let x = lx, z = lz, hit = false;
  for (const p of state.pieces) for (const b of collidersOf(p)) {
    const qx = Math.max(b.x0, Math.min(x, b.x1)), qz = Math.max(b.z0, Math.min(z, b.z1)), dx = x - qx, dz = z - qz, d2 = dx * dx + dz * dz;
    if (d2 >= rad * rad) continue; hit = true;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (rad - d) / d; x += dx * k; z += dz * k; }
    else { // centre inside the box: leave by the nearest face
      const opts = [[b.x0 - rad - x, 0], [b.x1 + rad - x, 0], [0, b.z0 - rad - z], [0, b.z1 + rad - z]].sort((u, v) => Math.hypot(...u) - Math.hypot(...v));
      x += opts[0][0]; z += opts[0][1];
    }
  }
  return hit ? { x, z } : null;
}
// best target for a turret at local (tx, tz): nearest within range. targets: [{ x, z }] local
export function pickTarget(tx, tz, targets, range = TURRET.range) {
  let best = null, bd = range;
  for (const t of targets) { const d = Math.hypot(t.x - tx, t.z - tz); if (d < bd) { bd = d; best = t; } }
  return best;
}
export function summary(state) { const n = {}; for (const p of state.pieces) n[p.type] = (n[p.type] || 0) + 1; return n; }
