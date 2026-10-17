// Look mock: three "like FIFA" presentation styles drawn from a real match moment.
//   A  TV camera: high side camera with perspective, 3D stands, LED boards, glossy parquet
//   B  Close TV camera: lower and closer, bigger heroes, more drama
//   C  Top camera (today's view) with broadcast polish: parquet, lights, TV scoreboard
// The court floor is drawn top-down into an offscreen canvas and projected row by row onto
// the screen (the "Mode 7" trick); heroes, goals, boards and fans are drawn upright on top.
import { createRenderer } from '../js/render.js';
import * as T from '../js/toon.js';
import { Game } from '../js/game.js';
import { W, H, CX, CY, POST_LO, POST_HI, GOAL_H } from '../js/court.js';

const FONT = "'Rubik', 'Arial Hebrew', Arial, sans-serif";
const NOW = 3.2;

// ------------------------------------------------------------------ a real match moment
function makeScene() {
  const g = new Game({ human: 0, halfLen: 600, difficulty: 'normal', rules: 'arcade', hero: 'eitan', power: 'lightning', rivalHero: 'eyal', rivalPower: 'ice' });
  g.opts.human = -1; // let the computer play both sides
  const eitan = g.teams[0].players.find((p) => p.role === 'CB');
  for (let i = 0; i < 60 * 240; i++) {
    g.step(1 / 60); g.events.length = 0;
    const o = g.ball.owner;
    if (g.splash > 0 || g.state !== 'play' || !o) continue;
    if (o === eitan && o.x > 24 && o.x < 32 && Math.hypot(o.vx, o.vy) > 1) break;
  }
  g.teams[0].score = 2; g.teams[1].score = 1; g.clock = 754;
  return { g, me: eitan };
}

// ------------------------------------------------------------------ floor texture
function floorCanvas(polish) {
  const RES = 26, X0 = -14, Y0 = -12, X1 = W + 14, Y1 = H + 12;
  const c = document.createElement('canvas');
  c.width = (X1 - X0) * RES; c.height = (Y1 - Y0) * RES;
  const R = createRenderer(c, { preferGL: false });
  R.begin((X0 + X1) / 2, (Y0 + Y1) / 2, RES, T.TP.clear);
  T.drawToonArena(R, NOW, 0);
  const g = R.g;
  // the stands are drawn upright later: paint the flat ones over with the arena's dark floor
  g.fillStyle = '#1a2340';
  g.fillRect(X0, Y0, X1 - X0, -2.2 - Y0);
  g.fillRect(X0, H + 2.5, X1 - X0, Y1 - H - 2.5);
  g.fillRect(X0, Y0, -2.7 - X0, Y1 - Y0);
  g.fillRect(W + 2.7, Y0, X1 - W - 2.7, Y1 - Y0);
  if (polish) {
    // parquet planks: thin seams and a little tone change per plank
    g.save();
    g.beginPath(); g.rect(-2.7, -2.5, W + 5.4, H + 5); g.clip();
    for (let y = -2.5, row = 0; y < H + 2.5; y += 0.32, row++) {
      g.fillStyle = 'rgba(60,30,0,0.10)'; g.fillRect(-2.7, y, W + 5.4, 0.018);
      for (let x = -2.7 + (row % 3) * 0.7; x < W + 2.7; x += 2.1) {
        const k = Math.sin(x * 12.9 + row * 78.2) * 0.5 + 0.5;
        g.fillStyle = k > 0.5 ? `rgba(255,240,210,${(k - 0.5) * 0.10})` : `rgba(80,40,0,${(0.5 - k) * 0.10})`;
        g.fillRect(x, y + 0.018, 2.08, 0.302);
        g.fillStyle = 'rgba(60,30,0,0.12)'; g.fillRect(x + 2.08, y, 0.02, 0.32);
      }
    }
    g.restore();
  }
  return { c, RES, X0, Y0 };
}

// ------------------------------------------------------------------ perspective camera
class Cam {
  constructor(w, h, opt) {
    Object.assign(this, opt);
    this.w = w; this.h = h;
    // fit: far sideline at `farY` of the screen, near sideline at `nearY`
    const dF = this.back + H, dN = this.back;
    this.f = ((opt.nearY - opt.farY) * h) / (this.height * (1 / dN - 1 / dF));
    this.hor = opt.nearY * h - (this.f * this.height) / dN;
    this.yPos = H + this.back;
  }
  depth(y) { return this.yPos - y; }
  scale(y) { return this.f / this.depth(y); }
  P(x, y, z = 0) {
    const d = this.depth(y);
    return [this.w / 2 + (this.f * (x - this.x)) / d, this.hor + (this.f * (this.height - z)) / d];
  }
}

function drawFloor(ctx, cam, floor) {
  const { c, RES, X0, Y0 } = floor;
  const yTop = Math.max(0, Math.ceil(cam.P(0, -2.2)[1]));
  for (let sy = yTop; sy < cam.h; sy++) {
    const d = (cam.f * cam.height) / (sy + 0.5 - cam.hor);
    const wy = cam.yPos - d, s = cam.f / d;
    const xL = cam.x - cam.w / 2 / s, xR = cam.x + cam.w / 2 / s;
    ctx.drawImage(c, (xL - X0) * RES, (wy - Y0) * RES, (xR - xL) * RES, 1, 0, sy, cam.w, 1.5);
  }
}

// upright objects: draw with the toon code, scaled for their distance and anchored at their feet
function withAnchor(R, cam, x, y, fn) {
  const s = cam.scale(y), [sx, sy] = cam.P(x, y);
  R.cam.ppm = s;
  R.view.x0 = -1e9; R.view.x1 = 1e9; R.view.y0 = -1e9; R.view.y1 = 1e9;
  R.g.setTransform(s, 0, 0, s, sx - x * s, sy - y * s);
  fn();
}

function quad(ctx, pts, fill) {
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
}

function drawStands(ctx, cam) {
  // roof and back wall
  const g = ctx.createLinearGradient(0, 0, 0, cam.P(0, -2.2)[1]);
  g.addColorStop(0, '#05070f'); g.addColorStop(1, '#1b2550');
  ctx.fillStyle = g; ctx.fillRect(0, 0, cam.w, cam.P(0, -2.2)[1] + 2);
  // tiers of fans rising behind the far sideline
  const rows = 11, colors = ['#ffd23f', '#e8453c', '#ffffff', '#3f8ee6', '#ffd23f', '#ff9f1c', '#e8453c', '#7cf26b'];
  const skins = ['#f2c6a4', '#e0ac85', '#a36a45', '#7a4b2f', '#f1c7a5'];
  for (let r = rows - 1; r >= 0; r--) {
    const y = -3.6 - r * 0.85, z = 0.5 + r * 0.62;
    const a = cam.P(-16, y, z), b = cam.P(W + 16, y, z), a2 = cam.P(-16, y + 0.85, z - 0.62), b2 = cam.P(W + 16, y + 0.85, z - 0.62);
    quad(ctx, [a, b, b2, a2], r % 2 ? '#222c58' : '#27336a');
    const s = cam.scale(y);
    for (let x = -15.5 + (r % 2) * 0.3; x < W + 15.5; x += 0.62) {
      const k = Math.abs(Math.sin(x * 9.1 + r * 3.7));
      if (k < 0.08) continue;
      const [px, py] = cam.P(x + (k - 0.5) * 0.2, y, z);
      if (px < -20 || px > cam.w + 20) continue;
      ctx.fillStyle = colors[(Math.floor(x * 3.3 + r * 5) % colors.length + colors.length) % colors.length];
      ctx.beginPath(); ctx.ellipse(px, py - 0.18 * s, 0.25 * s, 0.24 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skins[Math.floor(k * 50) % skins.length];
      ctx.beginPath(); ctx.ellipse(px, py - 0.55 * s, 0.17 * s, 0.17 * s, 0, 0, Math.PI * 2); ctx.fill();
      if (k > 0.86) { // waving arms and scarves
        ctx.strokeStyle = colors[(r + Math.floor(x)) % colors.length]; ctx.lineWidth = 0.09 * s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px - 0.2 * s, py - 0.4 * s); ctx.lineTo(px - 0.32 * s, py - 0.95 * s); ctx.stroke();
      }
    }
  }
  // light rigs hanging from the roof
  for (let x = -6; x <= W + 6; x += 8) {
    const [px, py] = cam.P(x, -14, 16);
    const glow = ctx.createRadialGradient(px, py, 0, px, py, 60);
    glow.addColorStop(0, 'rgba(255,255,240,0.95)'); glow.addColorStop(0.2, 'rgba(255,250,220,0.35)'); glow.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = glow; ctx.fillRect(px - 60, py - 60, 120, 120);
  }
}

function drawBoards(ctx, cam) {
  // LED advertising boards along the far sideline
  const ads = [['#ffd23f', '#1b2a4a', 'כדוריד הגיבורים'], ['#e8453c', '#ffffff', 'איתן ⚡'], ['#3f8ee6', '#ffffff', 'אמה ★'], ['#7fd4ff', '#0b3a6b', 'אייל ❄'], ['#3ccf74', '#0e3b22', 'גול!']];
  const y = -2.4;
  for (let i = 0, x = -4; x < W + 4; i++, x += 6) {
    const [ad, fg, txt] = ads[i % ads.length];
    const p0 = cam.P(x, y, 0), p1 = cam.P(x + 6, y, 0), p2 = cam.P(x + 6, y, 0.9), p3 = cam.P(x, y, 0.9);
    quad(ctx, [p0, p1, p2, p3], '#0b0f22');
    const i0 = cam.P(x + 0.06, y, 0.08), i1 = cam.P(x + 5.94, y, 0.08), i2 = cam.P(x + 5.94, y, 0.82), i3 = cam.P(x + 0.06, y, 0.82);
    quad(ctx, [i0, i1, i2, i3], ad);
    const s = cam.scale(y);
    ctx.fillStyle = fg; ctx.font = `900 ${0.5 * s}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const m = cam.P(x + 3, y, 0.45); ctx.fillText(txt, m[0], m[1]);
  }
}

function drawGoal3D(ctx, cam, gx) {
  const s = gx === 0 ? -1 : 1, back = gx + s * 1.0;
  const P = (x, y, z) => cam.P(x, y, z);
  // net
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1, cam.scale(CY) * 0.025);
  const line = (a, b) => { ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); };
  for (let i = 0; i <= 12; i++) {
    const y = POST_LO + (i / 12) * 3;
    line(P(gx, y, GOAL_H), P(back, y, 1.3)); line(P(back, y, 1.3), P(back, y, 0));
  }
  for (let k = 0; k <= 6; k++) { const z = 1.3 * (k / 6); line(P(back, POST_LO, z), P(back, POST_HI, z)); }
  for (const y of [POST_LO, POST_HI]) for (let k = 0; k <= 4; k++) { const z = 1.3 * (k / 4); line(P(gx, y, z), P(back, y, z)); }
  // posts and crossbar, red and white
  const bar = (a, b, n) => {
    const w = cam.scale(CY) * 0.09;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      ctx.strokeStyle = i % 2 ? '#ffffff' : '#e8453c'; ctx.lineWidth = w; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0); ctx.lineTo(a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1); ctx.stroke();
    }
  };
  bar(P(gx, POST_LO, 0), P(gx, POST_LO, GOAL_H), 10);
  bar(P(gx, POST_HI, 0), P(gx, POST_HI, GOAL_H), 10);
  bar(P(gx, POST_LO, GOAL_H), P(gx, POST_HI, GOAL_H), 15);
}

function gloss(ctx, cam) {
  // reflections of the roof lights on the polished floor
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let x = -6; x <= W + 6; x += 8) {
    const [px, py] = cam.P(x, 6, 0);
    const r = cam.scale(6) * 4;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(255,250,230,0.22)'); g.addColorStop(1, 'rgba(255,250,230,0)');
    ctx.fillStyle = g; ctx.save(); ctx.translate(px, py); ctx.scale(0.55, 1.6); ctx.translate(-px, -py); ctx.fillRect(px - r, py - r, r * 2, r * 2); ctx.restore();
  }
  ctx.restore();
}

function vignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.35, w / 2, h * 0.55, w * 0.7);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,20,0.45)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

// ------------------------------------------------------------------ TV overlays
function scoreboard(ctx, g, k) {
  const t0 = g.teams[0], t1 = g.teams[1];
  const x = 14 * k, y = 12 * k, h = 30 * k;
  ctx.save();
  ctx.font = `800 ${15 * k}px ${FONT}`; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
  const clock = `${String(Math.floor(g.clock / 60)).padStart(2, '0')}:${String(Math.floor(g.clock % 60)).padStart(2, '0')}`;
  const n0 = t0.kit.abbr, n1 = t1.kit.abbr;
  const w0 = ctx.measureText(n0).width, w1 = ctx.measureText(n1).width;
  const wClock = 62 * k, wScore = 64 * k, pad = 12 * k;
  const total = wClock + w0 + w1 + wScore + pad * 4 + 8 * k;
  // clock block
  ctx.fillStyle = '#0b1230'; ctx.fillRect(x, y, wClock, h);
  ctx.fillStyle = '#ffffff'; ctx.direction = 'ltr'; ctx.textAlign = 'center'; ctx.fillText(clock, x + wClock / 2, y + h / 2 + k);
  // teams and score: [bar] name · score · name [bar]
  let cx = x + wClock;
  ctx.fillStyle = 'rgba(245,247,255,0.96)'; ctx.fillRect(cx, y, total - wClock, h);
  ctx.fillStyle = t0.kit.shirt; ctx.fillRect(cx, y, 4 * k, h);
  ctx.fillStyle = '#111a3a'; ctx.textAlign = 'center';
  ctx.fillText(n0, cx + pad + w0 / 2, y + h / 2 + k);
  cx += pad * 2 + w0;
  ctx.fillStyle = '#111a3a'; ctx.fillRect(cx, y + 3 * k, wScore, h - 6 * k);
  ctx.fillStyle = '#ffffff'; ctx.direction = 'ltr'; ctx.font = `900 ${17 * k}px ${FONT}`;
  // each score sits next to its own team's name
  ctx.fillText(String(t0.score), cx + wScore * 0.22, y + h / 2 + k);
  ctx.fillText('-', cx + wScore * 0.5, y + h / 2 + k);
  ctx.fillText(String(t1.score), cx + wScore * 0.78, y + h / 2 + k);
  cx += wScore + pad;
  ctx.font = `800 ${15 * k}px ${FONT}`; ctx.fillStyle = '#111a3a'; ctx.direction = 'rtl';
  ctx.fillText(n1, cx + w1 / 2, y + h / 2 + k);
  ctx.fillStyle = t1.kit.shirt; ctx.fillRect(x + total - 4 * k, y, 4 * k, h);
  // "LIVE" tag
  ctx.fillStyle = '#e8453c'; ctx.fillRect(x, y + h, 46 * k, 16 * k);
  ctx.fillStyle = '#fff'; ctx.font = `800 ${10 * k}px ${FONT}`; ctx.textAlign = 'center'; ctx.direction = 'rtl';
  ctx.fillText('שידור חי', x + 23 * k, y + h + 8.5 * k);
  ctx.restore();
}

function nameTag(ctx, x, y, name, color, k, s) {
  // a FIFA-style player indicator: name pill and a small arrow above the head
  ctx.save();
  ctx.font = `800 ${13 * k}px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(name).width + 16 * k, h = 20 * k, top = y - h - 9 * k;
  ctx.fillStyle = 'rgba(11,18,48,0.9)';
  ctx.beginPath(); ctx.roundRect(x - w / 2, top, w, h, 5 * k); ctx.fill();
  ctx.fillStyle = color; ctx.fillRect(x - w / 2, top + h - 3 * k, w, 3 * k);
  ctx.beginPath(); ctx.moveTo(x - 6 * k, y - 8 * k); ctx.lineTo(x + 6 * k, y - 8 * k); ctx.lineTo(x, y - 1 * k); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(name, x, top + h / 2);
  ctx.restore();
}

function groundRing(ctx, cam, p, color) {
  const [x, y] = cam.P(p.x, p.y), s = cam.scale(p.y), fl = cam.height / cam.depth(p.y);
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 0.09 * s;
  ctx.beginPath(); ctx.ellipse(x, y, 0.62 * s, 0.62 * s * Math.min(0.8, fl * 1.3), 0, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.25; ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------ styles A and B
function drawTV(canvas, scene, opt) {
  const R = createRenderer(canvas, { preferGL: false }), ctx = R.g;
  const { g, me } = scene, b = g.ball;
  const cw = canvas.width, ch = canvas.height, k = ch / 390;
  const cam = new Cam(cw, ch, { x: Math.min(W - 8, Math.max(8, me.x + 2)), ...opt });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b0f22'; ctx.fillRect(0, 0, cw, ch);
  drawStands(ctx, cam);
  drawFloor(ctx, cam, scene.floorTV);
  gloss(ctx, cam);
  drawBoards(ctx, cam);
  groundRing(ctx, cam, me, '#ffd23f');
  // depth order: far to near
  const ents = [];
  for (const p of g.all) if (p.active) ents.push({ y: p.y, p });
  g.refs.forEach((f) => ents.push({ y: f.y, ref: f }));
  if (!b.owner) ents.push({ y: b.y, ball: true });
  ents.push({ y: POST_LO - 0.01, goal: 0 }, { y: POST_LO - 0.01, goal: W });
  ents.sort((a, z) => a.y - z.y);
  for (const e of ents) {
    if (e.goal !== undefined) { ctx.setTransform(1, 0, 0, 1, 0, 0); drawGoal3D(ctx, cam, e.goal); continue; }
    if (e.p) {
      const p = e.p;
      withAnchor(R, cam, p.x, p.y, () => {
        T.drawHero(R, p.hero, g.teams[p.team].kit, p, { t: NOW, hasBall: b.owner === p, dribbling: b.owner === p && p.carry === 'drib' });
        if (b.owner === p) T.drawToonBall(R, b.x, b.y, b.z, 0);
      });
    } else if (e.ref) withAnchor(R, cam, e.ref.x, e.ref.y, () => T.drawToonRef(R, e.ref, null, NOW));
    else withAnchor(R, cam, b.x, b.y, () => T.drawToonBall(R, b.x, b.y, b.z, NOW));
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  vignette(ctx, cw, ch);
  const s = cam.scale(me.y), [hx, hy] = cam.P(me.x, me.y);
  nameTag(ctx, hx, hy - 1.75 * s, 'איתן', '#ffd23f', k, s);
  scoreboard(ctx, g, k);
}

// ------------------------------------------------------------------ style C: today's camera, polished
function drawTop(canvas, scene) {
  const R = createRenderer(canvas, { preferGL: false }), ctx = R.g;
  const { g, me } = scene, b = g.ball;
  const cw = canvas.width, ch = canvas.height, k = ch / 390;
  const ppm = Math.min(cw / 24, ch / 13);
  const cx = Math.min(W + 4.5 - cw / 2 / ppm, me.x + 2.5), cy = Math.min(H + 3.5 - ch / 2 / ppm, Math.max(-4 + ch / 2 / ppm, me.y));
  R.begin(cx, cy, ppm, T.TP.clear);
  ctx.drawImage(scene.floorTop.c, 0, 0, scene.floorTop.c.width, scene.floorTop.c.height,
    -14, -12, scene.floorTop.c.width / scene.floorTop.RES, scene.floorTop.c.height / scene.floorTop.RES);
  T.drawToonGoalBack(R, 0); T.drawToonGoalBack(R, W);
  // soft spotlight pools on the floor
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let x = 4; x <= W; x += 8) for (const y of [4, 16]) {
    const gr = ctx.createRadialGradient(x, y, 0, x, y, 6);
    gr.addColorStop(0, 'rgba(255,248,225,0.16)'); gr.addColorStop(1, 'rgba(255,248,225,0)');
    ctx.fillStyle = gr; ctx.fillRect(x - 6, y - 6, 12, 12);
  }
  ctx.restore();
  // FIFA ring under your player
  ctx.save(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 0.09; ctx.beginPath(); ctx.ellipse(me.x, me.y + 0.02, 0.6, 0.26, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.restore();
  const ents = [];
  for (const p of g.all) if (p.active) ents.push({ y: p.y, p });
  g.refs.forEach((f) => ents.push({ y: f.y, ref: f }));
  ents.push({ y: (b.owner ? b.owner.y : b.y) + 0.01, ball: true });
  ents.push({ y: POST_HI, post: 0 }, { y: POST_HI, post: W });
  ents.sort((a, z) => a.y - z.y);
  for (const e of ents) {
    if (e.p) {
      // longer, softer shadows from the roof lights
      ctx.save(); ctx.fillStyle = 'rgba(0,0,30,0.18)'; ctx.beginPath(); ctx.ellipse(e.p.x + 0.35, e.p.y + 0.05, 0.55, 0.16, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      T.drawHero(R, e.p.hero, g.teams[e.p.team].kit, e.p, { t: NOW, hasBall: b.owner === e.p, dribbling: b.owner === e.p && e.p.carry === 'drib' });
    } else if (e.ref) T.drawToonRef(R, e.ref, null, NOW);
    else if (e.ball) T.drawToonBall(R, b.x, b.y, b.z, b.owner ? 0 : NOW);
    else T.toonPost(R, e.post, POST_HI);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  vignette(ctx, cw, ch);
  const hx = cw / 2 + (me.x - cx) * ppm, hy = ch / 2 + (me.y - me.z * 0.62 - 1.45 - cy) * ppm;
  nameTag(ctx, hx, hy, 'איתן', '#ffd23f', k, ppm);
  scoreboard(ctx, g, k);
}

function topFloor() {
  // today's arena (with its crowd) plus parquet planks
  const RES = 26, X0 = -14, Y0 = -12, X1 = W + 14, Y1 = H + 12;
  const c = document.createElement('canvas');
  c.width = (X1 - X0) * RES; c.height = (Y1 - Y0) * RES;
  const R = createRenderer(c, { preferGL: false });
  R.begin((X0 + X1) / 2, (Y0 + Y1) / 2, RES, T.TP.clear);
  T.drawToonArena(R, NOW, 0);
  const g = R.g;
  g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip();
  for (let y = 0, row = 0; y < H; y += 0.32, row++) {
    g.fillStyle = 'rgba(60,30,0,0.10)'; g.fillRect(0, y, W, 0.018);
    for (let x = (row % 3) * 0.7 - 2.1; x < W; x += 2.1) {
      const k = Math.sin(x * 12.9 + row * 78.2) * 0.5 + 0.5;
      g.fillStyle = k > 0.5 ? `rgba(255,240,210,${(k - 0.5) * 0.12})` : `rgba(80,40,0,${(0.5 - k) * 0.12})`;
      g.fillRect(x, y + 0.018, 2.08, 0.302);
    }
  }
  g.restore();
  return { c, RES };
}

// ------------------------------------------------------------------ boot
export async function run() {
  try { await document.fonts.load(`900 20px Rubik`); await document.fonts.load(`800 20px Rubik`); } catch {}
  const scene = makeScene();
  scene.floorTV = floorCanvas(true);
  scene.floorTop = topFloor();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  for (const cv of document.querySelectorAll('canvas[data-style]')) {
    const r = cv.getBoundingClientRect();
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    const st = cv.dataset.style;
    if (st === 'A') drawTV(cv, scene, { height: 22, back: 30, farY: 0.30, nearY: 0.97 });
    else if (st === 'B') drawTV(cv, scene, { height: 8.5, back: 11, farY: 0.24, nearY: 1.12 });
    else drawTop(cv, scene);
  }
  document.body.dataset.ready = '1';
}
