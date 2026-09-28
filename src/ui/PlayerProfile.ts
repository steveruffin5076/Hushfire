import { LetterGrade, betterGrade, missionLetterGrade } from './LetterGrade';
import { RunStats } from './ExtractionModal';
import { KeyValueStorage } from './LoadoutStorage';

const STORAGE_KEY = 'hushfire.profile.v1';

export interface PlayerProfile {
  totalWins: number;
  bestGrade: LetterGrade | null;
  totalKillsBest: number;
}

export const defaultPlayerProfile = (): PlayerProfile => ({
  totalWins: 0,
  bestGrade: null,
  totalKillsBest: 0
});

const defaultStorage = (): KeyValueStorage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export function loadPlayerProfile(storage: KeyValueStorage | null = defaultStorage()): PlayerProfile {
  const base = defaultPlayerProfile();
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return base;
    const o = parsed as Partial<PlayerProfile>;
    if (typeof o.totalWins === 'number') base.totalWins = o.totalWins;
    if (o.bestGrade === 'S' || o.bestGrade === 'A' || o.bestGrade === 'B' || o.bestGrade === 'C' || o.bestGrade === 'D') {
      base.bestGrade = o.bestGrade;
    }
    if (typeof o.totalKillsBest === 'number') base.totalKillsBest = o.totalKillsBest;
  } catch {
    // ignore
  }
  return base;
}

export function savePlayerProfile(profile: PlayerProfile, storage: KeyValueStorage | null = defaultStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

/** Updates career stats after a run; returns the run's letter grade. */
export function recordPlayerProfile(stats: RunStats, storage: KeyValueStorage | null = defaultStorage()): LetterGrade {
  const profile = loadPlayerProfile(storage);
  const grade = missionLetterGrade(stats);
  if (stats.victory) profile.totalWins++;
  profile.bestGrade = betterGrade(grade, profile.bestGrade);
  if (stats.totalKills > profile.totalKillsBest) profile.totalKillsBest = stats.totalKills;
  savePlayerProfile(profile, storage);
  return grade;
}
