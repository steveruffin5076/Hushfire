import { Point } from '../lighting/Raycaster';

export interface CameraTarget extends Point {
  alive: boolean;
}

/**
 * Tracks the midpoint of both operatives, zooming out to keep both on screen
 * when they split up, and clamping to the sector bounds. Sector 1's play area
 * currently fits the viewport exactly, so this mostly no-ops there, but it's
 * ready for the larger Sector 2/3 maps.
 */
/** Trauma decays this fast per second once nothing is adding to it. */
const SHAKE_DECAY = 1.2;
/** Screen-space px at full (1.0) trauma — shake scales with trauma^2, so small hits barely move the camera. */
const SHAKE_MAX_OFFSET = 10;

export class Camera {
  public x: number;
  public y: number;
  public zoom = 1;

  private trauma = 0;
  private shakeClock = 0;
  private shakeOffsetX = 0;
  private shakeOffsetY = 0;

  constructor(
    private viewportWidth: number,
    private viewportHeight: number,
    private worldMinX: number,
    private worldMinY: number,
    private worldMaxX: number,
    private worldMaxY: number
  ) {
    this.x = viewportWidth / 2;
    this.y = viewportHeight / 2;
  }

  update(targets: CameraTarget[], dt: number) {
    const alive = targets.filter(t => t.alive);
    const pts = alive.length > 0 ? alive : targets;
    if (pts.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const spreadW = maxX - minX + 400;
    const spreadH = maxY - minY + 300;

    const targetZoom = Math.min(1, this.viewportWidth / spreadW, this.viewportHeight / spreadH);
    const lerp = Math.min(1, dt * 4);

    this.x += (centerX - this.x) * lerp;
    this.y += (centerY - this.y) * lerp;
    this.zoom += (targetZoom - this.zoom) * lerp;

    const halfW = this.viewportWidth / (2 * this.zoom);
    const halfH = this.viewportHeight / (2 * this.zoom);
    this.x = Math.min(Math.max(this.x, this.worldMinX + halfW), this.worldMaxX - halfW);
    this.y = Math.min(Math.max(this.y, this.worldMinY + halfH), this.worldMaxY - halfH);
  }

  getViewRect() {
    const halfW = this.viewportWidth / (2 * this.zoom);
    const halfH = this.viewportHeight / (2 * this.zoom);
    return { x: this.x - halfW, y: this.y - halfH, width: halfW * 2, height: halfH * 2 };
  }

  /** Adds screen shake "trauma" — hits accumulate (clamped to 1), they don't reset, so overlapping impacts compound up to the cap instead of restarting the decay. */
  addTrauma(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Decays trauma and samples the shake offset for this frame. Call once per fixed update tick. */
  updateShake(dt: number) {
    if (this.trauma <= 0) {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      return;
    }
    this.trauma = Math.max(0, this.trauma - SHAKE_DECAY * dt);
    const shake = this.trauma * this.trauma; // quadratic: gentle at low trauma, sharp punch at high
    this.shakeClock += dt * 30;
    // Sampled sine, not a fresh random offset each frame — random-every-frame reads as buzzing static.
    this.shakeOffsetX = SHAKE_MAX_OFFSET * shake * Math.sin(this.shakeClock * 1.7);
    this.shakeOffsetY = SHAKE_MAX_OFFSET * shake * Math.sin(this.shakeClock * 2.3);
  }

  apply(ctx: CanvasRenderingContext2D) {
    ctx.translate(this.viewportWidth / 2 + this.shakeOffsetX, this.viewportHeight / 2 + this.shakeOffsetY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  /** Inverse of apply(): canvas-pixel coordinates (e.g. InputManager.mousePos) to world space. */
  screenToWorld(p: Point): Point {
    return {
      x: this.x + (p.x - this.viewportWidth / 2 - this.shakeOffsetX) / this.zoom,
      y: this.y + (p.y - this.viewportHeight / 2 - this.shakeOffsetY) / this.zoom
    };
  }

  /**
   * Forward transform, exact inverse of screenToWorld(): world coordinates to
   * canvas pixels. Lets HUD elements that are anchored to a world position be
   * drawn in screen space instead — i.e. after the lighting pass, so the
   * darkness mask can't bury them.
   */
  worldToScreen(p: Point): Point {
    return {
      x: (p.x - this.x) * this.zoom + this.viewportWidth / 2 + this.shakeOffsetX,
      y: (p.y - this.y) * this.zoom + this.viewportHeight / 2 + this.shakeOffsetY
    };
  }
}
