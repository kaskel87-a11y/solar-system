/*
 * savecode.js: 💾 Save Code (Marsmania). Progress lives in each browser's localStorage, so a phone and a computer keep
 * separate saves. This bundles every game save key into one code you copy on one device and paste on another.
 *
 * Loaded as ONE classic <script> before the module scripts (index.html), so a pending import is written to localStorage
 * before any game module reads its save. Import = validate -> back up this device's save (localStorage 'ssx.savecode.bak')
 * -> stage the code in 'ssx.savecode.pending' -> reload -> (here, first thing on load) clear this device's game keys and
 * write the code's keys. Staging survives the pagehide saves that time.js / empire.js do on the way out.
 *
 * Code format: 'SSX1-g.' + base64url(gzip(JSON)) (CompressionStream), or 'SSX1-j.' + base64url(JSON) when gzip is missing.
 * JSON: { f: 'ssx-save', v: 1, t: <ms>, app: 'v7.x', keys: { <localStorage key>: <string value> } }
 * Game keys: every key in KNOWN (found by scanning the source; tests/test-savecode-unit.mjs re-scans and fails on a new one),
 * keys under PREFIXES (race ghosts), and any future versioned save named 'ssx.<name>.v<N>'. DEVICE keys (graphics tier,
 * camera zoom, brightness, install banner) stay with each device and are never exported or overwritten.
 * window.SSX.savecode: export() -> Promise<code>, import(code, { reload = true }) -> Promise<{ ok, msg, keys? }>,
 *   inspect(code) -> Promise<{ ok, msg, t, count }>, undo(), open(), close(), keys() (game keys on this device), core.
 * UI: ☰ → 💾 Save Code. Black buttons, white text, 48px targets, window.__onTap.
 */
(function () {
  'use strict';
  const PREFIX = 'SSX1-', PENDING = 'ssx.savecode.pending', BAK = 'ssx.savecode.bak', DONE = 'ssx.savecode.done';
  const KNOWN = [
    'ssx.progress.v1', 'ssx.discoveries.v1', 'ssx.contacts', 'ssx.texts', 'ssx.dannyShows', 'ssx.adult', 'ssx.dogName', 'ssx.heist.unlock',
    'ssx.ambient.v1', 'ssx.arsenal.v1', 'ssx.base.v1', 'ssx.beltway.v1', 'ssx.bribes.v1', 'ssx.consequences.v1', 'ssx.contraband.v1',
    'ssx.controlMode', 'ssx.danger.v1', 'ssx.director.v1', 'ssx.empire.v1', 'ssx.farm.v1', 'ssx.farm.v1.bak', 'ssx.fight.v1', 'ssx.flats.v1',
    'ssx.grime.v1', 'ssx.hudx.more', 'ssx.hudx.v1', 'ssx.jobs.v1', 'ssx.lab.v1', 'ssx.mars.act.v1', 'ssx.marstracks.snap', 'ssx.mix.v1',
    'ssx.onboard.v1', 'ssx.planets.v1', 'ssx.pursuit.v1', 'ssx.r2r.v1', 'ssx.raccoonRover.v1', 'ssx.race.v1', 'ssx.radioBanner', 'ssx.rep.v1',
    'ssx.smuggle.v1', 'ssx.stars.v1', 'ssx.street.v1', 'ssx.time.v1', 'ssx.turf.v1',
    'ssx.still.v1', 'ssx.still.v1.bak', // moonshine still (mars/still.js) + its #83-style mirror
    'ssx.bar.v1', // Nova's space-liquor bar (bar.js): daily sell cap + drunk level
    'ssx.harvest.v1', 'ssx.skins.v1', 'ssx.flame.v1', 'ssx.jetpack.v1' // v7.5.9 flamethrower (#84) + jetpack (#85) ownership/fuel
  ];
  const PREFIXES = ['ssx.race.ghost.'];
  const DEVICE = ['ssx-quality', 'ssx-gfx-tier', 'ssx.a2hs.seen', 'ssx.dancerq', 'ssx.perfgov', 'ssx.view.v1', 'ssx.view.rover.v1', 'ssx.bright.v1', 'ssx.mouth.tts', 'ssx.muted'];
  const OWN = [PENDING, BAK, DONE];
  const MAX_CODE = 4e6, MAX_VAL = 2e6;
  const VERSIONED = /^ssx\.[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)*\.v\d+$/;
  function isGameKey(k) {
    if (typeof k !== 'string' || k.length > 120) return false;
    if (OWN.includes(k) || DEVICE.includes(k)) return false;
    return KNOWN.includes(k) || PREFIXES.some(p => k.startsWith(p) && k.length > p.length && /^[\w.\-:]+$/.test(k)) || VERSIONED.test(k);
  }
  function storageKeys(st) { const out = []; try { for (let i = 0; i < st.length; i++) { const k = st.key(i); if (k != null) out.push(k); } } catch (e) { /* */ } return out; }
  function collect(st) { const keys = {}; for (const k of storageKeys(st).sort()) if (isGameKey(k)) { const v = st.getItem(k); if (v != null) keys[k] = v; } return keys; }
  // ---- bytes <-> base64url ----
  const enc = new TextEncoder(), dec = new TextDecoder();
  function b64u(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64u(s) { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  async function pipe(bytes, Stream, mode) { const s = new Blob([bytes]).stream().pipeThrough(new Stream(mode)); return new Uint8Array(await new Response(s).arrayBuffer()); }
  // v7.5.9: tiny pure-JS gunzip (inflate after tiny-inflate's tinf, zlib licence) so a browser without DecompressionStream
  // (older iOS Safari / iOS Chrome before 16.4) can still LOAD a gzip code made on a computer. Export there falls back to SSX1-j.
  function gunzipJS(src) {
    if (src.length < 18 || src[0] !== 0x1f || src[1] !== 0x8b || src[2] !== 8) throw new Error('not gzip');
    const flg = src[3]; let pos = 10;
    if (flg & 4) pos += 2 + (src[pos] | src[pos + 1] << 8);
    if (flg & 8) { while (src[pos++]); } if (flg & 16) { while (src[pos++]); } if (flg & 2) pos += 2;
    let tag = 0, cnt = 0, out = new Uint8Array(Math.max(1024, src.length * 4)), n = 0;
    const need = k => { if (n + k > out.length) { const o = new Uint8Array(Math.max(out.length * 2, n + k)); o.set(out.subarray(0, n)); out = o; } };
    const bit = () => { if (!cnt) { if (pos >= src.length) throw new Error('truncated'); tag = src[pos++]; cnt = 8; } const b = tag & 1; tag >>>= 1; cnt--; return b; };
    const bits = k => { let v = 0; for (let i = 0; i < k; i++) v |= bit() << i; return v; };
    const tree = () => ({ table: new Uint16Array(16), trans: new Uint16Array(288) });
    const build = (t, L, off, num) => { t.table.fill(0); for (let i = 0; i < num; i++) t.table[L[off + i]]++; t.table[0] = 0; const offs = new Uint16Array(16);
      for (let i = 0, sum = 0; i < 16; i++) { offs[i] = sum; sum += t.table[i]; } for (let i = 0; i < num; i++) if (L[off + i]) t.trans[offs[L[off + i]]++] = i; };
    const sym = t => { let sum = 0, cur = 0, len = 0; do { cur = 2 * cur + bit(); if (++len > 15) throw new Error('bad code'); sum += t.table[len]; cur -= t.table[len]; } while (cur >= 0); return t.trans[sum + cur]; };
    const LB = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258], LX = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
    const DB = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577], DX = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
    const CL = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
    const flt = tree(), fdt = tree(); { const L = new Uint8Array(320); L.fill(8, 0, 144); L.fill(9, 144, 256); L.fill(7, 256, 280); L.fill(8, 280, 288); L.fill(5, 288, 318); build(flt, L, 0, 288); build(fdt, L, 288, 30); }
    const lt = tree(), dt = tree(), ct = tree();
    let final;
    do {
      final = bit(); const type = bits(2);
      if (type === 0) { cnt = 0; const len = src[pos] | src[pos + 1] << 8; pos += 4; if (pos + len > src.length) throw new Error('truncated'); need(len); out.set(src.subarray(pos, pos + len), n); n += len; pos += len; continue; }
      let L1 = flt, D1 = fdt;
      if (type === 2) {
        const hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4, L = new Uint8Array(320);
        for (let i = 0; i < hclen; i++) L[CL[i]] = bits(3); build(ct, L, 0, 19); L.fill(0, 0, 19);
        for (let i = 0; i < hlit + hdist;) { const c = sym(ct);
          if (c < 16) L[i++] = c; else { let r, v = 0; if (c === 16) { if (!i) throw new Error('bad'); v = L[i - 1]; r = 3 + bits(2); } else if (c === 17) r = 3 + bits(3); else r = 11 + bits(7); if (i + r > hlit + hdist) throw new Error('bad'); while (r--) L[i++] = v; } }
        build(lt, L, 0, hlit); build(dt, L, hlit, hdist); L1 = lt; D1 = dt;
      } else if (type !== 1) throw new Error('bad block');
      for (;;) { const c = sym(L1); if (c === 256) break;
        if (c < 256) { need(1); out[n++] = c; continue; }
        const li = c - 257; if (li > 28) throw new Error('bad'); const len = LB[li] + bits(LX[li]); const di = sym(D1); if (di > 29) throw new Error('bad'); const d = DB[di] + bits(DX[di]);
        if (d > n) throw new Error('bad distance'); need(len); for (let k = 0; k < len; k++, n++) out[n] = out[n - d]; }
    } while (!final);
    return out.subarray(0, n);
  }
  const hasGzip = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function' && typeof Response === 'function' && typeof Blob === 'function';
  async function encode(keys, meta = {}) {
    const json = JSON.stringify({ f: 'ssx-save', v: 1, t: meta.t || Date.now(), app: meta.app || '', keys });
    const raw = enc.encode(json);
    if (hasGzip() && !meta.plain) { try { return PREFIX + 'g.' + b64u(await pipe(raw, CompressionStream, 'gzip')); } catch (e) { /* fall back to plain */ } }
    return PREFIX + 'j.' + b64u(raw);
  }
  const fail = msg => ({ ok: false, msg });
  const BAD = 'That doesn\u2019t look like a save code. Copy the whole code (it starts with SSX1-) and try again. Nothing was changed.';
  async function decode(code) {
    if (typeof code !== 'string') return fail(BAD);
    const c = code.replace(/\s+/g, '');
    if (!c) return fail('Paste a save code first. Nothing was changed.');
    if (c.length > MAX_CODE) return fail('That code is too big to be a save. Nothing was changed.');
    const m = /^SSX1-([gj])\.([A-Za-z0-9_-]+)$/.exec(c); if (!m) return fail(BAD);
    let obj;
    try {
      let bytes = unb64u(m[2]);
      if (m[1] === 'g') { const z = bytes; bytes = null; if (hasGzip()) { try { bytes = await pipe(z, DecompressionStream, 'gzip'); } catch (e) { bytes = null; } } if (!bytes) bytes = gunzipJS(z); } // v7.5.9: JS fallback (older iOS)
      obj = JSON.parse(dec.decode(bytes));
    } catch (e) { return fail('That code is damaged or cut short. Copy the whole code again. Nothing was changed.'); }
    return validate(obj);
  }
  function validate(obj) {
    if (!obj || typeof obj !== 'object' || obj.f !== 'ssx-save' || !obj.keys || typeof obj.keys !== 'object' || Array.isArray(obj.keys)) return fail(BAD);
    if (obj.v !== 1) return fail('That code comes from a newer version of the game. Update this device and try again. Nothing was changed.');
    const keys = {}; let skipped = 0;
    for (const [k, v] of Object.entries(obj.keys)) { if (isGameKey(k) && typeof v === 'string' && v.length <= MAX_VAL) keys[k] = v; else skipped++; }
    if (!keys['ssx.progress.v1'] && !Object.keys(keys).length) return fail('That code has no game progress in it. Nothing was changed.');
    return { ok: true, t: Number(obj.t) || 0, app: String(obj.app || ''), keys, count: Object.keys(keys).length, skipped };
  }
  // replace this device's game keys with `keys` (device keys and our own keys stay)
  function applyTo(st, keys) {
    for (const k of storageKeys(st)) if (isGameKey(k) && !(k in keys)) st.removeItem(k);
    for (const [k, v] of Object.entries(keys)) if (isGameKey(k)) st.setItem(k, v);
  }
  const core = { gunzipJS, PREFIX, KNOWN, PREFIXES, DEVICE, OWN, isGameKey, collect, encode, decode, validate, applyTo, b64u, unb64u };
  globalThis.SSXSaveCore = core;
  if (typeof window === 'undefined' || typeof document === 'undefined') return; // node unit test

  let LS = null; try { LS = window.localStorage; } catch (e) { LS = null; }
  // ---- 1) first thing on load: apply a staged import before any module reads its save ----
  let applied = null;
  try {
    const raw = LS && LS.getItem(PENDING);
    if (raw) { LS.removeItem(PENDING); const p = JSON.parse(raw); const v = validate({ f: 'ssx-save', v: 1, keys: p.keys }); if (v.ok) { applyTo(LS, v.keys); applied = { n: v.count, undo: !!p.undo, t: p.t || 0 }; LS.setItem(DONE, JSON.stringify(applied)); } }
  } catch (e) { console.warn('savecode: pending import skipped', e); }

  // ---- 2) API + panel once the game is up ----
  const app = () => window.__app, game = () => app() && (app().game || (app().surface && app().surface.game));
  const ver = () => { const m = document.querySelector('meta[name="app-version"]'); return m ? m.content : ''; };
  const flush = () => { try { const g = game(); if (g && g.save) g.save(); } catch (e) { /* */ } };
  async function exportCode() { flush(); if (!LS) throw new Error('No storage on this browser.'); return encode(collect(LS), { app: ver() }); }
  async function inspect(code) { return decode(code); }
  // v7.5.9: once an import is staged, this tab must not write game saves any more (its pagehide / autosave would land after the
  // reload applies the code if anything delays it, and a 2nd tab with the game open would overwrite the import with its old state).
  let locked = false;
  function lockWrites() {
    if (locked || typeof Storage === 'undefined') return; locked = true;
    const P = Storage.prototype, set = P.setItem, rm = P.removeItem;
    P.setItem = function (k, v) { if (this === LS && isGameKey(String(k))) return; return set.call(this, k, v); };
    P.removeItem = function (k) { if (this === LS && isGameKey(String(k))) return; return rm.call(this, k); };
  }
  // another tab staged an import: stop saving here, then reload once that tab has applied it
  try { window.addEventListener('storage', e => { if (e.key === PENDING && e.newValue && !locked) { lockWrites(); try { app() && app().toast && app().toast('💾 A save is loading in another tab. This tab reloads to match.', 3000); } catch (x) { /* */ } setTimeout(() => location.reload(), 2500); } }); } catch (e) { /* */ }
  function stage(keys, undo) {
    if (!LS) return fail('This browser won\u2019t let the game save. Nothing was changed.');
    try {
      if (!undo) LS.setItem(BAK, JSON.stringify({ t: Date.now(), app: ver(), keys: collect(LS) }));
      LS.setItem(PENDING, JSON.stringify({ t: Date.now(), undo: !!undo, keys }));
      lockWrites();
    } catch (e) { try { LS.removeItem(PENDING); } catch (x) { /* */ } return fail('This device is out of save space. Nothing was changed.'); }
    return { ok: true };
  }
  let busy = false;
  async function importCode(code, opts = {}) {
    if (busy) return { ok: false, dup: true, msg: 'Already loading.' }; busy = true;
    try {
      const v = await decode(code); if (!v.ok) return v;
      const s = stage(v.keys, false); if (!s.ok) return s;
      if (opts.reload !== false) setTimeout(() => location.reload(), 60);
      return { ok: true, count: v.count, skipped: v.skipped, t: v.t, keys: Object.keys(v.keys), msg: `Loading ${v.count} save items\u2026` };
    } finally { busy = false; }
  }
  function backup() { try { const b = JSON.parse(LS.getItem(BAK) || 'null'); return b && b.keys ? b : null; } catch (e) { return null; } }
  function undo(opts = {}) { const b = backup(); if (!b) return fail('No earlier save to go back to.'); const s = stage(b.keys, true); if (!s.ok) return s; try { LS.removeItem(BAK); } catch (e) { /* */ } if (opts.reload !== false) setTimeout(() => location.reload(), 60); return { ok: true, msg: 'Going back to the save from before\u2026' }; }

  const css = `
#scPanel{position:fixed;inset:0;z-index:64;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.6)}
#scPanel.show{display:flex}
#scPanel .wrap{width:min(480px,calc(100vw - 12px));max-height:calc(100vh - 24px - env(safe-area-inset-top));display:flex;flex-direction:column;overflow:hidden;margin:0 6px calc(8px + env(safe-area-inset-bottom));padding:14px;border-radius:16px;background:#000;color:#fff;border:2px solid #fff;font:14px system-ui,sans-serif;box-sizing:border-box}
#scBody{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch}
#scPanel h2{margin:0 0 6px;font-size:18px} #scPanel h3{margin:12px 0 6px;font-size:15px} #scPanel p{margin:0 0 8px;font-size:13px;color:#fff}
#scPanel .note{padding:8px 10px;border:2px solid #fff;border-radius:10px;font-weight:700}
#scPanel .row{display:flex;gap:8px;margin:6px 0} #scPanel .row>*{flex:1}
#scPanel button,#scPanel label.btnl{display:flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:48px;min-width:64px;padding:4px 10px;border-radius:10px;background:#000!important;color:#fff!important;border:2px solid #fff!important;font:800 14px system-ui,sans-serif;touch-action:manipulation;cursor:pointer;opacity:1}
#scPanel button:disabled{opacity:.45;border-style:dashed!important}
#scPanel textarea{width:100%;box-sizing:border-box;min-height:64px;padding:8px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:12px ui-monospace,monospace;resize:vertical;word-break:break-all}
#scPanel .confirm{margin:8px 0;padding:10px;border:2px solid #fff;border-radius:10px}
#scPanel .msg{min-height:1.3em;margin:8px 0;font-weight:700;color:#fff} #scPanel .foot{display:flex}
#scPanel .foot button{flex:1} #scFile{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
`;
  let panel, body, msgEl, code = '', pendingV = null, pendingKind = null, lastTouch = 0;
  function tap(el, fn) {
    const g = e => { const n = performance.now(); if (e && e.type === 'click' && n - lastTouch < 700) return; if (e && e.type === 'pointerup') lastTouch = n; fn(e); };
    (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, g);
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const when = t => { try { return t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'an unknown time'; } catch (e) { return 'an unknown time'; } };
  const say = m => { if (msgEl) msgEl.textContent = m || ''; };
  function ui() {
    if (panel) return; const st = document.createElement('style'); st.id = 'scCss'; st.textContent = css; document.head.appendChild(st);
    panel = document.createElement('div'); panel.id = 'scPanel';
    panel.innerHTML = '<div class="wrap" role="dialog" aria-label="Save Code"><div id="scBody"></div><div class="msg" id="scMsg" aria-live="polite"></div><div class="foot"><button id="scClose" type="button">Close</button></div></div>';
    document.body.appendChild(panel); body = panel.querySelector('#scBody'); msgEl = panel.querySelector('#scMsg');
    tap(panel.querySelector('#scClose'), close);
  }
  function render() {
    const b = backup();
    body.innerHTML = `<h2>💾 Save Code</h2><p class="note">Progress is saved per device and browser. Use this code to move it.</p>
<h3>Move progress from this device</h3><p>Copy this code (or download it), then paste it on your other device.</p>
<textarea id="scOut" readonly aria-label="Your save code" rows="3">${esc(code || 'Making your code\u2026')}</textarea>
<p id="scSize">${code ? `${code.length.toLocaleString('en-US')} characters` : ''}</p>
<div class="row"><button id="scCopy" type="button" ${code ? '' : 'disabled'}>Copy code</button><button id="scDl" type="button" ${code ? '' : 'disabled'}>Download .txt</button></div>
<h3>Load progress onto this device</h3><p>Paste a code from your other device, or load the .txt file.</p>
<textarea id="scIn" aria-label="Paste a save code here" rows="3" placeholder="Paste the code here (starts with SSX1-)" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
<div class="row"><button id="scLoad" type="button">Load code</button><label class="btnl" id="scFileBtn" for="scFile">Load from file</label></div>
<input id="scFile" type="file" accept=".txt,text/plain" aria-label="Save code file">
<div id="scConfirm"></div>
${b ? `<h3>Changed your mind?</h3><div class="row"><button id="scUndo" type="button">Undo last load (save from ${esc(when(b.t))})</button></div>` : ''}`;
    tap(body.querySelector('#scCopy'), copy); tap(body.querySelector('#scDl'), download);
    tap(body.querySelector('#scLoad'), () => check(body.querySelector('#scIn').value));
    body.querySelector('#scFile').addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return; if (f.size > MAX_CODE) return say('That file is too big to be a save code. Nothing was changed.'); const t = await f.text(); body.querySelector('#scIn').value = t.trim(); check(t); });
    const u = body.querySelector('#scUndo'); if (u) tap(u, () => ask('undo', null));
  }
  async function copy() {
    const out = body.querySelector('#scOut'); let okc = false;
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(code); okc = true; } } catch (e) { /* fall back */ }
    if (!okc) { try { out.focus(); out.select(); out.setSelectionRange(0, code.length); okc = document.execCommand && document.execCommand('copy'); } catch (e) { okc = false; } }
    say(okc ? '✅ Code copied. Paste it on your other device: ☰ → 💾 Save Code → Load code.' : 'The code is selected. Copy it (long-press → Copy), then paste it on your other device.');
  }
  function download() {
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([code + '\n'], { type: 'text/plain' }));
      a.download = `solar-system-save-${new Date().toISOString().slice(0, 10)}.txt`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      say('⬇️ Saved the code as a .txt file.'); } catch (e) { say('Download didn\u2019t work here. Use Copy code instead.'); }
  }
  async function check(text) {
    say('Checking the code\u2026'); const v = await decode(text);
    if (!v.ok) { body.querySelector('#scConfirm').innerHTML = ''; return say(v.msg); }
    ask('load', v);
  }
  function ask(kind, v) {
    pendingKind = kind; pendingV = v; const box = body.querySelector('#scConfirm');
    const what = kind === 'undo' ? 'This puts back the save this device had before your last load.' : `This code holds a save from ${esc(when(v.t))}${v.app ? ` (${esc(v.app)})` : ''}.`;
    box.innerHTML = `<div class="confirm" role="alertdialog" aria-label="Replace progress?"><p><b>Replace the progress on this device?</b></p><p>${what} Everything saved on this device (progress, farm, credits, stars) is replaced. Your current save is kept, so you can undo it here.</p>
<div class="row"><button id="scYes" type="button">Yes, replace</button><button id="scNo" type="button">Cancel</button></div></div>`;
    say(''); box.scrollIntoView({ block: 'nearest' });
    tap(box.querySelector('#scNo'), () => { box.innerHTML = ''; pendingV = null; say('Nothing was changed.'); });
    tap(box.querySelector('#scYes'), () => {
      if (pendingKind === 'undo') { const r = undo(); return say(r.msg); }
      if (!pendingV) return; const s = stage(pendingV.keys, false); if (!s.ok) return say(s.msg);
      box.innerHTML = ''; say(`Loading ${pendingV.count} save items\u2026 the game restarts in a moment.`); pendingV = null; setTimeout(() => location.reload(), 400);
    });
  }
  async function open() {
    ui(); code = ''; pendingV = null; panel.classList.add('show'); try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ }
    render(); say('');
    try { code = await exportCode(); } catch (e) { say('Couldn\u2019t read this device\u2019s save. ' + (e && e.message || '')); }
    // fill the code in place (a full render() here wiped a Load → confirm already on screen when the export finished late)
    if (panel.classList.contains('show')) { const o = body.querySelector('#scOut'), z = body.querySelector('#scSize'); if (o) o.value = code; if (z) z.textContent = code ? `${code.length.toLocaleString('en-US')} characters` : '';
      for (const id of ['#scCopy', '#scDl']) { const b = body.querySelector(id); if (b) b.disabled = !code; } }
  }
  function close() { if (panel) panel.classList.remove('show'); }
  const API = { get locked() { return locked; }, export: exportCode, import: importCode, inspect, undo, open, close, keys: () => (LS ? Object.keys(collect(LS)) : []), get backup() { const b = backup(); return b ? { t: b.t, count: Object.keys(b.keys).length } : null; }, get applied() { return applied; }, core };
  (function boot() {
    if (!window.SSX || !window.__app || !window.SSX.registerMenuItem) { setTimeout(boot, 200); return; }
    window.SSX.savecode = API;
    try { window.SSX.registerMenuItem({ id: 'rmSaveCode', label: '💾 Save Code', onTap: () => open() }); } catch (e) { console.warn('savecode menu', e); }
    try { const d = LS && JSON.parse(LS.getItem(DONE) || 'null'); if (d) { LS.removeItem(DONE); setTimeout(() => { try { app().toast(d.undo ? '💾 Your earlier save is back.' : `💾 Save loaded (${d.n} items). Welcome back.`, 4000); } catch (e) { /* */ } }, 1500); } } catch (e) { /* */ }
  })();
})();
