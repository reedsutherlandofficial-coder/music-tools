import { INDEX, launch } from './lib.mjs';
const url=INDEX+'#fretboard';
const b=await launch();
const out=[]; const ok=(n,c,x='')=>out.push((c?'PASS ':'FAIL ')+n+(x!==''?'  ['+String(x).slice(0,170)+']':'')); const sleep=(ms)=>new Promise(r=>setTimeout(r,ms)); const errs=[];
const NOTES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']; const pcOf=(n)=>NOTES.indexOf(n);
async function fresh(){ const pg=await b.newPage(); pg.on('pageerror',e=>errs.push('PAGE '+e.message)); pg.on('console',m=>{if(m.type()==='error'&&!/Unsafe/.test(m.text()))errs.push(m.text().slice(0,140))});
  await pg.setViewport({width:1440,height:1000}); await pg.goto(url); await pg.evaluate(()=>{localStorage.clear();sessionStorage.clear()}); await pg.reload(); await sleep(1200); return pg; }
const sheet=async(pg)=>JSON.parse(await pg.evaluate(()=>localStorage.getItem('musictools.fretboard.sheet')));
const dg=async(pg,i=0)=>(await sheet(pg)).diagrams[i];
const sel=(pg,i,s,v)=>pg.evaluate((i,s,v)=>{const e=document.querySelectorAll('.diagram-card')[i].querySelector(s); e.value=v; e.dispatchEvent(new Event('change',{bubbles:true}))},i,s,v);
const seg=(pg,i,kind,v)=>pg.evaluate((i,k,v)=>document.querySelectorAll('.diagram-card')[i].querySelector('.'+k+'Seg [data-'+(k==='combine'?'combine':k==='show'?'show':'tool')+'="'+v+'"]').click(),i,kind,v);
const pressed=(pg,i,kind)=>pg.evaluate((i,k)=>[...document.querySelectorAll('.diagram-card')[i].querySelectorAll('.'+k+'Seg button')].filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.textContent.trim()).join(),i,kind);
const neck=(pg,s,f,i=0)=>pg.evaluate((i,s,f)=>{const c=document.querySelectorAll('.fretCanvas')[i]; const r=c.getBoundingClientRect(); c.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+58+46*f,clientY:r.top+50+28*s}))},i,s,f);
const btn=(pg,i,s)=>pg.evaluate((i,s)=>document.querySelectorAll('.diagram-card')[i].querySelector(s).click(),i,s);
const q=(pg,i,s,f)=>pg.evaluate((i,s,f)=>{const e=document.querySelectorAll('.diagram-card')[i].querySelector(s); return f==='disabled'?e.disabled:f==='title'?e.title:f==='text'?e.textContent:f==='value'?e.value:f==='display'?getComputedStyle(e).display:f==='cursor'?getComputedStyle(e).cursor:e.getAttribute(f)},i,s,f);
const settle=()=>sleep(650);
const strings={standard:['E','B','G','D','A','E'],dropD:['E','B','G','D','A','D']};
const pcsOfNotes=(notes,st)=>notes.map(k=>{const [s,f]=k.split('_').map(Number); return (pcOf(st[s])+f)%12});

// ================= live patterns =================
let pg=await fresh();
ok('the two fret inputs share a group, labels unchanged', await pg.evaluate(()=>{const g=document.querySelector('.firstFretInput').parentElement; return g===document.querySelector('.lastFretInput').parentElement && /From fret/.test(g.textContent) && /To fret/.test(g.textContent)}));
ok('no Instrument select and no Generate buttons any more', await pg.evaluate(()=>!document.querySelector('.instrumentSel,.presetSel,.scaleSel,.chordSel,.genScaleBtn,.genChordBtn,.octaveBtn,.rootBtn,.displaySel')));
ok('Tuning is one grouped list (Guitar, Bass)', await pg.evaluate(()=>[...document.querySelectorAll('.tuningSel optgroup')].map(g=>g.label).join()==='Guitar,Bass'));
ok('the Pattern list groups scales and chords', await pg.evaluate(()=>[...document.querySelectorAll('.patternSel optgroup')].map(g=>g.label).join()==='Scales,Chords'));
await sel(pg,0,'.keySel','A'); await sel(pg,0,'.patternSel','scale:minorPentatonic'); await settle();
let d=await dg(pg); const n0=d.notes.length;
ok('choosing a pattern applies at once, no Generate', d.pattern==='scale:minorPentatonic' && d.rootPC===9 && n0>0 && d.title==='A Minor Pentatonic');
ok('it is tagged live', (await q(pg,0,'.patstate','text'))==='live');
await sel(pg,0,'.keySel','D'); await settle(); d=await dg(pg);
ok('changing the key re-applies a live pattern', d.rootPC===2 && d.title==='D Minor Pentatonic' && d.pattern==='scale:minorPentatonic' && pcsOfNotes(d.notes,strings.standard).every(p=>[2,5,7,9,0].includes(p)), d.title);
await sel(pg,0,'.tuningSel','guitar:dropD'); await settle(); d=await dg(pg);
ok('changing the tuning re-applies it: every note is still in D minor pentatonic on the new tuning', d.preset==='dropD' && d.pattern && pcsOfNotes(d.notes,strings.dropD).every(p=>[2,5,7,9,0].includes(p)) && d.notes.length===n0, d.notes.length);
await pg.$eval('.lastFretInput',e=>{e.value='12';e.dispatchEvent(new Event('change',{bubbles:true}))}); await settle(); d=await dg(pg);
ok('narrowing the frets keeps the pattern live and drops out-of-range notes', d.lastFret===12 && d.notes.every(k=>+k.split('_')[1]<=12) && d.notes.length<n0 && d.pattern!=='');
await pg.$eval('.lastFretInput',e=>{e.value='22';e.dispatchEvent(new Event('change',{bubbles:true}))}); await settle(); d=await dg(pg);
ok('widening them again restores the whole pattern (nothing was lost)', d.notes.length===n0, d.notes.length);
await neck(pg,2,3); await settle(); d=await dg(pg); const edited=JSON.stringify(d.notes);
ok('a hand edit makes the notes yours: tagged edited, pattern no longer live', d.pattern==='' && (await q(pg,0,'.patstate','text'))==='edited' && (await q(pg,0,'.patternSel option:first-child','text'))==='Custom notes');
await sel(pg,0,'.keySel','E'); await settle(); d=await dg(pg);
ok('so changing the key no longer re-applies over your edit', JSON.stringify(d.notes)===edited && d.key==='E');
await sel(pg,0,'.patternSel','scale:minorPentatonic'); await settle(); d=await dg(pg);
ok('choosing the pattern again brings it back, live, in the key you set', d.pattern==='scale:minorPentatonic' && d.rootPC===4 && (await q(pg,0,'.patstate','text'))==='live');
await pg.click('#undoBtn'); await settle(); ok('and it is one undo step', (await dg(pg)).pattern==='' && JSON.stringify((await dg(pg)).notes)===edited);

// ================= Add mode =================
pg=await fresh(); await sel(pg,0,'.keySel','A'); await sel(pg,0,'.patternSel','scale:minorPentatonic'); await settle(); const pent=(await dg(pg)).notes.length;
await seg(pg,0,'combine','add'); await settle(); d=await dg(pg);
ok('switching to Add freezes the live pattern into your notes', d.combine==='add' && d.pattern==='' && d.notes.length===pent && (await pressed(pg,0,'combine'))==='Add');
await sel(pg,0,'.keySel','C'); await sel(pg,0,'.patternSel','chord:maj7'); await settle(); d=await dg(pg);
ok('in Add mode a pattern is layered on: more notes, the first root kept', d.notes.length>pent && d.rootPC===9, d.notes.length+' vs '+pent);
ok('the composite is not live and its title says what is in it', d.pattern==='' && d.title==='A Minor Pentatonic + C Major 7 chord', d.title);
await seg(pg,0,'combine','replace'); await sel(pg,0,'.patternSel','scale:blues'); await settle(); d=await dg(pg);
ok('back in Replace mode a pattern replaces again', d.combine==='replace' && d.pattern==='scale:blues' && d.rootPC===0 && d.notes.length<pent+40);

// ================= tuning keeps pitches =================
pg=await fresh(); await neck(pg,2,5); await settle();                    // G string, fret 5 = C
await sel(pg,0,'.tuningSel','guitar:halfstep'); await settle(); d=await dg(pg);
ok('half-step-down: the note slides up a fret and still sounds the same pitch', JSON.stringify(d.notes)==='["2_6"]', JSON.stringify(d.notes));
pg=await fresh(); await neck(pg,5,2); await neck(pg,0,3); await settle();  // low E string fret 2 (F#) and high E fret 3 (G)
await sel(pg,0,'.tuningSel','guitar:dropD'); await settle(); d=await dg(pg);
ok('Drop D: only the retuned string moves, and its note follows the pitch (fret 2 to fret 4)', JSON.stringify(d.notes.sort())==='["0_3","5_4"]', JSON.stringify(d.notes));
await sel(pg,0,'.tuningSel','bass:standard4'); await settle(); d=await dg(pg);
ok('switching to a 4-string bass keeps notes on the strings that exist', d.instrument==='bass' && d.notes.every(k=>+k.split('_')[0]<4 && +k.split('_')[1]<=22));
pg=await fresh(); await neck(pg,2,5); await btn(pg,0,'.toolSeg [data-tool="root"]'); await neck(pg,2,5); await settle();
const rootBefore=(await dg(pg)).rootPC; await sel(pg,0,'.tuningSel','guitar:openG'); await settle();
ok('changing tuning no longer throws the root away', rootBefore!==null && (await dg(pg)).rootPC===rootBefore);

// ================= the click tool =================
pg=await fresh();
ok('the tool selector starts on Place / remove, and the cursor agrees', (await pressed(pg,0,'tool'))==='Place / remove' && (await q(pg,0,'canvas','data-tool'))==='place' && (await q(pg,0,'canvas','cursor'))==='pointer');
await seg(pg,0,'tool','octave'); await settle();
ok('Fill octaves is visibly on: pressed and a copy cursor', (await pressed(pg,0,'tool'))==='Fill octaves' && (await q(pg,0,'canvas','cursor'))==='copy');
await neck(pg,2,5); await settle(); d=await dg(pg);
const expectedC=[]; for(let s=0;s<6;s++)for(let f=0;f<=22;f++) if((pcOf(strings.standard[s])+f)%12===0) expectedC.push(s+'_'+f);
ok('it fills that note in every octave, everywhere', JSON.stringify(d.notes.slice().sort())===JSON.stringify(expectedC.sort()), d.notes.length+' vs '+expectedC.length);
await neck(pg,2,5); await settle(); ok('and clears them all again', (await dg(pg)).notes.length===0);
await seg(pg,0,'tool','root'); await settle();
ok('Set root shows a crosshair', (await q(pg,0,'canvas','cursor'))==='crosshair');
await neck(pg,3,2); await settle(); d=await dg(pg);   // D string fret 2 = E
ok('one click sets the root (and the key), then the tool returns to placing', d.rootPC===4 && d.key==='E' && (await pressed(pg,0,'tool'))==='Place / remove' && d.notes.includes('3_2'), JSON.stringify(d));
ok('Clear root is enabled now, and clears it', !(await q(pg,0,'.clearRootBtn','disabled'))); await btn(pg,0,'.clearRootBtn'); await settle();
ok('the root is gone and the button says so', (await dg(pg)).rootPC===null && (await q(pg,0,'.clearRootBtn','disabled')) && /no root/.test(await q(pg,0,'.clearRootBtn','title')));

// ================= Invert, never hidden =================
pg=await fresh();
ok('Invert is visible but disabled with no notes, and says why', !(await q(pg,0,'.invertUpBtn','display')==='none') && await q(pg,0,'.invertUpBtn','disabled') && /at least two notes/.test(await q(pg,0,'.invertUpBtn','title')));
await neck(pg,3,2); await neck(pg,2,4); await neck(pg,1,3); await settle();
ok('with notes it is enabled and explains itself', !(await q(pg,0,'.invertUpBtn','disabled')) && /lowest-pitched/.test(await q(pg,0,'.invertUpBtn','title')));

// ================= Move pattern =================
pg=await fresh(); await sel(pg,0,'.keySel','A'); await sel(pg,0,'.patternSel','scale:minorPentatonic'); await settle();
ok('Move pattern starts at 0', (await q(pg,0,'.shiftLabel','text'))==='0');
await btn(pg,0,'.shiftUpBtn'); await btn(pg,0,'.shiftUpBtn'); await settle(); d=await dg(pg);
ok('it shows where the pattern went: +2 · A to B', (await q(pg,0,'.shiftLabel','text'))==='+2 · A to B', await q(pg,0,'.shiftLabel','text'));
ok('a moved pattern is the same pattern in a new key, still live, and its name follows', d.key==='B' && d.title==='B Minor Pentatonic' && d.pattern==='scale:minorPentatonic', d.title);

// ================= Show =================
await seg(pg,0,'show','interval'); await settle(); ok('Show is a segmented control and it works', (await pressed(pg,0,'show'))==='Intervals' && (await dg(pg)).displayMode==='interval');

// ================= collapse in place =================
pg=await fresh(); await sel(pg,0,'.keySel','A'); await sel(pg,0,'.patternSel','scale:minorPentatonic'); await pg.click('#addDiagramBtn'); await settle();
ok('controls are open by default; the toggle offers to hide them', (await q(pg,0,'.collapseBtn','text'))==='Hide controls' && (await q(pg,0,'.controls','display'))!=='none');
await btn(pg,0,'.collapseBtn'); await settle();
ok('collapsing folds the controls and title field away', (await q(pg,0,'.controls','display'))==='none' && (await q(pg,0,'.title-input','display'))==='none' && (await q(pg,0,'.collapseBtn','aria-expanded'))==='false');
ok('the diagram, its title and legend stay: the canvas is still there and tall', await pg.evaluate(()=>{const c=document.querySelector('.fretCanvas'); return c.getBoundingClientRect().height>200 && getComputedStyle(c).display!=='none'}));
ok('a one-line summary replaces the controls', (await q(pg,0,'.summary','display'))!=='none' && (await q(pg,0,'.summary','text'))==='Standard (E A D G B E) · A Minor Pentatonic · frets 0–22', await q(pg,0,'.summary','text'));
ok('the other diagram is untouched', (await q(pg,1,'.controls','display'))!=='none');
await pg.click('#undoBtn'); await settle(); ok('Undo unfolds it', (await q(pg,0,'.controls','display'))!=='none');
await pg.click('#redoBtn'); await settle(); ok('and Redo folds it again', (await q(pg,0,'.controls','display'))==='none');
ok('it is saved with the sheet', (await dg(pg)).collapsed===true);
await pg.reload(); await sleep(1500); ok('and survives a reload', (await q(pg,0,'.controls','display'))==='none' && (await q(pg,1,'.controls','display'))!=='none');
ok('with one still open, the page button offers to hide all', (await pg.$eval('#collapseAllBtn',e=>e.textContent))==='Hide all controls');
await pg.click('#collapseAllBtn'); await settle();
ok('Hide all controls folds every diagram, and the button flips', (await pg.$$eval('.controls',c=>c.every(e=>getComputedStyle(e).display==='none'))) && (await pg.$eval('#collapseAllBtn',e=>e.textContent))==='Show all controls');
await pg.click('#collapseAllBtn'); await settle(); ok('Show all controls brings them all back', await pg.$$eval('.controls',c=>c.every(e=>getComputedStyle(e).display!=='none')));

// ================= naming, and the flat sheet =================
ok('the toolbar says Neck: Horizontal / Vertical', await pg.evaluate(()=>[...document.querySelectorAll('.toolbar label')].some(l=>l.textContent.trim()==='Neck') && document.getElementById('landscapeBtn').textContent==='Horizontal' && document.getElementById('portraitBtn').textContent==='Vertical'));
ok('no card chrome: transparent, unblurred, no glow', await pg.evaluate(()=>{const c=getComputedStyle(document.querySelector('.diagram-card')); return c.backgroundColor==='rgba(0, 0, 0, 0)' && (c.backdropFilter==='none'||c.backdropFilter==='') && c.boxShadow==='none' && c.borderLeftWidth==='0px'}));
ok('the neck sits on the page: the canvas ground is transparent', await pg.evaluate(()=>{const c=document.querySelector('.fretCanvas'); const g=c.getContext('2d'); return g.getImageData(2,2,1,1).data[3]===0}));

// ================= older sheets =================
pg=await fresh(); await pg.evaluate(()=>localStorage.setItem('musictools.fretboard.sheet',JSON.stringify({v:1,orientation:'landscape',diagrams:[{title:'Old',instrument:'guitar',preset:'standard6',firstFret:0,lastFret:22,notes:['0_5','1_5'],rootPC:null,displayMode:'name',shift:0,key:'D',scale:'dorian',chord:'minor'}]})));
await pg.reload(); await sleep(1500);
ok('a sheet saved before live patterns opens as custom notes, key kept', (await q(pg,0,'.patternSel option:first-child','text'))==='Custom notes' && (await q(pg,0,'.keySel','value'))==='D' && (await q(pg,0,'.patstate','text'))==='edited');
ok('no page errors', errs.length===0, errs.join(' | '));
console.log(out.join('\n')); console.log(`\n${out.filter(x=>x.startsWith('PASS')).length}/${out.length} passed`); await b.close();
