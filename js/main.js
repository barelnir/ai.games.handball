// Boot, game loop, camera, HUD and menus.

import { Game } from './game.js';
import { createRenderer } from './render.js';
import { W, H, CY, POST_HI, Z2Y } from './court.js';
import * as T from './toon.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { POWERS_ENABLED, ENERGY_MAX } from './powers.js';
import { PROFILES, TEMPLATES, profileById, drawPortrait } from './heroes.js';

const $ = (s) => document.querySelector(s);
const STEP = 1 / 60;

const settings = { difficulty: 'normal', half: '300', rules: 'arcade', sound: true, music: true, hero: 'eitan', power: 'lightning' };
try { Object.assign(settings, JSON.parse(localStorage.getItem('handball7') || '{}')); } catch {}
const save = () => { try { localStorage.setItem('handball7', JSON.stringify(settings)); } catch {} };

let R = null;
let game = null;
let mode = 'menu';           // menu | play | paused | break
let acc = 0, last = 0, now = 0;
let excite = 0;
const cam = { x: W / 2, y: H / 2, ppm: 20 };
const input = new Input($('#touch'));
const sound = new Sound();
sound.muted = !settings.sound;
sound.musicOn = settings.music !== false;

// ------------------------------------------------------------------ setup
async function boot() {
  R = createRenderer($('#game'));
  $('#gfx').textContent = R.kind === 'WebGL 2' ? 'WebGL 2' : 'Canvas 2D (אין WebGL 2 במכשיר הזה)';
  blockPageZoom();
  resize();
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 200));
  startDemo();
  bindUI();
  buildPick();
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// Sharp on every phone (up to 3x pixels) but capped so big screens stay fast.
function pixelRatio() {
  const d = Math.min(window.devicePixelRatio || 1, 3), px = innerWidth * innerHeight;
  return Math.max(1, Math.min(d, Math.sqrt(4.5e6 / px)));
}

// Stop the phone browser from zooming the page (pinch or double-tap): the game sets its own zoom.
function blockPageZoom() {
  const stop = (e) => e.preventDefault();
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) document.addEventListener(ev, stop, { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  // If the page got zoomed anyway (iPhone double-tap), snap it back to normal size.
  const meta = document.querySelector('meta[name=viewport]');
  const base = meta && meta.content;
  const unzoom = () => {
    if (!meta || !window.visualViewport || visualViewport.scale <= 1.01) return;
    meta.content = base + ', minimum-scale=1';
    setTimeout(() => { meta.content = base; }, 300);
    window.scrollTo(0, 0);
  };
  if (window.visualViewport) { visualViewport.addEventListener('resize', unzoom); visualViewport.addEventListener('scroll', unzoom); }
  let lastTap = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTap < 350 && !e.target.closest('.seg, #menu button, .screen button')) e.preventDefault();
    lastTap = now;
  }, { passive: false });
}

function resize() {
  const dpr = pixelRatio();
  const c = R.canvas;
  c.width = Math.round(innerWidth * dpr);
  c.height = Math.round(innerHeight * dpr);
  const portrait = innerHeight > innerWidth && matchMedia('(pointer: coarse)').matches;
  $('#rotate').hidden = !(portrait && mode === 'play');
}

// ------------------------------------------------------------------ pick a team, then a power
// Each card has a small canvas drawn with the 2D renderer (keeps WebGL contexts to one).
const pick = { step: 'team', teams: [], powers: [] };
function card(parent, title, sub, onPick) {
  const b = document.createElement('button');
  b.className = 'pick-card';
  b.innerHTML = `<canvas aria-hidden="true"></canvas><b></b><small></small>`;
  b.querySelector('b').textContent = title;
  b.querySelector('small').textContent = sub;
  b.addEventListener('click', onPick);
  parent.appendChild(b);
  return { el: b, r: createRenderer(b.querySelector('canvas'), { preferGL: false }) };
}
function buildPick() {
  pick.teams = PROFILES.map((pr) => ({ pr, ...card($('#pickTeams'), `הנבחרת של ${pr.nameHe}`, `${pr.nameHe} הוא הגיבור`, () => {
    settings.hero = pr.id; save(); showPick('power');
  }) }));
  pick.teams.forEach((c) => { if (c.pr.girl) c.el.querySelector('small').textContent = `${c.pr.nameHe} היא הגיבורה`; });
  pick.powers = Object.values(TEMPLATES).map((tp) => ({ tp, ...card($('#pickPowers'), '', tp.about, () => {
    settings.power = tp.key; save(); startMatch();
  }) }));
  $('#pickBack').addEventListener('click', () => (pick.step === 'power' ? showPick('team') : toMenu()));
}
function showPick(step) {
  pick.step = step;
  const pr = profileById(settings.hero);
  $('#pickTeams').hidden = step !== 'team';
  $('#pickPowers').hidden = step !== 'power';
  $('#pickStep').textContent = step === 'team' ? 'שלב 1 מתוך 2' : 'שלב 2 מתוך 2';
  $('#pickTitle').textContent = step === 'team' ? 'בחרו נבחרת' : `בחרו כוח מיוחד ל${pr.nameHe}`;
  pick.teams.forEach((c) => c.el.classList.toggle('last', c.pr.id === settings.hero));
  pick.powers.forEach((c) => {
    c.el.querySelector('b').textContent = c.tp.title(pr.nameHe).replace('!', '');
    c.el.classList.toggle('last', c.tp.key === settings.power);
  });
  if (mode !== 'pick') setMode('pick');
  const dpr = pixelRatio();
  for (const c of step === 'team' ? pick.teams : pick.powers) {
    const cv = c.r.canvas;
    cv.width = Math.round(cv.clientWidth * dpr) || 300; cv.height = Math.round(cv.clientHeight * dpr) || 300;
  }
}
function renderPick() {
  const list = pick.step === 'team' ? pick.teams : pick.powers;
  for (const c of list) {
    const r = c.r, cv = r.canvas;
    const pr = c.pr || profileById(settings.hero), tp = c.tp || TEMPLATES[settings.power] || TEMPLATES.lightning;
    r.begin(0, -1.0, cv.height / 4.6, T.TP.clear);
    drawPortrait(r, pr, tp, now);
    r.end();
  }
}

function startDemo() {
  game = new Game({ human: -1, halfLen: 600, difficulty: 'normal', rules: 'full' });
}

function startMatch() {
  sound.unlock();
  game = new Game({
    human: 0,
    halfLen: +settings.half,
    difficulty: settings.difficulty,
    rules: settings.rules,
    hero: settings.hero,
    power: settings.power,
    // sometimes the computer's team is led by one of the other kids
    rivalHero: Math.random() < 0.4 ? otherKid(settings.hero) : null,
  });
  $('.board .home .abbr').textContent = game.teams[0].kit.abbr;
  $('.board .away .abbr').textContent = game.teams[1].kit.abbr;
  game.input = input.state;
  setMode('play');
  requestWakeLock();
  if (input.touchUsed || matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
}

function otherKid(id) {
  const others = PROFILES.filter((p) => p.id !== id);
  return others.length ? others[(Math.random() * others.length) | 0].id : null;
}

function setMode(m) {
  mode = m;
  input.reset();
  $('#menu').hidden = m !== 'menu';
  $('#pick').hidden = m !== 'pick';
  $('#pause').hidden = m !== 'paused';
  $('#break').hidden = m !== 'break';
  $('#hud').hidden = m === 'menu' || m === 'pick';
  $('#touch').hidden = m !== 'play';
  if (m !== 'menu') $('#rules').hidden = true;
  resize();
}

let wakeLock = null;
async function requestWakeLock() {
  try { if (navigator.wakeLock && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'play') setMode('paused');
  if (sound.ctx) { if (document.hidden) sound.ctx.suspend(); else sound.ctx.resume(); }
  if (!document.hidden && mode === 'play') requestWakeLock();
});

// ------------------------------------------------------------------ UI
function bindUI() {
  document.querySelectorAll('.seg').forEach((seg) => {
    const key = seg.dataset.key;
    const sync = () => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === String(settings[key])));
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      settings[key] = b.dataset.v;
      save(); sync();
    });
    sync();
  });
  $('#play').addEventListener('click', () => { sound.unlock(); showPick('team'); });
  $('#openRules').addEventListener('click', () => { $('#rules').hidden = false; });
  $('#toRules').addEventListener('click', () => { $('#rules').hidden = false; });
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { $('#' + b.dataset.close).hidden = true; }));
  $('#btnPause').addEventListener('click', togglePause);
  input.onPause = togglePause;
  $('#resume').addEventListener('click', () => setMode('play'));
  $('#restart').addEventListener('click', startMatch);
  $('#toMenu').addEventListener('click', toMenu);
  $('#brMenu').addEventListener('click', toMenu);
  $('#brNext').addEventListener('click', () => {
    if (game.state === 'halftime') { game.startSecondHalf(); setMode('play'); }
    else startMatch();
  });
  const mb = $('#btnMusic');
  mb.classList.toggle('off', !sound.musicOn);
  mb.addEventListener('click', () => {
    sound.unlock();
    sound.setMusic(!sound.musicOn); settings.music = sound.musicOn; save();
    mb.classList.toggle('off', !sound.musicOn);
  });
  const sb = $('#btnSound');
  sb.classList.toggle('off', sound.muted);
  sb.addEventListener('click', () => {
    sound.unlock();
    sound.muted = !sound.muted; settings.sound = !sound.muted; save();
    sb.classList.toggle('off', sound.muted);
  });
  $('#btnFull').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        try { await screen.orientation.lock('landscape'); } catch {}
      }
    } catch {}
  });
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) {
    addEventListener(ev, () => sound.unlock(), { passive: true, capture: true });
  }
}

function togglePause() {
  if (mode === 'play') setMode('paused');
  else if (mode === 'paused') setMode('play');
}

function toMenu() {
  startDemo();
  setMode('menu');
}

// ------------------------------------------------------------------ loop
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (t - last) / 1000 || 0);
  last = t;
  now += dt;
  const demo = mode === 'menu' || mode === 'pick';
  if (mode === 'play' || demo) {
    if (mode === 'play') input.read();
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 8) { game.step(STEP); acc -= STEP; n++; }
    if (n === 8) acc = 0;
    handleEvents();
    if (demo) {
      if (game.state === 'halftime') game.startSecondHalf();
      else if (game.state === 'fulltime') startDemo();
    } else if (game.state === 'halftime' || game.state === 'fulltime') showBreak();
  }
  if (mode === 'pick') renderPick();
  excite = Math.max(0, excite - dt * 0.35);
  updateCamera(dt);
  render();
  if (mode !== 'menu' && mode !== 'pick') updateHUD();
}

function handleEvents() {
  const live = mode === 'play';
  for (const e of game.events) {
    if (!live) continue;
    switch (e.type) {
      case 'whistle': sound.whistle(e.n, e.short); break;
      case 'goal':
        excite = 1;
        sound.crowd(e.team === 0 ? 0.55 : 0.3, 3);
        if (e.team === 0 && navigator.vibrate) try { navigator.vibrate([30, 40, 60]); } catch {}
        break;
      case 'shot': sound.thud(0.5, 190); break;
      case 'pass': sound.thud(0.18, 240); break;
      case 'catch': sound.thud(0.12, 320); break;
      case 'save': sound.thud(0.5, 95); sound.crowd(0.15, 1.2); excite = Math.max(excite, 0.4); break;
      case 'post': sound.thud(0.5, 900); break;
      case 'block': sound.thud(0.4, 120); break;
      case 'card': sound.crowd(0.12, 1); break;
      case 'power': {
        const tp = TEMPLATES[e.kind];
        if (tp && sound[tp.sound]) sound[tp.sound]();
        sound.crowd(0.4, 2.5); excite = 1;
        if (navigator.vibrate) try { navigator.vibrate([40, 30, 80]); } catch {}
        break;
      }
      case 'powershot': sound.whoosh(); if (e.kind === 'lightning') sound.zap(); break;
    }
  }
  game.events.length = 0;
}

function updateCamera(dt) {
  const c = R.canvas;
  let ppm, tx, ty;
  if (mode === 'menu' || mode === 'pick') {
    ppm = Math.min(c.width / 50, c.height / 27);
    tx = W / 2 - (c.width / ppm) * 0.12; ty = H / 2;
  } else {
    // Fixed, readable zoom on every screen: at least 24 m of court across and 13 m top to bottom
    // (on a phone held sideways that is about 28 × 13 m, so you always see where you are).
    ppm = Math.min(c.width / 24, c.height / 13);
    const b = game.ball, r = b.owner || b;
    const s = game.teams[game.poss].defX === 0 ? 1 : -1;
    tx = r.x + s * 2.5; ty = r.y - (b.z || 0) * Z2Y * 0.5;
  }
  const hw = c.width / 2 / ppm, hh = c.height / 2 / ppm;
  const minX = -4.5, maxX = W + 4.5, minY = -4, maxY = H + 3.5;
  tx = hw * 2 >= maxX - minX ? W / 2 : Math.min(Math.max(tx, minX + hw), maxX - hw);
  ty = hh * 2 >= maxY - minY ? H / 2 : Math.min(Math.max(ty, minY + hh), maxY - hh);
  const k = mode === 'menu' || mode === 'pick' ? 1 : 1 - Math.exp(-dt * 4.5);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.ppm = ppm;
}

// ------------------------------------------------------------------ render
const ents = [];
const HINT = T.col('#ffd23f'), SOFT = T.col('#ffffff', 0.45);
const trail = [];
function render() {
  const g = game, b = g.ball;
  if (g.splash > 0) { renderSplash(g.splash); return; }
  if (b.power && !b.owner && b.state !== 'dead') {
    trail.push({ x: b.x, y: b.y, z: b.z });
    if (trail.length > 26) trail.shift();
  } else trail.length = 0;
  R.begin(cam.x, cam.y, cam.ppm, T.TP.clear);
  T.drawToonArena(R, now, excite);
  T.drawToonGoalBack(R, 0);
  T.drawToonGoalBack(R, W);

  const c = g.controlled;
  if (c && c.active && mode !== 'menu') T.drawMarker(R, c, now, HINT);
  if (g.passHint) T.drawMarker(R, g.passHint, now, SOFT);

  ents.length = 0;
  for (const p of g.all) ents.push({ y: p.y, p });
  g.refs.forEach((f, i) => ents.push({ y: f.y, ref: f, i }));
  ents.push({ y: (b.owner ? b.owner.y : b.y) + 0.01, ball: true });
  ents.push({ y: POST_HI, post: 0 });
  ents.push({ y: POST_HI, post: W });
  ents.sort((a, z) => a.y - z.y);
  const alert = b.state === 'shot';
  for (const e of ents) {
    if (e.p) {
      const p = e.p;
      if (p.frozen > 0 && !p.iced) T.drawPowerAura(R, p, now, '#7fe7ff');
      else if (p.effects.length && g.powers.teams[p.team]) T.drawPowerAura(R, p, now, g.powers.teams[p.team].template.aura);
      T.drawHero(R, p.hero, g.teams[p.team].kit, p, {
        t: now,
        hasBall: b.owner === p,
        dribbling: b.owner === p && p.carry === 'drib',
        alert: alert && p.gk && g.teams[p.team].defX === b.goalX,
      });
      if (p.frozen > 0 && p.iced) T.drawIceBlock(R, p, now);
    } else if (e.ref) {
      T.drawToonRef(R, e.ref, g.signal && e.i === 0 ? g.signal.type : null, now);
    } else if (e.ball) {
      if (b.power) { T.drawPowerTrail(R, b.power, trail, now); T.drawPowerBall(R, b.power, b.x, b.y, b.z, now); }
      else if (b.state !== 'dead' || g.state === 'goal') T.drawToonBall(R, b.x, b.y, b.z, b.owner ? 0 : now);
    } else T.toonPost(R, e.post, POST_HI);
  }

  if (c && c.active && mode !== 'menu') {
    T.drawHeadTag(R, c, now, HINT);
    drawRuleDots(c);
    if (c.charging) drawAim(c);
  }
  R.end();
}

// Full-screen POWER close-up: Eitan with a big head, flexing, looking at you.
function renderSplash(left) {
  const c = R.canvas, total = 1.8, k = total - left;
  const zoom = Math.min(1, 0.55 + k * 2.2);           // quick zoom-in
  R.begin(0, -0.75, (c.height / 5.4) * zoom, T.TP.clear);
  const info = game.splashInfo;
  drawPortrait(R, info.profile, info.template, now, Math.min(1, k / 0.25));
  R.end();
}

function drawRuleDots(p) {
  if (!game.full || game.ball.owner !== p || p.gk) return;
  const y = p.y - p.z * Z2Y - 1.5;
  if (p.carry === 'fresh' || p.carry === 'held' || (game.lock && game.lock.p === p && game.state === 'play')) {
    const left = 3 - p.holdT;
    for (let i = 0; i < 3; i++) {
      R.ellipse(p.x - 0.2 + i * 0.2, y, 0.075, 0.075, T.TP.ink);
      R.ellipse(p.x - 0.2 + i * 0.2, y, 0.055, 0.055, i < left ? T.TP.white : SOFT);
    }
  }
  if (p.carry === 'held') {
    const steps = 3 - Math.floor(p.stepDist / 0.87);
    for (let i = 0; i < 3; i++) {
      R.rect(p.x - 0.2 + i * 0.2, y - 0.19, 0.065, 0.065, T.TP.ink, 0, 0.02);
      R.rect(p.x - 0.2 + i * 0.2, y - 0.19, 0.045, 0.045, i < steps ? HINT : SOFT, 0, 0.01);
    }
  }
}

function drawAim(p) {
  const t = game.teams[p.team], ax = t.defX === 0 ? W : 0;
  const my = input.state.my;
  const ty = CY + (Math.abs(my) > 0.25 ? my * 1.3 : 0);
  const x0 = p.x, y0 = p.y, dx = ax - x0, dy = ty - y0, d = Math.hypot(dx, dy);
  const n = Math.floor(d / 0.6);
  const col = T.col('#ffd23f', Math.round((0.35 + p.charge * 0.6) * 20) / 20);
  for (let i = 1; i < n; i += 2) {
    const a = i / n, b2 = Math.min(1, (i + 1) / n);
    R.line(x0 + dx * a, y0 + dy * a, x0 + dx * b2, y0 + dy * b2, 0.035 + p.charge * 0.03, col);
  }
}

// ------------------------------------------------------------------ HUD
let lastMsg = null, hudKey = '';
function updateHUD() {
  const g = game;
  $('#s0').textContent = g.teams[0].score;
  $('#s1').textContent = g.teams[1].score;
  $('#clock').textContent = g.clockText();
  $('#half').textContent = g.half === 1 ? 'מחצית 1' : 'מחצית 2';

  if (g.msg !== lastMsg) {
    lastMsg = g.msg;
    const bn = $('#banner');
    if (g.msg) {
      $('#bTitle').textContent = g.msg.title;
      $('#bSub').textContent = g.msg.sub || '';
      $('#bSub').hidden = !g.msg.sub;
      bn.className = `banner show ${g.msg.kind}`;
    } else bn.className = 'banner';
  }

  $('#passive').hidden = !g.passive;
  if (g.passive) $('#passLeft').textContent = Math.max(0, 4 - g.passivePasses);

  const susp = g.all.filter((p) => !p.active);
  const key = susp.map((p) => p.id + ':' + Math.ceil(p.susp)).join(',');
  if (key !== hudKey) {
    hudKey = key;
    $('#susp').innerHTML = susp.map((p) => {
      const s = Math.ceil(p.susp);
      return `<span class="chip"><i style="background:${g.teams[p.team].kit.shirt}"></i>#${p.num} ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</span>`;
    }).join('');
  }

  const b = g.ball, h = 0;
  const attacking = b.owner && b.owner.team === h;
  const gkBall = attacking && b.owner.gk;
  const la = attacking ? 'מסירה' : 'החלף', lb = gkBall ? 'הוצאה' : attacking ? 'זריקה' : 'חטיפה';
  if ($('#lA').textContent !== la) { $('#lA').textContent = la; $('#kA').textContent = la; }
  if ($('#lB').textContent !== lb) { $('#lB').textContent = lb; $('#kB').textContent = lb; }
  const e = Math.round((g.teams[h].energy / ENERGY_MAX) * 100);
  $('#btnP').style.setProperty('--e', e);
  const ready = POWERS_ENABLED && e >= 100;
  $('#btnP').classList.toggle('ready', ready);
  $('#btnP').querySelector('small').textContent = !POWERS_ENABLED ? 'בקרוב' : ready ? 'מוכן!' : `${e}%`;
}

function showBreak() {
  if (mode === 'break') return;
  const g = game;
  const [a, z] = g.teams;
  const half = g.state === 'halftime';
  $('#brEyebrow').textContent = half ? 'מחצית' : a.score > z.score ? 'סיום · ניצחתם!' : a.score < z.score ? `סיום · ${z.kit.he} ניצחו` : 'סיום · תיקו';
  $('#brScore').textContent = `${a.score} : ${z.score}`;
  const rows = [['שערים', 'goals'], ['זריקות', 'shots'], ['הצלות', 'saves'], ['חטיפות', 'steals'], ['עבירות', 'fouls'], ['2 דקות', 'suspensions']];
  $('#brStats').innerHTML = rows.map(([l, k]) => `<tr><td>${a.stats[k]}</td><td>${l}</td><td>${z.stats[k]}</td></tr>`).join('');
  $('#brNext').textContent = half ? 'למחצית השנייה' : 'עוד משחק!';
  setMode('break');
}

// Read-only handle for automated tests (tests/e2e.mjs).
window.handball = { get game() { return game; }, get mode() { return mode; }, input };

boot();
