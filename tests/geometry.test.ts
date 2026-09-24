import { describe, it, expect } from 'vitest';
import { closestPointOnSegment, distanceToSegment, segmentsCross, countWallsCrossed, lineOfSight } from '../src/systems/Geometry';
import { Segment } from '../src/lighting/Raycaster';

const vertical: Segment = { p1: { x: 50, y: 0 }, p2: { x: 50, y: 100 } };

describe('closestPointOnSegment', () => {
  it('projects onto the segment interior', () => {
    expect(closestPointOnSegment({ x: 0, y: 40 }, vertical.p1, vertical.p2)).toEqual({ x: 50, y: 40 });
  });

  it('clamps to the nearest endpoint past either end', () => {
    expect(closestPointOnSegment({ x: 60, y: -30 }, vertical.p1, vertical.p2)).toEqual({ x: 50, y: 0 });
    expect(closestPointOnSegment({ x: 60, y: 130 }, vertical.p1, vertical.p2)).toEqual({ x: 50, y: 100 });
  });

  it('handles a zero-length segment', () => {
    expect(closestPointOnSegment({ x: 9, y: 9 }, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
  });
});

describe('distanceToSegment', () => {
  it('returns perpendicular distance', () => {
    expect(distanceToSegment({ x: 20, y: 50 }, vertical)).toBe(30);
  });
});

describe('segmentsCross', () => {
  it('detects a path crossing a wall', () => {
    expect(segmentsCross({ x: 0, y: 50 }, { x: 100, y: 50 }, vertical)).toBe(true);
  });

  it('ignores a path that stops short of the wall', () => {
    expect(segmentsCross({ x: 0, y: 50 }, { x: 40, y: 50 }, vertical)).toBe(false);
  });

  it('ignores a path passing beyond the wall end', () => {
    expect(segmentsCross({ x: 0, y: 150 }, { x: 100, y: 150 }, vertical)).toBe(false);
  });

  it('ignores parallel paths', () => {
    expect(segmentsCross({ x: 0, y: 0 }, { x: 0, y: 100 }, vertical)).toBe(false);
  });

  it('is not mirrored — a crossing in the opposite direction still counts', () => {
    expect(segmentsCross({ x: 100, y: 50 }, { x: 0, y: 50 }, vertical)).toBe(true);
  });
});

describe('countWallsCrossed / lineOfSight', () => {
  const walls: Segment[] = [vertical, { p1: { x: 80, y: 0 }, p2: { x: 80, y: 100 } }];

  it('counts every wall between two points', () => {
    expect(countWallsCrossed({ x: 0, y: 50 }, { x: 100, y: 50 }, walls)).toBe(2);
    expect(countWallsCrossed({ x: 0, y: 50 }, { x: 60, y: 50 }, walls)).toBe(1);
  });

  it('reports line of sight only when nothing is in the way', () => {
    expect(lineOfSight({ x: 0, y: 50 }, { x: 40, y: 50 }, walls)).toBe(true);
    expect(lineOfSight({ x: 0, y: 50 }, { x: 100, y: 50 }, walls)).toBe(false);
  });
});
