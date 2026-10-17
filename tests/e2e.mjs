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

const POWER_LABEL = { lightning: 'ברק', fire: 'אש', muscle: 'שרירים', ice: 'קרח', captain: 'קפטן', random: 'הפתעה' };
// home -> team (הצרעות) -> captain -> play; optionally cycle the captain's power chip to `power`
async function startMatch(P, kid = 0, power = null) {
  const { page, t } = P;
  await page.goto(url);
  await wait(page, 1200);
  await t.tapEl('#play');
  await wait(page, 300);
  await t.tapEl('#teamCards .lu-card:visible', 0);
  await wait(page, 300);
  await t.tapEl('.kid-card .kid-face', kid);
  await wait(page, 200);
  for (let i = 0; power && i < 7 && !(await page.textContent('#powerChip')).includes(POWER_LABEL[power]); i++) { await t.tapEl('#powerChip'); await wait(page, 60); }
  await t.tapEl('#go');
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
  check(await page.isVisible('#play') && !(await page.isVisible('#againBox')), 'first visit: one big play button');
  let taps = 0;
  await t.tapEl('#play'); taps++;
  await wait(page, 400);
  check(await page.isVisible('#stepTeam'), 'tap Play -> pick a team');
  const tabs = await page.locator('#teamTabs button').allTextContents();
  check(tabs.join() === 'ליגת הילדים,נבחרות', 'two tabs: kids\' league and national teams', tabs.join(' | '));
  const league = await page.locator('#teamCards .lu-card:visible b').allTextContents();
  check(league[0] === 'הצרעות' && league.includes('א.כ. נס ציונה'), 'הצרעות first, then the kids\' league', league.join(' | '));
  await page.screenshot({ path: `${out}/02-pick-team.png` });
  await t.tapEl('#teamCards .lu-card:visible', 0); taps++;
  await wait(page, 400);
  const kids = await page.locator('.kid-card b').allTextContents();
  check(kids.length === 4 && ['אייל', 'אמה', 'איתן', 'רפל'].every((n) => kids.includes(n)), 'four kids, רפל too', kids.join(' | '));
  await t.tapEl('.kid-card:has-text("אייל") .kid-face'); taps++;
  await wait(page, 300);
  check((await page.textContent('#powerChip')).includes('קרח'), 'Eyal comes with his own power: ice', await page.textContent('#powerChip'));
  check((await page.textContent('#oppChip')).includes('הצפעונים') && await page.isDisabled('#oppChip'), 'הצרעות always play הצפעונים (no shuffle)');
  const noOverflow = await G(page, () => [...document.querySelectorAll('#pick button')].filter((b) => b.offsetParent).every((b) => { const r = b.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1; }));
  check(noOverflow, 'everything on the kids screen fits the phone');
  await page.screenshot({ path: `${out}/03-pick-kids.png` });
  await t.tapEl('#go'); taps++;
  check(taps === 4, 'four taps from opening to the match');
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
  await t.down(1, c.x, c.y); await t.move(1, c.x + 300, c.y - 200); await waitGame(page, 0.3);
  const m0 = await me(page);
  await t.up(1); await waitGame(page, 0.4);
  let m = await me(page);
  const fairFar = await G(page, () => handball.game.state === 'play' && !(handball.game.splash > 0) && !(handball.game.controlled.frozen > 0));
  check(m.stick === null && !(fairFar && m.id === m0.id && m.sp > 0.8), 'release after dragging far away still stops', `speed ${m.sp.toFixed(2)}`);
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
    await startMatch(P, i % 4, keys[i]);
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
    await startMatch(P, k);
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
// ---------------------------------------------------------------- pick the players
await run('kids', async () => {
  const P = await phone();
  const { page, t, errors } = P;
  await page.goto(url); await wait(page, 1200);
  await t.tapEl('#play'); await wait(page, 300);
  await t.tapEl('#teamCards .lu-card:has-text("א.כ. נס ציונה")'); await wait(page, 300);
  const cls = (n) => G(page, (n) => [...document.querySelectorAll('.kid-card')].find((k) => k.textContent.includes(n)).className, n);
  check(/cap/.test(await cls('איתן')) && !/in/.test(await cls('אמה')), 'only the captain is on the team at first');
  // Eyal's power to fire, then Emma is captain (her own fire), then Eyal again: still fire
  await t.tapEl('.kid-card:has-text("אייל") .kid-face');
  for (let i = 0; i < 7 && !(await page.textContent('#powerChip')).includes('אש'); i++) await t.tapEl('#powerChip');
  await t.tapEl('.kid-card:has-text("אמה") .kid-face');
  check((await page.textContent('#powerChip')).includes('אש'), 'Emma has her own power (fire)', await page.textContent('#powerChip'));
  await t.tapEl('.kid-card:has-text("אייל") .kid-face');
  check((await page.textContent('#powerChip')).includes('אש'), 'each kid keeps the power they picked', await page.textContent('#powerChip'));
  // friends: Emma is in (she was captain before); add רפל, keep איתן out
  await t.tapEl('.kid-card:has-text("רפל") .kid-toggle');
  if (/in/.test(await cls('איתן'))) await t.tapEl('.kid-card:has-text("איתן") .kid-toggle');
  check(/in/.test(await cls('רפל')) && /in/.test(await cls('אמה')) && !/in/.test(await cls('איתן')), 'friends are added and removed with one tap');
  // the opponent chip re-rolls within the kids' league and never picks us
  const seen = new Set();
  for (let i = 0; i < 8; i++) {
    const txt = await page.textContent('#oppChip');
    seen.add(txt.replace(/ · עם .*/, '').replace(' 🔀', ''));
    if (/עם (אייל|אמה|רפל)/.test(txt)) check(false, 'the computer\'s kid is never one of ours', txt);
    await t.tapEl('#oppChip'); await wait(page, 50);
  }
  const opps = [...seen].join(' | ');
  check(seen.size >= 3 && ![...seen].some((x) => /נס ציונה|הצרעות|ישראל|ספרד/.test(x)), 'the opponent re-rolls among other kids\' clubs', opps);
  await page.screenshot({ path: `${out}/38-kids.png` });
  const chip = await page.textContent('#oppChip');
  await t.tapEl('#go');
  await page.waitForFunction(() => handball.mode === 'play', null, { timeout: 8000 });
  const g = await G(page, () => { const g = handball.game; return { mine: g.teams[0].players.map((p) => p.hero.nameHe), theirs: g.teams[1].players.map((p) => p.hero.nameHe), cb: g.teams[0].players.find((p) => p.role === 'CB').hero.nameHe, power: g.template.key, teams: g.teams.map((x) => x.kit.he), rivalKid: g.rivalProfile ? g.rivalProfile.nameHe : null }; });
  check(g.cb === 'אייל' && g.power === 'fire', 'Eyal is captain with the power he picked', `${g.cb} ${g.power}`);
  check(g.mine.includes('אמה') && g.mine.includes('רפל') && !g.mine.includes('איתן') && new Set(g.mine).size === 7, 'the friends play, nobody twice', g.mine.join(','));
  check(!g.mine.some((n) => ['סליל', 'היס', 'ניב', 'ארס', 'רעשן', 'זחל', 'פייתון'].includes(n)), 'no Vipers on our team', g.mine.join(','));
  check(g.teams[0] === 'א.כ. נס ציונה' && chip.includes(g.teams[1]) && (!g.rivalKid || chip.includes(g.rivalKid)), 'the match is exactly what the chip said', `${chip} -> ${g.teams.join(' - ')} ${g.rivalKid || ''}`);
  check(errors.length === 0, 'no errors on the kids screen', errors.join(' | '));
  await page.close();
});

await run('teams', async () => {
  const P = await phone();
  const { page, t, errors } = P;
  await page.goto(url); await wait(page, 1200);
  // national teams: רפל as captain for Israel
  await t.tapEl('#play'); await wait(page, 300);
  await t.tapEl('#teamTabs button[data-g="nation"]'); await wait(page, 200);
  const nations = await page.locator('#teamCards .lu-card:visible b').allTextContents();
  check(nations.includes('ישראל') && nations.includes('ספרד') && nations.length >= 10, 'national teams to pick', nations.join(' | '));
  await page.screenshot({ path: `${out}/39-nations.png` });
  await t.tapEl('#teamCards .lu-card:visible:has-text("ישראל")'); await wait(page, 300);
  check((await page.textContent('#pickTitle')).includes('ישראל'), 'the kids screen names the team', await page.textContent('#pickTitle'));
  await t.tapEl('.kid-card:has-text("רפל") .kid-face');
  const chip = await page.textContent('#oppChip');
  await t.tapEl('#go');
  await page.waitForFunction(() => handball.mode === 'play', null, { timeout: 8000 });
  const k = await G(page, () => ({ teams: handball.game.teams.map((tm) => tm.kit.he), shirts: handball.game.teams.map((tm) => tm.kit.shirt), badge: handball.game.teams[0].kit.badge, cb: handball.game.teams[0].players.find((p) => p.role === 'CB').hero.nameHe }));
  check(k.teams[0] === 'ישראל' && k.cb === 'רפל' && chip.includes(k.teams[1]), 'Israel with רפל against the nation on the chip', `${k.teams.join(' - ')} · ${k.cb}`);
  check(k.badge === 'israel', 'Israel wears the flag on the shirt', k.badge);
  check(k.shirts[0] !== k.shirts[1], 'the two teams wear different shirts', k.shirts.join(' / '));
  const board = await G(page, () => [...document.querySelectorAll('.board .abbr')].map((e) => e.textContent).join(' | '));
  check(!/צרעות|צפעונים/.test(board), 'the scoreboard shows the teams', board);
  // restart keeps the same match
  await t.tapEl('#btnPause'); await t.tapEl('#restart'); await wait(page, 500);
  const k2 = await G(page, () => handball.game.teams.map((tm) => tm.kit.he));
  check(k2.join() === k.teams.join(), '"מתחילים מחדש" keeps the same teams', k2.join(' - '));
  // back to the home screen: "play again" in one tap
  await t.tapEl('#btnPause'); await t.tapEl('#toMenu'); await wait(page, 400);
  await page.reload(); await wait(page, 1200);
  check(await page.isVisible('#again') && (await page.textContent('#againSub')).includes('ישראל'), 'home: "שחקו שוב" with last time\'s match', await page.textContent('#againSub'));
  await page.screenshot({ path: `${out}/01b-home-again.png` });
  await t.tapEl('#again');
  await page.waitForFunction(() => handball.mode === 'play', null, { timeout: 8000 });
  const k3 = await G(page, () => handball.game.teams.map((tm) => tm.kit.he));
  check(k3.join() === k.teams.join(), 'one tap plays the same match again', k3.join(' - '));
  // the phone's back button: in a match it pauses; on the kids screen it goes back to the teams
  await page.goBack(); await wait(page, 300);
  check(await G(page, () => handball.mode) === 'paused', 'back button in a match pauses');
  await t.tapEl('#toMenu'); await wait(page, 300);
  await t.tapEl('#play'); await wait(page, 300); await t.tapEl('#teamCards .lu-card:visible', 0); await wait(page, 300);
  await page.goBack(); await wait(page, 300);
  check(await page.isVisible('#stepTeam'), 'back button on the kids screen goes back to the teams');
  // wording: one meaning for "נבחרת", and the right spelling of רפל
  const text = await G(page, () => document.body.innerText + [...document.querySelectorAll('[hidden]')].map((e) => e.textContent).join(' '));
  check(!/הנבחרת של|רפאל/.test(text), 'no "הנבחרת של" and no "רפאל" anywhere');
  // settings live in a small window and reach the match
  await t.tapEl('#pickBack'); await wait(page, 300);
  await t.tapEl('#openSettings'); await t.tapEl('.seg[data-key="half"] button[data-v="180"]'); await t.tapEl('[data-close="settings"]');
  await t.tapEl('#again');
  await page.waitForFunction(() => handball.mode === 'play', null, { timeout: 8000 });
  check(await G(page, () => handball.game.opts.halfLen) === 180, 'settings reach the match');
  // old saved data (handball7) carries over
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('handball7', JSON.stringify({ hero: 'emma', myClub: 'holon', half: '600', view: 'night' })); });
  await page.reload(); await wait(page, 1200);
  await t.tapEl('#play'); await wait(page, 300);
  check(await G(page, () => document.querySelector('#teamCards .lu-card.sel b').textContent) === 'הכדוריד חולון', 'old saved team carries over');
  await t.tapEl('#teamCards .lu-card.sel'); await wait(page, 300);
  check(/cap/.test(await G(page, () => [...document.querySelectorAll('.kid-card')].find((k) => k.textContent.includes('אמה')).className)), 'old saved hero becomes the captain');
  check(errors.length === 0, 'no errors with teams', errors.join(' | '));
  await page.close();
});

// ---------------------------------------------------------------- views: top / TV camera
await run('view', async () => {
  const P = await phone();
  const { page, t, errors } = P;
  await startMatch(P);
  const view = () => G(page, () => document.querySelector('#btnView').dataset.view);
  check(await view() === 'top', 'starts in the top view');
  const top = await page.screenshot({ path: `${out}/40-view-top.png` });
  await t.tapEl('#btnView');
  await waitGame(page, 0.6);
  check(await view() === 'tv', 'the view button switches to the TV camera');
  const tv = await page.screenshot({ path: `${out}/41-view-tv.png` });
  check(!top.equals(tv), 'the TV camera draws a different picture');
  await t.tapEl('#btnView'); await t.tapEl('#btnView'); // quick taps: tv -> top -> tv
  check(await view() === 'tv', 'quick taps on the button all count');
  // the joystick still steers in the TV view, and the camera follows across the court
  const c = await t.center('#stick');
  // (not while the computer's ice power holds your team, or during a power close-up)
  await page.waitForFunction(() => { const g = handball.game, p = g.controlled; return g.state === 'play' && !(g.splash > 0) && p && !(p.frozen > 0); }, null, { timeout: 15000, polling: 50 });
  const m0 = await me(page);
  await t.down(1, c.x, c.y); await t.move(1, c.x + 25, c.y); await t.move(1, c.x + 50, c.y);
  await waitGame(page, 0.8);
  const m1 = await me(page);
  const why = await G(page, () => { const g = handball.game, c = g.controlled; return { state: g.state, splash: g.splash, frozen: c && c.frozen, stick: handball.input.state.mx, mode: handball.mode }; });
  await t.up(1);
  check(m1 && m0 && m1.id === m0.id ? m1.x > m0.x + 0.5 : m1 && m1.sp > 1.5, 'the joystick steers in the TV view', m0 && m1 ? `${m0.x.toFixed(1)} -> ${m1.x.toFixed(1)} ${JSON.stringify(why)}` : '');
  const cam = await G(page, () => { const g = handball.game, b = g.ball, r = b.owner || b; return { ball: r.y }; });
  check(Number.isFinite(cam.ball), 'the TV camera keeps running');
  // the choice is remembered; an old "night" choice becomes the TV camera
  await page.reload(); await wait(page, 1200);
  check(await view() === 'tv', 'the view is remembered after a reload');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('handball7', JSON.stringify({ view: 'night' })); });
  await page.reload(); await wait(page, 1200);
  check(await view() === 'tv', 'an old night setting opens the TV camera');
  check(errors.length === 0, 'no errors while switching views', errors.join(' | '));
  await page.close();
});

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
  await page.evaluate(() => { document.querySelector('#play').click(); document.querySelector('#teamCards .lu-card').click(); document.querySelector('#go').click(); });
  await page.clock.runFor(500);
  check(await page.evaluate(() => handball.mode === 'play'), 'the match starts after the three steps');
  for (let i = 0; i < 40 && !(await page.isVisible('#break')); i++) await page.clock.runFor(5000);
  check(/מחצית/.test(await page.textContent('#brEyebrow')), 'half-time screen');
  await page.evaluate(() => document.querySelector('#brNext').click());
  await page.clock.runFor(2000);
  check((await page.evaluate(() => handball.game.teams.map((t) => t.defX))).join() === '40,0', 'teams switch ends');
  for (let i = 0; i < 40 && !(await page.isVisible('#break')); i++) await page.clock.runFor(5000);
  check(/סיום/.test(await page.textContent('#brEyebrow')), 'full-time screen', await page.textContent('#brScore'));
  check(await page.isVisible('#brNext') && (await page.textContent('#brNext')).includes('עוד משחק') && !(await page.isVisible('#brNewOpp')), 'end: "עוד משחק!" (no new opponent for הצרעות)');
  check(errors.length === 0, 'no page errors (match)', errors.slice(0, 2).join(' | '));
  await page.close();
});

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
