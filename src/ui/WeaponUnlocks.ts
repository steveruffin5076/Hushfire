import { GRADE_RANK } from './LetterGrade';
import { loadPlayerProfile, PlayerProfile } from './PlayerProfile';
import { WeaponLoadout } from '../entities/Player';
import { WEAPON_REGISTRY } from '../config/weapons';

const ALWAYS = new Set(['mpx', 'glock17', 'knife']);

const UNLOCK_RULES: Record<string, (p: PlayerProfile) => boolean> = {
  crossbow: p => p.totalWins >= 1,
  m4a1: p => p.totalWins >= 1 && (p.bestGrade === null || GRADE_RANK[p.bestGrade] >= GRADE_RANK.B),
  shotgun: p => p.totalKillsBest >= 10,
  revolver: p => p.bestGrade !== null && GRADE_RANK[p.bestGrade] >= GRADE_RANK.A
};

const UNLOCK_HINT: Record<string, string> = {
  crossbow: 'Win any extraction',
  m4a1: 'Win with grade B or better',
  shotgun: '10+ kills in one run',
  revolver: 'Earn grade A or S on a win'
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
  return { ...loadout, primaryWeapon: primary, secondaryWeapon: secondary };
}
