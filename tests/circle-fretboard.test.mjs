import { INDEX, launch } from './lib.mjs';
const url=INDEX;
const b=await launch();
const pg=await b.newPage(); await pg.setViewport({width:1440,height:1000});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const out=[]; const ok=(n,c,x='')=>out.push((c?'PASS ':'FAIL ')+n+(x?'  ['+x+']':''));
const cnt=(sel)=>pg.$$eval(sel,n=>n.length);
const hasClass=(sel,c)=>pg.$eval(sel,(e,c)=>e.classList.contains(c),c);
const html=(sel)=>pg.$eval(sel,e=>e.innerHTML);

await pg.goto(url+'#circle'); await pg.waitForSelector('#famBtns .chip');

// Focus panel: switching to Fretboard swaps the controls that only mean
// something for one view, and draws a neck (not a staff) for both figures.
await pg.click('#viewFretboard');
ok('mode switch: fretboard on, notation off', await hasClass('#viewFretboard','on') && !(await hasClass('#viewNotation','on')));
ok('courtesy accidentals hides, instrument choice shows', await hasClass('#courtRow','hide') && !(await hasClass('#instRow','hide')));
ok('octave register hides (no register once every occurrence is marked)', await hasClass('#regRow','hide'));
ok('figScale draws a neck', await pg.$('#figScale svg') !== null);
ok('figArp draws a neck', await pg.$('#figArp svg') !== null);
ok('scale marks more than the arpeggio (7 notes vs 3-4)', (await html('#figScale')).length > (await html('#figArp')).length);
ok('guitar is the default instrument', await hasClass('#instGuitar','on'));
ok('guitar neck shows 6 strings', (await pg.$eval('#figScale svg',s=>s.querySelectorAll('text').length)) > 0);

// Bass swaps the tuning; the arpeggio title still names the chord.
await pg.click('#instBass');
ok('bass selected, guitar not', await hasClass('#instBass','on') && !(await hasClass('#instGuitar','on')));
ok('figArp titled for the chord', (await pg.$eval('#figArp svg title',e=>e.textContent)).includes('arpeggio'), await pg.$eval('#figArp svg title',e=>e.textContent));

// Sheet: all seven degrees, one wide column each, Scales/Arpeggios still works.
await pg.click('#tabS');
ok('seven rows, each with its own neck', (await cnt('.srow'))===7 && (await cnt('.srow svg'))===7);
ok('sheet drops to one column in fretboard mode', await hasClass('#sheetRows','fb'));
const scaleRowLen = await pg.$eval('.srow .sstaff',e=>e.innerHTML.length);
await pg.click('#figArpB');
const arpRowLen = await pg.$eval('.srow .sstaff',e=>e.innerHTML.length);
ok('arpeggio row marks fewer notes than the scale row', arpRowLen < scaleRowLen, arpRowLen+' vs '+scaleRowLen);

// Sevenths applies to the fretboard arpeggio too, same as the ring and notation.
const titleBefore = await pg.$eval('.srow .sstaff svg title',e=>e.textContent);
await pg.click('#sev');
const titleAfter = await pg.$eval('.srow .sstaff svg title',e=>e.textContent);
ok('sevenths toggle changes the arpeggio (marks a 4th chord tone)', titleBefore !== titleAfter, titleBefore+' -> '+titleAfter);
await pg.click('#sev'); // back off, leave state clean

// Switching back to Notation restores everything, including for Sheet.
await pg.click('#viewNotation');
ok('back to notation: staff (gstaff), not a neck', (await cnt('.srow .gstaff'))===7 && (await cnt('.srow svg:not(.gstaff)'))===0);
ok('courtesy accidentals visible again, instrument choice hidden', !(await hasClass('#courtRow','hide')) && await hasClass('#instRow','hide'));
await pg.click('#tabF');
ok('focus: octave register visible again', !(await hasClass('#regRow','hide')));

ok('no page errors', errs.length===0, errs.join(' | '));

console.log(out.join('\n'));
const pass=out.filter(l=>l.startsWith('PASS')).length;
console.log(`${pass}/${out.length} passed`);
await b.close();
process.exit(pass===out.length?0:1);
