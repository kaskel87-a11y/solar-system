// Stuck? help (pure; runtime in help/stuck.js). One plain-word hint for the step you're on, and when a step has sat still
// for STALL_S or its target is gone / can't be reached, a no-penalty way out (skip the step or quit the job).
export const STALL_S = 180;
export const KEY = 'Digit6', KEY_LABEL = '6'; // H is "fly back to the ship" (index.html), every letter is taken: 6 is free outside base-build mode

// steps whose target is a place you go to (the ◆ waypoint); defeat = red ◆ over each foe; none = nothing on the map by design
export function markerKind(type) {
  if (type === 'defeat') return 'foes';
  if (type === 'race') return 'gate';
  if (type === 'collect') return 'items';
  if (type === 'clean' || type === 'choice') return 'none';
  return 'place'; // goto, return, enter, crack, take, any add-on type with an `at`
}

// which way, in plain words, relative to where you face (yaw: 0 = looking down -z, same frame as hud/hudx.js)
export function dirWord(dx, dz, yaw = 0) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), sx = dx * cy - dz * sy, sz = dx * sy + dz * cy;
  const d = Math.atan2(sx, -sz) * 180 / Math.PI, A = Math.abs(d);
  return A < 22 ? 'straight ahead' : A > 150 ? 'behind you' : A < 70 ? (d > 0 ? 'ahead on your right' : 'ahead on your left')
    : A < 115 ? (d > 0 ? 'to your right' : 'to your left') : (d > 0 ? 'behind you on the right' : 'behind you on the left');
}
export function howFar(d) {
  if (!Number.isFinite(d)) return '';
  if (d < 12) return 'right here';
  if (d < 1000) return `about ${Math.max(10, Math.round(d / 10) * 10)} m`;
  return `about ${(d / 1000).toFixed(1)} km`;
}
const clean = t => String(t || '').replace(/\s*\((?:◆|red dots|\d+\s*\/\s*\d+|\d+%)\)/g, '').replace(/\s+/g, ' ').trim();
const cap = t => t ? t[0].toUpperCase() + t.slice(1) : t;
const end = t => /[.!?]$/.test(t) ? t : t + '.';

// o: { what, how, kind: place|foes|items|gate|none|job|farm, name, me:{x,z,yaw}, target:{x,z}, foes:[{x,z}], left, total, inside, missing, unreachable }
export function hint(o = {}) {
  const what = end(cap(clean(o.what) || 'Follow the ◆'));
  const me = o.me || { x: 0, z: 0, yaw: 0 };
  if (o.missing) return `${what} I can't find the target right now. Tap Skip this step or Quit job; neither costs you anything.`;
  if (o.kind === 'foes' && o.foes?.length) {
    let n = null, bd = Infinity; for (const f of o.foes) { const d = Math.hypot(f.x - me.x, f.z - me.z); if (d < bd) { bd = d; n = f; } }
    const left = o.left ?? o.foes.length, who = left === 1 ? 'One left' : `${left} left`;
    const where = bd < 12 ? 'right next to you' : `${howFar(bd)} ${dirWord(n.x - me.x, n.z - me.z, me.yaw)}`;
    return `${what} ${who}, the nearest ${where}. Look for the red ◆ over ${left === 1 ? 'its head' : 'their heads'} and the red dot${left === 1 ? '' : 's'} on the map.`;
  }
  if (o.kind === 'foes') { // the wave hasn't shown up yet: they come when you get close
    const t = o.target; if (!t) return `${what} They show up when you get close to the ◆.`;
    const d = Math.hypot(t.x - me.x, t.z - me.z);
    return `${what} Go to the ◆, ${howFar(d)} ${dirWord(t.x - me.x, t.z - me.z, me.yaw)}${o.name ? ` (${o.name})` : ''}. They show up when you get close.`;
  }
  if (o.kind === 'none') return `${what}${o.how ? ' ' + end(cap(clean(o.how))) : ''}`;
  const t = o.target; if (!t) return `${what}${o.how ? ' ' + end(cap(clean(o.how))) : ''}`;
  const d = Math.hypot(t.x - me.x, t.z - me.z), mark = o.kind === 'gate' ? 'the next ring' : o.kind === 'farm' ? 'the yellow beacon' : 'the ◆';
  if (d < 12) return `${what} You're there${o.name ? `: ${o.name}` : ''}.${o.how ? ' ' + end(cap(clean(o.how))) : ''}`;
  return `${what} Head ${dirWord(t.x - me.x, t.z - me.z, me.yaw)}, ${howFar(d)}, to ${o.name || mark}. Follow ${mark} and the ➤ arrow.`;
}

// stall tracker: call with the current step key every so often; returns how long it has sat still (s)
export function createStall() { return { key: null, since: 0 }; }
export function stallTick(S, key, now) {
  if (key !== S.key) { S.key = key; S.since = now; }
  return key == null ? 0 : (now - S.since);
}
export const offerOut = ({ stillS = 0, missing = false, unreachable = false } = {}) => missing || unreachable || stillS >= STALL_S;

// what Stuck? can do for each kind of card (skip needs a step to move past; the farm guide's "quit" hides it)
export function actionsFor(src) {
  if (src === 'quest' || src === 'side') return { skip: true, quit: true, quitLabel: 'Quit job' };
  if (src === 'job' || src === 'turf') return { skip: false, quit: true, quitLabel: src === 'turf' ? 'Retreat' : 'Quit job' };
  if (src === 'farm') return { skip: false, quit: true, quitLabel: 'Hide the farm guide' };
  return { skip: false, quit: false };
}
