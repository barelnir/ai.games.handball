// Clubs from the Israeli kids' handball leagues and national teams: names and shirt colours only
// (no badges).
// You can play as one of them, and pick one as the opponent. When both teams' shirts look alike,
// the opponent wears its white away kit so the two teams are easy to tell apart.

import { SQUADS } from './toon.js';

const kit = (shirt, trim, shorts, gk, gkTrim) => ({ shirt, trim, shorts, cape: trim, shoe: '#ffffff', gk, gkTrim, mask: '#1b2a4a', glow: shirt });

// Each club gets an emblem of our own (not the club's official logo): a shield in its colours, with
// its initials on the cards and a stripe pattern on the shirts.
const CRESTS = {
  'nes-ziona': { a: '#ff7a1a', b: '#ffffff', txt: 'נ״צ', p: 'band' },
  'hapoel-rishon': { a: '#e23b3b', b: '#ffffff', txt: 'ה״ר', p: 'stripes' },
  'maccabi-rishon': { a: '#ffd23f', b: '#1d4fbf', txt: 'מ״ר', p: 'star' },
  'hapoel-ashdod': { a: '#c81e2a', b: '#161616', txt: 'ה״א', p: 'stripes' },
  holon: { a: '#2f6fe0', b: '#ffffff', txt: 'ח״ל', p: 'band' },
  'kfar-saba': { a: '#2fa84f', b: '#ffffff', txt: 'כ״ס', p: 'stripes' },
  rehovot: { a: '#56b4f0', b: '#0b2a5a', txt: 'מ״ח', p: 'star' },
};

// group 'league': clubs from the kids' league; 'nation': national teams
export const CLUBS = [
  { id: 'nes-ziona', he: 'א.כ. נס ציונה', short: 'נס ציונה', kit: kit('#ff7a1a', '#ffffff', '#ffffff', '#3f8ee6', '#0c2257') }, // "the Oranges"
  { id: 'hapoel-rishon', he: 'הפועל ראשון לציון', short: 'הפועל ראשל"צ', kit: kit('#e23b3b', '#ffffff', '#ffffff', '#3ccf74', '#0e3b22') },
  { id: 'maccabi-rishon', he: 'מכבי ראשון לציון', short: 'מכבי ראשל"צ', kit: kit('#ffd23f', '#1d4fbf', '#1d4fbf', '#e8453c', '#4a0f0f') },
  { id: 'hapoel-ashdod', he: 'הפועל אשדוד', short: 'הפועל אשדוד', kit: kit('#c81e2a', '#161616', '#161616', '#3f8ee6', '#0c2257') },
  { id: 'holon', he: 'הכדוריד חולון', short: 'חולון', kit: kit('#2f6fe0', '#ffffff', '#ffffff', '#ff9f1c', '#5a2e00') },
  { id: 'kfar-saba', he: 'הפועל כפר סבא', short: 'כפר סבא', kit: kit('#2fa84f', '#ffffff', '#0e3b22', '#8b5cf6', '#24124f') },
  { id: 'rehovot', he: 'מכבי רחובות', short: 'רחובות', kit: kit('#56b4f0', '#0b2a5a', '#0b2a5a', '#ffd23f', '#4a3a00') },
].map((c) => ({ ...c, group: 'league', kit: { ...c.kit, crest: CRESTS[c.id] } }));

export const NATIONS = [
  { id: 'israel', he: 'ישראל', short: 'ישראל', kit: kit('#ffffff', '#1d4fbf', '#1d4fbf', '#ffd23f', '#4a3a00') },
  { id: 'spain', he: 'ספרד', short: 'ספרד', kit: kit('#d01f2e', '#ffcc00', '#1b2a6b', '#3ccf74', '#0e3b22') },
  { id: 'france', he: 'צרפת', short: 'צרפת', kit: kit('#1f3c99', '#ffffff', '#1f3c99', '#ff9f1c', '#5a2e00') },
  { id: 'germany', he: 'גרמניה', short: 'גרמניה', kit: kit('#1e1e1e', '#ffcc00', '#1e1e1e', '#3ccf74', '#0e3b22') },
  { id: 'denmark', he: 'דנמרק', short: 'דנמרק', kit: kit('#c8102e', '#ffffff', '#ffffff', '#ffd23f', '#4a3a00') },
  { id: 'sweden', he: 'שוודיה', short: 'שוודיה', kit: kit('#ffcd00', '#005baa', '#005baa', '#e8453c', '#4a0f0f') },
  { id: 'norway', he: 'נורווגיה', short: 'נורווגיה', kit: kit('#ba0c2f', '#00205b', '#00205b', '#3ccf74', '#0e3b22') },
  { id: 'croatia', he: 'קרואטיה', short: 'קרואטיה', kit: kit('#e2231a', '#ffffff', '#1b2a6b', '#3f8ee6', '#0c2257') },
  { id: 'brazil', he: 'ברזיל', short: 'ברזיל', kit: kit('#ffdf00', '#009c3b', '#002776', '#3f8ee6', '#0c2257') },
  { id: 'iceland', he: 'איסלנד', short: 'איסלנד', kit: kit('#02529c', '#dc1e35', '#02529c', '#ffd23f', '#4a3a00') },
  { id: 'egypt', he: 'מצרים', short: 'מצרים', kit: kit('#ce1126', '#1e1e1e', '#1e1e1e', '#3ccf74', '#0e3b22') },
].map((c) => ({ ...c, group: 'nation', kit: { ...c.kit, badge: c.id } })); // national teams wear their flag

// The cartoon squads: הצרעות is the default team (first in the kids' league tab); הצפעונים is
// always their opponent and is not picked as your own team.
export const HORNETS = { id: 'hornets', he: SQUADS[0].he, short: SQUADS[0].short, kit: { ...SQUADS[0].kit }, group: 'league', toon: true };
export const VIPERS = { id: 'vipers', he: SQUADS[1].he, short: SQUADS[1].short, kit: { ...SQUADS[1].kit }, group: 'toon', toon: true };

export const ALL_TEAMS = [HORNETS, ...CLUBS, ...NATIONS];
export const teamById = (id) => [...ALL_TEAMS, VIPERS].find((c) => c.id === id) || null;
export const clubById = teamById;
// Who a team can play against: הצרעות always meet הצפעונים; a club meets another club, a nation another nation.
export const opponentsOf = (id) => (id === 'hornets' ? [VIPERS] : ALL_TEAMS.filter((t) => !t.toon && t.id !== id && t.group === (teamById(id) || HORNETS).group));

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function looksAlike(a, b) {
  const [x, y] = [rgb(a), rgb(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 130;
}
const light = (h) => { const [r, g, b] = rgb(h); return r * 0.3 + g * 0.59 + b * 0.11 > 200; };
// Away kit: white in the club's colours (or, for a white home shirt, a shirt in its trim colour).
export function awayKit(k) {
  if (light(k.shirt)) return { ...k, shirt: k.trim, trim: '#ffffff', shorts: '#ffffff', cape: '#ffffff', glow: k.trim };
  return { ...k, shirt: '#f4f6fb', trim: k.shirt, shorts: k.shirt, cape: k.shirt, glow: k.shirt };
}
// The two teams' names and kits for a match (mine / rival: teams from this file).
export function matchKits(defaults, mine, rival) {
  const as = (t, d) => ({ ...d, ...t.kit, he: t.he, to: 'ל' + t.he, abbr: t.short, club: t.id });
  const t0 = as(mine || HORNETS, defaults[0]);
  let t1 = as(rival || VIPERS, defaults[1]);
  if (looksAlike(t0.shirt, t1.shirt)) t1 = awayKit(t1);
  if (looksAlike(t0.shirt, t1.gk)) t1.gk = looksAlike(t0.shirt, '#8b5cf6') ? '#3ccf74' : '#8b5cf6';
  if (looksAlike(t1.shirt, t0.gk)) t0.gk = looksAlike(t1.shirt, '#3ccf74') ? '#8b5cf6' : '#3ccf74';
  return [t0, t1];
}
