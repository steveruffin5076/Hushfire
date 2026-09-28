import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InputManager } from '../src/core/Input';

describe('InputManager.dispose', () => {
  const listeners = new Map<string, Set<EventListener>>();

  beforeEach(() => {
    listeners.clear();
    vi.stubGlobal('window', {
      addEventListener: (type: string, fn: EventListener) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener: (type: string, fn: EventListener) => {
        listeners.get(type)?.delete(fn);
      }
    });
    vi.stubGlobal('navigator', { getGamepads: () => [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('removes every window listener it registered', () => {
    const canvas = {
      width: 1280,
      height: 720,
      addEventListener: () => {},
      removeEventListener: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 })
    } as unknown as HTMLCanvasElement;

    const input = new InputManager(canvas);
    expect(listeners.get('keydown')?.size).toBe(1);
    expect(listeners.get('mousemove')?.size).toBe(1);

    input.dispose();
    expect(listeners.get('keydown')?.size ?? 0).toBe(0);
    expect(listeners.get('keyup')?.size ?? 0).toBe(0);
    expect(listeners.get('mousemove')?.size ?? 0).toBe(0);
    expect(listeners.get('mousedown')?.size ?? 0).toBe(0);
    expect(listeners.get('mouseup')?.size ?? 0).toBe(0);
    expect(listeners.get('contextmenu')?.size ?? 0).toBe(0);
  });
});
