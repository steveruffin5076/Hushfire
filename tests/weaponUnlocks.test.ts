import { describe, it, expect } from 'vitest';
import { clampLoadoutToUnlocks, isGearUnlocked, isMuzzleUnlocked, isWeaponUnlocked } from '../src/ui/WeaponUnlocks';
import { WEAPON_REGISTRY } from '../src/config/weapons';
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

  it('lists expanded SMG, rifle, and pistol roster in registry', () => {
    expect(WEAPON_REGISTRY.mp5sd?.type).toBe('primary');
    expect(WEAPON_REGISTRY.ak12?.type).toBe('primary');
    expect(WEAPON_REGISTRY.p226?.type).toBe('secondary');
  });

  it('tactical suppressor is always unlocked', () => {
    expect(isMuzzleUnlocked('tactical_suppressor', defaultPlayerProfile())).toBe(true);
    expect(isMuzzleUnlocked('monolithic_suppressor', defaultPlayerProfile())).toBe(false);
  });

  it('gear unlocks follow profile milestones', () => {
    const p = defaultPlayerProfile();
    expect(isGearUnlocked('nvg', p)).toBe(false);
    p.totalWins = 1;
    expect(isGearUnlocked('nvg', p)).toBe(true);
    expect(isGearUnlocked('flare_pack', p)).toBe(false);
    p.totalWins = 2;
    p.totalKillsBest = 5;
    expect(isGearUnlocked('extra_ammo', p)).toBe(true);
    expect(isGearUnlocked('flare_pack', p)).toBe(true);
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
