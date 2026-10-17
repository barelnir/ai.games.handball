// Cartoon "hero" art style: chunky ink outlines, small bodies, big heads (about half the figure),
// each player a hero with their own hair, mask/cape/goggles and chest emblem.
// Built from the renderer primitives (ellipse, rect, ring, line, tri), so it runs on WebGL and Canvas 2D.

import { W, H, CX, CY, POST_LO, POST_HI, GOAL_H, AREA_R, FREE_R, PEN_D, GK_LINE, Z2Y, dPoint } from './court.js';

const cache = new Map();
export function col(hex, a = 1) {
  const k = hex + a;
  let c = cache.get(k);
  if (!c) {
    let h = hex.slice(1);
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h, 16);
    c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
    cache.set(k, c);
  }
  return c;
}

export const TP = {
  ink: col('#1a1430'),
  shadow: col('#0b0820', 0.3),
  white: col('#ffffff'),
  eyeWhite: col('#fdfcf7'),
  highlight: col('#ffffff', 0.95),
  mouth: col('#5a1f2e'),
  tongue: col('#ff7a8a'),
  blush: col('#ff6b6b', 0.25),
  clear: col('#101833'),
  stands: col('#18224a'),
  boardDark: col('#0f1638'),
  runoff: col('#283f97'),
  court: col('#3f8ee6'),
  courtAlt: col('#3a86dc'),
  area: col('#f08a3c'),
  areaAlt: col('#ea8236'),
  line: col('#ffffff'),
  lineSoft: col('#ffffff', 0.6),
  logo: col('#ffffff', 0.12),
  postRed: col('#ff4b3e'),
  postWhite: col('#ffffff'),
  net: col('#ffffff', 0.45),
  ball: col('#fff3c4'),
  ballSeam: col('#ff4b3e'),
  ref: col('#c6f432'),
  refDark: col('#1d1d28'),
};

// ------------------------------------------------------------------ squads
export const SQUADS = [
  {
    key: 'hornets', name: 'Hornets', he: 'הצרעות', to: 'לצרעות', short: 'צרעות',
    kit: { shirt: '#ffd23f', trim: '#1b2a4a', shorts: '#1b2a4a', cape: '#1b2a4a', shoe: '#ffffff', gk: '#3ccf74', gkTrim: '#0e3b22', mask: '#1b2a4a', glow: '#ffd23f' },
    heroes: [
      { role: 'GK', pos: 'Goalkeeper', name: 'Hive', nameHe: 'כוורת', build: 'big', skin: '#e0ac85', hair: '#3d2618', style: 'helmet', acc: ['gloves'], emblem: 'hex', power: 'Honey Wall: the goal looks smaller for 5 s' },
      { role: 'LW', pos: 'Left wing', name: 'Zip', nameHe: 'זיפ', build: 'small', skin: '#f1c7a5', hair: '#f0cf6a', style: 'spiky', acc: ['headband'], emblem: 'bolt', power: 'Lightning Dash: burst of speed' },
      { role: 'LB', pos: 'Left back', name: 'Stinger', nameHe: 'עוקץ', build: 'normal', skin: '#7a4b2f', hair: '#20150f', style: 'buzz', acc: ['antennae', 'cape'], emblem: 'stinger', power: 'Stinger Shot: curving shot' },
      { role: 'CB', pos: 'Centre back', name: 'Zamzam', nameHe: 'זמזם', build: 'normal', skin: '#e8b48c', hair: '#d9a53a', style: 'quiff', acc: ['antennae'], emblem: 'hex', power: 'Buzz Line: a straight, fast shot' },
      { role: 'RB', pos: 'Right back', name: 'Buzz', nameHe: 'באז', build: 'normal', skin: '#f1c7a5', hair: '#c2412a', style: 'pigtails', acc: ['goggles'], emblem: 'star', power: 'Buzz Bomb: rocket shot' },
      { role: 'RW', pos: 'Right wing', name: 'Dash', nameHe: 'דאש', build: 'small', skin: '#a36a45', hair: '#141414', style: 'pony', acc: ['headband'], emblem: 'bolt', power: 'Wall Run: sprint along the sideline' },
      { role: 'PV', pos: 'Pivot', name: 'Honey Tank', nameHe: 'טנק הדבש', build: 'big', skin: '#e0ac85', hair: '#6b4425', style: 'buzz', acc: ['beard'], emblem: 'hex', power: 'Unmovable: can\'t be pushed off the line' },
    ],
  },
  {
    key: 'vipers', name: 'Vipers', he: 'הצפעונים', to: 'לצפעונים', short: 'צפעונים',
    kit: { shirt: '#e8453c', trim: '#fff4ec', shorts: '#3a1838', cape: '#3a1838', shoe: '#3a1838', gk: '#8b5cf6', gkTrim: '#24124f', mask: '#231a2e', glow: '#7cf26b' },
    heroes: [
      { role: 'GK', pos: 'Goalkeeper', name: 'Coil', nameHe: 'סליל', build: 'big', skin: '#c68b62', hair: '#24124f', style: 'hood', acc: ['gloves', 'fangs'], emblem: 'coil', power: 'Coil Reach: arms stretch to the posts' },
      { role: 'LW', pos: 'Left wing', name: 'Hiss', nameHe: 'היס', build: 'small', skin: '#f1c7a5', hair: '#7cf26b', style: 'mohawk', acc: ['mask'], emblem: 'fang', power: 'Smoke Step: vanish for a second' },
      { role: 'LB', pos: 'Left back', name: 'Fang', nameHe: 'ניב', build: 'normal', skin: '#5b3622', hair: '#20150f', style: 'spiky', acc: ['cape', 'fangs'], emblem: 'fang', power: 'Venom Shot: keeper moves slowly' },
      { role: 'CB', pos: 'Centre back', name: 'Venom', nameHe: 'ארס', build: 'normal', skin: '#e0ac85', hair: '#3a1838', style: 'hood', acc: ['cape', 'captain', 'glow'], emblem: 'drop', power: 'Hypno Fake: defenders freeze' },
      { role: 'RB', pos: 'Right back', name: 'Rattle', nameHe: 'רעשן', build: 'normal', skin: '#a36a45', hair: '#b07a3b', style: 'bun', acc: ['mask'], emblem: 'diamond', power: 'Rattle Roar: stuns nearby players' },
      { role: 'RW', pos: 'Right wing', name: 'Slink', nameHe: 'זחל', build: 'small', skin: '#f1c7a5', hair: '#141414', style: 'pony', acc: ['goggles'], emblem: 'fang', power: 'Slither: slips through a block' },
      { role: 'PV', pos: 'Pivot', name: 'Python', nameHe: 'פייתון', build: 'big', skin: '#7a4b2f', hair: '#141414', style: 'bald', acc: ['headband'], emblem: 'coil', power: 'Squeeze: wins every loose ball' },
    ],
  },
];

// ------------------------------------------------------------------ outlined primitives
let O = 0.03; // ink outline width in metres, set per frame from the zoom
const E = (R, x, y, rx, ry, c) => { R.ellipse(x, y, rx + O, ry + O, TP.ink); R.ellipse(x, y, rx, ry, c); };
const B = (R, x, y, hw, hh, c, rad = 0, rot = 0) => { R.rect(x, y, hw + O, hh + O, TP.ink, rot, rad + O); R.rect(x, y, hw, hh, c, rot, rad); };
const L = (R, x1, y1, x2, y2, hw, c) => { R.line(x1, y1, x2, y2, hw + O, TP.ink); R.line(x1, y1, x2, y2, hw, c); };
const T = (R, ax, ay, bx, by, cx, cy, c, r = 0) => { R.tri(ax, ay, bx, by, cx, cy, TP.ink, r + O); R.tri(ax, ay, bx, by, cx, cy, c, r); };
export const ink = { E: (...a) => E(...a), B: (...a) => B(...a), L: (...a) => L(...a), T: (...a) => T(...a), get O() { return O; } };
export function setInk(R) { O = Math.max(0.016, 1.35 / R.cam.ppm); }

// ------------------------------------------------------------------ hero figure
// p: { x, y, z, face, phase, vx, vy, gk, action, actT, stance, diveDir, charging }
// o: { t, hasBall, dribbling, alert, pose }
export function drawHero(R, h, kit, p, o = {}) {
  setInk(R);
  const t = o.t || 0;
  const big = h.build === 'big', small = h.build === 'small';
  const sc = small ? 0.93 : big ? 1.05 : 1;
  const bw = big ? 0.2 : small ? 0.135 : 0.155;
  const sp = Math.hypot(p.vx || 0, p.vy || 0), run = Math.min(1, sp / 3);
  const ph = p.phase || 0, sw = Math.sin(ph) * run;
  const bob = run > 0.05 ? Math.abs(Math.cos(ph)) * 0.04 * run : (Math.sin(t * 2.4 + p.x * 3.1 + p.y) * 0.5 + 0.5) * 0.014;
  const X = p.x, Y = p.y - (p.z || 0) * Z2Y - bob;
  const cf = Math.cos(p.face), sf = Math.sin(p.face);
  const dirX = cf >= 0 ? 1 : -1;
  const back = sf < -0.55, front = sf > 0.55, side = !back && !front;
  const gk = !!p.gk;
  const shirt = col(gk ? kit.gk : kit.shirt), trim = col(gk ? kit.gkTrim : kit.trim);
  const shorts = col(kit.shorts), skin = col(h.skin), hair = col(h.hair), cape = col(kit.cape), shoe = col(kit.shoe);
  const air = (p.z || 0) > 0.02;

  // shadow
  const shs = 1 / (1 + (p.z || 0) * 1.1);
  R.ellipse(p.x, p.y + 0.02, 0.27 * shs * sc, 0.1 * shs, TP.shadow);

  const hipY = Y - 0.2 * sc, bodyY = Y - 0.33 * sc, shY = Y - 0.42 * sc;
  const HR = 0.27 * (big ? 1.04 : 1), headY = Y - 0.47 * sc - HR * 0.98;
  const hands = poseHands(p, o, X, Y, sc, bw, dirX, sw, side);
  const has = (a) => h.acc.includes(a);

  // cape behind the body (front and side views)
  const flutter = Math.sin(t * 7 + p.x) * 0.03 + run * 0.12;
  if (has('cape') && !back) {
    if (side) T(R, X + dirX * 0.04, shY - 0.03, X - dirX * 0.06, Y - 0.06, X - dirX * (0.22 + flutter * 1.2), Y - 0.16 - run * 0.1, cape, 0.03);
    else {
      const wb = bw + 0.13 + flutter * 0.5, by = Y - 0.07;
      const quad = (c, r) => {
        R.tri(X - bw, shY - 0.02, X + bw, shY - 0.02, X - wb, by, c, r);
        R.tri(X + bw, shY - 0.02, X + wb, by, X - wb, by, c, r);
      };
      quad(TP.ink, 0.03 + O); quad(cape, 0.03);
    }
  }

  // far arm (side view)
  const arm = (k) => {
    const sx = X + k * (side ? 0.03 : bw - 0.01), hd = hands[k > 0 ? 1 : 0];
    L(R, sx, shY, hd[0], hd[1], 0.04 * sc, shirt);
    const gl = has('gloves');
    E(R, hd[0], hd[1], (gl ? 0.08 : 0.05) * sc, (gl ? 0.075 : 0.05) * sc, gl ? trim : skin);
    if (has('captain') && k === (side ? dirX : -1) && !back) {
      const mx = (sx + hd[0]) / 2, my = (shY + hd[1]) / 2;
      R.ellipse(mx, my, 0.035, 0.035, col(kit.glow || '#ffffff'));
    }
  };
  if (side) arm(-dirX);

  // legs and shoes
  for (const k of [-1, 1]) {
    const hx = X + k * 0.065 * (big ? 1.25 : 1);
    let fx = hx, fy = Y;
    if (air) { fx = hx + k * 0.04 - dirX * 0.03; fy = Y - 0.05 + (k > 0 ? -0.05 : 0); }
    else if (side) fx += k * sw * 0.15 * dirX;
    else fy -= Math.max(0, k * sw) * 0.06;
    L(R, hx, hipY, fx, fy - 0.05, 0.045 * sc, shorts);
    E(R, fx + (side ? dirX * 0.035 : 0), fy - 0.03, 0.075 * sc, 0.045 * sc, shoe);
  }

  // body
  B(R, X, bodyY, side ? bw * 0.85 : bw, 0.15 * sc, shirt, 0.09);
  R.rect(X, hipY + 0.01, (side ? bw * 0.85 : bw) - 0.005, 0.022, trim); // belt
  if (!back && kit.badge) drawFlag(R, kit.badge, side ? X + dirX * 0.03 : X, bodyY - 0.02, 0.075);
  else if (!back && kit.crest) drawCrest(R, kit.crest, side ? X + dirX * 0.03 : X, bodyY - 0.02, 0.07);
  else if (!back) drawEmblem(R, h.emblem, side ? X + dirX * 0.03 : X, bodyY - 0.02, trim, kit);
  if (back) {
    if (has('cape')) {
      const wb = bw + 0.1 + flutter * 0.5, by = Y - 0.1;
      const quad = (c, r) => {
        R.tri(X - bw, shY - 0.03, X + bw, shY - 0.03, X - wb, by, c, r);
        R.tri(X + bw, shY - 0.03, X + wb, by, X - wb, by, c, r);
      };
      quad(TP.ink, 0.03 + O); quad(cape, 0.03);
    }
    else R.rect(X, bodyY - 0.02, 0.05, 0.06, trim, 0, 0.015); // number patch
  }
  const raised = o.pose === 'windup' || o.pose === 'cheer' || p.charging || (p.action === 'shoot' && p.actT < 0.35);
  if (!raised) { if (!side) { arm(-1); arm(1); } else arm(dirX); }
  else if (side) arm(dirX);
  const lateArms = raised && !side;

  // ----- head
  const style = h.style;
  if (style === 'hood') E(R, X - (side ? dirX * 0.02 : 0), headY - 0.01, HR + 0.05, HR + 0.04, hair);
  if (style === 'pony' && !back) {
    const px = side ? X - dirX * (HR + 0.08) : X + HR * 0.75;
    L(R, X, headY - HR * 0.6, px, headY + 0.12 + Math.sin(t * 6 + p.x) * 0.02, 0.05, hair);
  }
  if (style === 'pigtails' && !back) {
    E(R, X - HR - 0.05, headY + 0.03, 0.08, 0.09, hair);
    E(R, X + HR + 0.05, headY + 0.03, 0.08, 0.09, hair);
  }
  if (has('headband') && side) { // band tails behind the head
    L(R, X - dirX * HR * 0.8, headY - 0.1, X - dirX * (HR + 0.16), headY - 0.02 + Math.sin(t * 9 + p.y) * 0.03, 0.02, trim);
  }
  E(R, X, headY, HR, HR * 0.94, skin);

  if (back) {
    drawHairBack(R, h, X, headY, HR, hair, skin, t);
    if (has('headband')) R.rect(X, headY - 0.08, HR - 0.01, 0.03, trim);
    if (has('antennae')) antennae(R, X, headY, HR, trim, t, 0);
    if (style === 'hood' || style === 'helmet') E(R, X, headY, HR - 0.01, HR * 0.93, hair);
    if (lateArms) { arm(-1); arm(1); }
    return;
  }

  // face
  const fx = side ? X + dirX * 0.09 : X;
  const ey = headY + 0.03;
  const eyes = side ? [[fx + dirX * 0.04, 0.95], [fx - dirX * 0.1, 0.8]] : [[fx - 0.1, 1], [fx + 0.1, 1]];
  const masked = has('mask');
  if (masked) B(R, fx - (side ? dirX * 0.03 : 0), ey, side ? 0.17 : 0.22, 0.065, col(kit.mask), 0.06);
  for (const [ex, s] of eyes) {
    E(R, ex, ey, 0.066 * s, 0.086 * s, TP.eyeWhite);
    if (!masked) {
      const look = side ? dirX * 0.02 : 0.0;
      R.ellipse(ex + look, ey + 0.012, 0.04 * s, 0.052 * s, has('glow') ? col(kit.glow) : TP.ink);
      R.ellipse(ex + look - 0.014, ey - 0.014, 0.016 * s, 0.016 * s, TP.highlight);
    }
    // brave eyebrows
    const inner = side ? ex + dirX * 0.05 : ex + (ex < fx ? 0.05 : -0.05);
    const outer = side ? ex - dirX * 0.05 : ex + (ex < fx ? -0.06 : 0.06);
    R.line(outer, ey - 0.12 * s, inner, ey - 0.1 * s, 0.015, TP.ink);
  }
  R.ellipse(fx + (side ? dirX * 0.06 : 0) - 0.13 * (side ? 0 : 1), ey + 0.08, 0.035, 0.022, TP.blush);
  if (!side) R.ellipse(fx + 0.13, ey + 0.08, 0.035, 0.022, TP.blush);
  if (h.freckles) { const fc = col(h.freckles); for (const k of side ? [0] : [-1, 1]) for (const [dx, dy] of [[0, 0], [0.03, 0.02], [-0.02, 0.025]]) R.ellipse(fx + (side ? dirX * 0.06 : k * 0.12) + dx, ey + 0.055 + dy, 0.009, 0.008, fc); }
  // mouth: open grin when shooting/celebrating, small smile otherwise
  const mx = side ? fx + dirX * 0.07 : fx, my = headY + 0.15;
  const shout = p.action === 'shoot' || p.charging || o.pose === 'cheer';
  if (shout) { E(R, mx, my, 0.045, 0.035, TP.mouth); R.ellipse(mx, my + 0.015, 0.025, 0.012, TP.tongue); }
  else {
    R.ellipse(mx, my - 0.005, 0.05, 0.03, TP.ink);
    R.ellipse(mx, my - 0.019, 0.056, 0.03, skin);
  }
  if (has('fangs')) {
    R.tri(mx - 0.03, my - 0.004, mx - 0.012, my - 0.004, mx - 0.021, my + 0.035, TP.white);
    R.tri(mx + 0.012, my - 0.004, mx + 0.03, my - 0.004, mx + 0.021, my + 0.035, TP.white);
  }
  if (has('beard')) {
    E(R, mx, headY + 0.17, 0.15, 0.08, hair);
    R.line(mx - 0.035, my - 0.01, mx + 0.035, my - 0.01, 0.012, TP.ink);
  }

  drawHairFront(R, h, X, headY, HR, hair, skin, dirX, side, t, kit);
  if (has('headband')) B(R, X + (side ? dirX * 0.01 : 0), headY - 0.12, HR * 0.96, 0.028, trim, 0.02);
  if (has('glasses')) {
    const fr = col('#2a1712');
    for (const [ex, s] of eyes) R.ring(ex, ey + 0.005, 0.088 * s, 0.075 * s, 0.017, fr);
    if (side) R.line(eyes[0][0] - dirX * 0.09, ey - 0.01, X - dirX * HR * 0.85, ey - 0.03, 0.014, fr);
    else R.line(eyes[0][0] + 0.088, ey - 0.005, eyes[1][0] - 0.088, ey - 0.005, 0.016, fr);
  }
  if (has('goggles')) {
    const gy = headY - 0.14;
    R.line(X - HR, gy, X + HR, gy, 0.022, TP.ink);
    for (const gx of side ? [X + dirX * 0.12] : [X - 0.09, X + 0.09]) {
      E(R, gx, gy, 0.06, 0.05, col('#8fe3ff'));
      R.ellipse(gx - 0.015, gy - 0.015, 0.016, 0.012, TP.highlight);
    }
  }
  if (has('antennae')) antennae(R, X, headY, HR, trim, t, side ? dirX : 0);
  if (lateArms) { arm(-1); arm(1); }
}

function antennae(R, X, headY, HR, trim, t, dirX) {
  for (const k of dirX ? [dirX * 0.3, -dirX * 0.4] : [-1, 1]) {
    const bx = X + k * 0.08, by = headY - HR * 0.95;
    const tx = X + k * 0.2 + Math.sin(t * 5 + k) * 0.02, ty = headY - HR - 0.2;
    L(R, bx, by, tx, ty, 0.012, trim);
    E(R, tx, ty, 0.04, 0.04, col('#ffd23f'));
  }
}

function drawHairFront(R, h, X, headY, HR, hair, skin, dirX, side, t, kit) {
  const s = h.style, top = headY - HR;
  const cap = (yOff = 0, extra = 0) => {
    E(R, X - (side ? dirX * 0.03 : 0), headY - HR * 0.55 + yOff, HR + 0.012 + extra, HR * 0.55, hair);
  };
  switch (s) {
    case 'spiky': {
      cap(0);
      for (let i = -2; i <= 2; i++) {
        const a = -Math.PI / 2 + i * 0.42 - (side ? dirX * 0.25 : 0);
        const bx = X + Math.cos(a) * HR * 0.75, by = headY + Math.sin(a) * HR * 0.75;
        const tx = X + Math.cos(a) * (HR + 0.16), ty = headY + Math.sin(a) * (HR + 0.16);
        const nx = -Math.sin(a) * 0.08, ny = Math.cos(a) * 0.08;
        T(R, bx - nx, by - ny, bx + nx, by + ny, tx - (side ? dirX * 0.06 : 0), ty, hair, 0.01);
      }
      R.ellipse(X - (side ? dirX * 0.03 : 0), headY - HR * 0.55, HR, HR * 0.5, hair);
      break;
    }
    case 'quiff': {
      const d = side ? dirX : 1;
      T(R, X - d * 0.16, top + 0.1, X + d * 0.14, top + 0.06, X + d * 0.22, top - 0.08, hair, 0.04);
      cap(0);
      R.tri(X - d * 0.16, top + 0.1, X + d * 0.14, top + 0.06, X + d * 0.22, top - 0.08, hair, 0.04);
      R.ellipse(X + d * 0.06, top + 0.02, 0.05, 0.022, col('#ffffff', 0.25));
      break;
    }
    case 'mohawk':
      for (let i = 0; i < 5; i++) {
        const x = X - 0.16 + i * 0.08 - (side ? dirX * 0.04 : 0);
        T(R, x - 0.05, top + 0.06, x + 0.05, top + 0.06, x + (side ? -dirX * 0.05 : 0), top - 0.16 - (i === 2 ? 0.04 : 0), hair, 0.01);
      }
      break;
    case 'bun':
      cap(0);
      E(R, X - (side ? dirX * 0.1 : 0), top - 0.06, 0.1, 0.09, hair);
      break;
    case 'pony':
    case 'pigtails':
      cap(0);
      break;
    case 'buzz':
      E(R, X, headY - HR * 0.6, HR - 0.01, HR * 0.42, hair);
      break;
    case 'long': {
      for (const k of [-1, 1]) E(R, X + k * (HR + 0.01) - (side ? dirX * 0.05 : 0), headY + 0.1, 0.075, 0.2, hair);
      cap(0);
      break;
    }
    case 'fringe': {
      cap(0);
      for (let i = 0; i < 4; i++) {
        const bx = X - 0.15 + i * 0.1 + (side ? dirX * 0.03 : 0);
        R.tri(bx - 0.07, top + 0.04, bx + 0.07, top + 0.04, bx + 0.01, top + 0.16, hair);
      }
      break;
    }
    case 'side': {
      // a long fringe swept across the forehead to one side
      const d = side ? dirX : 1;
      cap(0);
      T(R, X - d * HR * 0.98, top + 0.13, X + d * 0.02, top - 0.015, X + d * HR * 0.92, top + 0.22, hair, 0.02);
      R.tri(X - d * HR * 0.9, top + 0.12, X + d * 0.02, top + 0.005, X + d * HR * 0.84, top + 0.2, hair, 0.015);
      R.ellipse(X - d * 0.03, top + 0.07, HR * 0.85, 0.06, hair);
      break;
    }
    case 'swoop': {
      // short sides, big tufty top swept up and to one side
      const d = side ? dirX : 1;
      cap(0);
      for (let i = 0; i < 4; i++) {
        const bx = X - 0.15 + i * 0.1;
        T(R, bx - 0.07, top + 0.08, bx + 0.07, top + 0.06, bx + d * 0.08, top - 0.1 - (i === 1 || i === 2 ? 0.04 : 0), hair, 0.02);
      }
      R.ellipse(X, headY - HR * 0.6, HR * 0.95, HR * 0.42, hair);
      R.line(X - 0.1, top + 0.04, X + 0.05 * d, top - 0.03, 0.012, col('#a07a50'));
      break;
    }
    case 'bald':
      R.ellipse(X - 0.08, top + 0.08, 0.06, 0.035, col('#ffffff', 0.35));
      break;
    case 'helmet': {
      E(R, X, headY - HR * 0.62, HR + 0.03, HR * 0.6, col(kit.gkTrim));
      R.rect(X, headY - HR * 0.36, HR + 0.01, 0.028, col(kit.gk), 0, 0.02);
      R.line(X, top - 0.08, X, top + 0.1, 0.03, col(kit.gk));
      R.ellipse(X - 0.09, top + 0.06, 0.06, 0.03, col('#ffffff', 0.3));
      break;
    }
    case 'hood':
      // hood frames the face: top band over the forehead
      R.ellipse(X, headY - HR * 0.72, HR * 0.95, HR * 0.38, hair);
      R.tri(X - 0.05, top + 0.02, X + 0.05, top + 0.02, X, top + 0.12, hair);
      break;
  }
}

function drawHairBack(R, h, X, headY, HR, hair, skin, t) {
  const s = h.style;
  if (s === 'bald') return;
  if (s === 'buzz') { E(R, X, headY - 0.02, HR - 0.01, HR * 0.85, hair); return; }
  E(R, X, headY - 0.01, HR + 0.01, HR * 0.95, hair);
  if (s === 'spiky' || s === 'mohawk') {
    for (let i = -2; i <= 2; i++) {
      const a = -Math.PI / 2 + i * 0.42;
      const tx = X + Math.cos(a) * (HR + 0.15), ty = headY + Math.sin(a) * (HR + 0.15);
      const bx = X + Math.cos(a) * HR * 0.7, by = headY + Math.sin(a) * HR * 0.7;
      const nx = -Math.sin(a) * 0.08, ny = Math.cos(a) * 0.08;
      T(R, bx - nx, by - ny, bx + nx, by + ny, tx, ty, hair, 0.01);
    }
  }
  if (s === 'bun') E(R, X, headY - HR - 0.04, 0.1, 0.09, hair);
  if (s === 'pony') L(R, X, headY, X + Math.sin(t * 6) * 0.03, headY + HR + 0.12, 0.05, hair);
  if (s === 'long') E(R, X, headY + 0.14, HR + 0.03, HR * 0.95, hair);
  if (s === 'pigtails') { E(R, X - HR - 0.04, headY + 0.04, 0.08, 0.09, hair); E(R, X + HR + 0.04, headY + 0.04, 0.08, 0.09, hair); }
}

// National flags (for national teams' shirts and cards). w = half width; the flag is w x 0.7w.
const FLAG = Object.fromEntries(Object.entries({
  white: '#ffffff', blue: '#0038b8', red: '#d52b1e', yellow: '#ffc400', black: '#1e1e1e', gold: '#ffce00',
  green: '#009c3b', navy: '#00205b', sky: '#02529c', bred: '#ce1126', dk: '#c8102e', sb: '#006aa7', sy: '#fecc00',
}).map(([k, v]) => [k, col(v)]));
export function drawFlag(R, kind, x, y, w) {
  const h = w * 0.7, F = FLAG;
  const bandsH = (cs) => cs.forEach((c, i) => R.rect(x, y - h + (h * 2 * (i + 0.5)) / cs.length, w, h / cs.length, c));
  const bandsV = (cs) => cs.forEach((c, i) => R.rect(x - w + (w * 2 * (i + 0.5)) / cs.length, y, w / cs.length, h, c));
  const cross = (c, t, cx = -0.25) => { R.rect(x, y, w, t * h, c); R.rect(x + cx * w, y, t * h, h, c); };
  R.rect(x, y, w + 0.012, h + 0.012, TP.ink, 0, 0.01);
  switch (kind) {
    case 'israel': {
      R.rect(x, y, w, h, F.white);
      for (const s of [-1, 1]) R.rect(x, y + s * h * 0.68, w, h * 0.12, F.blue);
      const r = h * 0.42, lw = Math.max(0.004, w * 0.045);
      for (const a0 of [-Math.PI / 2, Math.PI / 2]) { // two triangles: the Star of David
        const p = [0, 1, 2].map((i) => [x + Math.cos(a0 + (i * 2 * Math.PI) / 3) * r, y + Math.sin(a0 + (i * 2 * Math.PI) / 3) * r]);
        for (let i = 0; i < 3; i++) R.line(p[i][0], p[i][1], p[(i + 1) % 3][0], p[(i + 1) % 3][1], lw, F.blue);
      }
      break;
    }
    case 'spain': R.rect(x, y, w, h, F.red); R.rect(x, y, w, h * 0.5, F.yellow); break;
    case 'france': bandsV([F.blue, F.white, F.red]); break;
    case 'germany': bandsH([F.black, F.red, F.gold]); break;
    case 'denmark': R.rect(x, y, w, h, F.dk); cross(F.white, 0.22); break;
    case 'sweden': R.rect(x, y, w, h, F.sb); cross(F.sy, 0.22); break;
    case 'norway': R.rect(x, y, w, h, F.dk); cross(F.white, 0.3); cross(F.navy, 0.14); break;
    case 'iceland': R.rect(x, y, w, h, F.sky); cross(F.white, 0.3); cross(F.dk, 0.14); break;
    case 'croatia': {
      bandsH([F.red, F.white, F.blue]);
      const q = h * 0.16; // the red-and-white chequered shield
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R.rect(x + (i - 1) * q * 2, y + (j - 1) * q * 2 + h * 0.05, q, q, (i + j) % 2 ? F.white : F.red);
      break;
    }
    case 'brazil': {
      R.rect(x, y, w, h, F.green);
      R.tri(x - w * 0.8, y, x, y - h * 0.8, x + w * 0.8, y, F.yellow); R.tri(x - w * 0.8, y, x, y + h * 0.8, x + w * 0.8, y, F.yellow);
      R.ellipse(x, y, h * 0.38, h * 0.38, F.navy);
      break;
    }
    case 'egypt': bandsH([F.bred, F.white, F.black]); R.ellipse(x, y, h * 0.16, h * 0.16, F.gold); break;
    default: R.rect(x, y, w, h, F.white);
  }
}

// A club emblem: a shield in the club colours (initials only where the renderer can write text).
export function drawCrest(R, c, x, y, w) {
  const A = col(c.a), Bc = col(c.b), h = w * 1.3, top = y - h * 0.62, mid = y + h * 0.3, tip = y + h * 0.72;
  const by = (top + mid) / 2, bh = (mid - top) / 2;
  const shield = (pad, colr) => {
    R.rect(x, by - pad * 0.2, w + pad, bh + pad * 0.8, colr, 0, w * 0.22);
    R.tri(x - w - pad, mid - bh * 0.3, x + w + pad, mid - bh * 0.3, x, tip + pad * 1.3, colr, w * 0.08 + pad * 0.4);
  };
  shield(w * 0.16, TP.ink);
  shield(w * 0.08, Bc);
  shield(0, A);
  if (c.p === 'stripes') for (const k of [-0.5, 0, 0.5]) R.rect(x + k * w, by + h * 0.12, w * 0.11, bh + h * 0.04, Bc);
  else if (c.p === 'band') R.rect(x, by + bh * 0.55, w * 0.98, h * 0.1, Bc);
  else if (c.p === 'star') {
    const r = w * 0.4, cy = mid + h * 0.06;
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
      R.tri(x, cy, x + Math.cos(a - 0.6) * r * 0.42, cy + Math.sin(a - 0.6) * r * 0.42, x + Math.cos(a) * r, cy + Math.sin(a) * r, Bc);
      R.tri(x, cy, x + Math.cos(a + 0.6) * r * 0.42, cy + Math.sin(a + 0.6) * r * 0.42, x + Math.cos(a) * r, cy + Math.sin(a) * r, Bc);
    }
  }
  if (R.g && c.txt && w > 0.12) { // the club's initials (cards only)
    const g = R.g, cv = R.canvas, ppm = R.cam.ppm;
    const sx = cv.width / 2 + (x - R.cam.x) * ppm, sy = cv.height / 2 + (by - h * 0.04 - R.cam.y) * ppm;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.font = `900 ${Math.round(w * 0.78 * ppm)}px Rubik, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
    g.lineJoin = 'round'; g.lineWidth = Math.max(2, w * 0.2 * ppm); g.strokeStyle = '#141a2e'; g.strokeText(c.txt, sx, sy);
    g.fillStyle = '#ffffff'; g.fillText(c.txt, sx, sy);
    g.restore();
  }
}

function drawEmblem(R, kind, x, y, c, kit) {
  const s = 0.06;
  switch (kind) {
    case 'bolt':
      R.tri(x + 0.02, y - s * 1.2, x - 0.05, y + 0.01, x + 0.005, y + 0.01, c);
      R.tri(x - 0.02, y + s * 1.2, x + 0.05, y - 0.01, x - 0.005, y - 0.01, c);
      break;
    case 'hex':
      R.ellipse(x, y, s, s * 0.9, c);
      R.ellipse(x, y, s * 0.45, s * 0.4, col(kit.shirt));
      break;
    case 'stinger':
      R.tri(x - s, y - s * 0.6, x + s, y - s * 0.6, x, y + s * 1.1, c);
      break;
    case 'star':
      R.tri(x, y - s * 1.1, x - s * 0.9, y + s * 0.7, x + s * 0.9, y + s * 0.7, c);
      R.tri(x, y + s * 1.0, x - s * 0.9, y - s * 0.5, x + s * 0.9, y - s * 0.5, c);
      break;
    case 'coil':
      R.ring(x, y, s * 0.8, s * 0.8, 0.014, c);
      R.ellipse(x, y, s * 0.3, s * 0.3, c);
      break;
    case 'fang':
      R.tri(x - s, y - s * 0.6, x - 0.008, y - s * 0.6, x - s * 0.5, y + s, c);
      R.tri(x + 0.008, y - s * 0.6, x + s, y - s * 0.6, x + s * 0.5, y + s, c);
      break;
    case 'drop':
      R.ellipse(x, y + 0.015, s * 0.7, s * 0.7, c);
      R.tri(x - s * 0.62, y, x + s * 0.62, y, x, y - s * 1.2, c);
      break;
    case 'diamond':
      R.rect(x, y, s * 0.65, s * 0.65, c, Math.PI / 4, 0.01);
      break;
  }
}

function poseHands(p, o, X, Y, sc, bw, dirX, sw, side) {
  const pose = o.pose;
  const sh = Y - 0.42 * sc;
  if (pose === 'cheer') return [[X - 0.3, Y - 0.86], [X + 0.3, Y - 0.86]];
  if (pose === 'windup' || p.charging || (p.action === 'shoot' && p.actT < 0.08)) return [[X + dirX * 0.24, sh + 0.04], [X - dirX * 0.42, Y - 0.85]].sort((a, b) => a[0] - b[0]);
  if (p.action === 'shoot' && p.actT < 0.35) return [[X - dirX * 0.18, sh + 0.12], [X + dirX * 0.34, Y - 0.62]].sort((a, b) => a[0] - b[0]);
  if (p.action === 'steal' && p.actT < 0.3) return [[X + dirX * 0.3, sh + 0.05], [X + dirX * 0.27, sh + 0.12]];
  if (pose === 'block' || p.stance > 0) return [[X - 0.32, Y - 0.78], [X + 0.32, Y - 0.78]];
  if (p.gk) {
    if (p.action === 'dive' || pose === 'dive') {
      const d = p.diveDir || 1;
      return [[X - 0.36, sh + d * 0.2 - 0.1], [X + 0.36, sh + d * 0.2 - 0.1]];
    }
    if (o.alert || pose === 'ready') return [[X - 0.36, Y - 0.62], [X + 0.36, Y - 0.62]];
  }
  if (o.hasBall && o.dribbling) return [[X - dirX * (bw + 0.08), sh + 0.15], [X + dirX * 0.25, Y - 0.22]].sort((a, b) => a[0] - b[0]);
  if (o.hasBall) return [[X - dirX * (bw + 0.07), sh + 0.15], [X + dirX * 0.27, sh + 0.02]].sort((a, b) => a[0] - b[0]);
  const s = side ? sw * 0.08 * dirX : 0;
  return [[X - bw - 0.07 - s, sh + 0.17 + (side ? 0 : sw * 0.02)], [X + bw + 0.07 + s, sh + 0.17 - (side ? 0 : sw * 0.02)]];
}

export function drawToonBall(R, x, y, z, t = 0) {
  setInk(R);
  const sy = y - z * Z2Y, sh = 1 / (1 + z * 0.8);
  R.ellipse(x, y + 0.02, 0.12 * sh, 0.05 * sh, TP.shadow);
  E(R, x, sy, 0.12, 0.12, TP.ball);
  const a = t * 9;
  R.line(x + Math.cos(a) * 0.1, sy + Math.sin(a) * 0.1, x - Math.cos(a) * 0.1, sy - Math.sin(a) * 0.1, 0.016, TP.ballSeam);
  R.ring(x + Math.cos(a + 1.6) * 0.05, sy + Math.sin(a + 1.6) * 0.05, 0.06, 0.06, 0.012, TP.ballSeam);
  R.ellipse(x - 0.04, sy - 0.045, 0.03, 0.022, TP.highlight);
}

// ------------------------------------------------------------------ referee
const REF = { name: 'Ref', build: 'normal', skin: '#e0ac85', hair: '#2a2a2a', style: 'buzz', acc: [], emblem: 'diamond' };
const REF_KIT = { shirt: '#c6f432', trim: '#1d1d28', shorts: '#1d1d28', cape: '#000', shoe: '#1d1d28', gk: '#c6f432', gkTrim: '#1d1d28', mask: '#000' };
export function drawToonRef(R, f, signal, t) {
  drawHero(R, REF, REF_KIT, { x: f.x, y: f.y, z: 0, vx: f.vx, vy: f.vy, face: f.face, phase: f.phase }, { t, pose: signal ? 'block' : null });
}

// ------------------------------------------------------------------ arena and court
const crowd = [];
(function buildCrowd() {
  const shirts = ['#ffd23f', '#e8453c', '#ffffff', '#1b2a4a', '#ff9f1c', '#8b5cf6', '#3ccf74', '#ff5c8a'];
  const skins = ['#f1c7a5', '#e0ac85', '#c68b62', '#a36a45', '#7a4b2f'];
  const add = (x, y) => crowd.push({ x, y, c: col(shirts[(Math.random() * shirts.length) | 0]), s: col(skins[(Math.random() * skins.length) | 0]), p: Math.random() * 6 });
  for (let row = 0; row < 5; row++) {
    for (let x = -7; x <= W + 7; x += 0.7) {
      add(x + (row % 2) * 0.35, -3.9 - row * 0.8);
      if (row < 3 && (x < CX - 9 || x > CX + 9)) add(x + (row % 2) * 0.35, H + 4.1 + row * 0.8);
    }
  }
  for (let row = 0; row < 4; row++) {
    for (let y = -2.5; y <= H + 2.5; y += 0.7) {
      add(-5.6 - row * 0.8, y + (row % 2) * 0.35);
      add(W + 5.6 + row * 0.8, y + (row % 2) * 0.35);
    }
  }
})();

function dLine(R, gx, r, hw, c, dashed) {
  const N = 72;
  let prev = dPoint(gx, r, 0);
  for (let i = 1; i <= N; i++) {
    const q = dPoint(gx, r, i / N);
    const inside = prev.y >= 0 && prev.y <= H && q.y >= 0 && q.y <= H;
    if (inside && (!dashed || i % 2 === 0)) R.line(prev.x, prev.y, q.x, q.y, hw, c);
    prev = q;
  }
}

function fillD(R, gx, r, c) {
  const s = gx === 0 ? 1 : -1;
  R.rect(gx + (s * r) / 2, CY, r / 2, (POST_HI - POST_LO) / 2, c);
  R.ellipse(gx, POST_LO, r, r, c);
  R.ellipse(gx, POST_HI, r, r, c);
}

export function drawToonArena(R, t, excite = 0) {
  setInk(R);
  R.rect(CX, CY, W / 2 + 14, H / 2 + 10, TP.stands);
  // crowd: little round fans
  for (const f of crowd) {
    const bob = excite > 0 ? Math.abs(Math.sin(t * 9 + f.p)) * 0.2 * excite : (Math.sin(t * 1.6 + f.p) * 0.5 + 0.5) * 0.04;
    R.ellipse(f.x, f.y + 0.14, 0.26, 0.2, f.c);
    R.ellipse(f.x, f.y - 0.18 - bob, 0.2, 0.2, f.s);
  }
  // advertising boards
  const boards = ['#ffd23f', '#e8453c', '#3ccf74', '#8b5cf6', '#ff9f1c', '#3f8ee6'];
  for (let i = 0; i < 14; i++) {
    const x = -2 + i * 3.3;
    const c = col(boards[i % boards.length]);
    R.rect(x, -2.85, 1.55, 0.32, TP.boardDark, 0, 0.08);
    R.rect(x, -2.85, 1.45, 0.24, c, 0, 0.06);
    R.ellipse(x - 0.9, -2.85, 0.13, 0.13, TP.white);
  }
  R.rect(CX, CY, W / 2 + 2.7, H / 2 + 2.5, TP.runoff);
  R.rect(CX, CY, W / 2, H / 2, TP.court);
  for (let i = 0; i < 10; i++) R.rect(2 + i * 4, CY, 1, H / 2, TP.courtAlt);
  // centre logo: a big ball
  R.ellipse(CX, CY, 2.6, 2.6, TP.logo);
  R.ring(CX, CY, 1.6, 1.6, 0.12, TP.logo);
  fillD(R, 0, AREA_R, TP.area);
  fillD(R, W, AREA_R, TP.area);
  R.rect(-1.35, CY, 1.35, H / 2 + 2.5, TP.runoff);
  R.rect(W + 1.35, CY, 1.35, H / 2 + 2.5, TP.runoff);
  R.rect(-8.7, CY, 6, H / 2 + 10, TP.stands);
  R.rect(W + 8.7, CY, 6, H / 2 + 10, TP.stands);
  for (const f of crowd) {
    if (f.x > -2.7 && f.x < W + 2.7) continue;
    const bob = excite > 0 ? Math.abs(Math.sin(t * 9 + f.p)) * 0.2 * excite : (Math.sin(t * 1.6 + f.p) * 0.5 + 0.5) * 0.04;
    R.ellipse(f.x, f.y + 0.14, 0.26, 0.2, f.c);
    R.ellipse(f.x, f.y - 0.18 - bob, 0.2, 0.2, f.s);
  }
  // benches
  for (const [x, c] of [[CX - 7, '#ffd23f'], [CX + 7, '#e8453c']]) {
    R.rect(x, H + 1.7, 3.3, 0.42, TP.ink, 0, 0.2);
    R.rect(x, H + 1.65, 3.2, 0.32, col(c), 0, 0.16);
  }

  const lw = 0.07, Ln = TP.line;
  R.line(0, 0, W, 0, lw, Ln); R.line(0, H, W, H, lw, Ln);
  R.line(0, 0, 0, H, lw, Ln); R.line(W, 0, W, H, lw, Ln);
  R.line(CX, 0, CX, H, lw, Ln);
  R.ring(CX, CY, 2, 2, lw * 0.8, TP.lineSoft);
  for (const x of [CX - 4.5, CX + 4.5]) R.line(x, H, x, H + 0.35, lw, Ln);
  for (const gx of [0, W]) {
    const s = gx === 0 ? 1 : -1;
    dLine(R, gx, AREA_R, lw, Ln, false);
    dLine(R, gx, FREE_R, lw, Ln, true);
    R.line(gx + s * PEN_D, CY - 0.5, gx + s * PEN_D, CY + 0.5, lw, Ln);
    R.line(gx + s * GK_LINE, CY - 0.1, gx + s * GK_LINE, CY + 0.1, lw, Ln);
  }
}

export function drawToonGoalBack(R, gx) {
  setInk(R);
  const s = gx === 0 ? 1 : -1, bx = gx - s * 1.0, top = (z) => z * Z2Y;
  R.rect(gx - s * 0.5, CY, 0.5, 1.5, col('#000000', 0.25));
  for (let i = 0; i <= 6; i++) {
    const y = POST_LO + i * 0.5;
    R.line(gx, y - top(GOAL_H), bx, y - top(1.4), 0.016, TP.net);
    R.line(bx, y - top(1.4), bx, y, 0.016, TP.net);
  }
  for (let k = 0; k <= 4; k++) { const z = 1.4 * (k / 4); R.line(bx, POST_LO - top(z), bx, POST_HI - top(z), 0.016, TP.net); }
  for (let k = 1; k <= 3; k++) {
    const f = k / 4, x = gx + (bx - gx) * f, z = GOAL_H + (1.4 - GOAL_H) * f;
    R.line(x, POST_LO - top(z), x, POST_HI - top(z), 0.016, TP.net);
  }
  toonPost(R, gx, POST_LO);
  const y0 = POST_LO - top(GOAL_H), y1 = POST_HI - top(GOAL_H);
  R.line(gx, y0, gx, y1, 0.08 + O, TP.ink);
  for (let i = 0; i < 10; i++) {
    const a = y0 + ((y1 - y0) * i) / 10, b = y0 + ((y1 - y0) * (i + 1)) / 10;
    R.line(gx, a, gx, b, 0.08, i % 2 ? TP.postWhite : TP.postRed);
  }
}

export function toonPost(R, gx, y) {
  setInk(R);
  const h = GOAL_H * Z2Y;
  R.line(gx, y, gx, y - h, 0.08 + O, TP.ink);
  for (let i = 0; i < 7; i++) R.line(gx, y - (h * i) / 7, gx, y - (h * (i + 1)) / 7, 0.08, i % 2 ? TP.postWhite : TP.postRed);
}

// ------------------------------------------------------------------ overlays
export function drawMarker(R, p, t, c = TP.white) {
  setInk(R);
  const pulse = 1 + Math.sin(t * 6) * 0.06;
  R.ring(p.x, p.y + 0.02, 0.4 * pulse, 0.16 * pulse, 0.035 + O, TP.ink);
  R.ring(p.x, p.y + 0.02, 0.4 * pulse, 0.16 * pulse, 0.035, c);
}

// Bouncing arrow above the controlled hero's head.
export function drawHeadTag(R, p, t, c) {
  setInk(R);
  const y = p.y - (p.z || 0) * Z2Y - 1.3 + Math.sin(t * 5) * 0.04;
  T(R, p.x - 0.12, y - 0.12, p.x + 0.12, y - 0.12, p.x, y + 0.03, c, 0.02);
}

// ------------------------------------------------------------------ power effects
const FIRE = ['#fff3b0', '#ffd23f', '#ff9f1c', '#ff5a1f', '#d62818'].map((h) => col(h));
const q = (a) => Math.max(0, Math.min(1, Math.round(a * 10) / 10));

// A ball on fire: flickering flames rise from it (screen-up), with a hot core.
export function drawFireBall(R, x, y, z, t) {
  setInk(R);
  const sy = y - z * Z2Y, sh = 1 / (1 + z * 0.8);
  R.ellipse(x, y + 0.02, 0.14 * sh, 0.06 * sh, TP.shadow);
  R.ellipse(x, sy, 0.3, 0.3, col('#ff9f1c', 0.25));
  for (let i = 0; i < 6; i++) {
    const a = t * 14 + i * 1.7, w = 0.07 + (i % 3) * 0.02;
    const ox = (i - 2.5) * 0.04 + Math.sin(a) * 0.03;
    const h = 0.22 + Math.sin(a * 1.3) * 0.07 + (i % 2) * 0.06;
    R.tri(x + ox - w, sy, x + ox + w, sy, x + ox + Math.sin(a * 0.7) * 0.05, sy - h - 0.06, FIRE[2 + (i % 3)]);
  }
  E(R, x, sy, 0.13, 0.13, FIRE[2]);
  R.ellipse(x, sy + 0.01, 0.09, 0.09, FIRE[1]);
  R.ellipse(x - 0.03, sy - 0.03, 0.04, 0.04, FIRE[0]);
}

// Trail of a flying fireball: oldest point first. Each point is {x, y, z}.
export function drawFireTrail(R, trail, t) {
  const n = trail.length;
  // a continuous ribbon: glow, then flame, then hot core, each tapering towards the tail
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < n; i++) {
      const a = trail[i - 1], b = trail[i], k = i / n;
      const ay = a.y - a.z * Z2Y, by = b.y - b.z * Z2Y;
      const w = [0.3, 0.19, 0.08][pass] * (0.25 + k * 0.75);
      const c = pass === 0 ? col('#d62818', q(k * 0.45)) : pass === 1 ? col('#ff9f1c', q(0.3 + k * 0.7)) : col('#fff3b0', q(k));
      R.line(a.x, ay, b.x, by, w, c);
    }
  }
  for (let i = 0; i < n; i += 3) { // sparks
    const p = trail[i], sy = p.y - p.z * Z2Y, a = t * 20 + i;
    R.ellipse(p.x + Math.sin(a) * 0.2, sy + Math.cos(a * 1.3) * 0.2, 0.025, 0.025, FIRE[0]);
  }
}

// Glow around a powered-up hero (or a frozen keeper), in the template's colour.
export function drawPowerAura(R, p, t, hex = '#7fe7ff') {
  setInk(R);
  const X = p.x, Y = p.y - (p.z || 0) * Z2Y;
  const pulse = 0.5 + 0.5 * Math.sin(t * 10);
  R.ellipse(X, Y - 0.55, 0.62 + pulse * 0.06, 0.78 + pulse * 0.06, col(hex, 0.2));
  R.ring(X, p.y + 0.02, 0.45, 0.18, 0.04, col(hex, 0.8));
  for (let i = 0; i < 3; i++) {
    if (Math.sin(t * 23 + i * 2.1) < 0.2) continue; // flicker
    const a = t * 3 + i * 2.09, cx = X + Math.cos(a) * 0.55, cy = Y - 0.55 + Math.sin(a) * 0.65;
    zigzag(R, cx, cy - 0.14, cx, cy + 0.14, 0.022, col(hex), t + i);
  }
}

// a jagged lightning line from (x1,y1) to (x2,y2)
function zigzag(R, x1, y1, x2, y2, w, c, seed) {
  const n = 4, dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  let px = x1, py = y1;
  for (let i = 1; i <= n; i++) {
    const k = i / n, j = i === n ? 0 : Math.sin(seed * 37.1 + i * 12.9) * len * 0.22;
    const qx = x1 + dx * k + nx * j, qy = y1 + dy * k + ny * j;
    R.line(px, py, qx, qy, w, c);
    px = qx; py = qy;
  }
}

const ELEC = { glow: col('#7fe7ff', 0.3), cyan: col('#7fe7ff'), white: col('#f4feff'), deep: col('#2a7bff') };

// A powered ball, drawn by kind: 'lightning' | 'fire' | 'power' | 'star'.
export function drawPowerBall(R, kind, x, y, z, t) {
  if (kind === 'fire') return drawFireBall(R, x, y, z, t);
  setInk(R);
  const sy = y - z * Z2Y, sh = 1 / (1 + z * 0.8);
  R.ellipse(x, y + 0.02, 0.14 * sh, 0.06 * sh, TP.shadow);
  if (kind === 'lightning') {
    R.ellipse(x, sy, 0.34, 0.34, ELEC.glow);
    // small bolts crackling around the ball
    const f = Math.floor(t * 18);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.257 + f * 0.7 + Math.sin(f + i) * 0.4;
      const r0 = 0.13, r1 = 0.3 + ((f + i) % 3) * 0.04;
      zigzag(R, x + Math.cos(a) * r0, sy + Math.sin(a) * r0, x + Math.cos(a) * r1, sy + Math.sin(a) * r1, 0.024, ELEC.cyan, f + i);
      zigzag(R, x + Math.cos(a) * r0, sy + Math.sin(a) * r0, x + Math.cos(a) * r1, sy + Math.sin(a) * r1, 0.01, ELEC.white, f + i);
    }
    E(R, x, sy, 0.12, 0.12, ELEC.white);
    R.ellipse(x, sy, 0.08, 0.08, ELEC.cyan);
    R.line(x - 0.03, sy - 0.06, x + 0.02, sy, 0.015, ELEC.deep);
    R.line(x + 0.02, sy, x - 0.02, sy + 0.06, 0.015, ELEC.deep);
  } else if (kind === 'ice') {
    R.ellipse(x, sy, 0.32, 0.32, col('#cff4ff', 0.3));
    // ice crystals orbiting the ball
    for (let i = 0; i < 6; i++) {
      const a = t * 2 + i * 1.047, r = 0.24;
      const cx = x + Math.cos(a) * r, cy = sy + Math.sin(a) * r * 0.85;
      R.tri(cx, cy - 0.07, cx - 0.04, cy, cx + 0.04, cy, col('#e8fbff'));
      R.tri(cx, cy + 0.07, cx - 0.04, cy, cx + 0.04, cy, col('#9fe3ff'));
    }
    E(R, x, sy, 0.13, 0.13, col('#bff0ff'));
    R.ellipse(x, sy, 0.09, 0.09, col('#e8fbff'));
    R.line(x - 0.08, sy, x + 0.08, sy, 0.012, col('#5fb6e8'));
    R.line(x, sy - 0.08, x, sy + 0.08, 0.012, col('#5fb6e8'));
    R.ellipse(x - 0.04, sy - 0.05, 0.035, 0.025, TP.highlight);
  } else if (kind === 'power') {
    for (let k = 0; k < 2; k++) {
      const f = (t * 2.2 + k * 0.5) % 1;
      R.ring(x, sy, 0.13 + f * 0.3, 0.13 + f * 0.3, 0.025, col('#ffd23f', q(1 - f)));
    }
    E(R, x, sy, 0.13, 0.13, col('#ffd23f'));
    R.ellipse(x, sy, 0.08, 0.08, col('#fff3b0'));
    R.ellipse(x - 0.04, sy - 0.04, 0.035, 0.03, TP.highlight);
  } else {
    // star: a white-red ball with stars circling it
    E(R, x, sy, 0.12, 0.12, col('#ffffff'));
    R.line(x - 0.09, sy - 0.03, x + 0.09, sy + 0.03, 0.02, col('#e03a3e'));
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + i * 2.09, sx = x + Math.cos(a) * 0.26, s2 = sy + Math.sin(a) * 0.2;
      star(R, sx, s2, 0.07, col(i === 1 ? '#e03a3e' : i ? '#ffffff' : '#ffd23f'));
    }
  }
}

function star(R, x, y, r, c) {
  R.tri(x, y - r, x - r * 0.9, y + r * 0.65, x + r * 0.9, y + r * 0.65, c);
  R.tri(x, y + r, x - r * 0.9, y - r * 0.45, x + r * 0.9, y - r * 0.45, c);
}

// Trail behind a flying powered ball. trail: oldest point first, each {x, y, z}.
export function drawPowerTrail(R, kind, trail, t) {
  if (kind === 'fire') return drawFireTrail(R, trail, t);
  const n = trail.length;
  if (n < 2) return;
  const sy = (p) => p.y - p.z * Z2Y;
  if (kind === 'lightning') {
    for (let i = 1; i < n; i++) {
      const a = trail[i - 1], b = trail[i], k = i / n;
      R.line(a.x, sy(a), b.x, sy(b), 0.22 * (0.3 + k * 0.7), col('#7fe7ff', q(k * 0.35)));
    }
    // two crackling bolts running along the trail
    const f = Math.floor(t * 20);
    for (let b2 = 0; b2 < 2; b2++) {
      for (let i = 1; i < n; i++) {
        const a = trail[i - 1], b = trail[i], k = i / n;
        const j = (Math.sin((f + i * 3 + b2 * 11) * 1.7) * 0.12) * (1 - k * 0.5);
        R.line(a.x, sy(a) + (i > 1 ? j : 0), b.x, sy(b) - j, 0.03 * (0.4 + k), b2 ? ELEC.white : ELEC.cyan);
      }
    }
  } else if (kind === 'ice') {
    for (let i = 1; i < n; i++) {
      const a = trail[i - 1], b = trail[i], k = i / n;
      R.line(a.x, sy(a), b.x, sy(b), 0.2 * (0.3 + k * 0.7), col('#9fe3ff', q(k * 0.5)));
      R.line(a.x, sy(a), b.x, sy(b), 0.06 * (0.3 + k * 0.7), col('#ffffff', q(k)));
    }
    for (let i = 0; i < n; i += 3) { // snow sparkles
      const p = trail[i], k = (i + 1) / n;
      R.ellipse(p.x + Math.sin(i * 1.9 + t * 3) * 0.15, sy(p) + Math.cos(i * 2.3) * 0.15, 0.03, 0.03, col('#ffffff', q(0.4 + k * 0.6)));
    }
  } else if (kind === 'power') {
    for (let i = 1; i < n; i++) {
      const a = trail[i - 1], b = trail[i], k = i / n;
      for (const o of [-0.1, 0, 0.1]) R.line(a.x, sy(a) + o, b.x, sy(b) + o, (o ? 0.015 : 0.05) * (0.3 + k), col(o ? '#ffffff' : '#ffd23f', q(k)));
    }
  } else {
    for (let i = 0; i < n; i += 2) {
      const p = trail[i], k = (i + 1) / n;
      star(R, p.x + Math.sin(i * 2.3) * 0.12, sy(p) + Math.cos(i * 1.7) * 0.12, 0.03 + k * 0.05, col(['#e03a3e', '#ffffff', '#2f4a8a'][i % 3], q(0.3 + k * 0.7)));
    }
  }
}

// A player frozen in a block of ice (ice power).
export function drawIceBlock(R, p, t) {
  setInk(R);
  const X = p.x, Y = p.y - (p.z || 0) * Z2Y;
  R.rect(X, Y - 0.62, 0.44, 0.7, col('#bfefff', 0.45), 0, 0.12);
  R.rect(X, Y - 0.62, 0.44, 0.7, col('#ffffff', 0.12), 0, 0.12);
  R.line(X - 0.3, Y - 1.1, X - 0.12, Y - 1.25, 0.03, col('#ffffff', 0.8));
  R.line(X + 0.2, Y - 0.2, X + 0.33, Y - 0.35, 0.025, col('#ffffff', 0.6));
  R.ring(X, Y - 0.62, 0.45, 0.71, 0.02, col('#e8fbff', 0.7));
}
