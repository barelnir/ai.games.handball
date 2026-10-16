// Headless AI-vs-AI matches: checks the simulation never breaks and that the rules produce
// a believable handball game (goals, saves, set pieces). Run: npm test
import { Game } from '../js/game.js';

const runs = Number(process.argv[2]) || 3;
let failed = false;
for (let r = 0; r < runs; r++) {
  const g = new Game({ halfLen: 300, human: -1, difficulty: 'normal', rules: 'full' });
  const counts = {};
  let steps = 0;
  while (g.state !== 'fulltime' && steps < 60 * 700) {
    if (g.state === 'halftime') g.startSecondHalf();
    g.step(1 / 60);
    steps++;
    for (const e of g.events) counts[e.type] = (counts[e.type] || 0) + 1;
    g.events.length = 0;
    for (const p of g.all) if (!Number.isFinite(p.x + p.y)) throw new Error('player position became NaN');
    if (!Number.isFinite(g.ball.x + g.ball.y + g.ball.z)) throw new Error('ball position became NaN');
  }
  const goals = g.teams[0].score + g.teams[1].score;
  const ok = g.state === 'fulltime' && goals >= 4 && (counts.save || 0) > 0;
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} match ${r + 1}: ${g.teams[0].score}-${g.teams[1].score}`, JSON.stringify(counts));
}
process.exit(failed ? 1 : 0);
