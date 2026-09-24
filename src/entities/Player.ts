import { Entity } from './Entity';
import { MuzzleType, RailType, AmmoType, WeaponDef, WEAPON_REGISTRY } from '../config/weapons';
import { PlayerInputState } from '../core/Input';
import { MapManager } from '../systems/MapManager';
import {
  SNEAK_SPEED,
  WALK_SPEED,
  SPRINT_SPEED,
  SNEAK_NOISE_RADIUS,
  WALK_NOISE_RADIUS,
  SPRINT_NOISE_RADIUS,
  DOWNED_CRAWL_SPEED,
  REVIVE_TIME_SEC,
  FLASHLIGHT_BATTERY_MAX,
  FLASHLIGHT_DRAIN_PER_SEC
} from '../config/constants';

export type MovementState = 'sneak' | 'walk' | 'sprint';

export interface WeaponLoadout {
  primaryWeapon: string;
  secondaryWeapon: string;
  // Every attachment is mounted per-weapon: switching weapons switches which
  // muzzle, sight, and chambered ammo are actually in effect.
  primaryMuzzle: MuzzleType;
  secondaryMuzzle: MuzzleType;
  primaryRail: RailType;
  secondaryRail: RailType;
  primaryAmmoType: AmmoType;
  secondaryAmmoType: AmmoType;
}

const PLAYER_RADIUS = 16;

/** Most weapons carry 4 spare mags; a few (the pistols) specify their own historically-accurate reserve. */
const startingReserve = (weapon: WeaponDef) => weapon.reserveAmmo ?? weapon.magSize * 4;

export class Player extends Entity {
  public readonly playerNumber: 1 | 2;
  public angle = 0;
  public movementState: MovementState = 'walk';
  public noiseRadius = 0;
  public justStepped = false;
  public isEliminated = false;
  private footstepTimer = 0;

  public loadout: WeaponLoadout;
  public activeSlot: 'primary' | 'secondary' = 'primary';
  private ammoBySlot: { primary: { mag: number; reserve: number }; secondary: { mag: number; reserve: number } };
  public isReloading = false;
  public reloadTimer = 0;
  public lastShotTime = 0;
  public muzzleFlashTimer = 0;
  public flashlightOn = true;
  public flashlightBattery = FLASHLIGHT_BATTERY_MAX;

  public isDowned = false;
  public reviveProgress = 0;

  public hasKeycard = false;

  public killCount = 0;
  /** Kills on a zombie that hadn't noticed anyone yet — the stealth stat on the end screen. */
  public silentKills = 0;
  public shotsFired = 0;

  constructor(playerNumber: 1 | 2, x: number, y: number, maxHealth: number, loadout: WeaponLoadout) {
    super(x, y, PLAYER_RADIUS, maxHealth);
    this.playerNumber = playerNumber;
    this.loadout = loadout;
    const primary = WEAPON_REGISTRY[loadout.primaryWeapon];
    const secondary = WEAPON_REGISTRY[loadout.secondaryWeapon];
    this.ammoBySlot = {
      primary: { mag: primary.magSize, reserve: startingReserve(primary) },
      secondary: { mag: secondary.magSize, reserve: startingReserve(secondary) }
    };
  }

  /**
   * An ammo crate: +2 magazines for each gun carried, capped at that gun's
   * starting reserve, so it's worth the same to an MPX (60 rounds) as to a
   * crossbow (2 bolts). Melee weapons are skipped. Returns false if both
   * guns were already full, so the crate can be left for later.
   */
  addAmmoPickup(): boolean {
    let added = false;
    for (const slot of ['primary', 'secondary'] as const) {
      const weapon = WEAPON_REGISTRY[slot === 'primary' ? this.loadout.primaryWeapon : this.loadout.secondaryWeapon];
      if (weapon.infiniteAmmo) continue;
      const ammo = this.ammoBySlot[slot];
      const next = Math.min(startingReserve(weapon), ammo.reserve + weapon.magSize * 2);
      if (next > ammo.reserve) {
        ammo.reserve = next;
        added = true;
      }
    }
    return added;
  }

  get activeWeaponId(): string {
    return this.activeSlot === 'primary' ? this.loadout.primaryWeapon : this.loadout.secondaryWeapon;
  }

  /** The rail/sight actually lit right now — swaps with whichever weapon is drawn. */
  get activeRail(): RailType {
    return this.activeSlot === 'primary' ? this.loadout.primaryRail : this.loadout.secondaryRail;
  }

  get activeMuzzle(): MuzzleType {
    return this.activeSlot === 'primary' ? this.loadout.primaryMuzzle : this.loadout.secondaryMuzzle;
  }

  get activeAmmoType(): AmmoType {
    return this.activeSlot === 'primary' ? this.loadout.primaryAmmoType : this.loadout.secondaryAmmoType;
  }

  get currentMag(): number {
    return this.ammoBySlot[this.activeSlot].mag;
  }

  set currentMag(value: number) {
    this.ammoBySlot[this.activeSlot].mag = value;
  }

  get reserveAmmo(): number {
    return this.ammoBySlot[this.activeSlot].reserve;
  }

  set reserveAmmo(value: number) {
    this.ammoBySlot[this.activeSlot].reserve = value;
  }

  update(dt: number, input: PlayerInputState, map: MapManager) {
    this.angle = input.aimAngle;

    if (!this.isDowned && !this.isReloading) {
      if (input.selectPrimary) this.activeSlot = 'primary';
      else if (input.selectSecondary) this.activeSlot = 'secondary';
      else if (input.isSwitchingWeapon) this.activeSlot = this.activeSlot === 'primary' ? 'secondary' : 'primary';
    }
    if (input.isTogglingFlashlight && !this.isDowned) this.toggleFlashlight();

    if (this.flashlightOn && !this.isDowned) {
      this.flashlightBattery = Math.max(0, this.flashlightBattery - FLASHLIGHT_DRAIN_PER_SEC * dt);
      if (this.flashlightBattery <= 0) this.flashlightOn = false;
    }

    if (this.isDowned) {
      this.movementState = 'sneak';
      const speed = DOWNED_CRAWL_SPEED;
      this.x += input.moveX * speed * dt;
      this.y += input.moveY * speed * dt;
      this.noiseRadius = 0;
    } else {
      this.movementState = input.isSneaking ? 'sneak' : input.isSprinting ? 'sprint' : 'walk';
      const speed = this.movementState === 'sneak' ? SNEAK_SPEED : this.movementState === 'sprint' ? SPRINT_SPEED : WALK_SPEED;
      this.x += input.moveX * speed * dt;
      this.y += input.moveY * speed * dt;

      const isMoving = input.moveX !== 0 || input.moveY !== 0;
      this.noiseRadius = !isMoving
        ? 0
        : this.movementState === 'sneak'
        ? SNEAK_NOISE_RADIUS
        : this.movementState === 'sprint'
        ? SPRINT_NOISE_RADIUS
        : WALK_NOISE_RADIUS;
    }

    const resolved = map.resolveCircleCollision({ x: this.x, y: this.y }, this.radius);
    this.x = resolved.x;
    this.y = resolved.y;

    this.justStepped = false;
    if (!this.isDowned && this.noiseRadius > 0) {
      const interval = this.movementState === 'sneak' ? 0.55 : this.movementState === 'sprint' ? 0.22 : 0.38;
      this.footstepTimer += dt;
      if (this.footstepTimer >= interval) {
        this.footstepTimer -= interval;
        this.justStepped = true;
      }
    } else {
      this.footstepTimer = 0;
    }

    if (this.muzzleFlashTimer > 0) this.muzzleFlashTimer -= dt;

    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.finishReload();
    }
  }

  /** Toggling off is always allowed; toggling on needs charge left, so an empty battery can't just be switched back on with no cost. Also callable directly from a UI button click, not just the keyboard shortcut. */
  toggleFlashlight() {
    if (this.isDowned) return;
    if (this.flashlightOn) this.flashlightOn = false;
    else if (this.flashlightBattery > 0) this.flashlightOn = true;
  }

  startRevive(dt: number): boolean {
    this.reviveProgress = Math.min(REVIVE_TIME_SEC, this.reviveProgress + dt);
    if (this.reviveProgress >= REVIVE_TIME_SEC) {
      this.reviveComplete();
      return true;
    }
    return false;
  }

  resetReviveProgress() {
    this.reviveProgress = 0;
  }

  private reviveComplete() {
    this.isDowned = false;
    this.health = Math.round(this.maxHealth * 0.5);
    this.reviveProgress = 0;
  }

  down() {
    this.isDowned = true;
    this.health = 0;
    this.reviveProgress = 0;
  }

  eliminate() {
    this.isDowned = false;
    this.isEliminated = true;
    this.health = 0;
  }

  startReload() {
    if (this.isReloading || this.isDowned) return;
    const weapon = WEAPON_REGISTRY[this.activeWeaponId];
    if (weapon.infiniteAmmo) return;
    if (this.currentMag >= weapon.magSize || this.reserveAmmo <= 0) return;
    this.isReloading = true;
    this.reloadTimer = weapon.reloadTimeSec;
  }

  private finishReload() {
    const weapon = WEAPON_REGISTRY[this.activeWeaponId];
    const needed = weapon.magSize - this.currentMag;
    const loaded = Math.min(needed, this.reserveAmmo);
    this.currentMag += loaded;
    this.reserveAmmo -= loaded;
    this.isReloading = false;
  }

  canFire(): boolean {
    const weapon = WEAPON_REGISTRY[this.activeWeaponId];
    const minInterval = 60000 / weapon.fireRateRPM;
    const hasAmmo = weapon.infiniteAmmo || this.currentMag > 0;
    return !this.isDowned && !this.isReloading && hasAmmo && performance.now() - this.lastShotTime > minInterval;
  }

  consumeShot() {
    const weapon = WEAPON_REGISTRY[this.activeWeaponId];
    if (!weapon.infiniteAmmo) this.currentMag = Math.max(0, this.currentMag - 1);
    this.lastShotTime = performance.now();
    this.shotsFired++;
    this.muzzleFlashTimer = Math.max(0.04, 320 / weapon.fireRateRPM / 1000);
  }
}
