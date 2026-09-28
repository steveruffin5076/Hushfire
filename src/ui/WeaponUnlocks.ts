import { GRADE_RANK } from './LetterGrade';
import { loadPlayerProfile, PlayerProfile } from './PlayerProfile';
import { WeaponLoadout } from '../entities/Player';
import { WEAPON_REGISTRY } from '../config/weapons';
import { OperativeGearId, OPERATIVE_GEAR_REGISTRY } from '../config/operativeGear';

const ALWAYS = new Set(['mpx', 'glock17', 'knife']);

const gradeAtLeast = (p: PlayerProfile, min: keyof typeof GRADE_RANK) =>
  p.bestGrade !== null && GRADE_RANK[p.bestGrade] >= GRADE_RANK[min];

const UNLOCK_RULES: Record<string, (p: PlayerProfile) => boolean> = {
  mp5sd: p => p.totalWins >= 1,
  vector: p => p.totalWins >= 1 && gradeAtLeast(p, 'C'),
  p90: p => p.totalKillsBest >= 25,
  crossbow: p => p.totalWins >= 1,
  m4a1: p => p.totalWins >= 1 && (p.bestGrade === null || GRADE_RANK[p.bestGrade] >= GRADE_RANK.B),
  ak12: p => p.totalWins >= 2,
  dmr: p => gradeAtLeast(p, 'A'),
  shotgun: p => p.totalKillsBest >= 10,
  p226: p => p.totalKillsBest >= 5,
  deagle: p => p.totalKillsBest >= 10,
  revolver: p => gradeAtLeast(p, 'A')
};

const UNLOCK_HINT: Record<string, string> = {
  mp5sd: 'Win any extraction',
  vector: 'Win with grade C or better',
  p90: '25+ kills in one run',
  crossbow: 'Win any extraction',
  m4a1: 'Win with grade B or better',
  ak12: 'Win 2 extractions',
  dmr: 'Earn grade A or S on a win',
  shotgun: '10+ kills in one run',
  p226: '5+ kills in one run',
  deagle: '10+ kills in one run',
  revolver: 'Earn grade A or S on a win'
};

const GEAR_UNLOCK_RULES: Record<Exclude<OperativeGearId, 'none'>, (p: PlayerProfile) => boolean> = {
  nvg: p => p.totalWins >= 1,
  flare_pack: p => p.totalWins >= 2
};

const GEAR_UNLOCK_HINT: Record<Exclude<OperativeGearId, 'none'>, string> = {
  nvg: 'Win any extraction',
  flare_pack: 'Win 2 extractions'
};

export function isWeaponUnlocked(weaponId: string, profile?: PlayerProfile): boolean {
  if (ALWAYS.has(weaponId)) return true;
  const p = profile ?? loadPlayerProfile();
  const rule = UNLOCK_RULES[weaponId];
  return rule ? rule(p) : true;
}

export function weaponUnlockHint(weaponId: string): string {
  return UNLOCK_HINT[weaponId] ?? '';
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
  const gear: OperativeGearId =
    isGearUnlocked(loadout.operativeGear ?? 'none', p) && OPERATIVE_GEAR_REGISTRY[loadout.operativeGear ?? 'none']
      ? (loadout.operativeGear ?? 'none')
      : 'none';
  return { ...loadout, primaryWeapon: primary, secondaryWeapon: secondary, operativeGear: gear };
}
