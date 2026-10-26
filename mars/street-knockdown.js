// Red Tape Flats street life: the player KNOCKDOWN (Snuffles). A lost fight puts YOU on the ground: the astronaut model
// crumples backwards (tween), lies there a beat, gets back up, then you are dazed for a few seconds: the camera wobbles,
// the view smears (cheap CSS blur on the canvas, eased out) and you move at half speed. Runs as a street part, after the
// core walk / astronaut / camera update (registerSurfaceTick order), so it only overrides pose, position and camera
// for this frame and never touches core state permanently. Everything is restored when it ends or the street unloads.
const ease = u => u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u);
const bigCanvas = () => { let b = null, m = 0; for (const c of document.querySelectorAll('canvas')) { const a = c.clientWidth * c.clientHeight; if (a > m) { m = a; b = c; } } return b; };
const FALL = 0.7, LIE = 1.8, RISE = 0.9, DAZE = 6;
export function createKnockdown(K) {
  let ko = null, astro = null, canvas = null, filt0 = '', dbg = { downs: 0, frames: 0, found: 0, maxTilt: 0, slowed: 0, stepRaw: 0, stepKept: 0 };
  function findAstro(c, P) { // the core astronaut group: 9 parts, standing at the player's feet
    if (astro && astro.parent === c.scene) return astro; astro = null;
    for (const o of c.scene.children) if (o.isGroup && o.children.length >= 9 && Math.abs(o.position.x - P.x) < 0.05 && Math.abs(o.position.z - P.z) < 0.05 && Math.abs(o.position.y - (P.y - 1.7)) < 0.2) { astro = o; dbg.found++; break; }
    return astro;
  }
  function overlay(text, on) {
    let o = document.getElementById('stKO');
    if (!o) { o = document.createElement('div'); o.id = 'stKO'; o.style.cssText = 'position:fixed;inset:0;z-index:60;pointer-events:none;opacity:0;transition:opacity .4s;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 30%,rgba(0,0,0,.92) 100%);color:#fff;display:flex;align-items:flex-start;justify-content:center;text-align:center;padding:96px 24px 0;font:800 17px/1.4 system-ui,sans-serif;text-shadow:0 2px 6px #000'; document.body.appendChild(o); }
    if (text != null) o.innerHTML = `<div style="background:#000;border:2px solid #fff;padding:10px 14px;max-width:340px"><div style="font-size:12px;letter-spacing:.2em;margin-bottom:6px">YOU HIT THE DIRT</div>${String(text).replace(/[&<>]/g, '')}</div>`;
    o.style.opacity = on ? '1' : '0';
  }
  function blur(px) {
    try { canvas = canvas || bigCanvas(); if (!canvas) return; if (px <= 0.05) { canvas.style.filter = filt0; return; } canvas.style.filter = `blur(${px.toFixed(2)}px) saturate(${(1 - px * 0.18).toFixed(2)})`; } catch (e) { /* */ }
  }
  function start(text, o = {}) {
    const P = K.player; if (!P || P.driving || P.inside) { if (text) K.toast(text, 3000); return false; }
    const raw = P.ctx?.player; if (!raw) return false;
    if (!ko) { try { canvas = bigCanvas(); filt0 = canvas?.style.filter || ''; } catch (e) { /* */ } }
    ko = { t: 0, x: raw.x, z: raw.z, yaw: raw.faceYaw ?? raw.yaw ?? 0, lie: o.lie ?? LIE, daze: o.daze ?? DAZE, px: raw.x, pz: raw.z };
    dbg.downs++; overlay(text, true); K.emit('knockdown', { text });
    return true;
  }
  function end() { if (!ko) return; ko = null; blur(0); overlay(null, false); if (astro) { astro.rotation.x = 0; astro.rotation.z = 0; astro.rotation.order = 'XYZ'; } }
  function phase() { if (!ko) return null; const t = ko.t, a = FALL, b = a + ko.lie, c = b + RISE; return t < a ? 'fall' : t < b ? 'down' : t < c ? 'rise' : t < c + ko.daze ? 'dazed' : 'done'; }
  function tick(dt, T, Pk) {
    if (!ko) return; const c = Pk?.ctx, raw = c?.player; if (!raw || Pk.driving || Pk.inside) { end(); return; }
    ko.t += dt; dbg.frames++; const ph = phase(), a = FALL, b = a + ko.lie, cEnd = b + RISE;
    if (ph === 'done') { end(); return; }
    // body: fall back, lie, get up; feet stay put
    const g = findAstro(c, raw);
    let tilt = ph === 'fall' ? ease(ko.t / a) : ph === 'down' ? 1 : ph === 'rise' ? 1 - ease((ko.t - b) / RISE) : 0;
    if (ph === 'fall' && ko.t > a * 0.7) tilt += Math.sin((ko.t - a * 0.7) * 40) * 0.03; // the bounce off the dirt
    if (g) { g.rotation.order = 'YXZ'; g.rotation.y = ko.yaw; g.rotation.x = tilt * 1.42; g.rotation.z = tilt * 0.18 + (ph === 'down' ? Math.sin(T * 2.3) * 0.02 : 0); g.position.y += tilt * 0.26; dbg.maxTilt = Math.max(dbg.maxTilt, g.rotation.x); }
    // movement: pinned while down, half speed while dazed (scale back this frame's step, collisions already applied)
    if (ph !== 'dazed') { raw.x = ko.x; raw.z = ko.z; }
    else { const k = 0.45 + 0.55 * ease((ko.t - cEnd) / ko.daze), mx = raw.x - ko.px, mz = raw.z - ko.pz; if (mx || mz) { raw.x = ko.px + mx * k; raw.z = ko.pz + mz * k; dbg.slowed++; const m = Math.hypot(mx, mz); dbg.stepRaw += m; dbg.stepKept += m * k; } }
    ko.px = raw.x; ko.pz = raw.z;
    if (ph === 'dazed' && ko.t - cEnd > 0.4) overlay(null, false);
    // camera: low roll on the ground, then a drunk wobble that settles; blur eases out
    const cam = c.camera, dz = ph === 'dazed' ? 1 - (ko.t - cEnd) / ko.daze : 1, amp = (ph === 'dazed' ? 0.07 : 0.1) * dz;
    if (cam) { cam.rotateZ(Math.sin(T * 2.1) * amp + (ph === 'down' ? 0.12 * tilt : 0)); cam.rotateX(Math.sin(T * 1.3 + 1) * amp * 0.4); }
    blur(K.PHONE ? 1.2 * dz : 2.2 * dz);
  }
  return {
    build() {}, dispose: end, tick, acts: () => [],
    start, end, phase, active: () => !!ko,
    debug: () => ({ ...dbg, phase: phase(), t: ko ? +ko.t.toFixed(2) : null, astro: !!astro, tilt: astro ? +astro.rotation.x.toFixed(2) : 0, filter: canvas?.style.filter || '', speedK: dbg.stepRaw ? +(dbg.stepKept / dbg.stepRaw).toFixed(2) : null })
  };
}
