import { describe, it, expect } from 'vitest';
import { WEAPON_REGISTRY, MUZZLE_MODIFIERS, AMMO_MODIFIERS } from '../src/config/weapons';
import { SECTOR_ALERT_SOUND_RADIUS_PX } from '../src/config/constants';

const suppressedRadius = (id: string, muzzle: keyof typeof MUZZLE_MODIFIERS) =>
  WEAPON_REGISTRY[id].baseSoundRadiusPx * MUZZLE_MODIFIERS[muzzle].soundMult * AMMO_MODIFIERS.standard.soundMult;

describe('suppressor balance', () => {
  it('titanium suppressor keeps the light guns stealthy', () => {
    expect(suppressedRadius('mpx', 'titanium_suppressor')).toBeLessThanOrEqual(SECTOR_ALERT_SOUND_RADIUS_PX);
    expect(suppressedRadius('glock17', 'titanium_suppressor')).toBeLessThanOrEqual(SECTOR_ALERT_SOUND_RADIUS_PX);
  });

  it('tactical suppressor cuts sound in half but light guns may still alert the sector', () => {
    expect(suppressedRadius('mpx', 'tactical_suppressor')).toBeGreaterThan(SECTOR_ALERT_SOUND_RADIUS_PX);
    expect(suppressedRadius('mpx', 'tactical_suppressor')).toBeLessThan(suppressedRadius('mpx', 'none'));
  });

  it('titanium suppressor does not make the heavy guns silent', () => {
    for (const id of ['m4a1', 'shotgun', 'revolver']) {
      expect(suppressedRadius(id, 'titanium_suppressor'), id).toBeGreaterThan(SECTOR_ALERT_SOUND_RADIUS_PX);
    }
  });

  it('leaves the crossbow as the quietest ranged option', () => {
    const crossbow = WEAPON_REGISTRY.crossbow.baseSoundRadiusPx;
    for (const id of ['mpx', 'glock17', 'm4a1', 'shotgun', 'revolver']) {
      expect(suppressedRadius(id, 'titanium_suppressor'), id).toBeGreaterThan(crossbow);
    }
  });

  it('monolithic suppressor slows movement more than titanium', () => {
    expect(MUZZLE_MODIFIERS.monolithic_suppressor.moveSpeedMult).toBeLessThan(
      MUZZLE_MODIFIERS.titanium_suppressor.moveSpeedMult
    );
    expect(MUZZLE_MODIFIERS.tactical_suppressor.moveSpeedMult).toBe(1);
  });
});

describe('recoilMult spread', () => {
  const baseSpreadRad = 0.015;

  it('muzzle brake tightens grouping vs bare barrel', () => {
    const bare = baseSpreadRad * MUZZLE_MODIFIERS.none.recoilMult;
    const brake = baseSpreadRad * MUZZLE_MODIFIERS.muzzle_brake.recoilMult;
    expect(brake).toBeLessThan(bare);
  });

  it('titanium suppressor widens grouping slightly', () => {
    const bare = baseSpreadRad * MUZZLE_MODIFIERS.none.recoilMult;
    const suppressed = baseSpreadRad * MUZZLE_MODIFIERS.titanium_suppressor.recoilMult;
    expect(suppressed).toBeGreaterThan(bare);
  });
});
