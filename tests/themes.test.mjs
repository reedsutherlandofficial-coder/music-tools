import { INDEX, launch } from './lib.mjs';
const cur=INDEX;
const b=await launch();
const out=[]; const ok=(n,c,x='')=>out.push((c?'PASS ':'FAIL ')+n+(x?'  ['+x+']':''));
const errs=[]; const pg=await b.newPage(); pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await pg.setViewport({width:1440,height:900});
await pg.goto(cur+'#circle'); await pg.waitForSelector('#famBtns .chip');
ok('exactly four themes, Terminal first', (await pg.$$eval('#themePick option',o=>o.map(x=>x.value).join()))==='terminal,blueprint,chalkboard,graphite');
const tok=()=>pg.evaluate(()=>{const c=getComputedStyle(document.documentElement);return {paper:c.getPropertyValue('--paper').trim(),red:c.getPropertyValue('--red').trim(),teal:c.getPropertyValue('--teal').trim(),rad:c.getPropertyValue('--radius-lg').trim(),scan:c.getPropertyValue('--fx-scan').trim(),meta:document.querySelector('meta[name=theme-color]').content}});
for(const [t,paper,red,teal] of [['blueprint','#0A2340','#FFB938','#5CD3F0'],['chalkboard','#15231D','#F2CB5B','#F4A0B7'],['graphite','#0F1013','#9C8CFF','#B4F26B'],['terminal','#120C07','#E5672B','#17B8A6']]){
  await pg.select('#themePick',t); const k=await tok();
  ok(`select ${t}: tokens + meta`, k.paper===paper && k.red===red && k.teal===teal && k.meta===paper, JSON.stringify(k));
  ok(`select ${t}: hash records theme`, (await pg.evaluate(()=>location.hash)).startsWith('#circle/'+t));
}
// switching away and back leaves no stale tokens: terminal's fx values restored exactly
const k=await tok(); ok('back on terminal: fx tokens restored', k.rad==='10px' && k.scan==='.16', JSON.stringify(k));
// stale ids from old links fall back to terminal
for(const old of ['night','prog','jazz','psychedelic','nonsense']){
  await pg.goto(cur+'#circle/'+old+'/0.0.5.0'); await pg.reload(); await pg.waitForSelector('#famBtns .chip');
  ok(`old link "${old}" -> terminal`, (await tok()).paper==='#120C07' && (await pg.$eval('#themePick',e=>e.value))==='terminal');
}
// fretboard repaints per theme (canvas pixel differs), and PNG export bg follows theme
// sample inside the neck: the ground around it is transparent now, so a corner pixel says nothing
const px=async(t)=>{await pg.goto(cur+'#fretboard/'+t); await pg.reload(); await new Promise(r=>setTimeout(r,1500)); return pg.$eval('.diagram-card canvas',c=>{const x=c.getContext('2d'); const d=x.getImageData(310,92,1,1).data; return [...d].join()})};
const seen=new Set(); for(const t of ['terminal','blueprint','chalkboard','graphite']) seen.add(await px(t));
ok('fretboard canvas repaints in each theme', seen.size===4, [...seen].join(' | '));
// Terminal's face: Chivo Mono for text, Noto Music for the accidentals, nothing from the OS or the old font
// audited in its own page: enabling DevTools' CSS domain on a file: page logs an unrelated console error
const aud=await b.newPage(); await aud.setViewport({width:1440,height:900});
await aud.goto(cur+'#circle/terminal/0.0.5.0'); await aud.reload(); await aud.waitForSelector('#famBtns .chip'); await new Promise(r=>setTimeout(r,2500));
const cdp=await aud.createCDPSession(); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
const {root}=await cdp.send('DOM.getDocument',{depth:-1});
const {nodeIds}=await cdp.send('DOM.querySelectorAll',{nodeId:root.nodeId,selector:'.app-panel:not([hidden]) *, .shell-bar *'});
const tally={}; for(const id of nodeIds){ try{ const r=await cdp.send('CSS.getPlatformFontsForNode',{nodeId:id}); r.fonts.forEach(f=>{const k=f.familyName.replace(/ (Medium|Regular|Bold|SemiBold)$/,'')+(f.isCustomFont?'':' (SYSTEM)'); tally[k]=(tally[k]||0)+f.glyphCount}) }catch(e){} }
ok('circle tab renders only Chivo Mono + Noto Music (no OS fallback)', Object.keys(tally).sort().join()==='Chivo Mono,Noto Music', JSON.stringify(tally));
await aud.goto(cur+'#fretboard/terminal'); await aud.reload(); await new Promise(r=>setTimeout(r,2500)); await aud.$eval('.patternSel',e=>{e.value='scale:major';e.dispatchEvent(new Event('change',{bubbles:true}))});
const {root:r2}=await cdp.send('DOM.getDocument',{depth:-1});
const ids2=(await cdp.send('DOM.querySelectorAll',{nodeId:r2.nodeId,selector:'.app-panel:not([hidden]) *, .shell-bar *'})).nodeIds;
const t2={}; for(const id of ids2){ try{ const r=await cdp.send('CSS.getPlatformFontsForNode',{nodeId:id}); r.fonts.forEach(f=>{const k=f.familyName.replace(/ (Medium|Regular|Bold|SemiBold)$/,'')+(f.isCustomFont?'':' (SYSTEM)'); t2[k]=(t2[k]||0)+f.glyphCount}) }catch(e){} }
ok('fretboard tab renders only web fonts too', !Object.keys(t2).some(k=>k.includes('SYSTEM')), JSON.stringify(t2));
ok('no JetBrains Mono requested anywhere', !(await aud.evaluate(()=>[...document.fonts].some(f=>f.family.includes('JetBrains')))) && !(await aud.evaluate(()=>document.documentElement.outerHTML.includes('JetBrains'))));
// the fretboard panel no longer paints its own flat surface: body atmosphere reaches the bottom
const edge=await aud.evaluate(()=>getComputedStyle(document.getElementById('fretApp')).backgroundColor);
ok('fretboard panel is transparent', edge==='rgba(0, 0, 0, 0)', edge);
ok('no page errors', errs.length===0, errs.join(' | '));
console.log(out.join('\n')); console.log(`\n${out.filter(x=>x.startsWith('PASS')).length}/${out.length} passed`); await b.close();
