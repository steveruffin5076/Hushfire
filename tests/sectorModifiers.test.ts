import { describe, it, expect } from 'vitest';
import { MapManager } from '../src/systems/MapManager';
import { SECTORS } from '../src/config/sectors';
import { filterPickupsForModifier, pickSectorModifier, SECTOR_MODIFIER_ORDER } from '../src/config/sectorModifiers';
import { FLASHLIGHT_BATTERY_MAX } from '../src/config/constants';

describe('sectorModifiers', () => {
  it('picks from the four defined modifiers', () => {
    for (let i = 0; i < 40; i++) {
      expect(SECTOR_MODIFIER_ORDER).toContain(pickSectorModifier(() => i / 40));
    }
  });

  it('blackout strips battery pickups from the sector layout', () => {
    const map = new MapManager();
    map.loadSector(0, () => 0, 'blackout');
    expect(map.pickups.some(p => p.type === 'battery')).toBe(false);
  });

  it('scavenger keeps at most half the sector pickups', () => {
    const map = new MapManager();
    map.loadSector(0, () => 0, 'scavenger');
    const full = new MapManager();
    full.loadSector(0, () => 0);
    expect(map.pickups.length).toBeLessThanOrEqual(Math.ceil(full.pickups.length / 2));
  });

  it('filterPickupsForModifier matches map loading rules', () => {
    const sector = SECTORS[0];
    const all = sector.pickups.map(p => ({ type: p.type }));
    const blackout = filterPickupsForModifier(all, 'blackout');
    expect(blackout.every(p => p.type !== 'battery')).toBe(true);
    const scavenger = filterPickupsForModifier(all, 'scavenger');
    expect(scavenger.length).toBe(Math.ceil(all.length / 2));
  });

  it('blackout starting charge is half a full battery', () => {
    expect(FLASHLIGHT_BATTERY_MAX / 2).toBe(50);
  });
});
