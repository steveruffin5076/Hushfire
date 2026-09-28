import { describe, it, expect } from 'vitest';
import { Player } from '../src/entities/Player';
import { DEFAULT_LOADOUTS } from '../src/ui/LoadoutStorage';
import { FLASHLIGHT_BATTERY_MAX } from '../src/config/constants';
import { WEAPON_REGISTRY } from '../src/config/weapons';

describe('operative gear deploy bonuses', () => {
  it('extra ammo adds one magazine per gun', () => {
    const loadout = { ...DEFAULT_LOADOUTS[0], operativeGear: 'extra_ammo' as const };
    const player = new Player(1, 100, 100, 100, loadout);
    player.activeSlot = 'primary';
    const before = player.reserveAmmo;
    const mag = WEAPON_REGISTRY.mpx.magSize;
    player.applyDeployGearBonus();
    player.activeSlot = 'primary';
    expect(player.reserveAmmo).toBe(before + mag);
  });

  it('extra battery adds pickup charge', () => {
    const player = new Player(1, 100, 100, 100, { ...DEFAULT_LOADOUTS[0], operativeGear: 'extra_battery' });
    player.flashlightBattery = 40;
    player.applyDeployGearBonus();
    expect(player.flashlightBattery).toBe(90);
    player.flashlightBattery = FLASHLIGHT_BATTERY_MAX - 10;
    player.applyDeployGearBonus();
    expect(player.flashlightBattery).toBe(FLASHLIGHT_BATTERY_MAX);
  });
});
