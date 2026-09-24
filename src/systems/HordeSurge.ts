import { ZombieArchetype } from '../entities/Zombie';

/**
 * Pacing for the final-sector evac holdout. Pure functions so the curve is
 * unit-testable; Game.updateHordeSurge does the spawning.
 *
 * The surge interval tightens as the holdout clock runs — 10s between
 * waves at the start, down to 4s in the last stretch — so the climax
 * actually builds instead of trickling one zombie every 10s throughout.
 */
export const SURGE_START_INTERVAL_SEC = 10;
export const SURGE_MIN_INTERVAL_SEC = 4;
/** Seconds of holdout it takes to shave one second off the interval. */
const SURGE_RAMP_SEC_PER_SEC = 20;

/** Seconds until the next wave, given how far into the holdout the team is. */
export function surgeInterval(holdoutElapsedSec: number, minIntervalSec = SURGE_MIN_INTERVAL_SEC): number {
  return Math.max(minIntervalSec, SURGE_START_INTERVAL_SEC - holdoutElapsedSec / SURGE_RAMP_SEC_PER_SEC);
}

/** Zombies per wave — co-op has two guns on the pad, so it gets twice the pressure. */
export function surgeSize(coop: boolean): number {
  return coop ? 2 : 1;
}

/** Weighted wave mix. The brute is rare, but it means the climax can't be held by facing one direction. */
const SURGE_MIX: readonly [ZombieArchetype, number][] = [
  ['lurker', 0.4],
  ['audio_stalker', 0.25],
  ['bio_carrier', 0.25],
  ['armored_brute', 0.1]
];

/** Picks an archetype from a uniform roll in [0, 1). */
export function pickSurgeArchetype(roll: number): ZombieArchetype {
  let acc = 0;
  for (const [archetype, weight] of SURGE_MIX) {
    acc += weight;
    if (roll < acc) return archetype;
  }
  return SURGE_MIX[SURGE_MIX.length - 1][0];
}
