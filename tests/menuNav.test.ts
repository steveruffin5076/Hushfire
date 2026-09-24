import { describe, it, expect } from 'vitest';
import { pickNext, NavRect } from '../src/ui/MenuGamepadNav';

// A 2x2 grid of 100x40 targets plus a wide button centered below it:
//   [0] [1]
//   [2] [3]
//     [4]
const grid: NavRect[] = [
  { x: 0, y: 0, w: 100, h: 40 },
  { x: 150, y: 0, w: 100, h: 40 },
  { x: 0, y: 80, w: 100, h: 40 },
  { x: 150, y: 80, w: 100, h: 40 },
  { x: 50, y: 160, w: 150, h: 40 }
];

describe('pickNext', () => {
  it('moves within a row and column', () => {
    expect(pickNext(grid[0], grid, 'right')).toBe(1);
    expect(pickNext(grid[1], grid, 'left')).toBe(0);
    expect(pickNext(grid[0], grid, 'down')).toBe(2);
    expect(pickNext(grid[3], grid, 'up')).toBe(1);
  });

  it('prefers staying in line over a closer diagonal', () => {
    expect(pickNext(grid[1], grid, 'down')).toBe(3);
  });

  it('reaches a centered button below from either column', () => {
    expect(pickNext(grid[2], grid, 'down')).toBe(4);
    expect(pickNext(grid[3], grid, 'down')).toBe(4);
  });

  it('returns -1 at an edge', () => {
    expect(pickNext(grid[0], grid, 'up')).toBe(-1);
    expect(pickNext(grid[1], grid, 'right')).toBe(-1);
    expect(pickNext(grid[4], grid, 'down')).toBe(-1);
  });
});
