import { describe, it, expect } from 'vitest';
import { WEAPON_REGISTRY, MUZZLE_MODIFIERS, AMMO_MODIFIERS } from '../src/config/weapons';
import { SECTOR_ALERT_SOUND_RADIUS_PX } from '../src/config/constants';

const suppressedRadius = (id: string) =>
  WEAPON_REGISTRY[id].baseSoundRadiusPx * MUZZLE_MODIFIERS.suppressor.soundMult * AMMO_MODIFIERS.standard.soundMult;

describe('suppressor balance', () => {
  it('keeps the light guns stealthy', () => {
    expect(suppressedRadius('mpx')).toBeLessThanOrEqual(SECTOR_ALERT_SOUND_RADIUS_PX);
    expect(suppressedRadius('glock17')).toBeLessThanOrEqual(SECTOR_ALERT_SOUND_RADIUS_PX);
  });

  it('does not make the heavy guns silent', () => {
    for (const id of ['m4a1', 'shotgun', 'revolver']) {
      expect(suppressedRadius(id), id).toBeGreaterThan(SECTOR_ALERT_SOUND_RADIUS_PX);
    }
  });

  it('leaves the crossbow as the quietest ranged option', () => {
    const crossbow = WEAPON_REGISTRY.crossbow.baseSoundRadiusPx;
    for (const id of ['mpx', 'glock17', 'm4a1', 'shotgun', 'revolver']) {
      expect(suppressedRadius(id), id).toBeGreaterThan(crossbow);
    }
  });
});

describe('recoilMult spread', () => {
  const baseSpreadRad = 0.015;

  it('muzzle brake tightens grouping vs bare barrel', () => {
    const bare = baseSpreadRad * MUZZLE_MODIFIERS.none.recoilMult;
    const brake = baseSpreadRad * MUZZLE_MODIFIERS.muzzle_brake.recoilMult;
    expect(brake).toBeLessThan(bare);
  });

  it('suppressor widens grouping slightly', () => {
    const bare = baseSpreadRad * MUZZLE_MODIFIERS.none.recoilMult;
    const suppressed = baseSpreadRad * MUZZLE_MODIFIERS.suppressor.recoilMult;
    expect(suppressed).toBeGreaterThan(bare);
  });
});
