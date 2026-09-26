import { createTopDownWalkRig, TopDownWalkRig } from '../graphics/TopDownWalkRig';

export type AssetKey =
  | 'player_infiltrator'
  | 'player_breacher'
  | 'player_downed'
  | 'zombie_lurker'
  | 'zombie_lurker_aggro'
  | 'zombie_audio_stalker'
  | 'zombie_bio_carrier'
  | 'zombie_armored_brute'
  | 'pickup_ammo'
  | 'pickup_medkit'
  | 'pickup_battery'
  | 'pickup_keycard'
  | 'muzzle_flash'
  | 'blood_splatter'
  | 'acoustic_ripple'
  | 'reticle_crosshair'
  | 'sector1_bg'
  | 'sector2_bg'
  | 'sector3_bg';

// Prefixed with Vite's BASE_URL (not a hardcoded leading slash) so these
// still resolve once built under a subpath, e.g. GitHub Pages' /Hushfire/ —
// vite.config.ts's `base` doesn't rewrite runtime string literals, only
// actual imports, so a hardcoded '/assets/...' 404s under any base but '/'.
const base = import.meta.env.BASE_URL;
const ASSET_PATHS: Record<AssetKey, string> = {
  player_infiltrator: `${base}assets/sprites/player_infiltrator.png`,
  player_breacher: `${base}assets/sprites/player_breacher.png`,
  player_downed: `${base}assets/sprites/player_downed.png`,
  zombie_lurker: `${base}assets/sprites/zombie_lurker.png`,
  zombie_lurker_aggro: `${base}assets/sprites/zombie_lurker_aggro.png`,
  zombie_audio_stalker: `${base}assets/sprites/zombie_audio_stalker.png`,
  zombie_bio_carrier: `${base}assets/sprites/zombie_bio_carrier.png`,
  zombie_armored_brute: `${base}assets/sprites/zombie_armored_brute.png`,
  pickup_ammo: `${base}assets/items/pickup_ammo.png`,
  pickup_medkit: `${base}assets/items/pickup_medkit.png`,
  pickup_battery: `${base}assets/items/pickup_battery.png`,
  pickup_keycard: `${base}assets/items/pickup_keycard.png`,
  muzzle_flash: `${base}assets/fx/muzzle_flash.png`,
  blood_splatter: `${base}assets/fx/blood_splatter.png`,
  acoustic_ripple: `${base}assets/fx/acoustic_ripple.png`,
  reticle_crosshair: `${base}assets/fx/reticle_crosshair.png`,
  sector1_bg: `${base}assets/backgrounds/sector1_bg.jpg`,
  sector2_bg: `${base}assets/backgrounds/sector2_bg.jpg`,
  sector3_bg: `${base}assets/backgrounds/sector3_bg.jpg`
};

/**
 * Loads the sprite atlas up front. Sprites are authored on a 128x128 canvas
 * with a centered pivot and facing +x, so they drop straight into the
 * translate/rotate the renderer already does per entity.
 */
export class AssetLoader {
  private images = new Map<AssetKey, HTMLImageElement>();
  /** Procedural walk cycle for Operative 1 (infiltrator), built from the static sprite. */
  infiltratorWalkRig: TopDownWalkRig | null = null;

  async loadAll(): Promise<void> {
    const entries = Object.entries(ASSET_PATHS) as [AssetKey, string][];
    await Promise.all(
      entries.map(
        ([key, path]) =>
          new Promise<void>(resolve => {
            const img = new Image();
            img.onload = () => {
              this.images.set(key, img);
              resolve();
            };
            img.onerror = () => {
              console.warn(`[assets] failed to load ${path}`);
              resolve();
            };
            img.src = path;
          })
      )
    );

    const infiltrator = this.images.get('player_infiltrator');
    if (infiltrator) {
      try {
        this.infiltratorWalkRig = createTopDownWalkRig(infiltrator);
      } catch (err) {
        console.warn('[assets] failed to build infiltrator walk rig', err);
        this.infiltratorWalkRig = null;
      }
    }
  }

  getImage(key: AssetKey): HTMLImageElement | undefined {
    return this.images.get(key);
  }

  has(key: AssetKey): boolean {
    return this.images.has(key);
  }

  /** Draws a sprite centered on the current transform origin. False if the asset is missing. */
  drawCentered(ctx: CanvasRenderingContext2D, key: AssetKey, size: number): boolean {
    const img = this.images.get(key);
    if (!img) return false;
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    return true;
  }

  /** Draws a sprite stretched into an arbitrary rect, e.g. a sector background. False if the asset is missing. */
  drawStretched(ctx: CanvasRenderingContext2D, key: AssetKey, x: number, y: number, w: number, h: number): boolean {
    const img = this.images.get(key);
    if (!img) return false;
    ctx.drawImage(img, x, y, w, h);
    return true;
  }

  /** Draws a sprite at a world position with rotation, restoring transform afterwards. */
  draw(
    ctx: CanvasRenderingContext2D,
    key: AssetKey,
    x: number,
    y: number,
    angle: number,
    size: number,
    alpha = 1
  ): boolean {
    const img = this.images.get(key);
    if (!img) return false;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (angle !== 0) ctx.rotate(angle);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
    return true;
  }
}
