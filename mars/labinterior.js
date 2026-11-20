// Walk-in Vat House (v7.5.120). Same interiors.js kit as the shops and the habitat.
// The door outside still belongs to mars/lab.js. This file only builds the room and the station buttons.
// Fiction only: Glow-dust, Low-G, and Red Static are made-up. No real substances or steps.
import { registerInterior } from '../interiors.js';
import { panelTap } from '../racehooks.js';

export const LAB_KIND = 'vathouse';
const ROOM = { w: 10, d: 8, h: 3.2 };

const VATS = [
  { id: 'glowdust', name: 'Glow-dust', color: 0x3dff9a, x: -2.6 },
  { id: 'lowg', name: 'Low-G', color: 0x7ad0ff, x: 0 },
  { id: 'redstatic', name: 'Red Static', color: 0xff3355, x: 2.6 }
];

const lab = () => window.SSX?.lab;
const toast = (m) => { try { window.__app?.toast?.(m, 2600); } catch (e) { /* */ } };

let sheetEl = null;
function ensureSheet() {
  if (sheetEl || typeof document === 'undefined') return sheetEl;
  const st = document.createElement('style');
  st.textContent = `#labRoom{position:fixed;inset:0;z-index:64;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.45)}
#labRoom.on{display:flex}
#labRoom .wrap{position:relative;width:min(96vw,420px);max-height:min(70vh,520px);overflow:auto;-webkit-overflow-scrolling:touch;margin:0 8px calc(10px + env(safe-area-inset-bottom));background:#000;color:#fff;border:2px solid #fff;border-radius:16px;padding:14px;box-sizing:border-box;font:15px/1.35 system-ui,sans-serif}
#labRoom h2{margin:0 48px 8px 0;font-size:18px}
#labRoom p{margin:0 0 8px}
#labRoom button{display:block;width:100%;min-height:48px;margin:8px 0 0;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:800 16px/1.2 system-ui,sans-serif;touch-action:manipulation}
#labRoom .x{position:absolute;top:8px;right:8px;width:44px;height:44px;margin:0;border-radius:10px;font:700 20px/40px system-ui,sans-serif}`;
  document.head.appendChild(st);
  sheetEl = document.createElement('div');
  sheetEl.id = 'labRoom';
  sheetEl.innerHTML = '<div class="wrap" role="dialog" aria-label="Vat House"><button type="button" class="x" data-a="close" aria-label="Close">✕</button><div id="labRoomBody"></div></div>';
  document.body.appendChild(sheetEl);
  panelTap(sheetEl, e => {
    const b = e.target?.closest?.('button'); if (!b) return;
    const fn = b._go; if (b.dataset.a === 'close' || !fn) { closeSheet(); return; }
    fn();
  });
  return sheetEl;
}
function closeSheet() { sheetEl?.classList.remove('on'); }
function openSheet(title, lines, buttons) {
  ensureSheet();
  const body = sheetEl.querySelector('#labRoomBody');
  body.innerHTML = `<h2>${title}</h2>${lines.map(t => `<p>${t}</p>`).join('')}`;
  for (const b of buttons) {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = b.label;
    el._go = () => { const r = b.go(); if (r?.msg) toast(r.msg); if (b.stay) paintCrew(b.stay); else closeSheet(); };
    body.appendChild(el);
  }
  const x = document.createElement('button');
  x.type = 'button'; x.textContent = 'Close'; x.dataset.a = 'close';
  body.appendChild(x);
  sheetEl.classList.add('on');
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ }
}
function paintCrew(role) {
  const L = lab(), st = L?.status?.(), C = L?.crewRoles?.[role];
  if (!st || !C) return;
  const c = st.crew[role];
  const line = {
    cook: 'Pipes: I keep the vats running when you leave. Pay me or I skim the batch.',
    guard: 'Tuli: I watch the door. Paid, the raids come smaller. Unpaid, I nap.',
    runner: 'Skitter: I sell a bit of the locker in the Flats and drop the cash in the till. I keep a quarter.'
  }[role];
  const buttons = [];
  if (!c.hired) buttons.push({ label: `Hire ${C.name} · ${C.hire} cr`, go: () => L.hire(role), stay: role });
  else {
    buttons.push({ label: `Fire ${C.name}`, go: () => L.fire(role), stay: role });
    if (c.owed) buttons.push({ label: 'Pay back wages', go: () => L.payCrew(), stay: role });
  }
  openSheet(C.name, [line, c.hired ? (c.owed ? `Owed ${c.owed} payday${c.owed > 1 ? 's' : ''}.` : 'Paid up.') : 'Not on the crew yet.'], buttons);
}

registerInterior(LAB_KIND, {
  name: 'Vat House',
  w: ROOM.w, d: ROOM.d, h: ROOM.h,
  wall: 0x24282e, floor: 0x1a1c20, ceil: 0x121418, trim: 0x3dff9a,
  light: { color: 0xffe2c4, int: 34 },
  build(api) {
    const steel = api.mat(0x3a4048, { metalness: 0.55, roughness: 0.4 });
    const dark = api.mat(0x14181c, { roughness: 0.9 });
    const wood = api.mat(0x5a4030, { roughness: 0.85 });
    api.sign('CRATES   VATS   LOCKER   LEAVE', 0xd8ffe8, 0, 2.75, -ROOM.d / 2 + 0.08, 0, 5.2, { h: 96, font: 'bold 42px system-ui, sans-serif' });

    // supply rack, west wall
    api.box(-4.15, 0.7, 0.2, 0.55, 1.35, 1.5, steel);
    api.box(-4.15, 0.45, 0.2, 0.7, 0.08, 1.4, dark);
    api.box(-4.15, 1.05, 0.2, 0.7, 0.08, 1.4, dark);
    for (const z of [-0.3, 0.2, 0.7]) api.box(-3.9, 0.7, z, 0.28, 0.22, 0.28, api.mat(0x3d4a2a));
    api.col(-4.15, 0.2, 0.4, 0.8);
    api.sign('CRATES', 0xffd040, -4.35, 1.7, 0.2, Math.PI / 2, 1.3, { h: 80, font: 'bold 48px system-ui, sans-serif' });
    const mark = (x, z, col) => {
      const m = api.mk(api.G.cyl, api.mat(col, { emissive: col, emissiveIntensity: 0.8 }), x, 0.04, z, 0.55, 0.02, 0.55);
      api.g.add(m);
    };
    mark(-3.3, 0.2, 0xffd040);
    api.spot({ id: 'supply', x: -3.3, z: 0.2, r: 0.7, label: 'Buy crates', act: 'lab', run: () => openSheet('Supply rack', ['Buy supply crates. One crate runs one batch. 110 cr each.'], [
      { label: 'Buy 1 crate · 110 cr', go: () => lab()?.buySupplies(1) },
      { label: 'Buy 5 crates · 550 cr', go: () => lab()?.buySupplies(5) }
    ]) });

    // heat board
    api.box(-4.2, 1.35, -1.15, 0.08, 0.7, 1.1, api.mat(0x101418, { emissive: 0x163028, emissiveIntensity: 0.6 }));
    api.sign('HEAT', 0xff5a5a, -4.05, 1.35, -1.15, Math.PI / 2, 1.15, { h: 80, font: 'bold 52px system-ui, sans-serif' });
    mark(-3.3, -1.15, 0xff5a5a);
    const heatSpot = api.spot({ id: 'heat', x: -3.3, z: -1.15, r: 0.62, label: 'Heat board', act: 'lab', run: () => {
      const st = lab()?.status?.();
      const heat = st?.heat ?? 0;
      const cost = Math.max(60, Math.round(heat * 6 / 5) * 5);
      openSheet('Heat board', [`Heat is ${heat} out of 100. Lay low pauses the vats. Grease the beat pays it down.`], [
        { label: 'Lay low for 3 min', go: () => lab()?.layLow() },
        { label: `Grease the beat · ${cost} cr`, go: () => lab()?.greaseBeat() }
      ]);
    } });

    // three open vats along the back wall, one product each. The colored fill grows with the batch.
    const fluids = [];
    const glass = api.mat(0xd8fff4, { transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false });
    for (const v of VATS) {
      api.box(v.x, 0.1, -2.7, 0.92, 0.14, 0.92, steel);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) api.box(v.x + sx * 0.4, 0.68, -2.7 + sz * 0.4, 0.06, 1.02, 0.06, steel);
      api.box(v.x, 1.2, -2.7, 0.96, 0.06, 0.96, steel);
      api.box(v.x, 0.68, -2.22, 0.78, 0.9, 0.025, glass);
      api.box(v.x, 0.68, -3.12, 0.78, 0.9, 0.04, dark);
      const fluid = api.mk(api.G.box, api.mat(v.color, { emissive: v.color, emissiveIntensity: 0.55, transparent: true, opacity: 0.95 }), v.x, 0.28, -2.7, 0.68, 0.08, 0.68);
      const gauge = api.mk(api.G.box, api.mat(v.color, { emissive: v.color, emissiveIntensity: 1.4 }), v.x - 0.34, 0.28, -2.28, 0.045, 0.08, 0.045);
      api.g.add(fluid); api.g.add(gauge);
      const entry = { ...v, fluid, gauge, spot: null };
      fluids.push(entry);
      v._entry = entry;
      api.col(v.x, -2.7, 0.5, 0.5);
      api.sign(v.name.toUpperCase(), v.color, v.x, 2.05, -2.35, 0, 1.15, { h: 72, font: 'bold 34px system-ui, sans-serif' });
      mark(v.x, -2.05, v.color);
      const spot = api.spot({ id: 'vat-' + v.id, x: v.x, z: -2.05, r: 0.62, label: v.name, act: 'lab', run: () => {
        const r = lab()?.setProduct(v.id);
        if (r?.msg) toast(r.msg);
      } });
      v.spot = spot; if (v._entry) v._entry.spot = spot;
    }

    // reactor glow between the vats and the room
    const core = api.mk(api.G.sph, api.mat(0x9dffd8, { emissive: 0x3dff9a, emissiveIntensity: 1.2 }), 0, 2.55, -1.2, 0.16, 0.16, 0.16);
    api.g.add(core);
    api.ticks.push(t => { core.material.emissiveIntensity = 0.8 + Math.sin(t * 3) * 0.4; });

    // locker and till, east side
    api.box(4.22, 0.9, -0.15, 0.42, 1.65, 0.82, steel);
    api.box(3.98, 0.95, -0.15, 0.06, 1.4, 0.66, api.mat(0x123044, { emissive: 0x1a6a90, emissiveIntensity: 0.55 }));
    api.box(3.94, 1.05, 0.12, 0.05, 0.16, 0.06, api.mat(0xffd040, { emissive: 0xffd040, emissiveIntensity: 0.9 }));
    api.col(4.15, -0.15, 0.4, 0.5);
    api.sign('LOCKER', 0x7ad0ff, 3.85, 1.95, -0.15, -Math.PI / 2, 1.3, { h: 80, font: 'bold 44px system-ui, sans-serif' });
    mark(3.35, -0.15, 0x7ad0ff);
    const lockerSpot = api.spot({ id: 'locker', x: 3.35, z: -0.15, r: 0.65, label: 'Collect locker', act: 'lab', run: () => {
      const r = lab()?.collect({ what: 'locker' });
      if (r?.msg) toast(r.msg);
    } });

    api.box(1.7, 0.45, 1.05, 1.3, 0.85, 0.6, wood);
    const tray = api.box(1.7, 0.9, 1.05, 0.4, 0.06, 0.28, api.mat(0x14301c, { emissive: 0x39ff7a, emissiveIntensity: 0.2 }));
    api.col(1.7, 1.05, 0.7, 0.35);
    api.sign('TILL', 0x39ff7a, 1.7, 1.45, 1.45, 0, 1.15, { h: 80, font: 'bold 52px system-ui, sans-serif' });
    mark(1.7, 0.45, 0x39ff7a);
    const tillSpot = api.spot({ id: 'till', x: 1.7, z: 0.45, r: 0.6, label: 'Take the till', act: 'lab', run: () => {
      const r = lab()?.collect({ what: 'till' });
      if (r?.msg) toast(r.msg);
    } });

    // crew
    const pipes = api.person({ top: 0x2a4a3a, bottom: 0x22262c, hair: 0x3a2a1a, hairStyle: 'bun', skin: 0xc49a74, accent: 0x3dff9a }, -1.25, -0.7, Math.PI, (p, t) => {
      p.hips.position.y = p.base - Math.abs(Math.sin(t * 2)) * 0.02;
      p.arms[1].rotation.x = 1.15 + Math.sin(t * 3) * 0.35;
      p.arms[0].rotation.x = 0.45;
      p.head.rotation.y = Math.sin(t * 0.6) * 0.35;
    });
    api.sign('PIPES', 0x9dffc8, -1.25, 2.15, -0.7, 0, 1.2, { h: 72, font: 'bold 48px system-ui, sans-serif' });
    api.spot({ id: 'pipes', x: -1.25, z: -0.05, r: 0.55, label: 'Talk to Pipes', act: 'lab', run: () => paintCrew('cook') });

    api.person({ top: 0x3a3e46, bottom: 0x1c1e22, hair: 0x111111, hairStyle: 'short', skin: 0x8a5a3a, bulk: 1.15, accent: 0xffd040 }, -2.3, 1.9, Math.PI, (p, t) => {
      p.arms[0].rotation.x = 0.55; p.arms[1].rotation.x = 0.55;
      p.arms[0].rotation.z = 0.45; p.arms[1].rotation.z = -0.45;
      p.head.rotation.y = Math.sin(t * 0.4) * 0.5;
    });
    api.sign('TULI', 0xffd040, -2.3, 2.15, 1.9, 0, 1.15, { h: 72, font: 'bold 48px system-ui, sans-serif' });
    api.spot({ id: 'tuli', x: -2.3, z: 1.2, r: 0.95, label: 'Talk to Tuli', act: 'lab', run: () => paintCrew('guard') });

    const skitter = api.person({ top: 0x4a3028, bottom: 0x2a2420, hair: 0x1a120c, hairStyle: 'cap', skin: 0xd8b08c, size: 0.92 }, 2.9, 1.7, Math.PI, (p, t) => {
      p.hips.position.y = p.base - Math.abs(Math.sin(t * 6)) * 0.03;
      p.legs[0].rotation.x = Math.sin(t * 6) * 0.35;
      p.legs[1].rotation.x = -Math.sin(t * 6) * 0.35;
    });
    const skitterSpot = api.spot({ id: 'skitter', x: 2.9, z: 1.05, r: 0.58, label: 'Talk to Skitter', act: 'lab', run: () => paintCrew('runner') });
    api.sign('SKITTER', 0xffb080, 2.9, 2.05, 1.7, 0, 1.35, { h: 72, font: 'bold 40px system-ui, sans-serif' });

    api.ticks.push(() => {
      let st = null; try { st = lab()?.status?.() || null; } catch (e) { st = null; }
      if (!st) return;
      const pct = st.batch?.pct || 0;
      const running = !!st.batch?.running;
      for (const v of fluids) {
        const info = (st.products || []).find(p => p.id === v.id);
        const on = st.product === v.id;
        const spot = v.spot;
        if (spot) spot.label = info?.locked ? 'Red Static locked' : on ? `${v.name} ${pct}%` : `Switch to ${v.name}`;
        const fill = (on && running ? Math.max(0.16, pct / 100) : 0.08) * 0.9;
        v.fluid.scale.y = fill;
        v.fluid.position.y = 0.2 + fill / 2;
        if (v.gauge) { v.gauge.scale.y = fill; v.gauge.position.y = 0.24 + fill / 2; if (v.gauge.material) v.gauge.material.emissiveIntensity = on && running ? 2 : 0.35; }
        if (v.fluid.material) v.fluid.material.emissiveIntensity = on && running ? 1.3 : 0.3;
      }
      if (heatSpot) heatSpot.label = `Heat board · ${st.heat}`;
      if (lockerSpot) lockerSpot.label = st.lockerUsed ? `Collect ${st.lockerUsed} from locker` : 'Locker is empty';
      if (tillSpot) tillSpot.label = st.till ? `Take ${st.till} cr` : 'Till is empty';
      tray.material.emissiveIntensity = st.till ? 0.9 : 0.15;
      const hired = !!st.crew?.runner?.hired;
      const sway = hired ? Math.sin(performance.now() / 700) * 0.18 : 0;
      skitter.group.position.x = 2.9 + sway;
      skitterSpot.x = 2.9 + sway;
      });
  }
});
