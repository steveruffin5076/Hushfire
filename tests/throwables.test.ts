import { describe, it, expect } from 'vitest';
import { Player, WeaponLoadout } from '../src/entities/Player';
import { clampThrowTarget } from '../src/systems/ThrowableSystem';
import { THROW_MAX_RANGE_PX, GRENADE_POUCH_STARTING } from '../src/config/throwables';
import { SECTORS } from '../src/config/sectors';

const grenadeLoadout = (): WeaponLoadout => ({
  primaryWeapon: 'mpx',
  secondaryWeapon: 'glock17',
  meleeWeapon: 'knife',
  primaryMuzzle: 'none',
  secondaryMuzzle: 'none',
  primaryRail: 'none',
  secondaryRail: 'none',
  primaryAmmoType: 'standard',
  secondaryAmmoType: 'standard',
  operativeGear: 'grenade_pouch'
});

describe('throwables', () => {
  it('clamps mouse aim to max throw range', () => {
    const c = clampThrowTarget(0, 0, 1000, 0);
    expect(c.x).toBeCloseTo(THROW_MAX_RANGE_PX);
    expect(c.y).toBeCloseTo(0);
  });

  it('issues starting pouch counts at deploy', () => {
    const spawn = SECTORS[0].playerSpawns[0];
    const p = new Player(1, spawn.x, spawn.y, 100, grenadeLoadout());
    p.applyDeployGearBonus();
    expect(p.throwableCounts).toEqual(GRENADE_POUCH_STARTING);
    expect(p.canThrow('he')).toBe(true);
    p.consumeThrowable('he');
    expect(p.throwableCounts.he).toBe(0);
    expect(p.canThrow('he')).toBe(false);
  });

  it('cycles to next type with ammo', () => {
    const spawn = SECTORS[0].playerSpawns[0];
    const p = new Player(1, spawn.x, spawn.y, 100, grenadeLoadout());
    p.applyDeployGearBonus();
    p.selectedThrowable = 'he';
    p.throwableCounts.he = 0;
    p.cycleThrowable();
    expect(p.selectedThrowable).toBe('incendiary');
  });
});
