// Runs every *.test.mjs in turn and reports one line each. A suite only counts as
// passing if it printed an "N/N passed" summary and no FAIL lines, so a suite that
// crashes (no summary) is a failure, never "no failures".
//
//   node run-all.mjs             all suites
//   node run-all.mjs frame       only suites whose file name contains "frame"
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2];
const files = fs.readdirSync(here).filter(f => f.endsWith('.test.mjs') && (!filter || f.includes(filter))).sort();
if (!files.length){ console.error('No test files matched.'); process.exit(1); }

let bad = 0;
for (const f of files){
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(here, f)], { encoding: 'utf8', timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '');
  const fails = out.split('\n').filter(l => l.startsWith('FAIL'));
  const m = /^(\d+)\/(\d+) passed$/m.exec(out);
  const ok = !!m && m[1] === m[2] && !fails.length && r.status === 0;
  const secs = ((Date.now() - t0) / 1000).toFixed(0) + 's';
  if (ok) console.log('OK    ' + f.padEnd(34) + m[0] + '  (' + secs + ')');
  else {
    bad++;
    console.log('FAIL  ' + f.padEnd(34) + (m ? m[0] : 'no summary: the suite crashed') + '  (' + secs + ')');
    fails.slice(0, 8).forEach(l => console.log('        ' + l.slice(0, 200)));
    if (!m) console.log(out.split('\n').filter(Boolean).slice(-6).map(l => '        ' + l.slice(0, 200)).join('\n'));
  }
}
console.log(bad ? `\n${bad} of ${files.length} suites failed` : `\nall ${files.length} suites passed`);
process.exit(bad ? 1 : 0);
