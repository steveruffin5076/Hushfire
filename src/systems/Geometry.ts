import { Point, Segment } from '../lighting/Raycaster';

/**
 * Smallest angle between two headings, in [0, π]. Safe for any inputs — a
 * plain |a - b| folded once breaks when the difference exceeds 2π (e.g. after
 * adding π to an atan2 result), which is how the brute's armour check used to
 * misfire.
 */
export function angleBetween(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

/** Closest point on segment [a,b] to p. */
export function closestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return { x: a.x, y: a.y };
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + abx * t, y: a.y + aby * t };
}

export function distanceToSegment(p: Point, seg: Segment): number {
  const c = closestPointOnSegment(p, seg.p1, seg.p2);
  return Math.hypot(p.x - c.x, p.y - c.y);
}

/**
 * True if the open segment a->b crosses `seg`.
 *
 * Solving a + t1*r = p1 + t2*s gives t1 = ((p1-a) x s) / (r x s) and
 * t2 = ((p1-a) x r) / (r x s), with `x` the 2D cross product. Getting either
 * numerator's operand order backwards silently mirrors the test, which is
 * exactly the bug this replaced.
 */
export function segmentsCross(a: Point, b: Point, seg: Segment): boolean {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = seg.p2.x - seg.p1.x;
  const sy = seg.p2.y - seg.p1.y;

  const denom = rx * sy - ry * sx;
  if (denom === 0) return false;

  const qpx = seg.p1.x - a.x;
  const qpy = seg.p1.y - a.y;

  const t1 = (qpx * sy - qpy * sx) / denom;
  const t2 = (qpx * ry - qpy * rx) / denom;

  return t1 > 0.001 && t1 < 0.999 && t2 >= 0 && t2 <= 1;
}

export function lineOfSight(a: Point, b: Point, walls: Segment[]): boolean {
  for (const seg of walls) {
    if (segmentsCross(a, b, seg)) return false;
  }
  return true;
}

export function countWallsCrossed(a: Point, b: Point, walls: Segment[]): number {
  let count = 0;
  for (const seg of walls) {
    if (segmentsCross(a, b, seg)) count++;
  }
  return count;
}
