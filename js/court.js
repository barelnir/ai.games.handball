// Court geometry (IHF rules), in metres. x runs goal-to-goal (0..40), y runs side-to-side (0..20).
// Screen projection is top-down with height (z) lifting things up the screen by Z2Y.

export const W = 40;          // court length
export const H = 20;          // court width
export const CX = 20;
export const CY = 10;
export const POST_LO = 8.5;   // goal is 3 m wide, centred
export const POST_HI = 11.5;
export const GOAL_H = 2;      // goal is 2 m high
export const AREA_R = 6;      // goal-area line
export const FREE_R = 9;      // free-throw line (dashed)
export const PEN_D = 7;       // 7-metre mark
export const GK_LINE = 4;     // goalkeeper restraining line
export const Z2Y = 0.62;      // screen lift per metre of height

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

// Distance from a point to the goal mouth (the segment between the posts).
// The goal area is exactly the set of points with goalDist < 6.
export function goalDist(x, y, gx) {
  const cy = clamp(y, POST_LO, POST_HI);
  return Math.hypot(x - gx, y - cy);
}

// Move a point so that it is at least r from the goal mouth (on the court side).
export function pushOut(x, y, gx, r) {
  const cy = clamp(y, POST_LO, POST_HI);
  let dx = x - gx, dy = y - cy;
  const s = gx === 0 ? 1 : -1;
  if (dx * s < 0) dx = 0;
  let d = Math.hypot(dx, dy);
  if (d >= r) return { x, y };
  if (d < 1e-6) { dx = s; dy = 0; d = 1; }
  return { x: gx + (dx / d) * r, y: cy + (dy / d) * r };
}

// Point on the "D" shaped line of radius r around goal gx. t=0 is where it meets
// the goal line on the y<10 side, t=1 on the y>10 side.
export function dPoint(gx, r, t) {
  const s = gx === 0 ? 1 : -1;
  const arc = (Math.PI * r) / 2;
  const L = 2 * arc + (POST_HI - POST_LO);
  let d = clamp(t, 0, 1) * L;
  if (d < arc) {
    const a = -Math.PI / 2 + d / r;
    return { x: gx + s * r * Math.cos(a), y: POST_LO + r * Math.sin(a) };
  }
  d -= arc;
  if (d < POST_HI - POST_LO) return { x: gx + s * r, y: POST_LO + d };
  d -= POST_HI - POST_LO;
  const a = d / r;
  return { x: gx + s * r * Math.cos(a), y: POST_HI + r * Math.sin(a) };
}

// Inverse of dPoint: the t of the D-line point nearest to (x, y).
export function dParam(gx, r, x, y) {
  const s = gx === 0 ? 1 : -1;
  const arc = (Math.PI * r) / 2;
  const L = 2 * arc + (POST_HI - POST_LO);
  const fx = Math.max(0, s * (x - gx));
  let d;
  if (y < POST_LO) d = (Math.atan2(y - POST_LO, fx) + Math.PI / 2) * r;
  else if (y > POST_HI) d = arc + (POST_HI - POST_LO) + Math.atan2(y - POST_HI, fx) * r;
  else d = arc + (y - POST_LO);
  return clamp(d / L, 0, 1);
}

export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1e-9;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return { d: Math.hypot(px - (ax + dx * t), py - (ay + dy * t)), t };
}
