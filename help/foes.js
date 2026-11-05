// Red ◆ over every mission foe (src 'quest' agents: Door Shift troublemakers, bodyguards, story waves, even ambushers still
// under the sand) + a red dot for each on the minimap (clamped to the rim when far), and on phones a critical NPC slot
// (mars/npcslots.js, #67) for a human wave so the street makes room for it. Ticked from help/stuck.js.
import * as THREE from 'three';

const MAX = 16, KEY = 'quest-foes', SLOT = 'questFoes';
let pool = [], tex = null, scene = null, list = [], pingT = 0, slotStep = null, mmKey = '', mmT = 0;

function texture() {
  if (tex) return tex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.translate(32, 28); g.rotate(Math.PI / 4); g.lineWidth = 6; g.strokeStyle = '#fff'; g.fillStyle = '#ff2020';
  g.beginPath(); g.rect(-13, -13, 26, 26); g.stroke(); g.fill(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.beginPath(); g.moveTo(24, 52); g.lineTo(40, 52); g.lineTo(32, 62); g.closePath(); g.fillStyle = '#ff2020'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke();
  tex = new THREE.CanvasTexture(c); if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
function sprite() {
  const m = new THREE.SpriteMaterial({ map: texture(), depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: false });
  const s = new THREE.Sprite(m); s.name = 'quest-foe-marker'; s.renderOrder = 999; s.frustumCulled = false; s.visible = false; return s;
}
function ensure(sc) {
  if (scene !== sc) { for (const s of pool) s.parent?.remove(s); scene = sc; for (const s of pool) sc?.add(s); }
  while (pool.length < MAX) { const s = sprite(); pool.push(s); scene?.add(s); }
}
const mm = () => globalThis.SSX?.minimap;
function clearMap() { if (mmKey) { try { mm()?.clear?.(KEY); } catch (e) { /* */ } mmKey = ''; } }

// -> current foes [{x, y, z, type, burrow}] (also used by Stuck? hints and the tests)
export function foes() { return list; }
export function ping(s = 3) { pingT = Math.max(pingT, s); }
export function markerState() {
  return { foes: list.length, world: pool.filter(s => s.visible).length, minimap: (() => { try { return mm()?.list?.().includes(KEY) ? list.length : 0; } catch (e) { return 0; } })(), slot: slotStep };
}

export function foesTick(dt, ctx) {
  const g = ctx?.game; if (!g || !ctx.scene) return;
  let a = []; try { a = (g.debug?.agents?.() || []).filter(o => o.src === 'quest' && o.hp > 0); } catch (e) { a = []; }
  list = a.slice(0, MAX).map(o => ({ x: o.x, y: o.y, z: o.z, type: o.type, burrow: (ctx.height?.(o.x, o.z) ?? o.y) - o.y > 1.5 }));
  if (list.length) ensure(ctx.scene);
  pingT = Math.max(0, pingT - (dt || 0));
  const indoors = document.body.classList.contains('indoors');
  const big = pingT > 0 ? 1 + 0.35 * (0.5 + 0.5 * Math.sin(performance.now() / 90)) : 1, mob = !!ctx.isMobile;
  for (let i = 0; i < pool.length; i++) {
    const s = pool[i], f = list[i]; if (!f || indoors) { s.visible = false; continue; }
    const gy = ctx.height ? ctx.height(f.x, f.z) : f.y;
    s.position.set(f.x, Math.max(f.y, gy) + (f.burrow ? 1.2 : 2.7), f.z);
    const k = (mob ? 0.075 : 0.05) * big; s.scale.set(k, k, 1); s.visible = true;
  }
  // minimap: one red dot per foe (clamped so a far one sits on the rim), refreshed 5x a second
  mmT -= dt || 0;
  if (mmT <= 0) {
    mmT = 0.2;
    if (list.length) { const marks = list.map(f => ({ x: f.x, z: f.z, color: '#ff2020', r: pingT > 0 ? 4.6 : 3.4, ring: true, clamp: true }));
      try { mm()?.addMarks?.(KEY, marks); mmKey = KEY; } catch (e) { /* no minimap */ } }
    else clearMap();
  }
  slotTick(ctx);
}

// phones: a human mission wave holds critical NPC slots while its step runs (ambient walkers make room; total stays <= 12)
function slotTick(ctx) {
  const S = globalThis.SSX?.npcSlots, g = ctx.game; if (!S || ctx.name !== 'Mars') return;
  let q = null, st = null; try { q = g.info?.quest; st = g.debug?.step?.(); } catch (e) { /* */ }
  const human = st?.type === 'defeat' && Array.isArray(st.wave) && st.wave.length && st.wave.every(t => /^(thug|goon|enforcer|guard)$/.test(t));
  const key = human && q ? `${q.id}:${q.step}` : null;
  if (key && key !== slotStep) {
    slotStep = key; const n = st.wave.length;
    S.reserve(SLOT, n, { critical: true, active: () => { try { const i = g.info?.quest; return !!i && `${i.id}:${i.step}` === key; } catch (e) { return false; } } });
  } else if (!key && slotStep) slotStep = null; // the slot's own watchdog lets it go (mars/npcslotscore.js sweep)
}
export function foesOff() { for (const s of pool) s.visible = false; list = []; clearMap(); }
