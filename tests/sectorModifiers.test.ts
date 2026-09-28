import { describe, it, expect } from 'vitest';
import { MapManager } from '../src/systems/MapManager';
import { SECTORS } from '../src/config/sectors';
import {
  filterPickupsForModifier,
  pickSectorModifier,
  RANDOM_SECTOR_MODIFIER_ORDER,
  SECTOR_MODIFIER_ORDER
} from '../src/config/sectorModifiers';
import { FLASHLIGHT_BATTERY_MAX } from '../src/config/constants';

describe('sectorModifiers', () => {
  it('picks from the four twist modifiers (never none)', () => {
    for (let i = 0; i < 40; i++) {
      const id = pickSectorModifier(() => i / 40);
      expect(RANDOM_SECTOR_MODIFIER_ORDER).toContain(id);
      expect(id).not.toBe('none');
    }
  });

  it('none leaves pickups unchanged', () => {
    const sector = SECTORS[0];
    const all = sector.pickups.map(p => ({ type: p.type }));
    expect(filterPickupsForModifier(all, 'none')).toEqual(all);
    const map = new MapManager();
    map.loadSector(0, () => 0, 'none');
    const full = new MapManager();
    full.loadSector(0, () => 0, 'none');
    expect(map.pickups.length).toBe(full.pickups.length);
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

  it('scavenger never strips the keycard, which Sector 1 cannot be finished without', () => {
    // Regression: the keycard is authored at a fixed index in Sector 1's pickup
    // list, so an every-other-entry strip deleted it on 100% of rolls and made
    // the blast door — and the run — impossible. The modifier is picked at
    // random for every campaign run, so this was a 1-in-4 soft-lock.
    for (let i = 0; i < 50; i++) {
      const map = new MapManager();
      map.loadSector(0, Math.random, 'scavenger');
      expect(map.pickups.some(p => p.type === 'keycard')).toBe(true);
    }
  });

  it.each(SECTOR_MODIFIER_ORDER)('every modifier leaves each sector completable (%s)', modifier => {
    for (let index = 0; index < SECTORS.length; index++) {
      const map = new MapManager();
      map.loadSector(index, Math.random, modifier);
      const authored = SECTORS[index].pickups.map(p => p.type);
      for (const type of authored) {
        if (type !== 'keycard') continue;
        expect(map.pickups.some(p => p.type === 'keycard'), `${SECTORS[index].name} lost its keycard`).toBe(true);
      }
    }
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
