import { describe, it, expect } from 'vitest';
import { tutorialHint } from '../src/config/tutorial';

describe('sector 1 tutorial hints', () => {
  it('shows early noise tip', () => {
    expect(tutorialHint(0, 2, 0, false)).toMatch(/NOISE/);
  });

  it('is silent after sector 1', () => {
    expect(tutorialHint(1, 10, 0, false)).toBeNull();
  });
});
