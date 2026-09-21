import fs from 'fs';
import { INDEX, launch, scratch } from './lib.mjs';
const S=scratch('clear-svg');
const url=INDEX+'#fretboard';
const b=await launch();
const out=[]; const ok=(n,c,x='')=>out.push((c?'PASS ':'FAIL ')+n+(x!==''?'  ['+String(x).slice(0,160)+']':'')); const sleep=(ms)=>new Promise(r=>setTimeout(r,ms)); const errs=[];
const pg=await b.newPage(); pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>{if(m.type()==='error'&&!/Unsafe/.test(m.text()))errs.push(m.text().slice(0,120))});
await pg.setViewport({width:1440,height:1000}); const cdp=await pg.createCDPSession(); await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:S+'dl5'});
const newest=(ext)=>fs.readdirSync(S+'dl5').filter(f=>f.endsWith(ext)).map(f=>[f,fs.statSync(S+'dl5/'+f).mtimeMs]).sort((a,b)=>b[1]-a[1])[0][0];
const read=(ext)=>fs.readFileSync(S+'dl5/'+newest(ext),'utf8');
const sel=(id,v)=>pg.evaluate((id,v)=>{const e=document.getElementById(id); e.value=v; e.dispatchEvent(new Event('change',{bubbles:true}))},id,v);
const raster=(svg,pts)=>pg.evaluate(async(t,pts)=>{const img=new Image(); await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(t)}); const c=document.createElement('canvas'); c.width=img.naturalWidth;c.height=img.naturalHeight; const g=c.getContext('2d'); g.drawImage(img,0,0); return {w:c.width,h:c.height,px:pts.map(([x,y])=>[...g.getImageData(x,y,1,1).data])}},svg,pts);
// an old install stored the setting under its earlier name
await pg.goto(url); await pg.evaluate(()=>{localStorage.clear(); localStorage.setItem('musictools.fretboard.print',JSON.stringify({png:'solid'}))}); await pg.reload(); await sleep(2000);
await pg.evaluate(()=>{window.print=()=>{}});
await pg.click('#printOpenBtn'); await sleep(300);
ok('a setting saved under the old name is still honoured', (await pg.$eval('#pBg',e=>e.value))==='solid');
ok('the control is labelled for all images', /images/i.test(await pg.$eval('label[for=pBg]',e=>e.textContent)));
await sel('pBg','clear'); await pg.keyboard.press('Escape');
await pg.$eval('.patternSel',e=>{e.value='scale:major';e.dispatchEvent(new Event('change',{bubbles:true}))}); await sleep(600);
// ---- clear SVG
await pg.$eval('.svgBtn',e=>e.click()); await sleep(1000); let svg=read('.svg');
const W=1092,H=294;
ok('clear SVG: no full-size background rectangle', !new RegExp('<rect x="0" y="0" width="'+W+'" height="'+H+'"').test(svg));
ok('clear SVG: the neck gradient, markers and text are all still there', svg.includes('<linearGradient') && (svg.match(/<path/g)||[]).length>80 && (svg.match(/<text/g)||[]).length>60);
let r=await raster(svg,[[0,0],[W-1,0],[0,H-1],[W-1,H-1],[600,100],[5,150]]);
ok('clear SVG rasterised: corners transparent, the neck opaque', r.px.slice(0,4).every(p=>p[3]===0) && r.px[4][3]===255, JSON.stringify(r.px));
// ---- solid SVG
await sel('pBg','solid'); await pg.$eval('.svgBtn',e=>e.click()); await sleep(1000); svg=read('.svg');
r=await raster(svg,[[0,0],[W-1,H-1]]);
ok('solid SVG: has its background, opaque in the paper white', new RegExp('<rect x="0" y="0" width="'+W+'" height="'+H+'"[^>]*fill="#FFFFFF"').test(svg) && r.px.every(p=>p[3]===255 && p[0]===255), JSON.stringify(r.px));
// ---- sheet SVG
await sel('pBg','clear'); await pg.keyboard.press('Escape'); await pg.click('#addDiagramBtn'); await sleep(500); await pg.click('#printOpenBtn'); await sleep(300);
await pg.$eval('#sheetSvgBtn',e=>e.click()); await sleep(1200); svg=read('.svg');
const sw=+/width="([\d.]+)"/.exec(svg)[1], sh=+/height="([\d.]+)"/.exec(svg)[1];
r=await raster(svg,[[0,0],[Math.round(sw)-1,Math.round(sh)-1],[Math.round(sw)-1,0]]);
ok('clear sheet SVG: no page background, corners transparent', !/<rect x="0" y="0" width="1248"/.test(svg) && r.px.every(p=>p[3]===0), JSON.stringify(r.px));
await sel('pBg','solid'); await pg.$eval('#sheetSvgBtn',e=>e.click()); await sleep(1200); svg=read('.svg');
ok('solid sheet SVG: has the page background', /<rect x="0" y="0" width="1248"/.test(svg));
// ---- print pages are always solid, whatever the setting
await sel('pBg','clear'); await pg.$eval('#printBtn',e=>e.click()); await sleep(400);
ok('printed pages stay solid with Clear selected', (await pg.$eval('#printRoot .pp',e=>e.style.background))==='rgb(255, 255, 255)' && /<rect x="0" y="0" width="1092"[^>]*fill="#FFFFFF"/.test(await pg.$eval('#printRoot svg',e=>e.outerHTML)));
ok('and so does the preview', /<rect x="0" y="0" width="1092"[^>]*fill="#FFFFFF"/.test(await pg.$eval('#printPreview svg',e=>e.outerHTML)));
// ---- copy image still fine
await pg.keyboard.press('Escape'); await pg.$eval('.copyImgBtn',e=>e.click()); await sleep(900);
ok('Copy image still reports', (await pg.$eval('.exportMsg',e=>e.textContent)).length>8, await pg.$eval('.exportMsg',e=>e.textContent));
ok('no page errors', errs.length===0, errs.join('|'));
console.log(out.join('\n')); console.log(out.filter(x=>x.startsWith('PASS')).length+'/'+out.length+' passed'); await b.close();
