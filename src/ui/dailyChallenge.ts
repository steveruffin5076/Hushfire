import { mulberry32 } from '../core/seededRand';

/** UTC date stamp for today's daily challenge seed (stable for 24h). */
export function dailyChallengeSeed(date = new Date()): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return y * 10000 + m * 100 + d;
}

export function dailyChallengeLabel(date = new Date()): string {
  const seed = dailyChallengeSeed(date);
  return `DAILY #${seed % 10000}`;
}

export function dailyChallengeRand(date = new Date()): () => number {
  return mulberry32(dailyChallengeSeed(date));
}
