// v7.3 track builder: a top-down editor on the live planet surface. Tap the ground to drop a gate (or a ramp, barrier
// or boost pad), drag to move, tap to select, then rotate/delete; one finger on empty ground pans, two fingers pinch-zoom
// and pan. Save/load your tracks (localStorage, via race.js saveTrack) and race them. Pointer events only, so it
// behaves the same with touch, a mouse or a pen. Desktop: WASD/arrows pan, -/= zoom, Delete removes, wheel zooms.
export function createBuilder(D) {
  const { THREE, RC } = D;
  let open = false, el = null, sheet = null, grp = null, line = null, dirty = true, draft = null, sel = null, tool = 'gate';
  let focus = { x: 0, z: 0 }, alt = 110, undo = [], saved = true;
  const ptrs = new Map(); let gest = null;
  const ray = new THREE.Raycaster(), v2 = new THREE.Vector2(), v3 = new THREE.Vector3();
  const C = () => D.ctx(), H = (x, z) => C().height(x, z);
  const LAPS = [[true, 1], [true, 2], [true, 3], [true, 5], [false, 1]];

  const css = `
body.tb-on #surfHud, body.tb-on #racePanel, body.tb-on #joy { display: none !important; }
#tbOverlay { position: fixed; inset: 0; z-index: 13; display: none; touch-action: none; -webkit-user-select: none; user-select: none; color: #fff; font-family: system-ui, sans-serif; }
#tbOverlay.on { display: block; }
#tbTop { position: absolute; top: calc(6px + var(--sat, 0px)); left: calc(8px + var(--sal, 0px)); right: calc(8px + var(--sar, 0px)); padding: 6px 10px; border-radius: 11px; background: rgba(8,10,20,0.72); border: 1px solid rgba(125,211,252,0.4); font-size: 0.74rem; line-height: 1.35; pointer-events: none; }
#tbTop b { color: #7dd3fc; } #tbTop .h { opacity: 0.75; font-size: 0.68rem; }
#tbBar { position: absolute; left: calc(6px + var(--sal, 0px)); right: calc(6px + var(--sar, 0px)); bottom: calc(8px + var(--sab, 0px)); display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
#tbBar button, #tbSheet button { min-height: 42px; border-radius: 10px; font-weight: 800; font-size: 0.76rem; color: #fff; background: rgba(14,20,40,0.82); border: 1px solid rgba(255,255,255,0.22); touch-action: none; padding: 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#tbBar button.on { background: rgba(56,225,255,0.45); border-color: #38e1ff; } #tbBar button.go { background: linear-gradient(135deg, rgba(255,42,122,0.9), rgba(255,154,60,0.9)); border: none; }
#tbBar button:disabled { opacity: 0.4; }
#tbSheet { position: absolute; left: calc(8px + var(--sal, 0px)); right: calc(8px + var(--sar, 0px)); bottom: calc(8px + var(--sab, 0px)); max-height: 62vh; overflow-y: auto; padding: 10px; border-radius: 13px; background: rgba(8,6,14,0.96); border: 1px solid rgba(125,211,252,0.4); display: none; font-size: 0.8rem; }
#tbSheet.on { display: block; } #tbSheet .it { display: flex; align-items: center; gap: 6px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.08); } #tbSheet .it div { flex: 1; min-width: 0; }
#tbSheet input { width: 100%; box-sizing: border-box; min-height: 40px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.08); color: #fff; font-size: 16px; padding: 0 10px; margin: 6px 0; }
#tbSheet .row { display: flex; gap: 6px; margin-top: 6px; } #tbSheet .row button { flex: 1; }
@media (orientation: landscape) and (max-height: 500px) { #tbBar { grid-template-columns: repeat(12, 1fr); } #tbBar button { min-height: 38px; font-size: 0.7rem; } }
`;

  function build() {
    if (el) return;
    el = document.createElement('div'); el.id = 'tbOverlay';
    el.innerHTML = `<div id="tbTop"></div><div id="tbBar">
      <button data-tool="gate">\ud83d\udea9 Gate</button><button data-tool="ramp">\u26f0 Ramp</button><button data-tool="barrier">\ud83e\uddf1 Barrier</button><button data-tool="boost">\u26a1 Boost</button>
      <button data-act="rot">\u27f3 Turn</button><button data-act="del">\ud83d\uddd1 Delete</button><button data-act="undo">\u21b6 Undo</button><button data-act="laps">\ud83d\udd01 2 laps</button>
      <button data-act="load">\ud83d\udcc2 Tracks</button><button data-act="save">\ud83d\udcbe Save</button><button data-act="race" class="go">\ud83c\udfc1 Race</button><button data-act="exit">\u2716 Exit</button></div><div id="tbSheet"></div>`;
    document.body.appendChild(el); sheet = el.querySelector('#tbSheet');
    el.querySelectorAll('#tbBar button').forEach(b => D.tapButton(b, () => b.dataset.tool ? setTool(b.dataset.tool) : act(b.dataset.act)));
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { e.preventDefault(); alt = clamp(alt * (e.deltaY > 0 ? 1.12 : 0.89), 40, 150); }, { passive: false });
    el.addEventListener('contextmenu', e => e.preventDefault());
    sheet.addEventListener('pointerdown', e => e.stopPropagation());
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const snap = () => JSON.stringify(draft);
  function pushUndo() { undo.push(snap()); if (undo.length > 40) undo.shift(); saved = false; }
  function newDraft() { return { id: 'c' + Date.now().toString(36), name: 'My track', world: D.planet(), loop: true, laps: 2, gates: [], props: [], custom: true, anchor: 'abs' }; }
  function fromDef(def, copy) {
    const t = D.resolve(def);
    return { id: copy || !def.custom ? 'c' + Date.now().toString(36) : def.id, name: copy || !def.custom ? `${def.name} remix`.slice(0, 28) : def.name, world: def.world, loop: t.loop, laps: t.laps,
      gates: t.gates.map(g => ({ x: g.x, z: g.z })), props: t.props.map(p => ({ ...p })), custom: true, anchor: 'abs' };
  }
  function openWith(def, copy) {
    build(); const c = C(); if (!c) return;
    if (def) { draft = fromDef(def, copy); undo = []; saved = !copy && !!def.custom; }
    else if (!draft || draft.world !== D.planet()) { draft = newDraft(); undo = []; saved = true; }
    const g0 = draft.gates[0], px = c.car ? c.car.x : c.player.x, pz = c.car ? c.car.z : c.player.z;
    if (g0) { const cx = draft.gates.reduce((a, g) => a + g.x, 0) / draft.gates.length, cz = draft.gates.reduce((a, g) => a + g.z, 0) / draft.gates.length; focus = { x: cx, z: cz }; recenter(true); }
    else focus = { x: px, z: pz };
    if (c.car) { c.car.speed = 0; }
    sel = null; open = true; dirty = true; el.classList.add('on'); document.body.classList.add('tb-on'); closeSheet(); setTool(tool); status();
    if (!draft.gates.length) D.toast?.('\ud83d\udee0 Tap the ground to drop your start gate.', 3000);
  }
  function close(silent = false) {
    if (!open) return; open = false; el?.classList.remove('on'); document.body.classList.remove('tb-on'); ptrs.clear(); gest = null;
    if (grp) { grp.parent?.remove(grp); grp = null; } if (line) { line.parent?.remove(line); line.geometry.dispose(); line = null; }
    D.onClose?.(); if (!silent && !saved && draft?.gates.length) D.toast?.('\ud83d\udee0 Builder closed. Your draft is kept until you leave this world (Save to keep it).', 3200);
  }
  function setTool(t) { tool = t; el.querySelectorAll('#tbBar [data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); status(); }
  function resolved() { return RC.resolveTrack({ ...draft, anchor: 'abs' }, null); }
  function status() {
    if (!el || !draft) return; const t = resolved(), n = draft.gates.length;
    const hint = !n ? 'Tap the ground to drop the START gate.' : n < RC.MIN_GATES ? `Add ${RC.MIN_GATES - n} more gate${RC.MIN_GATES - n > 1 ? 's' : ''} to race it.` :
      sel ? `${sel.kind === 'gate' ? 'Gate ' + (sel.i + 1) + ' selected: new gates go after it.' : RC.PROP_TYPES[draft.props[sel.i]?.t]?.name + ' selected.'} Drag to move${sel.kind === 'prop' ? ', \u27f3 to turn' : ''}, \ud83d\uddd1 to delete, tap it again to deselect.` : `Tap ground to add a ${RC.PROP_TYPES[tool]?.name?.toLowerCase() || 'gate'}. Drag to pan, pinch to zoom.`;
    el.querySelector('#tbTop').innerHTML = `<b>\ud83d\udee0 ${esc(draft.name)}</b>${saved ? '' : ' \u270e'} \u00b7 ${n} gate${n === 1 ? '' : 's'} \u00b7 ${draft.props.length} props \u00b7 ${Math.round(t.length)} m \u00b7 ${draft.loop ? draft.laps + ' lap' + (draft.laps > 1 ? 's' : '') : 'sprint'}<br><span class="h">${hint}</span>`;
    const lb = el.querySelector('[data-act=laps]'); lb.textContent = draft.loop ? `\ud83d\udd01 ${draft.laps} lap${draft.laps > 1 ? 's' : ''}` : '\u27a1 Sprint';
    el.querySelector('[data-act=race]').disabled = n < RC.MIN_GATES; el.querySelector('[data-act=del]').disabled = !sel; el.querySelector('[data-act=rot]').disabled = !sel || sel.kind !== 'prop'; el.querySelector('[data-act=undo]').disabled = !undo.length;
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function act(a) {
    if (a === 'exit') return close();
    if (a === 'undo') { if (undo.length) { draft = JSON.parse(undo.pop()); sel = null; dirty = true; saved = false; } return status(); }
    if (a === 'del') { if (!sel) return; pushUndo(); (sel.kind === 'gate' ? draft.gates : draft.props).splice(sel.i, 1); sel = null; dirty = true; return status(); }
    if (a === 'rot') { if (sel?.kind !== 'prop') return; pushUndo(); const p = draft.props[sel.i]; p.yaw = ((p.yaw || 0) + Math.PI / 4) % (Math.PI * 2); dirty = true; return status(); }
    if (a === 'laps') { pushUndo(); const i = LAPS.findIndex(([l, n]) => l === draft.loop && n === draft.laps); const [l, n] = LAPS[(i + 1) % LAPS.length]; draft.loop = l; draft.laps = n; dirty = true; return status(); }
    if (a === 'save') return saveSheet();
    if (a === 'load') return loadSheet();
    if (a === 'race') { if (draft.gates.length < RC.MIN_GATES) return; const t = doSave(); if (!t) return; close(true); D.raceTrack(t.id); }
  }
  function doSave(name) {
    if (name !== undefined) draft.name = (name.trim() || draft.name).slice(0, 28);
    if (draft.gates.length < 2) { D.toast?.('\ud83d\udee0 Drop at least two gates first.', 2400); return null; }
    const t = D.saveTrack({ ...draft, par: Math.round(resolved().length / 14) });
    if (!t) { D.toast?.('\ud83d\udeab Couldn\u2019t save (storage full?).', 2600); return null; }
    saved = true; status(); return t;
  }
  function saveSheet() {
    sheet.innerHTML = `<b>\ud83d\udcbe Save track</b><input id="tbName" maxlength="28" value="${esc(draft.name)}" aria-label="Track name" autocomplete="off"><div class="row"><button data-s="save">\ud83d\udcbe Save</button><button data-s="close">Cancel</button></div>`;
    wireSheet();
    const inp = sheet.querySelector('#tbName'); inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { doSave(inp.value); closeSheet(); D.toast?.(`\ud83d\udcbe Saved \u201c${draft.name}\u201d.`, 2000); } });
  }
  function loadSheet() {
    const list = D.tracks();
    sheet.innerHTML = `<b>\ud83d\udcc2 Tracks on ${esc(D.planet())}</b>` + list.map(d => `<div class="it"><div>${d.custom ? '\ud83d\udee0' : '\ud83c\udfc1'} ${esc(d.name)}<br><small style="opacity:.7">${d.gates.length} gates${d.custom ? '' : ' \u00b7 preset (loads as a remix)'}</small></div><button data-s="load" data-id="${esc(d.id)}">${d.custom ? 'Edit' : 'Remix'}</button></div>`).join('') +
      `<div class="row"><button data-s="new">\u2728 New track</button><button data-s="close">Close</button></div>`;
    wireSheet();
  }
  // sheet buttons act on pointerdown like the toolbar (the sheet opens over the bar; a click would land on the sheet)
  function wireSheet() { sheet.querySelectorAll('button').forEach(b => D.tapButton(b, () => onSheet({ target: b }))); sheet.classList.add('on'); }
  function closeSheet() { sheet?.classList.remove('on'); }
  function onSheet(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.s === 'close') return closeSheet();
    if (b.dataset.s === 'save') { doSave(sheet.querySelector('#tbName').value); closeSheet(); D.toast?.(`\ud83d\udcbe Saved \u201c${draft.name}\u201d.`, 2000); return; }
    if (b.dataset.s === 'new') { draft = newDraft(); undo = []; sel = null; dirty = true; saved = true; closeSheet(); const c = C(); focus = { x: c.player.x, z: c.player.z }; return status(); }
    if (b.dataset.s === 'load') { const d = D.tracks().find(x => x.id === b.dataset.id); if (d) { closeSheet(); openWith(d, !d.custom); } }
  }

  // ----- picking -----
  function ground(cx, cy) {
    const cam = C().camera; v2.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(v2, cam);
    const o = ray.ray.origin, d = ray.ray.direction; if (d.y > -0.05) return null;
    let y = H(focus.x, focus.z), p = null;
    for (let k = 0; k < 6; k++) { const t = (y - o.y) / d.y; p = { x: o.x + d.x * t, z: o.z + d.z * t }; y = H(p.x, p.z); }
    return p;
  }
  function screenOf(x, y, z) { v3.set(x, y, z).project(C().camera); return { x: (v3.x + 1) / 2 * innerWidth, y: (1 - v3.y) / 2 * innerHeight, ok: v3.z < 1 }; }
  function hit(cx, cy) {
    let best = null, bd = 34;
    const test = (kind, i, x, z, yo) => { const s = screenOf(x, H(x, z) + yo, z); if (!s.ok) return; const d = Math.hypot(s.x - cx, s.y - cy); if (d < bd) { bd = d; best = { kind, i }; } };
    draft.props.forEach((p, i) => test('prop', i, p.x, p.z, 0.5));
    draft.gates.forEach((g, i) => { test('gate', i, g.x, g.z, 0); test('gate', i, g.x, g.z, 6); });
    return best;
  }
  function itemOf(s) { return s ? (s.kind === 'gate' ? draft.gates[s.i] : draft.props[s.i]) : null; }
  // ----- gestures -----
  function down(e) {
    if (e.target.closest('#tbBar') || e.target.closest('#tbSheet')) return;
    e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) {}
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
    closeSheet();
    if (ptrs.size === 1) {
      const h = hit(e.clientX, e.clientY), g = ground(e.clientX, e.clientY);
      if (h) { const it = itemOf(h); gest = { kind: 'drag', sel: h, moved: false, off: g ? { x: it.x - g.x, z: it.z - g.z } : { x: 0, z: 0 }, wasSel: sel && sel.kind === h.kind && sel.i === h.i }; sel = h; dirty = true; status(); }
      else gest = { kind: 'tap', moved: false, g0: g, f0: { ...focus } };
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()]; gest = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, alt0: alt, c0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, f0: { ...focus } };
    }
  }
  function move(e) {
    const p = ptrs.get(e.pointerId); if (!p || !gest) return; p.x = e.clientX; p.y = e.clientY;
    if (gest.kind === 'pinch' && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1; alt = clamp(gest.alt0 * gest.d0 / d, 40, 150);
      const k = alt / innerHeight * 1.4, c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; focus.x = gest.f0.x - (c.x - gest.c0.x) * k; focus.z = gest.f0.z - (c.y - gest.c0.y) * k; return;
    }
    if (Math.hypot(p.x - p.x0, p.y - p.y0) > 8 && !gest.moved) { gest.moved = true; if (gest.kind === 'drag') pushUndo(); }
    if (!gest.moved) return;
    if (gest.kind === 'drag') { const g = ground(p.x, p.y), it = itemOf(gest.sel); if (g && it) { it.x = g.x + gest.off.x; it.z = g.z + gest.off.z; dirty = true; } }
    else if (gest.kind === 'tap') { const k = alt / innerHeight * 1.4; focus.x = gest.f0.x - (p.x - p.x0) * k; focus.z = gest.f0.z - (p.y - p.y0) * k; }
  }
  function up(e) {
    if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
    const g = gest; if (ptrs.size > 0) { if (g?.kind === 'pinch') gest = { kind: 'none' }; return; }
    gest = null; if (!g) return;
    if (g.kind === 'tap' && !g.moved) place(e.clientX, e.clientY);
    if (g.kind === 'drag') { if (!g.moved && g.wasSel) sel = null; dirty = true; status(); }
    recenter();
  }
  function place(cx, cy) {
    const g = ground(cx, cy); if (!g) return;
    if (tool === 'gate') {
      if (draft.gates.length >= RC.MAX_GATES) { D.toast?.(`\ud83d\udea9 ${RC.MAX_GATES} gates max.`, 2000); return; }
      pushUndo(); const at = sel?.kind === 'gate' ? sel.i + 1 : draft.gates.length; draft.gates.splice(at, 0, { x: g.x, z: g.z }); sel = { kind: 'gate', i: at };
    } else {
      if (draft.props.length >= RC.MAX_PROPS) { D.toast?.(`${RC.MAX_PROPS} props max.`, 2000); return; }
      pushUndo(); draft.props.push({ t: tool, x: g.x, z: g.z, yaw: nearestYaw(g) }); sel = { kind: 'prop', i: draft.props.length - 1 };
    }
    dirty = true; status();
  }
  function nearestYaw(p) { // face along the closest track segment
    const t = resolved(); let best = 0, bd = 1e9; t.gates.forEach(g => { const d = Math.hypot(g.x - p.x, g.z - p.z); if (d < bd) { bd = d; best = g.yaw; } }); return best;
  }
  // keep terrain loaded under the camera: walk/drive you to where you're building
  function recenter(force) {
    const c = C(); if (!c) return; const ent = c.car || c.player, d = Math.hypot(ent.x - focus.x, ent.z - focus.z);
    if (d < 30 && !force) return;
    ent.x = focus.x; ent.z = focus.z;
    if (c.car) { c.car.y = H(focus.x, focus.z); c.car.speed = 0; c.car.vy = 0; c.car.prevG = null; } else { c.player.y = H(focus.x, focus.z) + 1.7; c.player.vy = 0; }
  }
  function key(e) {
    const k = alt * 0.08;
    if (e.code === 'KeyW' || e.code === 'ArrowUp') focus.z -= k; else if (e.code === 'KeyS' || e.code === 'ArrowDown') focus.z += k;
    else if (e.code === 'KeyA' || e.code === 'ArrowLeft') focus.x -= k; else if (e.code === 'KeyD' || e.code === 'ArrowRight') focus.x += k;
    else if (e.key === '-' ) alt = clamp(alt * 1.12, 40, 150); else if (e.key === '=' || e.key === '+') alt = clamp(alt * 0.89, 40, 150);
    else if (e.code === 'Delete' || e.code === 'Backspace') act('del');
    else if (e.code === 'KeyR') act('rot'); else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) act('undo');
    else return; e.preventDefault(); if (e.code.startsWith('Key') || e.code.startsWith('Arrow')) recenter();
  }

  // ----- per frame (runs after the surface update, so our camera wins this frame) -----
  function tick(dt) {
    const c = C(); if (!c) return;
    if (c.car) { c.car.speed = 0; }
    if (dirty) {
      dirty = false; const t = resolved(), root = D.root();
      if (grp) { grp.parent?.remove(grp); } if (line) { line.parent?.remove(line); line.geometry.dispose(); line = null; }
      grp = D.buildTrackGroup(t, { numbers: true }); root.add(grp);
      line = D.pathLine(t); if (line) root.add(line);
      const a = D.assets();
      grp.userData.gates.forEach((o, i) => D.setGateLook(o, sel?.kind === 'gate' && sel.i === i ? a.mSel : i === 0 ? a.mNext : a.mIdle));
      grp.userData.props.forEach((o, i) => { o.scale.setScalar(sel?.kind === 'prop' && sel.i === i ? 1.15 : 1); });
    }
    const cam = c.camera, hc = H(focus.x, focus.z);
    cam.position.set(focus.x, hc + alt, focus.z + alt * 0.3); cam.lookAt(focus.x, hc, focus.z);
    const f = c.scene.fog; if (f) { if (f.isFogExp2) f.density = Math.min(f.density, 0.0006); else { f.near = Math.max(f.near, 400); f.far = Math.max(f.far, 1600); } }
  }

  return {
    css, openWith, close, tick, key,
    get open() { return open; }, get draft() { return draft; }, get sel() { return sel; }, get focus() { return { ...focus, alt }; }, get saved() { return saved; },
    // test hooks: screen position of a world point / of an item
    screenOf: (x, z, yo = 0) => screenOf(x, H(x, z) + yo, z), ground, act, setTool
  };
}
