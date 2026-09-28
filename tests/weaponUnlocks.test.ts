import { describe, it, expect } from 'vitest';
import { clampLoadoutToUnlocks, isWeaponUnlocked } from '../src/ui/WeaponUnlocks';
import { defaultPlayerProfile } from '../src/ui/PlayerProfile';
import { DEFAULT_LOADOUTS } from '../src/ui/LoadoutStorage';

describe('weapon unlocks', () => {
  it('starter kit is always available', () => {
    expect(isWeaponUnlocked('mpx', defaultPlayerProfile())).toBe(true);
    expect(isWeaponUnlocked('glock17', defaultPlayerProfile())).toBe(true);
  });

  it('crossbow unlocks after a win', () => {
    const p = defaultPlayerProfile();
    expect(isWeaponUnlocked('crossbow', p)).toBe(false);
    p.totalWins = 1;
    expect(isWeaponUnlocked('crossbow', p)).toBe(true);
  });

  it('clampLoadoutToUnlocks resets locked weapons for a fresh profile', () => {
    const locked = {
      ...DEFAULT_LOADOUTS[0],
      primaryWeapon: 'shotgun',
      secondaryWeapon: 'revolver'
    };
    const clamped = clampLoadoutToUnlocks(locked, defaultPlayerProfile());
    expect(clamped.primaryWeapon).toBe('mpx');
    expect(clamped.secondaryWeapon).toBe('glock17');
  });
});
