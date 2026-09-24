import { describe, it, expect } from 'vitest';
import { MapManager } from '../src/systems/MapManager';
import { SECTORS, BoxDef } from '../src/config/sectors';
import { candidateSpots, rollSectorLayout, MIN_ZOMBIE_SPAWN_DIST } from '../src/config/sectorLayout';
import { ZOMBIE_REGISTRY } from '../src/config/zombies';
import { Point } from '../src/lighting/Raycaster';

// Guards the wall/art alignment work and the per-run layout shuffle: every
// spot a spawn, pickup or goal can ever appear at must sit on walkable floor
// inside the map and be reachable from where the players start.
const MAP_MIN = 20;
const MAP_MAX_X = 1260;
const MAP_MAX_Y = 700;
const ENTITY_RADIUS = 16;

const insideBox = (p: Point, b: BoxDef) => p.x > b.x1 && p.x < b.x2 && p.y > b.y1 && p.y < b.y2;

SECTORS.forEach((sector, index) => {
  describe(sector.name, () => {
    const zombieSpots = sector.zombies.flatMap(z =>
      candidateSpots(z).map(p => ({ label: `${z.archetype} @${p.x},${p.y}`, p }))
    );
    const pickupSpots = sector.pickups.flatMap(pk =>
      candidateSpots(pk).map(p => ({ label: `${pk.type} pickup @${p.x},${p.y}`, p }))
    );
    const points: { label: string; p: Point }[] = [
      ...sector.playerSpawns.map((p, i) => ({ label: `P${i + 1} spawn`, p })),
      ...zombieSpots,
      ...pickupSpots,
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

    it('spawns players and every possible zombie spot without overlapping a wall', () => {
      const map = new MapManager();
      map.loadSector(index);
      for (const p of [...sector.playerSpawns, ...zombieSpots.map(z => z.p)]) {
        const resolved = map.resolveCircleCollision({ x: p.x, y: p.y }, ENTITY_RADIUS);
        expect(resolved.x, `${p.x},${p.y}`).toBeCloseTo(p.x, 5);
        expect(resolved.y, `${p.x},${p.y}`).toBeCloseTo(p.y, 5);
      }
    });

    it(`keeps every zombie spot at least ${MIN_ZOMBIE_SPAWN_DIST}px from the player spawns`, () => {
      for (const { label, p } of zombieSpots) {
        for (const spawn of sector.playerSpawns) {
          expect(Math.hypot(p.x - spawn.x, p.y - spawn.y), label).toBeGreaterThanOrEqual(MIN_ZOMBIE_SPAWN_DIST);
        }
      }
    });

    it('lets players reach every pickup spot and the objective before any door opens', () => {
      // The keycard in particular must never roll behind the door it unlocks.
      const map = new MapManager();
      map.loadSector(index);
      const start = sector.playerSpawns[0];
      for (const { label, p } of [...pickupSpots, { label: 'objective', p: sector.objective }]) {
        expect(map.nav.findPath(start, p), `no path to ${label}`).not.toHaveLength(0);
      }
    });

    it('lets players reach the exit once the objective is done', () => {
      const map = new MapManager();
      map.loadSector(index);
      map.completeObjective();
      const start = sector.playerSpawns[0];
      for (const goal of [...(sector.exitZone ? [sector.exitZone] : []), ...(sector.evacZone ? [sector.evacZone] : [])]) {
        expect(map.nav.findPath(start, goal), `no path to ${goal.x},${goal.y}`).not.toHaveLength(0);
      }
    });
  });
});

describe('per-run layout shuffle', () => {
  const sector = SECTORS[0];

  it('picks the primary spot, or a given alternative, from the roll', () => {
    const first = rollSectorLayout(sector, () => 0);
    expect(first.zombies.map(z => [z.x, z.y])).toEqual(sector.zombies.map(z => [z.x, z.y]));
    const last = rollSectorLayout(sector, () => 0.9999);
    expect(last.zombies.map(z => [z.x, z.y])).toEqual(sector.zombies.map(z => {
      const spots = candidateSpots(z);
      return [spots[spots.length - 1].x, spots[spots.length - 1].y];
    }));
  });

  it('never changes what spawns — only where', () => {
    for (const s of SECTORS) {
      const hp = (zs: { archetype: keyof typeof ZOMBIE_REGISTRY }[]) => zs.reduce((n, z) => n + ZOMBIE_REGISTRY[z.archetype].maxHealth, 0);
      const layout = rollSectorLayout(s);
      expect(layout.zombies.map(z => z.archetype)).toEqual(s.zombies.map(z => z.archetype));
      expect(layout.pickups.map(p => p.type)).toEqual(s.pickups.map(p => p.type));
      expect(hp(layout.zombies)).toBe(hp(s.zombies));
    }
  });

  it('actually varies between runs', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) seen.add(JSON.stringify(rollSectorLayout(sector).zombies.map(z => [z.x, z.y])));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('is what MapManager uses for the pickups it places', () => {
    const map = new MapManager();
    map.loadSector(0, () => 0.9999);
    expect(map.pickups.map(p => [p.x, p.y])).toEqual(map.layout.pickups.map(p => [p.x, p.y]));
    expect(map.pickups[0].x).not.toBe(sector.pickups[0].x);
  });
});
