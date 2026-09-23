import { Entity } from './Entity';

export type ProjectileKind = 'bolt';

const BOLT_SPEED = 1400; // px/s

export class Projectile extends Entity {
  public kind: ProjectileKind;
  public angle: number;
  public damage: number;
  public ownerId: number;
  /** Captured from the shooter's ammo at the moment of firing — the bolt can be
   *  mid-flight by the time it lands, after the shooter has switched weapons,
   *  so it must not re-read whatever ammo type happens to be active on impact. */
  public armorPen: number;
  public stuck = false;
  public speed = BOLT_SPEED;

  constructor(x: number, y: number, angle: number, damage: number, ownerId: number, armorPen: number, kind: ProjectileKind = 'bolt') {
    super(x, y, 4, 1);
    this.kind = kind;
    this.angle = angle;
    this.damage = damage;
    this.ownerId = ownerId;
    this.armorPen = armorPen;
  }

  update(dt: number) {
    if (this.stuck) return;
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
  }

  stick() {
    this.stuck = true;
    this.speed = 0;
  }
}
