// v7.5.44 zoom lock for iOS WebKit (Collin): iOS ignores user-scalable=no, so block pinch, double-tap and
// gesture zoom here. Only preventDefault (never stopPropagation) so joystick + fire multi-touch keeps working.
(function () {
  var st = document.createElement('style');
  st.textContent = 'html,body{touch-action:manipulation!important}canvas{touch-action:none}' +
    'html{-webkit-text-size-adjust:100%;text-size-adjust:100%}input,textarea,select{font-size:max(16px,1em)!important}';
  (document.head || document.documentElement).appendChild(st);
  var opt = { passive: false };
  var pd = function (e) { if (e.cancelable) e.preventDefault(); };
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) { document.addEventListener(t, pd, opt); });
  var isText = function (el) { return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)); };
  document.addEventListener('touchmove', function (e) { if (e.touches.length > 1 || (e.scale && e.scale !== 1)) pd(e); }, opt);
  var last = 0;
  document.addEventListener('touchend', function (e) {
    var now = Date.now();
    if (now - last < 300 && e.touches.length === 0 && !isText(e.target)) pd(e);
    last = now;
  }, opt);
  document.addEventListener('dblclick', function (e) { if (!isText(e.target)) pd(e); }, opt);
})();
