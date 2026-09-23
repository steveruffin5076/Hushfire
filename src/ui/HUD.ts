import { Player } from '../entities/Player';
import { WEAPON_REGISTRY } from '../config/weapons';
import { MapManager } from '../systems/MapManager';
import { CANVAS_WIDTH } from '../config/constants';
import { AssetLoader } from '../core/AssetLoader';
import { Point } from '../lighting/Raycaster';

const PANEL_COLOR = '#EBF4FA';
const FLASHLIGHT_BTN_W = 150;
const FLASHLIGHT_BTN_H = 22;
const FLASHLIGHT_BTN_Y_OFFSET = 76;

export class HUD {
  private rippleClock = 0;

  constructor(private assets: AssetLoader) {}

  /**
   * Screen-space bounds of a player's clickable flashlight button, in the
   * same coordinates renderScreenSpace draws their panel at. Shared with
   * Game.ts's click hit-test so the drawn button and the clickable region
   * never drift apart.
   */
  static getFlashlightButtonRect(playerNumber: 1 | 2): { x: number; y: number; w: number; h: number } {
    const x = playerNumber === 1 ? 30 : CANVAS_WIDTH - 330;
    return { x, y: 30 + FLASHLIGHT_BTN_Y_OFFSET, w: FLASHLIGHT_BTN_W, h: FLASHLIGHT_BTN_H };
  }

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

    // Flashlight battery — only worth showing once it's on or actually low,
    // so a fresh spawn's HUD isn't cluttered with an always-full bar.
    if (p.flashlightOn || p.flashlightBattery < 30) {
      ctx.strokeStyle = '#3A4252';
      ctx.strokeRect(x, y + 63, 200, 5);
      ctx.fillStyle = p.flashlightBattery > 30 ? '#00E5FF' : p.flashlightBattery > 0 ? '#FFC107' : '#FF5252';
      ctx.fillRect(x, y + 63, 200 * (p.flashlightBattery / 100), 5);
    }

    this.renderFlashlightButton(ctx, p);

    ctx.restore();
  }

  /** Only P1's button is actually clickable (see Game.ts's canvas click handler) — local
   * co-op shares one mouse, and P2 already has their own dedicated key. Still drawn for
   * both so P2 can read their state and keybind at a glance. */
  private renderFlashlightButton(ctx: CanvasRenderingContext2D, p: Player) {
    const rect = HUD.getFlashlightButtonRect(p.playerNumber);
    const disabled = p.isDowned;
    const key = p.playerNumber === 1 ? 'T' : "'";

    ctx.strokeStyle = disabled ? '#2A2F3A' : p.flashlightOn ? '#00E5FF' : '#3A4252';
    ctx.fillStyle = disabled ? 'rgba(20,22,28,0.6)' : p.flashlightOn ? 'rgba(0,229,255,0.15)' : 'rgba(20,22,28,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 4);
    ctx.fill();
    ctx.stroke();

    ctx.font = '11px monospace';
    ctx.fillStyle = disabled ? '#4A5468' : p.flashlightOn ? '#00E5FF' : '#8A94A6';
    ctx.textBaseline = 'middle';
    const label = `FLASHLIGHT ${p.flashlightOn ? 'ON' : 'OFF'} [${key}]`;
    ctx.fillText(label, rect.x + 8, rect.y + rect.h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
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
