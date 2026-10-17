// Picking the players: your line-up is used, and the computer's team never shares a hero with yours.
import { Game } from '../js/game.js';
import { SQUADS } from '../js/toon.js';
import { PROFILES, kidHero } from '../js/heroes.js';

let failed = false;
const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`); if (!ok) failed = true; };
const byName = (n) => [...SQUADS[0].heroes, ...SQUADS[1].heroes].find((h) => h.name === n);
const kid = (id) => kidHero(PROFILES.find((p) => p.id === id));

const cases = [
  { GK: byName('Coil'), LW: byName('Hiss'), LB: kid('emma'), RB: kid('eyal'), RW: byName('Slink'), PV: byName('Python') },
  { GK: byName('Hive'), LW: byName('Fang'), LB: byName('Rattle'), RB: byName('Venom'), RW: byName('Dash'), PV: byName('Honey Tank') },
];
for (const [i, lineup] of cases.entries()) {
  for (const rivalHero of [null, 'eyal']) {
    const g = new Game({ human: 0, hero: 'eitan', power: 'fire', lineup, rivalHero: i === 0 && rivalHero === 'eyal' ? null : rivalHero });
    const mine = g.teams[0].players.map((p) => p.hero.name), theirs = g.teams[1].players.map((p) => p.hero.name);
    check(Object.entries(lineup).every(([r, h]) => g.teams[0].players.find((p) => p.role === r).hero === h), `line-up ${i + 1} is used`);
    check(g.teams[0].players.find((p) => p.role === 'CB').hero.name === 'Eitan', `line-up ${i + 1}: your kid stays centre back`);
    check(!theirs.some((n) => mine.includes(n)) && new Set(theirs).size === 7, `line-up ${i + 1}: no hero on both teams (rival ${rivalHero || 'Venom'})`, theirs.join(','));
    // the match still plays
    for (let k = 0; k < 60 * 20; k++) { g.step(1 / 60); g.events.length = 0; }
    check(Number.isFinite(g.ball.x) && g.time > 19, `line-up ${i + 1}: the match runs`);
  }
}
process.exit(failed ? 1 : 0);
