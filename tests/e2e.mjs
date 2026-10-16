// Browser test: plays the real game in headless Chromium with a phone-sized touch screen.
// Run: npm run e2e        (needs Playwright: npm i -D playwright, or a global install)
// Env: CHROMIUM=/path/to/chrome to use a specific browser binary. Screenshots go to ./test-results/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let pw;
for (const p of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { pw = require(p); break; } catch {} }
if (!pw) { console.error('Playwright is not installed: npm i -D playwright'); process.exit(1); }

const out = path.join(root, 'test-results');
fs.mkdirSync(out, { recursive: true });

// tiny static server
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let f = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/index.html`;

const exe = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const browser = await pw.chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

let failed = 0;
const check = (ok, name, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`);
  if (!ok) failed++;
};

// Tap every connection to the speakers with an analyser, so the test can "hear" the game.
const audioProbe = () => {
  const AC = window.AudioContext;
  window.__acs = [];
  window.AudioContext = function (...a) { const c = new AC(...a); window.__acs.push(c); c.__an = c.createAnalyser(); c.__an.fftSize = 2048; return c; };
  window.AudioContext.prototype = AC.prototype;
  const conn = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dst, ...r) {
    if (dst instanceof AudioDestinationNode && this.context.__an) conn.call(this, this.context.__an);
    return conn.call(this, dst, ...r);
  };
};

async function loudness(page, ms = 1500) {
  let peak = 0;
  for (let t = 0; t < ms; t += 100) {
    peak = Math.max(peak, await page.evaluate(() => {
      const c = window.__acs && window.__acs[0];
      if (!c) return 0;
      const d = new Float32Array(2048); c.__an.getFloatTimeDomainData(d);
      let p = 0; for (const v of d) p = Math.max(p, Math.abs(v));
      return p;
    }));
    await page.waitForTimeout(100);
  }
  return peak;
}

// ---------------------------------------------------------------- 1. real-time play on a phone
{
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(audioProbe);
  await page.goto(url);
  await page.waitForTimeout(1200);
  const gfx = await page.textContent('#gfx');
  check(/WebGL 2|Canvas/.test(gfx), 'renderer starts', gfx);
  await page.screenshot({ path: `${out}/1-menu.png` });

  await page.tap('body', { position: { x: 700, y: 150 } });
  const menuPeak = await loudness(page);
  check(menuPeak > 0.1, 'music plays after the first tap', `peak ${menuPeak.toFixed(2)}`);

  await page.tap('#play');
  await page.waitForTimeout(1500);
  check(await page.isVisible('#hud'), 'match starts, scoreboard visible');
  check(await page.isVisible('#stick') && await page.isVisible('#btnB'), 'arrow pad and buttons visible on phone');

  // steer with the arrow pad: hold "right" for 1.5 s and check our hero moved right
  const before = await page.evaluate(() => { const c = handball.game.controlled; return c && { id: c.id, x: c.x }; });
  const pad = await page.locator('#stick').boundingBox();
  const cx = pad.x + pad.width / 2, cy = pad.y + pad.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 50, cy, { steps: 4 });
  await page.waitForTimeout(1500);
  const arrowLit = await page.evaluate(() => document.querySelector('.arr.right').classList.contains('on'));
  await page.screenshot({ path: `${out}/2-steering.png` });
  await page.mouse.up();
  const after = await page.evaluate((id) => { const p = handball.game.all.find((q) => q.id === id); return p && { x: p.x }; }, before.id);
  check(arrowLit, 'right arrow lights up while steering');
  check(after.x > before.x + 1.5, 'hero runs right when steering right', `${before.x.toFixed(1)} → ${after.x.toFixed(1)} m`);

  // play 20 s mashing the buttons
  const clock0 = await page.evaluate(() => handball.game.clock);
  for (let i = 0; i < 20; i++) {
    await page.tap(i % 2 ? '#btnA' : '#btnB');
    await page.waitForTimeout(900);
  }
  const st = await page.evaluate(() => {
    const g = handball.game;
    return { clock: g.clock, ok: g.all.every((p) => Number.isFinite(p.x + p.y)) && Number.isFinite(g.ball.x + g.ball.y), state: g.state };
  });
  check(st.clock - clock0 > 15, 'match clock runs in real time', `${(st.clock - clock0).toFixed(1)} s in ~19 s`);
  check(st.ok, 'all positions valid after 20 s of play');
  const matchPeak = await loudness(page);
  check(matchPeak > 0.1, 'music audible during the match', `peak ${matchPeak.toFixed(2)}`);
  await page.screenshot({ path: `${out}/3-match.png` });

  await page.tap('#btnMusic');
  await page.waitForTimeout(800);
  check(await page.evaluate(() => document.querySelector('#btnMusic').classList.contains('off')), 'music button switches music off');

  await page.tap('#btnPause');
  const p0 = await page.evaluate(() => handball.game.clock);
  await page.waitForTimeout(1200);
  const p1 = await page.evaluate(() => handball.game.clock);
  check(await page.isVisible('#pause') && p1 === p0, 'pause stops the clock');
  await page.tap('#toRules');
  await page.waitForTimeout(300);
  check(await page.isVisible('#rules'), 'How to play opens from pause');
  await page.screenshot({ path: `${out}/4-how-to-play.png` });
  await page.tap('[data-close=rules]');
  await page.tap('#resume');
  await page.waitForTimeout(800);
  check((await page.evaluate(() => handball.game.clock)) > p1, 'resume restarts the clock');
  check(errors.length === 0, 'no errors in the page', errors.slice(0, 3).join(' | '));
  await page.close();
}

// ---------------------------------------------------------------- 2. a whole match, fast-forwarded
{
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto(url);
  await page.clock.runFor(1500);
  await page.evaluate(() => { localStorage.setItem('handball7', JSON.stringify({ half: '180', music: false })); });
  await page.reload();
  await page.clock.runFor(1500);
  await page.tap('#play');
  for (let i = 0; i < 40 && !(await page.isVisible('#break')); i++) await page.clock.runFor(5000);
  const ht = await page.textContent('#brEyebrow');
  check(/Half-time/.test(ht), 'half-time screen after the first half', ht);
  await page.screenshot({ path: `${out}/5-half-time.png` });
  await page.tap('#brNext');
  await page.clock.runFor(2000);
  const sides = await page.evaluate(() => handball.game.teams.map((t) => t.defX));
  check(sides[0] === 40 && sides[1] === 0, 'teams switch ends for the second half');
  for (let i = 0; i < 40 && !(await page.isVisible('#break')); i++) await page.clock.runFor(5000);
  const ft = await page.textContent('#brEyebrow');
  const score = await page.textContent('#brScore');
  check(/Full-time/.test(ft), 'full-time screen at the end', `${ft}, ${score}`);
  await page.screenshot({ path: `${out}/6-full-time.png` });
  check(errors.length === 0, 'no errors during the full match', errors.slice(0, 3).join(' | '));
  await page.close();
}

await browser.close();
server.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
