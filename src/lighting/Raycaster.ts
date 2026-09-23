export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  p1: Point;
  p2: Point;
}

export interface RayIntersection {
  point: Point;
  param: number;
  angle: number;
}

/**
 * Rays stop exactly ON the wall line they hit, which would leave the wall's own
 * stroke (5px, straddling that line) outside the light polygon — so a lit floor
 * would just end at an invisible black edge. Carrying each ray this far past the
 * hit covers the stroke and lets you actually see the geometry you're lighting.
 */
const WALL_LIGHT_BLEED_PX = 6;

export class Raycaster {
  static getIntersection(rayOrigin: Point, rayDir: Point, segment: Segment): Point | null {
    const r_px = rayOrigin.x;
    const r_py = rayOrigin.y;
    const r_dx = rayDir.x;
    const r_dy = rayDir.y;

    const s_px = segment.p1.x;
    const s_py = segment.p1.y;
    const s_dx = segment.p2.x - segment.p1.x;
    const s_dy = segment.p2.y - segment.p1.y;

    const r_mag = Math.sqrt(r_dx * r_dx + r_dy * r_dy);
    const s_mag = Math.sqrt(s_dx * s_dx + s_dy * s_dy);

    if (r_dx / r_mag === s_dx / s_mag && r_dy / r_mag === s_dy / s_mag) {
      return null;
    }

    const T2 = (r_dx * (s_py - r_py) + r_dy * (r_px - s_px)) / (s_dx * r_dy - s_dy * r_dx);
    const T1 = (s_px + s_dx * T2 - r_px) / r_dx;

    if (T1 < 0) return null;
    if (T2 < 0 || T2 > 1) return null;

    return {
      x: r_px + r_dx * T1,
      y: r_py + r_dy * T1
    };
  }

  static castCone(
    origin: Point,
    aimAngle: number,
    coneFov: number,
    range: number,
    segments: Segment[]
  ): Point[] {
    const minAngle = aimAngle - coneFov / 2;
    const maxAngle = aimAngle + coneFov / 2;

    const angles: number[] = [minAngle, maxAngle];

    // Gather angles to segment endpoints within or near cone
    for (const seg of segments) {
      for (const pt of [seg.p1, seg.p2]) {
        const dx = pt.x - origin.x;
        const dy = pt.y - origin.y;
        let angle = Math.atan2(dy, dx);

        // Normalize angle around aimAngle
        while (angle < aimAngle - Math.PI) angle += Math.PI * 2;
        while (angle > aimAngle + Math.PI) angle -= Math.PI * 2;

        if (angle >= minAngle - 0.2 && angle <= maxAngle + 0.2) {
          angles.push(angle - 0.0001, angle, angle + 0.0001);
        }
      }
    }

    // Add arc steps for smooth round cone falloff
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      angles.push(minAngle + (i / steps) * coneFov);
    }

    // Filter and sort angles
    const validAngles = angles
      .filter(a => a >= minAngle && a <= maxAngle)
      .sort((a, b) => a - b);

    const polygon: Point[] = [origin];

    for (const angle of validAngles) {
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);
      const rayDir = { x: dirX * range, y: dirY * range };
      let closestPt: Point = { x: origin.x + rayDir.x, y: origin.y + rayDir.y };
      let minT = 1.0;
      let hitWall = false;

      for (const seg of segments) {
        const hit = Raycaster.getIntersection(origin, rayDir, seg);
        if (hit) {
          const distSq = (hit.x - origin.x) ** 2 + (hit.y - origin.y) ** 2;
          const t = Math.sqrt(distSq) / range;
          if (t < minT) {
            minT = t;
            closestPt = hit;
            hitWall = true;
          }
        }
      }

      if (hitWall) {
        closestPt = { x: closestPt.x + dirX * WALL_LIGHT_BLEED_PX, y: closestPt.y + dirY * WALL_LIGHT_BLEED_PX };
      }
      polygon.push(closestPt);
    }

    return polygon;
  }
}
