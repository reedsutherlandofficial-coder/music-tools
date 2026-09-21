import fs from 'fs';
import { INDEX, launch, scratch } from './lib.mjs';
const S=scratch('fretboard');
fs.rmSync(S+'dl',{recursive:true,force:true}); fs.mkdirSync(S+'dl',{recursive:true});
const base=INDEX, url=base+'#fretboard';
const b=await launch();
const out=[]; const ok=(n,c,x='')=>out.push((c?'PASS ':'FAIL ')+n+(x?'  ['+String(x).slice(0,150)+']':''));
const errs=[]; const wire=(pg)=>{pg.on('pageerror',e=>errs.push('PAGE '+e.message)); pg.on('console',m=>{if(m.type()==='error'&&!/Unsafe attempt/.test(m.text()))errs.push(m.text().slice(0,140))})};
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const SK='musictools.fretboard.sheet', VK='musictools.fretboard.versions';
async function fresh(ctx=b, u=url){ const pg=await ctx.newPage(); wire(pg); await pg.setViewport({width:1440,height:1000}); pending.clear(); await pg.goto(u); await pg.evaluate(()=>{localStorage.clear();sessionStorage.clear()}); await pg.reload(); await sleep(900); return pg; }
const stored=(pg,k=SK)=>pg.evaluate(k=>localStorage.getItem(k),k);
const sheet=async(pg)=>JSON.parse(await stored(pg));

const pending=new Map();   // a scale/chord chosen in a test, waiting for its old-style Generate click
const pickPattern=(pg,idx,v)=>pg.evaluate((i,v)=>{const e=document.querySelectorAll('.diagram-card')[i].querySelector('.patternSel'); e.value=v; e.dispatchEvent(new Event('change',{bubbles:true}))},idx,v);
const setSel=(pg,idx,sel,val)=>{
  if(sel==='.scaleSel'){ pending.set('s'+idx,val); return Promise.resolve(); }
  if(sel==='.chordSel'){ pending.set('c'+idx,val); return Promise.resolve(); }
  if(sel==='.displaySel') return pg.evaluate((i,v)=>document.querySelectorAll('.diagram-card')[i].querySelector('.showSeg [data-show="'+v+'"]').click(),idx,val);
  return pg.evaluate((i,s,v)=>{const e=document.querySelectorAll('.diagram-card')[i].querySelector(s); e.value=v; e.dispatchEvent(new Event('change',{bubbles:true}))},idx,sel,val);
};
const click=(pg,idx,sel)=>{
  if(sel==='.genScaleBtn') return pickPattern(pg,idx,'scale:'+(pending.get('s'+idx)||'major'));
  if(sel==='.genChordBtn') return pickPattern(pg,idx,'chord:'+(pending.get('c'+idx)||'major'));
  return pg.evaluate((i,s)=>document.querySelectorAll('.diagram-card')[i].querySelector(s).click(),idx,sel);
};
const canv=(pg)=>pg.$$eval('.fretCanvas',c=>c.map(x=>x.toDataURL().length+':'+x.toDataURL().slice(-60)));
const nCards=(pg)=>pg.$$eval('.diagram-card',c=>c.length);
const notesOf=async(pg,i=0)=>(await sheet(pg)).diagrams[i].notes.length;
const settle=()=>sleep(650);

// ---------- 1. autosave round trip
let pg=await fresh();
await pg.$eval('.title-input',e=>{e.value='D dorian, full neck';e.dispatchEvent(new Event('input',{bubbles:true}))});
await setSel(pg,0,'.keySel','D'); await setSel(pg,0,'.scaleSel','dorian'); await click(pg,0,'.genScaleBtn');
await setSel(pg,0,'.displaySel','interval'); await pg.click('#portraitBtn'); await pg.click('#addDiagramBtn'); await settle();
await pg.$eval('.diagram-card:nth-child(2) .title-input',e=>{e.value='second';e.dispatchEvent(new Event('input',{bubbles:true}))}); await settle();
const s1=await stored(pg), c1=await canv(pg); await pg.reload(); await sleep(2200);
ok('reload restores the sheet exactly (stored JSON identical)', (await stored(pg))===s1);
ok('reload restores the drawn necks (canvas pixels identical)', JSON.stringify(await canv(pg))===JSON.stringify(c1));
ok('reload restores pickers, title, orientation, count', (await pg.$eval('.keySel',e=>e.value))==='D' && (await pg.$eval('.patternSel',e=>e.value))==='scale:dorian' && (await pg.$eval('.title-input',e=>e.value))==='D dorian, full neck' && (await pg.$eval('#portraitBtn',e=>e.classList.contains('active'))) && (await nCards(pg))===2);
ok('status reads Saved', (await pg.$eval('#saveState',e=>e.textContent))==='Saved');
await pg.click('#landscapeBtn'); await settle(); const beforeClick=await notesOf(pg);
await pg.evaluate(()=>{const c=document.querySelector('.fretCanvas'); const r=c.getBoundingClientRect(); c.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+58+46*3,clientY:r.top+50+28*2}))}); await settle();
ok('a click on the neck is autosaved', (await notesOf(pg))!==beforeClick, beforeClick+' -> '+await notesOf(pg));

// ---------- 2. undo / redo
pg=await fresh(); const u=()=>pg.$eval('#undoBtn',e=>e.disabled), r=()=>pg.$eval('#redoBtn',e=>e.disabled);
ok('fresh sheet: undo and redo disabled', (await u())&&(await r()));
await click(pg,0,'.genScaleBtn'); await settle(); const withNotes=await notesOf(pg);
await click(pg,0,'.clearNotesBtn'); await settle();
ok('generate then clear: 0 notes, undo enabled', (await notesOf(pg))===0 && !(await u()));
await pg.click('#undoBtn'); await settle();
ok('undo brings the scale back', (await notesOf(pg))===withNotes, await notesOf(pg));
ok('redo now enabled', !(await r()));
await pg.click('#redoBtn'); await settle(); ok('redo clears again', (await notesOf(pg))===0);
await pg.keyboard.down('Control'); await pg.keyboard.press('z'); await pg.keyboard.up('Control'); await settle();
ok('Ctrl+Z undoes', (await notesOf(pg))===withNotes);
await pg.keyboard.down('Control'); await pg.keyboard.down('Shift'); await pg.keyboard.press('z'); await pg.keyboard.up('Shift'); await pg.keyboard.up('Control'); await settle();
ok('Ctrl+Shift+Z redoes', (await notesOf(pg))===0);
await pg.keyboard.down('Control'); await pg.keyboard.press('z'); await pg.keyboard.up('Control'); await settle();
await pg.click('.title-input'); await pg.$eval('.title-input',e=>e.select()); await pg.keyboard.type('Position A',{delay:15}); await settle();
await pg.keyboard.down('Control'); await pg.keyboard.press('z'); await pg.keyboard.up('Control'); await settle();
ok('Ctrl+Z inside the title field does not undo the sheet', (await notesOf(pg))===withNotes);
await pg.$eval('.title-input',e=>e.blur()); await pg.click('#undoBtn'); await settle();
ok('a burst of typing is one undo step (back to the name the pattern gave it)', (await pg.$eval('.title-input',e=>e.value))==='C Major (Ionian)' , await pg.$eval('.title-input',e=>e.value));
await pg.click('#redoBtn'); await settle();
const stackA=await pg.evaluate(()=>document.getElementById('undoBtn').disabled+'|'+document.getElementById('redoBtn').disabled);
await pg.select('#themePick','blueprint'); await sleep(600); await pg.select('#themePick','terminal'); await sleep(600);
const stackB=await pg.evaluate(()=>document.getElementById('undoBtn').disabled+'|'+document.getElementById('redoBtn').disabled);
ok('changing theme adds no undo step (redo still available)', stackA===stackB && stackB==='false|true', stackA+' vs '+stackB);
await pg.click('#tab-circle'); await pg.keyboard.down('Control'); await pg.keyboard.press('z'); await pg.keyboard.up('Control'); await settle();
await pg.click('#tab-fretboard'); ok('Ctrl+Z on the circle tab leaves the fretboard alone', (await pg.$eval('.title-input',e=>e.value))==='Position A');

// ---------- 3. duplicate / remove
pg=await fresh(); await pg.$eval('.title-input',e=>{e.value='Scale';e.dispatchEvent(new Event('input',{bubbles:true}))}); await click(pg,0,'.genScaleBtn'); await setSel(pg,0,'.displaySel','interval'); await settle();
ok('single diagram: Remove is disabled with a reason', (await pg.$eval('.removeBtn',e=>e.disabled&&/at least one/.test(e.title))));
await click(pg,0,'.duplicateBtn'); await settle();
let sh=await sheet(pg);
ok('duplicate inserts a copy right after', sh.diagrams.length===2 && sh.diagrams[1].title==='Scale (copy)');
ok('the copy carries notes, display mode and pickers', JSON.stringify(sh.diagrams[0].notes)===JSON.stringify(sh.diagrams[1].notes) && sh.diagrams[1].displayMode==='interval' && sh.diagrams[1].scale===sh.diagrams[0].scale);
await click(pg,1,'.clearNotesBtn'); await settle(); sh=await sheet(pg);
ok('editing the copy leaves the original alone', sh.diagrams[0].notes.length>0 && sh.diagrams[1].notes.length===0);
ok('two diagrams: Remove enabled', !(await pg.$eval('.removeBtn',e=>e.disabled)));
await click(pg,1,'.removeBtn'); await settle(); ok('remove drops it', (await nCards(pg))===1);
await pg.click('#undoBtn'); await settle(); ok('undo restores a removed diagram', (await nCards(pg))===2);
for(let i=0;i<30;i++){ if(await pg.$eval('#addDiagramBtn',e=>e.disabled)) break; await pg.click('#addDiagramBtn'); }
ok('sheet caps at 24 diagrams and Add disables', (await nCards(pg))===24 && await pg.$eval('#addDiagramBtn',e=>e.disabled));

// ---------- 4. versions
pg=await fresh(); await setSel(pg,0,'.keySel','A'); await setSel(pg,0,'.scaleSel','minorPentatonic'); await click(pg,0,'.genScaleBtn'); await settle();
await pg.click('#versionsBtn'); await sleep(200);
ok('dialog opens with a suggested name', await pg.$eval('#versionsDlg',d=>d.open) && (await pg.$eval('#versionName',e=>e.value)).length>0);
ok('empty state is explained', /No saved versions/.test(await pg.$eval('#versionList',e=>e.textContent)));
await pg.$eval('#versionName',e=>e.value='Box A'); await pg.click('#saveVersionBtn'); await sleep(200);
ok('version appears in the list', /Box A/.test(await pg.$eval('#versionList',e=>e.textContent)) && /1 diagram/.test(await pg.$eval('#versionList',e=>e.textContent)));
await pg.$eval('#versionName',e=>e.value='<img src=x onerror="window.__xss=1"> hostile'); await pg.click('#saveVersionBtn'); await sleep(200);
ok('a hostile version name renders as text and does not execute', (await pg.evaluate(()=>window.__xss))===undefined && (await pg.$$eval('#versionList img',i=>i.length))===0);
await pg.keyboard.press('Escape'); await sleep(100);
ok('Escape closes the dialog', !(await pg.$eval('#versionsDlg',d=>d.open)));
await click(pg,0,'.clearNotesBtn'); await settle(); ok('sheet cleared after saving', (await notesOf(pg))===0);
await pg.click('#versionsBtn'); await sleep(150);
await pg.$$eval('#versionList li',l=>l.find(x=>x.textContent.includes('Box A')).querySelector('button').click()); await sleep(300);
ok('Load restores that version and closes the dialog', (await notesOf(pg))>0 && !(await pg.$eval('#versionsDlg',d=>d.open)));
await pg.click('#undoBtn'); await settle(); ok('loading a version is one undoable step', (await notesOf(pg))===0);
await pg.reload(); await sleep(900); await pg.click('#versionsBtn'); await sleep(150);
ok('versions survive a reload', /Box A/.test(await pg.$eval('#versionList',e=>e.textContent)));
let lis=await pg.$$('#versionList li'); let btns=await lis[0].$$('button');
await btns[1].click(); ok('Delete asks first', /Really/.test(await btns[1].evaluate(e=>e.textContent)) && (await pg.$$('#versionList li')).length===2);
await btns[1].click(); await sleep(200); ok('second click deletes', (await pg.$$('#versionList li')).length===1);

// ---------- 5. share links
pg=await fresh(); await setSel(pg,0,'.keySel','G'); await setSel(pg,0,'.scaleSel','blues'); await click(pg,0,'.genScaleBtn'); await pg.$eval('.title-input',e=>{e.value='Shared <b>one</b>';e.dispatchEvent(new Event('input',{bubbles:true}))}); await settle();
await pg.click('#versionsBtn'); await sleep(150); const link=await pg.$eval('#shareLink',e=>e.value);
const mine=await stored(pg);
ok('share link is produced and reasonably short', link.includes('?sheet=') && link.length<3000, link.length+' chars');
const mk=()=>b.createBrowserContext?b.createBrowserContext():b.createIncognitoBrowserContext();
const ctx1=await mk();
let p2=await ctx1.newPage(); wire(p2); await p2.setViewport({width:1440,height:1000}); await p2.goto(link); await sleep(1500);
ok('opening the link in a fresh browser loads that sheet', JSON.stringify((await sheet(p2)).diagrams.map(d=>[d.key,d.pattern,d.notes.length]))===JSON.stringify(JSON.parse(mine).diagrams.map(d=>[d.key,d.pattern,d.notes.length])) && (await p2.$eval('.title-input',e=>e.value))==='Shared <b>one</b>');
ok('the title is text, not markup', (await p2.$$eval('.diagram-card b',n=>n.length))===0);
const ctx2=await mk();
let p3=await ctx2.newPage(); wire(p3); await p3.goto(url); await p3.evaluate(()=>localStorage.clear()); await p3.reload(); await sleep(700);
await setSel(p3,0,'.keySel','F'); await click(p3,0,'.genScaleBtn'); await sleep(700);
await p3.goto(link); await sleep(1500);
const vs=JSON.parse(await stored(p3,VK)||'[]');
ok('opening a link files your own sheet as a version first', vs.length===1 && /Before opening a shared link/.test(vs[0].name) && vs[0].sheet.diagrams[0].key==='F', JSON.stringify(vs.map(v=>v.name)));
await p3.reload(); await sleep(900); await p3.reload(); await sleep(900);
ok('reloading does not re-apply the link or file more versions', JSON.parse(await stored(p3,VK)||'[]').length===1);
let p4=await ctx1.newPage(); wire(p4); await p4.goto(base+'?sheet=@@@notbase64@@@#fretboard'); await sleep(1200);
ok('a malformed link is refused with a message, sheet still works', /could not be read/.test(await p4.$eval('#saveState',e=>e.textContent)) && (await p4.$$('.diagram-card')).length===1);
const evil=Buffer.from(JSON.stringify({diagrams:[{title:'<script>window.__x=1</script>'.repeat(20),instrument:'__proto__',preset:'constructor',firstFret:-50,lastFret:9999,notes:['99_99','0_5','x','0_5',{a:1}, '5_500'],rootPC:77,displayMode:'<img>',shift:1e9,key:'Z#',scale:'toString',chord:'hasOwnProperty'}]})).toString('base64url');
let p5=await ctx1.newPage(); wire(p5); await p5.goto(base+'?sheet='+evil+'#fretboard'); await sleep(1500);
const cl=(await sheet(p5)).diagrams[0];
ok('a hostile link is clamped to safe values', cl.instrument==='guitar' && cl.firstFret===0 && cl.lastFret===30 && cl.rootPC===null && cl.displayMode==='name' && cl.shift===11 && cl.key==='C' && cl.title.length<=120 && cl.notes.every(n=>/^\d_\d+$/.test(n)) && (await p5.evaluate(()=>window.__x))===undefined, JSON.stringify({...cl,title:cl.title.length}));
await ctx1.close(); await ctx2.close();

// ---------- 6. file export / import
pg=await fresh(); const cdp=await pg.createCDPSession(); await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:S+'dl'});
await setSel(pg,0,'.keySel','E'); await setSel(pg,0,'.scaleSel','mixolydian'); await click(pg,0,'.genScaleBtn'); await pg.click('#addDiagramBtn'); await settle();
const want=await stored(pg);
await pg.click('#versionsBtn'); await sleep(150); await pg.click('#exportFileBtn'); await sleep(1200);
const files=fs.readdirSync(S+'dl').filter(f=>f.endsWith('.json')); ok('export writes a .json file', files.length===1, files.join());
const doc=JSON.parse(fs.readFileSync(S+'dl/'+files[0],'utf8'));
ok('the file is labelled and holds the sheet', doc.kind==='fretboard-sheet' && JSON.stringify(doc.sheet)===want);
await pg.keyboard.press('Escape'); await click(pg,0,'.clearNotesBtn'); await click(pg,1,'.removeBtn'); await settle();
await pg.click('#versionsBtn'); await sleep(150);
await (await pg.$('#importFile')).uploadFile(S+'dl/'+files[0]); await sleep(900);
ok('importing the file restores the sheet', (await stored(pg))===want && /Imported 2 diagrams/.test(await pg.$eval('#versionMsg',e=>e.textContent)));
fs.writeFileSync(S+'dl/bad.json','{"hello":"world"}'); await (await pg.$('#importFile')).uploadFile(S+'dl/bad.json'); await sleep(600);
ok('a non-sheet file is refused with a message and changes nothing', /not a fretboard sheet/.test(await pg.$eval('#versionMsg',e=>e.textContent)) && (await stored(pg))===want);
fs.writeFileSync(S+'dl/garbage.json','not json at all {{{'); await (await pg.$('#importFile')).uploadFile(S+'dl/garbage.json'); await sleep(600);
ok('unparseable JSON is refused too', /not a fretboard sheet/.test(await pg.$eval('#versionMsg',e=>e.textContent)));
await pg.keyboard.press('Escape'); await pg.click('#undoBtn'); await settle();
ok('Undo after an import brings back the previous sheet', (await stored(pg))!==want);

ok('no page errors anywhere', errs.length===0, errs.join(' | '));
console.log(out.join('\n')); console.log(`\n${out.filter(x=>x.startsWith('PASS')).length}/${out.length} passed`); await b.close();
