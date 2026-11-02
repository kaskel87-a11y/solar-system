// v7.5.44 zoom lock for iOS WebKit (Collin): iOS ignores user-scalable=no, so block pinch, double-tap and
// gesture zoom here. Only preventDefault (never stopPropagation) so joystick + fire multi-touch keeps working.
(function () {
  var st = document.createElement('style');
  st.textContent = 'html,body{touch-action:manipulation!important}canvas{touch-action:none}' +
    // v7.5.47 fit-to-screen: text-size-adjust is !important so Chrome iOS text zoom (inline style on html/body) can't inflate
    // px-sized HUD text; html/body pinned to the layout viewport so nothing can widen or scroll the page.
    'html,body{-webkit-text-size-adjust:100%!important;text-size-adjust:100%!important;overflow:hidden!important;' +
    'position:fixed!important;left:0;top:0;width:100%!important;height:100%!important;max-width:100vw;margin:0}' +
    'input,textarea,select{font-size:max(16px,1em)!important}' +
    'body.ssx-vvfit{transform-origin:0 0!important;will-change:transform}' +
    'body.ssx-vvfit>canvas.ssx-main{width:100%!important;height:100%!important}';
  (document.head || document.documentElement).appendChild(st);
  var opt = { passive: false }, vv = window.visualViewport;
  // zoomed in (iOS restores the old pinch scale + scroll on reload, or an auto-zoom slipped through): let a pinch through
  // so you can always zoom back out, and never block touches while zoomed.
  var zoomed = function () { return !!(vv && vv.scale > 1.01); };
  var pd = function (e) { if (e.cancelable) e.preventDefault(); };
  var pdg = function (e) { if (!zoomed()) pd(e); };
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) { document.addEventListener(t, pdg, opt); });
  var isText = function (el) { return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)); };
  document.addEventListener('touchmove', function (e) { if (zoomed()) return; if (e.touches.length > 1 || (e.scale && e.scale !== 1)) pd(e); }, opt);
  var last = 0;
  document.addEventListener('touchend', function (e) {
    var now = Date.now();
    if (now - last < 300 && e.touches.length === 0 && !isText(e.target)) pd(e);
    last = now;
  }, opt);
  document.addEventListener('dblclick', function (e) { if (!isText(e.target)) pd(e); }, opt);

  // v7.5.47 always fit the visible screen (Collin: buttons cut off on iPhone even after a reload).
  try { history.scrollRestoration = 'manual'; } catch (e) {}
  var noKick = function () { return !!window.SSX_FIT_NOKICK; }, meta = function () { return document.querySelector('meta[name=viewport]'); };
  var VP = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
  var kicks = 0, kickT = 0, raf = 0;
  function kick() { // iOS re-applies initial-scale when the viewport meta changes: nudges a stuck zoom back to 1
    var m = meta(); if (!m || noKick() || kicks > 6 || Date.now() - kickT < 400) return; kicks++; kickT = Date.now();
    m.setAttribute('content', VP.replace('initial-scale=1', 'initial-scale=1.0001'));
    setTimeout(function () { m.setAttribute('content', VP); }, 30);
  }
  function fit() {
    raf = 0; var b = document.body; if (!b) return;
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    var de = document.documentElement; if (de.scrollLeft || de.scrollTop) { de.scrollLeft = 0; de.scrollTop = 0; }
    if (b.scrollLeft || b.scrollTop) { b.scrollLeft = 0; b.scrollTop = 0; }
    var s = vv ? vv.scale : 1;
    if (s > 1.01) {
      kick();
      // still zoomed: draw the whole game inside what you can actually see (fixed children use body as their box)
      b.classList.add('ssx-vvfit');
      b.style.transform = 'translate(' + (vv.offsetLeft || 0).toFixed(1) + 'px,' + (vv.offsetTop || 0).toFixed(1) + 'px) scale(' + (1 / s).toFixed(4) + ')';
    } else if (b.classList.contains('ssx-vvfit')) { b.classList.remove('ssx-vvfit'); b.style.transform = ''; kicks = 0; }
    sizeChanged();
  }
  var q = function () { if (!raf) raf = requestAnimationFrame(fit); };
  // v7.5.48: iOS reports innerWidth/innerHeight as the *visible* (zoomed) size, so while zoomed the renderer was sized
  // ~1/scale too small and the shrink-to-fit left black strips right + bottom. While the fit is on, innerWidth/innerHeight
  // answer the real box the game is drawn in (the layout viewport = body), so renderer, camera aspect and HUD maths all
  // fill the screen edge to edge. At 1x the browser's own values are returned untouched.
  var de0 = document.documentElement;
  function nativeGetter(k) { for (var o = window; o; o = Object.getPrototypeOf(o)) { var d = Object.getOwnPropertyDescriptor(o, k); if (d) return d.get ? function () { return d.get.call(window); } : (d.value !== undefined ? function () { return d.value; } : null); } return null; }
  var nW = nativeGetter('innerWidth'), nH = nativeGetter('innerHeight');
  var boxW = function () { return Math.round(de0.clientWidth || (nW && nW()) || 0); }, boxH = function () { return Math.round(de0.clientHeight || (nH && nH()) || 0); };
  var fitted = function () { return !!(document.body && document.body.classList.contains('ssx-vvfit')); };
  if (nW && nH) try {
    Object.defineProperty(window, 'innerWidth', { configurable: true, get: function () { return fitted() ? boxW() : nW(); }, set: function () {} });
    Object.defineProperty(window, 'innerHeight', { configurable: true, get: function () { return fitted() ? boxH() : nH(); }, set: function () {} });
  } catch (e) {}
  var lastKey = '';
  function sizeChanged() { // tell the renderer (index.html onResize, surface, HUD fitters) whenever the drawn box changes
    var k = innerWidth + 'x' + innerHeight + (fitted() ? 'f' : ''); if (k === lastKey) return; var first = !lastKey; lastKey = k;
    if (!first) try { window.dispatchEvent(new Event('resize')); } catch (e) {}
  }
  window.SSX_FIT = { fit: fit, zoomed: zoomed, fitted: fitted, box: function () { return { w: innerWidth, h: innerHeight }; } };
  if (vv) { vv.addEventListener('resize', q); vv.addEventListener('scroll', q); }
  addEventListener('resize', q); addEventListener('scroll', q, true);
  addEventListener('orientationchange', function () { q(); setTimeout(q, 300); setTimeout(q, 800); });
  addEventListener('pageshow', q); addEventListener('load', q);
  document.addEventListener('focusout', function (e) { if (isText(e.target)) { setTimeout(q, 60); setTimeout(q, 400); } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', q); else q();
  setInterval(function () { if (zoomed() || window.scrollX || window.scrollY) q(); }, 1000);
})();
