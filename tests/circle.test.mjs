import { INDEX, launch } from './lib.mjs';
const url=INDEX;
const b=await launch();
const pg=await b.newPage(); await pg.setViewport({width:1440,height:1000});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const out=[]; const ok=(n,c,x='')=>out.push((c?'PASS ':'FAIL ')+n+(x?'  ['+x+']':''));
const T=(sel)=>pg.$eval(sel,e=>e.textContent.trim());
const cnt=(sel)=>pg.$$eval(sel,n=>n.length);
const tap=(nm)=>pg.$$eval('.cnode',(ns,nm)=>ns.find(n=>n.querySelector('.cn').textContent===nm).dispatchEvent(new MouseEvent('click',{bubbles:true})),nm);
const hash=()=>pg.evaluate(()=>location.hash);

await pg.goto(url+'#circle'); await pg.waitForSelector('#famBtns .chip');
ok('scaffolding gone', await pg.evaluate(()=>!document.querySelector('.mock-switch,#chipsO,#chipsI,#circleApp select')));
ok('readout tiles', (await T('#n1'))==='C Ionian' && (await T('#n2'))==='A Aeolian' && (await T('#n2n'))==='natural minor', await T('#n1')+' / '+await T('#n2')+' / '+await T('#n2n'));
ok('readout sits above the wheel', await pg.evaluate(()=>document.querySelector('.rings').getBoundingClientRect().bottom<=document.querySelector('.stage').getBoundingClientRect().top+1));
ok('readout tiles centred text', await pg.$eval('.rtile',e=>getComputedStyle(e).textAlign==='center'));
ok('hub: letter + glow', (await T('#hk'))==='C' && await pg.$eval('#hk',e=>getComputedStyle(e).textShadow!=='none'));
// notation: focus C Ionian = outer figure
ok('outer figure: 1 teal home note (A), rest orange', (await cnt('#figScale .head.ri'))===1 && (await cnt('#figScale .head.ro'))===7, (await cnt('#figScale .head.ri'))+' teal / '+(await cnt('#figScale .head.ro'))+' orange');
ok('teal note is degree 6', await pg.$eval('#figScale .deg.ri',e=>e.textContent.trim())==='6');
ok('big chord name is orange class', await pg.$eval('#dName',e=>e.classList.contains('ro')));
// tap Am with assign=outer -> outer becomes Aeolian; figure now inner+outer same? (mo=mi)
await tap('Am');
ok('tap Am (outer): both rings A Aeolian', (await T('#n1'))==='A Aeolian' && (await T('#n2'))==='A Aeolian');
ok('same mode both: only orange, no teal', (await cnt('#figScale .head.ri'))===0 && (await cnt('#figScale .head.ro'))===8);
await pg.click('#asgO'); await tap('C');
await pg.click('#asgI'); await tap('Am');  // outer C Ionian? (assign inner)
// now outer=Aeolian(A)... reset explicitly via hash
await pg.goto(url+'#circle/terminal/0.0.5.0'); await pg.waitForSelector('#famBtns .chip');
await pg.click('#asgI'); await tap('Am');
ok('inner=A Aeolian, outer=C Ionian', (await T('#n1'))==='C Ionian' && (await T('#n2'))==='A Aeolian');
// inner figure: teal base, C orange
await tap('Am');
ok('inner figure: teal base, C picked out orange', (await cnt('#figScale .head.ro'))===1 && (await cnt('#figScale .head.ri'))===7, (await cnt('#figScale .head.ro'))+' orange / '+(await cnt('#figScale .head.ri'))+' teal');
ok('big chord name is teal class', await pg.$eval('#dName',e=>e.classList.contains('ri')));
// neither ring: Sheet row for Dm
await pg.click('#tabS');
await pg.$$eval('.srow',rs=>rs.find(r=>r.querySelector('.ssym').textContent==='Dm').click());
ok('neither-ring figure: ink base, C orange, A teal', (await cnt('#figScale .head.ro'))===1 && (await cnt('#figScale .head.ri'))===1 && (await cnt('#figScale .head:not(.ro):not(.ri)'))===6, [await cnt('#figScale .head.ro'),await cnt('#figScale .head.ri'),await cnt('#figScale .head:not(.ro):not(.ri)')].join('/'));
ok('name neutral class', await pg.$eval('#dName',e=>!e.classList.contains('ro')&&!e.classList.contains('ri')));
await pg.click('#tabS');
ok('sheet: outer+inner rows marked', (await cnt('.srow.tonic'))===1 && (await cnt('.srow.tonic2'))===1);
// sheet order starts on the outer ring's own chord, then continues the same
// descending-fifths cycle around from there
await pg.goto(url+'#circle/terminal/0.0.5.0'); await pg.waitForSelector('#famBtns .chip');
await pg.click('#asgO'); await tap('F'); await pg.click('#tabS');
ok('sheet starts on outer ring chord, then cycles in fourths', (await pg.$$eval('.srow .ssym',es=>es.map(e=>e.textContent).join(' '))) === 'F B° Em Am Dm G C', await pg.$$eval('.srow .ssym',es=>es.map(e=>e.textContent).join(' ')));
await tap('C'); // undo the tap above: later checks expect the major family's remembered outer ring still at C
// family switch, memory, long names fit
await pg.$$eval('#famBtns .chip',bs=>bs[2].click());
ok('family=Harmonic minor readout', (await T('#n1')).includes('Harmonic minor'), await T('#n1'));
await pg.click('#asgO'); await tap('Dm');
ok('long mode name shown in tile', (await T('#n1')).length>8, await T('#n1'));
await pg.$$eval('#famBtns .chip',bs=>bs[0].click());
ok('family memory restored', (await T('#n1'))==='C Ionian' && (await T('#n2'))==='A Aeolian', await T('#n1')+' / '+await T('#n2'));
const h0=await hash(); await pg.focus('.stage'); await pg.keyboard.press('ArrowRight');
ok('arrow key turns wheel', (await hash())!==h0);
// ---- new: note names, layout
await pg.goto(url+'#circle/terminal/0.0.5.0'); await pg.waitForSelector('#famBtns .chip');
ok('note names under scale staff', (await pg.$$eval('#figScale .nm',n=>n.map(x=>x.textContent).join(' ')))==='C D E F G A B C');
ok('note names under arpeggio', (await pg.$$eval('#figArp .nm',n=>n.map(x=>x.textContent).join(' ')))==='C E G B D F A');
ok('names carry ring colour (A teal)', await pg.$eval('#figScale .nm.ri',e=>e.textContent)==='A');
await pg.$$eval('#famBtns .chip',bs=>bs[1].click());
ok('names show accidentals (melodic minor has E♭)', (await pg.$$eval('#figScale .nm',n=>n.map(x=>x.textContent))).some(t=>t.includes('♭')));
await pg.$$eval('#famBtns .chip',bs=>bs[0].click());
for (const [w,h] of [[1440,900],[1024,800],[390,800]]){
  await pg.setViewport({width:w,height:h});
  const m=await pg.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth,stage:document.querySelector('.stage').getBoundingClientRect().width,ws:document.querySelector('.wheel-stage').getBoundingClientRect().width}));
  ok(`layout ${w}px: no horizontal scroll, wheel visible`, m.sw<=m.iw && m.stage>250, JSON.stringify(m));
}
await pg.setViewport({width:1440,height:900});
ok('wheel fully inside first screen at 1440x900 (minus readout)', await pg.evaluate(()=>document.querySelector('.stage').getBoundingClientRect().bottom<=900));
ok('side by side at desktop', await pg.evaluate(()=>{const a=document.querySelector('.stage').getBoundingClientRect(), c=document.querySelector('#ring').getBoundingClientRect(); return c.left>a.right && Math.abs((a.top+a.bottom)/2-(c.top+c.bottom)/2)<200}));
ok('notation is full width below', await pg.evaluate(()=>{const n=document.querySelector('#notationCard').getBoundingClientRect(), a=document.querySelector('.ex-wheels').getBoundingClientRect(); return n.top>=a.bottom && n.width>1000}));

ok('no page errors', errs.length===0, errs.join(' | '));
console.log(out.join('\n')); console.log(`\n${out.filter(x=>x.startsWith('PASS')).length}/${out.length} passed`); await b.close();
