import { Player } from '../entities/Player';
import { WEAPON_REGISTRY } from '../config/weapons';
import { MapManager } from '../systems/MapManager';
import { CANVAS_WIDTH } from '../config/constants';
import { AssetLoader } from '../core/AssetLoader';
import { Point } from '../lighting/Raycaster';

const PANEL_COLOR = '#EBF4FA';

export class HUD {
  private rippleClock = 0;

  constructor(private assets: AssetLoader) {}

  /**
   * World-space HUD elements (tied to player position) — call while the
   * camera transform is active. `p1MouseWorld` is P1's actual mouse cursor
   * converted to world space, so their reticle tracks the pointer exactly
   * instead of just sitting a fixed distance out along the aim angle; P2
   * has no physical mouse (keyboard aim or bot), so it keeps that fallback.
   */
  renderWorldSpace(ctx: CanvasRenderingContext2D, p1: Player, p2: Player, p1MouseWorld?: Point) {
    this.rippleClock += 1 / 60;
    this.renderDecibelRipple(ctx, p1);
    if (!p2.isEliminated) this.renderDecibelRipple(ctx, p2);
    this.renderReticle(ctx, p1, p1MouseWorld);
    if (!p2.isEliminated) this.renderReticle(ctx, p2);
  }

  /**
   * Screen-space HUD elements (fixed panels/text) — call after the camera
   * transform is reset. P2's panel is skipped once eliminated: permanently
   * absent in solo mode (there was never a second operative to report on),
   * or genuinely dead in co-op, where a stale "HP: 0/120" panel would just
   * be confusing.
   */
  renderScreenSpace(ctx: CanvasRenderingContext2D, p1: Player, p2: Player, map: MapManager) {
    this.renderPlayerPanel(ctx, p1, 30, 30);
    if (!p2.isEliminated) this.renderPlayerPanel(ctx, p2, CANVAS_WIDTH - 330, 30);
    this.renderMissionStatus(ctx, map);
  }

  private renderPlayerPanel(ctx: CanvasRenderingContext2D, p: Player, x: number, y: number) {
    ctx.save();
    ctx.font = '13px monospace';
    ctx.fillStyle = PANEL_COLOR;

    const label = p.isDowned ? 'DOWNED — NEEDS REVIVE' : `HP: ${Math.round(p.health)}/${p.maxHealth}`;
    ctx.fillText(`P${p.playerNumber} — ${label}`, x, y);

    if (!p.isDowned) {
      const weapon = WEAPON_REGISTRY[p.activeWeaponId];
      ctx.fillStyle = '#00E5FF';
      const ammoLabel = p.isReloading ? 'RELOADING...' : `${p.currentMag}/${p.reserveAmmo}`;
      ctx.fillText(`${weapon.name} [${p.activeMuzzle.toUpperCase()}] — ${ammoLabel}`, x, y + 20);

      ctx.fillStyle = p.noiseRadius > 150 ? '#FF5252' : p.noiseRadius > 40 ? '#FFC107' : '#00E676';
      ctx.fillText(`NOISE: ${Math.round(p.noiseRadius)} px`, x, y + 40);
    } else {
      ctx.fillStyle = '#FF5252';
      ctx.fillText('Hold F near partner to revive', x, y + 20);
    }

    // Health bar
    ctx.strokeStyle = '#3A4252';
    ctx.strokeRect(x, y + 50, 200, 8);
    ctx.fillStyle = p.health > p.maxHealth * 0.3 ? '#00E676' : '#FF5252';
    ctx.fillRect(x, y + 50, 200 * (p.health / p.maxHealth), 8);

    ctx.restore();
  }

  private renderMissionStatus(ctx: CanvasRenderingContext2D, map: MapManager) {
    const zone = map.extractionZone;
    const centered = (text: string, y: number) => {
      ctx.fillText(text, CANVAS_WIDTH / 2 - ctx.measureText(text).width / 2, y);
    };

    ctx.save();
    ctx.font = '14px monospace';
    ctx.fillStyle = '#8A94A6';
    centered(map.sector.name, 30);

    ctx.font = '13px monospace';
    if (zone.isComplete) {
      ctx.fillStyle = '#00E676';
      centered('EXTRACTION COMPLETE', 52);
    } else if (zone.isActive) {
      ctx.fillStyle = '#FF5252';
      centered(`HOLDOUT — ${Math.ceil(zone.holdoutTimer)}s UNTIL EVAC`, 52);
    } else if (map.objectiveComplete) {
      ctx.fillStyle = '#00E676';
      centered(zone.radius > 0 ? 'OBJECTIVE DONE — BOARD THE EVAC PAD' : 'OBJECTIVE DONE — MOVE TO EXIT', 52);
    } else {
      ctx.fillStyle = '#FF9E1B';
      centered(map.sector.briefing, 52);
    }
    ctx.restore();
  }

  private renderDecibelRipple(ctx: CanvasRenderingContext2D, p: Player) {
    if (p.isDowned || p.noiseRadius < 20) return;

    // Ring expands to the actual alert radius for the current action, per the art spec.
    const pulse = (this.rippleClock * 2) % 1;
    const radius = p.noiseRadius * (0.35 + pulse * 0.65);
    const alpha = (1 - pulse) * 0.7;

    if (this.assets.draw(ctx, 'acoustic_ripple', p.x, p.y, 0, radius * 2, alpha)) return;

    ctx.save();
    ctx.strokeStyle = `rgba(0, 230, 118, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private renderReticle(ctx: CanvasRenderingContext2D, p: Player, mouseWorld?: Point) {
    if (p.isDowned || p.isEliminated) return;
    const weapon = WEAPON_REGISTRY[p.activeWeaponId];
    const spread = weapon.pelletCount ? 22 : 12;

    let rx: number;
    let ry: number;
    if (mouseWorld) {
      rx = mouseWorld.x;
      ry = mouseWorld.y;
    } else {
      const reticleDist = 46;
      rx = p.x + Math.cos(p.angle) * reticleDist;
      ry = p.y + Math.sin(p.angle) * reticleDist;
    }

    if (this.assets.draw(ctx, 'reticle_crosshair', rx, ry, 0, spread * 2.4, 0.75)) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(235, 244, 250, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(rx, ry, spread, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
