import { LetterGrade } from './LetterGrade';
import { RunStats } from './ExtractionModal';

/** XP required to advance from `level` to `level + 1`. */
export function xpToNextLevel(level: number): number {
  return 100 + Math.max(0, level - 1) * 25;
}

export interface LevelProgress {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  totalXp: number;
}

export function levelProgressFromTotalXp(totalXp: number): LevelProgress {
  const safe = Math.max(0, Math.floor(totalXp));
  let level = 1;
  let spent = 0;
  while (true) {
    const need = xpToNextLevel(level);
    if (safe < spent + need) {
      return { level, xpIntoLevel: safe - spent, xpForNextLevel: need, totalXp: safe };
    }
    spent += need;
    level++;
  }
}

const GRADE_XP: Record<LetterGrade, number> = {
  D: 10,
  C: 25,
  B: 40,
  A: 60,
  S: 100
};

/** Career XP earned from a single run (applied once in recordPlayerProfile). */
export function missionXpFromRun(stats: RunStats, grade: LetterGrade): number {
  let xp = 25;
  if (stats.victory) xp += 75;
  xp += GRADE_XP[grade];
  xp += Math.min(stats.totalKills, 20) * 2;
  if (stats.runKind === 'survival' && stats.survivalWavesCleared) {
    xp += Math.min(stats.survivalWavesCleared, 10) * 5;
  }
  return xp;
}
