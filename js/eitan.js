// Eitan: a custom hero for the Hornets, plus the full-screen "POWER" portrait
// (big head looking at you, flexing muscular arms). Four costume/power variants to choose from.

import { col, TP, ink, setInk, SQUADS } from './toon.js';

// In-game look (small figure): Eitan plays centre back for the Hornets.
export const EITAN = SQUADS[0].heroes.find((h) => h.name === 'Eitan');

export const VARIANTS = [
  {
    key: 'muscle', name: 'איתן סופר-שריר', en: 'Super Muscle Eitan',
    power: 'זריקת כוח: הכדור טס פי 2 מהר ישר לשער',
    shirt: '#ffd23f', trim: '#1b2a4a', bg: ['#ffb000', '#ffd23f'], aura: '#fff3b0',
    acc: [], pose: 'double', emblem: 'star',
  },
  {
    key: 'captain', name: 'קפטן איתן', en: 'Captain Eitan',
    power: 'קפטן: כל הקבוצה רצה מהר יותר ל-6 שניות',
    shirt: '#ffffff', trim: '#e03a3e', trim2: '#1b2a4a', bg: ['#1b2a4a', '#2f4a8a'], aura: '#9fc3ff',
    acc: ['cape'], cape: '#e03a3e', pose: 'ball', emblem: 'shield',
  },
  {
    key: 'lightning', name: 'איתן הברק', en: 'Lightning Eitan',
    power: 'עיני ברק: השוער קופא לשנייה וחצי',
    shirt: '#24305e', trim: '#7fe7ff', bg: ['#0f1638', '#3b2a8a'], aura: '#7fe7ff',
    acc: ['laser', 'bolts'], pose: 'double', emblem: 'bolt',
  },
  {
    key: 'fire', name: 'איתן האש', en: 'Fire Eitan',
    power: 'כדור אש: זריקה שאי אפשר לחסום',
    shirt: '#e8453c', trim: '#ffd23f', bg: ['#b3261e', '#ff7a1a'], aura: '#ffb347',
    acc: ['headband', 'fireball'], pose: 'fire', emblem: 'flame',
  },
];

// The in-game hero with a variant's kit applied.
export const LIGHTNING = VARIANTS.find((v) => v.key === 'lightning');

export function eitanHero(v) {
  return { ...EITAN, acc: [...EITAN.acc, ...(v.acc.includes('cape') ? ['cape'] : []), ...(v.acc.includes('headband') ? ['headband'] : [])], emblem: v.emblem === 'flame' ? 'drop' : v.emblem === 'shield' ? 'hex' : v.emblem };
}
export function eitanKit(v) {
  return { shirt: v.shirt, trim: v.trim, shorts: v.trim2 || '#1b2a4a', cape: v.cape || '#1b2a4a', shoe: '#ffffff', gk: v.shirt, gkTrim: v.trim, mask: '#000', glow: v.aura };
}

const SKIN = col('#f2c6a4'), SKIN_SH = col('#e2a684'), HAIR = col('#6e4a2a'), HAIR_HI = col('#9b7046');
const FRAME = col('#2a1712'), IRIS = col('#6a4225'), LENS = col('#dff3ff', 0.22), LIP = col('#d77b7b');

// Portrait in its own coordinates: the head is centred at (0, -1.55) with radius ~1.1, waist at y = 1.6.
// Call with the renderer's camera already set up to frame roughly x -2.4..2.4, y -3.3..1.7.
export function drawPortrait(R, v, t, intro = 1) {
  setInk(R);
  const { E, B, L, T } = ink;
  const pulse = Math.sin(t * 4) * 0.5 + 0.5;
  const bob = Math.sin(t * 2) * 0.04;

  // background burst
  const bg0 = col(v.bg[0]), bg1 = col(v.bg[1]);
  R.rect(0, -0.8, 8, 6, bg0);
  const N = 18;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + t * 0.25, w = Math.PI / N;
    R.tri(0, -1.3, Math.cos(a) * 9, -1.3 + Math.sin(a) * 9, Math.cos(a + w) * 9, -1.3 + Math.sin(a + w) * 9, bg1);
  }
  R.ellipse(0, -1.3, 2.6 + pulse * 0.15, 2.6 + pulse * 0.15, col(v.aura, 0.35));
  R.ellipse(0, -1.3, 2.0, 2.0, col(v.aura, 0.3));
  if (v.acc.includes('bolts')) {
    for (const s of [-1, 1]) {
      const x = s * (2.2 + Math.sin(t * 9) * 0.05);
      T(R, x, -2.8, x - s * 0.35, -1.9, x + s * 0.05, -1.95, col('#7fe7ff'));
      T(R, x + s * 0.05, -2.05, x - s * 0.25, -1.05, x - s * 0.05, -1.95, col('#7fe7ff'));
    }
  }

  const y0 = bob;
  // cape behind everything
  if (v.acc.includes('cape')) {
    const c = col(v.cape), sw = Math.sin(t * 3) * 0.1;
    T(R, -1.0, -0.1 + y0, 1.0, -0.1 + y0, -2.3 - sw, 1.9, c, 0.05);
    T(R, 1.0, -0.1 + y0, 2.3 + sw, 1.9, -2.3 - sw, 1.9, c, 0.05);
  }

  const shirt = col(v.shirt), trim = col(v.trim);
  // ----- arms (behind the head, in front of the background)
  const flex = 1 + pulse * 0.07;
  const arm = (s, raise) => {
    const sx = s * 1.0, sy = 0.25 + y0;            // shoulder
    const ex = s * 2.1, ey = 0.12 + y0;            // elbow
    const fx = s * 1.95, fy = -1.15 + y0 - raise;  // fist
    L(R, sx, sy, ex, ey, 0.3, SKIN);               // upper arm
    L(R, ex, ey, fx, fy + 0.1, 0.27, SKIN);        // forearm
    E(R, s * 1.98, -0.45 + y0, 0.3, 0.42, SKIN);   // forearm muscle
    E(R, s * 1.5, -0.08 + y0, 0.55 * flex, 0.42 * flex, SKIN); // big biceps on top of the upper arm
    R.line(s * 1.2, -0.02 + y0, s * 1.45, -0.28 + y0, 0.03, SKIN_SH);
    R.ellipse(s * 1.42, -0.3 + y0, 0.16, 0.07, col('#ffffff', 0.5)); // shine
    E(R, fx, fy - 0.12, 0.34, 0.31, SKIN);         // fist
    for (let k = -1; k <= 1; k++) R.line(fx - s * 0.18, fy - 0.12 + k * 0.1, fx + s * 0.05, fy - 0.12 + k * 0.1, 0.018, TP.ink);
    E(R, s * 1.05, 0.15 + y0, 0.4, 0.36, shirt);   // sleeve / shoulder
    R.rect(s * 1.05, 0.42 + y0, 0.38, 0.06, trim, 0, 0.03);
  };
  if (v.pose === 'double') { arm(-1, 0); arm(1, 0); }
  else { arm(-1, 0); }

  // ----- torso
  B(R, 0, 1.0 + y0, 1.05, 0.95, shirt, 0.45);
  R.line(-0.55, 0.35 + y0, -0.05, 0.62 + y0, 0.025, col('#000000', 0.18)); // chest lines
  R.line(0.55, 0.35 + y0, 0.05, 0.62 + y0, 0.025, col('#000000', 0.18));
  B(R, 0, 0.12 + y0, 0.42, 0.12, trim, 0.1); // collar
  emblem(R, v, 0, 1.0 + y0, t);
  if (v.trim2) R.rect(0, 1.75 + y0, 1.05, 0.08, col(v.trim2));

  // second arm for one-arm poses, in front of the body
  if (v.pose === 'ball' || v.pose === 'fire') {
    const s = 1, sx = 1.05, sy = 0.25 + y0;
    if (v.pose === 'ball') {
      L(R, sx, sy, 1.75, 0.95 + y0, 0.31, SKIN);
      E(R, 1.45, 0.55 + y0, 0.36 * flex, 0.3 * flex, SKIN);
      E(R, 1.2, 1.15 + y0, 0.45, 0.45, col('#fff3c4'));
      R.line(0.85, 1.0 + y0, 1.55, 1.3 + y0, 0.04, col('#ff4b3e'));
      R.ring(1.3, 1.0 + y0, 0.2, 0.2, 0.03, col('#ff4b3e'));
      E(R, 1.75, 1.0 + y0, 0.28, 0.26, SKIN);
    } else {
      // arm raised high holding a fireball
      L(R, sx, sy, 1.9, -0.6 + y0, 0.31, SKIN);
      L(R, 1.9, -0.6 + y0, 1.75, -2.2 + y0, 0.27, SKIN);
      E(R, 1.6, -0.45 + y0, 0.38 * flex, 0.32 * flex, SKIN);
      fireball(R, 1.75, -2.75 + y0, t);
      E(R, 1.75, -2.25 + y0, 0.3, 0.28, SKIN);
    }
    E(R, s * 1.05, 0.15 + y0, 0.4, 0.36, shirt);
    R.rect(s * 1.05, 0.42 + y0, 0.38, 0.06, trim, 0, 0.03);
  }

  // ----- neck and head
  B(R, 0, -0.1 + y0, 0.3, 0.22, SKIN, 0.1);
  const hy = -1.55 + y0;
  if (v.acc.includes('headband')) {
    const w = Math.sin(t * 8) * 0.08, c = col(v.trim);
    T(R, -1.0, hy - 0.66, -1.75, hy - 0.95 + w, -1.65, hy - 0.72 + w, c, 0.03);
    T(R, -1.0, hy - 0.58, -1.7, hy - 0.45 - w, -1.6, hy - 0.3 - w, c, 0.03);
  }
  for (const s of [-1, 1]) { E(R, s * 1.08, hy + 0.12, 0.2, 0.27, SKIN); R.ellipse(s * 1.1, hy + 0.12, 0.08, 0.13, SKIN_SH); }
  E(R, 0, hy, 1.1, 1.05, SKIN);
  R.ellipse(0, hy + 0.75, 0.55, 0.22, col('#e2a684', 0.25)); // chin shade

  // hair: short sides, tall tufty top swept up and to the right
  E(R, 0, hy - 0.72, 1.12, 0.5, HAIR);
  for (const [bx, tx, ty] of [[-0.75, -0.6, -1.15], [-0.4, -0.1, -1.45], [0.0, 0.45, -1.6], [0.4, 0.95, -1.4], [0.75, 1.15, -1.0]]) {
    T(R, bx - 0.32, hy - 0.62, bx + 0.32, hy - 0.66, tx, hy + ty, HAIR, 0.06);
  }
  R.ellipse(0, hy - 0.75, 1.08, 0.46, HAIR);
  R.ellipse(-1.02, hy - 0.25, 0.14, 0.32, HAIR); // sideburns
  R.ellipse(1.02, hy - 0.25, 0.14, 0.32, HAIR);
  for (const [a, b, c, d] of [[-0.5, -1.0, -0.2, -1.3], [0.1, -1.05, 0.45, -1.4], [0.55, -0.95, 0.85, -1.2]]) R.line(a, hy + b + 0.2, c, hy + d + 0.2, 0.035, HAIR_HI);

  // eyebrows (thick)
  for (const s of [-1, 1]) R.line(s * 0.7, hy - 0.42, s * 0.18, hy - 0.47, 0.065, col('#4a3120'));

  // glasses frames, then eyes inside them
  const laser = v.acc.includes('laser');
  for (const s of [-1, 1]) {
    B(R, s * 0.45, hy - 0.08, 0.36, 0.27, FRAME, 0.1);
    R.rect(s * 0.45, hy - 0.08, 0.28, 0.2, SKIN, 0, 0.06);
    R.ellipse(s * 0.45, hy - 0.06, 0.2, 0.17, TP.eyeWhite);
    const lx = s * 0.45 + Math.sin(t * 0.7) * 0.02;
    R.ellipse(lx, hy - 0.05, 0.12, 0.13, laser ? col('#7fe7ff') : IRIS);
    R.ellipse(lx, hy - 0.05, 0.06, 0.065, laser ? col('#ffffff') : TP.ink);
    R.ellipse(lx - 0.04, hy - 0.1, 0.035, 0.035, TP.highlight);
    R.rect(s * 0.45, hy - 0.08, 0.28, 0.2, laser ? col('#7fe7ff', 0.25 + pulse * 0.3) : LENS, 0, 0.06);
    R.line(s * 0.45 - 0.18, hy - 0.2, s * 0.45 - 0.05, hy - 0.26, 0.025, col('#ffffff', 0.7)); // glare
    R.line(s * 0.81, hy - 0.12, s * 1.02, hy - 0.05, 0.05, FRAME); // temples
  }
  R.line(-0.09, hy - 0.12, 0.09, hy - 0.12, 0.05, FRAME); // bridge
  if (laser) for (const s of [-1, 1]) R.line(s * 0.45, hy - 0.05, s * 0.45 + s * 0.2, hy + 3.2, 0.05 + pulse * 0.03, col('#7fe7ff', 0.5));

  // nose, cheeks, smirk (closed mouth, one side higher), dimple
  R.ellipse(0, hy + 0.28, 0.13, 0.1, SKIN_SH);
  R.ellipse(-0.04, hy + 0.25, 0.04, 0.03, col('#ffffff', 0.5));
  R.ellipse(-0.62, hy + 0.38, 0.2, 0.1, TP.blush);
  R.ellipse(0.62, hy + 0.38, 0.2, 0.1, TP.blush);
  const m = [[-0.38, 0.55], [-0.18, 0.62], [0.05, 0.63], [0.25, 0.58], [0.4, 0.49]];
  for (let i = 0; i < m.length - 1; i++) R.line(m[i][0], hy + m[i][1], m[i + 1][0], hy + m[i + 1][1], 0.04, TP.ink);
  R.line(-0.15, hy + 0.67, 0.15, hy + 0.67, 0.035, LIP);
  R.line(0.44, hy + 0.46, 0.47, hy + 0.55, 0.025, SKIN_SH);

  if (v.acc.includes('headband')) B(R, 0, hy - 0.62, 1.07, 0.11, col(v.trim), 0.08);
  if (v.acc.includes('fireball')) {
    for (let i = 0; i < 6; i++) {
      const a = t * 3 + i;
      R.ellipse(-1.9 + Math.sin(a) * 0.2, 1.4 - ((t * 0.8 + i * 0.3) % 2), 0.08, 0.08, col('#ffd23f', 0.7));
    }
  }
  if (intro < 1) R.rect(0, -0.8, 8, 6, col('#ffffff', Math.round((1 - intro) * 20) / 20));
}

function emblem(R, v, x, y, t) {
  const { T, E } = ink;
  const c = col(v.trim);
  if (v.emblem === 'star') {
    // five-pointed star: five spikes around a centre disc, outlined then filled
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      pts.push([x + Math.cos(a) * 0.48, y + Math.sin(a) * 0.48, a]);
    }
    const spike = (cc, r) => pts.forEach(([px, py, a]) => {
      const b = 0.2;
      R.tri(px, py, x + Math.cos(a - 0.63) * b, y + Math.sin(a - 0.63) * b, x + Math.cos(a + 0.63) * b, y + Math.sin(a + 0.63) * b, cc, r);
    });
    spike(TP.ink, ink.O);
    R.ellipse(x, y, 0.2 + ink.O, 0.2 + ink.O, TP.ink);
    spike(c, 0);
    R.ellipse(x, y, 0.21, 0.21, c);
  } else if (v.emblem === 'shield') {
    E(R, x, y - 0.05, 0.36, 0.3, c);
    T(R, x - 0.36, y, x + 0.36, y, x, y + 0.48, c, 0.02);
    R.ellipse(x, y - 0.05, 0.36, 0.3, c);
    R.tri(x - 0.12, y - 0.1, x + 0.12, y - 0.1, x, y + 0.12, col('#ffffff'));
  } else if (v.emblem === 'bolt') {
    T(R, x + 0.12, y - 0.5, x - 0.3, y + 0.05, x + 0.02, y + 0.05, c);
    T(R, x - 0.12, y + 0.5, x + 0.3, y - 0.05, x - 0.02, y - 0.05, c);
  } else if (v.emblem === 'flame') {
    fireball(R, x, y, t, 0.6);
  }
}

function fireball(R, x, y, t, s = 1) {
  const { E } = ink;
  for (let i = 0; i < 5; i++) {
    const a = t * 6 + i * 1.3;
    R.tri(x - 0.3 * s, y, x + 0.3 * s, y, x + Math.sin(a) * 0.15 * s, y - (0.6 + Math.sin(a * 1.3) * 0.15) * s, col(i % 2 ? '#ff7a1a' : '#ffd23f'));
  }
  E(R, x, y + 0.05 * s, 0.38 * s, 0.38 * s, col('#ff7a1a'));
  R.ellipse(x, y + 0.08 * s, 0.24 * s, 0.24 * s, col('#ffd23f'));
  R.ellipse(x - 0.08 * s, y, 0.08 * s, 0.08 * s, col('#ffffff', 0.8));
}
