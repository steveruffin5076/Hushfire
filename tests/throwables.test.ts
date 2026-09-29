import { describe, it, expect } from 'vitest';
import { Player, WeaponLoadout } from '../src/entities/Player';
import { clampThrowTarget } from '../src/systems/ThrowableSystem';
import { THROW_MAX_RANGE_PX, GRENADE_POUCH_STARTING } from '../src/config/throwables';
import {
  buildThrowableCountsFromLoadout,
  getGrenadePouchSelection,
  throwableCarryFromSelection,
  normalizeThrowableCarry
} from '../src/config/throwableCarry';
import { defaultPlayerProfile } from '../src/ui/PlayerProfile';
import { isThrowableUnlocked } from '../src/ui/WeaponUnlocks';
import { SECTORS } from '../src/config/sectors';

const baseLoadout = (): WeaponLoadout => ({
  primaryWeapon: 'mpx',
  secondaryWeapon: 'glock17',
  meleeWeapon: 'knife',
  primaryMuzzle: 'none',
  secondaryMuzzle: 'none',
  primaryRail: 'none',
  secondaryRail: 'none',
  primaryAmmoType: 'standard',
  secondaryAmmoType: 'standard',
  throwableCarry: { flashbang: true }
});

describe('throwables', () => {
  it('clamps mouse aim to max throw range', () => {
    const c = clampThrowTarget(0, 0, 1000, 0);
    expect(c.x).toBeCloseTo(THROW_MAX_RANGE_PX);
    expect(c.y).toBeCloseTo(0);
  });

  it('normalizes legacy multi-carry to a single type', () => {
    expect(getGrenadePouchSelection(normalizeThrowableCarry({ flashbang: true, he: true }))).toBe('he');
    expect(getGrenadePouchSelection(throwableCarryFromSelection('none'))).toBe('none');
  });

  it('flashbang is unlocked for a fresh profile', () => {
    expect(isThrowableUnlocked('flashbang', defaultPlayerProfile())).toBe(true);
    expect(isThrowableUnlocked('he', defaultPlayerProfile())).toBe(false);
  });

  it('issues counts for one selected unlocked type (legacy multi-select uses first in order)', () => {
    const p = defaultPlayerProfile();
    const counts = buildThrowableCountsFromLoadout({ flashbang: true, he: true }, p);
    expect(counts.he).toBe(0);
    expect(counts.flashbang).toBe(0);
    const onlyFlash = buildThrowableCountsFromLoadout({ flashbang: true }, p);
    expect(onlyFlash.flashbang).toBe(GRENADE_POUCH_STARTING.flashbang);
  });

  it('deploys flashbang inventory from loadout', () => {
    const spawn = SECTORS[0].playerSpawns[0];
    const player = new Player(1, spawn.x, spawn.y, 100, baseLoadout());
    player.applyDeployGearBonus();
    expect(player.throwableCounts.flashbang).toBe(2);
    expect(player.throwableCounts.he).toBe(0);
    expect(player.canThrow('flashbang')).toBe(true);
    player.consumeThrowable('flashbang');
    expect(player.throwableCounts.flashbang).toBe(1);
  });

  it('only throws the armory-selected grenade type', () => {
    const spawn = SECTORS[0].playerSpawns[0];
    const player = new Player(1, spawn.x, spawn.y, 100, baseLoadout());
    expect(player.equippedThrowableKind()).toBe('flashbang');
    expect(player.canThrow('he')).toBe(false);
    expect(player.canThrow('flashbang')).toBe(true);
  });
});
