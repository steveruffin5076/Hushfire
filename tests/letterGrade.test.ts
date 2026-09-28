import { describe, it, expect } from 'vitest';
import { missionLetterGrade } from '../src/ui/LetterGrade';
import { RunStats } from '../src/ui/ExtractionModal';

const base = (): RunStats => ({
  victory: true,
  timeSurvivedSec: 400,
  totalKills: 10,
  totalShotsFired: 30,
  sectorReached: 'SECTOR 3',
  zombiesAlerted: 1,
  silentKills: 5,
  difficulty: 'NORMAL'
});

describe('mission letter grade', () => {
  it('fails map to D', () => {
    expect(missionLetterGrade({ ...base(), victory: false })).toBe('D');
  });

  it('ghost stealth + fast win can reach S', () => {
    expect(missionLetterGrade({ ...base(), zombiesAlerted: 0, timeSurvivedSec: 300, silentKills: 5 })).toBe('S');
  });
});
