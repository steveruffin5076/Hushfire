import { describe, it, expect } from 'vitest';
import { dailyChallengeSeed, dailyChallengeLabel, dailyChallengeModifier } from '../src/ui/dailyChallenge';
import { RANDOM_SECTOR_MODIFIER_ORDER } from '../src/config/sectorModifiers';

describe('daily challenge', () => {
  it('seed is stable for a UTC date', () => {
    const d = new Date('2026-09-28T12:00:00Z');
    expect(dailyChallengeSeed(d)).toBe(20260928);
    expect(dailyChallengeLabel(d)).toContain('928');
  });

  it('gives the same run modifier to everyone on a given UTC day', () => {
    // Regression: the daily twist used to be rolled at random (and rerollable)
    // when the armory opened, so two players on the same day had different runs.
    const morning = new Date('2026-09-28T00:30:00Z');
    const evening = new Date('2026-09-28T23:30:00Z');
    expect(dailyChallengeModifier(morning)).toBe(dailyChallengeModifier(evening));
  });

  it('picks a real modifier, and varies across days', () => {
    const seen = new Set<string>();
    for (let day = 1; day <= 28; day++) {
      const d = new Date(Date.UTC(2026, 5, day));
      const modifier = dailyChallengeModifier(d);
      expect(RANDOM_SECTOR_MODIFIER_ORDER).toContain(modifier);
      expect(modifier).not.toBe('none');
      seen.add(modifier);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
