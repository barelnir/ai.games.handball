// Eitan's power, end to end in the simulation: POWER -> pass to Eitan -> close-up -> fireball -> unstoppable shot.
import { Game } from '../js/game.js';
import { goalDist } from '../js/court.js';

let fails = 0;
const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`); if (!ok) fails++; };

// The pass to Eitan can be intercepted (that's fair play), so keep going until 8 powers have fired.
let goals = 0, tries = 0, runs = 0;
for (let run = 0; run < 60 && tries < 8; run++) {
  runs++;
  const g = new Game({ halfLen: 600, human: 0, difficulty: 'hard' });
  const inp = { mx: 0, my: 0 }; g.input = inp;
  const eitan = g.teams[0].players.find((p) => p.hero.name === 'Eitan');
  // play until a Hornet who isn't Eitan has the ball
  let n = 0;
  while (!(g.state === 'play' && g.ball.owner && g.ball.owner.team === 0 && g.ball.owner !== eitan) && n++ < 60 * 120) g.step(1 / 60);
  g.teams[0].energy = 100;
  inp.pPress = true;
  g.step(1 / 60);
  if (run === 0) check(g.ball.passTo === eitan && g.pendingPower === eitan, 'POWER makes the carrier pass to Eitan');
  n = 0;
  while (!g.ball.fire && g.pendingPower && n++ < 300) g.step(1 / 60);
  if (!g.ball.fire) continue; // pass intercepted: no power this time
  tries++;
  if (run === 0 || tries === 1) {
    check(g.ball.owner === eitan && g.splash > 1.5, 'Eitan catches it and the close-up starts');
    check(g.teams[0].energy < 10 && eitan.effects.length === 1, 'energy is spent, Eitan is powered up');
    const c0 = g.clock; for (let i = 0; i < 60; i++) g.step(1 / 60);
    check(g.clock === c0, 'match is frozen during the close-up');
  }
  while (g.splash > 0) g.step(1 / 60);
  // put Eitan 8 m out in front of goal and shoot
  const t = g.teams[0], ax = t.defX === 0 ? 40 : 0, s = ax === 40 ? -1 : 1;
  eitan.x = ax + s * 8; eitan.y = 10; eitan.vx = eitan.vy = 0;
  inp.bPress = true; inp.bDown = false;
  g.step(1 / 60);
  if (tries === 1) check(g.ball.state === 'shot' && g.ball.fire, 'the shot is a fireball');
  const before = g.teams[0].score;
  n = 0;
  while (g.ball.state === 'shot' && n++ < 200) g.step(1 / 60);
  if (g.teams[0].score > before) goals++;
}
check(tries >= 8, 'power fires once Eitan gets the ball', `${tries} powers in ${runs} tries`);
check(goals >= tries * 0.7, 'fireball shots score (no blocks, keeper frozen)', `${goals}/${tries} goals vs hard keeper`);
process.exit(fails ? 1 : 0);
