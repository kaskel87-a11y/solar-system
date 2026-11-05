// v7.5.56 m2: driving at the real Red Tape Flats start (live 🏁 Red Tape Run button from danger.js), with the tutorial card,
// a quest line and a toast in #stackR, the stack must end above the #surfBtns column (no overlap with Red Tape Run).
// DEV="iPhone SE" LAND=1 ZOOM=1.25 node tests/test-v7556-redtape.js
const pw=require('playwright');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const base=process.env.BASE||'http://127.0.0.1:8897/',DEV=process.env.DEV||'iPhone SE',Z=+(process.env.ZOOM||1),OUT=process.env.OUT;
(async()=>{const b=await pw.chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const{defaultBrowserType:_,...d}=pw.devices[DEV];let vw=d.viewport.width,vh=d.viewport.height;if(process.env.LAND)[vw,vh]=[vh,vw];
const ctx=await b.newContext({...d,viewport:{width:Math.round(vw/Z),height:Math.round(vh/Z)}});await ctx.addInitScript(()=>{window.__ssxNoKeepAlive=true});
const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,200)));const G=(f,a)=>p.evaluate(f,a);
await p.goto(base+'?storm=0&t='+Date.now());await p.waitForFunction(()=>window.__frames>3&&!document.getElementById('loading'),null,{timeout:120000});
await G(()=>{localStorage.setItem('ssx.adult','1');window.__app.landOn(window.__app.bodies.find(b=>b.name==='Mars').mesh)});
await p.waitForFunction(()=>window.__app.state.onSurface&&!window.__app.state.transitioning&&window.__app.surface.info?.intro===0,null,{timeout:90000});await sleep(1500);
await G(()=>document.getElementById('radioLater')?.click());
const st=await G(async()=>{const m=await import('./pursuit.js');return m.setPieceStart()});
await G(([x,z])=>window.__app.surface.debugPlace(x,z,0),[st.x+6,st.z]);await sleep(1200);
await G(([x,z])=>{const S=window.__app.surface;const vs=(S.world.parkedVehicles()||[]).filter(v=>v.kind!=='magnet_crane'&&!v.owned);vs.sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z));const v=vs[0];v.x=x+2;v.z=z;v.group?.position.set(v.x,v.group.position.y,v.z)},[st.x+6,st.z]);
await sleep(600);await G(()=>window.__app.surface.interact());await sleep(800);await G(()=>window.__app.surface.world.setWanted?.(0));
await G(()=>{const q=document.getElementById('questTrack');q.style.display='block';q.textContent='📜 Quest: walk into the glowing marker by the dome and talk to the fixer';window.__app.toast?.('Fuel low: top up at the Beltway pump before the run',9000)});
await sleep(2500);
const R=await G(()=>{const rt=document.getElementById('dzRedTape'),sr=document.getElementById('stackR');const a=rt.getBoundingClientRect(),c=sr.getBoundingClientRect();
 const btns=[...document.querySelectorAll('#surfBtns > *')].filter(e=>e.getBoundingClientRect().width>4&&getComputedStyle(e).display!=='none');const top=Math.min(...btns.map(e=>e.getBoundingClientRect().top));
 const kids=[...sr.children].filter(e=>e.getBoundingClientRect().height>2).map(e=>e.id);
 const ox=Math.min(a.right,c.right)-Math.max(a.left,c.left),oy=Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top);
 return {vp:[innerWidth,innerHeight],redTape:a.width>4,rtTop:Math.round(a.top),stackBottom:Math.round(c.bottom),btnTop:Math.round(top),overlap:ox>0&&oy>0?Math.round(ox)+'x'+Math.round(oy):0,kids,scroll:[sr.scrollHeight,sr.clientHeight]}});
R.errs=errs;console.log(JSON.stringify(R));if(OUT)await p.screenshot({path:OUT+'redtape-'+DEV.replace(/ /g,'-')+(process.env.LAND?'-land':'')+'-z'+Z+'.png'});
console.log(R.redTape&&!R.overlap&&R.stackBottom<=R.btnTop&&!errs.length?'PASS':'FAIL');await b.close()})().catch(e=>{console.log('CRASH',e);process.exit(1)});
