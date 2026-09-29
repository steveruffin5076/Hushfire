/** Throwable types issued with the Grenade Pouch operative gear. */
export type ThrowableKind = 'he' | 'incendiary' | 'flashbang' | 'flare';

export const THROWABLE_ORDER: ThrowableKind[] = ['he', 'incendiary', 'flashbang', 'flare'];

export const THROWABLE_LABELS: Record<ThrowableKind, string> = {
  he: 'HE Grenade',
  incendiary: 'Incendiary',
  flashbang: 'Flashbang',
  flare: 'Flare'
};

export const THROWABLE_SHORT: Record<ThrowableKind, string> = {
  he: 'HE',
  incendiary: 'INC',
  flashbang: 'FLASH',
  flare: 'FLARE'
};

/** Max ground distance from the thrower — mouse aim is clamped to this arc. */
export const THROW_MAX_RANGE_PX = 300;
export const THROW_SPEED_PX_PER_SEC = 540;
export const THROW_COOLDOWN_SEC = 0.45;

/** Starting counts when Grenade Pouch is equipped at deploy. */
export const GRENADE_POUCH_STARTING: Record<ThrowableKind, number> = {
  he: 1,
  incendiary: 1,
  flashbang: 2,
  flare: 2
};

export const THROWABLE_EFFECT = {
  he: { radius: 95, damage: 130, noise: 720, flashSec: 0 },
  incendiary: { radius: 80, damage: 55, noise: 420, burnSec: 6 },
  flashbang: { radius: 150, damage: 0, noise: 480, stunSec: 4.5 },
  flare: { radius: 300, noise: 220, durationSec: 28 }
} as const;
