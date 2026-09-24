import { describe, it, expect } from 'vitest';
import { loadArmoryState, saveArmoryState, DEFAULT_LOADOUTS, KeyValueStorage } from '../src/ui/LoadoutStorage';

const memoryStorage = (initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } => {
  const data = { ...initial };
  return {
    data,
    getItem: key => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    }
  };
};

describe('armory persistence', () => {
  it('falls back to solo + defaults when nothing is saved', () => {
    expect(loadArmoryState(memoryStorage())).toEqual({ mode: 'solo', loadouts: DEFAULT_LOADOUTS });
    expect(loadArmoryState(null)).toEqual({ mode: 'solo', loadouts: DEFAULT_LOADOUTS });
  });

  it('returns copies, never the shared defaults', () => {
    const state = loadArmoryState(memoryStorage());
    state.loadouts[0].primaryWeapon = 'shotgun';
    expect(DEFAULT_LOADOUTS[0].primaryWeapon).toBe('mpx');
  });

  it('round-trips mode and both loadouts', () => {
    const storage = memoryStorage();
    const state = loadArmoryState(storage);
    state.mode = 'coop';
    state.loadouts[0] = { ...state.loadouts[0], primaryWeapon: 'shotgun', primaryRail: 'green_laser', secondaryAmmoType: 'subsonic' };
    state.loadouts[1] = { ...state.loadouts[1], secondaryMuzzle: 'suppressor' };
    saveArmoryState(state, storage);
    expect(loadArmoryState(storage)).toEqual(state);
  });

  it('resets only the fields that are no longer valid', () => {
    const storage = memoryStorage();
    saveArmoryState(
      {
        mode: 'coop',
        loadouts: [
          // Unknown weapon, a secondary in the primary slot, and a removed attachment.
          { ...DEFAULT_LOADOUTS[0], primaryWeapon: 'railgun', secondaryWeapon: 'shotgun', primaryRail: 'plasma' as never, primaryAmmoType: 'subsonic' },
          DEFAULT_LOADOUTS[1]
        ]
      },
      storage
    );
    const loaded = loadArmoryState(storage);
    expect(loaded.mode).toBe('coop');
    expect(loaded.loadouts[0]).toEqual({ ...DEFAULT_LOADOUTS[0], primaryAmmoType: 'subsonic' });
  });

  it('survives corrupt JSON and storage that throws', () => {
    expect(loadArmoryState(memoryStorage({ 'hushfire.armory.v1': '{not json' }))).toEqual({ mode: 'solo', loadouts: DEFAULT_LOADOUTS });
    const throwing: KeyValueStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      }
    };
    expect(loadArmoryState(throwing).mode).toBe('solo');
    expect(() => saveArmoryState({ mode: 'coop', loadouts: DEFAULT_LOADOUTS }, throwing)).not.toThrow();
  });
});
