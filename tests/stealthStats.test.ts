import { describe, it, expect } from 'vitest';
import { stealthRating } from '../src/ui/StealthRating';
import { CombatSystem } from '../src/systems/CombatSystem';
import { MapManager } from '../src/systems/MapManager';
import { NoiseSystem } from '../src/systems/NoiseSystem';
import { Player, WeaponLoadout } from '../src/entities/Player';
import { Zombie } from '../src/entities/Zombie';

describe('stealthRating', () => {
  it('grades by zombies alerted', () => {
    expect(stealthRating(0)).toBe('GHOST');
    expect(stealthRating(1)).toBe('SHADOW');
    expect(stealthRating(3)).toBe('SHADOW');
    expect(stealthRating(4)).toBe('OPERATOR');
    expect(stealthRating(8)).toBe('OPERATOR');
    expect(stealthRating(9)).toBe('LOUD');
  });
});

describe('silent kills', () => {
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
  const stab = (z: Zombie) => {
    const p = new Player(1, 150, 360, 100, loadout);
    p.activeSlot = 'secondary';
    p.angle = 0;
    p.lastShotTime = -1e9;
    new CombatSystem(new MapManager(), new NoiseSystem()).fire(p, [z], [], []);
    return p;
  };

  it('counts a kill on an unaware zombie', () => {
    const z = new Zombie(180, 360, 0, 'lurker'); // back turned: backstab kill
    const p = stab(z);
    expect(z.alive).toBe(false);
    expect(p.killCount).toBe(1);
    expect(p.silentKills).toBe(1);
  });

  it('does not count a kill on a zombie that was already enraged', () => {
    const z = new Zombie(180, 360, 0, 'lurker');
    z.alert('ENRAGED', { x: 150, y: 360 });
    const p = stab(z);
    expect(z.alive).toBe(false);
    expect(p.killCount).toBe(1);
    expect(p.silentKills).toBe(0);
  });
});
