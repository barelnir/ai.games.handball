// Special powers – the extension slot for later.
//
// The game already asks this module for a multiplier every time it computes something a power
// could change (run speed, shot speed, accuracy, catch radius, goalkeeper reach, steal chance).
// Today every multiplier is 1. To add a power later:
//   1. add an entry to POWERS below,
//   2. flip POWERS_ENABLED to true,
//   3. (optional) give it visuals in figures.js by checking player.effects.
//
// Each team fills an energy meter (time on court, goals, saves, steals). Activating a power
// spends the meter and applies the power's `mods` to the chosen player for `duration` seconds.

export const POWERS_ENABLED = false;

export const POWERS = {
  rocketShot: {
    name: 'Rocket Shot',
    about: 'Next shot flies 40% faster and straighter.',
    cost: 100,
    duration: 6,
    target: 'carrier',
    mods: { shotSpeed: 1.4, shotError: 0.5 },
  },
  turbo: {
    name: 'Turbo Legs',
    about: 'Sprint 35% faster for 4 seconds.',
    cost: 60,
    duration: 4,
    target: 'controlled',
    mods: { speed: 1.35 },
  },
  stickyHands: {
    name: 'Sticky Hands',
    about: 'Bigger catch radius and very hard to steal from.',
    cost: 70,
    duration: 6,
    target: 'controlled',
    mods: { catchRadius: 1.5, stealResist: 3 },
  },
  keeperWall: {
    name: 'Keeper Wall',
    about: 'Your goalkeeper reaches 60% further for 5 seconds.',
    cost: 80,
    duration: 5,
    target: 'goalkeeper',
    mods: { gkReach: 1.6 },
  },
};

export const ENERGY_MAX = 100;
const GAIN = { second: 0.6, goal: 18, save: 14, steal: 12 };

export class PowerSystem {
  constructor(game) {
    this.game = game;
    this.enabled = POWERS_ENABLED;
    this.selected = Object.keys(POWERS)[0];
  }

  // Product of all active effects on this player for a modifier key (1 when none).
  mod(player, key) {
    let m = 1;
    if (!player || !player.effects) return m;
    for (const e of player.effects) {
      const v = POWERS[e.id] && POWERS[e.id].mods[key];
      if (v) m *= v;
    }
    return m;
  }

  gain(team, what) {
    team.energy = Math.min(ENERGY_MAX, team.energy + (GAIN[what] || 0));
  }

  update(dt) {
    for (const t of this.game.teams) {
      t.energy = Math.min(ENERGY_MAX, t.energy + GAIN.second * dt);
      for (const p of t.players) {
        if (!p.effects.length) continue;
        for (const e of p.effects) e.t -= dt;
        p.effects = p.effects.filter((e) => e.t > 0);
      }
    }
  }

  // Returns true when the power fired. While POWERS_ENABLED is false this is a no-op.
  activate(teamIdx, id = this.selected) {
    if (!this.enabled) return false;
    const g = this.game, team = g.teams[teamIdx], def = POWERS[id];
    if (!def || team.energy < def.cost) return false;
    let target = null;
    if (def.target === 'goalkeeper') target = team.players.find((p) => p.gk);
    else if (def.target === 'carrier') target = g.ball.owner && g.ball.owner.team === teamIdx ? g.ball.owner : null;
    else target = g.controlled && g.controlled.team === teamIdx ? g.controlled : null;
    if (!target) return false;
    team.energy -= def.cost;
    target.effects.push({ id, t: def.duration });
    g.emit({ type: 'power', id, team: teamIdx });
    return true;
  }
}
