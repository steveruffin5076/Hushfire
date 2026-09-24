import { describe, it, expect } from 'vitest';
import { MapManager } from '../src/systems/MapManager';
import { SECTORS } from '../src/config/sectors';

const RADIUS = 16;

describe('MapManager.resolveCircleCollision', () => {
  const map = new MapManager();

  it('leaves a circle in open floor untouched', () => {
    const spawn = SECTORS[0].playerSpawns[0];
    expect(map.resolveCircleCollision(spawn, RADIUS)).toEqual(spawn);
  });

  it('pushes a circle back inside the outer map boundary', () => {
    // Outer walls run along x=20 and y=20.
    const out = map.resolveCircleCollision({ x: 25, y: 360 }, RADIUS);
    expect(out.x).toBeCloseTo(20 + RADIUS, 5);
    expect(out.y).toBe(360);

    const corner = map.resolveCircleCollision({ x: 24, y: 24 }, RADIUS);
    expect(corner.x).toBeGreaterThanOrEqual(20 + RADIUS - 1e-6);
    expect(corner.y).toBeGreaterThanOrEqual(20 + RADIUS - 1e-6);
  });

  it('pushes a circle out of an interior wall face', () => {
    // Sector 1's first box spans x 310-395; approach its left face.
    const out = map.resolveCircleCollision({ x: 300, y: 150 }, RADIUS);
    expect(out.x).toBeCloseTo(310 - RADIUS, 5);
  });

  it('ejects a circle trapped inside a solid box interior', () => {
    const sector3 = new MapManager();
    sector3.loadSector(2);
    const inside = { x: 60, y: 100 };
    expect(sector3.isInsideBox(inside, sector3.sector.boxes[6])).toBe(true);

    const out = sector3.resolveCircleCollision(inside, RADIUS);
    expect(sector3.sector.boxes.some(box => sector3.isInsideBox(out, box))).toBe(false);
    expect(out.y).toBeLessThanOrEqual(200 - RADIUS + 1e-3);
  });

  it('keeps a circle out of the blast door until the objective completes', () => {
    const door = SECTORS[0].doorWalls[0];
    const nearDoor = { x: door.p1.x - 8, y: (door.p1.y + door.p2.y) / 2 };
    expect(map.resolveCircleCollision(nearDoor, RADIUS).x).toBeCloseTo(door.p1.x - RADIUS, 5);

    const opened = new MapManager();
    opened.completeObjective();
    expect(opened.resolveCircleCollision(nearDoor, RADIUS)).toEqual(nearDoor);
  });
});
