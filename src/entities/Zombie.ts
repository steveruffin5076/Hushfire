import { Entity } from './Entity';
import { ZombieState, ZOMBIE_REGISTRY } from '../config/zombies';
import { Point } from '../lighting/Raycaster';

export type ZombieArchetype = 'lurker' | 'audio_stalker' | 'bio_carrier' | 'armored_brute';

const ZOMBIE_RADIUS = 16;

export class Zombie extends Entity {
  public archetype: ZombieArchetype;
  public angle: number;
  public state: ZombieState = 'DORMANT';
  public lightExposureTimer = 0;
  public investigateTarget: Point | null = null;
  public screamCooldown = 0;
  public hasExploded = false;

  private path: Point[] = [];
  private pathIndex = 0;
  /** Where the path was computed toward, so we can repath when the quarry moves. */
  public pathTarget: Point | null = null;
  public repathTimer = 0;
  /** Staggered so a horde doesn't groan in unison. */
  public groanTimer = 2 + Math.random() * 8;

  /** Brief white flash on taking a hit that didn't kill it. */
  public hitFlashTimer = 0;
  /** Decaying cosmetic push-back from the last hit — never wall-collision-checked itself, so it's purely visual punch, not a real shove. */
  public knockbackX = 0;
  public knockbackY = 0;
  /** >0 while playing its death pop/shrink animation; removed from play once this hits 0. */
  public deathTimer = 0;
  private static readonly DEATH_ANIM_SEC = 0.35;

  constructor(x: number, y: number, angle: number, archetype: ZombieArchetype) {
    const def = ZOMBIE_REGISTRY[archetype];
    super(x, y, ZOMBIE_RADIUS, def.maxHealth);
    this.archetype = archetype;
    this.angle = angle;
  }

  get def() {
    return ZOMBIE_REGISTRY[this.archetype];
  }

  moveToward(target: Point, speed: number, dt: number) {
    const angle = Math.atan2(target.y - this.y, target.x - this.x);
    this.angle = angle;
    this.x += Math.cos(angle) * speed * dt;
    this.y += Math.sin(angle) * speed * dt;
  }

  setPath(path: Point[], target: Point) {
    this.path = path;
    this.pathIndex = 0;
    this.pathTarget = { ...target };
  }

  clearPath() {
    this.path = [];
    this.pathIndex = 0;
    this.pathTarget = null;
  }

  get hasPath(): boolean {
    return this.pathIndex < this.path.length;
  }

  get waypoint(): Point | null {
    return this.path[this.pathIndex] ?? null;
  }

  advanceWaypoint() {
    this.pathIndex++;
  }

  alert(newState: Extract<ZombieState, 'SUSPICIOUS' | 'ENRAGED'>, source: Point) {
    if (this.state === 'ENRAGED') return;
    this.state = newState;
    this.investigateTarget = source;
  }

  get isDying(): boolean {
    return this.deathTimer > 0;
  }

  /** 0 (just died) -> 1 (animation finished) — Game.ts renders the death pop/shrink from this. */
  get deathProgress(): number {
    return 1 - this.deathTimer / Zombie.DEATH_ANIM_SEC;
  }

  startDying() {
    this.deathTimer = Zombie.DEATH_ANIM_SEC;
  }

  /**
   * Decays hit-flash/knockback/death-animation timers — called every tick
   * regardless of AI state, since a dying or just-hit zombie isn't running
   * its normal sensory/movement update anymore.
   */
  updateJuice(dt: number) {
    if (this.hitFlashTimer > 0) this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    if (this.deathTimer > 0) this.deathTimer = Math.max(0, this.deathTimer - dt);

    if (this.knockbackX !== 0 || this.knockbackY !== 0) {
      this.x += this.knockbackX * dt;
      this.y += this.knockbackY * dt;
      const decay = Math.exp(-dt * 8); // bleeds off quickly — a punch, not a slide
      this.knockbackX *= decay;
      this.knockbackY *= decay;
      if (Math.abs(this.knockbackX) < 0.5) this.knockbackX = 0;
      if (Math.abs(this.knockbackY) < 0.5) this.knockbackY = 0;
    }
  }
}
