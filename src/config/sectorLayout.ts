import { Point } from '../lighting/Raycaster';
import { SectorDef, ZombieSpawnDef, PickupDef } from './sectors';

/**
 * Per-run shuffle of where each zombie and pickup sits. Every entry in
 * sectors.ts may list `alts`; each run picks one of its primary spot or
 * those alternatives. Types and counts never change, so a sector's total
 * zombie HP and pickup mix stay exactly as tuned — only the route does.
 *
 * tests/sectors.test.ts checks every possible spot (inside the map, not in
 * a wall, reachable, zombies clear of the player spawns), so any roll is safe.
 */

/** No zombie spot may be this close to a player spawn — a bad roll can't start the run on top of a brute. */
export const MIN_ZOMBIE_SPAWN_DIST = 200;

export interface SectorLayout {
  zombies: ZombieSpawnDef[];
  pickups: PickupDef[];
}

/** Every spot an entry can appear at: its primary position first, then its alternatives. */
export function candidateSpots(def: { x: number; y: number; alts?: Point[] }): Point[] {
  return [{ x: def.x, y: def.y }, ...(def.alts ?? [])];
}

function pick<T extends { x: number; y: number; alts?: Point[] }>(def: T, rand: () => number): T {
  const spots = candidateSpots(def);
  const spot = spots[Math.min(spots.length - 1, Math.floor(rand() * spots.length))];
  return { ...def, x: spot.x, y: spot.y };
}

export function rollSectorLayout(sector: SectorDef, rand: () => number = Math.random): SectorLayout {
  return {
    zombies: sector.zombies.map(z => pick(z, rand)),
    pickups: sector.pickups.map(p => pick(p, rand))
  };
}
