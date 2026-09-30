import { describe, expect, it } from 'vitest';
import { operativeLoadoutForPlayer } from '../src/graphics/animation/operativeLoadout';
import type { Player } from '../src/entities/Player';

function stubPlayer(partial: Partial<Player> & { playerNumber: 1 | 2 }): Player {
  return {
    activeSlot: 'primary',
    activeWeaponId: 'mpx',
    ...partial
  } as Player;
}

describe('operativeLoadoutForPlayer', () => {
  it('maps melee slot to knife', () => {
    const p = stubPlayer({ playerNumber: 1, activeSlot: 'melee', activeWeaponId: 'knife' });
    expect(operativeLoadoutForPlayer(p)).toBe('knife');
  });

  it('maps secondary to pistol', () => {
    const p = stubPlayer({ playerNumber: 1, activeSlot: 'secondary', activeWeaponId: 'glock17' });
    expect(operativeLoadoutForPlayer(p)).toBe('pistol');
  });

  it('maps primary long gun to rifle', () => {
    const p = stubPlayer({ playerNumber: 1, activeSlot: 'primary', activeWeaponId: 'm4a1' });
    expect(operativeLoadoutForPlayer(p)).toBe('rifle');
  });

  it('uses rifle art for breacher (no loadout packs)', () => {
    const p = stubPlayer({ playerNumber: 2, activeSlot: 'secondary', activeWeaponId: 'glock17' });
    expect(operativeLoadoutForPlayer(p)).toBe('rifle');
  });
});
