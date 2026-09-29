import { Entity } from './Entity';
import { MuzzleType, RailType, AmmoType, WeaponDef, WEAPON_REGISTRY, MUZZLE_MODIFIERS } from '../config/weapons';
import { OperativeGearId } from '../config/operativeGear';
import { ThrowableKind, THROWABLE_ORDER, THROW_COOLDOWN_SEC, startingThrowableCounts } from '../config/throwables';
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
  BLEEDOUT_SEC,
  FLASHLIGHT_BATTERY_MAX,
  FLASHLIGHT_DRAIN_PER_SEC,
  BATTERY_PICKUP_CHARGE,
  NVG_BATTERY_MAX,
  NVG_DRAIN_PER_SEC,
  MELEE_STAMINA_MAX,
  MELEE_STAMINA_COST_PER_SWING,
  MELEE_STAMINA_REGEN_PER_SEC
} from '../config/constants';

export type MovementState = 'sneak' | 'walk' | 'sprint';

export interface WeaponLoadout {
  primaryWeapon: string;
  secondaryWeapon: string;
  /** Sidearm slot is pistols only; melee is equipped separately. */
  meleeWeapon: string;
  // Every attachment is mounted per-weapon: switching weapons switches which
  // muzzle, sight, and chambered ammo are actually in effect.
  primaryMuzzle: MuzzleType;
  secondaryMuzzle: MuzzleType;
  primaryRail: RailType;
  secondaryRail: RailType;
  primaryAmmoType: AmmoType;
  secondaryAmmoType: AmmoType;
  /** Optional in saved JSON — defaults to `none` in Player and armory sanitize. */
  operativeGear?: OperativeGearId;
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
  public operativeGear: OperativeGearId;
  public activeSlot: 'primary' | 'secondary' | 'melee' = 'primary';
  private ammoBySlot: { primary: { mag: number; reserve: number }; secondary: { mag: number; reserve: number } };
  public isReloading = false;
  public reloadTimer = 0;
  /** Far in the past so the first shot is never blocked by performance.now() ≈ 0 at page load. */
  public lastShotTime = -Infinity;
  public muzzleFlashTimer = 0;
  public flashlightOn = true;
  public flashlightBattery = FLASHLIGHT_BATTERY_MAX;
  /** Night vision goggles — only toggleable when `operativeGear === 'nvg'`. */
  public nvgOn = false;
  public nvgBattery = 0;
  /** Fire-rate gate for melee swings (drawn melee slot or quick-melee key). */
  public lastMeleeSwingTime = -Infinity;
  public meleeStamina = MELEE_STAMINA_MAX;
  public throwableCounts: Record<ThrowableKind, number> = { he: 0, incendiary: 0, flashbang: 0, flare: 0 };
  public selectedThrowable: ThrowableKind = 'he';
  public lastThrowTime = -Infinity;

  public isDowned = false;
  public reviveProgress = 0;
  /** Seconds spent downed this life — co-op bleed-out escalates to eliminated. */
  public bleedoutTimer = 0;

  public hasKeycard = false;

  public killCount = 0;
  /** Kills on a zombie that hadn't noticed anyone yet — the stealth stat on the end screen. */
  public silentKills = 0;
  public shotsFired = 0;

  constructor(playerNumber: 1 | 2, x: number, y: number, maxHealth: number, loadout: WeaponLoadout) {
    super(x, y, PLAYER_RADIUS, maxHealth);
    this.playerNumber = playerNumber;
    this.loadout = loadout;
    this.operativeGear = loadout.operativeGear ?? 'none';
    if (this.operativeGear === 'nvg') this.nvgBattery = NVG_BATTERY_MAX;
    if (this.hasThrowableGear()) this.initGrenadePouchInventory();
    const primary = WEAPON_REGISTRY[loadout.primaryWeapon];
    const secondary = WEAPON_REGISTRY[loadout.secondaryWeapon];
    this.ammoBySlot = {
      primary: { mag: primary.magSize, reserve: startingReserve(primary) },
      secondary: { mag: secondary.magSize, reserve: startingReserve(secondary) }
    };
  }

  /**
   * Picks a spent crossbow bolt back up: +1 to whichever slot holds the
   * crossbow. Returns false (bolt stays on the floor) if this operative
   * isn't carrying one. No cap — every bolt on the floor was fired by
   * someone, so retrieving them can't mint ammo.
   */
  retrieveBolt(): boolean {
    for (const slot of ['primary', 'secondary'] as const) {
      const id = slot === 'primary' ? this.loadout.primaryWeapon : this.loadout.secondaryWeapon;
      if (id === 'crossbow') {
        this.ammoBySlot[slot].reserve++;
        return true;
      }
    }
    return false;
  }

  /**
   * An ammo crate: +2 magazines for each gun carried, capped at that gun's
   * starting reserve, so it's worth the same to an MPX (60 rounds) as to a
   * crossbow (2 bolts). Melee weapons are skipped. Returns false if both
   * guns were already full, so the crate can be left for later.
   */
  /** Armory operative gear applied once at deploy. */
  applyDeployGearBonus() {
    switch (this.operativeGear) {
      case 'extra_ammo':
        for (const slot of ['primary', 'secondary'] as const) {
          const weapon = WEAPON_REGISTRY[slot === 'primary' ? this.loadout.primaryWeapon : this.loadout.secondaryWeapon];
          if (weapon.infiniteAmmo) continue;
          this.ammoBySlot[slot].reserve += weapon.magSize;
        }
        break;
      case 'extra_battery':
        this.flashlightBattery = Math.min(FLASHLIGHT_BATTERY_MAX, this.flashlightBattery + BATTERY_PICKUP_CHARGE);
        break;
      case 'grenade_pouch':
      case 'extra_grenade_pouches':
        this.initGrenadePouchInventory();
        break;
      default:
        break;
    }
  }

  hasThrowableGear(): boolean {
    return this.operativeGear === 'grenade_pouch' || this.operativeGear === 'extra_grenade_pouches';
  }

  /** @deprecated Use hasThrowableGear — kept for call-site clarity in HUD. */
  hasGrenadePouch(): boolean {
    return this.hasThrowableGear();
  }

  initGrenadePouchInventory() {
    if (!this.hasThrowableGear()) return;
    const gear = this.operativeGear as 'grenade_pouch' | 'extra_grenade_pouches';
    const starting = startingThrowableCounts(gear);
    for (const kind of THROWABLE_ORDER) {
      this.throwableCounts[kind] = starting[kind];
    }
    this.selectedThrowable = this.firstThrowableWithAmmo() ?? 'he';
  }

  firstThrowableWithAmmo(): ThrowableKind | null {
    for (const kind of THROWABLE_ORDER) {
      if (this.throwableCounts[kind] > 0) return kind;
    }
    return null;
  }

  selectThrowable(kind: ThrowableKind) {
    if (!this.hasGrenadePouch()) return;
    if (this.throwableCounts[kind] > 0) this.selectedThrowable = kind;
  }

  cycleThrowable() {
    if (!this.hasGrenadePouch()) return;
    const start = THROWABLE_ORDER.indexOf(this.selectedThrowable);
    for (let i = 1; i <= THROWABLE_ORDER.length; i++) {
      const kind = THROWABLE_ORDER[(start + i) % THROWABLE_ORDER.length];
      if (this.throwableCounts[kind] > 0) {
        this.selectedThrowable = kind;
        return;
      }
    }
  }

  canThrow(kind = this.selectedThrowable): boolean {
    if (!this.hasGrenadePouch() || this.isDowned || this.isEliminated) return false;
    if (this.throwableCounts[kind] <= 0) return false;
    return performance.now() - this.lastThrowTime >= THROW_COOLDOWN_SEC * 1000;
  }

  consumeThrowable(kind: ThrowableKind) {
    this.throwableCounts[kind] = Math.max(0, this.throwableCounts[kind] - 1);
    this.lastThrowTime = performance.now();
    if (this.throwableCounts[this.selectedThrowable] <= 0) {
      const next = this.firstThrowableWithAmmo();
      if (next) this.selectedThrowable = next;
    }
  }

  totalThrowablesRemaining(): number {
    return THROWABLE_ORDER.reduce((sum, k) => sum + this.throwableCounts[k], 0);
  }

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
    if (this.activeSlot === 'melee') return this.loadout.meleeWeapon;
    return this.activeSlot === 'primary' ? this.loadout.primaryWeapon : this.loadout.secondaryWeapon;
  }

  /** The rail/sight actually lit right now — swaps with whichever weapon is drawn. */
  get activeRail(): RailType {
    if (this.activeSlot === 'melee') return 'none';
    return this.activeSlot === 'primary' ? this.loadout.primaryRail : this.loadout.secondaryRail;
  }

  get activeMuzzle(): MuzzleType {
    if (this.activeSlot === 'melee') return 'none';
    return this.activeSlot === 'primary' ? this.loadout.primaryMuzzle : this.loadout.secondaryMuzzle;
  }

  get activeAmmoType(): AmmoType {
    if (this.activeSlot === 'melee') return 'standard';
    return this.activeSlot === 'primary' ? this.loadout.primaryAmmoType : this.loadout.secondaryAmmoType;
  }

  get currentMag(): number {
    if (this.activeSlot === 'melee') return 1;
    return this.ammoBySlot[this.activeSlot].mag;
  }

  set currentMag(value: number) {
    if (this.activeSlot === 'melee') return;
    this.ammoBySlot[this.activeSlot].mag = value;
  }

  get reserveAmmo(): number {
    if (this.activeSlot === 'melee') return 0;
    return this.ammoBySlot[this.activeSlot].reserve;
  }

  set reserveAmmo(value: number) {
    if (this.activeSlot === 'melee') return;
    this.ammoBySlot[this.activeSlot].reserve = value;
  }

  update(dt: number, input: PlayerInputState, map: MapManager) {
    this.angle = input.aimAngle;

    if (!this.isDowned && !this.isReloading) {
      if (input.selectPrimary) this.activeSlot = 'primary';
      else if (input.selectSecondary) this.activeSlot = 'secondary';
      else if (input.selectMelee) this.activeSlot = 'melee';
      else if (input.isSwitchingWeapon) {
        this.activeSlot = this.activeSlot === 'primary' ? 'secondary' : 'primary';
      }
    }
    if (input.isTogglingFlashlight && !this.isDowned) this.toggleFlashlight();
    if (input.isTogglingNvg && !this.isDowned) this.toggleNvg();

    if (this.flashlightOn && !this.isDowned) {
      this.flashlightBattery = Math.max(0, this.flashlightBattery - FLASHLIGHT_DRAIN_PER_SEC * dt);
      if (this.flashlightBattery <= 0) this.flashlightOn = false;
    }
    if (this.nvgOn && this.operativeGear === 'nvg' && !this.isDowned) {
      this.nvgBattery = Math.max(0, this.nvgBattery - NVG_DRAIN_PER_SEC * dt);
      if (this.nvgBattery <= 0) this.nvgOn = false;
    }
    if (!this.isDowned) {
      this.meleeStamina = Math.min(
        MELEE_STAMINA_MAX,
        this.meleeStamina + MELEE_STAMINA_REGEN_PER_SEC * dt
      );
    }

    if (this.isDowned) {
      this.movementState = 'sneak';
      const speed = DOWNED_CRAWL_SPEED;
      this.x += input.moveX * speed * dt;
      this.y += input.moveY * speed * dt;
      this.noiseRadius = 0;
      this.bleedoutTimer += dt;
      if (this.bleedoutTimer >= BLEEDOUT_SEC) this.eliminate();
    } else {
      this.movementState = input.isSneaking ? 'sneak' : input.isSprinting ? 'sprint' : 'walk';
      let speed = this.movementState === 'sneak' ? SNEAK_SPEED : this.movementState === 'sprint' ? SPRINT_SPEED : WALK_SPEED;
      speed *= MUZZLE_MODIFIERS[this.activeMuzzle].moveSpeedMult;
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
  toggleNvg() {
    if (this.operativeGear !== 'nvg') return;
    if (this.nvgOn) this.nvgOn = false;
    else if (this.nvgBattery > 0) this.nvgOn = true;
  }

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
    this.bleedoutTimer = 0;
  }

  down() {
    this.isDowned = true;
    this.health = 0;
    this.reviveProgress = 0;
    this.bleedoutTimer = 0;
  }

  eliminate() {
    this.isDowned = false;
    this.isEliminated = true;
    this.health = 0;
    this.bleedoutTimer = 0;
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
    if (weapon.type === 'melee') return this.canMeleeSwing(weapon.id);
    const minInterval = 60000 / weapon.fireRateRPM;
    const hasAmmo = weapon.infiniteAmmo || this.currentMag > 0;
    return !this.isDowned && !this.isReloading && hasAmmo && performance.now() - this.lastShotTime > minInterval;
  }

  canMeleeSwing(meleeId = this.loadout.meleeWeapon): boolean {
    const weapon = WEAPON_REGISTRY[meleeId];
    if (weapon.type !== 'melee') return false;
    const minInterval = 60000 / weapon.fireRateRPM;
    return (
      !this.isDowned &&
      !this.isReloading &&
      this.meleeStamina >= MELEE_STAMINA_COST_PER_SWING &&
      performance.now() - this.lastMeleeSwingTime > minInterval
    );
  }

  private spendMeleeStamina() {
    this.meleeStamina = Math.max(0, this.meleeStamina - MELEE_STAMINA_COST_PER_SWING);
  }

  consumeShot() {
    const weapon = WEAPON_REGISTRY[this.activeWeaponId];
    if (weapon.type === 'melee') {
      this.lastMeleeSwingTime = performance.now();
      this.spendMeleeStamina();
      this.shotsFired++;
      return;
    }
    if (!weapon.infiniteAmmo) this.currentMag = Math.max(0, this.currentMag - 1);
    this.lastShotTime = performance.now();
    this.shotsFired++;
    this.muzzleFlashTimer = Math.max(0.04, 320 / weapon.fireRateRPM / 1000);
  }

  consumeMeleeSwing() {
    this.lastMeleeSwingTime = performance.now();
    this.spendMeleeStamina();
    this.shotsFired++;
  }
}
