import { describe, it, expect } from 'vitest';
import { MapManager } from '../src/systems/MapManager';
import { SECTORS, BoxDef } from '../src/config/sectors';
import { Point } from '../src/lighting/Raycaster';

// Guards the wall/art alignment work: every spawn, pickup and goal must sit on
// walkable floor inside the map, and be reachable from where the players start.
const MAP_MIN = 20;
const MAP_MAX_X = 1260;
const MAP_MAX_Y = 700;
const ENTITY_RADIUS = 16;

const insideBox = (p: Point, b: BoxDef) => p.x > b.x1 && p.x < b.x2 && p.y > b.y1 && p.y < b.y2;

SECTORS.forEach((sector, index) => {
  describe(sector.name, () => {
    const points: { label: string; p: Point }[] = [
      ...sector.playerSpawns.map((p, i) => ({ label: `P${i + 1} spawn`, p })),
      ...sector.zombies.map(z => ({ label: `${z.archetype} @${z.x},${z.y}`, p: z })),
      ...sector.pickups.map(p => ({ label: `${p.type} pickup @${p.x},${p.y}`, p })),
      { label: 'objective', p: sector.objective },
      ...(sector.exitZone ? [{ label: 'exit zone', p: sector.exitZone }] : []),
      ...(sector.evacZone ? [{ label: 'evac zone', p: sector.evacZone }] : [])
    ];

    it.each(points)('$label is inside the map and not inside a wall', ({ p }) => {
      expect(p.x).toBeGreaterThan(MAP_MIN);
      expect(p.x).toBeLessThan(MAP_MAX_X);
      expect(p.y).toBeGreaterThan(MAP_MIN);
      expect(p.y).toBeLessThan(MAP_MAX_Y);
      for (const box of sector.boxes) expect(insideBox(p, box)).toBe(false);
    });

    it('spawns players and zombies without overlapping a wall', () => {
      const map = new MapManager();
      map.loadSector(index);
      for (const p of [...sector.playerSpawns, ...sector.zombies]) {
        const resolved = map.resolveCircleCollision({ x: p.x, y: p.y }, ENTITY_RADIUS);
        expect(resolved.x).toBeCloseTo(p.x, 5);
        expect(resolved.y).toBeCloseTo(p.y, 5);
      }
    });

    it('lets players reach every pickup and goal once the objective is done', () => {
      const map = new MapManager();
      map.loadSector(index);
      map.completeObjective();
      const start = sector.playerSpawns[0];
      const goals = [
        ...sector.pickups,
        sector.objective,
        ...(sector.exitZone ? [sector.exitZone] : []),
        ...(sector.evacZone ? [sector.evacZone] : [])
      ];
      for (const goal of goals) {
        expect(map.nav.findPath(start, goal), `no path to ${goal.x},${goal.y}`).not.toHaveLength(0);
      }
    });
  });
});
