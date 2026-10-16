// Scene drawing: arena, court markings, goals, players, referees, ball and overlays.
// Everything is built from four primitives (ellipse, rounded rect, ring, line) so it runs on
// both the WebGPU and the Canvas 2D renderer.

import { W, H, CX, CY, POST_LO, POST_HI, GOAL_H, AREA_R, FREE_R, PEN_D, GK_LINE, Z2Y, dPoint } from './court.js';

const cache = new Map();
export function col(hex, a = 1) {
  const k = hex + a;
  let c = cache.get(k);
  if (!c) {
    const n = parseInt(hex.slice(1), 16);
    c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
    cache.set(k, c);
  }
  return c;
}

export const PAL = {
  clear: col('#0d1622'),
  stands: col('#16222f'),
  runoff: col('#1d4a7a'),
  court: col('#2f74b8'),
  courtAlt: col('#2b6cad'),
  area: col('#5b9ad4'),
  line: col('#f4f7fb'),
  lineSoft: col('#f4f7fb', 0.55),
  shadow: col('#000000', 0.28),
  net: col('#ffffff', 0.35),
  postRed: col('#e23a32'),
  postWhite: col('#f7f7f7'),
  ball: col('#fbfbf6'),
  ballSeam: col('#2f74b8'),
  ref: col('#c6f432'),
  refDark: col('#151515'),
  eye: col('#1a1a1a'),
  marker: col('#ffffff', 0.9),
  markerSoft: col('#ffffff', 0.35),
  hint: col('#ffd23f', 0.85),
  danger: col('#ff5a4e'),
};

// ------------------------------------------------------------------ crowd (static, generated once)
const crowd = [];
(function buildCrowd() {
  const shirts = ['#ffd23f', '#e8453c', '#f4f7fb', '#1b2a4a', '#ffb000', '#c53030', '#8aa3c2', '#2b2b2b'];
  const add = (x, y) => crowd.push({ x, y, c: col(shirts[(Math.random() * shirts.length) | 0]), h: col(['#f1c7a5', '#c68b62', '#7a4b2f', '#e0ac85'][(Math.random() * 4) | 0]), p: Math.random() * 6 });
  for (let row = 0; row < 5; row++) {
    for (let x = -6; x <= W + 6; x += 0.62) {
      add(x + (row % 2) * 0.31, -3.4 - row * 0.75);
      if (row < 3 && (x < CX - 10 || x > CX + 10)) add(x + (row % 2) * 0.31, H + 3.6 + row * 0.75);
    }
  }
  for (let row = 0; row < 4; row++) {
    for (let y = -2; y <= H + 2; y += 0.62) {
      add(-5.2 - row * 0.75, y + (row % 2) * 0.31);
      add(W + 5.2 + row * 0.75, y + (row % 2) * 0.31);
    }
  }
})();

function dLine(R, gx, r, hw, c, dashed) {
  const N = 64;
  let prev = dPoint(gx, r, 0);
  for (let i = 1; i <= N; i++) {
    const q = dPoint(gx, r, i / N);
    const inside = prev.y >= 0 && prev.y <= H && q.y >= 0 && q.y <= H;
    if (inside && (!dashed || i % 2 === 0)) R.line(prev.x, prev.y, q.x, q.y, hw, c);
    prev = q;
  }
}

function fillD(R, gx, r, c) {
  // Fill the goal area with overlapping discs and a rectangle (exact for the D shape).
  const s = gx === 0 ? 1 : -1;
  R.rect(gx + s * r / 2, CY, r / 2, (POST_HI - POST_LO) / 2, c);
  R.ellipse(gx, POST_LO, r, r, c);
  R.ellipse(gx, POST_HI, r, r, c);
}

export function drawArena(R, t, excite) {
  // stands, run-off area and court
  R.rect(CX, CY, W / 2 + 12, H / 2 + 9, PAL.stands);
  R.rect(CX, CY, W / 2 + 2.6, H / 2 + 2.4, PAL.runoff);
  R.rect(CX, CY, W / 2, H / 2, PAL.court);
  for (let i = 0; i < 10; i++) R.rect(2 + i * 4, CY, 1, H / 2, PAL.courtAlt);
  fillD(R, 0, AREA_R, PAL.area);
  fillD(R, W, AREA_R, PAL.area);
  // the goal-area discs reach behind the goal lines: paint the surroundings back over them
  R.rect(-1.3, CY, 1.3, H / 2 + 2.4, PAL.runoff);
  R.rect(W + 1.3, CY, 1.3, H / 2 + 2.4, PAL.runoff);
  R.rect(-7.3, CY, 4.7, H / 2 + 9, PAL.stands);
  R.rect(W + 7.3, CY, 4.7, H / 2 + 9, PAL.stands);
  for (const f of crowd) {
    const bob = excite > 0 ? Math.abs(Math.sin(t * 9 + f.p)) * 0.18 * excite : Math.sin(t * 1.3 + f.p) * 0.02;
    R.ellipse(f.x, f.y + 0.1, 0.24, 0.2, f.c);
    R.ellipse(f.x, f.y - 0.22 - bob, 0.13, 0.13, f.h);
  }

  // benches and substitution zones (bottom side)
  R.rect(CX - 7, H + 1.6, 3.2, 0.35, col('#0e2c4c'), 0, 0.15);
  R.rect(CX + 7, H + 1.6, 3.2, 0.35, col('#0e2c4c'), 0, 0.15);
  R.rect(CX, H + 1.4, 0.7, 0.4, col('#0e2c4c'), 0, 0.1); // timekeeper table

  const lw = 0.05, L = PAL.line;
  R.line(0, 0, W, 0, lw, L);
  R.line(0, H, W, H, lw, L);
  R.line(0, 0, 0, H, lw, L);
  R.line(W, 0, W, H, lw, L);
  R.line(CX, 0, CX, H, lw, L);
  R.ring(CX, CY, 2, 2, lw * 0.8, PAL.lineSoft); // throw-off area
  for (const x of [CX - 4.5, CX + 4.5]) R.line(x, H - 0.0, x, H + 0.3, lw, L); // substitution lines
  for (const gx of [0, W]) {
    const s = gx === 0 ? 1 : -1;
    dLine(R, gx, AREA_R, lw, L, false);
    dLine(R, gx, FREE_R, lw, L, true);
    R.line(gx + s * PEN_D, CY - 0.5, gx + s * PEN_D, CY + 0.5, lw, L);
    R.line(gx + s * GK_LINE, CY - 0.075, gx + s * GK_LINE, CY + 0.075, lw, L);
  }
}

// Back part of a goal: floor, net and far post. The near post is drawn with the sorted entities.
export function drawGoalBack(R, gx) {
  const s = gx === 0 ? 1 : -1, bx = gx - s * 0.95;
  R.rect(gx - s * 0.47, CY, 0.47, 1.5, col('#000000', 0.22));
  const top = (z) => z * Z2Y;
  for (let i = 0; i <= 6; i++) {
    const y = POST_LO + i * 0.5;
    R.line(gx, y - top(GOAL_H), bx, y - top(1.4), 0.012, PAL.net);
    R.line(bx, y - top(1.4), bx, y, 0.012, PAL.net);
  }
  for (let k = 0; k <= 4; k++) {
    const z = 1.4 * (k / 4);
    R.line(bx, POST_LO - top(z), bx, POST_HI - top(z), 0.012, PAL.net);
  }
  for (let k = 1; k <= 3; k++) {
    const f = k / 4, x = gx + (bx - gx) * f, z = GOAL_H + (1.4 - GOAL_H) * f;
    R.line(x, POST_LO - top(z), x, POST_HI - top(z), 0.012, PAL.net);
  }
  post(R, gx, POST_LO);
  // crossbar (striped)
  const y0 = POST_LO - top(GOAL_H), y1 = POST_HI - top(GOAL_H);
  for (let i = 0; i < 15; i++) {
    const a = y0 + ((y1 - y0) * i) / 15, b = y0 + ((y1 - y0) * (i + 1)) / 15;
    R.line(gx, a, gx, b, 0.05, i % 2 ? PAL.postWhite : PAL.postRed);
  }
}

export function post(R, gx, y) {
  const h = GOAL_H * Z2Y;
  for (let i = 0; i < 10; i++) {
    R.line(gx, y - (h * i) / 10, gx, y - (h * (i + 1)) / 10, 0.05, i % 2 ? PAL.postWhite : PAL.postRed);
  }
}

// ------------------------------------------------------------------ figures
export function drawPlayer(R, p, kit, o) {
  const X = p.x, Y = p.y - p.z * Z2Y;
  const sp = Math.hypot(p.vx, p.vy);
  const cf = Math.cos(p.face), sf = Math.sin(p.face);
  const dirX = cf >= 0 ? 1 : -1;
  const back = sf < -0.5, front = sf > 0.5, side = !back && !front;
  const run = Math.min(1, sp / 3);
  const sw = Math.sin(p.phase) * run;
  const shirt = col(p.gk ? kit.gk : kit.shirt), trim = col(p.gk ? kit.gkTrim : kit.trim), shorts = col(kit.shorts);
  const skin = col(p.look.skin), hair = col(p.look.hair);
  const alpha = o.ghost ? 0.4 : 1;
  const A = (c) => (alpha === 1 ? c : [c[0], c[1], c[2], c[3] * alpha]);

  // shadow on the floor
  const sh = 1 / (1 + p.z * 1.2);
  R.ellipse(p.x, p.y + 0.03, 0.3 * sh, 0.13 * sh, PAL.shadow);

  // legs
  const hipY = Y - 0.42;
  for (const k of [-1, 1]) {
    const hx = X + k * 0.075;
    let fx = hx, fy = Y;
    if (side) fx += k * sw * 0.16 * dirX;
    else fy -= Math.max(0, k * sw) * 0.08;
    if (p.air) { fx = hx + k * 0.05; fy = Y - 0.08 + (k > 0 ? -0.06 : 0); }
    R.line(hx, hipY, fx, fy - 0.04, 0.055, A(skin));
    R.ellipse(fx + (side ? dirX * 0.03 : 0), fy - 0.02, 0.065, 0.04, A(PAL.refDark));
  }
  R.rect(X, hipY + 0.02, 0.15, 0.09, A(shorts), 0, 0.03);

  // arms (behind torso when seen from the side)
  const shY = Y - 0.86;
  const hands = armPose(p, X, Y, dirX, sw, o);
  const drawArm = (k) => {
    const sx = X + k * (side ? 0.06 : 0.16), h = hands[k > 0 ? 1 : 0];
    R.line(sx, shY, h[0], h[1], 0.045, A(skin));
    if (p.gk) R.ellipse(h[0], h[1], 0.06, 0.06, A(trim));
  };
  if (side) drawArm(-dirX);

  // torso
  R.rect(X, Y - 0.7, side ? 0.13 : 0.17, 0.21, A(shirt), 0, 0.07);
  if (back) {
    // number block on the back
    R.rect(X, Y - 0.72, 0.07, 0.09, A(trim), 0, 0.02);
  } else {
    R.rect(X, Y - 0.83, side ? 0.13 : 0.17, 0.035, A(trim));
  }
  if (!side) { drawArm(-1); drawArm(1); } else drawArm(dirX);

  // head
  const hy = Y - 1.07;
  if (back) {
    R.ellipse(X, hy, 0.135, 0.135, A(hair));
  } else {
    R.ellipse(X - (side ? dirX * 0.03 : 0), hy - 0.03, 0.135, 0.13, A(hair));
    R.ellipse(X + (side ? dirX * 0.025 : 0), hy + 0.01, 0.118, 0.118, A(skin));
    if (p.look.style === 1) R.ellipse(X - (side ? dirX * 0.06 : 0), hy - 0.08, 0.12, 0.06, A(hair));
    if (p.look.style === 2) R.ellipse(X - dirX * 0.12, hy + 0.04, 0.05, 0.08, A(hair));
    if (front) {
      R.ellipse(X - 0.045, hy + 0.01, 0.018, 0.022, PAL.eye);
      R.ellipse(X + 0.045, hy + 0.01, 0.018, 0.022, PAL.eye);
    } else {
      R.ellipse(X + dirX * 0.075, hy + 0.0, 0.017, 0.021, PAL.eye);
    }
  }
}

function armPose(p, X, Y, dirX, sw, o) {
  const shY = Y - 0.86;
  if (p.action === 'shoot' && p.actT < 0.3) return [[X - dirX * 0.05, Y - 1.3], [X + dirX * 0.22, Y - 1.15]];
  if (p.charging) return [[X - dirX * 0.18, Y - 1.25], [X + dirX * 0.18, Y - 0.7]];
  if (p.action === 'steal' && p.actT < 0.3) return [[X + dirX * 0.32, Y - 0.8], [X + dirX * 0.3, Y - 0.7]];
  if (p.stance > 0) return [[X - 0.22, Y - 1.3], [X + 0.22, Y - 1.3]];
  if (p.gk) {
    if (p.action === 'dive') {
      const d = p.diveDir || 1;
      return [[X - 0.25, Y - 0.9 + d * 0.35], [X + 0.25, Y - 0.9 + d * 0.35]];
    }
    if (o.alert) return [[X - 0.3, Y - 1.15], [X + 0.3, Y - 1.15]];
  }
  if (o.hasBall && !o.dribbling) return [[X - dirX * 0.18, Y - 0.62], [X + dirX * 0.24, Y - 0.78]];
  if (o.hasBall && o.dribbling) return [[X - dirX * 0.18 - sw * 0.06, Y - 0.62], [X + dirX * 0.24, Y - 0.62]];
  return [[X - 0.21 - sw * 0.07 * dirX, shY + 0.26], [X + 0.21 + sw * 0.07 * dirX, shY + 0.26]];
}

export function drawReferee(R, f, signal) {
  const kit = { shirt: '#c6f432', trim: '#151515', shorts: '#151515', gk: '#c6f432', gkTrim: '#151515' };
  const p = {
    x: f.x, y: f.y, z: 0, vx: f.vx, vy: f.vy, face: f.face, phase: f.phase, gk: false,
    look: { skin: '#e0ac85', hair: '#2a2a2a', style: 0 }, action: null, actT: 0, stance: signal ? 1 : 0,
  };
  drawPlayer(R, p, kit, {});
}

export function drawBall(R, b) {
  const sy = b.y - b.z * Z2Y;
  const sh = 1 / (1 + b.z * 0.8);
  R.ellipse(b.x, b.y + 0.02, 0.12 * sh, 0.06 * sh, PAL.shadow);
  R.ellipse(b.x, sy, 0.11, 0.11, PAL.ball);
  R.line(b.x - 0.08, sy - 0.03, b.x + 0.08, sy + 0.03, 0.018, PAL.ballSeam);
  R.ellipse(b.x - 0.035, sy - 0.04, 0.03, 0.025, col('#ffffff', 0.9));
}

export function drawMarker(R, p, t, color) {
  const pulse = 1 + Math.sin(t * 6) * 0.06;
  R.ring(p.x, p.y + 0.03, 0.42 * pulse, 0.2 * pulse, 0.03, color || PAL.marker);
}

export function drawHeadTag(R, p, t, color) {
  const y = p.y - p.z * Z2Y - 1.42 + Math.sin(t * 5) * 0.04;
  R.line(p.x - 0.09, y - 0.1, p.x, y, 0.035, color);
  R.line(p.x + 0.09, y - 0.1, p.x, y, 0.035, color);
}
