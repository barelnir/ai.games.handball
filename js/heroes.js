// Custom heroes: a player's look (profile, drawn from a photo) combined with a power template
// (Lightning, Fire, Muscle, Captain). The template sets everything about the power: the full-screen
// close-up costume, the ball, the trail, the glow, the sound and what the power does in the game.
// To add a new player: add an entry to PROFILES (colours and hairstyle), nothing else.

import { col, TP, ink, setInk } from './toon.js';

export const PROFILES = [
  {
    id: 'eitan', name: 'Eitan', nameHe: 'איתן',
    skin: '#f2c6a4', skinShade: '#e2a684', hair: '#6e4a2a', hairHi: '#9b7046', brow: '#4a3120',
    iris: '#6a4225', glasses: '#2a1712', style: 'swoop', mouth: 'smirk', power: 'lightning',
  },
  {
    // light-brown loose hair down to the shoulders, big happy smile with a missing front tooth, earrings
    id: 'emma', name: 'Emma', nameHe: 'אמה',
    skin: '#f3c8a8', skinShade: '#e3a888', hair: '#b08a5c', hairHi: '#dcbf8e', brow: '#6e5236',
    iris: '#4a2e1c', glasses: null, style: 'long', mouth: 'grin', earrings: '#e8c25a', girl: true, power: 'fire',
  },
  {
    // light ash-brown hair with a fringe falling over the forehead, short sides, calm closed smile
    id: 'eyal', name: 'Eyal', nameHe: 'אייל',
    skin: '#f1c9a9', skinShade: '#dfa785', hair: '#a88d63', hairHi: '#d4bc90', brow: '#6e5a42',
    iris: '#4e3220', glasses: null, style: 'fringe', mouth: 'smile', power: 'ice',
  },
  {
    // brown hair with a long fringe swept to one side, freckles on the nose and cheeks, a sly closed smile
    id: 'rafael', name: 'Rafael', nameHe: 'רפל',
    skin: '#f0c4a2', skinShade: '#dda080', hair: '#5e4128', hairHi: '#8e6a46', brow: '#4a3420',
    iris: '#4a2e1c', glasses: null, style: 'side', mouth: 'smirk', freckles: '#c98a62', power: 'captain',
  },
  {
    // a mop of tight dark curls (a few falling on the forehead), short sides, warm tanned skin,
    // a pressed-lips half smile
    id: 'roy', name: 'Roy', nameHe: 'רוי',
    skin: '#e8b48e', skinShade: '#d39670', hair: '#2b1a12', hairHi: '#5b3b27', brow: '#2a1a12',
    iris: '#3b2416', glasses: null, style: 'curly', mouth: 'smirk', power: 'lightning',
  },
  {
    // short black hair combed up and over to one side, thick dark eyebrows, big dark eyes with long
    // lashes, freckles across the nose and cheeks, olive skin, a calm closed mouth
    id: 'cohen', name: 'Cohen', nameHe: 'כהן',
    skin: '#dca57c', skinShade: '#c38862', hair: '#1a1210', hairHi: '#3e2c22', brow: '#1a1210',
    iris: '#3a2214', glasses: null, style: 'neat', mouth: 'calm', freckles: '#a5683f', lashes: true, power: 'muscle',
  },
  {
    // ginger-blond wavy hair, a bit messy, with a fringe falling over the forehead to one side,
    // fair skin with a few freckles on the nose, light hazel eyes, a calm closed mouth
    id: 'eliya', name: 'Eliya', nameHe: 'אליה',
    skin: '#f4cdb0', skinShade: '#e2aa8a', hair: '#c4813c', hairHi: '#eeba76', brow: '#a26a36',
    iris: '#6b5232', glasses: null, style: 'messy', mouth: 'calm', freckles: '#d79a72', power: 'fire',
  },
];
export const profileById = (id) => PROFILES.find((p) => p.id === id) || PROFILES[0];

// The computer team's power hero (Venom, the Vipers' centre back). Not in the picker.
export const RIVAL = {
  id: 'venom', name: 'Venom', nameHe: 'ארס',
  skin: '#e0ac85', skinShade: '#c98f6a', hair: '#3a1838', hairHi: '#6b3a66', brow: '#2a1028',
  iris: '#3fbf4a', glasses: null, style: 'short', mouth: 'smirk',
};

// fx: what the power does.
//   speed      shot speed multiplier          aim        shot error multiplier (lower = more accurate)
//   unblockable  defenders can't block         freezeKeeper  keeper frozen for N seconds (no save)
//   keeperSave   multiplier on the keeper's save chance
//   teamSpeed / teamTime   whole team runs faster for teamTime seconds
export const TEMPLATES = {
  lightning: {
    key: 'lightning', label: 'ברק', he: 'הברק', about: 'כדור ברק: השוער קופא',
    title: (n) => `${n} הברק!`, sub: 'כדור ברק!',
    shirt: '#24305e', trim: '#7fe7ff', bg: ['#0f1638', '#3b2a8a'], aura: '#7fe7ff',
    acc: ['laser', 'bolts'], pose: 'double', emblem: 'bolt', gameEmblem: 'bolt', gameAcc: [],
    ball: 'lightning', sound: 'zap',
    fx: { speed: 1.35, aim: 0.6, unblockable: true, freezeKeeper: 1.5 },
  },
  fire: {
    key: 'fire', label: 'אש', he: 'האש', about: 'כדור אש: אי אפשר לחסום אותו',
    title: (n) => `${n} האש!`, sub: 'כדור אש!',
    shirt: '#e8453c', trim: '#ffd23f', bg: ['#b3261e', '#ff7a1a'], aura: '#ffb347',
    acc: ['headband', 'fireball'], pose: 'fire', emblem: 'flame', gameEmblem: 'drop', gameAcc: ['headband'],
    ball: 'fire', sound: 'whoosh',
    fx: { speed: 1.6, aim: 0.6, unblockable: true, keeperSave: 0.25 },
  },
  muscle: {
    key: 'muscle', label: 'שרירים', he: 'סופר-שריר', about: 'זריקת כוח: מהירה פי 2',
    title: (n) => `${n} סופר-שריר!`, sub: 'זריקת כוח!',
    shirt: '#ffd23f', trim: '#1b2a4a', bg: ['#ffb000', '#ffd23f'], aura: '#fff3b0',
    acc: [], pose: 'double', emblem: 'star', gameEmblem: 'star', gameAcc: [],
    ball: 'power', sound: 'boom',
    fx: { speed: 2.0, aim: 0.5, keeperSave: 0.4 },
  },
  ice: {
    key: 'ice', label: 'קרח', he: 'איש הקרח', about: 'כוח קרח: כל היריבים קופאים',
    title: (n) => `${n} איש הקרח!`, sub: 'כולם קפאו!',
    shirt: '#bfe9ff', trim: '#2a6fd6', bg: ['#0b3a6b', '#4fb6f0'], aura: '#cff4ff',
    acc: ['frost'], pose: 'double', emblem: 'snowflake', gameEmblem: 'diamond', gameAcc: [],
    ball: 'ice', sound: 'freeze',
    fx: { speed: 1.3, aim: 0.6, freezeTeam: 3 }, // the computer's ice freezes you for less (see powers.js)
  },
  captain: {
    key: 'captain', label: 'קפטן', he: 'הקפטן', about: 'קפטן: כל הקבוצה רצה מהר יותר',
    title: (n) => `${n} הקפטן!`, sub: 'כולם קדימה!',
    shirt: '#ffffff', trim: '#e03a3e', trim2: '#1b2a4a', bg: ['#1b2a4a', '#2f4a8a'], aura: '#9fc3ff',
    acc: ['cape'], cape: '#e03a3e', pose: 'ball', emblem: 'shield', gameEmblem: 'hex', gameAcc: ['cape'],
    ball: 'star', sound: 'fanfare',
    fx: { speed: 1.2, aim: 0.8, teamSpeed: 1.3, teamTime: 8 },
  },
};
export const TEMPLATE_LIST = Object.values(TEMPLATES);

// The small in-game figure for a profile + template (wears the team kit; the template adds a detail).
export function heroFromProfile(pr, tp) {
  return {
    role: 'CB', pos: 'Centre back', name: pr.name, nameHe: pr.nameHe, build: 'normal', custom: true,
    skin: pr.skin, hair: pr.hair, style: pr.style === 'ponytail' ? 'pony' : pr.style, freckles: pr.freckles,
    acc: [...(pr.glasses ? ['glasses'] : []), ...tp.gameAcc],
    emblem: tp.gameEmblem,
  };
}
// One of the kids as a plain teammate (no power costume), for picking the line-up.
export function kidHero(pr) {
  return { ...heroFromProfile(pr, { gameAcc: [], gameEmblem: 'star' }), kid: pr.id };
}

// The template's costume as an in-game kit (used by the preview pages).
export function templateKit(tp) {
  return { shirt: tp.shirt, trim: tp.trim, shorts: tp.trim2 || '#1b2a4a', cape: tp.cape || '#1b2a4a', shoe: '#ffffff', gk: tp.shirt, gkTrim: tp.trim, mask: '#000', glow: tp.aura };
}

// Portrait in its own coordinates: the head is centred at (0, -1.55) with radius ~1.1, waist at y = 1.6.
// Call with the renderer's camera already set up to frame roughly x -2.4..2.4, y -3.3..1.7.
const LENS = col('#dff3ff', 0.22), LIP = col('#d77b7b');

export function drawPortrait(R, pr, v, t, intro = 1) {
  setInk(R);
  const SKIN = col(pr.skin), SKIN_SH = col(pr.skinShade), HAIR = col(pr.hair), HAIR_HI = col(pr.hairHi);
  const FRAME = col(pr.glasses || '#000000'), IRIS = col(pr.iris);
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
  if (v.acc.includes('frost')) {
    for (let i = 0; i < 10; i++) {
      const a = i * 0.63 + t * 0.4, r = 2.3 + (i % 3) * 0.25;
      snowflake(R, Math.cos(a) * r, -1.3 + Math.sin(a) * r * 0.8, 0.12 + (i % 2) * 0.06, col('#ffffff', 0.9));
    }
  }
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
  if (pr.style === 'long') { // loose hair falling past the ears onto the shoulders
    const sw = Math.sin(t * 2) * 0.04;
    E(R, 0, hy - 0.1, 1.32, 1.18, HAIR);
    for (const s of [-1, 1]) E(R, s * (0.98 + sw), hy + 0.75, 0.45, 0.75, HAIR);
  }
  if (pr.style === 'ponytail') { // tail peeking out behind the head, swinging a little
    const sw = Math.sin(t * 3) * 0.08;
    E(R, 0.9 + sw, hy - 0.95, 0.42, 0.3, HAIR);
    E(R, 1.2 + sw * 1.4, hy - 0.55, 0.3, 0.42, HAIR);
    R.ellipse(0.72, hy - 0.98, 0.12, 0.1, col('#e85d8a')); // hair tie
  }
  for (const s of [-1, 1]) { E(R, s * 1.08, hy + 0.12, 0.2, 0.27, SKIN); R.ellipse(s * 1.1, hy + 0.12, 0.08, 0.13, SKIN_SH); }
  if (pr.earrings) for (const s of [-1, 1]) ink.E(R, s * 1.1, hy + 0.42, 0.07, 0.07, col(pr.earrings));
  E(R, 0, hy, 1.1, 1.05, SKIN);
  R.ellipse(0, hy + 0.75, 0.55, 0.22, col(pr.skinShade, 0.25)); // chin shade

  // hair (short neat hair sits higher, so the forehead and the eyebrows show)
  const capY = pr.style === 'neat' ? -1.04 : -0.72;
  E(R, 0, hy + capY, 1.12, 0.5, HAIR);
  if (pr.style === 'swoop') { // short sides, tall tufty top swept up and to the right
    for (const [bx, tx, ty] of [[-0.75, -0.6, -1.15], [-0.4, -0.1, -1.45], [0.0, 0.45, -1.6], [0.4, 0.95, -1.4], [0.75, 1.15, -1.0]]) {
      T(R, bx - 0.32, hy - 0.62, bx + 0.32, hy - 0.66, tx, hy + ty, HAIR, 0.06);
    }
  }
  if (pr.style === 'curly') { // a mop of curls: round bumps all around the top of the head
    for (let i = 0; i <= 9; i++) {
      const a = Math.PI * (1.06 + i * 0.088);
      E(R, Math.cos(a) * 1.1, hy - 0.62 + Math.sin(a) * 0.74, 0.27, 0.25, HAIR);
    }
    for (let i = 0; i <= 4; i++) {
      const a = Math.PI * (1.2 + i * 0.15);
      E(R, Math.cos(a) * 0.62, hy - 0.86 + Math.sin(a) * 0.62, 0.26, 0.24, HAIR);
    }
  }
  if (pr.style === 'messy') { // wavy and a bit messy: soft tufts sticking up on top
    for (const [x, y, rx, ry] of [[-0.85, -0.95, 0.34, 0.3], [-0.42, -1.25, 0.4, 0.32], [0.12, -1.35, 0.42, 0.3], [0.62, -1.18, 0.4, 0.3], [0.95, -0.85, 0.3, 0.28]]) E(R, x, hy + y, rx, ry, HAIR);
  }
  if (pr.style === 'neat') { // short, combed up at the front and over to one side
    E(R, -0.35, hy - 1.08, 0.6, 0.28, HAIR);
    E(R, 0.28, hy - 1.16, 0.74, 0.3, HAIR);
  }
  R.ellipse(0, hy + capY - 0.03, 1.08, 0.46, HAIR);
  if (pr.style === 'neat') {
    R.ellipse(-0.35, hy - 1.08, 0.56, 0.24, HAIR); R.ellipse(0.28, hy - 1.16, 0.7, 0.26, HAIR); // no lines inside
    for (const [a, b, c, d] of [[-0.7, -0.98, -0.15, -1.2], [-0.3, -0.96, 0.3, -1.3], [0.1, -0.98, 0.75, -1.24]]) R.line(a, hy + b, c, hy + d, 0.03, HAIR_HI); // combed strands
  }
  if (pr.style === 'curly') {
    R.ellipse(0, hy - 1.0, 0.95, 0.5, HAIR); // fill in the mop (no outlines inside it)
    for (const [x, y] of [[-0.62, -0.6], [-0.3, -0.56], [0.06, -0.62], [0.42, -0.66]]) E(R, x, hy + y, 0.17, 0.15, HAIR); // curls on the forehead
    for (const [x, y] of [[-0.75, -1.3], [-0.3, -1.5], [0.2, -1.52], [0.65, -1.35], [-0.55, -0.95], [0.0, -1.05], [0.5, -0.98], [-0.62, -0.6], [-0.3, -0.56], [0.06, -0.62], [0.42, -0.66]]) {
      R.line(x - 0.1, hy + y - 0.01, x + 0.02, hy + y - 0.09, 0.03, HAIR_HI); // a little shine on each curl
    }
  }
  if (pr.style === 'messy') { // fill the top, then wavy locks over the forehead, swept to one side
    R.ellipse(0, hy - 1.0, 1.0, 0.42, HAIR);
    for (const [x0, x1, tx, ty] of [[-1.0, -0.5, -0.95, -0.3], [-0.62, -0.1, -0.62, -0.36], [-0.22, 0.3, -0.25, -0.42], [0.18, 0.68, 0.18, -0.46], [0.55, 1.02, 0.62, -0.5]]) {
      T(R, x0, hy - 0.8, x1, hy - 0.84, tx, hy + ty, HAIR, 0.08);
    }
    R.ellipse(0, hy - 0.82, 1.02, 0.34, HAIR);
    for (const [a, b, c, d] of [[-0.72, -1.08, -0.56, -0.82], [-0.22, -1.28, -0.3, -0.98], [0.3, -1.3, 0.2, -1.0], [0.78, -1.02, 0.62, -0.8]]) R.line(a, hy + b, c, hy + d, 0.035, HAIR_HI);
  }
  if (pr.style === 'fringe') { // bangs falling over the forehead
    for (const [x0, x1, tip] of [[-0.95, -0.45, -0.75], [-0.55, -0.05, -0.32], [-0.15, 0.35, 0.12], [0.25, 0.75, 0.52], [0.6, 1.0, 0.85]]) {
      T(R, x0, hy - 0.75, x1, hy - 0.78, tip, hy - 0.4, HAIR, 0.05);
    }
    R.ellipse(0, hy - 0.78, 1.05, 0.38, HAIR);
  }
  if (pr.style === 'side') { // one long fringe swept across the forehead, down to the eyebrow on one side
    T(R, -1.08, hy - 0.62, 0.2, hy - 1.12, 1.02, hy - 0.36, HAIR, 0.1);
    R.tri(-0.98, hy - 0.68, 0.15, hy - 1.02, 0.9, hy - 0.44, HAIR, 0.08); // no outline inside the hair
    R.ellipse(-0.1, hy - 0.86, 0.95, 0.3, HAIR);
    for (const [a, b, c, d] of [[-0.6, -0.88, 0.45, -0.6], [-0.2, -0.98, 0.78, -0.55], [-0.85, -0.74, 0.05, -0.56]]) R.line(a, hy + b, c, hy + d, 0.03, HAIR_HI);
  }
  if (pr.style === 'long') { // centre parting and soft locks framing the face
    R.line(0, hy - 1.15, 0.04, hy - 0.7, 0.025, col(pr.skinShade));
    for (const s of [-1, 1]) {
      T(R, s * 0.35, hy - 0.95, s * 1.12, hy - 0.62, s * 1.0, hy + 0.05, HAIR, 0.06);
      R.line(s * 0.75, hy - 0.75, s * 1.0, hy - 0.2, 0.03, HAIR_HI);
    }
  } else if (pr.style === 'ponytail') { // pulled back with a centre parting and loose strands
    R.line(0, hy - 1.15, 0.05, hy - 0.68, 0.025, col(pr.skinShade));
    for (const s of [-1, 1]) {
      R.line(s * 1.04, hy - 0.5, s * 1.16, hy - 0.05, 0.04, HAIR);
      R.line(s * 1.1, hy - 0.4, s * 1.2, hy + 0.12 + Math.sin(t * 2 + s) * 0.03, 0.022, HAIR);
    }
  } else if (pr.style === 'neat') { // short sides, down from the hair to the temples
    for (const x of [-0.84, 0.84]) R.ellipse(x, hy - 0.62, 0.17, 0.3, HAIR);
  } else if (pr.style === 'curly') { // short sides
    R.ellipse(-1.03, hy - 0.42, 0.1, 0.2, HAIR);
    R.ellipse(1.03, hy - 0.42, 0.1, 0.2, HAIR);
  } else {
    R.ellipse(-1.02, hy - 0.25, 0.14, 0.32, HAIR); // sideburns
    R.ellipse(1.02, hy - 0.25, 0.14, 0.32, HAIR);
  }
  if (!['side', 'curly', 'neat', 'messy'].includes(pr.style)) for (const [a, b, c, d] of [[-0.5, -1.0, -0.2, -1.3], [0.1, -1.05, 0.45, -1.4], [0.55, -0.95, 0.85, -1.2]]) R.line(a, hy + b + 0.2, c, hy + d + 0.2, 0.035, HAIR_HI);

  // eyebrows (thick)
  for (const s of [-1, 1]) R.line(s * 0.7, hy - 0.42, s * 0.18, hy - 0.47, pr.girl ? 0.045 : 0.065, col(pr.brow));
  if (pr.girl || pr.lashes) for (const s of [-1, 1]) for (let k = 0; k < 3; k++) R.line(s * (0.62 - k * 0.05), hy - 0.2, s * (0.68 - k * 0.04), hy - 0.27, 0.014, TP.ink); // lashes

  // glasses frames, then eyes inside them
  const laser = v.acc.includes('laser');
  const gl = !!pr.glasses;
  for (const s of [-1, 1]) {
    if (gl) {
      B(R, s * 0.45, hy - 0.08, 0.36, 0.27, FRAME, 0.1);
      R.rect(s * 0.45, hy - 0.08, 0.28, 0.2, SKIN, 0, 0.06);
    }
    if (gl) R.ellipse(s * 0.45, hy - 0.06, 0.2, 0.17, TP.eyeWhite);
    else ink.E(R, s * 0.45, hy - 0.06, 0.22, 0.2, TP.eyeWhite);
    const lx = s * 0.45 + Math.sin(t * 0.7) * 0.02;
    R.ellipse(lx, hy - 0.05, 0.12, 0.13, laser ? col('#7fe7ff') : IRIS);
    R.ellipse(lx, hy - 0.05, 0.06, 0.065, laser ? col('#ffffff') : TP.ink);
    R.ellipse(lx - 0.04, hy - 0.1, 0.035, 0.035, TP.highlight);
    if (gl) {
      R.rect(s * 0.45, hy - 0.08, 0.28, 0.2, laser ? col('#7fe7ff', Math.round((0.25 + pulse * 0.3) * 10) / 10) : LENS, 0, 0.06);
      R.line(s * 0.45 - 0.18, hy - 0.2, s * 0.45 - 0.05, hy - 0.26, 0.025, col('#ffffff', 0.7)); // glare
      R.line(s * 0.81, hy - 0.12, s * 1.02, hy - 0.05, 0.05, FRAME); // temples
    }
  }
  if (gl) R.line(-0.09, hy - 0.12, 0.09, hy - 0.12, 0.05, FRAME); // bridge
  if (laser) for (const s of [-1, 1]) R.ellipse(s * 0.45, hy - 0.05, 0.3 + pulse * 0.04, 0.27 + pulse * 0.04, col('#7fe7ff', 0.25)); // glowing eyes

  // nose, cheeks, smirk (closed mouth, one side higher), dimple
  R.ellipse(0, hy + 0.28, 0.13, 0.1, SKIN_SH);
  R.ellipse(-0.04, hy + 0.25, 0.04, 0.03, col('#ffffff', 0.5));
  R.ellipse(-0.62, hy + 0.38, 0.2, 0.1, TP.blush);
  R.ellipse(0.62, hy + 0.38, 0.2, 0.1, TP.blush);
  if (pr.freckles) { // freckles across the nose and cheeks
    const fc = col(pr.freckles);
    for (const [x, y] of [[-0.62, 0.22], [-0.48, 0.3], [-0.7, 0.34], [-0.55, 0.42], [-0.2, 0.2], [0.2, 0.2], [0.62, 0.22], [0.48, 0.3], [0.7, 0.34], [0.55, 0.42], [-0.08, 0.14], [0.08, 0.14]]) R.ellipse(x, hy + y, 0.035, 0.03, fc);
  }
  if (pr.mouth === 'grin') {
    // big open smile with a gap where a front tooth fell out
    // a big happy crescent smile: teeth showing, with the gap of a missing front tooth
    ink.E(R, 0, hy + 0.47, 0.42, 0.22, col('#8a3040'));
    R.ellipse(0, hy + 0.66, 0.2, 0.07, col('#ff8a9a'));
    R.ellipse(0, hy + 0.44, 0.36, 0.11, TP.white);
    R.rect(0.04, hy + 0.45, 0.035, 0.09, col('#8a3040'));         // the gap
    R.ellipse(0, hy + 0.3, 0.5, 0.17, SKIN);                     // upper lip line becomes a curve
    R.line(-0.38, hy + 0.38, -0.12, hy + 0.45, 0.028, TP.ink);
    R.line(-0.12, hy + 0.45, 0.12, hy + 0.45, 0.028, TP.ink);
    R.line(0.12, hy + 0.45, 0.38, hy + 0.38, 0.028, TP.ink);
    for (const s of [-1, 1]) R.line(s * 0.43, hy + 0.36, s * 0.5, hy + 0.28, 0.025, SKIN_SH); // dimples
  } else if (pr.mouth === 'calm') { // a calm, closed mouth: a short straight line and a full lower lip
    R.line(-0.24, hy + 0.56, 0.24, hy + 0.56, 0.04, TP.ink);
    R.ellipse(0, hy + 0.64, 0.17, 0.05, LIP);
  } else if (pr.mouth === 'smile') {
    const m = [[-0.34, 0.52], [-0.16, 0.6], [0.16, 0.6], [0.34, 0.52]];
    for (let i = 0; i < m.length - 1; i++) R.line(m[i][0], hy + m[i][1], m[i + 1][0], hy + m[i + 1][1], 0.04, TP.ink);
    R.line(-0.12, hy + 0.65, 0.12, hy + 0.65, 0.03, LIP);
  } else {
    const m = [[-0.38, 0.55], [-0.18, 0.62], [0.05, 0.63], [0.25, 0.58], [0.4, 0.49]];
    for (let i = 0; i < m.length - 1; i++) R.line(m[i][0], hy + m[i][1], m[i + 1][0], hy + m[i + 1][1], 0.04, TP.ink);
    R.line(-0.15, hy + 0.67, 0.15, hy + 0.67, 0.035, LIP);
    R.line(0.44, hy + 0.46, 0.47, hy + 0.55, 0.025, SKIN_SH);
  }

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
  } else if (v.emblem === 'snowflake') {
    snowflake(R, x, y, 0.42, c, 0.05);
  } else if (v.emblem === 'flame') {
    fireball(R, x, y, t, 0.6);
  }
}

export function snowflake(R, x, y, r, c, w = r * 0.12) {
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3, dx = Math.cos(a) * r, dy = Math.sin(a) * r;
    R.line(x - dx, y - dy, x + dx, y + dy, w, c);
    for (const k of [-1, 1]) {
      const bx = x + dx * 0.55 * k, by = y + dy * 0.55 * k, ba = a + (k > 0 ? 0 : Math.PI);
      R.line(bx, by, bx + Math.cos(ba + 0.7) * r * 0.3, by + Math.sin(ba + 0.7) * r * 0.3, w * 0.8, c);
      R.line(bx, by, bx + Math.cos(ba - 0.7) * r * 0.3, by + Math.sin(ba - 0.7) * r * 0.3, w * 0.8, c);
    }
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
