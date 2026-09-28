import { RunStats } from './ExtractionModal';
import { stealthRating } from './StealthRating';

export type LetterGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export const GRADE_RANK: Record<LetterGrade, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };

export const GRADE_COLOR: Record<LetterGrade, string> = {
  S: '#00E5FF',
  A: '#00E676',
  B: '#FFC107',
  C: '#FF9100',
  D: '#FF5252'
};

/** End-of-run letter grade from victory, stealth, tempo and kills. */
export function missionLetterGrade(stats: RunStats): LetterGrade {
  if (!stats.victory) return 'D';

  const stealth = stealthRating(stats.zombiesAlerted);
  let score = 0;
  if (stealth === 'GHOST') score += 3;
  else if (stealth === 'SHADOW') score += 2;
  else if (stealth === 'OPERATOR') score += 1;

  if (stats.timeSurvivedSec <= 420) score += 2;
  else if (stats.timeSurvivedSec <= 600) score += 1;

  if (stats.silentKills >= 4) score += 1;
  if (stats.totalKills >= 8) score += 1;

  if (score >= 6) return 'S';
  if (score >= 5) return 'A';
  if (score >= 3) return 'B';
  if (score >= 2) return 'C';
  return 'D';
}

export function betterGrade(a: LetterGrade, b: LetterGrade | null): LetterGrade {
  if (!b) return a;
  return GRADE_RANK[a] >= GRADE_RANK[b] ? a : b;
}

export function nextGradeGoal(stats: RunStats, best: LetterGrade | null): string {
  const current = missionLetterGrade(stats);
  if (!best || GRADE_RANK[current] > GRADE_RANK[best]) {
    return `New best mission grade: ${current}`;
  }
  const target: LetterGrade =
    current === 'D' ? 'C' : current === 'C' ? 'B' : current === 'B' ? 'A' : current === 'A' ? 'S' : 'S';
  if (target === 'S' && current === 'S') return 'Hold S — fewer alerts or faster time';
  return `Next goal: earn ${target} on ${stats.difficulty}`;
}
