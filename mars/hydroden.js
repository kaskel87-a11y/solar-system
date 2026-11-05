// v7.5.25 The Hydro Den: the big ARES JUNCTION dome is now a walk-in black-market grow house (window.SSX.hydroden).
// Walk (or drive) up to the dome's south airlock, tap 🚪 Enter Hydro Den, and Sister Nettle swaps your farm crops (her runner
// pulls them from your Dustbowl Homestead silo) and the moonshine crates in your rover (SSX.liquor, mars/still.js) for
// contraband in your stash (SSX.contraband.add). Rates + heat in mars/hydrodencore.js. Fiction only.
// Built on the v7.3 interior framework: one world.js dome entry gets an interior kind (so world.js builds the airlock door),
// the room is built on first entry and hidden between visits, so phones pay ~20 draws only while you're inside.
// Outside: one sprite over the airlock + a 🌿 minimap mark.
import * as THREE from 'three';
import { COLONIES } from '../world.js';
import { registerInterior, textTex } from '../interiors.js';
import * as K from './hydrodencore.js';

// ---------- the dome gets a door (before the colony is built) ----------
let tagged = false;
(function tagDome() {
  try {
    const D = COLONIES.Mars?.domes; if (!Array.isArray(D)) return;
    const d = D.find(x => x[3] === K.DOME_SIGN); if (!d) return;
    d[4] = d[4] ?? 0xff7a2a; d[5] = K.KIND; d[6] = K.TITLE; tagged = true;
    COLONIES.Mars.inside = COLONIES.Mars.inside || {}; COLONIES.Mars.inside[K.KIND] = { talk: K.DEALER };
  } catch (e) { console.warn('hydroden: dome', e); }
})();

// ---------- helpers ----------
const SSX = () => window.SSX || {};
const surf = () => window.__app?.surface, game = () => window.__app?.surface?.game, world = () => surf()?.world;
const toast = (t, ms = 3200) => { try { window.__app?.toast?.(t, ms); } catch (e) { /* */ } };
const inKind = () => surf()?.info?.inside?.kind || null;
const inside = () => inKind() === K.KIND;
const credits = () => game()?.progress?.credits ?? 0;
const pay = n => { const g = game(); if (!g || n <= 0) return; g.progress.credits += Math.round(n); g.save?.(); };
const subs = new Set(); const emit = (type, d = {}) => { for (const f of subs) { try { f({ type, ...d }); } catch (e) { console.warn('hydroden listener', e); } } try { SSX().emit?.('hydroden:' + type, d); } catch (e) { /* */ } };
const stats = { trades: 0, goods: 0, units: 0, change: 0, heat: 0 };
let rng = Math.random;

// v7.5.30: one rentable grow rack (K.rackPlant / K.rackHarvest). Wall-clock readyAt so it keeps growing while you're away.
let rack = null; try { rack = JSON.parse(localStorage.getItem(K.RACK_KEY) || 'null')?.rack || null; } catch (e) { rack = null; }
const rackSt = () => rack;
const rackSave = () => { try { localStorage.setItem(K.RACK_KEY, JSON.stringify({ rack })); } catch (e) { /* private mode */ } };
function siloInfo() { try { const F = SSX().farm; return { owned: !!F?.status?.()?.owned, room: F?.siloRoom?.() ?? 0 }; } catch (e) { return { owned: false, room: 0 }; } }
function rackPlant(crop) {
  const r = K.rackPlant(rack, crop, credits()); if (!r.ok) { toast(r.msg, 2800); return r; }
  const g = game(); g.progress.credits -= r.cost; g.save?.(); rack = r.next; rackSave(); emit('rack', { do: 'plant', crop }); toast(r.msg, 3200); return r;
}
// harvest the ripe rack: to = 'silo' or a drug id (sell straight to Nettle). Checks it can happen BEFORE the raid roll.
function rackTake(to) {
  const ph = K.rackPhase(rack);
  if (ph.phase !== 'ready') { const m = ph.phase === 'empty' ? '🌱 Nothing planted. Pick a crop.' : `🌱 Not ripe yet. ${K.mmss(ph.ms)} left.`; toast(m, 2600); return { ok: false, msg: m }; }
  const crop = ph.crop;
  if (to === 'silo') { const si = siloInfo(); if (!si.owned) { const m = '🌱 You need the Dustbowl Homestead for a silo. Sell it to Nettle instead.'; toast(m, 3000); return { ok: false, msg: m }; } if (si.room < 1) { const m = '🌱 Your silo is full. Sell to Nettle instead.'; toast(m, 3000); return { ok: false, msg: m }; } }
  else { const q = K.quote(crop, ph.n, to, room(to), drugCost(to)); if (!q.ok) { toast('🌱 ' + q.msg, 2800); return q; } }
  let cops = 1; try { cops = SSX().time?.state?.()?.cops ?? 1; } catch (e) { /* */ }
  const w = world(), h = K.rackHarvest(rack, rng(), K.raidChance(w?.wanted || 0, cops));
  let raidMsg = '';
  if (h.raided) { stats.heat++; raidMsg = `🚨 ColSec raid! They bagged ${h.lost} ${K.goodName(crop)} as evidence. `; try { w?.crime?.(1, 'grow rack raid in the Hydro Den'); } catch (e) { /* */ } }
  let n = h.n, out;
  if (n < 1) { rack = null; out = { ok: true, raided: true, msg: raidMsg + 'Nothing left.' }; }
  else if (to === 'silo') {
    let b = null; try { b = SSX().farm.bank({ [crop]: n }, { hand: true, via: 'hydroden' }); } catch (e) { b = null; }
    const got = b?.got?.[crop] | 0; n -= got; rack = n > 0 ? { ...rack, n } : null;
    out = { ok: got > 0, raided: h.raided, got, msg: raidMsg + (got ? `🌱 ${got} ${K.goodIcon(crop)} ${K.goodName(crop)} into your silo.${n ? ` ${n} left on the rack (silo full).` : ' Rack is free.'}` : '🌱 The silo took nothing.') };
  } else {
    const q = K.quote(crop, n, to, room(to), drugCost(to)); let added = 0, change = 0, take = 0;
    if (q.ok) { take = q.take; try { added = SSX().contraband.add(to, q.units, 1)?.qty | 0; } catch (e) { added = 0; } change = take * q.each - added * q.cost; pay(change); stats.trades++; stats.goods += take; stats.units += added; }
    n -= take; rack = n > 0 ? { ...rack, n } : null;
    out = { ok: added > 0, raided: h.raided, units: added, change, msg: raidMsg + (added ? `🌿 Nettle takes ${take} ${K.goodName(crop)} off the rack: ${added} ${K.DRUGS[to].icon} ${K.DRUGS[to].name}${change ? ` + ${change} cr` : ''}.${n ? ` ${n} left on the rack.` : ' Rack is free.'}` : '🌿 Nettle: No room for it in your pockets.') };
  }
  rackSave(); emit('rack', { do: 'harvest', to, ...out }); toast(out.msg, 3400); return out;
}

// what you can bring: silo crops (Dustbowl Homestead) + moonshine crates in your rover
function goods() {
  const out = [];
  try { const F = SSX().farm, silo = F?.status?.()?.silo || {}; for (const id of K.CROP_IDS) { const n = silo[id] | 0; if (n > 0) out.push({ id, n, from: 'silo' }); } } catch (e) { /* no farm */ }
  try { for (const b of SSX().liquor?.inventory?.() || []) if (K.isShine(b.id) && b.n > 0) out.push({ id: b.id, n: b.n | 0, from: 'rover' }); } catch (e) { /* no still */ }
  return out;
}
function drugCost(id) { try { const p = SSX().contraband?.supplierPrice?.(id); if (Number.isFinite(p) && p > 0) return p; } catch (e) { /* */ } return K.DRUGS[id].cost; }
// stash slots left for one drug: its own cap and the 20-unit pocket cap
function room(id) {
  const C = SSX().contraband; if (!C) return 0;
  try {
    const it = (C.items?.() || []).find(x => x.id === id), cap = C.capacity?.() || { used: 0, max: 20 }, have = C.stash?.()?.items?.[id]?.qty | 0;
    return Math.max(0, Math.min((it?.max ?? 99) - have, cap.max - cap.used));
  } catch (e) { return 0; }
}
function quote(good, drug) { const g = goods().find(x => x.id === good); return K.quote(good, g?.n || 0, drug, room(drug), drugCost(drug)); }
function takeGood(id, n) {
  if (K.isCrop(id)) { try { return SSX().farm?.siloTake?.(id, n) | 0; } catch (e) { return 0; } }
  try { return SSX().liquor?.take?.(id, n) | 0; } catch (e) { return 0; }
}
function trade(good, drug) {
  if (!SSX().contraband) return { ok: false, msg: 'Nettle: No product today.' };
  const q = quote(good, drug); if (!q.ok) return q;
  const got = takeGood(good, q.take); if (got < 1) return { ok: false, why: 'gone', msg: `Your ${K.goodName(good)} came up empty.` };
  const units = Math.min(q.units, Math.floor(got * q.each / q.cost));
  let added = 0; if (units > 0) { try { added = SSX().contraband.add(drug, units, 1)?.qty | 0; } catch (e) { added = 0; } }
  const change = got * q.each - added * q.cost; pay(change);
  stats.trades++; stats.goods += got; stats.units += added; stats.change += change;
  const msg = `🌿 Nettle takes ${got} ${K.goodName(good)} and slides over ${added} ${K.DRUGS[drug].icon} ${K.DRUGS[drug].name}${change ? ` + ${change} cr` : ''}.`;
  const res = { ok: true, good, drug, take: got, units: added, change, msg, heat: false };
  // heat: maybe somebody on the rail is wearing a wire
  let cops = 1; try { cops = SSX().time?.state?.()?.cops ?? 1; } catch (e) { /* */ }
  const w = world(), ch = K.heatChance(added, w?.wanted || 0, cops);
  if (rng() < ch) { res.heat = true; stats.heat++; try { w?.crime?.(1, 'dealing in the Hydro Den'); } catch (e) { /* */ } }
  emit('trade', res); return res;
}

// ---------- v7.5.32: Nettle buys for cash (product off your stash; silo crops and rover shine) ----------
function stashQty(id) { try { return SSX().contraband?.stash?.()?.items?.[id]?.qty | 0; } catch (e) { return 0; } }
function cap() { try { return SSX().contraband?.capacity?.() || null; } catch (e) { return null; } }
function streetPrice(id) { try { const p = SSX().contraband?.buyerPrice?.(id); return Number.isFinite(p) ? p : null; } catch (e) { return null; } }
const fence = id => K.fencePrice(id, streetPrice(id));
function sellDrug(id, qty = 1) {
  const D = K.DRUGS[id], C = SSX().contraband; if (!D || !C) return { ok: false, msg: 'Nettle: Not buying that.' };
  const q = K.saleQuote(stashQty(id), qty, fence(id), D.name); if (!q.ok) return q;
  const got = C.remove?.(id, q.qty) | 0; if (got < 1) return { ok: false, msg: `You\u2019re not holding any ${D.name}.` };
  const total = got * q.each; pay(total); stats.sold = (stats.sold || 0) + got; stats.cash = (stats.cash || 0) + total;
  const res = { ok: true, kind: 'drug', id, qty: got, each: q.each, total, heat: false, msg: `💰 Nettle buys ${got} ${D.icon} ${D.name} for ${total} cr (${q.each} each).` };
  let cops = 1; try { cops = SSX().time?.state?.()?.cops ?? 1; } catch (e) { /* */ }
  const w = world(); if (rng() < K.heatChance(got, w?.wanted || 0, cops)) { res.heat = true; stats.heat++; try { w?.crime?.(1, 'dealing in the Hydro Den'); } catch (e) { /* */ } res.msg += ' 🚨 Somebody on the rail was wearing a wire.'; }
  emit('sell', res); return res;
}
function sellGood(id, qty = 'all') {
  const g = goods().find(x => x.id === id), name = K.goodName(id), q = K.saleQuote(g?.n || 0, qty, K.goodCash(id), name); if (!q.ok) return q;
  const got = takeGood(id, q.qty); if (got < 1) return { ok: false, msg: `Your ${name} came up empty.` };
  const total = got * q.each; pay(total); stats.cash = (stats.cash || 0) + total;
  const res = { ok: true, kind: 'good', id, qty: got, each: q.each, total, msg: `💰 Nettle pays ${total} cr for ${got} ${K.goodIcon(id)} ${name} (${q.each} each).` };
  emit('sell', res); return res;
}

// ---------- the room ----------
const live = { api: null, nettle: null, fan: null, n: 0 };
const anim = (h, t, k) => { const s = Math.sin(t * 1.4 + k); h.hips.position.y = h.base - Math.abs(s) * 0.02; h.torso.rotation.z = s * 0.04; h.head.rotation.y = Math.sin(t * 0.5 + k) * 0.5; h.arms[0].rotation.x = 0.4; h.arms[1].rotation.x = 0.9 + Math.sin(t * 2 + k) * 0.2; };
const hulk = (h, t) => { h.arms[0].rotation.x = 0.6; h.arms[1].rotation.x = 0.6; h.arms[0].rotation.z = 0.5; h.arms[1].rotation.z = -0.5; h.head.rotation.y = Math.sin(t * 0.35) * 0.6; };
registerInterior(K.KIND, {
  name: K.NAME, w: 16, d: 12, h: 5, wall: 0x22261c, floor: 0x15140f, ceil: 0x0e100c, trim: 0x7dff6a, light: { color: 0xd8a0ff, int: 62 },
  build(api) {
    const { box, mat, d, w } = api;
    const rack = mat(0x3a3e36, { metalness: 0.6, roughness: 0.5 }), soil = mat(0x2a1d12, { roughness: 1 }), wood = mat(0x4a3220, { roughness: 0.8 }), tarp = mat(0x1c3a2a, { roughness: 1 });
    const grow = mat(0xf0a0ff, { basic: true }), lime = mat(0x9dff6a, { basic: true });
    api.sign(K.TITLE, 0x7dff6a, 0, 3.7, -d / 2 + 0.08, 0, 5.2, { h: 96 });
    // grow racks down both walls: tray + soil + a purple grow bar above; the plants are one instanced draw
    const rows = [[-w / 2 + 1.1, -0.5], [w / 2 - 1.1, -0.5]];
    for (const [x, z] of rows) { box(x, 0.55, z, 1.4, 1.1, 8.5, rack); box(x, 1.12, z, 1.3, 0.06, 8.3, soil); box(x, 3.0, z, 0.35, 0.08, 8.3, grow); api.col(x, z, 0.75, 4.3); }
    const pg = new THREE.ConeGeometry(0.22, 0.75, 5), pm = new THREE.MeshLambertMaterial({ color: 0x5ad04a, emissive: 0x1a4010 });
    const per = 14, im = new THREE.InstancedMesh(pg, pm, rows.length * per); api.disposables.push(pg, pm);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(); let i = 0;
    for (const [x, z] of rows) for (let k = 0; k < per; k++) { const s = 0.8 + ((k * 37) % 7) / 14; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), k * 1.3); m4.compose(pos.set(x + ((k % 2) - 0.5) * 0.5, 1.5 * s * 0.75 + 0.85, z - 4 + k * 0.6), q, sc.set(s, s, s)); im.setMatrixAt(i++, m4); }
    api.g.add(im);
    // Nettle's trade table: scale, baggies, cash box; a sheet of tarp on the back wall; crates of shine by the door
    box(0, 0.45, -2.2, 3.4, 0.9, 1.0, wood); box(0, 0.93, -2.2, 3.5, 0.05, 1.1, mat(0x6a5a40)); api.col(0, -2.2, 1.8, 0.6);
    box(-0.9, 1.02, -2.2, 0.5, 0.1, 0.4, mat(0xc8c8c8, { metalness: 0.7, roughness: 0.3 })); box(0.4, 1.0, -2.3, 0.6, 0.06, 0.4, lime); box(1.2, 1.05, -2.1, 0.45, 0.2, 0.3, mat(0x2a2a2a));
    box(0, 2.2, -d / 2 + 0.2, 7, 3.2, 0.05, tarp);
    for (const [x, z] of [[-5.2, 4.2], [-4.4, 4.6], [5.0, 4.4]]) { box(x, 0.35, z, 0.8, 0.7, 0.8, wood); api.col(x, z, 0.45, 0.45); }
    live.fan = box(0, d > 0 ? 4.85 : 4.85, 1.5, 2.2, 0.04, 0.3, mat(0x50544a)); // ceiling fan blade
    api.ticks.push((t, dt) => { if (live.fan) live.fan.rotation.y += dt * 4; });
    live.nettle = api.person({ top: 0x3a4a2a, bottom: 0x22201a, hair: 0x6a7a5a, hairStyle: 'long', skin: 0xa07050, accent: 0x7dff6a, glow: 0x7dff6a }, 0, -3.1, 0, anim, 0.7);
    api.person({ top: 0x1a1a1a, bottom: 0x1e1e22, hairStyle: 'cap', skin: 0x6a4a32, accent: 0xff4a4a, bulk: 1.3 }, w / 2 - 2.6, -4.4, -Math.PI / 4, hulk);
    api.person({ top: 0x5a4a3a, bottom: 0x2a2a2a, hair: 0x2a1a10, hairStyle: 'short', skin: 0xd8b090 }, -w / 2 + 2.4, 2.4, Math.PI / 2, anim, 2.3);
    api.spot({ id: 'hd:nettle', x: 0, z: -1.0, r: 1.8, label: `💬 Talk to ${K.DEALER} · trade crops & shine` });
    // v7.5.30: the racks are a real feature (rent one, harvest glow-dust); one spot per wall, label follows the rack's state
    for (const sx of [-1, 1]) { const sp = api.spot({ id: 'hd:racks', x: sx * (w / 2 - 2.3), z: 0.6, r: 1.4, label: '🌱 Grow rack' }); const real = api.spots?.find(o => o.id === 'hd:racks' && o.x === sp.x && o.z === sp.z) || sp; Object.defineProperty(real, 'label', { get: () => K.rackLabel(rackSt()), configurable: true }); }
    api.spot({ id: 'hd:muscle', x: w / 2 - 3.2, z: -3.4, r: 1.2, label: '💬 Muscle' });
    // v7.5.30: timer + progress bar over the left rack (one sprite + one bar; canvas redrawn twice a second only when it changes)
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const cx = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); tag.scale.set(3.2, 0.6, 1); tag.position.set(-w / 2 + 1.1, 2.55, 0.6); api.g.add(tag);
    const barM = new THREE.MeshBasicMaterial({ color: 0x7dff6a }), bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1), barM); bar.position.set(-w / 2 + 1.1, 2.15, 0.6); api.g.add(bar);
    let last = '', acc = 1;
    api.ticks.push((t, dt) => { acc += dt; if (acc < 0.5) return; acc = 0; const ph = K.rackPhase(rackSt()); // (rackSt: build() has a local `rack` material)
      const txt = ph.phase === 'growing' ? `${K.goodIcon(ph.crop)} ${K.mmss(ph.ms)} · ${Math.round(ph.p * 100)}%` : ph.phase === 'ready' ? `${K.goodIcon(ph.crop)} READY · ${ph.n}` : `🌱 RACK FOR RENT · ${K.RACK.rent} cr`;
      bar.visible = ph.phase !== 'empty'; bar.scale.z = Math.max(0.02, ph.p * 2.6); bar.position.z = 0.6 - (2.6 - bar.scale.z) / 2; barM.color.setHex(ph.phase === 'ready' ? 0xffffff : 0x7dff6a);
      if (txt === last) return; last = txt; cx.clearRect(0, 0, 512, 96); cx.fillStyle = 'rgba(0,0,0,0.75)'; cx.fillRect(0, 0, 512, 96); cx.strokeStyle = '#fff'; cx.lineWidth = 4; cx.strokeRect(2, 2, 508, 92);
      cx.fillStyle = ph.phase === 'ready' ? '#fff' : '#9dff6a'; cx.font = 'bold 50px system-ui, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(txt, 256, 50); tex.needsUpdate = true; });
    live.api = api; live.n++;
  }
});

// ---------- UI: one black/white panel, 48px buttons via window.__onTap (built on open, removed on close) ----------
let panel = null, sel = 'glowdust', msg = '';
const CSS = `#hdPanel{position:fixed;left:50%;bottom:max(12px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:70;width:min(94vw,440px);max-height:min(78vh,620px);overflow:auto;background:#000;color:#fff;border:2px solid #fff;border-radius:6px;padding:12px 12px 6px;font:15px/1.35 system-ui,sans-serif;box-shadow:0 0 0 4px rgba(0,0,0,.6);touch-action:pan-y}
#hdPanel h3{margin:0 0 4px;font:800 13px/1.2 system-ui;letter-spacing:.12em;text-transform:uppercase}#hdPanel p{margin:0 0 8px;color:#ddd}#hdPanel .q{font-style:italic;color:#fff}#hdPanel .m{color:#fff;font-weight:700}
#hdPanel .drugs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 8px}
#hdPanel button{display:block;width:100%;min-height:48px;margin:0 0 6px;padding:8px 10px;background:#000;color:#fff;border:2px solid #fff;border-radius:4px;font:700 15px system-ui;text-align:left;touch-action:manipulation}
#hdPanel .drugs button{margin:0;text-align:center}#hdPanel button.on{background:#fff;color:#000}#hdPanel button[disabled]{opacity:.45;border-style:dashed}#hdPanel button.alt{color:#bbb;border-style:dashed}
#hdPanel .full{background:#fff;color:#000;border:2px solid #fff;font:800 15px/1.3 system-ui;padding:10px;margin:0 0 8px;text-align:center}#hdPanel button.no{opacity:.55;border-style:dashed}
#hdPanel small{display:block;color:#aaa;margin:-2px 0 8px;font-size:12px}`;
function css() { if (document.getElementById('hdCss')) return; const s = document.createElement('style'); s.id = 'hdCss'; s.textContent = CSS; document.head.appendChild(s); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function onTap(el, fn) { if (window.__onTap) window.__onTap(el, fn); else el.addEventListener('click', fn); }
const QUOTES = ['You grow it, I move it. Everybody eats.', 'Shine pays better than spuds. Spuds pay better than nothing.', 'Don\u2019t look at the guy on the rail. Don\u2019t look at anyone.', 'Ghost lichen? Now we\u2019re talking.'];
function render() {
  if (!panel) return;
  if (mode === 'rack') return renderRack();
  const G = goods(); let h = `<h3>${esc(K.DEALER)} · ${esc(K.TITLE)}</h3><p class="q">\u201c${esc(QUOTES[(stats.trades + (Date.now() / 60000 | 0)) % QUOTES.length])}\u201d</p>`;
  const C0 = cap(); if (K.pocketsFull(C0)) h += `<div class="full" data-full="1">${esc(K.fullBanner(C0))}</div>`;
  if (msg) h += `<p class="m">${esc(msg)}</p>`;
  const held = K.DRUG_IDS.filter(id => stashQty(id) > 0);
  if (held.length) {
    h += '<h3 style="margin-top:6px">💰 Sell product to Nettle</h3>';
    for (const id of held) { const D = K.DRUGS[id], n = stashQty(id), e = fence(id); h += `<p style="margin:2px 0">${D.icon} ${esc(D.name)} · you hold ${n} · ${e} cr each</p><div class="drugs"><button data-sell="${id}" data-q="1">Sell 1 · ${e} cr</button><button data-sell="${id}" data-q="all">Sell all ${n} · ${n * e} cr</button></div>`; }
    h += '<small>Street buyers pay more, with more risk. Nettle pays a fence’s price.</small>';
  }
  h += '<h3 style="margin-top:6px">🔁 Swap for product</h3>';
  h += `<p>Pick the product you want, then what you\u2019re paying with. Crops come from your homestead silo; shine from the crates in your rover.</p><div class="drugs">`;
  for (const id of K.DRUG_IDS) { const D = K.DRUGS[id]; h += `<button data-drug="${id}" class="${id === sel ? 'on' : ''}">${D.icon} ${esc(D.name)}<br><small style="margin:0;color:inherit">${drugCost(id)} cr · room ${room(id)}</small></button>`; }
  h += '</div>';
  if (!G.length) h += '<p>You\u2019ve got nothing she wants. Harvest crops at the Dustbowl Homestead, or brew shine at your still and load the crates in your rover.</p>';
  for (const g of G) {
    const q = quote(g.id, sel), each = K.goodValue(g.id);
    h += `<button data-good="${g.id}" ${q.ok ? '' : `class="no" data-no="${esc(q.msg)}"`}>${q.ok ? esc(K.tradeText(q)) : `${K.goodIcon(g.id)} ${esc(K.goodName(g.id))}: ${esc(q.msg)}`}</button><small>${g.n} ${g.from === 'silo' ? 'in your silo' : 'in your rover'} · worth ${each} cr each${K.isShine(g.id) ? ' (shine pays more)' : ''}</small>`;
  }
  if (G.length) {
    h += '<h3 style="margin-top:6px">💵 Sell crops &amp; shine for cash</h3>';
    for (const g of G) { const e = K.goodCash(g.id); h += `<p style="margin:2px 0">${K.goodIcon(g.id)} ${esc(K.goodName(g.id))} · ${g.n} ${g.from === 'silo' ? 'in your silo' : 'in your rover'} · ${e} cr each</p><div class="drugs"><button data-cash="${g.id}" data-q="1">Sell 1 · ${e} cr</button><button data-cash="${g.id}" data-q="all">Sell all ${g.n} · ${g.n * e} cr</button></div>`; }
  }
  h += '<button data-leave="1" class="alt">Leave it</button>';
  panel.innerHTML = h;
  for (const b of panel.querySelectorAll('button')) onTap(b, () => {
    if (b.dataset.no) { const full = K.pocketsFull(cap()); msg = b.dataset.no + (full ? ' Sell some product to Nettle first.' : ''); toast('🌿 ' + msg, 2600); return render(); }
    if (b.dataset.sell || b.dataset.cash) { const qq = b.dataset.q === 'all' ? 'all' : 1, r = b.dataset.sell ? sellDrug(b.dataset.sell, qq) : sellGood(b.dataset.cash, qq); msg = r.msg || 'Nettle shrugs.'; toast(msg, 2800); return render(); }
    if (b.dataset.leave) { toast('🌿 Nettle: Come back when you’ve got something.', 1600); return close(); }
    if (b.dataset.drug) { sel = b.dataset.drug; msg = ''; toast(`🌿 Swapping for ${K.DRUGS[sel].icon} ${K.DRUGS[sel].name}: ${room(sel)} room left.`, 1600); return render(); }
    if (b.dataset.good) { const r = trade(b.dataset.good, sel); msg = r.msg || ''; if (!r.ok) toast('🌿 ' + msg, 2600); if (r.ok && r.heat) msg += ' 🚨 Somebody on the rail was wearing a wire. ColSec is coming.'; render(); if (r.ok) toast(r.msg, 2600); }
  });
}
// v7.5.30: the grow-rack panel (same black/white look, every button through __onTap, every tap toasts)
let rackPh = '';
function rackBar(ph) { return `<div style="height:12px;border:2px solid #fff;margin:0 0 8px;background:#000"><div data-bar="1" style="height:100%;width:${Math.round(ph.p * 100)}%;background:#fff"></div></div>`; }
function renderRackLive() { const ph = K.rackPhase(rack); if (ph.phase !== rackPh) return render(); const t = panel?.querySelector('[data-timer]'), b = panel?.querySelector('[data-bar]'); if (t && ph.phase === 'growing') t.textContent = `${K.mmss(ph.ms)} left · ${Math.round(ph.p * 100)}%`; if (b) b.style.width = Math.round(ph.p * 100) + '%'; }
function renderRack() {
  const ph = K.rackPhase(rack); rackPh = ph.phase;
  let h = `<h3>🌱 Grow racks · ${esc(K.TITLE)}</h3>`;
  if (msg) h += `<p class="m">${esc(msg)}</p>`;
  if (ph.phase === 'empty') {
    h += `<p>Rent a rack under Nettle\u2019s lights: ${K.RACK.rent} cr rent + her seeds, ripe in real minutes (keeps growing while you\u2019re out). Harvest into your silo or sell it straight to her. ColSec sometimes raids a harvest.</p>`;
    for (const id of K.CROP_IDS) { const c = K.plantCost(id), dis = credits() < c; h += `<button data-plant="${id}" ${dis ? 'data-short="1"' : ''}>${K.goodIcon(id)} Plant ${esc(K.goodName(id))} · ${c} cr</button><small>${K.RACK.rent} rent + ${K.seedPrice(id)} seeds · ${K.mmss(K.growMs(id))} · ${K.rackYield(id)} crops (worth ${K.goodValue(id)} cr each)${dis ? ' · you\u2019re short' : ''}</small>`; }
  } else if (ph.phase === 'growing') {
    h += `<p>${K.goodIcon(ph.crop)} ${ph.n} ${esc(K.goodName(ph.crop))} growing: <b data-timer="1">${K.mmss(ph.ms)} left · ${Math.round(ph.p * 100)}%</b></p>` + rackBar(ph);
    h += `<button data-check="1">⏱ Check the rack</button>`;
  } else {
    const si = siloInfo();
    h += `<p>${K.goodIcon(ph.crop)} <b>${ph.n} ${esc(K.goodName(ph.crop))} ripe.</b> Raid risk on harvest: ~${Math.round(K.raidChance(world()?.wanted || 0) * 100)}%.</p>` + rackBar(ph);
    h += `<button data-take="silo">🏚 Harvest into your silo</button><small>${si.owned ? `${si.room} silo space free` : 'needs the Dustbowl Homestead'}</small>`;
    h += `<p style="margin:4px 0">Or sell straight to Nettle for:</p><div class="drugs">`;
    for (const id of K.DRUG_IDS) { const D = K.DRUGS[id], q = K.quote(ph.crop, ph.n, id, room(id), drugCost(id)); h += `<button data-take="${id}">${D.icon} ${esc(D.name)}<br><small style="margin:0;color:inherit">${q.ok ? `${q.units} + ${q.change} cr` : 'no room'}</small></button>`; }
    h += '</div>';
  }
  h += '<button data-leave="1" class="alt">Done</button>';
  panel.innerHTML = h;
  for (const b of panel.querySelectorAll('button')) onTap(b, () => {
    if (b.dataset.leave) { toast('🌱 Racks hum along.', 1400); return close(); }
    if (b.dataset.plant) { const r = rackPlant(b.dataset.plant); msg = r.msg || ''; return render(); }
    if (b.dataset.check) { const p2 = K.rackPhase(rack); msg = p2.phase === 'growing' ? `Still growing. ${K.mmss(p2.ms)} left.` : 'Ripe!'; toast('🌱 ' + msg, 2000); return render(); }
    if (b.dataset.take) { const r = rackTake(b.dataset.take); msg = r.msg || ''; return render(); }
  });
}
let mode = 'trade', rackTimer = 0;
function open(m = 'trade') { if (!inside() && !openAnywhere) return false; css(); close(); mode = m === 'rack' ? 'rack' : 'trade'; panel = document.createElement('div'); if (mode === 'rack') rackTimer = setInterval(() => { if (panel && mode === 'rack') renderRackLive(); }, 500); panel.id = 'hdPanel'; panel.setAttribute('role', 'dialog'); document.body.appendChild(panel); msg = ''; render(); if (document.pointerLockElement) document.exitPointerLock?.(); emit('open'); return true; }
function close() { clearInterval(rackTimer); rackTimer = 0; if (panel) { panel.remove(); panel = null; emit('close'); } }
let openAnywhere = false;

// ---------- hotspots (the existing context button / E) ----------
const LINES = { muscle: ['Muscle: Trade or walk. Don\u2019t browse.', 'Muscle: Nettle says you\u2019re cool. I say we\u2019ll see.', 'Muscle: You bleed on the floor, you mop the floor.', 'Muscle: Racks on the walls are for rent. Tap one. Rent up front.', 'Muscle: Shine buys more than spuds. Talk to Nettle.'] };
const pick = a => a[(Math.random() * a.length) | 0];
function act(id) {
  if (!inside()) return false; const sid = id || surf()?.info?.spot?.id;
  if (sid === 'hd:nettle') return open('trade');
  if (sid === 'hd:racks') { const ok = open('rack'); const ph = K.rackPhase(rack); toast(ph.phase === 'growing' ? `🌱 Your ${K.goodName(ph.crop)}: ${K.mmss(ph.ms)} left.` : ph.phase === 'ready' ? `🌱 Your ${K.goodName(ph.crop)} is ripe. Harvest it.` : `🌱 Rent a rack: ${K.RACK.rent} cr + seeds. Ready in minutes.`, 2200); return ok; }
  if (sid === 'hd:muscle') { toast(pick(LINES.muscle), 2600); return true; }
  return false;
}
let lastAct = 0;
function tryAct() { if (panel) return; const t = performance.now(); if (t - lastAct < 350) return; if (act()) lastAct = t; }

// ---------- outside: door name, airlock sign, minimap ----------
let marker = null, markScene = null, marked = '';
function door() { try { const d = world()?.doorFor?.(K.KIND); return d && d.kind === K.KIND ? d : null; } catch (e) { return null; } }
function surfaceTick(dt, tc) {
  if (!inside() && panel) close();
  if (tc?.name !== 'Mars') { if (marker) { marker.parent?.remove(marker); markScene = null; } if (marked) { marked = ''; try { SSX().minimap?.clear?.('hydroden'); } catch (e) { /* */ } } return; }
  const d = door(); if (!d) return;
  if (d.name !== K.NAME) d.name = K.NAME; // the enter button says "Enter Hydro Den", not "Enter Ares Junction"
  if (!marker) { const t = textTex('🌿 HYDRO DEN · CROPS & SHINE', '#9dff6a', { w: 640, h: 112, font: 'bold 60px system-ui, sans-serif' }); marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); marker.name = 'hydroden-sign'; marker.scale.set(6.4, 1.12, 1); }
  if (markScene !== tc.scene) { tc.scene.add(marker); markScene = tc.scene; }
  const y = tc.height ? tc.height(d.x, d.z) : 0; marker.position.set(d.x, y + 5.0, d.z - 0.6);
  const key = Math.round(d.x) + ',' + Math.round(d.z);
  if (marked !== key) { marked = key; try { SSX().minimap?.addMarks?.('hydroden', [{ x: d.x, z: d.z, color: '#7dff6a', r: 2.2, ring: true, icon: '🌿' }]); } catch (e) { /* radar optional */ } }
}

// ---------- public API ----------
const API = {
  version: 1, get tagged() { return tagged; }, get inside() { return inside(); }, get isOpen() { return !!panel; },
  door: () => { const d = door(); return d ? { x: d.x, z: d.z, name: d.name, kind: d.kind } : null; },
  goods, room, quote, trade, sellDrug, sellGood, fence, open, close, act, rates: K.rateTable, stats: () => ({ ...stats }),
  on(fn) { subs.add(fn); return () => subs.delete(fn); },
  rack: () => ({ state: rack ? { ...rack } : null, ...K.rackPhase(rack), label: K.rackLabel(rack) }), rackPlant, rackTake,
  debug: { rackReady() { if (rack) { rack.readyAt = Date.now() - 1; rackSave(); } return !!rack; }, rackClear() { rack = null; rackSave(); }, rng(f) { rng = typeof f === 'function' ? f : Math.random; }, anywhere(v = true) { openAnywhere = !!v; }, room: () => ({ built: live.n }) }
};
window.SSX = window.SSX || {}; window.SSX.hydroden = API; // index.html's SSX object spreads this in
let booted = false;
(function boot() {
  if (!window.SSX?.registerSurfaceTick || !window.__app?.surface) { setTimeout(boot, 250); return; }
  if (booted) return; booted = true; if (window.SSX.hydroden !== API) window.SSX.hydroden = API;
  const btn = document.getElementById('driveBtn'); if (btn) onTap(btn, () => tryAct());
  addEventListener('keydown', e => { const tg = e.target; if (tg && /INPUT|TEXTAREA|SELECT/.test(tg.tagName)) return; if (e.code === 'Escape' && panel) { close(); return; } if (e.code === 'KeyE' && !e.repeat) tryAct(); });
  try { (window.SSX.registerSurfaceTick || (f => window.__app.surface.registerTick?.(f)))(surfaceTick); } catch (e) { console.warn('hydroden tick', e); }
})();
export default API;
