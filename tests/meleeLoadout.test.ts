import { describe, it, expect } from 'vitest';
import { CombatSystem } from '../src/systems/CombatSystem';
import { MapManager } from '../src/systems/MapManager';
import { NoiseSystem } from '../src/systems/NoiseSystem';
import { Player } from '../src/entities/Player';
import { Zombie } from '../src/entities/Zombie';
import { ZOMBIE_REGISTRY } from '../src/config/zombies';
import { DEFAULT_LOADOUTS } from '../src/ui/LoadoutStorage';
import {
  MELEE_STAMINA_COST_PER_SWING,
  MELEE_STAMINA_MAX,
  MELEE_STAMINA_REGEN_PER_SEC
} from '../src/config/constants';
import { PlayerInputState } from '../src/core/Input';
import { SECTORS } from '../src/config/sectors';

describe('melee loadout slot', () => {
  it('quick melee temporarily draws knife then restores the gun slot', () => {
    const combat = new CombatSystem(new MapManager(), new NoiseSystem());
    const p = new Player(1, 200, 360, 100, DEFAULT_LOADOUTS[0]);
    expect(p.activeSlot).toBe('primary');
    const z = new Zombie(230, 360, Math.PI, 'lurker');
    p.lastMeleeSwingTime = -1e9;
    p.beginQuickMelee();
    expect(p.activeSlot).toBe('melee');
    combat.swingMelee(p, [z], []);
    expect(z.health).toBeLessThan(ZOMBIE_REGISTRY.lurker.maxHealth);
    p.finishQuickMelee();
    expect(p.activeSlot).toBe('primary');
    expect(p.quickMeleeRestoreSlot).toBeNull();
  });

  it('blocks melee spam when stamina is empty', () => {
    const combat = new CombatSystem(new MapManager(), new NoiseSystem());
    const p = new Player(1, 200, 360, 100, DEFAULT_LOADOUTS[0]);
    const z = new Zombie(230, 360, Math.PI, 'lurker');
    p.meleeStamina = MELEE_STAMINA_COST_PER_SWING - 1;
    p.lastMeleeSwingTime = -1e9;
    combat.swingMelee(p, [z], []);
    expect(p.shotsFired).toBe(0);
  });

  it('consumes stamina per swing and regens over time', () => {
    const spawn = SECTORS[0].playerSpawns[0];
    const map = new MapManager();
    const p = new Player(1, spawn.x, spawn.y, 100, DEFAULT_LOADOUTS[0]);
    p.activeSlot = 'melee';
    p.lastMeleeSwingTime = -1e9;
    p.consumeMeleeSwing();
    expect(p.meleeStamina).toBe(MELEE_STAMINA_MAX - MELEE_STAMINA_COST_PER_SWING);
    const idle: PlayerInputState = {
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
      isThrowing: false,
      cycleThrowable: false,
      selectThrowableHe: false,
      selectThrowableIncendiary: false,
      selectThrowableFlashbang: false,
      selectThrowableFlare: false
    };
    p.update(1, idle, map);
    expect(p.meleeStamina).toBeGreaterThan(MELEE_STAMINA_MAX - MELEE_STAMINA_COST_PER_SWING);
    expect(p.meleeStamina).toBeCloseTo(
      MELEE_STAMINA_MAX - MELEE_STAMINA_COST_PER_SWING + MELEE_STAMINA_REGEN_PER_SEC,
      1
    );
  });
});
