// The pass magnet: a kid holding the stick in random directions while passing still gets most
// passes to a teammate (the ball bends toward the receiver and is hard for the computer to cut off).
import { Game } from '../js/game.js';

let ok = 0, lost = 0;
for (let r = 0; r < 4; r++) {
  const g = new Game({ halfLen: 240, human: 0, difficulty: 'normal', rules: 'arcade' });
  g.input = { mx: 0, my: 0 };
  let pending = false, steps = 0, held = 0, ang = 0, angT = 0;
  while (g.state !== 'fulltime' && steps < 60 * 600) {
    if (g.state === 'halftime') g.startSecondHalf();
    if ((angT -= 1 / 60) <= 0) { ang = Math.random() * 6.28; angT = 0.6 + Math.random(); }
    g.input.mx = Math.cos(ang); g.input.my = Math.sin(ang);
    const c = g.controlled;
    if (c && g.ball.owner === c && !c.gk) { if ((held += 1 / 60) > 0.6) { g.input.aPress = true; held = 0; } } else held = 0;
    g.step(1 / 60); steps++; g.input.aPress = false;
    for (const e of g.events) if (e.type === 'pass' && e.team === 0) { if (pending) lost++; pending = true; }
    g.events.length = 0;
    if (pending && g.ball.owner) { if (g.ball.owner.team === 0) ok++; else lost++; pending = false; }
    if (pending && g.state !== 'play') { lost++; pending = false; }
  }
}
const rate = ok / Math.max(1, ok + lost);
const pass = ok + lost >= 30 && rate >= 0.75;
console.log(`${pass ? 'PASS' : 'FAIL'}  your passes reach a teammate while the stick wanders  (${ok}/${ok + lost}, ${(100 * rate).toFixed(0)}%)`);
process.exit(pass ? 0 : 1);
