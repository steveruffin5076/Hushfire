import { describe, it, expect } from 'vitest';
import { isWeaponUnlocked } from '../src/ui/WeaponUnlocks';
import { defaultPlayerProfile } from '../src/ui/PlayerProfile';

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
});
