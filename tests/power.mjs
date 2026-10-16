// Custom hero powers, end to end in the simulation, for every template:
// POWER -> pass to the hero -> close-up -> powered ball -> powered shot.
import { Game } from '../js/game.js';
import { TEMPLATE_LIST } from '../js/heroes.js';

let fails = 0;
const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`); if (!ok) fails++; };

for (const tp of TEMPLATE_LIST) {
  let goals = 0, tries = 0, runs = 0, first = true;
  // the pass to the hero can be intercepted (fair play), so keep going until 6 powers have fired
  for (let run = 0; run < 60 && tries < 6; run++) {
    runs++;
    const g = new Game({ halfLen: 600, human: 0, difficulty: 'hard', power: tp.key, rivalPowers: false });
    const inp = { mx: 0, my: 0 }; g.input = inp;
    const hero = g.teams[0].players.find((p) => p.hero.custom);
    let n = 0;
    while (!(g.state === 'play' && g.ball.owner && g.ball.owner.team === 0 && g.ball.owner !== hero) && n++ < 60 * 120) g.step(1 / 60);
    g.teams[0].energy = 100;
    inp.pPress = true;
    g.step(1 / 60);
    // either the pass is on its way, or the hero was close enough to catch it already
    if (first) check((g.ball.passTo === hero && g.pendingPower === hero) || (g.ball.owner === hero && g.ball.power), `${tp.label}: POWER makes the carrier pass to the hero`);
    n = 0;
    while (!g.ball.power && g.pendingPower && n++ < 300) g.step(1 / 60);
    if (!g.ball.power) { first = false; continue; }
    tries++;
    if (tries === 1) {
      check(g.ball.owner === hero && g.splash > 1.5 && g.ball.power === tp.ball, `${tp.label}: close-up starts, ball becomes "${tp.ball}"`);
      const c0 = g.clock; for (let i = 0; i < 60; i++) g.step(1 / 60);
      check(g.clock === c0, `${tp.label}: match frozen during the close-up`);
      if (tp.fx.teamSpeed) check(g.teams[0].players.filter((p) => p.effects.some((e) => e.id === 'rally')).length >= 5, `${tp.label}: the whole team gets the speed boost`);
    }
    while (g.splash > 0) g.step(1 / 60);
    const ax = g.teams[0].defX === 0 ? 40 : 0, s = ax === 40 ? -1 : 1;
    hero.x = ax + s * 8; hero.y = 10; hero.vx = hero.vy = 0;
    inp.bPress = true; inp.bDown = false;
    g.step(1 / 60);
    if (tries === 1) check(g.ball.state === 'shot' && g.ball.power === tp.ball, `${tp.label}: the shot is powered`);
    const before = g.teams[0].score;
    n = 0;
    while (g.ball.state === 'shot' && n++ < 200) g.step(1 / 60);
    if (g.teams[0].score > before) goals++;
    first = false;
  }
  check(tries >= 6, `${tp.label}: power fires once the hero gets the ball`, `${tries} in ${runs} tries`);
  const need = tp.fx.freezeKeeper || tp.fx.unblockable ? 0.5 : tp.fx.keeperSave ? 0.34 : 0;
  check(goals >= tries * need, `${tp.label}: powered shots score`, `${goals}/${tries} vs hard keeper`);
}

// the computer uses its own power too
{
  let fired = 0;
  for (let run = 0; run < 3 && !fired; run++) {
    const g = new Game({ halfLen: 300, human: 0, rivalPower: 'fire' });
    g.input = { mx: 0, my: 0 };
    g.teams[0].players.forEach((p) => { if (!p.gk) p.active = false; }); // empty court: the Vipers attack freely
    for (let i = 0; i < 60 * 90 && !fired; i++) {
      g.step(1 / 60);
      for (const e of g.events) if (e.type === 'power' && e.team === 1) fired++;
      g.events.length = 0;
    }
  }
  check(fired > 0, 'the computer fires its own power when it attacks');
}
process.exit(fails ? 1 : 0);
