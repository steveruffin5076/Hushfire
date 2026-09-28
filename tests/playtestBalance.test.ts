import { describe, it, expect } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../src/config/difficulty';
import { ZOMBIE_REGISTRY } from '../src/config/zombies';
import { SECTORS } from '../src/config/sectors';
import { surgeInterval } from '../src/systems/HordeSurge';
import { SECTOR_HORDE_COOLDOWN_SEC } from '../src/config/constants';

/** Sanity checks from automated playtest / balance review (progress.md §7 item 1). */
describe('playtest balance review', () => {
  const sectorHp = (hpMult: number) =>
    SECTORS.reduce((sum, sector) => {
      const sectorSum = sector.zombies.reduce((s, z) => s + Math.round(ZOMBIE_REGISTRY[z.archetype].maxHealth * hpMult), 0);
      return sum + sectorSum;
    }, 0);

  it('EASY contact damage is survivable for ~7s of continuous grapple', () => {
    const dps = DIFFICULTIES.easy.contactDps;
    const timeToDown = 100 / dps;
    expect(timeToDown).toBeGreaterThanOrEqual(7);
    expect(timeToDown).toBeLessThanOrEqual(12);
  });

  it('HARD contact damage threatens faster than NORMAL', () => {
    expect(100 / DIFFICULTIES.hard.contactDps).toBeLessThan(100 / DIFFICULTIES.normal.contactDps);
  });

  it('total zombie HP scales up across difficulties', () => {
    const easy = sectorHp(DIFFICULTIES.easy.zombieHpMult);
    const normal = sectorHp(DIFFICULTIES.normal.zombieHpMult);
    const hard = sectorHp(DIFFICULTIES.hard.zombieHpMult);
    expect(normal).toBeGreaterThan(easy);
    expect(hard).toBeGreaterThan(normal);
  });

  it('evac wave pacing tightens on HARD vs EASY', () => {
    const easyMin = surgeInterval(120, DIFFICULTIES.easy.surgeMinIntervalSec);
    const hardMin = surgeInterval(120, DIFFICULTIES.hard.surgeMinIntervalSec);
    expect(hardMin).toBeLessThan(easyMin);
  });

  it('sector horde reinforcement cooldown is long enough to avoid per-bullet spam', () => {
    expect(SECTOR_HORDE_COOLDOWN_SEC).toBeGreaterThanOrEqual(6);
  });

  it('every difficulty exposes a distinct evac holdout length', () => {
    const holds = DIFFICULTY_ORDER.map(d => DIFFICULTIES[d].holdoutSec);
    expect(new Set(holds).size).toBe(3);
  });

  it('NORMAL offers the longest comfortable window before HARD overtakes contact threat', () => {
    const normalGrapple = 100 / DIFFICULTIES.normal.contactDps;
    const hardGrapple = 100 / DIFFICULTIES.hard.contactDps;
    expect(normalGrapple - hardGrapple).toBeGreaterThanOrEqual(2);
  });
});
