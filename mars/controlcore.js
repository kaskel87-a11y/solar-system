// mars/controlcore.js: pure scheduler for Control's Mars job offers (mars/control.js). No DOM, no game access.
// Timing (seconds of real play while idle on the Mars surface):
//   first   ~20 s after you land on Mars
//   after   ~20 s after a job ends (finished, failed or dropped: any busy -> idle change)
//   every   30-45 s (random) between offers while you stay idle, and after an offer times out unanswered
//   later   ~45 s snooze after you tap Later
//   wayp    75 s after an Accept that only sets a waypoint (smuggling pad, farm chores), so you can get there
// No cap: offers keep coming while you're idle. Exactly one offer on screen at a time: nothing fires while any radio is up.
export const TIMES = { first: 20, after: 20, every: [30, 45], later: 45, wayp: 75 };

export function fresh() { return { next: null, wasBusy: false, onMars: false, pending: null, offers: 0, accepts: 0, laters: 0, expired: 0, lastKey: null, bag: [] }; }
export const between = (r, rnd = Math.random) => Array.isArray(r) ? r[0] + (r[1] - r[0]) * rnd() : r;

// one scheduler step. Returns 'offer' when it's time to radio a job (the caller then calls shown() or resolve(s,'none')).
export function step(s, { dt = 0, onMars = false, busy = null, radioUp = false, T = TIMES } = {}) {
  if (!onMars) { s.onMars = false; s.next = null; s.wasBusy = false; return null; }
  if (!s.onMars) { s.onMars = true; s.next = T.first; s.wasBusy = false; }
  if (s.pending) return null;                       // one offer at a time; the caller resolves it
  if (busy) { s.wasBusy = true; return null; }      // the clock holds while you're busy
  if (s.wasBusy) { s.wasBusy = false; s.next = T.after; }
  if (s.next == null) s.next = T.first;
  s.next -= Math.max(0, Math.min(dt, 1));
  if (s.next <= 0 && !radioUp) return 'offer';      // someone else on the radio: wait for it to clear (never stack)
  return null;
}
export function shown(s, offer) { s.pending = { key: offer.key, id: offer.id, text: offer.text }; s.offers++; s.lastKey = offer.key; }
// how: 'later' | 'started' | 'waypoint' | 'expired' | 'none' (no job to offer right now / accept failed)
// age = seconds the offer was on screen: an ignored offer counts toward the 30-45 s gap (offers start 30-45 s apart).
export function resolve(s, how, { T = TIMES, rnd = Math.random, age = 0 } = {}) {
  s.pending = null;
  if (how === 'later') { s.laters++; s.next = T.later; }
  else if (how === 'started') { s.accepts++; s.next = T.after; }
  else if (how === 'waypoint') { s.accepts++; s.next = T.wayp; }
  else if (how === 'expired') { s.expired++; s.next = Math.max(5, between(T.every, rnd) - Math.max(0, age)); }
  else s.next = between(T.every, rnd);
  return s.next;
}
// pick the next offer key: a shuffled bag of what's available now, never the same job twice in a row (unless it's the only one)
export function pick(s, keys, rnd = Math.random) {
  if (!keys.length) return null;
  s.bag = s.bag.filter(k => keys.includes(k));
  if (!s.bag.length) { s.bag = [...keys]; for (let i = s.bag.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [s.bag[i], s.bag[j]] = [s.bag[j], s.bag[i]]; } }
  let i = s.bag.findIndex(k => k !== s.lastKey); if (i < 0) i = 0;
  return s.bag.splice(i, 1)[0];
}
