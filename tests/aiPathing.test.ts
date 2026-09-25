import { describe, it, expect, vi } from 'vitest';
import { AISystem } from '../src/systems/AISystem';
import { MapManager } from '../src/systems/MapManager';
import { Zombie } from '../src/entities/Zombie';
import { Player, WeaponLoadout } from '../src/entities/Player';

const loadout: WeaponLoadout = {
  primaryWeapon: 'mpx',
  secondaryWeapon: 'knife',
  primaryMuzzle: 'none',
  secondaryMuzzle: 'none',
  primaryRail: 'none',
  secondaryRail: 'none',
  primaryAmmoType: 'standard',
  secondaryAmmoType: 'standard'
};

describe('AISystem pathing', () => {
  it('holds position when blocked with no A* route instead of grinding into the wall', () => {
    const map = new MapManager();
    const zombie = new Zombie(500, 360, 0, 'lurker');
    zombie.state = 'ENRAGED';
    const player = new Player(1, 700, 360, 100, loadout);

    vi.spyOn(map, 'hasLineOfSight').mockReturnValue(false);
    vi.spyOn(map.nav, 'findPath').mockReturnValue([]);

    const startX = zombie.x;
    const startY = zombie.y;
    const ai = new AISystem();
    for (let i = 0; i < 90; i++) ai.update(1 / 60, [zombie], [player], map);

    expect(zombie.x).toBe(startX);
    expect(zombie.y).toBe(startY);
  });
});
