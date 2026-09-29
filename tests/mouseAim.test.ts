import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputManager } from '../src/core/Input';
import { Camera } from '../src/core/Camera';

describe('mouse aim', () => {
  const canvas = {
    width: 1280,
    height: 720,
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 })
  } as unknown as HTMLCanvasElement;

  beforeEach(() => {
    vi.stubGlobal('window', { addEventListener: () => {} });
    vi.stubGlobal('navigator', { getGamepads: () => [] });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('aims at the world point under the cursor when the camera is offset', () => {
    const input = new InputManager(canvas);
    const camera = new Camera(1280, 720, 0, 0, 5000, 5000);
    camera.x = 640;
    camera.y = 400;
    camera.zoom = 1;

    const player = { x: 500, y: 500 };
    const targetWorld = { x: 700, y: 500 };
    const screen = camera.worldToScreen(targetWorld);
    input.mousePos.x = screen.x;
    input.mousePos.y = screen.y;
    input.p1AimSource = 'mouse';

    const aim = input.getPlayer1Input(player, camera).aimAngle;
    expect(aim).toBeCloseTo(0);
  });
});
