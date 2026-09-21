import fs from 'fs';
import { INDEX, launch, scratch } from './lib.mjs';
const S=scratch('clear-png');
const url=INDEX+'#fretboard';
const b=await launch();
const out=[]; const ok=(n,c,x='')=>out.push((c?'PASS ':'FAIL ')+n+(x!==''?'  ['+String(x).slice(0,160)+']':'')); const sleep=(ms)=>new Promise(r=>setTimeout(r,ms)); const errs=[];
const pg=await b.newPage(); pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>{if(m.type()==='error'&&!/Unsafe/.test(m.text()))errs.push(m.text().slice(0,120))});
await pg.setViewport({width:1440,height:1000}); const cdp=await pg.createCDPSession(); await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:S+'dl4'});
await pg.goto(url); await pg.evaluate(()=>{localStorage.clear()}); await pg.reload(); await sleep(2000);
const newest=()=>fs.readdirSync(S+'dl4').filter(f=>f.endsWith('.png')).map(f=>[f,fs.statSync(S+'dl4/'+f).mtimeMs]).sort((a,b)=>b[1]-a[1])[0][0];
const px=async(file,pts)=>pg.evaluate(async(b64,pts)=>{const img=new Image(); await new Promise(r=>{img.onload=r;img.src='data:image/png;base64,'+b64}); const c=document.createElement('canvas'); c.width=img.width;c.height=img.height; const g=c.getContext('2d'); g.drawImage(img,0,0); let opaque=0,total=0; const d=g.getImageData(0,0,c.width,c.height).data; for(let i=3;i<d.length;i+=4){total++; if(d[i]>0)opaque++} return {w:img.width,h:img.height,frac:+(opaque/total).toFixed(3),pts:pts.map(([x,y])=>{const p=g.getImageData(x,y,1,1).data;return [p[0],p[1],p[2],p[3]]})}},fs.readFileSync(S+'dl4/'+file).toString('base64'),pts);
const sel=(v)=>pg.evaluate((v)=>{const e=document.getElementById('pBg'); e.value=v; e.dispatchEvent(new Event('change',{bubbles:true}))},v);
const click=(sel)=>pg.$eval(sel,e=>e.click());
await pg.$eval('.patternSel',e=>{e.value='scale:major';e.dispatchEvent(new Event('change',{bubbles:true}))}); await sleep(600);
ok('the dialog offers Clear (the default) and Solid', (await pg.evaluate(()=>{document.getElementById('printOpenBtn').click(); return [...document.querySelectorAll('#pBg option')].map(o=>o.value).join()+'|'+document.getElementById('pBg').value}))==='clear,solid|clear');
await pg.keyboard.press('Escape'); await sleep(200);
// --- clear
await click('.pngBtn'); await sleep(1500); let f=newest();
let r=await px(f,[[0,0],[10,10],[3270,5],[5,870],[3270,870],[1800,300],[600,500]]);
const [tl,tl2,tr,bl,br,neck,neck2]=r.pts;
ok('clear PNG: every corner is fully transparent', [tl,tr,bl,br].every(p=>p[3]===0), JSON.stringify([tl,tr,bl,br]));
ok('clear PNG: the fretboard itself is opaque', neck[3]===255 && neck2[3]===255, JSON.stringify([neck,neck2]));
ok('clear PNG: only part of the image is opaque (neck + marks, not a full rectangle)', r.frac>0.15 && r.frac<0.75, r.frac);
// --- solid
await sel('solid'); await click('.pngBtn'); await sleep(1500); f=newest(); r=await px(f,[[0,0],[3270,870],[1800,300]]);
ok('solid PNG: fully opaque, in the paper white', r.pts.every(p=>p[3]===255) && r.pts[0].slice(0,3).join()==='255,255,255' && r.frac===1, JSON.stringify(r.pts[0])+' '+r.frac);
await sel('clear');
// --- theme palette, clear
await pg.evaluate(()=>{const e=document.getElementById('pColors'); e.value='theme'; e.dispatchEvent(new Event('change',{bubbles:true}))});
await click('.pngBtn'); await sleep(1500); f=newest(); r=await px(f,[[0,0],[1800,300]]);
ok('clear also holds with "match the app theme"', r.pts[0][3]===0 && r.pts[1][3]===255, JSON.stringify(r.pts));
await pg.evaluate(()=>{const e=document.getElementById('pColors'); e.value='light'; e.dispatchEvent(new Event('change',{bubbles:true}))});
// --- sheet PNG, two diagrams, clear: corners and the gap between them
await pg.keyboard.press('Escape'); await pg.click('#addDiagramBtn'); await sleep(500); await pg.click('#printOpenBtn'); await sleep(400);
await click('#sheetPngBtn'); await sleep(2500); f='fretboard-sheet.png'; r=await px(f,[[0,0],[r.w-1,0]]);
const sh=await px(f,[[0,0],[10,10]]);
const gapY=await pg.evaluate(async(b64)=>{const img=new Image(); await new Promise(r=>{img.onload=r;img.src='data:image/png;base64,'+b64}); const c=document.createElement('canvas'); c.width=img.width;c.height=img.height; const g=c.getContext('2d'); g.drawImage(img,0,0); const col=g.getImageData(972,0,1,c.height).data; let runs=0,inTrans=false,mid=0; for(let y=0;y<c.height;y++){const a=col[y*4+3]; if(a===0){ if(!inTrans){inTrans=true;runs++} } else inTrans=false} return {h:c.height,transparentRuns:runs}},fs.readFileSync(S+'dl4/'+f).toString('base64'));
ok('the sheet PNG is clear too: corners transparent, with clear gaps between diagrams', sh.pts.every(p=>p[3]===0) && gapY.transparentRuns>=3, JSON.stringify(gapY));
// preferences persist; print/SVG unaffected by the PNG setting
await sel('solid'); await pg.reload(); await sleep(1800); await pg.click('#printOpenBtn'); await sleep(400);
ok('the choice is remembered across reloads', (await pg.$eval('#pBg',e=>e.value))==='solid');
await sel('clear'); await pg.evaluate(()=>{window.print=()=>{window.__p=1}}); await click('#printBtn'); await sleep(300);
ok('printing still uses a solid page whatever the PNG setting', (await pg.$eval('#printRoot .pp',e=>e.style.background))==='rgb(255, 255, 255)');
ok('no page errors', errs.length===0, errs.join('|'));
console.log(out.join('\n')); console.log(out.filter(x=>x.startsWith('PASS')).length+'/'+out.length+' passed'); await b.close();
