import { Point } from '../lighting/Raycaster';
import { Zombie } from '../entities/Zombie';
import { MapManager } from './MapManager';
import {
  WALL_SOUND_DAMPENING,
  ZOMBIE_AWARENESS_THRESHOLD,
  ZOMBIE_ENRAGE_THRESHOLD,
  GUNSHOT_ENRAGE_THRESHOLD,
  ZOMBIE_SCREAM_ALERT_RADIUS
} from '../config/constants';

export type SoundType = 'gunshot' | 'footstep' | 'scream' | 'explosion';

export interface SoundEvent {
  x: number;
  y: number;
  radius: number;
  type: SoundType;
}

/**
 * Propagates radial sound circles from gunshots/footsteps/screams to zombies,
 * damping the effective radius for every wall crossed along the line of travel.
 */
export class NoiseSystem {
  private queue: SoundEvent[] = [];

  emit(event: SoundEvent) {
    if (event.radius <= 0) return;
    this.queue.push(event);
  }

  /** Applies all queued sound events to the zombie roster, then clears the queue. */
  propagate(zombies: Zombie[], map: MapManager) {
    for (const event of this.queue) {
      for (const zombie of zombies) {
        if (!zombie.alive || zombie.state === 'ENRAGED') continue;

        const origin: Point = { x: event.x, y: event.y };
        const target: Point = { x: zombie.x, y: zombie.y };
        const dist = Math.hypot(target.x - origin.x, target.y - origin.y);
        if (dist > event.radius * 1.5) continue;

        const wallsCrossed = map.countWallsCrossed(origin, target);
        const effectiveRadius = event.radius * Math.pow(1 - WALL_SOUND_DAMPENING, wallsCrossed);
        if (effectiveRadius <= 0) continue;

        const intensity = Math.max(0, 1 - dist / effectiveRadius);
        if (intensity <= 0) continue;

        const enrageAt = event.type === 'gunshot' ? GUNSHOT_ENRAGE_THRESHOLD : ZOMBIE_ENRAGE_THRESHOLD;
        if (intensity >= enrageAt || event.type === 'explosion') {
          zombie.alert('ENRAGED', origin);
        } else if (intensity >= ZOMBIE_AWARENESS_THRESHOLD) {
          zombie.alert('SUSPICIOUS', origin);
        }
      }
    }

    this.queue = [];
  }

  /** Screaming zombies (ENRAGED) instantly alert nearby dormant zombies within earshot, ignoring walls. */
  static propagateScreams(zombies: Zombie[]): Point[] {
    const heard: Point[] = [];
    // A dying zombie now lingers briefly for its death animation (still ENRAGED,
    // no longer alive) — exclude it so a fresh kill can't scream and alert the sector.
    const screamers = zombies.filter(z => z.alive && z.state === 'ENRAGED' && z.screamCooldown <= 0);
    for (const screamer of screamers) {
      screamer.screamCooldown = 4.0;
      heard.push({ x: screamer.x, y: screamer.y });
      for (const other of zombies) {
        if (other === screamer || !other.alive || other.state === 'ENRAGED') continue;
        const dist = Math.hypot(other.x - screamer.x, other.y - screamer.y);
        if (dist <= ZOMBIE_SCREAM_ALERT_RADIUS) {
          other.alert('ENRAGED', { x: screamer.x, y: screamer.y });
        }
      }
    }
    return heard;
  }
}
