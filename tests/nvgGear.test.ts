import { describe, it, expect } from 'vitest';
import { Player, WeaponLoadout } from '../src/entities/Player';
import { MapManager } from '../src/systems/MapManager';
import { PlayerInputState } from '../src/core/Input';
import { SECTORS } from '../src/config/sectors';
import { nvgLightsForPlayers } from '../src/systems/GearSystem';

const baseLoadout = (): WeaponLoadout => ({
  primaryWeapon: 'mpx',
  secondaryWeapon: 'glock17',
  primaryMuzzle: 'none',
  secondaryMuzzle: 'none',
  primaryRail: 'none',
  secondaryRail: 'none',
  primaryAmmoType: 'standard',
  secondaryAmmoType: 'standard',
  meleeWeapon: 'knife',
  operativeGear: 'nvg'
});

const idle = (overrides: Partial<PlayerInputState> = {}): PlayerInputState => ({
  moveX: 0,
  moveY: 0,
  aimAngle: 0,
  isFiring: false,
  isSprinting: false,
  isSneaking: false,
  isReloading: false,
  isInteracting: false,
  isSwitchingWeapon: false,
  selectPrimary: false,
  selectSecondary: false,
  selectMelee: false,
  isMeleeAttack: false,
  isTogglingFlashlight: false,
  isTogglingNvg: false,
  ...overrides
});

describe('night vision gear', () => {
  it('toggles only when NVG is equipped', () => {
    const spawn = SECTORS[0].playerSpawns[0];
    const map = new MapManager();
    const withNvg = new Player(1, spawn.x, spawn.y, 100, baseLoadout());
    withNvg.update(1 / 60, idle({ isTogglingNvg: true }), map);
    expect(withNvg.nvgOn).toBe(true);

    const plain = new Player(1, spawn.x, spawn.y, 100, { ...baseLoadout(), operativeGear: 'none' });
    plain.update(1 / 60, idle({ isTogglingNvg: true }), map);
    expect(plain.nvgOn).toBe(false);
  });

  it('emits NVG lights while active', () => {
    const spawn = SECTORS[0].playerSpawns[0];
    const p = new Player(1, spawn.x, spawn.y, 100, baseLoadout());
    expect(nvgLightsForPlayers([p])).toHaveLength(0);
    p.nvgOn = true;
    expect(nvgLightsForPlayers([p])).toHaveLength(1);
  });

  it('drains NVG battery separately from the flashlight', () => {
    const spawn = SECTORS[0].playerSpawns[0];
    const map = new MapManager();
    const p = new Player(1, spawn.x, spawn.y, 100, baseLoadout());
    p.nvgOn = true;
    p.flashlightOn = false;
    const startNvg = p.nvgBattery;
    const startFlash = p.flashlightBattery;
    p.update(2, idle(), map);
    expect(p.nvgBattery).toBeLessThan(startNvg);
    expect(p.flashlightBattery).toBe(startFlash);
  });

  it('spare battery cell gear only boosts the weapon flashlight', () => {
    const spawn = SECTORS[0].playerSpawns[0];
    const p = new Player(1, spawn.x, spawn.y, 100, {
      ...baseLoadout(),
      operativeGear: 'extra_battery'
    });
    p.flashlightBattery = 40;
    p.nvgBattery = 80;
    p.applyDeployGearBonus();
    expect(p.flashlightBattery).toBe(90);
    expect(p.nvgBattery).toBe(80);
  });
});
