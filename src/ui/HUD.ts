import { Player } from '../entities/Player';
import { WEAPON_REGISTRY } from '../config/weapons';
import { THROWABLE_LABELS, THROWABLE_ORDER, THROWABLE_SHORT, THROW_MAX_RANGE_PX } from '../config/throwables';
import { MapManager } from '../systems/MapManager';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  FLASHLIGHT_BATTERY_MAX,
  NVG_BATTERY_MAX,
  MELEE_STAMINA_MAX
} from '../config/constants';
import { SectorModifierId, getSectorModifier } from '../config/sectorModifiers';
import { AssetLoader } from '../core/AssetLoader';
import { Camera } from '../core/Camera';
import { Point } from '../lighting/Raycaster';

const PANEL_COLOR = '#EBF4FA';
const FLASHLIGHT_BTN_W = 150;
const FLASHLIGHT_BTN_H = 22;
const PANEL_X_P1 = 30;
const PANEL_Y = 30;
const RESOURCE_BAR_H = 5;
const RESOURCE_BAR_GAP = 6;
const PANEL_BTN_GAP = 8;
const NVG_BTN_GAP = 6;
const NVG_GREEN = '#00E676';

export interface PlayerPanelLayout {
  flashlightBtn: { x: number; y: number; w: number; h: number };
  nvgBtn: { x: number; y: number; w: number; h: number } | null;
}

// Reticle — #FF1744 is the red ART_SPECIFICATION.md §4 already specifies for the
// laser sight, so the aim reticle reads as the same system rather than a new
// arbitrary color. Drawn procedurally (not from fx/reticle_crosshair.png) so the
// stroke weight is constant in screen space: a raster scaled to the weapon's
// spread thins to under 1px for non-shotgun weapons, which is why the old
// crosshair read as faint.
const RETICLE_COLOR = '#FF1744';
/** Dark under-stroke, so the red still reads against bright sector floors, blood decals and the damage vignette. */
const RETICLE_OUTLINE = 'rgba(0, 0, 0, 0.55)';
const RETICLE_LINE_W = 3;
const RETICLE_OUTLINE_W = 6;
/** Where P2's reticle sits along their aim vector — they have no mouse to track. */
const RETICLE_AIM_DIST = 46;

export class HUD {
  private rippleClock = 0;

  constructor(private assets: AssetLoader) {}

  /**
   * Screen-space bounds of a player's clickable flashlight button, in the
   * same coordinates renderScreenSpace draws their panel at. Shared with
   * Game.ts's click hit-test so the drawn button and the clickable region
   * never drift apart.
   */
  /** Stacks resource bars then buttons so melee/NVG bars never paint over the flashlight control. */
  static layoutPlayerPanel(p: Player): PlayerPanelLayout {
    const x = p.playerNumber === 1 ? PANEL_X_P1 : CANVAS_WIDTH - 330;
    let cursor = PANEL_Y + 58;

    const flashlightCharge = p.flashlightBattery / FLASHLIGHT_BATTERY_MAX;
    if (p.flashlightOn || flashlightCharge < 0.3) cursor += RESOURCE_BAR_GAP + RESOURCE_BAR_H;

    if (p.operativeGear === 'nvg') {
      const nvgCharge = p.nvgBattery / NVG_BATTERY_MAX;
      if (p.nvgOn || nvgCharge < 0.3) cursor += RESOURCE_BAR_GAP + RESOURCE_BAR_H;
    }

    const meleeCharge = p.meleeStamina / MELEE_STAMINA_MAX;
    if (meleeCharge < 1) cursor += RESOURCE_BAR_GAP + RESOURCE_BAR_H;

    cursor += PANEL_BTN_GAP;
    const flashlightBtn = { x, y: cursor, w: FLASHLIGHT_BTN_W, h: FLASHLIGHT_BTN_H };
    const nvgBtn =
      p.operativeGear === 'nvg'
        ? { x, y: cursor + FLASHLIGHT_BTN_H + NVG_BTN_GAP, w: FLASHLIGHT_BTN_W, h: FLASHLIGHT_BTN_H }
        : null;
    return { flashlightBtn, nvgBtn };
  }

  static getFlashlightButtonRect(p: Player): { x: number; y: number; w: number; h: number } {
    return HUD.layoutPlayerPanel(p).flashlightBtn;
  }

  static getNvgButtonRect(p: Player): { x: number; y: number; w: number; h: number } {
    const layout = HUD.layoutPlayerPanel(p);
    return layout.nvgBtn ?? layout.flashlightBtn;
  }

  /**
   * World-space HUD elements (tied to player position) — call while the
   * camera transform is active, i.e. *before* the lighting pass. Only the
   * acoustic ripple belongs here: it's a diegetic sound visual, so it should
   * be dimmed by darkness exactly like the floor it ripples over.
   *
   * The reticle deliberately does not live here — see renderReticles.
   */
  renderWorldSpace(ctx: CanvasRenderingContext2D, p1: Player, p2: Player) {
    this.rippleClock += 1 / 60;
    this.renderDecibelRipple(ctx, p1);
    if (!p2.isEliminated) this.renderDecibelRipple(ctx, p2);
  }

  /**
   * Reticles, in screen space — call *after* the lighting pass.
   *
   * This used to be drawn in world space before renderLighting(), which meant
   * ShadowRenderer's darkness mask (rgba(5,5,8,0.96) over everything outside a
   * light cone) composited on top of it. Aiming anywhere unlit left the
   * crosshair ~96% buried. That mattered little while the OS cursor was
   * visible; it matters a lot now that gameplay hides it and the reticle is
   * the player's only pointer.
   *
   * `mouseScreen` is P1's pointer in canvas pixels, so their reticle tracks it
   * exactly with no world round-trip. It's null while P1 aims with a gamepad
   * stick; then, like P2 (keyboard or stick aim, no physical mouse), the
   * reticle is projected RETICLE_AIM_DIST along the aim vector and converted
   * back to screen space.
   */
  renderReticles(
    ctx: CanvasRenderingContext2D,
    p1: Player,
    p2: Player,
    mouseScreen: Point | null,
    camera: Camera
  ) {
    const alongAim = (p: Player) =>
      camera.worldToScreen({
        x: p.x + Math.cos(p.angle) * RETICLE_AIM_DIST,
        y: p.y + Math.sin(p.angle) * RETICLE_AIM_DIST
      });
    this.renderReticle(ctx, p1, mouseScreen ?? alongAim(p1));
    if (!p2.isEliminated) this.renderReticle(ctx, p2, alongAim(p2));
  }

  /**
   * Screen-space HUD elements (fixed panels/text) — call after the camera
   * transform is reset. P2's panel is skipped once eliminated: permanently
   * absent in solo mode (there was never a second operative to report on),
   * or genuinely dead in co-op, where a stale "HP: 0/120" panel would just
   * be confusing.
   */
  renderScreenSpace(
    ctx: CanvasRenderingContext2D,
    p1: Player,
    p2: Player,
    map: MapManager,
    runModifier: SectorModifierId,
    tutorialBanner: string | null = null
  ) {
    this.renderPlayerPanel(ctx, p1, 30, 30);
    if (!p2.isEliminated) this.renderPlayerPanel(ctx, p2, CANVAS_WIDTH - 330, 30);
    this.renderMissionStatus(ctx, map, !p2.isEliminated, runModifier);
    if (tutorialBanner) {
      ctx.save();
      ctx.font = '12px monospace';
      ctx.fillStyle = 'rgba(235, 244, 250, 0.92)';
      ctx.textAlign = 'center';
      ctx.fillText(tutorialBanner, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 28);
      ctx.restore();
    }
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
      const ammoLabel =
        weapon.type === 'melee' || weapon.infiniteAmmo
          ? 'MELEE'
          : p.isReloading
            ? 'RELOADING...'
            : `${p.currentMag}/${p.reserveAmmo}`;
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

    let barCursor = y + 58;
    const drawResourceBar = (fill: number, color: string) => {
      barCursor += RESOURCE_BAR_GAP;
      ctx.strokeStyle = '#3A4252';
      ctx.strokeRect(x, barCursor, 200, RESOURCE_BAR_H);
      ctx.fillStyle = color;
      ctx.fillRect(x, barCursor, 200 * fill, RESOURCE_BAR_H);
      barCursor += RESOURCE_BAR_H;
    };

    const charge = p.flashlightBattery / FLASHLIGHT_BATTERY_MAX;
    if (p.flashlightOn || charge < 0.3) {
      const color = charge > 0.3 ? '#00E5FF' : charge > 0 ? '#FFC107' : '#FF5252';
      drawResourceBar(charge, color);
    }

    if (p.operativeGear === 'nvg') {
      const nvgCharge = p.nvgBattery / NVG_BATTERY_MAX;
      if (p.nvgOn || nvgCharge < 0.3) {
        const color = nvgCharge > 0.3 ? '#00E676' : nvgCharge > 0 ? '#FFC107' : '#FF5252';
        drawResourceBar(nvgCharge, color);
      }
    }

    const meleeCharge = p.meleeStamina / MELEE_STAMINA_MAX;
    if (meleeCharge < 1) {
      const color = meleeCharge > 0.35 ? '#B388FF' : meleeCharge > 0 ? '#FFC107' : '#FF5252';
      drawResourceBar(meleeCharge, color);
      ctx.font = '10px monospace';
      ctx.fillStyle = '#8A94A6';
      ctx.fillText('MELEE STAMINA [E]', x, barCursor + 11);
      ctx.font = '13px monospace';
    }

    if (p.hasGrenadePouch() && p.totalThrowablesRemaining() > 0) {
      ctx.font = '11px monospace';
      ctx.fillStyle = '#FFAB40';
      const parts = THROWABLE_ORDER.map(
        k =>
          `${THROWABLE_SHORT[k]}×${p.throwableCounts[k]}${p.selectedThrowable === k ? '*' : ''}`
      );
      ctx.fillText(`GRENADES [G] ${parts.join(' ')} — ${THROW_MAX_RANGE_PX}px`, x, barCursor + 14);
      ctx.fillStyle = '#8A94A6';
      ctx.font = '10px monospace';
      ctx.fillText(
        `Selected: ${THROWABLE_LABELS[p.selectedThrowable]} — [4-7] pick, [B] cycle`,
        x,
        barCursor + 28
      );
      ctx.font = '13px monospace';
      barCursor += 36;
    }

    this.renderFlashlightButton(ctx, p);
    if (p.operativeGear === 'nvg') this.renderNvgButton(ctx, p);

    ctx.restore();
  }

  /** Only P1's button is clickable (see Game.ts). P2 in online co-op is remote — no local key hints. */
  private renderFlashlightButton(ctx: CanvasRenderingContext2D, p: Player) {
    const rect = HUD.getFlashlightButtonRect(p);
    const disabled = p.isDowned;
    const keyHint = p.playerNumber === 1 ? ' [T]' : '';

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
    const label = `FLASHLIGHT ${p.flashlightOn ? 'ON' : 'OFF'}${keyHint}`;
    ctx.fillText(label, rect.x + 8, rect.y + rect.h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
  }

  private renderNvgButton(ctx: CanvasRenderingContext2D, p: Player) {
    const rect = HUD.getNvgButtonRect(p);
    const disabled = p.isDowned;
    const keyHint = p.playerNumber === 1 ? ' [N]' : '';

    ctx.strokeStyle = disabled ? '#2A2F3A' : p.nvgOn ? NVG_GREEN : '#3A4252';
    ctx.fillStyle = disabled ? 'rgba(20,22,28,0.6)' : p.nvgOn ? 'rgba(0,230,118,0.18)' : 'rgba(20,22,28,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 4);
    ctx.fill();
    ctx.stroke();

    ctx.font = '11px monospace';
    ctx.fillStyle = disabled ? '#4A5468' : p.nvgOn ? NVG_GREEN : '#8A94A6';
    ctx.textBaseline = 'middle';
    const label = `NIGHT VISION ${p.nvgOn ? 'ON' : 'OFF'}${keyHint}`;
    ctx.fillText(label, rect.x + 8, rect.y + rect.h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
  }

  private renderMissionStatus(ctx: CanvasRenderingContext2D, map: MapManager, coop: boolean, runModifier: SectorModifierId) {
    const mod = getSectorModifier(runModifier);
    const zone = map.extractionZone;
    const centered = (text: string, y: number) => {
      ctx.fillText(text, CANVAS_WIDTH / 2 - ctx.measureText(text).width / 2, y);
    };

    ctx.save();
    ctx.font = '14px monospace';
    ctx.fillStyle = '#8A94A6';
    centered(map.sector.name, 30);
    ctx.font = '11px monospace';
    ctx.fillStyle = '#FF9E1B';
    centered(`${mod.name} — ${mod.blurb}`, 46);

    ctx.font = '13px monospace';
    if (zone.isComplete) {
      ctx.fillStyle = '#00E676';
      centered('EXTRACTION COMPLETE', 62);
    } else if (zone.isActive) {
      ctx.fillStyle = '#FF5252';
      centered(
        zone.isOccupied
          ? `HOLDOUT — ${Math.ceil(zone.holdoutTimer)}s UNTIL EVAC`
          : `HOLDOUT PAUSED (${Math.ceil(zone.holdoutTimer)}s) — GET BACK ON THE PAD`,
        62
      );
    } else if (map.objectiveComplete) {
      ctx.fillStyle = '#00E676';
      centered(
        zone.radius > 0
          ? 'OBJECTIVE DONE — BOARD THE EVAC PAD'
          : coop
            ? 'OBJECTIVE DONE — BOTH OPERATIVES TO THE EXIT'
            : 'OBJECTIVE DONE — MOVE TO EXIT',
        62
      );
    } else {
      ctx.fillStyle = '#FF9E1B';
      centered(map.sector.briefing, 62);
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

  /**
   * One reticle, drawn at a canvas-pixel position. Ring radius still tracks the
   * weapon's spread so a shotgun reads visibly wider than an SMG, but the stroke
   * weight is fixed in screen space rather than baked into a scaled raster.
   */
  private renderReticle(ctx: CanvasRenderingContext2D, p: Player, at: Point) {
    if (p.isDowned || p.isEliminated) return;
    const weapon = WEAPON_REGISTRY[p.activeWeaponId];
    const spread = weapon.pelletCount ? 22 : 12;

    const ring = spread * 0.9;
    const tickInner = ring + 4;
    const tickOuter = ring + 11;

    // Ring plus four ticks as a single path, so both the outline and the colour
    // pass cost one stroke each. moveTo before every tick keeps the arc from
    // connecting to it with a stray line.
    const trace = () => {
      ctx.beginPath();
      ctx.arc(at.x, at.y, ring, 0, Math.PI * 2);
      ctx.moveTo(at.x + tickInner, at.y);
      ctx.lineTo(at.x + tickOuter, at.y);
      ctx.moveTo(at.x - tickInner, at.y);
      ctx.lineTo(at.x - tickOuter, at.y);
      ctx.moveTo(at.x, at.y + tickInner);
      ctx.lineTo(at.x, at.y + tickOuter);
      ctx.moveTo(at.x, at.y - tickInner);
      ctx.lineTo(at.x, at.y - tickOuter);
    };

    ctx.save();
    ctx.lineCap = 'round';

    ctx.strokeStyle = RETICLE_OUTLINE;
    ctx.lineWidth = RETICLE_OUTLINE_W;
    trace();
    ctx.stroke();

    ctx.strokeStyle = RETICLE_COLOR;
    ctx.lineWidth = RETICLE_LINE_W;
    trace();
    ctx.stroke();

    // Centre pip, outlined for the same reason as the ring.
    ctx.fillStyle = RETICLE_OUTLINE;
    ctx.beginPath();
    ctx.arc(at.x, at.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = RETICLE_COLOR;
    ctx.beginPath();
    ctx.arc(at.x, at.y, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
