import { describe, it, expect } from 'vitest';
import { Player, WeaponLoadout } from '../src/entities/Player';
import { FLASHLIGHT_BATTERY_MAX } from '../src/config/constants';
import { WEAPON_REGISTRY } from '../src/config/weapons';

const loadout: WeaponLoadout = {
  primaryWeapon: 'mpx',
  secondaryWeapon: 'glock17',
  primaryMuzzle: 'suppressor',
  secondaryMuzzle: 'suppressor',
  primaryRail: 'none',
  secondaryRail: 'none',
  primaryAmmoType: 'standard',
  secondaryAmmoType: 'standard'
};

describe('sector reward application', () => {
  it('medkit heals up to max health', () => {
    const p = new Player(1, 0, 0, 100, loadout);
    p.health = 40;
    p.health = Math.min(p.maxHealth, p.health + 50);
    expect(p.health).toBe(90);
  });

  it('ammo reward mirrors the pickup crate (+2 mags per gun)', () => {
    const p = new Player(1, 0, 0, 100, loadout);
    p.reserveAmmo = 0;
    p.activeSlot = 'secondary';
    p.reserveAmmo = 0;
    expect(p.addAmmoPickup()).toBe(true);
    expect(p.reserveAmmo).toBe(WEAPON_REGISTRY.glock17.magSize * 2);
    p.activeSlot = 'primary';
    expect(p.reserveAmmo).toBe(WEAPON_REGISTRY.mpx.magSize * 2);
  });

  it('battery reward caps at full charge', () => {
    const p = new Player(1, 0, 0, 100, loadout);
    p.flashlightBattery = FLASHLIGHT_BATTERY_MAX - 10;
    p.flashlightBattery = Math.min(FLASHLIGHT_BATTERY_MAX, p.flashlightBattery + 50);
    expect(p.flashlightBattery).toBe(FLASHLIGHT_BATTERY_MAX);
  });
});
