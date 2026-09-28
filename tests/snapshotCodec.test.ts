import { describe, it, expect } from 'vitest';
import { inputToNet, netToInput } from '../src/net/Protocol';
import type { PlayerInputState } from '../src/core/Input';

describe('network snapshot codec', () => {
  it('round-trips guest input packets', () => {
    const input: PlayerInputState = {
      moveX: 0.7,
      moveY: -0.3,
      aimAngle: 1.2,
      isFiring: true,
      isSprinting: false,
      isSneaking: true,
      isReloading: false,
      isInteracting: true,
      isSwitchingWeapon: false,
      selectPrimary: false,
      selectSecondary: true,
      isTogglingFlashlight: false
    };
    const wire = inputToNet(42, input);
    expect(wire.t).toBe('input');
    expect(wire.seq).toBe(42);
    expect(netToInput(wire)).toEqual(input);
  });
});
