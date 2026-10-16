// Intensive browser test: plays the real game in headless Chromium as a phone held sideways,
// using real touch events (CDP), not mouse clicks. Run: npm run e2e
// Env: CHROMIUM=/path/to/chrome. Screenshots go to ./test-results/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serveDir = process.env.SERVE_DIR ? path.resolve(process.env.SERVE_DIR) : root;
const require = createRequire(import.meta.url);
let pw;
for (const p of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { pw = require(p); break; } catch {} }
if (!pw) { console.error('Playwright is not installed: npm i -D playwright'); process.exit(1); }
const out = path.join(root, 'test-results');
fs.mkdirSync(out, { recursive: true });
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let f = path.join(serveDir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(serveDir) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/index.html`;
const exe = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const browser = await pw.chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

let failed = 0, passed = 0;
const check = (ok, name, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info !== '' ? `  (${info})` : ''}`);
  if (ok) passed++; else failed++;
};
const wait = (page, ms) => page.waitForTimeout(ms);

// ---------------------------------------------------------------- phone helpers (real touches)
async function phone(opts = {}) {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, ...opts });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|fonts\.g/.test(m.text())) errors.push(m.text()); });
  const cdp = await page.context().newCDPSession(page);
  const touches = new Map(); // id -> {x,y}
  const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...touches.entries()].map(([id, p]) => ({ x: p.x, y: p.y, id })) });
  const t = {
    async down(id, x, y) { touches.set(id, { x, y }); await send('touchStart'); },
    async move(id, x, y) { touches.set(id, { x, y }); await send('touchMove'); },
    async up(id) {
      const p = touches.get(id); touches.delete(id);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [...touches.entries()].map(([i, q]) => ({ x: q.x, y: q.y, id: i })) });
      return p;
    },
    async cancel() { touches.clear(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); },
    async tap(x, y) { await t.down(9, x, y); await wait(page, 40); await t.up(9); await wait(page, 60); },
    async tapEl(sel, nth = 0) {
      const b = await page.locator(sel).nth(nth).boundingBox();
      if (!b) throw new Error('not visible: ' + sel);
      await t.tap(b.x + b.width / 2, b.y + b.height / 2);
    },
    async center(sel) { const b = await page.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; },
  };
  return { page, errors, t };
}

const G = (page, f, arg) => page.evaluate(f, arg);
// wait for game time (not wall time): the headless software renderer can be much slower than a phone
async function waitGame(page, secs) {
  const t0 = await G(page, () => handball.game.time);
  await page.waitForFunction(([t0, s]) => handball.game.time - t0 >= s, [t0, secs], { timeout: 20000, polling: 50 });
}
const me = (page) => G(page, () => { const g = handball.game, c = g.controlled; return c && { id: c.id, x: c.x, y: c.y, sp: Math.hypot(c.vx, c.vy), state: g.state, stick: handball.input.stick.id }; });

async function startMatch(P, team = 0, power = 0) {
  const { page, t } = P;
  await page.goto(url);
  await wait(page, 1200);
  await t.tapEl('#play');
  await wait(page, 300);
  await t.tapEl('#pickTeams .pick-card', team);
  await wait(page, 300);
  await t.tapEl('#pickPowers .pick-card', power);
  await page.waitForFunction(() => handball.mode === 'play' && handball.game.state === 'play', null, { timeout: 15000 });
}

const run = async (name, fn) => {
  if (ONLY && !ONLY.includes(name)) return;
  console.log(`\n--- ${name}`);
  try { await fn(); } catch (e) { check(false, `${name} crashed`, e.message.split('\n')[0]); }
};

// ---------------------------------------------------------------- 1. start flow, Hebrew, fonts, music
await run('flow', async () => {
  const P = await phone();
  const { page, t, errors } = P;
  await page.addInitScript(() => {
    const AC = window.AudioContext; window.__acs = [];
    window.AudioContext = function (...a) { const c = new AC(...a); window.__acs.push(c); c.__an = c.createAnalyser(); return c; };
    window.AudioContext.prototype = AC.prototype;
    const conn = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (d, ...r) { if (d instanceof AudioDestinationNode && this.context.__an) conn.call(this, this.context.__an); return conn.call(this, d, ...r); };
  });
  await page.goto(url);
  await wait(page, 1500);
  check(/WebGL 2|Canvas/.test(await page.textContent('#gfx')), 'renderer starts');
  const font = await G(page, () => getComputedStyle(document.querySelector('h1')).fontFamily + ' ' + getComputedStyle(document.querySelector('h1')).fontWeight);
  check(/Rubik/.test(font) && /900/.test(font), 'title uses the heavy Hebrew font', font);
  await page.screenshot({ path: `${out}/01-menu.png` });
  await t.tapEl('#play');
  await wait(page, 400);
  check(await page.isVisible('#pickTeams'), 'tap Play -> pick a team');
  const teams = await page.locator('#pickTeams .pick-card b').allTextContents();
  check(teams.length === 3 && teams.some((s) => s.includes('אייל')) && teams.some((s) => s.includes('אמה')) && teams.some((s) => s.includes('איתן')), 'three kids\' teams', teams.join(' | '));
  await page.screenshot({ path: `${out}/02-pick-team.png` });
  await t.tapEl('#pickTeams .pick-card', 2);
  await wait(page, 400);
  const powers = await page.locator('#pickPowers .pick-card b').allTextContents();
  check(powers.length === 5 && powers.some((s) => s.includes('קרח')), 'five powers incl. ice', powers.join(' | '));
  await page.screenshot({ path: `${out}/03-pick-power.png` });
  await t.tapEl('#pickPowers .pick-card', powers.findIndex((s) => s.includes('קרח')));
  await page.waitForFunction(() => handball.mode === 'play', null, { timeout: 5000 });
  await wait(page, 1500);
  check(await page.isVisible('#hud') && await page.isVisible('#stick') && await page.isVisible('#btnB'), 'match starts with arrow pad and buttons');
  const labels = await G(page, () => ['#lA', '#lB', '#btnP span', '#btnP small', '#half', '.board .home .abbr', '#bTitle'].map((s) => document.querySelector(s).textContent).join(' '));
  check(!/[A-Za-z]/.test(labels), 'in-game labels are Hebrew', labels);
  check(await G(page, () => handball.game.profile.id) === 'eyal' && await G(page, () => handball.game.template.key) === 'ice', 'picked Eyal with the ice power');
  let peak = 0;
  for (let i = 0; i < 12; i++) { peak = Math.max(peak, await G(page, () => { const c = window.__acs[0]; if (!c) return 0; const d = new Float32Array(2048); c.__an.getFloatTimeDomainData(d); return Math.max(...d.map(Math.abs)); })); await wait(page, 100); }
  check(peak > 0.1, 'music is playing', `peak ${peak.toFixed(2)}`);
  await page.screenshot({ path: `${out}/04-match.png` });
  check(errors.length === 0, 'no page errors (flow)', errors.slice(0, 2).join(' | '));
  await page.close();
});

// ---------------------------------------------------------------- 2. control: nothing moves by itself; joystick never sticks
await run('control', async () => {
  const P = await phone();
  const { page, t, errors } = P;
  await startMatch(P, 0, 0);
  // a) hands off: our player must stand still
  let maxSp = 0, samples = 0;
  for (let i = 0; i < 15; i++) {
    const m = await me(page);
    if (m && m.state === 'play' && m.stick === null) { maxSp = Math.max(maxSp, m.sp); samples++; }
    await wait(page, 150);
  }
  check(samples > 5 && maxSp < 0.6, 'hands off: our player does not move by itself', `max speed ${maxSp.toFixed(2)} m/s over ${samples} samples`);
  // b) drag in 8 directions, release, must stop every time
  const c = await t.center('#stick');
  const dirs = [[1, 0], [-1, 0], [0, -1], [0, 1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  let stuck = 0, movedOk = 0;
  for (const [dx, dy] of dirs) {
    await t.down(1, c.x, c.y);
    await t.move(1, c.x + dx * 25, c.y + dy * 25);
    await t.move(1, c.x + dx * 50, c.y + dy * 50);
    await waitGame(page, 0.5);
    const m1 = await me(page);
    if (m1 && m1.sp > 1.5) movedOk++;
    await t.up(1);
    await waitGame(page, 0.4);
    const m2 = await me(page);
    const fair = await G(page, () => handball.game.state === 'play' && !(handball.game.splash > 0) && !(handball.game.controlled.frozen > 0));
    if (!m2 || m2.stick !== null || (fair && m2.id === m1.id && m2.sp > 0.8)) {
      stuck++;
      console.log('   stuck detail', JSON.stringify({ before: m1, after: m2, dbg: await G(page, () => { const g = handball.game, c = g.controlled; return { owner: g.ball.owner && g.ball.owner.id, air: c.air, state: g.state, splash: g.splash, lock: !!g.lock, inp: [handball.input.state.mx, handball.input.state.my], frozen: c.frozen }; }) }));
    }
  }
  check(movedOk >= 7, 'the hero runs while the pad is held', `${movedOk}/8 directions`);
  check(stuck === 0, 'the hero stops every time the thumb lifts', `${stuck} stuck`);
  // c) drag far outside the pad and off the left half, then release
  await t.down(1, c.x, c.y); await t.move(1, c.x + 300, c.y - 200); await waitGame(page, 0.3); await t.up(1); await waitGame(page, 0.4);
  let m = await me(page);
  check(m.stick === null && m.sp < 0.8, 'release after dragging far away still stops', `speed ${m.sp.toFixed(2)}`);
  // d) two thumbs: hold the pad, tap buttons, lift in both orders
  const b = await t.center('#btnB'), a = await t.center('#btnA');
  for (let k = 0; k < 4; k++) {
    await t.down(1, c.x, c.y); await t.move(1, c.x + 40, c.y);
    await t.down(2, b.x, b.y); await wait(page, 120);
    if (k % 2) { await t.up(1); await t.up(2); } else { await t.up(2); await t.up(1); }
    await t.down(3, a.x, a.y); await t.up(3);
    await waitGame(page, 0.4);
  }
  m = await me(page);
  check(m.stick === null && await G(page, () => !handball.input.touchB), 'two-thumb play: pad and buttons all released', `stick ${m.stick}, speed ${m.sp.toFixed(2)}`);
  // e) a touch that is cancelled (system gesture) must also release
  await t.down(1, c.x, c.y); await t.move(1, c.x - 40, c.y);
  await t.cancel();
  await wait(page, 400);
  m = await me(page);
  check(m.stick === null, 'a cancelled touch releases the pad');
  // f) a new touch always takes over even if an old one was never released
  await G(page, () => { handball.input.stick.id = 999; });
  await t.down(1, c.x, c.y); await t.move(1, c.x + 50, c.y); await wait(page, 400);
  const took = (await me(page)).stick !== 999;
  await t.up(1); await wait(page, 300);
  check(took && (await me(page)).stick === null, 'a stale stuck touch is replaced by the next touch');
  // g) pause and resume with a thumb on the pad
  await t.down(1, c.x, c.y); await t.move(1, c.x, c.y - 50);
  await G(page, () => document.querySelector('#btnPause').click());
  await t.up(1);
  await wait(page, 200);
  await t.tapEl('#resume');
  await wait(page, 500);
  m = await me(page);
  check(m.stick === null && m.sp < 0.8, 'after pause/resume nothing is held');
  check(errors.length === 0, 'no page errors (control)', errors.slice(0, 2).join(' | '));
  await page.close();
});

// ---------------------------------------------------------------- 3. no page zoom
await run('zoom', async () => {
  const P = await phone();
  const { page, t } = P;
  await startMatch(P);
  const spots = [[422, 195], [700, 120], [120, 300], [780, 330], [422, 40]];
  for (const [x, y] of spots) { await t.tap(x, y); await wait(page, 80); await t.tap(x, y); await wait(page, 250); }
  const scale = await G(page, () => (window.visualViewport ? visualViewport.scale : 1));
  check(Math.abs(scale - 1) < 0.01, 'double taps never zoom the page', `scale ${scale}`);
  await page.close();
});

// ---------------------------------------------------------------- 4. POWER with real taps, every template
await run('power', async () => {
  const keys = ['lightning', 'fire', 'muscle', 'ice', 'captain'];
  for (let i = 0; i < keys.length; i++) {
    const P = await phone();
    const { page, t, errors } = P;
    await startMatch(P, i % 3, i);
    check(await G(page, () => handball.game.template.key) === keys[i], `${keys[i]}: picked`);
    check(await G(page, () => document.querySelector('#btnP').classList.contains('ready')), `${keys[i]}: POWER is full at kick-off`);
    // POWER at a throw-off / free throw works too
    if (i === 0) {
      await G(page, () => { const g = handball.game; g.setPiece('freethrow', 0, 15, 10); });
      await t.tapEl('#btnP');
      await waitGame(page, 0.05);
      check(await G(page, () => !!handball.game.ball.power && handball.game.splash > 0), 'POWER works during a free throw');
      await page.waitForFunction(() => !(handball.game.splash > 0), null, { timeout: 15000 });
      await G(page, () => { const g = handball.game; g.ball.power = null; g.teams[0].energy = 100; g.state = 'play'; g.lock = null; });
    }
    // make sure our team has the ball, then tap POWER
    await G(page, () => { const g = handball.game; g.setOwner(g.teams[0].players.find((p) => p.role === 'LB')); });
    await t.tapEl('#btnP');
    await wait(page, 150);
    const fired = await G(page, () => ({ splash: handball.game.splash > 0, power: handball.game.ball.power }));
    check(fired.splash && !!fired.power, `${keys[i]}: tapping POWER fires it`, JSON.stringify(fired));
    await wait(page, 700);
    await page.screenshot({ path: `${out}/10-power-${keys[i]}-closeup.png` });
    await page.waitForFunction(() => !(handball.game.splash > 0), null, { timeout: 8000 });
    if (keys[i] === 'ice') check(await G(page, () => handball.game.teams[1].players.filter((p) => p.active && p.frozen > 0).length >= 6), 'ice: rivals are frozen');
    // move the carrier near goal and shoot with a real tap
    await G(page, () => { const g = handball.game, c = g.ball.owner, ax = g.teams[0].defX === 0 ? 40 : 0; c.x = ax + (ax ? -9 : 9); c.y = 9.5; });
    await wait(page, 200);
    await page.screenshot({ path: `${out}/11-power-${keys[i]}-ball.png` });
    const pre = await G(page, () => { const g = handball.game; return { owner: g.ball.owner && g.ball.owner.id, ctrl: g.controlled && g.controlled.id, state: g.state, power: g.ball.power, splash: g.splash }; });
    const shots0 = await G(page, () => handball.game.teams[0].stats.shots);
    await t.tapEl('#btnB');
    await waitGame(page, 0.15);
    // the shot left the hand with the power (it may already be in the net or blocked: muscle can be blocked)
    const flew = await G(page, (s0) => handball.game.teams[0].stats.shots > s0, shots0);
    check(flew, `${keys[i]}: powered shot flies`, flew ? '' : JSON.stringify({ pre, post: await G(page, () => { const g = handball.game; return { owner: g.ball.owner && g.ball.owner.id, state: g.state, bstate: g.ball.state, power: g.ball.power, msg: g.msg && g.msg.title }; }) }));
    await page.screenshot({ path: `${out}/12-power-${keys[i]}-shot.png` });
    // armed power: rivals have the ball
    await page.waitForFunction(() => !handball.game.ball.power && !(handball.game.splash > 0) && handball.game.state === 'play', null, { timeout: 60000 });
    await G(page, () => { const g = handball.game; g.teams[0].energy = 100; g.setOwner(g.teams[1].players.find((p) => p.role === 'CB')); });
    await t.tapEl('#btnP');
    await wait(page, 150);
    const armed = await G(page, () => handball.game.powers.teams[0].armed);
    await G(page, () => { const g = handball.game; g.setOwner(g.teams[0].players.find((p) => p.role === 'RB')); });
    await wait(page, 100);
    const after = await G(page, () => { const g = handball.game; return { power: g.ball.power, owner: g.ball.owner && g.ball.owner.team, energy: Math.round(g.teams[0].energy), state: g.state, splash: g.splash, msg: g.msg && g.msg.title }; });
    check(armed && !!after.power, `${keys[i]}: POWER without the ball fires when we get it`, armed && after.power ? '' : JSON.stringify({ armed, after }));
    check(errors.length === 0, `${keys[i]}: no page errors`, errors.slice(0, 2).join(' | '));
    await page.close();
  }
});

// ---------------------------------------------------------------- 5. the computer's power and rival kids
await run('rival', async () => {
  const P = await phone();
  const { page, errors } = P;
  await startMatch(P);
  await G(page, () => { const g = handball.game, cb = g.teams[1].players.find((p) => p.role === 'CB'); g.setOwner(cb); g.powers.start(cb); });
  await wait(page, 600);
  await page.screenshot({ path: `${out}/20-rival-closeup.png` });
  check(await G(page, () => handball.game.splashInfo.hero.team === 1), 'the computer\'s hero close-up shows');
  check(errors.length === 0, 'no page errors (rival)', errors.slice(0, 2).join(' | '));
  await page.close();
});

// ---------------------------------------------------------------- 6. menus: pause, rules, menu, play again, portrait hint
await run('menus', async () => {
  const P = await phone();
  const { page, t, errors } = P;
  for (let k = 0; k < 3; k++) {
    await startMatch(P, k, k);
    await t.tapEl('#btnPause'); await wait(page, 200);
    await t.tapEl('#toRules'); await wait(page, 200);
    check(await page.isVisible('#rules'), `round ${k + 1}: How to play opens`);
    await t.tapEl('[data-close=rules]'); await wait(page, 150);
    await t.tapEl('#toMenu'); await wait(page, 400);
    check(await page.isVisible('#menu'), `round ${k + 1}: back to the menu`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await startMatch(P);
  await wait(page, 300);
  check(await page.isVisible('#rotate'), 'phone held upright: turn-sideways hint shows');
  check(errors.length === 0, 'no page errors (menus)', errors.slice(0, 2).join(' | '));
  await page.close();
});

// ---------------------------------------------------------------- 7. a whole match, fast-forwarded
await run('match', async () => {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto(url);
  await page.clock.runFor(1500);
  await page.evaluate(() => { localStorage.setItem('handball7', JSON.stringify({ half: '180', music: false })); });
  await page.reload();
  await page.clock.runFor(1500);
  await page.evaluate(() => { document.querySelector('#play').click(); document.querySelector('#pickTeams .pick-card').click(); document.querySelector('#pickPowers .pick-card').click(); });
  for (let i = 0; i < 40 && !(await page.isVisible('#break')); i++) await page.clock.runFor(5000);
  check(/מחצית/.test(await page.textContent('#brEyebrow')), 'half-time screen');
  await page.evaluate(() => document.querySelector('#brNext').click());
  await page.clock.runFor(2000);
  check((await page.evaluate(() => handball.game.teams.map((t) => t.defX))).join() === '40,0', 'teams switch ends');
  for (let i = 0; i < 40 && !(await page.isVisible('#break')); i++) await page.clock.runFor(5000);
  check(/סיום/.test(await page.textContent('#brEyebrow')), 'full-time screen', await page.textContent('#brScore'));
  check(errors.length === 0, 'no page errors (match)', errors.slice(0, 2).join(' | '));
  await page.close();
});

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
