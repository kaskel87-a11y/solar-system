// Foul-mouthed Mars locals (mars/mouth.js) on an iPhone: a foul colonist in Red Tape Flats greets you when you walk up
// in view (head-anchored bubble, clear of the HUD), insults you when you walk into them, no spam (cooldowns), the 📯 horn while
// driving gets a honk insult downtown, text-to-speech stays off when muted, the phone NPC cap holds, no errors.
// SHOTS_DIR=$PWD/.shots/mouth BASE=http://127.0.0.1:8871/ BR=webkit node tests/test-mouth.js   (one browser at a time)
const { chromium, webkit, devices } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8871/', BR = process.env.BR || 'webkit';
const out = (process.env.SHOTS_DIR || require('path').join(__dirname, '..', '.shots', 'mouth')) + '/';
const fs = require('fs'); try { fs.mkdirSync(out, { recursive: true }); } catch (e) {}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await (BR === 'webkit' ? webkit : chromium).launch({ args: BR === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const { defaultBrowserType, ...dev } = devices['iPhone 14'];
  const ctx = await browser.newContext({ ...dev, viewport: { width: 393, height: 852 } }); const page = await ctx.newPage();
  const R = { br: BR }, bad = [], errs = [];
  const ok = (k, v, cond) => { if (cond === undefined) cond = !!v; R[k] = v ?? !!cond; if (!cond) bad.push(k); };
  page.on('pageerror', e => errs.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /\[mouth\]/.test(m.text()))) errs.push(m.text().slice(0, 200)); });
  const G = (f, a) => page.evaluate(f, a);
  const wait = async (f, ms = 30000, a) => { try { await page.waitForFunction(f, a, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
  const shot = async s => { const f = `${out}mouth-393x852-${BR}-${s}.png`; await page.screenshot({ path: f, timeout: 15000 }); return f; };
  // a live foul colonist in a zone: index + position
  const foulIn = zone => G(z => { const ps = window.__app.surface.world.debug.people(); return window.SSX.mouth.foul().map(i => ({ i, ...ps[i] })).filter(p => p.zone === z && p.on !== false)[0] || null; }, zone);
  const npc = i => G(i => window.__app.surface.world.debug.people()[i], i);
  // stand `dist` m from NPC i (on the side `ang`), facing them; the camera trails behind
  const faceFrom = (i, dist, ang) => G(([i, dist, ang]) => { const s = window.__app.surface, p = s.world.debug.people()[i]; const x = p.x + Math.cos(ang) * dist, z = p.z + Math.sin(ang) * dist; s.debugPlace(x, z, Math.atan2(x - p.x, z - p.z)); return { x, z }; }, [i, dist, ang]); // yaw: stick-forward walks toward -sin/-cos
  try {
    await page.goto(base, { timeout: 180000 });
    await wait(() => window.__frames > 3 && !document.getElementById('loading'), 180000);
    ok('api', await wait(() => !!window.SSX?.mouth && typeof window.SSX.registerBarks === 'function', 30000));
    await G(() => window.__app.landOn(window.__app.bodies.find(b => b.name === 'Mars').mesh));
    ok('landed', await wait(() => window.__app.state.onSurface && !window.__app.state.transitioning && window.__app.surface.info?.intro === 0, 120000));
    await G(() => { window.__app.game?.setAliens?.(false); window.__app.game?.debug?.clear?.(); });
    const lines = await G(() => ({ greet: window.SSX.mouth.core.GREET, insult: window.SSX.mouth.core.INSULT }));
    ok('greetLines', lines.greet.length, lines.greet.length >= 15 && lines.greet.includes("What's up, bitch"));
    // ---- Red Tape Flats ----
    await G(() => { const s = window.__app.surface, d = s.world.districts().find(d => d.id === 'mars-rough'); s.debugPlace(d.x + 18, d.z + 18, 0); });
    await sleep(4000);
    const st0 = await G(() => window.SSX.mouth.state());
    ok('zones', st0.zones.join(), st0.zones.includes('mars-rough') && st0.zones.includes('mars-downtown') && !st0.zones.includes('aj') && !st0.zones.includes('mars-gated'));
    const cap = await G(() => window.__app.surface.world.debug.people().filter(p => p.on !== false).length);
    ok('npcCap', cap, cap <= 12);
    const allColonists = await G(() => { const ps = window.__app.surface.world.debug.people(), M = window.SSX.mouth; return { foul: M.foul().length, col: ps.filter(p => p.kind === 'colonist' && /rough|downtown/.test(p.zone)).length, kinds: [...new Set(M.foul().map(i => ps[i].kind))] }; });
    ok('foulPicked', allColonists, allColonists.foul >= 2 && allColonists.foul <= Math.ceil(allColonists.col / 2) && allColonists.kinds.join() === 'colonist');
    const F = await foulIn('mars-rough'); ok('foulLive', F && F.name, !!F);
    if (!F) throw new Error('no live foul colonist in Red Tape Flats');
    // greeting: walk up in view, ~5 m away; try a few sides till the camera frames them
    let greeted = null;
    for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, -3 * Math.PI / 4]) {
      await faceFrom(F.i, 5.2, ang);
      if (await wait(i => { const l = window.SSX.mouth.state().last; return l && l.type === 'greet' && l.i === i; }, 2500, F.i)) { greeted = await G(() => window.SSX.mouth.state().last); break; }
    }
    ok('greet', greeted && greeted.line, !!greeted && lines.greet.includes(greeted.line));
    await sleep(300);
    const bubble = await G(() => [...document.querySelectorAll('#ssxMouth .ssxMouthBubble')].map(e => ({ t: e.textContent, r: e.getBoundingClientRect().toJSON(), vis: getComputedStyle(e).display !== 'none' && +getComputedStyle(e).opacity > 0.05 })));
    const gb = bubble.find(b => greeted && b.t.includes(greeted.line));
    const hudBottom = await G(() => Math.max(0, ...[...document.querySelectorAll('body *')].filter(e => { const cs = getComputedStyle(e); if (cs.position !== 'fixed' && cs.position !== 'absolute') return false; if (e.closest('#ssxMouth, #ssxBarks, canvas')) return false; const r = e.getBoundingClientRect(); return r.width > 150 && r.height > 14 && r.top < 260 && r.top >= 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.1 && e.getClientRects().length > 0; }).map(e => e.getBoundingClientRect().bottom).filter(b => b < 300)));
    ok('greetBubble', gb && { t: gb.t, top: Math.round(gb.r.top), hudBottom: Math.round(hudBottom) }, !!gb && gb.vis && gb.r.width > 40 && gb.r.left >= 0 && gb.r.right <= 393 && gb.r.top >= hudBottom - 1 && gb.r.bottom <= 852 * 0.66);
    await sleep(250); R.shotGreet = await shot('greet');
    // no spam: hang around in view for 7 s, the same NPC must not greet again
    const n0 = await G(() => window.SSX.mouth.state().said);
    await sleep(7000);
    const st1 = await G(([i]) => { const S = window.SSX.mouth.state(); return { said: S.said, again: S.lines.filter(l => l.i === i && l.type === 'greet').length }; }, [F.i]);
    ok('noSpam', st1, st1.again === 1 && st1.said - n0 <= 2);
    // bump: walk into them (stick forward) from ~2.2 m, facing them
    let bumped = null;
    for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      await faceFrom(F.i, 2.4, ang); await sleep(400);
      await G(() => { window.__app.joy.x = 0; window.__app.joy.y = -1; });
      let hit = false; const tr = [];
      for (let k = 0; k < 18 && !hit; k++) { await sleep(100); const o = await G(i => { const s = window.__app.surface, p = s.world.debug.people()[i], l = window.SSX.mouth.state().last; return { d: +Math.hypot(p.x - s.info.x, p.z - s.info.z).toFixed(2), on: p.on, hit: !!(l && l.type === 'bump' && l.i === i) }; }, F.i); tr.push(o.d + (o.on === false ? 'off' : '')); hit = o.hit; }
      (R.bumpTrace ||= []).push(tr.join(' '));
      await G(() => { window.__app.joy.y = 0; });
      if (hit) { bumped = await G(() => window.SSX.mouth.state().last); break; }
    }
    ok('bump', bumped && bumped.line, !!bumped && lines.insult.bump.includes(bumped.line));
    const bb = await G(l => [...document.querySelectorAll('#ssxMouth .ssxMouthBubble')].some(e => e.textContent.includes(l)), bumped ? bumped.line : '~');
    ok('bumpBubble', bb);
    await sleep(200); R.shotBump = await shot('bump');
    // bump again straight away: cooldown holds
    await faceFrom(F.i, 2.4, 0); await G(() => { window.__app.joy.y = -1; }); await sleep(1500); await G(() => { window.__app.joy.y = 0; });
    const nb = await G(i => window.SSX.mouth.state().lines.filter(l => l.i === i && l.type === 'bump').length, F.i);
    ok('bumpCooldown', nb, nb === 1);
    // ---- Olympus Row: drive in, horn ----
    await G(() => { const s = window.__app.surface, d = s.world.districts().find(d => d.id === 'mars-downtown'); s.debugPlace(d.x + 16, d.z + 16, 0); });
    await sleep(4000);
    const D = await foulIn('mars-downtown'); ok('foulDowntown', D && D.name, !!D);
    ok('hornHiddenOnFoot', await G(() => { const b = document.getElementById('ssxMouthHorn'); return !b || b.style.display === 'none'; }));
    await G(() => { const s = window.__app.surface; s.summonRover(); const i = s.info; s.debugPlace(i.roverX + 3.5, i.roverZ + 2, 0.9); }); await sleep(1200);
    await G(() => window.__app.surface.interact());
    ok('driving', await wait(() => window.__app.surface.info.driving, 6000));
    if (D) {
      const p = await npc(D.i);
      await G(([x, z]) => window.__app.surface.debugMove(x, z, 0), [p.x + 9, p.z]);
      await sleep(900);
      const horn = await G(() => { const b = document.getElementById('ssxMouthHorn'); if (!b || b.style.display === 'none') return null; const r = b.getBoundingClientRect(); const others = [...document.querySelectorAll('button, .tb, [class*="btn"]')].filter(e => e !== b && e.offsetParent && getComputedStyle(e).visibility !== 'hidden').map(e => e.getBoundingClientRect()).filter(o => o.width > 4 && o.right > r.left && o.left < r.right && o.bottom > r.top && o.top < r.bottom); return { r: r.toJSON(), overlaps: others.length }; });
      ok('hornButton', horn, !!horn && horn.overlaps === 0 && horn.r.left >= 0 && horn.r.bottom <= 852);
      const dNow = await G(i => { const s = window.__app.surface, p = s.world.debug.people()[i]; return Math.hypot(p.x - s.info.x, p.z - s.info.z); }, D.i);
      if (horn) await page.tap('#ssxMouthHorn'); else await G(() => window.SSX.mouth.honk());
      const honked = await wait(() => { const l = window.SSX.mouth.state().last; return l && l.type === 'honk'; }, 2500);
      const hl = await G(() => window.SSX.mouth.state().last);
      ok('honk', { d: +dNow.toFixed(1), line: hl && hl.line }, honked && lines.insult.honk.includes(hl.line));
      R.shotHonk = await shot('honk');
    }
    // mute: text-to-speech never speaks while muted (and the module reports sound off)
    await G(() => window.SSX.audio?.mix?.set?.({ mute: true }));
    const m = await G(i => { const M = window.SSX.mouth, s0 = M.state().spoken; let spoke = 0; const sp = window.speechSynthesis, o = sp && sp.speak; if (sp) sp.speak = u => { spoke++; return o.call(sp, u); }; M.say(i, 'greet'); if (sp) sp.speak = o; const S = M.state(); return { soundOn: S.soundOn, spoken: S.spoken - s0, spoke, last: S.last && S.last.spoken }; }, (D || F).i);
    ok('mutedNoTts', m, !m.soundOn && m.spoken === 0 && m.spoke === 0 && m.last === false);
    await G(() => window.SSX.audio?.mix?.set?.({ mute: false }));
    R.tts = await G(() => ({ has: typeof speechSynthesis !== 'undefined', soundOn: window.SSX.mouth.state().soundOn, spoken: window.SSX.mouth.state().spoken }));
    // leaving Mars hides the horn
    R.final = await G(() => { const S = window.SSX.mouth.state(); return { said: S.said, bubbles: S.bubbles, lines: S.lines.map(l => l.type + ': ' + l.line) }; });
    ok('bubbles', R.final.bubbles, R.final.bubbles >= 3);
  } catch (e) { errs.push('TEST ' + e.message); }
  ok('noErrors', errs.length ? errs : 0, errs.length === 0);
  R.bad = bad; console.log(JSON.stringify(R, null, 1));
  await browser.close(); process.exit(bad.length ? 1 : 0);
})();
