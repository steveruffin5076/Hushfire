export type PickupType = 'ammo' | 'medkit' | 'battery' | 'keycard';

const PICKUP_RADIUS = 14;

export class Pickup {
  public x: number;
  public y: number;
  public radius = PICKUP_RADIUS;
  public type: PickupType;
  public collected = false;

  constructor(x: number, y: number, type: PickupType) {
    this.x = x;
    this.y = y;
    this.type = type;
  }
}
