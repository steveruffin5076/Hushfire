import { Point } from './Raycaster';
import { FlashlightBeam } from './Flashlight';
import { DARKNESS_COLOR } from '../config/constants';

export interface RadialLight {
  origin: Point;
  radius: number;
}

export type MuzzleFlashPulse = RadialLight;

export interface ViewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Renders the pitch-black ambient mask, punching out player flashlight cones,
 * lasers, and muzzle-flash pulses with destination-out compositing.
 *
 * The mask is built on an offscreen buffer rather than directly on the main
 * canvas: destination-out erases whatever pixels are already there, and the
 * scene (floor, walls, zombies, players) is drawn on the SAME main canvas
 * before this runs, so punching holes directly on it would erase the scene
 * too, not just the darkness — leaving transparent pixels that show the
 * canvas's own near-black CSS background instead of the lit world beneath.
 * Building the mask on its own transparent buffer and compositing that with
 * a normal draw avoids that.
 */
export class ShadowRenderer {
  private static offscreen: HTMLCanvasElement | null = null;

  private static getOffscreen(width: number, height: number): HTMLCanvasElement {
    if (!this.offscreen) this.offscreen = document.createElement('canvas');
    if (this.offscreen.width !== width || this.offscreen.height !== height) {
      this.offscreen.width = width;
      this.offscreen.height = height;
    }
    return this.offscreen;
  }

  static render(
    mainCtx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    applyCameraTransform: (ctx: CanvasRenderingContext2D) => void,
    viewRect: ViewRect,
    beams: FlashlightBeam[],
    muzzleFlashes: MuzzleFlashPulse[],
    carryLights: RadialLight[] = []
  ) {
    const offCanvas = this.getOffscreen(canvasWidth, canvasHeight);
    const ctx = offCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    ctx.save();
    applyCameraTransform(ctx);

    ctx.fillStyle = DARKNESS_COLOR;
    ctx.fillRect(viewRect.x, viewRect.y, viewRect.width, viewRect.height);

    ctx.globalCompositeOperation = 'destination-out';

    for (const beam of beams) {
      if (beam.isLaser && beam.laserEnd) {
        this.renderLaser(ctx, beam.origin, beam.laserEnd);
      } else if (beam.polygon.length >= 3) {
        this.renderLightPolygon(ctx, beam.polygon, beam.origin, beam.range);
      }
    }

    for (const flash of muzzleFlashes) {
      const grad = ctx.createRadialGradient(flash.origin.x, flash.origin.y, 0, flash.origin.x, flash.origin.y, flash.radius);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(flash.origin.x, flash.origin.y, flash.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // The cone's apex IS the operative, so their own body always fell outside
    // their own light — the rear half of the sprite measured as pitch black.
    // A small spill disc around each one keeps them (and what they're standing
    // on) readable without lifting the sector's darkness.
    for (const light of carryLights) {
      this.punchDisc(ctx, light, [
        [0, 1],
        [0.55, 0.95],
        [1, 0]
      ]);
    }

    // Punching a hole only reveals the (very dark) floor underneath — a real
    // flashlight should also actively brighten what it's shining on. Add a
    // warm glow with additive blending on top of the revealed area.
    ctx.globalCompositeOperation = 'lighter';

    // Kept deliberately below saturation: the hole punched above already reveals
    // the scene's true colours, and a hotter glow clips sprites to flat white.
    for (const beam of beams) {
      if (!beam.isLaser && beam.polygon.length >= 3) {
        this.renderGlowPolygon(ctx, beam.polygon, beam.origin, beam.range);
      }
    }

    for (const flash of muzzleFlashes) {
      const grad = ctx.createRadialGradient(flash.origin.x, flash.origin.y, 0, flash.origin.x, flash.origin.y, flash.radius);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(flash.origin.x, flash.origin.y, flash.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Weaker than the beam glow: enough to read the operative, not enough to
    // make standing still as informative as sweeping the light around.
    for (const light of carryLights) {
      const grad = ctx.createRadialGradient(light.origin.x, light.origin.y, 0, light.origin.x, light.origin.y, light.radius);
      grad.addColorStop(0, 'rgba(226, 236, 255, 0.3)');
      grad.addColorStop(0.6, 'rgba(206, 220, 245, 0.18)');
      grad.addColorStop(1, 'rgba(180, 196, 225, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(light.origin.x, light.origin.y, light.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
    for (const beam of beams) {
      if (beam.isLaser && beam.laserEnd) this.renderLaserGlow(ctx, beam.origin, beam.laserEnd);
    }

    ctx.restore();

    mainCtx.drawImage(offCanvas, 0, 0);
  }

  /** Erases a soft-edged circle from the darkness. `stops` are [offset, alpha] pairs. */
  private static punchDisc(ctx: CanvasRenderingContext2D, light: RadialLight, stops: [number, number][]) {
    const grad = ctx.createRadialGradient(light.origin.x, light.origin.y, 0, light.origin.x, light.origin.y, light.radius);
    for (const [offset, alpha] of stops) grad.addColorStop(offset, `rgba(255, 255, 255, ${alpha})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(light.origin.x, light.origin.y, light.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  private static renderLightPolygon(ctx: CanvasRenderingContext2D, poly: Point[], origin: Point, range: number) {
    const grad = ctx.createRadialGradient(origin.x, origin.y, 10, origin.x, origin.y, range);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.65, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.88, 'rgba(255, 255, 255, 0.9)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fill();
  }

  private static renderGlowPolygon(ctx: CanvasRenderingContext2D, poly: Point[], origin: Point, range: number) {
    const grad = ctx.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, range);
    grad.addColorStop(0, 'rgba(255, 246, 222, 0.42)');
    grad.addColorStop(0.45, 'rgba(255, 232, 190, 0.34)');
    grad.addColorStop(0.8, 'rgba(255, 208, 150, 0.18)');
    grad.addColorStop(1, 'rgba(255, 190, 120, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fill();
  }

  private static renderLaser(ctx: CanvasRenderingContext2D, origin: Point, end: Point) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(end.x, end.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private static renderLaserGlow(ctx: CanvasRenderingContext2D, origin: Point, end: Point) {
    ctx.save();
    ctx.strokeStyle = 'rgba(80, 255, 120, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#50FF78';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();
  }
}
