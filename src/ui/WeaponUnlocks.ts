import { GRADE_RANK } from './LetterGrade';
import { loadPlayerProfile, PlayerProfile } from './PlayerProfile';
import { WeaponLoadout } from '../entities/Player';
import { MuzzleType, WEAPON_REGISTRY } from '../config/weapons';
import { OperativeGearId, OPERATIVE_GEAR_REGISTRY } from '../config/operativeGear';

const ALWAYS = new Set(['mpx', 'glock17', 'knife']);

const gradeAtLeast = (p: PlayerProfile, min: keyof typeof GRADE_RANK) =>
  p.bestGrade !== null && GRADE_RANK[p.bestGrade] >= GRADE_RANK[min];

const UNLOCK_RULES: Record<string, (p: PlayerProfile) => boolean> = {
  mp5sd: p => p.totalWins >= 2,
  vector: p => p.totalWins >= 2 && gradeAtLeast(p, 'B'),
  p90: p => p.totalKillsBest >= 40,
  crossbow: p => p.totalWins >= 2 && gradeAtLeast(p, 'C'),
  m4a1: p => p.totalWins >= 3 && gradeAtLeast(p, 'B'),
  ak12: p => p.totalWins >= 4,
  dmr: p => p.totalWins >= 4 && gradeAtLeast(p, 'A'),
  shotgun: p => p.totalWins >= 2 && p.totalKillsBest >= 15,
  p226: p => p.totalWins >= 1 && p.totalKillsBest >= 10,
  deagle: p => p.totalKillsBest >= 20,
  revolver: p => p.totalWins >= 3 && gradeAtLeast(p, 'A')
};

const UNLOCK_HINT: Record<string, string> = {
  mp5sd: 'Win 2 extractions',
  vector: 'Win 2× with grade B or better',
  p90: '40+ kills in one run',
  crossbow: 'Win 2× with grade C or better',
  m4a1: 'Win 3× with grade B or better',
  ak12: 'Win 4 extractions',
  dmr: 'Win 4× with grade A or S',
  shotgun: 'Win 2× and 15+ kills in one run',
  p226: 'Win once and 10+ kills in one run',
  deagle: '20+ kills in one run',
  revolver: 'Win 3× with grade A or S'
};

const MUZZLE_ALWAYS = new Set<MuzzleType>(['none', 'tactical_suppressor', 'muzzle_brake', 'compensator', 'flash_hider']);

const MUZZLE_UNLOCK_RULES: Partial<Record<MuzzleType, (p: PlayerProfile) => boolean>> = {
  titanium_suppressor: p => p.totalWins >= 1,
  monolithic_suppressor: p => p.totalWins >= 1 && gradeAtLeast(p, 'B')
};

const MUZZLE_UNLOCK_HINT: Partial<Record<MuzzleType, string>> = {
  titanium_suppressor: 'Win any extraction',
  monolithic_suppressor: 'Win with grade B or better'
};

const GEAR_UNLOCK_RULES: Record<Exclude<OperativeGearId, 'none'>, (p: PlayerProfile) => boolean> = {
  extra_ammo: p => p.totalKillsBest >= 5,
  extra_battery: p => p.totalWins >= 1,
  nvg: p => p.totalWins >= 1,
  flare_pack: p => p.totalWins >= 2,
  grenade_pouch: p => p.totalWins >= 2 && gradeAtLeast(p, 'C'),
  extra_grenade_pouches: p => p.totalWins >= 3 && gradeAtLeast(p, 'B')
};

const GEAR_UNLOCK_HINT: Record<Exclude<OperativeGearId, 'none'>, string> = {
  extra_ammo: '5+ kills in one run',
  extra_battery: 'Win any extraction',
  nvg: 'Win any extraction',
  flare_pack: 'Win 2 extractions',
  grenade_pouch: 'Win 2× with grade C or better',
  extra_grenade_pouches: 'Win 3× with grade B or better'
};

const DEFAULT_MUZZLE: MuzzleType = 'tactical_suppressor';

export function isWeaponUnlocked(weaponId: string, profile?: PlayerProfile): boolean {
  if (ALWAYS.has(weaponId)) return true;
  const p = profile ?? loadPlayerProfile();
  const rule = UNLOCK_RULES[weaponId];
  return rule ? rule(p) : true;
}

export function weaponUnlockHint(weaponId: string): string {
  return UNLOCK_HINT[weaponId] ?? '';
}

export function isMuzzleUnlocked(muzzle: MuzzleType, profile?: PlayerProfile): boolean {
  if (MUZZLE_ALWAYS.has(muzzle)) return true;
  const p = profile ?? loadPlayerProfile();
  const rule = MUZZLE_UNLOCK_RULES[muzzle];
  return rule ? rule(p) : true;
}

export function muzzleUnlockHint(muzzle: MuzzleType): string {
  return MUZZLE_UNLOCK_HINT[muzzle] ?? '';
}

export function isGearUnlocked(gearId: OperativeGearId, profile?: PlayerProfile): boolean {
  if (gearId === 'none') return true;
  const p = profile ?? loadPlayerProfile();
  const rule = GEAR_UNLOCK_RULES[gearId];
  return rule ? rule(p) : true;
}

export function gearUnlockHint(gearId: OperativeGearId): string {
  if (gearId === 'none') return '';
  return GEAR_UNLOCK_HINT[gearId] ?? '';
}

export function listUnlockedWeaponIds(profile?: PlayerProfile): string[] {
  const p = profile ?? loadPlayerProfile();
  return Object.keys(UNLOCK_RULES).filter(id => UNLOCK_RULES[id](p)).concat([...ALWAYS]);
}

const STARTER_PRIMARY = 'mpx';
const STARTER_SECONDARY = 'glock17';
const STARTER_MELEE = 'knife';

/** Ensures saved or default loadouts never reference locked weapons (e.g. fresh profile + legacy P2 defaults). */
export function clampLoadoutToUnlocks(loadout: WeaponLoadout, profile?: PlayerProfile): WeaponLoadout {
  const p = profile ?? loadPlayerProfile();
  const primary =
    isWeaponUnlocked(loadout.primaryWeapon, p) && WEAPON_REGISTRY[loadout.primaryWeapon]?.type === 'primary'
      ? loadout.primaryWeapon
      : STARTER_PRIMARY;
  const secondary =
    isWeaponUnlocked(loadout.secondaryWeapon, p) && WEAPON_REGISTRY[loadout.secondaryWeapon]?.type === 'secondary'
      ? loadout.secondaryWeapon
      : STARTER_SECONDARY;
  const melee =
    isWeaponUnlocked(loadout.meleeWeapon, p) && WEAPON_REGISTRY[loadout.meleeWeapon]?.type === 'melee'
      ? loadout.meleeWeapon
      : STARTER_MELEE;
  const gear: OperativeGearId =
    isGearUnlocked(loadout.operativeGear ?? 'none', p) && OPERATIVE_GEAR_REGISTRY[loadout.operativeGear ?? 'none']
      ? (loadout.operativeGear ?? 'none')
      : 'none';
  const primaryMuzzle = isMuzzleUnlocked(loadout.primaryMuzzle, p) ? loadout.primaryMuzzle : DEFAULT_MUZZLE;
  const secondaryMuzzle = isMuzzleUnlocked(loadout.secondaryMuzzle, p) ? loadout.secondaryMuzzle : DEFAULT_MUZZLE;
  return {
    ...loadout,
    primaryWeapon: primary,
    secondaryWeapon: secondary,
    meleeWeapon: melee,
    primaryMuzzle,
    secondaryMuzzle,
    operativeGear: gear
  };
}
