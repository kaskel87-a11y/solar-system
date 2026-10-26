// Red Tape Flats street life: ROCKHEADS (Snuffles). Twitchy Red Static smokers who spot you on foot, storm over ranting,
// accuse you of stealing their stash or staring, and call you out: Fight / Back off / Pay 10 cr. Not a robbery (that is
// danger.js's junkie mugger, and we stand down while one is active): it is a fistfight. Fists through the normal melee
// path (world.meleeWorld via street-combat), erratic swings, sometimes a broken bottle. Win: he crumples, bleeds, drops a
// little cash or a rock, you get street cred and no heat for a fair fight. Weapon kill: heat as usual. Lose: you hit the
// dirt and he goes through your pockets. Pooled (phones: one rockhead, counted in the street NPC budget). More at night,
// scaled by SSX.grime when present.
import * as THREE from 'three';
import { buildHuman } from '../interiors.js';
import { RANT, ACCUSE, CHALLENGE, TAUNT, PAID, SWING, BOTTLE, KO, WON, HURT, pickRant, mangle, volume } from './street-rant.js';
const R = () => Math.random(), pick = a => a[(R() * a.length) | 0];
const NAMES = ['Twitch', 'Gary', 'Sparky', 'Rattlecan', 'Skeeter', 'Glassjaw Lenny', 'Static Pete', 'Dome Rat', 'Crickets'];
// Their own look, never danger.js's knife junkie (brown hooded suit, BLUE glow visor, knife): no hood, no suit, gaunt and
// ashen in a stained tank top or a torn red flannel, burn-scarred fingertips, and Red Static eyes that glow and crackle red.
const LOOKS = [{ top: 0xcfc6b2, bottom: 0x3a3430, skin: 0xb59684, hair: 0x1a1412, hairStyle: 'mohawk', bulk: 0.72 }, { top: 0x7a1c16, bottom: 0x2a2624, skin: 0xa8907e, hair: 0x5a5048, hairStyle: 'bald', bulk: 0.74 },
  { top: 0xbab09a, bottom: 0x1e1c1c, skin: 0x8a6a58, hair: 0x2a2018, hairStyle: 'long', bulk: 0.7 }];
const EYE = 0xff2414; // Red Static

const faceYaw = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));

export function createTweakers(K) {
  let root = null, pool = [], cur = null, checkT = 6, coolT = 0, dbg = { spawned: 0, confronts: 0, fights: 0, won: 0, lost: 0, paid: 0, backed: 0, killed: 0, forced: 0 };
  const MAX = K.PHONE ? 1 : 2;
  const mugging = () => { try { const m = window.__danger?.state?.mug; return !!(m && !m.done && !m.over && m.phase !== 'done'); } catch (e) { return false; } };
  // anything of danger.js's on the street right now (knife mugging, NPC street fight, ambient event): rockheads stay home
  const dangerBusy = () => { if (mugging()) return true; try { const D = window.__danger; if ((D?.state?.fights || []).some(f => !f.over)) return true; if (D?.director?.()?.active) return true; } catch (e) { /* */ } return false; };
  const grimeK = () => { try { const G = K.X().grime; const v = typeof G?.level === 'function' ? G.level() : G?.level; return Number.isFinite(+v) ? 0.6 + Math.max(0, Math.min(1, +v)) * 0.9 : 1; } catch (e) { return 1; } };
  function actor() {
    let a = pool.find(p => !p.busy); if (!a && pool.length < MAX) { const h = buildHuman(pick(LOOKS)); h.group.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } }); h.group.visible = false; root.add(h.group);
      const bottle = new THREE.Mesh(K.geo().cyl, K.mat('st_bottle', { color: 0x2c4a22, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85 })); bottle.scale.set(0.07, 0.26, 0.07); bottle.position.set(0, -0.72, -0.08); bottle.rotation.x = 1.3; bottle.visible = false; h.arms[1].add(bottle);
      const eyeM = K.mat('st_rh_eye', { color: 0x300000, emissive: EYE, emissiveIntensity: 3, roughness: 0.3 }), tipM = K.mat('st_rh_tip', { color: 0x401010, emissive: 0xff3a10, emissiveIntensity: 0.9 }), eyes = [];
      for (const sx of [-1, 1]) { const e = new THREE.Mesh(K.geo().sph, eyeM); e.scale.set(0.045, 0.03, 0.02); e.position.set(sx * 0.046, 0.025, -0.132); h.head.add(e); eyes.push(e); }
      for (const A of h.arms) { const f = new THREE.Mesh(K.geo().sph, tipM); f.scale.setScalar(0.07); f.position.set(0, -0.64, -0.02); A.add(f); } // pipe-burned fingers
      a = { h, bottle, eyes, eyeM, busy: false }; pool.push(a); }
    return a || null;
  }
  const hpOf = () => { try { const i = K.game()?.info; return i ? (i.hp || 0) + (i.shield || 0) : 100; } catch (e) { return 100; } };
  function say(s, line, lvl = 1) { K.yell(s, s.name, mangle(line, lvl), lvl); }
  function spawn(force = false) {
    const P = K.player; if (!root || cur || !P || P.driving || P.inside || mugging()) return null; if (!force && K.room() - (K.extra || 0) < 1) return null;
    const a = actor(); if (!a) return null; a.busy = true;
    const d = force ? 9 : 17 + R() * 6, ang = (P.yaw || 0) + (R() - 0.5) * 1.4; // in front of you, so you watch him come
    let x = P.x - Math.sin(ang) * d, z = P.z - Math.cos(ang) * d; const c = K.collide(x, z, 0.5); if (c) { x = c.x; z = c.z; }
    cur = { a, h: a.h, name: pick(NAMES), x, z, yaw: faceYaw(x, z, P.x, P.z), st: 'storm', t: 0, rantT: 0, hp: 6, chased: false, bottle: false, swingT: 1.2, wind: 0, weapon: false, fair: true, panelUp: false, life: 0 };
    a.h.group.visible = true; a.bottle.visible = false; K.tweak = 1; K.reselect(); dbg.spawned++; if (force) dbg.forced++;
    K.emit('rockhead', { name: cur.name, x, z }); say(cur, pickRant(), volume(d)); return cur;
  }
  function despawn() { if (!cur) return; cur.h.group.visible = false; cur.h.group.rotation.set(0, 0, 0); cur.a.bottle.visible = false; cur.a.busy = false; if (cur.panelUp) K.closePanel(); cur = null; K.tweak = 0; K.reselect(); coolT = K.T + 60 + R() * 30; }
  function confront(s) {
    s.st = 'confront'; s.t = 0; s.panelUp = true; dbg.confronts++; const acc = pick(ACCUSE), ch = pick(CHALLENGE); say(s, acc, 2); setTimeout(() => cur === s && say(s, ch, 2), 1400);
    K.openPanel(`${s.name} \u00b7 rockhead`, `Tweaked out of his skull on Red Static, fists balled, eyes going two directions. He wants a fight.`, [
      { label: '\ud83d\udc4a Fight', sub: 'Fists. No heat for a fair fight in the Flats.', fn: () => { s.panelUp = false; brawl(s); } },
      { label: 'Back off', sub: 'Hands up, walk away. He might not let you.', fn: () => { s.panelUp = false; backOff(s); } },
      { label: 'Pay 10 cr', sub: '"For the crickets."', disabled: K.credits() < 10, fn: () => { s.panelUp = false; payOff(s); } }
    ], `${acc} ${ch}`);
  }
  function brawl(s) { s.st = 'brawl'; s.t = 0; s.swingT = 0.6 + R() * 0.6; dbg.fights++; K.ST.stats.brawls = (K.ST.stats.brawls || 0) + 1; K.save(); K.toast(K.PHONE ? '\ud83d\udc4a Fistfight! Tap punch to fight back.' : '\ud83d\udc4a Fistfight! Melee (punch) to fight back.', 2600); K.emit('brawl', { name: s.name }); }
  function backOff(s) {
    dbg.backed++; say(s, pick(TAUNT), 2); const r = R();
    if (r < 0.35) { setTimeout(() => { if (cur !== s) return; try { K.game()?.hurtPlayer?.(4, { x: s.x, z: s.z }); } catch (e) { /* */ } K.toast(`\ud83d\udca2 ${s.name} shoves you in the back.`, 2000); }, 500); leave(s); }
    else if (r < 0.65 && !s.chased) { s.st = 'chase'; s.t = 0; s.chased = true; } else leave(s);
  }
  function payOff(s) { if (!K.take(10)) return backOff(s); dbg.paid++; say(s, pick(PAID), 1); K.emit('rockheadPaid', { name: s.name }); leave(s); }
  function leave(s) { s.st = 'leave'; s.t = 0; }
  function lose(s) {
    dbg.lost++; s.st = 'gloat'; s.t = 0; const c = K.credits(), cut = Math.min(c, Math.max(5, Math.min(60, Math.round(c * (0.1 + R() * 0.15)))));
    if (cut) K.take(cut); say(s, pick(WON), 2); K.ST.stats.brawlsLost = (K.ST.stats.brawlsLost || 0) + 1; K.save();
    const why = `${s.name} put you on the ground and went through your pockets. -${cut} cr, -3 cred.`; if (!K.knockdown?.(why)) knockdown(why); K.cred(-3, 'lost a fistfight'); K.emit('brawlLost', { name: s.name, took: cut });
  }
  function knockdown(text) {
    let o = document.getElementById('stKO'); if (!o) { o = document.createElement('div'); o.id = 'stKO'; o.style.cssText = 'position:fixed;inset:0;z-index:60;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font:800 18px/1.4 system-ui,sans-serif;pointer-events:none;opacity:0;transition:opacity .35s'; document.body.appendChild(o); }
    o.innerHTML = `<div><div style="font-size:13px;letter-spacing:.2em;margin-bottom:8px">YOU HIT THE DIRT</div>${text.replace(/[&<>]/g, '')}</div>`; o.style.opacity = '0.88'; clearTimeout(o._t); o._t = setTimeout(() => { o.style.opacity = '0'; }, 2600);
  }
  function hit(s, dmg, how, from, knock = 0) {
    if (!cur || s !== cur || s.st === 'down' || s.st === 'dead') return true;
    const melee = how === 'melee'; if (!melee) { s.weapon = true; s.fair = false; }
    s.hp -= dmg; K.combat.bleed(s.x, s.z, dmg, from); if (from && knock) { const d = Math.hypot(s.x - from.x, s.z - from.z) || 1; s.x += (s.x - from.x) / d * knock * 0.4; s.z += (s.z - from.z) / d * knock * 0.4; }
    if (s.panelUp) { K.closePanel(); s.panelUp = false; }
    if (s.hp <= 0) { finish(s, melee); return true; }
    if (melee && s.st !== 'brawl') brawl(s); else if (!melee) { s.st = 'leave'; s.t = 0; s.run = true; K.combat.witnesses(s.x, s.z, K.player, 20); }
    if (R() < 0.5) say(s, pick(HURT), 2); s.flinch = 0.25; return true;
  }
  function finish(s, melee) {
    const P = K.player, dir = P ? (Math.sign((s.x - P.x) * Math.sin(s.yaw) + (s.z - P.z) * Math.cos(s.yaw)) || 1) : 1; s.dir = dir; s.t = 0; s.a.bottle.visible = false;
    if (melee && s.fair !== false) { s.st = 'down'; dbg.won++; K.ST.stats.brawlsWon = (K.ST.stats.brawlsWon || 0) + 1; K.save(); K.cred(8, 'won a street fight'); say(s, pick(KO), 0); K.combat.bleed(s.x, s.z, 3, P, true);
      K.toast(`\ud83d\udc4a ${s.name} is down. +8 street cred.`, 2400); K.emit('brawlWon', { name: s.name });
      setTimeout(() => { if (cur === s) K.combat.drop(s.x + 0.7, s.z + 0.4, R() < 0.4 ? { item: 'redstatic', qty: 1, who: s.name } : { cash: 8 + ((R() * 22) | 0), who: s.name }); }, 900); }
    else { s.st = 'dead'; dbg.killed++; K.combat.bleed(s.x, s.z, 4, P, true); K.crime(1, `killed ${s.name} in Red Tape Flats`); K.combat.witnesses(s.x, s.z, P, 26); K.emit('rockheadKilled', { name: s.name });
      setTimeout(() => { if (cur === s) K.combat.drop(s.x + 0.7, s.z + 0.4, { cash: 5 + ((R() * 15) | 0), who: s.name }); }, 900); }
  }
  const hittable = { get x() { return cur?.x ?? 0; }, get y() { return cur ? K.hgt(cur.x, cur.z) + (cur.st === 'down' || cur.st === 'dead' ? 0.35 : 1.15) : 0; }, get z() { return cur?.z ?? 0; }, r: 0.62, kind: 'street_rockhead',
    get alive() { return !!cur && cur.st !== 'down' && cur.st !== 'dead'; }, get hostile() { return !!cur && cur.st === 'brawl'; }, hit: (d, how, from, knock) => cur && hit(cur, d, how, from, knock) };
  function step(s, P, speed, dt, toward = true) {
    const dx = (toward ? P.x - s.x : s.x - P.x), dz = (toward ? P.z - s.z : s.z - P.z), L = Math.hypot(dx, dz) || 1, j = Math.sin(K.T * 9 + s.x) * 0.5; // twitchy zig-zag
    let nx = s.x + (dx / L + (-dz / L) * j * 0.5) * speed * dt, nz = s.z + (dz / L + (dx / L) * j * 0.5) * speed * dt; const c = K.collide(nx, nz, 0.4); if (c) { nx = c.x; nz = c.z; } s.x = nx; s.z = nz;
  }
  function tick(dt, t, P) {
    if (!root) return;
    if (!cur) {
      if ((checkT -= dt) > 0) return; checkT = 8;
      if (P.driving || P.inside || K.panelOpen || dangerBusy() || K.T < coolT || P.d > 90) return;
      if (R() < (K.night() ? 0.12 : 0.04) * grimeK()) spawn(false); return;
    }
    const s = cur, h = s.h, d = Math.hypot(P.x - s.x, P.z - s.z); s.t += dt; s.life += dt; K.posePlain(h); h.group.rotation.order = 'YXZ';
    if (s.st !== 'down' && s.st !== 'dead' && s.st !== 'leave' && s.st !== 'gloat' && (P.driving || P.inside || d > 32 || mugging())) { if (mugging()) { dbg.yielded = (dbg.yielded || 0) + 1; s.run = true; } if (s.panelUp) { K.closePanel(); s.panelUp = false; } if (d < 30) say(s, pick(TAUNT), volume(d)); leave(s); }
    // the Red Static twitch: constant jitter plus a full-body spasm every 1-3 s (head snaps, shoulder jerks, a hand to the face)
    if ((s.spT = (s.spT ?? 1.5) - dt) <= 0) { s.spT = 1 + R() * 2; s.spasm = 0.28; s.spSide = R() < 0.5 ? -1 : 1; dbg.spasms = (dbg.spasms || 0) + 1; }
    const sp = s.spasm > 0 ? Math.sin((s.spasm -= dt) / 0.28 * Math.PI) : 0;
    const twitch = () => { h.head.rotation.y = Math.sin(t * 13) * 0.25 + (Math.sin(t * 3.1) > 0.9 ? 0.6 : 0) + sp * 0.7 * s.spSide; h.head.rotation.z = Math.sin(t * 7.7) * 0.12 + sp * 0.35 * s.spSide; h.torso.rotation.z = Math.sin(t * 5.3) * 0.08 + sp * 0.22 * s.spSide;
      if (sp > 0.2) { h.arms[s.spSide > 0 ? 1 : 0].rotation.z = -0.9 * s.spSide * sp; h.arms[0].rotation.x += sp * 1.2; } h.torso.position.y = Math.abs(Math.sin(t * 21)) * 0.012; };
    const flick = Math.sin(t * 31) > 0.85 ? 0.4 : 1; s.a.eyeM.emissiveIntensity = (s.st === 'brawl' || s.st === 'confront' ? 4 : 2.6) * flick;
    if (s.st === 'storm' || s.st === 'chase') {
      step(s, P, s.st === 'chase' ? 4.6 : 3.4, dt); s.yaw = faceYaw(s.x, s.z, P.x, P.z); K.walkAnim(h, t * 1.5, 1.2); h.torso.rotation.x = 0.22; h.arms[0].rotation.x = 0.9 + Math.sin(t * 17) * 0.3; h.arms[1].rotation.z = -0.4; twitch();
      if ((s.rantT -= dt) <= 0) { s.rantT = 1.6 + R() * 1.6; say(s, R() < 0.6 ? pickRant(RANT) : pick(CHALLENGE), volume(d)); }
      if (d < 2.2) { if (s.st === 'chase') { say(s, pick(CHALLENGE), 2); } confront(s); }
      if (s.t > 25) leave(s);
    } else if (s.st === 'confront') {
      s.yaw = faceYaw(s.x, s.z, P.x, P.z); h.torso.rotation.x = 0.15; h.arms[0].rotation.x = h.arms[1].rotation.x = 1.25 + Math.sin(t * 11) * 0.12; h.hips.position.y = h.base + Math.abs(Math.sin(t * 6)) * 0.04; twitch();
      if (d > 2.6) step(s, P, 1.2, dt);
      if (s.panelUp && !K.panelOpen) { s.panelUp = false; backOff(s); } // "Walk away" or closed
      else if (d > 7 && s.st === 'confront') { if (s.panelUp) { K.closePanel(); s.panelUp = false; } backOff(s); }
      else if (s.t > 20 && s.st === 'confront') { if (s.panelUp) { K.closePanel(); s.panelUp = false; } say(s, pick(SWING), 2); brawl(s); }
    } else if (s.st === 'brawl') {
      s.yaw = faceYaw(s.x, s.z, P.x, P.z) + Math.sin(t * 4) * 0.15; if (d > 1.15) step(s, P, d > 3 ? 3.6 : 1.8, dt); else if (d < 0.8) step(s, P, 1.2, dt, false);
      h.torso.rotation.x = 0.25; h.arms[0].rotation.x = 1.4 + Math.sin(t * 9) * 0.2; h.arms[1].rotation.x = 1.2 + Math.sin(t * 8 + 1) * 0.2; h.hips.position.y = h.base - 0.05 + Math.abs(Math.sin(t * 7)) * 0.05; twitch();
      if (s.flinch > 0) { s.flinch -= dt; h.head.rotation.x = -0.5; h.torso.rotation.x = -0.15; }
      if (!s.bottle && s.t > 4 && R() < dt * 0.09) { s.bottle = true; s.a.bottle.visible = true; say(s, pick(BOTTLE), 2); }
      if (s.wind > 0) { s.wind -= dt; const u = 1 - s.wind / 0.32; h.arms[1].rotation.x = 2.6 * u; h.torso.rotation.y = -0.5 * u;
        if (s.wind <= 0) { h.arms[1].rotation.x = 1.6; if (d < 1.7) { const dmg = s.bottle ? 11 + ((R() * 6) | 0) : 5 + ((R() * 5) | 0);
          if (hpOf() - dmg <= 22) lose(s); else { try { K.game()?.hurtPlayer?.(dmg, { x: s.x, z: s.z }); } catch (e) { /* */ } if (s.bottle) K.combat.bleed(P.x, P.z, 2, s); } } else if (R() < 0.4) say(s, pick(SWING), 2); } }
      else if ((s.swingT -= dt) <= 0) { s.swingT = 0.5 + R() * 0.9; s.wind = 0.32; if (R() < 0.3) say(s, pick(SWING), 2); }
      if (s.t > 60) leave(s);
    } else if (s.st === 'down' || s.st === 'dead') {
      K.combat.crumple(h, s, Math.min(1, s.t / 1.1), s.dir || 1);
      if (s.st === 'down' && s.t > 22) { s.st = 'leave'; s.t = 0; s.hp = 2; h.group.rotation.x = 0; }
      if (s.st === 'dead' && s.t > 60) despawn();
      return;
    } else if (s.st === 'gloat') {
      s.yaw = faceYaw(s.x, s.z, P.x, P.z); h.arms[0].rotation.x = h.arms[1].rotation.x = 2.8 + Math.sin(t * 8) * 0.2; h.hips.position.y = h.base + Math.abs(Math.sin(t * 9)) * 0.12; // hopping, arms up
      if (s.t > 2.5) leave(s);
    } else if (s.st === 'leave') {
      step(s, P, s.run ? 4.4 : 2.4, dt, false); s.yaw = faceYaw(s.x, s.z, P.x, P.z) + Math.PI; K.walkAnim(h, t * (s.run ? 1.6 : 1.1), 1); twitch();
      if ((s.rantT -= dt) <= 0 && d < 28) { s.rantT = 3 + R() * 3; say(s, pickRant(), volume(d)); }
      if (s.t > 9 || d > 40) { despawn(); return; }
    }
    if (!cur) return;
    h.group.position.set(s.x, K.hgt(s.x, s.z), s.z); h.group.rotation.set(0, s.yaw, 0); h.group.visible = !P.inside;
  }
  return {
    build(g) { root = g; pool = []; cur = null; checkT = 6; },
    dispose() { if (cur?.panelUp) K.closePanel(); for (const a of pool) a.h.group.parent?.remove(a.h.group); pool = []; cur = null; root = null; K.tweak = 0; },
    tick, acts: () => [], hittables: () => cur ? [hittable] : [],
    challenge: (o = {}) => { if (cur) { if (o.reset !== false) despawn(); else return { name: cur.name, st: cur.st }; } coolT = 0; const s = spawn(true); if (s && o.close !== false && o.near) { const P = K.player; s.x = P.x - Math.sin(P.yaw || 0) * 3; s.z = P.z - Math.cos(P.yaw || 0) * 3; } return s ? { name: s.name, st: s.st } : null; },
    state: () => cur ? { name: cur.name, st: cur.st, hp: cur.hp, bottle: cur.bottle, x: +cur.x.toFixed(2), z: +cur.z.toFixed(2), d: K.player ? +Math.hypot(K.player.x - cur.x, K.player.z - cur.z).toFixed(2) : null, panel: cur.panelUp } : null,
    debug: () => ({ ...dbg, max: MAX, active: !!cur, mugging: mugging(), dangerBusy: dangerBusy(), grimeK: grimeK(), look: cur ? { eyes: cur.a.eyes.length, eye: '#' + cur.a.eyeM.emissive.getHexString(), hood: false } : null })
  };
}
