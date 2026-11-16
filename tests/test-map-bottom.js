// v7.5.115 map bottom bar. Bottom legend, place rows, and waypoint buttons
// stay on screen, do not overlap, and are at least 44px tall on iPhone SE and iPhone 14 portrait.
// BASE=http://127.0.0.1:8765/ node tests/test-map-bottom.js
const pw = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8765/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hit = (a, b) => a.right > b.left + 0.5 && b.right > a.left + 0.5 && a.bottom > b.top + 0.5 && b.bottom > a.top + 0.5;
const onScreen = (r, ih, iw) => r.top >= -0.5 && r.left >= -0.5 && r.bottom <= ih + 0.5 && r.right <= iw + 0.5;
const measure = () => {
  const box = el => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return { t: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48), h: r.height, w: r.width, top: r.top, left: r.left, bottom: r.bottom, right: r.right, fs: parseFloat(s.fontSize), color: s.color, bg: s.backgroundColor };
  };
  const seen = el => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const clip = el.closest('.lst');
    if (clip) {
      const c = clip.getBoundingClientRect();
      if (Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top) < r.height - 1) return false;
    }
    return true;
  };
  const cvs = document.querySelector('#hxMap canvas').getBoundingClientRect();
  return {
    ih: innerHeight, iw: innerWidth,
    legend: box(document.querySelector('#hxMap .lg')),
    rows: [...document.querySelectorAll('#hxMap .lst .it')].filter(seen).map(box),
    chips: [...document.querySelectorAll('#hxMap .chips button')].filter(seen).map(box),
    card: [...document.querySelectorAll('#hxLoc button')].filter(seen).map(box),
    canvas: { top: cvs.top, left: cvs.left, bottom: cvs.bottom, right: cvs.right, h: cvs.height },
  };
};
(async () => {
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const bad = [];
  const R = {};
  for (const name of ['iPhone SE', 'iPhone 14']) {
    const dev = (({ defaultBrowserType, ...o }) => o)(pw.devices[name]);
    const page = await (await browser.newContext(dev)).newPage();
    const G = (f, a) => page.evaluate(f, a);
    const wait = (f, ms = 90000) => page.waitForFunction(f, null, { timeout: ms, polling: 200 }).then(() => true).catch(() => false);
    const tag = name.replace(/\s+/g, '');
    try {
      await page.goto(base + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
      if (!await wait(() => window.__frames > 3 && !document.getElementById('loading'))) bad.push(tag + ' boot');
      await G(() => localStorage.clear());
      await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
      if (!await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0)) bad.push(tag + ' land');
      await sleep(300);
      await G(() => { window.SSX.onboard?.skip?.(); window.SSX.hudx.openMap(); });
      if (!await wait(() => document.getElementById('hxMap')?.classList.contains('on'))) bad.push(tag + ' map');
      await sleep(400);
      const m = await G(measure);
      R[tag] = { ih: m.ih, legend: m.legend.t, rows: m.rows.length, chips: m.chips.map(c => c.t), canvasH: Math.round(m.canvas.h) };
      const white = c => c === 'rgb(255, 255, 255)';
      const dark = c => c === 'rgb(0, 0, 0)';
      if (!(m.legend && m.legend.h >= 44 && m.legend.fs >= 15 && white(m.legend.color) && dark(m.legend.bg) && /Drag to move/.test(m.legend.t) && /You/.test(m.legend.t) && /Objective/.test(m.legend.t) && /Shop/.test(m.legend.t))) bad.push(tag + ' legend');
      if (!(m.ih - m.legend.bottom >= 12 && onScreen(m.legend, m.ih, m.iw))) bad.push(tag + ' legend-safe');
      if (!(m.rows.length >= 1 && m.rows.every(r => r.h >= 44 && r.fs >= 15 && white(r.color) && onScreen(r, m.ih, m.iw)))) bad.push(tag + ' rows');
      if (!(m.chips.length === 5 && m.chips.every(c => c.h >= 44 && c.fs >= 15 && onScreen(c, m.ih, m.iw)))) bad.push(tag + ' chips');
      const bottom = [m.legend, ...m.rows];
      let overlap = false;
      for (let i = 0; i < bottom.length; i++) for (let j = i + 1; j < bottom.length; j++) if (hit(bottom[i], bottom[j])) overlap = true;
      for (const c of m.chips) for (const b of bottom) if (hit(c, b)) overlap = true;
      for (let i = 0; i < m.chips.length; i++) for (let j = i + 1; j < m.chips.length; j++) if (hit(m.chips[i], m.chips[j])) overlap = true;
      if (bottom.some(b => hit(b, m.canvas)) || m.chips.some(c => hit(c, m.canvas))) overlap = true;
      if (overlap) bad.push(tag + ' overlap');
      if (!(m.canvas.h >= 100)) bad.push(tag + ' map');
      await G(() => window.__hxMapDebug.openCard());
      await sleep(200);
      const c = await G(measure);
      const shown = c.card.filter(b => /Fly ship here|Set waypoint|More/.test(b.t));
      R[tag].card = shown.map(b => b.t);
      if (!(shown.length === 3 && shown.every(b => b.h >= 44 && b.fs >= 15 && white(b.color) && onScreen(b, c.ih, c.iw) && !hit(b, c.canvas) && (c.legend.h < 2 || !hit(b, c.legend))))) bad.push(tag + ' card');
      const low = Math.max(...shown.map(b => b.bottom));
      if (!(c.ih - low >= 12 && shown.every(b => !hit(b, c.canvas)))) bad.push(tag + ' card-safe');
      await G(() => document.getElementById('hxLocMore').click());
      await sleep(100);
      const extra = await G(measure);
      const more = extra.card.filter(b => /Beam there|Close/.test(b.t));
      R[tag].more = more.map(b => Math.round(b.h));
      if (!(more.length === 2 && more.every(b => b.h >= 44 && b.fs >= 15 && white(b.color) && onScreen(b, extra.ih, extra.iw) && !hit(b, extra.canvas)))) bad.push(tag + ' more');
      if (more.length === 2 && hit(more[0], more[1])) bad.push(tag + ' more-overlap');
    } catch (e) { bad.push(tag + ' throw'); R[tag + 'err'] = String(e.stack || e).slice(0, 400); }
    await page.close();
  }
  console.log(JSON.stringify({ R, bad }, null, 2));
  await browser.close();
  if (bad.length) { console.log('FAILED ' + bad.join(', ')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
