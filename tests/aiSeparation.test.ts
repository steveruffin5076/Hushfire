import { describe, it, expect } from 'vitest';
import { AISystem } from '../src/systems/AISystem';
import { Zombie } from '../src/entities/Zombie';
import { MapManager } from '../src/systems/MapManager';
import { Player } from '../src/entities/Player';
import { DEFAULT_LOADOUTS } from '../src/ui/LoadoutStorage';

describe('zombie separation', () => {
  it('pushes overlapping enraged zombies apart', () => {
    const map = new MapManager();
    const z1 = new Zombie(400, 360, 0, 'lurker');
    const z2 = new Zombie(408, 360, 0, 'lurker');
    z1.alert('ENRAGED', { x: 600, y: 360 });
    z2.alert('ENRAGED', { x: 600, y: 360 });
    const before = Math.hypot(z2.x - z1.x, z2.y - z1.y);

    const player = new Player(1, 600, 360, 100, DEFAULT_LOADOUTS[0]);
    new AISystem().update(1 / 60, [z1, z2], [player], map);

    const after = Math.hypot(z2.x - z1.x, z2.y - z1.y);
    expect(after).toBeGreaterThanOrEqual(before);
    expect(after).toBeGreaterThanOrEqual(z1.radius + z2.radius - 1);
  });
});
