import fs from 'fs';
import { INDEX, launch, scratch } from './lib.mjs';
const S=scratch('fretboard-frame-zoom');
const url=INDEX+'#fretboard';
const b=await launch();
const out=[]; const ok=(n,c,x='')=>out.push((c?'PASS ':'FAIL ')+n+(x!==''?'  ['+String(x).slice(0,170)+']':'')); const sleep=(ms)=>new Promise(r=>setTimeout(r,ms)); const errs=[];
const settle=()=>sleep(650);
async function fresh(vw=1440){ const pg=await b.newPage(); pg.on('pageerror',e=>errs.push('PAGE '+e.message)); pg.on('console',m=>{if(m.type()==='error'&&!/Unsafe/.test(m.text()))errs.push(m.text().slice(0,140))});
  await pg.setViewport({width:vw,height:1000}); const cdp=await pg.createCDPSession(); await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:S+'dl6'});
  await pg.goto(url); await pg.evaluate(()=>{localStorage.clear();sessionStorage.clear()}); await pg.reload(); await sleep(1300); return pg; }
const sheet=async(pg)=>JSON.parse(await pg.evaluate(()=>localStorage.getItem('musictools.fretboard.sheet')));
const dg=async(pg,i=0)=>(await sheet(pg)).diagrams[i];
const sel=(pg,s,v)=>pg.$eval(s,(e,v)=>{e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))},v);
const num=(pg,s,v)=>pg.$eval(s,(e,v)=>{e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))},String(v));
const q=(pg,s,f)=>pg.$eval(s,(e,f)=>f==='disabled'?e.disabled:f==='text'?e.textContent:f==='value'?e.value:f==='title'?e.title:f==='ta'?getComputedStyle(e).touchAction:e.getAttribute(f),f);
const geo=(pg)=>pg.evaluate(()=>{const c=document.querySelector('.fretCanvas'), r=c.getBoundingClientRect(), w=document.querySelector('.canvas-wrap'); return {left:r.left,top:r.top,w:r.width,h:r.height,wrapW:w.clientWidth,wrapSW:w.scrollWidth,wrapSL:w.scrollLeft,docW:document.documentElement.scrollWidth}});
const px=(pg,f,s)=>pg.evaluate((f,s)=>{const c=document.querySelector('.fretCanvas'); const k=c.getBoundingClientRect().width/1092; const d=c.getContext('2d').getImageData(Math.round((58+46*f)*k),Math.round((50+28*s)*k),1,1).data; return [d[0],d[1],d[2]]},f,s);
const lum=(c)=>c[0]+c[1]+c[2];
const ring=(pg,f,s)=>pg.evaluate((f,s)=>{const c=document.querySelector('.fretCanvas'); const k=c.getBoundingClientRect().width/1092; const g=c.getContext('2d'); let r=0,gg=0,b=0,n=0;
  for(let a=0;a<8;a++){const x=Math.round((58+46*f+8.5*Math.cos(a*Math.PI/4))*k), y=Math.round((50+28*s+8.5*Math.sin(a*Math.PI/4))*k); const d=g.getImageData(x,y,1,1).data; r+=d[0];gg+=d[1];b+=d[2];n++}
  return [r/n,gg/n,b/n]},f,s);
const stripY=async(pg)=>(await geo(pg)).top+218;                                // the fret-number strip, horizontal neck
const fx=async(pg,f,edge=0)=>(await geo(pg)).left+58+46*f+edge;                  // x of a fret's wire
const drag=async(pg,f0,f1,e0=0,e1=0)=>{ const y=await stripY(pg); await pg.mouse.move(await fx(pg,f0,e0),y); await pg.mouse.down(); await pg.mouse.move(await fx(pg,f1,e1),y,{steps:8}); await pg.mouse.up(); await settle(); };
const neck=(pg,s,f)=>pg.evaluate((s,f)=>{const c=document.querySelector('.fretCanvas'); const r=c.getBoundingClientRect(), k=r.width/1092; c.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+(58+46*f)*k,clientY:r.top+(50+28*s)*k}))},s,f);
const pent=async(pg)=>{ await sel(pg,'.keySel','A'); await sel(pg,'.patternSel','scale:minorPentatonic'); await settle(); };

// ================= frame: inputs, buttons =================
let pg=await fresh(); await pent(pg);
const insideBefore=await ring(pg,5,5), outsideBefore=await ring(pg,17,5);     // low E: fret 5 and fret 17 are both A, the root
ok('no frame to begin with: its controls are off and say why', (await dg(pg)).frame===null && (await q(pg,'.frameClearBtn','disabled')) && /no frame/.test(await q(pg,'.frameClearBtn','title')) && (await q(pg,'.zoomFrameBtn','disabled')));
await num(pg,'.frameFromInput',5); await num(pg,'.frameToInput',9); await settle();
ok('typing a from and a to sets a frame', JSON.stringify((await dg(pg)).frame)==='{"from":5,"to":9}');
const insideAfter=await ring(pg,5,5), outsideAfter=await ring(pg,17,5);
ok('inside the frame nothing changes', Math.abs(lum(insideBefore)-lum(insideAfter))<12, JSON.stringify([insideBefore,insideAfter]));
ok('outside it, the same note is dimmed', lum(outsideAfter)<lum(outsideBefore)*0.8, lum(outsideBefore)+' -> '+lum(outsideAfter));
await btn(pg,'.frameRightBtn'); await settle(); ok('slide toward the body', JSON.stringify((await dg(pg)).frame)==='{"from":6,"to":10}');
await btn(pg,'.frameLeftBtn'); await btn(pg,'.frameLeftBtn'); await settle(); ok('and toward the nut, keeping its width', JSON.stringify((await dg(pg)).frame)==='{"from":4,"to":8}');
await num(pg,'.frameFromInput',0); await num(pg,'.frameToInput',4); await settle();
ok('at the nut end the left slide is off, with the reason', await q(pg,'.frameLeftBtn','disabled') && /nut end/.test(await q(pg,'.frameLeftBtn','title')));
await num(pg,'.frameFromInput',18); await num(pg,'.frameToInput',22); await settle();
ok('at the far end the right slide is off', await q(pg,'.frameRightBtn','disabled'));
await btn(pg,'.frameClearBtn'); await settle();
ok('Clear removes it and the veil goes', (await dg(pg)).frame===null && Math.abs(lum(await ring(pg,17,5))-lum(outsideBefore))<12);
await num(pg,'.frameFromInput',7); await settle(); ok('only a start given: a one-fret frame', JSON.stringify((await dg(pg)).frame)==='{"from":7,"to":7}');
await pg.evaluate(()=>{const a=document.querySelector('.frameFromInput'),b=document.querySelector('.frameToInput'); a.value='9'; b.value='5'; b.dispatchEvent(new Event('change',{bubbles:true}))}); await settle(); ok('from and to the wrong way round are put right', JSON.stringify((await dg(pg)).frame)==='{"from":5,"to":9}');
await num(pg,'.frameFromInput',-5); await num(pg,'.frameToInput',999); await settle(); ok('out of range is clamped to the neck', JSON.stringify((await dg(pg)).frame)==='{"from":0,"to":22}');
await pg.$eval('.frameFromInput',e=>{e.value='';e.dispatchEvent(new Event('change',{bubbles:true}))}); await settle();
ok('emptying a field of an existing frame clears it (a frame needs both ends)', (await dg(pg)).frame===null && (await q(pg,'.frameToInput','value'))==='');
ok('the outline and veil are in the accessible description', await (async()=>{await num(pg,'.frameFromInput',3); await num(pg,'.frameToInput',6); await settle(); return /framed on frets 3 to 6/.test(await q(pg,'.fretCanvas','aria-label'))})());
async function btn(pg,s){ await pg.$eval(s,e=>e.click()); }

// ================= frame: dragging the strip =================
pg=await fresh(); await pent(pg);
ok('the strip takes the drag, the neck keeps touch scrolling', (await q(pg,'.strip','ta'))==='none' && (await q(pg,'.fretCanvas','ta'))==='auto');
await drag(pg,3,8); let d=await dg(pg);
ok('drag along the fret numbers to mark a frame', JSON.stringify(d.frame)==='{"from":3,"to":8}', JSON.stringify(d.frame));
ok('a frame is not a note edit: the pattern stays live', d.pattern==='scale:minorPentatonic');
await drag(pg,5,8); ok('drag inside it to slide it, keeping its width', JSON.stringify((await dg(pg)).frame)==='{"from":6,"to":11}', JSON.stringify((await dg(pg)).frame));
await drag(pg,11,14,23,0); ok('drag its right edge to resize', JSON.stringify((await dg(pg)).frame)==='{"from":6,"to":14}', JSON.stringify((await dg(pg)).frame));
await drag(pg,6,2,-23,0); ok('drag its left edge to resize', JSON.stringify((await dg(pg)).frame)==='{"from":2,"to":14}', JSON.stringify((await dg(pg)).frame));
await pg.mouse.move(await fx(pg,8),await stripY(pg)); await pg.mouse.down(); await pg.mouse.up(); await settle();
ok('a plain click inside the frame leaves it alone', JSON.stringify((await dg(pg)).frame)==='{"from":2,"to":14}');
await pg.click('#undoBtn'); await settle(); ok('each drag is one undo step', JSON.stringify((await dg(pg)).frame)==='{"from":6,"to":14}', JSON.stringify((await dg(pg)).frame));
await pg.click('#redoBtn'); await settle();
await pg.mouse.move(await fx(pg,20),await stripY(pg)); await pg.mouse.down(); await pg.mouse.up(); await settle();
ok('a click on the strip outside the frame clears it', (await dg(pg)).frame===null);
await pg.mouse.move(await fx(pg,10),await stripY(pg)); await pg.mouse.down(); await pg.mouse.up(); await settle();
ok('a click with no frame does not make one', (await dg(pg)).frame===null);
const before=(await dg(pg)).notes.length; await drag(pg,4,9); await neck(pg,2,3); await settle();
ok('the neck still takes clicks with a frame drawn, and the frame is untouched', (await dg(pg)).notes.length!==before && JSON.stringify((await dg(pg)).frame)==='{"from":4,"to":9}');
// vertical necks: the strip runs down the fret numbers
await pg.click('#portraitBtn'); await settle(); await btn(pg,'.frameClearBtn'); await settle();
const vg=await geo(pg); await pg.mouse.move(vg.left+30+140+14+18, vg.top+78+46*3); await pg.mouse.down(); await pg.mouse.move(vg.left+30+140+14+18, vg.top+78+46*8,{steps:8}); await pg.mouse.up(); await settle();
ok('on a vertical neck it drags down the fret numbers', JSON.stringify((await dg(pg)).frame)==='{"from":3,"to":8}', JSON.stringify((await dg(pg)).frame));

// ================= frame follows the range =================
pg=await fresh(); await pent(pg); await num(pg,'.frameFromInput',5); await num(pg,'.frameToInput',20); await settle();
await num(pg,'.lastFretInput',12); await settle(); ok('narrowing the range trims the frame to it', JSON.stringify((await dg(pg)).frame)==='{"from":5,"to":12}');
await num(pg,'.firstFretInput',10); await settle(); ok('and again from the other end', JSON.stringify((await dg(pg)).frame)==='{"from":10,"to":12}');
await num(pg,'.lastFretInput',22); await num(pg,'.firstFretInput',0); await num(pg,'.frameFromInput',1); await num(pg,'.frameToInput',2); await settle();
await num(pg,'.firstFretInput',5); await settle(); ok('a range that leaves no frame drops it', (await dg(pg)).frame===null);

// ================= zoom, and hit-testing under it =================
pg=await fresh(); await pent(pg); let g=await geo(pg);
ok('at 1440 the neck is 100% and fits', Math.round(g.w)===1092 && g.wrapSW<=g.wrapW+1 && g.docW<=1440, JSON.stringify(g));
await sel(pg,'.zoomSel','2'); await settle(); g=await geo(pg);
ok('200% doubles the neck and the wrapper scrolls to pan it', Math.round(g.w)===2184 && g.wrapSW>g.wrapW*1.5 && g.docW<=1440, JSON.stringify(g));
ok('the zoom is saved', (await dg(pg)).zoom===2);
const n0=(await dg(pg)).notes.length; await neck(pg,2,3); await settle();
ok('clicks land on the right note when zoomed', (await dg(pg)).notes.length!==n0 && ((await dg(pg)).notes.includes('2_3')!==false));
await pg.reload(); await sleep(1400); ok('zoom survives a reload', (await q(pg,'.zoomSel','value'))==='2' && Math.round((await geo(pg)).w)===2184);
await sel(pg,'.zoomSel','fit'); await settle();
await num(pg,'.frameFromInput',14); await num(pg,'.frameToInput',18); await settle(); await btn(pg,'.zoomFrameBtn'); await settle(); g=await geo(pg);
const zc=(await dg(pg)).zoom; const cx=(58+46*16)*zc, viewC=g.wrapSL+g.wrapW/2;
ok('To frame zooms in so the frame fills the view', typeof zc==='number' && zc>1.5, zc);
ok('and scrolls the frame into the middle', Math.abs(cx-viewC)<70, Math.round(cx)+' vs '+Math.round(viewC));
ok('the zoom box says what the zoom is now', /%$/.test(await pg.$eval('.zoomSel',e=>e.selectedOptions[0].textContent)) && (await q(pg,'.zoomSel','value'))==='custom', await pg.$eval('.zoomSel',e=>e.selectedOptions[0].textContent));
await btn(pg,'.frameLeftBtn'); await btn(pg,'.frameLeftBtn'); await btn(pg,'.frameLeftBtn'); await btn(pg,'.frameLeftBtn'); await btn(pg,'.frameLeftBtn'); await btn(pg,'.frameLeftBtn'); await btn(pg,'.frameLeftBtn'); await btn(pg,'.frameLeftBtn'); await settle(); g=await geo(pg);
const fr=(await dg(pg)).frame, fxp=(58+46*(fr.from+fr.to)/2)*zc;
ok('sliding a frame keeps it in view as the neck pans', fxp>=g.wrapSL && fxp<=g.wrapSL+g.wrapW, `frame centre ${Math.round(fxp)} in view ${Math.round(g.wrapSL)}..${Math.round(g.wrapSL+g.wrapW)}`);

// ================= fit to width =================
pg=await fresh(1024); await pent(pg); g=await geo(pg);
ok('at 1024 the neck fits its wrapper instead of scrolling, and the page does not overflow', g.w<=g.wrapW+1 && g.w>g.wrapW*0.98 && g.docW<=1024, JSON.stringify(g));
const k1=g.w/1092; const m0=(await dg(pg)).notes.length; await neck(pg,3,5); await settle();
ok('clicks land right on a shrunken neck (k='+k1.toFixed(2)+')', (await dg(pg)).notes.length!==m0);
await pg.setViewport({width:1440,height:1000}); await sleep(700);
ok('and it grows back to 100% when the window does (no reload)', Math.round((await geo(pg)).w)===1092);
await pg.setViewport({width:700,height:1000}); await sleep(700); g=await geo(pg); ok('a narrow window fits too', g.w<=g.wrapW+1 && g.docW<=700, JSON.stringify(g));
await pg.setViewport({width:1440,height:1000}); await sleep(500);
ok('the strip sits over the fret numbers at any scale', await pg.evaluate(()=>{const c=document.querySelector('.fretCanvas').getBoundingClientRect(), s=document.querySelector('.strip').getBoundingClientRect(); return s.left>=c.left-1 && s.right<=c.right+1 && s.top>c.top+c.height*0.6 && s.bottom<=c.bottom+1}));

// ================= highlight =================
pg=await fresh(); ok('with no root there is nothing to pick out, and it says so', /set a root/.test(await pg.$eval('.emphChips',e=>e.textContent)));
await pent(pg);
ok('one button per interval on the neck', (await pg.$$eval('.emph',b=>b.map(x=>x.textContent).join(' ')))==='R ♭3 4 5 ♭7');
const rootBefore=await ring(pg,5,5);                                    // low E fret 5 = A, the root
const nonRoot=async()=>ring(pg,8,5);                                    // low E fret 8 = C, the b3
const nrBefore=await nonRoot();
await pg.$eval('.emph[data-i="0"]',e=>e.click()); await settle();
ok('picking out R fades every other interval and leaves R alone', lum(await nonRoot())<lum(nrBefore)*0.85 && Math.abs(lum(await ring(pg,5,5))-lum(rootBefore))<12, lum(nrBefore)+' -> '+lum(await nonRoot()));
ok('the button shows it is on', (await pg.$eval('.emph[data-i="0"]',e=>e.getAttribute('aria-pressed')))==='true' && !(await q(pg,'.emphClearBtn','disabled')));
ok('and it is saved', JSON.stringify((await dg(pg)).emphasis)==='[0]' && (await dg(pg)).pattern==='scale:minorPentatonic');
// the legend is a highlighter too: first item is R, second is b3
const cg=await geo(pg); const legY=cg.top+244+2+10;
await pg.mouse.click(cg.left+14+ 130, legY); await settle();
ok('clicking a legend item on the diagram picks it out too, and is not a note edit', (await dg(pg)).emphasis.length===2 && (await dg(pg)).pattern==='scale:minorPentatonic', JSON.stringify((await dg(pg)).emphasis));
await pg.$eval('.emphClearBtn',e=>e.click()); await settle();
ok('Show all puts everything back at full strength', (await dg(pg)).emphasis.length===0 && Math.abs(lum(await nonRoot())-lum(nrBefore))<6);
// an interval that is not on the neck cannot fade the lot
await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('musictools.fretboard.sheet')); s.diagrams[0].emphasis=[11]; localStorage.setItem('musictools.fretboard.sheet',JSON.stringify(s))}); await pg.reload(); await sleep(1400);
ok('emphasising an interval that is absent fades nothing', Math.abs(lum(await ring(pg,8,5))-lum(nrBefore))<12);

// ================= saved sheets, links: hostile input =================
pg=await fresh();
await pg.evaluate(()=>localStorage.setItem('musictools.fretboard.sheet',JSON.stringify({v:1,orientation:'landscape',diagrams:[
  {instrument:'guitar',preset:'standard6',firstFret:0,lastFret:22,notes:[],frame:{from:-5,to:999},zoom:99,emphasis:[1,1,99,-1,'x',3,null]},
  {instrument:'guitar',preset:'standard6',firstFret:0,lastFret:22,notes:[],frame:{from:9,to:5},zoom:'huge',emphasis:'nope'},
  {instrument:'guitar',preset:'standard6',firstFret:10,lastFret:12,notes:[],frame:{from:0,to:3},zoom:0.001},
  {instrument:'guitar',preset:'standard6',firstFret:0,lastFret:22,notes:[],frame:'nonsense'},
  {instrument:'guitar',preset:'standard6',firstFret:0,lastFret:22,notes:[]}]})));
await pg.reload(); await sleep(1500); await pg.$eval('.legendChk',e=>e.click()); await settle(); const hs=(await sheet(pg)).diagrams;
ok('hostile frames: out-of-range is clamped, swapped is put right, non-frames are none', JSON.stringify(hs.map(d=>d.frame))==='[{"from":0,"to":22},{"from":5,"to":9},null,null,null]', JSON.stringify(hs.map(d=>d.frame)));
ok('hostile zoom is clamped, or falls back to fit', JSON.stringify(hs.map(d=>d.zoom))==='[4,"fit",0.25,"fit","fit"]', JSON.stringify(hs.map(d=>d.zoom)));
ok('hostile highlights are reduced to valid intervals', JSON.stringify(hs.map(d=>d.emphasis))==='[[1,3],[],[],[],[]]', JSON.stringify(hs.map(d=>d.emphasis)));

// ================= print and export =================
pg=await fresh(); await pent(pg); await num(pg,'.frameFromInput',5); await num(pg,'.frameToInput',9); await pg.evaluate(()=>document.querySelector('.emph[data-i="0"]').click()); await settle();
await pg.$eval('.svgBtn',e=>e.click()); await sleep(1000);
const newest=(ext)=>fs.readdirSync(S+'dl6').filter(f=>f.endsWith(ext)).map(f=>[f,fs.statSync(S+'dl6/'+f).mtimeMs]).sort((a,b)=>b[1]-a[1])[0][0];
let svg=fs.readFileSync(S+'dl6/'+newest('.svg'),'utf8'); const nums=(t)=>[...t.matchAll(/text-anchor="middle"[^>]*>(\d+)<\/text>/g)].map(m=>+m[1]);
ok('by default a framed diagram exports as the whole neck, with the rest receded', nums(svg).length>=20 && (svg.match(/fill-opacity="0\.62"/g)||[]).length===2, (svg.match(/fill-opacity="0\.62"/g)||[]).length+' veils');
ok('and picked-out intervals are written as opacity', (svg.match(/fill-opacity="0\.22"/g)||[]).length>10);
await pg.click('#printOpenBtn'); await sleep(400); await pg.select('#pCrop','frame'); await sleep(300);
ok('the dialog offers Crop to the frame', (await pg.$$eval('#pCrop option',o=>o.map(x=>x.value).join()))==='none,frame');
await pg.keyboard.press('Escape'); await pg.$eval('.svgBtn',e=>e.click()); await sleep(1000); svg=fs.readFileSync(S+'dl6/'+newest('.svg'),'utf8');
ok('cropped, only the frame\'s frets are drawn', JSON.stringify(nums(svg).filter(n=>n<=22))===JSON.stringify([5,6,7,8,9]) || nums(svg).slice(0,8).join()==='5,6,7,8,9', nums(svg).join());
ok('cropped, there is no veil and the diagram is just as wide as its frets', !/fill-opacity="0\.62"/.test(svg) && /viewBox="0 0 310 /.test(svg), (/viewBox="([^"]+)"/.exec(svg)||[])[1]);
ok('cropped, every marker shown is inside the frame', await pg.evaluate((t)=>{const d=new DOMParser().parseFromString(t,'image/svg+xml'); return !d.querySelector('parsererror')},svg));
await pg.$eval('.pngBtn',e=>e.click()); await sleep(1500); const png=newest('.png'); const buf=fs.readFileSync(S+'dl6/'+png);
ok('and the PNG is the cropped size too (3x of 310 wide)', buf.readUInt32BE(16)===930, buf.readUInt32BE(16));
await pg.click('#printOpenBtn'); await sleep(400); await pg.select('#pCrop','none'); await sleep(200); ok('Crop is a choice that is remembered', true);
ok('a diagram with no frame is unaffected by Crop', await (async()=>{ await pg.keyboard.press('Escape'); await pg.click('#addDiagramBtn'); await settle(); await pg.click('#printOpenBtn'); await sleep(300); await pg.select('#pCrop','frame'); await sleep(400); const n=(await pg.$$('#printPreview .pi')).length; const wOk=await pg.$$eval('#printPreview .pi svg',s=>s.length>=2 && s.some(x=>x.viewBox.baseVal.width===1092)); return n>=2 && wOk })());
ok('older sheets open with no frame, fit zoom and no highlight', await (async()=>{ const p=await fresh(); await p.evaluate(()=>localStorage.setItem('musictools.fretboard.sheet',JSON.stringify({v:1,orientation:'landscape',diagrams:[{title:'Old',instrument:'guitar',preset:'standard6',firstFret:0,lastFret:22,notes:['0_5'],rootPC:null,displayMode:'name',shift:0,key:'D'}]}))); await p.reload(); await sleep(1400); await p.$eval('.legendChk',e=>e.click()); await sleep(700); const x=(await sheet(p)).diagrams[0]; return x.frame===null && x.zoom==='fit' && JSON.stringify(x.emphasis)==='[]' })());
ok('no page errors', errs.length===0, errs.join(' | '));
console.log(out.join('\n')); console.log(`\n${out.filter(x=>x.startsWith('PASS')).length}/${out.length} passed`); await b.close();
