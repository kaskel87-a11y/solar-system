// Grime pass, part 2: Skid Row on Mars. Red Tape Flats (and the Beltway underpasses) are where people live on the street,
// and walking through means getting hassled. Martian slum-dwellers in tarp ponchos, hoods and cracked respirators; no faces,
// no real-world caricatures. Static encampments are baked with the district; the hassle is a tiny recycled pool of actors
// near the player (3 on phones, 6 on desktop), none while driving or indoors, scaled by grime level, district and the hour.
//   panhandler  follows you begging for credits          hustler  pushes fake goods and "O2 cartridges"
//   yeller      screams at nobody                        shover   gets in your face, shoves if you don't back off
//   pickpocket  lifts credits if you stand still too long mugger  pulls a shiv: pay, run or fight (wanted + combat hooks)
// Every hook into the game is guarded: SSX.bark (subtitle fallback), SSX.city.hostiles / setWanted, game.hurtPlayer.
import * as THREE from 'three';

const TYPES = {
  panhandler: { speed: 1.25, reach: 2.2, cool: 22, buttons: [['shove', 'Shove off'], ['give', 'Give 5 cr'], ['ignore', 'Ignore']], cat: 'grime_panhandle' },
  hustler: { speed: 1.4, reach: 2.4, cool: 30, buttons: [['shove', 'Shove off'], ['give', 'Buy one (20 cr)'], ['ignore', 'Ignore']], cat: 'grime_hustle' },
  yeller: { speed: 0.9, reach: 7, cool: 40, buttons: null, cat: 'grime_yell' },
  shover: { speed: 1.9, reach: 1.7, cool: 45, buttons: [['shove', 'Shove off'], ['give', 'Give 10 cr'], ['ignore', 'Back off']], cat: 'grime_shove' },
  pickpocket: { speed: 1.1, reach: 1.4, cool: 50, buttons: null, cat: 'grime_pickpocket' },
  mugger: { speed: 2.7, reach: 2.4, cool: 90, buttons: [['fight', 'Fight'], ['give', 'Pay 50 cr'], ['run', 'Run']], cat: 'grime_mugger' }
};
// how often each type shows up, per district (relative weights)
const MIX = {
  'mars-rough': { panhandler: 3, hustler: 2, yeller: 1.4, shover: 1.3, pickpocket: 1.4, mugger: 1 },
  'mars-highway': { panhandler: 2, hustler: 1, yeller: 1, shover: 1, pickpocket: 0.6, mugger: 1.4 },
  'mars-downtown': { panhandler: 3, hustler: 2.5, yeller: 1.2, shover: 0.5, pickpocket: 1.4, mugger: 0.25 },
  aj: { panhandler: 2, hustler: 1, yeller: 0.6, shover: 0.3, pickpocket: 0.6, mugger: 0.1 },
  'mars-gated': { panhandler: 1, hustler: 0, yeller: 0.3, shover: 0, pickpocket: 0.2, mugger: 0 }
};
const FALLBACK = { // subtitle lines if SSX.bark isn't there (mars-audio not loaded): one per category
  grime_panhandle: 'Spare a credit, chief? Just one. For air.', grime_hustle: 'O2 cartridges! Ninety-percent oxygen!', grime_yell: 'THE DOMES ARE LISTENING!',
  grime_shove: 'The fuck you looking at?', grime_pickpocket: 'Sorry, sorry, my bad.', grime_lifted: 'Too slow, helmet!', grime_mugger: 'Wallet. Now. Or I open you up.',
  grime_paid: 'Pleasure. Now fuck off.', grime_refused: 'Cheap bastard.', grime_fight: 'Big mistake, helmet!', grime_run: 'Run, rabbit! Run!', grime_shoved: 'Fuck! Fine! I\u2019m going!', grime_sleeper: 'Mmph. Fuck off. Sleeping.'
};

export function createStreet(ctx) {
  const { app, cfg, PHONE } = ctx;
  const POOL = PHONE ? 3 : 6, SPAWN_R = PHONE ? 16 : 20;
  let enabled = cfg.street !== false, paused = true, density = 1, nightOverride = null, actors = [], cool = {}, nextSpawn = 4, ui = null, uiFor = null, lastPos = null, stillT = 0, reserved = 0;
  let curY = 0; const camps = new Map(); // district id -> [{x, z, kind}] (sleepers / sitters: they mutter when you walk past)
  const counts = { spawned: 0, encounters: 0, paid: 0, lifted: 0, fights: 0, shoves: 0, routed: 0 };
  const W = () => app.surface?.world, solid = (x, z) => { try { return !!W()?.solidAt?.(x, curY + 0.8, z); } catch (e) { return false; } }, G = () => app.surface?.game, X = () => window.SSX || {};

  // ---------- materials for live actors (baked camp people use the shared vertex-colour cloth) ----------
  const M = {};
  const mat = (k, o) => M[k] ||= Object.assign(new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o }), { userData: { shared: true } });
  const PAL = [[0x9a9878, 0x5a5650], [0xa87450, 0x4e4a44], [0x7888a0, 0x4a4a4e], [0x9a8a70, 0x5a4e40], [0x808078, 0x46423e], [0xb07a60, 0x50504a]];
  const ponchoGeo = new THREE.CylinderGeometry(0.2, 0.46, 0.95, 9, 1, true), hoodGeo = new THREE.SphereGeometry(0.3, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62);
  for (const g of [ponchoGeo, hoodGeo]) g.userData.shared = true;
    function figure(type, seed) {
    const tex = ctx.R.cloth.map, box = ctx.R.geo.box, sph = ctx.R.geo.sph, cap = ctx.R.geo.cap, cyl = ctx.R.geo.cyl;
    const p = PAL[seed % PAL.length], g = new THREE.Group(), body = new THREE.Group(); g.add(body); g.userData.grime = true;
    const coat = mat('coat' + seed % PAL.length, { map: tex, color: p[0], emissive: p[0], emissiveIntensity: 0.12, side: THREE.DoubleSide }), pants = mat('pants' + seed % PAL.length, { map: tex, color: p[1], emissive: p[1], emissiveIntensity: 0.1 });
    const dark = mat('dark', { color: 0x141312, roughness: 0.6 }), glove = mat('glove', { color: 0x2a2420 }), lens = mat('lens', { color: 0x0a0a0a, emissive: 0x7a4a10, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.5 });
    const m = (geo, mt, x, y, z, sx, sy, sz, par = body) => { const o = new THREE.Mesh(geo, mt); o.position.set(x, y, z); o.scale.set(sx, sy, sz); par.add(o); return o; };
    const limb = (x, y, par = body) => { const pv = new THREE.Group(); pv.position.set(x, y, 0); par.add(pv); return pv; };
    const legL = limb(-0.11, 0.92), legR = limb(0.11, 0.92);
    for (const L of [legL, legR]) { m(box, pants, 0, -0.44, 0, 0.16, 0.88, 0.18, L); m(box, dark, 0, -0.88, 0.05, 0.18, 0.12, 0.3, L); }
    const torso = new THREE.Group(); torso.position.y = 0.95; body.add(torso);
    m(cap, coat, 0, 0.42, 0, 1.15, 0.78, 0.85, torso); m(ponchoGeo, coat, 0, 0.32, 0, 1, 1, 1, torso);
    const head = new THREE.Group(); head.position.y = 0.86; torso.add(head);
    m(sph, dark, 0, 0, 0, 0.42, 0.46, 0.42, head);
    if (type !== 'yeller') m(hoodGeo, coat, 0, 0.02, -0.03, 1, 1.05, 1.08, head); else m(sph, mat('cracked', { color: 0x2a3036, transparent: true, opacity: 0.5, roughness: 0.1 }), 0, 0.03, 0, 0.56, 0.58, 0.56, head);
    m(box, dark, 0, -0.07, 0.17, 0.2, 0.12, 0.12, head); m(cyl, mat('filter', { color: 0x6a5a40, roughness: 0.5, metalness: 0.5 }), 0.12, -0.1, 0.16, 0.09, 0.1, 0.09, head).rotation.z = 1.2;
    for (const sx of [-1, 1]) m(sph, lens, sx * 0.075, 0.04, 0.17, 0.09, 0.07, 0.05, head);
    const armL = limb(-0.31, 0.7, torso), armR = limb(0.31, 0.7, torso);
    for (const A of [armL, armR]) { m(box, coat, 0, -0.3, 0, 0.13, 0.6, 0.14, A); m(box, glove, 0, -0.64, 0, 0.11, 0.12, 0.12, A); }
    if (type === 'mugger') { const sh = m(box, mat('blade', { color: 0xb0b4b8, metalness: 0.9, roughness: 0.25 }), 0, -0.72, 0.12, 0.025, 0.05, 0.26, armR); sh.userData.shiv = true; }
    if (type === 'hustler') { const tray = m(box, mat('tray', { color: 0x3a2e24 }), 0, 0.2, 0.32, 0.5, 0.05, 0.3, torso); for (let i = 0; i < 4; i++) m(cyl, mat('o2', { color: 0x40d8ff, emissive: 0x1a6a80, emissiveIntensity: 0.8 }), -0.16 + i * 0.11, 0.27, 0.32, 0.05, 0.12, 0.05, torso); tray.userData.tray = true; }
    if (type === 'panhandler') m(cyl, mat('cup', { color: 0x8a8070, metalness: 0.4 }), 0, -0.72, 0.06, 0.09, 0.12, 0.09, armR);
    if (type === 'shover') g.scale.set(1.14, 1.08, 1.14); if (type === 'pickpocket') { g.scale.setScalar(0.94); torso.rotation.x = 0.22; }
    return { g, body, torso, head, legL, legR, armL, armR };
  }

  // ---------- static encampments (baked with the district by grime.js) ----------
  function campsBuild(c) {
    const { bk, R, r, spots, y0, level, id } = c, list = camps.get(id) || []; camps.set(id, list);
    const n = c.highway ? 1 : Math.round(spots.length * 0.22 * level), tarps = [[0.28, 0.42, 0.66], [0.42, 0.44, 0.3], [0.62, 0.34, 0.18], [0.5, 0.5, 0.5], [0.3, 0.32, 0.36], [0.55, 0.5, 0.42]];
    const used = [];
    for (let i = 0; i < n; i++) {
      const s = c.highway ? spots[0] : spots[(r() * spots.length) | 0]; if (!s) break; if (!c.highway && used.some(u => Math.hypot(u.x - s.x, u.z - s.z) < 7)) continue; used.push(s);
      const f = s.f, ux = Math.cos(f.yaw), uz = -Math.sin(f.yaw), at = (u, o) => [s.x + ux * u + f.nx * o, s.z + uz * u + f.nz * o];
      // tents and a tarp lean-to
      for (let k = 0, nt = 1 + (r() * 2.5 * Math.min(1.3, level) | 0); k < nt; k++) { const [x, z] = at(-2 + k * 2.3 + (r() - 0.5) * 0.6, 0.6 + r() * 0.6), sc = 0.9 + r() * 0.4;
        bk.put(R.geo.tent, R.tarp, x, y0 + 0.62 * sc, z, 0, f.yaw + Math.PI / 4 + (r() - 0.5) * 0.4, 0, 1.25 * sc, 1.25 * sc, 1.6 * sc, tarps[(r() * tarps.length) | 0]); }
      if (r() < 0.7) { const [x, z] = at(2.6, 0.3); bk.put(R.geo.plane, R.tarp, x + f.nx * 0.6, y0 + 1, z + f.nz * 0.6, -0.75, f.yaw, 0, 2.6, 2.4, 1, tarps[(r() * tarps.length) | 0], null, 'YXZ'); }
      // shopping cart stuffed with junk
      if (r() < 0.8) { const [x, z] = at(-3.4 + r(), 1.4), yaw = f.yaw + (r() - 0.5) * 1.5; cart(bk, R, x, y0, z, yaw, r); }
      trash(c, at(0.5, 1.6), 1);
      // somebody asleep in the doorway / along the wall, under a blanket
      if (r() < 0.85) { const [x, z] = at(-0.6 + (r() - 0.5) * 2, 0.45); sleeper(bk, R, x, y0, z, f.yaw + Math.PI / 2, r); list.push({ x, z, kind: 'sleeper' }); }
      // a burn barrel and people huddled round it at night
      if (!c.highway && r() < 0.55 * level) { const [x, z] = at(1.2, 2.2); c.barrelAt(x, z); for (let k = 0; k < 2; k++) { const a = r() * 6.28; sitter(bk, R, x + Math.cos(a) * 1.05, y0, z + Math.sin(a) * 1.05, Math.atan2(x - (x + Math.cos(a)), z - (z + Math.sin(a))), r); list.push({ x: x + Math.cos(a), z: z + Math.sin(a), kind: 'sitter' }); } }
      if (c.highway) { c.barrelAt(...at(0.8, 2.3)); sitter(bk, R, ...(() => { const [x, z] = at(0.8, 3.3); return [x, y0, z]; })(), f.yaw + Math.PI, r); }
    }
    // people sleeping in doorways of the blocks too (not just camps)
    if (!c.highway) for (const b of c.blocks) { if (b.lock || !b.door || r() > 0.32 * level) continue; const fx = b.X + (r() < 0.5 ? -1 : 1) * Math.min(b.w / 2 - 0.6, 1.9), fz = b.Z + b.d / 2 + 0.45; sleeper(bk, R, fx, y0, fz, Math.PI / 2, r); list.push({ x: fx, z: fz, kind: 'sleeper' }); }
  }
  function trash(c, [x, z], n) { c.trash(x, z, 0, n); }
  function cart(bk, R, x, y0, z, yaw, r) {
    const c = Math.cos(yaw), s = Math.sin(yaw), P = (lx, ly, lz) => [x + lx * c + lz * s, y0 + ly, z - lx * s + lz * c], tilt = (r() - 0.5) * 0.15;
    for (const [lx, ly, lz, sx, sy, ry, rx] of [[0, 0.55, 0, 0.55, 0.85, 0, -Math.PI / 2], [0, 0.82, 0.42, 0.55, 0.5, 0, 0], [0, 0.82, -0.42, 0.55, 0.5, 0, 0], [0.275, 0.82, 0, 0.85, 0.5, Math.PI / 2, 0], [-0.275, 0.82, 0, 0.85, 0.5, Math.PI / 2, 0]])
      bk.put(R.geo.plane, R.cart, ...P(lx, ly, lz), rx, yaw + ry, tilt, sx, sy, 1, [0.8, 0.8, 0.8], null, 'YXZ');
    bk.put(R.geo.cyl, R.metal, ...P(0, 1.08, -0.5), 0, yaw, Math.PI / 2, 0.035, 0.6, 0.035, [0.6, 0.6, 0.6], null, 'YXZ');
    for (const [lx, lz] of [[-0.24, 0.36], [0.24, 0.36], [-0.24, -0.36], [0.24, -0.36]]) bk.put(R.geo.cyl, R.rubber, ...P(lx, 0.07, lz), 0, yaw, Math.PI / 2, 0.14, 0.04, 0.14, null, null, 'YXZ');
    for (let i = 0; i < 3; i++) { const sc = 0.5 + r() * 0.3; bk.put(R.geo.bag, R.plastic, ...P((r() - 0.5) * 0.3, 0.85 + i * 0.12, (r() - 0.5) * 0.4), 0, r() * 6, 0, sc, sc, sc, [[0.07, 0.07, 0.07], [0.3, 0.3, 0.34], [0.12, 0.14, 0.1]][i]); }
  }
  function sleeper(bk, R, x, y0, z, yaw, r) { // lying along the wall under a blanket; boots poking out, hood at the other end
    const c = Math.cos(yaw), s = Math.sin(yaw), P = (lx, ly, lz) => [x + lx * c + lz * s, y0 + ly, z - lx * s + lz * c], bl = [[0.42, 0.32, 0.26], [0.3, 0.34, 0.4], [0.5, 0.2, 0.18], [0.35, 0.35, 0.3]][(r() * 4) | 0];
    bk.put(R.geo.box, R.cloth, ...P(0, 0.06, 0), 0, yaw, 0, 0.8, 0.08, 1.95, [0.55, 0.45, 0.3]); // flattened cardboard
    bk.put(R.geo.cap, R.cloth, ...P(0, 0.24, 0.05), Math.PI / 2, yaw, 0, 1.3, 1.25, 1.1, bl, null, 'YXZ');
    bk.put(R.geo.sph, R.cloth, ...P(0, 0.22, -0.82), 0, yaw, 0, 0.36, 0.32, 0.4, [0.22, 0.2, 0.18]);
    bk.put(R.geo.box, R.rubber, ...P(0.08, 0.14, 0.95), 0, yaw, 0.3, 0.14, 0.14, 0.22, [0.6, 0.6, 0.6]); bk.put(R.geo.box, R.rubber, ...P(-0.1, 0.13, 0.93), 0, yaw, -0.2, 0.14, 0.14, 0.22, [0.6, 0.6, 0.6]);
    if (r() < 0.5) bk.put(R.geo.cyl, R.metal, ...P(0.5, 0.12, -0.3), 0, 0, 0, 0.08, 0.24, 0.08, [0.4, 0.5, 0.3]); // the bottle
  }
  function sitter(bk, R, x, y0, z, yaw, r) { // hunched on a crate, hood up, hands to the fire
    const c = Math.cos(yaw), s = Math.sin(yaw), P = (lx, ly, lz) => [x + lx * c + lz * s, y0 + ly, z - lx * s + lz * c], col = [[0.55, 0.55, 0.45], [0.6, 0.42, 0.3], [0.45, 0.5, 0.6]][(r() * 3) | 0];
    bk.put(R.geo.box, R.card, ...P(0, 0.22, -0.1), 0, yaw, 0, 0.45, 0.44, 0.45, [0.7, 0.6, 0.5]);
    bk.put(R.geo.cap, R.cloth, ...P(0, 0.85, -0.05), 0.35, yaw, 0, 1.15, 0.8, 0.95, col, null, 'YXZ');
    bk.put(R.geo.sph, R.cloth, ...P(0, 1.32, 0.12), 0, yaw, 0, 0.36, 0.38, 0.38, col.map(v => v * 0.8));
    bk.put(R.geo.box, R.rubber, ...P(0, 1.27, 0.3), 0, yaw, 0, 0.18, 0.1, 0.06, [0.5, 0.5, 0.5]);
    for (const sx of [-0.12, 0.12]) { bk.put(R.geo.box, R.cloth, ...P(sx, 0.5, 0.2), 0, yaw, 0, 0.16, 0.16, 0.5, [0.3, 0.3, 0.3]); bk.put(R.geo.box, R.cloth, ...P(sx, 0.25, 0.42), 0, yaw, 0, 0.15, 0.5, 0.16, [0.3, 0.3, 0.3]); }
    bk.put(R.geo.box, R.cloth, ...P(0, 0.85, 0.35), 0, yaw, 0, 0.42, 0.12, 0.3, col);
  }

  // ---------- speech: Pumpkin's bark system first, our own subtitle as the fallback ----------
  function say(a, cat, force = true) {
    const pos = a ? { x: a.x, z: a.z, kind: 'colonist', name: a.name } : null; let line = null;
    const has = typeof X().bark === 'function';
    try { if (has) line = X().bark(pos, cat, { force }); } catch (e) { line = null; }
    if (!line && (!has || force)) { line = FALLBACK[cat] || '...'; subtitle(line); }
    if (!line) return null;
    if (typeof line !== 'string') line = line.text || line.line || String(line);
    if (a) a.lastLine = line;
    if (uiFor === a && ui) ui.querySelector('.gq').textContent = '\u201c' + line + '\u201d';
    return line;
  }
  let subEl = null, subT = 0;
  function subtitle(t) { if (!subEl) { subEl = document.createElement('div'); subEl.style.cssText = 'position:fixed;left:50%;bottom:24%;transform:translateX(-50%);z-index:9998;background:rgba(0,0,0,.82);color:#fff;font:600 15px system-ui,sans-serif;padding:8px 12px;border-radius:6px;max-width:86vw;text-align:center;pointer-events:none'; document.body.appendChild(subEl); }
    subEl.textContent = t; subEl.style.display = 'block'; subT = 3.2; }
  const toast = (t, ms = 2600) => { try { (X().city?.toast || app.toast)?.(t, ms); } catch (e) { /* */ } };

  // ---------- the response bar: black, white, 44px+, __onTap, auto-dismisses, never covers the sticks ----------
  function showBar(a) {
    hideBar(); const T = TYPES[a.type]; if (!T.buttons) return; counts.encounters++;
    const el = ui = document.createElement('div'); uiFor = a; el.id = 'grimeBar';
    el.style.cssText = 'position:fixed;left:50%;top:16%;transform:translateX(-50%);z-index:9998;width:min(94vw,440px);pointer-events:none;text-align:center;font:15px system-ui,sans-serif;color:#fff';
    el.innerHTML = `<div style="background:#000;border:1px solid #fff;border-radius:8px;padding:8px 10px"><div style="opacity:.7;font-size:12px;letter-spacing:.06em">${a.label.toUpperCase()}</div><div class="gq" style="margin:4px 0 8px;font-weight:600"></div><div class="gb" style="display:flex;gap:6px"></div><div class="gt" style="height:3px;background:#fff;margin-top:8px;transform-origin:left;opacity:.6"></div></div>`;
    for (const [id, label] of T.buttons) { const b = document.createElement('button'); b.textContent = label; b.dataset.act = id;
      b.style.cssText = 'pointer-events:auto;flex:1;min-height:46px;background:#000;color:#fff;border:1px solid #fff;border-radius:6px;font:600 14px system-ui,sans-serif;touch-action:manipulation';
      window.__onTap?.(b, () => respond(a, id)); el.querySelector('.gb').appendChild(b); }
    if (a.lastLine) el.querySelector('.gq').textContent = '\u201c' + a.lastLine + '\u201d';
    document.body.appendChild(el); a.barT = 6.5; a.barEnd = performance.now() + 6500; // wall clock, so slow frames don't stretch it
  }
  function hideBar() { ui?.remove(); ui = null; uiFor = null; }

  // ---------- money / damage / wanted, all guarded ----------
  const credits = () => G()?.progress?.credits ?? 0;
  function take(n) { const P = G()?.progress; if (!P) return 0; const k = Math.max(0, Math.min(n, P.credits | 0)); P.credits -= k; try { G().save?.(); } catch (e) { /* */ } return k; }
  function hurt(d) { try { G()?.hurtPlayer?.(d, null); } catch (e) { /* */ } }
  function push(a, m) { const i = app.surface?.info; if (!i) return; const dx = i.x - a.x, dz = i.z - a.z, L = Math.hypot(dx, dz) || 1; const x = i.x + dx / L * m, z = i.z + dz / L * m;
    const ok = !solid(x, z); if (ok) try { app.surface.debugMove?.(x, z, i.faceYaw ?? 0); } catch (e) { /* */ } }
  function wantedFor(why) { const d = a0 => a0; const zone = W()?.districtAt?.()?.id; if (zone === 'mars-rough' || zone === 'mars-highway') { toast('Nobody calls ColSec in the Flats.'); return; }
    try { (X().city?.setWanted || W()?.setWanted)?.(Math.max(1, X().city?.wanted || W()?.wanted || 0), why); } catch (e) { /* */ } d(0); }
  function toHostile(a, why) { // hand the actor over to the real combat system (a 'thug' with aggro) if there's room under the cap
    let n = 0; try { n = (X().city?.hostiles || G()?.hostiles)?.(['thug'], a.x, a.z, { aggro: true, r: 0.4, faction: 'street', src: 'grime' }) || 0; } catch (e) { n = 0; }
    if (n) { counts.fights++; despawn(a); wantedFor(why); return true; } return false;
  }

  function respond(a, act) {
    if (!actors.includes(a)) { hideBar(); return; } hideBar(); a.answered = act;
    const T = a.type;
    if (act === 'give') {
      const want = T === 'mugger' ? 50 : T === 'hustler' ? 20 : T === 'shover' ? 10 : 5, got = take(want);
      if (!got) { say(a, 'grime_refused'); toast('You\u2019re broke. They noticed.'); if (T === 'mugger') { a.state = 'stab'; a.t = 0.6; } else leave(a); return; }
      counts.paid++; say(a, 'grime_paid'); toast(`\u2212${got} cr`);
      if (T === 'hustler') setTimeout(() => toast(Math.random() < 0.7 ? 'The \u201cO2 cartridge\u201d is full of dust. You got scammed.' : 'It actually works. Tastes like pennies.'), 1800);
      leave(a); return;
    }
    if (act === 'shove' || act === 'fight') {
      counts.shoves++;
      if (T === 'mugger') { say(a, 'grime_fight'); if (!toHostile(a, 'Street fight')) { a.state = 'stab'; a.t = 0.4; } return; }
      if (T === 'shover' && Math.random() < 0.55) { say(a, 'grime_fight'); if (!toHostile(a, 'Brawl')) { a.state = 'shove'; a.t = 0.3; } return; }
      a.knock = 0.5; say(a, 'grime_shoved'); flee(a); return;
    }
    if (act === 'run') { say(a, 'grime_run'); a.state = 'chase'; a.t = 7; return; }
    // ignore
    if (T === 'panhandler') { a.state = 'follow'; a.t = 9 + Math.random() * 6; a.nextBark = 3; return; }
    if (T === 'shover') { a.state = 'shove'; a.t = 0.7; return; }
    if (T === 'mugger') { a.state = 'stab'; a.t = 0.5; return; }
    say(a, 'grime_refused'); leave(a);
  }
  const leave = a => { a.state = 'leave'; a.t = 8; }, flee = a => { a.state = 'flee'; a.t = 6; };

  // ---------- spawning / despawning the pool ----------
  // night: setNight() override > SSX.time.isNight() (game clock, when it exists) > the real clock
  const gameTime = () => { const t = X().time; return t && typeof t.isNight === 'function' ? t : null; };
  function hour() { if (nightOverride != null) return nightOverride; const t = gameTime(); if (t) { try { const h = typeof t.hour === 'function' ? +t.hour() : NaN; if (isFinite(h)) return h; return t.isNight() ? 23 : 13; } catch (e) { /* fall through */ } } return new Date().getHours(); }
  function timeMult() { if (nightOverride == null) { const t = gameTime(); if (t) { try { if (t.isNight()) return 1.8; } catch (e) { /* */ } } } const h = hour(); return h >= 21 || h < 5 ? 1.8 : h >= 18 || h < 7 ? 1.3 : 1; }
  const nightSource = () => nightOverride != null ? 'override' : gameTime() ? 'SSX.time' : 'clock';
  // muggings belong to Chief of Staff's street danger (SSX.danger, PR #3): its director already rolls knife muggings by
  // district and hour, with Pay / Fight / Run / Talk, loot, heat and backup. While it is loaded we never run our own
  // mugger; a forced one is handed to it. Our mugger below is only the fallback when danger.js isn't there.
  const danger = () => { const d = X().danger; return d && typeof d === 'object' ? d : null; };
  // public API first (SSX.danger.startMugging, PR #19); if missing or it refuses, the __danger.force debug hook; else null -> local mugger
  function dangerMug(o = {}) {
    const d = danger(); const dbg = window.__danger; if (!d && !dbg) return null;
    const opt = { force: true, dist: o.near ? 6 : o.dist, district: zoneHere(app.surface?.info || {}), src: 'grime' };
    try { if (d && typeof d.startMugging === 'function') { counts.routed++; if (d.startMugging(opt)) return 'SSX.danger.startMugging'; } } catch (e) { console.warn('grime: danger startMugging', e); }
    try { if (dbg && typeof dbg.force === 'function') { counts.routed++; if (dbg.force('mugging', opt)) return 'SSX.danger (via __danger.force)'; } } catch (e) { console.warn('grime: danger mugging', e); }
    return null; }
  const dangerBusy = () => { try { const d = danger(); if (d && typeof d.isMugging === 'function') return !!d.isMugging(); if (d && d.mugging && typeof d.mugging === 'object') return !!d.mugging.phase; return !!window.__danger?.state?.mug; } catch (e) { return false; } };
  function zoneHere(i) { const d = W()?.districtAt?.(i.x, i.z); return d?.id || null; }
  function rate(zone) { if (!zone) return 0; const D = ctx.dcfg(zone); return (D.street ?? 0) * Math.min(1.35, ctx.mult()) * density * timeMult(); }
  function reserve(n) { if (n === reserved) return; reserved = n; try { X().city?.npcReserve?.('grime-street', n); } catch (e) { /* */ } }
  function pickType(zone) { const mix = MIX[zone] || MIX.aj, t = timeMult(), e = Object.entries(mix).map(([k, w]) => [k, (cool[k] > 0 || actors.some(a => a.type === k) || (k === 'mugger' && danger()) ? 0 : w) * (k === 'mugger' ? t * t / 2 : 1)]), tot = e.reduce((a, b) => a + b[1], 0); if (!tot) return null;
    let x = Math.random() * tot; for (const [k, w] of e) if ((x -= w) <= 0) return k; return null; }
  const NAMES = { panhandler: ['Coughing Teo', 'Old Brine', 'Wheezer', 'Ma Dusty'], hustler: ['Slick Orrin', 'Two-Tank Vic', 'Lungs Malloy'], yeller: ['Preacher Rust', 'Loud Ansel'], shover: ['Big Kettle', 'Knuckles Dray'], pickpocket: ['Fingers', 'Quiet Nim'], mugger: ['Shiv', 'Razor Pell', 'Knife Odo'] };
  const LABEL = { panhandler: 'Panhandler', hustler: 'Hustler', yeller: 'Street preacher', shover: 'Some asshole', pickpocket: 'Stranger', mugger: 'Mugger' };
  function spawn(type, i) {
    const sc = ctx.scene(); if (!sc) return null;
    const yaw = i.viewYaw ?? i.faceYaw ?? 0; let x = 0, z = 0, ok = false;
    for (let k = 0; k < 8 && !ok; k++) { const a = yaw + Math.PI * (0.35 + Math.random() * 1.3) * (Math.random() < 0.5 ? 1 : -1), d = SPAWN_R * (0.65 + Math.random() * 0.35); x = i.x + Math.sin(a) * d; z = i.z + Math.cos(a) * d;
      try { const f = X().city?.freeSpot?.(x, z, 0.8); if (f) { x = f.x; z = f.z; } } catch (e) { /* */ } ok = !solid(x, z); }
    if (!ok) return null;
    const seed = (Math.random() * 1000) | 0, F = figure(type, seed), a = { type, ...F, x, z, y: i.y ?? 0, yaw: 0, state: type === 'yeller' ? 'yell' : 'approach', t: 30, phase: Math.random() * 6, name: NAMES[type][seed % NAMES[type].length], label: LABEL[type], nextBark: 1 + Math.random() * 2, barT: 0, speed: TYPES[type].speed };
    if (type === 'yeller') { a.home = { x, z }; }
    a.g.position.set(x, a.y, z); sc.add(a.g); actors.push(a); counts.spawned++; reserve(actors.length); return a;
  }
  function despawn(a) { a.g.parent?.remove(a.g); actors = actors.filter(b => b !== a); if (uiFor === a) hideBar(); cool[a.type] = TYPES[a.type].cool / Math.max(0.3, density); reserve(actors.length); }
  function clear() { for (const a of [...actors]) despawn(a); hideBar(); reserve(0); }

  // ---------- per-frame ----------
  let campBark = 3;
  function update(dt) {
    if (subT > 0 && (subT -= dt) <= 0 && subEl) subEl.style.display = 'none';
    for (const k in cool) cool[k] -= dt;
    const i = app.surface?.info, off = !enabled || paused || !i || i.driving || i.inside || !ctx.onMars() || ctx.mult() <= 0;
    if (off) { if (actors.length) clear(); stillT = 0; return; }
    curY = i.y ?? 0; const zone = zoneHere(i), rt = rate(zone);
    // standing still (pickpockets love it)
    if (lastPos && Math.hypot(i.x - lastPos.x, i.z - lastPos.z) < 0.02 * Math.max(1, dt * 60)) stillT += dt; else stillT = 0; lastPos = { x: i.x, z: i.z };
    // spawn
    nextSpawn -= dt;
    const dBusy = dangerBusy(); if (dBusy && uiFor) respond(uiFor, 'ignore'); // a danger.js mugging owns the screen; our hassle backs off
    if (nextSpawn <= 0) { nextSpawn = 1.5; if (rt > 0 && !dBusy && actors.length < Math.min(POOL, 1 + Math.ceil(rt * 2.2)) && Math.random() < Math.min(0.8, 0.13 * rt)) { const t = pickType(zone); if (t) spawn(t, i); } }
    // the camp sleepers mutter when you walk right past
    if ((campBark -= dt) <= 0) { campBark = 2; for (const L of camps.values()) for (const c of L) if (Math.hypot(c.x - i.x, c.z - i.z) < 2.6 && Math.random() < 0.35) { say({ x: c.x, z: c.z, name: 'Sleeper' }, 'grime_sleeper', false); campBark = 12; break; } }
    for (const a of [...actors]) act(a, dt, i);
  }
  function act(a, dt, i) {
    const dx = i.x - a.x, dz = i.z - a.z, d = Math.hypot(dx, dz) || 0.001, T = TYPES[a.type]; a.t -= dt; a.phase += dt;
    let mv = 0, face = Math.atan2(dx, dz);
    if (d > 60) { despawn(a); return; }
    if (a.barT > 0 && uiFor === a) { a.barT = Math.min(a.barT - dt, (a.barEnd - performance.now()) / 1000); const bar = ui?.querySelector('.gt'); if (bar) bar.style.transform = `scaleX(${Math.max(0, a.barT / 6.5)})`; if (a.barT <= 0) respond(a, 'ignore'); }
    switch (a.state) {
      case 'approach': mv = d > T.reach ? a.speed : 0; if (d <= T.reach + 0.2) { a.state = 'engage'; say(a, T.cat); showBar(a); if (!T.buttons) { a.state = a.type === 'pickpocket' ? 'lurk' : 'yell'; a.t = 14; } } if (a.t < 0) leave(a); break;
      case 'engage': mv = d > T.reach + 0.6 ? a.speed : 0; a.nextBark -= dt; if (a.nextBark < 0) { a.nextBark = 5; if (a.type !== 'mugger') say(a, T.cat); } break;
      case 'follow': mv = d > 1.8 ? Math.min(a.speed * 1.2, 2.2) : 0; a.nextBark -= dt; if (a.nextBark < 0) { a.nextBark = 4 + Math.random() * 2; say(a, T.cat); } if (a.t < 0 || d > 14) { say(a, 'grime_refused'); leave(a); } break;
      case 'yell': { const h = a.home || a; const hx = h.x - a.x, hz = h.z - a.z; mv = Math.hypot(hx, hz) > 1.5 ? 0.7 : 0; face = mv ? Math.atan2(hx, hz) : a.yaw + Math.sin(a.phase * 0.7) * 0.05; a.nextBark -= dt; if (a.nextBark < 0 && d < 16) { a.nextBark = 4.5 + Math.random() * 3; say(a, T.cat, true); } if (a.t < -20 || d > 30) despawn(a); break; }
      case 'lurk': mv = d > 1.3 ? 0.9 : 0; if (stillT > 4.5 && d < 2.2) { const got = take(5 + (Math.random() * 16 | 0)); if (got) { counts.lifted++; toast(`\uD83D\uDCB8 Pickpocket lifted ${got} cr \u2014 he\u2019s running!`, 3200); say(a, 'grime_lifted'); a.loot = got; a.state = 'flee'; a.t = 8; a.speed = 3.6; } else { say(a, 'grime_refused'); leave(a); } }
        else if (d > 7 || a.t < 0) leave(a); break;
      case 'shove': mv = d > 1 ? 2.6 : 0; if (d < 1.2) { say(a, 'grime_shove'); hurt(4); push(a, 1.6); toast('Shoved.'); leave(a); } if (a.t < -4) leave(a); break;
      case 'stab': mv = d > 1.1 ? 3 : 0; if (d < 1.3 && a.t < 0) { hurt(12); const got = take(30); toast(got ? `Stabbed. He took ${got} cr.` : 'Stabbed. You had nothing.', 3000); say(a, 'grime_paid'); flee(a); a.speed = 3.6; } break;
      case 'chase': mv = 3.15; a.cd = (a.cd || 0) - dt; if (d < 1.3 && a.cd <= 0) { a.cd = 1.4; hurt(8); toast('He cut you!'); } if (a.t < 0 || d > 22) { say(a, 'grime_run'); leave(a); } break;
      case 'flee': mv = a.speed * 1.3; face = Math.atan2(-dx, -dz); if (a.loot && d < 1.3) { const P = G()?.progress; if (P) { P.credits += a.loot; G().save?.(); } toast(`You grab him and take your ${a.loot} cr back.`); a.loot = 0; say(a, 'grime_shoved'); } if (a.t < 0 || d > 40) despawn(a); break;
      case 'leave': mv = 1.1; face = Math.atan2(-dx, -dz); if (a.t < 0 || d > 35) despawn(a); break;
    }
    if (a.knock > 0) { a.knock -= dt; a.x -= dx / d * dt * 4; a.z -= dz / d * dt * 4; }
    if (mv) { const dir = a.state === 'flee' || a.state === 'leave' ? face : Math.atan2(dx, dz), nx = a.x + Math.sin(dir) * mv * dt, nz = a.z + Math.cos(dir) * mv * dt; if (!solid(nx, nz)) { a.x = nx; a.z = nz; } else { a.x += Math.cos(dir) * mv * dt; a.z -= Math.sin(dir) * mv * dt; } }
    let dy = face - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.yaw += dy * Math.min(1, dt * 6);
    a.y += ((i.grounded !== false ? i.y : a.y) - a.y) * Math.min(1, dt * 2);
    a.g.position.set(a.x, a.y, a.z); a.g.rotation.y = a.yaw;
    // animation: walk cycle, begging hand, flailing preacher, knife hand forward
    const w = mv ? Math.sin(a.phase * (4 + mv * 2.2)) * Math.min(0.7, 0.25 + mv * 0.2) : 0;
    a.legL.rotation.x = w; a.legR.rotation.x = -w; a.armL.rotation.x = -w * 0.8; a.armR.rotation.x = w * 0.8; a.body.position.y = mv ? Math.abs(Math.sin(a.phase * (4 + mv * 2.2))) * 0.04 : Math.sin(a.phase * 1.5) * 0.01;
    if (a.type === 'panhandler' && !mv) { a.armR.rotation.x = -1.1 + Math.sin(a.phase * 2) * 0.08; }
    if (a.type === 'yeller') { a.armL.rotation.x = -2.2 + Math.sin(a.phase * 5) * 0.8; a.armR.rotation.x = -1.6 + Math.sin(a.phase * 4.3 + 1) * 1; a.armL.rotation.z = 0.3; a.head.rotation.x = -0.3 + Math.sin(a.phase * 3) * 0.15; }
    if (a.type === 'mugger' && (a.state === 'engage' || a.state === 'stab' || a.state === 'chase')) { a.armR.rotation.x = -1.35 + (a.state === 'stab' ? Math.sin(a.phase * 14) * 0.5 : 0); }
    if (a.type === 'hustler' && !mv) { a.armL.rotation.x = a.armR.rotation.x = -0.9; }
    if (a.type === 'shover' && a.state === 'engage') { a.torso.rotation.x = 0.15 + Math.sin(a.phase * 3) * 0.05; a.armL.rotation.x = a.armR.rotation.x = -0.5; }
  }

  const api = {
    setDensity(n) { density = Math.max(0, Math.min(3, +n || 0)); ctx.save?.(); return density; }, get density() { return density; },
    enable() { enabled = true; cfg.street = true; ctx.save?.(); return true; }, disable() { enabled = false; cfg.street = false; clear(); ctx.save?.(); return false; },
    get enabled() { return enabled; },
    setNight(v) { nightOverride = v === true ? 23 : v === false ? 13 : v == null ? null : +v; return hour(); }, // force night / day for testing (default: the real clock)
    trigger(type = 'mugger', o = {}) { const i = app.surface?.info; if (!i || !TYPES[type]) return null; if (type === 'mugger' && (danger() || window.__danger) && !o.local) { const r = dangerMug(o); if (r) return r; } cool[type] = 0; const a = spawn(type, i); if (a) { const c = app.surface?.camera; let fx = Math.sin(i.faceYaw || 0), fz = Math.cos(i.faceYaw || 0); if (c) { fx = i.x - c.position.x; fz = i.z - c.position.z; const L = Math.hypot(fx, fz) || 1; fx /= L; fz /= L; } // in front of the player, as seen from the camera
        const R0 = o.near ? TYPES[type].reach + 0.1 : 6; for (const side of o.near ? [0.9, -0.9, 0.5] : [0.35, -0.35, 0]) { const x = i.x + (fx * R0 - fz * side * R0), z = i.z + (fz * R0 + fx * side * R0); if (!solid(x, z)) { a.x = x; a.z = z; break; } } a.g.position.set(a.x, a.y, a.z); } return a ? a.name : null; },
    actors: () => actors.map(a => ({ type: a.type, name: a.name, state: a.state, x: +a.x.toFixed(1), z: +a.z.toFixed(1) })),
    stats: () => ({ ...counts, muggings: danger() ? 'SSX.danger' : 'grime fallback', nightSource: nightSource(), active: actors.length, pool: POOL, density, enabled, night: timeMult() > 1.5, camps: [...camps.values()].reduce((s, l) => s + l.length, 0) })
  };
  return {
    api, get density() { return density; }, camps: campsBuild, dropCamps: id => camps.delete(id), update, pause(v) { paused = v; if (v) clear(); },
    enable(silent) { enabled = true; if (!silent) cfg.street = true; }, disable(silent) { enabled = false; clear(); if (!silent) cfg.street = false; }, setDensity: api.setDensity, stats: api.stats
  };
}
