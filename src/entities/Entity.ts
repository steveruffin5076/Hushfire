import { Point } from '../lighting/Raycaster';

let nextEntityId = 1;

export abstract class Entity {
  public readonly id: number;
  public x: number;
  public y: number;
  public vx = 0;
  public vy = 0;
  public radius: number;
  public health: number;
  public maxHealth: number;

  constructor(x: number, y: number, radius: number, maxHealth: number) {
    this.id = nextEntityId++;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.maxHealth = maxHealth;
    this.health = maxHealth;
  }

  get alive(): boolean {
    return this.health > 0;
  }

  get position(): Point {
    return { x: this.x, y: this.y };
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
  }
}
