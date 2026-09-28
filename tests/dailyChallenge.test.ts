import { describe, it, expect } from 'vitest';
import { dailyChallengeSeed, dailyChallengeLabel } from '../src/ui/dailyChallenge';

describe('daily challenge', () => {
  it('seed is stable for a UTC date', () => {
    const d = new Date('2026-09-28T12:00:00Z');
    expect(dailyChallengeSeed(d)).toBe(20260928);
    expect(dailyChallengeLabel(d)).toContain('928');
  });
});
