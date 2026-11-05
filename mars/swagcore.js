// Planum Swag (v7.5.68): pure shop rules for Slick's stall at Planum Australe. No DOM, no three.js.
// Threads are snow outfits (mars/skinscore.js, venue 'planum'). Boards, balls, cartoon drugs and liquor,
// plus a short ban / fine for insulting the stall. tests/test-icecap-unit.mjs covers the money and the ban.
import { CX, SPOTS } from './icecapcore.js';
import { BY_ID as SKIN } from './skinscore.js';

export const SAVE_KEY = 'ssx.swag.v1';
export const FINE = 180;
export const BAN_MS = 90 * 1000; // real time. Long enough to notice, short enough to walk it off.
export const STACK = 5;
export const SPOT = { x: CX + 20, z: 950 };
export const NEAR = 4.2;
export const BENNY_NEAR = 4.5;

const thread = id => {
  const k = SKIN[id];
  return { id, kind: 'thread', name: k.name, price: k.price, icon: k.icon, blurb: k.blurb, skin: id };
};
export const CATALOG = [
  thread('frostbib'),
  thread('pipeduds'),
  thread('nightrun'),
  { id: 'dustrunner', kind: 'board', name: 'Dust Runner', price: 220, icon: '🏂', blurb: 'Orange base. Pops a little higher off the lip.', deck: 0xc45a28, stripe: 0xf2e6c8, ride: { ollie: 0.06 } },
  { id: 'piperat', kind: 'board', name: 'Pipe Rat', price: 480, icon: '🏂', blurb: 'Black deck, cyan rail. Spins a touch quicker.', deck: 0x141416, stripe: 0x3cf0ff, ride: { spin: 0.08 } },
  { id: 'nighthall', kind: 'board', name: 'Night Haul', price: 760, icon: '🏂', blurb: 'Purple night board. A little more top end.', deck: 0x2a1848, stripe: 0xff4ad4, ride: { vmax: 1.5 } },
  { id: 'slug', kind: 'ball', name: 'Colony Slug', price: 120, icon: '🟢', blurb: 'Heavy green sludge-ball. Straighter on bad ice.', color: 0x6a8a4a, bowl: { steady: 0.35 } },
  { id: 'guttergod', kind: 'ball', name: 'Gutter God', price: 260, icon: '⚫', blurb: 'Black rock. Hooks a little harder.', color: 0x1a1a1c, bowl: { hook: 0.18 } },
  { id: 'redeye', kind: 'ball', name: 'Red Eye', price: 420, icon: '🔴', blurb: 'Chipped red ice. A bit more pop off the hand.', color: 0xc81e1e, bowl: { pop: 0.05 } },
  { id: 'polarlager', kind: 'liquor', name: 'Polar Lager', price: 20, icon: '🍺', blurb: 'Flat, cold, tastes like a radiator. Light buzz.', fx: 'buzz', secs: 18 },
  { id: 'frostshine', kind: 'liquor', name: 'Frost Shine', price: 35, icon: '🥃', blurb: 'Bathtub shine from the hut. Warm, then the world tilts.', fx: 'buzz', secs: 26 },
  { id: 'blackcap', kind: 'liquor', name: 'Black Cap', price: 50, icon: '🍸', blurb: 'Sweet, illegal, and it makes a bad idea feel brave.', fx: 'courage', secs: 20 },
  { id: 'reddust', kind: 'drug', name: 'Red Dust', price: 40, icon: '💊', blurb: 'A pinch of crater dust. You feel ten feet tall. Briefly.', fx: 'courage', secs: 22 },
  { id: 'glowmoss', kind: 'drug', name: 'Glow Moss', price: 60, icon: '🌿', blurb: 'Dried moss off a dome rack. The lane goes wavy.', fx: 'wobble', secs: 24 }
];
export const BY_ID = Object.fromEntries(CATALOG.map(it => [it.id, it]));
export const HOUSE_BALL = { id: 'house', kind: 'ball', name: 'House Boulder', price: 0, icon: '🪨', blurb: 'Benny\'s frozen boulder. Free, crooked, classic.', color: 0xa9c9de, bowl: {} };
export const MOUTHS = {
  slick: { id: 'slick', who: 'Slick', line: 'Your stall smells like a melted boot.' },
  pebble: { id: 'pebble', who: 'Pebble', line: 'Nice goggles. Did a visor throw up on your face?' }
};

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const num = v => typeof v === 'number' && Number.isFinite(v) ? v : 0;
const ids = (a, kind) => [...new Set((Array.isArray(a) ? a : []).filter(id => BY_ID[id]?.kind === kind))];

export function fresh() { return { v: 1, threads: [], boards: [], balls: [], board: null, ball: null, wear: null, bag: {}, banUntil: 0, fines: 0, insults: 0, fx: null }; }
export function norm(raw) {
  const s = fresh(); if (!raw || typeof raw !== 'object') return s;
  s.threads = ids(raw.threads, 'thread');
  s.boards = ids(raw.boards, 'board');
  s.balls = ids(raw.balls, 'ball');
  s.board = s.boards.includes(raw.board) ? raw.board : (s.boards[0] || null);
  s.ball = s.balls.includes(raw.ball) ? raw.ball : null;
  s.wear = s.threads.includes(raw.wear) ? raw.wear : null;
  const bag = {};
  if (raw.bag && typeof raw.bag === 'object') for (const [id, n] of Object.entries(raw.bag)) {
    const it = BY_ID[id]; if (!it || (it.kind !== 'drug' && it.kind !== 'liquor')) continue;
    const q = Math.round(num(n)); if (q > 0) bag[id] = Math.min(STACK, q);
  }
  s.bag = bag;
  s.banUntil = Math.max(0, num(raw.banUntil));
  s.fines = Math.max(0, Math.round(num(raw.fines)));
  s.insults = Math.max(0, Math.round(num(raw.insults)));
  if (raw.fx && BY_ID[raw.fx.id] && num(raw.fx.until) > 0) s.fx = { id: raw.fx.id, kind: BY_ID[raw.fx.id].fx, name: BY_ID[raw.fx.id].name, until: num(raw.fx.until) };
  return s;
}
export function parse(str) { try { return norm(JSON.parse(str)); } catch (e) { return fresh(); } }

export const banned = (s, now) => num(s?.banUntil) > num(now);
export const banLeft = (s, now) => Math.max(0, num(s?.banUntil) - num(now));
export function fmtLeft(ms) { const s = Math.max(0, Math.ceil(num(ms) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
export const hasBoard = s => (s?.boards?.length || 0) > 0;
// Benny's 50 cr rental stays the fallback until you own a deck.
export const needsRent = (s, rented) => !rented && !hasBoard(s);
export function equippedBoard(s) { const id = s?.board && s.boards?.includes(s.board) ? s.board : (s?.boards?.[0] || null); return id ? BY_ID[id] : null; }
export function equippedBall(s) { return s?.ball && BY_ID[s.ball]?.kind === 'ball' ? BY_ID[s.ball] : HOUSE_BALL; }
export const boardLook = s => { const b = equippedBoard(s); return b ? { id: b.id, deck: b.deck, stripe: b.stripe } : null; };
export const ballLook = s => { const b = equippedBall(s); return { id: b.id, color: b.color }; };
export const rideOf = s => equippedBoard(s)?.ride || null;
export const bowlOf = s => equippedBall(s)?.bowl || {};
export function clearOfLane() {
  const b = SPOTS.benny, f = SPOTS.foul, r = SPOTS.rival;
  const d = (p) => Math.hypot(SPOT.x - p.x, SPOT.z - p.z);
  return d(b) > NEAR + BENNY_NEAR && d(f) > NEAR + 4 && d(r) > NEAR + 3.2;
}

const banBlock = (s, now) => banned(s, now) ? { ok: false, why: 'banned', left: banLeft(s, now), fine: FINE } : null;
const copy = s => ({ ...s, threads: s.threads.slice(), boards: s.boards.slice(), balls: s.balls.slice(), bag: { ...s.bag }, fx: s.fx ? { ...s.fx } : null });

export function buy(s, id, credits, now) {
  const held = norm(s); const stop = banBlock(held, now); if (stop) return stop;
  const it = BY_ID[id]; if (!it) return { ok: false, why: 'unknown' };
  const cr = num(credits); if (cr < it.price) return { ok: false, why: 'broke', need: it.price - cr, price: it.price };
  const next = copy(held);
  if (it.kind === 'drug' || it.kind === 'liquor') {
    const n = next.bag[id] || 0; if (n >= STACK) return { ok: false, why: 'full', price: it.price };
    next.bag[id] = n + 1;
  } else {
    const key = it.kind === 'thread' ? 'threads' : it.kind === 'board' ? 'boards' : 'balls';
    if (next[key].includes(id)) return { ok: false, why: 'owned', price: it.price };
    next[key] = [...next[key], id];
    if (it.kind === 'thread') next.wear = id;
    if (it.kind === 'board') next.board = id;
    if (it.kind === 'ball') next.ball = id;
  }
  return { ok: true, price: it.price, item: it, state: next };
}

export function equip(s, id, now) {
  const held = norm(s); const stop = banBlock(held, now); if (stop) return stop;
  if (id === 'house') return { ok: true, state: { ...copy(held), ball: null }, id: 'house' };
  const it = BY_ID[id]; if (!it || it.kind === 'drug' || it.kind === 'liquor') return { ok: false, why: 'unknown' };
  const key = it.kind === 'thread' ? 'threads' : it.kind === 'board' ? 'boards' : 'balls';
  if (!held[key].includes(id)) return { ok: false, why: 'need' };
  const next = copy(held);
  if (it.kind === 'thread') next.wear = id;
  if (it.kind === 'board') next.board = id;
  if (it.kind === 'ball') next.ball = id;
  return { ok: true, state: next, id };
}

export function useItem(s, id, now) {
  const held = norm(s); const stop = banBlock(held, now); if (stop) return stop;
  const it = BY_ID[id]; if (!it || (it.kind !== 'drug' && it.kind !== 'liquor')) return { ok: false, why: 'unknown' };
  const n = held.bag[id] || 0; if (n < 1) return { ok: false, why: 'none' };
  const next = copy(held); next.bag = { ...next.bag, [id]: n - 1 }; if (next.bag[id] <= 0) delete next.bag[id];
  const t = num(now), add = it.secs * 1000, prev = held.fx && held.fx.until > t ? held.fx.until : t;
  next.fx = { id, kind: it.fx, name: it.name, until: Math.min(t + 40000, prev + add) };
  return { ok: true, state: next, fx: next.fx, item: it };
}

export function insult(s, who, now) {
  const held = norm(s); const stop = banBlock(held, now); if (stop) return { ...stop, who: MOUTHS[who]?.who || '' };
  const mouth = MOUTHS[who]; if (!mouth) return { ok: false, why: 'unknown' };
  const t = num(now);
  const next = copy(held); next.insults += 1; next.banUntil = t + BAN_MS;
  return { ok: true, state: next, who: mouth.who, line: mouth.line, until: next.banUntil, fine: FINE, left: BAN_MS };
}

// Pay the fine to clear a live ban, or up front so the insult never sticks.
export function payFine(s, credits, now, avoid = false) {
  const held = norm(s); const active = banned(held, now);
  if (!active && !avoid) return { ok: false, why: 'clear' };
  const cr = num(credits); if (cr < FINE) return { ok: false, why: 'broke', need: FINE - cr, fine: FINE };
  const next = copy(held); next.banUntil = 0; next.fines += 1;
  if (avoid && !active) next.insults += 1;
  return { ok: true, price: FINE, avoided: !active, state: next };
}

export function fxActive(s, now) { const fx = norm(s).fx; return fx && fx.until > num(now) ? fx : null; }
export function fxView(s, now) {
  const fx = fxActive(s, now); if (!fx) return null;
  const left = fx.until - num(now);
  if (fx.kind === 'wobble') return { kind: fx.kind, name: fx.name, left, chip: `WOBBLE · ${fx.name}` };
  if (fx.kind === 'courage') return { kind: fx.kind, name: fx.name, left, chip: `COURAGE · ${fx.name}` };
  return { kind: 'buzz', name: fx.name, left, chip: `BUZZ · ${fx.name}` };
}

const qty = (s, it) => (it.kind === 'drug' || it.kind === 'liquor') ? (s.bag[it.id] || 0) : 0;
const ownedGear = (s, it) => it.kind === 'thread' ? s.threads.includes(it.id) : it.kind === 'board' ? s.boards.includes(it.id) : it.kind === 'ball' ? s.balls.includes(it.id) : qty(s, it) > 0;
const worn = (s, it) => it.kind === 'thread' ? s.wear === it.id : it.kind === 'board' ? s.board === it.id : it.kind === 'ball' ? s.ball === it.id : false;
export function rows(s, credits, now) {
  const held = norm(s), ban = banned(held, now), cr = num(credits);
  const gear = CATALOG.map(it => ({ id: it.id, kind: it.kind, name: it.name, icon: it.icon, price: it.price, blurb: it.blurb, qty: qty(held, it), owned: ownedGear(held, it), worn: worn(held, it), afford: cr >= it.price, ban }));
  const house = { id: 'house', kind: 'ball', name: HOUSE_BALL.name, icon: HOUSE_BALL.icon, price: 0, blurb: HOUSE_BALL.blurb, qty: 0, owned: true, worn: !held.ball, afford: true, ban };
  const i = gear.findIndex(r => r.kind === 'ball');
  gear.splice(i < 0 ? gear.length : i, 0, house);
  return gear;
}
export function prompt(s, now) {
  const held = norm(s), on = banned(held, now), left = banLeft(held, now);
  return {
    at: SPOT, near: NEAR,
    label: on ? `🚫 Banned · ${fmtLeft(left)}` : '🛍️ Planum Swag',
    sub: on ? `pay ${FINE} cr fine` : 'threads · boards · trouble'
  };
}
