// Umbra Hold (v7.5.119): a penal colony in Nadir Crater, southwest of Freeport on the Moon.
// Bribe the sentry or turn yourself in. Do a favor for each inmate. Parole them or cut the fence,
// then the Umbra shuttle (the same take-off and landing the ship already uses) flies them to Mars.
// On Mars they stand with your crew and change real numbers: ride speed, wanted-star cooldown,
// punch damage, and street-good prices. Climb the yard until you sit in the warden's chair.
// Fiction only. Glint-salt is a made-up crater mineral, not a real drug. No borrowed names.
// window.SSX.prison. Save key ssx.umbra.v1 (savecode.js).
import * as THREE from 'three';
import * as C from 'ssx/moon/prisoncore';
import { addMenuItem, tap, panelTap } from 'ssx/racehooks';

const app = () => window.__app;
const SSX = () => window.SSX || {};
const game = () => app()?.game;
const surf = () => app()?.surface;
const world = () => surf()?.world;
const info = () => surf()?.info;
const toast = (m, ms = 3200) => { try { app()?.toast?.(m, ms); } catch (e) { /* */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let S = C.fresh();
try { S = C.load(localStorage.getItem(C.KEY)); } catch (e) { S = C.fresh(); }
const save = () => { try { localStorage.setItem(C.KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };

const inmate = id => C.INMATES.find(i => i.id === id);
const credits = () => game()?.progress?.credits | 0;

const CSS = `
#umbraAct{position:fixed;z-index:16;right:calc(6px + env(safe-area-inset-right));bottom:calc(196px + env(safe-area-inset-bottom));display:none;min-width:48px;max-width:92px;min-height:48px;padding:6px 8px;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:800 12px/1.15 system-ui,sans-serif;touch-action:manipulation}
#umbraAct.on{display:block}
@media (orientation:landscape){#umbraAct{bottom:calc(112px + env(safe-area-inset-bottom));max-width:140px}}
#umbraSheet{position:fixed;inset:0;z-index:62;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.45)}
#umbraSheet.on{display:flex}
#umbraSheet .wrap{position:relative;width:min(96vw,440px);max-height:min(72vh,640px);overflow:auto;-webkit-overflow-scrolling:touch;margin:0 8px calc(10px + env(safe-area-inset-bottom));background:#000;color:#fff;border:2px solid #fff;border-radius:16px;padding:14px 14px 12px;box-sizing:border-box;font:15px/1.35 system-ui,sans-serif}
#umbraSheet h2{margin:0 48px 8px 0;font-size:18px}
#umbraSheet p{margin:0 0 8px}
#umbraSheet .step{margin:0 0 10px;padding:8px 10px;border:1px solid #fff;border-radius:10px}
#umbraSheet button{display:block;width:100%;min-height:48px;margin:8px 0 0;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:800 15px/1.2 system-ui,sans-serif;touch-action:manipulation}
#umbraSheet button:disabled{opacity:.45}
#umbraSheet .x{position:absolute;top:8px;right:8px;width:44px;height:44px;border-radius:10px;border:2px solid #fff;background:#000;color:#fff;font:700 20px/40px system-ui,sans-serif}
#umbraLift{position:fixed;z-index:74;left:calc(8px + env(safe-area-inset-left));right:calc(8px + env(safe-area-inset-right));top:calc(8px + env(safe-area-inset-top));display:none;padding:10px 12px;border-radius:12px;border:2px solid #fff;background:#000;color:#fff;font:800 16px/1.3 system-ui,sans-serif;text-align:center}
#umbraLift.on{display:block}
#umbraLift small{display:block;font-weight:600;font-size:14px;margin-top:4px}
`;

let actBtn = null, sheet = null, liftEl = null, sheetMode = null;
function ensureDom() {
  if (actBtn || typeof document === 'undefined') return;
  const st = document.createElement('style'); st.id = 'umbraCss'; st.textContent = CSS; document.head.appendChild(st);
  actBtn = document.createElement('button'); actBtn.id = 'umbraAct'; actBtn.type = 'button';
  document.body.appendChild(actBtn);
  sheet = document.createElement('div'); sheet.id = 'umbraSheet';
  sheet.innerHTML = '<div class="wrap" role="dialog" aria-label="Umbra Hold"><button type="button" class="x" data-a="close" aria-label="Close">✕</button><div id="umbraBody"></div></div>';
  document.body.appendChild(sheet);
  panelTap(sheet, e => { const b = e.target?.closest?.('button'); if (b && !b.disabled) onSheet(b.dataset.a, b.dataset.id, b.dataset.how); });
  liftEl = document.createElement('div'); liftEl.id = 'umbraLift'; liftEl.setAttribute('role', 'status');
  document.body.appendChild(liftEl);
}
function setLift(on, title, sub) {
  ensureDom();
  liftEl.classList.toggle('on', !!on);
  liftEl.innerHTML = on ? `${esc(title || '')}${sub ? `<small>${esc(sub)}</small>` : ''}` : '';
}
function closeSheet() { sheet?.classList.remove('on'); sheetMode = null; return true; }
function body() { return sheet?.querySelector('#umbraBody'); }

function rankLine() {
  const o = C.objective(S);
  return `<p>${esc(C.rankName(S))} at ${esc(C.NAME)}, ${esc(C.CRATER)}.</p><div class="step">${esc(o.text)}</div>`;
}

function paintMenu() {
  const o = C.objective(S);
  const rows = C.INMATES.map(i => {
    const st = S.crew.includes(i.id) ? 'On Mars' : S.favors[i.id] ? 'Ready to leave' : 'In the yard';
    return `<p><b>${esc(i.name)}</b> · ${esc(i.role)} · ${st}</p>`;
  }).join('');
  const till = S.office ? `<p>Till earned ${S.earned} cr. It pays ${C.INCOME} cr every few minutes.</p>` : '';
  body().innerHTML = `<h2>🔒 ${esc(C.NAME)}</h2>${rankLine()}${till}${rows}
    <button type="button" data-a="show">Show me the way</button>
    ${S.office ? '<button type="button" data-a="till">Collect the till</button>' : ''}
    <button type="button" data-a="fly" data-id="Moon">Fly to the Moon</button>
    <button type="button" data-a="fly" data-id="Mars">Fly to Mars</button>
    <button type="button" data-a="close">Close</button>`;
}
function paintGate() {
  body().innerHTML = `<h2>🔒 ${esc(C.NAME)}</h2>
    <p>A penal colony in ${esc(C.CRATER)}, southwest of Freeport. Bribe the sentry, or turn yourself in. Either way you walk in as a visitor.</p>
    ${S.entry ? '<p>You already have a visitor log.</p><button type="button" data-a="goin">Go into the yard</button>' : ''}
    <button type="button" data-a="bribe" ${S.entry ? 'disabled' : ''}>Bribe the sentry · ${C.BRIBE} cr</button>
    <button type="button" data-a="arrest" ${S.entry ? 'disabled' : ''}>Turn yourself in</button>
    <button type="button" data-a="show">Show me the way</button>
    <button type="button" data-a="close">Close</button>`;
}
function paintTrustee() {
  body().innerHTML = `<h2>Trustee Neeve</h2>
    <p>Neeve runs the visitor log. Juno Keel drives. Sato Lin cuts cameras. Moss Kade fights. Nim Ore moves crates. Bram Holt's Kiln Ring owns the ring until somebody drops him.</p>
    <div class="step">${esc(C.objective(S).text)}</div>
    <button type="button" data-a="meet" data-id="trustee">Got it</button>
    <button type="button" data-a="close">Close</button>`;
}
function paintInmate(id) {
  const i = inmate(id); if (!i) return paintMenu();
  const done = !!S.favors[id], gone = S.crew.includes(id);
  let extra = '';
  if (!S.entry) extra = '<p>The sentry has not logged you yet.</p><button type="button" data-a="gate">Go to the gate</button>';
  else if (gone) extra = `<p>${esc(i.short)} is crew on Mars. ${esc(i.perk)}</p>`;
  else if (done) extra = `<p>${esc(i.short)} will leave with you. Parole costs ${C.PAROLE} cr. Cutting the fence is free and loud.</p>
    <button type="button" data-a="move" data-id="${id}" data-how="parole">Parole ${esc(i.short)} · ${C.PAROLE} cr</button>
    <button type="button" data-a="move" data-id="${id}" data-how="break">Break ${esc(i.short)} out</button>`;
  else extra = `<p>${esc(i.line)}</p><div class="step">${esc(C.questDefs().find(q => q.id === C.favorQuestId(id)).steps[0].text)}</div>
    <button type="button" data-a="favor" data-id="${id}">Do this favor</button>`;
  body().innerHTML = `<h2>${esc(i.name)}</h2><p>${esc(i.role)}. ${esc(i.blurb)} ${esc(i.perk)}</p>${extra}
    <button type="button" data-a="close">Close</button>`;
}
function paintGuard() {
  body().innerHTML = `<h2>Yard guard</h2>
    <p>He looks the other way for ${C.GUARD_BRIBE} cr. Do it once and the yard starts to trust your hands.</p>
    <div class="step">${esc(C.objective(S).text)}</div>
    <button type="button" data-a="guardpay">Bribe the guard · ${C.GUARD_BRIBE} cr</button>
    <button type="button" data-a="close">Close</button>`;
}
function paintFence() {
  body().innerHTML = `<h2>Fence slot</h2>
    <p>Move a pinch of glint-salt. It is a glittery crater mineral the yard trades. It is made up. It is not a real drug.</p>
    <div class="step">Hand it through the slot. You get ${C.TRADE_PAY} cr.</div>
    <button type="button" data-a="trade">Move a pinch · +${C.TRADE_PAY} cr</button>
    <button type="button" data-a="close">Close</button>`;
}
function paintOffice() {
  body().innerHTML = `<h2>Warden Quell</h2>
    <p>${S.office ? 'The chair is yours. The till pays on its own.' : `Quell will sell you the chair for ${C.OFFICE} cr once Bram Holt is down.`}</p>
    <div class="step">${esc(C.objective(S).text)}</div>
    ${S.office ? `<button type="button" data-a="till">Collect the till</button>` : `<button type="button" data-a="office">Take the chair · ${C.OFFICE} cr</button>`}
    <button type="button" data-a="close">Close</button>`;
}
function paintRing() {
  body().innerHTML = `<h2>Yard ring</h2>
    <p>Bram Holt runs the Kiln Ring from here. Drop him and the yard answers to you.</p>
    <div class="step">Walk into the ring and drop Bram Holt.</div>
    <button type="button" data-a="bram" ${S.bram ? 'disabled' : ''}>${S.bram ? 'Bram is down' : 'Fight Bram Holt'}</button>
    <button type="button" data-a="close">Close</button>`;
}
function paintEarth() {
  body().innerHTML = `<h2>Quell Transfer</h2>
    <p>Ada Brin stamps visitor slips for ${esc(C.NAME)}. The hold is in ${esc(C.CRATER)} on the Moon, southwest of Freeport.</p>
    ${S.office ? '<p>You run the hold. The Earth till is the same one.</p><button type="button" data-a="till">Collect the till</button>' : '<p>Bribe the sentry on the Moon, or turn yourself in. Then talk to the inmates.</p>'}
    <button type="button" data-a="fly" data-id="Moon">Fly to the Moon</button>
    <button type="button" data-a="close">Close</button>`;
}
function paintCrew(id) {
  const i = inmate(id) || C.INMATES[0];
  const p = C.perks(S);
  body().innerHTML = `<h2>${esc(i.name)} · Mars crew</h2>
    <p>${esc(i.perk)}</p>
    <p>Rides ×${p.drive}. Stars cool ×${p.heat}. Punches ×${p.melee}. Street prices ×${p.sell}.</p>
    <button type="button" data-a="close">Close</button>`;
}

const PAINT = { menu: paintMenu, gate: paintGate, trustee: paintTrustee, guard: paintGuard, fence: paintFence, office: paintOffice, ring: paintRing, earth: paintEarth };
function openSheet(mode, id) {
  ensureDom();
  sheetMode = mode;
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ }
  if (mode === 'inmate') paintInmate(id);
  else if (mode === 'crew') paintCrew(id);
  else (PAINT[mode] || paintMenu)();
  sheet.classList.add('on');
  return true;
}

function spend(n) {
  const g = game();
  if (!g?.spend) return false;
  return !!g.spend(n);
}
function pay(n) { try { game()?.reward?.(0, n); } catch (e) { /* */ } }
function busyQuest() {
  const q = game()?.info?.quest;
  if (!q) return null;
  if (String(q.id).startsWith('umbra-')) return 'umbra';
  return 'other';
}
function acceptQuest(id) {
  const b = busyQuest();
  if (b === 'other') { toast('Finish your current job first. The arrow is on that step.'); return false; }
  const g = game();
  if (!g?.accept) { toast('Land on the Moon first.'); return false; }
  if (info()?.name !== 'Moon') { toast('That job is on the Moon. Fly there, then try again.'); return false; }
  if (!g.accept(id)) { toast('Could not start that step. You need to be on the Moon.'); return false; }
  aim();
  return true;
}

function doEnter(kind) {
  if (S.entry) { goInside(); return; }
  if (kind === 'bribe') {
    if (credits() < C.BRIBE || !spend(C.BRIBE)) { toast(`You need ${C.BRIBE} cr to bribe the sentry.`); return; }
  } else {
    try { world()?.setWanted?.(0); } catch (e) { /* */ }
  }
  const r = C.enter(S, kind);
  if (!r.ok) { toast(r.why); return; }
  save();
  closeSheet();
  goInside();
  toast(kind === 'bribe' ? 'The sentry pockets the cash and waves you in as a visitor.' : 'They wipe your stars and walk you in as a visitor.');
  aim();
}
function goInside() {
  const p = spotWorld('inside');
  if (p) { try { surf()?.debugMove?.(p.x, p.z, 0); } catch (e) { /* */ } }
}
function doMeet(id) {
  const r = C.meet(S, id || 'trustee');
  if (!r.ok) { toast(r.why); return; }
  save(); aim();
  toast('Neeve nods. Pick an inmate and do their favor. Follow the arrow.');
  closeSheet();
}
function doFavor(id) {
  if (!S.entry) { toast('Get inside first. Bribe the sentry, or turn yourself in.'); openSheet('gate'); return; }
  C.meet(S, id); save();
  if (acceptQuest(C.favorQuestId(id))) { closeSheet(); toast('Follow the arrow. The card has the step.'); }
}
function doMove(id, how) {
  const preview = C.canMove(S, id);
  if (!preview.ok) { toast(preview.why); return; }
  if (how === 'parole' && (credits() < C.PAROLE || !spend(C.PAROLE))) { toast(`Parole costs ${C.PAROLE} cr.`); return; }
  const r = C.board(S, id, how);
  if (!r.ok) { if (how === 'parole') pay(C.PAROLE); toast(r.why); return; }
  save();
  if (!acceptQuest(r.quest)) {
    if (how === 'parole') pay(C.PAROLE);
    S.pending = null; save();
    return;
  }
  closeSheet();
  toast(how === 'parole' ? 'Papers stamped. Walk them to the shuttle pad.' : 'Cut the power, then run for the pad.');
}
function doGuard() {
  if (credits() < C.GUARD_BRIBE || !spend(C.GUARD_BRIBE)) { toast(`The guard wants ${C.GUARD_BRIBE} cr.`); return; }
  const r = C.bribeGuard(S);
  if (!r.ok) { pay(C.GUARD_BRIBE); toast(r.why); return; }
  save(); aim();
  toast(r.rank >= 4 ? 'The guard looks away. The yard calls you a block hand now.' : 'The guard looks away. You are one step up.');
  closeSheet();
}
function doTrade() {
  const r = C.tradeSalt(S);
  if (!r.ok) { toast(r.why); return; }
  pay(C.TRADE_PAY); save(); aim();
  toast(`Glint-salt moved. +${C.TRADE_PAY} cr.${r.rank >= 4 ? ' The yard calls you a block hand now.' : ''}`);
  closeSheet();
}
function doBram() {
  if (S.bram) { toast('Bram Holt is already down.'); return; }
  if ((S.rank | 0) < 4) { toast(C.beatBram(S).why || 'Not yet.'); return; }
  if (acceptQuest('umbra-bram')) { closeSheet(); toast('Follow the arrow into the ring.'); }
}
function doOffice() {
  if (S.office) { doTill(); return; }
  if (credits() < C.OFFICE || !spend(C.OFFICE)) { toast(`The chair costs ${C.OFFICE} cr.`); return; }
  const r = C.takeOffice(S, Date.now());
  if (!r.ok) { pay(C.OFFICE); toast(r.why); return; }
  if (r.stipend) pay(r.stipend);
  save(); aim();
  toast(`You run Umbra Hold. First till: +${r.stipend || 0} cr. It keeps paying.`);
  closeSheet();
}
function doTill() {
  const r = C.collectIncome(S, Date.now());
  if (!r.ok) {
    const min = Math.ceil((r.wait || 0) / 60000);
    toast(S.office ? `The till is light. Next pay in about ${min} min.` : 'You do not run the hold yet.');
    return;
  }
  pay(r.pay); save();
  toast(`Umbra Hold till: +${r.pay} cr.`);
}
let hopping = false;
async function flyTo(worldName) {
  if (hopping) return;
  hopping = true;
  closeSheet();
  setLift(true, 'Umbra shuttle', `Lifting for ${worldName}.`);
  try {
    await hop(worldName);
    if (worldName === 'Moon') { aim(); toast('You are on the Moon. Follow the arrow to Umbra Hold.'); }
    else if (worldName === 'Mars') {
      const p = spotWorld('crew');
      if (p) { try { surf()?.debugMove?.(p.x, p.z + 8, 0); } catch (e) { /* */ } }
      toast(S.crew.length ? 'Your Umbra crew is here on Mars.' : 'Ares Junction. Your crew shows up here after a shuttle run.');
    }
  } catch (e) {
    toast('The shuttle aborted. Try again in a moment.');
  } finally {
    hopping = false;
    setLift(false);
  }
}
async function launch(id) {
  const i = inmate(id); if (!i || hopping) return;
  hopping = true;
  try { SSX().hudx?.setWaypoint?.(null, true); } catch (e) { /* */ }
  setLift(true, `${i.short} is aboard`, 'Umbra shuttle lifting for Mars.');
  const craft = shuttleRef;
  const y0 = craft ? craft.position.y : 0;
  const t0 = performance.now();
  await new Promise(res => {
    const step = now => {
      const u = Math.min(1, (now - t0) / 1600);
      if (craft) craft.position.y = y0 + u * u * 36;
      if (u < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
  try {
    await hop('Mars');
    C.arrived(S, id); save();
    const p = spotWorld('crew');
    if (p) { try { surf()?.debugMove?.(p.x + 2, p.z + 8, 0); } catch (e) { /* */ } }
    aimCrew();
    toast(`${i.name} is crew on Mars. ${i.perk}`);
  } catch (e) {
    toast('The shuttle aborted. Talk to them at the pad and try again.');
  } finally {
    hopping = false;
    setLift(false);
  }
}

function waitFor(fn, ms) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const step = () => {
      let ok = false; try { ok = !!fn(); } catch (e) { ok = false; }
      if (ok) return resolve();
      if (performance.now() - t0 > ms) return reject(new Error('timeout'));
      requestAnimationFrame(step);
    };
    step();
  });
}
async function hop(worldName) {
  const a = app();
  if (!a?.takeOff || !a?.landOn) throw new Error('no travel');
  try {
    const mesh = a.bodies?.find(b => b.name === worldName)?.mesh;
    if (!mesh) throw new Error('no body');
    if (a.joy) { a.joy.x = 0; a.joy.y = 0; }
    if (a.state?.onSurface) {
      a.takeOff();
      await waitFor(() => a.state && !a.state.onSurface && !a.state.transitioning, 20000);
    }
    if (a.joy) { a.joy.x = 0; a.joy.y = 0; }
    const pos = new THREE.Vector3();
    mesh.getWorldPosition(pos);
    const rad = mesh.userData?.r || 3;
    if (a.rocket) {
      const out = pos.clone();
      if (out.lengthSq() < 1) out.set(1, 0.3, 0);
      out.normalize();
      a.rocket.position.copy(pos).addScaledVector(out, rad * 2.2 + 7);
    }
    a.landOn(mesh);
    await waitFor(() => a.state?.onSurface && !a.state.transitioning && info()?.name === worldName && info()?.intro === 0, 50000);
  } catch (e) { throw e; }
}

function colony() {
  const c = info()?.colony;
  return c && Number.isFinite(c.x) ? c : null;
}
let earthSpot = null, marsAnchor = null;
function crewPoint() {
  const c = colony();
  if (!c || info()?.name !== 'Mars') return null;
  return { x: c.x + 28, z: c.z + 40 };
}
function spotWorld(id) {
  const name = info()?.name;
  if (id === 'earth') return name === 'Earth' ? earthSpot : null;
  if (id === 'crew') return crewPoint();
  if (name !== 'Moon') return null;
  const local = C.SPOTS[id];
  const c = colony(); if (!local || !c) return null;
  return { x: c.x + local[0], z: c.z + local[1] };
}
function aimAt(p, label) {
  if (!p) return;
  try { SSX().hudx?.setWaypoint?.({ x: p.x, z: p.z, label }, true); } catch (e) { /* */ }
}
function aim() {
  const o = C.objective(S);
  if (info()?.name !== o.world) return;
  const q = game()?.info?.quest;
  if (q && String(q.id).startsWith('umbra-')) return;
  aimAt(spotWorld(o.at), o.text);
}
function aimCrew() {
  aimAt(spotWorld('crew'), 'Your Umbra crew');
}
function showWay() {
  const here = info()?.name;
  const o = C.objective(S);
  if (here === 'Moon') { aimAt(spotWorld(o.at === 'crew' ? 'gate' : o.at), o.text); toast('Follow the arrow.'); closeSheet(); return; }
  if (here === 'Earth') { aimAt(earthSpot, 'Quell Transfer'); toast('Quell Transfer is marked. Or fly to the Moon.'); closeSheet(); return; }
  if (here === 'Mars' && S.crew.length) { aimCrew(); toast('Follow the arrow to your crew.'); closeSheet(); return; }
  toast(o.text);
  closeSheet();
}

function onSheet(a, id, how) {
  if (a === 'close') return closeSheet();
  if (a === 'show') return showWay();
  if (a === 'bribe') return doEnter('bribe');
  if (a === 'arrest') return doEnter('arrest');
  if (a === 'goin') { goInside(); closeSheet(); return; }
  if (a === 'gate') return openSheet('gate');
  if (a === 'meet') return doMeet(id || 'trustee');
  if (a === 'favor') return doFavor(id);
  if (a === 'move') return doMove(id, how);
  if (a === 'guardpay') return doGuard();
  if (a === 'trade') return doTrade();
  if (a === 'bram') return doBram();
  if (a === 'office') return doOffice();
  if (a === 'till') return doTill();
  if (a === 'fly') return flyTo(id || 'Moon');
}

let questsOn = false;
function registerQuests() {
  const g = game();
  if (questsOn || typeof g?.registerMission !== 'function') return false;
  for (const q of C.questDefs()) g.registerMission(q);
  questsOn = true;
  return true;
}
function onQuest(ev) {
  if (!ev) return;
  const id = String(ev.id || '');
  if (ev.kind === 'step' && S.pending && id.startsWith('umbra-out-') && /power at the yard generator/.test(ev.text || '')) {
    try { world()?.setWanted?.(2, 'cut the Umbra fence'); } catch (e) { /* */ }
    toast('The fence alarm trips. Two stars. Run for the pad.');
  }
  if (ev.kind !== 'done') return;
  if (id.startsWith('umbra-favor-')) {
    const who = id.slice('umbra-favor-'.length);
    const r = C.finishFavor(S, who);
    if (r.ok) { save(); aim(); toast(`${inmate(who)?.short || 'They'} owe you. Talk to them when you want them out.`); }
    return;
  }
  if (id === 'umbra-bram') {
    const r = C.beatBram(S);
    if (r.ok && !r.already) { save(); aim(); toast('Bram Holt is down. The yard is yours to take.'); }
    return;
  }
  const m = /^umbra-out-([a-z]+)-(parole|break)$/.exec(id);
  if (m && S.pending === m[1]) launch(m[1]);
}

// ---------- meshes ----------
let root = null, builtFor = '', shuttleRef = null, people = [];
const mat = (color, o) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const basic = color => new THREE.MeshBasicMaterial({ color });
function label(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,.75)'; x.fillRect(4, 10, 248, 44);
  x.fillStyle = '#fff'; x.font = 'bold 26px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 128, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(2.6, 0.65, 1); s.position.y = 2.7;
  return s;
}
function person(color, name) {
  const g = new THREE.Group();
  const m = mat(color);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.55, 2, 6), m);
  body.position.y = 1.15; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), m);
  head.position.y = 1.82; g.add(head);
  g.add(label(name));
  return g;
}
function clearMeshes() {
  if (root) { root.parent?.remove(root); root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); root = null; }
  shuttleRef = null; people = [];
}
function yAt(tc, x, z) {
  let y = 0; try { y = tc.height?.(x, z); } catch (e) { y = 0; }
  return Number.isFinite(y) ? y : 0;
}
function put(obj, tc, x, z, dy) {
  obj.position.set(x, yAt(tc, x, z) + (dy || 0), z);
  root.add(obj);
  return obj;
}
function buildMoon(tc) {
  if (root) return;
  const c = colony(); if (!c) return;
  root = new THREE.Group(); root.name = 'umbra-hold';
  const W = (lx, lz) => ({ x: c.x + lx, z: c.z + lz });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(18, 20), mat(0xa8adb4, { roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  const mid = W(-150, 74);
  put(floor, tc, mid.x, mid.z, 0.05);
  const wallM = mat(0x3a3e46);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    if (Math.sin(a) < -0.55) continue;
    const box = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.4, 0.6), wallM);
    const p = W(-150 + Math.cos(a) * 24, 74 + Math.sin(a) * 24);
    box.position.set(p.x, yAt(tc, p.x, p.z) + 1.2, p.z);
    box.lookAt(mid.x, box.position.y, mid.z);
    root.add(box);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.6), makeSign());
  const g = W(-150, 48);
  put(sign, tc, g.x, g.z, 3.2);
  sign.lookAt(g.x, sign.position.y, g.z + 10);
  const beamGeo = new THREE.CylinderGeometry(0.7, 1.4, 80, 8, 1, true); beamGeo.translate(0, 40, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  put(beam, tc, g.x, g.z, 0);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.2, 12), mat(0x2a2e34));
  const sh = W(...waitSpot('shuttle'));
  put(pad, tc, sh.x, sh.z, 0.1);
  shuttleRef = new THREE.Group();
  shuttleRef.add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 4.2), mat(0xd0d4da, { metalness: 0.4 })));
  shuttleRef.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.8), basic(0xffb040)));
  shuttleRef.children[1].position.set(0, 0.5, -1.6);
  put(shuttleRef, tc, sh.x, sh.z, 1.2);
  const lamp = (key, col) => {
    const p = W(...C.SPOTS[key]);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), basic(col));
    put(bulb, tc, p.x, p.z, 2.2);
  };
  lamp('office', 0xffe08a); lamp('ring', 0xff6040); lamp('pool', 0x9fd8ff);
  const office = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 4), mat(0x4a4038));
  const op = W(...C.SPOTS.office); put(office, tc, op.x, op.z, 1.5);
  addPerson(tc, 'trustee', 0xc8b090, 'Neeve');
  for (const i of C.INMATES) if (!S.crew.includes(i.id)) addPerson(tc, i.id, roleColor(i.id), i.short);
  addPerson(tc, 'guard', 0x8aa0c0, 'Guard');
  if (!S.bram) addPerson(tc, 'ring', 0x8a3030, 'Bram');
  if (!S.office) addPerson(tc, 'office', 0xd8d0c8, 'Quell');
  tc.scene.add(root);
}
function waitSpot(key) { return C.SPOTS[key]; }
function roleColor(id) { return { juno: 0xc45a2a, sato: 0x3a6a8a, moss: 0x6a3a3a, nim: 0x3a6a4a }[id] || 0x888888; }
function addPerson(tc, key, color, name) {
  const c = colony(); if (!c) return;
  const local = C.SPOTS[key]; if (!local) return;
  const g = person(color, name);
  put(g, tc, c.x + local[0], c.z + local[1], 0);
  people.push(g);
}
function makeSign() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#111'; x.fillRect(0, 0, 512, 128);
  x.strokeStyle = '#ffb040'; x.lineWidth = 8; x.strokeRect(8, 8, 496, 112);
  x.fillStyle = '#ffb040'; x.font = 'bold 64px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('UMBRA HOLD', 256, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: t });
}
function buildMars(tc) {
  if (root || !S.crew.length) return;
  const anchor = crewPoint(); if (!anchor) return;
  marsAnchor = anchor;
  root = new THREE.Group(); root.name = 'umbra-crew';
  S.crew.forEach((id, n) => {
    const i = inmate(id); if (!i) return;
    const g = person(roleColor(id), i.short);
    const x = anchor.x + (n - (S.crew.length - 1) / 2) * 3.2;
    const z = anchor.z;
    g.position.set(x, yAt(tc, x, z), z);
    root.add(g); people.push(g);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.9), makeSign());
  sign.position.set(anchor.x, yAt(tc, anchor.x, anchor.z) + 2.6, anchor.z - 2);
  root.add(sign);
  tc.scene.add(root);
}
function buildEarth(tc) {
  if (root) return;
  let a = 175 * Math.PI / 180, d = 38, x = 0, z = 0;
  for (let k = 0; k < 12; k++) {
    x = Math.sin(a) * d; z = -Math.cos(a) * d;
    const y = yAt(tc, x, z);
    if (y > 0.3) break;
    d += 8;
  }
  earthSpot = { x, z };
  root = new THREE.Group(); root.name = 'quell-transfer';
  const booth = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 2.2), mat(0x2c3440));
  booth.position.set(x, yAt(tc, x, z) + 1.2, z);
  root.add(booth);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), basic(0xffe08a));
  win.position.set(x, yAt(tc, x, z) + 1.6, z + 1.12);
  root.add(win);
  const who = person(0xd0b090, 'Ada');
  who.position.set(x + 1.6, yAt(tc, x + 1.6, z + 1.4), z + 1.4);
  root.add(who);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.7), makeSign());
  board.position.set(x, yAt(tc, x, z) + 2.8, z + 1.2);
  root.add(board);
  tc.scene.add(root);
}

function nearestSpot() {
  const i = info(); if (!i || hopping) return null;
  const here = { x: i.x, z: i.z };
  let best = null, bd = C.NEAR;
  const consider = (mode, id, p) => {
    if (!p) return;
    const d = Math.hypot(p.x - here.x, p.z - here.z);
    if (d < bd) { bd = d; best = { mode, id, d }; }
  };
  if (i.name === 'Moon') {
    consider('gate', 'gate', spotWorld('gate'));
    if (S.entry) {
      consider('trustee', 'trustee', spotWorld('trustee'));
      for (const inm of C.INMATES) if (!S.crew.includes(inm.id)) consider('inmate', inm.id, spotWorld(inm.id));
      consider('guard', 'guard', spotWorld('guard'));
      consider('fence', 'fence', spotWorld('fence'));
      consider('ring', 'ring', spotWorld('ring'));
      consider('office', 'office', spotWorld('office'));
    }
  } else if (i.name === 'Mars' && S.crew.length) {
    consider('crew', S.crew[0], spotWorld('crew'));
  } else if (i.name === 'Earth' && earthSpot) consider('earth', 'earth', earthSpot);
  return best;
}
function buttonLabel(n) {
  if (!n) return '';
  if (n.mode === 'gate') return S.entry ? 'Yard' : 'Gate';
  if (n.mode === 'inmate') return inmate(n.id)?.short || 'Talk';
  if (n.mode === 'trustee') return 'Neeve';
  if (n.mode === 'guard') return 'Guard';
  if (n.mode === 'fence') return 'Fence';
  if (n.mode === 'ring') return 'Ring';
  if (n.mode === 'office') return 'Chair';
  if (n.mode === 'earth') return 'Transfer';
  if (n.mode === 'crew') return 'Crew';
  return 'Umbra';
}
let heardT = 0, payT = 0, markT = 0;
function tick(dt, tc) {
  if (!tc) return;
  if (hopping && app()?.joy) { app().joy.x = 0; app().joy.y = 0; }
  const name = tc.name || '';
  if (name !== builtFor) { clearMeshes(); builtFor = name; earthSpot = null; marsAnchor = null; }
  try {
    if (name === 'Moon') buildMoon(tc);
    else if (name === 'Mars') buildMars(tc);
    else if (name === 'Earth') buildEarth(tc);
  } catch (e) { if (!tick.warned) { tick.warned = true; console.warn('umbra mesh', e); } }
  payT += dt || 0;
  if (payT > 3) {
    payT = 0;
    const due = C.incomeDue(S, Date.now());
    if (due) { const r = C.collectIncome(S, Date.now()); if (r.ok) { pay(r.pay); save(); toast(`Umbra Hold till: +${r.pay} cr.`); } }
  }
  if (name === 'Moon' && !S.heard && (heardT += dt || 0) > 2 && info()?.intro === 0) {
    S.heard = true; save();
    toast('Umbra Hold is in Nadir Crater, southwest of Freeport. Open ☰ → Umbra Hold.');
    aim();
  }
  markT += dt || 0;
  if (markT > 1.2) {
    markT = 0;
    try {
      const m = SSX().minimap;
      if (name === 'Moon') { const p = spotWorld('gate'); if (p && m?.addMarks) m.addMarks('umbra', [{ x: p.x, z: p.z, color: '#ffb040', r: 4, icon: '🔒', clamp: true }]); }
      else m?.clear?.('umbra');
    } catch (e) { /* */ }
  }
  if (!actBtn) return;
  const hide = document.body.classList.contains('cinematic') || document.body.classList.contains('hxMapOpen') || sheet?.classList.contains('on') || liftEl?.classList.contains('on');
  const n = hide ? null : nearestSpot();
  if (!n) { actBtn.classList.remove('on'); return; }
  const label = buttonLabel(n);
  actBtn.dataset.mode = n.mode;
  actBtn.dataset.id = n.id || '';
  if (actBtn.textContent !== label) actBtn.textContent = label;
  const full = n.mode === 'gate' ? 'Enter Umbra Hold. Bribe the sentry or turn yourself in.' : `Talk. ${C.objective(S).text}`;
  if (actBtn.getAttribute('aria-label') !== full) actBtn.setAttribute('aria-label', full);
  actBtn.classList.add('on');
  actBtn._open = () => openSheet(n.mode, n.id);
}

const api = {
  version: 1, key: C.KEY, name: C.NAME,
  get state() { return { ...S, favors: { ...S.favors }, crew: S.crew.slice(), rankName: C.rankName(S), objective: C.objective(S), perks: C.perks(S) }; },
  driveMul: () => C.perks(S).drive,
  heatEase: () => C.perks(S).heat,
  meleeMul: () => C.perks(S).melee,
  sellMul: () => C.perks(S).sell,
  spot: id => spotWorld(id),
  open: () => openSheet('menu'),
  close: () => closeSheet(),
  show: () => showWay(),
  debug: {
    reset() { S = C.fresh(); save(); try { game()?.abandon?.(true); } catch (e) { /* */ } return S; },
    enter: kind => { const r = C.enter(S, kind); if (r.ok) save(); return r; },
    favor: id => { const r = C.finishFavor(S, id); if (r.ok) save(); return r; },
    arrive: id => { const r = C.arrived(S, id); if (r.ok) { save(); clearMeshes(); builtFor = ''; } return r; },
    office() { const r = C.takeOffice(S, Date.now()); if (r.ok && !r.already) { if (r.stipend) pay(r.stipend); save(); } return { ...r, rank: S.rank }; },
    ageIncome(ms) { S.incomeAt = Date.now() - ms; save(); return C.incomeDue(S, Date.now()); },
    load: () => S
  }
};
// The live button opens whatever you are standing next to. Tests and the menu use open().
function bindAct() {
  if (!actBtn || actBtn._bound) return;
  actBtn._bound = true;
  tap(actBtn, () => { if (actBtn._open) actBtn._open(); else openSheet(actBtn.dataset.mode || 'menu', actBtn.dataset.id); });
}

let booted = false;
function boot() {
  if (booted) return;
  const X = SSX();
  if (!X.registerSurfaceTick || !app()?.game?.registerMission) { setTimeout(boot, 200); return; }
  booted = true;
  try { S = C.load(localStorage.getItem(C.KEY)); } catch (e) { /* keep */ }
  ensureDom(); bindAct();
  registerQuests();
  try { X.on?.('game:quest', onQuest); } catch (e) { /* */ }
  try { X.registerSurfaceTick((dt, tc) => { try { tick(dt, tc); } catch (e) { if (!boot.warned) { boot.warned = true; console.warn('umbra tick', e); } } }); } catch (e) { console.warn('umbra hook', e); }
  try { addMenuItem(app(), { id: 'umbraMenu', label: '🔒 Umbra Hold', onTap: () => openSheet('menu') }); } catch (e) { /* menu later */ }
  window.SSX.prison = api;
}
boot();
