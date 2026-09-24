import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TouchControls, TOUCH_BUTTONS, STICK_RADIUS, FIRE_THRESHOLD } from '../src/core/TouchControls';
import { InputManager } from '../src/core/Input';

const btn = (id: string) => TOUCH_BUTTONS.find(b => b.id === id)!;

describe('TouchControls', () => {
  it('stays inactive until touched', () => {
    const t = new TouchControls();
    expect(t.active).toBe(false);
    t.onStart(1, 200, 500);
    expect(t.active).toBe(true);
  });

  it('left half is a floating move stick', () => {
    const t = new TouchControls();
    t.onStart(1, 300, 500);
    t.onMove(1, 300 + STICK_RADIUS, 500);
    const s = t.read();
    expect(s.moveX).toBeCloseTo(1);
    expect(s.moveY).toBeCloseTo(0);
    t.onEnd(1);
    expect(t.read().moveX).toBe(0);
  });

  it('caps stick deflection at full strength', () => {
    const t = new TouchControls();
    t.onStart(1, 300, 500);
    t.onMove(1, 300, 500 - STICK_RADIUS * 3);
    expect(Math.hypot(t.read().moveX, t.read().moveY)).toBeCloseTo(1);
  });

  it('right half aims, and only fires past the threshold', () => {
    const t = new TouchControls();
    t.onStart(2, 900, 500);
    t.onMove(2, 900, 500 - STICK_RADIUS * (FIRE_THRESHOLD - 0.2));
    let s = t.read();
    expect(s.aimAngle).toBeCloseTo(-Math.PI / 2);
    expect(s.fire).toBe(false);
    t.onMove(2, 900, 500 - STICK_RADIUS);
    s = t.read();
    expect(s.fire).toBe(true);
  });

  it('ignores a tap on the aim side (no spin, no shot)', () => {
    const t = new TouchControls();
    t.onStart(2, 900, 500);
    expect(t.read()).toMatchObject({ aimAngle: null, fire: false });
  });

  it('runs both sticks at once with two thumbs', () => {
    const t = new TouchControls();
    t.onStart(1, 300, 500);
    t.onStart(2, 900, 500);
    t.onMove(1, 300 - STICK_RADIUS, 500);
    t.onMove(2, 900 + STICK_RADIUS, 500);
    const s = t.read();
    expect(s.moveX).toBeCloseTo(-1);
    expect(s.aimAngle).toBeCloseTo(0);
    expect(s.fire).toBe(true);
  });

  it('holds RELOAD and USE while pressed', () => {
    const t = new TouchControls();
    t.onStart(3, btn('reload').x, btn('reload').y);
    t.onStart(4, btn('use').x, btn('use').y);
    expect(t.read()).toMatchObject({ reload: true, interact: true });
    t.onEnd(3);
    t.onEnd(4);
    expect(t.read()).toMatchObject({ reload: false, interact: false });
  });

  it('reports LIGHT and SWAP once per tap, kept until endFrame', () => {
    const t = new TouchControls();
    t.onStart(3, btn('light').x, btn('light').y);
    t.onEnd(3);
    expect(t.read().justPressed.has('light')).toBe(true);
    t.endFrame();
    expect(t.read().justPressed.has('light')).toBe(false);
  });

  it('SPRINT and SNEAK are exclusive toggles', () => {
    const t = new TouchControls();
    t.onStart(3, btn('sprint').x, btn('sprint').y);
    t.onEnd(3);
    expect(t.read()).toMatchObject({ sprint: true, sneak: false });
    t.onStart(4, btn('sneak').x, btn('sneak').y);
    t.onEnd(4);
    expect(t.read()).toMatchObject({ sprint: false, sneak: true });
    t.onStart(5, btn('sneak').x, btn('sneak').y);
    expect(t.read()).toMatchObject({ sprint: false, sneak: false });
  });

  it('a button touch never starts a stick', () => {
    const t = new TouchControls();
    t.onStart(3, btn('use').x, btn('use').y);
    t.onMove(3, btn('use').x - 200, btn('use').y);
    expect(t.read()).toMatchObject({ moveX: 0, moveY: 0, aimAngle: null, fire: false });
  });

  it('pause is consumed once', () => {
    const t = new TouchControls();
    t.onStart(3, btn('pause').x, btn('pause').y);
    expect(t.consumePause()).toBe(true);
    expect(t.consumePause()).toBe(false);
  });
});

describe('InputManager with touch', () => {
  const canvas = {
    width: 1280,
    height: 720,
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 })
  } as unknown as HTMLCanvasElement;
  const at = { x: 100, y: 100 };

  beforeEach(() => {
    vi.stubGlobal('window', { addEventListener: () => {} });
    vi.stubGlobal('navigator', { getGamepads: () => [] });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('drives P1 and keeps the aim after the thumb lifts', () => {
    const input = new InputManager(canvas, true);
    input.touch.onStart(1, 300, 500);
    input.touch.onMove(1, 300, 500 + STICK_RADIUS);
    input.touch.onStart(2, 900, 500);
    input.touch.onMove(2, 900 - STICK_RADIUS, 500);
    input.poll();
    let s = input.getPlayer1Input(at);
    expect(s.moveY).toBeCloseTo(1);
    expect(s.aimAngle).toBeCloseTo(Math.PI);
    expect(s.isFiring).toBe(true);
    expect(input.p1AimSource).toBe('stick');

    input.touch.onEnd(2);
    input.poll();
    s = input.getPlayer1Input(at);
    expect(s.aimAngle).toBeCloseTo(Math.PI);
    expect(s.isFiring).toBe(false);
  });

  it('turns a flashlight tap into a one-frame toggle', () => {
    const input = new InputManager(canvas, true);
    input.touch.onStart(3, btn('light').x, btn('light').y);
    input.touch.onEnd(3);
    input.poll();
    expect(input.getPlayer1Input(at).isTogglingFlashlight).toBe(true);
    input.endFrame();
    expect(input.getPlayer1Input(at).isTogglingFlashlight).toBe(false);
  });

  it('reports the pause button through poll()', () => {
    const input = new InputManager(canvas, true);
    input.touch.onStart(3, btn('pause').x, btn('pause').y);
    expect(input.poll()).toBe(true);
    expect(input.poll()).toBe(false);
  });

  it('leaves P2 untouched', () => {
    const input = new InputManager(canvas, false);
    input.touch.onStart(1, 300, 500);
    input.touch.onMove(1, 300 + STICK_RADIUS, 500);
    input.poll();
    expect(input.getPlayer2Input(at, { x: 0, y: 0 }).moveX).toBe(0);
  });
});
