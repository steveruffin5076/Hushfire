import { describe, it, expect } from 'vitest';
import { levelProgressFromTotalXp, missionXpFromRun, xpToNextLevel } from '../src/ui/PlayerProgress';
import { defaultPlayerProfile, loadPlayerProfile, recordPlayerProfile, savePlayerProfile } from '../src/ui/PlayerProfile';
import { RunStats } from '../src/ui/ExtractionModal';

const baseStats = (): RunStats => ({
  victory: true,
  timeSurvivedSec: 400,
  totalKills: 6,
  totalShotsFired: 10,
  sectorReached: 'Sector 3',
  zombiesAlerted: 2,
  silentKills: 4,
  difficulty: 'normal'
});

describe('player progress', () => {
  it('xp thresholds grow per level', () => {
    expect(xpToNextLevel(1)).toBe(100);
    expect(xpToNextLevel(2)).toBe(125);
  });

  it('derives level and in-level XP from lifetime total', () => {
    expect(levelProgressFromTotalXp(0)).toEqual({
      level: 1,
      xpIntoLevel: 0,
      xpForNextLevel: 100,
      totalXp: 0
    });
    expect(levelProgressFromTotalXp(100).level).toBe(2);
    expect(levelProgressFromTotalXp(100).xpIntoLevel).toBe(0);
  });

  it('awards more XP for wins and better grades', () => {
    const win = missionXpFromRun(baseStats(), 'B');
    const loss = missionXpFromRun({ ...baseStats(), victory: false }, 'D');
    expect(win).toBeGreaterThan(loss);
  });

  it('persists totalXp when recording a run', () => {
    const storage = new Map<string, string>();
    const kv = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v)
    };
    savePlayerProfile(defaultPlayerProfile(), kv);
    recordPlayerProfile(baseStats(), kv);
    const loaded = loadPlayerProfile(kv);
    expect(loaded.totalXp).toBeGreaterThan(0);
  });
});
