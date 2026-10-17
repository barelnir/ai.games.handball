// Runs the browser test (tests/e2e.mjs) section by section in parallel: each section gets its own
// Node process and browser, a few at a time, longest first. Same checks, a fraction of the time.
// Run: npm run e2e   ·   Env: JOBS=3 (parallel browsers), ONLY=flow,kids (some sections), E2E_DPR=2
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, 'e2e.mjs'), 'utf8');
let sections = [...src.matchAll(/^await run\('([\w-]+)'/gm)].map((m) => m[1]);
if (process.env.ONLY) sections = sections.filter((s) => process.env.ONLY.split(',').includes(s));
// the slow ones first, so the parallel slots finish together
const SLOW = ['power', 'match', 'control', 'teams', 'menus', 'kids', 'flow', 'view'];
sections.sort((a, b) => (SLOW.indexOf(a) + 1 || 99) - (SLOW.indexOf(b) + 1 || 99));
const jobs = Math.max(1, Number(process.env.JOBS) || Math.min(3, os.cpus().length - 1));

const t0 = Date.now();
const results = [];
function runOne(name) {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(process.execPath, [path.join(here, 'e2e.mjs')], { env: { ...process.env, ONLY: name }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    const kill = setTimeout(() => child.kill('SIGKILL'), 15 * 60 * 1000);
    child.on('close', (code) => {
      clearTimeout(kill);
      const lines = out.split('\n');
      const fails = lines.filter((l) => /^FAIL/.test(l));
      const passed = lines.filter((l) => /^PASS/.test(l)).length;
      const secs = ((Date.now() - start) / 1000).toFixed(0);
      const ok = code === 0 && fails.length === 0 && passed > 0;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(8)} ${String(passed).padStart(3)} passed, ${fails.length} failed  (${secs}s)`);
      for (const f of fails) console.log('   ' + f);
      if (!ok && !fails.length) console.log(out.split('\n').slice(-15).map((l) => '   ' + l).join('\n'));
      results.push({ name, ok, passed, failed: fails.length || (ok ? 0 : 1) });
      resolve();
    });
  });
}

const queue = [...sections];
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
  while (queue.length) await runOne(queue.shift());
}));
const passed = results.reduce((a, r) => a + r.passed, 0), failed = results.reduce((a, r) => a + r.failed, 0);
console.log(`\n${passed} passed, ${failed} failed  (${sections.length} sections, ${jobs} at a time, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
process.exit(failed ? 1 : 0);
