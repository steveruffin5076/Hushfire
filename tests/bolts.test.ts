import { describe, it, expect } from 'vitest';
import { collectStuckBolts, BOLT_PICKUP_RADIUS } from '../src/systems/CombatSystem';
import { Projectile } from '../src/entities/Projectile';
import { Player, WeaponLoadout } from '../src/entities/Player';

const loadout = (primaryWeapon: string, secondaryWeapon: string): WeaponLoadout => ({
  primaryWeapon, secondaryWeapon, primaryMuzzle: 'none', secondaryMuzzle: 'none',
  primaryRail: 'none', secondaryRail: 'none', primaryAmmoType: 'standard', secondaryAmmoType: 'standard'
});

const stuckBoltAt = (x: number, y: number) => {
  const b = new Projectile(x, y, 0, 115, 1, 0);
  b.stick();
  return b;
};

describe('crossbow bolt retrieval', () => {
  it('a crossbow carrier walking over a stuck bolt gets it back', () => {
    const p = new Player(1, 100, 100, 100, loadout('crossbow', 'knife'));
    const before = p.reserveAmmo;
    const left = collectStuckBolts([stuckBoltAt(110, 100)], [p]);
    expect(left).toHaveLength(0);
    expect(p.reserveAmmo).toBe(before + 1);
  });

  it('works when the crossbow is in either slot, even while the other gun is drawn', () => {
    const p = new Player(1, 100, 100, 100, loadout('mpx', 'crossbow'));
    p.activeSlot = 'secondary';
    const before = p.reserveAmmo;
    p.activeSlot = 'primary';
    collectStuckBolts([stuckBoltAt(100, 100)], [p]);
    p.activeSlot = 'secondary';
    expect(p.reserveAmmo).toBe(before + 1);
  });

  it('leaves bolts that are out of reach, still flying, or walked over by someone without a crossbow', () => {
    const archer = new Player(1, 100, 100, 100, loadout('crossbow', 'knife'));
    const far = stuckBoltAt(100 + BOLT_PICKUP_RADIUS + 5, 100);
    const flying = new Projectile(100, 100, 0, 115, 1, 0);
    expect(collectStuckBolts([far, flying], [archer])).toHaveLength(2);

    const rifleman = new Player(2, 100, 100, 100, loadout('mpx', 'glock17'));
    expect(collectStuckBolts([stuckBoltAt(100, 100)], [rifleman])).toHaveLength(1);
  });

  it('downed operatives cannot pick bolts up', () => {
    const p = new Player(1, 100, 100, 100, loadout('crossbow', 'knife'));
    p.down();
    expect(collectStuckBolts([stuckBoltAt(100, 100)], [p])).toHaveLength(1);
  });
});
