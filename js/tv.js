// TV camera view ("like FIFA"): a high camera on the near sideline looks across the court.
// The floor is a top-down drawing of the court, projected in perspective by the renderer
// (R.floor). Everything upright (heroes, goals, boards, fans) is drawn with the usual toon
// code through a proxy that scales it for its distance and stands it on its projected feet.
import * as T from './toon.js';
import { snowflake } from './heroes.js';
import { W, H, CX, CY, POST_LO, POST_HI, GOAL_H } from './court.js';

const FLOOR_BOX = [-14, -12, W + 14, H + 12];
const STAND_Y = -2.2; // the floor ends here; the stands rise behind it

// ------------------------------------------------------------------ camera
export class TVCam {
  constructor() { this.x = CX; this.ready = false; }
  // w, h: canvas pixels. tx: where the action is (metres along the court).
  update(w, h, tx, dt, snap) {
    const nearY = 0.92, farY = 0.27;
    let height = 12, back = 15, f, hor;
    // on narrow screens move the camera back so you still see at least 18 m of the near sideline
    for (let i = 0; i < 30; i++) {
      f = ((nearY - farY) * h) / (height * (1 / back - 1 / (back + H)));
      if ((w * back) / f >= 18) break;
      back *= 1.08; height *= 1.04;
    }
    hor = nearY * h - (f * height) / back;
    Object.assign(this, { w, h, f, hor, height, back, yPos: H + back, minY: STAND_Y });
    const half = (w / 2) * back / f;
    let lo = half - 4, hi = W + 4 - half;
    tx = lo > hi ? CX : Math.min(Math.max(tx, lo), hi);
    const k = snap || !this.ready ? 1 : 1 - Math.exp(-dt * 4.5);
    this.x += (tx - this.x) * k;
    this.ready = true;
  }
  depth(y) { return this.yPos - y; }
  scale(y) { return this.f / (this.yPos - y); }
  P(x, y, z = 0) {
    const d = this.yPos - y;
    return [this.w / 2 + (this.f * (x - this.x)) / d, this.hor + (this.f * (this.height - z)) / d];
  }
}

// ------------------------------------------------------------------ floor texture
export function makeFloor(createRenderer) {
  const RES = 24, [X0, Y0, X1, Y1] = FLOOR_BOX;
  const c = document.createElement('canvas');
  c.width = (X1 - X0) * RES; c.height = (Y1 - Y0) * RES;
  const R = createRenderer(c, { preferGL: false });
  R.begin((X0 + X1) / 2, (Y0 + Y1) / 2, RES, T.TP.clear);
  T.drawToonArena(R, 0, 0);
  const g = R.g;
  // the flat crowd of the top view goes: the TV view has real stands
  g.fillStyle = '#1a2340';
  g.fillRect(X0, Y0, X1 - X0, STAND_Y - Y0);
  g.fillRect(X0, H + 2.5, X1 - X0, Y1 - H - 2.5);
  g.fillRect(X0, Y0, -2.7 - X0, Y1 - Y0);
  g.fillRect(W + 2.7, Y0, X1 - W - 2.7, Y1 - Y0);
  // the benches go back on the near side
  for (const [x, cc] of [[CX - 7, '#ffd23f'], [CX + 7, '#e8453c']]) { g.fillStyle = cc; g.fillRect(x - 3.2, H + 1.4, 6.4, 0.6); }
  // parquet planks
  g.save(); g.beginPath(); g.rect(-2.7, -2.5, W + 5.4, H + 5); g.clip();
  for (let y = -2.5, row = 0; y < H + 2.5; y += 0.32, row++) {
    g.fillStyle = 'rgba(60,30,0,0.10)'; g.fillRect(-2.7, y, W + 5.4, 0.02);
    for (let x = -2.7 + (row % 3) * 0.7; x < W + 2.7; x += 2.1) {
      const k = Math.sin(x * 12.9 + row * 78.2) * 0.5 + 0.5;
      g.fillStyle = k > 0.5 ? `rgba(255,240,210,${((k - 0.5) * 0.1).toFixed(3)})` : `rgba(80,40,0,${((0.5 - k) * 0.1).toFixed(3)})`;
      g.fillRect(x, y + 0.02, 2.08, 0.3);
      g.fillStyle = 'rgba(60,30,0,0.12)'; g.fillRect(x + 2.08, y, 0.02, 0.32);
    }
  }
  g.restore();
  return { canvas: c, box: FLOOR_BOX };
}

// ------------------------------------------------------------------ distance proxy
// Looks like a renderer to the toon code; maps world metres around an anchor to screen pixels.
class Proxy {
  constructor() { this.cam = { ppm: 1 }; this.s = 1; this.ox = 0; this.oy = 0; }
  // heroes, referees and the ball are drawn a bit bigger than life (cartoon style), around their feet
  at(R, cam, x, y, big = BIG) {
    const s = cam.scale(y) * big, [sx, sy] = cam.P(x, y);
    this.R = R; this.s = s; this.ox = sx - x * s; this.oy = sy - y * s; this.cam.ppm = s;
    return this;
  }
  ellipse(x, y, rx, ry, c) { const s = this.s; this.R.ellipse(x * s + this.ox, y * s + this.oy, rx * s, ry * s, c); }
  rect(x, y, hw, hh, c, rot = 0, rad = 0) { const s = this.s; this.R.rect(x * s + this.ox, y * s + this.oy, hw * s, hh * s, c, rot, rad * s); }
  ring(x, y, rx, ry, th, c) { const s = this.s; this.R.ring(x * s + this.ox, y * s + this.oy, rx * s, ry * s, th * s, c); }
  line(x1, y1, x2, y2, hw, c) { const s = this.s; this.R.line(x1 * s + this.ox, y1 * s + this.oy, x2 * s + this.ox, y2 * s + this.oy, hw * s, c); }
  tri(x1, y1, x2, y2, x3, y3, c, round = 0) {
    const s = this.s, ox = this.ox, oy = this.oy;
    this.R.tri(x1 * s + ox, y1 * s + oy, x2 * s + ox, y2 * s + oy, x3 * s + ox, y3 * s + oy, c, round * s);
  }
}
const BIG = 1.3;
const PX = new Proxy();

// ------------------------------------------------------------------ the arena
const C = (h, a = 1) => T.col(h, a);
const FANS = ['#ffd23f', '#e8453c', '#ffffff', '#3f8ee6', '#ffd23f', '#ff9f1c', '#e8453c', '#7cf26b'].map((h) => C(h));
const SKINS = ['#f2c6a4', '#e0ac85', '#a36a45', '#7a4b2f', '#f1c7a5'].map((h) => C(h));
const WALL = [C('#05070f'), C('#0d1430'), C('#151e44')], TIER = [C('#222c58'), C('#27336a')];
const GLOW = [C('#fffbe6', 0.1), C('#fffbe6', 0.25), C('#fffbe6', 0.95)];
const NIGHT = C('#04061a', 0.6), BEAM = C('#fffbe6', 0.05);
const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };

function quad(R, a, b, c, d, col) { R.tri(a[0], a[1], b[0], b[1], c[0], c[1], col); R.tri(a[0], a[1], c[0], c[1], d[0], d[1], col); }

function drawStands(R, cam, t, excite) {
  const w = cam.w, top = cam.P(0, STAND_Y)[1];
  R.rect(w / 2, top / 2, w / 2 + 2, top / 2 + 2, WALL[1]);
  R.rect(w / 2, top * 0.12, w / 2 + 2, top * 0.12 + 2, WALL[0]);
  const k = cam.h / 390;
  for (let x = -6; x <= W + 6; x += 8) {
    const [px, py] = cam.P(x, -14, 16);
    if (px < -60 * k || px > w + 60 * k) continue;
    R.ellipse(px, py, 40 * k, 30 * k, GLOW[0]);
    R.ellipse(px, py, 16 * k, 12 * k, GLOW[1]);
    R.ellipse(px, py, 6 * k, 5 * k, GLOW[2]);
  }
  for (let r = 10; r >= 0; r--) {
    const y = -3.6 - r * 0.85, z = 0.5 + r * 0.62, d = cam.depth(y), s = cam.scale(y);
    const xL = cam.x - (w / 2 + 20) * d / cam.f, xR = cam.x + (w / 2 + 20) * d / cam.f;
    quad(R, cam.P(xL, y, z), cam.P(xR, y, z), cam.P(xR, y + 0.85, z - 0.62), cam.P(xL, y + 0.85, z - 0.62), TIER[r % 2]);
    const step = 0.62, i0 = Math.ceil(xL / step), i1 = Math.floor(xR / step);
    for (let i = i0; i <= i1; i++) {
      const h1 = hash(i, r);
      if (h1 < 0.08) continue;
      const bob = excite > 0 ? Math.abs(Math.sin(t * 9 + h1 * 30)) * 0.25 * excite : (Math.sin(t * 1.6 + h1 * 30) * 0.5 + 0.5) * 0.04;
      const [px, py0] = cam.P(i * step + (r % 2) * 0.3, y, z + bob), py = py0;
      R.ellipse(px, py - 0.18 * s, 0.25 * s, 0.24 * s, FANS[(i * 7 + r * 3) & 7]);
      R.ellipse(px, py - 0.55 * s, 0.17 * s, 0.17 * s, SKINS[((h1 * 50) | 0) % 5]);
      if (h1 > 0.86 || (excite > 0.3 && h1 > 0.5)) R.line(px - 0.2 * s, py - 0.4 * s, px - 0.32 * s, py - 0.95 * s, 0.05 * s, FANS[(r + i) & 7]);
    }
  }
}

const ADS = [['#ffd23f', '#1b2a4a', 'ball'], ['#e8453c', '#ffffff', 'bolt'], ['#3f8ee6', '#ffffff', 'star'], ['#7fd4ff', '#0b3a6b', 'snow'], ['#3ccf74', '#0e3b22', 'ball']].map(([a, b, k]) => [C(a), C(b), k]);
const BOARD = C('#0b0f22');
function drawBoards(R, cam) {
  const y = -2.4, s = cam.scale(y);
  for (let i = 0, x = -4; x < W + 4; i++, x += 6) {
    const [bg, fg, kind] = ADS[i % ADS.length];
    const a = cam.P(x, y, 0), b = cam.P(x + 6, y, 0);
    if (b[0] < 0 || a[0] > cam.w) continue;
    quad(R, a, b, cam.P(x + 6, y, 0.9), cam.P(x, y, 0.9), BOARD);
    quad(R, cam.P(x + 0.06, y, 0.08), cam.P(x + 5.94, y, 0.08), cam.P(x + 5.94, y, 0.82), cam.P(x + 0.06, y, 0.82), bg);
    for (const dx of [1.5, 4.5]) {
      const [mx, my] = cam.P(x + dx, y, 0.45);
      if (kind === 'snow') snowflake(R, mx, my, 0.28 * s, fg, 0.04 * s);
      else if (kind === 'bolt') { R.tri(mx + 0.05 * s, my - 0.3 * s, mx - 0.15 * s, my + 0.04 * s, mx + 0.02 * s, my + 0.02 * s, fg); R.tri(mx - 0.02 * s, my - 0.02 * s, mx + 0.15 * s, my - 0.04 * s, mx - 0.05 * s, my + 0.3 * s, fg); }
      else if (kind === 'star') { for (let k = 0; k < 5; k++) { const a1 = -Math.PI / 2 + (k * 2 * Math.PI) / 5; R.tri(mx, my, mx + Math.cos(a1 - 0.5) * 0.12 * s, my + Math.sin(a1 - 0.5) * 0.12 * s, mx + Math.cos(a1) * 0.3 * s, my + Math.sin(a1) * 0.3 * s, fg); R.tri(mx, my, mx + Math.cos(a1 + 0.5) * 0.12 * s, my + Math.sin(a1 + 0.5) * 0.12 * s, mx + Math.cos(a1) * 0.3 * s, my + Math.sin(a1) * 0.3 * s, fg); } }
      else { R.ellipse(mx, my, 0.27 * s, 0.27 * s, fg); R.ring(mx, my, 0.17 * s, 0.17 * s, 0.035 * s, bg); }
    }
  }
}

const NET = C('#ffffff', 0.5), RED = C('#e8453c'), WHITE = C('#ffffff'), INKC = T.TP.ink;
function bar(R, a, b, n, hw) {
  R.line(a[0], a[1], b[0], b[1], hw * 1.35, INKC);
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    R.line(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0, a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1, hw, i % 2 ? WHITE : RED);
  }
}
// part: 'back' (net, far post, crossbar) or 'front' (near post)
function drawGoal(R, cam, gx, part) {
  const s = gx === 0 ? -1 : 1, back = gx + s * 1.0, P = (x, y, z) => cam.P(x, y, z), sc = cam.scale(CY), hw = sc * 0.045;
  if (part === 'back') {
    const nw = Math.max(0.6, sc * 0.012), L = (a, b) => R.line(a[0], a[1], b[0], b[1], nw, NET);
    for (let i = 0; i <= 12; i++) { const y = POST_LO + (i / 12) * 3; L(P(gx, y, GOAL_H), P(back, y, 1.3)); L(P(back, y, 1.3), P(back, y, 0)); }
    for (let k = 0; k <= 6; k++) { const z = 1.3 * (k / 6); L(P(back, POST_LO, z), P(back, POST_HI, z)); }
    for (const y of [POST_LO, POST_HI]) for (let k = 0; k <= 4; k++) { const z = 1.3 * (k / 4); L(P(gx, y, z), P(back, y, z)); }
    bar(R, P(gx, POST_LO, 0), P(gx, POST_LO, GOAL_H), 10, hw);
    bar(R, P(gx, POST_LO, GOAL_H), P(gx, POST_HI, GOAL_H), 15, hw);
  } else bar(R, P(gx, POST_HI, 0), P(gx, POST_HI, GOAL_H), 10, hw);
}

// ------------------------------------------------------------------ the frame
const ents = [];
// o: { game, now, excite, night, trail, mode, hint, soft, ruleDots(R, p) }
export function renderTV(R, cam, o) {
  const g = o.game, b = g.ball, w = cam.w, h = cam.h;
  R.begin(w / 2, h / 2, 1, T.TP.clear);
  const c = g.controlled, focus = c && c.active ? c : b.owner || b;
  R.floor({ x: cam.x, height: cam.height, yPos: cam.yPos, f: cam.f, hor: cam.hor, minY: cam.minY, spot: o.night ? [focus.x, focus.y, 5, 0.6] : null });
  drawStands(R, cam, o.now, o.excite);
  drawBoards(R, cam);
  if (o.night) {
    const top = cam.P(0, STAND_Y)[1];
    R.rect(w / 2, top / 2, w / 2 + 2, top / 2 + 1, NIGHT);
    const [lx, ly] = cam.P(focus.x, focus.y), r = cam.scale(focus.y) * 2.5;
    for (const bx of [0.2, 0.8]) R.tri(w * bx - 10, -5, w * bx + 10, -5, lx + (bx - 0.5) * r, ly, BEAM);
  }

  const menu = o.mode === 'menu' || o.mode === 'pick';
  if (c && c.active && !menu) T.drawMarker(PX.at(R, cam, c.x, c.y), c, o.now, o.hint);
  if (g.passHint) T.drawMarker(PX.at(R, cam, g.passHint.x, g.passHint.y), g.passHint, o.now, o.soft);
  if (c && c.charging && !menu) drawAim(R, cam, g, c, o.aimY);

  ents.length = 0;
  for (const p of g.all) ents.push({ y: p.y, p });
  g.refs.forEach((f, i) => ents.push({ y: f.y, ref: f, i }));
  if (!b.owner) ents.push({ y: b.y + 0.01, ball: true });
  for (const gx of [0, W]) { ents.push({ y: POST_LO - 0.01, goal: gx, part: 'back' }); ents.push({ y: POST_HI + 0.01, goal: gx, part: 'front' }); }
  ents.sort((a, z) => a.y - z.y);
  const alert = b.state === 'shot';
  for (const e of ents) {
    if (e.p) {
      const p = e.p, r = PX.at(R, cam, p.x, p.y);
      if (p.frozen > 0 && !p.iced) T.drawPowerAura(r, p, o.now, '#7fe7ff');
      else if (p.effects.length && g.powers.teams[p.team]) T.drawPowerAura(r, p, o.now, g.powers.teams[p.team].template.aura);
      T.drawHero(r, p.hero, g.teams[p.team].kit, p, {
        t: o.now, hasBall: b.owner === p, dribbling: b.owner === p && p.carry === 'drib',
        alert: alert && p.gk && g.teams[p.team].defX === b.goalX,
      });
      if (p.frozen > 0 && p.iced) T.drawIceBlock(r, p, o.now);
      if (b.owner === p) drawBall(r, g, o);
      if (p === c && c.active && !menu) { T.drawHeadTag(r, c, o.now, o.hint); o.ruleDots(r, c); }
    } else if (e.ref) T.drawToonRef(PX.at(R, cam, e.ref.x, e.ref.y), e.ref, g.signal && e.i === 0 ? g.signal.type : null, o.now);
    else if (e.ball) drawBall(PX.at(R, cam, b.x, b.y), g, o);
    else drawGoal(R, cam, e.goal, e.part);
  }
  R.end();
}

function drawBall(r, g, o) {
  const b = g.ball;
  if (b.power) { T.drawPowerTrail(r, b.power, o.trail, o.now); T.drawPowerBall(r, b.power, b.x, b.y, b.z, o.now); }
  else if (b.state !== 'dead' || g.state === 'goal') T.drawToonBall(r, b.x, b.y, b.z, b.owner ? 0 : o.now);
}

function drawAim(R, cam, g, p, aimY) {
  const t = g.teams[p.team], ax = t.defX === 0 ? W : 0;
  const ty = CY + aimY, x0 = p.x, y0 = p.y, dx = ax - x0, dy = ty - y0, d = Math.hypot(dx, dy);
  const n = Math.floor(d / 0.6);
  const colr = T.col('#ffd23f', Math.round((0.35 + p.charge * 0.6) * 20) / 20);
  for (let i = 1; i < n; i += 2) {
    const a = i / n, b2 = Math.min(1, (i + 1) / n);
    const A = cam.P(x0 + dx * a, y0 + dy * a), B = cam.P(x0 + dx * b2, y0 + dy * b2), s = cam.scale(y0 + dy * a);
    R.line(A[0], A[1], B[0], B[1], (0.035 + p.charge * 0.03) * s, colr);
  }
}

