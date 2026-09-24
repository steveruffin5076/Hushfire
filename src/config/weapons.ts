export type MuzzleType = 'none' | 'suppressor' | 'muzzle_brake' | 'compensator' | 'flash_hider';
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
  }
};

// recoilMult is intentionally unused right now (no spread/accuracy model exists
// yet) — muzzle_brake/compensator's sound & damage numbers are set to stand on
// their own as real tradeoffs rather than leaning on a stat nothing reads.
export const MUZZLE_MODIFIERS: Record<MuzzleType, { soundMult: number; flashMult: number; recoilMult: number; dmgMult: number }> = {
  none: { soundMult: 1.0, flashMult: 1.0, recoilMult: 1.0, dmgMult: 1.0 },
  // Was 0.15: that made any gun near-silent for only -10% damage (a suppressed
  // hollow-point M4 was ~102px and still one-shot lurkers), leaving the
  // crossbow's silence pointless. At 0.35 the light guns stay stealthy
  // (MPX 133px, Glock 140px) but the M4 (227px) and the big guns don't.
  suppressor: { soundMult: 0.35, flashMult: 0.30, recoilMult: 1.05, dmgMult: 0.90 },
  muzzle_brake: { soundMult: 1.0, flashMult: 1.25, recoilMult: 0.60, dmgMult: 1.08 },
  compensator: { soundMult: 1.0, flashMult: 1.0, recoilMult: 0.75, dmgMult: 1.03 },
  flash_hider: { soundMult: 1.0, flashMult: 0.05, recoilMult: 0.90, dmgMult: 1.0 }
};

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
