import { describe, it, expect } from 'vitest';
import { AISystem } from '../src/systems/AISystem';
import { NoiseSystem } from '../src/systems/NoiseSystem';
import { MapManager } from '../src/systems/MapManager';
import { Zombie } from '../src/entities/Zombie';
import { Player, WeaponLoadout } from '../src/entities/Player';
import {
  DORMANT_NOTICE_RADIUS,
  SUSPICIOUS_NOTICE_RADIUS,
  SNEAK_NOISE_RADIUS,
  WALK_NOISE_RADIUS,
  GUNSHOT_ENRAGE_THRESHOLD,
  ZOMBIE_ENRAGE_THRESHOLD
} from '../src/config/constants';

const loadout: WeaponLoadout = {
  primaryWeapon: 'mpx',
  secondaryWeapon: 'glock17',
  primaryMuzzle: 'none',
  secondaryMuzzle: 'none',
  // No rail light, so only proximity can wake the zombie in these tests.
  primaryRail: 'none',
  secondaryRail: 'none',
  primaryAmmoType: 'standard',
  secondaryAmmoType: 'standard'
};

// Open floor in Sector 1, left of the first wall column (x 310).
const ZX = 150;
const ZY = 360;

const setup = (dist: number, noise: number, state: 'DORMANT' | 'SUSPICIOUS' = 'DORMANT', archetype: 'lurker' | 'audio_stalker' = 'lurker') => {
  const map = new MapManager();
  const z = new Zombie(ZX, ZY, Math.PI, archetype);
  if (state === 'SUSPICIOUS') z.alert('SUSPICIOUS', { x: ZX, y: ZY });
  const p = new Player(1, ZX + dist, ZY, 100, loadout);
  p.noiseRadius = noise;
  new AISystem().update(1 / 60, [z], [p], map);
  return z;
};

describe('close-range detection', () => {
  it('a dormant zombie wakes enraged when a walking player comes within reach', () => {
    expect(setup(DORMANT_NOTICE_RADIUS - 5, WALK_NOISE_RADIUS).state).toBe('ENRAGED');
  });

  it('but not just outside it', () => {
    expect(setup(DORMANT_NOTICE_RADIUS + 5, WALK_NOISE_RADIUS).state).toBe('DORMANT');
  });

  it('sneaking or standing still slips past, even point-blank', () => {
    expect(setup(20, SNEAK_NOISE_RADIUS).state).toBe('DORMANT');
    expect(setup(20, 0).state).toBe('DORMANT');
  });

  it('a suspicious zombie notices from further away', () => {
    const between = (DORMANT_NOTICE_RADIUS + SUSPICIOUS_NOTICE_RADIUS) / 2;
    expect(setup(between, WALK_NOISE_RADIUS, 'DORMANT').state).toBe('DORMANT');
    expect(setup(between, WALK_NOISE_RADIUS, 'SUSPICIOUS').state).toBe('ENRAGED');
    expect(setup(between, SNEAK_NOISE_RADIUS, 'SUSPICIOUS').state).not.toBe('ENRAGED');
  });

  it('works on blind audio-stalkers too', () => {
    expect(setup(DORMANT_NOTICE_RADIUS - 5, WALK_NOISE_RADIUS, 'DORMANT', 'audio_stalker').state).toBe('ENRAGED');
  });

  it('does not see through walls', () => {
    // Sector 1's first wall box spans x 310-395, y 20-260: zombie on one side, player on the other.
    const map = new MapManager();
    // 95px apart — inside the suspicious notice radius, so only the wall hides the player.
    const z = new Zombie(303, 150, 0, 'lurker');
    z.alert('SUSPICIOUS', { x: 303, y: 150 });
    const p = new Player(1, 398, 150, 100, loadout);
    expect(Math.hypot(p.x - z.x, p.y - z.y)).toBeLessThan(SUSPICIOUS_NOTICE_RADIUS);
    p.noiseRadius = WALK_NOISE_RADIUS;
    new AISystem().update(1 / 60, [z], [p], map);
    expect(z.state).not.toBe('ENRAGED');
  });

  it('ignores downed players', () => {
    const map = new MapManager();
    const z = new Zombie(ZX, ZY, 0, 'lurker');
    const p = new Player(1, ZX + 10, ZY, 100, loadout);
    p.noiseRadius = WALK_NOISE_RADIUS;
    p.down();
    new AISystem().update(1 / 60, [z], [p], map);
    expect(z.state).toBe('DORMANT');
  });
});

describe('gunshots enrage from further away than other sounds', () => {
  const origin = { x: 100, y: 360 };
  const hear = (type: 'gunshot' | 'footstep', intensity: number) => {
    const radius = 200;
    const z = new Zombie(origin.x + radius * (1 - intensity), origin.y, 0, 'lurker');
    const noise = new NoiseSystem();
    noise.emit({ ...origin, radius, type });
    noise.propagate([z], new MapManager());
    return z.state;
  };
  const between = (GUNSHOT_ENRAGE_THRESHOLD + ZOMBIE_ENRAGE_THRESHOLD) / 2;

  it('a gunshot enrages at an intensity where a footstep only raises suspicion', () => {
    expect(hear('gunshot', between)).toBe('ENRAGED');
    expect(hear('footstep', between)).toBe('SUSPICIOUS');
  });

  it('a faint gunshot still only raises suspicion', () => {
    expect(hear('gunshot', GUNSHOT_ENRAGE_THRESHOLD - 0.1)).toBe('SUSPICIOUS');
  });
});
