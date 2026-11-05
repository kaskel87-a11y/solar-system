// v7.5.53 M1: steal a world car, DRIVE it onto the Red Line lot, the ctx button must read "💸 Fence ride", tap it -> paid, car gone.
const pw=require('playwright');
const base=process.env.BASE||'http://127.0.0.1:8897/',DEV=process.env.DEV||'iPhone 15',OUT=process.env.OUT,sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await pw.chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const desk=DEV==='desktop';const{defaultBrowserType:_,...d}=desk?{}:pw.devices[DEV];const ctx=await b.newContext(desk?{viewport:{width:1440,height:900}}:d);await ctx.addInitScript(k=>{window.__ssxNoKeepAlive=true;window.__fenceKind=k},process.env.FKIND||'');
const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
const G=(f,a)=>p.evaluate(f,a),W=(f,ms=180000)=>p.waitForFunction(f,null,{timeout:ms,polling:200});
await p.goto(base+'?storm=0&t='+Date.now(),{timeout:180000});await W(()=>window.__frames>3&&!document.getElementById('loading'));
await G(()=>{localStorage.setItem('ssx.adult','1');localStorage.setItem('ssx.onboard.v1','{"v":1,"status":"done","done":true,"skipped":true}');window.__app.landOn(window.__app.bodies.find(b=>b.name==='Mars').mesh)});
await W(()=>window.__app.state.onSurface&&!window.__app.state.transitioning&&window.__app.surface.info?.intro===0);await sleep(1500);
await G(()=>{try{window.SSX.onboard?.skip?.()}catch(e){}});await W(()=>!!window.__dealer,30000);
const R={};
const lot=await G(()=>{const d=window.__dealer.lotCenter;if(!window.__dealer.lotCenter.on(d))throw new Error('lot centre math');return {x:d.x,z:d.z}});
// start 30 m off the lot, pull the nearest unowned parked car next to us, take it
const start=process.env.TELE?{x:lot.x,z:lot.z}:{x:lot.x-30,z:lot.z};
await G(([x,z])=>window.__app.surface.debugPlace(x,z,0),[start.x,start.z]);await sleep(1200);
R.steal=await G(([x,z])=>{const S=window.__app.surface;const vs=(S.world.parkedVehicles()||[]).filter(v=>v.kind!=='rover'&&v.kind!=='magnet_crane'&&!v.owned&&(!window.__fenceKind||v.kind===window.__fenceKind||(window.__fenceKind==='!hover'&&!/hover/.test(v.kind))));vs.sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z));const v=vs[0];if(!v)return null;v.x=x+3;v.z=z;v.group?.position.set(v.x,v.group.position.y,v.z);return v.kind},[start.x,start.z]);
await sleep(800);await G(()=>window.__app.surface.interact());await sleep(1200);
R.veh=await G(()=>{window.SSX_TICKS.push((dt,tc)=>{window.__tc=tc});return true});await W(()=>!!window.__tc,20000);R.veh=await G(()=>window.__tc.car?{kind:window.__tc.car.kind,stolen:window.__tc.car!==window.__tc.rover}:null);
await G(()=>window.__app.surface.world.setWanted?.(0));
// drive: hold W, steer the car's nose at the lot each 100 ms, stop on the lot
await p.keyboard.down('KeyW');let on=false;
for(let i=0;i<200&&!on;i++){on=await G(([lx,lz])=>{const c=window.__tc.car;if(!c)return 'nocar';const dx=lx-c.x,dz=lz-c.z;c.yaw=Math.atan2(-dx,-dz);return Math.hypot(dx,dz)<5},[lot.x,lot.z]);if(on==='nocar')break;await sleep(100);}
await p.keyboard.up('KeyW');
// brake to a stop (a hover bike glides), then creep back if it slid off the lot
const spd=()=>G(()=>Math.abs(window.__tc.car?.speed||0)),dl=()=>G(([lx,lz])=>{const c=window.__tc.car;return Math.hypot(lx-c.x,lz-c.z)},[lot.x,lot.z]);
for(let k=0;k<4;k++){await p.keyboard.down('KeyS');for(let i=0;i<40&&await spd()>0.4;i++)await sleep(100);await p.keyboard.up('KeyS');await sleep(300);
 if(await dl()<6)break;await p.keyboard.down('KeyW');for(let i=0;i<60&&await dl()>=3;i++){await G(([lx,lz])=>{const c=window.__tc.car;c.yaw=Math.atan2(-(lx-c.x),-(lz-c.z))},[lot.x,lot.z]);await sleep(60);}await p.keyboard.up('KeyW');}
R.dist=Math.round(await dl());
R.reached=on;await G(()=>window.__app.surface.world.setWanted?.(0));await sleep(1500);
R.samp=await G(async()=>{const o=[];for(let i=0;i<30;i++){const b=document.getElementById('dlrCtxBtn');o.push(b.style.display==='none'?'-':'F');await new Promise(r=>setTimeout(r,100))}return o.join('')});R.why=await G(()=>window.__dealer.ctxWhy);R.lbl=await G(()=>document.getElementById('dlrCtxBtn')?.textContent.trim());
if(OUT)await p.screenshot({path:OUT+'fence-ride-'+DEV.replace(/ /g,'-')+'.png'});
const cr0=await G(()=>window.__app.game.progress.credits),n0=await G(()=>window.__app.surface.world.parkedVehicles().length);
const bb=await G(()=>{const r=document.getElementById('dlrCtxBtn')?.getBoundingClientRect();return r&&r.width?[r.x+r.width/2,r.y+r.height/2]:null});
R.hit=bb&&await G(([x,y])=>{const e=document.elementFromPoint(x,y);return e&&(e.id||e.className)},bb);R.rect=await G(()=>{const e=document.getElementById('dlrCtxBtn');const r=e.getBoundingClientRect();let q=e.parentElement,h=[];while(q&&q!==document.body){const cs=getComputedStyle(q);if(cs.display==='none'||cs.visibility==='hidden')h.push(q.id||q.tagName);q=q.parentElement}return [Math.round(r.width),Math.round(r.height),h.join(','),document.body.className.slice(0,200)]});
if(desk){if(process.env.KEY){await G(r=>{window.__dealerNoCapture=r==='index';window.__dealer.lastKey=null},process.env.ROUTE||'index');await p.keyboard.press(process.env.KEY);R.keyRoute=await G(()=>window.__dealer.lastKey);}else if(bb)await p.mouse.click(bb[0],bb[1]);}else if(bb)await p.touchscreen.tap(bb[0],bb[1]);await sleep(1500);
R.cr=[cr0,await G(()=>window.__app.game.progress.credits)];R.veh2=await G(()=>window.__tc.car?.kind||null);R.toast=await G(()=>document.getElementById('toast')?.textContent.slice(0,120));
R.errs=errs;console.log(JSON.stringify(R));
console.log(/Fence ride/.test(R.lbl||'')&&R.cr[1]>R.cr[0]&&!R.veh2&&!errs.length&&(!(desk&&process.env.KEY)||R.keyRoute===(process.env.ROUTE||'index'))?'PASS':'FAIL');await b.close()})().catch(e=>{console.log('CRASH',e);process.exit(1)});
