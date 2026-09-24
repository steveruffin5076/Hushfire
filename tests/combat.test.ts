import { describe, it, expect } from 'vitest';
import { CombatSystem } from '../src/systems/CombatSystem';
import { MapManager } from '../src/systems/MapManager';
import { NoiseSystem } from '../src/systems/NoiseSystem';
import { angleBetween } from '../src/systems/Geometry';
import { Player, WeaponLoadout } from '../src/entities/Player';
import { Zombie } from '../src/entities/Zombie';
import { WEAPON_REGISTRY } from '../src/config/weapons';
import { ZOMBIE_REGISTRY } from '../src/config/zombies';

const loadout = (primaryWeapon: string, secondaryWeapon: string): WeaponLoadout => ({
  primaryWeapon,
  secondaryWeapon,
  primaryMuzzle: 'none',
  secondaryMuzzle: 'none',
  primaryRail: 'none',
  secondaryRail: 'none',
  primaryAmmoType: 'standard',
  secondaryAmmoType: 'standard'
});

// Open floor in Sector 1, clear of walls.
const X = 150;
const Y = 360;

const knifer = () => {
  const p = new Player(1, X, Y, 100, loadout('mpx', 'knife'));
  p.activeSlot = 'secondary';
  return p;
};

/** One knife swing, bypassing the fire-rate timer. */
const swing = (combat: CombatSystem, p: Player, z: Zombie) => {
  p.lastShotTime = -1e9;
  combat.fire(p, [z], [], []);
};

describe('angleBetween', () => {
  it('is the smallest angle, in [0, π], for any inputs', () => {
    expect(angleBetween(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    expect(angleBetween(-3, 3)).toBeCloseTo(2 * Math.PI - 6);
    // atan2 result + π can land past π — the case that broke the old armour
    // check, whose single fold gave 2π - 2.8π = -0.8π (negative, so "frontal").
    expect(angleBetween(-Math.PI * 0.9, Math.PI * 0.9 + Math.PI)).toBeCloseTo(Math.PI * 0.8);
  });
});

describe('knife backstab', () => {
  const combat = new CombatSystem(new MapManager(), new NoiseSystem());
  const brute = () => ZOMBIE_REGISTRY.armored_brute.maxHealth;

  it('kills from behind (attacker in the zombie’s rear arc)', () => {
    const p = knifer();
    p.angle = 0; // facing +X
    const z = new Zombie(X + 30, Y, 0, 'armored_brute'); // facing away from the player
    swing(combat, p, z);
    expect(z.alive).toBe(false);
  });

  it('does not backstab face-to-face (the old inverted behaviour)', () => {
    const p = knifer();
    p.angle = 0;
    const z = new Zombie(X + 30, Y, Math.PI, 'armored_brute'); // facing the player
    swing(combat, p, z);
    expect(z.alive).toBe(true);
    // Plain 60 damage into frontal armour (×0.25).
    expect(brute() - z.health).toBeCloseTo(WEAPON_REGISTRY.knife.baseDamage * 0.25);
  });

  it('treats a flank stab as a normal hit', () => {
    const p = knifer();
    p.angle = 0;
    const z = new Zombie(X + 30, Y, Math.PI / 2, 'armored_brute'); // side-on
    swing(combat, p, z);
    expect(z.alive).toBe(true);
  });
});

describe('brute armour', () => {
  const combat = new CombatSystem(new MapManager(), new NoiseSystem());

  it('only reduces hits that come from the front, including near the ±π wrap', () => {
    // Zombie facing almost exactly -X (angle just past -π wraps to near +π).
    for (const facing of [Math.PI - 0.01, -Math.PI + 0.01]) {
      const p = knifer();
      p.angle = 0;
      const front = new Zombie(X + 30, Y, facing, 'armored_brute');
      swing(combat, p, front);
      const frontDamage = ZOMBIE_REGISTRY.armored_brute.maxHealth - front.health;
      expect(frontDamage).toBeCloseTo(WEAPON_REGISTRY.knife.baseDamage * 0.25);
    }
  });
});

describe('brute armour — wrap-around case', () => {
  it('does not armour a rear hit whose angles straddle ±π', () => {
    // Shot travels at -0.9π into a brute facing +0.9π: that's a hit in the
    // back (0.8π from "frontal"). The old single-fold check computed a
    // negative difference and wrongly applied the ×0.25 front armour.
    const combat = new CombatSystem(new MapManager(), new NoiseSystem());
    const zx = 400;
    const zy = 360;
    const z = new Zombie(zx, zy, Math.PI * 0.9, 'armored_brute');
    const p = new Player(1, zx + Math.cos(Math.PI * 0.1) * 120, zy + Math.sin(Math.PI * 0.1) * 120, 100, loadout('mpx', 'glock17'));
    p.angle = -Math.PI * 0.9;
    p.lastShotTime = -1e9;
    combat.fire(p, [z], [], []);
    expect(ZOMBIE_REGISTRY.armored_brute.maxHealth - z.health).toBeCloseTo(WEAPON_REGISTRY.mpx.baseDamage);
  });
});

describe('knife ammo', () => {
  it('never runs out and never reloads', () => {
    const p = knifer();
    for (let i = 0; i < 20; i++) {
      p.lastShotTime = -1e9;
      expect(p.canFire()).toBe(true);
      p.consumeShot();
    }
    expect(p.currentMag).toBe(WEAPON_REGISTRY.knife.magSize);
    p.startReload();
    expect(p.isReloading).toBe(false);
  });
});

describe('ammo crate', () => {
  it('gives each gun two mags, capped at its starting reserve', () => {
    const p = new Player(1, X, Y, 100, loadout('mpx', 'glock17'));
    p.reserveAmmo = 10; // primary
    p.activeSlot = 'secondary';
    p.reserveAmmo = 0;
    expect(p.addAmmoPickup()).toBe(true);
    expect(p.reserveAmmo).toBe(WEAPON_REGISTRY.glock17.magSize * 2);
    p.activeSlot = 'primary';
    expect(p.reserveAmmo).toBe(10 + WEAPON_REGISTRY.mpx.magSize * 2);

    // Fill up: the cap is the starting reserve.
    p.addAmmoPickup();
    p.addAmmoPickup();
    expect(p.reserveAmmo).toBe(WEAPON_REGISTRY.mpx.magSize * 4);
  });

  it('is worth 2 bolts to a crossbow, not 60', () => {
    const p = new Player(1, X, Y, 100, loadout('crossbow', 'knife'));
    p.reserveAmmo = 0;
    p.addAmmoPickup();
    expect(p.reserveAmmo).toBe(2);
  });

  it('is left on the floor when both guns are full, and skips the knife', () => {
    const p = new Player(1, X, Y, 100, loadout('mpx', 'knife'));
    expect(p.addAmmoPickup()).toBe(false);
  });
});
