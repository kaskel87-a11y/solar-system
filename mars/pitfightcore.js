// Pit fight rules (v7.5.107). Pure: no DOM, no three.js. The stick is camera-relative, the same
// way walking works outside the cage. A bout is one round, about 75 seconds, with stamina,
// a punch-punch-hold combo, a dodge, a parry, and a charged finisher.
export const ROUND_S = 75;
export const STAMINA = 100;
export const COST = { punch: 8, kick: 14, dodge: 22, block: 16, special: 40 };
export const IFRAME = 0.32;
export const PARRY = 0.18;
export const CHARGE = 0.45;
export const COMBO_GAP = 0.55;
export const STYLES = {
  brawler: { name: 'Brawler', wind: 0.72, line: 'Big slow swings. Step out, then counter.' },
  swarmer: { name: 'Swarmer', wind: 0.34, line: 'Fast hands. Block early or back off.' },
  counter: { name: 'Counter', wind: 0.58, line: 'Waits, then lunges. Do not swing first.' }
};

// Stick: x is right, y is down (the on-screen joystick). Up on the stick moves the way the camera looks.
export function stickWorld(jx, jy, viewYaw) {
  let mvx = +jx || 0, mvz = -(+jy || 0);
  const len = Math.hypot(mvx, mvz);
  if (len > 1) { mvx /= len; mvz /= len; }
  const fx = -Math.sin(viewYaw), fz = -Math.cos(viewYaw);
  const rx = Math.cos(viewYaw), rz = -Math.sin(viewYaw);
  return { x: fx * mvz + rx * mvx, z: fz * mvz + rz * mvx, len: Math.min(1, len) };
}

export function styleOf(name = '') {
  const keys = Object.keys(STYLES);
  let h = 0; for (const c of String(name)) h = (h + c.charCodeAt(0)) % keys.length;
  return keys[h];
}

export function fresh(name = '') {
  const style = styleOf(name);
  return { sta: STAMINA, regen: 0, combo: 0, comboT: 0, dodge: 0, block: 0, blockT: 0, charge: 0, down: 0, shake: 0, cheer: '', t: 0, style, wind: STYLES[style].wind };
}

export function tick(s, dt, blocking) {
  if (!s) return s;
  s.t += dt;
  s.comboT = Math.max(0, s.comboT - dt);
  if (s.comboT <= 0) s.combo = 0;
  s.dodge = Math.max(0, s.dodge - dt);
  s.down = Math.max(0, s.down - dt);
  s.shake = Math.max(0, s.shake - dt);
  if (s.cheer) { s.cheerT = (s.cheerT || 0) - dt; if (s.cheerT <= 0) s.cheer = ''; }
  if (blocking) { s.blockT += dt; s.sta = Math.max(0, s.sta - COST.block * dt); if (s.sta <= 0) s.block = 0; }
  else { s.block = 0; s.blockT = 0; s.sta = Math.min(STAMINA, s.sta + 14 * dt); }
  if (s.charge > 0) s.charge += dt;
  return s;
}

function spend(s, n) { if (s.sta < n || s.down > 0) return false; s.sta -= n; return true; }

// A punch. The third press inside the combo window, held, is the finisher.
export function punch(s, held = false) {
  if (!s || s.dodge > 0) return { ok: false };
  if (s.comboT <= 0) s.combo = 0;
  const finisher = held && s.combo >= 2;
  if (!spend(s, finisher ? COST.special : COST.punch)) return { ok: false, why: 'Out of wind.' };
  s.combo = finisher ? 0 : s.combo + 1;
  s.comboT = COMBO_GAP;
  if (finisher) { s.shake = 0.28; s.cheer = 'COMBO'; s.cheerT = 1.2; }
  return { ok: true, finisher, step: finisher ? 3 : s.combo, dmg: finisher ? 2.4 : 1 };
}

export function kick(s) {
  if (!s || !spend(s, COST.kick)) return { ok: false, why: 'Out of wind.' };
  s.combo = 0; s.shake = 0.16; s.cheer = 'KICK'; s.cheerT = 0.8;
  return { ok: true, kick: true, dmg: 1.35 };
}

export function dodge(s) {
  if (!s || s.dodge > 0 || !spend(s, COST.dodge)) return { ok: false, why: 'Out of wind.' };
  s.dodge = IFRAME; s.block = 0;
  return { ok: true };
}

export function blockDown(s) { if (s && s.sta > 0) { s.block = 1; s.blockT = 0; } return !!s?.block; }
export function blockUp(s) { if (s) { s.block = 0; s.blockT = 0; } }

export function chargeStart(s) { if (!s || s.sta < COST.special) return false; s.charge = 0.001; return true; }
export function chargeRelease(s) {
  if (!s || !(s.charge >= CHARGE)) { if (s) s.charge = 0; return { ok: false }; }
  if (!spend(s, COST.special)) { s.charge = 0; return { ok: false, why: 'Out of wind.' }; }
  s.charge = 0; s.shake = 0.4; s.cheer = 'FINISH'; s.cheerT = 1.4;
  return { ok: true, special: true, dmg: 3 };
}

// Their swing connects. A fresh block parries. A held block chips. A dodge whiffs.
export function absorb(s, dmg) {
  if (!s) return { dmg, dodge: false, parry: false };
  if (s.dodge > 0) return { dmg: 0, dodge: true, parry: false };
  if (s.block && s.sta > 0) {
    const parry = s.blockT > 0 && s.blockT < PARRY;
    s.sta = Math.max(0, s.sta - (parry ? 4 : 10));
    if (parry) { s.shake = 0.2; s.cheer = 'PARRY'; s.cheerT = 1; s.down = 0; return { dmg: 0, dodge: false, parry: true }; }
    return { dmg: dmg * 0.25, dodge: false, parry: false };
  }
  if (dmg >= 10) s.down = 0.7;
  s.shake = Math.min(0.45, 0.08 + dmg * 0.02);
  return { dmg, dodge: false, parry: false };
}

export const timeLeft = s => Math.max(0, ROUND_S - (s?.t || 0));
export const tipsText = 'The stick moves the way the camera looks. You face them. Punch, Kick, Block, Dodge, Special. Punch, punch, then hold Punch for a combo. Block as they swing to parry. Dodge rolls through a hit.';
