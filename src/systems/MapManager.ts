import { Point, Segment } from '../lighting/Raycaster';
import { Pickup, PickupType } from '../entities/Pickup';
import { SECTORS, SectorDef, BoxDef } from '../config/sectors';
import { rawSurgeSpawnPoint } from './HordeSurge';
import { SectorLayout, rollSectorLayout } from '../config/sectorLayout';
import { NavGrid } from './NavGrid';
import { closestPointOnSegment, lineOfSight, countWallsCrossed } from './Geometry';

export interface ExtractionZone {
  x: number;
  y: number;
  radius: number;
  holdoutDurationSec: number;
  holdoutTimer: number;
  isActive: boolean;
  isComplete: boolean;
  /** Someone is on the pad right now — the holdout clock is paused otherwise. */
  isOccupied: boolean;
}

export class MapManager {
  public walls: Segment[] = [];
  public extractionZone: ExtractionZone;
  public pickups: Pickup[] = [];

  public sectorIndex = 0;
  public sector: SectorDef;
  public objectiveComplete = false;
  public objectiveProgress = 0;
  public nav!: NavGrid;
  /** This run's rolled zombie and pickup positions for the current sector. */
  public layout!: SectorLayout;
  private doorWalls: Segment[] = [];

  constructor() {
    this.sector = SECTORS[0];
    this.extractionZone = {
      x: 0,
      y: 0,
      radius: 0,
      holdoutDurationSec: 120,
      holdoutTimer: 120,
      isActive: false,
      isComplete: false,
      isOccupied: false
    };
    this.loadSector(0);
  }

  get isFinalSector(): boolean {
    return this.sectorIndex >= SECTORS.length - 1;
  }

  /** `rand` picks this visit's zombie/pickup spots — injectable so tests can pin a layout. */
  loadSector(index: number, rand: () => number = Math.random) {
    const sector = SECTORS[Math.min(index, SECTORS.length - 1)];
    this.sectorIndex = index;
    this.sector = sector;
    this.objectiveComplete = false;
    this.objectiveProgress = 0;

    this.walls = [
      { p1: { x: 20, y: 20 }, p2: { x: 1260, y: 20 } },
      { p1: { x: 1260, y: 20 }, p2: { x: 1260, y: 700 } },
      { p1: { x: 1260, y: 700 }, p2: { x: 20, y: 700 } },
      { p1: { x: 20, y: 700 }, p2: { x: 20, y: 20 } }
    ];
    for (const box of sector.boxes) this.addBox(box.x1, box.y1, box.x2, box.y2);

    this.doorWalls = sector.doorWalls.map(w => ({ p1: { ...w.p1 }, p2: { ...w.p2 } }));
    this.walls.push(...this.doorWalls);

    this.layout = rollSectorLayout(sector, rand);
    this.pickups = this.layout.pickups.map(p => new Pickup(p.x, p.y, p.type));

    const evac = sector.evacZone;
    this.extractionZone = {
      x: evac?.x ?? 0,
      y: evac?.y ?? 0,
      radius: evac?.radius ?? 0,
      holdoutDurationSec: evac?.holdoutSec ?? 120,
      holdoutTimer: evac?.holdoutSec ?? 120,
      isActive: false,
      isComplete: false,
      isOccupied: false
    };

    this.nav = new NavGrid(this.walls);
  }

  /** Marks the sector objective done and opens any blast doors it was holding shut. */
  completeObjective() {
    if (this.objectiveComplete) return;
    this.objectiveComplete = true;
    this.objectiveProgress = 1;
    if (this.doorWalls.length > 0) {
      this.walls = this.walls.filter(w => !this.doorWalls.includes(w));
      this.doorWalls = [];
      // The opened doorway is now walkable, so paths through it must be valid.
      this.nav = new NavGrid(this.walls);
    }
  }

  private addBox(x1: number, y1: number, x2: number, y2: number) {
    this.walls.push(
      { p1: { x: x1, y: y1 }, p2: { x: x2, y: y1 } },
      { p1: { x: x2, y: y1 }, p2: { x: x2, y: y2 } },
      { p1: { x: x2, y: y2 }, p2: { x: x1, y: y2 } },
      { p1: { x: x1, y: y2 }, p2: { x: x1, y: y1 } }
    );
  }

  /** True when a point sits strictly inside a solid obstacle box. */
  isInsideBox(p: Point, box: BoxDef): boolean {
    return p.x > box.x1 && p.x < box.x2 && p.y > box.y1 && p.y < box.y2;
  }

  /** True when an entity circle can rest here without overlapping walls or sitting inside a box. */
  isFreePosition(pos: Point, radius: number): boolean {
    for (const box of this.sector.boxes) {
      if (this.isInsideBox(pos, box)) return false;
    }
    const resolved = this.resolveCircleCollision(pos, radius);
    return Math.hypot(resolved.x - pos.x, resolved.y - pos.y) < 0.01;
  }

  /**
   * Picks a walkable edge spawn for evac horde waves. Retries random edge
   * points, then falls back near the player spawn so a zombie never appears
   * trapped inside off-roof blockers.
   */
  rollSurgeSpawn(rand: () => number, radius = 16): Point {
    for (let attempt = 0; attempt < 64; attempt++) {
      const candidate = rawSurgeSpawnPoint(rand);
      if (this.isFreePosition(candidate, radius)) return candidate;
    }

    const base = this.sector.playerSpawns[0];
    const goal = this.extractionZone.radius > 0 ? this.extractionZone : base;
    for (let attempt = 0; attempt < 32; attempt++) {
      const angle = rand() * Math.PI * 2;
      const dist = 80 + rand() * 160;
      const candidate = { x: base.x + Math.cos(angle) * dist, y: base.y + Math.sin(angle) * dist };
      if (!this.isFreePosition(candidate, radius)) continue;
      if (this.nav.findPath(candidate, goal).length > 0) return candidate;
    }

    return base;
  }

  /** Pushes a moving circle out of any wall it is penetrating. Returns the resolved position. */
  resolveCircleCollision(pos: Point, radius: number): Point {
    let { x, y } = this.ejectFromBoxes(pos, radius);

    for (let pass = 0; pass < 3; pass++) {
      for (const seg of this.walls) {
        const closest = closestPointOnSegment({ x, y }, seg.p1, seg.p2);
        const dx = x - closest.x;
        const dy = y - closest.y;
        const distSq = dx * dx + dy * dy;
        if (distSq >= radius * radius) continue;

        if (distSq <= 0.0001) {
          const segDx = seg.p2.x - seg.p1.x;
          const segDy = seg.p2.y - seg.p1.y;
          const len = Math.hypot(segDx, segDy) || 1;
          const nx = -segDy / len;
          const ny = segDx / len;
          x += nx * radius;
          y += ny * radius;
          continue;
        }

        const dist = Math.sqrt(distSq);
        const overlap = radius - dist;
        x += (dx / dist) * overlap;
        y += (dy / dist) * overlap;
      }
    }

    return { x, y };
  }

  /** Shoves a center that landed inside a solid box out to the nearest exterior face. */
  private ejectFromBoxes(pos: Point, radius: number): Point {
    let { x, y } = pos;
    for (const box of this.sector.boxes) {
      if (x <= box.x1 || x >= box.x2 || y <= box.y1 || y >= box.y2) continue;

      const dLeft = x - box.x1;
      const dRight = box.x2 - x;
      const dTop = y - box.y1;
      const dBottom = box.y2 - y;
      const min = Math.min(dLeft, dRight, dTop, dBottom);
      if (min === dLeft) x = box.x1 - radius;
      else if (min === dRight) x = box.x2 + radius;
      else if (min === dTop) y = box.y1 - radius;
      else y = box.y2 + radius;
    }
    return { x, y };
  }

  /** True if the line from a to b is unobstructed. */
  hasLineOfSight(a: Point, b: Point): boolean {
    return lineOfSight(a, b, this.walls);
  }

  /** Number of walls crossed between two points (for sound/light occlusion). */
  countWallsCrossed(a: Point, b: Point): number {
    return countWallsCrossed(a, b, this.walls);
  }

  removePickup(pickup: Pickup) {
    this.pickups = this.pickups.filter(p => p !== pickup);
  }
}

export type { PickupType };
