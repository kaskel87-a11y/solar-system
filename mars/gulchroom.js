// Walk-in shed at Red Static Gulch. The yard and the ☰ Grow op sheet stay.
// Fiction only: Red Static moss, Glow-dust cactus, Void Honey poppies, Ghost spore.
import { registerInterior } from '../interiors.js';
import { panelTap } from '../racehooks.js';

export const GULCH_KIND = 'gulch';
const ROOM = { w: 12, d: 10, h: 4.2 };
const RACK_XZ = [[-3.6, -3.1], [0, -3.1], [3.6, -3.1], [-3.6, -1.2], [0, -1.2], [3.6, -1.2]];

const op = () => window.SSX?.farm2;
const toast = m => { try { window.__app?.toast?.(m, 2600); } catch (e) { /* */ } };

let sheetEl = null, stepEl = null;
function ensureSheet() {
  if (sheetEl || typeof document === 'undefined') return sheetEl;
  const st = document.createElement('style');
  st.textContent = `#gulchPick{position:fixed;inset:0;z-index:64;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.35)}
#gulchPick.on{display:flex}
#gulchPick .wrap{width:min(96vw,420px);max-height:42vh;overflow:auto;-webkit-overflow-scrolling:touch;margin:0 8px calc(10px + env(safe-area-inset-bottom));background:#000;color:#fff;border:2px solid #fff;border-radius:16px;padding:14px;box-sizing:border-box;font:15px/1.35 system-ui,sans-serif}
#gulchPick h2{margin:0 48px 8px 0;font-size:18px}
#gulchPick p{margin:0 0 8px}
#gulchPick button{display:block;width:100%;min-height:48px;margin:8px 0 0;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:800 16px/1.2 system-ui,sans-serif;touch-action:manipulation}
#gulchStep{position:fixed;z-index:14;top:calc(118px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);display:none;max-width:min(320px,calc(100vw - 28px));padding:6px 12px;border-radius:12px;border:2px solid #c8ff6a;background:#000;color:#fff;font:800 15px/1.25 system-ui,sans-serif;text-align:center;pointer-events:none}
#gulchStep.on{display:block}`;
  document.head.appendChild(st);
  sheetEl = document.createElement('div');
  sheetEl.id = 'gulchPick';
  sheetEl.innerHTML = '<div class="wrap" role="dialog" aria-label="Gulch"><button type="button" data-a="close" aria-label="Close" style="position:absolute;top:8px;right:8px;width:44px;height:44px;margin:0">✕</button><div id="gulchPickBody"></div></div>';
  document.body.appendChild(sheetEl);
  panelTap(sheetEl, e => {
    const b = e.target?.closest?.('button'); if (!b) return;
    if (b.dataset.a === 'close' || !b._go) { closeSheet(); return; }
    const r = b._go();
    if (r?.msg) toast(r.msg);
    closeSheet();
  });
  stepEl = document.createElement('div');
  stepEl.id = 'gulchStep';
  stepEl.setAttribute('role', 'status');
  document.body.appendChild(stepEl);
  return sheetEl;
}
function closeSheet() { sheetEl?.classList.remove('on'); }
function openSheet(title, lines, buttons) {
  ensureSheet();
  const body = sheetEl.querySelector('#gulchPickBody');
  body.innerHTML = `<h2>${title}</h2>${lines.map(t => `<p>${t}</p>`).join('')}`;
  for (const b of buttons) {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = b.label;
    el._go = b.go;
    body.appendChild(el);
  }
  sheetEl.classList.add('on');
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ }
}
export function setGulchStep(text) {
  ensureSheet();
  const hide = !text || document.getElementById('f2Panel')?.classList.contains('show') || sheetEl?.classList.contains('on');
  stepEl.textContent = hide ? '' : text;
  stepEl.classList.toggle('on', !hide && !!text);
}

function nextJob(st) {
  if (!st) return { id: 'leave', text: 'Leave by the door.' };
  if (st.raid) return { id: 'lights', text: 'Kill the grow lights. Follow the marker.' };
  if (!st.owned) return { id: 'skiv', text: 'Talk to Skiv. Buy the gulch.' };
  const ripe = st.racks.findIndex(r => r.crop && r.growth >= 1);
  if (ripe >= 0) return { id: 'rack-' + ripe, text: 'Harvest the ripe rack. Follow the marker.' };
  if (st.stashCount > 0) return { id: 'skiv', text: 'Sell the harvest to Skiv. Follow the marker.' };
  const empty = st.racks.findIndex(r => !r.crop);
  if (empty >= 0) return { id: 'rack-' + empty, text: 'Plant the empty rack. Follow the marker.' };
  if (st.racks.length < 6) return { id: 'rack-' + st.racks.length, text: 'Add a grow rack. Follow the marker.' };
  return { id: 'leave', text: 'The racks are growing. Leave by the door when you want.' };
}

registerInterior(GULCH_KIND, {
  name: 'Red Static Gulch',
  w: ROOM.w, d: ROOM.d, h: ROOM.h,
  wall: 0x3a241c, floor: 0x1c1612, ceil: 0x14110e, trim: 0xc8ff6a,
  light: { color: 0xd8ffc0, int: 36 },
  build(api) {
    const steel = api.mat(0x4a4038, { metalness: 0.4, roughness: 0.6 });
    const wood = api.mat(0x6a4030, { roughness: 0.85 });
    const spots = {};
    api.sign('RACKS    SKIV    LIGHTS    LEAVE', 0xe8ffc8, 0, 3.5, -ROOM.d / 2 + 0.08, 0, 7.2, { h: 80, font: 'bold 36px system-ui, sans-serif' });
    const plants = [];
    RACK_XZ.forEach(([x, z], i) => {
      api.box(x, 0.45, z, 1.5, 0.9, 0.7, wood);
      api.box(x, 1.15, z, 1.55, 0.06, 0.75, api.mat(0xc8ff6a, { emissive: 0x88cc44, emissiveIntensity: 0.8 }));
      const crop = api.mk(api.G.box, api.mat(0xc81e1e, { emissive: 0xc81e1e, emissiveIntensity: 0.4 }), x, 0.7, z, 0.9, 0.2, 0.4);
      api.g.add(crop);
      plants.push(crop);
      api.col(x, z, 0.7, 0.35);
      const spot = api.spot({ id: 'rack-' + i, x, z: z + 0.8, r: 0.72, label: 'Rack', act: 'gulch', run: () => onRack(i) });
      spots[spot.id] = spot;
    });
    api.person({ top: 0x3a3428, bottom: 0x2a2418, hair: 0x1a1810, hairStyle: 'cap', skin: 0xc4a574, accent: 0xff3b30 }, -4.3, 2.15, Math.PI, (p, t) => {
      p.hips.position.y = p.base - Math.abs(Math.sin(t * 1.4)) * 0.02;
      p.arms[1].rotation.x = 0.4;
      p.head.rotation.y = Math.sin(t * 0.5) * 0.4;
    });
    api.sign('SKIV', 0xffd24a, -4.3, 2.15, 2.15, 0, 1.3, { h: 72, font: 'bold 48px system-ui, sans-serif' });
    const skiv = api.spot({ id: 'skiv', x: -4.3, z: 1.35, r: 0.75, label: 'Talk to Skiv', act: 'gulch', run: () => onSkiv() });
    spots.skiv = skiv;
    api.box(4.5, 1.2, 2.2, 0.2, 0.5, 0.7, api.mat(0x101410, { emissive: 0xc8ff6a, emissiveIntensity: 0.7 }));
    api.sign('LIGHTS', 0xc8ff6a, 4.2, 1.9, 2.2, -Math.PI / 2, 1.4, { h: 72, font: 'bold 40px system-ui, sans-serif' });
    const lights = api.spot({ id: 'lights', x: 3.7, z: 2.2, r: 0.7, label: 'Grow lights', act: 'gulch', run: () => op()?.killLights?.() });
    spots.lights = lights;
    const marker = api.mk(api.G.cone, api.mat(0xc8ff6a, { emissive: 0xc8ff6a, emissiveIntensity: 1.4 }), 0, 0.35, 0, 0.28, 0.45, 0.28);
    api.g.add(marker);
    const byId = id => api.spots.find(s => s.id === id);
    api.ticks.push(t => {
      let st = null;
      try { st = op()?.status?.() || null; } catch (e) { st = null; }
      const job = nextJob(st);
      setGulchStep(job.text);
      const target = byId(job.id) || byId('leave');
      if (target) {
        marker.position.set(target.x, 0.28 + Math.sin(t * 4) * 0.06, target.z);
        marker.visible = true;
      }
      if (!st) return;
      plants.forEach((mesh, i) => {
        const r = st.racks[i];
        const crop = r?.crop && op()?.CROPS?.[r.crop];
        mesh.visible = !!crop;
        if (!crop) return;
        const g = Math.max(0.15, r.growth || 0);
        mesh.scale.y = g;
        mesh.position.y = 0.55 + g * 0.15;
        if (mesh.material?.color) mesh.material.color.setHex(crop.color);
        if (mesh.material?.emissive) mesh.material.emissive.setHex(crop.color);
      });
      RACK_XZ.forEach((_, i) => {
        const spot = spots['rack-' + i];
        const r = st.racks[i];
        if (!st.owned) { spot.label = 'Buy the gulch first'; return; }
        if (!r) { spot.label = i === st.racks.length ? 'Add a rack · 400 cr' : 'Empty bay'; return; }
        const c = r.crop && op().CROPS[r.crop];
        if (!c) spot.label = 'Plant this rack';
        else if (r.growth >= 1) spot.label = `Harvest ${c.name}`;
        else spot.label = `${c.name} ${Math.floor(r.growth * 100)}%`;
      });
      skiv.label = !st.owned ? 'Buy the gulch · 2,500 cr' : st.stashCount ? `Sell to Skiv · ${st.stashCount}` : 'Talk to Skiv';
      lights.label = st.raid ? 'Kill the grow lights' : 'Grow lights';
    });
  }
});

function onRack(i) {
  const F = op(); if (!F) return;
  const st = F.status();
  if (!st.owned) { toast('Talk to Skiv. Buy the gulch first.'); return; }
  if (i === st.racks.length) return F.rack('cr');
  if (i > st.racks.length) { toast('Add the next rack first.'); return; }
  const r = st.racks[i];
  if (!r) return;
  if (r.crop && r.growth >= 1) return F.harvest(i);
  if (r.crop) { const c = F.CROPS[r.crop]; toast(`${c.name} is ${Math.floor(r.growth * 100)}% grown.`); return; }
  const crops = Object.values(F.CROPS);
  openSheet('Plant this rack', ['Pick a crop. It grows while you are away.'], crops.map(c => ({
    label: `${c.icon} ${c.name} · ${c.seed} cr`,
    go: () => F.plant(i, c.id)
  })));
}
function onSkiv() {
  const F = op(); if (!F) return;
  const st = F.status();
  if (!st.owned) {
    openSheet('Skiv', ['Dead-end gulch. Stolen power. No paperwork. 2,500 cr, once.'], [
      { label: 'Buy the gulch · 2,500 cr', go: () => F.buy('cr') },
      { label: 'Buy the gulch · 2,500 stars', go: () => F.buy('stars') }
    ]);
    return;
  }
  const held = Object.keys(st.stash || {}).filter(k => st.stash[k] > 0);
  if (!held.length) { toast('Skiv: Nothing to sell. Cut a ripe rack.'); return; }
  openSheet('Skiv', ['He pays cash. He talks when he drinks.'], held.map(k => {
    const c = F.CROPS[k];
    return { label: `Sell ${st.stash[k]} ${c.name}`, go: () => F.sell('skiv', k) };
  }));
}
