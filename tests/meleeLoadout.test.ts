import { describe, it, expect } from 'vitest';
import { CombatSystem } from '../src/systems/CombatSystem';
import { MapManager } from '../src/systems/MapManager';
import { NoiseSystem } from '../src/systems/NoiseSystem';
import { Player } from '../src/entities/Player';
import { Zombie } from '../src/entities/Zombie';
import { ZOMBIE_REGISTRY } from '../src/config/zombies';
import { DEFAULT_LOADOUTS } from '../src/ui/LoadoutStorage';

describe('melee loadout slot', () => {
  it('quick melee swings without swapping off the primary', () => {
    const combat = new CombatSystem(new MapManager(), new NoiseSystem());
    const p = new Player(1, 200, 360, 100, DEFAULT_LOADOUTS[0]);
    expect(p.activeSlot).toBe('primary');
    const z = new Zombie(230, 360, Math.PI, 'lurker');
    p.lastMeleeSwingTime = -1e9;
    combat.swingMelee(p, [z], []);
    expect(p.activeSlot).toBe('primary');
    expect(z.health).toBeLessThan(ZOMBIE_REGISTRY.lurker.maxHealth);
  });
});
