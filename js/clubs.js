// Clubs from the Israeli kids' handball leagues: names and shirt colours only (no club badges).
// You can play as one of them, and pick one as the opponent. When both teams' shirts look alike,
// the opponent wears its white away kit so the two teams are easy to tell apart.

const kit = (shirt, trim, shorts, gk, gkTrim) => ({ shirt, trim, shorts, cape: trim, shoe: '#ffffff', gk, gkTrim, mask: '#1b2a4a', glow: shirt });

export const CLUBS = [
  { id: 'hapoel-rishon', he: 'הפועל ראשון לציון', short: 'הפועל ראשל"צ', kit: kit('#e23b3b', '#ffffff', '#ffffff', '#3ccf74', '#0e3b22') },
  { id: 'maccabi-rishon', he: 'מכבי ראשון לציון', short: 'מכבי ראשל"צ', kit: kit('#ffd23f', '#1d4fbf', '#1d4fbf', '#e8453c', '#4a0f0f') },
  { id: 'hapoel-ashdod', he: 'הפועל אשדוד', short: 'הפועל אשדוד', kit: kit('#c81e2a', '#161616', '#161616', '#3f8ee6', '#0c2257') },
  { id: 'holon', he: 'הכדוריד חולון', short: 'חולון', kit: kit('#2f6fe0', '#ffffff', '#ffffff', '#ff9f1c', '#5a2e00') },
  { id: 'kfar-saba', he: 'הפועל כפר סבא', short: 'כפר סבא', kit: kit('#2fa84f', '#ffffff', '#0e3b22', '#8b5cf6', '#24124f') },
  { id: 'rehovot', he: 'מכבי רחובות', short: 'רחובות', kit: kit('#56b4f0', '#0b2a5a', '#0b2a5a', '#ffd23f', '#4a3a00') },
];
export const clubById = (id) => CLUBS.find((c) => c.id === id) || null;

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function looksAlike(a, b) {
  const [x, y] = [rgb(a), rgb(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 130;
}
// White away kit in the club's colours.
export function awayKit(k) {
  return { ...k, shirt: '#f4f6fb', trim: k.shirt, shorts: k.shirt, cape: k.shirt, glow: k.shirt };
}
// The two teams' names and kits for a match. mine/rival: club or null (null = the kid's team / the Vipers).
export function matchKits(defaults, mine, rival) {
  const t0 = mine ? { ...defaults[0], ...mine.kit, he: mine.he, to: 'ל' + mine.he, abbr: mine.short, club: mine.id } : { ...defaults[0] };
  let t1 = rival ? { ...defaults[1], ...rival.kit, he: rival.he, to: 'ל' + rival.he, abbr: rival.short, club: rival.id } : { ...defaults[1] };
  if (looksAlike(t0.shirt, t1.shirt)) t1 = awayKit(t1);
  if (looksAlike(t0.shirt, t1.gk)) t1.gk = looksAlike(t0.shirt, '#8b5cf6') ? '#3ccf74' : '#8b5cf6';
  if (looksAlike(t1.shirt, t0.gk)) t0.gk = looksAlike(t1.shirt, '#3ccf74') ? '#8b5cf6' : '#3ccf74';
  return [t0, t1];
}
