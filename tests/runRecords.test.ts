import { describe, it, expect } from 'vitest';
import { loadRunRecords, recordRun, defaultRunRecords } from '../src/ui/RunRecords';
import { KeyValueStorage } from '../src/ui/LoadoutStorage';
import { RunStats } from '../src/ui/ExtractionModal';

const memoryStorage = (): KeyValueStorage & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: key => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    }
  };
};

const sampleStats = (overrides: Partial<RunStats> = {}): RunStats => ({
  victory: true,
  timeSurvivedSec: 300,
  totalKills: 12,
  totalShotsFired: 40,
  sectorReached: 'SECTOR 3 — HELIPAD',
  zombiesAlerted: 2,
  silentKills: 5,
  difficulty: 'NORMAL',
  ...overrides
});

describe('run records', () => {
  it('starts empty per difficulty', () => {
    expect(loadRunRecords(memoryStorage())).toEqual(defaultRunRecords());
  });

  it('records new bests and returns which categories improved', () => {
    const storage = memoryStorage();
    const first = recordRun(sampleStats(), storage);
    expect(first).toEqual(['TIME SURVIVED', 'KILLS', 'STEALTH']);

    const second = recordRun(sampleStats({ timeSurvivedSec: 250, totalKills: 8, zombiesAlerted: 4 }), storage);
    expect(second).toEqual([]);

    const third = recordRun(sampleStats({ timeSurvivedSec: 400, totalKills: 15, zombiesAlerted: 0 }), storage);
    expect(third).toEqual(['TIME SURVIVED', 'KILLS', 'STEALTH']);
    expect(loadRunRecords(storage).byDifficulty.normal.bestTimeSurvivedSec).toBe(400);
  });

  it('only updates stealth bests on victorious runs', () => {
    const storage = memoryStorage();
    recordRun(sampleStats({ zombiesAlerted: 0 }), storage);
    const loss = recordRun(sampleStats({ victory: false, zombiesAlerted: 0 }), storage);
    expect(loss).not.toContain('STEALTH');
    expect(loadRunRecords(storage).byDifficulty.normal.bestStealthAlerts).toBe(0);
  });
});
