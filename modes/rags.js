// Rags to Riches: a separate career mode for Mars. Start broke in Red Tape Flats, buy property, defend it, climb to Helios Heights.
// Its own save (ssx.r2r.v1). While it's active your normal credits are stashed and restored when you return to the normal game.
// Property raids go through the generic SSX.raids engine (modes/raids.js), the same API base building uses.
import * as THREE from 'three';
import { addMenuItem, tap } from '../racehooks.js';
import * as R from './ragscore.js';

const KEY = 'ssx.r2r.v1', MENU_ID = 'r2rMenuBtn', CTX_ID = 'r2rCtxBtn', PANEL_ID = 'r2rPanel', ALERT_ID = 'r2rAlert';
let C = null, data = null, loading = null, S = null, ui = null, root = null, rootPlanet = null, meshes = {}, nearProp = null;
let wasDown = false, respawnT = 0, raidLive = null, raidPending = null, saveT = 0, hustleWatch = {}, gateCd = 0, roverCd = 0, menuLabel = '';
const app = () => window.__app;
const toast = (m, ms) => { try { app()?.toast?.(m, ms || 2600); } catch {} };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const P = () => C?.game?.debug?.P?.() || C?.game?.progress || null;

function loadData() {
  if (data || loading) return loading;
  // same ?v= as the modules, so the service worker caches it per release
  loading = fetch(new URL('./rags-data.json' + (new URL(import.meta.url).search || ''), import.meta.url)).then(r => r.json()).then(d => {
    data = d;
    // feature-detect district registration: use whatever centres the city pack registered
    try {
      const city = window.SSX?.city?.districts, reg = [...(window.SSX?.districtsOf?.('Mars') || []), ...(city ? Object.entries(city).map(([id, d]) => ({ id, ...d })) : [])];
      for (const k of Object.keys(data.districts)) {
        const dd = data.districts[k], hit = reg.find(r => r.id === dd.districtId || r.name === dd.name);
        const c = hit?.origin || hit?.centre || hit?.center; if (Array.isArray(c) && c.length === 2 && c.every(Number.isFinite)) dd.center = [c[0], c[1]]; // colony-relative, same frame as our data
      }
    } catch {}
    S = load();
    return data;
  }).catch(e => { console.warn('[r2r] data', e); loading = null; });
  return loading;
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1) { const f = R.freshState(data); return { ...f, ...s, props: { ...f.props, ...s.props }, stats: { ...f.stats, ...s.stats } }; } } catch {}
  return R.freshState(data);
}
function save() { if (!S) return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }

const toW = aj => { const col = C?.world?.colony; return col ? { x: col.x + aj[0], z: col.z + aj[1] } : null; };
const here = () => C.car ? { x: C.car.x, z: C.car.z } : { x: C.player.x, z: C.player.z };
const distAJ = aj => { const w = toW(aj), p = here(); return w ? Math.hypot(w.x - p.x, w.z - p.z) : 1e9; };
const raidsApi = () => window.SSX?.raids || null;
// street prices for hot goods move the chop shop's take (SSX.contraband when the city pack provides it; neutral otherwise)
// street prices for hot goods move the chop shop's take: SSX.contraband.buyerPrice('hot_plates', Flats) over the item's
// base value (mars/contraband.js v7.5.1). Neutral (1) when the module or item is missing. Cached for 5 s (price lookups walk the stash).
let cbCache = { t: -1e9, m: 1 };
const contraband = () => { const now = performance.now(); if (now - cbCache.t < 5000) return cbCache.m; let m = 1;
  try { const X = window.SSX?.contraband; if (typeof X?.buyerPrice === 'function') { const it = ['hot_plates', 'salvage'].map(id => [id, X.items?.().find(i => i.id === id)]).find(([, i]) => i);
      const v = it && X.buyerPrice(it[0], 'red-tape-flats'), b = it && (it[1].vals?.['red-tape-flats'] || it[1].base); if (Number.isFinite(v) && b > 0) m = R.clamp(v / b, 0.6, 1.6); } } catch {}
  cbCache = { t: now, m }; return m; };
const bark = (who, cat) => { try { window.SSX?.bark?.({ name: who, kind: 'contact' }, cat); } catch {} };

// ---------- mode switching ----------
function startNew() {
  const p = P(); if (!p) return toast('Land on Mars first.');
  const keepStash = S?.active ? S.stash : null;
  S = R.freshState(data);
  S.active = true; S.started = Date.now(); S.stash = keepStash || { credits: p.credits };
  p.credits = data.start.credits; C.game.save?.();
  S.pendingSpawn = true; save(); closePanel();
  if (C.name !== 'Mars') { toast('Rags to Riches starts on Mars. Fly there and land.', 4000); return; }
  toast(`Rags to Riches: ${data.start.credits} credits, no rover, a crash pad in Red Tape Flats. Go.`, 4200);
  bark('Marrow', 'greet');
}
function resume() {
  const p = P(); if (!p || !S?.started) return;
  if (!S.active) { S.stash = { credits: p.credits }; p.credits = S.cash; S.active = true; S.pendingSpawn = true; C.game.save?.(); save(); }
  closePanel(); toast('Back on the climb.');
}
function quit() {
  const p = P(); if (!p || !S?.active) return;
  if (raidLive) raidsApi()?.stop?.(raidLive.raidId, 'quit');
  S.cash = p.credits; p.credits = S.stash?.credits ?? p.credits; S.active = false; S.stash = null;
  C.game.save?.(); save(); closePanel(); updateCtx(null); toast('Back to the normal game. Your Rags to Riches run is saved.');
}

// ---------- world props ----------
function signTexture(text, color) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d');
  g.fillStyle = '#0b0710'; g.fillRect(0, 0, 256, 64); g.fillStyle = color; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 34); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildProps() {
  root = new THREE.Group(); root.name = 'r2r'; meshes = {};
  const box = new THREE.BoxGeometry(1, 1, 1), plane = new THREE.PlaneGeometry(1, 1);
  box.userData.shared = true; plane.userData.shared = true;
  const doorMat = new THREE.MeshBasicMaterial({ color: 0x66e0ff, transparent: true, opacity: 0.85 });
  for (const def of data.properties) {
    const door = toW(def.door), dc = toW(data.districts[def.district].center); if (!door || !dc) continue;
    let dx = door.x - dc.x, dz = door.z - dc.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const [w, d, h] = def.size, cx = door.x + dx * d / 2, cz = door.z + dz * d / 2, y = C.height(cx, cz);
    const g = new THREE.Group(); g.position.set(cx, y, cz); g.rotation.y = Math.atan2(-dx, -dz);
    const mat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.85 });
    // properties in an existing city building (WRENCH'S, RED SHIFT) only get a door marker, sign and flag
    if (!def.building) { const body = new THREE.Mesh(box, mat); body.scale.set(w, h, d); body.position.y = h / 2; g.add(body); }
    const dm = new THREE.Mesh(plane, doorMat); dm.scale.set(1.6, 2.4, 1); dm.position.set(0, 1.2, def.building ? -d / 2 + 0.3 : d / 2 + 0.02); g.add(dm);
    if (def.building) { g.position.set(door.x, C.height(door.x, door.z), door.z); dm.position.z = 0; }
    const sm = new THREE.MeshBasicMaterial({ map: signTexture(def.sign, '#ff5a8a') });
    const sign = new THREE.Mesh(plane, sm); sign.scale.set(Math.min(w * 0.8, 8), Math.min(w * 0.8, 8) / 4, 1);
    const flag = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0x3cff9a })); flag.scale.set(0.15, 1.6, 0.15);
    if (def.building) { sign.scale.multiplyScalar(0.45); sign.position.set(0, 3.2, 0); flag.position.set(1.4, 3.0, 0); }
    else { sign.position.set(0, h + 0.9, d / 2 * 0.6); flag.position.set(w / 2 - 0.4, h + 0.8, d / 2 - 0.4); }
    g.add(sign); g.add(flag);
    root.add(g); meshes[def.id] = { g, flag, sign: sm };
  }
  // crash pad + unlocked spawns: a mattress-and-tarp marker
  for (const [id, sp] of Object.entries(data.spawns)) {
    const p = toW(sp.aj); if (!p) continue;
    const m = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: id === 'crashpad' ? 0x5a5048 : 0x40506a })); m.scale.set(2.2, 0.35, 1.2);
    m.position.set(p.x, C.height(p.x, p.z) + 0.2, p.z); m.userData.spawn = id; root.add(m); meshes['spawn:' + id] = { g: m };
  }
  const beam = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.55, depthWrite: false }));
  beam.scale.set(0.8, 160, 0.8); beam.visible = false; root.add(beam); meshes.beam = { g: beam };
  rootPlanet = C.name;
}
function ensureProps() {
  if (C.name !== 'Mars' || !S?.active) { if (root?.parent) root.parent.remove(root); return; }
  if (!root || rootPlanet !== C.name) buildProps();
  if (!root.parent || root.userData.scene !== C.scene) { C.scene.add(root); root.userData.scene = C.scene; }
  for (const def of data.properties) { const m = meshes[def.id], st = S.props[def.id]; if (m) m.flag.visible = !!st.owned; }
  for (const [id, sp] of Object.entries(data.spawns)) { const m = meshes['spawn:' + id]; if (m) m.g.visible = sp.tier <= S.tier; }
  const bd = S.beacon && R.propDef(data, S.beacon), beam = meshes.beam?.g;
  if (beam) { const w = bd && toW(bd.door); if (w && distAJ(bd.door) > 12) { beam.position.set(w.x, C.height(w.x, w.z) + 80, w.z); beam.visible = true; } else { beam.visible = false; if (bd) S.beacon = null; } }
}

// ---------- UI ----------
const CSS = `
#${CTX_ID} { background: linear-gradient(135deg, rgba(255,170,60,0.8), rgba(220,80,60,0.8)) !important; border-color: rgba(255,210,150,0.6) !important; }
#${PANEL_ID} { position: fixed; inset: 0; z-index: 15; display: none; background: rgba(10,6,4,0.95); overflow-y: auto; -webkit-overflow-scrolling: touch; color: #fff;
  padding: calc(env(safe-area-inset-top) + 14px) 14px calc(env(safe-area-inset-bottom) + 18px); font-family: inherit; touch-action: pan-y; }
#${PANEL_ID}.on { display: block; } #${PANEL_ID} .wrap { max-width: 640px; margin: 0 auto; } #${PANEL_ID} h2 { margin: 6px 0 2px; }
#${PANEL_ID} .sub { opacity: 0.72; font-size: 0.8rem; margin-bottom: 10px; }
#${PANEL_ID} .item { padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,0.06); margin-bottom: 8px; font-size: 0.84rem; border: 1px solid rgba(255,255,255,0.08); }
#${PANEL_ID} .item.locked { opacity: 0.5; } #${PANEL_ID} .item small { opacity: 0.75; display: block; margin-top: 2px; }
#${PANEL_ID} .row { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
#${PANEL_ID} .bar { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.12); overflow: hidden; margin-top: 6px; } #${PANEL_ID} .bar i { display: block; height: 100%; background: linear-gradient(90deg,#ffb347,#ff5a5a); }
#${PANEL_ID} button { min-height: 44px; border-radius: 10px; font-weight: 800; color: #fff; background: rgba(70,50,40,0.95); border: 1px solid rgba(255,190,140,0.35); padding: 0 12px; font-size: 0.82rem; }
#${PANEL_ID} button.go { background: linear-gradient(135deg, rgba(255,170,60,0.95), rgba(220,80,60,0.95)); border: none; flex: 1; }
#${PANEL_ID} button:disabled { opacity: 0.45; }
#${PANEL_ID} .close { float: right; } #${PANEL_ID} .foot { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; } #${PANEL_ID} .foot button { flex: 1; }
#${ALERT_ID} { display: none; pointer-events: none; padding: 6px 10px; border-radius: 10px; background: rgba(120,20,20,0.85); border: 1px solid rgba(255,140,120,0.45);
  color: #fff; font-weight: 800; font-size: 0.74rem; line-height: 1.25; text-align: right; }
#${ALERT_ID}.on { display: block; }`;
function ensureUi() {
  if (ui && document.getElementById(PANEL_ID)) return ui;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const panel = document.createElement('div'); panel.id = PANEL_ID; document.body.appendChild(panel);
  const alert = document.createElement('div'); alert.id = ALERT_ID; // lives in the HUD's right stack so it flows with toasts and radio
  const ctx = document.createElement('button'); ctx.id = CTX_ID; ctx.className = 'glass'; ctx.style.display = 'none';
  tap(ctx, () => { if (nearProp) openProp(nearProp); });
  panel.addEventListener('pointerdown', e => e.stopPropagation());
  ui = { panel, alert, ctx };
  return ui;
}
function ensureMenu() {
  const label = S?.active ? '🧱 Rags to Riches: progress' : '🧱 New Game: Rags to Riches';
  const el = document.getElementById(MENU_ID);
  if (el && label === menuLabel) return;
  if (el && el.textContent !== label) { el.textContent = label; menuLabel = label; return; }
  if (!document.getElementById('roverMenu')) return;
  addMenuItem(app() && window.SSX ? window.SSX : app(), { id: MENU_ID, label, onTap: () => openMain() });
  menuLabel = label;
}
function updateCtx(def) {
  ensureUi(); const b = ui.ctx, bar = document.getElementById('surfBtns');
  if (!def) { b.style.display = 'none'; return; }
  if (bar && b.parentNode !== bar) bar.prepend(b);
  const st = S.props[def.id];
  b.textContent = st.owned ? (st.stored >= 1 ? `💰 ${Math.floor(st.stored)}` : '🏠 Manage') : `🔑 ${def.price}`;
  b.style.display = '';
}
function closePanel() { ui?.panel.classList.remove('on'); }
function show(html, bind) { ensureUi(); ui.panel.innerHTML = `<div class="wrap">${html}</div>`; ui.panel.classList.add('on'); for (const [sel, fn] of bind) for (const el of ui.panel.querySelectorAll(sel)) tap(el, () => fn(el)); }

function openMain() {
  if (!data) { loadData()?.then(() => openMain()); return; }
  if (!S.active) {
    const saved = S.started && !S.active;
    show(`<button class="close" data-a="close">✕</button><h2>🧱 Rags to Riches</h2>
      <div class="sub">A separate career on Mars. Your normal credits are put aside until you come back.</div>
      <div class="item">Start broke in <b>Red Tape Flats</b> with ${data.start.credits} credits, a crash pad and no rover.
      Buy a noodle cart, a chop shop, a club on Olympus Row, and finally a mansion in <b>Helios Heights</b>. Rival crews and ColSec will come for what's yours.
      <small>M-rated crime sim. Separate save.</small></div>
      ${saved ? `<div class="item">Saved run: ${esc(data.tiers[S.tier].name)} · net worth ${R.netWorth(S, data)} cr</div>` : ''}
      <div class="foot">${saved ? '<button class="go" data-a="resume">Continue run</button>' : ''}<button class="go" data-a="new">${saved ? 'Start over' : 'New Game: Rags to Riches'}</button></div>`,
      [['[data-a=close]', closePanel], ['[data-a=new]', startNew], ['[data-a=resume]', resume]]);
    return;
  }
  const nw = R.netWorth(S, data), t = data.tiers[S.tier], nt = data.tiers[S.tier + 1], goal = R.nextGoal(S, data);
  const pct = nt ? Math.min(100, Math.round(100 * Math.min(nw / nt.netWorth, nt.rep ? S.rep / nt.rep : 1))) : 100;
  const props = data.properties.map(def => {
    const st = S.props[def.id], locked = def.tier > S.tier;
    return `<div class="item ${locked ? 'locked' : ''}"><b>${esc(def.name)}</b> · ${esc(data.districts[def.district].name)}
      <small>${st.owned ? `Owned · ${Math.floor(st.stored)}/${R.incomeCap(def, st)} cr waiting · security ${st.secLvl} · income ${st.incomeLvl}${st.damaged > 0 ? ' · ⚠️ trashed, repairing' : ''}`
        : locked ? `Unlocks at ${esc(data.tiers[def.tier].name)}` : `For sale: ${def.price} cr · ${def.incomePerMin} cr/min`}</small>
      <div class="row"><button data-a="goto" data-id="${def.id}" ${locked ? 'disabled' : ''}>📍 Waypoint</button>${st.owned || !locked ? `<button data-a="prop" data-id="${def.id}">Details</button>` : ''}</div></div>`;
  }).join('');
  const spawns = Object.entries(data.spawns).filter(([, sp]) => sp.tier <= S.tier).map(([id, sp]) => `<button data-a="spawn" data-id="${id}">🛏 ${esc(sp.name)}</button>`).join('');
  const contacts = data.tiers.slice(0, S.tier + 1).flatMap(x => x.unlocks.contacts).join(', ');
  const hustles = data.hustles.filter(h => h.tier <= S.tier).map(h => `<button data-a="hustle" data-id="${h.id}">${esc(h.title.replace('R2R: ', ''))} · ${h.pay} cr</button>`).join('');
  const acts = activityList().map(a => `<button data-a="act" data-id="${a.id}">${esc(a.name)}</button>`).join('');
  show(`<button class="close" data-a="close">✕</button><h2>🧱 ${esc(t.name)}</h2>
    <div class="sub">${esc(t.blurb)}</div>
    <div class="item"><b>Net worth ${nw} cr</b> · cash ${Math.floor(P()?.credits ?? S.cash)} · rep ${S.rep}${S.hasRover ? ' · 🚙 rover' : ' · no rover'}
      <div class="bar"><i style="width:${pct}%"></i></div><small>Next: ${esc(goal.text)}</small></div>
    ${props}
    <div class="item"><b>Hustles</b><small>Quick jobs from your contacts (${esc(contacts)}).</small><div class="row">${hustles}</div>
      ${acts ? `<small>Side jobs in your districts:</small><div class="row">${acts}</div>` : ''}</div>
    <div class="item"><b>Spawn points</b><small>Respawn and fast travel to places you've earned.</small><div class="row">${spawns}</div></div>
    ${!S.hasRover ? `<div class="item"><b>Wrench's beater rover</b><small>${data.rover.price} cr. Until then you walk, or borrow something that isn't yours.</small><div class="row"><button data-a="rover" ${(P()?.credits ?? 0) < data.rover.price ? 'disabled' : ''}>Buy rover</button></div></div>` : ''}
    <div class="sub">Raids won ${S.stats.raidsWon} · lost ${S.stats.raidsLost} · collected ${S.stats.collected} cr</div>
    <div class="foot"><button data-a="quit">Return to normal game</button><button data-a="new">Start over</button></div>`,
    [['[data-a=close]', closePanel], ['[data-a=quit]', quit], ['[data-a=new]', startNew], ['[data-a=rover]', buyRover],
     ['[data-a=goto]', el => waypointTo(el.dataset.id)], ['[data-a=prop]', el => openProp(R.propDef(data, el.dataset.id))],
     ['[data-a=spawn]', el => { goSpawn(el.dataset.id); closePanel(); }], ['[data-a=hustle]', el => startHustle(el.dataset.id)],
     ['[data-a=act]', el => { closePanel(); const r = window.__activities?.start?.(el.dataset.id); if (r && r.ok === false) toast(r.why); }]]);
}
function openProp(def) {
  if (!def) return;
  const st = S.props[def.id], cash = P()?.credits ?? 0, price = def.price, near = distAJ(def.door) < 9;
  const up = k => { const lvl = k === 'security' ? st.secLvl : st.incomeLvl, u = data.upgrades[k]; if (lvl >= u.max) return `<button disabled>${k === 'security' ? '🛡' : '📈'} Maxed</button>`;
    const c = R.upgradeCost(def, k, lvl, data); return `<button data-a="up" data-k="${k}" ${cash < c ? 'disabled' : ''}>${k === 'security' ? '🛡' : '📈'} ${esc(u.names[lvl])} · ${c}</button>`; };
  show(`<button class="close" data-a="close">✕</button><h2>${esc(def.name)}</h2><div class="sub">${esc(data.districts[def.district].name)}${def.contact ? ' · ' + esc(def.contact) : ''}</div>
    <div class="item">${esc(def.pitch)}<small>${def.incomePerMin} cr/min base${def.contraband && contraband() !== 1 ? ` (hot-parts prices ×${contraband().toFixed(2)})` : ''} · holds ${R.incomeCap(def, st)} cr · raids by ${def.raidAttackers.join(' / ')}</small></div>
    ${st.owned ? `<div class="item"><b>${Math.floor(st.stored)} cr waiting</b>${st.damaged > 0 ? `<small>⚠️ Trashed in a raid. Back in business in ${Math.ceil(st.damaged)}s.</small>` : ''}
        <div class="row"><button class="go" data-a="collect" ${!near || st.stored < 1 ? 'disabled' : ''}>💰 Collect${near ? '' : ' (go to the door)'}</button></div></div>
      <div class="item"><b>Upgrades</b><small>Security cuts raid odds and size and toughens the place. Income raises the rate and the cap.</small><div class="row">${up('security')}${up('income')}</div></div>`
    : `<div class="item"><b>${price} cr</b><div class="row"><button class="go" data-a="buy" ${cash < price || !near || def.tier > S.tier ? 'disabled' : ''}>🔑 Buy${near ? '' : ' (at the door)'}</button></div></div>`}
    <div class="foot"><button data-a="back">Progress</button><button data-a="close">Close</button></div>`,
    [['[data-a=close]', closePanel], ['[data-a=back]', openMain], ['[data-a=buy]', () => buy(def.id)], ['[data-a=collect]', () => collect(def.id)],
     ['[data-a=up]', el => upgrade(def.id, el.dataset.k)]]);
}

// ---------- economy ----------
function buy(id) {
  const def = R.propDef(data, id), st = S.props[id], p = P(); if (!def || st.owned) return false;
  if (def.tier > S.tier) { toast(`Locked until ${data.tiers[def.tier].name}.`); return false; }
  const price = def.price;
  if (!C.game.spend?.(price)) { toast(`Need ${price} cr.`); return false; }
  st.owned = true; st.stored = 0; st.boughtAt = Date.now(); S.cash = p.credits; save(); C.game.save?.();
  toast(`🔑 ${def.name} is yours. Money starts rolling in.`, 3200); if (def.contact) bark(def.contact, 'deal');
  checkTier(); openProp(def); return true;
}
function collect(id) {
  const def = R.propDef(data, id), st = S.props[id], p = P(); if (!st?.owned) return 0;
  const amt = Math.floor(st.stored || 0); if (amt < 1) return 0;
  st.stored -= amt; p.credits += amt; S.cash = p.credits; S.stats.collected += amt;
  S.repFrac = (S.repFrac || 0) + amt / 100 * data.rep.per100Collected; const whole = Math.floor(S.repFrac); S.repFrac -= whole; S.rep += whole;
  save(); C.game.save?.(); toast(`💰 +${amt} cr from ${def.name}`); checkTier();
  if (ui?.panel.classList.contains('on')) openProp(def);
  return amt;
}
function upgrade(id, kind) {
  const def = R.propDef(data, id), st = S.props[id], k = kind === 'security' ? 'secLvl' : 'incomeLvl';
  if (!st?.owned || st[k] >= data.upgrades[kind].max) return false;
  const c = R.upgradeCost(def, kind, st[k], data);
  if (!C.game.spend?.(c)) { toast(`Need ${c} cr.`); return false; }
  st[k]++; S.cash = P().credits; save(); C.game.save?.(); toast(`${data.upgrades[kind].names[st[k] - 1]} installed at ${def.name}.`); checkTier(); openProp(def); return true;
}
function buyRover() {
  if (S.hasRover) return;
  if (!C.game.spend?.(data.rover.price)) return toast(`Need ${data.rover.price} cr.`);
  S.hasRover = true; S.cash = P().credits; save();
  try { window.SSX?.garage?.grantVehicle?.('rover', { source: 'r2r' }); } catch {}
  toast(data.rover.line, 3200); checkTier(); openMain();
}
function checkTier() {
  const nw = R.netWorth(S, data), t = R.tierFor(nw, S.rep, data);
  if (t > S.tier) {
    S.tier = t; const tier = data.tiers[t]; save();
    toast(`⬆️ ${tier.name}! New spawn, new contacts: ${tier.unlocks.contacts.join(', ')}${tier.unlocks.gate ? '. Helios gate is open to you.' : '.'}`, 5000);
    bark(tier.unlocks.contacts[0], 'greet');
  }
}
// the game's waypoint follows the active quest, so properties get their own light beam
function waypointTo(id) {
  const def = R.propDef(data, id), w = def && toW(def.door); if (!w) return;
  S.beacon = id; save(); closePanel();
  const p = here(), d = Math.round(Math.hypot(w.x - p.x, w.z - p.z));
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'], a = Math.atan2(w.x - p.x, -(w.z - p.z));
  toast(`📍 ${def.name}: ${d} m ${dirs[(Math.round(a / (Math.PI / 4)) + 8) % 8]}. Follow the orange beam.`, 3600);
}
function goSpawn(id) {
  const sp = data.spawns[id], w = sp && toW(sp.aj), s = app()?.surface; if (!w || !s) return;
  if (s.info?.driving) s.interact?.();
  s.debugMove?.(w.x, w.z, 0);
}

// ---------- hustles (fallback income jobs; the activity runner is used when present) ----------
function activityList() {
  const A = window.__activities; if (!A?.list || !A.start) return [];
  const ids = new Set(data.activitiesByTier.slice(0, S.tier + 1).flat());
  try { return A.list().filter(a => ids.has(a.id) && !a.deferred); } catch { return []; }
}
function registerHustles() {
  if (registerHustles.done || !C.game.registerMission) return; registerHustles.done = true;
  for (const h of data.hustles) {
    try { C.game.registerMission({ id: h.id, world: 'Mars', title: h.title, contact: h.contact, intro: h.intro, steps: h.steps, reward: { xp: h.xp, credits: h.pay }, fiction: true }); } catch (e) { console.warn('[r2r] hustle', e); }
  }
}
function startHustle(id) {
  const h = data.hustles.find(x => x.id === id); if (!h) return;
  registerHustles(); const p = P();
  if (p?.quests) delete p.quests[id]; // fresh every time so it pays in full
  if (C.game.accept?.(id)) { hustleWatch[id] = true; closePanel(); toast(`${h.contact}: on it.`); } else toast('Can\u2019t take that job right now.');
}
function watchHustles() {
  const p = P(); if (!p?.quests) return;
  for (const id of Object.keys(hustleWatch)) {
    const q = p.quests[id]; if (!q) continue;
    if (q.everDone) { delete hustleWatch[id]; delete p.quests[id]; S.rep += data.rep.hustle; S.stats.hustles++; S.cash = p.credits; save(); checkTier(); }
    else if (q.status !== 'active') delete hustleWatch[id];
  }
}

// ---------- raids ----------
function triggerRaid(id, opts = {}) {
  const def = R.propDef(data, id), st = S.props[id]; if (!def || !st?.owned || raidLive || raidPending) return false;
  const attackers = opts.attackers || def.raidAttackers[Math.floor(Math.random() * def.raidAttackers.length)];
  const near = opts.live ?? distAJ(def.door) < 90;
  if (near) return startLiveRaid(def, attackers);
  raidPending = { id, attackers, t: opts.grace ?? 45 };
  showAlert(`⚠️ ${attackers === 'colsec' ? 'ColSec' : 'The Rustline crew'} is hitting ${def.name}! Get there (${Math.ceil(raidPending.t)}s)`);
  if (def.contact) bark(def.contact, 'warn');
  return true;
}
function startLiveRaid(def, attackers) {
  const api = raidsApi(); const st = S.props[def.id];
  if (!api?.start) { resolveAway(def, attackers); return false; }
  const res = api.start({ id: 'r2r-' + def.id, pos: def.door, radius: Math.max(def.size[0], def.size[2]) + 10, attackers, waves: R.wavePlan(def, st, !!C.isMobile),
    integrity: R.raidIntegrity(def, st), label: def.name,
    onWin: info => raidOver(def, true, info), onLose: info => raidOver(def, false, info) });
  if (!res?.ok) { resolveAway(def, attackers); return false; }
  raidLive = { id: def.id, raidId: res.id };
  showAlert(`⚔️ Defend ${def.name}!`);
  return true;
}
function raidOver(def, won, info) {
  const st = S.props[def.id]; raidLive = null;
  if (won) { S.rep += data.rep.raidWin; S.stats.raidsWon++; const bonus = Math.round(def.price * 0.05); P().credits += bonus; S.cash = P().credits; toast(`🛡 ${def.name} held! +${bonus} cr, +${data.rep.raidWin} rep.`, 3600); }
  else { const pen = R.raidLossPenalty(def, st); st.stored = Math.max(0, st.stored - pen.stored); st.damaged = pen.downtime; S.rep = Math.max(0, S.rep + data.rep.raidLoss); S.stats.raidsLost++;
    toast(`💥 ${def.name} got trashed${info?.why === 'down' ? ' while you were down' : info?.why === 'fled' ? ' after you ran' : ''}. Lost ${pen.stored} cr.`, 4000); }
  save(); checkTier(); hideAlert();
}
function resolveAway(def, attackers) {
  const st = S.props[def.id], won = Math.random() < R.autoDefendChance(st);
  raidPending = null; hideAlert();
  if (won) { toast(`🛡 Your people at ${def.name} held off the ${attackers === 'colsec' ? 'ColSec squad' : 'crew'}.`, 3600); S.stats.raidsWon++; save(); }
  else raidOver(def, false, { why: 'away' });
}
function showAlert(t) { ensureUi(); const st = document.getElementById('stackR'); if (st && ui.alert.parentNode !== st) st.prepend(ui.alert); ui.alert.textContent = t; ui.alert.classList.add('on'); }
function hideAlert() { ui?.alert.classList.remove('on'); }

// ---------- tick ----------
export function ragsTick(dt, ctx) {
  C = ctx;
  if (!data) { loadData(); return; }
  ensureUi(); ensureMenu();
  if (!S.active) { updateCtx(null); hideAlert(); if (root?.parent) root.parent.remove(root); return; }
  if (ctx.name !== 'Mars' || !ctx.world?.colony) { updateCtx(null); return; }
  ensureProps(); registerHustles();
  const p = P(); if (p) S.cash = p.credits;
  const sf = app()?.surface;
  if (S.pendingSpawn && sf) { S.pendingSpawn = false; goSpawn('crashpad'); save(); }
  // respawns land you at your best spawn point, not the ship
  const down = !!ctx.game.isDown?.();
  if (wasDown && !down) respawnT = 0.6; wasDown = down;
  if (respawnT > 0 && (respawnT -= dt) <= 0) goSpawn(Object.entries(data.spawns).filter(([, s]) => s.tier <= S.tier).pop()[0]);
  // no rover until you buy one: your own rover won't start (stolen rides are fair game)
  roverCd -= dt;
  if (!S.hasRover && ctx.car && ctx.car === ctx.rover && roverCd <= 0) { roverCd = 1.5; sf?.interact?.(); toast('No rover yet. Buy Wrench\u2019s beater, or borrow something.', 2800); }
  // Helios gate: residents and guests only
  gateCd -= dt;
  const hel = data.districts.helios;
  if (S.tier < 2 && distAJ(hel.center) < hel.radius && gateCd <= 0) {
    gateCd = 2; const o = toW(data.helios_gate.outside);
    if (sf?.info?.driving) sf.interact?.(); sf?.debugMove?.(o.x, o.z, Math.PI);
    toast(data.helios_gate.line, 3600); bark('Porter', 'deny');
  }
  // income ticks everywhere; you collect in person
  for (const def of data.properties) {
    const st = S.props[def.id]; if (!st.owned) continue;
    if (st.damaged > 0) st.damaged = Math.max(0, st.damaged - dt);
    R.accrue(def, st, def.contraband ? dt * contraband() : dt);
  }
  // raids roll once a minute per property
  S.raidClock = (S.raidClock || 0) + dt;
  if (S.raidClock >= 60) { S.raidClock = 0;
    for (const def of data.properties) { const st = S.props[def.id]; if (st.owned && !st.damaged && Math.random() < R.raidChancePerMin(def, st)) { triggerRaid(def.id); break; } } }
  if (raidPending) {
    const def = R.propDef(data, raidPending.id);
    raidPending.t -= dt;
    if (distAJ(def.door) < 40) { const a = raidPending.attackers; raidPending = null; startLiveRaid(def, a); }
    else if (raidPending.t <= 0) resolveAway(def, raidPending.attackers);
    else showAlert(`⚠️ ${raidPending.attackers === 'colsec' ? 'ColSec' : 'The Rustline crew'} is hitting ${def.name}! Get there (${Math.ceil(raidPending.t)}s)`);
  }
  if (raidLive) {
    const a = raidsApi()?.active?.();
    if (!a) { raidLive = null; hideAlert(); } // engine ended it without callbacks (e.g. another engine)
    else if (a.id === raidLive.raidId) showAlert(`⚔️ ${a.label}: ${a.wave ? `wave ${a.wave}/${a.waves} · ${a.alive + a.queued} left` : 'crew incoming'} · 🧱 ${Math.round(100 * a.integrity / a.maxIntegrity)}%`);
  }
  watchHustles();
  // context button at property doors
  let near = null, nd = 7;
  if (!raidLive) for (const def of data.properties) { if (def.tier > S.tier && !S.props[def.id].owned) continue; const d = distAJ(def.door); if (d < nd) { nd = d; near = def; } }
  nearProp = near; updateCtx(near);
  if ((saveT += dt) > 5) { saveT = 0; save(); }
}

// test/debug surface
if (typeof window !== 'undefined') window.__r2r = {
  get state() { return S; }, get data() { return data; }, get netWorth() { return S && data ? R.netWorth(S, data) : 0; }, get near() { return nearProp?.id || null; },
  get contrabandMult() { cbCache.t = -1e9; return contraband(); },
  ready: () => loadData(), open: () => openMain(), startNew: () => startNew(), quit: () => quit(), resume: () => resume(),
  warp: id => { const def = R.propDef(data, id); const w = def && toW(def.door); if (w) { const s = app()?.surface; if (s?.info?.driving) s.interact?.(); s?.debugMove?.(w.x, w.z, 0); } return !!w; },
  advance: sec => { for (const def of data.properties) { const st = S.props[def.id]; if (st.owned) R.accrue(def, st, sec); } return S.props; },
  buy, collect, upgrade, raid: (id, opts) => triggerRaid(id, opts), checkTier, toW, get raidLive() { return raidLive; }, get raidPending() { return raidPending; }
};
