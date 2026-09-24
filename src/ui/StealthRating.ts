/**
 * End-of-run stealth grade, from how many zombies the team alerted (a zombie
 * going ENRAGED while alive — silent kills don't count, and evac surge
 * zombies arrive enraged so they're excluded). Kept pure for unit tests.
 */
export type StealthRating = 'GHOST' | 'SHADOW' | 'OPERATOR' | 'LOUD';

export function stealthRating(zombiesAlerted: number): StealthRating {
  if (zombiesAlerted === 0) return 'GHOST';
  if (zombiesAlerted <= 3) return 'SHADOW';
  if (zombiesAlerted <= 8) return 'OPERATOR';
  return 'LOUD';
}

export const RATING_COLOR: Record<StealthRating, string> = {
  GHOST: '#00E5FF',
  SHADOW: '#00E676',
  OPERATOR: '#FFC107',
  LOUD: '#FF5252'
};
