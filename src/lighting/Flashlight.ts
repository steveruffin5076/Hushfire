import { Point, Segment, Raycaster } from './Raycaster';
import { RailType, RAIL_MODIFIERS } from '../config/weapons';

export interface FlashlightBeam {
  polygon: Point[];
  origin: Point;
  range: number;
  isLaser: boolean;
  laserEnd?: Point;
}

/** Builds the light shape for a player's rail attachment: a flood/spot cone, or a pencil-thin laser ray. */
export class Flashlight {
  private static beamCache = new Map<string, FlashlightBeam | null>();

  static clearCache() {
    this.beamCache.clear();
  }

  static build(
    origin: Point,
    angle: number,
    rail: RailType,
    walls: Segment[],
    wallsRevision = 0
  ): FlashlightBeam | null {
    const key = `${Math.round(origin.x)}|${Math.round(origin.y)}|${angle.toFixed(3)}|${rail}|${wallsRevision}`;
    const hit = this.beamCache.get(key);
    if (hit !== undefined) return hit;

    const mod = RAIL_MODIFIERS[rail];
    if (rail === 'none' || mod.rangePx === 0) {
      this.beamCache.set(key, null);
      return null;
    }

    if (rail === 'green_laser') {
      const dir = { x: Math.cos(angle) * mod.rangePx, y: Math.sin(angle) * mod.rangePx };
      let laserEnd: Point = { x: origin.x + dir.x, y: origin.y + dir.y };
      let minT = 1.0;
      for (const seg of walls) {
        const hit = Raycaster.getIntersection(origin, dir, seg);
        if (hit) {
          const t = Math.hypot(hit.x - origin.x, hit.y - origin.y) / mod.rangePx;
          if (t < minT) {
            minT = t;
            laserEnd = hit;
          }
        }
      }
      const beam = { polygon: [], origin, range: mod.rangePx, isLaser: true, laserEnd };
      this.beamCache.set(key, beam);
      return beam;
    }

    const polygon = Raycaster.castCone(origin, angle, mod.coneAngleRad, mod.rangePx, walls);
    const beam = { polygon, origin, range: mod.rangePx, isLaser: false };
    this.beamCache.set(key, beam);
    return beam;
  }
}
