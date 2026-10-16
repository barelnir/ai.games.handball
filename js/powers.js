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

export const POWERS_ENABLED = true;

export const POWERS = {
  // Eitan's power: the ball turns into a fireball. A shot with it can't be blocked and the keeper freezes.
  lightning: {
    name: 'Lightning Eitan',
    about: 'Fireball shot: unblockable, the keeper freezes.',
    hero: 'Eitan',
    cost: 100,
    duration: 10,
    mods: { shotSpeed: 1.35, shotError: 0.6 },
  },
};

export const ENERGY_MAX = 100;
const GAIN = { second: 1.2, goal: 18, save: 14, steal: 12 };

export class PowerSystem {
  constructor(game) {
    this.game = game;
    this.enabled = POWERS_ENABLED;
    this.selected = 'lightning';
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

  // Called when the player presses POWER. Returns true, or the reason it can't fire yet:
  // 'energy' (meter not full), 'ball' (team doesn't have the ball), 'missing' (hero not on court).
  activate(teamIdx, id = this.selected) {
    if (!this.enabled) return 'off';
    const g = this.game, team = g.teams[teamIdx], def = POWERS[id], b = g.ball;
    if (g.pendingPower || b.fire) return true;
    if (team.energy < def.cost) return 'energy';
    const hero = team.players.find((p) => p.active && p.hero && p.hero.name === def.hero);
    if (!hero) return 'missing';
    if (b.owner === hero) { this.start(hero, id); return true; }
    if (b.owner && b.owner.team === teamIdx && g.state === 'play') {
      g.pass(b.owner, hero);            // the carrier passes to the hero; the power starts on the catch
      if (b.passTo === hero) g.pendingPower = hero;
      return true;
    }
    return 'ball';
  }

  start(hero, id = this.selected) {
    const g = this.game, def = POWERS[id], team = g.teams[hero.team];
    team.energy = Math.max(0, team.energy - def.cost);
    hero.effects = hero.effects.filter((e) => e.id !== id);
    hero.effects.push({ id, t: def.duration });
    g.pendingPower = null;
    g.ball.fire = true;
    g.fireT = def.duration;
    g.splash = 1.8;
    g.say(def.name.toUpperCase() + '!', 'Fireball ready!', 1.9, 'power');
    g.emit({ type: 'power', id, team: hero.team });
  }
}
