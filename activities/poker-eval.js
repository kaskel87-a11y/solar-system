// Texas Hold'em hand evaluator — pure, no DOM. Ranks: 0=2 .. 12=A. Suits: 0..3.
export const RANKS = '23456789TJQKA';
export const SUITS = 'cdhs';
export const HAND_NAMES = [
  'High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight',
  'Flush', 'Full house', 'Four of a kind', 'Straight flush', 'Royal flush',
];

export function card(r, s) { return (r << 2) | s; }
export function rank(c) { return c >> 2; }
export function suit(c) { return c & 3; }
export function cardLabel(c) { return RANKS[rank(c)] + SUITS[suit(c)]; }

export function freshDeck(rng = Math.random) {
  const d = [];
  for (let r = 0; r < 13; r++) for (let s = 0; s < 4; s++) d.push(card(r, s));
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

/** Score a 5-card hand → [category 0..9, kicker ints…] higher is better (lexicographic). */
export function eval5(cards) {
  if (cards.length !== 5) throw new Error('eval5 needs 5 cards');
  const rs = cards.map(rank).sort((a, b) => b - a);
  const ss = cards.map(suit);
  const counts = new Array(13).fill(0);
  for (const r of rs) counts[r]++;
  const byCount = [];
  for (let r = 12; r >= 0; r--) if (counts[r]) byCount.push([counts[r], r]);
  byCount.sort((a, b) => b[0] - a[0] || b[1] - a[1]);

  const flush = ss.every(s => s === ss[0]);
  // Straight (wheel A-2-3-4-5)
  const uniq = [...new Set(rs)].sort((a, b) => b - a);
  let straightHigh = -1;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    else if (uniq[0] === 12 && uniq[1] === 3 && uniq[2] === 2 && uniq[3] === 1 && uniq[4] === 0) straightHigh = 3; // 5-high
  } else if (uniq.length >= 5) {
    // not used for exact 5 with dupes
  }
  // With pairs uniq.length < 5; recompute straight on unique only
  if (uniq.length >= 5) {
    for (let i = 0; i <= uniq.length - 5; i++) {
      const slice = uniq.slice(i, i + 5);
      if (slice[0] - slice[4] === 4) { straightHigh = slice[0]; break; }
    }
    if (straightHigh < 0 && uniq.includes(12) && uniq.includes(0) && uniq.includes(1) && uniq.includes(2) && uniq.includes(3)) {
      straightHigh = 3;
    }
  }

  const c0 = byCount[0][0], r0 = byCount[0][1];
  const c1 = byCount[1]?.[0] || 0, r1 = byCount[1]?.[1] || 0;

  if (flush && straightHigh >= 0) {
    if (straightHigh === 12) return [9, 12]; // royal
    return [8, straightHigh];
  }
  if (c0 === 4) return [7, r0, r1];
  if (c0 === 3 && c1 === 2) return [6, r0, r1];
  if (flush) return [5, ...rs];
  if (straightHigh >= 0) return [4, straightHigh];
  if (c0 === 3) return [3, r0, ...byCount.slice(1).map(x => x[1])];
  if (c0 === 2 && c1 === 2) {
    const high = Math.max(r0, r1), low = Math.min(r0, r1);
    const kicker = byCount[2][1];
    return [2, high, low, kicker];
  }
  if (c0 === 2) return [1, r0, ...byCount.slice(1).map(x => x[1])];
  return [0, ...rs];
}

export function cmpScore(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return d;
  }
  return 0;
}

/** Best 5-card score from 5–7 cards. */
export function evalBest(cards) {
  if (cards.length < 5) throw new Error('need ≥5 cards');
  if (cards.length === 5) { const score = eval5(cards); return { score, name: HAND_NAMES[score[0]], category: score[0] }; }
  let best = null;
  const n = cards.length;
  const pick = (start, chosen) => {
    if (chosen.length === 5) {
      const s = eval5(chosen);
      if (!best || cmpScore(s, best) > 0) best = s;
      return;
    }
    for (let i = start; i < n; i++) {
      chosen.push(cards[i]);
      pick(i + 1, chosen);
      chosen.pop();
    }
  };
  pick(0, []);
  return { score: best, name: HAND_NAMES[best[0]], category: best[0] };
}

/** 0..1 strength heuristic for AI (category + kickers). */
export function strength01(score) {
  const cat = score[0];
  const frac = (score[1] || 0) / 12;
  return Math.min(1, (cat + frac * 0.9) / 9);
}

/** Equity-ish vs random boards is expensive; use hand category for preflop/postflop AI. */
export function handName(score) { return HAND_NAMES[score[0]] || '?'; }
