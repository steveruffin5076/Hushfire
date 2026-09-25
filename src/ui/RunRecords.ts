import { Difficulty, DIFFICULTIES } from '../config/difficulty';
import { RunStats } from './ExtractionModal';
import { KeyValueStorage } from './LoadoutStorage';

const STORAGE_KEY = 'hushfire.records.v1';

export interface DifficultyRecords {
  bestTimeSurvivedSec: number;
  bestKills: number;
  /** Lowest zombies-alerted on a victorious run; null until the first win. */
  bestStealthAlerts: number | null;
}

export interface RunRecords {
  byDifficulty: Record<Difficulty, DifficultyRecords>;
}

const emptyDifficultyRecords = (): DifficultyRecords => ({
  bestTimeSurvivedSec: 0,
  bestKills: 0,
  bestStealthAlerts: null
});

export const defaultRunRecords = (): RunRecords => ({
  byDifficulty: {
    easy: emptyDifficultyRecords(),
    normal: emptyDifficultyRecords(),
    hard: emptyDifficultyRecords()
  }
});

const defaultStorage = (): KeyValueStorage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const difficultyFromLabel = (label: string): Difficulty => {
  const entry = Object.entries(DIFFICULTIES).find(([, def]) => def.label === label);
  return (entry?.[0] as Difficulty) ?? 'normal';
};

export function loadRunRecords(storage: KeyValueStorage | null = defaultStorage()): RunRecords {
  const base = defaultRunRecords();
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return base;
    const byDifficulty = (parsed as { byDifficulty?: Record<string, Partial<DifficultyRecords>> }).byDifficulty;
    if (!byDifficulty) return base;
    for (const key of Object.keys(DIFFICULTIES) as Difficulty[]) {
      const saved = byDifficulty[key];
      if (!saved || typeof saved !== 'object') continue;
      base.byDifficulty[key] = {
        bestTimeSurvivedSec: typeof saved.bestTimeSurvivedSec === 'number' ? saved.bestTimeSurvivedSec : 0,
        bestKills: typeof saved.bestKills === 'number' ? saved.bestKills : 0,
        bestStealthAlerts: typeof saved.bestStealthAlerts === 'number' ? saved.bestStealthAlerts : null
      };
    }
  } catch {
    // Corrupt storage — fall back to empty records.
  }
  return base;
}

export function saveRunRecords(records: RunRecords, storage: KeyValueStorage | null = defaultStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Persistence is a convenience, never a hard requirement.
  }
}

/** Updates stored bests for this run's difficulty. Returns human labels for any new records. */
export function recordRun(stats: RunStats, storage: KeyValueStorage | null = defaultStorage()): string[] {
  const records = loadRunRecords(storage);
  const key = difficultyFromLabel(stats.difficulty);
  const slot = records.byDifficulty[key];
  const newBest: string[] = [];

  if (stats.timeSurvivedSec > slot.bestTimeSurvivedSec) {
    slot.bestTimeSurvivedSec = stats.timeSurvivedSec;
    newBest.push('TIME SURVIVED');
  }
  if (stats.totalKills > slot.bestKills) {
    slot.bestKills = stats.totalKills;
    newBest.push('KILLS');
  }
  if (stats.victory && (slot.bestStealthAlerts === null || stats.zombiesAlerted < slot.bestStealthAlerts)) {
    slot.bestStealthAlerts = stats.zombiesAlerted;
    newBest.push('STEALTH');
  }

  if (newBest.length > 0) saveRunRecords(records, storage);
  return newBest;
}

export function recordsForDifficulty(difficultyLabel: string, storage: KeyValueStorage | null = defaultStorage()): DifficultyRecords {
  return loadRunRecords(storage).byDifficulty[difficultyFromLabel(difficultyLabel)];
}
