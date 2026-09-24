import { describe, it, expect } from 'vitest';
import { Player, WeaponLoadout } from '../src/entities/Player';
import { MapManager } from '../src/systems/MapManager';
import { PlayerInputState } from '../src/core/Input';
import { FLASHLIGHT_BATTERY_MAX, FLASHLIGHT_FULL_CHARGE_SEC } from '../src/config/constants';
import { SECTORS } from '../src/config/sectors';
import { WEAPON_REGISTRY } from '../src/config/weapons';

const weaponId = Object.keys(WEAPON_REGISTRY)[0];

const loadout: WeaponLoadout = {
  primaryWeapon: weaponId,
  secondaryWeapon: weaponId,
  primaryMuzzle: 'none',
  secondaryMuzzle: 'none',
  primaryRail: 'none',
  secondaryRail: 'none',
  primaryAmmoType: 'standard',
  secondaryAmmoType: 'standard'
};

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
  isTogglingFlashlight: false,
  ...overrides
});

const spawn = SECTORS[0].playerSpawns[0];
const makePlayer = () => new Player(1, spawn.x, spawn.y, 100, loadout);

/** Advances the player in fixed 60Hz steps, like Game.ts's physics loop. */
const run = (p: Player, map: MapManager, seconds: number) => {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) p.update(dt, idle(), map);
};

describe('flashlight battery', () => {
  const map = new MapManager();

  it('starts full and on', () => {
    const p = makePlayer();
    expect(p.flashlightOn).toBe(true);
    expect(p.flashlightBattery).toBe(FLASHLIGHT_BATTERY_MAX);
  });

  it('drains at a rate that empties a full charge in FLASHLIGHT_FULL_CHARGE_SEC', () => {
    const p = makePlayer();
    run(p, map, FLASHLIGHT_FULL_CHARGE_SEC / 2);
    expect(p.flashlightBattery).toBeCloseTo(FLASHLIGHT_BATTERY_MAX / 2, 0);
  });

  it('does not drain while off', () => {
    const p = makePlayer();
    p.toggleFlashlight();
    run(p, map, 60);
    expect(p.flashlightBattery).toBe(FLASHLIGHT_BATTERY_MAX);
  });

  it('forces off at empty and refuses to turn back on', () => {
    const p = makePlayer();
    p.flashlightBattery = 0.01;
    run(p, map, 1);
    expect(p.flashlightBattery).toBe(0);
    expect(p.flashlightOn).toBe(false);
    p.toggleFlashlight();
    expect(p.flashlightOn).toBe(false);
  });

  it('toggles via the keyboard input flag', () => {
    const p = makePlayer();
    p.update(1 / 60, idle({ isTogglingFlashlight: true }), map);
    expect(p.flashlightOn).toBe(false);
    p.update(1 / 60, idle({ isTogglingFlashlight: true }), map);
    expect(p.flashlightOn).toBe(true);
  });

  it('cannot be toggled while downed, and does not drain while downed', () => {
    const p = makePlayer();
    p.down();
    const before = p.flashlightBattery;
    p.toggleFlashlight();
    expect(p.flashlightOn).toBe(true);
    run(p, map, 10);
    expect(p.flashlightBattery).toBe(before);
  });
});
