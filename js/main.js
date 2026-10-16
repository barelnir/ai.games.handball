// Boot, game loop, camera, HUD and menus.

import { Game } from './game.js';
import { createRenderer } from './render.js';
import { W, H, CY, POST_HI, Z2Y } from './court.js';
import * as D from './draw.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { POWERS_ENABLED, ENERGY_MAX } from './powers.js';

const $ = (s) => document.querySelector(s);
const STEP = 1 / 60;

const settings = { difficulty: 'normal', half: '300', rules: 'full', sound: true };
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

// ------------------------------------------------------------------ setup
async function boot() {
  R = await createRenderer($('#game'), { onLost: rebuildRenderer });
  $('#gfx').textContent = R.kind === 'WebGPU' ? 'WebGPU' : 'Canvas 2D (WebGPU not available on this device)';
  resize();
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 200));
  startDemo();
  bindUI();
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

async function rebuildRenderer() {
  R = await createRenderer(R.canvas, { onLost: rebuildRenderer });
  resize();
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const c = R.canvas;
  c.width = Math.round(innerWidth * dpr);
  c.height = Math.round(innerHeight * dpr);
  const portrait = innerHeight > innerWidth && matchMedia('(pointer: coarse)').matches;
  $('#rotate').hidden = !(portrait && mode === 'play');
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
  });
  game.input = input.state;
  setMode('play');
  requestWakeLock();
  if (input.touchUsed || matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
}

function setMode(m) {
  mode = m;
  input.clearEdges();
  $('#menu').hidden = m !== 'menu';
  $('#pause').hidden = m !== 'paused';
  $('#break').hidden = m !== 'break';
  $('#hud').hidden = m === 'menu';
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
  $('#play').addEventListener('click', startMatch);
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
  addEventListener('pointerdown', () => sound.unlock(), { once: false, passive: true });
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
  if (mode === 'play' || mode === 'menu') {
    if (mode === 'play') input.read();
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 8) { game.step(STEP); acc -= STEP; n++; }
    if (n === 8) acc = 0;
    handleEvents();
    if (mode === 'menu') {
      if (game.state === 'halftime') game.startSecondHalf();
      else if (game.state === 'fulltime') startDemo();
    } else if (game.state === 'halftime' || game.state === 'fulltime') showBreak();
  }
  excite = Math.max(0, excite - dt * 0.35);
  updateCamera(dt);
  render();
  if (mode !== 'menu') updateHUD();
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
    }
  }
  game.events.length = 0;
}

function updateCamera(dt) {
  const c = R.canvas;
  let ppm, tx, ty;
  if (mode === 'menu') {
    ppm = Math.min(c.width / 50, c.height / 27);
    tx = W / 2 - (c.width / ppm) * 0.12; ty = H / 2;
  } else {
    ppm = Math.min(c.height / 15.5, c.width / 24);
    const b = game.ball, r = b.owner || b;
    const s = game.teams[game.poss].defX === 0 ? 1 : -1;
    tx = r.x + s * 2.5; ty = r.y - (b.z || 0) * Z2Y * 0.5;
  }
  const hw = c.width / 2 / ppm, hh = c.height / 2 / ppm;
  const minX = -4.5, maxX = W + 4.5, minY = -4, maxY = H + 3.5;
  tx = hw * 2 >= maxX - minX ? W / 2 : Math.min(Math.max(tx, minX + hw), maxX - hw);
  ty = hh * 2 >= maxY - minY ? H / 2 : Math.min(Math.max(ty, minY + hh), maxY - hh);
  const k = mode === 'menu' ? 1 : 1 - Math.exp(-dt * 4.5);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.ppm = ppm;
}

// ------------------------------------------------------------------ render
const ents = [];
function render() {
  const g = game, b = g.ball;
  R.begin(cam.x, cam.y, cam.ppm, D.PAL.clear);
  D.drawArena(R, now, excite);
  D.drawGoalBack(R, 0);
  D.drawGoalBack(R, W);

  const c = g.controlled;
  if (c && c.active && mode !== 'menu') D.drawMarker(R, c, now);
  if (g.passHint) D.drawMarker(R, g.passHint, now, D.PAL.markerSoft);

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
      D.drawPlayer(R, p, g.teams[p.team].kit, {
        hasBall: b.owner === p,
        dribbling: b.owner === p && p.carry === 'drib',
        alert: alert && p.gk && g.teams[p.team].defX === b.goalX,
      });
    } else if (e.ref) {
      D.drawReferee(R, e.ref, g.signal && e.i === 0 ? g.signal.type : null);
    } else if (e.ball) {
      if (b.state !== 'dead' || g.state === 'goal') D.drawBall(R, b);
    } else D.post(R, e.post, POST_HI);
  }

  if (c && c.active && mode !== 'menu') {
    D.drawHeadTag(R, c, now, D.PAL.hint);
    drawRuleDots(c);
    if (c.charging) drawAim(c);
  }
  R.end();
}

function drawRuleDots(p) {
  if (!game.full || game.ball.owner !== p || p.gk) return;
  const y = p.y - p.z * Z2Y - 1.62;
  if (p.carry === 'fresh' || p.carry === 'held' || (game.lock && game.lock.p === p && game.state === 'play')) {
    const left = 3 - p.holdT;
    for (let i = 0; i < 3; i++) {
      R.ellipse(p.x - 0.2 + i * 0.2, y, 0.06, 0.06, i < left ? D.PAL.marker : D.PAL.markerSoft);
    }
  }
  if (p.carry === 'held') {
    const steps = 3 - Math.floor(p.stepDist / 0.87);
    for (let i = 0; i < 3; i++) R.rect(p.x - 0.2 + i * 0.2, y - 0.17, 0.045, 0.045, i < steps ? D.PAL.hint : D.PAL.markerSoft);
  }
}

function drawAim(p) {
  const t = game.teams[p.team], ax = t.defX === 0 ? W : 0;
  const my = input.state.my;
  const ty = CY + (Math.abs(my) > 0.25 ? my * 1.3 : 0);
  const x0 = p.x, y0 = p.y, dx = ax - x0, dy = ty - y0, d = Math.hypot(dx, dy);
  const n = Math.floor(d / 0.6);
  const col = D.col('#ffd23f', 0.35 + p.charge * 0.6);
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
  $('#half').textContent = g.half === 1 ? '1st half' : '2nd half';

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
  const la = attacking ? 'PASS' : 'SWITCH', lb = gkBall ? 'THROW' : attacking ? 'SHOOT' : 'STEAL';
  if ($('#lA').textContent !== la) { $('#lA').textContent = la; $('#kA').textContent = la.toLowerCase(); }
  if ($('#lB').textContent !== lb) { $('#lB').textContent = lb; $('#kB').textContent = lb.toLowerCase(); }
  const e = Math.round((g.teams[h].energy / ENERGY_MAX) * 100);
  $('#btnP').style.setProperty('--e', e);
  $('#btnP').querySelector('small').textContent = POWERS_ENABLED ? `${e}%` : 'soon';
}

function showBreak() {
  if (mode === 'break') return;
  const g = game;
  const [a, z] = g.teams;
  const half = g.state === 'halftime';
  $('#brEyebrow').textContent = half ? 'Half-time' : a.score > z.score ? 'Full-time · You win' : a.score < z.score ? 'Full-time · Vipers win' : 'Full-time · Draw';
  $('#brScore').textContent = `${a.score} : ${z.score}`;
  const rows = [['Goals', 'goals'], ['Shots', 'shots'], ['Saves', 'saves'], ['Steals', 'steals'], ['Fouls', 'fouls'], ['2-min', 'suspensions']];
  $('#brStats').innerHTML = rows.map(([l, k]) => `<tr><td>${a.stats[k]}</td><td>${l}</td><td>${z.stats[k]}</td></tr>`).join('');
  $('#brNext').textContent = half ? 'Start second half' : 'Play again';
  setMode('break');
}

boot();
