import { Entity } from './Entity';
import { ThrowableKind } from '../config/throwables';

/** In-flight grenade / flare — detonates on impact (wall or target point). */
export class ThrownGrenade extends Entity {
  public readonly kind: ThrowableKind;
  public readonly ownerId: number;
  private readonly targetX: number;
  private readonly targetY: number;
  private readonly speed: number;
  public fuse = 0;

  constructor(
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    kind: ThrowableKind,
    ownerId: number,
    speed: number
  ) {
    super(x, y, 6, 1);
    this.kind = kind;
    this.ownerId = ownerId;
    this.targetX = targetX;
    this.targetY = targetY;
    this.speed = speed;
  }

  update(dt: number): boolean {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (dist <= step) {
      this.x = this.targetX;
      this.y = this.targetY;
      return true;
    }
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
    this.fuse += dt;
    return false;
  }
}
