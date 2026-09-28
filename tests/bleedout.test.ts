import { describe, it, expect } from 'vitest';
import { Player } from '../src/entities/Player';
import { MapManager } from '../src/systems/MapManager';
import { BLEEDOUT_SEC } from '../src/config/constants';
import { DEFAULT_LOADOUTS } from '../src/ui/LoadoutStorage';

const idle = {
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
  isTogglingFlashlight: false
};

describe('co-op bleed-out', () => {
  it('eliminates a downed operative after BLEEDOUT_SEC', () => {
    const map = new MapManager();
    const player = new Player(1, 200, 360, 100, DEFAULT_LOADOUTS[0]);
    player.down();
    expect(player.isDowned).toBe(true);

    const steps = Math.ceil(BLEEDOUT_SEC / (1 / 60)) + 1;
    for (let i = 0; i < steps; i++) player.update(1 / 60, idle, map);

    expect(player.isEliminated).toBe(true);
    expect(player.isDowned).toBe(false);
  });

  it('resets the bleed-out clock on revive', () => {
    const map = new MapManager();
    const player = new Player(1, 200, 360, 100, DEFAULT_LOADOUTS[0]);
    player.down();
    for (let i = 0; i < 120; i++) player.update(1 / 60, idle, map);
    expect(player.bleedoutTimer).toBeGreaterThan(0);

    while (!player.startRevive(1 / 60)) player.update(1 / 60, idle, map);
    expect(player.isDowned).toBe(false);
    expect(player.bleedoutTimer).toBe(0);
  });
});
