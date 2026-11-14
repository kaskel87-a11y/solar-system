// One objective line (v7.5.111). The phone shows a single readable line. Moonshine, a payout,
// a tour note and any other notice wait behind ▤ More. Toasts and empire texts stay one at a time.
const css = `
#hxOne{display:none;box-sizing:border-box;max-width:min(100%,320px);padding:6px 12px;border-radius:10px;background:rgba(255,255,255,.9);border:1px solid rgba(0,0,0,.45);color:#111;font:800 16px/1.2 system-ui,sans-serif;pointer-events:none;align-items:center;gap:8px}
body.hxOne #hxOne.on{display:flex}
#hxOne .hxBody{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#hxOne .hxDist{flex:none}
body.hxOne #hxStat{order:-2} body.hxOne #hxOne{order:-1}
body.hxOne.hudx #stackR{max-height:calc(25vh - 62px - var(--sat,0px))!important;overflow:hidden}
body.hxOne #stackR > #radio:not(.hxOffer){display:none!important}
body.hxOne #hxCard :is(.hxTx,.hxHow,#hxJob .l2){display:none!important}
body.hxOne #hxCard.on{background:rgba(255,255,255,.9);color:#111;border:1px solid rgba(0,0,0,.45);text-shadow:none;max-width:min(100%,320px)}
body.hxOne #hxCard.on :is(#hxJob .l1,#questTrack,#questTrack b){color:#111;font:800 16px/1.2 system-ui,sans-serif}
body.hxOne #hxCard.on #questTrack{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-height:22px}
body.hxOne #hxOne.on ~ #hxCard .hxCol{display:none!important}
body.hxOne #hxCard.on ~ #hxWay{display:none!important}
body.hxOne :is(#stillCap,#farmGuide,#f2Cap).on{display:none!important}
body.hxOne.hxBusy #obLine{display:none!important}
body.hxOne #empPing,body.hxOne #dealCard{z-index:40}
body.hxOne #stackR > #toast.on{max-height:34px;min-height:0;padding:4px 44px 4px 10px;background:rgba(255,255,255,.9);color:#111;overflow:hidden}
body.hxOne #toast .ssx-t{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#111;-webkit-line-clamp:1}
body.hxOne #empPing{display:none!important}
#hxMoreP .hxNote{grid-column:1 / -1;background:rgba(255,255,255,.92);color:#111}
`;
const plain = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
function lineOf(t) {
  const dist = t.match(/(\d+(?:\.\d+)?\s*(?:m|km))\s*$/);
  let body = dist ? t.slice(0, dist.index).replace(/[·.\s]+$/, '') : t;
  const sent = body.match(/^[^.!?]{4,}[.!?]/);
  if (sent && sent[0].length < body.length) body = sent[0];
  if (body.length > 48) body = body.slice(0, 46).trim() + '…';
  return { body, dist: dist ? dist[1] : '' };
}
function notes() {
  const out = [];
  const g = document.getElementById('ssxGuide');
  if (g?.classList.contains('on')) { const t = plain(g.dataset.full || g.textContent); if (t.length > 2) out.push({ id: 'guide', pri: 0, text: t }); }
  const card = document.getElementById('hxCard');
  if (card?.classList.contains('on')) { const t = plain(card.innerText).replace(/\b(Quit|Retreat|Stuck\?)\b/g, '').trim(); if (t) out.push({ id: 'card', pri: 1, text: t }); }
  for (const [id, pri] of [['stillCap', 2], ['farmGuide', 3], ['f2Cap', 3]]) {
    const n = document.getElementById(id);
    if (n?.classList.contains('on')) { const t = plain(n.innerText); if (t) out.push({ id, pri, text: t }); }
  }
  const ob = document.getElementById('obLine');
  if (out.length && ob && !ob.hidden) { const t = plain(ob.innerText); if (t) out.push({ id: 'tour', pri: 4, text: t }); }
  const ping = document.getElementById('empPing');
  if (ping?.classList.contains('on')) { const t = plain(ping.innerText).replace(/✕/g, '').trim(); if (t) out.push({ id: 'empire', pri: 5, text: t }); }
  out.sort((a, b) => a.pri - b.pri);
  return out;
}
let el = null, lastKey = '';
function ensure() {
  if (el) return el;
  const st = document.createElement('style'); st.id = 'hxOneCss'; st.textContent = css; document.head.appendChild(st);
  el = document.createElement('div'); el.id = 'hxOne'; el.setAttribute('role', 'status');
  const stack = document.getElementById('stackR'); if (stack) stack.prepend(el);
  return el;
}
function syncMore(extras) {
  const p = document.getElementById('hxMoreP'); if (!p) return;
  const key = extras.map(n => n.text).join('\n');
  if (p.dataset.notes === key) return;
  p.dataset.notes = key;
  for (const b of [...p.querySelectorAll('.hxNote')]) b.remove();
  for (const n of extras) { const b = document.createElement('button'); b.type = 'button'; b.className = 'hxNote show'; b.textContent = n.text; p.appendChild(b); }
}
function tick() {
  const b = document.body;
  const on = b.classList.contains('surface') && !b.classList.contains('cinematic') && !b.classList.contains('pshow');
  b.classList.toggle('hxOne', on);
  const list = on ? notes() : [];
  b.classList.toggle('hxBusy', on && list.some(n => n.pri < 4));
  if (!on) { el?.classList.remove('on'); return; }
  const radio = document.getElementById('radio'), btns = document.getElementById('radioBtns');
  if (radio) radio.classList.toggle('hxOffer', !!(btns && getComputedStyle(btns).display !== 'none' && radio.style.display !== 'none'));
  const box = ensure();
  const cardOn = document.getElementById('hxCard')?.classList.contains('on');
  const guide = list.find(n => n.id === 'guide');
  const top = guide || (cardOn ? null : list[0]);
  const rest = list.filter(n => n !== top && !(cardOn && n.id === 'card'));
  if (top) {
    const t = lineOf(top.text);
    const shown = t.body + (t.dist ? ' ' + t.dist : '');
    if (box.dataset.t !== shown) {
      box.dataset.t = shown;
      box.textContent = '';
      const s = document.createElement('span'); s.className = 'hxBody'; s.textContent = t.body; box.appendChild(s);
      if (t.dist) { const d = document.createElement('b'); d.className = 'hxDist'; d.textContent = t.dist; box.appendChild(d); }
    }
    box.classList.add('on');
  } else box.classList.remove('on');
  const key = rest.map(n => n.text).join('\n');
  if (key !== lastKey) { lastKey = key; syncMore(rest); }
}
function boot() {
  if (!document.getElementById('stackR')) { setTimeout(boot, 300); return; }
  ensure(); setInterval(tick, 200); tick();
}
boot();
