import { Zombie } from '../entities/Zombie';
import { Player } from '../entities/Player';
import { MapManager } from './MapManager';
import { NoiseSystem } from './NoiseSystem';
import { RAIL_MODIFIERS } from '../config/weapons';
import { Point } from '../lighting/Raycaster';
import { DORMANT_NOTICE_RADIUS, SUSPICIOUS_NOTICE_RADIUS, SNEAK_NOISE_RADIUS } from '../config/constants';

const INVESTIGATE_SPEED_MULT = 0.6;
const INVESTIGATE_GIVE_UP_RADIUS = 24;
const SUSPICION_DECAY_SEC = 6.0;
const WAYPOINT_REACHED_PX = 16;
const REPATH_INTERVAL_SEC = 0.5;
/** Repath early if the quarry has moved further than this since the last solve. */
const TARGET_DRIFT_PX = 70;

/** Drives zombie sensory perception (light + sound) and per-state movement/behavior. */
export class AISystem {
  private suspicionTimers = new Map<number, number>();

  /** `noticeMult` scales the close-range notice radii for the run's difficulty. */
  constructor(private noticeMult = 1) {}

  update(dt: number, zombies: Zombie[], players: Player[], map: MapManager): Point[] {
    const livingPlayers = players.filter(p => p.alive && !p.isDowned);

    for (const zombie of zombies) {
      if (!zombie.alive) continue;

      if (zombie.screamCooldown > 0) zombie.screamCooldown -= dt;

      if (zombie.state !== 'ENRAGED' && !zombie.def.isBlindToLight) {
        this.senseLight(dt, zombie, players, map);
      }
      if (zombie.state !== 'ENRAGED') this.senseNearby(zombie, livingPlayers, map);

      if (zombie.repathTimer > 0) zombie.repathTimer -= dt;

      switch (zombie.state) {
        case 'DORMANT':
          break;
        case 'SUSPICIOUS':
          this.updateSuspicious(dt, zombie, map);
          break;
        case 'ENRAGED':
          this.updateEnraged(dt, zombie, livingPlayers, map);
          break;
      }

      const resolved = map.resolveCircleCollision(zombie.position, zombie.radius);
      zombie.x = resolved.x;
      zombie.y = resolved.y;
    }

    this.separateZombies(zombies);
    for (const zombie of zombies) {
      if (!zombie.alive) continue;
      const resolved = map.resolveCircleCollision(zombie.position, zombie.radius);
      zombie.x = resolved.x;
      zombie.y = resolved.y;
    }

    return NoiseSystem.propagateScreams(zombies);
  }

  /** Soft push so horde zombies don't stack into a single sprite pile. */
  private separateZombies(zombies: Zombie[]) {
    for (let i = 0; i < zombies.length; i++) {
      const a = zombies[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < zombies.length; j++) {
        const b = zombies[j];
        if (!b.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.radius + b.radius;
        if (dist <= 0 || dist >= minDist) continue;
        const push = (minDist - dist) * 0.5;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }

  private senseLight(dt: number, zombie: Zombie, players: Player[], map: MapManager) {
    let exposed = false;

    for (const player of players) {
      if (!player.alive || player.isDowned || !player.flashlightOn) continue;
      const mod = RAIL_MODIFIERS[player.activeRail];
      if (mod.rangePx === 0 || !mod.alertsZombies) continue;

      const dx = zombie.x - player.x;
      const dy = zombie.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > mod.rangePx) continue;

      const angleToZombie = Math.atan2(dy, dx);
      let diff = Math.abs(angleToZombie - player.angle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > mod.coneAngleRad / 2) continue;

      if (!map.hasLineOfSight({ x: player.x, y: player.y }, { x: zombie.x, y: zombie.y })) continue;

      exposed = true;
      break;
    }

    if (exposed) {
      zombie.lightExposureTimer += dt;
      if (zombie.lightExposureTimer >= zombie.def.lightAwarenessTimeSec) {
        zombie.alert('ENRAGED', zombie.position);
      }
    } else {
      zombie.lightExposureTimer = Math.max(0, zombie.lightExposureTimer - dt * 2);
    }
  }

  /**
   * Close-range detection that doesn't depend on light or a sound event:
   * a player in plain view, moving faster than a sneak, within the notice
   * radius for the zombie's state (tight while dormant, wider once
   * suspicious). Sneaking or standing still slips past — the stealth
   * option the knife backstab relies on. Works for blind zombies too:
   * at this range they feel the footsteps.
   */
  private senseNearby(zombie: Zombie, players: Player[], map: MapManager) {
    const radius = (zombie.state === 'SUSPICIOUS' ? SUSPICIOUS_NOTICE_RADIUS : DORMANT_NOTICE_RADIUS) * this.noticeMult;
    for (const player of players) {
      if (player.noiseRadius <= SNEAK_NOISE_RADIUS) continue;
      if (Math.hypot(player.x - zombie.x, player.y - zombie.y) > radius) continue;
      if (!map.hasLineOfSight(zombie.position, player.position)) continue;
      zombie.alert('ENRAGED', player.position);
      return;
    }
  }

  /**
   * Walks toward a target, going straight when it's in sight and otherwise
   * following an A* path through the sector so walls get routed around.
   */
  private steer(zombie: Zombie, target: Point, speed: number, dt: number, map: MapManager) {
    if (map.hasLineOfSight(zombie.position, target)) {
      zombie.clearPath();
      zombie.moveToward(target, speed, dt);
      return;
    }

    const drifted =
      !zombie.pathTarget || Math.hypot(zombie.pathTarget.x - target.x, zombie.pathTarget.y - target.y) > TARGET_DRIFT_PX;

    if (!zombie.hasPath || drifted || zombie.repathTimer <= 0) {
      zombie.setPath(map.nav.findPath(zombie.position, target), target);
      // Stagger solves so a whole horde never repaths on the same frame.
      zombie.repathTimer = REPATH_INTERVAL_SEC + Math.random() * 0.25;
    }

    while (zombie.waypoint && Math.hypot(zombie.waypoint.x - zombie.x, zombie.waypoint.y - zombie.y) < WAYPOINT_REACHED_PX) {
      zombie.advanceWaypoint();
    }

    const next = zombie.waypoint ?? target;
    zombie.moveToward(next, speed, dt);
  }

  private updateSuspicious(dt: number, zombie: Zombie, map: MapManager) {
    if (!zombie.investigateTarget) {
      zombie.state = 'DORMANT';
      return;
    }

    const dist = Math.hypot(zombie.investigateTarget.x - zombie.x, zombie.investigateTarget.y - zombie.y);
    if (dist > INVESTIGATE_GIVE_UP_RADIUS) {
      this.steer(zombie, zombie.investigateTarget, zombie.def.walkSpeed * INVESTIGATE_SPEED_MULT, dt, map);
    }

    const timer = (this.suspicionTimers.get(zombie.id) ?? 0) + dt;
    this.suspicionTimers.set(zombie.id, timer);
    if (timer >= SUSPICION_DECAY_SEC) {
      this.suspicionTimers.delete(zombie.id);
      zombie.state = 'DORMANT';
      zombie.investigateTarget = null;
      zombie.lightExposureTimer = 0;
    }
  }

  private updateEnraged(dt: number, zombie: Zombie, players: Player[], map: MapManager) {
    this.suspicionTimers.delete(zombie.id);
    if (players.length === 0) return;

    let nearest = players[0];
    let nearestDist = Infinity;
    for (const p of players) {
      const d = Math.hypot(p.x - zombie.x, p.y - zombie.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = p;
      }
    }

    this.steer(zombie, nearest.position, zombie.def.sprintSpeed, dt, map);
  }
}
