/**
 * Difficulty levels, picked in the armory. NORMAL is the game as tuned;
 * HARD mostly restores the harsher values the code was tuned down from
 * (e.g. contact damage was 22/s — see Game.ts's ZOMBIE_CONTACT_DPS note).
 */
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyDef {
  label: string;
  /** One-line summary shown under the armory buttons. */
  blurb: string;
  /** Multiplies every zombie's max health (rounded). */
  zombieHpMult: number;
  /** Health per second an enraged zombie drains on contact. */
  contactDps: number;
  /** Multiplies the close-range notice radii (DORMANT/SUSPICIOUS_NOTICE_RADIUS). */
  noticeMult: number;
  /** Evac holdout length in the final sector. */
  holdoutSec: number;
  /** Fastest the evac horde waves get (see HordeSurge.surgeInterval). */
  surgeMinIntervalSec: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  easy: {
    label: 'EASY',
    blurb: 'Weaker, less watchful zombies. 90s evac hold.',
    zombieHpMult: 0.8,
    contactDps: 11,
    noticeMult: 0.75,
    holdoutSec: 90,
    surgeMinIntervalSec: 6
  },
  normal: {
    label: 'NORMAL',
    blurb: 'The intended balance. 120s evac hold.',
    zombieHpMult: 1,
    contactDps: 15,
    noticeMult: 1,
    holdoutSec: 120,
    surgeMinIntervalSec: 4
  },
  hard: {
    label: 'HARD',
    blurb: 'Tougher, sharper zombies that hit harder. 150s evac hold.',
    zombieHpMult: 1.25,
    contactDps: 22,
    noticeMult: 1.4,
    holdoutSec: 150,
    surgeMinIntervalSec: 3
  }
};

export const DIFFICULTY_ORDER: readonly Difficulty[] = ['easy', 'normal', 'hard'];
