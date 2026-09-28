export type MuzzleType =
  | 'none'
  | 'tactical_suppressor'
  | 'titanium_suppressor'
  | 'monolithic_suppressor'
  | 'muzzle_brake'
  | 'compensator'
  | 'flash_hider';

/** @deprecated Saved loadouts may still reference this id — migrated to `tactical_suppressor`. */
export type LegacyMuzzleType = 'suppressor';
export type RailType = 'none' | 'flood_light' | 'spotlight' | 'green_laser' | 'uv_blacklight';
export type AmmoType = 'standard' | 'subsonic' | 'hollow_point' | 'armor_piercing';

export interface WeaponDef {
  id: string;
  name: string;
  type: 'primary' | 'secondary';
  baseDamage: number;
  fireRateRPM: number;
  magSize: number;
  reloadTimeSec: number;
  baseSoundRadiusPx: number;
  muzzleFlashRadiusPx: number;
  pelletCount?: number;
  isSilentByDefault?: boolean;
  /** Melee: never uses or reloads ammo. */
  infiniteAmmo?: boolean;
  /** Overrides the default "4 spare mags" reserve when a weapon carries a different amount. */
  reserveAmmo?: number;
}

export const WEAPON_REGISTRY: Record<string, WeaponDef> = {
  mpx: {
    id: 'mpx',
    name: 'MPX-S Tactical',
    type: 'primary',
    baseDamage: 22,
    fireRateRPM: 800,
    magSize: 30,
    reloadTimeSec: 1.8,
    baseSoundRadiusPx: 380,
    muzzleFlashRadiusPx: 80
  },
  m4a1: {
    id: 'm4a1',
    name: 'M4A1 CQB',
    type: 'primary',
    baseDamage: 38,
    fireRateRPM: 650,
    magSize: 30,
    reloadTimeSec: 2.2,
    baseSoundRadiusPx: 650,
    muzzleFlashRadiusPx: 150,
    // Same mag size and reserve as the MPX made it a strict upgrade once both are
    // suppressed (both land under the stealth threshold) — thinner reserve keeps
    // the extra damage a real tradeoff instead of a free replacement.
    reserveAmmo: 90
  },
  shotgun: {
    id: 'shotgun',
    name: 'Mossberg 590 Tactical',
    type: 'primary',
    // baseDamage is the TOTAL per-shot damage before the pelletCount split (see
    // CombatSystem.fire) — 18 meant a full point-blank blast, every pellet
    // connecting, did less than a single SMG round. Raised to actually devastate up close.
    baseDamage: 120,
    pelletCount: 8,
    fireRateRPM: 75,
    magSize: 8,
    reloadTimeSec: 3.2,
    baseSoundRadiusPx: 850,
    muzzleFlashRadiusPx: 220
  },
  crossbow: {
    id: 'crossbow',
    name: 'Viper Tac-Crossbow',
    type: 'primary',
    baseDamage: 115,
    fireRateRPM: 45,
    magSize: 1,
    reloadTimeSec: 1.4,
    baseSoundRadiusPx: 25,
    muzzleFlashRadiusPx: 0,
    isSilentByDefault: true
  },
  revolver: {
    id: 'revolver',
    name: 'Colt Python .357',
    type: 'secondary',
    baseDamage: 95,
    fireRateRPM: 140,
    magSize: 6,
    reloadTimeSec: 2.8,
    baseSoundRadiusPx: 800,
    muzzleFlashRadiusPx: 190
  },
  knife: {
    id: 'knife',
    name: 'Carbon Combat Knife',
    type: 'secondary',
    baseDamage: 60,
    fireRateRPM: 110,
    magSize: 1,
    reloadTimeSec: 0,
    baseSoundRadiusPx: 15,
    muzzleFlashRadiusPx: 0,
    isSilentByDefault: true,
    infiniteAmmo: true
  },
  glock17: {
    id: 'glock17',
    name: 'Glock 17',
    type: 'secondary',
    baseDamage: 26,
    fireRateRPM: 400,
    magSize: 17,
    reloadTimeSec: 1.5,
    baseSoundRadiusPx: 400,
    muzzleFlashRadiusPx: 72,
    reserveAmmo: 51
  },
  mp5sd: {
    id: 'mp5sd',
    name: 'MP5SD Integral',
    type: 'primary',
    baseDamage: 20,
    fireRateRPM: 750,
    magSize: 30,
    reloadTimeSec: 1.9,
    baseSoundRadiusPx: 280,
    muzzleFlashRadiusPx: 40
  },
  vector: {
    id: 'vector',
    name: 'Vector .45 ACP',
    type: 'primary',
    baseDamage: 24,
    fireRateRPM: 900,
    magSize: 25,
    reloadTimeSec: 2.0,
    baseSoundRadiusPx: 420,
    muzzleFlashRadiusPx: 85
  },
  p90: {
    id: 'p90',
    name: 'P90 PDW',
    type: 'primary',
    baseDamage: 19,
    fireRateRPM: 850,
    magSize: 50,
    reloadTimeSec: 2.1,
    baseSoundRadiusPx: 390,
    muzzleFlashRadiusPx: 75
  },
  ak12: {
    id: 'ak12',
    name: 'AK-12 Assault',
    type: 'primary',
    baseDamage: 40,
    fireRateRPM: 600,
    magSize: 30,
    reloadTimeSec: 2.3,
    baseSoundRadiusPx: 670,
    muzzleFlashRadiusPx: 155,
    reserveAmmo: 90
  },
  dmr: {
    id: 'dmr',
    name: 'DMR Marksman',
    type: 'primary',
    baseDamage: 72,
    fireRateRPM: 120,
    magSize: 10,
    reloadTimeSec: 2.6,
    baseSoundRadiusPx: 720,
    muzzleFlashRadiusPx: 170,
    reserveAmmo: 40
  },
  p226: {
    id: 'p226',
    name: 'P226 Suppressed',
    type: 'secondary',
    baseDamage: 28,
    fireRateRPM: 360,
    magSize: 15,
    reloadTimeSec: 1.6,
    baseSoundRadiusPx: 320,
    muzzleFlashRadiusPx: 55,
    reserveAmmo: 45
  },
  deagle: {
    id: 'deagle',
    name: 'Desert Eagle .50',
    type: 'secondary',
    baseDamage: 72,
    fireRateRPM: 180,
    magSize: 7,
    reloadTimeSec: 2.4,
    baseSoundRadiusPx: 780,
    muzzleFlashRadiusPx: 200,
    reserveAmmo: 28
  }
};

/** Armory dropdown order (tier progression within each slot). */
export const PRIMARY_WEAPON_ARMORY_ORDER: string[] = [
  'mpx',
  'mp5sd',
  'vector',
  'p90',
  'crossbow',
  'm4a1',
  'ak12',
  'dmr',
  'shotgun'
];

export const SECONDARY_WEAPON_ARMORY_ORDER: string[] = ['glock17', 'p226', 'deagle', 'revolver', 'knife'];

// recoilMult scales hitscan spread in CombatSystem (lower = tighter grouping).
// moveSpeedMult applies while that weapon is drawn (walk/sprint/sneak).
export const MUZZLE_MODIFIERS: Record<
  MuzzleType,
  { soundMult: number; flashMult: number; recoilMult: number; dmgMult: number; moveSpeedMult: number }
> = {
  none: { soundMult: 1.0, flashMult: 1.0, recoilMult: 1.0, dmgMult: 1.0, moveSpeedMult: 1.0 },
  tactical_suppressor: { soundMult: 0.5, flashMult: 0.35, recoilMult: 1.03, dmgMult: 0.95, moveSpeedMult: 1.0 },
  titanium_suppressor: { soundMult: 0.35, flashMult: 0.3, recoilMult: 1.05, dmgMult: 0.92, moveSpeedMult: 0.95 },
  monolithic_suppressor: { soundMult: 0.15, flashMult: 0.2, recoilMult: 1.08, dmgMult: 0.88, moveSpeedMult: 0.92 },
  muzzle_brake: { soundMult: 1.0, flashMult: 1.25, recoilMult: 0.6, dmgMult: 1.08, moveSpeedMult: 1.0 },
  compensator: { soundMult: 1.0, flashMult: 1.0, recoilMult: 0.75, dmgMult: 1.03, moveSpeedMult: 1.0 },
  flash_hider: { soundMult: 1.0, flashMult: 0.05, recoilMult: 0.9, dmgMult: 1.0, moveSpeedMult: 1.0 }
};

export const MUZZLE_ARMORY_ORDER: MuzzleType[] = [
  'none',
  'tactical_suppressor',
  'titanium_suppressor',
  'monolithic_suppressor',
  'muzzle_brake',
  'compensator',
  'flash_hider'
];

export function isSuppressedMuzzle(muzzle: MuzzleType): boolean {
  return muzzle === 'tactical_suppressor' || muzzle === 'titanium_suppressor' || muzzle === 'monolithic_suppressor';
}

/** Maps pre-v0.48 armory saves onto the new suppressor line-up. */
export function normalizeMuzzleType(raw: string | undefined, fallback: MuzzleType): MuzzleType {
  if (raw === 'suppressor') return 'tactical_suppressor';
  if (raw && Object.prototype.hasOwnProperty.call(MUZZLE_MODIFIERS, raw)) return raw as MuzzleType;
  return fallback;
}

export const AMMO_MODIFIERS: Record<AmmoType, { soundMult: number; armorPen: number; dmgMult: number }> = {
  standard: { soundMult: 1.0, armorPen: 0, dmgMult: 1.0 },
  subsonic: { soundMult: 0.75, armorPen: -0.20, dmgMult: 0.90 },
  // Was 1.45 — a +45% damage buff for only +5% sound made it a near-free
  // upgrade over standard in every non-armored case. Left with a real edge,
  // not a strict replacement.
  hollow_point: { soundMult: 1.05, armorPen: -0.45, dmgMult: 1.20 },
  armor_piercing: { soundMult: 1.20, armorPen: 0.85, dmgMult: 0.95 }
};

export const RAIL_MODIFIERS: Record<RailType, { coneAngleRad: number; rangePx: number; hipAccuracyBonus: number; alertsZombies: boolean }> = {
  none: { coneAngleRad: 0, rangePx: 0, hipAccuracyBonus: 0, alertsZombies: false },
  flood_light: { coneAngleRad: (95 * Math.PI) / 180, rangePx: 460, hipAccuracyBonus: 0.1, alertsZombies: true },
  spotlight: { coneAngleRad: (55 * Math.PI) / 180, rangePx: 700, hipAccuracyBonus: 0.15, alertsZombies: true },
  green_laser: { coneAngleRad: (1 * Math.PI) / 180, rangePx: 1200, hipAccuracyBonus: 0.45, alertsZombies: false },
  uv_blacklight: { coneAngleRad: (50 * Math.PI) / 180, rangePx: 250, hipAccuracyBonus: 0, alertsZombies: false }
};
