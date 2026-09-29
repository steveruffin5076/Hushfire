import { ThrowableKind, THROWABLE_ORDER, GRENADE_POUCH_STARTING, EXTRA_GRENADE_POUCH_EXTRA_HE } from './throwables';
import { isThrowableUnlocked } from '../ui/WeaponUnlocks';
import type { PlayerProfile } from '../ui/PlayerProfile';
import { loadPlayerProfile } from '../ui/PlayerProfile';

/** Which grenade types the operative brings (armory toggles; must be unlocked). */
export type ThrowableCarry = Partial<Record<ThrowableKind, boolean>>;

export const DEFAULT_THROWABLE_CARRY: ThrowableCarry = { flashbang: true };

export function normalizeThrowableCarry(raw: unknown): ThrowableCarry {
  const out: ThrowableCarry = { ...DEFAULT_THROWABLE_CARRY };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  for (const kind of THROWABLE_ORDER) {
    if (typeof r[kind] === 'boolean') out[kind] = r[kind];
  }
  return out;
}

/** Mission inventory from loadout carry flags, profile unlocks, and optional +1 HE gear. */
export function buildThrowableCountsFromLoadout(
  carry: ThrowableCarry,
  profile?: PlayerProfile,
  extraHeFromGear = false
): Record<ThrowableKind, number> {
  const p = profile ?? loadPlayerProfile();
  const counts: Record<ThrowableKind, number> = { he: 0, incendiary: 0, flashbang: 0, flare: 0 };
  for (const kind of THROWABLE_ORDER) {
    if (carry[kind] && isThrowableUnlocked(kind, p)) {
      counts[kind] = GRENADE_POUCH_STARTING[kind];
    }
  }
  if (extraHeFromGear && counts.he > 0) counts.he += EXTRA_GRENADE_POUCH_EXTRA_HE;
  return counts;
}

export function clampThrowableCarry(carry: ThrowableCarry, profile?: PlayerProfile): ThrowableCarry {
  const p = profile ?? loadPlayerProfile();
  const out: ThrowableCarry = {};
  for (const kind of THROWABLE_ORDER) {
    if (!isThrowableUnlocked(kind, p)) {
      out[kind] = false;
      continue;
    }
    out[kind] = carry[kind] ?? (kind === 'flashbang');
  }
  return out;
}
