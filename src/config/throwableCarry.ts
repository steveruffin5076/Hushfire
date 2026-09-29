import { ThrowableKind, THROWABLE_ORDER, GRENADE_POUCH_STARTING, EXTRA_GRENADE_POUCH_EXTRA_HE } from './throwables';
import { isThrowableUnlocked } from '../ui/WeaponUnlocks';
import type { PlayerProfile } from '../ui/PlayerProfile';
import { loadPlayerProfile } from '../ui/PlayerProfile';

/** Which grenade types the operative brings (at most one type may be true). */
export type ThrowableCarry = Partial<Record<ThrowableKind, boolean>>;

export type GrenadePouchSelection = ThrowableKind | 'none';

export const DEFAULT_THROWABLE_CARRY: ThrowableCarry = { flashbang: true };

/** Collapse legacy multi-select saves to a single carried type (first in THROWABLE_ORDER). */
export function collapseThrowableCarry(carry: ThrowableCarry): ThrowableCarry {
  const picked = THROWABLE_ORDER.find(k => carry[k]);
  if (!picked) return {};
  return { [picked]: true };
}

export function getGrenadePouchSelection(carry: ThrowableCarry | undefined): GrenadePouchSelection {
  if (!carry) return 'flashbang';
  const picked = THROWABLE_ORDER.find(k => carry[k]);
  return picked ?? 'none';
}

export function throwableCarryFromSelection(sel: GrenadePouchSelection): ThrowableCarry {
  if (sel === 'none') return {};
  return { [sel]: true };
}

export function normalizeThrowableCarry(raw: unknown): ThrowableCarry {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_THROWABLE_CARRY };
  const r = raw as Record<string, unknown>;
  const merged: ThrowableCarry = {};
  for (const kind of THROWABLE_ORDER) {
    if (typeof r[kind] === 'boolean') merged[kind] = r[kind];
  }
  const hasAnyKey = THROWABLE_ORDER.some(k => k in r);
  if (!hasAnyKey) return { ...DEFAULT_THROWABLE_CARRY };
  return collapseThrowableCarry(merged);
}

/** Mission inventory from loadout carry flags, profile unlocks, and optional +1 HE gear. */
export function buildThrowableCountsFromLoadout(
  carry: ThrowableCarry,
  profile?: PlayerProfile,
  extraHeFromGear = false
): Record<ThrowableKind, number> {
  const p = profile ?? loadPlayerProfile();
  const counts: Record<ThrowableKind, number> = { he: 0, incendiary: 0, flashbang: 0, flare: 0 };
  const sel = getGrenadePouchSelection(carry);
  if (sel !== 'none' && isThrowableUnlocked(sel, p)) {
    counts[sel] = GRENADE_POUCH_STARTING[sel];
  }
  if (extraHeFromGear && counts.he > 0) counts.he += EXTRA_GRENADE_POUCH_EXTRA_HE;
  return counts;
}

export function clampThrowableCarry(carry: ThrowableCarry, profile?: PlayerProfile): ThrowableCarry {
  const p = profile ?? loadPlayerProfile();
  let sel = getGrenadePouchSelection(collapseThrowableCarry(carry));
  if (sel !== 'none' && !isThrowableUnlocked(sel, p)) {
    sel = isThrowableUnlocked('flashbang', p) ? 'flashbang' : 'none';
  }
  return throwableCarryFromSelection(sel);
}
