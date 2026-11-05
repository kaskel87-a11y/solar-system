// Bore's bench: a black-market gunsmith in Red Tape Flats, a short walk from Blue. Trades guns, ammo and mods for
// contraband (through SSX.contraband.registerOffer + barter, so the stash, stats and barks stay in one place), for a
// favour (one front at a time, cleared when you finish any job), or for cash at a steep markup. Fictional everything.
import * as THREE from 'three';

const AT = [-246, -62], NEAR = 5.5, MARKUP = 1.6;
const fin = v => typeof v === 'number' && isFinite(v);
// what Bore takes. wants use contraband ids (glowdust lowg redstatic voidhoney); cash = base credits before the markup
const CATALOG = [
  { id: 'smg', kind: 'gun', label: 'Viper SMG', wants: [{ item: 'glowdust', qty: 3 }], cash: 420, ammo: 30 },
  { id: 'shotgun', kind: 'gun', label: 'Breacher shotgun', wants: [{ item: 'redstatic', qty: 2 }], cash: 380, ammo: 12 },
  { id: 'rifle', kind: 'gun', label: 'Longwatch AR-7', wants: [{ item: 'voidhoney', qty: 2 }, { item: 'lowg', qty: 2 }], cash: 640, ammo: 48 },
  { id: 'rail', kind: 'gun', label: 'Halcyon coil lance (rare)', wants: [{ item: 'voidhoney', qty: 4 }, { item: 'glowdust', qty: 4 }], cash: 2400, ammo: 3, noFavor: true },
  { id: 'bat', kind: 'melee', label: 'Slugger bat', wants: [{ item: 'lowg', qty: 1 }], cash: 90 },
  { id: 'ammo:light:std', kind: 'ammo', label: 'Light rounds ×40', wants: [{ item: 'glowdust', qty: 1 }], cash: 60, n: 40 },
  { id: 'ammo:light:hollow', kind: 'ammo', label: 'Hollow-point light ×30', wants: [{ item: 'redstatic', qty: 1 }], cash: 110, n: 30 },
  { id: 'ammo:light:ap', kind: 'ammo', label: 'AP light ×30', wants: [{ item: 'lowg', qty: 1 }], cash: 130, n: 30 },
  { id: 'ammo:shell:std', kind: 'ammo', label: 'Shells ×12', wants: [{ item: 'glowdust', qty: 1 }], cash: 70, n: 12 },
  { id: 'ammo:shell:ap', kind: 'ammo', label: 'AP shells ×10', wants: [{ item: 'redstatic', qty: 1 }], cash: 120, n: 10 },
  { id: 'ammo:heavy:std', kind: 'ammo', label: 'Heavy rounds ×48', wants: [{ item: 'lowg', qty: 1 }], cash: 90, n: 48 },
  { id: 'ammo:heavy:hollow', kind: 'ammo', label: 'Hollow-point heavy ×30', wants: [{ item: 'redstatic', qty: 1 }, { item: 'glowdust', qty: 1 }], cash: 150, n: 30 },
  { id: 'ammo:heavy:ap', kind: 'ammo', label: 'AP heavy ×30', wants: [{ item: 'voidhoney', qty: 1 }], cash: 170, n: 30 },
  { id: 'ammo:rail:slug', kind: 'ammo', label: 'Coil slugs ×3', wants: [{ item: 'voidhoney', qty: 2 }], cash: 600, n: 3, noFavor: true },
  { id: 'mod:suppressor', kind: 'mod', mod: 'suppressor', label: 'Suppressor', wants: [{ item: 'redstatic', qty: 1 }, { item: 'glowdust', qty: 1 }], cash: 350 },
  { id: 'mod:extmag', kind: 'mod', mod: 'extmag', label: 'Extended mag', wants: [{ item: 'lowg', qty: 2 }], cash: 260 },
  { id: 'mod:scope', kind: 'mod', mod: 'scope', label: 'Scope', wants: [{ item: 'voidhoney', qty: 1 }], cash: 300 }
];
const LINES = { hi: ['Bore: "No serials, no questions, no refunds."', 'Bore: "Blue sends me the good ones. You look like one."', 'Bore: "Iron for product. Product for iron. Mars runs on it."'], deal: ['Bore: "Pleasure. Don\u2019t say where you got it."', 'Bore: "Wrapped in a rag, like always."'], short: ['Bore: "Come back when your pockets rattle."'] };
const pick = a => a[(Math.random() * a.length) | 0];

export function initGunsmith(A) {
  const app = () => window.__app || null, surf = () => app()?.surface || null, game = () => surf()?.game || null;
  const C = () => window.SSX?.contraband || null;
  const st = A.state();
  let marked = false, mesh = null, meshScene = null, btn = null, panel = null, near = false, open = false, modFor = null;
  const at = () => { const c = surf()?.world?.colony; return c && fin(c.x) ? { x: c.x + AT[0], z: c.z + AT[1] } : null; };
  const dist = () => { const i = A.pos(), p = at(); return i && p && fin(i.x) && !i.driving && !i.inside && i.name === 'Mars' ? Math.hypot(i.x - p.x, i.z - p.z) : Infinity; };
  const repOk = () => { try { const R = window.SSX?.rep; const v = typeof R?.get === 'function' ? R.get('flats') ?? R.get('red-tape-flats') : null; return !(fin(v) && v < -40); } catch (e) { return true; } };
  const iname = id => { try { return (C()?.items?.() || []).find(i => i.id === id)?.name || id; } catch (e) { return id; } };
  const fmt = w => w.map(x => `${x.qty}× ${iname(x.item)}`).join(' + ');
  const targetFor = e => { if (e.kind !== 'mod') return null; if (modFor && A.defs()[modFor]?.mods.includes(e.mod)) return modFor; const c = A.current(); if (c && A.defs()[c.id]?.mods.includes(e.mod)) return c.id;
    return A.weapons().find(w => w.owned && w.fits?.includes(e.mod) && !w.mods.includes(e.mod))?.id || null; };
  function why(e) { // '' = can take it
    if (e.kind === 'gun' || e.kind === 'melee') return A.owned(e.id) && e.kind === 'melee' ? 'Owned' : '';
    if (e.kind === 'ammo') { const [, cal] = e.id.split(':'); return A.weapons().some(w => w.owned && w.cal === cal) ? '' : 'No gun for it'; }
    if (e.kind === 'mod') { const t = targetFor(e); if (!t) return 'Nothing it fits'; return A.hasMod(t, e.mod) ? 'Fitted' : ''; }
    return '';
  }
  function grant(e) {
    if (e.kind === 'gun' || e.kind === 'melee') return A.give(e.id, e.ammo || 0);
    if (e.kind === 'ammo') return A.give(e.id, e.n);
    if (e.kind === 'mod') { const t = targetFor(e); return t ? A.addMod(t, e.mod) : { ok: false, msg: 'Nothing it fits.' }; }
    return { ok: false, msg: 'No deal.' };
  }
  // contraband offers (Bore only deals face to face)
  let registered = false;
  function register() {
    const c = C(); if (registered || !c?.registerOffer) return registered; 
    for (const e of CATALOG) {
      try { c.registerOffer({ id: 'bore:' + e.id, npc: 'bore', district: 'red-tape-flats', wants: e.wants, gives: { type: 'custom', label: e.label }, repeatable: true,
        available: () => dist() < NEAR || A.debug.__smithAnywhere === true, onTrade: () => { const w = why(e); if (w) return { ok: false, msg: w + '.' }; const r = grant(e); return r.ok ? { ok: true, msg: r.msg } : { ok: false, msg: r.msg }; } }); } catch (err) { console.warn('bore offer', e.id, err); }
    }
    registered = true; return true;
  }
  function trade(id, pay = 'stash') {
    const e = CATALOG.find(q => q.id === id); if (!e) return { ok: false, msg: 'Bore: "Never heard of it."' };
    if (dist() >= NEAR && A.debug.__smithAnywhere !== true) return { ok: false, msg: 'Find Bore in Red Tape Flats (near Blue).' };
    const w = why(e); if (w) return { ok: false, msg: `Bore: "${w}."` };
    let r;
    if (pay === 'stash') {
      const c = C(); if (!c) return { ok: false, msg: 'Bore: "Product only. You got none."' };
      if (register()) { r = c.barter(null, null, 'bore:' + e.id); }
      else { const s = c.stash()?.items || {}; if (!e.wants.every(x => (s[x.item]?.qty || 0) >= x.qty)) return { ok: false, msg: pick(LINES.short) }; for (const x of e.wants) c.remove(x.item, x.qty); r = grant(e); }
    } else if (pay === 'cash') {
      const g = game(), price = Math.round(e.cash * MARKUP); if (!g?.spend?.(price)) return { ok: false, msg: `Bore: "${price} cr. Cash is cash, and you\u2019re short."` };
      r = grant(e); if (!r.ok) { try { g.progress.credits += price; g.save(); } catch (x) { /* */ } } else r = { ...r, msg: `${r.msg} (−${price} cr)` };
    } else if (pay === 'favor') {
      if (e.noFavor) return { ok: false, msg: 'Bore: "Not on a favour. Not that one."' };
      if (st.debt) return { ok: false, msg: `Bore: "You still owe me for the ${st.debt.label}. Finish a job first."` };
      if (!window.SSX?.jobs) return { ok: false, msg: 'Bore: "No work around to owe me with."' };
      if (!repOk()) return { ok: false, msg: 'Bore: "Your name\u2019s mud in the Flats. Cash or product."' };
      r = grant(e); if (r.ok) { st.debt = { id: e.id, label: e.label, t: Date.now() }; A.saveState(); r = { ...r, msg: `${r.msg} You owe Bore a job (📜 J).` }; }
    } else return { ok: false, msg: 'Pay how?' };
    if (r?.ok) { A.emit('trade', { id: e.id, pay }); A.toast(`🔧 ${r.msg}`, 3000); } render();
    return r || { ok: false, msg: 'No deal.' };
  }
  try { window.SSX?.jobs?.on?.('complete', () => { if (st.debt) { const l = st.debt.label; st.debt = null; A.saveState(); A.toast(`🔧 Bore: "We\u2019re square for the ${l}."`, 3000); A.emit('trade', { id: 'debt', pay: 'paid' }); } }); } catch (e) { /* no jobs */ }

  // ---------- UI ----------
  const css = `#arSmithBtn{position:fixed;z-index:9;left:50%;transform:translateX(-50%);bottom:calc(150px + env(safe-area-inset-bottom));min-height:48px;padding:0 18px;border-radius:24px;border:2px solid #ffd400;background:#000;color:#ffd400;font:700 16px system-ui,sans-serif;display:none;touch-action:manipulation}
body.surface:not(.indoors) #arSmithBtn.show{display:block}
#arShop{position:fixed;z-index:61;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,94vw);max-height:84vh;overflow:auto;background:#050505;color:#fff;border:3px solid #ffd400;border-radius:16px;padding:12px;font:14px system-ui,sans-serif;display:none;-webkit-overflow-scrolling:touch}
#arShop.open{display:block} #arShop h3{margin:0 0 4px;color:#ffd400;font-size:18px} #arShop .sub{color:#ddd;margin:0 0 8px}
#arShop .sec{margin:10px 0 4px;font-weight:800;color:#ffd400;text-transform:uppercase;font-size:12px;letter-spacing:.06em}
#arShop .row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 0;border-top:1px solid #333}
#arShop .row .nm{flex:1 1 180px;font-weight:700} #arShop .row .nm small{display:block;font-weight:400;color:#ccc}
#arShop button{min-height:44px;min-width:44px;border-radius:10px;border:2px solid #fff;background:#111;color:#fff;font:700 13px system-ui,sans-serif;padding:0 10px;touch-action:manipulation}
#arShop button.pri{background:#ffd400;color:#000;border-color:#ffd400} #arShop button[disabled]{opacity:.4}
#arShop .x{position:sticky;top:0;float:right;min-width:48px;font-size:18px} #arShop .stash{color:#9ff;margin-bottom:4px}
#arShop .tgt{display:flex;gap:6px;flex-wrap:wrap} #arShop .tgt button.on{border-color:#3ee07a;color:#3ee07a}`;
  const tap = (el, fn) => { if (window.__onTap) window.__onTap(el, fn); else el.addEventListener('pointerup', ev => { ev.preventDefault(); fn(ev); }); };
  function ui() {
    if (btn) return; const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    btn = document.createElement('button'); btn.id = 'arSmithBtn'; btn.type = 'button'; btn.textContent = '🔧 Bore\u2019s bench'; document.body.appendChild(btn); tap(btn, () => openShop());
    panel = document.createElement('div'); panel.id = 'arShop'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Black-market gunsmith'); document.body.appendChild(panel);
    panel.addEventListener('pointerdown', ev => ev.stopPropagation());
  }
  function render() {
    if (!panel || !open) return; const c = C(), s = c?.stash?.()?.items || {}, cr = game()?.progress?.credits | 0;
    const stash = Object.entries(s).filter(([, v]) => v.qty > 0).map(([k, v]) => `${v.qty}× ${iname(k)}`).join(', ') || 'nothing';
    const owned = A.weapons().filter(w => w.owned && w.fits?.length);
    let h = `<button class="x" type="button" data-a="close" aria-label="Close">✕</button><h3>🔧 Bore\u2019s bench</h3><p class="sub">${pick(LINES.hi)}</p><div class="stash">Stash: ${stash} · ${cr} cr${st.debt ? ` · owes: ${st.debt.label}` : ''}</div>`;
    for (const [k, t] of [['gun', 'Guns'], ['melee', 'Melee'], ['ammo', 'Ammo'], ['mod', 'Mods']]) {
      h += `<div class="sec">${t}</div>`;
      if (k === 'mod') h += `<div class="tgt">${owned.map(w => `<button type="button" data-a="tgt" data-id="${w.id}" class="${(targetFor({ kind: 'mod', mod: 'scope' }) === w.id && modFor === w.id) || modFor === w.id ? 'on' : ''}">${w.icon} ${w.name.split(' ')[0]}</button>`).join('')}</div>`;
      for (const e of CATALOG.filter(q => q.kind === k)) {
        const w = why(e), have = e.wants.every(x => (s[x.item]?.qty || 0) >= x.qty), tg = e.kind === 'mod' ? targetFor(e) : null, mine = (e.kind === 'gun') && A.owned(e.id);
        h += `<div class="row"><div class="nm">${e.label}${mine ? ' (owned: ammo)' : ''}${tg ? ` → ${A.defs()[tg].name}` : ''}<small>${fmt(e.wants)} · or ${Math.round(e.cash * MARKUP)} cr${w ? ' · ' + w : ''}</small></div>`
          + `<button type="button" class="pri" data-a="stash" data-id="${e.id}" ${w || !have ? 'disabled' : ''}>Trade</button><button type="button" data-a="cash" data-id="${e.id}" ${w || cr < Math.round(e.cash * MARKUP) ? 'disabled' : ''}>Cash</button>${e.noFavor ? '' : `<button type="button" data-a="favor" data-id="${e.id}" ${w || st.debt ? 'disabled' : ''}>Favor</button>`}</div>`;
      }
    }
    panel.innerHTML = h;
    panel.querySelectorAll('button[data-a]').forEach(b => tap(b, () => {
      const a = b.dataset.a; if (a === 'close') return closeShop(); if (a === 'tgt') { modFor = b.dataset.id; return render(); }
      if (b.disabled) return; const r = trade(b.dataset.id, a); if (!r.ok) A.toast(r.msg, 2600);
    }));
  }
  function openShop() { ui(); if (dist() >= NEAR && A.debug.__smithAnywhere !== true) { A.toast('Find Bore in Red Tape Flats (near Blue).'); return false; } register(); open = true; panel.classList.add('open'); render(); A.emit('trade', { id: 'open' }); return true; }
  function closeShop() { open = false; panel?.classList.remove('open'); return true; }
  function stall(sc, h) {
    if (meshScene === sc && mesh) return; if (mesh && meshScene) meshScene.remove(mesh); mesh = null; meshScene = sc; const p = at(); if (!sc || !p) return;
    const g = new THREE.Group(), dark = new THREE.MeshLambertMaterial({ color: 0x2a2420 }), metal = new THREE.MeshLambertMaterial({ color: 0x5a5e66 }), tarp = new THREE.MeshLambertMaterial({ color: 0x7a1d12 });
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 1), dark); bench.position.y = 0.45; g.add(bench);
    for (const x of [-1.2, 1.2]) { const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), metal); pole.position.set(x, 1.3, -0.45); g.add(pole); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 1.6), tarp); roof.position.set(0, 2.6, 0); roof.rotation.x = 0.12; g.add(roof);
    for (let i = 0; i < 3; i++) { const gun = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.16), metal); gun.position.set(-0.8 + i * 0.8, 0.95, 0); gun.rotation.y = 0.3 * i; g.add(gun); }
    const gy = h?.(p.x, p.z); g.position.set(p.x, fin(gy) ? gy : 0, p.z); g.name = 'boreStall'; sc.add(g); mesh = g;
  }
  window.SSX?.registerSurfaceTick?.((dt, tc) => {
    try {
      if (tc?.name && tc.name !== 'Mars') { if (btn) btn.classList.remove('show'); return; }
      stall(tc?.scene, tc?.height); ui(); if (!marked) { const p = at(); if (p) { marked = true; try { window.SSX?.minimap?.addMarks?.('arsenal', [{ x: p.x, z: p.z, color: '#ffd400', r: 2.6, label: 'Bore' }]); } catch (e) { /* no marks */ } } } const n = dist() < NEAR; if (n !== near) { near = n; btn.classList.toggle('show', n); if (!n) closeShop(); }
    } catch (e) { console.warn('gunsmith tick', e); }
  });
  setTimeout(register, 0);
  return { open: openShop, close: closeShop, at, catalog: () => CATALOG.map(e => ({ ...e, cashPrice: Math.round(e.cash * MARKUP), why: why(e) })), trade, near: () => dist() < NEAR, isOpen: () => open };
}
