import { describe, it, expect } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../src/config/difficulty';
import { Zombie } from '../src/entities/Zombie';
import { ZOMBIE_REGISTRY } from '../src/config/zombies';
import { AISystem } from '../src/systems/AISystem';
import { MapManager } from '../src/systems/MapManager';
import { Player, WeaponLoadout } from '../src/entities/Player';
import { surgeInterval, SURGE_MIN_INTERVAL_SEC } from '../src/systems/HordeSurge';
import { SECTORS } from '../src/config/sectors';
import { DORMANT_NOTICE_RADIUS, WALK_NOISE_RADIUS } from '../src/config/constants';

describe('difficulty levels', () => {
  it('NORMAL is exactly the game as already tuned', () => {
    const n = DIFFICULTIES.normal;
    expect(n.zombieHpMult).toBe(1);
    expect(n.noticeMult).toBe(1);
    expect(n.contactDps).toBe(15);
    expect(n.surgeMinIntervalSec).toBe(SURGE_MIN_INTERVAL_SEC);
    expect(n.holdoutSec).toBe(SECTORS[SECTORS.length - 1].evacZone!.holdoutSec);
  });

  it('every knob gets strictly harder from EASY to NORMAL to HARD', () => {
    const [e, n, h] = DIFFICULTY_ORDER.map(d => DIFFICULTIES[d]);
    for (const key of ['zombieHpMult', 'contactDps', 'noticeMult', 'holdoutSec'] as const) {
      expect(e[key], key).toBeLessThan(n[key]);
      expect(n[key], key).toBeLessThan(h[key]);
    }
    // A shorter minimum wave interval is harder.
    expect(e.surgeMinIntervalSec).toBeGreaterThan(n.surgeMinIntervalSec);
    expect(n.surgeMinIntervalSec).toBeGreaterThan(h.surgeMinIntervalSec);
  });

  it('scales zombie health', () => {
    expect(new Zombie(0, 0, 0, 'armored_brute', DIFFICULTIES.hard.zombieHpMult).maxHealth).toBe(
      Math.round(ZOMBIE_REGISTRY.armored_brute.maxHealth * 1.25)
    );
    expect(new Zombie(0, 0, 0, 'lurker').maxHealth).toBe(ZOMBIE_REGISTRY.lurker.maxHealth);
  });

  it('scales how close a zombie notices a walking player', () => {
    const loadout: WeaponLoadout = {
      primaryWeapon: 'mpx', secondaryWeapon: 'glock17', primaryMuzzle: 'none', secondaryMuzzle: 'none',
      primaryRail: 'none', secondaryRail: 'none', primaryAmmoType: 'standard', secondaryAmmoType: 'standard'
    };
    const notices = (noticeMult: number, dist: number) => {
      const z = new Zombie(150, 360, Math.PI, 'lurker');
      const p = new Player(1, 150 + dist, 360, 100, loadout);
      p.noiseRadius = WALK_NOISE_RADIUS;
      new AISystem(noticeMult).update(1 / 60, [z], [p], new MapManager());
      return z.state === 'ENRAGED';
    };
    const justOutsideNormal = DORMANT_NOTICE_RADIUS + 5;
    expect(notices(DIFFICULTIES.normal.noticeMult, justOutsideNormal)).toBe(false);
    expect(notices(DIFFICULTIES.hard.noticeMult, justOutsideNormal)).toBe(true);
    const justInsideNormal = DORMANT_NOTICE_RADIUS - 5;
    expect(notices(DIFFICULTIES.normal.noticeMult, justInsideNormal)).toBe(true);
    expect(notices(DIFFICULTIES.easy.noticeMult, justInsideNormal)).toBe(false);
  });

  it('sets how fast the evac waves can get', () => {
    expect(surgeInterval(1000, DIFFICULTIES.hard.surgeMinIntervalSec)).toBe(3);
    expect(surgeInterval(1000, DIFFICULTIES.easy.surgeMinIntervalSec)).toBe(6);
    expect(surgeInterval(1000)).toBe(SURGE_MIN_INTERVAL_SEC);
  });
});
