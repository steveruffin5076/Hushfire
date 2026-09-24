import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyDeadzone, readPad, assignPads, PadSnapshot, PAD_BUTTON, MOVE_DEADZONE } from '../src/core/Gamepad';
import { InputManager } from '../src/core/Input';

const pad = (index: number, opts: { axes?: number[]; down?: number[]; mapping?: string; connected?: boolean } = {}): PadSnapshot => ({
  index,
  connected: opts.connected ?? true,
  mapping: opts.mapping ?? 'standard',
  axes: opts.axes ?? [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, (_, i) => {
    const down = opts.down?.includes(i) ?? false;
    return { pressed: down, value: down ? 1 : 0 };
  })
});

describe('applyDeadzone', () => {
  it('zeroes stick drift inside the deadzone', () => {
    expect(applyDeadzone(0.1, 0.1, MOVE_DEADZONE)).toEqual({ x: 0, y: 0 });
  });

  it('ramps from 0 at the edge to 1 at full tilt, keeping direction', () => {
    const full = applyDeadzone(1, 0, MOVE_DEADZONE);
    expect(full.x).toBeCloseTo(1);
    expect(full.y).toBeCloseTo(0);
    const half = applyDeadzone(0, -(MOVE_DEADZONE + (1 - MOVE_DEADZONE) / 2), MOVE_DEADZONE);
    expect(half.y).toBeCloseTo(-0.5);
  });

  it('never exceeds magnitude 1 on a diagonal corner', () => {
    const d = applyDeadzone(1, 1, MOVE_DEADZONE);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
  });
});

describe('readPad', () => {
  it('maps sticks to move and aim', () => {
    const s = readPad(pad(0, { axes: [1, 0, 0, 1] }));
    expect(s.moveX).toBeCloseTo(1);
    expect(s.aimAngle).toBeCloseTo(Math.PI / 2);
  });

  it('reports no aim while the right stick is centered', () => {
    expect(readPad(pad(0, { axes: [0, 0, 0.2, 0.1] })).aimAngle).toBeNull();
  });

  it('maps triggers and buttons', () => {
    const s = readPad(pad(0, { down: [PAD_BUTTON.RT, PAD_BUTTON.LT, PAD_BUTTON.L3, PAD_BUTTON.X, PAD_BUTTON.A] }));
    expect(s).toMatchObject({ fire: true, sneak: true, sprint: true, reload: true, interact: true });
    expect(readPad(pad(0))).toMatchObject({ fire: false, sneak: false, sprint: false, reload: false, interact: false });
  });

  it('treats a half-pulled analog trigger as pressed', () => {
    const p = pad(0);
    (p.buttons as { pressed: boolean; value: number }[])[PAD_BUTTON.RT] = { pressed: false, value: 0.7 };
    expect(readPad(p).fire).toBe(true);
  });
});

describe('assignPads', () => {
  const a = pad(0);
  const b = pad(1);

  it('solo: first usable pad drives P1', () => {
    expect(assignPads([null, b], true)).toEqual({ p1: b, p2: null });
  });

  it('co-op with one pad: it goes to P2, P1 keeps the mouse', () => {
    expect(assignPads([a], false)).toEqual({ p1: null, p2: a });
  });

  it('co-op with two pads: one each, in order', () => {
    expect(assignPads([a, b], false)).toEqual({ p1: a, p2: b });
  });

  it('skips disconnected and non-standard pads', () => {
    expect(assignPads([pad(0, { connected: false }), pad(1, { mapping: '' }), b], true)).toEqual({ p1: b, p2: null });
  });
});

describe('InputManager with a gamepad', () => {
  let pads: (PadSnapshot | null)[] = [];
  const canvas = { width: 1280, height: 720, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) } as unknown as HTMLCanvasElement;
  const at = { x: 100, y: 100 };

  beforeEach(() => {
    pads = [];
    vi.stubGlobal('window', { addEventListener: () => {} });
    vi.stubGlobal('navigator', { getGamepads: () => pads });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('drives P1 in solo: stick move, stick aim, trigger fire', () => {
    const input = new InputManager(canvas, true);
    pads = [pad(0, { axes: [0, -1, -1, 0], down: [PAD_BUTTON.RT] })];
    input.pollGamepads();
    const s = input.getPlayer1Input(at);
    expect(s.moveY).toBeCloseTo(-1);
    expect(s.aimAngle).toBeCloseTo(Math.PI);
    expect(s.isFiring).toBe(true);
    expect(input.p1AimSource).toBe('pad');
  });

  it('keeps the last stick aim after the stick is released', () => {
    const input = new InputManager(canvas, true);
    pads = [pad(0, { axes: [0, 0, 0, 1] })];
    input.pollGamepads();
    pads = [pad(0)];
    input.pollGamepads();
    expect(input.getPlayer1Input(at).aimAngle).toBeCloseTo(Math.PI / 2);
  });

  it('fires one-shot actions once per press, not every frame held', () => {
    const input = new InputManager(canvas, true);
    pads = [pad(0, { down: [PAD_BUTTON.B, PAD_BUTTON.Y] })];
    input.pollGamepads();
    const first = input.getPlayer1Input(at);
    expect(first.isTogglingFlashlight).toBe(true);
    expect(first.isSwitchingWeapon).toBe(true);
    input.endFrame();

    input.pollGamepads(); // still held
    const held = input.getPlayer1Input(at);
    expect(held.isTogglingFlashlight).toBe(false);
    expect(held.isSwitchingWeapon).toBe(false);
  });

  it('keeps a tap that lands between physics ticks until endFrame', () => {
    const input = new InputManager(canvas, true);
    pads = [pad(0, { down: [PAD_BUTTON.DPAD_RIGHT] })];
    input.pollGamepads();
    pads = [pad(0)]; // released before the next poll
    input.pollGamepads();
    expect(input.getPlayer1Input(at).selectSecondary).toBe(true);
  });

  it('reports Start as a pause edge', () => {
    const input = new InputManager(canvas, true);
    pads = [pad(0, { down: [PAD_BUTTON.START] })];
    expect(input.pollGamepads()).toBe(true);
    expect(input.pollGamepads()).toBe(false);
  });

  it('routes a single co-op pad to P2 and leaves P1 on keyboard/mouse', () => {
    const input = new InputManager(canvas, false);
    pads = [pad(0, { axes: [1, 0, 0, -1], down: [PAD_BUTTON.RT] })];
    input.pollGamepads();
    const p1 = input.getPlayer1Input(at);
    const p2 = input.getPlayer2Input(at, { x: 0, y: 0 });
    expect(p1.moveX).toBe(0);
    expect(p1.isFiring).toBe(false);
    expect(input.p1AimSource).toBe('mouse');
    expect(p2.moveX).toBeCloseTo(1);
    expect(p2.aimAngle).toBeCloseTo(-Math.PI / 2);
    expect(p2.isFiring).toBe(true);
  });

  it('falls back to the mouse when the pad is unplugged', () => {
    const input = new InputManager(canvas, true);
    pads = [pad(0, { axes: [0, 0, 1, 0] })];
    input.pollGamepads();
    expect(input.p1AimSource).toBe('pad');
    pads = [];
    input.pollGamepads();
    expect(input.p1AimSource).toBe('mouse');
  });
});
