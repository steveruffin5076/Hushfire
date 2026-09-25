import { describe, it, expect } from 'vitest';
import { CombatSystem } from '../src/systems/CombatSystem';
import { MapManager } from '../src/systems/MapManager';
import { NoiseSystem } from '../src/systems/NoiseSystem';
import { isSectorAlertingShot } from '../src/systems/HordeSurge';
import { Player, WeaponLoadout } from '../src/entities/Player';
import { Zombie } from '../src/entities/Zombie';
import { WEAPON_REGISTRY, MUZZLE_MODIFIERS, AMMO_MODIFIERS } from '../src/config/weapons';
import { SECTOR_ALERT_SOUND_RADIUS_PX } from '../src/config/constants';

const loudLoadout: WeaponLoadout = {
  primaryWeapon: 'shotgun',
  secondaryWeapon: 'knife',
  primaryMuzzle: 'none',
  secondaryMuzzle: 'none',
  primaryRail: 'none',
  secondaryRail: 'none',
  primaryAmmoType: 'standard',
  secondaryAmmoType: 'standard'
};

const stealthLoadout: WeaponLoadout = {
  primaryWeapon: 'mpx',
  secondaryWeapon: 'knife',
  primaryMuzzle: 'suppressor',
  secondaryMuzzle: 'none',
  primaryRail: 'none',
  secondaryRail: 'none',
  primaryAmmoType: 'standard',
  secondaryAmmoType: 'standard'
};

const soundRadius = (weaponId: string, muzzle: WeaponLoadout['primaryMuzzle'], ammo: WeaponLoadout['primaryAmmoType']) => {
  const weapon = WEAPON_REGISTRY[weaponId];
  return weapon.baseSoundRadiusPx * MUZZLE_MODIFIERS[muzzle].soundMult * AMMO_MODIFIERS[ammo].soundMult;
};

describe('isSectorAlertingShot', () => {
  it('flags loud unsuppressed guns', () => {
    expect(isSectorAlertingShot(soundRadius('shotgun', 'none', 'standard'))).toBe(true);
    expect(isSectorAlertingShot(soundRadius('mpx', 'none', 'standard'))).toBe(true);
  });

  it('does not flag stealth-ready suppressed light guns', () => {
    expect(isSectorAlertingShot(soundRadius('mpx', 'suppressor', 'standard'))).toBe(false);
    expect(isSectorAlertingShot(soundRadius('glock17', 'suppressor', 'standard'))).toBe(false);
  });

  it('does not flag silent weapons', () => {
    expect(isSectorAlertingShot(WEAPON_REGISTRY.crossbow.baseSoundRadiusPx, true)).toBe(false);
    expect(isSectorAlertingShot(WEAPON_REGISTRY.knife.baseSoundRadiusPx, true)).toBe(false);
  });

  it('uses the shared sector alert threshold', () => {
    expect(isSectorAlertingShot(SECTOR_ALERT_SOUND_RADIUS_PX)).toBe(false);
    expect(isSectorAlertingShot(SECTOR_ALERT_SOUND_RADIUS_PX + 1)).toBe(true);
  });
});

describe('sector alert callback', () => {
  it('fires for an unsuppressed shotgun but not a suppressed SMG', () => {
    const map = new MapManager();
    const noise = new NoiseSystem();
    let sectorAlerts = 0;
    const combat = new CombatSystem(map, noise, {
      onSectorAlertingShot: () => {
        sectorAlerts++;
      }
    });

    const loud = new Player(1, 150, 360, 100, loudLoadout);
    loud.lastShotTime = -1e9;
    combat.fire(loud, [], [], []);

    const quiet = new Player(1, 150, 360, 100, stealthLoadout);
    quiet.lastShotTime = -1e9;
    combat.fire(quiet, [], [], []);

    expect(sectorAlerts).toBe(1);
  });

  it('can wake every zombie in the sector regardless of walls', () => {
    const map = new MapManager();
    const zombies = map.layout.zombies.map(s => new Zombie(s.x, s.y, s.angle, s.archetype));
    const spawn = map.sector.playerSpawns[0];
    const source = { x: spawn.x, y: spawn.y };
    for (const zombie of zombies) zombie.alert('ENRAGED', source);
    expect(zombies.every(z => z.state === 'ENRAGED')).toBe(true);
  });
});
