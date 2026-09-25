import { WEAPON_REGISTRY, MUZZLE_MODIFIERS, RAIL_MODIFIERS, AMMO_MODIFIERS } from '../config/weapons';
import { WeaponLoadout } from '../entities/Player';
import { Difficulty, DIFFICULTIES } from '../config/difficulty';

export type GameMode = 'solo' | 'coop' | 'online';

export interface ArmoryState {
  mode: GameMode;
  difficulty: Difficulty;
  loadouts: [WeaponLoadout, WeaponLoadout];
}

export const DEFAULT_LOADOUTS: [WeaponLoadout, WeaponLoadout] = [
  {
    primaryWeapon: 'mpx',
    secondaryWeapon: 'glock17',
    primaryMuzzle: 'suppressor',
    secondaryMuzzle: 'suppressor',
    primaryRail: 'spotlight',
    secondaryRail: 'spotlight',
    primaryAmmoType: 'standard',
    secondaryAmmoType: 'standard'
  },
  {
    primaryWeapon: 'shotgun',
    secondaryWeapon: 'revolver',
    primaryMuzzle: 'muzzle_brake',
    secondaryMuzzle: 'muzzle_brake',
    primaryRail: 'flood_light',
    secondaryRail: 'flood_light',
    primaryAmmoType: 'standard',
    secondaryAmmoType: 'standard'
  }
];

const STORAGE_KEY = 'hushfire.armory.v1';

/** Minimal slice of the Web Storage API, so tests can pass an in-memory stand-in. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** localStorage throws outright in some private-browsing modes and sandboxed iframes, rather than just being empty. */
const defaultStorage = (): KeyValueStorage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const pick = <T extends string>(value: unknown, valid: Record<string, unknown>, fallback: T): T =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(valid, value) ? (value as T) : fallback;

const pickWeapon = (value: unknown, slot: 'primary' | 'secondary', fallback: string): string =>
  typeof value === 'string' && WEAPON_REGISTRY[value]?.type === slot ? value : fallback;

/**
 * Validates field-by-field against the live registries, so a save from an
 * older build (a renamed weapon, a removed attachment) only resets the
 * fields that no longer exist instead of throwing out the whole loadout.
 */
const sanitizeLoadout = (raw: unknown, fallback: WeaponLoadout): WeaponLoadout => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    primaryWeapon: pickWeapon(r.primaryWeapon, 'primary', fallback.primaryWeapon),
    secondaryWeapon: pickWeapon(r.secondaryWeapon, 'secondary', fallback.secondaryWeapon),
    primaryMuzzle: pick(r.primaryMuzzle, MUZZLE_MODIFIERS, fallback.primaryMuzzle),
    secondaryMuzzle: pick(r.secondaryMuzzle, MUZZLE_MODIFIERS, fallback.secondaryMuzzle),
    primaryRail: pick(r.primaryRail, RAIL_MODIFIERS, fallback.primaryRail),
    secondaryRail: pick(r.secondaryRail, RAIL_MODIFIERS, fallback.secondaryRail),
    primaryAmmoType: pick(r.primaryAmmoType, AMMO_MODIFIERS, fallback.primaryAmmoType),
    secondaryAmmoType: pick(r.secondaryAmmoType, AMMO_MODIFIERS, fallback.secondaryAmmoType)
  };
};

/** The last-used mode, difficulty and loadouts, or the defaults when nothing valid is saved. Always returns fresh copies. */
export function loadArmoryState(storage: KeyValueStorage | null = defaultStorage()): ArmoryState {
  let parsed: Record<string, unknown> = {};
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (value && typeof value === 'object') parsed = value as Record<string, unknown>;
  } catch {
    // Unreadable storage or corrupt JSON — fall through to defaults.
  }
  const loadouts = Array.isArray(parsed.loadouts) ? parsed.loadouts : [];
  return {
    mode: parsed.mode === 'coop' ? 'coop' : parsed.mode === 'online' ? 'online' : 'solo',
    difficulty: pick(parsed.difficulty, DIFFICULTIES, 'normal'),
    loadouts: [sanitizeLoadout(loadouts[0], DEFAULT_LOADOUTS[0]), sanitizeLoadout(loadouts[1], DEFAULT_LOADOUTS[1])]
  };
}

/** Best-effort: a full or blocked storage just means the choice isn't remembered next time. */
export function saveArmoryState(state: ArmoryState, storage: KeyValueStorage | null = defaultStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore — persistence is a convenience, never a reason to break the armory.
  }
}
