import { describe, it, expect } from 'vitest';
import { Player, WeaponLoadout } from '../src/entities/Player';

const loadout = (primary: string, secondary: string): WeaponLoadout => ({
  primaryWeapon: primary,
  secondaryWeapon: secondary,
  primaryMuzzle: 'none',
  secondaryMuzzle: 'none',
  primaryRail: 'none',
  secondaryRail: 'none',
  primaryAmmoType: 'standard',
  secondaryAmmoType: 'standard'
});

describe('crossbow warm-up', () => {
  it('can fire on the first frame after deploy even when performance.now() is still small', () => {
    const p = new Player(1, 100, 100, 100, loadout('crossbow', 'knife'));
    expect(p.canFire()).toBe(true);
  });
});
